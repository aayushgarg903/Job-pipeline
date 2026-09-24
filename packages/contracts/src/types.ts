// Shared domain types. Every package speaks these. Owned by the integration lead:
// change them only by agreement, never inside a feature package.

export type LgdCode = string; // Local Government Directory district code, e.g. "490" (Pune)
export type NcoCode = string; // NCO-2015, e.g. "7412.0100"
export type SkillId = string; // stable slug, e.g. "solar-pv-installation"
export type Proficiency = 1 | 2 | 3 | 4; // 1 basic · 2 working · 3 advanced · 4 expert (cumulative: "at p" means ">= p")
export type Lang = "en" | "mr";
export type Quarter = string; // "2026-Q3"

export type SignalKind = "postings" | "surveys" | "consultations" | "udyam";

/** Where a number came from. Every figure shown in the UI carries one. */
export interface Provenance {
  sources: Array<{ kind: SignalKind | "supply" | "placement" | "trend"; label: string; n: number }>;
  asOf: string; // ISO date
  isDemo: boolean; // SPECIMEN watermark when true
  lapsed: boolean; // LAPSED watermark when a source is past its freshness SLA
}

export interface District {
  lgd: LgdCode;
  nameEn: string;
  nameMr: string;
  division: string; // Konkan | Pune | Nashik | Chh. Sambhajinagar | Amravati | Nagpur
  population: number | null;
  isAspirational: boolean;
}

export interface Skill {
  id: SkillId;
  labelEn: string;
  labelMr: string | null;
  kind: "knowledge" | "skill" | "tool" | "transversal";
  escoUri: string | null;
}

export interface Occupation {
  nco: NcoCode;
  titleEn: string;
  titleMr: string | null;
  nsqfLevel: number | null;
}

/** One signal's estimate for a district before fusion (engine input). */
export interface SignalObservation {
  kind: SignalKind;
  lgd: LgdCode;
  nco: NcoCode;
  quarter: Quarter;
  n: number; // observation count (postings, survey responses, meetings, Udyam registrations)
  hires12m: number; // already converted to expected hires over 12 months
}

export interface DemandCell {
  lgd: LgdCode;
  skillId: SkillId;
  proficiency: Proficiency;
  quarter: Quarter;
  demand: number; // expected hires needing this skill at >= proficiency, next 12 months
  supply: number; // expected completers teaching it at >= proficiency, catchment-adjusted
  gap: number; // demand - supply (people)
  ratio: number; // demand / max(supply, 1)
  sdi: number; // absolute Skill Demand Index, 100 = state average at base quarter
  ciLow: number;
  ciHigh: number;
  coverage: number; // 0..1
}

export type CourseFlag = "HEALTHY" | "REVISE" | "OBSOLETE" | "OVERSUPPLIED";

export interface Course {
  id: string;
  institutionId: string;
  institutionName: string;
  lgd: LgdCode;
  name: string;
  code: string; // NCVT trade code or NSQF QP code
  kind: "ITI" | "PMKVY" | "polytechnic" | "state";
  targetNco: NcoCode;
  seats: number;
  durationHours: number;
  skills: Array<{ skillId: SkillId; proficiency: Proficiency; hours: number; assessed: boolean }>;
  isDemo: boolean;
}

export interface CourseHealth {
  courseId: string;
  quarter: Quarter;
  relevance: number; // 0..100
  outcomes: number; // 0..100
  currency: number; // 0..100
  validation: number; // 0..100
  total: number; // weighted 0..100
  flags: CourseFlag[];
  placementRate: number | null; // 0..1, 6-month
  missingSkills: SkillId[]; // demanded, not taught
  decliningSkills: SkillId[]; // taught, demand declining
  unassessedSkills: SkillId[]; // demanded + taught, never assessed
  explain: string[]; // plain sentences, each backed by a number
}

export type PrTarget = "state-course" | "add-on-module" | "recommendation";
export type PrStatus = "draft" | "employer-validated" | "approved" | "adopted";

