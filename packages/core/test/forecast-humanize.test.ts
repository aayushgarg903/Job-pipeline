import { describe, expect, it } from "vitest";
import {
  compactIndian,
  confidencePhrase,
  createRng,
  forecastSeries,
  formatIndian,
  mrLocative,
  peopleSentence,
  rupees,
  seasonalNaive,
  smape,
  toDevanagariDigits,
} from "../src/index";

const seasonal = (n: number, seed = 5) => {
  const rng = createRng(seed, "seasonal");
  return Array.from({ length: n }, (_, t) => 100 + 4 * t + 25 * Math.sin((2 * Math.PI * t) / 4) + 3 * rng.normal());
};

describe("forecast", () => {
  it("says insufficient-history below 8 points", () => {
    const r = forecastSeries([1, 2, 3, 4, 5, 6, 7]);
    expect(r.status).toBe("insufficient-history");
    expect(r.points).toEqual([]);
  });

  it("beats or matches seasonal-naive on a seasonal series (backtest and holdout)", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const y = seasonal(20, seed);
      const r = forecastSeries(y);
      expect(r.status).toBe("ok");
      expect(r.smape).not.toBeNull();
      const chosen = r.model === "ets" ? r.smape!.ets : r.smape!.naive;
      expect(chosen).toBeLessThanOrEqual(r.smape!.naive);
      // Holdout: fit on the first 18, score the last 2.
      const train = y.slice(0, 18);
      const test = y.slice(18);
      const f = forecastSeries(train).points.map((p) => p.value);
      expect(smape(test, f)).toBeLessThanOrEqual(smape(test, seasonalNaive(train, 2, 4)) + 1e-9);
    }
  });

  it("returns a band around each point", () => {
    const r = forecastSeries(seasonal(16), { horizon: 2 });
    expect(r.points).toHaveLength(2);
    for (const p of r.points) {
      expect(p.low).toBeLessThanOrEqual(p.value);
      expect(p.high).toBeGreaterThanOrEqual(p.value);
    }
  });
});

describe("humanize", () => {
  it("formats Indian numbers", () => {
    expect(formatIndian(1234567)).toBe("12,34,567");
    expect(formatIndian(999)).toBe("999");
    expect(compactIndian(120000)).toBe("1.2 lakh");
    expect(compactIndian(34000000, { lang: "mr" })).toBe("3.4 कोटी");
    expect(rupees(1e6)).toBe("₹10 lakh");
    expect(toDevanagariDigits("140")).toBe("१४०");
  });

  it("writes the people sentence in English and Marathi", () => {
    const gap = { demand: 138, supply: 34 };
    expect(peopleSentence({ gap, district: "Nashik", occupationLabel: "solar technicians", lang: "en" })).toBe(
      "About 140 people in Nashik could be hired as solar technicians next year; ITIs here will train about 35.",
    );
    expect(peopleSentence({ gap, district: "नाशिक", occupationLabel: "सोलर तंत्रज्ञ", lang: "mr" })).toBe(
      "नाशिकमध्ये पुढील वर्षी सुमारे 140 जणांना सोलर तंत्रज्ञ म्हणून नोकरी मिळू शकते; इथल्या ITI सुमारे 35 जणांना प्रशिक्षण देतील.",
    );
    expect(peopleSentence({ gap: { demand: 40, supply: 0 }, district: "Gadchiroli", occupationLabel: "welders" })).toContain("no ITI here trains for it yet");
    expect(mrLocative("पुणे")).toBe("पुण्यात");
  });

  it("chooses confidence phrases from coverage", () => {
    expect(confidencePhrase({ coverage: 0.9 })).toBe("We're fairly sure.");
    expect(confidencePhrase({ coverage: 0.2, employers: 6 })).toBe("This leans on only 6 employers.");
    expect(confidencePhrase({ coverage: 0.9, lang: "mr" })).toBe("याबद्दल आम्हाला बऱ्यापैकी खात्री आहे.");
    expect(confidencePhrase({ coverage: 0.1 })).toContain("very little local data");
  });
});
