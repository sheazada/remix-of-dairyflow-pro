import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, requireRole } from "./_roles";

export default defineTool({
  name: "list_pending_deliveries",
  title: "List pending deliveries",
  description: "List deliveries not yet marked delivered, optionally filtered by date or route.",
  inputSchema: {
    date: z.string().optional().describe("ISO date (YYYY-MM-DD)."),
    route_id: z.string().uuid().optional(),
    limit: z.number().int().positive().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ date, route_id, limit }, ctx) => {
    const denied = await requireRole(ctx, "list_pending_deliveries");
    if (denied) return denied;
    let q = sb(ctx)
      .from("deliveries")
      .select("*")
      .neq("status", "delivered")
      .order("created_at", { ascending: false })
      .limit(Math.min(limit ?? 100, 500));
    if (date) q = q.eq("delivery_date", date);
    if (route_id) q = q.eq("route_id", route_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { deliveries: data } };
  },
});
