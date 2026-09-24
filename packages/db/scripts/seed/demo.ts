// SPECIMEN seed: institutions, courses, cohorts, trainers, equipment, surveys, curriculum PRs.
// Deterministic (seeded PRNG) and idempotent: every demo row is deleted and re-created.
import type { Sql } from "../../src/client";
import { BASE_PLACEMENT, INSTITUTIONS, MODERN_DROPS, MODERN_EXTRAS, SECTOR_WAGE, SURVEYS } from "./demo-data";
import { type TradeJson, readData } from "./reference";

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

async function insertMany(sql: Sql, table: string, rows: object[], cols: string[]) {
  const s = sql as unknown as (strings: TemplateStringsArray | object[] | string, ...rest: unknown[]) => Promise<unknown>;
  for (let i = 0; i < rows.length; i += 1000) await s`insert into ${s(`ks.${table}`)} ${s(rows.slice(i, i + 1000), ...cols)}`;
}

export async function seedDemo(sql: Sql): Promise<Record<string, number>> {
  const trades = new Map((readData<TradeJson[]>("trades.json") ?? []).map((t) => [t.code, t]));
  const qpCode = new Map((readData<Array<TradeJson & { qpCode: string | null }>>("trades.json") ?? []).map((t) => [t.code, t.qpCode ?? t.code]));
  const r = rng(26134);

  // Wipe previous demo rows (children cascade from institution / course / employer).
  await sql`delete from ks.curriculum_pr where is_demo`;
  await sql`delete from ks.survey_response where is_demo`;
  await sql`delete from ks.institution where is_demo`;
  await sql`delete from ks.employer where is_demo`;

  const inst: object[] = [], courses: object[] = [], cskills: object[] = [], assess: object[] = [], cohorts: object[] = [];
  const trainers: object[] = [], equipment: object[] = [];
  for (const i of INSTITUTIONS) {
    inst.push({ id: i.id, name: i.name, type: i.type, lgd_code: i.lgd, town: i.town, ownership: i.ownership, is_demo: true });
    for (const code of i.trades) {
      const t = trades.get(code);
      if (!t) throw new Error(`unknown trade ${code}`);
      const id = `${i.id}:${code}`;
      const seats = t.kind === "ITI" ? [20, 24, 40, 48][Math.floor(r() * 4)]! : [30, 60, 90][Math.floor(r() * 3)]!;
      courses.push({ id, institution_id: i.id, code: qpCode.get(code), name: t.name, kind: t.kind, sector: t.sector, target_nco: t.nco,
        seats, duration_hours: t.durationHours, trainer_qualification: t.trainerQualification, is_demo: true });

      const drops = new Set(i.modern ? MODERN_DROPS[code] ?? [] : []);
      const skills = t.skills.filter((s) => !drops.has(s.skillId)).map((s) => ({ ...s, extra: false }));
      if (i.modern) for (const [skillId, p, h] of MODERN_EXTRAS[code] ?? []) {
        if (!skills.some((s) => s.skillId === skillId)) skills.push({ skillId, proficiency: p, hours: h, module: "Industry add-on module", extra: true });
      }
      for (const s of skills) {
        cskills.push({ course_id: id, skill_id: s.skillId, proficiency: s.proficiency, hours: s.hours, module: s.module });
        // Most syllabus skills are assessed; add-on modules often are not (the "assessment lag").
        const assessed = s.extra ? r() < 0.5 : r() < 0.88;
        if (assessed) {
          assess.push({ course_id: id, skill_id: s.skillId, method: s.hours >= 150 ? "practical" : "theory", weight: Math.round((s.hours / t.durationHours) * 100) / 100 });
        }
      }

      const mod = (i.lgd === "490" ? 0.08 : i.lgd === "475" ? -0.15 : 0) + (i.modern ? 0.05 : 0);
      const base = BASE_PLACEMENT[code] ?? 0.45;
      const wage = Math.round((SECTOR_WAGE[t.sector] ?? 12000) * (i.lgd === "490" ? 1.2 : i.lgd === "475" ? 0.8 : 1) / 100) * 100;
      for (const [fy, lift] of [["FY24", 0], ["FY25", 0.02 + r() * 0.03]] as const) {
        const enrolled = Math.round(seats * (0.8 + r() * 0.2));
        const completed = Math.round(enrolled * (0.7 + r() * 0.2));
        const p = Math.max(0.05, Math.min(0.92, base + mod + lift + (r() - 0.5) * 0.12));
        const placed6m = Math.round(completed * p);
        cohorts.push({ course_id: id, fy, enrolled, completed, placed_3m: Math.round(placed6m * 0.7), placed_6m: placed6m,
          median_wage: wage + Math.round((r() - 0.5) * 2000 / 100) * 100, is_demo: true });
      }

      const nTrainers = Math.max(1, Math.ceil(seats / 24));
      for (let k = 0; k < nTrainers; k++) {
        const expired = i.lgd === "475" ? r() < 0.5 : r() < 0.1;
        trainers.push({ id: `${id}:t${k}`, institution_id: i.id, qualification: t.trainerQualification, qp_codes: [qpCode.get(code)],
          certified_until: expired ? "2026-03-31" : `${2027 + Math.floor(r() * 3)}-03-31`, is_demo: true });
      }
      const sets = Math.max(1, Math.ceil(seats / 24) - (i.lgd === "475" && r() < 0.5 ? 1 : 0));
      t.equipment.forEach((item, k) => {
        equipment.push({ id: `${id}:e${k}`, institution_id: i.id, course_id: id, item_code: `${code}-EQ${k + 1}`, item, qty: sets,
          condition: r() < (i.lgd === "475" ? 0.4 : 0.15) ? "poor" : r() < 0.4 ? "fair" : "good",
          unit_cost: 40_000 + (hash(item) % 16) * 25_000, is_demo: true });
      });
    }
  }
  await insertMany(sql, "institution", inst, ["id", "name", "type", "lgd_code", "town", "ownership", "is_demo"]);
  await insertMany(sql, "course", courses, ["id", "institution_id", "code", "name", "kind", "sector", "target_nco", "seats", "duration_hours", "trainer_qualification", "is_demo"]);
  await insertMany(sql, "course_skill", cskills, ["course_id", "skill_id", "proficiency", "hours", "module"]);
  await insertMany(sql, "assessment_item", assess, ["course_id", "skill_id", "method", "weight"]);
  await insertMany(sql, "course_cohort", cohorts, ["course_id", "fy", "enrolled", "completed", "placed_3m", "placed_6m", "median_wage", "is_demo"]);
  await insertMany(sql, "trainer", trainers, ["id", "institution_id", "qualification", "qp_codes", "certified_until", "is_demo"]);
  await insertMany(sql, "equipment", equipment, ["id", "institution_id", "course_id", "item_code", "item", "qty", "condition", "unit_cost", "is_demo"]);

  // Employers + survey responses, in two waves (earlier wave ≈ Apr–Jun, recent wave ≈ Jul–Sep 2026).
  const employerId = new Map<string, string>();
  let nSurvey = 0;
  for (const [k, s] of SURVEYS.entries()) {
    const [e] = await sql<{ id: string }[]>`
      insert into ks.employer (name, lgd_code, sector, size_band, verified, is_demo)
      values (${s.employer}, ${s.lgd}, ${s.sector}, ${s.hires >= 25 ? "medium" : "small"}, false, true) returning id`;
    employerId.set(s.employer, e!.id);
    const recent = k % 2 === 0;
    const day = 1 + Math.floor(r() * 80);
    const collected = new Date(Date.UTC(2026, recent ? 6 : 3, day, 10));
    const [resp] = await sql<{ id: string }[]>`
      insert into ks.survey_response (employer_id, lgd_code, nco_code, sector, expected_hires_12m, posting_to_hire_ratio,
        csat_recent_hires, weeks_to_productivity, comment, collected_at, is_demo, verified, verified_at)
      values (${e!.id}, ${s.lgd}, ${s.nco}, ${s.sector}, ${s.hires}, ${Math.round((0.6 + r() * 1.6) * 10) / 10},
        ${recent ? 3 + Math.floor(r() * 2) : 2 + Math.floor(r() * 2)}, ${Math.round(recent ? 5 + r() * 6 : 7 + r() * 8)},
        ${s.comment}, ${collected}, true, true, ${collected}) returning id`;
    for (const [skillId, importance, proficiency] of s.skills) {
      await sql`insert into ks.survey_skill (response_id, skill_id, importance, proficiency) values (${resp!.id}, ${skillId}, ${importance}, ${proficiency})`;
    }
    nSurvey++;
  }

  const prs = await seedPrs(sql, employerId);
  await seedDemoEmployer(sql);
  return { institutions: inst.length, courses: courses.length, course_skill: cskills.length, assessment_item: assess.length,
    course_cohort: cohorts.length, trainer: trainers.length, equipment: equipment.length, surveys: nSurvey, curriculum_pr: prs };
}

