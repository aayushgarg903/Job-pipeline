import { describe, expect, it } from "vitest";
import type { SignalObservation } from "@ks/contracts";
import {
  DEFAULT_WEIGHTS,
  buildDemandCells,
  buildSupply,
  computeDemand,
  coverage,
  createRng,
  estimatePriorStrength,
  mismatchIndex,
  normaliseSpillover,
  shrinkHierarchy,
  shrinkToward,
  spilloverRowError,
  DEFAULT_PRIOR_STRENGTH,
} from "../src/index";
import type { Course } from "@ks/contracts";

const divisionOf = { "516": "Nashik", "517": "Nashik", "518": "Nashik", "490": "Pune", "491": "Pune" };
const profiles = {
  "7411": [
    { skillId: "solar-pv", proficiency: 2 as const, prob: 0.6 },
    { skillId: "wiring", proficiency: 1 as const, prob: 0.9 },
  ],
  "7233": [{ skillId: "wiring", proficiency: 1 as const, prob: 0.3 }],
};

function obs(lgd: string, nco: string, kind: SignalObservation["kind"], n: number, hires: number, quarter = "2027-Q1"): SignalObservation {
  return { kind, lgd, nco, quarter, n, hires12m: hires };
}

const baseObs: SignalObservation[] = [
  obs("516", "7411", "postings", 40, 120), obs("517", "7411", "postings", 5, 10), obs("490", "7411", "postings", 200, 400),
  obs("491", "7411", "postings", 20, 60), obs("516", "7411", "surveys", 6, 90), obs("490", "7411", "surveys", 12, 300),
  obs("516", "7411", "udyam", 30, 50), obs("518", "7411", "udyam", 10, 12), obs("490", "7411", "udyam", 80, 140),
  obs("516", "7233", "postings", 12, 30), obs("490", "7233", "postings", 30, 50),
  // base quarter, fixed
  obs("516", "7411", "postings", 30, 100, "2026-Q4"), obs("490", "7411", "postings", 150, 300, "2026-Q4"),
  obs("516", "7233", "postings", 10, 25, "2026-Q4"),
];

