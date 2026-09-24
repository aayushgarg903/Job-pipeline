// Fixture implementation of the Readers port (packages/contracts/src/ports.ts).
// Realistic demo data for Pune, Nashik and Gadchiroli, filler for the other districts.
// Everything is isDemo = true, so every card carries the SPECIMEN watermark.
import type { CourseFlag, Readers, StateOverview } from "@ks/contracts";
import { AS_OF, DISTRICTS } from "./fixtures/base";
import { COURSES, PLAN_INPUTS, PRS, SAVED_PLANS } from "./fixtures/courses";
import { EVIDENCE, OUTCOMES, POSTINGS, RADAR, SOURCES, evidenceFor } from "./fixtures/signals";
import { CELLS, OCCUPATIONS, SKILLS, deltaOf, skillById, summaryOf, trendOf } from "./fixtures/skills";

export { DISTRICTS, FOCUS, AS_OF } from "./fixtures/base";
export { SKILLS } from "./fixtures/skills";
export { COURSES, PRS } from "./fixtures/courses";
export { EVIDENCE } from "./fixtures/signals";

const clone = <T>(v: T): T => structuredClone(v);
const nonNull = <T>(v: T | null): v is T => v !== null;

export const fixtureReaders: Readers = {
  async stateOverview(): Promise<StateOverview> {
    const summaries = DISTRICTS.map((d) => summaryOf(d.lgd)).filter(nonNull);
    const flagCounts: Record<CourseFlag, number> = { HEALTHY: 802, REVISE: 391, OVERSUPPLIED: 143, OBSOLETE: 82 };
    return {
      asOf: AS_OF,
      districts: DISTRICTS.length,
      postingsThisQuarter: summaries.reduce((s, d) => s + d.postings, 0),
      employersHeard: 1184,
      coursesTracked: Object.values(flagCounts).reduce((a, b) => a + b, 0),
      flagCounts,
      isDemo: true,
    };
  },

  async districts() {
    return DISTRICTS.map((d) => summaryOf(d.lgd)).filter(nonNull);
  },

  async district(lgd) {
    return summaryOf(lgd);
  },

  async districtCells(lgd, limit = 20) {
    return clone(CELLS.filter((c) => c.lgd === lgd).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)).slice(0, limit));
  },

  async skill(id) {
    return clone(skillById.get(id) ?? null);
  },

  async skillCells(id) {
    return clone(CELLS.filter((c) => c.skillId === id));
  },

  async skillTrend(id) {
    return skillById.has(id) ? trendOf(id) : [];
  },

  async topSkills({ lgd, by, limit }) {
    const pool = CELLS.filter((c) => !lgd || c.lgd === lgd);
    const agg = new Map<string, { gap: number; sdi: number; n: number; delta: number }>();
    for (const c of pool) {
      const a = agg.get(c.skillId) ?? { gap: 0, sdi: 0, n: 0, delta: 0 };
      a.gap += c.gap;
      a.sdi += c.sdi;
      a.delta += deltaOf(c.lgd, c.skillId);
      a.n += 1;
      agg.set(c.skillId, a);
    }
    const rows = [...agg.entries()].map(([id, a]) => ({ ...skillById.get(id)!, gap: a.gap, sdi: Math.round(a.sdi / a.n), delta: Math.round(a.delta / a.n) }));
    const key = by === "shortage" ? (r: (typeof rows)[number]) => -r.gap : by === "surplus" ? (r: (typeof rows)[number]) => r.gap : (r: (typeof rows)[number]) => -r.delta;
    return rows.sort((a, b) => key(a) - key(b)).slice(0, limit);
  },

  async searchSkills(q, limit = 10) {
    const n = q.trim().toLowerCase();
    if (!n) return clone(SKILLS.slice(0, limit));
    return clone(SKILLS.filter((s) => s.labelEn.toLowerCase().includes(n) || (s.labelMr ?? "").includes(q.trim()) || s.id.includes(n)).slice(0, limit));
  },

  async occupation(nco) {
    return clone(OCCUPATIONS.find((o) => o.nco === nco) ?? null);
  },

  async courses({ lgd, flag, limit = 50 }) {
    return clone(COURSES.filter((c) => (!lgd || c.lgd === lgd) && (!flag || c.health.flags.includes(flag as CourseFlag))).slice(0, limit));
  },

  async course(id) {
    return clone(COURSES.find((c) => c.id === id) ?? null);
  },

  async coursePrs(courseId) {
    return clone(PRS.filter((p) => p.courseId === courseId));
  },

  async pr(id) {
    return clone(PRS.find((p) => p.id === id) ?? null);
  },

  async employerInbox(_employerId) {
    return clone(PRS.filter((p) => p.status === "draft" || p.status === "employer-validated"));
  },

  async evidence(ref, limit = 20) {
    const rows = evidenceFor(ref, (id) => COURSES.find((c) => c.id === id)?.lgd ?? null);
    return (rows.length ? rows : EVIDENCE.slice(-1).map(({ lgd: _l, skillId: _s, ...r }) => r)).slice(0, limit);
  },

  async postings({ lgd, skillId, limit }) {
    return POSTINGS.filter((p) => (!lgd || p.lgd === lgd) && (!skillId || p.skills.includes(skillId)))
      .slice(0, limit)
      .map(({ skills: _s, ...p }) => p);
  },

  async planInput(lgd, fy) {
    return clone(PLAN_INPUTS.find((p) => p.lgd === lgd && p.fy === fy) ?? null);
  },

  async savedPlan(lgd, fy) {
    const hit = SAVED_PLANS.find((p) => p.lgd === lgd && p.fy === fy);
    if (!hit) return null;
    const { lgd: _l, fy: _f, ...rest } = hit;
    return clone(rest);
  },

  async radar() {
    return clone(RADAR);
  },

  async sources() {
    return clone(SOURCES);
  },

  async outcomes() {
    return clone(OUTCOMES);
  },
};
