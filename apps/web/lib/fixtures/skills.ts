// Skills, occupations, demand cells and trends. Pune, Nashik and Gadchiroli are hand-tuned;
// the other 33 districts get deterministic filler so the state map is complete.
import type { DemandCell, DistrictSummary, Occupation, Proficiency, Skill } from "@ks/contracts";
import { DISTRICTS, FOCUS, FORECAST_QUARTERS, QUARTER, QUARTERS, between, intBetween, prov, rand } from "./base";

const S = (id: string, labelEn: string, labelMr: string, kind: Skill["kind"] = "skill"): Skill => ({ id, labelEn, labelMr, kind, escoUri: null });

export const SKILLS: Skill[] = [
  S("solar-pv-installation", "Solar PV installation", "सौर पीव्ही बसवणी"),
  S("cnc-programming", "CNC programming (Fanuc)", "सीएनसी प्रोग्रामिंग (फॅनुक)"),
  S("industrial-wiring", "Industrial electrical wiring", "औद्योगिक विद्युत वायरिंग"),
  S("plc-automation", "PLC automation", "पीएलसी ऑटोमेशन"),
  S("power-bi", "Power BI dashboards", "पॉवर बीआय डॅशबोर्ड", "tool"),
  S("spreadsheet-analysis", "Spreadsheet data analysis", "स्प्रेडशीट डेटा विश्लेषण"),
  S("legacy-macros", "Legacy spreadsheet macros", "जुने स्प्रेडशीट मॅक्रो", "tool"),
  S("tig-welding", "TIG welding", "टीआयजी वेल्डिंग"),
  S("ev-battery-maintenance", "EV battery maintenance", "ईव्ही बॅटरी देखभाल"),
  S("food-safety-haccp", "Food safety (HACCP)", "अन्न सुरक्षा (HACCP)", "knowledge"),
  S("drone-spraying", "Drone operation for farms", "शेतीसाठी ड्रोन चालवणे"),
  S("tally-gst", "Tally accounting with GST", "टॅली लेखा व जीएसटी", "tool"),
  S("forest-produce-processing", "Forest produce processing", "गौण वनोपज प्रक्रिया"),
  S("data-entry", "Data entry", "डेटा एंट्री"),
  S("customer-communication", "Talking with customers", "ग्राहकांशी संवाद", "transversal"),
];
export const skillById = new Map(SKILLS.map((s) => [s.id, s]));

export const OCCUPATIONS: Occupation[] = [
  { nco: "7411.0100", titleEn: "Electrician", titleMr: "विजतंत्री", nsqfLevel: 4 },
  { nco: "7411.0300", titleEn: "Solar PV technician", titleMr: "सौर पीव्ही तंत्रज्ञ", nsqfLevel: 4 },
  { nco: "7223.0400", titleEn: "CNC machine operator", titleMr: "सीएनसी यंत्रचालक", nsqfLevel: 4 },
  { nco: "4132.0100", titleEn: "Data entry operator", titleMr: "डेटा एंट्री ऑपरेटर", nsqfLevel: 3 },
  { nco: "7515.0200", titleEn: "Forest produce processor", titleMr: "वनोपज प्रक्रिया कामगार", nsqfLevel: 3 },
];

/** Hand-tuned cells: [skillId, demand, supply, sdi, delta] per focus district. */
const TUNED: Record<string, Array<[string, number, number, number, number]>> = {
  [FOCUS.pune]: [
    ["cnc-programming", 1240, 310, 178, 12], ["power-bi", 860, 140, 164, 21], ["plc-automation", 610, 190, 142, 9],
    ["ev-battery-maintenance", 480, 60, 151, 28], ["industrial-wiring", 720, 690, 112, 2], ["legacy-macros", 40, 380, 38, -61],
    ["data-entry", 520, 1450, 71, -9], ["customer-communication", 900, 700, 104, 3],
  ],
  [FOCUS.nashik]: [
    ["solar-pv-installation", 175, 35, 172, 19], ["cnc-programming", 540, 180, 149, 8], ["food-safety-haccp", 310, 90, 138, 11],
    ["drone-spraying", 120, 15, 158, 34], ["tig-welding", 260, 150, 118, 4], ["industrial-wiring", 330, 420, 96, -2],
    ["data-entry", 180, 640, 64, -7], ["legacy-macros", 10, 120, 31, -48],
  ],
  [FOCUS.gadchiroli]: [
    ["forest-produce-processing", 95, 20, 141, 14], ["solar-pv-installation", 60, 12, 133, 22], ["drone-spraying", 35, 0, 127, 30],
    ["tally-gst", 45, 30, 97, 1], ["data-entry", 40, 210, 52, -6], ["industrial-wiring", 30, 55, 81, -3],
  ],
};

function cell(lgd: string, skillId: string, demand: number, supply: number, sdi: number, coverage: number, proficiency: Proficiency = 2): DemandCell {
  const spread = (1 - coverage) * 0.5 + 0.12;
  return {
    lgd, skillId, proficiency, quarter: QUARTER, demand, supply, gap: demand - supply,
    ratio: Math.round((demand / Math.max(supply, 1)) * 10) / 10, sdi,
    ciLow: Math.round(demand * (1 - spread)), ciHigh: Math.round(demand * (1 + spread)), coverage,
  };
}

