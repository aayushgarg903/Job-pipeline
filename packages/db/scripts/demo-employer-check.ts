// Checks the fixed demo employer: its inbox, and that reviewPr upserts one row per (pr, employer).
// Leaves the inbox clean again (the review it writes is removed at the end).
//   tsx scripts/demo-employer-check.ts
import { createSql } from "../src/client";
import { createReaders } from "../src/readers";
import { createWriters } from "../src/writers";
import { DEMO_EMPLOYER_ID } from "./seed/demo";

const sql = createSql(undefined, 1);
try {
  const r = createReaders(sql);
  const w = createWriters(sql);
  const inbox = await r.employerInbox(DEMO_EMPLOYER_ID);
  console.log(`employerInbox → ${inbox.length} PRs: ${inbox.map((p) => `${p.id} (${p.status})`).join(", ")}`);
  const pr = "pr-nashik-copa-modernise";
  const [before] = await sql<{ status: string }[]>`select status from ks.curriculum_pr where id = ${pr}`;
  await w.reviewPr({ prId: pr, employerId: DEMO_EMPLOYER_ID, verdict: "change", comment: "check: first verdict" });
  await w.reviewPr({ prId: pr, employerId: DEMO_EMPLOYER_ID, verdict: "change", comment: "check: second verdict replaces the first" });
  const rows = await sql<{ verdict: string; comment: string }[]>`
    select verdict, comment from ks.pr_review where pr_id = ${pr} and employer_id = ${DEMO_EMPLOYER_ID}`;
  console.log(`reviewPr twice → ${rows.length} row(s): ${JSON.stringify(rows)}`);
  await sql`delete from ks.pr_review where pr_id = ${pr} and employer_id = ${DEMO_EMPLOYER_ID}`;
  const [after] = await sql<{ status: string; n: number }[]>`
    select status, (select count(*)::int from ks.pr_review where employer_id = ${DEMO_EMPLOYER_ID}) as n from ks.curriculum_pr where id = ${pr}`;
  console.log(`cleanup → PR status ${before?.status} → ${after?.status}; demo employer reviews left: ${after?.n}`);
} finally {
  await sql.end();
}
