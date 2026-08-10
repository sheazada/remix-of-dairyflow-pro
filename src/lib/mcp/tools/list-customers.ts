import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, requireRole } from "./_roles";

export default defineTool({
  name: "list_customers",
  title: "List customers (retail shops)",
  description:
    "List retail shop customers visible to the signed-in user, with optional name search and dues filter. Returns id, name, phone, area, and outstanding balance.",
  inputSchema: {
    search: z.string().optional().describe("Filter by customer name (case-insensitive contains)."),
    with_dues_only: z.boolean().optional().describe("Only include customers with outstanding > 0."),
    limit: z.number().int().positive().optional().describe("Max rows (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, with_dues_only, limit }, ctx) => {
    const denied = await requireRole(ctx, "list_customers");
    if (denied) return denied;
    let q = sb(ctx)
      .from("customers")
      .select("id, name, phone, area, outstanding")
      .order("name")
      .limit(Math.min(limit ?? 50, 500));
    if (search) q = q.ilike("name", `%${search}%`);
    if (with_dues_only) q = q.gt("outstanding", 0);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { customers: data } };
  },
});
