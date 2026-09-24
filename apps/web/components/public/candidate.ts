// Job-seeker path, server side. Two steps:
// 1. readSkills(): free text (en / mr / code-mixed) -> catalogue skills. Gemini first, with a
//    short time budget; if it fails or is slow, a lexical match over the catalogue. We report
//    which one answered so the page can say so honestly.
// 2. rankPaths(): the 3 best roles for this person, ranked by demand in the home district and
//    its division (nearby) x how many of the role's skills they already have.
// Nothing here stores anything: inputs in, results out.
import type { Course, CourseHealth, DemandCell, DistrictSummary, Lang, Proficiency, Readers, Skill, SkillId } from "@ks/contracts";
import { createExtractor, createRouter, lexicalCandidateSkills, modelChainFromEnv, type KsExtractor } from "@ks/ai";
import { ROLES, type Role } from "./roles";

export type ReadVia = "ai" | "words" | "none";
export interface HeldSkill { skillId: SkillId; proficiency: Proficiency }

const AI_BUDGET_MS = 8_000;

/**
 * Everyday words people use for catalogue skills, for the lexical fallback only. Each becomes a
 * one-word pseudo-label, so "house wiring" finds "Industrial electrical wiring". Marathi words
 * are already translated to these English tokens by @ks/ai's glossary (वायरिंग -> wiring).
 */
const ALIASES: Record<SkillId, string[]> = {
  "industrial-wiring": ["wiring", "electrician", "electrical"],
  "solar-pv-installation": ["solar"],
  "tig-welding": ["welding", "welder"],
  "cnc-programming": ["fanuc", "turning"],
  "plc-automation": ["automation"],
  "ev-battery-maintenance": ["battery", "inverter"],
  "spreadsheet-analysis": ["excel", "spreadsheet"],
  "power-bi": ["dashboard", "dashboards"],
  "data-entry": ["typing", "computer"],
  "tally-gst": ["tally", "accounting", "gst"],
  "food-safety-haccp": ["haccp", "hygiene"],
  "drone-spraying": ["drone", "spraying"],
  "forest-produce-processing": ["bamboo", "mahua", "forest"],
  "customer-communication": ["customer", "customers", "sales"],
};
let extractor: KsExtractor | null = null;

function getExtractor(): KsExtractor {
  // One fast attempt per model, two models, and trip a model for a minute after one failure:
  // the free tier is rate-limited, and a job seeker on a phone shouldn't wait for retries.
  extractor ??= createExtractor({
    router: createRouter({ models: modelChainFromEnv().slice(0, 2), retriesPerModel: 0, timeoutMs: 6_000, breakerThreshold: 1, breakerCooldownMs: 60_000 }),
  });
  return extractor;
}

const timeout = <T>(ms: number, value: T) => new Promise<T>((r) => setTimeout(() => r(value), ms));

export async function readSkills(text: string, lang: Lang, catalog: Skill[], allowAi = true): Promise<{ skills: HeldSkill[]; via: ReadVia }> {
  const skillsCatalog = catalog.map((s) => ({ id: s.id, labelEn: s.labelEn }));
  // Marathi catalogue labels help the lexical matcher when people write in Devanagari.
  const lexical = () => {
    const en = lexicalCandidateSkills({ text, lang, skillsCatalog });
    const mr = lexicalCandidateSkills({ text, lang, skillsCatalog: catalog.filter((s) => s.labelMr).map((s) => ({ id: s.id, labelEn: s.labelMr! })) });
    const known = new Set(catalog.map((s) => s.id));
    const aliasCatalog = Object.entries(ALIASES).filter(([id]) => known.has(id)).flatMap(([id, words]) => words.map((w) => ({ id, labelEn: w })));
    const alias = lexicalCandidateSkills({ text, lang, skillsCatalog: aliasCatalog });
    const best = new Map<SkillId, Proficiency>();
    for (const s of [...en, ...mr, ...alias]) best.set(s.skillId, Math.max(best.get(s.skillId) ?? 1, s.proficiency) as Proficiency);
    return [...best].map(([skillId, proficiency]) => ({ skillId, proficiency }));
  };
  if (!text.trim()) return { skills: [], via: "none" };

  if (allowAi && process.env.KS_CANDIDATE_AI !== "off") {
    try {
      const ex = getExtractor();
      const before = ex.router.attempts().length;
      const res = await Promise.race([ex.parseCandidateSkills({ text, lang, skillsCatalog }), timeout(AI_BUDGET_MS, null)]);
      // parseCandidateSkills falls back to lexical internally on failure; the router log tells us who answered.
      const answered = ex.router.attempts().slice(before).some((a) => a.ok);
      if (res && answered && res.length) return { skills: res, via: "ai" };
    } catch {
      /* fall through to the lexical matcher */
    }
  }
  const skills = lexical();
  return { skills, via: skills.length ? "words" : "none" };
}

// ---------------------------------------------------------------- ranking
export interface PathCourse {
  course: Course & { health: CourseHealth | null };
  where: "home" | "nearby" | "state";
  districtName: string;
  teaches: SkillId[];
}

export interface CareerPath {
  role: Role;
  have: SkillId[];
  gaps: SkillId[]; // 1-3 skills to add, most-needed first
  home: { demand: number; supply: number };
  nearbyDemand: number;
  nearbyNames: string[];
  course: PathCourse | null;
  score: number;
}

