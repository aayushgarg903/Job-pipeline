// Fixture foundations: the 36 districts, deterministic pseudo-randomness, shared constants.
// Everything here is demo data (isDemo = true) and renders with the SPECIMEN watermark.
import type { District, Provenance } from "@ks/contracts";

export const AS_OF = "2026-09-24T06:00:00+05:30";
export const QUARTER = "2026-Q3";
export const FOCUS = { pune: "490", nashik: "487", gadchiroli: "475" } as const;

/** Deterministic 0..1 from a string (FNV-1a). Same input, same demo numbers, every build. */
export function rand(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) % 100000) / 100000;
}
export const between = (key: string, lo: number, hi: number) => lo + rand(key) * (hi - lo);
export const intBetween = (key: string, lo: number, hi: number) => Math.round(between(key, lo, hi));

type Row = [lgd: string, en: string, mr: string, division: string, population: number, aspirational?: boolean];

// Best-effort LGD codes (state 27); the data agent owns the canonical table. Population: Census 2011.
const ROWS: Row[] = [
  ["466", "Ahilyanagar", "अहिल्यानगर", "Nashik", 4543159],
  ["467", "Akola", "अकोला", "Amravati", 1813906],
  ["468", "Amravati", "अमरावती", "Amravati", 2888445],
  ["469", "Chhatrapati Sambhajinagar", "छत्रपती संभाजीनगर", "Chh. Sambhajinagar", 3701282],
  ["470", "Beed", "बीड", "Chh. Sambhajinagar", 2585049],
  ["471", "Bhandara", "भंडारा", "Nagpur", 1200334],
  ["472", "Buldhana", "बुलढाणा", "Amravati", 2586258],
  ["473", "Chandrapur", "चंद्रपूर", "Nagpur", 2204307],
  ["474", "Dhule", "धुळे", "Nashik", 2050862],
  ["475", "Gadchiroli", "गडचिरोली", "Nagpur", 1072942, true],
  ["476", "Gondia", "गोंदिया", "Nagpur", 1322507],
  ["477", "Hingoli", "हिंगोली", "Chh. Sambhajinagar", 1177345],
  ["478", "Jalgaon", "जळगाव", "Nashik", 4229917],
  ["479", "Jalna", "जालना", "Chh. Sambhajinagar", 1959046],
  ["480", "Kolhapur", "कोल्हापूर", "Pune", 3876001],
  ["481", "Latur", "लातूर", "Chh. Sambhajinagar", 2454196],
  ["482", "Mumbai City", "मुंबई शहर", "Konkan", 3085411],
  ["483", "Mumbai Suburban", "मुंबई उपनगर", "Konkan", 9356962],
  ["484", "Nagpur", "नागपूर", "Nagpur", 4653570],
  ["485", "Nanded", "नांदेड", "Chh. Sambhajinagar", 3361292],
  ["486", "Nandurbar", "नंदुरबार", "Nashik", 1648295, true],
  ["487", "Nashik", "नाशिक", "Nashik", 6107187],
  ["488", "Dharashiv", "धाराशिव", "Chh. Sambhajinagar", 1657576, true],
  ["489", "Parbhani", "परभणी", "Chh. Sambhajinagar", 1836086],
  ["490", "Pune", "पुणे", "Pune", 9429408],
  ["491", "Raigad", "रायगड", "Konkan", 2634200],
  ["492", "Ratnagiri", "रत्नागिरी", "Konkan", 1615069],
  ["493", "Sangli", "सांगली", "Pune", 2822143],
  ["494", "Satara", "सातारा", "Pune", 3003741],
  ["495", "Sindhudurg", "सिंधुदुर्ग", "Konkan", 849651],
  ["496", "Solapur", "सोलापूर", "Pune", 4317756],
  ["497", "Thane", "ठाणे", "Konkan", 8070032],
  ["498", "Wardha", "वर्धा", "Nagpur", 1300774],
  ["499", "Washim", "वाशिम", "Amravati", 1197160, true],
  ["500", "Yavatmal", "यवतमाळ", "Amravati", 2772348],
  ["665", "Palghar", "पालघर", "Konkan", 2990116],
];

export const DISTRICTS: District[] = ROWS.map(([lgd, nameEn, nameMr, division, population, asp]) => ({
  lgd, nameEn, nameMr, division, population, isAspirational: !!asp,
}));

export const districtByLgd = new Map(DISTRICTS.map((d) => [d.lgd, d]));

export function prov(sources: Provenance["sources"], opts: { lapsed?: boolean; asOf?: string } = {}): Provenance {
  return { sources, asOf: opts.asOf ?? AS_OF, isDemo: true, lapsed: !!opts.lapsed };
}

export const QUARTERS = ["2024-Q2", "2024-Q3", "2024-Q4", "2025-Q1", "2025-Q2", "2025-Q3", "2025-Q4", "2026-Q1", "2026-Q2", "2026-Q3"];
export const FORECAST_QUARTERS = ["2026-Q4", "2027-Q1"];
