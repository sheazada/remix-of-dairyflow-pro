import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/authz";

/**
 * Admin actions for binding a retailer login to a customer record.
 *
 * The retailer portal queries `customers WHERE user_id = <auth_user_id>` to find
 * the logged-in user's shop, outstanding balance, orders and ledger. The link is
 * 1:1 (unique partial index on customers.user_id), so at most one customer per
 * auth user. Walk-in customers have user_id = NULL.
 *
 * These run with the service-role client (RLS bypassed), so every handler
 * verifies the caller is an admin first.
 */

/** Admin action: link an existing customer row to an existing auth user by email. */
export const linkCustomerToUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { customerId: string; userEmail: string }) => data)
  .handler(async ({ data, context }) => {
    await requireRole(context.supabase, context.userId, ["admin"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!data.customerId || !data.userEmail) {
      throw new Error("customerId and userEmail are required");
    }

    // Resolve auth user.
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const user = list?.users.find((x) => x.email?.toLowerCase() === data.userEmail.toLowerCase());
    if (!user) {
      throw new Error(`No auth user found with email: ${data.userEmail}`);
    }

    // Unlink any other customer that might be using this auth user (1:1 constraint).
    await supabaseAdmin
      .from("customers")
      .update({ user_id: null })
      .eq("user_id", user.id)
      .neq("id", data.customerId);

    // Link this customer.
    const { error } = await supabaseAdmin
      .from("customers")
      .update({ user_id: user.id })
      .eq("id", data.customerId);

    if (error) throw new Error(error.message);
    return { ok: true, userId: user.id, email: user.email };
  });

/** Admin action: unlink a customer from their auth user (set user_id = NULL). */
export const unlinkCustomerFromUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { customerId: string }) => data)
  .handler(async ({ data, context }) => {
    await requireRole(context.supabase, context.userId, ["admin"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("customers")
      .update({ user_id: null })
      .eq("id", data.customerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
