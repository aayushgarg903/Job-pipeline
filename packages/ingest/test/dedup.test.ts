import { describe, expect, it } from "vitest";
import { Deduper, descriptionHash, jaccard, shingles } from "../src/dedup";

const base = "We are hiring an ITI Electrician for our Chakan plant. Must know industrial wiring, motor control panels and PLC basics. " +
  "Candidates with 2 years of experience in maintenance preferred. Salary as per industry standards. Shift work required.";

describe("dedup", () => {
  it("hash ignores case, punctuation and whitespace", () => {
    expect(descriptionHash(base)).toBe(descriptionHash(`  ${base.toUpperCase().replace(/\./g, " ")} `));
  });

  it("jaccard is 1 for identical and low for unrelated text", () => {
    expect(jaccard(shingles(base), shingles(base))).toBe(1);
    expect(jaccard(shingles(base), shingles("Senior React developer, remote, TypeScript and Next.js required."))).toBeLessThan(0.1);
  });

  it("collapses exact and near-duplicates from the same employer within 14 days", () => {
    const d = new Deduper();
    const t0 = new Date("2026-09-01");
    expect(d.add({ id: "a", employer: "Bharat Forge", title: "Electrician", description: base, postedAt: t0 }).canonicalId).toBeNull();
    expect(d.add({ id: "b", employer: "BHARAT FORGE", title: "Electrician", description: base, postedAt: t0 })).toMatchObject({ canonicalId: "a", reason: "hash" });
    const near = `${base} Apply now.`;
    const r = d.add({ id: "c", employer: "Bharat Forge", title: "ITI Electrician", description: near, postedAt: new Date("2026-09-05") });
    expect(r.canonicalId).toBe("a");
    expect(r.reason).toBe("jaccard");
    expect(r.similarity).toBeGreaterThanOrEqual(0.8);
  });

  it("keeps near-identical text from a different employer and title, or outside the window", () => {
    const d = new Deduper();
    d.add({ id: "a", employer: "Bharat Forge", title: "Electrician", description: base, postedAt: new Date("2026-09-01") });
    expect(d.add({ id: "b", employer: "Tata Motors", title: "Maintenance Tech", description: `${base} Apply now.`, postedAt: new Date("2026-09-02") }).canonicalId).toBeNull();
    expect(d.add({ id: "c", employer: "Bharat Forge", title: "Electrician", description: `${base} Join us.`, postedAt: new Date("2026-10-20") }).canonicalId).toBeNull();
  });
});
