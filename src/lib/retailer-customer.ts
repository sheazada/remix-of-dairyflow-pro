// Shared helper for the retailer portal to look up the logged-in user's
// customer record. Uses a two-step strategy:
//
//   1. Try `user_id` column (set by admin linking or the demo seed).
//      This is the canonical, fast path.
//   2. If the column is missing (migration not yet run) OR no row matches,
//      fall back to matching the first active customer with the same email.
//      This keeps the portal working before the migration is applied.
//
// The result is cached by React Query on each page that uses it, but you
// can also call this directly from a queryFn to share the cache key.

import { supabase } from "@/integrations/supabase/client";

export const RETAILER_CUSTOMER_QUERY_KEY = ["retailer-customer"];

export async function fetchRetailerCustomer(userId: string, userEmail: string | null) {
  if (!userId) return null;

  // Strategy 1: user_id column (preferred).
  try {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (!error && data) return data;
    if (error?.code === "42703") {
      // undefined_column — user_id column doesn't exist yet. Fall through.
    } else if (error?.code === "42P01") {
      // undefined_table — customers table doesn't exist at all. Bail.
      return null;
    }
    // error but not "column missing" — log and fall through.
    if (error) console.warn("[retailer] user_id lookup failed:", error.message);
  } catch (err) {
    console.warn("[retailer] user_id lookup threw:", err);
  }

  // Strategy 2: email fallback.
  if (!userEmail) return null;
  try {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("email", userEmail)
      .eq("status", "active")
      .maybeSingle();
    return data ?? null;
  } catch (err) {
    console.warn("[retailer] email fallback failed:", err);
    return null;
  }
}

/**
 * Use this as a React Query queryFn for any retailer portal page.
 * Wraps fetchRetailerCustomer with a single cache key so invalidating
 * ["retailer-customer"] refreshes every page at once.
 */
export function makeRetailerCustomerQueryFn(userId: string | null, userEmail: string | null) {
  return async () => {
    if (!userId) return null;
    return fetchRetailerCustomer(userId, userEmail);
  };
}
