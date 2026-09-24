// Gathers engine inputs from the fact/evidence tables. All SQL, no engine logic.
import type { SignalKind, SignalObservation } from "@ks/contracts";
import type { Sql } from "@ks/db";
import type { EngineInput } from "./engine";
import { ESTIMATE_FY } from "./supply-estimate";
import { quarterOf, shiftQuarter } from "./util";

/** Share of Udyam registrations that are genuinely new enterprises (the rest formalise existing ones). */
export const UDYAM_NEW_SHARE = 0.25;
export const WEIGHTS: Record<SignalKind, number> = { udyam: 0.4, postings: 0.25, surveys: 0.3, consultations: 0.05 };
export const PRIOR_STRENGTH: Record<SignalKind, number> = { udyam: 200, postings: 30, surveys: 10, consultations: 3 };
export const SELF_SHARE = 0.85; // spill-over: share of a district's completers who work in-district

export async function observations(sql: Sql, quarters: string[]): Promise<SignalObservation[]> {
  const first = quarters[0]!;
  const obs: SignalObservation[] = [];
  const udyam = await sql<{ quarter: string; lgd_code: string; nco_code: string; n: number; hires: number }[]>`
    select to_char(f.month, 'YYYY') || '-Q' || extract(quarter from f.month) as quarter, f.lgd_code, x.nco_code,
           sum(f.registrations * x.share)::float8 as n,
           sum(f.registrations * x.share * x.employment_per_unit * ${UDYAM_NEW_SHARE} * 4)::float8 as hires
    from ks.udyam_fact f join ks.nic_nco_xwalk x on x.nic5 = f.nic5
    group by 1, 2, 3`;
  for (const r of udyam) if (quarters.includes(r.quarter)) obs.push({ kind: "udyam", lgd: r.lgd_code, nco: r.nco_code, quarter: r.quarter, n: r.n, hires12m: r.hires });

  const [ratio] = await sql<{ r: number | null }[]>`select avg(posting_to_hire_ratio)::float8 as r from ks.survey_response where posting_to_hire_ratio is not null`;
  const hiresPerPosting = ratio?.r ?? 1;
  const posts = await sql<{ quarter: string; lgd_code: string; nco_code: string; n: number }[]>`
    select to_char(posted_at, 'YYYY') || '-Q' || extract(quarter from posted_at) as quarter, lgd_code, nco_code, count(*)::int as n
    from ks.posting where not is_duplicate and lgd_code is not null and nco_code is not null group by 1, 2, 3`;
  for (const r of posts) if (quarters.includes(r.quarter)) obs.push({ kind: "postings", lgd: r.lgd_code, nco: r.nco_code, quarter: r.quarter, n: r.n, hires12m: r.n * hiresPerPosting * 4 });

  // A survey answer ("hires in the next 12 months") stays valid for the 4 quarters after collection.
  const surveys = await sql<{ collected_at: Date; lgd_code: string; nco_code: string; hires: number }[]>`
    select collected_at, lgd_code, nco_code, expected_hires_12m as hires from ks.survey_response`;
  for (const s of surveys) {
    const q0 = quarterOf(s.collected_at);
    for (let i = 0; i < 4; i++) {
      const q = shiftQuarter(q0, i);
      if (q >= first && quarters.includes(q)) obs.push({ kind: "surveys", lgd: s.lgd_code, nco: s.nco_code, quarter: q, n: 1, hires12m: s.hires });
    }
  }
  return obs;
}

/** Curated P(s|o), blended 70/30 with skill frequencies observed in ≥ 5 postings of that occupation. */
export async function profiles(sql: Sql): Promise<EngineInput["profiles"]> {
  const curated = await sql<{ nco_code: string; skill_id: string; weight: number; proficiency: number }[]>`
    select nco_code, skill_id, weight, proficiency from ks.occupation_skill`;
  const observed = await sql<{ nco_code: string; skill_id: string; freq: number; prof: number | null; n: number }[]>`
    with p as (select id, nco_code from ks.posting where not is_duplicate and nco_code is not null),
    n as (select nco_code, count(*) as n from p group by 1 having count(*) >= 5)
    select p.nco_code, ps.skill_id, count(*)::float8 / max(n.n) as freq, round(avg(ps.proficiency))::int as prof, max(n.n)::int as n
    from p join n on n.nco_code = p.nco_code join ks.posting_skill ps on ps.posting_id = p.id and not ps.negated
    group by 1, 2`;
  const out = new Map<string, EngineInput["profiles"][number]>();
  const hasObs = new Set(observed.map((o) => o.nco_code));
  for (const c of curated) {
    out.set(`${c.nco_code}|${c.skill_id}`, { nco: c.nco_code, skillId: c.skill_id, weight: hasObs.has(c.nco_code) ? 0.7 * c.weight : c.weight, proficiency: c.proficiency });
  }
  for (const o of observed) {
    const k = `${o.nco_code}|${o.skill_id}`;
    const cur = out.get(k);
    if (cur) cur.weight += 0.3 * o.freq;
    else out.set(k, { nco: o.nco_code, skillId: o.skill_id, weight: 0.3 * o.freq, proficiency: o.prof ?? 2 });
  }
  return [...out.values()].map((p) => ({ ...p, weight: Math.min(1, p.weight) }));
}

