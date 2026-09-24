-- =============================================================================
-- SPRINT 1 MIGRATION — SIH26134 Labour Market Intelligence Platform
-- Run this entire file in Supabase SQL Editor (supabase.com -> SQL Editor)
-- =============================================================================
-- HOW TO RUN:
-- 1. Go to supabase.com -> Your Project -> SQL Editor
-- 2. Paste this entire file
-- 3. Click "Run"
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SECTION 1: UPGRADE THE JOBS TABLE
-- We add fields for: work mode (remote/hybrid/on-site), duplicate detection,
-- processing status (so failed AI jobs can be retried), and demo data flag.
-- -----------------------------------------------------------------------------

ALTER TABLE jobs
    -- Work mode: is this job remote, hybrid, or on-site?
    -- WHY: Remote jobs cannot be assigned to a district.
    --      They must be excluded from district-level analytics.
    ADD COLUMN IF NOT EXISTS work_mode          VARCHAR(20)  DEFAULT 'on_site',

    -- Published date from the source (different from our created_at)
    -- WHY: Old jobs distort demand. We filter by published_at for fresh data.
    ADD COLUMN IF NOT EXISTS published_at       TIMESTAMPTZ,

    -- Last time our scraper saw this job live on its source
    -- WHY: Jobs not seen in 90 days are probably filled. We mark them expired.
    ADD COLUMN IF NOT EXISTS last_seen_at       TIMESTAMPTZ  DEFAULT NOW(),

    -- When the job was decided to be expired
    ADD COLUMN IF NOT EXISTS expired_at         TIMESTAMPTZ,

    -- SHA-256 hash of the cleaned description text
    -- WHY: Prevents calling Gemini again for the same description under a new ID.
    --      This saves API cost and prevents duplicate skill data.
    ADD COLUMN IF NOT EXISTS description_hash   VARCHAR(64),

    -- Duplicate detection
    -- WHY: Same job on LinkedIn + Naukri = two different job_ids but ONE real job.
    --      Analytics must not double-count it.
    ADD COLUMN IF NOT EXISTS is_duplicate       BOOLEAN      DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS potential_duplicate BOOLEAN     DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS canonical_job_id   UUID,       -- Points to master job record

    -- AI processing status
    -- WHY: If Gemini fails, we need to know which jobs to retry.
    --      Without this, failed jobs are silently lost.
    ADD COLUMN IF NOT EXISTS processing_status  VARCHAR(20)  DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS retry_count        INT          DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_error         TEXT,

    -- State and district (for geographic analytics)
    -- WHY: These should already exist from our previous work.
    --      IF NOT EXISTS prevents errors if they're already there.
    ADD COLUMN IF NOT EXISTS state              VARCHAR(100),
    ADD COLUMN IF NOT EXISTS district           VARCHAR(100),

    -- Demo data flag
    -- WHY: We must never present demo/seed data as real government statistics.
    --      When is_demo = TRUE, the dashboard shows a warning banner.
    ADD COLUMN IF NOT EXISTS is_demo            BOOLEAN      DEFAULT FALSE;

-- Processing status valid values: pending / processing / complete / failed
COMMENT ON COLUMN jobs.processing_status IS 'pending=waiting for AI, processing=AI running, complete=saved, failed=AI error';
COMMENT ON COLUMN jobs.work_mode         IS 'remote / hybrid / on_site';
COMMENT ON COLUMN jobs.is_demo           IS 'TRUE = demo/seed data, never present as real statistics';


-- -----------------------------------------------------------------------------
-- SECTION 2: UPGRADE THE JOB_SKILLS TABLE
-- This is the most important upgrade. We add:
-- - required_status: is this skill required, preferred, or optional?
-- - confidence: how sure was the AI? (0.0 to 1.0)
-- - evidence: the exact sentence from the job that proved this skill exists
-- - is_negated: "Docker NOT required" — should NEVER count as demand
-- - years_min/max: "3+ years experience" stored numerically
-- - model tracking: which AI version extracted this?
-- -----------------------------------------------------------------------------

