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
  requiredPermissionsForPath,
  type StaffRole,
} from "@/lib/access";
import { logAccessEvent } from "@/lib/audit.server";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // 1. Check if user is logged in (using localStorage for now)
    const userStr = localStorage.getItem("creamroute_user");
    const distributorStr = localStorage.getItem("creamroute_distributor");

    if (!userStr || !distributorStr) {
      throw redirect({ to: "/auth" });
    }

    const user = JSON.parse(userStr);
    const distributor = JSON.parse(distributorStr);
    const permissions = JSON.parse(localStorage.getItem("creamroute_permissions") || "[]");

    // 2. Check account status
    if (user.status !== "active") {
      localStorage.removeItem("creamroute_user");
      localStorage.removeItem("creamroute_distributor");
      localStorage.removeItem("creamroute_permissions");
      throw redirect({ to: "/auth" });
    }

    // 3. Resolve roles (for backward compatibility)
    const roles = [user.role];

    // 4. Retailers never belong in the staff app.
    if (isRetailerRole(roles)) throw redirect({ to: "/retailer" });

    const landing = landingForRoles(roles);
    if (landing === "/auth") throw redirect({ to: "/auth", search: { next: undefined } });

    // 5. Permission check.
    const path = location.pathname;
    const allowed = canAccessPath(path, permissions.map((p: any) => p.name));
    const required = requiredPermissionsForPath(path);

    if (!allowed) {
      logAccessEvent({
        data: {
          eventType: "access_denied",
          userId: user.id,
          userEmail: user.email ?? null,
          userRoles: roles,
          requiredRoles: required,
          routePath: path,
          reason: `User permissions [${permissions.map((p: any) => p.name).join(",")}] missing required [${required.join(",")}]`,
        },
      }).catch((err) => console.warn("[audit] logAccessEvent failed:", err));

      throw new AccessDeniedError({
        requiredRoles: required,
        userRoles: roles,
        attemptedPath: path,
      });
    }

    return { user, distributor, roles, permissions };
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
