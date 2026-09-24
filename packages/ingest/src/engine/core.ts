// Engine adapter over @ks/core (Architecture §6.1–6.3). Implements the ingest `Engine` seam.
//
// Where @ks/core and the old local stand-in (./cells.ts, ./health.ts) disagree we follow core
// (it implements the red-teamed spec). Differences, each deliberate:
//  D1 Prior strengths m_k are FITTED by core's empirical-Bayes method of moments (bounded 0.5..500)
//     instead of the fixed `input.priorStrength` table. A fit that lands on a bound is degenerate
//     (thin data), and only then does that signal keep its published prior. Reported in facts stats.
//  D2 Fusion weights are renormalised per (occupation, quarter) over the signals that observed that
//     occupation (core), not once per quarter over all signals (local). An occupation seen only
//     by Udyam gets Udyam's full level instead of 40% of it.
//  D3 Intervals are core's parametric bootstrap over each signal's Gamma posterior
//     (core's default 400 draws: ~25 s for the 170k-cell batch vs ~7 s at 100; KS_BOOTSTRAP
//     overrides), not the local delta-method approximation.
//  D4 Coverage is core's hires-weighted Σ_k w_k·n_k/(n_k+m_k) per district, not a flat sum.
//  D5 Mismatch is core's mismatchIndex: occupations that only have supply count too, and it is
//     NOT capped at 1 (the local engine clipped it). 0 = balanced, 1 = misplaced people equal demand.
//  D6 Course Health uses core.courseHealth: relevance credits a skill only when it is taught at
//     ≥ the required level (local gave half credit below it), demand is taken in the course's
//     spill-over catchment M, outcomes use core's piecewise Beta-binomial score, REVISE needs demand
//     evidence, and explain[] sentences come from core's humaniser (people, not percentages).
//  D7 Declining skills are core.detectDecliningSkills on statewide quarterly SDI (Theil–Sen < 0,
//     exact Mann–Kendall, BH q < 0.1, sustained two quarters). The local "low statewide demand"
//     rule (below 20% of the median skill) is NOT applied: it is not in the spec and trips OBSOLETE
//     for every niche skill.
//  D8 Division and state rates pool only the districts that observed the signal (core), so a
//     district with no postings borrows the per-capita posting rate of its observed peers, not
//     that rate diluted over the whole division's population (local).
// Kept from the data agent's design, on top of core:
//  K1 Level calibration: non-anchor signals are rescaled per quarter so their statewide shrunk level
//     matches Udyam's (the anchor) on the occupations both observe, so postings/surveys shape the
//     mix but cannot swing the level. (The local engine matched TOTALS, which inflated the few
//     occupations a 66-posting sample covers up to all of Udyam's hires; see calibrate().)
//     Done with cheap core passes (no profiles, 20 draws) before the full run.
//  K2 Mismatch is computed over trainable occupations only (`trainableNcos`, passed to core as the
//     occupation filter and as `supplyOnlyNcos`).
//  K3 Transversal skills are excluded from headlines in @ks/db's readers; cells still carry them.
import {
  PRIOR_STRENGTH_BOUNDS, buildSupply, computeDemand, courseHealth, detectDecliningSkills, districtCoverage, mismatchIndex,
  type HiresEstimate, type SeriesPoint, type SkillProfiles, type Spillover, type SupplyIndex,
} from "@ks/core";
import type { Course, CourseHealth, DemandCell, Proficiency, SignalKind, SignalObservation } from "@ks/contracts";
import type {
  DemandFactOut, DistrictMetricOut, Engine, EngineInput, EngineOutput, HealthInput, OccupationCell, SupplyFactOut,
} from "./types";

const KINDS: SignalKind[] = ["udyam", "postings", "surveys", "consultations"];
const SKILL_ONLY = "__skill_supply__"; // synthetic target occupation for skill-level supply rows
const key = (...xs: Array<string | number>) => xs.join("|");
const round = (x: number, dp = 1) => Math.round(x * 10 ** dp) / 10 ** dp;
const sum = (xs: Iterable<number>) => { let s = 0; for (const x of xs) s += x; return s; };

export function bootstrapDraws(): number {
  const b = Number(process.env.KS_BOOTSTRAP);
  return Number.isFinite(b) && b >= 20 ? Math.floor(b) : 400;
}

/** P(s ≥ p | o) for p = 1..required, so demand is cumulative in proficiency (core emits listed pairs only). */
export function toSkillProfiles(profiles: EngineInput["profiles"]): SkillProfiles {
  const out: SkillProfiles = {};
  for (const p of profiles) {
    const list = (out[p.nco] ??= []);
    for (let q = 1; q <= Math.min(4, Math.max(1, p.proficiency)); q++) {
      list.push({ skillId: p.skillId, proficiency: q as Proficiency, prob: Math.min(1, Math.max(0, p.weight)) });
    }
  }
  return out;
}