export interface DiffLine {
  op: "add" | "drop" | "resize" | "keep";
  module: string;
  skillId: SkillId | null;
  hoursBefore: number;
  hoursAfter: number;
  reason: string; // plain sentence with the number that justifies it
}

export interface CurriculumPr {
  id: string;
  courseId: string;
  target: PrTarget;
  status: PrStatus;
  diff: DiffLine[];
  rationale: string; // human, grounded, 2-4 sentences
  endorsements: number;
  changeRequests: number;
  openedAt: string;
  adoptedAt: string | null;
  trainerDelta: Array<{ qualification: string; count: number }>;
  equipmentDelta: Array<{ item: string; qty: number }>;
}

export interface PlanCourseInput {
  courseId: string;
  name: string;
  isNew: boolean;
  seatsPrev: number;
  batchSize: number;
  maxBatches: number;
  completionRate: number; // 0..1
  placementProb: number; // 0..1 at current supply
  wage: number; // monthly INR
  trainerQualification: string;
  trainerHoursPerBatch: number;
  equipmentSets: number;
  equipmentCostPerSet: number; // INR
  teaches: SkillId[];
}

export interface PlanInput {
  lgd: LgdCode;
  fy: string; // "FY27"
  seatBudget: number;
  capexBudget: number; // INR
  trainerHoursAvailable: Record<string, number>; // qualification -> hours
  trainerHireCost: Record<string, number>; // qualification -> INR per trainer
  hoursPerHiredTrainer: number;
  demandBySkill: Record<SkillId, number>; // people
  medianWage: number;
  courses: PlanCourseInput[];
  params?: { lambda?: number; mu?: number; alpha?: number };
}

export interface PlanResult {
  status: "optimal" | "infeasible" | "error";
  objective: number;
  expectedPlacements: number;
  rows: Array<{ courseId: string; name: string; seatsPrev: number; seats: number; batches: number; opened: boolean }>;
  trainersToHire: Record<string, number>;
  equipmentToBuy: Record<string, number>; // courseId -> sets
  oversupplyBySkill: Record<SkillId, number>;
  marginals: Array<{ resource: string; deltaPlacements: number; sentence: string }>;
  capexUsed: number;
}

export interface Posting {
  id: string;
  title: string;
  employer: string;
  lgd: LgdCode | null;
  city: string | null;
  nco: NcoCode | null;
  postedAt: string;
  source: string;
  url: string | null;
}

/** An Evidence Drawer row: why a number says what it says. */
export interface EvidenceRow {
  kind: "posting" | "survey" | "consultation" | "udyam" | "dataset" | "cohort";
  title: string;
  detail: string; // e.g. the highlighted evidence sentence
  source: string;
  date: string;
  url: string | null;
}

export interface RadarTerm {
  term: string;
  skillId: SkillId | null;
  global: Array<{ period: string; value: number }>; // e.g. GitHub repos / OpenAlex works per quarter, indexed
  mhPostings: Array<{ period: string; value: number }>;
  coursesTeaching: number;
  note: string;
}

export interface SourceHealth {
  id: string;
  name: string;
  kind: string;
  licence: string;
  lastFetchAt: string | null;
  rows: number;
  freshnessSlaHours: number;
  ok: boolean;
  note: string;
}

export interface StateOverview {
  asOf: string;
  districts: number;
  postingsThisQuarter: number;
  employersHeard: number; // surveys + consultations
  coursesTracked: number;
  flagCounts: Record<CourseFlag, number>;
  isDemo: boolean;
}

export interface DistrictSummary {
  district: District;
  mismatch: number; // 0..1
  coverage: number; // 0..1
  topShortage: { skillId: SkillId; label: string; gap: number } | null;
  topSurplus: { skillId: SkillId; label: string; gap: number } | null;
  postings: number;
  udyamNew12m: number;
  provenance: Provenance;
}
