import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, requireRole } from "./_roles";

const STATUSES = ["delivered", "partially_delivered", "failed", "en_route"] as const;
const MODES = ["cash", "upi", "bank", "cheque", "credit"] as const;

export default defineTool({
  name: "mark_delivery_collected",
  title: "Mark delivery collected / delivered",
  description:
    "Update a delivery stop with collection details. Sets status (default 'delivered'), delivered_at (now for delivered/partially_delivered), receiver name, and optionally records a payment collected on delivery. Use list_pending_deliveries first to get the delivery id.",
  inputSchema: {
    delivery_id: z.string().uuid().describe("Delivery id from list_pending_deliveries."),
    status: z.enum(STATUSES).optional().describe("Defaults to 'delivered'."),
    received_by: z.string().optional().describe("Name of person who received the goods."),
    notes: z.string().optional(),
    collected_amount: z.number().nonnegative().optional().describe("Amount collected from the shop."),
    collected_mode: z.enum(MODES).optional().describe("Payment mode when collected_amount > 0."),
    reference: z.string().optional().describe("UPI/txn/cheque reference when applicable."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await requireRole(ctx, "mark_delivery_collected");
    if (denied) return denied;
    const client = sb(ctx);

    const { data: d, error: dErr } = await client
      .from("deliveries")
      .select("id, invoice_id, status, collected_amount, collected_mode")
      .eq("id", input.delivery_id)
      .maybeSingle();
    if (dErr) return { content: [{ type: "text", text: dErr.message }], isError: true };
    if (!d) return { content: [{ type: "text", text: `No delivery found with id ${input.delivery_id}` }], isError: true };

    const status = input.status ?? "delivered";
    const amt = Number(input.collected_amount ?? 0);
    if (amt > 0 && !input.collected_mode) {
      return {
        content: [{ type: "text", text: "collected_mode is required when collected_amount > 0." }],
        isError: true,
      };
    }

    // Optional payment when cash/UPI/etc. collected at the door.
    if (amt > 0 && d.invoice_id) {
      const { data: inv } = await client
        .from("invoices")
        .select("id, customer_id, invoice_number")
        .eq("id", d.invoice_id)
        .maybeSingle();
      if (inv?.customer_id) {
        const payNo = `RCP-${Date.now().toString(36).toUpperCase()}`;
        const { error: pErr } = await client.from("payments").insert({
          payment_no: payNo,
          customer_id: inv.customer_id,
          invoice_id: inv.id,
          amount: amt,
          mode: input.collected_mode,
          reference: input.reference ?? null,
          notes: `Collected on delivery via MCP`,
        });
        if (pErr) return { content: [{ type: "text", text: `Payment insert failed: ${pErr.message}` }], isError: true };
      }
    }

    const update: Record<string, unknown> = {
      status,
      received_by: input.received_by ?? undefined,
      notes: input.notes ?? undefined,
    };
    if (status === "delivered" || status === "partially_delivered") {
      update.delivered_at = new Date().toISOString();
    }
    if (amt > 0) {
      update.collected_amount = amt;
      update.collected_mode = input.collected_mode;
    }
    // Strip undefined so we don't null-out existing fields.
    for (const k of Object.keys(update)) if (update[k] === undefined) delete update[k];

    const { data: updated, error: uErr } = await client
      .from("deliveries")
      .update(update)
      .eq("id", input.delivery_id)
      .select("id, status, delivered_at, received_by, collected_amount, collected_mode, invoice_id")
      .maybeSingle();
    if (uErr) return { content: [{ type: "text", text: uErr.message }], isError: true };

    return {
      content: [{ type: "text", text: `Delivery ${input.delivery_id} marked ${status}${amt > 0 ? ` · collected ₹${amt} (${input.collected_mode})` : ""}.` }],
      structuredContent: { delivery: updated },
    };
  },
});
