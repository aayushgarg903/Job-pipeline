// Architecture §6.1 steps 2–3: fuse shrunk signals into expected hires per (district, occupation,
// quarter), expand to skills via occupation skill profiles, index against a base quarter, and
// attach parametric-bootstrap intervals.

import type { LgdCode, NcoCode, Proficiency, Quarter, SignalKind, SignalObservation, SkillId } from "@ks/contracts";
import { createRng, quantile } from "./random";
import { DEFAULT_PRIOR_STRENGTH, coverage, estimatePriorStrength, shrinkToward } from "./shrink";

export const SIGNAL_KINDS: readonly SignalKind[] = ["postings", "surveys", "consultations", "udyam"];

/** Fixed, published fusion weights (shown on /sources). They sum to 1. */
export const DEFAULT_WEIGHTS: Readonly<Record<SignalKind, number>> = {
  postings: 0.35,
  surveys: 0.3,
  consultations: 0.1,
  udyam: 0.25,
};

export const DEFAULT_BASE_QUARTER: Quarter = "2026-Q4";

/** P(skill needed at ≥ proficiency | occupation). Entries for one skill should not rise with p. */
export interface SkillProfileEntry {
  skillId: SkillId;
  proficiency: Proficiency;
  prob: number; // 0..1
}
export type SkillProfiles = Record<NcoCode, SkillProfileEntry[]>;

export interface SdiOptions {
  weights?: Readonly<Record<SignalKind, number>>;
  /** Per-signal prior strengths, or "estimate" to fit them by method of moments (default). */
  priorStrength?: Partial<Record<SignalKind, number>> | "estimate";
  /** Size measure per district (e.g. working-age population). Shrinkage runs on hires/exposure. Default 1. */
  exposure?: Record<LgdCode, number>;
  baseQuarter?: Quarter;
  /** Override for the SDI denominator: state mean demand per district, keyed `${skillId}|${p}`. */
  baseDemand?: Record<string, number>;
  bootstrap?: number; // draws, default 400
  seed?: number;
  ciLevel?: number; // default 0.9 → 5th and 95th percentiles
}

export interface SignalContribution {
  n: number;
  raw: number | null; // district's own hires estimate (null when n = 0)
  shrunk: number; // after district → division → state shrinkage
  weight: number; // effective fusion weight (renormalised over signals that exist)
  m: number;
}

export interface HiresEstimate {
  lgd: LgdCode;
  nco: NcoCode;
  quarter: Quarter;
  hires: number;
  ciLow: number;
  ciHigh: number;
  coverage: number;
  signals: Partial<Record<SignalKind, SignalContribution>>;
}

export interface SkillDemand {
  lgd: LgdCode;
  skillId: SkillId;
  proficiency: Proficiency;
  quarter: Quarter;
  demand: number; // expected hires needing skill at ≥ p, next 12 months
  demandLow: number;
  demandHigh: number;
  sdi: number; // 100 = state per-district mean at the base quarter
  ciLow: number;
  ciHigh: number;
  coverage: number; // demand-weighted over the contributing occupations
  baseQuarter: Quarter | null; // the quarter actually used as the SDI base
  byOccupation: Array<{ nco: NcoCode; hires: number; prob: number; demand: number }>;
}

export interface DemandResult {
  hires: HiresEstimate[];
  skills: SkillDemand[];
  priorStrength: Record<SignalKind, number>;
  weights: Record<SignalKind, number>;
}

interface Agg {
  n: number;
  hires: number;
}

const key = (...parts: string[]) => parts.join("|");

/** Sum observations into (kind, lgd, nco, quarter) cells. */
function aggregate(obs: readonly SignalObservation[]): Map<string, Agg> {
  const out = new Map<string, Agg>();
  for (const o of obs) {
    if (!(o.n >= 0) || !Number.isFinite(o.hires12m)) continue;
    const k = key(o.kind, o.lgd, o.nco, o.quarter);
    const a = out.get(k) ?? { n: 0, hires: 0 };
    a.n += o.n;
    a.hires += Math.max(0, o.hires12m);
    out.set(k, a);
  }
  return out;
}

