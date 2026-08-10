import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, requireRole } from "./_roles";

export default defineTool({
  name: "daily_demand",
  title: "Daily pickup demand",
  description:
    "Aggregate product quantities to pick up from Sudha Dairy for a given date, based on confirmed orders and invoices for that day.",
  inputSchema: {
    date: z.string().describe("ISO date (YYYY-MM-DD). Defaults to today if omitted.").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ date }, ctx) => {
    const denied = await requireRole(ctx, "daily_demand");
    if (denied) return denied;
    const day = date ?? new Date().toISOString().slice(0, 10);
    const client = sb(ctx);
    const { data: invoices, error: invErr } = await client
      .from("invoices")
      .select("id")
      .eq("invoice_date", day);
    if (invErr) return { content: [{ type: "text", text: invErr.message }], isError: true };
    const ids = (invoices ?? []).map((r: { id: string }) => r.id);
    if (ids.length === 0) {
      return { content: [{ type: "text", text: `No invoices on ${day}` }], structuredContent: { date: day, items: [] } };
    }
    const { data: items, error: itErr } = await client
      .from("invoice_items")
      .select("product_id, product_name, quantity, unit")
      .in("invoice_id", ids);
    if (itErr) return { content: [{ type: "text", text: itErr.message }], isError: true };
    const agg = new Map<string, { product_name: string; unit: string | null; quantity: number }>();
    for (const it of items ?? []) {
      const key = (it.product_id as string) ?? (it.product_name as string);
      const cur = agg.get(key);
      const qty = Number(it.quantity) || 0;
      if (cur) cur.quantity += qty;
      else agg.set(key, { product_name: it.product_name, unit: it.unit, quantity: qty });
    }
    const rows = [...agg.values()].sort((a, b) => a.product_name.localeCompare(b.product_name));
    return {
      content: [{ type: "text", text: JSON.stringify({ date: day, items: rows }) }],
      structuredContent: { date: day, items: rows },
    };
  },
});
