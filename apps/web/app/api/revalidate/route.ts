// POST /api/revalidate — called by ingest after new facts land. HMAC-SHA256 signed with
// REVALIDATE_SECRET over `${timestamp}.${rawBody}`:
//   x-ks-timestamp: unix seconds (must be within 5 minutes)
//   x-ks-signature: sha256=<hex>
//   body: {"tags": ["state", "district:490", "skill:power-bi", "course:pune-pmkvy-data"]}
// Each tag is revalidated with the "max" profile (stale-while-revalidate).
import { createHmac, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { z } from "zod";

const MAX_SKEW_SECONDS = 300;
const MAX_BODY_BYTES = 16 * 1024;
const Tag = z.string().regex(/^(state|district:[0-9]{1,6}|skill:[a-z0-9-]{1,80}|course:[\w.-]{1,80}|plan:[0-9]{1,6}:FY[0-9]{2})$/);
const Body = z.object({ tags: z.array(Tag).min(1).max(100) });

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

function validSignature(secret: string, ts: string, raw: string, header: string): boolean {
  const expected = createHmac("sha256", secret).update(`${ts}.${raw}`).digest();
  const given = Buffer.from(header.replace(/^sha256=/, ""), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return json(503, { ok: false, error: "revalidation is not configured" });

  const ts = request.headers.get("x-ks-timestamp") ?? "";
  const sig = request.headers.get("x-ks-signature") ?? "";
  const now = Math.floor(Date.now() / 1000);
  if (!/^\d{9,12}$/.test(ts) || Math.abs(now - Number(ts)) > MAX_SKEW_SECONDS) return json(401, { ok: false, error: "stale or missing timestamp" });

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { ok: false, error: "body too large" });
  if (!/^(sha256=)?[0-9a-f]{64}$/i.test(sig) || !validSignature(secret, ts, raw, sig)) return json(401, { ok: false, error: "bad signature" });

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(JSON.parse(raw));
  } catch {
    return json(400, { ok: false, error: "body must be {\"tags\": [...]} with known tag shapes" });
  }
  const tags = [...new Set(parsed.tags)];
  for (const tag of tags) revalidateTag(tag, "max");
  return json(200, { ok: true, revalidated: tags });
}