ALTER TABLE job_skills
    -- CRITICAL: required vs preferred vs optional vs not_required
    -- WHY: "React required" and "Docker preferred" are very different signals.
    --      Match scores and demand analytics must treat them differently.
    ADD COLUMN IF NOT EXISTS required_status   VARCHAR(20)  DEFAULT 'required',

    -- AI confidence score from 0.0 (guessing) to 1.0 (very sure)
    -- WHY: We flag anything below 0.6 for human review.
    --      This prevents hallucinated skills from corrupting our analytics.
    ADD COLUMN IF NOT EXISTS confidence        FLOAT        DEFAULT 1.0,

    -- The exact sentence from the job description that proves this skill
    -- WHY: Judges will ask "why does the system say Docker is required?"
    --      We show them the evidence. Full transparency.
    ADD COLUMN IF NOT EXISTS evidence          TEXT,

    -- Is this skill explicitly negated? e.g., "Docker NOT required"
    -- WHY: A naive parser would count Docker as demanded.
    --      We detect negation and EXCLUDE negated skills from all analytics.
    ADD COLUMN IF NOT EXISTS is_negated        BOOLEAN      DEFAULT FALSE,

    -- Years of experience extracted numerically
    -- WHY: "3+ years" and "Advanced React" are different signals.
    --      We store them separately and never auto-convert between them.
    ADD COLUMN IF NOT EXISTS years_min         INT,
    ADD COLUMN IF NOT EXISTS years_max         INT,

    -- AI model tracking for auditability
    -- WHY: If we upgrade Gemini versions, we need to know which extractions
    --      to reprocess. This makes our data fully auditable.
    ADD COLUMN IF NOT EXISTS model_name        VARCHAR(100) DEFAULT 'gemini-3.5-flash-lite',
    ADD COLUMN IF NOT EXISTS prompt_version    VARCHAR(20)  DEFAULT 'v2.0',
    ADD COLUMN IF NOT EXISTS processed_at      TIMESTAMPTZ  DEFAULT NOW();

COMMENT ON COLUMN job_skills.required_status IS 'required / preferred / optional / not_required';
COMMENT ON COLUMN job_skills.confidence      IS '0.0=guessing to 1.0=very sure. Flag <0.6 for review.';
COMMENT ON COLUMN job_skills.is_negated      IS 'TRUE means skill was negated (e.g. Docker NOT required). Exclude from demand counts.';


-- -----------------------------------------------------------------------------
-- SECTION 3: UPGRADE THE COURSE_SKILLS TABLE
-- Add hours tracking and module names so we know HOW DEEPLY a course covers a skill.
-- -----------------------------------------------------------------------------

ALTER TABLE course_skills
    -- How many hours does the course spend on this skill?
    -- WHY: "We teach Docker" is different from "We teach Docker for 40 hours."
    --      This makes our curriculum gap analysis much more accurate.
    ADD COLUMN IF NOT EXISTS hours_coverage    INT          DEFAULT 0,

    -- Which module in the course covers this skill?
    -- WHY: Enables module-level curriculum recommendations.
    ADD COLUMN IF NOT EXISTS module_name       VARCHAR(200),

    ADD COLUMN IF NOT EXISTS is_demo           BOOLEAN      DEFAULT FALSE;


-- -----------------------------------------------------------------------------
-- SECTION 4: ADD DEMO FLAG TO INSTITUTIONS AND COURSES
-- -----------------------------------------------------------------------------

ALTER TABLE institutions
    ADD COLUMN IF NOT EXISTS is_demo           BOOLEAN      DEFAULT FALSE;

ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS annual_enrollment INT          DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_demo           BOOLEAN      DEFAULT FALSE;


