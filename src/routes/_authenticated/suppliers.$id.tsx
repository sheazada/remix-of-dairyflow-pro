import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/status-badge";
import { inr, shortDate, isoDate, genDocNo } from "@/lib/format";
import { ArrowLeft, Wallet, ScanLine, FileText, ExternalLink, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/suppliers/$id")({
  component: SupplierDetail,
});

function SupplierDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [payOpen, setPayOpen] = useState(false);

  const { data: supplier } = useQuery({
    queryKey: ["supplier", id],
    queryFn: async () => (await supabase.from("suppliers").select("*").eq("id", id).single()).data,
  });

  const { data: purchases } = useQuery({
    queryKey: ["supplier-purchases", id],
    queryFn: async () => (await supabase.from("purchases").select("*").eq("supplier_id", id).order("purchase_date", { ascending: false })).data ?? [],
  });

  const { data: payments } = useQuery({
    queryKey: ["supplier-payments", id],
    queryFn: async () => (await supabase.from("supplier_payments").select("*").eq("supplier_id", id).order("payment_date", { ascending: false })).data ?? [],
  });

  const totals = {
    purchased: (purchases ?? []).filter((p: any) => p.status !== "void").reduce((s: number, p: any) => s + Number(p.total), 0),
    paid: (payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0),
    billsCount: (purchases ?? []).filter((p: any) => Number(p.total) - Number(p.paid) > 0 && p.status !== "void").length,
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["supplier", id] });
    qc.invalidateQueries({ queryKey: ["supplier-purchases", id] });
    qc.invalidateQueries({ queryKey: ["supplier-payments", id] });
    qc.invalidateQueries({ queryKey: ["suppliers"] });
  };

  if (!supplier) return <PageContainer><div className="py-20 text-center text-muted-foreground">Loading…</div></PageContainer>;

  return (
    <PageContainer>
      <div className="mb-4">
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={() => nav({ to: "/suppliers" })}>
          <ArrowLeft className="size-4" /> All suppliers
        </Button>
      </div>
      <PageHeader
        title={supplier.name}
        description={[supplier.company, supplier.gstin && `GSTIN ${supplier.gstin}`, supplier.mobile].filter(Boolean).join(" · ")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to="/purchases/challan"><ScanLine className="size-4" /> Scan Challan</Link>
            </Button>
            <Dialog open={payOpen} onOpenChange={setPayOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5"><Wallet className="size-4" /> Record Payment</Button>
              </DialogTrigger>
              <PaymentDialog supplierId={id} purchases={purchases ?? []} onSaved={() => { setPayOpen(false); refresh(); }} />
            </Dialog>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Outstanding</div>
          <div className={`text-2xl font-semibold font-mono mt-1 ${Number(supplier.outstanding) > 0 ? "text-destructive" : ""}`}>{inr(supplier.outstanding)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Purchased</div>
          <div className="text-2xl font-semibold font-mono mt-1">{inr(totals.purchased)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Paid</div>
          <div className="text-2xl font-semibold font-mono mt-1">{inr(totals.paid)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Bills With Dues</div>
          <div className="text-2xl font-semibold font-mono mt-1">{totals.billsCount}</div>
        </Card>
      </div>

      <Tabs defaultValue="purchases">
        <TabsList>
          <TabsTrigger value="purchases">Purchases ({purchases?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({payments?.length ?? 0})</TabsTrigger>
        </TabsList>
        <TabsContent value="purchases">
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="text-left px-4 py-3 font-semibold">Date</th>
                    <th className="text-left px-4 py-3 font-semibold">Bill #</th>
                    <th className="text-right px-4 py-3 font-semibold">Total</th>
                    <th className="text-right px-4 py-3 font-semibold">Paid</th>
                    <th className="text-right px-4 py-3 font-semibold">Balance</th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                    <th className="text-left px-4 py-3 font-semibold">Challan</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(purchases ?? []).length === 0 && <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No purchases from this supplier yet.</td></tr>}
                  {(purchases ?? []).map((p: any) => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{shortDate(p.purchase_date)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{p.bill_no}</td>
                      <td className="px-4 py-3 text-right font-mono">{inr(p.total)}</td>
                      <td className="px-4 py-3 text-right font-mono text-success">{inr(p.paid)}</td>
                      <td className={`px-4 py-3 text-right font-mono ${Number(p.total) - Number(p.paid) > 0 ? "text-destructive font-semibold" : ""}`}>{inr(Number(p.total) - Number(p.paid))}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3">{p.challan_url ? <ChallanLink path={p.challan_url} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="payments">
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="text-left px-4 py-3 font-semibold">Date</th>
                    <th className="text-left px-4 py-3 font-semibold">Payment #</th>
                    <th className="text-left px-4 py-3 font-semibold">Bill</th>
                    <th className="text-left px-4 py-3 font-semibold">Mode</th>
                    <th className="text-left px-4 py-3 font-semibold">Reference</th>
                    <th className="text-right px-4 py-3 font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(payments ?? []).length === 0 && <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No payments recorded yet.</td></tr>}
                  {(payments ?? []).map((p: any) => {
                    const bill = (purchases ?? []).find((x: any) => x.id === p.purchase_id);
                    return (
                      <tr key={p.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{shortDate(p.payment_date)}</td>
                        <td className="px-4 py-3 font-mono text-xs">{p.payment_no}</td>
                        <td className="px-4 py-3 font-mono text-xs">{bill?.bill_no ?? <span className="text-muted-foreground">On account</span>}</td>
                        <td className="px-4 py-3 uppercase text-xs">{p.mode}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{p.reference || "—"}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">{inr(p.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

function ChallanLink({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    supabase.storage.from("challans").createSignedUrl(path, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [path]);
  if (!url) return <span className="text-xs text-muted-foreground">Loading…</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
      <FileText className="size-3.5" /> View <ExternalLink className="size-3" />
    </a>
  );
}

function PaymentDialog({ supplierId, purchases, onSaved }: { supplierId: string; purchases: any[]; onSaved: () => void }) {
  const openBills = purchases.filter((p) => Number(p.total) - Number(p.paid) > 0 && p.status !== "void");
  const [f, setF] = useState({
    amount: 0,
    mode: "bank",
    reference: "",
    purchase_id: "on_account",
    payment_date: isoDate(),
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!f.amount || f.amount <= 0) return toast.error("Enter payment amount");
    setSaving(true);
    const { error } = await supabase.from("supplier_payments").insert({
      payment_no: genDocNo("SP"),
      supplier_id: supplierId,
      purchase_id: f.purchase_id === "on_account" ? null : f.purchase_id,
      amount: f.amount,
      mode: f.mode,
      reference: f.reference || null,
      payment_date: f.payment_date,
      notes: f.notes || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Payment recorded");
    onSaved();
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Record supplier payment</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>Against bill</Label>
          <Select value={f.purchase_id} onValueChange={(v) => setF({ ...f, purchase_id: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="on_account">On account (unallocated)</SelectItem>
              {openBills.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.bill_no} · {shortDate(p.purchase_date)} · Due {inr(Number(p.total) - Number(p.paid))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Amount *</Label>
          <Input type="number" value={f.amount || ""} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label>Mode</Label>
          <Select value={f.mode} onValueChange={(v) => setF({ ...f, mode: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="upi">UPI</SelectItem>
              <SelectItem value="bank">Bank transfer</SelectItem>
              <SelectItem value="cheque">Cheque</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Date</Label>
          <Input type="date" value={f.payment_date} onChange={(e) => setF({ ...f, payment_date: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Reference</Label>
          <Input placeholder="UTR / cheque #" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Notes</Label>
          <Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving} className="gap-1.5"><Plus className="size-4" />{saving ? "Saving…" : "Record payment"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
