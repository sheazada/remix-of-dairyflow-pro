import { useState, type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Package,
  Boxes,
  ShoppingCart,
  ReceiptText,
  Wallet,
  Truck,
  Map as MapIcon,
  Building2,
  ClipboardList,
  BarChart3,
  Settings,
  Search,
  Bell,
  LogOut,
  Milk,
  ChevronDown,
  Menu,
  Layers,
  Share2,
  Compass,
  Shield,
  Receipt,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ThemeMenuItems } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { GlobalSearch, useGlobalSearchTrigger } from "@/components/global-search";
import { NotificationManager } from "@/components/notification-manager";

type Role = "admin" | "manager" | "salesperson" | "driver" | "helper";
const ALL: Role[] = ["admin", "manager", "salesperson", "driver", "helper"];
const FIN: Role[] = ["admin", "manager"];

const nav: {
  label: string;
  items: { to: string; label: string; icon: typeof LayoutDashboard; roles: Role[] }[];
}[] = [
  { label: "Overview", items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: FIN }] },
  {
    label: "Sales",
    items: [
      { to: "/orders", label: "Orders", icon: ShoppingCart, roles: ["admin", "manager", "salesperson"] },
      { to: "/demand-consolidation", label: "Pickup from Sudha", icon: Layers, roles: ALL },
      { to: "/delivery-demand", label: "Delivery Demand", icon: Truck, roles: ALL },
      { to: "/invoices", label: "Invoices", icon: ReceiptText, roles: ["admin", "manager", "salesperson"] },
      { to: "/payments", label: "Payments", icon: Wallet, roles: ["admin", "manager", "salesperson"] },
      { to: "/cash-reconciliation", label: "Cash Reconciliation", icon: Wallet, roles: ["admin", "manager"] },
      { to: "/reconcile", label: "Reconcile", icon: Wallet, roles: FIN },
      { to: "/deliveries", label: "Deliveries", icon: Truck, roles: ALL },
      { to: "/delivery-status", label: "Delivery Status", icon: BarChart3, roles: FIN },
      { to: "/routes", label: "Route Planning", icon: MapIcon, roles: FIN },
      { to: "/route-optimization", label: "Route Optimization", icon: Compass, roles: FIN },
    ],
  },
  {
    label: "Catalog",
    items: [
      { to: "/products", label: "Products", icon: Package, roles: ["admin", "manager", "salesperson"] },
      { to: "/inventory", label: "Inventory", icon: Boxes, roles: ["admin", "manager"] },
    ],
  },
  {
    label: "Partners",
    items: [
      { to: "/customers", label: "Customers", icon: Users, roles: ["admin", "manager", "salesperson"] },
      { to: "/suppliers", label: "Suppliers", icon: Building2, roles: FIN },
      { to: "/purchases", label: "Purchases", icon: ClipboardList, roles: FIN },
      { to: "/crates", label: "Crates", icon: Package, roles: ["admin", "manager", "driver", "helper"] },
      { to: "/claims", label: "Claims to Sudha", icon: ClipboardList, roles: FIN },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: "/reports", label: "Reports", icon: BarChart3, roles: FIN },
      { to: "/expenses", label: "Expenses", icon: Receipt, roles: FIN },
      { to: "/notifications", label: "Notifications", icon: Bell, roles: ALL },
      { to: "/payment-reminders", label: "Payment Reminders", icon: Bell, roles: FIN },
      { to: "/share-log", label: "Share Log", icon: Share2, roles: ["admin"] },
    ],
  },
  {
    label: "Admin",
    items: [
      { to: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
      { to: "/admin/roles", label: "Roles & Permissions", icon: Shield, roles: ["admin"] },
    ],
  },
];


const mobileTabsByRole: Record<Role, { to: string; label: string; icon: typeof LayoutDashboard }[]> = {
  admin: [
    { to: "/dashboard", label: "Home", icon: LayoutDashboard },
    { to: "/invoices", label: "Invoices", icon: ReceiptText },
    { to: "/orders", label: "Orders", icon: ShoppingCart },
    { to: "/customers", label: "Customers", icon: Users },
  ],
  manager: [
    { to: "/dashboard", label: "Home", icon: LayoutDashboard },
    { to: "/invoices", label: "Invoices", icon: ReceiptText },
    { to: "/deliveries", label: "Delivery", icon: Truck },
    { to: "/reports", label: "Reports", icon: BarChart3 },
  ],
  salesperson: [
    { to: "/invoices", label: "Invoices", icon: ReceiptText },
    { to: "/orders/new", label: "Add Sale", icon: ShoppingCart },
    { to: "/customers", label: "Customers", icon: Users },
    { to: "/products", label: "Products", icon: Package },
  ],
  driver: [
    { to: "/demand-consolidation", label: "Pickup", icon: Layers },
    { to: "/delivery-demand", label: "Delivery", icon: Truck },
  ],
  helper: [
    { to: "/demand-consolidation", label: "Pickup", icon: Layers },
    { to: "/delivery-demand", label: "Delivery", icon: Truck },
  ],
};


function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userRes.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userRes.user.id),
      ]);
      return {
        user: userRes.user,
        profile,
        roles: (roles ?? []).map((r) => r.role),
      };
    },
  });
}

