// Location → LGD district. Chain: pincode (India Post) → pincode prefix → alias table → Nominatim → null.
// Pure core: network lookups are injected, so the chain is unit-testable.
import { normalizeText } from "./util";

export interface GeoDistrictRef { lgd: string; nameEn: string; nameMr: string; lgdName?: string; aliases?: string[] }
export interface GeoAliasRef { alias: string; lgd: string; source: string }

export interface GeoContext {
  districts: GeoDistrictRef[];
  aliases: GeoAliasRef[];
  pincodePrefixes: Array<{ prefix: string; lgd: string }>;
  /** India Post: pincode → district name + state, or null. */
  lookupPincode?: (pin: string) => Promise<{ district: string; state: string } | null>;
  /** Nominatim: free text → district (state_district/county) + state, or null. */
  nominatim?: (q: string) => Promise<{ district: string | null; state: string | null } | null>;
}

export type GeoMethod = "pincode" | "pincode-prefix" | "alias" | "nominatim" | "out-of-state" | "none";
export interface GeoResult { lgd: string | null; confidence: number; method: GeoMethod; matched: string | null }

export interface GeoInput { city?: string | null; state?: string | null; pincode?: string | null; text?: string | null }

const MH = new Set(["maharashtra", "mh", "महाराष्ट्र"]);
const MH_PIN = /\b(4[0-4]\d{4})\b/;

export class Geocoder {
  private byName = new Map<string, string>();
  private alias = new Map<string, { lgd: string; ambiguous: boolean }>();
  private prefixes: Array<{ prefix: string; lgd: string }>;

  constructor(private ctx: GeoContext) {
    for (const d of ctx.districts) {
      for (const n of [d.nameEn, d.nameMr, d.lgdName, ...(d.aliases ?? [])]) {
        if (n) this.byName.set(normalizeText(n), d.lgd);
      }
    }
    // Census/Udyam spellings that differ from LGD names.
    const extra: Record<string, string> = {
      "mumbai suburban": "483", "mumbai city": "482", "aurangabad": "469", "osmanabad": "488", "ahmednagar": "466",
      "ahmadnagar": "466", "nan ded": "485", "beed": "470", "bid": "470", "gondiya": "476", "buldana": "472",
    };
    for (const [k, v] of Object.entries(extra)) if (!this.byName.has(k)) this.byName.set(k, v);
    for (const a of ctx.aliases) {
      this.alias.set(normalizeText(a.alias), { lgd: a.lgd, ambiguous: a.source.includes("ambiguous") });
    }
    this.prefixes = [...ctx.pincodePrefixes].sort((a, b) => b.prefix.length - a.prefix.length);
  }

  /** District name as written by India Post / Nominatim / Udyam → LGD code. */
  matchDistrictName(name: string | null | undefined): string | null {
    if (!name) return null;
    const n = normalizeText(name).replace(/\bdistrict\b|\bdist\b|जिल्हा/g, "").trim();
    return this.byName.get(n) ?? this.alias.get(n)?.lgd ?? null;
  }

  async geocode(input: GeoInput): Promise<GeoResult> {
    const state = input.state ? normalizeText(input.state) : null;
    if (state && !MH.has(state)) return { lgd: null, confidence: 0.9, method: "out-of-state", matched: input.state ?? null };

    const pin = input.pincode?.match(MH_PIN)?.[1] ?? input.text?.match(MH_PIN)?.[1] ?? null;
    if (pin) {
      if (this.ctx.lookupPincode) {
        const hit = await this.ctx.lookupPincode(pin);
        if (hit && MH.has(normalizeText(hit.state))) {
          const lgd = this.matchDistrictName(hit.district);
          if (lgd) return { lgd, confidence: 0.95, method: "pincode", matched: pin };
        }
      }
      const pre = this.prefixes.find((p) => pin.startsWith(p.prefix));
      if (pre) return { lgd: pre.lgd, confidence: 0.85, method: "pincode-prefix", matched: pin };
    }

    // Try each comma-separated part, most specific first, then the whole string.
    const parts = (input.city ?? "").split(/[,/|]| - /).map((p) => normalizeText(p)).filter(Boolean);
    for (const part of [...parts, parts.join(" ")]) {
      const a = this.alias.get(part);
      if (a) return { lgd: a.lgd, confidence: a.ambiguous ? 0.6 : 0.9, method: "alias", matched: part };
      const d = this.byName.get(part);
      if (d) return { lgd: d, confidence: 0.9, method: "alias", matched: part };
    }

    if (this.ctx.nominatim && parts.length > 0) {
      const hit = await this.ctx.nominatim(`${input.city}, Maharashtra, India`);
      if (hit && (!hit.state || MH.has(normalizeText(hit.state)))) {
        const lgd = this.matchDistrictName(hit.district);
        if (lgd) return { lgd, confidence: 0.7, method: "nominatim", matched: hit.district };
      }
    }
    return { lgd: null, confidence: 0, method: "none", matched: null };
  }
}
