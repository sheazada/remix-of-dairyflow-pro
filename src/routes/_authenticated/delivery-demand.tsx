import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { inr, num, isoDate, shortDate, genDocNo } from "@/lib/format";
import { useRealtimeSync } from "@/lib/realtime";
import { sendWhatsApp, formatOrderConfirmation } from "@/lib/whatsapp";
import {
  CheckCircle2,
  Check,
  Circle,
  Clock,
  Phone,
  Search,
  Wallet,
  Package,
  MapPin,
  X,
  Minus,
  Plus,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/delivery-demand")({
  component: DeliveryDemand,
});

type ShopOrder = {
  customer_id: string;
  customer_name: string;
  shop_name: string | null;
  address: string | null;
  mobile: string | null;
  order_id: string;
  order_no: string;
  order_total: number;
  invoice_id: string | null;
  invoice_no: string | null;
  invoice_balance: number;
  delivery_id: string | null;
  delivery_status: string | null;
  items: {
    id: string;
    product_name: string;
    quantity: number;
    rate: number;
    amount: number;
  }[];
};

function DeliveryDemand() {
  const nav = useNavigate();
  const qc = useQueryClient();

  // Live-update when deliveries/invoices/orders change (e.g. a driver marks
  // a stop delivered in another tab, or an invoice is paid).
  useRealtimeSync({
    tableName: "deliveries",
    invalidateKeys: [["delivery-demand"]],
  });
  useRealtimeSync({
    tableName: "invoices",
    invalidateKeys: [["delivery-demand"]],
  });
  useRealtimeSync({
    tableName: "orders",
    invalidateKeys: [["delivery-demand"]],
  });
  const [date, setDate] = useState(isoDate());
  const [routeFilter, setRouteFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [payFor, setPayFor] = useState<ShopOrder | null>(null);
  const [markDeliveredFor, setMarkDeliveredFor] = useState<ShopOrder | null>(null);

  // Fetch routes for filter
  const { data: routes = [] } = useQuery({
    queryKey: ["routes"],
    queryFn: async () => {
      const { data } = await supabase.from("routes").select("*").eq("active", true).order("name");
      return data ?? [];
    },
  });

  // Fetch orders + invoice + delivery for the date
  const { data: shopOrders = [], isLoading } = useQuery({
    queryKey: ["delivery-demand", date],
    queryFn: async () => {
      // Get orders for the date
      const { data: orders, error: oErr } = await supabase
        .from("orders")
        .select("id, order_no, order_date, total, customer_id, customer:customers(id, name, shop_name, address, mobile)")
        .gte("order_date", date)
        .lte("order_date", date + "T23:59:59")
        .neq("status", "cancelled")
        .order("customer:customers.name", { ascending: true });
      if (oErr) throw oErr;

      if (!orders || orders.length === 0) return [];

      const orderIds = orders.map((o: any) => o.id);

      // Get order items
      const { data: items } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orderIds);

      // Get invoices for these orders
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, invoice_no, total, paid, balance, order_id")
        .in("order_id", orderIds);

      // Get deliveries for these invoices
      const invoiceIds = (invoices ?? []).map((i: any) => i.id);
      let deliveries: any[] = [];
      if (invoiceIds.length > 0) {
        const { data: del } = await supabase
          .from("deliveries")
          .select("id, invoice_id, status, route, assigned_to")
          .in("invoice_id", invoiceIds);
        deliveries = del ?? [];
      }

      const invByOrder = new Map<string, any>();
      for (const inv of invoices ?? []) {
        if (inv.order_id) invByOrder.set(inv.order_id, inv);
      }

      const delByInvoice = new Map<string, any>();
      for (const d of deliveries) {
        delByInvoice.set(d.invoice_id, d);
      }

      const itemsByOrder = new Map<string, any[]>();
      for (const item of items ?? []) {
        const list = itemsByOrder.get(item.order_id) ?? [];
        list.push(item);
        itemsByOrder.set(item.order_id, list);
      }

      return orders.map((o: any) => {
        const inv = invByOrder.get(o.id);
        const del = inv ? delByInvoice.get(inv.id) : null;
        return {
          customer_id: o.customer_id,
          customer_name: o.customer?.name ?? "",
          shop_name: o.customer?.shop_name ?? null,
          address: o.customer?.address ?? null,
          mobile: o.customer?.mobile ?? null,
          order_id: o.id,
          order_no: o.order_no,
          order_total: Number(o.total),
          invoice_id: inv?.id ?? null,
          invoice_no: inv?.invoice_no ?? null,
          invoice_balance: Number(inv?.balance ?? 0),
          delivery_id: del?.id ?? null,
          delivery_status: del?.status ?? null,
          items: (itemsByOrder.get(o.id) ?? []).map((it: any) => ({
            id: it.id,
            product_name: it.product_name,
            quantity: Number(it.quantity),
            rate: Number(it.rate),
            amount: Number(it.amount),
          })),
        };
      });
    },
  });

  const filtered = useMemo(() => {
    return shopOrders.filter((s) => {
      if (statusFilter !== "all" && s.delivery_status !== statusFilter) return false;
      const q = search.toLowerCase().trim();
      if (q && !(s.customer_name.toLowerCase().includes(q) || (s.shop_name ?? "").toLowerCase().includes(q) || (s.address ?? "").toLowerCase().includes(q))) {
        return false;
      }
      return true;
    });
  }, [shopOrders, statusFilter, search]);

  const stats = useMemo(() => {
    return {
      total: shopOrders.length,
      delivered: shopOrders.filter((s) => s.delivery_status === "delivered").length,
      pending: shopOrders.filter((s) => !s.delivery_status || s.delivery_status === "planned").length,
      paid: shopOrders.filter((s) => s.invoice_balance <= 0).length,
      outstanding: shopOrders.reduce((sum, s) => sum + s.invoice_balance, 0),
      collected: shopOrders.reduce((sum, s) => sum + (s.order_total - s.invoice_balance), 0),
    };
  }, [shopOrders]);

  const updateDeliveryStatus = async (deliveryId: string, status: string) => {
    const { error } = await supabase
      .from("deliveries")
      .update({ status, delivered_at: status === "delivered" ? new Date().toISOString() : null })
      .eq("id", deliveryId);
    if (error) return toast.error(error.message);
    toast.success(`Marked as ${status}`);
    qc.invalidateQueries({ queryKey: ["delivery-demand", date] });
  };

  return (
    <PageContainer>
      <PageHeader
        title="Delivery Demand"
        description="Per-shop orders. Mark delivered, collect payment."
      />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Shops</div>
          <div className="text-2xl font-bold font-mono mt-1">{stats.total}</div>
          <div className="text-xs text-muted-foreground">{stats.delivered} delivered</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pending</div>
          <div className="text-2xl font-bold font-mono mt-1 text-warning">{stats.pending}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Collected</div>
          <div className="text-2xl font-bold font-mono mt-1 text-success">{inr(stats.collected)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Outstanding</div>
          <div className="text-2xl font-bold font-mono mt-1 text-destructive">{inr(stats.outstanding)}</div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-3 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-36 h-8" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="planned">Pending</SelectItem>
            <SelectItem value="en_route">En Route</SelectItem>
            <SelectItem value="partially_delivered">Partial</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search shop, name, address…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8" />
        </div>
      </Card>

      {/* Shop cards */}
      {isLoading && <div className="text-center py-12 text-muted-foreground">Loading…</div>}

      {!isLoading && filtered.length === 0 && (
        <Card className="p-12 text-center">
          <Package className="size-10 mx-auto mb-3 opacity-50" />
          <div className="text-sm font-semibold">No shops for {shortDate(date)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {statusFilter !== "all" ? "Try changing the filter" : "Orders will appear here as retailers place them."}
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {filtered.map((shop) => (
          <ShopCard
            key={shop.order_id}
            shop={shop}
            onCollectPayment={() => setPayFor(shop)}
            onMarkDelivered={() => setMarkDeliveredFor(shop)}
            onStatusChange={updateDeliveryStatus}
          />
        ))}
      </div>

      {/* Payment dialog */}
      {payFor && (
        <PaymentDialog
          shop={payFor}
          onClose={() => setPayFor(null)}
          onSaved={() => {
            setPayFor(null);
            qc.invalidateQueries({ queryKey: ["delivery-demand", date] });
          }}
        />
      )}

      {/* Mark delivered dialog */}
      {markDeliveredFor && (
        <MarkDeliveredDialog
          shop={markDeliveredFor}
          onClose={() => setMarkDeliveredFor(null)}
          onSaved={() => {
            setMarkDeliveredFor(null);
            qc.invalidateQueries({ queryKey: ["delivery-demand", date] });
          }}
        />
      )}
    </PageContainer>
  );
}

function ShopCard({
  shop,
  onCollectPayment,
  onMarkDelivered,
  onStatusChange,
}: {
  shop: ShopOrder;
  onCollectPayment: () => void;
  onMarkDelivered: () => void;
  onStatusChange: (deliveryId: string, status: string) => void;
}) {
  const sendWhatsAppOrder = () => {
    const biz = { name: "DairyFlow Distributors", mobile: "" };
    const customer = { name: shop.customer_name, shop_name: shop.shop_name ?? undefined };
    const msg = formatOrderConfirmation(
      shop.order_no,
      shop.order_no,
      shop.order_total,
      shop.items.map((i) => ({ product_name: i.product_name, quantity: i.quantity, rate: i.rate })),
      customer,
      biz,
    );
    sendWhatsApp(shop.mobile, msg);
    toast.success("Opening WhatsApp…");
  };
  const isDelivered = shop.delivery_status === "delivered";
  const isPaid = shop.invoice_balance <= 0;

  return (
    <Card className={cn("p-4", isDelivered && "bg-success/5", isPaid && isDelivered && "border-success/30")}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm truncate">{shop.shop_name ?? shop.customer_name}</h3>
            {isDelivered && <CheckCircle2 className="size-4 text-success shrink-0" />}
          </div>
          <div className="text-xs text-muted-foreground truncate">{shop.customer_name}</div>
          {shop.address && (
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="size-3" /> {shop.address}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-[10px] text-muted-foreground">{shop.invoice_no ?? shop.order_no}</div>
          <div className="font-mono font-semibold text-sm">{inr(shop.order_total)}</div>
          {shop.invoice_balance > 0 ? (
            <div className="text-[11px] text-destructive font-mono font-semibold">Due {inr(shop.invoice_balance)}</div>
          ) : (
            <Badge variant="outline" className="text-[10px] text-success border-success/30 mt-1">
              <Check className="size-3 mr-1" /> Paid
            </Badge>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="border rounded-md divide-y text-xs mb-3">
        {shop.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between px-3 py-1.5">
            <span className="font-medium truncate">{item.product_name}</span>
            <div className="flex items-center gap-3 shrink-0 ml-2">
              <span className="font-mono">{num(item.quantity, 1)} × {inr(item.rate)}</span>
              <span className="font-mono font-semibold w-20 text-right">{inr(item.amount)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {shop.mobile && (
          <Button asChild size="sm" variant="ghost" className="gap-1.5">
            <a href={`tel:${shop.mobile}`}>
              <Phone className="size-4" /> Call
            </a>
          </Button>
        )}
        {shop.mobile && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={sendWhatsAppOrder}>
            <MessageCircle className="size-4 text-green-600" /> WhatsApp
          </Button>
        )}

        <Select
          value={shop.delivery_status ?? "planned"}
          onValueChange={(v) => shop.delivery_id && onStatusChange(shop.delivery_id, v)}
        >
          <SelectTrigger className="h-8 flex-1 min-w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="planned"><Circle className="size-3 inline mr-1" /> Planned</SelectItem>
            <SelectItem value="en_route"><Clock className="size-3 inline mr-1" /> En Route</SelectItem>
            <SelectItem value="delivered"><CheckCircle2 className="size-3 inline mr-1 text-success" /> Delivered</SelectItem>
            <SelectItem value="partially_delivered">Partial</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        {!isDelivered && (
          <Button size="sm" onClick={onMarkDelivered} className="gap-1.5">
            <CheckCircle2 className="size-4" /> Mark Delivered
          </Button>
        )}

        <Button
          size="sm"
          variant={isPaid ? "secondary" : "default"}
          onClick={onCollectPayment}
          className="gap-1.5"
        >
          <Wallet className="size-4" />
          {isPaid ? "Paid — History" : "Collect Payment"}
        </Button>
      </div>
    </Card>
  );
}

function PaymentDialog({ shop, onClose, onSaved }: { shop: ShopOrder; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"cash" | "upi" | "bank">("cash");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  const bal = shop.invoice_balance;

  const save = async () => {
    const amt = Number(amount || bal);
    if (!amt || amt <= 0) return toast.error("Enter amount");
    setSaving(true);

    const { error } = await supabase.from("payments").insert({
      payment_no: genDocNo("RCP"),
      customer_id: shop.customer_id,
      invoice_id: shop.invoice_id,
      amount: amt,
      mode,
      reference: reference || null,
      notes: `Collected on delivery`,
    });

    if (error) { setSaving(false); return toast.error(error.message); }

    if (shop.invoice_id) {
      await supabase.rpc("recalc_invoice", { _invoice_id: shop.invoice_id });
      await supabase.rpc("recalc_customer_outstanding", { _customer_id: shop.customer_id });
    }

    setSaving(false);
    toast.success(`Payment of ${inr(amt)} recorded!`);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="size-5 text-success" /> Collect Payment
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-lg bg-muted/40 p-3 space-y-1">
          <div className="font-medium text-sm">{shop.shop_name ?? shop.customer_name}</div>
          <div className="text-xs text-muted-foreground">{shop.invoice_no}</div>
          <div className="mt-2 pt-2 border-t flex justify-between text-sm font-semibold">
            <span>Balance Due</span>
            <span className="font-mono text-destructive">{inr(bal)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <Input type="number" placeholder={String(bal)} value={amount} onChange={(e) => setAmount(e.target.value)} className="text-lg font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label>Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">💵 Cash</SelectItem>
                <SelectItem value="upi"> UPI</SelectItem>
                <SelectItem value="bank">🏦 Bank</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {mode !== "cash" && (
          <div className="space-y-1.5">
            <Label>Reference / txn id</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : `Record ${amount ? inr(Number(amount)) : "Payment"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MarkDeliveredDialog({ shop, onClose, onSaved }: { shop: ShopOrder; onClose: () => void; onSaved: () => void }) {
  const [qtys, setQtys] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    shop.items.forEach((it) => { init[it.id] = it.quantity; });
    return init;
  });
  const [saving, setSaving] = useState(false);

  const allFull = shop.items.every((it) => qtys[it.id] >= it.quantity);
  const hasPartial = shop.items.some((it) => qtys[it.id] > 0 && qtys[it.id] < it.quantity);
  const allZero = shop.items.every((it) => qtys[it.id] === 0);

  const setQty = (id: string, qty: number) => setQtys((prev) => ({ ...prev, [id]: Math.max(0, qty) }));

  const save = async () => {
    setSaving(true);
    try {
      // Update delivery status
      if (shop.delivery_id) {
        const status = allZero ? "failed" : allFull ? "delivered" : "partially_delivered";
        await supabase.from("deliveries").update({
          status,
          delivered_at: new Date().toISOString(),
        }).eq("id", shop.delivery_id);
      }

      // If partial and invoice exists, revise the invoice items
      if (hasPartial && shop.invoice_id) {
        for (const item of shop.items) {
          await supabase
            .from("invoice_items")
            .update({ quantity: qtys[item.id], amount: qtys[item.id] * item.rate })
            .eq("id", item.id);
        }
        // Recalculate invoice
        await supabase.rpc("recalc_invoice", { _invoice_id: shop.invoice_id });
        await supabase.rpc("recalc_customer_outstanding", { _customer_id: shop.customer_id });
      }

      toast.success(allFull ? "Marked as delivered" : hasPartial ? "Marked as partially delivered" : "Marked as failed");
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mark Delivery</DialogTitle>
          <div className="text-xs text-muted-foreground">{shop.shop_name ?? shop.customer_name}</div>
        </DialogHeader>

        <div className="space-y-2">
          {shop.items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 p-2 border rounded-md">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{item.product_name}</div>
                <div className="text-xs text-muted-foreground">Ordered: {num(item.quantity, 1)}</div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="size-7" onClick={() => setQty(item.id, qtys[item.id] - 1)} aria-label={`Decrease ${item.product_name}`}>
                  <Minus className="size-3" aria-hidden />
                </Button>
                <Input
                  type="number"
                  value={qtys[item.id]}
                  onChange={(e) => setQty(item.id, Number(e.target.value))}
                  className="h-7 w-14 text-center font-mono"
                  aria-label={`Quantity for ${item.product_name}`}
                />
                <Button variant="outline" size="icon" className="size-7" onClick={() => setQty(item.id, qtys[item.id] + 1)} aria-label={`Increase ${item.product_name}`}>
                  <Plus className="size-3" aria-hidden />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-muted-foreground">
          {allFull && <span className="text-success font-semibold">✓ All items full quantity</span>}
          {hasPartial && <span className="text-warning font-semibold">⚠ Partial delivery — invoice will be revised</span>}
          {allZero && <span className="text-destructive font-semibold">✗ Failed delivery</span>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : allFull ? "Mark Delivered" : hasPartial ? "Mark Partial" : "Mark Failed"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
