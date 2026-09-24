import { describe, expect, it } from "vitest";
import { checkProse, extractNumbers, marketingWords, ungroundedNumbers } from "../src/grounding";
import { narrateDetailed } from "../src/narrate";
import { templateNarrate } from "../src/templates";
import { apiError, scriptedModels, testRouter } from "./helpers";

const facts = {
  course: "Electrician (NCVT)", district: "Nashik", skill: "solar PV installation",
  demand: 140, supply: 35, employers: 14, postings: 212, hoursAdded: 60,
  dropSkill: "DC generator repair", hoursDropped: 48, quarter: "2026-Q3",
};

describe("number grounding", () => {
  it("reads Western, Indian and Devanagari numerals and skips identifiers", () => {
    expect(extractNumbers("About 1,200 people; ₹1,20,000 budget; १४० जागा; 2026-Q3; NSQF4")).toEqual([1200, 120000, 140, 2026]);
    expect(extractNumbers("0.31 and 12.5")).toEqual([0.31, 12.5]);
  });
  it("accepts numbers from the facts, including roundings and lakh forms", () => {
    expect(ungroundedNumbers("About 140 people could be hired and 35 will be trained.", facts)).toEqual([]);
    expect(ungroundedNumbers("That is 105 people short.", facts)).toEqual([105]); // a derived number is rejected
    expect(ungroundedNumbers("It costs ₹12.5 lakh.", { capex: 1_250_000 })).toEqual([]);
    expect(ungroundedNumbers("A 31% gap.", { mismatch: 0.31 })).toEqual([]);
    expect(ungroundedNumbers("नाशिकमध्ये सुमारे १४० लोक.", facts)).toEqual([]);
  });
  it("finds marketing words", () => {
    expect(marketingWords("This will unlock insights and leverage data.")).toEqual(["unlock", "leverage", "insights"]);
    expect(marketingWords("About 140 people could be hired.")).toEqual([]);
  });
  it("checkProse trims to 4 sentences and fails on 1", () => {
    const five = "One 140. Two 35. Three 14. Four 60. Five 48.";
    expect(checkProse(five, facts)).toMatchObject({ ok: true, text: "One 140. Two 35. Three 14. Four 60." });
    expect(checkProse("Only one sentence about 140 people.", facts).ok).toBe(false);
  });
});

describe("narrate with a mocked model", () => {
  const good = "About 140 people in Nashik could be hired for solar PV installation next year, and local courses will train about 35. 14 employers told us it is a must-have. Share this with the ITI principal.";
  const invented = "About 140 people could be hired, which is 105 more than we train. Share it with the principal.";
  const input = { kind: "pr-rationale" as const, facts, lang: "en" as const };

  it("returns a grounded first draft as-is", async () => {
    const { factory, calls } = scriptedModels({ m: [good] });
    const out = await narrateDetailed({ router: testRouter(["m"]), modelFactory: factory }, input);
    expect(out).toMatchObject({ source: "model", model: "m", text: good });
    expect(calls).toHaveLength(1);
  });

  it("regenerates once when a number is not in the facts", async () => {
    const { factory, calls } = scriptedModels({ m: [invented, good] });
    const out = await narrateDetailed({ router: testRouter(["m"]), modelFactory: factory }, input);
    expect(out.source).toBe("model-retry");
    expect(out.issues[0]).toContain("105");
    expect(calls).toHaveLength(2);
  });

  it("falls back to the template after two bad drafts", async () => {
    const { factory, calls } = scriptedModels({ m: [invented, "Unlock insights for 999 people. Leverage it."] });
    const out = await narrateDetailed({ router: testRouter(["m"]), modelFactory: factory }, input);
    expect(out.source).toBe("template");
    expect(out.text).toBe(templateNarrate("pr-rationale", facts, "en"));
    expect(calls).toHaveLength(2);
  });

  it("falls back to the template when every model is down", async () => {
    const { factory } = scriptedModels({ a: [apiError(503)], b: [apiError(503)] });
    const out = await narrateDetailed({ router: testRouter(["a", "b"]), modelFactory: factory }, input);
    expect(out.source).toBe("template");
  });

  it("works with no model at all", async () => {
    expect((await narrateDetailed(null, input)).source).toBe("template");
  });
});

describe("templateNarrate", () => {
  const cases = {
    "pr-rationale": facts,
    compare: { skill: "data analysis", places: [{ name: "Pune", nameMr: "पुणे", demand: 420, supply: 110, postings: 380 }, { name: "Nagpur", nameMr: "नागपूर", demand: 90, supply: 70, postings: 23 }] },
    "plan-summary": { district: "Nashik", districtMr: "नाशिक", fy: "FY27", status: "optimal", seats: 1240, seatsPrev: 1100, expectedPlacements: 780, trainersToHire: 6, capexUsed: 4_500_000 },
    "candidate-path": { district: "Nashik", districtMr: "नाशिक", role: "Solar PV technician", roleMr: "सोलर पीव्ही तंत्रज्ञ", openings: 140, have: ["electrical wiring"], haveMr: ["इलेक्ट्रिकल वायरिंग"], gaps: ["inverter installation"], gapsMr: ["इन्व्हर्टर बसवणे"], course: "Solar Technician (NSQF 4)", seats: 12, institute: "ITI Satpur" },
  } as const;

  for (const lang of ["en", "mr"] as const) {
    for (const [kind, f] of Object.entries(cases)) {
      it(`${kind} (${lang}) is grounded, plain and 2-4 sentences`, () => {
        const text = templateNarrate(kind as keyof typeof cases, f as Record<string, unknown>, lang);
        const check = checkProse(text, f);
        expect(check.issues).toEqual([]);
        expect(check.text).toBe(text); // already 4 sentences or fewer
        if (lang === "mr") expect(text).toMatch(/[ऀ-ॿ]/u);
        else expect(text).not.toMatch(/[ऀ-ॿ]/u);
      });
    }
  }

  it("speaks in people and ends with a next step", () => {
    const en = templateNarrate("pr-rationale", facts, "en");
    expect(en).toContain("About 140 people in Nashik");
    expect(en).toContain("14 employers");
    expect(en.endsWith("ask them to endorse it or suggest changes.")).toBe(true);
    const mr = templateNarrate("pr-rationale", { ...facts, districtMr: "नाशिक" }, "mr");
    expect(mr).toContain("सुमारे 140 लोकांना");
    expect(mr.endsWith("सूचना विचारा.")).toBe(true);
  });

  it("is honest when the signal is thin", () => {
    expect(templateNarrate("pr-rationale", { ...facts, postings: 12 }, "en")).toContain("only read 12 job posts so far");
    expect(templateNarrate("pr-rationale", { ...facts, postings: 12 }, "mr")).toContain("फक्त 12 नोकरीच्या जाहिराती");
    expect(templateNarrate("compare", cases.compare, "en")).toContain("only seen 23 job posts from Nagpur");
  });

  it("says rupees in lakh", () => {
    expect(templateNarrate("plan-summary", cases["plan-summary"], "en")).toContain("spend ₹45 lakh on equipment");
    expect(templateNarrate("plan-summary", cases["plan-summary"], "mr")).toContain("₹45 लाख");
  });

  it("degrades gracefully with missing or bad facts", () => {
    expect(templateNarrate("compare", { places: [] }, "en")).toMatch(/at least two places/);
    expect(templateNarrate("plan-summary", { district: "Pune", fy: "FY27", status: "infeasible" }, "en")).toMatch(/does not fit/);
    const bare = templateNarrate("pr-rationale", { skill: "welding" }, "en");
    expect(checkProse(bare, {}).issues).toEqual([]);
  });
});
