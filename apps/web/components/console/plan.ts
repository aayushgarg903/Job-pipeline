// Training-plan solve (Architecture §6.6). HiGHS runs in Node (`highs` is a server external
// package). The solve is deterministic, so it is cached per (district, FY, knobs, language).
import type { Lang, PlanInput, PlanResult } from "@ks/contracts";
import { DEFAULT_PLAN_PARAMS, solveTrainingPlan } from "@ks/core";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { getReaders } from "@/lib/readers";

export const LAKH = 1e5;
export const LAMBDA_RANGE = { min: 0, max: 2, step: 0.1 } as const;

/** Knobs an officer can change (capex in ₹ lakh). Missing or out-of-range values fall back to the stored input. */
export const PlanKnobs = z.object({
  seats: z.coerce.number().int().min(0).max(100_000).optional().catch(undefined),
  capex: z.coerce.number().min(0).max(100_000).optional().catch(undefined),
  lambda: z.coerce.number().min(LAMBDA_RANGE.min).max(LAMBDA_RANGE.max).optional().catch(undefined),
});
export type PlanKnobs = z.infer<typeof PlanKnobs>;

export function parseKnobs(sp: Record<string, string | string[] | undefined>): PlanKnobs {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  return PlanKnobs.parse({ seats: one(sp.seats), capex: one(sp.capex), lambda: one(sp.lambda) });
}

export function applyKnobs(input: PlanInput, k: PlanKnobs): PlanInput {
  return {
    ...input,
    seatBudget: k.seats ?? input.seatBudget,
    capexBudget: k.capex !== undefined ? Math.round(k.capex * LAKH) : input.capexBudget,
    params: { ...input.params, lambda: k.lambda ?? input.params?.lambda ?? DEFAULT_PLAN_PARAMS.lambda },
  };
}

export const lambdaOf = (input: PlanInput) => input.params?.lambda ?? DEFAULT_PLAN_PARAMS.lambda;

export interface SolvedPlan {
  input: PlanInput;
  result: PlanResult;
}

/** Loads the plan input and solves it. null when the district has no plan input for that FY. */
export async function solvePlan(
  lgd: string, fy: string, seats: number | null, capex: number | null, lambda: number | null, lang: Lang, districtName: string,
): Promise<SolvedPlan | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(`district:${lgd}`, `plan:${lgd}:${fy}`);
  const r = await getReaders();
  const raw = await r.planInput(lgd, fy);
  if (!raw) return null;
  const input = applyKnobs(raw, { seats: seats ?? undefined, capex: capex ?? undefined, lambda: lambda ?? undefined });
  const result = await solveTrainingPlan(input, { lang, districtName });
  return { input, result };
}

/** Totals used by the page, the narrative and the PDF. */
export function planTotals(input: PlanInput, result: PlanResult) {
  const seatsPrev = result.rows.reduce((s, r) => s + r.seatsPrev, 0);
  const seats = result.rows.reduce((s, r) => s + r.seats, 0);
  const trainers = Object.values(result.trainersToHire).reduce((s, n) => s + n, 0);
  const moved = result.rows.reduce((s, r) => s + Math.max(0, r.seats - r.seatsPrev), 0);
  const equipment = Object.entries(result.equipmentToBuy)
    .filter(([, sets]) => sets > 0)
    .map(([courseId, sets]) => {
      const c = input.courses.find((x) => x.courseId === courseId);
      return { courseId, name: c?.name ?? courseId, sets, cost: sets * (c?.equipmentCostPerSet ?? 0) };
    });
  return { seatsPrev, seats, trainers, moved, equipment };
}