-- -----------------------------------------------------------------------------
-- SECTION 5: NEW TABLE — UNKNOWN SKILL CANDIDATES
-- When Gemini extracts a skill we've never seen, instead of blindly creating it,
-- we put it here for admin review first.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS unknown_skill_candidates (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    term         VARCHAR(200) NOT NULL,
    -- How many times has this unknown term appeared?
    frequency    INT          DEFAULT 1,
    -- In how many different jobs?
    job_count    INT          DEFAULT 1,
    -- Example sentences where this term was found (for context)
    contexts     TEXT[],
    -- Admin decision: pending / approved / rejected
    status       VARCHAR(20)  DEFAULT 'pending',
    reviewed_by  UUID         REFERENCES users(id),
    reviewed_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  DEFAULT NOW(),
    UNIQUE(term)
);

COMMENT ON TABLE unknown_skill_candidates IS 'New tech terms found by AI that are not yet in our skill dictionary. Admin must approve before they count in analytics.';


-- -----------------------------------------------------------------------------
-- SECTION 6: NEW TABLE — ADMIN REVIEW QUEUE
-- A single queue for all items that need human review:
-- low-confidence skills, unknown skills, potential duplicates, etc.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS admin_review_queue (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- What kind of item needs review?
    item_type    VARCHAR(50)  NOT NULL,  -- low_confidence_skill / unknown_skill / duplicate_job / ambiguous_location
    -- Reference to the actual record (job, skill, etc.)
    item_id      UUID,
    -- All data needed for the admin to make a decision (stored as JSON)
    context      JSONB,
    -- Admin decision
    status       VARCHAR(20)  DEFAULT 'pending',  -- pending / approved / rejected / edited
    reviewer_id  UUID         REFERENCES users(id),
    reviewed_at  TIMESTAMPTZ,
    decision     VARCHAR(20),
    notes        TEXT,
    created_at   TIMESTAMPTZ  DEFAULT NOW()
);

COMMENT ON TABLE admin_review_queue IS 'Central queue for all items requiring human review. Prevents unchecked AI output from corrupting analytics.';


-- -----------------------------------------------------------------------------
-- SECTION 7: NEW TABLE — SKILL DECOMPOSITIONS
-- "MERN Stack" = MongoDB + Express + React + Node.js
-- When a composite skill is found, we expand it to its components.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS skill_decompositions (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    composite_name   VARCHAR(200) NOT NULL,   -- e.g., "MERN Stack"
    component_skill  VARCHAR(200) NOT NULL,   -- e.g., "React"
    created_at       TIMESTAMPTZ  DEFAULT NOW(),
    UNIQUE(composite_name, component_skill)
);

-- Pre-populate common tech stacks
INSERT INTO skill_decompositions (composite_name, component_skill) VALUES
('MERN Stack', 'MongoDB'),  ('MERN Stack', 'Express'),
('MERN Stack', 'React'),    ('MERN Stack', 'Node.js'),
('MEAN Stack', 'MongoDB'),  ('MEAN Stack', 'Express'),
('MEAN Stack', 'Angular'),  ('MEAN Stack', 'Node.js'),
('LAMP Stack', 'Linux'),    ('LAMP Stack', 'Apache'),
('LAMP Stack', 'MySQL'),    ('LAMP Stack', 'PHP'),
('JAM Stack',  'JavaScript'), ('JAM Stack', 'APIs'), ('JAM Stack', 'Markup'),
('Full Stack Development', 'HTML'), ('Full Stack Development', 'CSS'),
('Full Stack Development', 'JavaScript'), ('Full Stack Development', 'SQL')
ON CONFLICT DO NOTHING;


-- -----------------------------------------------------------------------------
-- SECTION 8: NEW TABLE — SOURCE HEALTH LOG
-- Tracks the health of each data source after every pipeline run.
-- Powers the API Health Dashboard.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS source_health_log (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    source         VARCHAR(50)  NOT NULL,
    -- success / failed / rate_limited / timeout
    status         VARCHAR(30)  NOT NULL,
    jobs_fetched   INT          DEFAULT 0,
    error_message  TEXT,
    run_at         TIMESTAMPTZ  DEFAULT NOW()
);

