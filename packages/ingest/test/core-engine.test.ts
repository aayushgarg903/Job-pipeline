import { describe, expect, it } from "vitest";
import { computeCellsCore, computeCourseHealthCore, toSkillProfiles } from "../src/engine/core";
import type { EngineInput } from "../src/engine/types";

const base = (over: Partial<EngineInput> = {}): EngineInput => ({
  quarters: ["2026-Q2", "2026-Q3"], baseQuarter: "2026-Q2",
  districts: [{ lgd: "A", division: "D", population: 1_000_000 }, { lgd: "B", division: "D", population: 1_000_000 }],
  observations: [
    { kind: "udyam", lgd: "A", nco: "o1", quarter: "2026-Q2", n: 400, hires12m: 1000 },
    { kind: "udyam", lgd: "A", nco: "o1", quarter: "2026-Q3", n: 400, hires12m: 1200 },
  ],
  weights: { udyam: 0.4, postings: 0.25, surveys: 0.3, consultations: 0.05 },
  priorStrength: { udyam: 200, postings: 30, surveys: 10, consultations: 3 },
  profiles: [{ nco: "o1", skillId: "s1", weight: 0.5, proficiency: 2 }],
  supply: [{ lgd: "A", skillId: "s1", proficiency: 1, completers: 100, estimated: 0 }],
  occSupply: [{ lgd: "A", nco: "o1", completers: 100 }],
  spill: [{ from: "A", to: "A", share: 1 }, { from: "B", to: "B", share: 1 }],
  trainableNcos: ["o1"],
  ...over,
});

describe("core engine adapter", () => {
  const out = computeCellsCore(base());
  const cell = (lgd: string, q: string, p: number) => out.cells.find((c) => c.lgd === lgd && c.quarter === q && c.proficiency === p);

  it("expands a required level into cumulative profile entries", () => {
    expect(toSkillProfiles([{ nco: "o", skillId: "s", weight: 0.4, proficiency: 3 }]).o!.map((e) => e.proficiency)).toEqual([1, 2, 3]);
  });

  it("lets a district with no observations borrow its division's rate", () => {
    // Core's division rate is pooled over districts that observed the signal, so B (no data,
    // same population) inherits A's per-capita rate exactly.
    expect(cell("B", "2026-Q3", 1)!.demand).toBeGreaterThan(0);
    expect(cell("B", "2026-Q3", 1)!.demand).toBeCloseTo(cell("A", "2026-Q3", 1)!.demand, 3);
  });

  it("counts proficiency cumulatively and nets supply only where it is taught", () => {
    const a1 = cell("A", "2026-Q3", 1)!, a2 = cell("A", "2026-Q3", 2)!;
    expect(a1.demand).toBeCloseTo(a2.demand, 5);
    expect(a1.supply).toBe(100);
    expect(a2.supply).toBe(0);
    expect(a2.gap).toBeGreaterThan(a1.gap);
    expect(a1.ciLow).toBeLessThanOrEqual(a1.sdi);
    expect(a1.ciHigh).toBeGreaterThanOrEqual(a1.sdi);
  });

  it("keeps supply-only cells so surpluses are visible", () => {
    const o = computeCellsCore(base({ supply: [...base().supply, { lgd: "B", skillId: "s9", proficiency: 1, completers: 50, estimated: 50 }] }));
    const c = o.cells.find((x) => x.lgd === "B" && x.skillId === "s9" && x.quarter === "2026-Q3")!;
    expect(c.demand).toBe(0);
    expect(c.gap).toBe(-50);
    expect(o.supplyFacts.find((f) => f.lgd === "B" && f.skillId === "s9")!.estimatedShare).toBe(1);
  });

  it("level-calibrates postings to the Udyam anchor", () => {
    const withPosts = computeCellsCore(base({
      observations: [...base().observations, { kind: "postings", lgd: "B", nco: "o1", quarter: "2026-Q3", n: 5, hires12m: 20 }],
    }));
    const total = (o: typeof out, q: string) => o.occupationCells.filter((c) => c.quarter === q).reduce((s, c) => s + c.demand, 0);
    expect(total(withPosts, "2026-Q3")).toBeCloseTo(total(out, "2026-Q3"), 0);
  });

  it("computes Mismatch over trainable occupations only", () => {
    const o = computeCellsCore(base({
      profiles: [...base().profiles, { nco: "o2", skillId: "s2", weight: 1, proficiency: 1 }],
      observations: [...base().observations, { kind: "udyam", lgd: "A", nco: "o2", quarter: "2026-Q3", n: 400, hires12m: 5000 }],
    }));
    const m = (x: typeof out) => x.districtMetrics.find((d) => d.lgd === "A" && d.quarter === "2026-Q3")!.mismatch;
    expect(m(o)).toBeCloseTo(m(out), 6); // o2 is not trainable, so it moves nothing
  });

  it("scores course health through core", () => {
    const [h] = computeCourseHealthCore({
      quarter: "2026-Q3", prevQuarter: "2026-Q2", profiles: base().profiles, cells: out.cells, occupationCells: out.occupationCells,
      labels: { s1: "Skill one" }, spill: base().spill, districtNames: { A: "Alpha" },
      courses: [{ id: "c1", lgd: "A", code: "T", targetNco: "o1", skills: [{ skillId: "s1", proficiency: 1, hours: 100, assessed: true }],
        cohort: { enrolled: 20, completed: 18, placed6m: 9 }, endorsements: 1, changeRequests: 0 }],
    });
    expect(h!.relevance).toBe(0); // taught at 1, required at 2 → no credit (core)
    expect(h!.flags).toContain("REVISE");
    expect(h!.missingSkills).toEqual(["s1"]);
    expect(h!.explain.join(" ")).toContain("Alpha");
  });
});