/** Local supply: demo/real courses (seats × completion) + apportioned state estimates. */
export async function supply(sql: Sql): Promise<Pick<EngineInput, "supply" | "occSupply">> {
  const courses = await sql<{ lgd_code: string; target_nco: string; skill_id: string; proficiency: number; completers: number }[]>`
    select i.lgd_code, c.target_nco, cs.skill_id, cs.proficiency,
           c.seats * coalesce((select x.completed::float8 / nullif(x.enrolled, 0) from ks.course_cohort x
                               where x.course_id = c.id order by x.fy desc limit 1), 0.8) as completers
    from ks.course c join ks.institution i on i.id = c.institution_id join ks.course_skill cs on cs.course_id = c.id`;
  const occCourses = await sql<{ lgd_code: string; target_nco: string; completers: number }[]>`
    select i.lgd_code, c.target_nco,
           sum(c.seats * coalesce((select x.completed::float8 / nullif(x.enrolled, 0) from ks.course_cohort x
                                   where x.course_id = c.id order by x.fy desc limit 1), 0.8))::float8 as completers
    from ks.course c join ks.institution i on i.id = c.institution_id group by 1, 2`;
  // Estimated completers teach the skills of the trade(s) that target their NCO.
  const est = await sql<{ lgd_code: string; nco_code: string; skill_id: string; proficiency: number; completers: number }[]>`
    with t as (select distinct on (q.nco_code, s.skill_id) q.nco_code, s.skill_id, s.proficiency
               from ks.qualification q join ks.qp_skill s on s.qp_code = q.qp_code order by q.nco_code, s.skill_id, q.qp_code)
    select e.lgd_code, e.nco_code, t.skill_id, t.proficiency, sum(e.trained)::float8 as completers
    from ks.supply_estimate e join t on t.nco_code = e.nco_code where e.fy = ${ESTIMATE_FY} group by 1, 2, 3, 4`;
  const occEst = await sql<{ lgd_code: string; nco_code: string; completers: number }[]>`
    select lgd_code, nco_code, sum(trained)::float8 as completers from ks.supply_estimate where fy = ${ESTIMATE_FY} group by 1, 2`;
  return {
    supply: [
      ...courses.map((c) => ({ lgd: c.lgd_code, skillId: c.skill_id, proficiency: c.proficiency, completers: c.completers, estimated: 0 })),
      ...est.map((e) => ({ lgd: e.lgd_code, skillId: e.skill_id, proficiency: e.proficiency, completers: e.completers, estimated: e.completers })),
    ],
    occSupply: [
      ...occCourses.map((c) => ({ lgd: c.lgd_code, nco: c.target_nco, completers: c.completers })),
      ...occEst.map((e) => ({ lgd: e.lgd_code, nco: e.nco_code, completers: e.completers })),
    ],
  };
}

/** Prior M: 85% of completers stay in-district, 15% spread over the division by population. */
export function spill(districts: EngineInput["districts"]): EngineInput["spill"] {
  const out: EngineInput["spill"] = [];
  for (const d of districts) {
    const peers = districts.filter((x) => x.division === d.division && x.lgd !== d.lgd);
    const peerPop = peers.reduce((s, x) => s + x.population, 0);
    out.push({ from: d.lgd, to: d.lgd, share: peers.length ? SELF_SHARE : 1 });
    for (const p of peers) out.push({ from: d.lgd, to: p.lgd, share: ((1 - SELF_SHARE) * p.population) / peerPop });
  }
  return out;
}
