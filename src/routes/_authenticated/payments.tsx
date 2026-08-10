import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { inr, shortDate, genDocNo, isoDate } from "@/lib/format";
import { useRealtimeSync } from "@/lib/realtime";
import { Plus, Download } from "lucide-react";
import { toast } from "sonner";
import { toCsv, downloadCsv } from "@/lib/bulk";

export const Route = createFileRoute("/_authenticated/payments")({
  component: Payments,
});

function Payments() {
  // Live-update when new payments are recorded. Also invalidate customers
  // since a new payment changes the customer's outstanding balance.
  useRealtimeSync({
    tableName: "payments",
    invalidateKeys: [["payments"], ["customers"]],
  });

  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => (await supabase.from("payments").select("*, customer:customers(name), invoice:invoices(invoice_no)").order("created_at", { ascending: false })).data ?? [],
  });

  // CSV Export
  const exportToCsv = () => {
    const rows = (data ?? []).map((p: any) => ({
      "Receipt #": p.payment_no,
      "Date": shortDate(p.payment_date),
      "Customer": p.customer?.name ?? "",
      "Invoice": p.invoice?.invoice_no ?? "",
      "Mode": p.mode,
      "Reference": p.reference ?? "",
      "Amount": p.amount,
    }));
    const csv = toCsv(rows);
    downloadCsv(csv, `payments_${isoDate()}.csv`);
    toast.success("Exported payments to CSV");
  };

  return (
    <PageContainer>
      <PageHeader
        title="Payments"
        description="Record collections against invoices — updates customer ledger automatically."
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={exportToCsv} className="gap-1.5">
              <Download className="size-4" /> Export CSV
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="size-4" /> Record Payment</Button></DialogTrigger>
              <PaymentDialog onSaved={() => { setOpen(false); qc.invalidateQueries(); }} />
            </Dialog>
          </div>
        }
      />
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-6 py-3 font-semibold">Receipt</th>
              <th className="text-left px-6 py-3 font-semibold">Date</th>
              <th className="text-left px-6 py-3 font-semibold">Customer</th>
              <th className="text-left px-6 py-3 font-semibold">Invoice</th>
              <th className="text-left px-6 py-3 font-semibold">Mode</th>
              <th className="text-left px-6 py-3 font-semibold">Reference</th>
              <th className="text-right px-6 py-3 font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(data ?? []).length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No payments recorded.</td></tr>
            )}
            {(data ?? []).map((p: any) => (
              <tr key={p.id} className="hover:bg-muted/30">
                <td className="px-6 py-3 font-mono text-xs">{p.payment_no}</td>
                <td className="px-6 py-3 text-muted-foreground">{shortDate(p.payment_date)}</td>
                <td className="px-6 py-3">{p.customer?.name}</td>
                <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{p.invoice?.invoice_no ?? "—"}</td>
                <td className="px-6 py-3 text-xs uppercase tracking-wider font-semibold">{p.mode}</td>
                <td className="px-6 py-3 text-xs font-mono text-muted-foreground">{p.reference ?? "—"}</td>
                <td className="px-6 py-3 text-right font-mono font-semibold text-success">{inr(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </PageContainer>
  );
}

function PaymentDialog({ onSaved }: { onSaved: () => void }) {
  const [f, setF] = useState({ customer_id: "", invoice_id: "", amount: "", mode: "cash", reference: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: async () => (await supabase.from("customers").select("*").order("name")).data ?? [] });
  const { data: invoices } = useQuery({
    queryKey: ["cust-invoices", f.customer_id],
    queryFn: async () => f.customer_id ? (await supabase.from("invoices").select("*").eq("customer_id", f.customer_id).gt("balance", 0).order("invoice_date")).data ?? [] : [],
    enabled: !!f.customer_id,
  });

  const save = async () => {
    if (!f.customer_id || !f.amount) return toast.error("Customer and amount required");
    setSaving(true);
    const amount = Number(f.amount);
    const { error } = await supabase.from("payments").insert({
      payment_no: genDocNo("RCP"),
      customer_id: f.customer_id, invoice_id: f.invoice_id || null,
      amount, mode: f.mode, reference: f.reference || null, notes: f.notes || null,
    });
    // Invoice paid/balance/status and customer outstanding are recalculated by DB triggers.


    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Payment recorded");
    onSaved();
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Customer *</Label>
          <Select value={f.customer_id} onValueChange={(v) => setF({ ...f, customer_id: v, invoice_id: "" })}>
            <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
            <SelectContent>{(customers ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name} · Bal {inr(c.outstanding)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {f.customer_id && (
          <div className="space-y-1.5">
            <Label>Against invoice (optional)</Label>
            <Select value={f.invoice_id} onValueChange={(v) => setF({ ...f, invoice_id: v })}>
              <SelectTrigger><SelectValue placeholder="On account" /></SelectTrigger>
              <SelectContent>{(invoices ?? []).map((i) => <SelectItem key={i.id} value={i.id}>{i.invoice_no} · Bal {inr(i.balance)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Amount *</Label><Input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label>Mode</Label>
            <Select value={f.mode} onValueChange={(v) => setF({ ...f, mode: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="bank">Bank Transfer</SelectItem>
                <SelectItem value="credit">Credit note</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5"><Label>Reference / txn id</Label><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      </div>
      <DialogFooter><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Record payment"}</Button></DialogFooter>
    </DialogContent>
  );
}
