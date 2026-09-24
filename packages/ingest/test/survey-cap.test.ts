import { describe, expect, it } from "vitest";
import { type SurveyRow, surveyObservations } from "../src/facts-inputs";

const Q = ["2026-Q2", "2026-Q3"];
const row = (employer: string, hires: number, at = "2026-07-15"): SurveyRow =>
  ({ employer_id: employer, collected_at: new Date(at), lgd_code: "487", nco_code: "7411.0100", hires });
const cell = (obs: ReturnType<typeof surveyObservations>, q = "2026-Q3") => obs.find((o) => o.quarter === q)!;

describe("survey observations (anti-gaming)", () => {
  it("counts a single employer as one observation, uncapped (1/k = 100%)", () => {
    const o = cell(surveyObservations([row("e1", 40)], Q));
    expect(o).toMatchObject({ kind: "surveys", n: 1, hires12m: 40 });
  });

  it("caps one employer at max(10%, 1/k) of the cell's stated hires", () => {
    // 4 employers → cap 25% of 100 = 25; the 70-hire claim is cut to 25.
    const o = cell(surveyObservations([row("e1", 70), row("e2", 10), row("e3", 10), row("e4", 10)], Q));
    expect(o.n).toBe(4);
    expect(o.hires12m).toBe(25 + 10 + 10 + 10);
  });

  it("applies the 10% cap once there are more than 10 employers", () => {
    const rows = [row("big", 500), ...Array.from({ length: 11 }, (_, i) => row(`e${i}`, 10))];
    const o = cell(surveyObservations(rows, Q));
    expect(o.n).toBe(12);
    expect(o.hires12m).toBeCloseTo(0.1 * 610 + 110, 6);
  });

  it("keeps only an employer's latest response, so re-submitting adds no weight", () => {
    const o = cell(surveyObservations([row("e1", 10, "2026-07-01"), row("e1", 12, "2026-08-01"), row("e1", 11, "2026-07-20")], Q));
    expect(o).toMatchObject({ n: 1, hires12m: 12 });
  });

  it("keeps a response valid for the four quarters from collection, inside the window", () => {
    const obs = surveyObservations([row("e1", 10, "2026-05-01")], Q);
    expect(obs.map((o) => o.quarter).sort()).toEqual(["2026-Q2", "2026-Q3"]);
  });
});
