import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inr, genDocNo } from "@/lib/format";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/orders/new")({
  component: NewOrder,
});

type Line = { product_id: string; product_name: string; quantity: number; rate: number };

function NewOrder() {
  const nav = useNavigate();
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: async () => (await supabase.from("customers").select("*").order("name")).data ?? [] });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: async () => (await supabase.from("products").select("*").eq("status", "active").order("name")).data ?? [] });

  const total = useMemo(() => lines.reduce((s, l) => s + l.quantity * l.rate, 0), [lines]);

  const addLine = () => setLines([...lines, { product_id: "", product_name: "", quantity: 1, rate: 0 }]);
  const setLine = (i: number, l: Line) => setLines(lines.map((x, idx) => (idx === i ? l : x)));
  const rmLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!customerId) return toast.error("Select customer");
    if (lines.length === 0) return toast.error("Add at least one item");
    setSaving(true);
    const order_no = genDocNo("ORD");
    const { data: order, error } = await supabase.from("orders").insert({
      order_no, customer_id: customerId, subtotal: total, total,
    }).select().single();
    if (!error && order) {
      await supabase.from("order_items").insert(lines.map((l) => ({
        order_id: order.id, product_id: l.product_id, product_name: l.product_name,
        quantity: l.quantity, rate: l.rate, amount: l.quantity * l.rate,
      })));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Order created");
    nav({ to: "/orders" });
  };

  return (
    <PageContainer>
      <PageHeader title="New Order" description="Capture a retailer order." />
      <Card className="p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4 max-w-2xl">
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder="Choose customer" /></SelectTrigger>
              <SelectContent>{(customers ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name} — {c.shop_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <Label>Items</Label>
            <Button variant="outline" size="sm" onClick={addLine} className="gap-1"><Plus className="size-3" /> Add item</Button>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left px-4 py-2 font-semibold">Product</th>
                  <th className="text-right px-4 py-2 font-semibold w-24">Qty</th>
                  <th className="text-right px-4 py-2 font-semibold w-28">Rate</th>
                  <th className="text-right px-4 py-2 font-semibold w-32">Amount</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lines.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No items. Click "Add item".</td></tr>
                )}
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2">
                      <Select value={l.product_id} onValueChange={(v) => {
                        const p = (products ?? []).find((x) => x.id === v);
                        if (p) setLine(i, { ...l, product_id: v, product_name: p.name, rate: Number(p.selling_price) });
                      }}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Select product" /></SelectTrigger>
                        <SelectContent>{(products ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2"><Input type="number" className="h-8 text-right" value={l.quantity} onChange={(e) => setLine(i, { ...l, quantity: Number(e.target.value) })} /></td>
                    <td className="px-4 py-2"><Input type="number" className="h-8 text-right" value={l.rate} onChange={(e) => setLine(i, { ...l, rate: Number(e.target.value) })} /></td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">{inr(l.quantity * l.rate)}</td>
                    <td className="px-4 py-2"><Button variant="ghost" size="icon" onClick={() => rmLine(i)} aria-label="Remove line item"><Trash2 className="size-3.5" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-between items-center border-t pt-4">
          <div className="text-sm text-muted-foreground">Total items: {lines.length}</div>
          <div className="text-2xl font-semibold font-mono">{inr(total)}</div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => nav({ to: "/orders" })}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Create order"}</Button>
        </div>
      </Card>
    </PageContainer>
  );
}
