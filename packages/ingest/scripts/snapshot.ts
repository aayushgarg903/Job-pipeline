// Read-only summary of the facts tables, for before/after comparisons of engine changes.
//   tsx scripts/snapshot.ts [lgd=487]
import { createSql } from "@ks/db";

const lgd = process.argv[2] ?? "487";
const sql = createSql(undefined, 1);
try {
  const [q] = await sql<{ q: string }[]>`select max(quarter) as q from ks.district_metric`;
  const quarter = q!.q;
  const flags = await sql`select f as flag, count(*)::int as n from ks.course_health, unnest(flags) f where quarter = ${quarter} group by 1 order by 1`;
  const [mm] = await sql`select min(mismatch) as min, percentile_cont(0.5) within group (order by mismatch) as median, max(mismatch) as max,
      avg(coverage) as avg_coverage from ks.district_metric where quarter = ${quarter}`;
  const [cells] = await sql`select count(*)::int as cells, count(*) filter (where quarter = ${quarter})::int as latest from ks.demand_cell`;
  const shortage = await sql`select c.skill_id, s.label_en, c.proficiency, round(c.demand::numeric,1) as demand, round(c.supply::numeric,1) as supply,
      round(c.gap::numeric,1) as gap, round(c.sdi::numeric,1) as sdi, round(c.ci_low::numeric,1) as ci_low, round(c.ci_high::numeric,1) as ci_high
      from ks.demand_cell c join ks.skill s on s.id = c.skill_id
      where c.quarter = ${quarter} and c.lgd_code = ${lgd} and c.gap > 0 and s.kind <> 'transversal' order by c.gap desc limit 5`;
  const elec = await sql`select h.course_id, h.relevance, h.outcomes, h.currency, h.validation, h.total, h.flags, h.missing_skills, h.declining_skills
      from ks.course_health h join ks.course c on c.id = h.course_id join ks.institution i on i.id = c.institution_id
      where h.quarter = ${quarter} and i.lgd_code = ${lgd} and c.code = 'CTS-ELEC' order by 1`;
  const [dm] = await sql`select mismatch, coverage from ks.district_metric where quarter = ${quarter} and lgd_code = ${lgd}`;
  console.log(JSON.stringify({ quarter, cells, flags, mismatch: mm, district: dm }, null, 1));
  console.table(shortage);
  console.table(elec.map((e) => ({
    ...e, flags: (e.flags as string[]).join(","), missing_skills: (e.missing_skills as string[]).slice(0, 3).join(","),
    declining_skills: (e.declining_skills as string[]).join(","),
  })));
} finally {
  await sql.end();
}