function useAlertsCount() {
  return useQuery({
    queryKey: ["alerts-count"],
    queryFn: async () => {
      const { data: prods } = await supabase
        .from("products")
        .select("id, current_stock, min_stock")
        .eq("status", "active");
      const low = (prods ?? []).filter((p) => Number(p.current_stock) <= Number(p.min_stock)).length;
      const soon = new Date();
      soon.setDate(soon.getDate() + 7);
      const { count } = await supabase
        .from("product_batches")
        .select("id", { count: "exact", head: true })
        .lte("expiry_date", soon.toISOString().slice(0, 10))
        .gt("quantity", 0);
      return low + (count ?? 0);
    },
    refetchInterval: 60_000,
  });
}

function SidebarContent({
  path,
  role,
  onNavigate,
}: {
  path: string;
  role: Role;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="p-5 flex items-center gap-2.5">
        <div className="size-8 rounded-lg bg-primary grid place-items-center text-primary-foreground shrink-0">
          <Milk className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold tracking-tight leading-none truncate">DairyFlow Pro</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
            Distribution ERP 🧪 Arena Connected
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-4">
        {nav.map((section) => {
          const items = section.items.filter((it) => it.roles.includes(role));
          if (items.length === 0) return null;
          return (
            <div key={section.label}>
              <div className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.label}
              </div>
              <div className="space-y-0.5">
                {items.map((it) => {
                  const active = path === it.to || path.startsWith(it.to + "/");
                  const Icon = it.icon;
                  return (
                    <Link
                      key={it.to}
                      to={it.to}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium ring-1 ring-primary/10"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="truncate">{it.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useMe();
  const alerts = useAlertsCount();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { open: searchOpen, setOpen: setSearchOpen, trigger: openSearch } = useGlobalSearchTrigger();
  const role: Role = ((me.data?.roles?.[0] as Role) ?? "salesperson");
  const mobileTabs = mobileTabsByRole[role] ?? mobileTabsByRole.salesperson;

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { next: undefined }, replace: true });
  };

  const initials =
    me.data?.profile?.full_name
      ?.split(" ")
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ??
    me.data?.user?.email?.[0]?.toUpperCase() ??
    "U";

  const userMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-secondary">
        <div className="size-8 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs font-semibold shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-xs font-semibold truncate">
            {me.data?.profile?.full_name ?? me.data?.user?.email}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {me.data?.roles?.[0] ?? "user"}
          </div>
        </div>
        <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-52">
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <span>Appearance</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-40">
            <ThemeMenuItems onDismiss={() => {}} />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem asChild>
          <Link to="/settings">Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 bg-sidebar border-r border-sidebar-border z-40 flex-col no-print">
        <SidebarContent path={path} role={role} />
        <div className="border-t border-sidebar-border p-3">{userMenu}</div>
      </aside>

      <div className="lg:pl-60 flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-14 border-b bg-background/80 backdrop-blur px-3 sm:px-6 flex items-center gap-2 sm:gap-3 justify-between no-print">
          {/* Mobile menu trigger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden shrink-0" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 flex flex-col bg-sidebar">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarContent path={path} role={role} onNavigate={() => setMobileOpen(false)} />
              <div className="border-t border-sidebar-border p-3">{userMenu}</div>
            </SheetContent>
          </Sheet>

          {/* Mobile brand */}
          <Link to="/dashboard" className="flex lg:hidden items-center gap-2 min-w-0">
            <div className="size-7 rounded-lg bg-primary grid place-items-center text-primary-foreground shrink-0">
              <Milk className="size-3.5" />
            </div>
            <span className="text-sm font-semibold tracking-tight truncate">DairyFlow</span>
          </Link>

          {/* Search trigger — desktop */}
          <Button
            variant="outline"
            className="hidden md:flex flex-1 max-w-md h-9 justify-start text-left text-muted-foreground gap-2 bg-muted/60 border-transparent hover:bg-muted"
            onClick={openSearch}
          >
            <Search className="size-4" />
            <span className="text-sm">Search customers, invoices, products…</span>
            <kbd className="ml-auto flex items-center gap-0.5 rounded bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground border">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>
          <div className="flex-1 md:hidden" />

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <NotificationManager className="hidden sm:flex mr-2" />
            <Button variant="ghost" size="icon" className="relative md:hidden" aria-label="Search" onClick={openSearch}>
              <Search className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="relative" aria-label="Alerts">
              <Bell className="size-4" />
              {(alerts.data ?? 0) > 0 && (
                <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive ring-2 ring-background" />
              )}
            </Button>
            <Button asChild size="sm" className="gap-1.5 hidden sm:inline-flex">
              <Link to="/invoices/new">
                <ReceiptText className="size-4" /> New Invoice
              </Link>
            </Button>
            <Button asChild size="icon" className="sm:hidden" aria-label="New invoice">
              <Link to="/invoices/new">
                <ReceiptText className="size-4" />
              </Link>
            </Button>
          </div>
        </header>

        <main id="main-content" className="flex-1 min-w-0 pb-16 lg:pb-0">{children}</main>

        {/* Global search command palette */}
        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

        {/* Mobile bottom tab bar */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-16 bg-background/95 backdrop-blur border-t no-print grid grid-cols-4">
          {mobileTabs.map((t) => {
            const active = path === t.to || path.startsWith(t.to + "/");
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" />
                <span>{t.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
