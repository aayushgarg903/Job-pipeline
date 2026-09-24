// pnpm ingest --source=udyam|jsearch|esco|openalex|all [--since=YYYY-MM-DD] [--max-requests=N] [--samples=N]
// pnpm ingest facts            rebuild supply estimates, demand/supply facts, cells, course health
// pnpm ingest normalize        re-run normalisation over stored raw postings (no API calls)
import { createSql } from "@ks/db";
import { ensureSources } from "./store";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k!, v ?? "true"];
  }),
);
const num = (k: string) => (args[k] ? Number(args[k]) : undefined);

async function main() {
  const sql = createSql(undefined, 2);
  const t0 = Date.now();
  const command = args.facts ? "facts" : args.normalize ? "normalize" : `ingest:${args.source ?? "all"}`;
  const [run] = await sql<{ id: number }[]>`insert into ks.pipeline_run (command) values (${command}) returning id`;
  const stats: Record<string, unknown> = {};
  let ok = true;
  try {
    await ensureSources(sql);
    if (args.facts) {
      const { buildFacts } = await import("./facts");
      stats.facts = await buildFacts(sql);
    } else if (args.normalize) {
      const { normalizeStoredPostings } = await import("./normalize");
      stats.normalize = await normalizeStoredPostings(sql);
    } else {
      const which = args.source ?? "all";
      const since = args.since ? new Date(args.since) : null;
      const run1 = async (name: string, make: () => Promise<{ fetch: (s: Date | null) => Promise<unknown> }>) => {
        if (which !== "all" && which !== name) return;
        try {
          stats[name] = await (await make()).fetch(since);
        } catch (e) {
          ok = false;
          stats[name] = { error: String(e) };
          console.error(`[${name}]`, e);
        }
      };
      await run1("udyam", async () => (await import("./sources/udyam")).createUdyamAdapter(sql, { samples: num("samples"), budgetMs: num("budget-ms") }));
      await run1("esco", async () => (await import("./sources/esco")).createEscoAdapter(sql, { maxRequests: num("max-requests") }));
      await run1("jsearch", async () => (await import("./sources/jsearch")).createJsearchAdapter(sql, { maxRequests: num("max-requests"), start: num("start") }));
      await run1("openalex", async () => (await import("./sources/openalex")).createOpenAlexAdapter(sql));
    }
  } catch (e) {
    ok = false;
    stats.error = String(e);
    console.error(e);
  }
  await sql`update ks.pipeline_run set finished_at = now(), ok = ${ok}, stats = ${sql.json(stats as never)} where id = ${run!.id}`;
  console.log(JSON.stringify({ command, ok, ms: Date.now() - t0, stats }, null, 2));
  await sql.end();
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
