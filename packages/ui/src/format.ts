// Formatting helpers. Pure functions, safe in server and client components.
// No Date.now() here: Cache Components forbids it in prerendered server code.
import type { Lang } from "@ks/contracts";

/** Intl locale for a UI language. Latin digits in both: figures are set in IBM Plex Mono. */
export function intlLocale(lang: Lang = "en"): string {
  return lang === "mr" ? "mr-IN-u-nu-latn" : "en-IN";
}

export function formatNumber(n: number, lang: Lang = "en", opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(intlLocale(lang), opts).format(n);
}

export function formatPercent(fraction: number, lang: Lang = "en", digits = 0): string {
  return new Intl.NumberFormat(intlLocale(lang), { style: "percent", maximumFractionDigits: digits }).format(fraction);
}

/**
 * Round a people count the way a person would say it: 137 -> 140, 1,243 -> 1,200.
 * Small numbers stay exact ("Our ITIs will train 35").
 */
export function humanRound(n: number): number {
  const a = Math.abs(n);
  if (a < 50) return Math.round(n);
  if (a < 1000) return Math.round(n / 10) * 10;
  if (a < 10000) return Math.round(n / 100) * 100;
  const mag = 10 ** (Math.floor(Math.log10(a)) - 1);
  return Math.round(n / mag) * mag;
}

/** True when rounding changed the number, so the UI should say "about". */
export function isApprox(n: number): boolean {
  return humanRound(n) !== Math.round(n);
}

const TZ = "Asia/Kolkata";

/** "SEP 26" style stamp for provenance lines. */
export function formatAsOf(iso: string, lang: Lang = "en"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(intlLocale(lang), { month: "short", year: "2-digit", timeZone: TZ }).format(d);
}

/** "24 Sep 2026" */
export function formatDate(iso: string, lang: Lang = "en"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(intlLocale(lang), { day: "numeric", month: "short", year: "numeric", timeZone: TZ }).format(d);
}

/** "24 Sep, 14:05" */
export function formatDateTime(iso: string, lang: Lang = "en"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(intlLocale(lang), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ }).format(d);
}

/** Replace {name} placeholders. Keeps label props serialisable (strings, not functions). */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
