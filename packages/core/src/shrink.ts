// Architecture §6.1 step 1: per-signal empirical-Bayes shrinkage, district → division → state.
//
//   r̃_k(d) = ( n_k(d)·r_k(d) + m_k·r̃_k(division(d)) ) / ( n_k(d) + m_k )
//
// Each signal k has its own prior strength m_k, measured in that signal's observation units
// (postings, survey responses, meetings, registrations). A district with n_k = m_k observations
// gets exactly half its own value and half its parent's.

import type { SignalKind } from "@ks/contracts";
import { clamp } from "./random";

/** Default prior strengths, used when there is too little spread across districts to fit m_k. */
export const DEFAULT_PRIOR_STRENGTH: Readonly<Record<SignalKind, number>> = {
  postings: 30,
  surveys: 8,
  consultations: 2,
  udyam: 20,
};

export const PRIOR_STRENGTH_BOUNDS = { min: 0.5, max: 500 } as const;

/** One-level shrinkage. With n = 0 the parent value is returned unchanged. */
export function shrinkToward(local: { n: number; value: number }, parent: number, m: number): number {
  const n = Math.max(0, local.n);
  if (n + m <= 0) return parent;
  return (n * local.value + m * parent) / (n + m);
}

/** The weight a unit keeps on its own data, n/(n+m). */
export function reliability(n: number, m: number): number {
  const nn = Math.max(0, n);
  return nn + m > 0 ? nn / (nn + m) : 0;
}

export interface LevelCell {
  n: number; // observation count
  value: number; // raw estimate in the signal's own units
}

export interface HierarchyResult {
  state: number;
  division: number; // division value after shrinking toward the state
  district: number; // district value after shrinking toward the (shrunk) division
}

/**
 * Two-level recursion. The state value is taken as-is (it is the best-pooled level).
 * The division is shrunk toward the state, then the district toward the shrunk division,
 * all with the same signal-specific m.
 */
export function shrinkHierarchy(
  cells: { district: LevelCell; division: LevelCell; state: number },
  m: number,
): HierarchyResult {
  const division = shrinkToward(cells.division, cells.state, m);
  const district = shrinkToward(cells.district, division, m);
  return { state: cells.state, division, district };
}

/**
 * Method-of-moments estimator for m_k.
 *
 * Model: a unit's raw value r_i has mean θ_i (its true level) and sampling variance σ²/n_i, and
 * θ_i varies around the parent mean μ with between-unit variance τ². Then
 *     E[(r_i − μ)²] = τ² + σ² · (1/n_i)
 * so a least-squares fit (OLS, then reweighted) of squared deviations on 1/n_i gives τ² (intercept) and
 * σ² (slope). The Bayes-optimal shrinkage weight is n/(n + σ²/τ²), hence m = σ²/τ².
 *
 * Needs at least 3 units with n > 0 and some variation in n; otherwise returns `fallback`.
 * The result is clamped to PRIOR_STRENGTH_BOUNDS so a noisy fit can't pool everything or nothing.
 */
export function estimatePriorStrength(
  units: ReadonlyArray<{ n: number; value: number; parent?: number }>,
  fallback: number,
): { m: number; tau2: number; sigma2: number; fitted: boolean } {
  const usable = units.filter((u) => u.n > 0 && Number.isFinite(u.value));
  const fail = { m: fallback, tau2: NaN, sigma2: NaN, fitted: false };
  if (usable.length < 3) return fail;
  const totalN = usable.reduce((a, u) => a + u.n, 0);
  const pooled = usable.reduce((a, u) => a + u.n * u.value, 0) / totalN;
  const xs = usable.map((u) => 1 / u.n);
  const ys = usable.map((u) => (u.value - (u.parent ?? pooled)) ** 2);
  // Squared deviations have variance ∝ (τ² + σ²/n)², so refine OLS with a few rounds of
  // iteratively reweighted least squares (weights 1/fitted²).
  const wls = (w: readonly number[]) => {
    let sw = 0, mx = 0, my = 0;
    for (let i = 0; i < xs.length; i++) {
      sw += w[i] as number;
      mx += (w[i] as number) * (xs[i] as number);
      my += (w[i] as number) * (ys[i] as number);
    }
    mx /= sw;
    my /= sw;
    let sxx = 0, sxy = 0;
    for (let i = 0; i < xs.length; i++) {
      const dx = (xs[i] as number) - mx;
      sxx += (w[i] as number) * dx * dx;
      sxy += (w[i] as number) * dx * ((ys[i] as number) - my);
    }
    if (sxx <= 1e-12 * sw * Math.max(1, mx * mx)) return null;
    const slope = sxy / sxx;
    return { sigma2: slope, tau2: my - slope * mx };
  };
  let fit = wls(xs.map(() => 1));
  if (!fit) return fail;
  for (let iter = 0; iter < 4 && fit; iter++) {
    const f: { sigma2: number; tau2: number } = fit;
    const floor = Math.max(1e-12, my0(ys) * 1e-3);
    const w = xs.map((x) => 1 / Math.max(floor, f.tau2 + f.sigma2 * x) ** 2);
    fit = wls(w) ?? f;
  }
  const { sigma2, tau2 } = fit;
  const { min, max } = PRIOR_STRENGTH_BOUNDS;
  // No detectable sampling noise → trust local data; no detectable true spread → pool hard.
  if (sigma2 <= 0) return { m: min, tau2, sigma2, fitted: true };
  if (tau2 <= 0) return { m: max, tau2, sigma2, fitted: true };
  return { m: clamp(sigma2 / tau2, min, max), tau2, sigma2, fitted: true };
}

const my0 = (ys: readonly number[]) => ys.reduce((a, b) => a + b, 0) / Math.max(1, ys.length);

/**
 * Coverage: Σ_k w_k · n_k/(n_k + m_k). 0 means "all borrowed from the parent", 1 means
 * "entirely local". Signals missing from `n` count as n = 0. Weights are renormalised to sum
 * to 1 over the signals passed in `w`, so the result is always in [0, 1].
 */
export function coverage(
  n: Partial<Record<SignalKind, number>>,
  m: Readonly<Record<SignalKind, number>>,
  w: Readonly<Record<SignalKind, number>>,
): number {
  let num = 0;
  let den = 0;
  for (const k of Object.keys(w) as SignalKind[]) {
    const wk = Math.max(0, w[k]);
    den += wk;
    num += wk * reliability(n[k] ?? 0, m[k]);
  }
  return den > 0 ? clamp(num / den, 0, 1) : 0;
}
