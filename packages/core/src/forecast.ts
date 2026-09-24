// Architecture §6.5: forecast per series with ETS (Holt / additive Holt–Winters) against a
// seasonal-naive baseline, chosen by rolling-origin backtest on sMAPE. Thin series say so:
// fewer than 8 points → "insufficient-history", and we never extrapolate them.

export const MIN_HISTORY = 8;

export type ForecastModel = "ets" | "seasonal-naive";

export interface ForecastPoint {
  step: number; // 1..horizon
  value: number;
  low: number;
  high: number;
}

export interface ForecastResult {
  status: "ok" | "insufficient-history";
  model: ForecastModel | null;
  etsKind: "holt" | "holt-winters" | null;
  points: ForecastPoint[];
  smape: { ets: number; naive: number } | null; // backtest sMAPE, 0..2
  params: { alpha: number; beta: number; gamma: number } | null;
}

export interface ForecastOptions {
  horizon?: number; // default 2 (two quarters = 6 months)
  period?: number; // default 4 (quarterly)
  nonNegative?: boolean; // default true
  z?: number; // band width in σ, default 1.645 (90%)
}

/** Symmetric MAPE in [0, 2]; 0/0 counts as a perfect forecast. */
export function smape(actual: readonly number[], forecast: readonly number[]): number {
  const n = Math.min(actual.length, forecast.length);
  if (n === 0) return NaN;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const a = actual[i] as number;
    const f = forecast[i] as number;
    const d = Math.abs(a) + Math.abs(f);
    s += d === 0 ? 0 : (2 * Math.abs(a - f)) / d;
  }
  return s / n;
}

export function seasonalNaive(y: readonly number[], h: number, period: number): number[] {
  const n = y.length;
  const m = n >= period ? period : 1;
  return Array.from({ length: h }, (_, i) => y[n - m + (i % m)] as number);
}

const GRID = [0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 0.9];

interface EtsFit {
  kind: "holt" | "holt-winters";
  alpha: number;
  beta: number;
  gamma: number;
  sse: number;
  forecast: (h: number) => number[];
}

function holt(y: readonly number[], alpha: number, beta: number): { sse: number; level: number; trend: number } {
  let level = y[0] as number;
  let trend = y.length > 1 ? (y[1] as number) - (y[0] as number) : 0;
  let sse = 0;
  for (let t = 1; t < y.length; t++) {
    const pred = level + trend;
    const e = (y[t] as number) - pred;
    sse += e * e;
    const prev = level;
    level = alpha * (y[t] as number) + (1 - alpha) * (level + trend);
    trend = beta * (level - prev) + (1 - beta) * trend;
  }
  return { sse, level, trend };
}

function holtWinters(y: readonly number[], m: number, alpha: number, beta: number, gamma: number) {
  const mean = (a: number, b: number) => y.slice(a, b).reduce((s, v) => s + v, 0) / (b - a);
  let level = mean(0, m);
  let trend = (mean(m, 2 * m) - level) / m;
  const season = Array.from({ length: m }, (_, i) => (y[i] as number) - level);
  let sse = 0;
  for (let t = m; t < y.length; t++) {
    const s = season[t % m] as number;
    const pred = level + trend + s;
    const e = (y[t] as number) - pred;
    sse += e * e;
    const prev = level;
    level = alpha * ((y[t] as number) - s) + (1 - alpha) * (level + trend);
    trend = beta * (level - prev) + (1 - beta) * trend;
    season[t % m] = gamma * ((y[t] as number) - level) + (1 - gamma) * s;
  }
  return { sse, level, trend, season, n: y.length };
}

