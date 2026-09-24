// Gallery data: pulled through the Readers port (fixtures in DATA_MODE=fixture).
import type { Lang } from "@ks/contracts";
import type { CardProps, ChartSpec } from "@ks/ui";
import { courseCard, districtCard, skillCard, type Tr } from "@/lib/cards";
import { FOCUS } from "@/lib/fixtures";
import { getReaders } from "@/lib/readers";

export async function loadGallery() {
  const r = await getReaders();
  const [overview, districts, courses, pr, plan, sources, skills] = await Promise.all([
    r.stateOverview(), r.districts(), r.courses({}), r.pr("pr-101"), r.savedPlan(FOCUS.nashik, "FY27"), r.sources(), r.searchSkills("", 100),
  ]);
  const focus = [FOCUS.pune, FOCUS.nashik, FOCUS.gadchiroli];
  const cellsBy = Object.fromEntries(await Promise.all(focus.map(async (l) => [l, await r.districtCells(l, 10)] as const)));
  const evidence = Object.fromEntries(await Promise.all(focus.map(async (l) => [l, await r.evidence({ kind: "district", id: l })] as const)));
  const courseEvidence = Object.fromEntries(await Promise.all(courses.map(async (c) => [c.id, await r.evidence({ kind: "course", id: c.id })] as const)));
  const solarTrend = await r.skillTrend("solar-pv-installation");
  const cncCells = await r.skillCells("cnc-programming");
  const skillEvidence = await r.evidence({ kind: "skill", id: "solar-pv-installation", skillId: "solar-pv-installation" });
  return { overview, districts, courses, pr, plan, sources, skills, cellsBy, evidence, courseEvidence, solarTrend, cncCells, skillEvidence };
}

export type GalleryData = Awaited<ReturnType<typeof loadGallery>>;

export function buildCards(d: GalleryData, t: Tr, lang: Lang) {
  const skillLabel = (id: string) => {
    const s = d.skills.find((x) => x.id === id);
    return (lang === "mr" && s?.labelMr) || s?.labelEn || id;
  };
  const dname = (lgd: string) => {
    const x = d.districts.find((s) => s.district.lgd === lgd)?.district;
    return x ? (lang === "mr" ? x.nameMr : x.nameEn) : lgd;
  };
  const focus = [FOCUS.pune, FOCUS.nashik, FOCUS.gadchiroli];
  const district: CardProps[] = focus.map((lgd) => {
    const s = d.districts.find((x) => x.district.lgd === lgd)!;
    const cell = d.cellsBy[lgd]?.find((c) => c.skillId === s.topShortage?.skillId);
    const p = districtCard(s, t, lang, cell, skillLabel);
    return { ...p, figure: p.figure && { ...p.figure, evidence: d.evidence[lgd] } };
  });
  const course: CardProps[] = d.courses.map((c) => {
    const p = courseCard(c, dname(c.lgd), t, lang, skillLabel, d.overview.asOf);
    return { ...p, figure: p.figure && { ...p.figure, evidence: d.courseEvidence[c.id] } };
  });
  const nashikSolar = d.cellsBy[FOCUS.nashik]!.find((c) => c.skillId === "solar-pv-installation")!;
  const solar = d.skills.find((s) => s.id === "solar-pv-installation")!;
  const skill = skillCard(solar, nashikSolar, dname(FOCUS.nashik), 19, t, lang, d.overview.asOf);
  skill.figure = skill.figure && { ...skill.figure, evidence: d.skillEvidence };
  return { district, course, skill, skillLabel, dname };
}

export function chartSpecs(d: GalleryData, dname: (lgd: string) => string, lang: Lang) {
  const forecastFrom = "2026-Q4";
  const trend: ChartSpec = {
    kind: "lineBand",
    data: d.solarTrend.map((p) => ({ x: p.quarter, y: p.sdi, low: p.ciLow, high: p.ciHigh, forecast: p.quarter >= forecastFrom })),
    yLabel: "SDI",
    forecastLabel: lang === "mr" ? "अंदाज" : "forecast",
  };
  const bars: ChartSpec = {
    kind: "barSorted",
    data: [...d.cncCells].sort((a, b) => b.gap - a.gap).slice(0, 8).map((c) => ({ label: dname(c.lgd), value: c.gap, highlight: c.lgd === FOCUS.pune })),
  };
  const slope: ChartSpec = {
    kind: "slope",
    data: (d.plan?.rows ?? []).map((r) => ({ label: r.name, before: r.seatsPrev, after: r.seats })),
    beforeLabel: "FY26",
    afterLabel: "FY27",
  };
  const cols = lang === "mr" ? ["आवश्यक", "पसंतीचे", "असल्यास चांगले"] : ["Must-have", "Preferred", "Nice to have"];
  const dots: ChartSpec = {
    kind: "dotMatrix",
    colOrder: cols,
    data: [
      { row: "Data entry", col: cols[0]!, covered: true },
      { row: "Power BI dashboards", col: cols[0]!, covered: false },
      { row: "Spreadsheet data analysis", col: cols[0]!, covered: true },
      { row: "Talking with customers", col: cols[1]!, covered: false },
      { row: "Tally accounting with GST", col: cols[2]!, covered: false },
      { row: "Legacy spreadsheet macros", col: cols[2]!, covered: true },
    ],
  };
  return { trend, bars, slope, dots };
}
