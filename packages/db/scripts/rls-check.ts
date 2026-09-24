// Verifies the ks lockdown: RLS on every table, and the anon / authenticated roles see nothing.
//   tsx scripts/rls-check.ts
import { createSql } from "../src/client";

const sql = createSql(undefined, 1);
try {
  const tables = await sql<{ tablename: string; rowsecurity: boolean }[]>`
    select tablename, rowsecurity from pg_tables where schemaname = 'ks' order by 1`;
  const off = tables.filter((t) => !t.rowsecurity).map((t) => t.tablename);
  console.log(`ks tables: ${tables.length}; RLS enabled: ${tables.length - off.length}; without RLS: ${off.join(", ") || "none"}`);
  const [pol] = await sql<{ n: number }[]>`select count(*)::int as n from pg_policies where schemaname = 'ks'`;
  console.log(`policies on ks: ${pol!.n}`);
  const grants = await sql<{ grantee: string; n: number }[]>`
    select grantee, count(*)::int as n from information_schema.role_table_grants
    where table_schema = 'ks' and grantee in ('anon', 'authenticated') group by 1`;
  console.log(`table grants to anon/authenticated: ${grants.map((g) => `${g.grantee}=${g.n}`).join(" ") || "none"}`);
  for (const role of ["anon", "authenticated"]) {
    for (const table of ["skill", "survey_response", "employer"]) {
      try {
        const rows = await sql.begin(async (tx) => {
          await tx.unsafe(`set local role ${role}`);
          return tx.unsafe(`select count(*)::int as n from ks.${table}`);
        });
        console.log(`as ${role}: select from ks.${table} → ${rows[0]!.n} rows`);
      } catch (e) {
        console.log(`as ${role}: select from ks.${table} → ERROR ${(e as Error).message}`);
      }
    }
  }
  // The same through Supabase's REST API with the public anon key (what a browser could do).
  const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anon } = process.env;
  if (url && anon) {
    for (const table of ["skill", "survey_response"]) {
      const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
        headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Accept-Profile": "ks" }, signal: AbortSignal.timeout(20_000),
      });
      console.log(`REST as anon: GET ks.${table} → HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
    }
  }
  const [me] = await sql<{ r: string; n: number }[]>`select current_user as r, (select count(*)::int from ks.skill) as n`;
  console.log(`as ${me!.r} (app role, after reset): ks.skill → ${me!.n} rows`);
} finally {
  await sql.end();
}
