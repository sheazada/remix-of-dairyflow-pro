-- is_staff() originally treated ANY user_roles row as staff, so a retailer
-- (who also gets a user_roles row) passed every staff policy and saw all
-- data. Staff = the five internal roles only.
CREATE OR REPLACE FUNCTION public.is_staff(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role IN ('admin','manager','salesperson','driver','helper')
  );
$$;