function normaliseWeights(w: Readonly<Record<SignalKind, number>>): Record<SignalKind, number> {
  const total = SIGNAL_KINDS.reduce((a, k) => a + Math.max(0, w[k] ?? 0), 0);
  const out = {} as Record<SignalKind, number>;
  for (const k of SIGNAL_KINDS) out[k] = total > 0 ? Math.max(0, w[k] ?? 0) / total : 0.25;
  return out;
}

interface ShrinkContext {
  divisionOf: Record<LgdCode, string>;
  exposure: (lgd: LgdCode) => number;
  cells: Map<string, Agg>;
}

/** Division and state rates (hires per exposure) for one (kind, nco, quarter), over districts with data. */
function parentRates(ctx: ShrinkContext, kind: SignalKind, nco: NcoCode, quarter: Quarter) {
  const div = new Map<string, { n: number; hires: number; exp: number }>();
  const st = { n: 0, hires: 0, exp: 0 };
  for (const lgd of Object.keys(ctx.divisionOf)) {
    const c = ctx.cells.get(key(kind, lgd, nco, quarter));
    if (!c || c.n <= 0) continue;
    const e = ctx.exposure(lgd);
    const d = ctx.divisionOf[lgd] as string;
    const a = div.get(d) ?? { n: 0, hires: 0, exp: 0 };
    a.n += c.n;
    a.hires += c.hires;
    a.exp += e;
    div.set(d, a);
    st.n += c.n;
    st.hires += c.hires;
    st.exp += e;
  }
  return { div, st };
}

function fitPriorStrengths(ctx: ShrinkContext, opt: SdiOptions["priorStrength"], groups: Array<[NcoCode, Quarter]>) {
  const out = { ...DEFAULT_PRIOR_STRENGTH } as Record<SignalKind, number>;
  if (opt && opt !== "estimate") {
    for (const k of SIGNAL_KINDS) if (opt[k] !== undefined) out[k] = opt[k] as number;
    return out;
  }
  for (const kind of SIGNAL_KINDS) {
    const units: Array<{ n: number; value: number; parent: number }> = [];
    for (const [nco, quarter] of groups) {
      const { div } = parentRates(ctx, kind, nco, quarter);
      for (const lgd of Object.keys(ctx.divisionOf)) {
        const c = ctx.cells.get(key(kind, lgd, nco, quarter));
        const p = div.get(ctx.divisionOf[lgd] as string);
        if (!c || c.n <= 0 || !p || p.exp <= 0) continue;
        units.push({ n: c.n, value: c.hires / ctx.exposure(lgd), parent: p.hires / p.exp });
      }
    }
    out[kind] = estimatePriorStrength(units, DEFAULT_PRIOR_STRENGTH[kind]).m;
  }
  return out;
}

/**
 * Full §6.1 pipeline. `divisionOf` lists every district to estimate (including ones with no
 * observations, which borrow from their division). Deterministic for a given seed.
 */
