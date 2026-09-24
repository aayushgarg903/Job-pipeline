import { describe, expect, it } from "vitest";
import { DictionaryExtractor, matchOccupation, splitSentences, workModeOf } from "../src/extract-fallback";

const catalog = [
  { id: "industrial-wiring", labelEn: "Industrial wiring" },
  { id: "plc-programming", labelEn: "PLC programming" },
  { id: "solar-pv-installation", labelEn: "Solar PV installation" },
  { id: "welding-arc", labelEn: "Arc welding" },
  { id: "ms-excel", labelEn: "MS Excel" },
  { id: "english-communication", labelEn: "English communication" },
];
const aliases = [
  { alias: "plc", skillId: "plc-programming" },
  { alias: "rooftop solar", skillId: "solar-pv-installation" },
  { alias: "excel", skillId: "ms-excel" },
  { alias: "वायरिंग", skillId: "industrial-wiring" },
];
const occupations = [
  { nco: "7411.0100", titleEn: "Electrician, General" },
  { nco: "7212.0100", titleEn: "Welder, Gas and Electric" },
  { nco: "2512.0100", titleEn: "Software Developer" },
];

const jd = [
  "We need an ITI Electrician for our Chakan plant.",
  "Must have strong industrial wiring skills and 3+ years experience.",
  "Knowledge of PLC is a plus.",
  "No welding experience required.",
  "Rooftop solar exposure is optional.",
].join("\n");

describe("DictionaryExtractor", () => {
  const ex = new DictionaryExtractor(aliases);

  it("finds skills with evidence, requirement, proficiency and years", async () => {
    const out = await ex.extractPosting({ title: "ITI Electrician", description: jd, skillsCatalog: catalog, occupations });
    const by = Object.fromEntries(out.skills.map((s) => [s.skillId, s]));
    expect(by["industrial-wiring"]).toMatchObject({
      requirement: "required", proficiency: 3, years: 3, negated: false,
      evidence: "Must have strong industrial wiring skills and 3+ years experience.",
    });
    expect(by["plc-programming"]).toMatchObject({ requirement: "preferred", negated: false });
    expect(by["solar-pv-installation"]).toMatchObject({ requirement: "optional", proficiency: 1 });
    expect(out.model).toBe("dictionary-v1");
    expect(out.nco).toBe("7411.0100");
  });

  it("detects negation before and after the skill", async () => {
    const out = await ex.extractPosting({ title: "Helper", description: "No welding experience required. Excel not required.", skillsCatalog: catalog, occupations });
    // "welding" alone is not an alias, so only Excel matches; it must be negated.
    expect(out.skills.find((s) => s.skillId === "ms-excel")?.negated).toBe(true);
    const out2 = await ex.extractPosting({ title: "Welder", description: "Candidates without arc welding need not apply.", skillsCatalog: catalog, occupations });
    expect(out2.skills.find((s) => s.skillId === "welding-arc")?.negated).toBe(true);
  });

  it("prefers the longest alias for a span and matches Marathi aliases", async () => {
    const out = await ex.extractPosting({ title: "x", description: "PLC programming on Siemens. वायरिंग येणे आवश्यक.", skillsCatalog: catalog, occupations });
    const ids = out.skills.map((s) => s.skillId).sort();
    expect(ids).toEqual(["industrial-wiring", "plc-programming"]);
    expect(out.skills.find((s) => s.skillId === "plc-programming")?.text).toBe("PLC programming");
  });

  it("parses candidate free text into canonical skills, skipping negated ones", async () => {
    const r = await ex.parseCandidateSkills({ text: "I know basic Excel. I don't know PLC.", lang: "en", skillsCatalog: catalog });
    expect(r).toEqual([{ skillId: "ms-excel", proficiency: 1 }]);
  });

  it("narrates only the facts it is given", async () => {
    const s = await ex.narrate({ kind: "pr-rationale", facts: { employersEndorsing: 3, addHours: 30 }, lang: "en" });
    expect(s).toContain("3");
    expect(s).toContain("30");
  });
});

describe("helpers", () => {
  it("splits bullets and lines into sentences", () => {
    expect(splitSentences("• One thing\n• Two things. Three!")).toEqual(["One thing", "Two things.", "Three!"]);
  });
  it("classifies work mode", () => {
    expect(workModeOf("This is a work from home role")).toBe("remote");
    expect(workModeOf("Hybrid, 3 days in office")).toBe("hybrid");
    expect(workModeOf("Shop floor role at our plant")).toBe("on_site");
    expect(workModeOf("Great team")).toBe("unknown");
  });
  it("maps titles to NCO by token overlap", () => {
    expect(matchOccupation("Welder (Arc/Gas)", occupations).nco).toBe("7212.0100");
    expect(matchOccupation("Senior Software Developer - Java", occupations).nco).toBe("2512.0100");
    expect(matchOccupation("Receptionist", occupations).nco).toBeNull();
  });
});
