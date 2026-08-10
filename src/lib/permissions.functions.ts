import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Permission, RolePermission } from "@/lib/permissions";

/**
 * Get all permissions for the current user
 */
export const getUserPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data: permissions, error } = await supabaseAdmin.rpc(
      "get_user_permissions",
      { _user_id: context.userId }
    );

    if (error) {
      console.error("[Permissions] Failed to get user permissions:", error);
      return { permissions: [] };
    }

    return {
      permissions: ((permissions ?? []) as { permission_name: string; category: string }[]).map(
        (p) => p.permission_name
      ),
    };
  });

/**
 * Check if current user has a specific permission
 */
export const checkPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ permissionName: z.string() }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data: hasPermission, error } = await supabaseAdmin.rpc(
      "has_permission",
      {
        _user_id: context.userId,
        _permission_name: data.permissionName
      }
    );

    if (error) {
      console.error("[Permissions] Failed to check permission:", error);
      return { hasPermission: false };
    }

    return { hasPermission: hasPermission as boolean };
  });

/**
 * Get all permissions for a specific role (admin only)
 */
export const getRolePermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ role: z.string() }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Verify caller is admin
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    
    const userRoles = (roles ?? []).map((r) => r.role);
    if (!userRoles.includes("admin")) {
      throw new Error("Only admins can view role permissions");
    }

    const { data: rolePerms, error } = await supabaseAdmin
      .from("role_permissions")
      .select("id, role, permission_id, permissions:permission_id(id, name, label, description, category)")
      .eq("role", data.role as never);

    if (error) {
      console.error("[Permissions] Failed to get role permissions:", error);
      return { permissions: [] };
    }

    return { 
      permissions: (rolePerms ?? []).map((rp) => ({
        id: rp.id,
        role: rp.role,
        permission_id: rp.permission_id,
        permission: rp.permissions as Permission
      })) as RolePermission[]
    };
  });

/**
 * Update permissions for a role (admin only)
 */
export const updateRolePermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      role: z.string(),
      permissionIds: z.array(z.string().uuid())
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Verify caller is admin
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    
    const userRoles = (roles ?? []).map((r) => r.role);
    if (!userRoles.includes("admin")) {
      throw new Error("Only admins can update role permissions");
    }

    // Delete existing permissions for this role
    const { error: deleteError } = await supabaseAdmin
      .from("role_permissions")
      .delete()
      .eq("role", data.role as never);

    if (deleteError) {
      console.error("[Permissions] Failed to delete old permissions:", deleteError);
      throw new Error("Failed to update permissions");
    }

    // Insert new permissions
    if (data.permissionIds.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from("role_permissions")
        .insert(
          data.permissionIds.map((permissionId) => ({
            role: data.role,
            permission_id: permissionId
          })) as never
        );

      if (insertError) {
        console.error("[Permissions] Failed to insert new permissions:", insertError);
        throw new Error("Failed to update permissions");
      }
    }

    return { success: true };
  });

/**
 * Get all available permissions (admin only)
 */
export const getAllPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Verify caller is admin
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    
    const userRoles = (roles ?? []).map((r) => r.role);
    if (!userRoles.includes("admin")) {
      throw new Error("Only admins can view all permissions");
    }

    const { data: permissions, error } = await supabaseAdmin
      .from("permissions")
      .select("*")
      .order("category")
      .order("name");

    if (error) {
      console.error("[Permissions] Failed to get all permissions:", error);
      return { permissions: [] };
    }

    return { permissions: (permissions ?? []) as Permission[] };
  });
