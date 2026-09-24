-- Lock schema ks away from Supabase's API roles. The app connects as `postgres` (table owner,
-- BYPASSRLS), so nothing changes for it; the anon / authenticated keys get no privileges and,
-- even if a grant slipped back in, RLS with no policies returns zero rows.
-- scripts/sql/post.sql re-asserts the same on every migrate, so tables added later are covered.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'ks' LOOP
    EXECUTE format('ALTER TABLE ks.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON SCHEMA ks FROM anon';
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA ks FROM anon';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA ks FROM anon';
    EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ks FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA ks REVOKE ALL ON TABLES FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA ks REVOKE ALL ON SEQUENCES FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA ks REVOKE ALL ON FUNCTIONS FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON SCHEMA ks FROM authenticated';
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA ks FROM authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA ks FROM authenticated';
    EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ks FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA ks REVOKE ALL ON TABLES FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA ks REVOKE ALL ON SEQUENCES FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA ks REVOKE ALL ON FUNCTIONS FROM authenticated';
  END IF;
END $$;
