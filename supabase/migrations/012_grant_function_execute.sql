-- The original schema granted EXECUTE on the RLS helper functions
-- (is_staff, can_manage_sales, can_manage_finance, has_role, ...) to
-- service_role ONLY. RLS policies run as the querying role, so every
-- authenticated request failed with 42501 "permission denied for function
-- is_staff" and the app showed empty lists.
--
-- Grant EXECUTE on all current public functions to the app roles, and set
-- default privileges so future functions are covered too.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role',
      r.oid::regprocedure
    );
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