export function computeDemand(
  observations: readonly SignalObservation[],
  divisionOf: Record<LgdCode, string>,
  profiles: SkillProfiles,
  options: SdiOptions = {},
): DemandResult {
  const weights = normaliseWeights(options.weights ?? DEFAULT_WEIGHTS);
  const B = Math.max(20, Math.floor(options.bootstrap ?? 400));
  const seed = options.seed ?? 26134;
  const tail = (1 - (options.ciLevel ?? 0.9)) / 2;
  const cells = aggregate(observations);
  const exp = options.exposure;
  const ctx: ShrinkContext = {
    divisionOf,
    cells,
    exposure: (lgd) => (exp && (exp[lgd] ?? 0) > 0 ? (exp[lgd] as number) : 1),
  };

  const groupSet = new Map<string, [NcoCode, Quarter]>();
  for (const o of observations) groupSet.set(key(o.nco, o.quarter), [o.nco, o.quarter]);
  const groups = [...groupSet.values()].sort((a, b) => cmp(a[1], b[1]) || cmp(a[0], b[0]));
  const m = fitPriorStrengths(ctx, options.priorStrength ?? "estimate", groups);
  const lgds = Object.keys(divisionOf).sort();
  const quarters = [...new Set(groups.map((g) => g[1]))].sort();

  const hiresOut: HiresEstimate[] = [];
  // Demand draws per (lgd, quarter, skill, p). Groups are sorted by quarter, so each quarter's
  // draws are reduced to quantiles and released before the next quarter starts.
  const skillAcc = new Map<string, { cell: SkillDemand; draws: Float64Array | null; covNum: number }>();
  const flush = () => {
    for (const acc of skillAcc.values()) {
      if (!acc.draws) continue;
      const arr = Array.from(acc.draws);
      acc.cell.demandLow = quantile(arr, tail);
      acc.cell.demandHigh = quantile(arr, 1 - tail);
      acc.draws = null;
    }
  };

  let currentQuarter: Quarter | null = null;
  for (const [nco, quarter] of groups) {
    if (quarter !== currentQuarter) {
      flush();
      currentQuarter = quarter;
    }
    const parents = SIGNAL_KINDS.map((k) => parentRates(ctx, k, nco, quarter));
    const active = SIGNAL_KINDS.filter((_, i) => (parents[i] as ReturnType<typeof parentRates>).st.exp > 0);
    const wSum = active.reduce((a, k) => a + weights[k], 0);
    if (active.length === 0 || wSum <= 0) continue;
    const effW = {} as Record<SignalKind, number>;
    for (const k of SIGNAL_KINDS) effW[k] = active.includes(k) ? weights[k] / wSum : 0;

    for (const lgd of lgds) {
      const draws = new Float64Array(B);
      const signals: HiresEstimate["signals"] = {};
      const nBy: Partial<Record<SignalKind, number>> = {};
      let hires = 0;
      for (const k of active) {
        const { div, st } = parents[SIGNAL_KINDS.indexOf(k)] as ReturnType<typeof parentRates>;
        const e = ctx.exposure(lgd);
        const own = cells.get(key(k, lgd, nco, quarter));
        const n = own && own.n > 0 ? own.n : 0;
        const stateRate = st.hires / st.exp;
        const dv = div.get(divisionOf[lgd] as string);
        const divRate = dv && dv.exp > 0 ? shrinkToward({ n: dv.n, value: dv.hires / dv.exp }, stateRate, m[k]) : stateRate;
        const rate = shrinkToward({ n, value: n > 0 ? (own as Agg).hires / e : 0 }, divRate, m[k]);
        const shrunk = rate * e;
        nBy[k] = n;
        signals[k] = { n, raw: n > 0 ? (own as Agg).hires : null, shrunk, weight: effW[k], m: m[k] };
        hires += effW[k] * shrunk;
        // Posterior for this signal: Gamma with mean `shrunk` and effective sample n + m (CV = 1/√(n+m)).
        const shape = n + m[k];
        if (shrunk > 0) {
          const rng = createRng(seed, key(lgd, nco, quarter, k));
          for (let b = 0; b < B; b++) draws[b] = (draws[b] as number) + effW[k] * rng.gamma(shape, shrunk / shape);
        }
      }
      const drawArr = Array.from(draws);
      const cov = coverage(nBy, m, effW);
      hiresOut.push({
        lgd, nco, quarter, hires, coverage: cov, signals,
        ciLow: quantile(drawArr, tail), ciHigh: quantile(drawArr, 1 - tail),
      });

      for (const [skillId, p, prob] of cumulativeProfile(profiles[nco] ?? [])) {
        const sk = key(lgd, quarter, skillId, String(p));
        let acc = skillAcc.get(sk);
        if (!acc) {
          acc = {
            cell: {
              lgd, skillId, proficiency: p, quarter, demand: 0, demandLow: 0, demandHigh: 0,
              sdi: 0, ciLow: 0, ciHigh: 0, coverage: 0, baseQuarter: null, byOccupation: [],
            },
            draws: new Float64Array(B),
            covNum: 0,
          };
          skillAcc.set(sk, acc);
        }
        const d = hires * prob;
        acc.cell.demand += d;
        acc.covNum += d * cov;
        acc.cell.byOccupation.push({ nco, hires, prob, demand: d });
        const ad = acc.draws as Float64Array;
        for (let b = 0; b < B; b++) ad[b] = (ad[b] as number) + (draws[b] as number) * prob;
      }
    }
  }
  flush();

  // SDI denominator: state mean demand per district at the base quarter (fallback: earliest quarter with demand).
  const baseQ = options.baseQuarter ?? DEFAULT_BASE_QUARTER;
  const stateMean = new Map<string, number>(); // `${quarter}|${skill}|${p}` → mean per district
  for (const { cell } of skillAcc.values()) {
    const k = key(cell.quarter, cell.skillId, String(cell.proficiency));
    stateMean.set(k, (stateMean.get(k) ?? 0) + cell.demand / Math.max(1, lgds.length));
  }
  const baseFor = (skillId: SkillId, p: Proficiency): { q: Quarter | null; v: number } => {
    const override = options.baseDemand?.[key(skillId, String(p))];
    if (override !== undefined && override > 0) return { q: baseQ, v: override };
    const v = stateMean.get(key(baseQ, skillId, String(p))) ?? 0;
    if (v > 0) return { q: baseQ, v };
    for (const q of quarters) {
      const alt = stateMean.get(key(q, skillId, String(p))) ?? 0;
      if (alt > 0) return { q, v: alt };
    }
    return { q: null, v: 0 };
  };

  const skills: SkillDemand[] = [];
  for (const { cell, covNum } of skillAcc.values()) {
    const base = baseFor(cell.skillId, cell.proficiency);
    cell.coverage = cell.demand > 0 ? covNum / cell.demand : 0;
    cell.baseQuarter = base.q;
    const scale = base.v > 0 ? 100 / base.v : 0;
    cell.sdi = cell.demand * scale;
    cell.ciLow = cell.demandLow * scale;
    cell.ciHigh = cell.demandHigh * scale;
    skills.push(cell);
  }
  skills.sort((a, b) => cmp(a.quarter, b.quarter) || cmp(a.lgd, b.lgd) || cmp(a.skillId, b.skillId) || a.proficiency - b.proficiency);
  return { hires: hiresOut, skills, priorStrength: m, weights };
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Makes a profile cumulative: P(s ≥ p) is the max over listed entries at p' ≥ p, so a skill listed
 * at p = 3 also counts toward demand at ≥ 1 and ≥ 2. Emits only the (skill, p) pairs that were listed.
 */
export function cumulativeProfile(entries: readonly SkillProfileEntry[]): Array<[SkillId, Proficiency, number]> {
  const out: Array<[SkillId, Proficiency, number]> = [];
  for (const e of entries) {
    let prob = 0;
    for (const f of entries) if (f.skillId === e.skillId && f.proficiency >= e.proficiency) prob = Math.max(prob, f.prob);
    if (prob > 0 && !out.some(([s, p]) => s === e.skillId && p === e.proficiency)) out.push([e.skillId, e.proficiency, Math.min(1, prob)]);
  }
  return out;
}

/** Hires-weighted coverage of a district in one quarter, for the map hatching. */
export function districtCoverage(hires: readonly HiresEstimate[], lgd: LgdCode, quarter: Quarter): number {
  let num = 0;
  let den = 0;
  for (const h of hires) {
    if (h.lgd !== lgd || h.quarter !== quarter) continue;
    num += h.hires * h.coverage;
    den += h.hires;
  }
  return den > 0 ? num / den : 0;
}

