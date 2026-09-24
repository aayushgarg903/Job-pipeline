// Architecture §6.2: supply through the spill-over matrix, gap/ratio, DemandCell building and the
// occupation-level Mismatch Index (counted in people).
//
//   supply(d,s,≥p) = Σ_d' M[d'→d] · Σ_{c in d'} completers_c · teaches(c,s,≥p)
//   gap = demand − supply,  ratio = demand / max(supply, 1)
//   Mismatch(d) = Σ_o |demand(d,o) − supply(d,o)| / Σ_o demand(d,o)

import type { Course, DemandCell, LgdCode, NcoCode, Proficiency, Quarter, SkillId } from "@ks/contracts";
import type { HiresEstimate, SkillDemand } from "./sdi";

/** Spill-over matrix: M[from][to] = share of `from`'s completers who work in `to`. Rows sum to 1. */
export type Spillover = Record<LgdCode, Record<LgdCode, number>>;

/**
 * Cleans a spill-over matrix: drops negative/non-finite shares and rescales every row to sum to 1.
 * A district with no row (or an all-zero row) keeps all its completers at home.
 */
export function normaliseSpillover(M: Spillover | undefined, lgds: readonly LgdCode[]): Spillover {
  const out: Spillover = {};
  const all = new Set<LgdCode>([...lgds, ...Object.keys(M ?? {})]);
  for (const from of all) {
    const row = M?.[from] ?? {};
    const clean: Record<LgdCode, number> = {};
    let total = 0;
    for (const [to, v] of Object.entries(row)) {
      if (Number.isFinite(v) && v > 0) {
        clean[to] = v;
        total += v;
      }
    }
    if (total <= 0) out[from] = { [from]: 1 };
    else {
      for (const to of Object.keys(clean)) clean[to] = (clean[to] as number) / total;
      out[from] = clean;
    }
  }
  return out;
}

/** Largest |row sum − 1| in M; 0 for a valid matrix. */
export function spilloverRowError(M: Spillover): number {
  let worst = 0;
  for (const row of Object.values(M)) {
    const s = Object.values(row).reduce((a, b) => a + b, 0);
    worst = Math.max(worst, Math.abs(s - 1));
  }
  return worst;
}

export interface SupplyOptions {
  /** Completion rate per course id (0..1), or one rate for all. Default 0.75. */
  completion?: Record<string, number> | number;
  /** Explicit expected completers per course id; overrides seats × completion. */
  completers?: Record<string, number>;
  spillover?: Spillover;
}

export interface SupplyIndex {
  /** Completers able to do skill s at ≥ p, serving district d. */
  skill(lgd: LgdCode, skillId: SkillId, p: Proficiency): number;
  /** Completers trained for occupation o, serving district d. */
  occupation(lgd: LgdCode, nco: NcoCode): number;
  /** Per-course completers after spill-over into district d (for evidence drawers). */
  contributions(lgd: LgdCode, skillId: SkillId, p: Proficiency): Array<{ courseId: string; people: number }>;
}

export function expectedCompleters(course: Course, opts: SupplyOptions = {}): number {
  const explicit = opts.completers?.[course.id];
  if (explicit !== undefined) return Math.max(0, explicit);
  const c = opts.completion;
  const rate = typeof c === "number" ? c : (c?.[course.id] ?? 0.75);
  return Math.max(0, course.seats) * Math.min(1, Math.max(0, rate));
}

const k3 = (a: string, b: string, c: number | string) => `${a}|${b}|${c}`;

