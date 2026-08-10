import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, requireRole } from "./_roles";

export default defineTool({
  name: "list_products",
  title: "List products",
  description: "List dairy products in the catalog with optional name search. Returns id, name, sku, unit, price, gst rate, hsn.",
  inputSchema: {
    search: z.string().optional().describe("Filter by product name (case-insensitive contains)."),
    limit: z.number().int().positive().optional().describe("Max rows (default 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    const denied = await requireRole(ctx, "list_products");
    if (denied) return denied;
    let q = sb(ctx)
      .from("products")
      .select("*")
      .order("name")
      .limit(Math.min(limit ?? 100, 500));
    if (search) q = q.ilike("name", `%${search}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { products: data } };
  },
});
