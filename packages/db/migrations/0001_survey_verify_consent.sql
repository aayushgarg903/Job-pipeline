ALTER TABLE "ks"."survey_response" ADD COLUMN "verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ks"."survey_response" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ks"."survey_response" ADD COLUMN "consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ks"."survey_response" ADD COLUMN "consent_notice_version" text;--> statement-breakpoint
ALTER TABLE "ks"."survey_response" ADD COLUMN "consent_purpose" text;--> statement-breakpoint
-- Seeded demo surveys stay counted (they are flagged is_demo); new responses start unverified.
UPDATE "ks"."survey_response" SET "verified" = true, "verified_at" = now() WHERE "is_demo";
