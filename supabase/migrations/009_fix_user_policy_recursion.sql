-- Fix infinite RLS recursion on public.users.
--
-- The original policies (users_select_admin / users_insert / users_update)
-- contained EXISTS (SELECT 1 FROM public.users ...) — a policy whose USING
-- clause queries its own table. For any authenticated session this causes
-- "infinite recursion detected in policy for relation users" (HTTP 500 from
-- PostgREST), which the app surfaced as "Invalid credentials".
--
-- Replace the self-reference with a SECURITY DEFINER helper (runs as the
-- function owner, bypassing RLS, so no recursion).

CREATE OR REPLACE FUNCTION public.is_distributor(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = _uid AND role = 'distributor'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_distributor(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS users_select_admin ON public.users;
CREATE POLICY users_select_admin ON public.users
  FOR SELECT TO authenticated
  USING (public.is_distributor(auth.uid()));

DROP POLICY IF EXISTS users_insert ON public.users;
CREATE POLICY users_insert ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (public.is_distributor(auth.uid()));

DROP POLICY IF EXISTS users_update ON public.users;
CREATE POLICY users_update ON public.users
  FOR UPDATE TO authenticated
  USING (public.is_distributor(auth.uid()))
  WITH CHECK (public.is_distributor(auth.uid()));
