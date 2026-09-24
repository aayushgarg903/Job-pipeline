// ESCO API (no auth). Fills skill.esco_uri for catalogue skills that have none yet, accepting only
// a result whose preferred label closely matches ours.
import type { Sql } from "@ks/db";
import { type SourceAdapter, healthFromLog, logHealth, storeRaw } from "../store";
import { getJson, normalizeText, sleep } from "../util";

interface EscoSearch { _embedded?: { results?: Array<{ uri: string; title: string; className?: string }> } }

export function labelsMatch(a: string, b: string): boolean {
  const x = normalizeText(a), y = normalizeText(b);
  if (x === y) return true;
  const tx = new Set(x.split(" ")), ty = new Set(y.split(" "));
  const inter = [...tx].filter((w) => ty.has(w)).length;
  return inter / Math.max(tx.size, ty.size) >= 0.75;
}

export function createEscoAdapter(sql: Sql, opts: { maxRequests?: number } = {}): SourceAdapter {
  return {
    id: "esco",
    health: healthFromLog(sql, "esco"),
    async fetch() {
      const todo = await sql<{ id: string; label_en: string }[]>`
        select id, label_en from ks.skill where esco_uri is null order by id limit ${opts.maxRequests ?? 40}`;
      let requests = 0, matched = 0, failed = 0;
      for (const s of todo) {
        const url = `https://ec.europa.eu/esco/api/search?language=en&type=skill&limit=5&text=${encodeURIComponent(s.label_en)}`;
        const r = await getJson<EscoSearch>(url, { timeoutMs: 20_000 });
        requests++;
        if (r.status !== 200) { failed++; continue; }
        const results = r.body?._embedded?.results ?? [];
        await storeRaw(sql, "esco", `search:${s.id}`, { q: s.label_en, results: results.map((x) => ({ uri: x.uri, title: x.title })) });
        const hit = results.find((x) => labelsMatch(x.title, s.label_en));
        if (hit) {
          await sql`update ks.skill set esco_uri = ${hit.uri} where id = ${s.id} and esco_uri is null`;
          matched++;
        }
        await sleep(250);
      }
      const note = `${todo.length} skills without a URI checked, ${matched} matched, ${failed} failed`;
      await logHealth(sql, { sourceId: "esco", ok: failed < Math.max(1, requests), rows: matched, requests, note });
      return { rows: matched, requests, note };
    },
  };
}
