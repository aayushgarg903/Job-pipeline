import { describe, expect, it } from "vitest";
import type { Course } from "@ks/contracts";
import {
  benjaminiHochberg,
  courseHealth,
  createRng,
  detectDecliningSkills,
  generateCurriculumPr,
  mannKendall,
  outcomesScore,
  quarterFromIndex,
  theilSen,
  validationScore,
  HOURS_TOLERANCE,
} from "../src/index";

const quarters = (n: number, start = 2024 * 4) => Array.from({ length: n }, (_, i) => quarterFromIndex(start + i));

describe("trend statistics", () => {
  it("Theil–Sen ignores a single outlier", () => {
    const xs = [0, 1, 2, 3, 4, 5, 6];
    const ys = xs.map((x) => 10 - 2 * x);
    ys[3] = 500;
    expect(theilSen(xs, ys)).toBeCloseTo(-2);
  });

  it("Mann–Kendall: a strict decline of 8 points has exact p = 1/8!", () => {
    const r = mannKendall([8, 7, 6, 5, 4, 3, 2, 1]);
    expect(r.exact).toBe(true);
    expect(r.pDecreasing).toBeCloseTo(1 / 40320, 10);
    expect(mannKendall([1, 2, 3, 4, 5, 6]).pDecreasing).toBeCloseTo(1, 10);
  });

  it("BH q-values are monotone in p and ≥ p", () => {
    const p = [0.01, 0.04, 0.03, 0.5, 0.2];
    const q = benjaminiHochberg(p);
    p.forEach((pi, i) => expect(q[i]).toBeGreaterThanOrEqual(pi));
    expect(q[0]).toBeCloseTo(0.05);
  });

  it("BH keeps false flags low on 300 pure-noise flat series", () => {
    const rng = createRng(42, "noise");
    const qs = quarters(10);
    const series: Record<string, Array<{ quarter: string; value: number }>> = {};
    for (let i = 0; i < 300; i++) series[`s${i}`] = qs.map((quarter) => ({ quarter, value: 100 + 10 * rng.normal() }));
    const { tests, declining } = detectDecliningSkills(series);
    expect(tests.length).toBe(300);
    expect(declining.length / 300).toBeLessThanOrEqual(0.1);
    // Without FDR control, raw p < 0.1 would flag roughly 10% of these (one-sided).
    const rawFlags = tests.filter((t) => t.pValue < 0.1 && t.slope < 0).length;
    expect(declining.length).toBeLessThan(rawFlags);
  });

  it("flags a real, sustained decline among noise, and needs ≥ 6 quarters", () => {
    const rng = createRng(9, "mix");
    const qs = quarters(10);
    const series: Record<string, Array<{ quarter: string; value: number }>> = {};
    for (let i = 0; i < 50; i++) series[`noise${i}`] = qs.map((quarter) => ({ quarter, value: 100 + 5 * rng.normal() }));
    series["cobol"] = qs.map((quarter, i) => ({ quarter, value: 120 - 8 * i + rng.normal() }));
    series["short"] = qs.slice(0, 5).map((quarter, i) => ({ quarter, value: 100 - 10 * i }));
    const { declining, tests } = detectDecliningSkills(series);
    expect(declining).toContain("cobol");
    expect(tests.find((t) => t.skillId === "short")).toBeUndefined();
  });
});

const course: Course = {
  id: "iti-nsk-elec", institutionId: "iti-nsk", institutionName: "Govt ITI Nashik", lgd: "516",
  name: "Electrician", code: "ELEC", kind: "ITI", targetNco: "7411", seats: 60, durationHours: 400,
  skills: [
    { skillId: "wiring", proficiency: 3, hours: 150, assessed: true },
    { skillId: "motor-rewinding", proficiency: 2, hours: 120, assessed: true },
    { skillId: "safety", proficiency: 2, hours: 60, assessed: false },
    { skillId: "plc-basics", proficiency: 1, hours: 70, assessed: true },
  ],
  isDemo: true,
};
const target = [
  { skillId: "wiring", proficiency: 2 as const, demand: 140, mustHave: true },
  { skillId: "solar-pv", proficiency: 2 as const, demand: 120, mustHave: true },
  { skillId: "safety", proficiency: 2 as const, demand: 130, mustHave: true },
  { skillId: "plc-basics", proficiency: 2 as const, demand: 60, mustHave: true },
  { skillId: "smart-meters", proficiency: 1 as const, demand: 40, mustHave: true },
];

