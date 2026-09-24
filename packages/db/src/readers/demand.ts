// Demand-side readers: state, districts, cells, skills. All aggregates come from the fact tables.
import type {
  CourseFlag, DemandCell, DistrictSummary, LgdCode, NcoCode, Occupation, Provenance, Readers, Skill, SkillId, StateOverview,
} from "@ks/contracts";
import type { Sql } from "../client";
import {
  type DistrictRow, type SkillRow, iso, lapsedSources, latestQuarter, num, numOrNull, prevQuarter, prof,
  provenance, toDistrict, toSkill,
} from "./shared";

interface CellRow {
  lgd_code: string; skill_id: string; proficiency: number; quarter: string; demand: number; supply: number;
  gap: number; ratio: number; sdi: number; ci_low: number; ci_high: number; coverage: number;
}
const toCell = (r: CellRow): DemandCell => ({
  lgd: r.lgd_code, skillId: r.skill_id, proficiency: prof(r.proficiency), quarter: r.quarter,
  demand: num(r.demand), supply: num(r.supply), gap: num(r.gap), ratio: num(r.ratio), sdi: num(r.sdi),
  ciLow: num(r.ci_low), ciHigh: num(r.ci_high), coverage: num(r.coverage),
});

type DemandReaders = Pick<Readers,
  "stateOverview" | "districts" | "district" | "districtCells" | "skill" | "skillCells" | "skillTrend" |
  "topSkills" | "searchSkills" | "occupation">;

