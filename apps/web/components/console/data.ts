// Cached aggregate loaders for the official / institute console. Every function takes
// primitives only and never touches cookies(); the locale is resolved outside and
// passed to the (uncached) card builders. Tags follow Architecture §7:
// state · district:<lgd> · skill:<id> · course:<id>.
import type { DemandCell, Skill } from "@ks/contracts";
import { cacheLife, cacheTag } from "next/cache";
import { getReaders } from "@/lib/readers";

async function allSkills(): Promise<Skill[]> {
  const r = await getReaders();
  return r.searchSkills("", 500);
}

export async function loadState() {
  "use cache";
  cacheLife("hours");
  cacheTag("state");
  const r = await getReaders();
  const [overview, districts, rising, sources, skills] = await Promise.all([
    r.stateOverview(), r.districts(), r.topSkills({ by: "rising", limit: 6 }), r.sources(), allSkills(),
  ]);
  const cells = await Promise.all(districts.map((d) => r.districtCells(d.district.lgd, 50)));
  const topCells: Record<string, DemandCell | null> = {};
  // Headline counts each district's biggest shortage once. Summing every skill would count
  // one hire several times (Architecture §6.2), so we don't.
  let peopleShort = 0;
  let trainedLocally = 0;
  districts.forEach((d, i) => {
    const top = (cells[i] ?? []).find((c) => c.skillId === d.topShortage?.skillId) ?? null;
    topCells[d.district.lgd] = top;
    if (top && top.gap > 0) {
      peopleShort += top.gap;
      trainedLocally += top.supply;
    }
  });
  return { overview, districts, topCells, rising, sources, skills, peopleShort, trainedLocally };
}

export async function loadDistrict(lgd: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`district:${lgd}`, "state");
  const r = await getReaders();
  const summary = await r.district(lgd);
  if (!summary) return null;
  const [cells, courses, evidence, postings, skills, overview, all] = await Promise.all([
    r.districtCells(lgd, 20), r.courses({ lgd, limit: 50 }), r.evidence({ kind: "district", id: lgd }, 12),
    r.postings({ lgd, limit: 6 }), allSkills(), r.stateOverview(), r.districts(),
  ]);
  const neighbours = all
    .filter((d) => d.district.division === summary.district.division && d.district.lgd !== lgd)
    .sort((a, b) => b.mismatch - a.mismatch)
    .slice(0, 3);
  const neighbourCells = await Promise.all(neighbours.map((n) => r.districtCells(n.district.lgd, 20)));
  return { summary, cells, courses, evidence, postings, skills, asOf: overview.asOf, neighbours, neighbourCells };
}

export async function loadSkill(id: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`skill:${id}`);
  const r = await getReaders();
  const skill = await r.skill(id);
  if (!skill) return null;
  const [cells, trend, rising, courses, postings, evidence, radar, overview, districts, skills] = await Promise.all([
    r.skillCells(id), r.skillTrend(id), r.topSkills({ by: "rising", limit: 500 }), r.courses({ limit: 500 }),
    r.postings({ skillId: id, limit: 8 }), r.evidence({ kind: "skill", id, skillId: id }, 10), r.radar(), r.stateOverview(), r.districts(), allSkills(),
  ]);
  const names = Object.fromEntries(districts.map((d) => [d.district.lgd, { en: d.district.nameEn, mr: d.district.nameMr, coverage: d.coverage }]));
  return {
    skill, cells, trend,
    delta: rising.find((s) => s.id === id)?.delta ?? 0,
    courses: courses.filter((c) => c.skills.some((s) => s.skillId === id)),
    postings, evidence,
    radar: radar.find((t) => t.skillId === id) ?? null,
    asOf: overview.asOf,
    names,
    skills,
  };
}

export async function loadCourse(id: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`course:${id}`);
  const r = await getReaders();
  const course = await r.course(id);
  if (!course) return null;
  cacheTag(`district:${course.lgd}`);
  const [prs, evidence, skills, summary, cells, overview, occupation] = await Promise.all([
    r.coursePrs(id), r.evidence({ kind: "course", id }, 10), allSkills(), r.district(course.lgd),
    r.districtCells(course.lgd, 50), r.stateOverview(), r.occupation(course.targetNco),
  ]);
  return { course, prs, evidence, skills, summary, cells, asOf: overview.asOf, occupation };
}

export async function loadPlanInput(lgd: string, fy: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`district:${lgd}`, `plan:${lgd}:${fy}`);
  const r = await getReaders();
  const [input, saved, summary, overview] = await Promise.all([r.planInput(lgd, fy), r.savedPlan(lgd, fy), r.district(lgd), r.stateOverview()]);
  return { input, saved, summary, asOf: overview.asOf };
}

export async function loadRadar() {
  "use cache";
  cacheLife("hours");
  cacheTag("state");
  const r = await getReaders();
  const [terms, skills, overview] = await Promise.all([r.radar(), allSkills(), r.stateOverview()]);
  return { terms, skills, asOf: overview.asOf };
}

export async function loadSources() {
  "use cache";
  cacheLife("hours");
  cacheTag("state");
  const r = await getReaders();
  const [sources, overview] = await Promise.all([r.sources(), r.stateOverview()]);
  return { sources, overview };
}

export async function loadOutcomes() {
  "use cache";
  cacheLife("hours");
  cacheTag("state");
  const r = await getReaders();
  const [kpis, overview] = await Promise.all([r.outcomes(), r.stateOverview()]);
  return { kpis, asOf: overview.asOf, isDemo: overview.isDemo };
}
