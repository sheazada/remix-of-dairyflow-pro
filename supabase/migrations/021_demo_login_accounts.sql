-- ============================================================
-- 021: Demo login accounts for every role
-- Password for ALL accounts: Admin@1234
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_dist UUID;
  v_uid  UUID;
BEGIN
  -- Make sure distributor exists
  INSERT INTO public.distributors (id, business_name, email, status)
  VALUES ('00000000-0000-4000-8000-000000000d01', 'Demo Dairy Business', 'admin@creamroute.com', 'active')
  ON CONFLICT (id) DO NOTHING;
  SELECT id INTO v_dist FROM public.distributors LIMIT 1;

  -- Helper: one insert per demo account
  -- Each gets an auth.users row (so signInWithPassword works),
  -- a public.users row (so our route guard sees the role),
  -- a profile, and a role in user_roles.
  FOR v_uid, v_dist IN
    SELECT * FROM (VALUES
      ('00000000-0000-4000-8000-000000000010'::uuid, v_dist::uuid, 'admin@demo.dairyflow.app',    'Admin User',    'admin'),
      ('00000000-0000-4000-8000-000000000020'::uuid, v_dist::uuid, 'manager@demo.dairyflow.app',   'Manager User',  'manager'),
      ('00000000-0000-4000-8000-000000000030'::uuid, v_dist::uuid, 'sales@demo.dairyflow.app',     'Sales User',    'salesperson'),
      ('00000000-0000-4000-8000-000000000040'::uuid, v_dist::uuid, 'driver@demo.dairyflow.app',    'Driver User',   'driver'),
      ('00000000-0000-4000-8000-000000000050'::uuid, v_dist::uuid, 'helper@demo.dairyflow.app',    'Helper User',   'helper'),
      ('00000000-0000-4000-8000-000000000060'::uuid, v_dist::uuid, 'retailer@demo.dairyflow.app',  'Retailer User', 'retailer')
    ) AS t(uid, dist, em, fn, rl)
    LOOP
      -- Auth user (signInWithPassword needs this)
      INSERT INTO auth.users (
        instance_id, id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at,
        confirmation_token, email_change, email_change_token_new, recovery_token,
        is_sso_user, is_anonymous, phone_change, phone_change_token,
        email_change_token_current, email_change_confirm_status, reauthentication_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_uid, 'authenticated', 'authenticated', v_uid::text || '@' || v_dist::text,  -- placeholder, fixed below
        extensions.crypt('Admin@1234', extensions.gen_salt('bf', 10)),
        now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', fn, 'role', rl),
        now(), now(),
        '', '', '', '',
        false, false, '', '',
        '', 0, ''
      )
      ON CONFLICT (id) DO UPDATE SET
        encrypted_password = EXCLUDED.encrypted_password,
        email_confirmed_at = now();

      -- Fix email (must be unique per row)
      UPDATE auth.users SET email = em WHERE id = v_uid;
    END LOOP;
END; $$;

