// Architecture §6.6: the District Training Plan, a MIP solved with HiGHS (WASM).
//
// maximise Σ_c x_c·π_c·p⁰_c·(1 + α·min(wage_c/wage_med, 1.5)) − λ·Σ_s o_s − μ·(Σ_q κ_q·t_q + Σ_c ε_c·e_c)
// (costs in ₹ lakh, so μ reads as "placements given up per ₹ lakh spent")
//
// MIPs have no duals, so "shadow prices" are marginal re-solves: +1 trainer per binding
// qualification, +₹10 lakh capex, +10% seat budget.

import type { Lang, PlanCourseInput, PlanInput, PlanResult, SkillId } from "@ks/contracts";
import { formatIndian, mrLocative, morePeople, type Digits } from "./humanize";

export const DEFAULT_PLAN_PARAMS = { lambda: 0.5, mu: 0.2, alpha: 0.2 } as const;
export const STABILITY = { down: 0.7, up: 1.3 } as const;
const LAKH = 1e5;
const OPEN_EPSILON = 1e-3; // tiny cost on y_c so an unused candidate is never reported as "opened"
const BATCH_EPSILON = 1e-4; // tiny cost per batch so the plan never runs more batches than its seats need

// ---------------------------------------------------------------------------------------------
// Solver loading (Node and browser). In the browser, pass `locateFile` if highs.wasm is served
// from somewhere other than next to the bundled loader, or inject an instance with setHighs().

export interface HighsColumn {
  Primal?: number;
}
export interface HighsSolutionLike {
  Status: string;
  ObjectiveValue: number;
  Columns: Record<string, HighsColumn>;
}
export interface HighsLike {
  solve(problem: string, options?: Record<string, unknown>): HighsSolutionLike;
}
export interface HighsLoadOptions {
  locateFile?: (file: string, prefix?: string) => string;
  wasmBinary?: ArrayBuffer | Uint8Array;
}

let highsPromise: Promise<HighsLike> | null = null;

export function loadHighs(options?: HighsLoadOptions): Promise<HighsLike> {
  if (!highsPromise) {
    highsPromise = import("highs")
      .then((m) => {
        const loader = ((m as { default?: unknown }).default ?? m) as (o?: HighsLoadOptions) => Promise<HighsLike>;
        return loader(options);
      })
      .catch((err: unknown) => {
        highsPromise = null; // allow a retry after a failed load
        throw err;
      });
  }
  return highsPromise;
}

/** Inject a pre-loaded HiGHS instance (e.g. one created with a custom wasm URL in the browser). */
export function setHighs(instance: HighsLike | null): void {
  highsPromise = instance ? Promise.resolve(instance) : null;
}

// ---------------------------------------------------------------------------------------------
// LP building

export interface PlanOptions {
  highs?: HighsLike;
  districtName?: string; // in `lang`, for marginal sentences
  lang?: Lang;
  digits?: Digits;
  marginals?: boolean; // default true
  timeLimitSeconds?: number; // default 20
}

const num = (x: number): string => {
  const v = Number(x.toPrecision(12));
  return Object.is(v, -0) ? "0" : String(v);
};

/** Formats Σ coef·var as LP text, skipping zeros. */
function expr(terms: Array<[number, string]>): string {
  const parts: string[] = [];
  for (const [c, v] of terms) {
    if (!Number.isFinite(c) || Math.abs(c) < 1e-12) continue;
    const sign = c < 0 ? "-" : "+";
    parts.push(`${parts.length === 0 && sign === "+" ? "" : `${sign} `}${num(Math.abs(c))} ${v}`);
  }
  return parts.join(" ");
}

interface Model {
  lp: string;
  course: (i: number) => { b: string; x: string; y: string | null; e: string };
  quals: string[];
  skills: SkillId[];
  trainerHoursRow: Map<string, { used: Array<[number, string]>; available: number }>;
}

export function courseValue(c: PlanCourseInput, medianWage: number, alpha: number): number {
  const wageRatio = medianWage > 0 ? Math.min(c.wage / medianWage, 1.5) : 1;
  return c.completionRate * c.placementProb * (1 + alpha * Math.max(0, wageRatio));
}

