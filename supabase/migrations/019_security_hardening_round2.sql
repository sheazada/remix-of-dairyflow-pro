-- 019_security_hardening_round2.sql
-- Second hardening round, based on the live security scan (post-017).

--------------------------------------------------------------------
-- 1) Verification / reset tokens: fully server-side.
--    Any signed-in user previously could insert/read/update rows in
--    these tables; now only service_role / edge functions can.
--------------------------------------------------------------------
DROP POLICY IF EXISTS email_verification_tokens_insert ON public.email_verification_tokens;
DROP POLICY IF EXISTS email_verification_tokens_select ON public.email_verification_tokens;
DROP POLICY IF EXISTS email_verification_tokens_update ON public.email_verification_tokens;
REVOKE ALL ON TABLE public.email_verification_tokens FROM authenticated;

DROP POLICY IF EXISTS password_reset_tokens_insert ON public.password_reset_tokens;
DROP POLICY IF EXISTS password_reset_tokens_select ON public.password_reset_tokens;
DROP POLICY IF EXISTS password_reset_tokens_update ON public.password_reset_tokens;
REVOKE ALL ON TABLE public.password_reset_tokens FROM authenticated;

--------------------------------------------------------------------
-- 2) Suspended / blocked / locked accounts lose ALL privileges,
--    including admin paths that check has_role directly.
--------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.is_account_active(_user_id) AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

--------------------------------------------------------------------
-- 3) No forged login-history / audit entries: writers may only
--    insert rows attributed to themselves (the SECURITY DEFINER
--    audit functions bypass RLS and are unaffected).
--------------------------------------------------------------------
DROP POLICY IF EXISTS login_history_insert ON public.login_history;
CREATE POLICY login_history_insert ON public.login_history FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS access_audit_logs_insert ON public.access_audit_logs;
CREATE POLICY access_audit_logs_insert ON public.access_audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
CREATE POLICY audit_logs_insert ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_finance(auth.uid()));

--------------------------------------------------------------------
-- 4) Defence in depth: a non-admin session can never modify the
--    privileged columns of public.users (role, status, lock, owner).
--------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_users_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT (public.has_role(auth.uid(), 'admin') OR public.is_distributor(auth.uid())) THEN
    NEW.role := OLD.role;
    NEW.status := OLD.status;
    NEW.locked_until := OLD.locked_until;
    NEW.distributor_id := OLD.distributor_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_users_privileged ON public.users;
CREATE TRIGGER protect_users_privileged
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_users_privileged_columns();

--------------------------------------------------------------------
-- 5) Drop the legacy password_hash column. It only ever contained
--    the placeholder 'supabase-managed'; real password hashes live
--    inside Supabase Auth and are never exposed through PostgREST.
--------------------------------------------------------------------
ALTER TABLE public.users DROP COLUMN IF EXISTS password_hash;
