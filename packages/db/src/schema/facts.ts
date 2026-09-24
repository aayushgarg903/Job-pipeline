// Analytical facts, rebuilt by `pnpm ingest facts`. Grain is the QUARTER ("2026-Q3"),
// which is what the engine and the contract (DemandCell.quarter) speak.
import { doublePrecision, index, integer, jsonb, primaryKey, smallint, text, timestamp } from "drizzle-orm/pg-core";
import { ks } from "./reference";

/** One signal's contribution, already in expected-hires-over-12-months units. */
export const demandFact = ks.table("demand_fact", {
  quarter: text("quarter").notNull(),
  lgdCode: text("lgd_code").notNull(),
  ncoCode: text("nco_code").notNull(),
  signal: text("signal").notNull(), // postings | surveys | consultations | udyam
  n: doublePrecision("n").notNull(), // observations
  hires12m: doublePrecision("hires_12m").notNull(),
}, (t) => [primaryKey({ columns: [t.quarter, t.lgdCode, t.ncoCode, t.signal] })]);

export const supplyFact = ks.table("supply_fact", {
  quarter: text("quarter").notNull(),
  lgdCode: text("lgd_code").notNull(),
  skillId: text("skill_id").notNull(),
  proficiency: smallint("proficiency").notNull(),
  graduatesExpected: doublePrecision("graduates_expected").notNull(),
  placedRate: doublePrecision("placed_rate"),
  estimatedShare: doublePrecision("estimated_share").notNull().default(0), // share from apportioned estimates
}, (t) => [primaryKey({ columns: [t.quarter, t.lgdCode, t.skillId, t.proficiency] })]);

/** The engine output per district × skill × proficiency × quarter (contract DemandCell). */
export const demandCell = ks.table("demand_cell", {
  quarter: text("quarter").notNull(),
  lgdCode: text("lgd_code").notNull(),
  skillId: text("skill_id").notNull(),
  proficiency: smallint("proficiency").notNull(),
  demand: doublePrecision("demand").notNull(),
  supply: doublePrecision("supply").notNull(),
  gap: doublePrecision("gap").notNull(),
  ratio: doublePrecision("ratio").notNull(),
  sdi: doublePrecision("sdi").notNull(),
  ciLow: doublePrecision("ci_low").notNull(),
  ciHigh: doublePrecision("ci_high").notNull(),
  coverage: doublePrecision("coverage").notNull(),
}, (t) => [
  primaryKey({ columns: [t.quarter, t.lgdCode, t.skillId, t.proficiency] }),
  index("demand_cell_skill_idx").on(t.skillId, t.quarter),
]);

/** Occupation-level demand vs supply in people (drives Mismatch and seat planning). */
export const occupationCell = ks.table("occupation_cell", {
  quarter: text("quarter").notNull(),
  lgdCode: text("lgd_code").notNull(),
  ncoCode: text("nco_code").notNull(),
  demand: doublePrecision("demand").notNull(),
  supply: doublePrecision("supply").notNull(),
}, (t) => [primaryKey({ columns: [t.quarter, t.lgdCode, t.ncoCode] })]);

export const districtMetric = ks.table("district_metric", {
  quarter: text("quarter").notNull(),
  lgdCode: text("lgd_code").notNull(),
  mismatch: doublePrecision("mismatch").notNull(),
  coverage: doublePrecision("coverage").notNull(),
  postings: integer("postings").notNull(),
  udyamNew12m: doublePrecision("udyam_new_12m").notNull(),
  sources: jsonb("sources").notNull(), // Provenance.sources
  isDemo: smallint("is_demo").notNull().default(0), // 1 when any contributing row is demo
}, (t) => [primaryKey({ columns: [t.quarter, t.lgdCode] })]);

export const courseHealth = ks.table("course_health", {
  courseId: text("course_id").notNull(),
  quarter: text("quarter").notNull(),
  relevance: doublePrecision("relevance").notNull(),
  outcomes: doublePrecision("outcomes").notNull(),
  currency: doublePrecision("currency").notNull(),
  validation: doublePrecision("validation").notNull(),
  total: doublePrecision("total").notNull(),
  flags: text("flags").array().notNull(),
  placementRate: doublePrecision("placement_rate"),
  missingSkills: text("missing_skills").array().notNull(),
  decliningSkills: text("declining_skills").array().notNull(),
  unassessedSkills: text("unassessed_skills").array().notNull(),
  explain: text("explain").array().notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.courseId, t.quarter] })]);

/** Emerging-tech Radar: curated terms with a real global series (OpenAlex works per year). */
export const radarTerm = ks.table("radar_term", {
  term: text("term").primaryKey(),
  skillId: text("skill_id"),
  global: jsonb("global").notNull().$type<Array<{ period: string; value: number }>>(),
  globalSource: text("global_source").notNull(),
  note: text("note").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});
