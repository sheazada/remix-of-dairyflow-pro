import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { inr, num, isoDate, shortDate } from "@/lib/format";
import { useRealtimeSync } from "@/lib/realtime";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Printer, Truck, Package, ShoppingCart, Store } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/demand-consolidation")({
  component: DemandConsolidation,
});

type OrderItem = {
  product_name: string;
  product_id: string | null;
  quantity: number;
  rate: number;
  amount: number;
  order_id: string;
  order_no: string;
  customer: { id: string; name: string; shop_name: string | null; address: string | null } | null;
};

function DemandConsolidation() {
  // Live-update the pickup list when orders are placed.
  useRealtimeSync({
    tableName: "orders",
    invalidateKeys: [["demand-items"]],
  });
  useRealtimeSync({
    tableName: "order_items",
    invalidateKeys: [["demand-items"]],
  });

  const [date, setDate] = useState(isoDate());
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});

  // Fetch all order items for the date with customer info
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["demand-items", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("id, product_name, product_id, quantity, rate, amount, order_id, orders!inner(order_no, customer_id, invoice:invoices!inner(id, customer:customers(id, name, shop_name, address)))")
        .gte("orders.order_date", date)
        .lte("orders.order_date", date + "T23:59:59")
        .neq("orders.status", "cancelled")
        .order("product_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Product-wise consolidation
  const { byProduct, totalQty, totalAmount, productCount, orderCount, shopCount } = useMemo(() => {
    const byProduct = new Map<string, { qty: number; amount: number; orders: Set<string>; shops: Set<string> }>();
    const shops = new Set<string>();
    const orders = new Set<string>();

    for (const item of items) {
      const name = item.product_name;
      const p = byProduct.get(name) ?? { qty: 0, amount: 0, orders: new Set(), shops: new Set() };
      p.qty += Number(item.quantity);
      p.amount += Number(item.amount);
      p.orders.add(item.order_no);
      if (item.orders?.customer) {
        p.shops.add(item.orders.customer.name);
        shops.add(item.orders.customer.name);
      }
      orders.add(item.order_no);
      byProduct.set(name, p);
    }

    const sorted = Array.from(byProduct.entries())
      .map(([name, v]) => ({ name, ...v, orderCount: v.orders.size, shopCount: v.shops.size }))
      .sort((a, b) => b.qty - a.qty);

    return {
      byProduct: sorted,
      totalQty: sorted.reduce((s, p) => s + p.qty, 0),
      totalAmount: sorted.reduce((s, p) => s + p.amount, 0),
      productCount: sorted.length,
      orderCount: orders.size,
      shopCount: shops.size,
    };
  }, [items]);

  const loadedCount = Object.values(loaded).filter(Boolean).length;

  const toggleLoaded = (name: string) => {
    setLoaded((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const toggleAll = () => {
    const allLoaded = byProduct.every((p) => loaded[p.name]);
    const next: Record<string, boolean> = {};
    byProduct.forEach((p) => { next[p.name] = !allLoaded; });
    setLoaded(next);
  };

  const exportCsv = () => {
    const rows = [["Product", "Total Qty", "# Orders", "# Shops", "Value"]];
    byProduct.forEach((p) => rows.push([p.name, String(p.qty), String(p.orderCount), String(p.shopCount), String(p.amount)]));
    rows.push(["TOTAL", String(totalQty), String(orderCount), String(shopCount), String(totalAmount)]);
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pickup-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Pickup from Sudha"
        description="Product-wise quantities to collect today. Tap to mark as loaded."
        actions={
          <>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground hidden sm:block">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40 h-9" />
            </div>
            <Button size="sm" variant="outline" onClick={exportCsv} className="gap-1.5 hidden sm:inline-flex">
              <Download className="size-4" /> CSV
            </Button>
          </>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Package className="size-3" /> Products
          </div>
          <div className="text-2xl font-semibold font-mono mt-1">{productCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Truck className="size-3" /> Total units
          </div>
          <div className="text-2xl font-semibold font-mono mt-1">{num(totalQty, 1)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <ShoppingCart className="size-3" /> Orders
          </div>
          <div className="text-2xl font-semibold font-mono mt-1">{orderCount}</div>
          <div className="text-[10px] text-muted-foreground">{shopCount} shops</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Store className="size-3" /> Loaded
          </div>
          <div className={cn("text-2xl font-semibold font-mono mt-1", loadedCount === productCount ? "text-success" : "")}>
            {loadedCount}<span className="text-sm text-muted-foreground">/{productCount}</span>
          </div>
        </Card>
      </div>

      {/* Pickup list */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b bg-primary/5 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">Pick up from Sudha Dairy — {shortDate(date)}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalQty > 0 ? `Mark each product as loaded in the vehicle` : `No orders for this date`}
            </p>
          </div>
          {productCount > 0 && (
            <Button size="sm" variant="ghost" onClick={toggleAll} className="text-xs">
              {loadedCount === productCount ? "Unmark all" : "Mark all loaded"}
            </Button>
          )}
        </div>

        {isLoading && (
          <div className="p-12 text-center text-muted-foreground text-sm">Loading…</div>
        )}

        {!isLoading && byProduct.length === 0 && (
          <div className="p-12 text-center text-muted-foreground">
            <Truck className="size-10 mx-auto mb-3 opacity-50" />
            <div className="text-sm font-semibold">No orders for {shortDate(date)}</div>
            <div className="text-xs mt-1">Orders will appear here as retailers place them.</div>
          </div>
        )}

        {byProduct.length > 0 && (
          <div className="divide-y">
            {byProduct.map((p, i) => {
              const isLoaded = loaded[p.name];
              return (
                <div
                  key={p.name}
                  className={cn(
                    "flex items-center gap-3 p-4 sm:px-6 transition-colors",
                    isLoaded ? "bg-success/5" : "hover:bg-muted/20"
                  )}
                >
                  <Checkbox
                    checked={isLoaded}
                    onCheckedChange={() => toggleLoaded(p.name)}
                    className="size-5 shrink-0"
                  />
                  <div className="size-8 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>{p.orderCount} order{p.orderCount === 1 ? "" : "s"}</span>
                      <span>·</span>
                      <span>{p.shopCount} shop{p.shopCount === 1 ? "" : "s"}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-lg">{num(p.qty, 1)}</div>
                    <div className="text-[10px] text-muted-foreground">{inr(p.amount)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {byProduct.length > 0 && (
          <div className="px-4 sm:px-6 py-3 bg-muted/30 flex items-center justify-between text-sm font-semibold">
            <span>Total</span>
            <div className="flex items-center gap-4">
              <span className="font-mono">{num(totalQty, 1)} units</span>
              <span className="font-mono text-muted-foreground">{inr(totalAmount)}</span>
            </div>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
