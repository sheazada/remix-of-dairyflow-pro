import { useQuery } from "@tanstack/react-query";
import { getUserPermissions } from "@/lib/permissions.functions";
import { useServerFn } from "@tanstack/react-start";
import { type PermissionName } from "@/lib/permissions";

/**
 * Hook to get all permissions for the current user
 */
export function useUserPermissions() {
  const getUserPerms = useServerFn(getUserPermissions);

  const { data, isLoading } = useQuery({
    queryKey: ["user-permissions"],
    queryFn: async () => {
      const result = await getUserPerms({ data: undefined });
      return result.permissions;
    },
    staleTime: 5 * 60_000, // 5 minutes
  });

  return {
    permissions: data ?? [],
    isLoading,
    hasPermission: (permissionName: string) =>
      (data ?? []).some((p) => p.name === permissionName),
  };
}

/**
 * Hook to check a single permission
 */
export function usePermission(permissionName: PermissionName | string) {
  const { permissions, isLoading } = useUserPermissions();
  
  return {
    hasPermission: permissions.some((p) => p.name === permissionName),
    isLoading,
  };
}

/**
 * Hook to check multiple permissions at once
 */
export function usePermissions(permissionNames: Array<PermissionName | string>) {
  const { permissions, isLoading } = useUserPermissions();
  
  const permissionMap = new Map(
    permissions.map((p) => [p.name, true])
  );

  return {
    hasAllPermissions: permissionNames.every((name) => permissionMap.has(name)),
    hasAnyPermission: permissionNames.some((name) => permissionMap.has(name)),
    getPermissionStatus: (name: string) => permissionMap.has(name),
    isLoading,
  };
}
