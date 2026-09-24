import { createHash } from "node:crypto";

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Lowercase, strip accents/punctuation, collapse whitespace. Devanagari is preserved. */
export function normalizeText(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}+#.\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function quarterOf(d: Date): string {
  return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
}

export function quarterStart(q: string): Date {
  const [y, n] = q.split("-Q").map(Number) as [number, number];
  return new Date(Date.UTC(y, (n - 1) * 3, 1));
}

export function shiftQuarter(q: string, by: number): string {
  const [y, n] = q.split("-Q").map(Number) as [number, number];
  const idx = y * 4 + (n - 1) + by;
  return `${Math.floor(idx / 4)}-Q${(idx % 4) + 1}`;
}

/** The last `count` quarters ending at `end`, oldest first. */
export function quarterRange(end: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => shiftQuarter(end, i - count + 1));
}

export interface HttpResult<T> { status: number; body: T | null; ms: number }

/** fetch + JSON with timeout. Never throws on HTTP status; the caller decides. */
export async function getJson<T>(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<HttpResult<T>> {
  const t0 = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), init.timeoutMs ?? 30_000);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    const text = await res.text();
    let body: T | null = null;
    try { body = JSON.parse(text) as T; } catch { body = null; }
    return { status: res.status, body, ms: Date.now() - t0 };
  } catch {
    return { status: 0, body: null, ms: Date.now() - t0 };
  } finally {
    clearTimeout(timer);
  }
}

export function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}
