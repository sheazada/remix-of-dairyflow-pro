import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { makeRetailerCustomerQueryFn } from "@/lib/retailer-customer";
import {
  Home,
  ShoppingCart,
  FileText,
  Wallet,
  User,
  LogOut,
  Milk,
  Bell,
} from "lucide-react";

export function RetailerShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: me } = useQuery({
    queryKey: ["retailer-me"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userRes.user.id)
        .maybeSingle();
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userRes.user.id);
      return {
        user: userRes.user,
        profile,
        roles: (roles ?? []).map((r) => r.role),
      };
    },
  });

  // Get retailer info (customer record linked to user) via shared helper.
  const { data: retailer } = useQuery({
    queryKey: ["retailer-info", me?.user?.id],
    enabled: !!me?.user,
    queryFn: makeRetailerCustomerQueryFn(me?.user?.id ?? null, me?.user?.email ?? null),
    retry: 1,
    staleTime: 2 * 60 * 1000,
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    qc.clear();
    window.location.href = "/auth";
  };

  const tabs = [
    { to: "/retailer/", label: "Home", icon: Home },
    { to: "/retailer/order", label: "Order", icon: ShoppingCart },
    { to: "/retailer/orders", label: "Orders", icon: FileText },
    { to: "/retailer/ledger", label: "Ledger", icon: Wallet },
    { to: "/retailer/profile", label: "Profile", icon: User },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top header */}
      <header className="sticky top-0 z-30 h-14 border-b bg-background/95 backdrop-blur px-4 flex items-center justify-between no-print">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-8 rounded-lg bg-primary grid place-items-center text-primary-foreground shrink-0">
            <Milk className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight truncate">DairyFlow</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
              {retailer?.shop_name ?? retailer?.name ?? "Retailer Portal"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {retailer && Number(retailer.outstanding) > 0 && (
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground">Outstanding</div>
              <div className="text-sm font-mono font-semibold text-destructive">
                ₹{Number(retailer.outstanding).toLocaleString("en-IN")}
              </div>
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={signOut} title="Sign out" aria-label="Sign out">
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 min-w-0 pb-20">{children}</main>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 h-16 bg-background/95 backdrop-blur border-t no-print grid grid-cols-5">
        {tabs.map((t) => {
          const active = t.to === "/retailer/" 
            ? path === "/retailer" || path === "/retailer/"
            : path === t.to || path.startsWith(t.to + "/");
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-5" />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
