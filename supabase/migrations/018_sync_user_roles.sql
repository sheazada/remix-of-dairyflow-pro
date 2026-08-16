-- 018_sync_user_roles.sql
-- Ensure every account has a user_roles row matching its business role.
-- Some accounts (e.g. retailer logins created outside the admin UI) were
-- missing their user_roles row, which locked them out of their portal
-- (the /retailer guard reads user_roles, not users.role).
INSERT INTO public.user_roles (user_id, role)
SELECT u.id,
       (CASE u.role
          WHEN 'distributor'  THEN 'admin'
          WHEN 'manager'      THEN 'manager'
          WHEN 'accountant'   THEN 'manager'
          WHEN 'warehouse'    THEN 'helper'
          WHEN 'salesman'     THEN 'salesperson'
          WHEN 'delivery_boy' THEN 'driver'
          WHEN 'retailer'     THEN 'retailer'
        END)::public.app_role
FROM public.users u
WHERE u.role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;
