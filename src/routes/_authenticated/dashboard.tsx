import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { inr, inrCompact, num, isoDate, shortDate } from "@/lib/format";
import { useRealtimeDashboard } from "@/lib/realtime";
import {
  ArrowUpRight,
  Package,
  ShoppingCart,
  ReceiptText,
  Wallet,
  TrendingUp,
  AlertTriangle,
  Truck,
  Users,
  Plus,
  UserPlus,
  FileText,
  Bell,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Lazy-load recharts (~492KB) — only fetched when the dashboard is actually viewed.
// This saves ~492KB for every other route in the app.
const SalesChart = lazy(() => import("@/components/sales-chart").then((m) => ({ default: m.SalesChart })));

export const Route = createFileRoute("/_authenticated/dashboard")({
  beforeLoad: async () => {
    const { redirect } = await import("@tanstack/react-router");
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) return;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userRes.user.id);
    const list = (roles ?? []).map((r) => r.role as string);
    if (list.includes("admin") || list.includes("manager")) return;
    if (list.includes("salesperson")) throw redirect({ to: "/invoices" });
    if (list.includes("driver") || list.includes("helper"))
      throw redirect({ to: "/demand-consolidation" });
  },
  component: Dashboard,
});

function Dashboard() {
  // Live-updates the dashboard whenever orders/invoices/deliveries/payments change.
  useRealtimeDashboard();

  const today = isoDate();
  const monthStart = isoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const sevenDaysAgo = isoDate(new Date(Date.now() - 6 * 24 * 3600 * 1000));

  const stats = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [
        todayInv,
        monthInv,
        pendDeliv,
        products,
        todayPay,
        outstanding,
        recentInv,
        salesByDay,
        topProducts,
      ] = await Promise.all([
        supabase.from("invoices").select("total, status").eq("invoice_date", today),
        supabase.from("invoices").select("total, subtotal, invoice_date").gte("invoice_date", monthStart),
        supabase.from("deliveries").select("id", { count: "exact", head: true }).in("status", ["pending", "out_for_delivery"]),
        supabase.from("products").select("id, name, current_stock, min_stock, selling_price, purchase_price, status"),
        supabase.from("payments").select("amount").eq("payment_date", today),
        supabase.from("customers").select("outstanding"),
        supabase.from("invoices").select("id, invoice_no, invoice_date, total, status, customer:customers(name, shop_name)").order("created_at", { ascending: false }).limit(6),
        supabase.from("invoices").select("invoice_date, total").gte("invoice_date", sevenDaysAgo),
        supabase.from("invoice_items").select("product_name, amount, quantity").limit(500),
      ]);

      const todaySales = (todayInv.data ?? []).reduce((s, r) => s + Number(r.total), 0);
      const todayOrders = (todayInv.data ?? []).length;
      const monthlyRevenue = (monthInv.data ?? []).reduce((s, r) => s + Number(r.total), 0);
      const stockValue = (products.data ?? []).reduce((s, r) => s + Number(r.current_stock) * Number(r.purchase_price), 0);
      const grossProfit = (monthInv.data ?? []).reduce((s, r) => s + Number(r.subtotal) * 0.15, 0);
      const collection = (todayPay.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
      const outstandingTotal = (outstanding.data ?? []).reduce((s, r) => s + Number(r.outstanding), 0);
      const lowStock = (products.data ?? []).filter((p) => p.status === "active" && Number(p.current_stock) <= Number(p.min_stock));

      // sales by day (last 7)
      const dayMap = new Map<string, number>();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 3600 * 1000);
        dayMap.set(isoDate(d), 0);
      }
      for (const r of salesByDay.data ?? []) {
        dayMap.set(r.invoice_date, (dayMap.get(r.invoice_date) ?? 0) + Number(r.total));
      }
      const chartData = Array.from(dayMap.entries()).map(([d, v]) => ({
        day: new Date(d).toLocaleDateString("en-IN", { weekday: "short" }),
        sales: v,
      }));

      // top products
      const prodMap = new Map<string, { name: string; qty: number; amount: number }>();
      for (const it of topProducts.data ?? []) {
        const cur = prodMap.get(it.product_name) ?? { name: it.product_name, qty: 0, amount: 0 };
        cur.qty += Number(it.quantity);
        cur.amount += Number(it.amount);
        prodMap.set(it.product_name, cur);
      }
      const top = Array.from(prodMap.values()).sort((a, b) => b.amount - a.amount).slice(0, 5);

      return {
        todaySales,
        todayOrders,
        pendingDeliveries: pendDeliv.count ?? 0,
        stockUnits: (products.data ?? []).reduce((s, p) => s + Number(p.current_stock), 0),
        collection,
        outstandingTotal,
        monthlyRevenue,
        grossProfit,
        lowStockCount: lowStock.length,
        recentInvoices: recentInv.data ?? [],
        chartData,
        topProducts: top,
      };
    },
  });

  const s = stats.data;

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description={`Overview for ${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`}
        actions={
          <>
            <Button asChild variant="outline" size="sm"><Link to="/reports">Reports</Link></Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5"><Link to="/orders/new"><ShoppingCart className="size-4" /> Add Sale</Link></Button>
            <Button asChild size="sm" className="gap-1.5"><Link to="/invoices/new"><Plus className="size-4" /> New Invoice</Link></Button>
          </>
        }
      />

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="Today's Sales" value={inr(s?.todaySales ?? 0)} delta="+12%" positive icon={TrendingUp} />
        <Kpi label="Today's Orders" value={num(s?.todayOrders ?? 0)} sub={`${s?.pendingDeliveries ?? 0} pending deliveries`} icon={ShoppingCart} />
        <Kpi label="Today's Collection" value={inr(s?.collection ?? 0)} icon={Wallet} />
        <Kpi label="Outstanding" value={inrCompact(s?.outstandingTotal ?? 0)} negative sub="Total receivable" icon={ReceiptText} />
        <Kpi label="Stock On Hand" value={`${num(s?.stockUnits ?? 0)} u`} sub={`${s?.lowStockCount ?? 0} low-stock`} icon={Package} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
        <Kpi label="Monthly Revenue" value={inr(s?.monthlyRevenue ?? 0)} delta="+18%" positive icon={TrendingUp} />
        <Kpi label="Monthly Gross Profit" value={inr(s?.grossProfit ?? 0)} delta="+8%" positive icon={TrendingUp} />
        <Kpi label="Pending Deliveries" value={num(s?.pendingDeliveries ?? 0)} icon={Truck} />
        <Kpi label="Low-Stock Alerts" value={num(s?.lowStockCount ?? 0)} negative={Boolean(s?.lowStockCount)} icon={AlertTriangle} />
      </div>

      {/* Quick Actions */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <QuickAction to="/invoices/new" icon={ReceiptText} label="Generate Invoice" primary />
          <QuickAction to="/orders/new" icon={ShoppingCart} label="New Order" />
          <QuickAction to="/customers" icon={UserPlus} label="Add Customer" />
          <QuickAction to="/products" icon={Package} label="Add Product" />
          <QuickAction to="/payments" icon={Wallet} label="Record Payment" />
          <QuickAction to="/reports" icon={FileText} label="View Reports" />
          <QuickAction to="/payment-reminders" icon={Bell} label="Send Reminders" />
        </div>
      </div>

      {/* Chart + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold tracking-tight">Sales — last 7 days</h3>
              <p className="text-xs text-muted-foreground">Daily invoice totals</p>
            </div>
          </div>
          <div className="h-64">
            <Suspense fallback={<div className="h-full flex items-center justify-center text-muted-foreground">Loading chart…</div>}>
              <SalesChart data={s?.chartData ?? []} />
            </Suspense>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="p-5 border-b flex items-center justify-between">
            <h3 className="font-semibold tracking-tight">Top Products</h3>
            <Link to="/reports" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="divide-y">
            {(s?.topProducts ?? []).length === 0 && (
              <div className="p-6 text-sm text-muted-foreground text-center">No sales yet.</div>
            )}
            {s?.topProducts.map((p, i) => (
              <div key={p.name} className="p-4 flex items-center gap-3">
                <div className="size-8 rounded-lg bg-primary-soft grid place-items-center text-primary text-xs font-semibold">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{num(p.qty)} units sold</div>
                </div>
                <div className="text-sm font-mono font-semibold">{inr(p.amount)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent Invoices */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold tracking-tight">Recent Invoices</h3>
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link to="/invoices">View all <ArrowUpRight className="size-3.5" /></Link>
          </Button>
        </div>
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-6 py-3 font-semibold">Invoice</th>
                <th className="text-left px-6 py-3 font-semibold">Customer</th>
                <th className="text-left px-6 py-3 font-semibold">Date</th>
                <th className="text-right px-6 py-3 font-semibold">Amount</th>
                <th className="text-left px-6 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(s?.recentInvoices ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground">
                    No invoices yet. <Link to="/invoices/new" className="text-primary hover:underline">Create your first invoice</Link>.
                  </td>
                </tr>
              )}
              {s?.recentInvoices?.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-muted/30">
                  <td className="px-6 py-3 font-mono text-xs">
                    <Link to="/invoices/$id" params={{ id: inv.id }} className="text-primary hover:underline">
                      {inv.invoice_no}
                    </Link>
                  </td>
                  <td className="px-6 py-3">
                    <div className="font-medium">{inv.customer?.name}</div>
                    <div className="text-xs text-muted-foreground">{inv.customer?.shop_name}</div>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">{shortDate(inv.invoice_date)}</td>
                  <td className="px-6 py-3 text-right font-mono font-semibold">{inr(inv.total)}</td>
                  <td className="px-6 py-3"><StatusBadge status={inv.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </PageContainer>
  );
}

function Kpi({
  label,
  value,
  sub,
  delta,
  positive,
  negative,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: string;
  positive?: boolean;
  negative?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <Card className="p-4 relative overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        {Icon && <Icon className="size-4 text-muted-foreground" />}
      </div>
      <div className={`text-2xl font-semibold tracking-tight font-mono ${negative ? "text-destructive" : ""}`}>
        {value}
      </div>
      <div className="mt-1 flex items-center gap-2">
        {delta && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${positive ? "text-success bg-success/10" : "text-destructive bg-destructive/10"}`}>
            {delta}
          </span>
        )}
        {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
      </div>
    </Card>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
  primary,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`group flex items-center gap-3 p-3 rounded-xl border transition-all hover:border-primary/30 hover:shadow-sm ${primary ? "bg-primary text-primary-foreground border-primary" : "bg-card"}`}
    >
      <div className={`size-9 rounded-lg grid place-items-center ${primary ? "bg-white/20" : "bg-primary-soft text-primary"}`}>
        <Icon className="size-4" />
      </div>
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}
