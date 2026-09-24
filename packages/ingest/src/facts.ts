// Stage 3: rebuild analytical facts. Idempotent (each table is replaced inside one transaction).
//   udyam_fact (re-apportioned) → supply_estimate → engine.computeCells → demand_fact, supply_fact,
//   demand_cell, occupation_cell, district_metric → engine.computeCourseHealth → course_health
// ENGINE SWAP POINT: ./engine/index.ts (`engine`). Nothing here depends on the local implementation.
import type { Sql } from "@ks/db";
import { engine } from "./engine";
import { PRIOR_STRENGTH, WEIGHTS, observations, profiles, spill, supply } from "./facts-inputs";
import { buildUdyamFacts } from "./sources/udyam";
import { insertMany } from "./store";
import { buildSupplyEstimates } from "./supply-estimate";
import { quarterOf, quarterRange, shiftQuarter } from "./util";

export const WINDOW_QUARTERS = 8;

async function replace(sql: Sql, table: string, rows: Array<Record<string, unknown>>, cols: string[], where?: string) {
  await sql.begin(async (tx) => {
    await tx.unsafe(`delete from ks.${table}${where ? ` where ${where}` : ""}`);
    await insertMany(tx as unknown as Sql, table, rows, cols);
  });
}

export async function buildFacts(sql: Sql, now = new Date()): Promise<Record<string, number | string>> {
  const udyamRows = await buildUdyamFacts(sql);
  const estimates = await buildSupplyEstimates(sql);

  const latest = quarterOf(now);
  const quarters = quarterRange(latest, WINDOW_QUARTERS);
  const districts = (await sql<{ lgd_code: string; division: string; population: number | null }[]>`
    select lgd_code, division, population from ks.geo_district`).map((d) => ({ lgd: d.lgd_code, division: d.division, population: d.population ?? 1_000_000 }));
  const [obs, prof, sup] = await Promise.all([observations(sql, quarters), profiles(sql), supply(sql)]);

  const out = engine.computeCells({
    quarters, baseQuarter: quarters[0]!, districts, observations: obs, weights: WEIGHTS, priorStrength: PRIOR_STRENGTH,
    profiles: prof, ...sup, spill: spill(districts),
  });

  await replace(sql, "demand_fact", out.demandFacts.map((f) => ({ quarter: f.quarter, lgd_code: f.lgd, nco_code: f.nco, signal: f.signal, n: f.n, hires_12m: f.hires12m })),
    ["quarter", "lgd_code", "nco_code", "signal", "n", "hires_12m"]);
  await replace(sql, "supply_fact", out.supplyFacts.map((f) => ({ quarter: f.quarter, lgd_code: f.lgd, skill_id: f.skillId, proficiency: f.proficiency, graduates_expected: f.graduates, estimated_share: f.estimatedShare })),
    ["quarter", "lgd_code", "skill_id", "proficiency", "graduates_expected", "estimated_share"]);
  await replace(sql, "demand_cell", out.cells.map((c) => ({
    quarter: c.quarter, lgd_code: c.lgd, skill_id: c.skillId, proficiency: c.proficiency, demand: c.demand, supply: c.supply,
    gap: c.gap, ratio: c.ratio, sdi: c.sdi, ci_low: c.ciLow, ci_high: c.ciHigh, coverage: c.coverage,
  })), ["quarter", "lgd_code", "skill_id", "proficiency", "demand", "supply", "gap", "ratio", "sdi", "ci_low", "ci_high", "coverage"]);
  await replace(sql, "occupation_cell", out.occupationCells.map((o) => ({ quarter: o.quarter, lgd_code: o.lgd, nco_code: o.nco, demand: o.demand, supply: o.supply })),
    ["quarter", "lgd_code", "nco_code", "demand", "supply"]);

  // District metrics + provenance counts.
  const counts = await sql<Array<{ lgd_code: string; postings: number; surveys: number; udyam12: number; courses: number; demo: boolean }>>`
    select d.lgd_code,
      (select count(*)::int from ks.posting p where p.lgd_code = d.lgd_code and not p.is_duplicate
         and to_char(p.posted_at, 'YYYY') || '-Q' || extract(quarter from p.posted_at) = ${latest}) as postings,
      (select count(*)::int from ks.survey_response s where s.lgd_code = d.lgd_code and s.collected_at > now() - interval '12 months') as surveys,
      (select coalesce(sum(registrations), 0)::float8 from ks.udyam_fact f where f.lgd_code = d.lgd_code
         and f.month >= ${shiftQuarter(latest, -3).replace(/-Q(\d)/, (_, n) => `-${String((Number(n) - 1) * 3 + 1).padStart(2, "0")}-01`)}::date) as udyam12,
      (select count(*)::int from ks.course c join ks.institution i on i.id = c.institution_id where i.lgd_code = d.lgd_code) as courses,
      exists (select 1 from ks.institution i where i.lgd_code = d.lgd_code and i.is_demo)
        or exists (select 1 from ks.survey_response s where s.lgd_code = d.lgd_code and s.is_demo) as demo
    from ks.geo_district d`;
  const byLgd = new Map(counts.map((c) => [c.lgd_code, c]));
  await replace(sql, "district_metric", out.districtMetrics.map((m) => {
    const c = byLgd.get(m.lgd);
    return {
      quarter: m.quarter, lgd_code: m.lgd, mismatch: Math.round(m.mismatch * 1000) / 1000, coverage: Math.round(m.coverage * 1000) / 1000,
      postings: m.quarter === latest ? (c?.postings ?? 0) : 0,
      udyam_new_12m: Math.round(c?.udyam12 ?? 0),
      sources: sql.json([
        { kind: "udyam", label: "Udyam registrations, last 12 months (apportioned)", n: Math.round(c?.udyam12 ?? 0) },
        { kind: "postings", label: "Online postings this quarter (JSearch)", n: c?.postings ?? 0 },
        { kind: "surveys", label: "Employer survey responses, last 12 months", n: c?.surveys ?? 0 },
        { kind: "supply", label: "Courses tracked (demo) + state supply estimated", n: c?.courses ?? 0 },
      ]),
      is_demo: c?.demo ? 1 : 0,
    };
  }), ["quarter", "lgd_code", "mismatch", "coverage", "postings", "udyam_new_12m", "sources", "is_demo"]);

  const health = await courseHealth(sql, latest, out);
  return {
    quarters: `${quarters[0]}..${latest}`, udyamFactRows: udyamRows, supplyEstimates: estimates, observations: obs.length,
    cells: out.cells.length, occupationCells: out.occupationCells.length, courseHealth: health,
  };
}

