import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { inr, shortDate, num } from "@/lib/format";
import { makeRetailerCustomerQueryFn } from "@/lib/retailer-customer";
import { Package, FileText, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/retailer/orders")({
  component: OrdersHistory,
});

function OrdersHistory() {
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

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["retailer-orders", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_no, order_date, total, status, items:order_items(product_name, quantity, rate)")
        .eq("customer_id", me!.id)
        .order("order_date", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Order History</h1>
        <p className="text-sm text-muted-foreground">All your orders</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <RefreshCw className="size-8 mx-auto mb-3 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12">
          <Package className="size-10 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-sm font-semibold">No orders yet</p>
          <p className="text-xs text-muted-foreground mt-1">Place your first order to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order: any) => (
            <Card key={order.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{order.order_no}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        order.status === "approved" && "text-success border-success/30",
                        order.status === "pending" && "text-warning border-warning/30",
                        order.status === "delivered" && "text-primary border-primary/30",
                        order.status === "cancelled" && "text-destructive border-destructive/30"
                      )}
                    >
                      {order.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{shortDate(order.order_date)}</p>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold">{inr(order.total)}</div>
                  <p className="text-[10px] text-muted-foreground">
                    {(order.items ?? []).length} items
                  </p>
                </div>
              </div>
              {/* Items list */}
              {order.items && order.items.length > 0 && (
                <div className="border-t pt-3 space-y-1">
                  {order.items.slice(0, 3).map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="truncate flex-1">{item.product_name}</span>
                      <span className="font-mono mx-2">× {num(item.quantity, 1)}</span>
                      <span className="font-mono font-semibold w-20 text-right">
                        {inr(item.rate * item.quantity)}
                      </span>
                    </div>
                  ))}
                  {(order.items ?? []).length > 3 && (
                    <p className="text-[10px] text-muted-foreground">
                      + {(order.items ?? []).length - 3} more items
                    </p>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
