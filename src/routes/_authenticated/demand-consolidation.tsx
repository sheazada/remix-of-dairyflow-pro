import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
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
import { toast } from "sonner";
import {
  Download,
  Printer,
  Truck,
  Package,
  ShoppingCart,
  Store,
  Save,
  Loader2,
  PencilLine,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/demand-consolidation")({
  component: DemandConsolidation,
});

type ConsolidationItem = {
  id: string;
  product_id: string | null;
  product_name: string;
  total_ordered_qty: number;
  buffer_qty: number;
  final_procurement_qty: number;
  unit_price: number;
  total_value: number;
  remarks: string | null;
};

function DemandConsolidation() {
  const queryClient = useQueryClient();

  // Live-update the pickup list when orders are placed.
  useRealtimeSync({
    tableName: "orders",
    invalidateKeys: [["demand-items"]],
  });
  useRealtimeSync({
    tableName: "order_items",
    invalidateKeys: [["demand-items"]],
  });
  useRealtimeSync({
    tableName: "demand_consolidation_items",
    invalidateKeys: [["consolidation"]],
  });

  const [date, setDate] = useState(isoDate());
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [adjustments, setAdjustments] = useState<
    Record<string, { buffer: number; final: number }>
  >({});

  // Current user role (distributor counts as admin). Only admin/manager may edit the plan.
  const me = useMemo(() => {
    try {
      const u = JSON.parse(localStorage.getItem("creamroute_user") || "null");
      if (!u) return { role: "" };
      return { role: u.role === "distributor" ? "admin" : (u.role as string) };
    } catch {
      return { role: "" };
    }
  }, []);
  const canEdit = me.role === "admin" || me.role === "manager";

  // Fetch all order items for the date with customer info
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["demand-items", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select(
          "id, product_name, product_id, quantity, rate, amount, order_id, orders!inner(order_no, customer_id, invoice:invoices!inner(id, customer:customers(id, name, shop_name, address)))"
        )
        .gte("orders.order_date", date)
        .lte("orders.order_date", date + "T23:59:59")
        .neq("orders.status", "cancelled")
        .order("product_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Stock on hand (helps decide buffer vs use-of-stock)
  const { data: products = [] } = useQuery({
    queryKey: ["products-stock"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, current_stock");
      return data ?? [];
    },
  });
  const stockByName = useMemo(() => {
    const m = new Map<string, number>();
    (products as any[]).forEach((p) => m.set(p.name, Number(p.current_stock ?? 0)));
    return m;
  }, [products]);

  // Saved consolidation for the date (if any)
  const { data: consolidation } = useQuery({
    queryKey: ["consolidation", date],
    queryFn: async () => {
      const { data: cycle } = await supabase
        .from("delivery_cycles")
        .select("id")
        .eq("delivery_date", date)
        .limit(1)
        .maybeSingle();
      if (!cycle) return null;
      const { data: cons } = await supabase
        .from("demand_consolidations")
        .select("id, consolidation_no, status")
        .eq("delivery_cycle_id", cycle.id)
        .limit(1)
        .maybeSingle();
      if (!cons) return null;
      const { data: consItems } = await supabase
        .from("demand_consolidation_items")
        .select("*")
        .eq("demand_consolidation_id", cons.id);
      return { ...cons, items: (consItems ?? []) as ConsolidationItem[] };
    },
  });

  // Product-wise consolidation of retailer orders
  const { byProduct, totalQty, totalAmount, productCount, orderCount, shopCount } =
    useMemo(() => {
      const byProduct = new Map<
        string,
        {
          qty: number;
          amount: number;
          orders: Set<string>;
          shops: Set<string>;
          productId: string | null;
        }
      >();
      const shops = new Set<string>();
      const orders = new Set<string>();

      for (const item of items) {
        const name = item.product_name;
        const p =
          byProduct.get(name) ??
          ({ qty: 0, amount: 0, orders: new Set(), shops: new Set(), productId: null } as any);
        p.qty += Number(item.quantity);
        p.amount += Number(item.amount);
        p.orders.add(item.orders?.order_no ?? item.order_id);
        if (!p.productId && item.product_id) p.productId = item.product_id;
        if (item.orders?.customer) {
          p.shops.add(item.orders.customer.name);
          shops.add(item.orders.customer.name);
        }
        orders.add(item.orders?.order_no ?? item.order_id);
        byProduct.set(name, p);
      }

      const sorted = Array.from(byProduct.entries())
        .map(([name, v]) => ({
          name,
          ...v,
          orderCount: v.orders.size,
          shopCount: v.shops.size,
        }))
        .sort((a, b) => b.qty - a.qty);

      return {
        byProduct: sorted,
        totalQty: sorted.reduce((s, p) => s + displayQty(p.name, p.qty), 0),
        totalAmount: sorted.reduce((s, p) => s + displayValue(p), 0),
        productCount: sorted.length,
        orderCount: orders.size,
        shopCount: shops.size,
      };

      function displayQty(name: string, ordered: number) {
        const saved = consolidation?.items?.find((i) => i.product_name === name);
        const adj = adjustments[name];
        if (adj) return adj.final;
        if (saved) return Number(saved.final_procurement_qty);
        return ordered;
      }
      function displayValue(p: any) {
        const q = displayQty(p.name, p.qty);
        const saved = consolidation?.items?.find((i) => i.product_name === p.name);
        const unit = saved
          ? Number(saved.unit_price)
          : p.qty > 0
            ? p.amount / p.qty
            : 0;
        return q * unit;
      }
    }, [items, adjustments, consolidation]);

  // Seed adjustments from a saved consolidation so edits start from saved values
  useEffect(() => {
    if (!consolidation?.items) return;
    setAdjustments((prev) => {
      const next = { ...prev };
      for (const it of consolidation.items) {
        if (!next[it.product_name]) {
          next[it.product_name] = {
            buffer: Number(it.buffer_qty ?? 0),
            final: Number(it.final_procurement_qty ?? 0),
          };
        }
      }
      return next;
    });
  }, [consolidation?.id]);

  const setAdj = (name: string, ordered: number, patch: Partial<{ buffer: number; final: number }>) => {
    setAdjustments((prev) => {
      const cur = prev[name] ?? { buffer: 0, final: ordered };
      const next = { ...cur, ...patch };
      if (patch.buffer !== undefined && patch.final === undefined) {
        next.final = ordered + next.buffer;
      }
      return { ...prev, [name]: next };
    });
  };

  const loadedCount = Object.values(loaded).filter(Boolean).length;

  const toggleLoaded = (name: string) => {
    setLoaded((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const toggleAll = () => {
    const allLoaded = byProduct.every((p) => loaded[p.name]);
    const next: Record<string, boolean> = {};
    byProduct.forEach((p) => {
      next[p.name] = !allLoaded;
    });
    setLoaded(next);
  };

  const displayQtyOf = (name: string, ordered: number) => {
    const adj = adjustments[name];
    if (adj) return adj.final;
    const saved = consolidation?.items?.find((i) => i.product_name === name);
    if (saved) return Number(saved.final_procurement_qty);
    return ordered;
  };

  const savePlan = async () => {
    setSaving(true);
    try {
      let consId = consolidation?.id as string | undefined;
      if (!consId) {
        const { data: cycleId, error: e1 } = await supabase.rpc(
          "ensure_delivery_cycle",
          { p_delivery_date: date, p_shift: "morning" }
        );
        if (e1 || !cycleId) throw new Error(e1?.message || "Could not create delivery cycle");
        const { data: newId, error: e2 } = await supabase.rpc(
          "create_demand_consolidation",
          { p_delivery_cycle_id: cycleId }
        );
        if (e2 || !newId) throw new Error(e2?.message || "Could not create consolidation");
        consId = newId;
      }

      const { data: existing } = await supabase
        .from("demand_consolidation_items")
        .select("id, product_id, product_name")
        .eq("demand_consolidation_id", consId);
      const byKey = new Map(
        (existing ?? []).map((x: any) => [x.product_name as string, x])
      );

      for (const p of byProduct) {
        const a = adjustments[p.name];
        if (!a) continue; // untouched rows keep their values
        const unit = p.qty > 0 ? p.amount / p.qty : 0;
        const row = byKey.get(p.name);
        if (row) {
          const { error } = await supabase
            .from("demand_consolidation_items")
            .update({
              buffer_qty: a.buffer,
              final_procurement_qty: a.final,
              total_value: a.final * unit,
            })
            .eq("id", row.id);
          if (error) throw new Error(error.message);
        } else {
          const { error } = await supabase
            .from("demand_consolidation_items")
            .insert({
              demand_consolidation_id: consId,
              product_id: p.productId,
              product_name: p.name,
              total_ordered_qty: p.qty,
              buffer_qty: a.buffer,
              final_procurement_qty: a.final,
              unit_price: unit,
              total_value: a.final * unit,
            });
          if (error) throw new Error(error.message);
        }
      }

      toast.success("Procurement plan saved — driver & helper portals updated");
      queryClient.invalidateQueries({ queryKey: ["consolidation"] });
    } catch (e: any) {
      toast.error(e?.message || "Failed to save plan");
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const rows = [
      ["Product", "Ordered", "Stock", "Buffer", "To Order (final)", "# Orders", "# Shops", "Value"],
    ];
    byProduct.forEach((p) => {
      const a = adjustments[p.name];
      rows.push([
        p.name,
        String(p.qty),
        String(stockByName.get(p.name) ?? 0),
        String(a?.buffer ?? (consolidation?.items?.find((i) => i.product_name === p.name)?.buffer_qty ?? 0)),
        String(displayQtyOf(p.name, p.qty)),
        String(p.orderCount),
        String(p.shopCount),
        String(p.amount),
      ]);
    });
    rows.push(["TOTAL", String(totalQty), "", "", String(totalQty), String(orderCount), String(shopCount), String(totalAmount)]);
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
        description={
          canEdit
            ? "Consolidated retailer demand. Adjust buffer / final order qty (leakage, damage, extra demand) and save."
            : "Product-wise quantities to collect today. Tap to mark as loaded."
        }
        actions={
          <>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground hidden sm:block">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40 h-9" />
            </div>
            <Button size="sm" variant="outline" onClick={exportCsv} className="gap-1.5 hidden sm:inline-flex">
              <Download className="size-4" /> CSV
            </Button>
            {canEdit && byProduct.length > 0 && (
              <Button size="sm" onClick={savePlan} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save plan
              </Button>
            )}
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
            <Truck className="size-3" /> To order (final)
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
            {loadedCount}
            <span className="text-sm text-muted-foreground">/{productCount}</span>
          </div>
        </Card>
      </div>

      {consolidation && (
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{consolidation.consolidation_no}</Badge>
          <span>Saved procurement plan active — drivers & helpers see final quantities.</span>
        </div>
      )}

      {/* Pickup list */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b bg-primary/5 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">Pick up from Sudha Dairy — {shortDate(date)}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {canEdit
                ? "Buffer −ve = use own stock; +ve = extra for leakage/damage/extra demand."
                : totalQty > 0
                  ? "Mark each product as loaded in the vehicle"
                  : "No orders for this date"}
            </p>
          </div>
          {productCount > 0 && (
            <Button size="sm" variant="ghost" onClick={toggleAll} className="text-xs">
              {loadedCount === productCount ? "Unmark all" : "Mark all loaded"}
            </Button>
          )}
        </div>

        {isLoading && <div className="p-12 text-center text-muted-foreground text-sm">Loading…</div>}

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
              const adj = adjustments[p.name];
              const saved = consolidation?.items?.find((it) => it.product_name === p.name);
              const finalQty = displayQtyOf(p.name, p.qty);
              const adjusted = finalQty !== p.qty;
              const stock = stockByName.get(p.name);
              return (
                <div
                  key={p.name}
                  className={cn(
                    "flex flex-wrap items-center gap-3 p-4 sm:px-6 transition-colors",
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
                    <div className="font-medium text-sm truncate flex items-center gap-2">
                      {p.name}
                      {adjusted && <Badge variant="secondary" className="text-[10px]">adjusted</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>{p.orderCount} order{p.orderCount === 1 ? "" : "s"}</span>
                      <span>·</span>
                      <span>{p.shopCount} shop{p.shopCount === 1 ? "" : "s"}</span>
                      {stock !== undefined && (
                        <>
                          <span>·</span>
                          <span className={cn(stock < 10 && "text-destructive")}>stock {num(stock, 1)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {canEdit ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-[10px] text-muted-foreground">Ordered</div>
                        <div className="font-mono text-sm">{num(p.qty, 1)}</div>
                      </div>
                      <div className="w-20">
                        <Label className="text-[10px] text-muted-foreground">Buffer</Label>
                        <Input
                          type="number"
                          className="h-8 text-sm"
                          value={adj?.buffer ?? saved?.buffer_qty ?? 0}
                          onChange={(e) =>
                            setAdj(p.name, p.qty, { buffer: Number(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div className="w-24">
                        <Label className="text-[10px] text-muted-foreground">Final</Label>
                        <Input
                          type="number"
                          className="h-8 text-sm font-semibold"
                          value={adj?.final ?? saved?.final_procurement_qty ?? p.qty}
                          onChange={(e) =>
                            setAdjustments((prev) => ({
                              ...prev,
                              [p.name]: {
                                buffer: prev[p.name]?.buffer ?? Number(saved?.buffer_qty ?? 0),
                                final: Number(e.target.value) || 0,
                              },
                            }))
                          }
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-lg">{num(finalQty, 1)}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {adjusted ? `ordered ${num(p.qty, 1)}` : inr(p.amount)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {byProduct.length > 0 && (
          <div className="px-4 sm:px-6 py-3 bg-muted/30 flex items-center justify-between text-sm font-semibold">
            <span>Total to order</span>
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
