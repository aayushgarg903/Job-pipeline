// Local stand-in for @ks/core's Course Health (Architecture §6.3).
//   Relevance 35 · Outcomes 30 · Currency 15 · Validation 20, each 0–100.
//   Declining skill: Theil–Sen slope < 0 with a Mann–Kendall test, BH-FDR q < 0.1 across skills,
//   sustained (also negative without the latest quarter); plus skills with ~zero demand anywhere.
import type { CourseFlag, CourseHealth, DemandCell } from "@ks/contracts";
import type { HealthInput } from "./types";

const clamp = (x: number) => Math.max(0, Math.min(100, x));
const r1 = (x: number) => Math.round(x * 10) / 10;

export function theilSen(ys: number[]): number {
  const s: number[] = [];
  for (let i = 0; i < ys.length; i++) for (let j = i + 1; j < ys.length; j++) s.push((ys[j]! - ys[i]!) / (j - i));
  s.sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : 0;
}

/** One-sided Mann–Kendall p-value for a decreasing trend (normal approximation). */
export function mannKendallDecreasingP(ys: number[]): number {
  const n = ys.length;
  if (n < 4) return 1;
  let S = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) S += Math.sign(ys[j]! - ys[i]!);
  const v = (n * (n - 1) * (2 * n + 5)) / 18;
  const z = S < 0 ? (S + 1) / Math.sqrt(v) : S > 0 ? (S - 1) / Math.sqrt(v) : 0;
  return normCdf(z);
}
function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/** Benjamini–Hochberg: ids whose adjusted q < alpha. */
export function benjaminiHochberg(ps: Array<{ id: string; p: number }>, alpha = 0.1): Set<string> {
  const sorted = [...ps].sort((a, b) => a.p - b.p);
  let k = -1;
  sorted.forEach((x, i) => { if (x.p <= ((i + 1) / sorted.length) * alpha) k = i; });
  return new Set(sorted.slice(0, k + 1).map((x) => x.id));
}

export function decliningSkills(cells: DemandCell[], quarters: string[]): { declining: Set<string>; zeroDemand: Set<string> } {
  const series = new Map<string, Map<string, number>>();
  for (const c of cells) {
    if (c.proficiency !== 1) continue;
    if (!series.has(c.skillId)) series.set(c.skillId, new Map());
    const m = series.get(c.skillId)!;
    m.set(c.quarter, (m.get(c.quarter) ?? 0) + c.demand);
  }
  const tests: Array<{ id: string; p: number }> = [];
  const sustained = new Set<string>();
  for (const [id, m] of series) {
    const ys = quarters.map((q) => m.get(q) ?? 0);
    if (ys.length < 6 || ys.every((y) => y === 0)) continue;
    tests.push({ id, p: mannKendallDecreasingP(ys) });
    if (theilSen(ys) < 0 && theilSen(ys.slice(0, -1)) < 0) sustained.add(id);
  }
  const bh = benjaminiHochberg(tests, 0.1);
  const declining = new Set([...bh].filter((id) => sustained.has(id)));
  const latest = quarters[quarters.length - 1];
  const totals = [...series.entries()].map(([id, m]) => [id, m.get(latest!) ?? 0] as const);
  const med = [...totals.map(([, v]) => v)].sort((a, b) => a - b)[Math.floor(totals.length / 2)] ?? 0;
  const zeroDemand = new Set(totals.filter(([, v]) => v < med * 0.01).map(([id]) => id));
  return { declining, zeroDemand };
}

