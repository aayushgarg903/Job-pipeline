// Idempotent migration runner (session pooler, port 5432).
//   1. pre.sql   — extensions (vector, pg_trgm) in schema `extensions`; always re-run, all IF NOT EXISTS
//   2. drizzle-kit generated migrations in journal order, tracked in ks._migrations (hash-checked)
//   3. post.sql  — trigram / HNSW indexes, all IF NOT EXISTS
// Regenerate SQL after a schema change with `pnpm --filter @ks/db generate`.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: process.env.KS_ENV ?? "/home/faith/stuff/SIH/Job-pipeline/.env", quiet: true });
const here = dirname(fileURLToPath(import.meta.url));
const migDir = join(here, "..", "migrations");

const url = process.env.DATABASE_URL_SESSION ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL_SESSION is not set");
const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });

const splitStatements = (text: string) =>
  text.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);

async function main() {
  const pre = readFileSync(join(here, "sql", "pre.sql"), "utf8");
  await sql.unsafe(pre);
  console.log("pre.sql applied (extensions)");

  await sql.unsafe(`create table if not exists ks._migrations (
    tag text primary key, hash text not null, applied_at timestamptz not null default now())`);
  const journal = JSON.parse(readFileSync(join(migDir, "meta", "_journal.json"), "utf8")) as {
    entries: Array<{ tag: string }>;
  };
  const applied = new Map((await sql<{ tag: string; hash: string }[]>`select tag, hash from ks._migrations`).map((r) => [r.tag, r.hash]));

  for (const { tag } of journal.entries) {
    const text = readFileSync(join(migDir, `${tag}.sql`), "utf8");
    const hash = createHash("sha256").update(text).digest("hex");
    if (applied.has(tag)) {
      if (applied.get(tag) !== hash) console.warn(`! ${tag} changed after it was applied; not re-running`);
      continue;
    }
    await sql.begin(async (tx) => {
      await tx.unsafe("set local search_path to ks, public, extensions");
      for (const stmt of splitStatements(text)) {
        await tx.unsafe(stmt.replace(/^CREATE SCHEMA "ks";?/i, 'CREATE SCHEMA IF NOT EXISTS "ks";'));
      }
      await tx`insert into ks._migrations (tag, hash) values (${tag}, ${hash})`;
    });
    console.log(`applied ${tag}`);
  }

  const post = readFileSync(join(here, "sql", "post.sql"), "utf8");
  await sql.unsafe(post);
  console.log("post.sql applied (indexes)");
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end({ timeout: 1 });
  process.exit(1);
});