/** Fits ETS by grid search on in-sample one-step SSE. Holt–Winters when there are two full seasons. */
export function fitEts(y: readonly number[], period = 4): EtsFit {
  let best: EtsFit | null = null;
  if (y.length >= 2 * period && period > 1) {
    for (const a of GRID) for (const b of GRID) for (const g of GRID) {
      const r = holtWinters(y, period, a, b, g);
      if (!best || r.sse < best.sse - 1e-12) {
        best = {
          kind: "holt-winters", alpha: a, beta: b, gamma: g, sse: r.sse,
          forecast: (h) => Array.from({ length: h }, (_, i) => r.level + (i + 1) * r.trend + (r.season[(r.n + i) % period] as number)),
        };
      }
    }
  } else {
    for (const a of GRID) for (const b of GRID) {
      const r = holt(y, a, b);
      if (!best || r.sse < best.sse - 1e-12) {
        best = { kind: "holt", alpha: a, beta: b, gamma: 0, sse: r.sse, forecast: (h) => Array.from({ length: h }, (_, i) => r.level + (i + 1) * r.trend) };
      }
    }
  }
  return best as EtsFit;
}

interface Backtest {
  smape: number;
  errorsByStep: number[][]; // absolute-scale errors per horizon step
}

function backtest(y: readonly number[], h: number, period: number, model: ForecastModel, clampLow: boolean): Backtest {
  const n = y.length;
  const start = Math.max(period + 1, Math.ceil(n / 2));
  const actualAll: number[] = [];
  const predAll: number[] = [];
  const errorsByStep: number[][] = Array.from({ length: h }, () => []);
  for (let origin = start; origin < n; origin++) {
    const train = y.slice(0, origin);
    const steps = Math.min(h, n - origin);
    let f = model === "ets" ? fitEts(train, period).forecast(steps) : seasonalNaive(train, steps, period);
    if (clampLow) f = f.map((v) => Math.max(0, v));
    for (let i = 0; i < steps; i++) {
      const a = y[origin + i] as number;
      actualAll.push(a);
      predAll.push(f[i] as number);
      (errorsByStep[i] as number[]).push(a - (f[i] as number));
    }
  }
  return { smape: smape(actualAll, predAll), errorsByStep };
}

/**
 * Picks ETS only if it beats seasonal-naive on the rolling-origin backtest (ties go to the simpler
 * baseline), then forecasts `horizon` steps with a band from the backtest errors at each step.
 */
export function forecastSeries(y: readonly number[], options: ForecastOptions = {}): ForecastResult {
  const h = Math.max(1, Math.floor(options.horizon ?? 2));
  const period = Math.max(1, Math.floor(options.period ?? 4));
  const clampLow = options.nonNegative ?? true;
  const z = options.z ?? 1.645;
  const clean = y.filter((v) => Number.isFinite(v));
  if (clean.length < MIN_HISTORY || clean.length !== y.length) {
    return { status: "insufficient-history", model: null, etsKind: null, points: [], smape: null, params: null };
  }
  const ets = backtest(clean, h, period, "ets", clampLow);
  const naive = backtest(clean, h, period, "seasonal-naive", clampLow);
  const model: ForecastModel = ets.smape < naive.smape - 1e-9 ? "ets" : "seasonal-naive";
  const fit = fitEts(clean, period);
  const raw = model === "ets" ? fit.forecast(h) : seasonalNaive(clean, h, period);
  const errs = (model === "ets" ? ets : naive).errorsByStep;
  const allErr = errs.flat();
  const rmse = (e: number[]) => Math.sqrt(e.reduce((s, v) => s + v * v, 0) / Math.max(1, e.length));
  const points = raw.map((v, i) => {
    const e = errs[i] ?? [];
    const sd = e.length >= 2 ? rmse(e) : rmse(allErr) * Math.sqrt(i + 1);
    const value = clampLow ? Math.max(0, v) : v;
    const low = value - z * sd;
    return { step: i + 1, value, low: clampLow ? Math.max(0, low) : low, high: value + z * sd };
  });
  return {
    status: "ok",
    model,
    etsKind: fit.kind,
    points,
    smape: { ets: ets.smape, naive: naive.smape },
    params: { alpha: fit.alpha, beta: fit.beta, gamma: fit.gamma },
  };
}
