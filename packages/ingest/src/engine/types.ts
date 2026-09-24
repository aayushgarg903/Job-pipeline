// The engine seam: facts.ts calls `engine.computeCells` and `engine.computeCourseHealth` through
// this interface only. ./core.ts adapts @ks/core (default); ./cells.ts + ./health.ts are the
// original local stand-in, kept behind KS_ENGINE=local.
import type { CourseHealth, DemandCell, SignalKind, SignalObservation } from "@ks/contracts";

export interface EngineDistrict { lgd: string; division: string; population: number }

export interface EngineInput {
  quarters: string[]; // oldest → latest
  baseQuarter: string; // SDI = 100 · demand / state-average demand in this quarter
  districts: EngineDistrict[];
  observations: SignalObservation[]; // per (kind, lgd, nco, quarter): n and hires12m (raw, uncalibrated)
  weights: Record<SignalKind, number>; // fixed fusion weights, sum to 1
  priorStrength: Record<SignalKind, number>; // m_k in the shrinkage recursion
  /** P(skill needed | occupation) and the typical required proficiency. */
  profiles: Array<{ nco: string; skillId: string; weight: number; proficiency: number }>;
  /** Annual completers teaching skill s at proficiency p, located in district lgd (pre spill-over). */
  supply: Array<{ lgd: string; skillId: string; proficiency: number; completers: number; estimated: number }>;
  occSupply: Array<{ lgd: string; nco: string; completers: number }>;
  /** Spill-over matrix M[from → to], rows sum to 1. */
  spill: Array<{ from: string; to: string; share: number }>;
  /** Occupations the ITI/PMKVY system trains for; Mismatch is computed over these only (all if omitted). */
  trainableNcos?: string[];
}

export interface OccupationCell { quarter: string; lgd: string; nco: string; demand: number; supply: number }
export interface DistrictMetricOut { quarter: string; lgd: string; mismatch: number; coverage: number }
export interface DemandFactOut { quarter: string; lgd: string; nco: string; signal: SignalKind; n: number; hires12m: number }
export interface SupplyFactOut { quarter: string; lgd: string; skillId: string; proficiency: number; graduates: number; estimatedShare: number }

export interface EngineOutput {
  /** Prior strengths actually used (the core engine fits them); reported in facts stats. */
  priorStrength?: Record<SignalKind, number>;
  cells: DemandCell[];
  occupationCells: OccupationCell[];
  districtMetrics: DistrictMetricOut[];
  demandFacts: DemandFactOut[]; // calibrated + shrunk per-signal estimates, for provenance
  supplyFacts: SupplyFactOut[];
}

export interface HealthCourseInput {
  id: string; lgd: string; code: string; targetNco: string;
  skills: Array<{ skillId: string; proficiency: number; hours: number; assessed: boolean }>;
  cohort: { enrolled: number; completed: number; placed6m: number } | null;
  endorsements: number; changeRequests: number;
}

export interface HealthInput {
  quarter: string;
  prevQuarter: string;
  courses: HealthCourseInput[];
  profiles: EngineInput["profiles"];
  cells: DemandCell[]; // all quarters (for trend tests) — latest used for relevance
  occupationCells: OccupationCell[];
  labels: Record<string, string>; // skillId → label, for explain sentences
  /** Spill-over matrix; the core engine measures relevance in the course's catchment. */
  spill?: EngineInput["spill"];
  /** lgd → district name, for explain sentences (core engine). */
  districtNames?: Record<string, string>;
}

export interface Engine {
  computeCells(input: EngineInput): EngineOutput;
  computeCourseHealth(input: HealthInput): CourseHealth[];
}
