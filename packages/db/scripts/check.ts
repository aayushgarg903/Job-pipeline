// Verification: row counts per ks table, then every reader for the hero districts.
// tsx scripts/check.ts [--verbose]
import { createSql } from "../src/client";
import { createReaders } from "../src/readers";

const sql = createSql(undefined, 2);
const r = createReaders(sql);
const verbose = process.argv.includes("--verbose");
const HERO = { Pune: "490", Nashik: "487", Gadchiroli: "475" };

async function main() {
  const tables = await sql<{ t: string }[]>`select table_name as t from information_schema.tables where table_schema = 'ks' order by 1`;
  const counts: Record<string, number> = {};
  for (const { t } of tables) counts[t] = Number((await sql.unsafe(`select count(*)::int as n from ks."${t}"`))[0]!.n);
  console.table(counts);

  const problems: string[] = [];
  const need = (name: string, v: unknown) => {
    const empty = v == null || (Array.isArray(v) && v.length === 0);
    if (empty) problems.push(name);
    const n = Array.isArray(v) ? v.length : v == null ? 0 : 1;
    console.log(`${empty ? "✗" : "✓"} ${name}${Array.isArray(v) ? ` (${n})` : ""}`);
    if (verbose && v) console.dir(Array.isArray(v) ? v.slice(0, 2) : v, { depth: 3 });
  };

  need("stateOverview", await r.stateOverview());
  need("districts", await r.districts());
  need("sources", await r.sources());
  need("radar", await r.radar());
  need("outcomes", await r.outcomes());
  const top = await r.topSkills({ by: "shortage", limit: 5 });
  need("topSkills(state, shortage)", top);
  const sid = top[0]?.id ?? "solar-pv-installation";
  need(`skill(${sid})`, await r.skill(sid));
  need(`skillCells(${sid})`, await r.skillCells(sid));
  need(`skillTrend(${sid})`, await r.skillTrend(sid));
  need("searchSkills(solar)", await r.searchSkills("solar"));
  need("searchSkills(वेल्डिंग)", await r.searchSkills("वेल्डिंग"));
  need("occupation(7411.0100)", await r.occupation("7411.0100"));
  need("evidence(skill)", await r.evidence({ kind: "skill", id: sid }));

  for (const [name, lgd] of Object.entries(HERO)) {
    console.log(`\n— ${name} (${lgd})`);
    const d = await r.district(lgd);
    need(`${name} district`, d);
    if (d) console.log(`   mismatch=${d.mismatch} coverage=${d.coverage} postings=${d.postings} udyam12m=${d.udyamNew12m} shortage=${d.topShortage?.label} (${d.topShortage?.gap}) surplus=${d.topSurplus?.label ?? "—"} demo=${d.provenance.isDemo}`);
    need(`${name} districtCells`, await r.districtCells(lgd, 10));
    need(`${name} topSkills shortage`, await r.topSkills({ lgd, by: "shortage", limit: 5 }));
    need(`${name} topSkills rising`, await r.topSkills({ lgd, by: "rising", limit: 5 }));
    const courses = await r.courses({ lgd, limit: 50 });
    need(`${name} courses`, courses);
    const c = courses[0];
    if (c) {
      need(`${name} course(${c.id})`, await r.course(c.id));
      console.log(`   worst course: ${c.name} total=${c.health?.total} flags=${c.health?.flags.join(",")}`);
      need(`${name} evidence(course)`, await r.evidence({ kind: "course", id: c.id }));
    }
    need(`${name} evidence(district)`, await r.evidence({ kind: "district", id: lgd }));
    need(`${name} evidence(cell)`, await r.evidence({ kind: "cell", id: lgd, skillId: sid }));
    need(`${name} planInput`, await r.planInput(lgd, "FY27"));
    const posts = await r.postings({ lgd, limit: 5 });
    console.log(`   postings: ${posts.length}`);
  }
  const prs = await r.coursePrs("iti-nashik-satpur:CTS-ELEC");
  need("coursePrs(nashik electrician)", prs);
  if (prs[0]) need("pr", await r.pr(prs[0].id));
  const [emp] = await sql<{ employer_id: string }[]>`select employer_id from ks.pr_route limit 1`;
  if (emp) need("employerInbox", await r.employerInbox(emp.employer_id));
  console.log(problems.length ? `\nEMPTY: ${problems.join(", ")}` : "\nall readers non-empty");
}

main().finally(() => sql.end());
