-- 017_security_hardening.sql
-- Safe re-implementation of the security review.
-- Every statement verified against the live schema and the app code:
-- login, expenses, audit log, notifications and invoice revision keep working.

--------------------------------------------------------------------
-- 1) Pre-auth account lookup: replace the anonymous full-table scan
--    of public.users with a narrow SECURITY DEFINER function that
--    returns only login-critical columns for ONE matched account.
--    (auth.tsx now calls this instead of selecting users as anon.)
--------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_login_account(_email text, _mobile text)
RETURNS TABLE (
  id uuid,
  email text,
  mobile text,
  status text,
  role text,
  full_name text,
  distributor_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT u.id, u.email, u.mobile, u.status, u.role, u.full_name, u.distributor_id
  FROM public.users u
  WHERE (_email IS NOT NULL AND lower(u.email) = lower(_email))
     OR (_mobile IS NOT NULL AND u.mobile = _mobile)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_login_account(text, text) TO anon, authenticated, service_role;

-- Now that login uses the function, remove anonymous access to users.
DROP POLICY IF EXISTS users_select_anon_login ON public.users;
REVOKE ALL ON TABLE public.users FROM anon;

--------------------------------------------------------------------
-- 2) Verification / password-reset tokens: server-side code only.
--    (Edge functions run as service_role and keep access.)
--------------------------------------------------------------------
DROP POLICY IF EXISTS email_verification_tokens_select_anon ON public.email_verification_tokens;
REVOKE ALL ON TABLE public.email_verification_tokens FROM anon;
REVOKE ALL ON TABLE public.password_reset_tokens FROM anon;

--------------------------------------------------------------------
-- 3) Account-status enforcement inside the RLS helper functions.
--    Previously is_account_active read profiles.account_status which
--    is never set, so suspended/blocked accounts kept full data
--    access. Now it reads users.status + locked_until.
--------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_account_active(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = _user_id
      AND (u.status <> 'active' OR (u.locked_until IS NOT NULL AND u.locked_until > now()))
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_account_active(_uid) AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role IN ('admin','manager','salesperson','driver','helper')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_internal_staff(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_account_active(_uid) AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role IN ('admin','manager','salesperson','driver','helper')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_distributor(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = _uid AND role = 'distributor' AND status = 'active'
      AND (locked_until IS NULL OR locked_until <= now())
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_sales(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_account_active(_uid) AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role IN ('admin','manager','salesperson')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_finance(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_account_active(_uid) AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role IN ('admin','manager')
  );
$$;

CREATE OR REPLACE FUNCTION public.my_customer_id(_uid uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id FROM public.customers
  WHERE user_id = _uid AND public.is_account_active(_uid)
  LIMIT 1;
$$;

--------------------------------------------------------------------
-- 4) distributors: staff/distributor read, distributor/admin write
--    (was: any signed-in account could read AND write everything)
--------------------------------------------------------------------
DROP POLICY IF EXISTS distributors_select ON public.distributors;
DROP POLICY IF EXISTS distributors_insert ON public.distributors;
DROP POLICY IF EXISTS distributors_update ON public.distributors;
CREATE POLICY distributors_select ON public.distributors FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()) OR public.is_distributor(auth.uid()));
CREATE POLICY distributors_insert ON public.distributors FOR INSERT TO authenticated
  WITH CHECK (public.is_distributor(auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY distributors_update ON public.distributors FOR UPDATE TO authenticated
  USING (public.is_distributor(auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_distributor(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

--------------------------------------------------------------------
-- 5) permissions / role_permissions: internal staff + distributor read.
--    (Retailer portal never reads these tables directly - it uses the
--    SECURITY DEFINER rpc get_user_permissions, which is unaffected.)
--------------------------------------------------------------------
DROP POLICY IF EXISTS permissions_select ON public.permissions;
DROP POLICY IF EXISTS permissions_staff_read ON public.permissions;
CREATE POLICY permissions_staff_read ON public.permissions FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()) OR public.is_distributor(auth.uid()));

DROP POLICY IF EXISTS role_permissions_select ON public.role_permissions;
DROP POLICY IF EXISTS role_permissions_staff_read ON public.role_permissions;
CREATE POLICY role_permissions_staff_read ON public.role_permissions FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()) OR public.is_distributor(auth.uid()));

--------------------------------------------------------------------
-- 6) user_roles: role management for admin/distributor only.
--    (Existing roles_admin_* and roles_read_self policies stay; this
--    adds distributor management + full read for admin/distributor.)
--------------------------------------------------------------------
DROP POLICY IF EXISTS user_roles_admin_write ON public.user_roles;
CREATE POLICY user_roles_admin_write ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_distributor(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_distributor(auth.uid()));

--------------------------------------------------------------------
-- 7) Fix mutable search_path on every public function lacking one.
--------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (p.proconfig IS NULL OR NOT EXISTS (
        SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'))
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path TO ''public''', r.sig);
  END LOOP;
END $$;

--------------------------------------------------------------------
-- 8) Function execution privileges.
--    a) Signed-out visitors can no longer call ANY helper function
--       (except the login lookup created above).
--    b) Sensitive server-side functions are revoked from the browser
--       session (authenticated) as well. NOTE: log_access_event,
--       record_notification_attempt and revise_invoice are KEPT for
--       authenticated because the app UI calls them directly.
--------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND p.proname <> 'get_login_account'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'create_notification',
        'send_notification',
        'get_app_setting',
        'link_customer_to_user',
        'enqueue_run_en_route_notifications',
        'has_reminder_been_sent',
        'get_customer_by_user_email',
        'get_next_revision_no',
        'handle_new_user'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
  END LOOP;
END $$;
