import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { RetailerShell } from "@/components/retailer-shell";
import {
  AccessDeniedError,
  AccessDeniedPage,
} from "@/components/access-denied";
import { logAccessEvent } from "@/lib/audit.server";
import { isRetailerRole } from "@/lib/access";

export const Route = createFileRoute("/retailer")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { next: undefined } });

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const roles = (roleRows ?? []).map((r) => r.role as string);

    if (!isRetailerRole(roles)) {
      logAccessEvent({
        data: {
          eventType: "access_denied",
          userId: data.user.id,
          userEmail: data.user.email ?? null,
          userRoles: roles,
          requiredRoles: ["retailer"],
          routePath: location.pathname,
          reason: `Non-retailer (${roles.join(",")}) tried to access retailer portal`,
        },
      }).catch((err) => console.warn("[audit] logAccessEvent failed:", err));
      throw redirect({ to: "/dashboard" });
    }

    return { user: data.user, roles };
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
    <RetailerShell>
      <Outlet />
    </RetailerShell>
  ),
});
