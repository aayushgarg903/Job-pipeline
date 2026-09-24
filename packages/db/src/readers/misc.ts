// Evidence, postings, radar, sources, outcome KPIs.
import type { EvidenceRow, Posting, RadarTerm, Readers, SourceHealth } from "@ks/contracts";
import type { Sql } from "../client";
import { iso, isoOrNull, latestQuarter, num, prevQuarter } from "./shared";

type MiscReaders = Pick<Readers, "evidence" | "postings" | "radar" | "sources" | "outcomes">;

interface EvRow { kind: EvidenceRow["kind"]; title: string; detail: string; source: string; date: Date | string; url: string | null }
const toEv = (r: EvRow): EvidenceRow => ({ ...r, date: iso(r.date) });

export function miscReaders(sql: Sql): MiscReaders {
  /** Posting evidence: one extracted evidence sentence per posting (the most confident), per skill and/or district. */
  const postingEv = (lgd: string | null, skillId: string | null, limit: number) => sql<EvRow[]>`
    select kind, title, detail, source, date, url from (
      select distinct on (p.id) 'posting' as kind, p.title || ' · ' || p.employer_name as title, ps.evidence_sentence as detail,
             p.source_id as source, p.posted_at as date, p.url
      from ks.posting_skill ps join ks.posting p on p.id = ps.posting_id
      where not p.is_duplicate and not ps.negated
        and (${lgd}::text is null or p.lgd_code = ${lgd}) and (${skillId}::text is null or ps.skill_id = ${skillId})
      order by p.id, ps.confidence desc nulls last, ps.skill_id) x
    order by date desc limit ${limit}`;

  const surveyEv = (lgd: string | null, skillId: string | null, limit: number) => sql<EvRow[]>`
    select 'survey' as kind,
           e.name || ' · ' || o.title_en || ' · ' || r.expected_hires_12m || ' hires in 12 months' as title,
           coalesce(string_agg(s.label_en || ' (' || ss.importance || ', level ' || ss.proficiency || ')', '; '), '')
             || coalesce(' — "' || r.comment || '"', '') as detail,
           case when r.is_demo then 'survey (demo)' else 'survey' end as source, r.collected_at as date, null as url
    from ks.survey_response r join ks.employer e on e.id = r.employer_id join ks.occupation o on o.nco_code = r.nco_code
    left join ks.survey_skill ss on ss.response_id = r.id left join ks.skill s on s.id = ss.skill_id
    where (${lgd}::text is null or r.lgd_code = ${lgd})
      and (${skillId}::text is null or exists (select 1 from ks.survey_skill x where x.response_id = r.id and x.skill_id = ${skillId}))
    group by r.id, e.name, o.title_en order by r.collected_at desc limit ${limit}`;

  const udyamEv = (lgd: string | null, limit: number) => sql<EvRow[]>`
    select 'udyam' as kind, d.name_en || ': ' || round(sum(f.registrations))::text || ' Udyam registrations in focus-sector NICs' as title,
           'Quarter ' || to_char(f.month, 'YYYY') || '-Q' || extract(quarter from f.month) || ', method: ' || min(f.method) as detail,
           'data.gov.in Udyam (8b68ae56)' as source, max(f.month) as date,
           'https://data.gov.in/resource/8b68ae56-84cf-4728-a0a6-1be11028dea7' as url
    from ks.udyam_fact f join ks.geo_district d on d.lgd_code = f.lgd_code
    where (${lgd}::text is null or f.lgd_code = ${lgd}) and f.month >= (now() - interval '12 months')
    group by d.name_en, to_char(f.month, 'YYYY'), extract(quarter from f.month)
    order by max(f.month) desc limit ${limit}`;

  return {
    async evidence(ref, limit = 20) {
      if (ref.kind === "district") {
        const [p, s, u] = await Promise.all([postingEv(ref.id, null, limit), surveyEv(ref.id, null, limit), udyamEv(ref.id, 4)]);
        return [...u, ...s, ...p].slice(0, limit).map(toEv);
      }
      if (ref.kind === "skill") {
        const [p, s] = await Promise.all([postingEv(null, ref.id, limit), surveyEv(null, ref.id, limit)]);
        return [...p, ...s].slice(0, limit).map(toEv);
      }
      if (ref.kind === "cell") {
        // id is the district LGD (or "lgd:skillId"); skillId narrows to one skill.
        const [lgd, idSkill] = ref.id.split(":");
        const skillId = ref.skillId ?? idSkill ?? null;
        const [p, s, u] = await Promise.all([
          postingEv(lgd ?? null, skillId, limit), surveyEv(lgd ?? null, skillId, limit), udyamEv(lgd ?? null, 2),
        ]);
        return [...p, ...s, ...u].slice(0, limit).map(toEv);
      }
      // course: cohorts, employer reviews, and district survey rows for the course's skills
      const rows = await sql<EvRow[]>`
        (select 'cohort' as kind, c.name || ' · ' || co.fy as title,
                co.completed || ' of ' || co.enrolled || ' completed; ' || co.placed_6m || ' placed within 6 months'
                  || coalesce('; median wage ₹' || co.median_wage, '') as detail,
                case when co.is_demo then 'institute upload (demo)' else 'institute upload' end as source,
                make_date(2000 + substr(co.fy, 3, 2)::int, 3, 31) as date, null as url
         from ks.course_cohort co join ks.course c on c.id = co.course_id where co.course_id = ${ref.id})
        union all
        (select 'survey' as kind, e.name || ' · ' || r.verdict as title, coalesce(r.comment, '') as detail,
                'employer review' as source, r.reviewed_at as date, null as url
         from ks.pr_review r join ks.curriculum_pr p on p.id = r.pr_id join ks.employer e on e.id = r.employer_id
         where p.course_id = ${ref.id})
        union all
        (select 'survey' as kind, e.name || ' rates ' || s.label_en || ' ' || ss.importance as title,
                'Needs level ' || ss.proficiency || '; expects ' || sr.expected_hires_12m || ' hires' as detail,
                case when sr.is_demo then 'survey (demo)' else 'survey' end as source, sr.collected_at as date, null as url
         from ks.course c join ks.institution i on i.id = c.institution_id
         join ks.survey_response sr on sr.lgd_code = i.lgd_code
         join ks.survey_skill ss on ss.response_id = sr.id
         join ks.course_skill cs on cs.course_id = c.id and cs.skill_id = ss.skill_id
         join ks.employer e on e.id = sr.employer_id join ks.skill s on s.id = ss.skill_id
         where c.id = ${ref.id})
        order by date desc limit ${limit}`;
      return rows.map(toEv);
    },

    async postings({ lgd, skillId, limit }) {
      const rows = await sql<Array<{
        id: string; title: string; employer_name: string; lgd_code: string | null; city: string | null;
        nco_code: string | null; posted_at: Date; source_id: string; url: string | null;
      }>>`
        select p.id, p.title, p.employer_name, p.lgd_code, p.city, p.nco_code, p.posted_at, p.source_id, p.url
        from ks.posting p
        where not p.is_duplicate and (${lgd ?? null}::text is null or p.lgd_code = ${lgd ?? null})
          and (${skillId ?? null}::text is null or exists (
            select 1 from ks.posting_skill ps where ps.posting_id = p.id and ps.skill_id = ${skillId ?? null} and not ps.negated))
        order by p.posted_at desc limit ${limit}`;
      return rows.map((r): Posting => ({
        id: r.id, title: r.title, employer: r.employer_name, lgd: r.lgd_code, city: r.city, nco: r.nco_code,
        postedAt: iso(r.posted_at), source: r.source_id, url: r.url,
      }));
    },

    async radar() {
      const rows = await sql<Array<{
        term: string; skill_id: string | null; global: RadarTerm["global"]; note: string;
        mh: RadarTerm["mhPostings"] | null; courses: number;
      }>>`
        select t.term, t.skill_id, t.global, t.note,
          (select json_agg(json_build_object('period', q, 'value', n) order by q) from (
             select to_char(p.posted_at, 'YYYY') || '-Q' || extract(quarter from p.posted_at) as q, count(*)::int as n
             from ks.posting_skill ps join ks.posting p on p.id = ps.posting_id
             where ps.skill_id = t.skill_id and not ps.negated and not p.is_duplicate and p.lgd_code is not null
             group by 1) x) as mh,
          (select count(distinct course_id)::int from ks.course_skill cs where cs.skill_id = t.skill_id) as courses
        from ks.radar_term t order by t.term`;
      return rows.map((r) => ({
        term: r.term, skillId: r.skill_id, global: r.global, mhPostings: r.mh ?? [], coursesTeaching: num(r.courses), note: r.note,
      }));
    },

    async sources() {
      const rows = await sql<Array<{
        id: string; name: string; kind: string; licence: string; freshness_sla_hours: number; notes: string | null;
        last_ok: Date | null; last_run: Date | null; last_ok_flag: boolean | null; last_note: string | null; rows: number;
      }>>`
        select s.id, s.name, s.kind, s.licence, s.freshness_sla_hours, s.notes,
          (select max(run_at) from ks.source_health h where h.source_id = s.id and h.ok) as last_ok,
          l.run_at as last_run, l.ok as last_ok_flag, l.note as last_note,
          (select count(*)::int from ks.raw_record r where r.source_id = s.id) as rows
        from ks.source s
        left join lateral (select run_at, ok, note from ks.source_health h where h.source_id = s.id
                           order by run_at desc limit 1) l on true
        order by s.kind, s.name`;
      const now = Date.now();
      return rows.map((r): SourceHealth => {
        const fresh = r.last_ok != null && now - new Date(r.last_ok).getTime() <= r.freshness_sla_hours * 3600_000;
        return {
          id: r.id, name: r.name, kind: r.kind, licence: r.licence, lastFetchAt: isoOrNull(r.last_ok ?? r.last_run),
          rows: num(r.rows), freshnessSlaHours: num(r.freshness_sla_hours),
          ok: Boolean(r.last_ok_flag) && fresh,
          note: [r.last_note, r.notes].filter(Boolean).join(" · "),
        };
      });
    },

    async outcomes() {
      const q = await latestQuarter(sql);
      const base = q ? prevQuarter(prevQuarter(prevQuarter(prevQuarter(q)))) : null;
      const [r] = await sql<Array<Record<string, number | null>>>`
        select
          (select sum(placed_6m)::float8 / nullif(sum(completed), 0) from ks.course_cohort where fy = 'FY24') as place_base,
          (select sum(placed_6m)::float8 / nullif(sum(completed), 0) from ks.course_cohort where fy = 'FY25') as place_cur,
          (select avg(mismatch) from ks.district_metric where quarter = ${base}) as mis_base,
          (select avg(mismatch) from ks.district_metric where quarter = ${q}) as mis_cur,
          (select avg(csat_recent_hires) from ks.survey_response where collected_at < now() - interval '90 days') as csat_base,
          (select avg(csat_recent_hires) from ks.survey_response where collected_at >= now() - interval '90 days') as csat_cur,
          (select avg(weeks_to_productivity) from ks.survey_response where collected_at < now() - interval '90 days') as wtp_base,
          (select avg(weeks_to_productivity) from ks.survey_response where collected_at >= now() - interval '90 days') as wtp_cur,
          (select count(*) filter (where exists (select 1 from ks.curriculum_pr p where p.course_id = h.course_id))::float8
              / nullif(count(*), 0)
           from ks.course_health h where h.quarter = ${q} and (h.flags && array['REVISE','OBSOLETE'])) as pr_share`;
      const v = (k: string) => num(r?.[k]);
      return [
        { kpi: "6-month placement rate", baseline: v("place_base") * 100, current: v("place_cur") * 100, unit: "%",
          note: "course_cohort, FY24 vs FY25 cohorts (demo institutes)" },
        { kpi: "Mismatch Index (avg across districts)", baseline: v("mis_base"), current: v("mis_cur"), unit: "index 0–1",
          note: `district_metric, ${base ?? "n/a"} vs ${q ?? "n/a"}; lower is better` },
        { kpi: "Employer CSAT on recent hires", baseline: v("csat_base"), current: v("csat_cur"), unit: "1–5",
          note: "survey_response, earlier wave vs last 90 days" },
        { kpi: "Weeks to productivity", baseline: v("wtp_base"), current: v("wtp_cur"), unit: "weeks",
          note: "survey_response, earlier wave vs last 90 days; lower is better" },
        { kpi: "REVISE/OBSOLETE courses with an open PR", baseline: 0, current: v("pr_share") * 100, unit: "%",
          note: "course_health × curriculum_pr; baseline is 0 because no PR workflow existed before" },
      ];
    },
  };
}