COMMENT ON TABLE source_health_log IS 'Tracks health of each job data source. Powers API Health Dashboard.';


-- -----------------------------------------------------------------------------
-- SECTION 9: NEW TABLE — PIPELINE RUN LOG
-- Records every pipeline execution. Powers the Data Freshness display.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pipeline_run_log (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    jobs_fetched   INT          DEFAULT 0,
    jobs_saved     INT          DEFAULT 0,
    jobs_failed    INT          DEFAULT 0,
    jobs_skipped   INT          DEFAULT 0,  -- Duplicates or cached
    run_at         TIMESTAMPTZ  DEFAULT NOW(),
    duration_secs  INT
);


-- -----------------------------------------------------------------------------
-- SECTION 10: ADD PERFORMANCE INDEXES
-- These make all analytics queries fast even with 100,000+ jobs.
-- Without these, every query scans the entire table (very slow).
-- -----------------------------------------------------------------------------

-- job_skills indexes (this table is queried the most for analytics)
CREATE INDEX IF NOT EXISTS idx_job_skills_skill_id    ON job_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_job_skills_job_id      ON job_skills(job_id);
CREATE INDEX IF NOT EXISTS idx_job_skills_created_at  ON job_skills(created_at);
CREATE INDEX IF NOT EXISTS idx_job_skills_negated      ON job_skills(is_negated);
CREATE INDEX IF NOT EXISTS idx_job_skills_required     ON job_skills(required_status);
CREATE INDEX IF NOT EXISTS idx_job_skills_confidence   ON job_skills(confidence);

-- jobs table indexes (for filtering by location, source, status)
CREATE INDEX IF NOT EXISTS idx_jobs_state              ON jobs(state);
CREATE INDEX IF NOT EXISTS idx_jobs_district           ON jobs(district);
CREATE INDEX IF NOT EXISTS idx_jobs_source             ON jobs(source);
CREATE INDEX IF NOT EXISTS idx_jobs_status             ON jobs(processing_status);
CREATE INDEX IF NOT EXISTS idx_jobs_desc_hash          ON jobs(description_hash);
CREATE INDEX IF NOT EXISTS idx_jobs_work_mode          ON jobs(work_mode);
CREATE INDEX IF NOT EXISTS idx_jobs_published_at       ON jobs(published_at);
CREATE INDEX IF NOT EXISTS idx_jobs_is_duplicate       ON jobs(is_duplicate);


-- -----------------------------------------------------------------------------
-- SECTION 11: UPGRADE ANALYTICS VIEWS
-- Rebuild key views to use the new fields.
-- All analytics now:
--   - Exclude negated skills (is_negated = FALSE)
--   - Only count skills the AI was reasonably confident about (confidence >= 0.6)
--   - Separate required vs preferred demand
--   - Show sample size and confidence level
--   - Exclude duplicate jobs
-- -----------------------------------------------------------------------------