describe("shrinkage", () => {
  it("DEFAULT_WEIGHTS sum to 1", () => {
    expect(Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it("stays between the local and parent values (property)", () => {
    const rng = createRng(1, "shrink");
    for (let i = 0; i < 2000; i++) {
      const n = Math.floor(rng.uniform() * 200);
      const local = rng.uniform() * 1000;
      const parent = rng.uniform() * 1000;
      const m = 0.5 + rng.uniform() * 100;
      const r = shrinkToward({ n, value: local }, parent, m);
      expect(r).toBeGreaterThanOrEqual(Math.min(local, parent) - 1e-9);
      expect(r).toBeLessThanOrEqual(Math.max(local, parent) + 1e-9);
      const h = shrinkHierarchy({ district: { n, value: local }, division: { n: n * 3, value: parent }, state: 500 }, m);
      expect(h.district).toBeGreaterThanOrEqual(Math.min(local, parent, 500) - 1e-9);
      expect(h.district).toBeLessThanOrEqual(Math.max(local, parent, 500) + 1e-9);
    }
    expect(shrinkToward({ n: 0, value: 999 }, 5, 10)).toBe(5);
  });

  it("coverage is in [0,1] (property)", () => {
    const rng = createRng(2, "cov");
    for (let i = 0; i < 1000; i++) {
      const n = { postings: rng.uniform() * 500, surveys: rng.uniform() * 20, consultations: Math.floor(rng.uniform() * 4), udyam: rng.uniform() * 100 };
      const c = coverage(n, DEFAULT_PRIOR_STRENGTH, DEFAULT_WEIGHTS);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
    expect(coverage({}, DEFAULT_PRIOR_STRENGTH, DEFAULT_WEIGHTS)).toBe(0);
  });

  it("method-of-moments recovers m roughly from simulated data", () => {
    const rng = createRng(3, "mom");
    const tau = 2;
    const sigma = 10; // → true m = σ²/τ² = 25
    const units = Array.from({ length: 400 }, () => {
      const n = 1 + Math.floor(rng.uniform() * 80);
      const theta = 50 + tau * rng.normal();
      return { n, value: theta + (sigma / Math.sqrt(n)) * rng.normal(), parent: 50 };
    });
    const fit = estimatePriorStrength(units, 99);
    expect(fit.fitted).toBe(true);
    expect(fit.m).toBeGreaterThan(10);
    expect(fit.m).toBeLessThan(60);
    expect(estimatePriorStrength([{ n: 3, value: 1 }], 7).m).toBe(7);
  });
});

describe("SDI", () => {
  const run = (o: SignalObservation[]) => computeDemand(o, divisionOf, profiles, { bootstrap: 200, seed: 7 });

  it("is deterministic for a fixed seed", () => {
    expect(run(baseObs)).toEqual(run(baseObs));
  });

  it("estimates every district, including ones with no data (borrowed from the division)", () => {
    const r = run(baseObs);
    const q1 = r.hires.filter((h) => h.quarter === "2027-Q1" && h.nco === "7411");
    expect(q1.map((h) => h.lgd).sort()).toEqual(Object.keys(divisionOf).sort());
    const d518 = q1.find((h) => h.lgd === "518");
    expect(d518 && d518.hires).toBeGreaterThan(0);
    for (const h of r.hires) {
      expect(h.coverage).toBeGreaterThanOrEqual(0);
      expect(h.coverage).toBeLessThanOrEqual(1);
      expect(h.ciLow).toBeLessThanOrEqual(h.ciHigh);
    }
  });

  it("is monotonic in demand (property)", () => {
    const pick = (res: ReturnType<typeof run>) =>
      res.skills.find((s) => s.lgd === "516" && s.skillId === "solar-pv" && s.quarter === "2027-Q1")?.sdi ?? NaN;
    let prev = pick(run(baseObs));
    for (const bump of [10, 40, 100, 400]) {
      const o = baseObs.map((x) => (x.lgd === "516" && x.nco === "7411" && x.quarter === "2027-Q1" && x.kind === "postings" ? { ...x, hires12m: x.hires12m + bump } : x));
      const next = pick(run(o));
      expect(next).toBeGreaterThan(prev);
      prev = next;
    }
  });

  it("SDI is 100 at the state per-district mean of the base quarter", () => {
    const r = run(baseObs);
    const base = r.skills.filter((s) => s.quarter === "2026-Q4" && s.skillId === "wiring" && s.proficiency === 1);
    const mean = base.reduce((a, s) => a + s.sdi, 0) / Object.keys(divisionOf).length;
    expect(mean).toBeCloseTo(100, 6);
    for (const s of r.skills) {
      expect(s.ciLow).toBeLessThanOrEqual(s.ciHigh);
      expect(s.baseQuarter).toBe("2026-Q4");
    }
  });
});

describe("supply, gap and mismatch", () => {
  const course = (id: string, lgd: string, seats: number, nco: string, skills: Course["skills"]): Course => ({
    id, institutionId: "i", institutionName: "ITI", lgd, name: id, code: id, kind: "ITI", targetNco: nco,
    seats, durationHours: 400, skills, isDemo: true,
  });
  const courses = [
    course("elec-516", "516", 100, "7411", [{ skillId: "wiring", proficiency: 2, hours: 100, assessed: true }]),
    course("solar-490", "490", 40, "7411", [{ skillId: "solar-pv", proficiency: 3, hours: 80, assessed: true }]),
  ];

  it("normalises the spill-over matrix so rows sum to 1", () => {
    const M = normaliseSpillover({ "490": { "490": 3, "516": 1 } }, ["516"]);
    expect(spilloverRowError(M)).toBeLessThan(1e-12);
    expect(M["516"]).toEqual({ "516": 1 });
  });

  it("counts completers × teaches(≥p) through M", () => {
    const s = buildSupply(courses, { completion: 0.5, spillover: { "490": { "490": 0.75, "516": 0.25 } } });
    expect(s.skill("516", "wiring", 1)).toBeCloseTo(50);
    expect(s.skill("516", "wiring", 3)).toBe(0); // taught only to level 2
    expect(s.skill("516", "solar-pv", 2)).toBeCloseTo(5); // 40·0.5·0.25
    expect(s.skill("490", "solar-pv", 3)).toBeCloseTo(15);
    expect(s.occupation("516", "7411")).toBeCloseTo(55);
  });

  it("builds DemandCells and a people-counted mismatch index", () => {
    const d = computeDemand(baseObs, divisionOf, profiles, { bootstrap: 50 });
    const s = buildSupply(courses, { completion: 0.8 });
    const cells = buildDemandCells(d.skills, s);
    for (const c of cells) {
      expect(c.gap).toBeCloseTo(c.demand - c.supply);
      expect(c.ratio).toBeCloseTo(c.demand / Math.max(c.supply, 1));
    }
    const mm = mismatchIndex(d.hires, s, "516", "2027-Q1");
    const byHand = mm.occupations.reduce((a, o) => a + Math.abs(o.demand - o.supply), 0) / mm.totalDemand;
    expect(mm.mismatch).toBeCloseTo(byHand);
    expect(mm.occupations.length).toBe(2); // one row per occupation, not per skill
  });
});
