CREATE SCHEMA "ks";
--> statement-breakpoint
CREATE TABLE "ks"."geo_alias" (
	"alias" text NOT NULL,
	"lgd_code" text NOT NULL,
	"source" text DEFAULT 'curated' NOT NULL,
	CONSTRAINT "geo_alias_alias_lgd_code_pk" PRIMARY KEY("alias","lgd_code")
);
--> statement-breakpoint
CREATE TABLE "ks"."geo_district" (
	"lgd_code" text PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_mr" text NOT NULL,
	"division" text NOT NULL,
	"population" integer,
	"is_aspirational" boolean DEFAULT false NOT NULL,
	"census2011" text,
	"geom" jsonb,
	"geom_note" text
);
--> statement-breakpoint
CREATE TABLE "ks"."geo_pincode" (
	"pincode" text PRIMARY KEY NOT NULL,
	"lgd_code" text,
	"district_name" text,
	"state" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ks"."nic_nco_xwalk" (
	"nic5" text NOT NULL,
	"nco_code" text NOT NULL,
	"share" double precision NOT NULL,
	"employment_per_unit" double precision NOT NULL,
	"nic_title" text,
	"sector" text,
	"reviewed_by" text,
	CONSTRAINT "nic_nco_xwalk_nic5_nco_code_pk" PRIMARY KEY("nic5","nco_code")
);
--> statement-breakpoint
CREATE TABLE "ks"."occupation" (
	"nco_code" text PRIMARY KEY NOT NULL,
	"title_en" text NOT NULL,
	"title_mr" text,
	"nsqf_level" smallint,
	"sector" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ks"."occupation_skill" (
	"nco_code" text NOT NULL,
	"skill_id" text NOT NULL,
	"weight" double precision NOT NULL,
	"proficiency" smallint NOT NULL,
	"essential" boolean DEFAULT false NOT NULL,
	CONSTRAINT "occupation_skill_nco_code_skill_id_pk" PRIMARY KEY("nco_code","skill_id")
);
--> statement-breakpoint
CREATE TABLE "ks"."pipeline_run" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ks"."pipeline_run_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"command" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"ok" boolean,
	"stats" jsonb
);
--> statement-breakpoint
CREATE TABLE "ks"."qp_skill" (
	"qp_code" text NOT NULL,
	"skill_id" text NOT NULL,
	"proficiency" smallint NOT NULL,
	"hours" integer NOT NULL,
	"module" text,
	CONSTRAINT "qp_skill_qp_code_skill_id_pk" PRIMARY KEY("qp_code","skill_id")
);
--> statement-breakpoint
CREATE TABLE "ks"."qualification" (
	"qp_code" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"nsqf_level" smallint,
	"sector_ssc" text,
	"hours" integer,
	"nco_code" text,
	"trainer_qualification" text,
	"equipment" jsonb
);
--> statement-breakpoint
CREATE TABLE "ks"."raw_record" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ks"."raw_record_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"source_id" text NOT NULL,
	"external_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ks"."skill" (
	"id" text PRIMARY KEY NOT NULL,
	"esco_uri" text,
	"label_en" text NOT NULL,
	"label_mr" text,
	"kind" text NOT NULL,
	"sector" text,
	"embedding" vector(768)
);
--> statement-breakpoint
CREATE TABLE "ks"."skill_alias" (
	"alias" text NOT NULL,
	"skill_id" text NOT NULL,
	"lang" text DEFAULT 'en' NOT NULL,
	"source" text DEFAULT 'curated' NOT NULL,
	"confidence" double precision DEFAULT 1 NOT NULL,
	CONSTRAINT "skill_alias_alias_skill_id_pk" PRIMARY KEY("alias","skill_id")
);
--> statement-breakpoint
CREATE TABLE "ks"."source" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"licence" text NOT NULL,
	"url" text,
	"freshness_sla_hours" integer NOT NULL,
	"weight_default" double precision,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "ks"."source_health" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ks"."source_health_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"source_id" text NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ok" boolean NOT NULL,
	"rows" integer DEFAULT 0 NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer,
	"note" text,
	"cursor" jsonb
);
--> statement-breakpoint
CREATE TABLE "ks"."consultation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lgd_code" text NOT NULL,
	"sector" text NOT NULL,
	"minutes_text" text NOT NULL,
	"extracted" jsonb,
	"held_on" date NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ks"."employer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"udyam_no" text,
	"nic_code" text,
	"lgd_code" text,
	"sector" text,
	"size_band" text,
	"verified" boolean DEFAULT false NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ks"."posting" (
	"id" text PRIMARY KEY NOT NULL,
	"raw_id" integer,
	"source_id" text NOT NULL,
	"title" text NOT NULL,
	"employer_id" uuid,
	"employer_name" text NOT NULL,
	"city" text,
	"lgd_code" text,
	"geo_confidence" double precision,
	"geo_method" text,
	"nco_code" text,
	"nco_confidence" double precision,
	"work_mode" text DEFAULT 'unknown' NOT NULL,
	"exp_min" double precision,
	"exp_max" double precision,
	"salary_min" double precision,
	"salary_max" double precision,
	"posted_at" timestamp with time zone NOT NULL,
	"url" text,
	"description" text NOT NULL,
	"description_hash" text NOT NULL,
	"canonical_posting_id" text,
	"is_duplicate" boolean DEFAULT false NOT NULL,
	"extracted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ks"."posting_skill" (
	"posting_id" text NOT NULL,
	"skill_id" text NOT NULL,
	"raw_text" text NOT NULL,
	"requirement" text NOT NULL,
	"proficiency" smallint,
	"years" double precision,
	"evidence_sentence" text NOT NULL,
	"negated" boolean DEFAULT false NOT NULL,
	"confidence" double precision NOT NULL,
	"model_id" text NOT NULL,
	"extracted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posting_skill_posting_id_skill_id_pk" PRIMARY KEY("posting_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "ks"."survey_response" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employer_id" uuid NOT NULL,
	"lgd_code" text NOT NULL,
	"nco_code" text NOT NULL,
	"sector" text NOT NULL,
	"expected_hires_12m" integer NOT NULL,
	"posting_to_hire_ratio" double precision,
	"csat_recent_hires" smallint,
	"weeks_to_productivity" double precision,
	"comment" text,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ks"."survey_skill" (
	"response_id" uuid NOT NULL,
	"skill_id" text NOT NULL,
	"importance" text NOT NULL,
	"proficiency" smallint NOT NULL,
	CONSTRAINT "survey_skill_response_id_skill_id_pk" PRIMARY KEY("response_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "ks"."udyam_district_total" (
	"lgd_code" text PRIMARY KEY NOT NULL,
	"district_name" text NOT NULL,
	"total" integer NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ks"."udyam_fact" (
	"month" date NOT NULL,
	"lgd_code" text NOT NULL,
	"nic5" text NOT NULL,
	"registrations" double precision NOT NULL,
	"cumulative" double precision,
	"method" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "udyam_fact_month_lgd_code_nic5_pk" PRIMARY KEY("month","lgd_code","nic5")
);
--> statement-breakpoint
CREATE TABLE "ks"."assessment_item" (
	"course_id" text NOT NULL,
	"skill_id" text NOT NULL,
	"method" text NOT NULL,
	"weight" double precision NOT NULL,
	CONSTRAINT "assessment_item_course_id_skill_id_method_pk" PRIMARY KEY("course_id","skill_id","method")
);
--> statement-breakpoint
CREATE TABLE "ks"."course" (
	"id" text PRIMARY KEY NOT NULL,
	"institution_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"sector" text NOT NULL,
	"target_nco" text NOT NULL,
	"seats" integer NOT NULL,
	"duration_hours" integer NOT NULL,
	"trainer_qualification" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ks"."course_cohort" (
	"course_id" text NOT NULL,
	"fy" text NOT NULL,
	"enrolled" integer NOT NULL,
	"completed" integer NOT NULL,
	"placed_3m" integer NOT NULL,
	"placed_6m" integer NOT NULL,
	"median_wage" integer,
	"is_demo" boolean DEFAULT false NOT NULL,
	CONSTRAINT "course_cohort_course_id_fy_pk" PRIMARY KEY("course_id","fy")
);
--> statement-breakpoint
CREATE TABLE "ks"."course_skill" (
	"course_id" text NOT NULL,
	"skill_id" text NOT NULL,
	"proficiency" smallint NOT NULL,
	"hours" integer NOT NULL,
	"module" text NOT NULL,
	CONSTRAINT "course_skill_course_id_skill_id_pk" PRIMARY KEY("course_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "ks"."equipment" (
	"id" text PRIMARY KEY NOT NULL,
	"institution_id" text NOT NULL,
	"course_id" text,
	"item_code" text NOT NULL,
	"item" text NOT NULL,
	"qty" integer NOT NULL,
	"condition" text NOT NULL,
	"unit_cost" integer,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ks"."institution" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"lgd_code" text NOT NULL,
	"town" text,
	"ownership" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ks"."supply_estimate" (
	"fy" text NOT NULL,
	"lgd_code" text NOT NULL,
	"scheme" text NOT NULL,
	"nco_code" text NOT NULL,
	"trained" double precision NOT NULL,
	"placed" double precision,
	"provenance" jsonb NOT NULL,
	"is_estimated" boolean DEFAULT true NOT NULL,
	CONSTRAINT "supply_estimate_fy_lgd_code_scheme_nco_code_pk" PRIMARY KEY("fy","lgd_code","scheme","nco_code")
);
--> statement-breakpoint
CREATE TABLE "ks"."trainer" (
	"id" text PRIMARY KEY NOT NULL,
	"institution_id" text NOT NULL,
	"qualification" text NOT NULL,
	"qp_codes" text[] DEFAULT '{}' NOT NULL,
	"certified_until" date,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ks"."course_health" (
	"course_id" text NOT NULL,
	"quarter" text NOT NULL,
	"relevance" double precision NOT NULL,
	"outcomes" double precision NOT NULL,
	"currency" double precision NOT NULL,
	"validation" double precision NOT NULL,
	"total" double precision NOT NULL,
	"flags" text[] NOT NULL,
	"placement_rate" double precision,
	"missing_skills" text[] NOT NULL,
	"declining_skills" text[] NOT NULL,
	"unassessed_skills" text[] NOT NULL,
	"explain" text[] NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_health_course_id_quarter_pk" PRIMARY KEY("course_id","quarter")
);
--> statement-breakpoint
CREATE TABLE "ks"."demand_cell" (
	"quarter" text NOT NULL,
	"lgd_code" text NOT NULL,
	"skill_id" text NOT NULL,
	"proficiency" smallint NOT NULL,
	"demand" double precision NOT NULL,
	"supply" double precision NOT NULL,
	"gap" double precision NOT NULL,
	"ratio" double precision NOT NULL,
	"sdi" double precision NOT NULL,
	"ci_low" double precision NOT NULL,
	"ci_high" double precision NOT NULL,
	"coverage" double precision NOT NULL,
	CONSTRAINT "demand_cell_quarter_lgd_code_skill_id_proficiency_pk" PRIMARY KEY("quarter","lgd_code","skill_id","proficiency")
);
--> statement-breakpoint
CREATE TABLE "ks"."demand_fact" (
	"quarter" text NOT NULL,
	"lgd_code" text NOT NULL,
	"nco_code" text NOT NULL,
	"signal" text NOT NULL,
	"n" double precision NOT NULL,
	"hires_12m" double precision NOT NULL,
	CONSTRAINT "demand_fact_quarter_lgd_code_nco_code_signal_pk" PRIMARY KEY("quarter","lgd_code","nco_code","signal")
);
--> statement-breakpoint
CREATE TABLE "ks"."district_metric" (
	"quarter" text NOT NULL,
	"lgd_code" text NOT NULL,
	"mismatch" double precision NOT NULL,
	"coverage" double precision NOT NULL,
	"postings" integer NOT NULL,
	"udyam_new_12m" double precision NOT NULL,
	"sources" jsonb NOT NULL,
	"is_demo" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "district_metric_quarter_lgd_code_pk" PRIMARY KEY("quarter","lgd_code")
);
--> statement-breakpoint
CREATE TABLE "ks"."occupation_cell" (
	"quarter" text NOT NULL,
	"lgd_code" text NOT NULL,
	"nco_code" text NOT NULL,
	"demand" double precision NOT NULL,
	"supply" double precision NOT NULL,
	CONSTRAINT "occupation_cell_quarter_lgd_code_nco_code_pk" PRIMARY KEY("quarter","lgd_code","nco_code")
);
--> statement-breakpoint
CREATE TABLE "ks"."radar_term" (
	"term" text PRIMARY KEY NOT NULL,
	"skill_id" text,
	"global" jsonb NOT NULL,
	"global_source" text NOT NULL,
	"note" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ks"."supply_fact" (
	"quarter" text NOT NULL,
	"lgd_code" text NOT NULL,
	"skill_id" text NOT NULL,
	"proficiency" smallint NOT NULL,
	"graduates_expected" double precision NOT NULL,
	"placed_rate" double precision,
	"estimated_share" double precision DEFAULT 0 NOT NULL,
	CONSTRAINT "supply_fact_quarter_lgd_code_skill_id_proficiency_pk" PRIMARY KEY("quarter","lgd_code","skill_id","proficiency")
);
--> statement-breakpoint
CREATE TABLE "ks"."curriculum_pr" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"target" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"diff" jsonb NOT NULL,
	"rationale" text NOT NULL,
	"approver_body" text NOT NULL,
	"trainer_delta" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"equipment_delta" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"validated_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"adopted_at" timestamp with time zone,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ks"."pr_review" (
	"pr_id" text NOT NULL,
	"employer_id" uuid NOT NULL,
	"verdict" text NOT NULL,
	"comment" text,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pr_review_pr_id_employer_id_pk" PRIMARY KEY("pr_id","employer_id")
);
--> statement-breakpoint
CREATE TABLE "ks"."pr_route" (
	"pr_id" text NOT NULL,
	"employer_id" uuid NOT NULL,
	"routed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pr_route_pr_id_employer_id_pk" PRIMARY KEY("pr_id","employer_id")
);
--> statement-breakpoint
CREATE TABLE "ks"."review_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"ref_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ks"."training_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lgd_code" text NOT NULL,
	"fy" text NOT NULL,
	"inputs" jsonb NOT NULL,
	"solution" jsonb NOT NULL,
	"objective" double precision NOT NULL,
	"status" text NOT NULL,
	"signed_by" text,
	"signed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ks"."geo_alias" ADD CONSTRAINT "geo_alias_lgd_code_geo_district_lgd_code_fk" FOREIGN KEY ("lgd_code") REFERENCES "ks"."geo_district"("lgd_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."geo_pincode" ADD CONSTRAINT "geo_pincode_lgd_code_geo_district_lgd_code_fk" FOREIGN KEY ("lgd_code") REFERENCES "ks"."geo_district"("lgd_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."nic_nco_xwalk" ADD CONSTRAINT "nic_nco_xwalk_nco_code_occupation_nco_code_fk" FOREIGN KEY ("nco_code") REFERENCES "ks"."occupation"("nco_code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."occupation_skill" ADD CONSTRAINT "occupation_skill_nco_code_occupation_nco_code_fk" FOREIGN KEY ("nco_code") REFERENCES "ks"."occupation"("nco_code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."occupation_skill" ADD CONSTRAINT "occupation_skill_skill_id_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "ks"."skill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."qp_skill" ADD CONSTRAINT "qp_skill_qp_code_qualification_qp_code_fk" FOREIGN KEY ("qp_code") REFERENCES "ks"."qualification"("qp_code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."qp_skill" ADD CONSTRAINT "qp_skill_skill_id_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "ks"."skill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."qualification" ADD CONSTRAINT "qualification_nco_code_occupation_nco_code_fk" FOREIGN KEY ("nco_code") REFERENCES "ks"."occupation"("nco_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."raw_record" ADD CONSTRAINT "raw_record_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "ks"."source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."skill_alias" ADD CONSTRAINT "skill_alias_skill_id_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "ks"."skill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."source_health" ADD CONSTRAINT "source_health_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "ks"."source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."consultation" ADD CONSTRAINT "consultation_lgd_code_geo_district_lgd_code_fk" FOREIGN KEY ("lgd_code") REFERENCES "ks"."geo_district"("lgd_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."employer" ADD CONSTRAINT "employer_lgd_code_geo_district_lgd_code_fk" FOREIGN KEY ("lgd_code") REFERENCES "ks"."geo_district"("lgd_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."posting" ADD CONSTRAINT "posting_raw_id_raw_record_id_fk" FOREIGN KEY ("raw_id") REFERENCES "ks"."raw_record"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."posting" ADD CONSTRAINT "posting_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "ks"."source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."posting" ADD CONSTRAINT "posting_employer_id_employer_id_fk" FOREIGN KEY ("employer_id") REFERENCES "ks"."employer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."posting" ADD CONSTRAINT "posting_lgd_code_geo_district_lgd_code_fk" FOREIGN KEY ("lgd_code") REFERENCES "ks"."geo_district"("lgd_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."posting" ADD CONSTRAINT "posting_nco_code_occupation_nco_code_fk" FOREIGN KEY ("nco_code") REFERENCES "ks"."occupation"("nco_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."posting_skill" ADD CONSTRAINT "posting_skill_posting_id_posting_id_fk" FOREIGN KEY ("posting_id") REFERENCES "ks"."posting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."posting_skill" ADD CONSTRAINT "posting_skill_skill_id_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "ks"."skill"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."survey_response" ADD CONSTRAINT "survey_response_employer_id_employer_id_fk" FOREIGN KEY ("employer_id") REFERENCES "ks"."employer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."survey_response" ADD CONSTRAINT "survey_response_lgd_code_geo_district_lgd_code_fk" FOREIGN KEY ("lgd_code") REFERENCES "ks"."geo_district"("lgd_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."survey_response" ADD CONSTRAINT "survey_response_nco_code_occupation_nco_code_fk" FOREIGN KEY ("nco_code") REFERENCES "ks"."occupation"("nco_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."survey_skill" ADD CONSTRAINT "survey_skill_response_id_survey_response_id_fk" FOREIGN KEY ("response_id") REFERENCES "ks"."survey_response"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."survey_skill" ADD CONSTRAINT "survey_skill_skill_id_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "ks"."skill"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."udyam_district_total" ADD CONSTRAINT "udyam_district_total_lgd_code_geo_district_lgd_code_fk" FOREIGN KEY ("lgd_code") REFERENCES "ks"."geo_district"("lgd_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."udyam_fact" ADD CONSTRAINT "udyam_fact_lgd_code_geo_district_lgd_code_fk" FOREIGN KEY ("lgd_code") REFERENCES "ks"."geo_district"("lgd_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."assessment_item" ADD CONSTRAINT "assessment_item_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "ks"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."assessment_item" ADD CONSTRAINT "assessment_item_skill_id_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "ks"."skill"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."course" ADD CONSTRAINT "course_institution_id_institution_id_fk" FOREIGN KEY ("institution_id") REFERENCES "ks"."institution"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."course" ADD CONSTRAINT "course_target_nco_occupation_nco_code_fk" FOREIGN KEY ("target_nco") REFERENCES "ks"."occupation"("nco_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."course_cohort" ADD CONSTRAINT "course_cohort_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "ks"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."course_skill" ADD CONSTRAINT "course_skill_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "ks"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."course_skill" ADD CONSTRAINT "course_skill_skill_id_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "ks"."skill"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."equipment" ADD CONSTRAINT "equipment_institution_id_institution_id_fk" FOREIGN KEY ("institution_id") REFERENCES "ks"."institution"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."equipment" ADD CONSTRAINT "equipment_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "ks"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."institution" ADD CONSTRAINT "institution_lgd_code_geo_district_lgd_code_fk" FOREIGN KEY ("lgd_code") REFERENCES "ks"."geo_district"("lgd_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."supply_estimate" ADD CONSTRAINT "supply_estimate_lgd_code_geo_district_lgd_code_fk" FOREIGN KEY ("lgd_code") REFERENCES "ks"."geo_district"("lgd_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."supply_estimate" ADD CONSTRAINT "supply_estimate_nco_code_occupation_nco_code_fk" FOREIGN KEY ("nco_code") REFERENCES "ks"."occupation"("nco_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."trainer" ADD CONSTRAINT "trainer_institution_id_institution_id_fk" FOREIGN KEY ("institution_id") REFERENCES "ks"."institution"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."curriculum_pr" ADD CONSTRAINT "curriculum_pr_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "ks"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."pr_review" ADD CONSTRAINT "pr_review_pr_id_curriculum_pr_id_fk" FOREIGN KEY ("pr_id") REFERENCES "ks"."curriculum_pr"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."pr_review" ADD CONSTRAINT "pr_review_employer_id_employer_id_fk" FOREIGN KEY ("employer_id") REFERENCES "ks"."employer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."pr_route" ADD CONSTRAINT "pr_route_pr_id_curriculum_pr_id_fk" FOREIGN KEY ("pr_id") REFERENCES "ks"."curriculum_pr"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."pr_route" ADD CONSTRAINT "pr_route_employer_id_employer_id_fk" FOREIGN KEY ("employer_id") REFERENCES "ks"."employer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ks"."training_plan" ADD CONSTRAINT "training_plan_lgd_code_geo_district_lgd_code_fk" FOREIGN KEY ("lgd_code") REFERENCES "ks"."geo_district"("lgd_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "raw_record_source_ext_uq" ON "ks"."raw_record" USING btree ("source_id","external_id");--> statement-breakpoint
CREATE INDEX "raw_record_hash_idx" ON "ks"."raw_record" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "employer_name_lgd_idx" ON "ks"."employer" USING btree ("name","lgd_code");--> statement-breakpoint
CREATE INDEX "posting_lgd_idx" ON "ks"."posting" USING btree ("lgd_code","posted_at");--> statement-breakpoint
CREATE INDEX "posting_hash_idx" ON "ks"."posting" USING btree ("description_hash");--> statement-breakpoint
CREATE INDEX "posting_skill_skill_idx" ON "ks"."posting_skill" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "survey_lgd_idx" ON "ks"."survey_response" USING btree ("lgd_code");--> statement-breakpoint
CREATE INDEX "course_inst_idx" ON "ks"."course" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "course_skill_skill_idx" ON "ks"."course_skill" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "institution_lgd_idx" ON "ks"."institution" USING btree ("lgd_code");--> statement-breakpoint
CREATE INDEX "demand_cell_skill_idx" ON "ks"."demand_cell" USING btree ("skill_id","quarter");--> statement-breakpoint
CREATE INDEX "pr_course_idx" ON "ks"."curriculum_pr" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "review_status_idx" ON "ks"."review_item" USING btree ("status","kind");--> statement-breakpoint
CREATE INDEX "plan_lgd_fy_idx" ON "ks"."training_plan" USING btree ("lgd_code","fy","created_at");