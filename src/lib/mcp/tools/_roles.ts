import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

export type AppRole = "admin" | "manager" | "salesperson" | "driver" | "helper";

// Which roles may call each tool. Admin & manager get everything.
export const TOOL_ROLES: Record<string, AppRole[]> = {
  list_customers: ["admin", "manager", "salesperson", "driver", "helper"],
  list_products: ["admin", "manager", "salesperson", "driver", "helper"],
  list_recent_invoices: ["admin", "manager", "salesperson"],
  daily_demand: ["admin", "manager", "salesperson", "driver", "helper"],
  list_pending_deliveries: ["admin", "manager", "driver", "helper"],
  mark_delivery_collected: ["admin", "manager", "driver", "helper"],
  upload_pod_proof: ["admin", "manager", "driver", "helper"],
};

export function sb(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function fetchRoles(ctx: ToolContext): Promise<AppRole[]> {
  const uid = ctx.getUserId();
  if (!uid) return [];
  const { data, error } = await sb(ctx).from("user_roles").select("role").eq("user_id", uid);
  if (error || !data) return [];
  return data.map((r: { role: AppRole }) => r.role);
}

function friendly(toolName: string, allowed: AppRole[], have: AppRole[]) {
  const yours = have.length ? have.join(", ") : "no assigned role";
  return (
    `You don't have permission to use "${toolName}". ` +
    `This tool is available to: ${allowed.join(", ")}. ` +
    `Your role: ${yours}. Ask an admin to grant you access if you need it.`
  );
}

/**
 * Guard a tool by role. Returns null if allowed, or an MCP error result if not.
 */
export async function requireRole(ctx: ToolContext, toolName: string) {
  if (!ctx.isAuthenticated()) {
    return {
      content: [{ type: "text" as const, text: "Not authenticated. Please sign in to use this tool." }],
      isError: true,
    };
  }
  const allowed = TOOL_ROLES[toolName];
  if (!allowed) return null;
  const roles = await fetchRoles(ctx);
  if (roles.some((r) => allowed.includes(r))) return null;
  return {
    content: [{ type: "text" as const, text: friendly(toolName, allowed, roles) }],
    isError: true,
  };
}
