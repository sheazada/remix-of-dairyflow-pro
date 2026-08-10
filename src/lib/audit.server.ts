// Server function for writing access audit events.
// Used by both the login page (login events) and route guards (access_denied events).

import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/authz";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AuditEvent = {
  eventType: "login_success" | "login_failure" | "logout" | "access_denied";
  userId: string | null;
  userEmail: string | null;
  userRoles: string[];
  requiredRoles: string[];
  routePath: string | null;
  reason?: string | null;
};

function extractClientInfo() {
  let headers: Headers | null = null;
  try {
    headers = getRequestHeaders() as unknown as Headers;
  } catch {
    headers = null;
  }
  return {
    ip:
      headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      headers?.get("x-real-ip") ??
      headers?.get("cf-connecting-ip") ??
      "unknown",
    userAgent: headers?.get("user-agent") ?? "unknown",
  };
}

export const logAccessEvent = createServerFn({ method: "POST" })
  .inputValidator((data: AuditEvent) => data)
  .handler(async ({ data }) => {
    const { ip, userAgent } = extractClientInfo();

    const { error } = await supabaseAdmin.rpc("log_access_event", {
      _event_type: data.eventType,
      _user_id: data.userId as string,
      _user_email: data.userEmail as string,
      _user_roles: data.userRoles,
      _required_roles: data.requiredRoles,
      _route_path: data.routePath as string,
      _ip_address: ip,
      _user_agent: userAgent,
      _reason: (data.reason ?? null) as string,
    });

    if (error) {
      // Audit logging must never break the user-facing flow.
      console.error("[audit] log_access_event failed:", error);
    }
    return { ok: !error };
  });

// Fetch recent audit events (admin only).
export const fetchAccessAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { limit?: number; eventType?: string } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    // The table's RLS restricts SELECT to admins; the service-role client
    // bypasses RLS, so enforce the same restriction explicitly here.
    await requireRole(context.supabase, context.userId, ["admin"]);

    const limit = Math.min(Math.max(data.limit ?? 100, 1), 500);
    let q = supabaseAdmin
      .from("access_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (data.eventType && data.eventType !== "all") {
      q = q.eq("event_type", data.eventType);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

