// Reference data: geography, taxonomy, sources. All tables live in the `ks` schema;
// the legacy app's `public` tables are never touched.
import {
  boolean, customType, doublePrecision, index, integer, jsonb, pgSchema, primaryKey, smallint, text, timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const ks = pgSchema("ks");

/** pgvector column. The extension lives in the `extensions` schema on Supabase. */
export const vector = customType<{ data: number[]; driverData: string; config: { dimensions: number } }>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 768})`;
  },
  toDriver(value) {
    return `[${value.join(",")}]`;
  },
  fromDriver(value) {
    return value.slice(1, -1).split(",").map(Number);
  },
});

export const geoDistrict = ks.table("geo_district", {
  lgdCode: text("lgd_code").primaryKey(),
  nameEn: text("name_en").notNull(),
  nameMr: text("name_mr").notNull(),
  division: text("division").notNull(),
  population: integer("population"),
  isAspirational: boolean("is_aspirational").notNull().default(false),
  census2011: text("census2011"),
  geom: jsonb("geom"), // GeoJSON geometry (simplified); PostGIS is not required
  geomNote: text("geom_note"),
});

export const geoAlias = ks.table("geo_alias", {
  alias: text("alias").notNull(),
  lgdCode: text("lgd_code").notNull().references(() => geoDistrict.lgdCode),
  source: text("source").notNull().default("curated"),
}, (t) => [primaryKey({ columns: [t.alias, t.lgdCode] })]);

/** Pincode → district cache, filled by the India Post adapter. */
export const geoPincode = ks.table("geo_pincode", {
  pincode: text("pincode").primaryKey(),
  lgdCode: text("lgd_code").references(() => geoDistrict.lgdCode),
  districtName: text("district_name"),
  state: text("state"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

export const occupation = ks.table("occupation", {
  ncoCode: text("nco_code").primaryKey(),
  titleEn: text("title_en").notNull(),
  titleMr: text("title_mr"),
  nsqfLevel: smallint("nsqf_level"),
  sector: text("sector").notNull(),
});

export const skill = ks.table("skill", {
  id: text("id").primaryKey(),
  escoUri: text("esco_uri"),
  labelEn: text("label_en").notNull(),
  labelMr: text("label_mr"),
  kind: text("kind").notNull(), // knowledge | skill | tool | transversal
  sector: text("sector"),
  embedding: vector("embedding", { dimensions: 768 }),
});

export const skillAlias = ks.table("skill_alias", {
  alias: text("alias").notNull(),
  skillId: text("skill_id").notNull().references(() => skill.id, { onDelete: "cascade" }),
  lang: text("lang").notNull().default("en"),
  source: text("source").notNull().default("curated"),
  confidence: doublePrecision("confidence").notNull().default(1),
}, (t) => [primaryKey({ columns: [t.alias, t.skillId] })]);

/** P(skill at >= proficiency | occupation): the occupation skill profile. */
export const occupationSkill = ks.table("occupation_skill", {
  ncoCode: text("nco_code").notNull().references(() => occupation.ncoCode, { onDelete: "cascade" }),
  skillId: text("skill_id").notNull().references(() => skill.id, { onDelete: "cascade" }),
  weight: doublePrecision("weight").notNull(),
  proficiency: smallint("proficiency").notNull(),
  essential: boolean("essential").notNull().default(false),
}, (t) => [primaryKey({ columns: [t.ncoCode, t.skillId] })]);

export const qualification = ks.table("qualification", {
  qpCode: text("qp_code").primaryKey(),
  title: text("title").notNull(),
  nsqfLevel: smallint("nsqf_level"),
  sectorSsc: text("sector_ssc"),
  hours: integer("hours"),
  ncoCode: text("nco_code").references(() => occupation.ncoCode),
  trainerQualification: text("trainer_qualification"),
  equipment: jsonb("equipment").$type<string[]>(),
});

export const qpSkill = ks.table("qp_skill", {
  qpCode: text("qp_code").notNull().references(() => qualification.qpCode, { onDelete: "cascade" }),
  skillId: text("skill_id").notNull().references(() => skill.id, { onDelete: "cascade" }),
  proficiency: smallint("proficiency").notNull(),
  hours: integer("hours").notNull(),
  module: text("module"),
}, (t) => [primaryKey({ columns: [t.qpCode, t.skillId] })]);

export const nicNcoXwalk = ks.table("nic_nco_xwalk", {
  nic5: text("nic5").notNull(),
  ncoCode: text("nco_code").notNull().references(() => occupation.ncoCode, { onDelete: "cascade" }),
  share: doublePrecision("share").notNull(),
  employmentPerUnit: doublePrecision("employment_per_unit").notNull(),
  nicTitle: text("nic_title"),
  sector: text("sector"),
  reviewedBy: text("reviewed_by"),
}, (t) => [primaryKey({ columns: [t.nic5, t.ncoCode] })]);

export const source = ks.table("source", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(), // postings | udyam | taxonomy | geocoding | supply | trend | survey
  name: text("name").notNull(),
  licence: text("licence").notNull(),
  url: text("url"),
  freshnessSlaHours: integer("freshness_sla_hours").notNull(),
  weightDefault: doublePrecision("weight_default"),
  notes: text("notes"),
});

export const sourceHealth = ks.table("source_health", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  sourceId: text("source_id").notNull().references(() => source.id),
  runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
  ok: boolean("ok").notNull(),
  rows: integer("rows").notNull().default(0),
  requests: integer("requests").notNull().default(0),
  latencyMs: integer("latency_ms"),
  note: text("note"),
  cursor: jsonb("cursor"),
});

/** Immutable raw payloads. Deduped on (source_id, external_id). */
export const rawRecord = ks.table("raw_record", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  sourceId: text("source_id").notNull().references(() => source.id),
  externalId: text("external_id").notNull(),
  payload: jsonb("payload").notNull(),
  contentHash: text("content_hash").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("raw_record_source_ext_uq").on(t.sourceId, t.externalId), index("raw_record_hash_idx").on(t.contentHash)]);

export const pipelineRun = ks.table("pipeline_run", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  command: text("command").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  ok: boolean("ok"),
  stats: jsonb("stats"),
});
