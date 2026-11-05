import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import {
  AccessDeniedError,
  AccessDeniedPage,
} from "@/components/access-denied";
import {
  canAccessPath,
  isRetailerRole,
  landingForRoles,
  mapUserRoleToAccessRole,
  requiredPermissionsForPath,
  type StaffRole,
} from "@/lib/access";
import { logAccessEvent } from "@/lib/audit.server";

/**
 * SECURITY FIX (Phase 1, Part B): Verify Supabase Auth session instead of
 * trusting localStorage. The browser can forge localStorage trivially.
 *
 * Flow:
 * 1. Call supabase.auth.getSession() which validates the JWT with Supabase.
 * 2. Use the verified user ID to look up the public.users row.
 * 3. Check account status from the DB (not from localStorage).
 * 4. Fetch roles and permissions from the DB (not from localStorage).
 * 5. Resolve distributor from public.users.distributor_id (trusted FK).
 */
async function resolveSession() {
  // 1. Verify the session with Supabase Auth
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    console.warn("[auth] getSession error:", sessionError.message);
    return null;
  }
  if (!session?.user) return null;

  const authUserId = session.user.id;

  // 2. Look up the public.users row by the verified auth user ID
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, distributor_id, email, mobile, full_name, role, status, email_verified")
    .eq("id", authUserId)
    .single();

  if (userError || !user) {
    console.warn("[auth] public.users lookup failed:", userError?.message);
    return null;
  }

  // 3. Account status check (from trusted DB record, not localStorage)
  if (user.status !== "active") {
    await supabase.auth.signOut();
    return null;
  }

  // 4. Fetch roles from trusted DB
  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const roles = (roleRows ?? []).map((r: any) => r.role);

  // 5. Fetch permissions via SECURITY DEFINER RPC
  let permissions: any[] = [];
  try {
    const { data: permData } = await supabase.rpc("get_user_permissions", {
      _user_id: user.id,
    });
    permissions = (permData ?? []).map((p: any) => ({
      name: p.permission_name,
      label: p.permission_label,
      category: p.category,
    }));
  } catch (err) {
    console.warn("[auth] get_user_permissions failed:", err);
  }

  // 6. Resolve distributor from trusted FK
  let distributor: any = null;
  if (user.distributor_id) {
    const { data: dist } = await supabase
      .from("distributors")
      .select("*")
      .eq("id", user.distributor_id)
      .maybeSingle();
    distributor = dist ?? null;
  }

  return { user, distributor, roles, permissions };
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // 1. Verify session with Supabase Auth (NOT localStorage)
    const session = await resolveSession();

    if (!session) {
      // Invalidate any stale localStorage — defense in depth
      localStorage.removeItem("creamroute_user");
      localStorage.removeItem("creamroute_distributor");
      localStorage.removeItem("creamroute_permissions");
      throw redirect({ to: "/auth" });
    }

    const { user, distributor, roles, permissions } = session;

    // 2. Map business role to access-layer role
    const accessRoles = roles.map(mapUserRoleToAccessRole).filter(Boolean);

    // 3. Retailers never belong in the staff app
    if (isRetailerRole(accessRoles)) throw redirect({ to: "/retailer" });

    const landing = landingForRoles(accessRoles);
    if (landing === "/auth") throw redirect({ to: "/auth", search: { next: undefined } });

    // 4. Permission check (default-deny for unknown routes — Part C)
    const path = location.pathname;
    const allowed = canAccessPath(path, permissions.map((p: any) => p.name));
    const required = requiredPermissionsForPath(path);

    if (!allowed) {
      logAccessEvent({
        data: {
          eventType: "access_denied",
          userId: user.id,
          userEmail: user.email ?? null,
          userRoles: accessRoles,
          requiredRoles: required,
          routePath: path,
          reason: `User permissions [${permissions.map((p: any) => p.name).join(",")}] missing required [${required.join(",")}]`,
        },
      }).catch((err) => console.warn("[audit] logAccessEvent failed:", err));

      throw new AccessDeniedError({
        requiredRoles: required,
        userRoles: accessRoles,
        attemptedPath: path,
      });
    }

    return { user, distributor, roles: accessRoles, permissions };
  },
  errorComponent: ({ error }) => {
    if (error instanceof AccessDeniedError) {
      return (
        <AccessDeniedPage
          context={{
            requiredRoles: error.requiredRoles,
            userRoles: error.userRoles,
            attemptedPath: error.attemptedPath,
          }}
        />
      );
    }
    return (
      <div className="p-10 text-center text-muted-foreground">
        <div className="text-lg font-semibold mb-2">Something went wrong</div>
        <div className="text-sm">{(error as Error)?.message ?? "Unknown error"}</div>
      </div>
    );
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