export function toSpillover(spill: EngineInput["spill"]): Spillover {
  const M: Spillover = {};
  for (const s of spill) (M[s.from] ??= {})[s.to] = (M[s.from]?.[s.to] ?? 0) + s.share;
  return M;
}

/** Supply rows → synthetic courses so core.buildSupply applies the spill-over matrix. */
function supplyIndex(rows: Array<{ lgd: string; nco: string; skillId?: string; proficiency?: number; completers: number }>, M: Spillover): SupplyIndex {
  const completers: Record<string, number> = {};
  const courses: Course[] = rows.map((r, i) => {
    const id = `s${i}`;
    completers[id] = r.completers;
    return {
      id, institutionId: "", institutionName: "", lgd: r.lgd, name: "", code: "", kind: "state", targetNco: r.nco, seats: 0,
      durationHours: 0, isDemo: false,
      skills: r.skillId ? [{ skillId: r.skillId, proficiency: (r.proficiency ?? 1) as Proficiency, hours: 0, assessed: false }] : [],
    };
  });
  return buildSupply(courses, { completers, spillover: M });
}

/**
 * K1: per-quarter scale factors that bring each signal's statewide shrunk level to the anchor's.
 * Returns the scaled observations, the prior strengths to use (guarded, D1) and the raw fit.
 */
export function calibrate(inp: EngineInput, divisionOf: Record<string, string>, exposure: Record<string, number>) {
  // Cheap passes: no skill profiles, 20 draws. The first only fits m_k.
  const fitted = computeDemand(inp.observations, divisionOf, {}, { weights: inp.weights, exposure, bootstrap: 20, priorStrength: "estimate" }).priorStrength;
  // D1 guard: a fit that lands on a bound is degenerate (too few units, or no detectable spread or
  // noise), so that signal falls back to its published prior.
  const priorStrength = { ...fitted };
  for (const k of KINDS) {
    const m = priorStrength[k];
    if (m <= PRIOR_STRENGTH_BOUNDS.min || m >= PRIOR_STRENGTH_BOUNDS.max) priorStrength[k] = inp.priorStrength[k];
  }
  const pass1 = computeDemand(inp.observations, divisionOf, {}, { weights: inp.weights, exposure, bootstrap: 20, priorStrength });
  // Statewide shrunk totals per (signal, quarter, occupation).
  const totals = new Map<string, Map<string, number>>(); // kind|quarter → nco → Σ shrunk
  for (const h of pass1.hires) {
    for (const k of KINDS) {
      const s = h.signals[k]?.shrunk ?? 0;
      if (s <= 0) continue;
      const kq = key(k, h.quarter);
      if (!totals.has(kq)) totals.set(kq, new Map());
      const m = totals.get(kq)!;
      m.set(h.nco, (m.get(h.nco) ?? 0) + s);
    }
  }
  // The scale is fitted on the occupations both the signal and the anchor observe: postings and
  // surveys sample a few occupations, so matching their TOTAL to Udyam's would inflate those few
  // many-fold. With no overlap, the totals are matched instead.
  const scale = new Map<string, number>();
  for (const q of inp.quarters) {
    const present = KINDS.filter((k) => totals.has(key(k, q)));
    const anchorKind = present.includes("udyam") ? "udyam"
      : present.sort((a, b) => sum(totals.get(key(b, q))!.values()) - sum(totals.get(key(a, q))!.values()))[0];
    if (!anchorKind) continue;
    const anchor = totals.get(key(anchorKind, q))!;
    for (const k of present) {
      if (k === anchorKind) { scale.set(key(k, q), 1); continue; }
      const mine = totals.get(key(k, q))!;
      const common = [...mine.keys()].filter((o) => (anchor.get(o) ?? 0) > 0);
      const [a, b] = common.length
        ? [sum(common.map((o) => anchor.get(o)!)), sum(common.map((o) => mine.get(o)!))]
        : [sum(anchor.values()), sum(mine.values())];
      scale.set(key(k, q), b > 0 ? a / b : 1);
    }
  }
  const observations: SignalObservation[] = inp.observations.map((o) => ({ ...o, hires12m: o.hires12m * (scale.get(key(o.kind, o.quarter)) ?? 1) }));
  return { observations, priorStrength, fitted, scale };
}

