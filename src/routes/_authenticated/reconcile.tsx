import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { inr, shortDate, genDocNo } from "@/lib/format";
import { toast } from "sonner";
import { Wand2, Link2, AlertTriangle, CheckCircle2, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reconcile")({
  component: Reconcile,
});

type Payment = {
  id: string; payment_no: string; payment_date: string; customer_id: string;
  invoice_id: string | null; amount: number; mode: string; reference: string | null;
  customer?: { name: string; outstanding: number } | null;
};
type Invoice = {
  id: string; invoice_no: string; invoice_date: string; customer_id: string;
  total: number; paid: number; balance: number; status: string;
  customer?: { name: string } | null;
};

function Reconcile() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [busy, setBusy] = useState(false);
  const [allocFor, setAllocFor] = useState<Payment | null>(null);

  const { data: unmatched = [] } = useQuery({
    queryKey: ["recon-unmatched"],
    queryFn: async () =>
      (await supabase
        .from("payments")
        .select("*, customer:customers(name, outstanding)")
        .is("invoice_id", null)
        .order("payment_date", { ascending: false })
      ).data as Payment[] ?? [],
  });

  const { data: openInvoices = [] } = useQuery({
    queryKey: ["recon-open"],
    queryFn: async () =>
      (await supabase
        .from("invoices")
        .select("id, invoice_no, invoice_date, customer_id, total, paid, balance, status, customer:customers(name)")
        .gt("balance", 0)
        .neq("status", "void")
        .order("invoice_date")
      ).data as Invoice[] ?? [],
  });

  const { data: matched = [] } = useQuery({
    queryKey: ["recon-matched"],
    queryFn: async () =>
      (await supabase
        .from("payments")
        .select("*, customer:customers(name, outstanding), invoice:invoices(invoice_no, total, balance)")
        .not("invoice_id", "is", null)
        .order("payment_date", { ascending: false })
        .limit(100)
      ).data ?? [],
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return unmatched.filter((p) => {
      if (modeFilter !== "all" && p.mode !== modeFilter) return false;
      if (!term) return true;
      return (
        p.payment_no?.toLowerCase().includes(term) ||
        p.reference?.toLowerCase().includes(term) ||
        p.customer?.name?.toLowerCase().includes(term)
      );
    });
  }, [unmatched, q, modeFilter]);

  const stats = useMemo(() => {
    const unmatchedTotal = unmatched.reduce((s, p) => s + Number(p.amount || 0), 0);
    const openTotal = openInvoices.reduce((s, i) => s + Number(i.balance || 0), 0);
    const byMode = ["cash", "upi", "bank", "credit"].map((m) => ({
      mode: m,
      amt: unmatched.filter((p) => p.mode === m).reduce((s, p) => s + Number(p.amount || 0), 0),
      count: unmatched.filter((p) => p.mode === m).length,
    }));
    return { unmatchedTotal, openTotal, byMode };
  }, [unmatched, openInvoices]);

  const runAutoMatch = async () => {
    if (unmatched.length === 0) return toast.info("Nothing to reconcile.");
    setBusy(true);
    let allocated = 0;
    let touchedInvoices = 0;
    try {
      // Group unmatched by customer, FIFO allocate against open invoices.
      const byCust = new Map<string, Payment[]>();
      for (const p of unmatched) {
        const list = byCust.get(p.customer_id) ?? [];
        list.push(p);
        byCust.set(p.customer_id, list);
      }
      const openByCust = new Map<string, Invoice[]>();
      for (const inv of openInvoices) {
        const list = openByCust.get(inv.customer_id) ?? [];
        list.push(inv);
        openByCust.set(inv.customer_id, list);
      }
      for (const [custId, pays] of byCust) {
        const invs = [...(openByCust.get(custId) ?? [])].sort(
          (a, b) => a.invoice_date.localeCompare(b.invoice_date),
        );
        for (const pay of pays) {
          let remaining = Number(pay.amount);
          let firstApplied = false;
          const balances = new Map(invs.map((i) => [i.id, Number(i.balance)]));
          while (remaining > 0.009 && invs.length) {
            const inv = invs.find((i) => (balances.get(i.id) ?? 0) > 0.009);
            if (!inv) break;
            const bal = balances.get(inv.id) ?? 0;
            const apply = Math.min(bal, remaining);
            if (!firstApplied) {
              // Update the original on-account row to point to this invoice.
              const { error } = await supabase.from("payments").update({
                invoice_id: inv.id,
                amount: apply,
                notes: appendNote(pay.reference, `Auto-matched ${pay.payment_no}`),
              }).eq("id", pay.id);
              if (error) throw error;
              firstApplied = true;
            } else {
              // Additional slice → new payment row referencing parent.
              const { error } = await supabase.from("payments").insert({
                payment_no: genDocNo("RCP"),
                customer_id: custId,
                invoice_id: inv.id,
                amount: apply,
                mode: pay.mode,
                payment_date: pay.payment_date,
                reference: pay.reference,
                notes: `Auto-split from ${pay.payment_no}`,
              });
              if (error) throw error;
            }
            balances.set(inv.id, bal - apply);
            remaining -= apply;
            touchedInvoices++;
            allocated += apply;
          }
          // If remaining > 0 → keep the leftover as on-account: update original amount to remainder.
          if (firstApplied && remaining > 0.009) {
            await supabase.from("payments").insert({
              payment_no: genDocNo("RCP"),
              customer_id: custId,
              invoice_id: null,
              amount: remaining,
              mode: pay.mode,
              payment_date: pay.payment_date,
              reference: pay.reference,
              notes: `On-account remainder from ${pay.payment_no}`,
            });
          }
        }
      }
      toast.success(`Reconciled ${inr(allocated)} across ${touchedInvoices} invoices.`);
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message ?? "Auto-match failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Collections Reconciliation"
        description="Match unallocated cash / UPI / bank / CoD receipts to open invoices. Customer balances update automatically."
        actions={
          <Button onClick={runAutoMatch} disabled={busy || unmatched.length === 0} className="gap-1.5">
            <Wand2 className="size-4" /> {busy ? "Matching…" : "Auto-match FIFO"}
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Unallocated receipts" value={inr(stats.unmatchedTotal)} sub={`${unmatched.length} payments`} tone="warn" />
        <StatCard label="Open invoices" value={inr(stats.openTotal)} sub={`${openInvoices.length} bills`} />
        {stats.byMode.map((m) => (
          <StatCard key={m.mode} label={m.mode.toUpperCase()} value={inr(m.amt)} sub={`${m.count} receipts`} />
        ))}
      </div>

      <Tabs defaultValue="unmatched" className="mt-2">
        <TabsList>
          <TabsTrigger value="unmatched">Unmatched ({unmatched.length})</TabsTrigger>
          <TabsTrigger value="matched">Recently matched</TabsTrigger>
        </TabsList>

        <TabsContent value="unmatched" className="space-y-3">
          <Card className="p-3 flex flex-col md:flex-row gap-2 md:items-center">
            <div className="relative flex-1">
              <Search className="size-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search receipt no, ref, customer…" className="pl-8" />
            </div>
            <div className="flex gap-1.5">
              {["all", "cash", "upi", "bank", "credit"].map((m) => (
                <Button key={m} variant={modeFilter === m ? "default" : "outline"} size="sm" onClick={() => setModeFilter(m)}>
                  {m.toUpperCase()}
                </Button>
              ))}
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="text-left px-4 py-3 font-semibold">Receipt</th>
                    <th className="text-left px-4 py-3 font-semibold">Date</th>
                    <th className="text-left px-4 py-3 font-semibold">Customer</th>
                    <th className="text-left px-4 py-3 font-semibold">Mode</th>
                    <th className="text-left px-4 py-3 font-semibold">Ref</th>
                    <th className="text-right px-4 py-3 font-semibold">Amount</th>
                    <th className="text-right px-4 py-3 font-semibold">Cust. dues</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-muted-foreground">
                        <CheckCircle2 className="size-8 mx-auto mb-2 text-success" />
                        Everything reconciled.
                      </td>
                    </tr>
                  )}
                  {filtered.map((p) => {
                    const custOpen = openInvoices.filter((i) => i.customer_id === p.customer_id);
                    const canMatch = custOpen.length > 0;
                    return (
                      <tr key={p.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-mono text-xs">{p.payment_no}</td>
                        <td className="px-4 py-3 text-muted-foreground">{shortDate(p.payment_date)}</td>
                        <td className="px-4 py-3">{p.customer?.name ?? "—"}</td>
                        <td className="px-4 py-3"><Badge variant="outline" className="uppercase text-[10px]">{p.mode}</Badge></td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.reference ?? "—"}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-success">{inr(p.amount)}</td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground">{inr(p.customer?.outstanding ?? 0)}</td>
                        <td className="px-4 py-3 text-right">
                          {canMatch ? (
                            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAllocFor(p)}>
                              <Link2 className="size-3.5" /> Match
                            </Button>
                          ) : (
                            <span className="text-xs text-warning inline-flex items-center gap-1">
                              <AlertTriangle className="size-3.5" /> No open bill
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="matched">
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="text-left px-4 py-3 font-semibold">Receipt</th>
                    <th className="text-left px-4 py-3 font-semibold">Date</th>
                    <th className="text-left px-4 py-3 font-semibold">Customer</th>
                    <th className="text-left px-4 py-3 font-semibold">Invoice</th>
                    <th className="text-left px-4 py-3 font-semibold">Mode</th>
                    <th className="text-right px-4 py-3 font-semibold">Applied</th>
                    <th className="text-right px-4 py-3 font-semibold">Bill balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {matched.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No allocations yet.</td></tr>
                  )}
                  {matched.map((p: any) => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs">{p.payment_no}</td>
                      <td className="px-4 py-3 text-muted-foreground">{shortDate(p.payment_date)}</td>
                      <td className="px-4 py-3">{p.customer?.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{p.invoice?.invoice_no}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className="uppercase text-[10px]">{p.mode}</Badge></td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-success">{inr(p.amount)}</td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">{inr(p.invoice?.balance ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!allocFor} onOpenChange={(v) => !v && setAllocFor(null)}>
        {allocFor && (
          <AllocateDialog
            payment={allocFor}
            invoices={openInvoices.filter((i) => i.customer_id === allocFor.customer_id)}
            onDone={() => { setAllocFor(null); qc.invalidateQueries(); }}
          />
        )}
      </Dialog>
    </PageContainer>
  );
}

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" }) {
  return (
    <Card className="p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className={`text-xl font-bold font-mono mt-1 ${tone === "warn" ? "text-warning" : ""}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

function appendNote(existing: string | null, add: string) {
  return existing ? `${existing} · ${add}` : add;
}

function AllocateDialog({
  payment, invoices, onDone,
}: {
  payment: Payment;
  invoices: Invoice[];
  onDone: () => void;
}) {
  const total = Number(payment.amount);
  const [allocs, setAllocs] = useState<Record<string, string>>(() => {
    // Prefill FIFO
    const map: Record<string, string> = {};
    let remaining = total;
    for (const inv of [...invoices].sort((a, b) => a.invoice_date.localeCompare(b.invoice_date))) {
      if (remaining <= 0.009) break;
      const apply = Math.min(Number(inv.balance), remaining);
      map[inv.id] = apply.toFixed(2);
      remaining -= apply;
    }
    return map;
  });
  const [saving, setSaving] = useState(false);

  const allocated = Object.values(allocs).reduce((s, v) => s + (Number(v) || 0), 0);
  const remainder = +(total - allocated).toFixed(2);

  const save = async () => {
    if (allocated <= 0) return toast.error("Allocate at least one invoice.");
    if (allocated - total > 0.009) return toast.error("Allocation exceeds payment amount.");
    setSaving(true);
    try {
      const entries = Object.entries(allocs).filter(([, v]) => Number(v) > 0);
      // Update original row to first allocation
      const [firstInvId, firstAmt] = entries[0];
      const { error: e1 } = await supabase.from("payments").update({
        invoice_id: firstInvId,
        amount: Number(firstAmt),
        notes: appendNote(payment.reference, `Reconciled ${payment.payment_no}`),
      }).eq("id", payment.id);
      if (e1) throw e1;
      
      // Batch insert remaining splits (instead of N+1 loop)
      const splitPayments = entries.slice(1).map(([invId, amt]) => ({
        payment_no: genDocNo("RCP"),
        customer_id: payment.customer_id,
        invoice_id: invId,
        amount: Number(amt),
        mode: payment.mode,
        payment_date: payment.payment_date,
        reference: payment.reference,
        notes: `Split from ${payment.payment_no}`,
      }));
      
      if (splitPayments.length > 0) {
        const { error } = await supabase.from("payments").insert(splitPayments);
        if (error) throw error;
      }
      if (remainder > 0.009) {
        const { error } = await supabase.from("payments").insert({
          payment_no: genDocNo("RCP"),
          customer_id: payment.customer_id,
          invoice_id: null,
          amount: remainder,
          mode: payment.mode,
          payment_date: payment.payment_date,
          reference: payment.reference,
          notes: `On-account remainder from ${payment.payment_no}`,
        });
        if (error) throw error;
      }
      toast.success("Payment allocated. Balances updated.");
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to allocate");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Allocate {payment.payment_no} · {inr(total)}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="text-xs text-muted-foreground">
          Distribute this {payment.mode.toUpperCase()} receipt across open invoices. Any leftover stays on-account.
        </div>
        <div className="max-h-[50vh] overflow-y-auto border rounded-md divide-y">
          {invoices.map((inv) => {
            const val = allocs[inv.id] ?? "";
            const checked = Number(val) > 0;
            return (
              <div key={inv.id} className="flex items-center gap-3 p-3">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(c) => {
                    if (!c) setAllocs({ ...allocs, [inv.id]: "0" });
                    else {
                      const remaining = total - (allocated - (Number(val) || 0));
                      const apply = Math.min(Number(inv.balance), Math.max(0, remaining));
                      setAllocs({ ...allocs, [inv.id]: apply.toFixed(2) });
                    }
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm">{inv.invoice_no}</div>
                  <div className="text-xs text-muted-foreground">
                    {shortDate(inv.invoice_date)} · Total {inr(inv.total)} · Balance {inr(inv.balance)}
                  </div>
                </div>
                <div className="w-32">
                  <Input
                    type="number"
                    value={val}
                    onChange={(e) => setAllocs({ ...allocs, [inv.id]: e.target.value })}
                    placeholder="0"
                    className="text-right font-mono"
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-sm">
          <div className="space-y-1">
            <div><span className="text-muted-foreground">Payment: </span><span className="font-mono font-semibold">{inr(total)}</span></div>
            <div><span className="text-muted-foreground">Allocated: </span><span className="font-mono font-semibold text-success">{inr(allocated)}</span></div>
          </div>
          <div>
            <Label className="text-xs">On-account remainder</Label>
            <div className={`font-mono font-bold text-lg ${remainder < -0.009 ? "text-destructive" : "text-warning"}`}>
              {inr(remainder)}
            </div>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>Cancel</Button>
        <Button onClick={save} disabled={saving || allocated <= 0 || allocated - total > 0.009}>
          {saving ? "Saving…" : "Apply allocation"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
