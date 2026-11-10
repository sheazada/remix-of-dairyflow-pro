-- ============================================================
-- 023: Correct demo-account distributor assignment and remove
--      spurious salesperson role rows
-- ============================================================
-- Scope:
--   Exactly six demo user IDs (0000...0010 through 0000...0060).
--   No other users, distributors, auth records, or profiles
--   are touched.
--
-- What it does:
--   1. Reassigns the six demo users to the demo distributor
--      (00000000-0000-4000-8000-000000000d01 "DairyFlow Distribution").
--   2. Removes exactly five spurious 'salesperson' user_roles rows
--      one each for Admin, Manager, Driver, Helper, Retailer.
--      The Sales user's single 'salesperson' row is preserved.
--
-- Transactional behavior:
--   The entire migration is one DO $$ block. A RAISE EXCEPTION
--   anywhere inside it rolls back the implicit transaction for
--   that statement. A RETURN inside the block exits the entire
--   migration (no subsequent SQL runs). The block is idempotent:
--   if the database already matches the target state, the block
--   exits cleanly via RETURN with a NOTICE, no rows changed.
--
-- Execution context (verified live 2026-11-05):
--   protect_users_privileged_columns (migration 019) gates its
--   privileged-column override on auth.uid() IS NOT NULL. The
--   Supabase SQL Editor runs as the postgres superuser for which
--   auth.uid() returns NULL, so the trigger guard is bypassed.
--   Verified with: SELECT auth.uid(), current_user, session_user;
--   Result: auth.uid() = NULL, current_user = 'postgres'.
--
-- Deployment note:
--   Must be run in the Supabase Dashboard SQL Editor (or via
--   psql / supabase db push). Do NOT use the Supabase REST
--   execute_query connector, which does not support DO $$
--   anonymous PL/pgSQL blocks.
-- ============================================================

DO $$
DECLARE
  v_already_ok  integer;
  v_count       integer;
  v_rows        integer;
  v_roles       text[];
