// Server function wrapper around the privileged revise_invoice routine.
// The RPC is no longer executable by signed-in users directly; only this
// role-checked server function (running with the service role) may call it.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole, SALES_ROLES } from "@/lib/authz";

export type ReviseInvoiceInput = {
  invoiceId: string;
  reason: string;
  items: { product_id: string; qty: number; rate: number; amount: number }[];
};

export const reviseInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: ReviseInvoiceInput) => {
    if (!data?.invoiceId) throw new Error("invoiceId is required");
    if (!data.reason || data.reason.trim().length < 3) {
      throw new Error("A revision reason is required");
    }
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new Error("No revised items provided");
    }
    return {
      invoiceId: data.invoiceId,
      reason: data.reason.trim().slice(0, 500),
      items: data.items.slice(0, 500).map((i) => ({
        product_id: String(i.product_id),
        qty: Number(i.qty),
        rate: Number(i.rate),
        amount: Number(i.amount),
      })),
    };
  })
  .handler(async ({ data, context }) => {
    await requireRole(context.supabase, context.userId, SALES_ROLES);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("revise_invoice", {
      _invoice_id: data.invoiceId,
      _revision_reason: data.reason,
      _revised_items: data.items,
      _revised_by: context.userId,
    });

    if (error) {
      console.error("[revise_invoice] failed:", error);
      throw new Error("Could not revise this invoice.");
    }
    return (result ?? {}) as { revised_invoice_no?: string; revised_invoice_id?: string };
  });
