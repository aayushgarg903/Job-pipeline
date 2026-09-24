import { describe, expect, it } from "vitest";
import { lexicalCandidateSkills, parseCandidateSkills } from "../src/candidate";
import { createEmbedder, fitDims } from "../src/embed";
import { apiError, scriptedModels, testRouter } from "./helpers";

const catalog = [
  { id: "electrical-wiring", labelEn: "Electrical wiring" },
  { id: "solar-pv-installation", labelEn: "Solar PV installation" },
  { id: "mig-welding", labelEn: "MIG welding" },
  { id: "excel", labelEn: "Microsoft Excel" },
];

describe("parseCandidateSkills", () => {
  it("offline fallback reads code-mixed Marathi", () => {
    const out = lexicalCandidateSkills({ text: "मला wiring आणि solar panel बसवता येतं", lang: "mr", skillsCatalog: catalog });
    expect(out.map((s) => s.skillId).sort()).toEqual(["electrical-wiring", "solar-pv-installation"]);
    expect(out.every((s) => s.proficiency === 2)).toBe(true);
  });

  it("offline fallback reads proficiency per clause", () => {
    const withInverter = [...catalog, { id: "inverter-installation", labelEn: "Inverter and battery installation" }];
    const out = lexicalCandidateSkills({ text: "मला wiring आणि solar panel बसवता येतं, inverter पण थोडं थोडं येतं", lang: "mr", skillsCatalog: withInverter });
    expect(Object.fromEntries(out.map((s) => [s.skillId, s.proficiency]))).toEqual({ "electrical-wiring": 2, "solar-pv-installation": 2, "inverter-installation": 1 });
  });

  it("offline fallback reads Devanagari-only text and years of experience", () => {
    const out = lexicalCandidateSkills({ text: "मला ५ वर्षे वेल्डिंग आणि वायरिंगचा अनुभव आहे", lang: "mr", skillsCatalog: catalog });
    expect(out.map((s) => s.skillId).sort()).toEqual(["electrical-wiring", "mig-welding"]);
    expect(out.every((s) => s.proficiency === 3)).toBe(true);
  });

  it("uses the model, keeps only catalogue ids, and merges duplicates at the higher level", async () => {
    const { factory } = scriptedModels({ m: [{ skills: [
      { mention: "wiring", skillId: "electrical-wiring", proficiency: 2 },
      { mention: "solar panel बसवता", skillId: "solar-pv-installation", proficiency: 2 },
      { mention: "वायरिंग", skillId: "electrical-wiring", proficiency: 3 },
      { mention: "drone", skillId: "drone-piloting", proficiency: 4 },
    ] }] });
    const out = await parseCandidateSkills({ router: testRouter(["m"]), modelFactory: factory }, { text: "मला wiring आणि solar panel बसवता येतं", lang: "mr", skillsCatalog: catalog });
    expect(out).toEqual([{ skillId: "electrical-wiring", proficiency: 3 }, { skillId: "solar-pv-installation", proficiency: 2 }]);
  });

  it("falls back to lexical matching when the model is unavailable", async () => {
    const { factory } = scriptedModels({ m: [apiError(503)] });
    const out = await parseCandidateSkills({ router: testRouter(["m"]), modelFactory: factory }, { text: "I can do wiring", lang: "en", skillsCatalog: catalog });
    expect(out).toEqual([{ skillId: "electrical-wiring", proficiency: 2 }]);
  });
});

describe("embedder", () => {
  it("fitDims truncates Matryoshka-style and L2-normalises", () => {
    const v = fitDims([3, 4, 12, 5], 2);
    expect(v).toHaveLength(2);
    expect(v[0]).toBeCloseTo(0.6);
    expect(v[1]).toBeCloseTo(0.8);
    expect(() => fitDims([1], 2)).toThrow();
  });

  it("batches by 100, caches by content hash, and returns vectors in input order", async () => {
    const batches: number[] = [];
    const em = createEmbedder({
      dims: 4,
      router: testRouter(["e"]),
      embedBatch: async (_m, values) => { batches.push(values.length); return values.map((t) => [t.length, 1, 0, 0, 9, 9]); },
    });
    const texts = Array.from({ length: 150 }, (_, i) => `text ${i}`);
    const first = await em.embed([...texts, "text 0"]); // duplicate is embedded once
    expect(batches).toEqual([100, 50]);
    expect(first).toHaveLength(151);
    expect(first[150]).toEqual(first[0]);
    expect(first[0]!).toHaveLength(4);
    expect(Math.hypot(...first[0]!)).toBeCloseTo(1);
    await em.embed(["text 3", "text 7"]);
    expect(batches).toEqual([100, 50]); // served from cache
    expect(em.stats()).toMatchObject({ cached: 150, apiBatches: 2, truncatedLocally: 150, lastModel: "e" });
  });

  it("falls back to the second embedding model on 503", async () => {
    const em = createEmbedder({
      dims: 2, router: testRouter(["primary", "backup"], 0),
      embedBatch: async (m, values) => { if (m === "primary") throw apiError(503); return values.map(() => [1, 1]); },
    });
    await em.embed(["a"]);
    expect(em.stats().lastModel).toBe("backup");
  });
});
