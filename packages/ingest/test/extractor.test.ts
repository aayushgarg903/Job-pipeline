import type { ExtractedPosting, Extractor } from "@ks/contracts";
import { describe, expect, it } from "vitest";
import { budgetedExtractor } from "../src/extractor";

const posting = (model: string, skillIds: string[]): ExtractedPosting => ({
  nco: null, ncoConfidence: 0, workMode: null, model,
  skills: skillIds.map((id) => ({ text: id, skillId: id, requirement: "required", proficiency: 2, years: null, evidence: `needs ${id}`, negated: false, confidence: 0.9 })),
} as unknown as ExtractedPosting);

const dict: Extractor = {
  extractPosting: async () => posting("dictionary-v1", ["a"]),
  parseCandidateSkills: async () => [],
  narrate: async () => "",
};
const input = { title: "t", description: "d", skillsCatalog: [], occupations: [] };

function fakeAi(results: Array<ExtractedPosting | Error>) {
  const attempts: unknown[] = [];
  return {
    router: { attempts: () => attempts } as never,
    extractPosting: async () => {
      attempts.push({});
      const r = results.shift()!;
      if (r instanceof Error) throw r;
      return r;
    },
  };
}

describe("budgetedExtractor", () => {
  it("uses Gemini when it answers and counts skills against the dictionary", async () => {
    const { extractor, stats } = budgetedExtractor(fakeAi([posting("gemini-x", ["a", "b", "c"])]), dict, 10);
    expect((await extractor.extractPosting(input)).model).toBe("gemini-x");
    expect(stats()).toMatchObject({ llmOk: 1, llmSkills: 3, dictSkillsSamePostings: 1, models: { "gemini-x": 1 }, apiCalls: 1 });
  });

  it("falls back to the dictionary on failure and once the call budget is spent", async () => {
    const { extractor, stats } = budgetedExtractor(fakeAi([new Error("429"), posting("gemini-x", ["a"])]), dict, 1);
    expect((await extractor.extractPosting(input)).model).toBe("dictionary-v1"); // failed
    expect((await extractor.extractPosting(input)).model).toBe("dictionary-v1"); // budget of 1 used
    expect(stats()).toMatchObject({ llmOk: 0, llmFailed: 1, skippedBudget: 1, apiCalls: 1 });
  });
});