-- Drop old basic views and recreate with new logic
DROP VIEW IF EXISTS skill_demand CASCADE;
CREATE OR REPLACE VIEW skill_demand AS
SELECT
    s.name                                                        AS skill,
    s.category,
    -- Total mentions (required + preferred combined)
    COUNT(js.job_id)                                              AS total_mentions,
    -- How many jobs REQUIRE this skill
    COUNT(js.job_id) FILTER (WHERE js.required_status = 'required')    AS required_count,
    -- How many jobs PREFER this skill
    COUNT(js.job_id) FILTER (WHERE js.required_status = 'preferred')   AS preferred_count,
    -- Unique companies demanding this skill (avoids one-company distortion)
    COUNT(DISTINCT j.company)                                     AS unique_companies,
    -- Weighted demand %: required counts 1.5x more than preferred
    ROUND(
        (COUNT(js.job_id) FILTER (WHERE js.required_status = 'required') * 1.5 +
         COUNT(js.job_id) FILTER (WHERE js.required_status = 'preferred') * 1.0)
        / NULLIF((SELECT COUNT(*) FROM jobs WHERE is_duplicate = FALSE), 0) * 100
    , 2)                                                           AS weighted_demand_pct,
    -- Simple demand % for display
    ROUND(COUNT(js.job_id) * 100.0
        / NULLIF((SELECT COUNT(*) FROM jobs WHERE is_duplicate = FALSE), 0)
    , 2)                                                           AS demand_pct,
    -- How confident are we in this number?
    CASE
        WHEN COUNT(js.job_id) >= 1000 THEN 'HIGH'
        WHEN COUNT(js.job_id) >= 100  THEN 'MEDIUM'
        ELSE                               'LOW'
    END                                                            AS confidence_level,
    COUNT(js.job_id)                                              AS sample_size
FROM job_skills js
JOIN skills s     ON js.skill_id = s.id
JOIN jobs j       ON js.job_id   = j.id
WHERE
    js.is_negated  = FALSE          -- Never count "Docker NOT required" as demand
    AND js.confidence >= 0.6        -- Only trust skills the AI was sure about
    AND j.is_duplicate = FALSE      -- Never double-count duplicates
    AND (j.published_at > NOW() - INTERVAL '90 days'
         OR j.created_at > NOW() - INTERVAL '90 days')  -- Recent jobs only
GROUP BY s.name, s.category
HAVING COUNT(js.job_id) >= 5       -- At least 5 jobs before showing as a metric
ORDER BY weighted_demand_pct DESC;


-- Skill demand broken down by state
DROP VIEW IF EXISTS skill_demand_by_state CASCADE;
CREATE OR REPLACE VIEW skill_demand_by_state AS
SELECT
    j.state,
    j.district,
    s.name                  AS skill,
    COUNT(js.job_id)        AS job_count,
    COUNT(DISTINCT j.company) AS unique_companies,
    CASE
        WHEN COUNT(js.job_id) >= 500 THEN 'HIGH'
        WHEN COUNT(js.job_id) >= 50  THEN 'MEDIUM'
        ELSE                              'LOW'
    END                     AS confidence_level
FROM job_skills js
JOIN skills s ON js.skill_id = s.id
JOIN jobs j   ON js.job_id   = j.id
WHERE
    js.is_negated = FALSE
    AND js.confidence >= 0.6
    AND j.is_duplicate = FALSE
    AND j.work_mode = 'on_site'     -- Remote jobs excluded from geographic analysis
    AND j.state IS NOT NULL
GROUP BY j.state, j.district, s.name
ORDER BY j.state, job_count DESC;


-- Skill gap analysis: what industry needs vs what curricula teach
DROP VIEW IF EXISTS skill_gap_analysis CASCADE;
CREATE OR REPLACE VIEW skill_gap_analysis AS
SELECT
    s.name                                                          AS skill,
    s.category,
    -- Market side
    COUNT(DISTINCT js.job_id)                                       AS market_job_count,
    ROUND(COUNT(DISTINCT js.job_id) * 100.0
        / NULLIF((SELECT COUNT(*) FROM jobs WHERE is_duplicate = FALSE), 0)
    , 2)                                                            AS market_demand_pct,
    -- Curriculum side
    COUNT(DISTINCT cs.course_id)                                    AS courses_covering,
    COALESCE(AVG(cs.hours_coverage), 0)                            AS avg_curriculum_hours,
    -- Gap calculation
    CASE
        WHEN COUNT(DISTINCT cs.course_id) = 0
            THEN 'Critical Gap'   -- No course teaches this skill
        WHEN COUNT(DISTINCT js.job_id) * 100.0
            / NULLIF((SELECT COUNT(*) FROM jobs WHERE is_duplicate = FALSE), 0) > 30
            AND COUNT(DISTINCT cs.course_id) < 3
            THEN 'High Gap'       -- High demand but few courses
        WHEN COUNT(DISTINCT js.job_id) * 100.0
            / NULLIF((SELECT COUNT(*) FROM jobs WHERE is_duplicate = FALSE), 0) > 10
            AND COUNT(DISTINCT cs.course_id) < 2
            THEN 'Medium Gap'
        ELSE
            'Covered'
    END                                                             AS gap_status,
    -- Sample size for transparency
    COUNT(DISTINCT js.job_id)                                       AS sample_size