/** Builds the CPLEX-LP text for a plan. Exposed for debugging and tests. */
export function buildPlanLp(input: PlanInput): Model {
  const p = { ...DEFAULT_PLAN_PARAMS, ...(input.params ?? {}) };
  const quals = [...new Set(input.courses.map((c) => c.trainerQualification))].sort();
  const skills = [...new Set([...input.courses.flatMap((c) => c.teaches), ...Object.keys(input.demandBySkill)])].sort();
  const qv = (q: string) => `t${quals.indexOf(q)}`;
  const sv = (s: SkillId) => `o${skills.indexOf(s)}`;
  const course = (i: number) => ({ b: `b${i}`, x: `x${i}`, y: input.courses[i]?.isNew ? `y${i}` : null, e: `e${i}` });

  const obj: Array<[number, string]> = [];
  const rows: string[] = [];
  const bounds: string[] = [];
  const generals: string[] = [];
  const binaries: string[] = [];
  let r = 0;
  const row = (terms: Array<[number, string]>, op: "<=" | ">=" | "=", rhs: number) => {
    const e = expr(terms);
    if (e) rows.push(` r${r++}: ${e} ${op} ${num(rhs)}`);
  };

  const capex: Array<[number, string]> = [];
  const hoursByQ = new Map<string, Array<[number, string]>>();
  input.courses.forEach((c, i) => {
    const v = course(i);
    obj.push([courseValue(c, input.medianWage, p.alpha), v.x]);
    obj.push([-BATCH_EPSILON, v.b]);
    obj.push([-p.mu * (c.equipmentCostPerSet / LAKH), v.e]);
    capex.push([c.equipmentCostPerSet / LAKH, v.e]);
    generals.push(v.b, v.x, v.e);
    row([[1, v.x], [-c.batchSize, v.b]], "<=", 0); // seats fit in batches
    const bmax = Math.max(0, Math.floor(c.maxBatches));
    if (v.y) {
      binaries.push(v.y);
      obj.push([-OPEN_EPSILON, v.y]);
      row([[1, v.b], [-bmax, v.y]], "<=", 0); // candidate only if opened
      bounds.push(` 0 <= ${v.b} <= ${bmax}`);
    } else {
      bounds.push(` 0 <= ${v.b} <= ${bmax}`);
    }
    if (!c.isNew && c.seatsPrev > 0) {
      bounds.push(` ${num(STABILITY.down * c.seatsPrev)} <= ${v.x} <= ${num(STABILITY.up * c.seatsPrev)}`);
    }
    row([[1, v.b], [-1, v.e]], "<=", Math.max(0, Math.floor(c.equipmentSets))); // one set per concurrent batch
    const list = hoursByQ.get(c.trainerQualification) ?? [];
    list.push([c.trainerHoursPerBatch, v.b]);
    hoursByQ.set(c.trainerQualification, list);
  });

  row(input.courses.map((_, i) => [1, course(i).x] as [number, string]), "<=", input.seatBudget);

  const trainerHoursRow = new Map<string, { used: Array<[number, string]>; available: number }>();
  for (const q of quals) {
    const t = qv(q);
    const cost = input.trainerHireCost[q];
    generals.push(t);
    if (cost === undefined || !(cost >= 0)) bounds.push(` 0 <= ${t} <= 0`); // no hiring route for this qualification
    const k = (cost ?? 0) / LAKH;
    obj.push([-p.mu * k, t]);
    capex.push([k, t]);
    const used = hoursByQ.get(q) ?? [];
    const available = input.trainerHoursAvailable[q] ?? 0;
    trainerHoursRow.set(q, { used, available });
    row([...used, [-input.hoursPerHiredTrainer, t]], "<=", available);
  }
  row(capex, "<=", input.capexBudget / LAKH);

  for (const s of skills) {
    const o = sv(s);
    obj.push([-p.lambda, o]);
    const produced: Array<[number, string]> = [];
    input.courses.forEach((c, i) => {
      if (c.teaches.includes(s)) produced.push([-c.completionRate, course(i).x]);
    });
    // o_s ≥ Σ x·π·teaches − demand_s
    row([[1, o], ...produced], ">=", -(input.demandBySkill[s] ?? 0));
  }

  const objText = expr(obj) || `0 ${course(0).x}`;
  const lp = [
    "Maximize",
    ` obj: ${objText}`,
    "Subject To",
    ...rows,
    "Bounds",
    ...bounds,
    ...(generals.length ? ["Generals", ` ${generals.join(" ")}`] : []),
    ...(binaries.length ? ["Binary", ` ${binaries.join(" ")}`] : []),
    "End",
  ].join("\n");
  return { lp, course, quals, skills, trainerHoursRow };
}

