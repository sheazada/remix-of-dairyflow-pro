/**
 * Server-side role authorization helpers.
 *
 * These take an already-authenticated Supabase client (from the
 * `requireSupabaseAuth` middleware context) and check the caller's roles
 * against `public.user_roles` under RLS (users may read their own roles).
 *
 * This module is dependency-free and client-safe, so it can be imported at
 * module scope from `*.functions.ts` files.
 */

export type AppRole =
  | "admin"
  | "manager"
  | "salesperson"
  | "driver"
  | "helper"
  | "retailer";

type MinimalSupabase = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => Promise<{ data: { role: string }[] | null; error: unknown }>;
    };
  };
};

export const STAFF_ROLES: AppRole[] = [
  "admin",
  "manager",
  "salesperson",
  "driver",
  "helper",
];
export const SALES_ROLES: AppRole[] = ["admin", "manager", "salesperson"];
export const FINANCE_ROLES: AppRole[] = ["admin", "manager"];

export async function getCallerRoles(
  supabase: unknown,
  userId: string,
): Promise<AppRole[]> {
  const client = supabase as MinimalSupabase;
  const { data, error } = await client.from("user_roles").select("role").eq("user_id", userId);
  if (error) return [];
  return ((data ?? []) as { role: string }[]).map((r) => r.role as AppRole);
}

/** Throws when the caller has none of the allowed roles. */
export async function requireRole(
  supabase: unknown,
  userId: string,
  allowed: AppRole[],
): Promise<AppRole[]> {
  const roles = await getCallerRoles(supabase, userId);
  if (!roles.some((r) => allowed.includes(r))) {
    throw new Error("Forbidden: insufficient permissions");
  }
  return roles;
}