export function computeCourseHealth(inp: HealthInput): CourseHealth[] {
  const quarters = [...new Set(inp.cells.map((c) => c.quarter))].sort();
  const { declining, zeroDemand } = decliningSkills(inp.cells, quarters);
  const cur = new Map<string, DemandCell>();
  for (const c of inp.cells) if (c.quarter === inp.quarter) cur.set(`${c.lgd}|${c.skillId}|${c.proficiency}`, c);
  const occ = new Map(inp.occupationCells.map((o) => [`${o.quarter}|${o.lgd}|${o.nco}`, o]));
  const profiles = new Map<string, HealthInput["profiles"]>();
  for (const p of inp.profiles) { if (!profiles.has(p.nco)) profiles.set(p.nco, []); profiles.get(p.nco)!.push(p); }

  // Trade medians for the Beta-binomial shrinkage of placement.
  const byTrade = new Map<string, number[]>();
  for (const c of inp.courses) {
    if (!c.cohort || c.cohort.completed <= 0) continue;
    if (!byTrade.has(c.code)) byTrade.set(c.code, []);
    byTrade.get(c.code)!.push(c.cohort.placed6m / c.cohort.completed);
  }
  const allRates = [...byTrade.values()].flat().sort((a, b) => a - b);
  const stateMedian = allRates[Math.floor(allRates.length / 2)] ?? 0.5;
  const median = (code: string) => { const r = [...(byTrade.get(code) ?? [])].sort((a, b) => a - b); return r.length >= 3 ? r[Math.floor(r.length / 2)]! : stateMedian; };
  const label = (id: string) => inp.labels[id] ?? id;

  return inp.courses.map((c): CourseHealth => {
    const prof = profiles.get(c.targetNco) ?? [];
    const taught = new Map(c.skills.map((s) => [s.skillId, s]));
    const explain: string[] = [];

    let wSum = 0, wTaught = 0;
    const missing: Array<{ id: string; w: number }> = [];
    for (const p of prof) {
      const d = cur.get(`${c.lgd}|${p.skillId}|${p.proficiency}`)?.demand ?? 0;
      const w = p.weight * Math.max(d, 0.01);
      wSum += w;
      const t = taught.get(p.skillId);
      const credit = t ? (t.proficiency >= p.proficiency ? 1 : 0.5) : 0;
      wTaught += w * credit;
      if (!t && d > 0) missing.push({ id: p.skillId, w });
    }
    const relevance = wSum > 0 ? clamp((100 * wTaught) / wSum) : 50;
    missing.sort((a, b) => b.w - a.w);
    const missingSkills = missing.slice(0, 5).map((m) => m.id);
    explain.push(`Teaches ${r1(relevance)}% of the demand-weighted skills local employers need for this occupation.`);
    if (missingSkills.length) explain.push(`Not taught but demanded: ${missingSkills.map(label).join(", ")}.`);

    let outcomes = 50;
    let placementRate: number | null = null;
    if (c.cohort && c.cohort.completed > 0) {
      const m = median(c.code);
      placementRate = c.cohort.placed6m / c.cohort.completed;
      const shrunk = (c.cohort.placed6m + 20 * m) / (c.cohort.completed + 20);
      outcomes = clamp(50 + (50 * (shrunk - m)) / Math.max(m, 0.1));
      explain.push(`6-month placement ${Math.round(placementRate * 100)}% (${c.cohort.placed6m} of ${c.cohort.completed}) vs a trade median of ${Math.round(m * 100)}%.`);
    } else {
      explain.push("No cohort outcomes reported yet; outcomes held at a neutral 50.");
    }

    const totalHours = c.skills.reduce((s, x) => s + x.hours, 0) || 1;
    const decl = c.skills.filter((s) => declining.has(s.skillId) || zeroDemand.has(s.skillId));
    const declHours = decl.reduce((s, x) => s + x.hours, 0);
    const currency = clamp(100 - (100 * declHours) / totalHours);
    if (decl.length) explain.push(`${Math.round((100 * declHours) / totalHours)}% of course hours go to skills with falling or no demand: ${decl.map((d) => label(d.skillId)).join(", ")}.`);

    const validation = clamp((100 * (2 + c.endorsements)) / (4 + c.endorsements + c.changeRequests));
    if (c.endorsements + c.changeRequests > 0) explain.push(`${c.endorsements} employer endorsements and ${c.changeRequests} change requests on open PRs.`);

    const demanded = new Set(prof.map((p) => p.skillId));
    const unassessedSkills = c.skills.filter((s) => demanded.has(s.skillId) && !s.assessed).map((s) => s.skillId);
    if (unassessedSkills.length) explain.push(`Taught but never assessed: ${unassessedSkills.map(label).join(", ")}.`);

    const ratio = (q: string) => { const o = occ.get(`${q}|${c.lgd}|${c.targetNco}`); return o && o.supply > 0 ? o.demand / o.supply : Infinity; };
    const flags: CourseFlag[] = [];
    if (currency < 60) flags.push("OBSOLETE");
    if (ratio(inp.quarter) < 0.6 && ratio(inp.prevQuarter) < 0.6) {
      flags.push("OVERSUPPLIED");
      explain.push(`Local demand is only ${r1(ratio(inp.quarter))}× the completers for this occupation, two quarters running.`);
    }
    if (relevance < 55) flags.push("REVISE");
    if (!flags.length) flags.push("HEALTHY");

    const total = 0.35 * relevance + 0.3 * outcomes + 0.15 * currency + 0.2 * validation;
    return {
      courseId: c.id, quarter: inp.quarter, relevance: r1(relevance), outcomes: r1(outcomes), currency: r1(currency),
      validation: r1(validation), total: r1(total), flags, placementRate: placementRate == null ? null : Math.round(placementRate * 1000) / 1000,
      missingSkills, decliningSkills: decl.map((d) => d.skillId), unassessedSkills, explain,
    };
  });
}
