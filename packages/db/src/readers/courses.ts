// Supply-side readers: courses + health, curriculum PRs, plan inputs and saved plans.
import type {
  Course, CourseFlag, CourseHealth, CurriculumPr, DiffLine, LgdCode, PlanCourseInput, PlanInput, PlanResult, Proficiency, Readers,
} from "@ks/contracts";
import type { Sql } from "../client";
import { iso, isoOrNull, latestQuarter, num, numOrNull } from "./shared";

interface CourseRow {
  id: string; institution_id: string; institution_name: string; lgd_code: string; name: string; code: string;
  kind: Course["kind"]; target_nco: string; seats: number; duration_hours: number; is_demo: boolean;
  skills: Array<{ skillId: string; proficiency: Proficiency; hours: number; assessed: boolean }>;
  h_quarter: string | null; relevance: number | null; outcomes: number | null; currency: number | null;
  validation: number | null; total: number | null; flags: CourseFlag[] | null; placement_rate: number | null;
  missing_skills: string[] | null; declining_skills: string[] | null; unassessed_skills: string[] | null;
  explain: string[] | null;
}

const toCourse = (r: CourseRow): Course & { health: CourseHealth | null } => ({
  id: r.id, institutionId: r.institution_id, institutionName: r.institution_name, lgd: r.lgd_code,
  name: r.name, code: r.code, kind: r.kind, targetNco: r.target_nco, seats: num(r.seats),
  durationHours: num(r.duration_hours), skills: r.skills ?? [], isDemo: r.is_demo,
  health: r.h_quarter == null ? null : {
    courseId: r.id, quarter: r.h_quarter, relevance: num(r.relevance), outcomes: num(r.outcomes),
    currency: num(r.currency), validation: num(r.validation), total: num(r.total), flags: r.flags ?? [],
    placementRate: numOrNull(r.placement_rate), missingSkills: r.missing_skills ?? [],
    decliningSkills: r.declining_skills ?? [], unassessedSkills: r.unassessed_skills ?? [], explain: r.explain ?? [],
  },
});

interface PrRow {
  id: string; course_id: string; target: CurriculumPr["target"]; status: CurriculumPr["status"]; diff: DiffLine[];
  rationale: string; endorsements: number; change_requests: number; opened_at: Date; adopted_at: Date | null;
  trainer_delta: CurriculumPr["trainerDelta"]; equipment_delta: CurriculumPr["equipmentDelta"];
}
const toPr = (r: PrRow): CurriculumPr => ({
  id: r.id, courseId: r.course_id, target: r.target, status: r.status, diff: r.diff, rationale: r.rationale,
  endorsements: num(r.endorsements), changeRequests: num(r.change_requests), openedAt: iso(r.opened_at),
  adoptedAt: isoOrNull(r.adopted_at), trainerDelta: r.trainer_delta ?? [], equipmentDelta: r.equipment_delta ?? [],
});

type CourseReaders = Pick<Readers, "courses" | "course" | "coursePrs" | "pr" | "employerInbox" | "planInput" | "savedPlan">;

