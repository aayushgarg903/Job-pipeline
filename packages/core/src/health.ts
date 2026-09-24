// Architecture §6.3: Course Health (0–100) and flags. Each component is scored 0–100 on its own
// scale, then weighted 35/30/15/20. Oversupply is a flag, never a score term.

import type { Course, CourseFlag, CourseHealth, Lang, Proficiency, Quarter, SkillId } from "@ks/contracts";
import { aboutNum, countOf, formatIndian, mrAttributive, mrPeopleObj, peopleCount, capitalize, type Digits } from "./humanize";
import { clamp } from "./random";

export { detectDecliningSkills, mannKendall, theilSen, benjaminiHochberg } from "./trend";

export const HEALTH_WEIGHTS = { relevance: 35, outcomes: 30, currency: 15, validation: 20 } as const;
export const THRESHOLDS = { obsoleteCurrency: 60, reviseRelevance: 55, oversuppliedRatio: 0.6 } as const;

export interface TargetSkillDemand {
  skillId: SkillId;
  proficiency: Proficiency; // required level (demand at ≥ p)
  demand: number; // people, in the course's catchment (via M)
  mustHave?: boolean; // employers marked it Mandatory
}

export interface HealthInput {
  course: Course;
  quarter: Quarter;
  districtName: string; // in `lang`
  targetSkills: readonly TargetSkillDemand[];
  cohort?: { completed: number; placed6m: number } | null;
  stateMedianPlacement?: number; // the trade's state median 6-month rate, 0..1
  outcomePriorStrength?: number; // Beta-binomial prior size in trainees, default 20
  declining?: readonly SkillId[];
  endorsements?: number;
  changeRequests?: number;
  occupationRatioHistory?: readonly number[]; // occupation demand/supply by quarter, most recent last
  occupationDemand?: number; // people, for the OVERSUPPLIED sentence
  occupationSupply?: number;
  skillLabels?: Record<SkillId, string>; // in `lang`
  lang?: Lang;
  digits?: Digits;
}

const teachesAt = (course: Course, skillId: SkillId, p: Proficiency) =>
  course.skills.some((s) => s.skillId === skillId && s.proficiency >= p);

/** Demand-weighted share (0–100) of the target occupation's skills the course teaches at ≥ the required level. */
export function relevanceScore(course: Course, target: readonly TargetSkillDemand[]): number {
  const total = target.reduce((a, t) => a + Math.max(0, t.demand), 0);
  if (total <= 0) return 50; // no demand evidence: neutral, not zero
  const covered = target.reduce((a, t) => a + (teachesAt(course, t.skillId, t.proficiency) ? Math.max(0, t.demand) : 0), 0);
  return (100 * covered) / total;
}

/**
 * Outcomes (0–100): Beta-binomial shrunk 6-month placement rate against the trade's state median.
 * p̂ = (placed + K·median)/(completed + K). At the median → 50, zero → 0, 100% → 100 (piecewise linear).
 */
export function outcomesScore(
  cohort: { completed: number; placed6m: number } | null | undefined,
  stateMedian = 0.5,
  priorStrength = 20,
): { score: number; shrunkRate: number | null; rawRate: number | null } {
  const m0 = clamp(stateMedian, 0.01, 0.99);
  if (!cohort || cohort.completed <= 0) return { score: 50, shrunkRate: null, rawRate: null };
  const placed = clamp(cohort.placed6m, 0, cohort.completed);
  const p = (placed + priorStrength * m0) / (cohort.completed + priorStrength);
  const score = p <= m0 ? (50 * p) / m0 : 50 + (50 * (p - m0)) / (1 - m0);
  return { score: clamp(score, 0, 100), shrunkRate: p, rawRate: placed / cohort.completed };
}

/** Currency (0–100): 100 − hours-weighted share of course skills flagged declining. */
export function currencyScore(course: Course, declining: readonly SkillId[]): { score: number; decliningHours: number; totalHours: number } {
  const set = new Set(declining);
  const totalHours = course.skills.reduce((a, s) => a + Math.max(0, s.hours), 0);
  const decliningHours = course.skills.reduce((a, s) => a + (set.has(s.skillId) ? Math.max(0, s.hours) : 0), 0);
  if (totalHours <= 0) return { score: 100, decliningHours: 0, totalHours: 0 };
  return { score: 100 - (100 * decliningHours) / totalHours, decliningHours, totalHours };
}

