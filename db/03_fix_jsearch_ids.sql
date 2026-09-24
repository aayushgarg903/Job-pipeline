-- =============================================================================
-- SPRINT 1B — Fix JSearch long job IDs + column upgrades
-- Run AFTER 02_sprint1_migration.sql
-- =============================================================================

-- FIX: JSearch generates base64-encoded job IDs that can be 400+ characters.
-- VARCHAR(255) is not enough. Upgrade to TEXT.
ALTER TABLE jobs
    ALTER COLUMN original_id TYPE TEXT;

-- Also upgrade url column for long URLs
ALTER TABLE jobs
    ALTER COLUMN url TYPE TEXT;

-- Add missing columns that may not exist yet
ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS state    VARCHAR(100),
    ADD COLUMN IF NOT EXISTS district VARCHAR(100);

-- =============================================================================
-- Done. The pipeline can now handle JSearch job IDs of any length.
-- =============================================================================