FROM skills s
LEFT JOIN job_skills js ON s.id = js.skill_id
    AND js.is_negated = FALSE
    AND js.confidence >= 0.6
LEFT JOIN course_skills cs ON s.id = cs.skill_id
LEFT JOIN jobs j ON js.job_id = j.id
    AND j.is_duplicate = FALSE
GROUP BY s.name, s.category
HAVING COUNT(DISTINCT js.job_id) > 10
ORDER BY market_demand_pct DESC;


-- Data quality summary (for the Data Quality dashboard)
CREATE OR REPLACE VIEW data_quality_summary AS
SELECT
    COUNT(*)                                             AS total_jobs,
    COUNT(*) FILTER (WHERE processing_status = 'complete')    AS valid_jobs,
    COUNT(*) FILTER (WHERE is_duplicate = TRUE)               AS duplicate_jobs,
    COUNT(*) FILTER (WHERE processing_status = 'failed')      AS failed_jobs,
    COUNT(*) FILTER (WHERE processing_status = 'pending')     AS unprocessed_jobs,
    COUNT(*) FILTER (WHERE is_demo = TRUE)                    AS demo_jobs,
    COUNT(*) FILTER (WHERE state IS NULL AND work_mode = 'on_site') AS missing_location,
    COUNT(*) FILTER (WHERE role IS NULL OR role = '')         AS missing_role,
    MAX(created_at)                                      AS last_job_ingested_at
FROM jobs;

COMMENT ON VIEW data_quality_summary IS 'Powers the Data Quality dashboard. Shows platform transparency.';


-- Job source statistics
DROP VIEW IF EXISTS job_source_stats CASCADE;
CREATE OR REPLACE VIEW job_source_stats AS
SELECT
    source,
    COUNT(*)                                              AS total_jobs,
    COUNT(*) FILTER (WHERE is_duplicate = FALSE)          AS unique_jobs,
    COUNT(*) FILTER (WHERE processing_status = 'complete') AS processed_jobs,
    COUNT(*) FILTER (WHERE processing_status = 'failed')  AS failed_jobs,
    ROUND(COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0), 1) AS share_pct,
    MAX(created_at)                                       AS last_job_at
FROM jobs
GROUP BY source
ORDER BY total_jobs DESC;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================
-- Summary of changes:
-- jobs table:        +10 columns (work_mode, published_at, last_seen_at, expired_at,
--                                 description_hash, is_duplicate, potential_duplicate,
--                                 canonical_job_id, processing_status, retry_count,
--                                 last_error, is_demo)
-- job_skills table:  +8 columns  (required_status, confidence, evidence, is_negated,
--                                 years_min, years_max, model_name, prompt_version,
--                                 processed_at)
-- course_skills:     +3 columns  (hours_coverage, module_name, is_demo)
-- institutions:      +1 column   (is_demo)
-- courses:           +2 columns  (annual_enrollment, is_demo)
-- New tables:        unknown_skill_candidates, admin_review_queue,
--                    skill_decompositions, source_health_log, pipeline_run_log
-- New indexes:       14 performance indexes
-- Upgraded views:    skill_demand, skill_demand_by_state, skill_gap_analysis,
--                    data_quality_summary, job_source_stats
-- =============================================================================