const NEARBY_WEIGHT = 0.35;

/** Demand for a role in one district is the demand for its core (first) skill there. */
function roleCell(role: Role, cells: Map<SkillId, DemandCell>): DemandCell | null {
  return (role.skills[0] && cells.get(role.skills[0])) || null;
}

export async function rankPaths(readers: Readers, opts: { lgd: string; held: HeldSkill[]; lang: Lang; catalog: Skill[] }): Promise<CareerPath[]> {
  const { lgd, held, lang } = opts;
  const known = new Set(opts.catalog.map((s) => s.id));
  const all = await readers.districts();
  const home = all.find((d) => d.district.lgd === lgd);
  if (!home) return [];
  const nearby = all.filter((d) => d.district.division === home.district.division && d.district.lgd !== lgd);
  const name = (d: DistrictSummary) => (lang === "mr" ? d.district.nameMr : d.district.nameEn);

  const cellsOf = async (code: string) => new Map((await readers.districtCells(code, 100)).map((c) => [c.skillId, c]));
  const [homeCells, nearbyCells, courses] = await Promise.all([
    cellsOf(lgd),
    Promise.all(nearby.map((d) => cellsOf(d.district.lgd))),
    readers.courses({ limit: 500 }),
  ]);
  const heldIds = new Set(held.map((h) => h.skillId));
  const districtName = new Map(all.map((d) => [d.district.lgd, name(d)]));
  const divisionOf = new Map(all.map((d) => [d.district.lgd, d.district.division]));

  const paths: CareerPath[] = [];
  for (const role of ROLES) {
    const skills = role.skills.filter((s) => known.has(s));
    if (!skills.length) continue;
    const r = { ...role, skills };
    const hc = roleCell(r, homeCells);
    const nearbyDemand = nearbyCells.reduce((s, m) => s + (roleCell(r, m)?.demand ?? 0), 0);
    const homeDemand = hc?.demand ?? 0;
    if (homeDemand + nearbyDemand <= 0) continue;
    const have = skills.filter((s) => heldIds.has(s));
    // Most-needed gaps first: the biggest local shortage (demand - supply).
    const gaps = skills
      .filter((s) => !heldIds.has(s))
      .sort((a, b) => (homeCells.get(b)?.gap ?? 0) - (homeCells.get(a)?.gap ?? 0))
      .slice(0, 3);
    const score = (homeDemand + NEARBY_WEIGHT * nearbyDemand) * (0.5 + have.length / skills.length);
    paths.push({
      role: r, have, gaps, score,
      home: { demand: homeDemand, supply: hc?.supply ?? 0 },
      nearbyDemand,
      nearbyNames: nearby.filter((_, i) => roleCell(r, nearbyCells[i]!)).map(name).slice(0, 3),
      course: null,
    });
  }
  // Roles sharing a core skill share one demand number, so keep one per core skill: the one
  // using most of the person's skills, ties to catalogue order (the broader role first).
  const perCore = new Map<SkillId, CareerPath>();
  for (const p of paths) {
    const core = p.role.skills[0]!;
    const cur = perCore.get(core);
    if (!cur || p.have.length > cur.have.length) perCore.set(core, p);
  }
  // Roles that use a skill the person has come first; then demand x overlap.
  const top = [...perCore.values()]
    .sort((a, b) => Number(b.have.length > 0) - Number(a.have.length > 0) || b.score - a.score)
    .slice(0, 3);

  // Nearest course with seats that teaches the gaps (or the role's core skill if no gaps).
  for (const p of top) {
    const want = p.gaps.length ? p.gaps : p.role.skills.slice(0, 1);
    const candidates = courses
      .filter((c) => c.seats > 0)
      .map((c) => ({ c, teaches: want.filter((s) => c.skills.some((k) => k.skillId === s)) }))
      .filter((x) => x.teaches.length);
    const rank = (c: Course) => (c.lgd === lgd ? 0 : divisionOf.get(c.lgd) === home.district.division ? 1 : 2);
    candidates.sort((a, b) => rank(a.c) - rank(b.c) || b.teaches.length - a.teaches.length || b.c.seats - a.c.seats);
    const best = candidates[0];
    if (best) {
      const r = rank(best.c);
      p.course = { course: best.c, where: r === 0 ? "home" : r === 1 ? "nearby" : "state", districtName: districtName.get(best.c.lgd) ?? best.c.lgd, teaches: best.teaches };
    }
  }
  return top;
}

/** "solar-pv-installation:2,industrial-wiring:3" <-> HeldSkill[] (the only state, kept in the URL). */
export function encodeHeld(skills: HeldSkill[]): string {
  return skills.map((s) => `${s.skillId}:${s.proficiency}`).join(",");
}
export function decodeHeld(raw: string | undefined, known: Set<string>): HeldSkill[] {
  if (!raw) return [];
  const out: HeldSkill[] = [];
  for (const part of raw.split(",").slice(0, 20)) {
    const [id, p] = part.split(":");
    const prof = Number(p);
    if (id && known.has(id) && prof >= 1 && prof <= 4) out.push({ skillId: id, proficiency: prof as Proficiency });
  }
  return out;
}
