// pnpm ingest embed: fill ks.skill.embedding (768-d, gemini-embedding) for skills that lack one.
// Text = label + kind + up to 6 aliases, so "PLC" and "programmable logic controllers" land close.
// Idempotent; `--all` re-embeds every skill. Vectors are L2-normalised by @ks/ai.
import { createEmbedder, EMBED_DIMS } from "@ks/ai";
import type { Sql } from "@ks/db";

export async function embedSkills(sql: Sql, opts: { all?: boolean } = {}): Promise<Record<string, unknown>> {
  const rows = await sql<{ id: string; label_en: string; kind: string; aliases: string[] }[]>`
    select s.id, s.label_en, s.kind,
      coalesce((select array_agg(a.alias order by a.confidence desc nulls last, a.alias)
                from (select * from ks.skill_alias x where x.skill_id = s.id limit 6) a), '{}') as aliases
    from ks.skill s where ${opts.all ?? false} or s.embedding is null order by s.id`;
  if (!rows.length) return { embedded: 0, note: "every skill already has an embedding" };
  const text = (r: (typeof rows)[number]) =>
    `${r.label_en} (${r.kind})${r.aliases.length ? `. Also called: ${r.aliases.filter((a) => a !== r.label_en.toLowerCase()).join(", ")}` : ""}`;
  // The free tier counts each text in a batch as one request, 100 per minute per model: embed in
  // chunks of KS_EMBED_CHUNK (default 90) texts, a minute apart, and save each chunk as it lands.
  const chunkSize = Math.max(1, Math.min(100, Number(process.env.KS_EMBED_CHUNK ?? 90) || 90));
  const pauseMs = Number(process.env.KS_EMBED_PAUSE_MS ?? 65_000);
  const embedder = createEmbedder();
  let done = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    if (i > 0) await new Promise((r) => setTimeout(r, pauseMs));
    const part = rows.slice(i, i + chunkSize);
    let vectors: number[][] | null = null;
    for (let attempt = 0; !vectors; attempt++) {
      try {
        // A fresh embedder per try: the router parks a model for 10 min after a quota 429.
        vectors = await (attempt === 0 ? embedder : createEmbedder()).embed(part.map(text));
      } catch (e) {
        if (attempt >= 3 || !/429|quota/i.test(String(e))) throw e;
        await new Promise((r) => setTimeout(r, pauseMs));
      }
    }
    if (vectors.some((v) => v.length !== EMBED_DIMS)) throw new Error("embedder returned a vector of the wrong size");
    const values = part.map((r, j) => [r.id, `[${vectors[j]!.join(",")}]`]);
    await sql`update ks.skill s set embedding = v.e::extensions.vector
              from (values ${sql(values)}) as v(id, e) where s.id = v.id`;
    done += part.length;
  }
  return { embedded: done, dims: EMBED_DIMS, ...embedder.stats() };
}