/** Builds a supply index over all courses. teaches(c,s,≥p) = 1 when the course teaches s at proficiency ≥ p. */
export function buildSupply(courses: readonly Course[], opts: SupplyOptions = {}): SupplyIndex {
  const lgds = [...new Set(courses.map((c) => c.lgd))];
  const M = normaliseSpillover(opts.spillover, lgds);
  const skillMap = new Map<string, number>();
  const occMap = new Map<string, number>();
  const contrib = new Map<string, Array<{ courseId: string; people: number }>>();

  for (const course of courses) {
    const completers = expectedCompleters(course, opts);
    if (completers <= 0) continue;
    const row = M[course.lgd] ?? { [course.lgd]: 1 };
    for (const [to, share] of Object.entries(row)) {
      const people = completers * share;
      if (people <= 0) continue;
      const ok = `${to}|${course.targetNco}`;
      occMap.set(ok, (occMap.get(ok) ?? 0) + people);
      // Best proficiency per skill in this course (a skill listed twice counts once).
      const best = new Map<SkillId, number>();
      for (const s of course.skills) best.set(s.skillId, Math.max(best.get(s.skillId) ?? 0, s.proficiency));
      for (const [skillId, top] of best) {
        for (let p = 1; p <= top; p++) {
          const k = k3(to, skillId, p);
          skillMap.set(k, (skillMap.get(k) ?? 0) + people);
          const list = contrib.get(k) ?? [];
          list.push({ courseId: course.id, people });
          contrib.set(k, list);
        }
      }
    }
  }

  return {
    skill: (lgd, skillId, p) => skillMap.get(k3(lgd, skillId, p)) ?? 0,
    occupation: (lgd, nco) => occMap.get(`${lgd}|${nco}`) ?? 0,
    contributions: (lgd, skillId, p) => contrib.get(k3(lgd, skillId, p)) ?? [],
  };
}

export function gapOf(demand: number, supply: number): { gap: number; ratio: number } {
  return { gap: demand - supply, ratio: demand / Math.max(supply, 1) };
}

/** Joins skill demand with supply into the contract's DemandCell rows. */
export function buildDemandCells(skills: readonly SkillDemand[], supply: SupplyIndex): DemandCell[] {
  return skills.map((s) => {
    const sup = supply.skill(s.lgd, s.skillId, s.proficiency);
    const { gap, ratio } = gapOf(s.demand, sup);
    return {
      lgd: s.lgd,
      skillId: s.skillId,
      proficiency: s.proficiency,
      quarter: s.quarter,
      demand: s.demand,
      supply: sup,
      gap,
      ratio,
      sdi: s.sdi,
      ciLow: s.ciLow,
      ciHigh: s.ciHigh,
      coverage: s.coverage,
    };
  });
}

export interface OccupationGap {
  nco: NcoCode;
  demand: number;
  supply: number;
  gap: number;
  ratio: number;
}

export interface MismatchResult {
  lgd: LgdCode;
  quarter: Quarter;
  mismatch: number; // 0.. (0 = every occupation balanced; 1 = misallocated people equal total demand)
  mismatchedPeople: number; // Σ_o |demand − supply|
  totalDemand: number;
  occupations: OccupationGap[]; // sorted by |gap| descending
}

/**
 * Occupation-level Mismatch Index for one district and quarter. Uses occupation hires, never a
 * sum over skills (which would count one hire several times). Occupations that only have supply
 * still count: completers with nowhere to go are mismatch too.
 */
export function mismatchIndex(
  hires: readonly HiresEstimate[],
  supply: SupplyIndex,
  lgd: LgdCode,
  quarter: Quarter,
  supplyOnlyNcos: readonly NcoCode[] = [],
): MismatchResult {
  const demandByO = new Map<NcoCode, number>();
  for (const h of hires) if (h.lgd === lgd && h.quarter === quarter) demandByO.set(h.nco, (demandByO.get(h.nco) ?? 0) + h.hires);
  for (const o of supplyOnlyNcos) if (!demandByO.has(o)) demandByO.set(o, 0);
  const occupations: OccupationGap[] = [];
  let num = 0;
  let den = 0;
  for (const [nco, demand] of demandByO) {
    const sup = supply.occupation(lgd, nco);
    const { gap, ratio } = gapOf(demand, sup);
    occupations.push({ nco, demand, supply: sup, gap, ratio });
    num += Math.abs(gap);
    den += demand;
  }
  occupations.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap) || (a.nco < b.nco ? -1 : 1));
  return { lgd, quarter, mismatch: den > 0 ? num / den : 0, mismatchedPeople: num, totalDemand: den, occupations };
}

/** Catchment demand for a course: demand the course's completers actually face, via M. */
export function catchmentWeight(M: Spillover, from: LgdCode): Array<{ lgd: LgdCode; share: number }> {
  const row = normaliseSpillover(M, [from])[from] ?? { [from]: 1 };
  return Object.entries(row).map(([lgd, share]) => ({ lgd, share }));
}