export function coverageOf(lgd: string): number {
  if (lgd === FOCUS.pune) return 0.83;
  if (lgd === FOCUS.nashik) return 0.61;
  if (lgd === FOCUS.gadchiroli) return 0.22;
  if (lgd === "482" || lgd === "483" || lgd === "497") return 0.9;
  return Math.round(between(`cov-${lgd}`, 0.18, 0.85) * 100) / 100;
}

const DELTA = new Map<string, number>();

function buildCells(): DemandCell[] {
  const out: DemandCell[] = [];
  for (const d of DISTRICTS) {
    const cov = coverageOf(d.lgd);
    const tuned = TUNED[d.lgd];
    if (tuned) {
      for (const [sid, dem, sup, sdi, delta] of tuned) {
        out.push(cell(d.lgd, sid, dem, sup, sdi, cov));
        DELTA.set(`${d.lgd}|${sid}`, delta);
      }
      continue;
    }
    const scale = (d.population ?? 2e6) / 3e6;
    for (const s of SKILLS) {
      if (rand(`has-${d.lgd}-${s.id}`) < 0.45) continue;
      const dem = Math.round(between(`dem-${d.lgd}-${s.id}`, 20, 420) * scale);
      const sup = Math.round(dem * between(`sup-${d.lgd}-${s.id}`, 0.2, 1.8));
      const sdi = intBetween(`sdi-${d.lgd}-${s.id}`, 45, 170);
      out.push(cell(d.lgd, s.id, dem, sup, sdi, cov));
      DELTA.set(`${d.lgd}|${s.id}`, intBetween(`dl-${d.lgd}-${s.id}`, -30, 30));
    }
  }
  return out;
}

export const CELLS: DemandCell[] = buildCells();
export const deltaOf = (lgd: string, skillId: string) => DELTA.get(`${lgd}|${skillId}`) ?? 0;

export function trendOf(skillId: string): Array<{ quarter: string; sdi: number; ciLow: number; ciHigh: number }> {
  const all = CELLS.filter((c) => c.skillId === skillId);
  const now = all.length ? all.reduce((s, c) => s + c.sdi, 0) / all.length : 100;
  const slope = all.length ? all.reduce((s, c) => s + deltaOf(c.lgd, skillId), 0) / all.length / 4 : 0;
  const series = [...QUARTERS, ...FORECAST_QUARTERS];
  const nowIdx = QUARTERS.length - 1;
  return series.map((quarter, i) => {
    const wobble = (rand(`tr-${skillId}-${quarter}`) - 0.5) * 8;
    const sdi = Math.max(5, Math.round(now + slope * (i - nowIdx) + (i === nowIdx ? 0 : wobble)));
    const band = i > nowIdx ? 10 + (i - nowIdx) * 8 : 6;
    return { quarter, sdi, ciLow: sdi - band, ciHigh: sdi + band };
  });
}

export function summaryOf(lgd: string): DistrictSummary | null {
  const district = DISTRICTS.find((d) => d.lgd === lgd);
  if (!district) return null;
  const cells = CELLS.filter((c) => c.lgd === lgd);
  const shortage = [...cells].sort((a, b) => b.gap - a.gap)[0];
  const surplus = [...cells].sort((a, b) => a.gap - b.gap)[0];
  const totalDemand = cells.reduce((s, c) => s + c.demand, 0) || 1;
  const mismatch = Math.min(1, Math.round((cells.reduce((s, c) => s + Math.abs(c.gap), 0) / (2 * totalDemand)) * 100) / 100);
  const coverage = coverageOf(lgd);
  const postings = lgd === FOCUS.pune ? 4120 : lgd === FOCUS.nashik ? 1310 : lgd === FOCUS.gadchiroli ? 23 : Math.round(coverage * intBetween(`p-${lgd}`, 200, 1600));
  const surveys = lgd === FOCUS.gadchiroli ? 6 : intBetween(`sv-${lgd}`, 8, 60);
  const label = (id: string) => SKILLS.find((s) => s.id === id)?.labelEn ?? id;
  return {
    district,
    mismatch,
    coverage,
    topShortage: shortage && shortage.gap > 0 ? { skillId: shortage.skillId, label: label(shortage.skillId), gap: shortage.gap } : null,
    topSurplus: surplus && surplus.gap < 0 ? { skillId: surplus.skillId, label: label(surplus.skillId), gap: surplus.gap } : null,
    postings,
    udyamNew12m: lgd === FOCUS.gadchiroli ? 410 : intBetween(`u-${lgd}`, 800, 9000),
    provenance: prov([
      { kind: "postings", label: "job posts", n: postings },
      { kind: "surveys", label: "employer surveys", n: surveys },
      { kind: "udyam", label: "new businesses", n: lgd === FOCUS.gadchiroli ? 410 : intBetween(`u-${lgd}`, 800, 9000) },
    ]),
  };
}
