import { describe, expect, it, vi } from "vitest";
import { Geocoder, type GeoContext } from "../src/geocode";

const ctx = (over: Partial<GeoContext> = {}): GeoContext => ({
  districts: [
    { lgd: "490", nameEn: "Pune", nameMr: "पुणे", aliases: ["Poona"] },
    { lgd: "487", nameEn: "Nashik", nameMr: "नाशिक", aliases: ["Nasik"] },
    { lgd: "475", nameEn: "Gadchiroli", nameMr: "गडचिरोली" },
    { lgd: "469", nameEn: "Chhatrapati Sambhajinagar", nameMr: "छत्रपती संभाजीनगर", lgdName: "Aurangabad" },
    { lgd: "482", nameEn: "Mumbai City", nameMr: "मुंबई शहर" },
  ],
  aliases: [
    { alias: "hinjewadi", lgd: "490", source: "curated" },
    { alias: "waluj", lgd: "469", source: "curated" },
    { alias: "mumbai", lgd: "482", source: "curated-ambiguous" },
  ],
  pincodePrefixes: [{ prefix: "411", lgd: "490" }, { prefix: "4220", lgd: "487" }],
  ...over,
});

describe("Geocoder", () => {
  it("prefers the India Post pincode lookup", async () => {
    const lookupPincode = vi.fn(async () => ({ district: "Nashik", state: "Maharashtra" }));
    const g = new Geocoder(ctx({ lookupPincode }));
    const r = await g.geocode({ city: "Somewhere", text: "Plant at MIDC Sinnar 422103" });
    expect(lookupPincode).toHaveBeenCalledWith("422103");
    expect(r).toMatchObject({ lgd: "487", method: "pincode" });
  });

  it("falls back to the longest pincode prefix when the API has nothing", async () => {
    const g = new Geocoder(ctx({ lookupPincode: async () => null }));
    expect(await g.geocode({ pincode: "411057" })).toMatchObject({ lgd: "490", method: "pincode-prefix" });
    expect(await g.geocode({ pincode: "422007" })).toMatchObject({ lgd: "487", method: "pincode-prefix" });
  });

  it("resolves localities through the alias table, most specific part first", async () => {
    const g = new Geocoder(ctx());
    expect(await g.geocode({ city: "Hinjewadi, Pune, Maharashtra" })).toMatchObject({ lgd: "490", method: "alias", confidence: 0.9 });
    expect(await g.geocode({ city: "Waluj MIDC" })).toMatchObject({ method: "none" });
    expect(await g.geocode({ city: "Waluj" })).toMatchObject({ lgd: "469" });
  });

  it("marks ambiguous aliases with lower confidence", async () => {
    const r = await new Geocoder(ctx()).geocode({ city: "Mumbai" });
    expect(r.lgd).toBe("482");
    expect(r.confidence).toBeLessThan(0.7);
  });

  it("matches old and Marathi district names", () => {
    const g = new Geocoder(ctx());
    expect(g.matchDistrictName("AURANGABAD")).toBe("469");
    expect(g.matchDistrictName("गडचिरोली")).toBe("475");
    expect(g.matchDistrictName("Nasik District")).toBe("487");
  });

  it("uses Nominatim last and only inside Maharashtra", async () => {
    const nominatim = vi.fn(async () => ({ district: "Gadchiroli", state: "Maharashtra" }));
    const g = new Geocoder(ctx({ nominatim }));
    expect(await g.geocode({ city: "Aheri" })).toMatchObject({ lgd: "475", method: "nominatim", confidence: 0.7 });
    const outside = new Geocoder(ctx({ nominatim: async () => ({ district: "Pune", state: "Karnataka" }) }));
    expect((await outside.geocode({ city: "Someplace" })).lgd).toBeNull();
  });

  it("rejects out-of-state postings and returns null when nothing matches", async () => {
    const g = new Geocoder(ctx());
    expect(await g.geocode({ city: "Bengaluru", state: "Karnataka" })).toMatchObject({ lgd: null, method: "out-of-state" });
    expect(await g.geocode({ city: "Atlantis" })).toMatchObject({ lgd: null, method: "none", confidence: 0 });
  });
});