async function courseHealth(sql: Sql, latest: string, out: ReturnType<typeof engine.computeCells>): Promise<number> {
  const courses = await sql<Array<{
    id: string; lgd_code: string; code: string; target_nco: string; endorse: number; change: number;
    skills: Array<{ skillId: string; proficiency: number; hours: number; assessed: boolean }>;
    enrolled: number | null; completed: number | null; placed6m: number | null;
  }>>`
    select c.id, i.lgd_code, c.code, c.target_nco,
      (select count(*)::int from ks.pr_review r join ks.curriculum_pr p on p.id = r.pr_id where p.course_id = c.id and r.verdict = 'endorse') as endorse,
      (select count(*)::int from ks.pr_review r join ks.curriculum_pr p on p.id = r.pr_id where p.course_id = c.id and r.verdict = 'change') as change,
      coalesce((select json_agg(json_build_object('skillId', cs.skill_id, 'proficiency', cs.proficiency, 'hours', cs.hours,
         'assessed', exists (select 1 from ks.assessment_item a where a.course_id = c.id and a.skill_id = cs.skill_id)))
         from ks.course_skill cs where cs.course_id = c.id), '[]'::json) as skills,
      co.enrolled, co.completed, co.placed_6m as placed6m
    from ks.course c join ks.institution i on i.id = c.institution_id
    left join lateral (select * from ks.course_cohort x where x.course_id = c.id order by fy desc limit 1) co on true`;
  if (!courses.length) return 0;
  const labels = Object.fromEntries((await sql<{ id: string; label_en: string }[]>`select id, label_en from ks.skill`).map((s) => [s.id, s.label_en]));
  const health = engine.computeCourseHealth({
    quarter: latest, prevQuarter: shiftQuarter(latest, -1), profiles: await profiles(sql), cells: out.cells,
    occupationCells: out.occupationCells, labels,
    courses: courses.map((c) => ({
      id: c.id, lgd: c.lgd_code, code: c.code, targetNco: c.target_nco, skills: c.skills, endorsements: c.endorse, changeRequests: c.change,
      cohort: c.completed == null ? null : { enrolled: c.enrolled ?? 0, completed: c.completed, placed6m: c.placed6m ?? 0 },
    })),
  });
  await replace(sql, "course_health", health.map((h) => ({
    course_id: h.courseId, quarter: h.quarter, relevance: h.relevance, outcomes: h.outcomes, currency: h.currency, validation: h.validation,
    total: h.total, flags: h.flags, placement_rate: h.placementRate, missing_skills: h.missingSkills, declining_skills: h.decliningSkills,
    unassessed_skills: h.unassessedSkills, explain: h.explain,
  })), ["course_id", "quarter", "relevance", "outcomes", "currency", "validation", "total", "flags", "placement_rate", "missing_skills",
    "declining_skills", "unassessed_skills", "explain"], `quarter = '${latest}'`);
  return health.length;
}