BEGIN

  -- ==========================================================
  -- STEP 0: Already-applied detection (idempotency)
  --
  -- All six demo users must satisfy ALL of:
  --   (a) their (id, email) pair matches the documented
  --       six (UUID, email) pairs,
  --   (b) sit on the target demo distributor
  --       (00000000-0000-4000-8000-000000000d01),
  --   (c) have EXACTLY ONE user_roles row, and
  --   (d) that single row must be the user's intended role,
  --       derived from the validated email.
  --
  -- The (id, email) IN (...) predicate prevents a degenerate
  -- case where a UUID's email was swapped with another demo
  -- user's email. If that happened, the row fails the IN
  -- filter, does not count toward v_already_ok, and the
  -- migration proceeds to pre-flights which will surface the
  -- inconsistency.
  --
  -- If all six satisfy these conditions, migration 023 has
  -- already been applied -- skip with a NOTICE. RETURN exits
  -- the entire DO block; no pre-flights or corrective ops run.
  --
  -- If the database is in an inconsistent partial state (e.g.,
  -- 5 of 6 users are correct, the 6th is wrong), the count is
  -- less than 6, we do NOT skip, and a later pre-flight
  -- assertion will catch the inconsistency and RAISE EXCEPTION.
  -- ==========================================================
  SELECT count(*) INTO v_already_ok
  FROM public.users u
  WHERE (u.id, u.email) IN (
    ('00000000-0000-4000-8000-000000000010'::uuid, 'admin@demo.dairyflow.app'::text),
    ('00000000-0000-4000-8000-000000000020'::uuid, 'manager@demo.dairyflow.app'::text),
    ('00000000-0000-4000-8000-000000000030'::uuid, 'sales@demo.dairyflow.app'::text),
    ('00000000-0000-4000-8000-000000000040'::uuid, 'driver@demo.dairyflow.app'::text),
    ('00000000-0000-4000-8000-000000000050'::uuid, 'helper@demo.dairyflow.app'::text),
    ('00000000-0000-4000-8000-000000000060'::uuid, 'retailer@demo.dairyflow.app'::text)
  )
  AND u.distributor_id = '00000000-0000-4000-8000-000000000d01'::uuid
  AND (
    SELECT array_agg(ur.role::text ORDER BY ur.role::text)
    FROM public.user_roles ur
    WHERE ur.user_id = u.id
  ) = (
    CASE u.email
      WHEN 'admin@demo.dairyflow.app'    THEN ARRAY['admin']::text[]
      WHEN 'manager@demo.dairyflow.app'  THEN ARRAY['manager']::text[]
      WHEN 'sales@demo.dairyflow.app'    THEN ARRAY['salesperson']::text[]
      WHEN 'driver@demo.dairyflow.app'   THEN ARRAY['driver']::text[]
      WHEN 'helper@demo.dairyflow.app'   THEN ARRAY['helper']::text[]
      WHEN 'retailer@demo.dairyflow.app' THEN ARRAY['retailer']::text[]
      ELSE NULL::text[]
    END
  );

  IF v_already_ok = 6 THEN
    RAISE NOTICE 'Migration 023 already applied: all six demo users are on distributor '
                 '00000000-0000-4000-8000-000000000d01 with their single intended role. '
                 'Skipping corrective operations.';
    RETURN;
  END IF;

  -- ==========================================================
  -- PRE-FLIGHT 1: target distributor exists and is active
  -- ==========================================================
  SELECT count(*) INTO v_count
  FROM public.distributors
  WHERE id = '00000000-0000-4000-8000-000000000d01'::uuid
    AND status = 'active';

  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'Pre-flight 023.1 failed: target distributor '
      '00000000-0000-4000-8000-000000000d01 does not exist or is not active. '
      'Aborting migration 023.';
  END IF;

  -- ==========================================================
  -- PRE-FLIGHT 2: all six demo users exist with expected emails
  -- and currently sit on the OLD distributor
  -- 6ac5adb2-7a71-4aa8-91a1-986388623841.
  -- ==========================================================
  SELECT count(*) INTO v_count
  FROM public.users
  WHERE (id, email) IN (
    ('00000000-0000-4000-8000-000000000010'::uuid, 'admin@demo.dairyflow.app'::text),
    ('00000000-0000-4000-8000-000000000020'::uuid, 'manager@demo.dairyflow.app'::text),
    ('00000000-0000-4000-8000-000000000030'::uuid, 'sales@demo.dairyflow.app'::text),
    ('00000000-0000-4000-8000-000000000040'::uuid, 'driver@demo.dairyflow.app'::text),
    ('00000000-0000-4000-8000-000000000050'::uuid, 'helper@demo.dairyflow.app'::text),
    ('00000000-0000-4000-8000-000000000060'::uuid, 'retailer@demo.dairyflow.app'::text)
  )
  AND distributor_id = '6ac5adb2-7a71-4aa8-91a1-986388623841'::uuid;

  IF v_count <> 6 THEN
    RAISE EXCEPTION
      'Pre-flight 023.2 failed: expected all 6 demo users on distributor '
      '6ac5adb2-7a71-4aa8-91a1-986388623841 with their documented emails, '
      'found %', v_count;
  END IF;

  -- ==========================================================
  -- PRE-FLIGHT 3: strict per-user role-set validation
  --
  -- Each demo user must have EXACTLY the following role set
  -- (no more, no less, no different roles). Any deviation
  -- aborts the migration with a descriptive exception.
  -- ==========================================================

  -- Admin: must have exactly {admin, salesperson}
  SELECT array_agg(r.role::text ORDER BY r.role::text) INTO v_roles
  FROM public.user_roles r
  WHERE r.user_id = '00000000-0000-4000-8000-000000000010'::uuid;
  IF v_roles <> ARRAY['admin', 'salesperson'] THEN
    RAISE EXCEPTION
      'Pre-flight 023.3a failed: Admin user expected exact role set '
      '{admin, salesperson}, got %', v_roles;
  END IF;

  -- Manager: must have exactly {manager, salesperson}
  SELECT array_agg(r.role::text ORDER BY r.role::text) INTO v_roles
  FROM public.user_roles r
  WHERE r.user_id = '00000000-0000-4000-8000-000000000020'::uuid;
  IF v_roles <> ARRAY['manager', 'salesperson'] THEN
    RAISE EXCEPTION
      'Pre-flight 023.3b failed: Manager user expected exact role set '
      '{manager, salesperson}, got %', v_roles;
  END IF;

  -- Sales: must have exactly {salesperson}. This is the only
  -- demo user whose sole role is salesperson. The DELETE step
  -- intentionally omits this user.
  SELECT array_agg(r.role::text ORDER BY r.role::text) INTO v_roles
  FROM public.user_roles r
  WHERE r.user_id = '00000000-0000-4000-8000-000000000030'::uuid;
  IF v_roles <> ARRAY['salesperson'] THEN
    RAISE EXCEPTION
      'Pre-flight 023.3c failed: Sales user expected exact role set '
      '{salesperson}, got %', v_roles;
  END IF;

  -- Driver: must have exactly {driver, salesperson}
  SELECT array_agg(r.role::text ORDER BY r.role::text) INTO v_roles
  FROM public.user_roles r
  WHERE r.user_id = '00000000-0000-4000-8000-000000000040'::uuid;
  IF v_roles <> ARRAY['driver', 'salesperson'] THEN
    RAISE EXCEPTION
      'Pre-flight 023.3d failed: Driver user expected exact role set '
      '{driver, salesperson}, got %', v_roles;
  END IF;

  -- Helper: must have exactly {helper, salesperson}
  SELECT array_agg(r.role::text ORDER BY r.role::text) INTO v_roles
  FROM public.user_roles r
  WHERE r.user_id = '00000000-0000-4000-8000-000000000050'::uuid;
  IF v_roles <> ARRAY['helper', 'salesperson'] THEN
    RAISE EXCEPTION
      'Pre-flight 023.3e failed: Helper user expected exact role set '
      '{helper, salesperson}, got %', v_roles;
  END IF;

  -- Retailer: must have exactly {retailer, salesperson}
  SELECT array_agg(r.role::text ORDER BY r.role::text) INTO v_roles
  FROM public.user_roles r
  WHERE r.user_id = '00000000-0000-4000-8000-000000000060'::uuid;
  IF v_roles <> ARRAY['retailer', 'salesperson'] THEN
    RAISE EXCEPTION
      'Pre-flight 023.3f failed: Retailer user expected exact role set '
      '{retailer, salesperson}, got %', v_roles;
  END IF;

  -- ==========================================================
  -- STEP 4: UPDATE -- reassign the six demo users to the demo
  -- distributor. Strict six-user allow-list.
  -- ==========================================================
  UPDATE public.users
  SET distributor_id = '00000000-0000-4000-8000-000000000d01'::uuid
  WHERE id IN (
    '00000000-0000-4000-8000-000000000010'::uuid,
    '00000000-0000-4000-8000-000000000020'::uuid,
    '00000000-0000-4000-8000-000000000030'::uuid,
    '00000000-0000-4000-8000-000000000040'::uuid,
    '00000000-0000-4000-8000-000000000050'::uuid,
    '00000000-0000-4000-8000-000000000060'::uuid
  );

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows <> 6 THEN
    RAISE EXCEPTION
      'Step 023.4 failed: UPDATE affected % rows, expected exactly 6. '
      'Aborting migration 023.', v_rows;
  END IF;

  RAISE NOTICE 'Step 023.4 OK: reassigned 6 demo-user rows to distributor '
               '00000000-0000-4000-8000-000000000d01';

  -- ==========================================================
  -- STEP 5: DELETE -- remove spurious salesperson user_roles
  -- rows from the five NON-Sales demo users. The Sales user
  -- (00000000-...0030) is intentionally omitted from this list
  -- because their salesperson role is the intended one.
  -- ==========================================================
  DELETE FROM public.user_roles
  WHERE role = 'salesperson'::public.app_role
    AND user_id IN (
      '00000000-0000-4000-8000-000000000010'::uuid,  -- Admin
      '00000000-0000-4000-8000-000000000020'::uuid,  -- Manager
      '00000000-0000-4000-8000-000000000040'::uuid,  -- Driver
      '00000000-0000-4000-8000-000000000050'::uuid,  -- Helper
      '00000000-0000-4000-8000-000000000060'::uuid   -- Retailer
    );

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows <> 5 THEN
    RAISE EXCEPTION
      'Step 023.5 failed: DELETE affected % rows, expected exactly 5. '
      'Aborting migration 023.', v_rows;
  END IF;

  RAISE NOTICE 'Step 023.5 OK: deleted 5 spurious salesperson user_roles rows';

  RAISE NOTICE 'Migration 023 completed successfully.';
END $$;