export function courseReaders(sql: Sql): CourseReaders {
  async function selectCourses(f: { id?: string; lgd?: LgdCode; flag?: string; limit: number }) {
    const q = await latestQuarter(sql);
    const rows = await sql<CourseRow[]>`
      select c.id, c.institution_id, i.name as institution_name, i.lgd_code, c.name, c.code, c.kind, c.target_nco,
             c.seats, c.duration_hours, c.is_demo,
             coalesce((select json_agg(json_build_object(
                 'skillId', cs.skill_id, 'proficiency', cs.proficiency, 'hours', cs.hours,
                 'assessed', exists(select 1 from ks.assessment_item a where a.course_id = c.id and a.skill_id = cs.skill_id))
               order by cs.hours desc) from ks.course_skill cs where cs.course_id = c.id), '[]'::json) as skills,
             h.quarter as h_quarter, h.relevance, h.outcomes, h.currency, h.validation, h.total, h.flags,
             h.placement_rate, h.missing_skills, h.declining_skills, h.unassessed_skills, h.explain
      from ks.course c join ks.institution i on i.id = c.institution_id
      left join ks.course_health h on h.course_id = c.id and h.quarter = ${q}
      where (${f.id ?? null}::text is null or c.id = ${f.id ?? null})
        and (${f.lgd ?? null}::text is null or i.lgd_code = ${f.lgd ?? null})
        and (${f.flag ?? null}::text is null or ${f.flag ?? null} = any(h.flags))
      order by h.total asc nulls last, c.name limit ${f.limit}`;
    return rows.map(toCourse);
  }

  async function selectPrs(where: "course" | "id" | "employer", value: string) {
    const cond = where === "course" ? sql`p.course_id = ${value}`
      : where === "id" ? sql`p.id = ${value}`
      : sql`p.id in (select pr_id from ks.pr_route where employer_id::text = ${value})`;
    const rows = await sql<PrRow[]>`
      select p.*,
        (select count(*)::int from ks.pr_review r where r.pr_id = p.id and r.verdict = 'endorse') as endorsements,
        (select count(*)::int from ks.pr_review r where r.pr_id = p.id and r.verdict = 'change') as change_requests
      from ks.curriculum_pr p where ${cond} order by p.opened_at desc`;
    return rows.map(toPr);
  }

  return {
    courses: ({ lgd, flag, limit = 50 }) => selectCourses({ lgd, flag, limit }),
    async course(id) {
      return (await selectCourses({ id, limit: 1 }))[0] ?? null;
    },
    coursePrs: (courseId) => selectPrs("course", courseId),
    async pr(id) {
      return (await selectPrs("id", id))[0] ?? null;
    },
    employerInbox: (employerId) => selectPrs("employer", employerId),

    async planInput(lgd, fy): Promise<PlanInput | null> {
      const q = await latestQuarter(sql);
      const courses = await sql<Array<{
        id: string; name: string; seats: number; duration_hours: number; trainer_qualification: string | null;
        completion: number | null; placement: number | null; wage: number | null; sets: number | null;
        set_cost: number | null; teaches: string[]; is_new: boolean;
      }>>`
        select c.id, c.name, c.seats, c.duration_hours, c.trainer_qualification,
               co.completed::float8 / nullif(co.enrolled, 0) as completion,
               co.placed_6m::float8 / nullif(co.completed, 0) as placement, co.median_wage as wage,
               -- a "set" is one of every listed item, so usable sets = the scarcest item
               (select min(e.qty)::int from ks.equipment e where e.course_id = c.id and e.condition <> 'poor') as sets,
               (select sum(e.unit_cost)::int from ks.equipment e where e.course_id = c.id) as set_cost,
               array(select skill_id from ks.course_skill cs where cs.course_id = c.id) as teaches,
               c.seats = 0 as is_new
        from ks.course c join ks.institution i on i.id = c.institution_id
        left join lateral (select * from ks.course_cohort x where x.course_id = c.id order by fy desc limit 1) co on true
        where i.lgd_code = ${lgd}`;
      if (courses.length === 0) return null;
      const demand = await sql<{ skill_id: string; demand: number }[]>`
        select skill_id, demand from ks.demand_cell where quarter = ${q} and lgd_code = ${lgd} and proficiency = 1`;
      const trainers = await sql<{ qualification: string; n: number }[]>`
        select t.qualification, count(*)::int as n from ks.trainer t join ks.institution i on i.id = t.institution_id
        where i.lgd_code = ${lgd} and (t.certified_until is null or t.certified_until > now()) group by 1`;
      const HOURS_PER_TRAINER = 1600;
      const BATCH = 24;
      const wages = courses.map((c) => num(c.wage)).filter((w) => w > 0).sort((a, b) => a - b);
      const medianWage = wages.length ? wages[Math.floor(wages.length / 2)]! : 12000;
      const rows: PlanCourseInput[] = courses.map((c) => ({
        courseId: c.id, name: c.name, isNew: c.is_new, seatsPrev: num(c.seats), batchSize: BATCH,
        maxBatches: Math.max(2, Math.ceil((num(c.seats) * 1.3) / BATCH)),
        completionRate: c.completion ?? 0.8, placementProb: c.placement ?? 0.5, wage: num(c.wage) || medianWage,
        trainerQualification: c.trainer_qualification ?? "CITS", trainerHoursPerBatch: Math.min(num(c.duration_hours), 1600),
        equipmentSets: num(c.sets), equipmentCostPerSet: num(c.set_cost) || 150000, teaches: c.teaches,
      }));
      const quals = [...new Set(rows.map((r) => r.trainerQualification))];
      const avail = Object.fromEntries(trainers.map((t) => [t.qualification, t.n * HOURS_PER_TRAINER]));
      return {
        lgd, fy,
        seatBudget: Math.round(rows.reduce((s, r) => s + r.seatsPrev, 0) * 1.05),
        capexBudget: 5_000_000,
        trainerHoursAvailable: Object.fromEntries(quals.map((qq) => [qq, avail[qq] ?? 0])),
        trainerHireCost: Object.fromEntries(quals.map((qq) => [qq, 600_000])),
        hoursPerHiredTrainer: HOURS_PER_TRAINER,
        demandBySkill: Object.fromEntries(demand.map((d) => [d.skill_id, Math.round(num(d.demand))])),
        medianWage,
        courses: rows,
      };
    },

    async savedPlan(lgd, fy) {
      const [r] = await sql<Array<{ solution: PlanResult; signed_by: string | null; signed_at: Date | null }>>`
        select solution, signed_by, signed_at from ks.training_plan
        where lgd_code = ${lgd} and fy = ${fy} order by created_at desc limit 1`;
      return r ? { ...r.solution, signedBy: r.signed_by, signedAt: isoOrNull(r.signed_at) } : null;
    },
  };
}
