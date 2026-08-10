import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, requireRole } from "./_roles";

export default defineTool({
  name: "list_recent_invoices",
  title: "List recent invoices",
  description: "List recent GST invoices visible to the signed-in user, optionally filtered by customer or date range.",
  inputSchema: {
    customer_id: z.string().uuid().optional(),
    from_date: z.string().optional().describe("ISO date (YYYY-MM-DD) inclusive."),
    to_date: z.string().optional().describe("ISO date (YYYY-MM-DD) inclusive."),
    limit: z.number().int().positive().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ customer_id, from_date, to_date, limit }, ctx) => {
    const denied = await requireRole(ctx, "list_recent_invoices");
    if (denied) return denied;
    let q = sb(ctx)
      .from("invoices")
      .select("id, invoice_number, invoice_date, customer_id, total, paid, balance, status")
      .order("invoice_date", { ascending: false })
      .limit(Math.min(limit ?? 50, 500));
    if (customer_id) q = q.eq("customer_id", customer_id);
    if (from_date) q = q.gte("invoice_date", from_date);
    if (to_date) q = q.lte("invoice_date", to_date);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { invoices: data } };
  },
});
