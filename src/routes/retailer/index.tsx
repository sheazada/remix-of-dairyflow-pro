import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { inr, shortDate, num } from "@/lib/format";
import { makeRetailerCustomerQueryFn } from "@/lib/retailer-customer";
import {
  ShoppingCart,
  FileText,
  Wallet,
  TrendingUp,
  Plus,
  CheckCircle2,
  Clock,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/retailer/")({
  component: RetailerDashboard,
});

function RetailerDashboard() {
  // Get retailer info via shared helper (user_id first, email fallback).
  const { data: me } = useQuery({
    queryKey: ["retailer-me"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return null;
      const fn = makeRetailerCustomerQueryFn(userRes.user.id, userRes.user.email ?? null);
      return fn();
    },
    retry: 1,
  });

  // Recent orders
  const { data: recentOrders = [] } = useQuery({
    queryKey: ["retailer-recent-orders", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_no, order_date, total, status, items:order_items(product_name, quantity, rate)")
        .eq("customer_id", me!.id)
        .order("order_date", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  // Recent invoices
  const { data: recentInvoices = [] } = useQuery({
    queryKey: ["retailer-recent-invoices", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_no, invoice_date, total, balance, status")
        .eq("customer_id", me!.id)
        .order("invoice_date", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const retailer = me;
  const outstanding = Number(retailer?.outstanding ?? 0);
  const creditLimit = Number(retailer?.credit_limit ?? 0);
  const availableCredit = creditLimit > 0 ? creditLimit - outstanding : 0;

  return (
    <div className="p-4 space-y-4">
      {/* Welcome */}
      <div>
        <h1 className="text-xl font-bold">
          Welcome, {retailer?.shop_name ?? retailer?.name ?? "Retailer"}
        </h1>
        <p className="text-sm text-muted-foreground">Here's your business summary</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Outstanding
            </span>
            <Wallet className="size-4 text-muted-foreground" />
          </div>
          <div className={cn("text-xl font-bold font-mono", outstanding > 0 ? "text-destructive" : "text-success")}>
            {inr(outstanding)}
          </div>
          {creditLimit > 0 && (
            <div className="text-[10px] text-muted-foreground mt-1">
              Limit: {inr(creditLimit)} · Available: {inr(availableCredit)}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Orders
            </span>
            <ShoppingCart className="size-4 text-muted-foreground" />
          </div>
          <div className="text-xl font-bold font-mono">{recentOrders.length}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Recent orders</div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button asChild className="h-20 flex-col gap-2">
          <Link to="/retailer/order">
            <Plus className="size-5" />
            <span className="text-sm">New Order</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-20 flex-col gap-2">
          <Link to="/retailer/orders">
            <FileText className="size-5" />
            <span className="text-sm">View Orders</span>
          </Link>
        </Button>
      </div>

      {/* Recent Orders */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm">Recent Orders</h2>
          <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
            <Link to="/retailer/orders">
              View all <ArrowRight className="size-3" />
            </Link>
          </Button>
        </div>
        {recentOrders.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            No orders yet. Place your first order!
          </div>
        ) : (
          <div className="space-y-2">
            {recentOrders.map((order: any) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold">{order.order_no}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        order.status === "approved" && "text-success border-success/30",
                        order.status === "pending" && "text-warning border-warning/30",
                        order.status === "delivered" && "text-primary border-primary/30"
                      )}
                    >
                      {order.status}
                    </Badge>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {shortDate(order.order_date)} · {order.items?.length ?? 0} items
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold text-sm">{inr(order.total)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recent Invoices */}
      {recentInvoices.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">Recent Invoices</h2>
            <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
              <Link to="/retailer/orders">
                View all <ArrowRight className="size-3" />
              </Link>
            </Button>
          </div>
          <div className="space-y-2">
            {recentInvoices.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <div className="font-mono text-xs font-semibold">{inv.invoice_no}</div>
                  <div className="text-[10px] text-muted-foreground">{shortDate(inv.invoice_date)}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-semibold">{inr(inv.total)}</div>
                  {Number(inv.balance) > 0 && (
                    <div className="text-[10px] text-destructive">Due: {inr(inv.balance)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
