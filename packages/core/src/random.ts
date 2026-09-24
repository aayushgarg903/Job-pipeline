// Small deterministic PRNG and sampling helpers. No Math.random anywhere in the engine:
// the same inputs and seed always give the same intervals.

/** 32-bit FNV-1a hash of a string, used to derive stable per-cell seeds. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32: tiny, fast, good enough for bootstrap draws. Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  uniform(): number;
  normal(): number;
  gamma(shape: number, scale: number): number;
}

/** A seeded generator. `key` lets callers derive independent streams per cell. */
export function createRng(seed: number, key = ""): Rng {
  const u = mulberry32((seed ^ hashString(key)) >>> 0);
  let spare: number | null = null;
  const uniform = () => {
    let x = u();
    while (x === 0) x = u();
    return x;
  };
  const normal = () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    const r = Math.sqrt(-2 * Math.log(uniform()));
    const th = 2 * Math.PI * uniform();
    spare = r * Math.sin(th);
    return r * Math.cos(th);
  };
  // Marsaglia–Tsang, with the shape<1 boost.
  const gamma = (shape: number, scale: number): number => {
    if (!(shape > 0) || !(scale > 0)) return 0;
    if (shape < 1) return gamma(shape + 1, scale) * Math.pow(uniform(), 1 / shape);
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x: number;
      let v: number;
      do {
        x = normal();
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const uu = uniform();
      if (uu < 1 - 0.0331 * x * x * x * x) return d * v * scale;
      if (Math.log(uu) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * scale;
    }
  };
  return { uniform, normal, gamma };
}

/** Linear-interpolated quantile of an unsorted array (q in [0,1]). */
export function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * Math.min(1, Math.max(0, q));
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = s[lo] as number;
  const b = s[hi] as number;
  return a + (b - a) * (pos - lo);
}

export function median(values: readonly number[]): number {
  return quantile(values, 0.5);
}

/** Standard normal CDF (Zelen & Severo 26.2.17, |error| < 7.5e-8). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const p =
    d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z > 0 ? 1 - p : p;
}

export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