async function seedPrs(sql: Sql, emp: Map<string, string>): Promise<number> {
  const [solar] = await sql<{ n: number }[]>`
    select count(distinct r.employer_id)::int as n from ks.survey_response r join ks.survey_skill s on s.response_id = r.id
    where r.lgd_code = '487' and s.skill_id in ('solar-pv-installation', 'ev-charging-installation') and s.importance = 'mandatory'`;
  const nashikEmployers = SURVEYS.filter((s) => s.lgd === "487" && s.sector === "electrical").map((s) => emp.get(s.employer)!);
  const allNashik = SURVEYS.filter((s) => s.lgd === "487").map((s) => emp.get(s.employer)!);
  const PRS = [
    {
      id: "pr-nashik-elec-solar-ev", course: "iti-nashik-satpur:CTS-ELEC", target: "add-on-module", status: "employer-validated",
      approver: "IMC, Satpur Govt ITI (specimen)", route: nashikEmployers,
      diff: [
        { op: "add", module: "Solar PV installation (add-on)", skillId: "solar-pv-installation", hoursBefore: 0, hoursAfter: 30, reason: `${solar?.n ?? 0} Nashik employers surveyed rank solar PV or EV charging Mandatory; the course teaches neither.` },
        { op: "add", module: "EV charging installation (add-on)", skillId: "ev-charging-installation", hoursBefore: 0, hoursAfter: 24, reason: "EV charger installation is named Mandatory by 3 local electrical employers." },
        { op: "resize", module: "Motor rewinding", skillId: "motor-rewinding", hoursBefore: 160, hoursAfter: 106, reason: "Rewinding is not named by any surveyed Nashik employer; 54 hours move to the add-ons, keeping total hours unchanged." },
        { op: "keep", module: "Wiring & installation", skillId: "domestic-wiring", hoursBefore: 300, hoursAfter: 300, reason: "Still Mandatory for every electrical employer surveyed." },
      ],
      rationale: "Local electrical employers now need solar PV and EV-charging skills from day one, and this course teaches neither. The PR adds two short add-on modules (54 hours) funded by trimming motor rewinding, so total hours stay the same. Three employers have endorsed it.",
      trainer: [{ qualification: "Suryamitra ToT (SCGJ)", count: 1 }], equip: [{ item: "Solar PV training kit", qty: 2 }, { item: "AC EV charger trainer", qty: 1 }],
      reviews: [["Godavari Solar Systems (specimen)", "endorse", "Exactly what our new hires lack."], ["Nashik Rooftop Energy (specimen)", "endorse", null],
        ["Sinnar Electricals (specimen)", "endorse", null], ["Satpur Switchgear Works (specimen)", "change", "Add 20 hours of PLC basics as well."]] as const,
      openedAt: "2026-08-04", validatedAt: "2026-09-02", approvedAt: null,
    },
    {
      id: "pr-nashik-copa-modernise", course: "iti-nashik-satpur:CTS-COPA", target: "recommendation", status: "draft",
      approver: "DGT / IT-ITeS SSC (NASSCOM)", route: allNashik,
      diff: [
        { op: "drop", module: "Typewriting", skillId: "typewriting", hoursBefore: 120, hoursAfter: 0, reason: "No surveyed employer and no Maharashtra posting in the last quarter asks for typewriting." },
        { op: "drop", module: "DOS & basic computing", skillId: "dos-basic-computing", hoursBefore: 120, hoursAfter: 0, reason: "DOS has no measurable demand in any district." },
        { op: "add", module: "Data analysis with spreadsheets", skillId: "data-analysis", hoursBefore: 0, hoursAfter: 140, reason: "Data-analysis skills appear in Pune and Nashik postings and are Mandatory for surveyed analytics employers." },
        { op: "add", module: "Advanced Excel", skillId: "ms-excel-advanced", hoursBefore: 0, hoursAfter: 100, reason: "Advanced Excel is requested across logistics and office roles." },
      ],
      rationale: "COPA still spends 240 hours on typewriting and DOS, which no employer asks for. This recommendation to DGT replaces them with data analysis and advanced Excel at equal hours.",
      trainer: [{ qualification: "CITS COPA with data-analytics upskilling", count: 1 }], equip: [{ item: "Spreadsheet/BI software licences", qty: 20 }],
      reviews: [] as const, openedAt: "2026-09-10", validatedAt: null, approvedAt: null,
    },
    {
      id: "pr-gadchiroli-gda-local", course: "pmk-gadchiroli:PMK-GDA", target: "state-course", status: "approved",
      approver: "MSSDS (Maharashtra State Skill Development Society)", route: SURVEYS.filter((s) => s.lgd === "475").map((s) => emp.get(s.employer)!),
      diff: [
        { op: "resize", module: "First aid & CPR", skillId: "first-aid-cpr", hoursBefore: 40, hoursAfter: 60, reason: "The district hospital marks first aid Mandatory; primary health centres are far apart." },
        { op: "add", module: "Patient communication in Marathi and Gondi", skillId: "marathi-communication", hoursBefore: 0, hoursAfter: 20, reason: "Local-language patient communication is Mandatory for the only surveyed hospital employer." },
      ],
      rationale: "Gadchiroli's hospital employer asks for stronger first aid and local-language patient communication. The state course adds 40 hours for this district's batches.",
      trainer: [{ qualification: "ToT-certified GDA trainer (HSSC)", count: 1 }], equip: [{ item: "CPR manikin", qty: 2 }],
      reviews: [["Gadchiroli District Hospital Services (specimen)", "endorse", "Please run two batches a year."]] as const,
      openedAt: "2026-06-15", validatedAt: "2026-07-20", approvedAt: "2026-08-28",
    },
  ];
  for (const p of PRS) {
    await sql`insert into ks.curriculum_pr (id, course_id, target, status, diff, rationale, approver_body, trainer_delta, equipment_delta,
        opened_at, validated_at, approved_at, is_demo)
      values (${p.id}, ${p.course}, ${p.target}, ${p.status}, ${sql.json(p.diff)}, ${p.rationale}, ${p.approver}, ${sql.json(p.trainer)},
        ${sql.json(p.equip)}, ${p.openedAt}, ${p.validatedAt}, ${p.approvedAt}, true)`;
    for (const e of new Set(p.route)) await sql`insert into ks.pr_route (pr_id, employer_id) values (${p.id}, ${e}) on conflict do nothing`;
    for (const [name, verdict, comment] of p.reviews) {
      await sql`insert into ks.pr_review (pr_id, employer_id, verdict, comment) values (${p.id}, ${emp.get(name)!}, ${verdict}, ${comment})`;
    }
  }
  return PRS.length;
}