-- Simpler: do each user one by one with fixed IDs.
DO $$
DECLARE v_dist UUID;
BEGIN
  SELECT id INTO v_dist FROM public.distributors LIMIT 1;

  -- ADMIN
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token, phone_change, phone_change_token, email_change_token_current, email_change_confirm_status, reauthentication_token, is_sso_user, is_anonymous)
  VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000010', 'authenticated', 'authenticated', 'admin@demo.dairyflow.app', extensions.crypt('Admin@1234', extensions.gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Admin User","role":"admin"}', now(), now(), '', '', '', '', '', '', '', 0, '', false, false)
  ON CONFLICT (id) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password, email_confirmed_at = now();
  INSERT INTO public.users (id, distributor_id, email, full_name, password_hash, role, status, email_verified) VALUES ('00000000-0000-4000-8000-000000000010', v_dist, 'admin@demo.dairyflow.app', 'Admin User', 'supabase_auth', 'admin', 'active', true) ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = 'active';
  INSERT INTO public.profiles (id, email, full_name, account_status, distributor_id) VALUES ('00000000-0000-4000-8000-000000000010', 'admin@demo.dairyflow.app', 'Admin User', 'active', v_dist) ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;
  INSERT INTO public.user_roles (user_id, role) VALUES ('00000000-0000-4000-8000-000000000010', 'admin') ON CONFLICT DO NOTHING;

  -- MANAGER
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token, phone_change, phone_change_token, email_change_token_current, email_change_confirm_status, reauthentication_token, is_sso_user, is_anonymous)
  VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000020', 'authenticated', 'authenticated', 'manager@demo.dairyflow.app', extensions.crypt('Admin@1234', extensions.gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Manager User","role":"manager"}', now(), now(), '', '', '', '', '', '', '', 0, '', false, false)
  ON CONFLICT (id) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password, email_confirmed_at = now();
  INSERT INTO public.users (id, distributor_id, email, full_name, password_hash, role, status, email_verified) VALUES ('00000000-0000-4000-8000-000000000020', v_dist, 'manager@demo.dairyflow.app', 'Manager User', 'supabase_auth', 'manager', 'active', true) ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = 'active';
  INSERT INTO public.profiles (id, email, full_name, account_status, distributor_id) VALUES ('00000000-0000-4000-8000-000000000020', 'manager@demo.dairyflow.app', 'Manager User', 'active', v_dist) ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;
  INSERT INTO public.user_roles (user_id, role) VALUES ('00000000-0000-4000-8000-000000000020', 'manager') ON CONFLICT DO NOTHING;

  -- SALESPERSON
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token, phone_change, phone_change_token, email_change_token_current, email_change_confirm_status, reauthentication_token, is_sso_user, is_anonymous)
  VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000030', 'authenticated', 'authenticated', 'sales@demo.dairyflow.app', extensions.crypt('Admin@1234', extensions.gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sales User","role":"salesperson"}', now(), now(), '', '', '', '', '', '', '', 0, '', false, false)
  ON CONFLICT (id) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password, email_confirmed_at = now();
  INSERT INTO public.users (id, distributor_id, email, full_name, password_hash, role, status, email_verified) VALUES ('00000000-0000-4000-8000-000000000030', v_dist, 'sales@demo.dairyflow.app', 'Sales User', 'supabase_auth', 'salesperson', 'active', true) ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = 'active';
  INSERT INTO public.profiles (id, email, full_name, account_status, distributor_id) VALUES ('00000000-0000-4000-8000-000000000030', 'sales@demo.dairyflow.app', 'Sales User', 'active', v_dist) ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;
  INSERT INTO public.user_roles (user_id, role) VALUES ('00000000-0000-4000-8000-000000000030', 'salesperson') ON CONFLICT DO NOTHING;

  -- DRIVER
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token, phone_change, phone_change_token, email_change_token_current, email_change_confirm_status, reauthentication_token, is_sso_user, is_anonymous)
  VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000040', 'authenticated', 'authenticated', 'driver@demo.dairyflow.app', extensions.crypt('Admin@1234', extensions.gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Driver User","role":"driver"}', now(), now(), '', '', '', '', '', '', '', 0, '', false, false)
  ON CONFLICT (id) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password, email_confirmed_at = now();
  INSERT INTO public.users (id, distributor_id, email, full_name, password_hash, role, status, email_verified) VALUES ('00000000-0000-4000-8000-000000000040', v_dist, 'driver@demo.dairyflow.app', 'Driver User', 'supabase_auth', 'driver', 'active', true) ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = 'active';
  INSERT INTO public.profiles (id, email, full_name, account_status, distributor_id) VALUES ('00000000-0000-4000-8000-000000000040', 'driver@demo.dairyflow.app', 'Driver User', 'active', v_dist) ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;
  INSERT INTO public.user_roles (user_id, role) VALUES ('00000000-0000-4000-8000-000000000040', 'driver') ON CONFLICT DO NOTHING;

  -- HELPER
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token, phone_change, phone_change_token, email_change_token_current, email_change_confirm_status, reauthentication_token, is_sso_user, is_anonymous)
  VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000050', 'authenticated', 'authenticated', 'helper@demo.dairyflow.app', extensions.crypt('Admin@1234', extensions.gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Helper User","role":"helper"}', now(), now(), '', '', '', '', '', '', '', 0, '', false, false)
  ON CONFLICT (id) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password, email_confirmed_at = now();
  INSERT INTO public.users (id, distributor_id, email, full_name, password_hash, role, status, email_verified) VALUES ('00000000-0000-4000-8000-000000000050', v_dist, 'helper@demo.dairyflow.app', 'Helper User', 'supabase_auth', 'helper', 'active', true) ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = 'active';
  INSERT INTO public.profiles (id, email, full_name, account_status, distributor_id) VALUES ('00000000-0000-4000-8000-000000000050', 'helper@demo.dairyflow.app', 'Helper User', 'active', v_dist) ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;
  INSERT INTO public.user_roles (user_id, role) VALUES ('00000000-0000-4000-8000-000000000050', 'helper') ON CONFLICT DO NOTHING;

  -- RETAILER
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token, phone_change, phone_change_token, email_change_token_current, email_change_confirm_status, reauthentication_token, is_sso_user, is_anonymous)
  VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000060', 'authenticated', 'authenticated', 'retailer@demo.dairyflow.app', extensions.crypt('Admin@1234', extensions.gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Retailer User","role":"retailer"}', now(), now(), '', '', '', '', '', '', '', 0, '', false, false)
  ON CONFLICT (id) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password, email_confirmed_at = now();
  INSERT INTO public.users (id, distributor_id, email, full_name, password_hash, role, status, email_verified) VALUES ('00000000-0000-4000-8000-000000000060', v_dist, 'retailer@demo.dairyflow.app', 'Retailer User', 'supabase_auth', 'retailer', 'active', true) ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = 'active';
  INSERT INTO public.profiles (id, email, full_name, account_status, distributor_id) VALUES ('00000000-0000-4000-8000-000000000060', 'retailer@demo.dairyflow.app', 'Retailer User', 'active', v_dist) ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;
  INSERT INTO public.user_roles (user_id, role) VALUES ('00000000-0000-4000-8000-000000000060', 'retailer') ON CONFLICT DO NOTHING;
END; $$;

-- Verify (should show 6 rows)
SELECT email, (raw_user_meta_data->>'full_name')::text AS name, (raw_user_meta_data->>'role')::text AS role
FROM auth.users
WHERE email LIKE '%@demo.dairyflow.app'
ORDER BY role;
