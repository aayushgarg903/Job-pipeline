// Deterministic checks on model output against the untrusted source text:
// evidence must be a verbatim substring, negation is double-checked with cue
// patterns, and sentences that look like prompt injection are flagged.

const QUOTES = "'\"‘’“”`´";
const DASHES = "-‐‑‒–—−";

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Regex source for one token that tolerates curly/straight quotes and dash variants. */
function tokenPattern(token: string): string {
  let out = "";
  for (const ch of token) {
    if (QUOTES.includes(ch)) out += `[${escapeRe(QUOTES)}]`;
    else if (DASHES.includes(ch)) out += `[${escapeRe(DASHES)}]`;
    else out += escapeRe(ch);
  }
  return out;
}

const TRIM_CHARS = new RegExp(`^[\\s${escapeRe(QUOTES)}•*·]+|[\\s${escapeRe(QUOTES)}]+$`, "gu");

export type EvidenceMatch =
  | { kind: "exact"; span: string }
  | { kind: "normalised"; span: string } // same words; whitespace/case/quote style differed
  | { kind: "none" };

/**
 * Is `evidence` a verbatim substring of `source`? If it only differs in whitespace,
 * case, or quote/dash style, recover the exact span from the source so the stored
 * evidence is still a true substring.
 */
export function locateEvidence(evidence: string, source: string): EvidenceMatch {
  const ev = evidence.trim();
  if (!ev) return { kind: "none" };
  if (source.includes(ev)) return { kind: "exact", span: ev };
  const core = ev.replace(TRIM_CHARS, "").replace(/[.।]+$/u, "");
  if (core.length < 3) return { kind: "none" };
  if (source.includes(core)) return { kind: "exact", span: core };
  const tokens = core.split(/\s+/u).filter(Boolean);
  const re = new RegExp(tokens.map(tokenPattern).join("\\s+"), "iu");
  const m = re.exec(source);
  return m ? { kind: "normalised", span: m[0] } : { kind: "none" };
}

/** Sentences and bullet lines. Handles the Devanagari danda (।). */
export function splitSentences(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?।])\s+/u)
    .map((s) => s.replace(/^[\s•*·-]+/u, "").trim())
    .filter((s) => s.length > 0);
}

/** First sentence of `source` that mentions `phrase` (case-insensitive), verbatim. */
export function sentenceMentioning(phrase: string, source: string): string | null {
  const p = phrase.trim().toLowerCase();
  if (p.length < 2) return null;
  return splitSentences(source).find((s) => s.toLowerCase().includes(p)) ?? null;
}

// ---------------------------------------------------------------- negation
const NEGATION_CUES: RegExp[] = [
  /\b(?:is|are)?\s*not\s+(?:required|needed|necessary|mandatory|compulsory|essential|expected|a\s+must|a\s+requirement)\b/i,
  /\bn['’]t\s+(?:required|needed|necessary)\b/i,
  /\b(?:do|does)\s*n['’]?o?t\s+need\b/i,
  /\bneed\s+not\b/i,
  /\bno\s+(?:need|requirement)\s+(?:for|of|to)\b/i,
  /\bnot\s+(?:looking\s+for|asking\s+for)\b/i,
  /\bnot\s+part\s+of\s+(?:this|the)\s+(?:role|job)\b/i,
  // Marathi / Hindi (Devanagari and romanised)
  /आवश्यक\s*नाही|गरज\s*नाही|अनिवार्य\s*नाही|लागत\s*नाही|नको|ज़?जरूरी\s*नहीं|ज़रूरी\s*नहीं/u,
  /\b(?:garaj|garaz|jaruri|zaruri|compulsory)\s+nahi\b/i,
];

/** Split a sentence into clauses so a cue only applies to the skill it sits next to. */
function clauses(sentence: string): string[] {
  return sentence.split(/[;,()]|\s+(?:but|however|whereas|although|though|and|पण|परंतु|मात्र|आणि)\s+/iu);
}

/**
 * Deterministic negation check: does the clause of `evidence` that mentions
 * `skillText` carry a negation cue? Also handles list headers such as
 * "Not required: Docker, Kubernetes". Returns null when the skill text can't be
 * found in the evidence, so the model's judgement stands.
 */
export function negationCue(skillText: string, evidence: string): boolean | null {
  const needle = skillText.trim().toLowerCase();
  const idx = needle ? evidence.toLowerCase().indexOf(needle) : -1;
  if (idx < 0) return null;
  const clause = clauses(evidence).find((c) => c.toLowerCase().includes(needle));
  if (clause && NEGATION_CUES.some((re) => re.test(clause))) return true;
  const colon = evidence.indexOf(":");
  if (colon >= 0 && colon < idx && NEGATION_CUES.some((re) => re.test(evidence.slice(0, colon)))) return true;
  return false;
}

// ---------------------------------------------------------------- injection
const INJECTION_PATTERNS: RegExp[] = [
  /\b(?:ignore|disregard|forget|override)\b.{0,40}\b(?:instructions?|prompts?|rules|guidelines|above|previous)\b/i,
  /\b(?:system|developer|admin)\s*(?:prompt|note|message|instruction|mode|override)s?\b/i,
  /\byou\s+are\s+now\b/i,
  /\bnew\s+instructions?\s*:/i,
  /\b(?:LLM|GPT|Gemini|ChatGPT|language\s+model|AI\s+(?:model|parser|system|agent|reader)|parser|extractor)s?\b.{0,60}\b(?:must|should|shall|output|return|list|classify|set|tag|mark)\b/i,
  /<\/?\s*(?:job_?posting|system|instructions?|data)\b[^>]*>/i,
  /\b(?:BEGIN|END)\s+UNTRUSTED\b/i,
];

/** Sentences of the untrusted text that look like instructions aimed at a model. */
export function suspiciousSentences(text: string): string[] {
  return splitSentences(text).filter((s) => INJECTION_PATTERNS.some((re) => re.test(s)));
}

/** True when the evidence span lies inside (or contains) a flagged sentence. */
export function overlapsAny(span: string, flagged: string[]): boolean {
  const s = span.trim();
  return flagged.some((f) => f.includes(s) || s.includes(f));
}
