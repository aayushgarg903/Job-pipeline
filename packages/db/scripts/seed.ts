// pnpm --filter @ks/db seed [--reference-only]
// 1. reference data (real): districts, geometry, aliases, occupations, skills, profiles, crosswalk, trades
// 2. demo supply side (is_demo=true): institutions, courses, cohorts, trainers, equipment, surveys, PRs
import { createSql } from "../src/client";
import { seedDemo } from "./seed/demo";
import { seedReference } from "./seed/reference";

const sql = createSql(process.env.DATABASE_URL_SESSION ?? undefined, 1);

async function main() {
  const ref = await seedReference(sql);
  console.log("reference:", ref);
  if (!process.argv.includes("--reference-only")) {
    const demo = await seedDemo(sql);
    console.log("demo:", demo);
  }
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end({ timeout: 1 });
  process.exit(1);
});
