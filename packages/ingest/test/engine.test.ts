import { describe, expect, it } from "vitest";
import { computeCells } from "../src/engine/cells";
import { benjaminiHochberg, mannKendallDecreasingP, theilSen } from "../src/engine/health";
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
  ...over,
});

describe("computeCells (local engine)", () => {
  const out = computeCells(base());
  const cell = (lgd: string, q: string, p: number) => out.cells.find((c) => c.lgd === lgd && c.quarter === q && c.proficiency === p);

  it("shrinks a thin district toward its division, conserving nothing it shouldn't", () => {
    // B has no observations, so it borrows the division rate; A keeps most of its own.
    expect(cell("B", "2026-Q3", 1)!.demand).toBeGreaterThan(0);
    expect(cell("A", "2026-Q3", 1)!.demand).toBeGreaterThan(cell("B", "2026-Q3", 1)!.demand);
  });

  it("counts proficiency cumulatively and nets supply only where it is taught", () => {
    const a1 = cell("A", "2026-Q3", 1)!, a2 = cell("A", "2026-Q3", 2)!;
    expect(a1.demand).toBeCloseTo(a2.demand, 5); // required level 2 → counted at ≥1 and ≥2
    expect(a1.supply).toBe(100);
    expect(a2.supply).toBe(0); // taught only to level 1
    expect(a2.gap).toBeGreaterThan(a1.gap);
  });

  it("indexes SDI to the base-quarter state average and reports coverage in 0..1", () => {
    const avgBase = (cell("A", "2026-Q2", 1)!.demand + cell("B", "2026-Q2", 1)!.demand) / 2;
    expect(cell("A", "2026-Q2", 1)!.sdi).toBeCloseTo((100 * cell("A", "2026-Q2", 1)!.demand) / avgBase, 0);
    for (const m of out.districtMetrics) {
      expect(m.coverage).toBeGreaterThanOrEqual(0);
      expect(m.coverage).toBeLessThanOrEqual(1);
    }
    expect(out.districtMetrics.find((m) => m.lgd === "A")!.coverage).toBeGreaterThan(out.districtMetrics.find((m) => m.lgd === "B")!.coverage);
  });

  it("level-calibrates postings to the Udyam anchor", () => {
    const withPosts = computeCells(base({
      observations: [...base().observations, { kind: "postings", lgd: "B", nco: "o1", quarter: "2026-Q3", n: 5, hires12m: 20 }],
    }));
    const total = (o: typeof out, q: string) => o.occupationCells.filter((c) => c.quarter === q).reduce((s, c) => s + c.demand, 0);
    expect(total(withPosts, "2026-Q3")).toBeCloseTo(total(out, "2026-Q3"), 0);
  });
});

describe("trend statistics", () => {
  it("Theil–Sen and Mann–Kendall detect a decline", () => {
    const ys = [10, 9, 8.5, 8, 7, 6.5, 6, 5];
    expect(theilSen(ys)).toBeLessThan(0);
    expect(mannKendallDecreasingP(ys)).toBeLessThan(0.01);
    expect(mannKendallDecreasingP([1, 2, 3, 4, 5, 6])).toBeGreaterThan(0.9);
  });
  it("Benjamini–Hochberg keeps only the discoveries", () => {
    const s = benjaminiHochberg([{ id: "a", p: 0.001 }, { id: "b", p: 0.02 }, { id: "c", p: 0.5 }, { id: "d", p: 0.9 }], 0.1);
    expect([...s].sort()).toEqual(["a", "b"]);
  });
});