function validate(input: PlanInput): string | null {
  const nums: number[] = [input.seatBudget, input.capexBudget, input.hoursPerHiredTrainer, input.medianWage];
  for (const c of input.courses) {
    nums.push(c.seatsPrev, c.batchSize, c.maxBatches, c.completionRate, c.placementProb, c.wage, c.trainerHoursPerBatch, c.equipmentSets, c.equipmentCostPerSet);
    if (c.completionRate < 0 || c.completionRate > 1 || c.placementProb < 0 || c.placementProb > 1) return `rates out of range for ${c.courseId}`;
  }
  nums.push(...Object.values(input.demandBySkill), ...Object.values(input.trainerHoursAvailable), ...Object.values(input.trainerHireCost));
  if (nums.some((v) => !Number.isFinite(v))) return "non-finite number in input";
  if (new Set(input.courses.map((c) => c.courseId)).size !== input.courses.length) return "duplicate courseId";
  return null;
}

const emptyResult = (input: PlanInput, status: PlanResult["status"]): PlanResult => ({
  status,
  objective: 0,
  expectedPlacements: 0,
  rows: input.courses.map((c) => ({ courseId: c.courseId, name: c.name, seatsPrev: c.seatsPrev, seats: 0, batches: 0, opened: false })),
  trainersToHire: {},
  equipmentToBuy: {},
  oversupplyBySkill: {},
  marginals: [],
  capexUsed: 0,
});

interface CoreSolve {
  result: PlanResult;
  binding: string[]; // qualifications with no room for another batch
}

function solveCore(input: PlanInput, highs: HighsLike, timeLimit: number): CoreSolve {
  if (validate(input) !== null) return { result: emptyResult(input, "error"), binding: [] };
  if (input.courses.length === 0) return { result: emptyResult(input, "optimal"), binding: [] };
  const model = buildPlanLp(input);
  let sol: HighsSolutionLike;
  try {
    sol = highs.solve(model.lp, { output_flag: false, time_limit: timeLimit });
  } catch {
    return { result: emptyResult(input, "error"), binding: [] };
  }
  const hasPrimal = Object.values(sol.Columns ?? {}).some((c) => typeof c.Primal === "number");
  if (sol.Status === "Infeasible" || sol.Status === "Primal infeasible or unbounded") {
    return { result: emptyResult(input, "infeasible"), binding: [] };
  }
  if (!(sol.Status === "Optimal" || (sol.Status === "Time limit reached" && hasPrimal))) {
    return { result: emptyResult(input, "error"), binding: [] };
  }
  const val = (name: string | null) => (name ? (sol.Columns[name]?.Primal ?? 0) : 0);
  const int = (name: string | null) => Math.round(val(name)) + 0; // "+ 0" turns -0 into 0

  let expected = 0;
  let capexUsed = 0;
  const equipmentToBuy: Record<string, number> = {};
  const rows = input.courses.map((c, i) => {
    const v = model.course(i);
    const seats = int(v.x);
    const batches = int(v.b);
    const e = int(v.e);
    expected += seats * c.completionRate * c.placementProb;
    if (e > 0) {
      equipmentToBuy[c.courseId] = e;
      capexUsed += e * c.equipmentCostPerSet;
    }
    return { courseId: c.courseId, name: c.name, seatsPrev: c.seatsPrev, seats, batches, opened: c.isNew && batches > 0 && val(v.y) > 0.5 };
  });
  const trainersToHire: Record<string, number> = {};
  const binding: string[] = [];
  model.quals.forEach((q, j) => {
    const t = int(`t${j}`);
    if (t > 0) {
      trainersToHire[q] = t;
      capexUsed += t * (input.trainerHireCost[q] ?? 0);
    }
    const h = model.trainerHoursRow.get(q);
    if (!h) return;
    const used = h.used.reduce((a, [coef, name]) => a + coef * int(name), 0);
    const cap = h.available + input.hoursPerHiredTrainer * t;
    const smallest = Math.min(...input.courses.filter((c) => c.trainerQualification === q).map((c) => c.trainerHoursPerBatch));
    if (used > 0 && cap - used < smallest - 1e-6) binding.push(q); // exhausted and actually in use
  });
  const oversupplyBySkill: Record<SkillId, number> = {};
  model.skills.forEach((s, k) => {
    const o = val(`o${k}`);
    if (o > 1e-6) oversupplyBySkill[s] = Math.round(o * 10) / 10;
  });
  return {
    result: {
      status: "optimal",
      objective: sol.ObjectiveValue,
      expectedPlacements: Math.round(expected * 10) / 10,
      rows,
      trainersToHire,
      equipmentToBuy,
      oversupplyBySkill,
      marginals: [],
      capexUsed,
    },
    binding,
  };
}