/** Employer validation (0–100): Beta(2,2) prior (neutral 50) updated by endorse / change verdicts. */
export function validationScore(endorsements = 0, changeRequests = 0): number {
  const e = Math.max(0, endorsements);
  const c = Math.max(0, changeRequests);
  return (100 * (2 + e)) / (4 + e + c);
}

export function courseHealth(input: HealthInput): CourseHealth {
  const { course } = input;
  const lang = input.lang ?? "en";
  const o = { lang, digits: input.digits };
  const label = (id: SkillId) => input.skillLabels?.[id] ?? id;
  const target = [...input.targetSkills].sort((a, b) => b.demand - a.demand || (a.skillId < b.skillId ? -1 : 1));

  const relevance = relevanceScore(course, target);
  const out = outcomesScore(input.cohort, input.stateMedianPlacement, input.outcomePriorStrength);
  const declining = input.declining ?? [];
  const cur = currencyScore(course, declining);
  const validation = validationScore(input.endorsements, input.changeRequests);
  const total =
    (HEALTH_WEIGHTS.relevance * relevance + HEALTH_WEIGHTS.outcomes * out.score +
      HEALTH_WEIGHTS.currency * cur.score + HEALTH_WEIGHTS.validation * validation) / 100;

  const demanded = target.filter((t) => t.demand > 0);
  const missingSkills = demanded.filter((t) => !teachesAt(course, t.skillId, t.proficiency)).map((t) => t.skillId);
  const decSet = new Set(declining);
  const decliningSkills = [...new Set(course.skills.filter((s) => decSet.has(s.skillId)).map((s) => s.skillId))];
  const demandedIds = new Set(demanded.map((t) => t.skillId));
  const unassessedSkills = [
    ...new Set(course.skills.filter((s) => demandedIds.has(s.skillId) && !s.assessed).map((s) => s.skillId)),
  ];

  const ratios = input.occupationRatioHistory ?? [];
  const lastTwo = ratios.slice(-2);
  const oversupplied = lastTwo.length === 2 && lastTwo.every((r) => r < THRESHOLDS.oversuppliedRatio);
  const flags: CourseFlag[] = [];
  if (cur.score < THRESHOLDS.obsoleteCurrency) flags.push("OBSOLETE");
  if (oversupplied) flags.push("OVERSUPPLIED");
  // REVISE needs demand evidence: the neutral 50 used when there is none must not trip it.
  const hasDemand = target.some((t) => t.demand > 0);
  if (hasDemand && relevance < THRESHOLDS.reviseRelevance) flags.push("REVISE");
  if (flags.length === 0) flags.push("HEALTHY");

  // ---- explain[]: short human sentences, people not percentages ----
  const explain: string[] = [];
  const mr = lang === "mr";
  const district = input.districtName;
  const must = demanded.filter((t) => t.mustHave);
  const pool = must.length > 0 ? must : demanded;
  if (pool.length > 0) {
    const taught = pool.filter((t) => teachesAt(course, t.skillId, t.proficiency)).length;
    const n = countOf(taught, pool.length, o);
    if (mr) {
      const who = `${mrAttributive(district)} कंपन्या`;
      const noun = taught === 1 ? "कौशल्य" : "कौशल्ये";
      explain.push(must.length > 0
        ? `${who} अत्यावश्यक मानतात अशा ${n} ${noun} हा अभ्यासक्रम शिकवतो.`
        : `या नोकऱ्यांसाठी ${who} मागतात अशा ${n} ${noun} हा अभ्यासक्रम शिकवतो.`);
    } else if (pool.length === 1) {
      const verb = taught === 1 ? "Teaches" : "Doesn't teach";
      explain.push(must.length > 0
        ? `${verb} the one skill ${district} employers call a must-have.`
        : `${verb} the one skill ${district} employers ask for in these jobs.`);
    } else {
      const of = `${formatIndian(taught, o)} of the ${formatIndian(pool.length, o)}`;
      explain.push(must.length > 0
        ? `Teaches ${of} skills ${district} employers call must-haves.`
        : `Teaches ${of} skills ${district} employers ask for in these jobs.`);
    }
  }
  const topMissing = demanded.find((t) => !teachesAt(course, t.skillId, t.proficiency));
  if (topMissing) {
    explain.push(mr
      ? `पुढील वर्षी इथे नोकरीला लागणाऱ्या ${mrPeopleObj(topMissing.demand, o)} लागणारे "${label(topMissing.skillId)}" हे कौशल्य हा अभ्यासक्रम शिकवत नाही.`
      : `Doesn't teach ${label(topMissing.skillId)}, which ${peopleCount(topMissing.demand, o)} hired here next year will need.`);
  }
  if (input.cohort && input.cohort.completed > 0) {
    const done = input.cohort.completed;
    const placed = Math.round(clamp(input.cohort.placed6m, 0, done));
    const med = input.stateMedianPlacement;
    const medPart = med !== undefined ? Math.round(med * done) : null;
    if (mr) {
      explain.push(`अभ्यासक्रम पूर्ण केलेल्या ${countOf(placed, done, o)} जणांना 6 महिन्यांत नोकरी मिळाली` +
        (medPart !== null ? `; राज्यभरात या ट्रेडसाठी हे प्रमाण ${countOf(medPart, done, o)} आहे.` : "."));
    } else {
      explain.push(`${capitalize(countOf(placed, done, o))} people who finished had a job within 6 months` +
        (medPart !== null ? `; across the state this trade places ${countOf(medPart, done, o)}.` : "."));
    }
  } else {
    explain.push(mr ? "या अभ्यासक्रमाच्या नोकरीच्या निकालांची माहिती अजून उपलब्ध नाही." : "We don't have job outcomes for this course yet.");
  }
  if (cur.decliningHours > 0) {
    const h = formatIndian(Math.round(cur.decliningHours), o);
    const t = formatIndian(Math.round(cur.totalHours), o);
    explain.push(mr
      ? `याच्या ${t} तासांपैकी ${h} तास अशा कौशल्यांवर जातात ज्यांची मागणी सतत कमी होत आहे.`
      : `${h} of its ${t} hours go to skills employers keep asking for less.`);
  }
  if (unassessedSkills.length > 0) {
    const k = formatIndian(unassessedSkills.length, o);
    explain.push(mr
      ? unassessedSkills.length === 1
        ? "कंपन्यांना हवे असलेले 1 कौशल्य शिकवले जाते, पण त्याची परीक्षा कधीच घेतली जात नाही."
        : `कंपन्यांना हवी असलेली ${k} कौशल्ये शिकवली जातात, पण त्यांची परीक्षा कधीच घेतली जात नाही.`
      : unassessedSkills.length === 1
        ? `1 skill employers need is taught but never tested.`
        : `${k} skills employers need are taught but never tested.`);
  }
  const e = input.endorsements ?? 0;
  const c = input.changeRequests ?? 0;
  if (e + c > 0) {
    explain.push(mr
      ? `${formatIndian(e, o)} ${e === 1 ? "कंपनीने" : "कंपन्यांनी"} या अभ्यासक्रमाला पाठिंबा दिला आणि ${formatIndian(c, o)} ${c === 1 ? "कंपनीने" : "कंपन्यांनी"} बदल सुचवले.`
      : `${e} ${e === 1 ? "employer" : "employers"} backed this course and ${c} asked for changes.`);
  } else {
    explain.push(mr ? "अजून कोणत्याही कंपनीने या अभ्यासक्रमाचा आढावा घेतलेला नाही." : "No employer has reviewed this course yet.");
  }
  if (oversupplied && input.occupationDemand !== undefined && input.occupationSupply !== undefined) {
    explain.push(mr
      ? `या नोकऱ्यांसाठी दरवर्षी ${mrPeopleObj(input.occupationSupply, o)} प्रशिक्षण मिळते, पण नोकऱ्या ${aboutNum(input.occupationDemand, o)} इतक्याच आहेत.`
      : `${capitalize(peopleCount(input.occupationSupply, o))} train for these jobs each year, but there are only ${aboutNum(input.occupationDemand, o)} openings.`);
  }

  return {
    courseId: course.id,
    quarter: input.quarter,
    relevance: round1(relevance),
    outcomes: round1(out.score),
    currency: round1(cur.score),
    validation: round1(validation),
    total: round1(total),
    flags,
    placementRate: out.rawRate,
    missingSkills,
    decliningSkills,
    unassessedSkills,
    explain,
  };
}

const round1 = (x: number) => Math.round(x * 10) / 10;
