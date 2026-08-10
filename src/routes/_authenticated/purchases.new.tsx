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
import { inr, isoDate } from "@/lib/format";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/purchases/new")({
  component: NewPurchase,
});

type Line = { product_id: string; product_name: string; quantity: number; rate: number; gst_rate: number };

function NewPurchase() {
  const nav = useNavigate();
  const [supplierId, setSupplierId] = useState("");
  const [billNo, setBillNo] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(isoDate());
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: suppliers } = useQuery({ queryKey: ["suppliers"], queryFn: async () => (await supabase.from("suppliers").select("*").order("name")).data ?? [] });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: async () => (await supabase.from("products").select("*").order("name")).data ?? [] });

  const totals = useMemo(() => {
    let subtotal = 0, gst = 0;
    for (const l of lines) {
      const g = l.quantity * l.rate;
      subtotal += g;
      gst += (g * l.gst_rate) / 100;
    }
    return { subtotal, gst, total: subtotal + gst };
  }, [lines]);

  const addLine = () => setLines([...lines, { product_id: "", product_name: "", quantity: 1, rate: 0, gst_rate: 5 }]);
  const setLine = (i: number, l: Line) => setLines(lines.map((x, idx) => (idx === i ? l : x)));
  const rmLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!supplierId || !billNo || lines.length === 0) return toast.error("Supplier, bill no and items required");
    setSaving(true);
    const { data: p, error } = await supabase.from("purchases").insert({
      bill_no: billNo, supplier_id: supplierId, purchase_date: purchaseDate,
      subtotal: totals.subtotal, gst: totals.gst, total: totals.total,
    }).select().single();
    if (!error && p) {
      await supabase.from("purchase_items").insert(lines.map((l) => ({
        purchase_id: p.id, product_id: l.product_id, product_name: l.product_name,
        quantity: l.quantity, rate: l.rate, gst_rate: l.gst_rate, amount: l.quantity * l.rate,
      })));
      
      // Batch stock updates (instead of N+1 loop)
      const stockUpdates = lines
        .map((l) => {
          const prod = (products ?? []).find((x) => x.id === l.product_id);
          return prod ? { id: l.product_id, current_stock: Number(prod.current_stock) + l.quantity } : null;
        })
        .filter((u): u is { id: string; current_stock: number } => u !== null);
      
      const movements = lines
        .filter((l) => (products ?? []).some((x) => x.id === l.product_id))
        .map((l) => ({
          product_id: l.product_id,
          movement_type: "in" as const,
          quantity: l.quantity,
          ref_type: "purchase" as const,
          ref_id: p.id,
          note: `Purchase ${billNo}`,
        }));

      if (stockUpdates.length > 0) {
        await supabase.from("products").upsert(stockUpdates as never);
      }
      if (movements.length > 0) {
        await supabase.from("inventory_movements").insert(movements);
      }
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Purchase recorded");
    nav({ to: "/purchases" });
  };

  return (
    <PageContainer>
      <PageHeader title="New Purchase" description="Record stock received from supplier. Adds to inventory automatically." />
      <Card className="p-6 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Supplier *</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue placeholder="Choose supplier" /></SelectTrigger>
              <SelectContent>{(suppliers ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Bill No *</Label><Input value={billNo} onChange={(e) => setBillNo(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} /></div>
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
                  <th className="text-right px-4 py-2 font-semibold w-20">Qty</th>
                  <th className="text-right px-4 py-2 font-semibold w-24">Rate</th>
                  <th className="text-right px-4 py-2 font-semibold w-20">GST%</th>
                  <th className="text-right px-4 py-2 font-semibold w-32">Amount</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lines.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No items yet.</td></tr>}
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2">
                      <Select value={l.product_id} onValueChange={(v) => {
                        const p = (products ?? []).find((x) => x.id === v);
                        if (p) setLine(i, { ...l, product_id: v, product_name: p.name, rate: Number(p.purchase_price), gst_rate: Number(p.gst_rate) });
                      }}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{(products ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2"><Input type="number" className="h-8 text-right" value={l.quantity} onChange={(e) => setLine(i, { ...l, quantity: Number(e.target.value) })} /></td>
                    <td className="px-4 py-2"><Input type="number" className="h-8 text-right" value={l.rate} onChange={(e) => setLine(i, { ...l, rate: Number(e.target.value) })} /></td>
                    <td className="px-4 py-2"><Input type="number" className="h-8 text-right" value={l.gst_rate} onChange={(e) => setLine(i, { ...l, gst_rate: Number(e.target.value) })} /></td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">{inr(l.quantity * l.rate * (1 + l.gst_rate / 100))}</td>
                    <td className="px-4 py-2"><Button variant="ghost" size="icon" onClick={() => rmLine(i)} aria-label="Remove line item"><Trash2 className="size-3.5" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end">
          <div className="border rounded-xl p-5 bg-muted/30 space-y-2 text-sm w-80">
            <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">{inr(totals.subtotal)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>GST</span><span className="font-mono">{inr(totals.gst)}</span></div>
            <div className="border-t pt-2 mt-2 flex justify-between items-center">
              <span className="font-semibold">Total</span>
              <span className="text-2xl font-semibold font-mono">{inr(totals.total)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => nav({ to: "/purchases" })}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save purchase"}</Button>
        </div>
      </Card>
    </PageContainer>
  );
}
