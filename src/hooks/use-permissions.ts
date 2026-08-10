// Client-side cached permission hook.
//
// Returns the current user's roles and a set of helper predicates:
//   - is(role)             — true if user has the role
//   - isAny(roles)         — true if user has any of the roles
//   - canAccess(path)      — true if any user role is allowed on the path
//
// Cached via React Query. Invalidate with qc.invalidateQueries({ queryKey: ['permissions'] })
// whenever a user's roles change (admin page, etc.).

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { canAccessPath, type StaffRole } from "@/lib/access";
import { useCallback, useEffect } from "react";

type PermissionResult = {
  roles: StaffRole[];
  userId: string | null;
  isLoading: boolean;
  is: (role: StaffRole) => boolean;
  isAny: (roles: StaffRole[]) => boolean;
  canAccess: (path: string) => boolean;
  refresh: () => void;
};

const PERMISSIONS_QUERY_KEY = ["permissions"];

export function usePermissions(): PermissionResult {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: PERMISSIONS_QUERY_KEY,
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return { userId: null, roles: [] as StaffRole[] };

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userRes.user.id);

      return {
        userId: userRes.user.id,
        roles: (rolesData ?? []).map((r) => r.role as StaffRole),
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

  const userId = data?.userId ?? null;
  const roles: StaffRole[] = data?.roles ?? [];

  const is = useCallback(
    (role: StaffRole) => roles.includes(role),
    [roles],
  );

  const isAny = useCallback(
    (rolesList: StaffRole[]) => rolesList.some((r) => roles.includes(r)),
    [roles],
  );

  const canAccess = useCallback(
    (path: string) => canAccessPath(path, roles),
    [roles],
  );

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: PERMISSIONS_QUERY_KEY });
  }, [qc]);

  return {
    roles,
    userId,
    isLoading,
    is,
    isAny,
    canAccess,
    refresh,
  };
}

// Invalidate the permissions cache after a role change.
// Call this from the admin roles page after editing.
export function usePermissionsInvalidation(deps: unknown[] = []) {
  const qc = useQueryClient();
  useEffect(() => {
    qc.invalidateQueries({ queryKey: PERMISSIONS_QUERY_KEY });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export const PERMISSIONS_QUERY_KEY_EXPORT = PERMISSIONS_QUERY_KEY;