/** Solves the District Training Plan. Never throws: bad input → "error", impossible constraints → "infeasible". */
export async function solveTrainingPlan(input: PlanInput, options: PlanOptions = {}): Promise<PlanResult> {
  let highs: HighsLike;
  try {
    highs = options.highs ?? (await loadHighs());
  } catch {
    return emptyResult(input, "error");
  }
  const timeLimit = options.timeLimitSeconds ?? 20;
  const base = solveCore(input, highs, timeLimit);
  if (base.result.status !== "optimal" || options.marginals === false) return base.result;

  const lang = options.lang ?? "en";
  const o = { lang, digits: options.digits };
  const mr = lang === "mr";
  const place = options.districtName;
  const marginals: PlanResult["marginals"] = [];
  const delta = (alt: PlanInput) => {
    const r = solveCore(alt, highs, timeLimit).result;
    return r.status === "optimal" ? Math.round((r.expectedPlacements - base.result.expectedPlacements) * 10) / 10 : 0;
  };
  // Marathi needs a different verb form when the change does nothing ("…मिळाल्यास" vs "…मिळाला तरी").
  const sentence = (d: number, en: string, mrIf: string, mrEvenIf: string) => {
    if (mr) {
      if (d >= 0.5) return `${mrIf} ${morePeople(d, "mr", options.digits)} नोकरी मिळू शकेल.`;
      if (d > 0.05) return `${mrEvenIf} नोकऱ्यांच्या संख्येत जवळजवळ फरक पडणार नाही.`;
      return `${mrEvenIf} नोकऱ्यांच्या संख्येत फरक पडणार नाही; अडचण दुसरीकडे आहे.`;
    }
    if (d >= 0.5) return `${en} would place ${morePeople(d, "en", options.digits)}.`;
    if (d > 0.05) return `${en} would make almost no difference to placements.`;
    return `${en} would not change placements; the limit is somewhere else.`;
  };

  for (const q of base.binding) {
    const alt: PlanInput = {
      ...input,
      trainerHoursAvailable: { ...input.trainerHoursAvailable, [q]: (input.trainerHoursAvailable[q] ?? 0) + input.hoursPerHiredTrainer },
    };
    const d = delta(alt);
    const mrLead = `${place ? `${mrLocative(place)} ` : ""}आणखी एक प्रमाणित ${q} प्रशिक्षक`;
    marginals.push({
      resource: `trainer:${q}`,
      deltaPlacements: d,
      sentence: sentence(d, `One more certified ${q} trainer${place ? ` in ${place}` : ""}`, `${mrLead} मिळाल्यास`, `${mrLead} मिळाला तरी`),
    });
  }
  {
    const d = delta({ ...input, capexBudget: input.capexBudget + 10 * LAKH });
    const mrLead = "उपकरणे आणि प्रशिक्षकांसाठी आणखी ₹10 लाख";
    marginals.push({
      resource: "capex+10L",
      deltaPlacements: d,
      sentence: sentence(d, "Another ₹10 lakh for equipment and trainers", `${mrLead} मिळाल्यास`, `${mrLead} मिळाले तरी`),
    });
  }
  {
    const extra = Math.round(input.seatBudget * 0.1);
    const d = delta({ ...input, seatBudget: input.seatBudget + extra });
    const mrLead = `10% अधिक जागा (आणखी ${formatIndian(extra, o)})`;
    marginals.push({
      resource: "seats+10%",
      deltaPlacements: d,
      sentence: sentence(d, `Allowing 10% more seats (${formatIndian(extra, o)} more)`, `${mrLead} दिल्यास`, `${mrLead} दिल्या तरी`),
    });
  }
  return { ...base.result, marginals };
}
