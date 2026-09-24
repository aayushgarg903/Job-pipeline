// Supply side: institutions, courses, cohorts, trainers, equipment, and state-level estimates.
import { boolean, date, doublePrecision, index, integer, jsonb, primaryKey, smallint, text, timestamp } from "drizzle-orm/pg-core";
import { geoDistrict, ks, occupation, skill } from "./reference";

export const institution = ks.table("institution", {
  id: text("id").primaryKey(), // stable slug, e.g. "iti-pune-aundh"
  name: text("name").notNull(),
  type: text("type").notNull(), // ITI | poly | PMKVY-TC | college
  lgdCode: text("lgd_code").notNull().references(() => geoDistrict.lgdCode),
  town: text("town"),
  ownership: text("ownership"), // govt | private
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("institution_lgd_idx").on(t.lgdCode)]);

export const course = ks.table("course", {
  id: text("id").primaryKey(),
  institutionId: text("institution_id").notNull().references(() => institution.id, { onDelete: "cascade" }),
  code: text("code").notNull(), // NCVT trade code or NSQF QP code
  name: text("name").notNull(),
  kind: text("kind").notNull(), // ITI | PMKVY | polytechnic | state
  sector: text("sector").notNull(),
  targetNco: text("target_nco").notNull().references(() => occupation.ncoCode),
  seats: integer("seats").notNull(),
  durationHours: integer("duration_hours").notNull(),
  trainerQualification: text("trainer_qualification"),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("course_inst_idx").on(t.institutionId)]);

export const courseSkill = ks.table("course_skill", {
  courseId: text("course_id").notNull().references(() => course.id, { onDelete: "cascade" }),
  skillId: text("skill_id").notNull().references(() => skill.id),
  proficiency: smallint("proficiency").notNull(),
  hours: integer("hours").notNull(),
  module: text("module").notNull(),
}, (t) => [primaryKey({ columns: [t.courseId, t.skillId] }), index("course_skill_skill_idx").on(t.skillId)]);

/** Flags demanded-but-never-assessed skills. */
export const assessmentItem = ks.table("assessment_item", {
  courseId: text("course_id").notNull().references(() => course.id, { onDelete: "cascade" }),
  skillId: text("skill_id").notNull().references(() => skill.id),
  method: text("method").notNull(), // theory | practical | viva | project
  weight: doublePrecision("weight").notNull(),
}, (t) => [primaryKey({ columns: [t.courseId, t.skillId, t.method] })]);

export const courseCohort = ks.table("course_cohort", {
  courseId: text("course_id").notNull().references(() => course.id, { onDelete: "cascade" }),
  fy: text("fy").notNull(), // "FY25"
  enrolled: integer("enrolled").notNull(),
  completed: integer("completed").notNull(),
  placed3m: integer("placed_3m").notNull(),
  placed6m: integer("placed_6m").notNull(),
  medianWage: integer("median_wage"),
  isDemo: boolean("is_demo").notNull().default(false),
}, (t) => [primaryKey({ columns: [t.courseId, t.fy] })]);

export const trainer = ks.table("trainer", {
  id: text("id").primaryKey(),
  institutionId: text("institution_id").notNull().references(() => institution.id, { onDelete: "cascade" }),
  qualification: text("qualification").notNull(),
  qpCodes: text("qp_codes").array().notNull().default([]),
  certifiedUntil: date("certified_until"),
  isDemo: boolean("is_demo").notNull().default(false),
});

export const equipment = ks.table("equipment", {
  id: text("id").primaryKey(),
  institutionId: text("institution_id").notNull().references(() => institution.id, { onDelete: "cascade" }),
  courseId: text("course_id").references(() => course.id, { onDelete: "cascade" }),
  itemCode: text("item_code").notNull(),
  item: text("item").notNull(),
  qty: integer("qty").notNull(),
  condition: text("condition").notNull(), // good | fair | poor
  unitCost: integer("unit_cost"),
  isDemo: boolean("is_demo").notNull().default(false),
});

/**
 * State-level supply (PMKVY / ITI) apportioned to districts by Udyam weights.
 * Always estimated: provenance.method explains the apportioning.
 */
export const supplyEstimate = ks.table("supply_estimate", {
  fy: text("fy").notNull(),
  lgdCode: text("lgd_code").notNull().references(() => geoDistrict.lgdCode),
  scheme: text("scheme").notNull(), // PMKVY | ITI
  ncoCode: text("nco_code").notNull().references(() => occupation.ncoCode),
  trained: doublePrecision("trained").notNull(),
  placed: doublePrecision("placed"),
  provenance: jsonb("provenance").notNull(),
  isEstimated: boolean("is_estimated").notNull().default(true),
}, (t) => [primaryKey({ columns: [t.fy, t.lgdCode, t.scheme, t.ncoCode] })]);
