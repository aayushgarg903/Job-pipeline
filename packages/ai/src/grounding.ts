// Post-checks for generated prose: every number in the output must come from the
// facts, no marketing words, 2-4 sentences.

const DEVANAGARI_DIGITS = "०१२३४५६७८९";

/** Converts Devanagari digits to ASCII so "१४०" and "140" compare equal. */
export function asciiDigits(text: string): string {
  return text.replace(/[०-९]/gu, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));
}

/**
 * Numbers written in `text`. Handles Indian and Western digit grouping
 * ("1,20,000", "1,200"), decimals, and Devanagari digits. Digits glued to a
 * preceding letter ("Q3", "NSQF4") are identifiers, not quantities, and are skipped.
 */
export function extractNumbers(text: string): number[] {
  const out: number[] = [];
  const re = /(?<![\p{L}\p{M}\d.,])\d+(?:,\d{2,3})*(?:\.\d+)?/gu;
  for (const m of asciiDigits(text).matchAll(re)) {
    const n = Number(m[0].replace(/,/g, ""));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/** Every number present in the facts: numeric values and numbers written inside strings. */
export function factNumbers(facts: unknown): number[] {
  const out: number[] = [];
  const walk = (v: unknown, depth: number) => {
    if (depth > 8 || v === null || v === undefined) return;
    if (typeof v === "number") { if (Number.isFinite(v)) out.push(v); return; }
    if (typeof v === "string") { out.push(...extractNumbers(v)); return; }
    if (Array.isArray(v)) { v.forEach((x) => walk(x, depth + 1)); return; }
    if (typeof v === "object") Object.values(v as Record<string, unknown>).forEach((x) => walk(x, depth + 1));
  };
  walk(facts, 0);
  return out;
}

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

/**
 * The renderings of a fact number a writer may legitimately use: the value,
 * its roundings, a 0..1 share as a percentage, and INR amounts in lakh / crore.
 */
function allowedForms(n: number): number[] {
  const forms = [n, Math.round(n), round(n, 1), round(n, 2), Math.abs(n)];
  if (Math.abs(n) <= 1) forms.push(Math.round(n * 100), round(n * 100, 1));
  if (Math.abs(n) >= 1e5) forms.push(round(n / 1e5, 1), round(n / 1e5, 2), Math.round(n / 1e5));
  if (Math.abs(n) >= 1e7) forms.push(round(n / 1e7, 1), round(n / 1e7, 2), Math.round(n / 1e7));
  return forms;
}

/** Numbers in `text` that do not appear in `facts` in any allowed form. */
export function ungroundedNumbers(text: string, facts: unknown): number[] {
  const allowed = new Set<number>();
  for (const n of factNumbers(facts)) for (const f of allowedForms(n)) allowed.add(f);
  return extractNumbers(text).filter((n) => !allowed.has(n));
}

export const MARKETING_WORDS = [
  "unlock", "unlocks", "unlocking", "leverage", "leverages", "leveraging", "insight", "insights",
  "synergy", "synergies", "empower", "empowers", "empowering", "seamless", "seamlessly",
  "cutting-edge", "game-changer", "game-changing", "revolutionize", "revolutionise", "harness",
  "robust", "holistic", "at your fingertips", "delve", "elevate", "supercharge", "next-level",
  "world-class", "best-in-class", "transformative",
];

/** Marketing / AI-filler words present in the text (lowercased). */
export function marketingWords(text: string): string[] {
  const lower = text.toLowerCase();
  // Words are plain letters, spaces and hyphens, so they are safe as literal regex source.
  return MARKETING_WORDS.filter((w) => new RegExp(`(?<![\\p{L}-])${w}(?![\\p{L}-])`, "u").test(lower));
}

/** Sentence split for prose (en + mr): ., !, ?, and the danda. */
export function proseSentences(text: string): string[] {
  return text.split(/(?<=[.!?।])\s+/u).map((s) => s.trim()).filter(Boolean);
}

export interface ProseCheck { ok: boolean; issues: string[]; text: string }

/**
 * Validates generated prose against its facts. Trims to 4 sentences if longer;
 * fails on ungrounded numbers, marketing words, or fewer than 2 sentences.
 */
export function checkProse(raw: string, facts: unknown): ProseCheck {
  const cleaned = raw.replace(/^["'“”\s]+|["'“”\s]+$/gu, "").replace(/\s*\n+\s*/g, " ").trim();
  const sentences = proseSentences(cleaned);
  const text = sentences.slice(0, 4).join(" ");
  const issues: string[] = [];
  const bad = ungroundedNumbers(text, facts);
  if (bad.length) issues.push(`numbers not in facts: ${bad.join(", ")}`);
  const words = marketingWords(text);
  if (words.length) issues.push(`marketing words: ${words.join(", ")}`);
  if (sentences.length < 2) issues.push(`only ${sentences.length} sentence(s)`);
  return { ok: issues.length === 0, issues, text };
}
