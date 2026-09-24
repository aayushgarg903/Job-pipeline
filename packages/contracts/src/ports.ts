// Ports: the seams between packages. @ks/db implements Readers/Writers,
// @ks/ai implements Extractor/Embedder, apps/web consumes them.
import type {
  Course, CourseHealth, CurriculumPr, DemandCell, District, DistrictSummary, EvidenceRow,
  Lang, LgdCode, NcoCode, Occupation, PlanInput, PlanResult, Posting, Proficiency, RadarTerm,
  Skill, SkillId, SourceHealth, StateOverview,
} from "./types";

/** Read side. Every function takes only primitives so it can run inside "use cache". */
export interface Readers {
  stateOverview(): Promise<StateOverview>;
  districts(): Promise<DistrictSummary[]>;
  district(lgd: LgdCode): Promise<DistrictSummary | null>;
  districtCells(lgd: LgdCode, limit?: number): Promise<DemandCell[]>; // sorted by |gap| desc
  skill(id: SkillId): Promise<Skill | null>;
  skillCells(id: SkillId): Promise<DemandCell[]>; // one per district, latest quarter
  skillTrend(id: SkillId): Promise<Array<{ quarter: string; sdi: number; ciLow: number; ciHigh: number }>>;
  topSkills(opts: { lgd?: LgdCode; by: "shortage" | "surplus" | "rising"; limit: number }): Promise<Array<Skill & { gap: number; sdi: number; delta: number }>>;
  searchSkills(q: string, limit?: number): Promise<Skill[]>;
  occupation(nco: NcoCode): Promise<Occupation | null>;
  courses(opts: { lgd?: LgdCode; flag?: string; limit?: number }): Promise<Array<Course & { health: CourseHealth | null }>>;
  course(id: string): Promise<(Course & { health: CourseHealth | null }) | null>;
  coursePrs(courseId: string): Promise<CurriculumPr[]>;
  pr(id: string): Promise<CurriculumPr | null>;
  employerInbox(employerId: string): Promise<CurriculumPr[]>;
  evidence(ref: { kind: "district" | "skill" | "course" | "cell"; id: string; skillId?: SkillId }, limit?: number): Promise<EvidenceRow[]>;
  postings(opts: { lgd?: LgdCode; skillId?: SkillId; limit: number }): Promise<Posting[]>;
  planInput(lgd: LgdCode, fy: string): Promise<PlanInput | null>;
  savedPlan(lgd: LgdCode, fy: string): Promise<(PlanResult & { signedBy: string | null; signedAt: string | null }) | null>;
  radar(): Promise<RadarTerm[]>;
  sources(): Promise<SourceHealth[]>;
  outcomes(): Promise<Array<{ kpi: string; baseline: number; current: number; unit: string; note: string }>>;
}

export interface SurveyInput {
  employerName: string;
  lgd: LgdCode;
  nco: NcoCode;
  sector: string;
  expectedHires12m: number;
  postingToHireRatio: number | null;
  csatRecentHires: 1 | 2 | 3 | 4 | 5 | null;
  weeksToProductivity: number | null;
  skills: Array<{ skillId: SkillId; importance: "mandatory" | "preferred" | "nice"; proficiency: Proficiency }>;
  comment: string | null;
  /** DPDP Act 2023 s.6: proof of consent. Writers must persist it with the response. */
  consent?: { at: string; noticeVersion: string; purpose: string };
}

export interface Writers {
  submitSurvey(input: SurveyInput): Promise<{ id: string }>;
  reviewPr(input: { prId: string; employerId: string; verdict: "endorse" | "change" | "irrelevant"; comment: string | null }): Promise<void>;
  savePlan(input: { lgd: LgdCode; fy: string; input: PlanInput; result: PlanResult; signedBy: string | null }): Promise<{ id: string }>;
  resolveReview(input: { id: string; decision: "approve" | "reject"; by: string }): Promise<void>;
}

/** What the AI package extracts from one job posting. */
export interface ExtractedSkill {
  text: string; // as written in the posting
  skillId: SkillId | null; // canonical mapping, null => unknown-skill review queue
  requirement: "required" | "preferred" | "optional";
  proficiency: Proficiency | null;
  years: number | null;
  negated: boolean;
  evidence: string; // exact sentence from the posting
  confidence: number; // 0..1
}

export interface ExtractedPosting {
  nco: NcoCode | null;
  ncoConfidence: number;
  workMode: "on_site" | "hybrid" | "remote" | "unknown";
  skills: ExtractedSkill[];
  model: string;
}

export interface Extractor {
  extractPosting(input: { title: string; description: string; skillsCatalog: Array<Pick<Skill, "id" | "labelEn">>; occupations: Array<Pick<Occupation, "nco" | "titleEn">> }): Promise<ExtractedPosting>;
  /** Candidate free text (en or mr) -> canonical skills */
  parseCandidateSkills(input: { text: string; lang: Lang; skillsCatalog: Array<Pick<Skill, "id" | "labelEn">> }): Promise<Array<{ skillId: SkillId; proficiency: Proficiency }>>;
  /** Grounded prose from computed numbers only. Never invents facts. */
  narrate(input: { kind: "pr-rationale" | "compare" | "plan-summary" | "candidate-path"; facts: Record<string, unknown>; lang: Lang }): Promise<string>;
}

export interface Embedder {
  embed(texts: string[]): Promise<number[][]>; // 768 dims
}
