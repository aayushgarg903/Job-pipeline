// Dictionary extractor: alias matching over the skill catalogue, with the evidence sentence,
// requirement, proficiency, years and negation read by regex. Implements the contract Extractor,
// so it is a drop-in stand-in for @ks/ai's Gemini extractor (select with EXTRACTOR=dictionary).
import type { ExtractedPosting, ExtractedSkill, Extractor, Lang, Proficiency, SkillId } from "@ks/contracts";
import { normalizeText } from "./util";

export const DICTIONARY_MODEL_ID = "dictionary-v1";

export interface AliasEntry { alias: string; skillId: SkillId }

const NEG_BEFORE = /\b(no|not|without|never|don'?t|doesn'?t|isn'?t|non|nor|neither)\b(?:\W+\w+){0,4}\W*$/i;
const NEG_AFTER = /^\W*(?:\w+\W+){0,3}(not (required|needed|necessary|mandatory)|is not a requirement)/i;
const PREFERRED = /\b(prefer(red|able)?|a plus|plus point|nice to have|good to have|desirable|added advantage|advantage|bonus)\b/i;
const OPTIONAL = /\b(optional|if any|not mandatory)\b/i;
const YEARS = /(\d+(?:\.\d+)?)\s*\+?\s*(?:-|to)?\s*(?:\d+\s*)?(?:years?|yrs?)\b/i;
const PROF_CUES: Array<[RegExp, Proficiency]> = [
  [/\b(expert|mastery|guru|architect-level)\b/i, 4],
  [/\b(advanced|strong|excellent|proficien(t|cy)|in-depth|deep)\b/i, 3],
  [/\b(hands-on|working knowledge|experience (in|with|of)|good (knowledge|understanding))\b/i, 2],
  [/\b(basic|familiar(ity)?|exposure|awareness|fundamentals?)\b/i, 1],
];
const STOP = new Set(["and", "or", "the", "of", "for", "in", "a", "an", "to", "with", "cum", "general", "other", "others", "n.e.c"]);

export function splitSentences(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split(/(?<=[.!?;])\s+|\n+|\s*[•·▪●]\s*|\s+-\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface Matcher { alias: string; skillId: SkillId; re: RegExp }

function buildMatchers(entries: AliasEntry[]): Matcher[] {
  const seen = new Set<string>();
  const out: Matcher[] = [];
  for (const e of entries) {
    const a = e.alias.trim().toLowerCase();
    if (a.length < 2 || seen.has(`${a}|${e.skillId}`)) continue;
    seen.add(`${a}|${e.skillId}`);
    // Unicode-aware word boundaries; works for Devanagari aliases too.
    out.push({ alias: a, skillId: e.skillId, re: new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(a)}(?![\\p{L}\\p{N}])`, "iu") });
  }
  return out.sort((x, y) => y.alias.length - x.alias.length); // longest first wins the span
}

export function readProficiency(sentence: string, years: number | null): Proficiency | null {
  for (const [re, p] of PROF_CUES) if (re.test(sentence)) return p;
  if (years != null) return years >= 5 ? 3 : years >= 2 ? 2 : 1;
  return null;
}

/** Find catalogue skills in free text. One hit per skill: its first non-negated sentence wins. */
export function matchSkills(text: string, matchers: Matcher[]): ExtractedSkill[] {
  const found = new Map<SkillId, ExtractedSkill>();
  for (const sentence of splitSentences(text)) {
    const taken: Array<[number, number]> = [];
    for (const m of matchers) {
      const hit = m.re.exec(sentence);
      if (!hit) continue;
      const start = hit.index;
      const end = start + hit[0].length;
      if (taken.some(([s, e]) => start < e && end > s)) continue;
      taken.push([start, end]);
      const before = sentence.slice(Math.max(0, start - 60), start);
      const after = sentence.slice(end, end + 60);
      const negated = NEG_BEFORE.test(before) || NEG_AFTER.test(after);
      const yearsMatch = sentence.match(YEARS);
      const years = yearsMatch ? Number(yearsMatch[1]) : null;
      const requirement = OPTIONAL.test(sentence) ? "optional" : PREFERRED.test(sentence) ? "preferred" : "required";
      const skill: ExtractedSkill = {
        text: hit[0], skillId: m.skillId, requirement, proficiency: readProficiency(sentence, years), years,
        negated, evidence: sentence, confidence: m.alias.length >= 4 ? 0.8 : 0.65,
      };
      const prev = found.get(m.skillId);
      if (!prev || (prev.negated && !negated)) found.set(m.skillId, skill);
    }
  }
  return [...found.values()];
}

const tokens = (s: string) => normalizeText(s).split(" ").filter((w) => w.length > 1 && !STOP.has(w));

/** Title → NCO by token overlap with occupation titles (the embedding NN in @ks/ai replaces this). */
export function matchOccupation(title: string, occupations: Array<{ nco: string; titleEn: string }>): { nco: string | null; confidence: number } {
  const t = new Set(tokens(title).map((w) => w.replace(/s$/, "")));
  let best = { nco: null as string | null, score: 0 };
  for (const o of occupations) {
    const ot = tokens(o.titleEn).map((w) => w.replace(/s$/, ""));
    if (!ot.length) continue;
    const hits = ot.filter((w) => t.has(w)).length;
    const score = hits / Math.max(ot.length, 1) * (hits / Math.max(t.size, 1)) ** 0.25;
    if (score > best.score) best = { nco: o.nco, score };
  }
  return best.score >= 0.34 ? { nco: best.nco, confidence: Math.min(0.9, 0.4 + best.score / 2) } : { nco: null, confidence: 0 };
}

export function workModeOf(text: string): ExtractedPosting["workMode"] {
  if (/\b(remote|work from home|wfh)\b/i.test(text)) return /\bhybrid\b/i.test(text) ? "hybrid" : "remote";
  if (/\bhybrid\b/i.test(text)) return "hybrid";
  if (/\b(on-?site|in office|work from office|wfo|plant|factory|shop floor)\b/i.test(text)) return "on_site";
  return "unknown";
}

export class DictionaryExtractor implements Extractor {
  private cache = new Map<string, Matcher[]>();
  constructor(private aliases: AliasEntry[] = []) {}

  private matchers(catalog: Array<{ id: SkillId; labelEn: string }>): Matcher[] {
    const key = `${catalog.length}:${this.aliases.length}`;
    let m = this.cache.get(key);
    if (!m) {
      m = buildMatchers([...catalog.map((s) => ({ alias: s.labelEn, skillId: s.id })), ...this.aliases]);
      this.cache.set(key, m);
    }
    return m;
  }

  async extractPosting(input: Parameters<Extractor["extractPosting"]>[0]): Promise<ExtractedPosting> {
    const text = `${input.title}.\n${input.description}`;
    const occ = matchOccupation(input.title, input.occupations);
    return {
      nco: occ.nco, ncoConfidence: occ.confidence, workMode: workModeOf(text),
      skills: matchSkills(text, this.matchers(input.skillsCatalog)), model: DICTIONARY_MODEL_ID,
    };
  }

  async parseCandidateSkills(input: { text: string; lang: Lang; skillsCatalog: Array<{ id: SkillId; labelEn: string }> }) {
    return matchSkills(input.text, this.matchers(input.skillsCatalog))
      .filter((s) => !s.negated && s.skillId)
      .map((s) => ({ skillId: s.skillId as SkillId, proficiency: (s.proficiency ?? 2) as Proficiency }));
  }

  /** Grounded, template-only prose: every sentence restates a passed-in fact, nothing is invented. */
  async narrate(input: { kind: string; facts: Record<string, unknown>; lang: Lang }): Promise<string> {
    const parts = Object.entries(input.facts)
      .filter(([, v]) => v != null && (typeof v !== "object" || Array.isArray(v)))
      .map(([k, v]) => `${k.replace(/([A-Z])/g, " $1").toLowerCase()}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
    return parts.length ? `${parts.join("; ")}.` : "";
  }
}
