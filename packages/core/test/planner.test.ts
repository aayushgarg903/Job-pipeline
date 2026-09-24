import { describe, expect, it } from "vitest";
import type { PlanInput, PlanResult } from "@ks/contracts";
import { buildPlanLp, solveTrainingPlan, STABILITY } from "../src/index";

const course = (over: Partial<PlanInput["courses"][number]> & { courseId: string }): PlanInput["courses"][number] => ({
  name: over.courseId, isNew: false, seatsPrev: 0, batchSize: 20, maxBatches: 4, completionRate: 0.8,
  placementProb: 0.5, wage: 14000, trainerQualification: "Fitter", trainerHoursPerBatch: 800,
  equipmentSets: 0, equipmentCostPerSet: 300000, teaches: [], ...over,
});

/** Toy Nashik: fitter seats are oversupplied, solar is undersupplied, EV is a promising new course, tailoring is not. */
const nashik: PlanInput = {
  lgd: "516",
  fy: "FY27",
  seatBudget: 300,
  capexBudget: 40 * 1e5,
  trainerHoursAvailable: { Fitter: 8000, Electrician: 1600, "EV Technician": 0, Tailor: 0 },
  trainerHireCost: { Fitter: 4e5, Electrician: 5e5, "EV Technician": 6e5, Tailor: 3e5 },
  hoursPerHiredTrainer: 1600,
  demandBySkill: { fitting: 60, "solar-pv": 150, "ev-service": 60, sewing: 5 },
  medianWage: 14000,
  courses: [
    course({ courseId: "fitter", name: "Fitter", seatsPrev: 200, maxBatches: 12, placementProb: 0.25, wage: 12000, equipmentSets: 12, equipmentCostPerSet: 2e5, teaches: ["fitting"] }),
    course({ courseId: "solar", name: "Solar Technician", seatsPrev: 40, completionRate: 0.85, placementProb: 0.8, wage: 16000, trainerQualification: "Electrician", equipmentSets: 2, teaches: ["solar-pv"] }),
    course({ courseId: "ev", name: "EV Service Technician", isNew: true, maxBatches: 2, placementProb: 0.75, wage: 18000, trainerQualification: "EV Technician", equipmentCostPerSet: 4e5, teaches: ["ev-service"] }),
    course({ courseId: "tailor", name: "Sewing Machine Operator", isNew: true, maxBatches: 2, placementProb: 0.1, wage: 9000, trainerQualification: "Tailor", equipmentCostPerSet: 1e5, teaches: ["sewing"] }),
  ],
};

function checkConstraints(input: PlanInput, r: PlanResult) {
  const byId = new Map(r.rows.map((row) => [row.courseId, row]));
  let seats = 0;
  let capex = 0;
  const hours = new Map<string, number>();
  for (const c of input.courses) {
    const row = byId.get(c.courseId);
    expect(row).toBeDefined();
    if (!row) continue;
    seats += row.seats;
    expect(row.seats).toBeLessThanOrEqual(c.batchSize * row.batches);
    expect(row.batches).toBeLessThanOrEqual(c.maxBatches);
    expect(row.batches).toBe(Math.ceil(row.seats / c.batchSize)); // no idle batches
    if (c.isNew && !row.opened) expect(row.batches).toBe(0);
    const bought = r.equipmentToBuy[c.courseId] ?? 0;
    expect(row.batches).toBeLessThanOrEqual(c.equipmentSets + bought);
    capex += bought * c.equipmentCostPerSet;
    hours.set(c.trainerQualification, (hours.get(c.trainerQualification) ?? 0) + row.batches * c.trainerHoursPerBatch);
    if (!c.isNew && c.seatsPrev > 0) {
      expect(row.seats).toBeGreaterThanOrEqual(STABILITY.down * c.seatsPrev - 1e-6);
      expect(row.seats).toBeLessThanOrEqual(STABILITY.up * c.seatsPrev + 1e-6);
    }
  }
  expect(seats).toBeLessThanOrEqual(input.seatBudget);
  for (const [q, used] of hours) {
    const t = r.trainersToHire[q] ?? 0;
    capex += t * (input.trainerHireCost[q] ?? 0);
    expect(used).toBeLessThanOrEqual((input.trainerHoursAvailable[q] ?? 0) + input.hoursPerHiredTrainer * t + 1e-6);
  }
  expect(capex).toBeLessThanOrEqual(input.capexBudget + 1e-6);
  expect(r.capexUsed).toBeCloseTo(capex);
}

describe("district training plan (HiGHS MIP)", () => {
  it("writes a CPLEX-LP model with the §6.6 variables", () => {
    const { lp } = buildPlanLp(nashik);
    expect(lp.startsWith("Maximize")).toBe(true);
    for (const v of ["b0", "x0", "e0", "y2", "t0", "o0"]) expect(lp).toContain(v);
    expect(lp).not.toContain("y0"); // existing courses have no open/close variable
    expect(lp).toMatch(/Binary\n y2 y3/);
  });

  it("shifts seats from the oversupplied course to the undersupplied one (toy Nashik)", async () => {
    const r = await solveTrainingPlan(nashik, { districtName: "Nashik" });
    expect(r.status).toBe("optimal");
    const seats = Object.fromEntries(r.rows.map((row) => [row.courseId, row.seats]));
    expect(seats.fitter).toBeLessThan(200);
    expect(seats.fitter).toBe(140); // down to the stability floor
    expect(seats.solar).toBeGreaterThan(40);
    expect(r.trainersToHire.Electrician).toBeGreaterThanOrEqual(1);
    expect(r.expectedPlacements).toBeGreaterThan(0);
    checkConstraints(nashik, r);
  });

  it("respects every constraint and opens a new course only when it's worth it", async () => {
    const r = await solveTrainingPlan(nashik);
    checkConstraints(nashik, r);
    const rows = Object.fromEntries(r.rows.map((row) => [row.courseId, row]));
    expect(rows.ev?.opened).toBe(true);
    expect(rows.tailor?.opened).toBe(false);
    expect(rows.tailor?.seats).toBe(0);
    // Make EV unaffordable: it must stay closed and nothing is bought for it.
    const poor = { ...nashik, capexBudget: 5e5 };
    const r2 = await solveTrainingPlan(poor);
    expect(r2.status).toBe("optimal");
    checkConstraints(poor, r2);
    expect(r2.rows.find((row) => row.courseId === "ev")?.opened).toBe(false);
  });

  it("reports marginal re-solves with human sentences", async () => {
    const r = await solveTrainingPlan(nashik, { districtName: "Nashik" });
    const resources = r.marginals.map((m) => m.resource);
    expect(resources).toContain("capex+10L");
    expect(resources).toContain("seats+10%");
    for (const m of r.marginals) {
      expect(m.sentence.length).toBeGreaterThan(20);
      expect(m.sentence.endsWith(".")).toBe(true);
    }
    const mr = await solveTrainingPlan(nashik, { districtName: "नाशिक", lang: "mr" });
    expect(mr.marginals.some((m) => /[ऀ-ॿ]/.test(m.sentence))).toBe(true);
  });

  it("returns status infeasible (not a throw) for impossible inputs", async () => {
    const r = await solveTrainingPlan({ ...nashik, seatBudget: 100 }); // fitter alone needs ≥ 140
    expect(r.status).toBe("infeasible");
    expect(r.marginals).toEqual([]);
    const bad = await solveTrainingPlan({ ...nashik, seatBudget: Number.NaN });
    expect(bad.status).toBe("error");
  });
});
