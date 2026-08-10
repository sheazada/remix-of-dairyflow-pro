// Friendly 403 Access Denied component.
//
// Usage: in a route's beforeLoad, throw an AccessDeniedError when the
// user's roles don't include any of the required roles. The nearest
// errorComponent in the route tree will render this page.

import { Link, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Home, ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect } from "react";
import { roleLabel } from "@/lib/access";
import { cn } from "@/lib/utils";

export type AccessDeniedContext = {
  requiredRoles: string[];
  userRoles?: string[];
  attemptedPath?: string;
};

// Custom error class. Thrown from beforeLoad; caught by errorComponent.
export class AccessDeniedError extends Error {
  public readonly requiredRoles: string[];
  public readonly userRoles: string[];
  public readonly attemptedPath: string;

  constructor(context: AccessDeniedContext) {
    super(
      `Access denied to ${context.attemptedPath ?? "this page"}. ` +
        `Required: ${context.requiredRoles.join(", ")}. ` +
        `User has: ${(context.userRoles ?? []).join(", ") || "(none)"}.`,
    );
    this.name = "AccessDeniedError";
    this.requiredRoles = context.requiredRoles;
    this.userRoles = context.userRoles ?? [];

    this.attemptedPath = context.attemptedPath ?? "";
  }
}

// Suggested destinations by role, so the user can actually go somewhere useful.
const SUGGESTIONS: Record<string, { to: string; label: string; hint: string }[]> = {
  admin: [
    { to: "/dashboard", label: "Dashboard", hint: "Overview and reports" },
    { to: "/settings", label: "Settings", hint: "Business profile" },
    { to: "/admin/roles", label: "Manage Roles", hint: "Users & permissions" },
  ],
  manager: [
    { to: "/dashboard", label: "Dashboard", hint: "Overview and reports" },
    { to: "/orders", label: "Orders", hint: "All retailer orders" },
    { to: "/delivery-demand", label: "Deliveries", hint: "Today's routes" },
  ],
  salesperson: [
    { to: "/orders", label: "Orders", hint: "Manage orders" },
    { to: "/invoices", label: "Invoices", hint: "Billing" },
    { to: "/customers", label: "Customers", hint: "Retailer list" },
  ],
  driver: [
    { to: "/delivery-demand", label: "Today's Deliveries", hint: "Shops and orders" },
    { to: "/demand-consolidation", label: "Pickup", hint: "From Sudha Dairy" },
  ],
  helper: [
    { to: "/delivery-demand", label: "Today's Deliveries", hint: "Shops and orders" },
    { to: "/demand-consolidation", label: "Pickup", hint: "From Sudha Dairy" },
  ],
  retailer: [
    { to: "/retailer/", label: "My Portal", hint: "Orders and invoices" },
  ],
};

export function AccessDeniedPage({ context }: { context: AccessDeniedContext }) {
  const router = useRouter();
  const { requiredRoles, userRoles = [], attemptedPath } = context;

  // If there's anywhere the user CAN go, show it. Otherwise show a single "back" button.
  const userHasRole = userRoles.length > 0;
  const suggestions = userRoles
    .flatMap((r) => SUGGESTIONS[r] ?? [])
    .filter((item, i, arr) => arr.findIndex((x) => x.to === item.to) === i)
    .slice(0, 3);

  // Auto-redirect to /dashboard if user has no role at all.
  useEffect(() => {
    if (!userHasRole) {
      const t = setTimeout(() => router.navigate({ to: "/dashboard" }), 3000);
      return () => clearTimeout(t);
    }
  }, [userHasRole, router]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <Card className="w-full max-w-lg p-8 text-center space-y-6">
        <div className="mx-auto size-16 rounded-full bg-destructive/10 border border-destructive/20 grid place-items-center">
          <ShieldAlert className="size-8 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Access denied</h1>
          <p className="text-sm text-muted-foreground">
            Your current role doesn't have permission to view{" "}
            <code className="text-xs rounded bg-muted px-1.5 py-0.5 font-mono">
              {attemptedPath ?? "this page"}
            </code>.
          </p>
        </div>

        {/* Required vs. held roles */}
        <div className="grid grid-cols-2 gap-3 text-left">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Required
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {requiredRoles.length === 0 && (
                <span className="text-xs text-muted-foreground italic">any role</span>
              )}
              {requiredRoles.map((r) => (
                <Badge key={r} variant="outline" className="text-[10px]">
                  {roleLabel(r as any)}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Your roles
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {userRoles.length === 0 && (
                <span className="text-xs text-muted-foreground italic">none</span>
              )}
              {userRoles.map((r) => (
                <Badge
                  key={r}
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    requiredRoles.includes(r)
                      ? "text-success border-success/30"
                      : "text-destructive border-destructive/30",
                  )}
                >
                  {roleLabel(r as any)}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="text-left space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Where you can go
            </div>
            <div className="space-y-1.5">
              {suggestions.map((s) => (
                <Link
                  key={s.to}
                  to={s.to}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm hover:bg-muted/60 transition-colors group"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{s.label}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{s.hint}</div>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" onClick={() => router.history.back()} className="gap-1.5">
            <ArrowLeft className="size-4" /> Go back
          </Button>
          <Button asChild className="gap-1.5">
            <Link to={userHasRole ? suggestions[0]?.to ?? "/dashboard" : "/dashboard"}>
              <Home className="size-4" />
              {userHasRole ? suggestions[0]?.label ?? "Dashboard" : "Dashboard"}
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