describe("course health", () => {
  it("components are 0–100 and the total uses 35/30/15/20", () => {
    const h = courseHealth({
      course, quarter: "2027-Q1", districtName: "Nashik", targetSkills: target,
      cohort: { completed: 40, placed6m: 22 }, stateMedianPlacement: 0.45,
      declining: ["motor-rewinding"], endorsements: 3, changeRequests: 1,
      skillLabels: { "solar-pv": "solar PV installation" },
    });
    for (const k of ["relevance", "outcomes", "currency", "validation", "total"] as const) {
      expect(h[k]).toBeGreaterThanOrEqual(0);
      expect(h[k]).toBeLessThanOrEqual(100);
    }
    expect(h.total).toBeCloseTo((35 * h.relevance + 30 * h.outcomes + 15 * h.currency + 20 * h.validation) / 100, 0);
    expect(h.currency).toBeCloseTo(70); // 120 of 400 hours declining
    expect(h.missingSkills).toEqual(["solar-pv", "plc-basics", "smart-meters"]); // plc taught only at level 1
    expect(h.decliningSkills).toEqual(["motor-rewinding"]);
    expect(h.unassessedSkills).toEqual(["safety"]);
    expect(h.explain[0]).toBe("Teaches 2 of the 5 skills Nashik employers call must-haves.");
    expect(h.explain.join(" ")).toContain("about 120 people");
    expect(h.relevance).toBeCloseTo(55.1, 1); // (140 + 130) / 490 people-weighted
    expect(h.flags).toEqual(["HEALTHY"]);
    const revise = courseHealth({ course, quarter: "q", districtName: "Nashik", targetSkills: target.filter((t) => t.skillId !== "safety") });
    expect(revise.flags).toEqual(["REVISE"]);
  });

  it("flags OBSOLETE, OVERSUPPLIED and HEALTHY per the thresholds", () => {
    const obsolete = courseHealth({ course, quarter: "q", districtName: "Nashik", targetSkills: target, declining: ["wiring", "motor-rewinding"] });
    expect(obsolete.flags).toContain("OBSOLETE");
    const over = courseHealth({ course, quarter: "q", districtName: "Nashik", targetSkills: [], occupationRatioHistory: [0.9, 0.5, 0.4], occupationDemand: 30, occupationSupply: 80 });
    expect(over.flags).toEqual(["OVERSUPPLIED"]);
    const once = courseHealth({ course, quarter: "q", districtName: "Nashik", targetSkills: [], occupationRatioHistory: [0.5, 0.9] });
    expect(once.flags).toEqual(["HEALTHY"]);
  });

  it("Beta-binomial shrinkage pulls small cohorts toward the median", () => {
    const small = outcomesScore({ completed: 3, placed6m: 3 }, 0.4);
    const big = outcomesScore({ completed: 300, placed6m: 300 }, 0.4);
    expect(small.score).toBeLessThan(big.score);
    expect(outcomesScore({ completed: 100, placed6m: 40 }, 0.4).score).toBeCloseTo(50);
    expect(validationScore()).toBe(50);
    expect(validationScore(4, 0)).toBeGreaterThan(50);
  });

  it("writes Marathi explanations", () => {
    const h = courseHealth({ course, quarter: "q", districtName: "नाशिक", targetSkills: target, lang: "mr" });
    expect(h.explain[0]).toBe("नाशिकमधील कंपन्या अत्यावश्यक मानतात अशा 5 पैकी 2 कौशल्ये हा अभ्यासक्रम शिकवतो.");
  });
});

describe("curriculum PR", () => {
  const health = courseHealth({ course, quarter: "2027-Q1", districtName: "Nashik", targetSkills: target, declining: ["motor-rewinding"] });
  const base = {
    course, health, qpBudgetHours: 400, targetSkills: target, districtName: "Nashik", openedAt: "2027-01-15T00:00:00Z",
    supplyBySkill: { "solar-pv": 35 },
    requirements: {
      "solar-pv": { hours: 60, module: "Solar PV installation", trainerQualification: "Solar PV Installer (QP SGJ/Q0101)", equipment: [{ item: "PV training kit", qty: 4 }] },
      "smart-meters": { hours: 30, equipment: [{ item: "Smart meter bench", qty: 2 }] },
    },
    equipmentStock: { "PV training kit": 1 },
  };

  it("keeps total hours within ±10% of the QP budget and explains each line with a number", () => {
    const pr = generateCurriculumPr(base);
    const total = pr.diff.reduce((a, d) => a + d.hoursAfter, 0);
    expect(total).toBeGreaterThanOrEqual(400 * (1 - HOURS_TOLERANCE));
    expect(total).toBeLessThanOrEqual(400 * (1 + HOURS_TOLERANCE));
    const add = pr.diff.find((d) => d.skillId === "solar-pv");
    expect(add?.op).toBe("add");
    expect(add?.reason).toBe("About 120 people in Nashik will need solar-pv next year; courses here train only about 35 in it.");
    for (const d of pr.diff) expect(d.reason).toMatch(/\d/);
    expect(pr.diff.find((d) => d.skillId === "motor-rewinding")?.op).toBe("drop");
    expect(pr.target).toBe("recommendation"); // NCVT trade with a drop → DGT recommendation
    expect(pr.trainerDelta).toEqual([{ qualification: "Solar PV Installer (QP SGJ/Q0101)", count: 1 }]);
    expect(pr.equipmentDelta).toEqual([{ item: "PV training kit", qty: 3 }, { item: "Smart meter bench", qty: 2 }]);
    expect(pr.status).toBe("draft");
  });

  it("chooses the target from the course kind", () => {
    const addOnly = generateCurriculumPr({ ...base, health: { ...health, decliningSkills: [] }, qpBudgetHours: 480 });
    expect(addOnly.diff.every((d) => d.op === "add" || d.op === "keep")).toBe(true);
    expect(addOnly.target).toBe("add-on-module");
    const state = generateCurriculumPr({ ...base, course: { ...course, kind: "state" } });
    expect(state.target).toBe("state-course");
  });
});