export function computeCellsCore(inp: EngineInput): EngineOutput & { priorStrength: Record<SignalKind, number> } {
  const divisionOf = Object.fromEntries(inp.districts.map((d) => [d.lgd, d.division]));
  const exposure = Object.fromEntries(inp.districts.map((d) => [d.lgd, Math.max(1, d.population)]));
  const quarters = new Set(inp.quarters);
  const cal = calibrate({ ...inp, observations: inp.observations.filter((o) => quarters.has(o.quarter)) }, divisionOf, exposure);
  const demand = computeDemand(cal.observations, divisionOf, toSkillProfiles(inp.profiles), {
    weights: inp.weights, exposure, priorStrength: cal.priorStrength, baseQuarter: inp.baseQuarter, bootstrap: bootstrapDraws(),
  });

  const M = toSpillover(inp.spill);
  const skillSupply = supplyIndex(inp.supply.map((s) => ({ ...s, nco: SKILL_ONLY })), M);
  const estSupply = supplyIndex(inp.supply.filter((s) => s.estimated > 0).map((s) => ({ ...s, completers: s.estimated, nco: SKILL_ONLY })), M);
  const occSupply = supplyIndex(inp.occSupply.map((s) => ({ lgd: s.lgd, nco: s.nco, completers: s.completers })), M);

  // District coverage per quarter (D4), used for supply-only cells too.
  const byLq = new Map<string, HiresEstimate[]>();
  for (const h of demand.hires) {
    const k = key(h.lgd, h.quarter);
    if (!byLq.has(k)) byLq.set(k, []);
    byLq.get(k)!.push(h);
  }
  const cov = (lgd: string, q: string) => districtCoverage(byLq.get(key(lgd, q)) ?? [], lgd, q);

  // Skill cells: every (lgd, skill, ≥p) with demand, plus every one that receives supply.
  const supplyKeys = new Set<string>();
  for (const s of inp.supply) {
    const row = M[s.lgd] ?? { [s.lgd]: 1 };
    for (const to of Object.keys(row)) for (let p = 1; p <= s.proficiency; p++) supplyKeys.add(key(to, s.skillId, p));
  }
  const cells: DemandCell[] = [];
  const supplyFacts: SupplyFactOut[] = [];
  const push = (lgd: string, skillId: string, p: Proficiency, q: string, d: { demand: number; sdi: number; ciLow: number; ciHigh: number; coverage: number }) => {
    const sup = skillSupply.skill(lgd, skillId, p);
    if (d.demand < 0.5 && sup < 0.5) return;
    cells.push({
      lgd, skillId, proficiency: p, quarter: q, demand: round(d.demand), supply: round(sup), gap: round(d.demand - sup),
      ratio: round(d.demand / Math.max(sup, 1), 3), sdi: round(d.sdi), ciLow: round(d.ciLow), ciHigh: round(d.ciHigh), coverage: round(d.coverage, 3),
    });
    if (sup > 0) {
      const e = estSupply.skill(lgd, skillId, p);
      supplyFacts.push({ quarter: q, lgd, skillId, proficiency: p, graduates: round(sup), estimatedShare: round(Math.min(1, e / sup), 3) });
    }
  };
  const seen = new Set<string>();
  for (const s of demand.skills) {
    seen.add(key(s.quarter, s.lgd, s.skillId, s.proficiency));
    push(s.lgd, s.skillId, s.proficiency, s.quarter, s);
  }
  for (const q of inp.quarters) {
    for (const sk of supplyKeys) {
      const [lgd, skillId, p] = sk.split("|") as [string, string, string];
      if (seen.has(key(q, lgd, skillId, p))) continue;
      push(lgd, skillId, Number(p) as Proficiency, q, { demand: 0, sdi: 0, ciLow: 0, ciHigh: 0, coverage: cov(lgd, q) });
    }
  }

  // Occupation cells, demand provenance, district metrics.
  const trainable = inp.trainableNcos ? new Set(inp.trainableNcos) : null;
  const occupationCells: OccupationCell[] = [];
  const demandFacts: DemandFactOut[] = [];
  const districtMetrics: DistrictMetricOut[] = [];
  const supplyNcos = [...new Set(inp.occSupply.map((s) => s.nco))];
  for (const q of inp.quarters) {
    for (const d of inp.districts) {
      const hs = byLq.get(key(d.lgd, q)) ?? [];
      const withDemand = new Set<string>();
      for (const h of hs) {
        withDemand.add(h.nco);
        const sup = occSupply.occupation(d.lgd, h.nco);
        if (h.hires > 0 || sup > 0) occupationCells.push({ quarter: q, lgd: d.lgd, nco: h.nco, demand: h.hires, supply: sup });
        for (const k of KINDS) {
          const s = h.signals[k];
          if (s && s.shrunk > 0) demandFacts.push({ quarter: q, lgd: d.lgd, nco: h.nco, signal: k, n: s.n, hires12m: s.shrunk });
        }
      }
      for (const nco of supplyNcos) {
        if (withDemand.has(nco)) continue;
        const sup = occSupply.occupation(d.lgd, nco);
        if (sup > 0) occupationCells.push({ quarter: q, lgd: d.lgd, nco, demand: 0, supply: sup });
      }
      const mm = mismatchIndex(trainable ? hs.filter((h) => trainable.has(h.nco)) : hs, occSupply, d.lgd, q, trainable ? [...trainable] : supplyNcos);
      districtMetrics.push({ quarter: q, lgd: d.lgd, mismatch: mm.mismatch, coverage: cov(d.lgd, q) });
    }
  }
  return { cells, occupationCells, districtMetrics, demandFacts, supplyFacts, priorStrength: demand.priorStrength };
}

