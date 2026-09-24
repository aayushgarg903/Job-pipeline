// Extractor selection. EXTRACTOR=gemini uses @ks/ai's createExtractor() (the contract `Extractor`),
// wrapped so a failed or over-budget call falls back to the dictionary for that posting:
//   KS_LLM_MAX_CALLS  stop issuing Gemini calls once this many API attempts were made (default 40)
//   KS_TIMEOUT_MS / KS_CONCURRENCY / KS_MODEL / KS_MODEL_FALLBACKS  read by @ks/ai's router
import { createExtractor } from "@ks/ai";
import type { ExtractedPosting, Extractor } from "@ks/contracts";
import type { Sql } from "@ks/db";
import { type AliasEntry, DictionaryExtractor } from "./extract-fallback";

export async function loadAliases(sql: Sql): Promise<AliasEntry[]> {
  const rows = await sql<{ alias: string; skill_id: string }[]>`select alias, skill_id from ks.skill_alias`;
  return rows.map((r) => ({ alias: r.alias, skillId: r.skill_id }));
}

export interface ExtractorStats {
  llmOk: number; llmFailed: number; skippedBudget: number; apiCalls: number;
  models: Record<string, number>; // model id → postings it answered
  llmSkills: number; dictSkillsSamePostings: number; // matched skills, Gemini vs dictionary on the same postings
  errors: string[];
  attempts: Record<string, number>; // "model status" → API attempts
}

export interface SelectedExtractor { extractor: Extractor; name: string; stats?: () => ExtractorStats }

type Ai = ReturnType<typeof createExtractor>;

/** Gemini first, dictionary on failure or once the call budget is spent. */
export function budgetedExtractor(ai: Pick<Ai, "extractPosting" | "router"> & Partial<Ai>, dict: Extractor, maxCalls: number): { extractor: Extractor; stats: () => ExtractorStats } {
  const s: ExtractorStats = { llmOk: 0, llmFailed: 0, skippedBudget: 0, apiCalls: 0, models: {}, llmSkills: 0, dictSkillsSamePostings: 0, errors: [], attempts: {} };
  const known = (p: ExtractedPosting) => p.skills.filter((x) => x.skillId && !x.negated).length;
  const extractor: Extractor = {
    parseCandidateSkills: (input) => dict.parseCandidateSkills(input),
    narrate: (input) => dict.narrate(input),
    async extractPosting(input) {
      const fallback = await dict.extractPosting(input);
      if (ai.router.attempts().length >= maxCalls) { s.skippedBudget++; return fallback; }
      try {
        const out = await ai.extractPosting(input);
        s.llmOk++;
        s.models[out.model] = (s.models[out.model] ?? 0) + 1;
        s.llmSkills += known(out);
        s.dictSkillsSamePostings += known(fallback);
        return out;
      } catch (e) {
        s.llmFailed++;
        if (s.errors.length < 5) s.errors.push(String((e as Error)?.message ?? e).slice(0, 200));
        return fallback;
      } finally {
        s.apiCalls = ai.router.attempts().length;
      }
    },
  };
  const attempts = () => {
    const out: Record<string, number> = {};
    for (const a of ai.router.attempts()) {
      const k = `${a.model ?? "?"} ${a.status ?? (a.error ? "error" : "?")}`;
      out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  };
  return { extractor, stats: () => ({ ...s, apiCalls: ai.router.attempts().length, attempts: attempts() }) };
}

export async function selectExtractor(sql: Sql): Promise<SelectedExtractor> {
  const dict = new DictionaryExtractor(await loadAliases(sql));
  const want = (process.env.EXTRACTOR ?? "dictionary").toLowerCase();
  if (want !== "gemini") return { extractor: dict, name: "dictionary" };
  const max = Number(process.env.KS_LLM_MAX_CALLS ?? 40);
  const { extractor, stats } = budgetedExtractor(createExtractor(), dict, Number.isFinite(max) ? max : 40);
  return { extractor, name: "gemini", stats };
}
