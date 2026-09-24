// Workflow: curriculum PRs, employer reviews, training plans, the review queue.
import { boolean, doublePrecision, index, jsonb, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { employer } from "./demand";
import { geoDistrict, ks } from "./reference";
import { course } from "./supply";

/** Lifecycle: draft → employer-validated → approved → adopted. */
export const curriculumPr = ks.table("curriculum_pr", {
  id: text("id").primaryKey(),
  courseId: text("course_id").notNull().references(() => course.id, { onDelete: "cascade" }),
  target: text("target").notNull(), // state-course | add-on-module | recommendation
  status: text("status").notNull().default("draft"),
  diff: jsonb("diff").notNull(),
  rationale: text("rationale").notNull(),
  approverBody: text("approver_body").notNull(), // MSBSVET | IMC | DGT / SSC
  trainerDelta: jsonb("trainer_delta").notNull().default([]),
  equipmentDelta: jsonb("equipment_delta").notNull().default([]),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  validatedAt: timestamp("validated_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  adoptedAt: timestamp("adopted_at", { withTimezone: true }),
  isDemo: boolean("is_demo").notNull().default(false),
}, (t) => [index("pr_course_idx").on(t.courseId)]);

/** Which employers a PR is routed to (their inbox). */
export const prRoute = ks.table("pr_route", {
  prId: text("pr_id").notNull().references(() => curriculumPr.id, { onDelete: "cascade" }),
  employerId: uuid("employer_id").notNull().references(() => employer.id, { onDelete: "cascade" }),
  routedAt: timestamp("routed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.prId, t.employerId] })]);

export const prReview = ks.table("pr_review", {
  prId: text("pr_id").notNull().references(() => curriculumPr.id, { onDelete: "cascade" }),
  employerId: uuid("employer_id").notNull().references(() => employer.id, { onDelete: "cascade" }),
  verdict: text("verdict").notNull(), // endorse | change | irrelevant
  comment: text("comment"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.prId, t.employerId] })]);

export const trainingPlan = ks.table("training_plan", {
  id: uuid("id").primaryKey().defaultRandom(),
  lgdCode: text("lgd_code").notNull().references(() => geoDistrict.lgdCode),
  fy: text("fy").notNull(),
  inputs: jsonb("inputs").notNull(),
  solution: jsonb("solution").notNull(),
  objective: doublePrecision("objective").notNull(),
  status: text("status").notNull(), // optimal | infeasible | error
  signedBy: text("signed_by"),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("plan_lgd_fy_idx").on(t.lgdCode, t.fy, t.createdAt)]);

/** Low-confidence extractions, unknown skills, suspected duplicates. */
export const reviewItem = ks.table("review_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(), // unknown-skill | low-confidence | duplicate | geo | survey-verify
  refId: text("ref_id").notNull(),
  payload: jsonb("payload").notNull(),
  status: text("status").notNull().default("open"), // open | approved | rejected
  decidedBy: text("decided_by"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("review_status_idx").on(t.status, t.kind)]);
