// Demand-side evidence: employers, postings, Udyam registrations, surveys, consultations.
import {
  boolean, date, doublePrecision, index, integer, jsonb, primaryKey, smallint, text, timestamp, uuid,
} from "drizzle-orm/pg-core";
import { geoDistrict, ks, occupation, rawRecord, skill, source } from "./reference";

const audit = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const employer = ks.table("employer", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  udyamNo: text("udyam_no"),
  nicCode: text("nic_code"),
  lgdCode: text("lgd_code").references(() => geoDistrict.lgdCode),
  sector: text("sector"),
  sizeBand: text("size_band"), // micro | small | medium | large
  verified: boolean("verified").notNull().default(false),
  isDemo: boolean("is_demo").notNull().default(false),
  ...audit,
}, (t) => [index("employer_name_lgd_idx").on(t.name, t.lgdCode)]);

export const posting = ks.table("posting", {
  id: text("id").primaryKey(), // `${source}:${external_id}`
  rawId: integer("raw_id").references(() => rawRecord.id),
  sourceId: text("source_id").notNull().references(() => source.id),
  title: text("title").notNull(),
  employerId: uuid("employer_id").references(() => employer.id),
  employerName: text("employer_name").notNull(),
  city: text("city"),
  lgdCode: text("lgd_code").references(() => geoDistrict.lgdCode),
  geoConfidence: doublePrecision("geo_confidence"),
  geoMethod: text("geo_method"), // pincode | alias | nominatim | none
  ncoCode: text("nco_code").references(() => occupation.ncoCode),
  ncoConfidence: doublePrecision("nco_confidence"),
  workMode: text("work_mode").notNull().default("unknown"),
  expMin: doublePrecision("exp_min"),
  expMax: doublePrecision("exp_max"),
  salaryMin: doublePrecision("salary_min"),
  salaryMax: doublePrecision("salary_max"),
  postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
  url: text("url"),
  description: text("description").notNull(),
  descriptionHash: text("description_hash").notNull(),
  canonicalPostingId: text("canonical_posting_id"),
  isDuplicate: boolean("is_duplicate").notNull().default(false),
  extractedAt: timestamp("extracted_at", { withTimezone: true }),
  ...audit,
}, (t) => [
  index("posting_lgd_idx").on(t.lgdCode, t.postedAt),
  index("posting_hash_idx").on(t.descriptionHash),
]);

export const postingSkill = ks.table("posting_skill", {
  postingId: text("posting_id").notNull().references(() => posting.id, { onDelete: "cascade" }),
  skillId: text("skill_id").notNull().references(() => skill.id),
  rawText: text("raw_text").notNull(),
  requirement: text("requirement").notNull(), // required | preferred | optional
  proficiency: smallint("proficiency"),
  years: doublePrecision("years"),
  evidenceSentence: text("evidence_sentence").notNull(),
  negated: boolean("negated").notNull().default(false),
  confidence: doublePrecision("confidence").notNull(),
  modelId: text("model_id").notNull(),
  extractedAt: timestamp("extracted_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.postingId, t.skillId] }), index("posting_skill_skill_idx").on(t.skillId)]);

/**
 * Udyam registrations by month × district × NIC-5.
 * method = 'rows' (aggregated from fetched rows) | 'apportioned' (district total from the API `total`
 * field, split by the NIC/month mix observed in the sampled rows).
 */
export const udyamFact = ks.table("udyam_fact", {
  month: date("month").notNull(),
  lgdCode: text("lgd_code").notNull().references(() => geoDistrict.lgdCode),
  nic5: text("nic5").notNull(),
  registrations: doublePrecision("registrations").notNull(),
  cumulative: doublePrecision("cumulative"),
  method: text("method").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.month, t.lgdCode, t.nic5] })]);

/** District-level Udyam totals read from the API `total` field (the fallback path). */
export const udyamDistrictTotal = ks.table("udyam_district_total", {
  lgdCode: text("lgd_code").primaryKey().references(() => geoDistrict.lgdCode),
  districtName: text("district_name").notNull(),
  total: integer("total").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

export const surveyResponse = ks.table("survey_response", {
  id: uuid("id").primaryKey().defaultRandom(),
  employerId: uuid("employer_id").notNull().references(() => employer.id),
  lgdCode: text("lgd_code").notNull().references(() => geoDistrict.lgdCode),
  ncoCode: text("nco_code").notNull().references(() => occupation.ncoCode),
  sector: text("sector").notNull(),
  expectedHires12m: integer("expected_hires_12m").notNull(),
  postingToHireRatio: doublePrecision("posting_to_hire_ratio"),
  csatRecentHires: smallint("csat_recent_hires"),
  weeksToProductivity: doublePrecision("weeks_to_productivity"),
  comment: text("comment"),
  collectedAt: timestamp("collected_at", { withTimezone: true }).notNull().defaultNow(),
  isDemo: boolean("is_demo").notNull().default(false),
  /** Survey demand never counts until verified (Architecture §6.1 anti-gaming). */
  verified: boolean("verified").notNull().default(false),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  /** DPDP Act 2023 s.6 consent record (SurveyInput.consent). */
  consentAt: timestamp("consent_at", { withTimezone: true }),
  consentNoticeVersion: text("consent_notice_version"),
  consentPurpose: text("consent_purpose"),
}, (t) => [index("survey_lgd_idx").on(t.lgdCode)]);

export const surveySkill = ks.table("survey_skill", {
  responseId: uuid("response_id").notNull().references(() => surveyResponse.id, { onDelete: "cascade" }),
  skillId: text("skill_id").notNull().references(() => skill.id),
  importance: text("importance").notNull(), // mandatory | preferred | nice
  proficiency: smallint("proficiency").notNull(),
}, (t) => [primaryKey({ columns: [t.responseId, t.skillId] })]);

export const consultation = ks.table("consultation", {
  id: uuid("id").primaryKey().defaultRandom(),
  lgdCode: text("lgd_code").notNull().references(() => geoDistrict.lgdCode),
  sector: text("sector").notNull(),
  minutesText: text("minutes_text").notNull(),
  extracted: jsonb("extracted"),
  heldOn: date("held_on").notNull(),
  isDemo: boolean("is_demo").notNull().default(false),
});
