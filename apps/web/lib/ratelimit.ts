// In-memory token bucket per (bucket, client IP). Good enough for one Node instance during the
// demo; put a shared store (Upstash/Redis) behind the same function before scaling out.
import { headers } from "next/headers";

const buckets = new Map<string, { tokens: number; at: number }>();
const MAX_KEYS = 10_000;

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}

/** true = allowed. `perMinute` tokens refill continuously; burst = perMinute. */
export async function take(bucket: string, perMinute: number, ip?: string): Promise<boolean> {
  const key = `${bucket}:${ip ?? (await clientIp())}`;
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: perMinute, at: now };
  b.tokens = Math.min(perMinute, b.tokens + ((now - b.at) / 60_000) * perMinute);
  b.at = now;
  if (b.tokens < 1) { buckets.set(key, b); return false; }
  b.tokens -= 1;
  if (buckets.size >= MAX_KEYS && !buckets.has(key)) buckets.clear();
  buckets.set(key, b);
  return true;
}
