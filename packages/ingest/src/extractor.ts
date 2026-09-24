// Extractor selection. SWAP POINT for the lead: EXTRACTOR=gemini loads @ks/ai.
// Expected export from @ks/ai (either name works): createExtractor() or createGeminiExtractor(),
// returning the contract `Extractor`. Until @ks/ai lands, EXTRACTOR=gemini falls back to the dictionary.
import type { Extractor } from "@ks/contracts";
import type { Sql } from "@ks/db";
import { type AliasEntry, DictionaryExtractor } from "./extract-fallback";

export async function loadAliases(sql: Sql): Promise<AliasEntry[]> {
  const rows = await sql<{ alias: string; skill_id: string }[]>`select alias, skill_id from ks.skill_alias`;
  return rows.map((r) => ({ alias: r.alias, skillId: r.skill_id }));
}

export async function selectExtractor(sql: Sql): Promise<{ extractor: Extractor; name: string }> {
  const want = (process.env.EXTRACTOR ?? "dictionary").toLowerCase();
  if (want === "gemini") {
    try {
      const spec = "@ks/ai"; // non-literal so typecheck doesn't require @ks/ai to exist yet
      const mod = (await import(spec)) as Record<string, unknown>;
      const make = (mod.createExtractor ?? mod.createGeminiExtractor) as undefined | (() => Extractor | Promise<Extractor>);
      if (make) return { extractor: await make(), name: "gemini" };
      console.warn("@ks/ai has no createExtractor export; using the dictionary extractor");
    } catch (e) {
      console.warn(`@ks/ai unavailable (${String(e).slice(0, 120)}); using the dictionary extractor`);
    }
  }
  return { extractor: new DictionaryExtractor(await loadAliases(sql)), name: "dictionary" };
}
