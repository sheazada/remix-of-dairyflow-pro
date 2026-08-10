// Automated tests for the permission-based access system.

import { describe, it, expect } from "vitest";
import {
  canAccessPath,
  isRetailerRole,
  landingForRoles,
  requiredPermissionsForPath,
  ROUTE_ACCESS,
  ROLE_ACCESS,
  DEFAULT_ROLE_PERMISSIONS,
  ALL_ROLES,
  roleDescription,
  type StaffRole,
} from "@/lib/access";

const perms = (role: StaffRole) => DEFAULT_ROLE_PERMISSIONS[role];

describe("canAccessPath", () => {
  it("admin can access every defined route", () => {
    for (const { prefix } of ROUTE_ACCESS) {
      expect(canAccessPath(prefix, perms("admin"))).toBe(true);
    }
  });

  it("driver can access delivery routes but not admin/finance ones", () => {
    expect(canAccessPath("/demand-consolidation", perms("driver"))).toBe(true);
    expect(canAccessPath("/deliveries", perms("driver"))).toBe(true);
    expect(canAccessPath("/admin/roles", perms("driver"))).toBe(false);
    expect(canAccessPath("/reconcile", perms("driver"))).toBe(false);
    expect(canAccessPath("/reports", perms("driver"))).toBe(false);
  });

  it("manager can access operations but not admin-only routes", () => {
    expect(canAccessPath("/dashboard", perms("manager"))).toBe(true);
    expect(canAccessPath("/reports", perms("manager"))).toBe(true);
    expect(canAccessPath("/orders", perms("manager"))).toBe(true);
    expect(canAccessPath("/admin/roles", perms("manager"))).toBe(false);
    expect(canAccessPath("/share-log", perms("manager"))).toBe(false);
    expect(canAccessPath("/settings", perms("manager"))).toBe(false);
  });

  it("salesperson cannot access finance or admin pages", () => {
    expect(canAccessPath("/reconcile", perms("salesperson"))).toBe(false);
    expect(canAccessPath("/admin/roles", perms("salesperson"))).toBe(false);
    expect(canAccessPath("/share-log", perms("salesperson"))).toBe(false);
    expect(canAccessPath("/orders", perms("salesperson"))).toBe(true);
    expect(canAccessPath("/invoices", perms("salesperson"))).toBe(true);
    expect(canAccessPath("/customers", perms("salesperson"))).toBe(true);
  });

  it("unknown paths are allowed by default (no accidental lockouts)", () => {
    expect(canAccessPath("/some-new-future-route", perms("driver"))).toBe(true);
    expect(canAccessPath("/foo/bar", perms("salesperson"))).toBe(true);
  });

  it("empty permissions are denied on guarded routes", () => {
    expect(canAccessPath("/dashboard", [])).toBe(false);
    expect(canAccessPath("/orders", [])).toBe(false);
  });
});

describe("isRetailerRole", () => {
  it("recognizes retailer and retailer_user", () => {
    expect(isRetailerRole(["retailer"])).toBe(true);
    expect(isRetailerRole(["retailer_user"])).toBe(true);
    expect(isRetailerRole(["admin", "retailer"])).toBe(true);
    expect(isRetailerRole(["admin"])).toBe(false);
    expect(isRetailerRole([])).toBe(false);
  });
});

describe("landingForRoles", () => {
  it("routes each role to its home page", () => {
    expect(landingForRoles(["admin"])).toBe("/dashboard");
    expect(landingForRoles(["manager"])).toBe("/dashboard");
    expect(landingForRoles(["salesperson"])).toBe("/invoices");
    expect(landingForRoles(["driver"])).toBe("/demand-consolidation");
    expect(landingForRoles(["helper"])).toBe("/demand-consolidation");
    expect(landingForRoles(["retailer"])).toBe("/retailer");
  });
});

describe("requiredPermissionsForPath", () => {
  it("returns required permissions for known paths", () => {
    expect(requiredPermissionsForPath("/admin/roles")).toEqual(["manage_roles"]);
    expect(requiredPermissionsForPath("/orders")).toEqual(["view_orders"]);
  });

  it("returns empty array for unknown paths", () => {
    expect(requiredPermissionsForPath("/nonexistent")).toEqual([]);
  });
});

describe("ROLE_ACCESS inverse", () => {
  it("admin has many routes", () => {
    expect(ROLE_ACCESS["admin"].length).toBeGreaterThan(10);
  });

  it("driver has delivery-related routes only", () => {
    const routes = ROLE_ACCESS["driver"];
    expect(routes.some((r) => r.includes("delivery") || r.includes("demand"))).toBe(true);
    expect(routes).not.toContain("/admin/roles");
    expect(routes).not.toContain("/dashboard");
  });

  it("retailer has the portal route", () => {
    expect(ROLE_ACCESS["retailer"]).toContain("/retailer");
  });
});

describe("roleDescription", () => {
  it("every role has a non-empty description", () => {
    for (const role of [...ALL_ROLES, "retailer", "retailer_user"]) {
      const desc = roleDescription(role as StaffRole | "retailer" | "retailer_user");
      expect(desc.length).toBeGreaterThan(10);
    }
  });
});

describe("ROUTE_ACCESS matrix completeness", () => {
  it("no duplicate permissions in any route's required list", () => {
    for (const { permissions } of ROUTE_ACCESS) {
      expect(new Set(permissions).size).toBe(permissions.length);
    }
  });

  it("every route requires at least one permission", () => {
    for (const { permissions } of ROUTE_ACCESS) {
      expect(permissions.length).toBeGreaterThan(0);
    }
  });
});
