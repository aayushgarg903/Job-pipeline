// Ad-hoc read-only query helper: tsx scripts/q.ts "select ..."
import { createSql } from "../src/client";

const sql = createSql(undefined, 1);
const text = process.argv.slice(2).join(" ");
if (!/^\s*(select|with|explain)\b/i.test(text)) {
  console.error("read-only: only select/with/explain");
  process.exit(1);
}
try {
  console.table(await sql.unsafe(text));
} finally {
  await sql.end();
}