/** Statewide quarterly SDI per skill at p = 1, for the declining-skill test (D7). */
export function stateSdiSeries(cells: readonly DemandCell[]): Record<string, SeriesPoint[]> {
  const tot = new Map<string, Map<string, number>>();
  for (const c of cells) {
    if (c.proficiency !== 1) continue;
    const m = tot.get(c.skillId) ?? new Map<string, number>();
    m.set(c.quarter, (m.get(c.quarter) ?? 0) + c.demand);
    tot.set(c.skillId, m);
  }
  const out: Record<string, SeriesPoint[]> = {};
  for (const [id, m] of tot) {
    const qs = [...m.keys()].sort();
    const base = m.get(qs[0]!) ?? 0;
    if (base <= 0 || sum(m.values()) <= 0) continue;
    out[id] = qs.map((q) => ({ quarter: q, value: (100 * (m.get(q) ?? 0)) / base }));
  }
  return out;
}

export function computeCourseHealthCore(inp: HealthInput): CourseHealth[] {
  const { declining } = detectDecliningSkills(stateSdiSeries(inp.cells));
  const cur = new Map<string, number>();
  for (const c of inp.cells) if (c.quarter === inp.quarter) cur.set(key(c.lgd, c.skillId, c.proficiency), c.demand);
  const occ = new Map(inp.occupationCells.map((o) => [key(o.quarter, o.lgd, o.nco), o]));
  const M = toSpillover(inp.spill ?? []);
  const profiles = new Map<string, HealthInput["profiles"]>();
  for (const p of inp.profiles) { if (!profiles.has(p.nco)) profiles.set(p.nco, []); profiles.get(p.nco)!.push(p); }

  // Trade medians of the 6-month placement rate (≥ 3 cohorts, else the state median).
  const byTrade = new Map<string, number[]>();
  for (const c of inp.courses) {
    if (!c.cohort || c.cohort.completed <= 0) continue;
    if (!byTrade.has(c.code)) byTrade.set(c.code, []);
    byTrade.get(c.code)!.push(c.cohort.placed6m / c.cohort.completed);
  }
  const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const stateMedian = med([...byTrade.values()].flat()) ?? 0.5;
  const tradeMedian = (code: string) => { const r = byTrade.get(code) ?? []; return r.length >= 3 ? med(r)! : stateMedian; };

  return inp.courses.map((c) => {
    const row = M[c.lgd] ?? { [c.lgd]: 1 };
    const catchment = (skillId: string, p: number) =>
      Object.entries(row).reduce((a, [to, share]) => a + share * (cur.get(key(to, skillId, p)) ?? 0), 0);
    const targetSkills = (profiles.get(c.targetNco) ?? []).map((p) => ({
      skillId: p.skillId, proficiency: Math.min(4, Math.max(1, p.proficiency)) as Proficiency, demand: catchment(p.skillId, p.proficiency),
    }));
    const ratio = (q: string) => { const o = occ.get(key(q, c.lgd, c.targetNco)); return o && o.supply > 0 ? o.demand / o.supply : Infinity; };
    const now = occ.get(key(inp.quarter, c.lgd, c.targetNco));
    const course: Course = {
      id: c.id, institutionId: "", institutionName: "", lgd: c.lgd, name: c.code, code: c.code, kind: "ITI", targetNco: c.targetNco,
      seats: 0, durationHours: 0, isDemo: false,
      skills: c.skills.map((s) => ({ ...s, proficiency: Math.min(4, Math.max(1, s.proficiency)) as Proficiency })),
    };
    const h = courseHealth({
      course, quarter: inp.quarter, districtName: inp.districtNames?.[c.lgd] ?? c.lgd, targetSkills,
      cohort: c.cohort, stateMedianPlacement: tradeMedian(c.code), declining,
      endorsements: c.endorsements, changeRequests: c.changeRequests,
      occupationRatioHistory: [ratio(inp.prevQuarter), ratio(inp.quarter)],
      occupationDemand: now?.demand, occupationSupply: now?.supply, skillLabels: inp.labels,
    });
    return { ...h, placementRate: h.placementRate == null ? null : Math.round(h.placementRate * 1000) / 1000 };
  });
}

export const coreEngine: Engine = { computeCells: computeCellsCore, computeCourseHealth: computeCourseHealthCore };
