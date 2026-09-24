// Trend statistics for declining-skill detection (Architecture §6.3): Theil–Sen slope,
// Mann–Kendall test (exact when there are no ties), Benjamini–Hochberg FDR.

import type { Quarter, SkillId } from "@ks/contracts";
import { median, normalCdf } from "./random";

export interface SeriesPoint {
  quarter: Quarter;
  value: number;
}

/** "2026-Q3" → 2026·4 + 2. Unparseable quarters return NaN. */
export function quarterIndex(q: Quarter): number {
  const m = /^(\d{4})-Q([1-4])$/.exec(q);
  return m ? Number(m[1]) * 4 + Number(m[2]) - 1 : NaN;
}

export function quarterFromIndex(i: number): Quarter {
  return `${Math.floor(i / 4)}-Q${(i % 4) + 1}`;
}

/** Theil–Sen estimator: median of all pairwise slopes. Units: value per x-unit. */
export function theilSen(xs: readonly number[], ys: readonly number[]): number {
  const slopes: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      const dx = (xs[j] as number) - (xs[i] as number);
      if (dx !== 0) slopes.push(((ys[j] as number) - (ys[i] as number)) / dx);
    }
  }
  return slopes.length ? median(slopes) : 0;
}

/** Distribution of the inversion count of a random permutation of n (Mahonian numbers), as probabilities. */
function inversionDistribution(n: number): number[] {
  let dist = [1];
  for (let i = 2; i <= n; i++) {
    const next = new Array<number>(dist.length + i - 1).fill(0);
    for (let k = 0; k < dist.length; k++) {
      const v = (dist[k] as number) / i;
      for (let j = 0; j < i; j++) next[k + j] = (next[k + j] as number) + v;
    }
    dist = next;
  }
  return dist;
}

export interface MannKendall {
  s: number;
  pDecreasing: number; // one-sided P(S ≤ s | no trend)
  pIncreasing: number;
  exact: boolean;
}

/** Mann–Kendall trend test on a series already in time order. */
export function mannKendall(ys: readonly number[]): MannKendall {
  const n = ys.length;
  let s = 0;
  let inversions = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = (ys[j] as number) - (ys[i] as number);
      if (d > 0) s++;
      else if (d < 0) {
        s--;
        inversions++;
      }
    }
  }
  if (n < 3) return { s, pDecreasing: 1, pIncreasing: 1, exact: true };
  const counts = new Map<number, number>();
  for (const y of ys) counts.set(y, (counts.get(y) ?? 0) + 1);
  const hasTies = [...counts.values()].some((c) => c > 1);
  if (!hasTies && n <= 30) {
    const dist = inversionDistribution(n);
    let geq = 0; // P(I ≥ observed) = P(S ≤ observed)
    for (let k = inversions; k < dist.length; k++) geq += dist[k] as number;
    let leq = 0; // P(I ≤ observed) = P(S ≥ observed)
    for (let k = 0; k <= inversions; k++) leq += dist[k] as number;
    return { s, pDecreasing: Math.min(1, geq), pIncreasing: Math.min(1, leq), exact: true };
  }
  let tieTerm = 0;
  for (const t of counts.values()) if (t > 1) tieTerm += t * (t - 1) * (2 * t + 5);
  const variance = (n * (n - 1) * (2 * n + 5) - tieTerm) / 18;
  if (variance <= 0) return { s, pDecreasing: 1, pIncreasing: 1, exact: false };
  const sd = Math.sqrt(variance);
  // Continuity-corrected z for each one-sided tail.
  return { s, pDecreasing: normalCdf((s + 1) / sd), pIncreasing: 1 - normalCdf((s - 1) / sd), exact: false };
}

/** Benjamini–Hochberg adjusted q-values, in the input order. */
export function benjaminiHochberg(pValues: readonly number[]): number[] {
  const m = pValues.length;
  const order = pValues.map((p, i) => [p, i] as const).sort((a, b) => a[0] - b[0]);
  const q = new Array<number>(m).fill(1);
  let running = 1;
  for (let r = m - 1; r >= 0; r--) {
    const [p, i] = order[r] as readonly [number, number];
    running = Math.min(running, (p * m) / (r + 1));
    q[i] = Math.min(1, running);
  }
  return q;
}

export interface TrendTest {
  skillId: SkillId;
  n: number;
  slope: number; // Theil–Sen, SDI points per quarter
  pValue: number; // one-sided Mann–Kendall, decreasing
  qValue: number; // BH across all skills tested at the latest quarter
  flaggedNow: boolean;
  flaggedPrev: boolean;
  declining: boolean; // flagged at the latest AND the previous quarter
}

export interface DecliningOptions {
  q?: number; // FDR level, default 0.1
  minQuarters?: number; // default 6
}

/**
 * Declining skills: negative Theil–Sen slope on quarterly SDI over ≥ 6 quarters, BH q < 0.1
 * across ALL skills tested, sustained for 2 consecutive quarters (the test must pass on the
 * series ending at the latest quarter and on the series ending one quarter earlier).
 */
export function detectDecliningSkills(
  series: Record<SkillId, readonly SeriesPoint[]>,
  opts: DecliningOptions = {},
): { tests: TrendTest[]; declining: SkillId[] } {
  const qLevel = opts.q ?? 0.1;
  const minN = Math.max(3, opts.minQuarters ?? 6);
  const ids = Object.keys(series).sort();
  const prepared = ids.map((id) => {
    const pts = [...(series[id] ?? [])]
      .map((p) => ({ x: quarterIndex(p.quarter), y: p.value }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
      .sort((a, b) => a.x - b.x);
    return { id, pts };
  });

  const runAt = (dropLast: number) => {
    const rows = prepared
      .map(({ id, pts }) => {
        const w = dropLast > 0 ? pts.slice(0, -dropLast) : pts;
        if (w.length < minN) return null;
        const slope = theilSen(w.map((p) => p.x), w.map((p) => p.y));
        return { id, n: w.length, slope, p: mannKendall(w.map((p) => p.y)).pDecreasing };
      })
      .filter((r): r is { id: string; n: number; slope: number; p: number } => r !== null);
    const q = benjaminiHochberg(rows.map((r) => r.p));
    const out = new Map<string, { n: number; slope: number; p: number; q: number; flagged: boolean }>();
    rows.forEach((r, i) => {
      const qi = q[i] as number;
      out.set(r.id, { n: r.n, slope: r.slope, p: r.p, q: qi, flagged: r.slope < 0 && qi < qLevel });
    });
    return out;
  };

  const now = runAt(0);
  const prev = runAt(1);
  const tests: TrendTest[] = [];
  for (const [id, r] of now) {
    const pr = prev.get(id);
    const flaggedPrev = pr?.flagged ?? false;
    tests.push({
      skillId: id, n: r.n, slope: r.slope, pValue: r.p, qValue: r.q,
      flaggedNow: r.flagged, flaggedPrev, declining: r.flagged && flaggedPrev,
    });
  }
  return { tests, declining: tests.filter((t) => t.declining).map((t) => t.skillId) };
}