/** Fixed-id demo employer the web app signs in as (DEMO_EMPLOYER_ID). Idempotent. */
export const DEMO_EMPLOYER_ID = "00000000-0000-4000-8000-000000000487";
export const DEMO_EMPLOYER_PRS = ["pr-nashik-elec-solar-ev", "pr-nashik-copa-modernise"];

export async function seedDemoEmployer(sql: Sql): Promise<{ id: string; routed: number }> {
  await sql`insert into ks.employer (id, name, lgd_code, sector, size_band, verified, is_demo)
            values (${DEMO_EMPLOYER_ID}, 'Nashik demo employer (specimen)', '487', 'electrical', 'small', false, true)
            on conflict (id) do update set name = excluded.name, lgd_code = excluded.lgd_code, is_demo = true`;
  // A clean inbox: routed to both Nashik PRs, no verdicts yet.
  await sql`delete from ks.pr_review where employer_id = ${DEMO_EMPLOYER_ID}`;
  let routed = 0;
  for (const pr of DEMO_EMPLOYER_PRS) {
    const r = await sql`insert into ks.pr_route (pr_id, employer_id) select ${pr}, ${DEMO_EMPLOYER_ID}
                        where exists (select 1 from ks.curriculum_pr where id = ${pr}) on conflict do nothing returning pr_id`;
    routed += r.length;
  }
  return { id: DEMO_EMPLOYER_ID, routed };
}
