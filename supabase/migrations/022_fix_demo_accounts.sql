-- ============================================================
-- 022: Corrective migration — fix 021 demo accounts
-- ============================================================
-- Problems with 021:
--   (a) First DO$$ block uses a broken FOR...LOOP (undefined variables fn, rl).
--   (b) Second DO$$ block references public.users.password_hash which was
--       DROPPED by migration 019.
--
-- This migration:
--   1. Drops the broken DO$$ blocks from 021 (they can't be dropped, but we
--      replace the provisioning with this one).
--   2. Provisions the 6 demo accounts WITHOUT password_hash.
--   3. Is fully idempotent (ON CONFLICT DO NOTHING / DO UPDATE).
--   4. Never modifies users that already have correct rows.
--   5. Uses the correct app_role enum values.
--
-- NOTE: This migration MUST run AFTER 019 (which drops password_hash).
-- ============================================================

-- pgcrypto is needed for crypt() / gen_salt(); already present from earlier
-- migrations but re-enabling is harmless.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE v_dist UUID;
BEGIN
  -- 1. Ensure the distributor record exists (idempotent).
  INSERT INTO public.distributors (id, business_name, email, status)
  VALUES ('00000000-0000-4000-8000-000000000d01', 'Demo Dairy Business', 'admin@creamroute.com', 'active')
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO v_dist FROM public.distributors LIMIT 1;

  -- Helper: provision ONE demo account.
  -- We use a nested DO block so we can declare per-row variables.
  -- auth.users: encrypted_password uses pgcrypto; password lives in Supabase Auth.
  -- public.users: NO password_hash (column was dropped in migration 019).
  -- public.profiles: account_status = 'active'.
  -- public.user_roles: role from the app_role enum.
  PERFORM _provision_demo_account(
    '00000000-0000-4000-8000-000000000010'::uuid,
    v_dist,
    'admin@demo.dairyflow.app',
    'Admin User',
    'admin'::public.app_role
  );

  PERFORM _provision_demo_account(
    '00000000-0000-4000-8000-000000000020'::uuid,
    v_dist,
    'manager@demo.dairyflow.app',
    'Manager User',
    'manager'::public.app_role
  );

  PERFORM _provision_demo_account(
    '00000000-0000-4000-8000-000000000030'::uuid,
    v_dist,
    'sales@demo.dairyflow.app',
    'Sales User',
    'salesperson'::public.app_role
  );

  PERFORM _provision_demo_account(
    '00000000-0000-4000-8000-000000000040'::uuid,
    v_dist,
    'driver@demo.dairyflow.app',
    'Driver User',
    'driver'::public.app_role
  );

  PERFORM _provision_demo_account(
    '00000000-0000-4000-8000-000000000050'::uuid,
    v_dist,
    'helper@demo.dairyflow.app',
    'Helper User',
    'helper'::public.app_role
  );

  PERFORM _provision_demo_account(
    '00000000-0000-4000-8000-000000000060'::uuid,
    v_dist,
    'retailer@demo.dairyflow.app',
    'Retailer User',
    'retailer'::public.app_role
  );
END; $$;

-- Helper function: provision one demo account idempotently.
-- Defined inside this migration so it can be dropped afterwards if desired.
CREATE OR REPLACE FUNCTION _provision_demo_account(
  p_id         UUID,
  p_dist_id    UUID,
  p_email      TEXT,
  p_full_name  TEXT,
  p_role       public.app_role
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_pw_hash TEXT;
BEGIN
  v_pw_hash := extensions.crypt('Admin@1234', extensions.gen_salt('bf', 10));

  -- auth.users: the real account. signInWithPassword reads encrypted_password here.
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    phone_change, phone_change_token, email_change_token_current,
    email_change_confirm_status, reauthentication_token,
    is_sso_user, is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    p_id, 'authenticated', 'authenticated', p_email,
    v_pw_hash,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name, 'role', p_role::text),
    now(), now(),
    '', '', '', '',
    '', '', '',
    0, '',
    false, false
  )
  ON CONFLICT (id) DO UPDATE SET
    -- Always ensure the password matches the documented demo password, in case
    -- someone changed it manually.
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = COALESCE(auth.users.email_confirmed_at, now());

  -- auth.identities: required for signInWithPassword to recognise the email.
  INSERT INTO auth.identities (
    id, provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  )
  SELECT
    gen_random_uuid(),
    p_email,
    p_id,
    jsonb_build_object(
      'sub', p_id::text,
      'email', p_email,
      'email_verified', true,
      'provider', 'email'
    ),
    'email',
    now(), now(), now()
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.identities
    WHERE user_id = p_id AND provider = 'email'
  );

  -- public.users: NO password_hash column (dropped in 019).
  INSERT INTO public.users (
    id, distributor_id, email, full_name, role, status, email_verified
  ) VALUES (
    p_id, p_dist_id, p_email, p_full_name, p_role::text, 'active', true
  )
  ON CONFLICT (id) DO UPDATE SET
    role           = EXCLUDED.role,
    status         = 'active',
    email_verified = true,
    full_name      = EXCLUDED.full_name;

  -- public.profiles
  INSERT INTO public.profiles (id, email, full_name, account_status, distributor_id)
  VALUES (p_id, p_email, p_full_name, 'active', p_dist_id)
  ON CONFLICT (id) DO UPDATE SET
    full_name      = EXCLUDED.full_name,
    email          = EXCLUDED.email,
    account_status = 'active';

  -- public.user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_id, p_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END; $$;

-- Drop the helper (it is not needed after provisioning, and keeping it creates
-- an unnecessary SECURITY DEFINER function).
DROP FUNCTION IF EXISTS _provision_demo_account(UUID, UUID, TEXT, TEXT, public.app_role);
