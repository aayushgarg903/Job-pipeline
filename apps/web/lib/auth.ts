// Minimal officer gate for the hackathon build. A shared passcode (CONSOLE_PASSCODE) plus the
// officer's name, sealed in an HMAC-signed, httpOnly cookie. Real deployments swap this for
// Supabase Auth + RLS roles (Architecture §8); every write path already calls requireOfficer().
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const OFFICER_COOKIE = "ks-officer";
const MAX_AGE_S = 8 * 60 * 60;

function secret(): string | null {
  const s = process.env.CONSOLE_PASSCODE;
  return s && s.length >= 8 ? s : null;
}
const mac = (key: string, data: string) => createHmac("sha256", key).update(data).digest("base64url");
function safeEq(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function sealOfficer(name: string, now = Date.now()): string | null {
  const key = secret();
  if (!key) return null;
  const body = Buffer.from(JSON.stringify({ n: name, exp: now + MAX_AGE_S * 1000 })).toString("base64url");
  return `${body}.${mac(key, body)}`;
}

export function checkPasscode(passcode: string): boolean {
  const key = secret();
  return !!key && safeEq(mac(key, passcode), mac(key, key));
}

/** The signed-in officer's name, or null. Never call inside a "use cache" scope. */
export async function getOfficer(): Promise<string | null> {
  const key = secret();
  const raw = (await cookies()).get(OFFICER_COOKIE)?.value;
  if (!key || !raw) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig || !safeEq(sig, mac(key, body))) return null;
  try {
    const { n, exp } = JSON.parse(Buffer.from(body, "base64url").toString()) as { n: string; exp: number };
    return typeof n === "string" && exp > Date.now() ? n : null;
  } catch {
    return null;
  }
}

export const officerCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: MAX_AGE_S };