export function demandReaders(sql: Sql): DemandReaders {
  async function summaries(lgd: LgdCode | null): Promise<DistrictSummary[]> {
    const q = await latestQuarter(sql);
    const lapsed = (await lapsedSources(sql)).size > 0;
    const rows = await sql<Array<DistrictRow & {
      mismatch: number | null; coverage: number | null; postings: number | null; udyam_new_12m: number | null;
      sources: Provenance["sources"] | null; is_demo: number | null; as_of: Date | null;
      short_id: string | null; short_label: string | null; short_gap: number | null;
      sur_id: string | null; sur_label: string | null; sur_gap: number | null;
    }>>`
      with shortage as (
        select distinct on (c.lgd_code) c.lgd_code, c.skill_id, s.label_en, c.gap
        from ks.demand_cell c join ks.skill s on s.id = c.skill_id
        where c.quarter = ${q} and c.gap > 0 and s.kind <> 'transversal' order by c.lgd_code, c.gap desc),
      surplus as (
        select distinct on (c.lgd_code) c.lgd_code, c.skill_id, s.label_en, c.gap
        from ks.demand_cell c join ks.skill s on s.id = c.skill_id
        where c.quarter = ${q} and c.gap < 0 and s.kind <> 'transversal' order by c.lgd_code, c.gap asc)
      select d.lgd_code, d.name_en, d.name_mr, d.division, d.population, d.is_aspirational,
             m.mismatch, m.coverage, m.postings, m.udyam_new_12m, m.sources, m.is_demo,
             (select max(finished_at) from ks.pipeline_run where command = 'facts' and ok) as as_of,
             sh.skill_id as short_id, sh.label_en as short_label, sh.gap as short_gap,
             su.skill_id as sur_id, su.label_en as sur_label, su.gap as sur_gap
      from ks.geo_district d
      left join ks.district_metric m on m.lgd_code = d.lgd_code and m.quarter = ${q}
      left join shortage sh on sh.lgd_code = d.lgd_code
      left join surplus su on su.lgd_code = d.lgd_code
      where ${lgd}::text is null or d.lgd_code = ${lgd}
      order by d.name_en`;
    return rows.map((r) => ({
      district: toDistrict(r),
      mismatch: num(r.mismatch),
      coverage: num(r.coverage),
      topShortage: r.short_id ? { skillId: r.short_id, label: r.short_label ?? r.short_id, gap: num(r.short_gap) } : null,
      topSurplus: r.sur_id ? { skillId: r.sur_id, label: r.sur_label ?? r.sur_id, gap: num(r.sur_gap) } : null,
      postings: num(r.postings),
      udyamNew12m: num(r.udyam_new_12m),
      provenance: provenance(r.sources ?? [], r.as_of, num(r.is_demo) > 0, lapsed),
    }));
  }

  return {
    async stateOverview(): Promise<StateOverview> {
      const q = await latestQuarter(sql);
      const [r] = await sql<Array<{
        districts: number; postings: number; employers: number; courses: number; demo: boolean; as_of: Date | null;
      }>>`
        select (select count(*)::int from ks.geo_district) as districts,
               (select count(*)::int from ks.posting p where not p.is_duplicate and p.lgd_code is not null
                  and to_char(p.posted_at, 'YYYY') || '-Q' || extract(quarter from p.posted_at) = ${q}) as postings,
               (select count(distinct employer_id)::int from ks.survey_response)
                 + (select count(*)::int from ks.consultation) as employers,
               (select count(*)::int from ks.course) as courses,
               (select bool_or(is_demo) from ks.course) as demo,
               (select max(finished_at) from ks.pipeline_run where command = 'facts' and ok) as as_of`;
      const flags = await sql<{ flag: CourseFlag; n: number }[]>`
        select unnest(flags) as flag, count(*)::int as n from ks.course_health where quarter = ${q} group by 1`;
      const flagCounts: Record<CourseFlag, number> = { HEALTHY: 0, REVISE: 0, OBSOLETE: 0, OVERSUPPLIED: 0 };
      for (const f of flags) flagCounts[f.flag] = f.n;
      return {
        asOf: r?.as_of ? iso(r.as_of) : new Date().toISOString(),
        districts: num(r?.districts), postingsThisQuarter: num(r?.postings), employersHeard: num(r?.employers),
        coursesTracked: num(r?.courses), flagCounts, isDemo: Boolean(r?.demo),
      };
    },

    districts: () => summaries(null),
    async district(lgd) {
      return (await summaries(lgd))[0] ?? null;
    },

    async districtCells(lgd, limit = 50) {
      const q = await latestQuarter(sql);
      const rows = await sql<CellRow[]>`
        select * from ks.demand_cell where quarter = ${q} and lgd_code = ${lgd}
        order by abs(gap) desc limit ${limit}`;
      return rows.map(toCell);
    },

    async skill(id) {
      const [r] = await sql<SkillRow[]>`select id, label_en, label_mr, kind, esco_uri from ks.skill where id = ${id}`;
      return r ? toSkill(r) : null;
    },

    async skillCells(id) {
      const q = await latestQuarter(sql);
      const rows = await sql<CellRow[]>`
        select distinct on (lgd_code) * from ks.demand_cell
        where quarter = ${q} and skill_id = ${id} order by lgd_code, abs(gap) desc`;
      return rows.map(toCell);
    },

    async skillTrend(id) {
      // State-level SDI per quarter at proficiency >= 1: Σ_d demand relative to the base quarter.
      const rows = await sql<Array<{ quarter: string; sdi: number; ci_low: number; ci_high: number }>>`
        with base as (select sum(demand) as b from ks.demand_cell
                      where skill_id = ${id} and proficiency = 1
                        and quarter = (select min(quarter) from ks.demand_cell where skill_id = ${id}))
        select c.quarter,
               100 * sum(c.demand) / nullif(max(base.b), 0) as sdi,
               100 * sum(c.demand * c.ci_low / nullif(c.sdi, 0)) / nullif(max(base.b), 0) as ci_low,
               100 * sum(c.demand * c.ci_high / nullif(c.sdi, 0)) / nullif(max(base.b), 0) as ci_high
        from ks.demand_cell c, base where c.skill_id = ${id} and c.proficiency = 1
        group by c.quarter order by c.quarter`;
      return rows.map((r) => ({ quarter: r.quarter, sdi: num(r.sdi), ciLow: num(r.ci_low), ciHigh: num(r.ci_high) }));
    },

    async topSkills({ lgd, by, limit }) {
      const q = await latestQuarter(sql);
      if (!q) return [];
      const pq = prevQuarter(q);
      const order = by === "shortage" ? sql`gap desc` : by === "surplus" ? sql`gap asc` : sql`delta desc`;
      const rows = await sql<Array<SkillRow & { gap: number; sdi: number; delta: number }>>`
        with cur as (
          select skill_id, proficiency, sum(demand - supply) as gap, avg(sdi) as sdi
          from ks.demand_cell where quarter = ${q} and (${lgd ?? null}::text is null or lgd_code = ${lgd ?? null})
          group by skill_id, proficiency),
        best as (
          select distinct on (skill_id) skill_id, gap, sdi from cur
          order by skill_id, ${by === "surplus" ? sql`gap asc` : sql`gap desc`}),
        sdi1 as (
          select skill_id,
                 avg(sdi) filter (where quarter = ${q}) - avg(sdi) filter (where quarter = ${pq}) as delta
          from ks.demand_cell where proficiency = 1 and quarter in (${q}, ${pq})
            and (${lgd ?? null}::text is null or lgd_code = ${lgd ?? null})
          group by skill_id)
        select s.id, s.label_en, s.label_mr, s.kind, s.esco_uri, b.gap, b.sdi, coalesce(d.delta, 0) as delta
        from best b join ks.skill s on s.id = b.skill_id left join sdi1 d on d.skill_id = b.skill_id
        where s.kind <> 'transversal' and ${by === "surplus" ? sql`b.gap < 0` : by === "shortage" ? sql`b.gap > 0` : sql`true`}
        order by ${order} limit ${limit}`;
      return rows.map((r) => ({ ...toSkill(r), gap: num(r.gap), sdi: num(r.sdi), delta: num(r.delta) }));
    },

    async searchSkills(qs, limit = 10) {
      const q = qs.trim();
      // Empty query = the catalogue (callers build label maps from it), same as the fixtures.
      if (!q) {
        const all = await sql<SkillRow[]>`
          select s.id, s.label_en, s.label_mr, s.kind, s.esco_uri from ks.skill s order by s.label_en limit ${limit}`;
        return all.map(toSkill);
      }
      const like = `%${q.replace(/[%_]/g, "")}%`;
      const rows = await sql<SkillRow[]>`
        select s.id, s.label_en, s.label_mr, s.kind, s.esco_uri from ks.skill s
        left join lateral (select max(extensions.similarity(a.alias, ${q.toLowerCase()})) as sim
                           from ks.skill_alias a where a.skill_id = s.id) a on true
        where s.label_en ilike ${like} or s.label_mr ilike ${like} or s.id ilike ${like}
           or coalesce(a.sim, 0) > 0.3 or extensions.similarity(s.label_en, ${q}) > 0.3
        order by greatest(extensions.similarity(s.label_en, ${q}), coalesce(a.sim, 0)) desc, s.label_en
        limit ${limit}`;
      return rows.map(toSkill) satisfies Skill[];
    },

    async occupation(nco: NcoCode): Promise<Occupation | null> {
      const [r] = await sql<Array<{ nco_code: string; title_en: string; title_mr: string | null; nsqf_level: number | null }>>`
        select nco_code, title_en, title_mr, nsqf_level from ks.occupation where nco_code = ${nco}`;
      return r ? { nco: r.nco_code, titleEn: r.title_en, titleMr: r.title_mr, nsqfLevel: numOrNull(r.nsqf_level) } : null;
    },
  };
}

export type { SkillId };
