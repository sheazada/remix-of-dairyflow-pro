export type StaffRole = "admin" | "manager" | "salesperson" | "driver" | "helper";
export type AppRole = StaffRole | "retailer" | "retailer_user";

const ALL: StaffRole[] = ["admin", "manager", "salesperson", "driver", "helper"];
const FIN: StaffRole[] = ["admin", "manager"];
const SALES: StaffRole[] = ["admin", "manager", "salesperson"];

/** All staff roles, exported for UI iteration (role selector, etc.). */
export const ALL_ROLES: StaffRole[] = ALL;

/** Path prefix -> permissions required. Longest matching prefix wins. */
export const ROUTE_ACCESS: { prefix: string; permissions: string[] }[] = [
  { prefix: "/dashboard", permissions: ["view_reports", "view_orders"] },
  { prefix: "/orders", permissions: ["view_orders"] },
  { prefix: "/demand-consolidation", permissions: ["view_deliveries"] },
  { prefix: "/delivery-demand", permissions: ["view_deliveries"] },
  { prefix: "/invoices", permissions: ["view_invoices"] },
  { prefix: "/payments", permissions: ["view_payments"] },
  { prefix: "/cash-reconciliation", permissions: ["reconcile_payments"] },
  { prefix: "/reconcile", permissions: ["reconcile_payments"] },
  { prefix: "/deliveries", permissions: ["view_deliveries"] },
  { prefix: "/delivery-status", permissions: ["view_deliveries"] },
  { prefix: "/route-optimization", permissions: ["manage_deliveries"] },
  { prefix: "/routes", permissions: ["manage_deliveries"] },
  { prefix: "/products", permissions: ["view_products"] },
  { prefix: "/inventory", permissions: ["view_inventory"] },
  { prefix: "/customers", permissions: ["view_customers"] },
  { prefix: "/customer-ledger", permissions: ["view_ledger"] },
  { prefix: "/suppliers", permissions: ["view_products"] },
  { prefix: "/purchases", permissions: ["view_products"] },
  { prefix: "/crates", permissions: ["view_inventory"] },
  { prefix: "/claims", permissions: ["view_reports"] },
  { prefix: "/reports", permissions: ["view_reports"] },
  { prefix: "/payment-reminders", permissions: ["view_payments"] },
  { prefix: "/notifications", permissions: ["view_reports"] },
  { prefix: "/share-log", permissions: ["view_audit_logs"] },
  { prefix: "/admin/roles", permissions: ["manage_roles"] },
  { prefix: "/admin/permissions", permissions: ["manage_roles"] },
  { prefix: "/settings", permissions: ["manage_settings"] },
];

export function isRetailerRole(roles: string[]) {
  return roles.includes("retailer") || roles.includes("retailer_user");
}

export function primaryStaffRole(roles: string[]): StaffRole | null {
  const order: StaffRole[] = ["admin", "manager", "salesperson", "driver", "helper"];
  return order.find((r) => roles.includes(r)) ?? null;
}

export function landingForRoles(roles: string[]): string {
  if (isRetailerRole(roles)) return "/retailer";
  const role = primaryStaffRole(roles);
  if (role === "admin" || role === "manager") return "/dashboard";
  if (role === "salesperson") return "/invoices";
  if (role === "driver" || role === "helper") return "/demand-consolidation";
  return "/auth";
}

/**
 * Check if user has all required permissions for a path
 * Returns true if user has at least one of the required permissions
 */
export function canAccessPath(
  pathname: string,
  userPermissions: string[]
): boolean {
  // Find matching route access rule (longest prefix first)
  const match = ROUTE_ACCESS.filter(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/")
  ).sort((a, b) => b.prefix.length - a.prefix.length)[0];

  // If no rule found, allow access (default open)
  if (!match) return true;

  // Check if user has at least one required permission
  return match.permissions.some((perm) => userPermissions.includes(perm));
}

/**
 * Get list of permissions required for a path
 */
export function requiredPermissionsForPath(pathname: string): string[] {
  const match = ROUTE_ACCESS.filter(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/")
  ).sort((a, b) => b.prefix.length - a.prefix.length)[0];

  return match?.permissions ?? [];
}

export function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function roleDescription(
  role: StaffRole | "retailer" | "retailer_user"
): string {
  switch (role) {
    case "admin":
      return "Full system access. Manages users, roles, and permissions.";
    case "manager":
      return "Operational control. Orders, deliveries, finance, reports.";
    case "salesperson":
      return "Sales access. Orders, invoices, customers, products.";
    case "driver":
      return "Field operations. Delivery demand and routes.";
    case "helper":
      return "Field operations. Delivery demand and routes.";
    case "retailer":
    case "retailer_user":
      return "Customer portal. Places orders and views invoices.";
  }
}

/** Default permissions per role (fallback view; DB is the source of truth). */
export const DEFAULT_ROLE_PERMISSIONS: Record<StaffRole, string[]> = {
  admin: [
    "view_reports", "view_orders", "view_invoices", "view_payments",
    "reconcile_payments", "view_deliveries", "manage_deliveries",
    "view_products", "view_inventory", "view_customers", "view_ledger",
    "view_audit_logs", "manage_roles", "manage_settings",
  ],
  manager: [
    "view_reports", "view_orders", "view_invoices", "view_payments",
    "reconcile_payments", "view_deliveries", "manage_deliveries",
    "view_products", "view_inventory", "view_customers", "view_ledger",
  ],
  salesperson: [
    "view_orders", "view_invoices", "view_customers", "view_products",
    "view_ledger",
  ],
  driver: ["view_deliveries"],
  helper: ["view_deliveries"],
};

/** Inverse map: role -> list of route prefixes they can access. */
export const ROLE_ACCESS: Record<StaffRole | "retailer" | "retailer_user", string[]> =
  (() => {
    const result: Record<string, string[]> = {
      retailer: ["/retailer"],
      retailer_user: ["/retailer"],
    };
    for (const role of ALL) {
      const perms = DEFAULT_ROLE_PERMISSIONS[role];
      result[role] = ROUTE_ACCESS.filter((entry) =>
        entry.permissions.some((p) => perms.includes(p))
      ).map((entry) => entry.prefix);
    }
    return result as typeof result;
  })();

