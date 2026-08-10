import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { inr, shortDate } from "@/lib/format";
import {
  ArrowLeft,
  Printer,
  Milk,
  Pencil,
  Ban,
  Save,
  X,
  Trash2,
  Receipt,
  Download,
  Copy,
  History,
} from "lucide-react";
import { InvoiceShareMenu } from "@/components/invoice-share-menu";
import { ReviseInvoiceDialog } from "@/components/revise-invoice-dialog";
import { InvoiceRevisionHistory } from "@/components/invoice-revision-history";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { amountInWords } from "@/lib/amount-in-words";
import { getBusiness, qrImage, upiIntent } from "@/lib/business";
import { buildInvoicePdf, prefetchInvoicePdf } from "@/lib/invoice-pdf";

export const Route = createFileRoute("/_authenticated/invoices/$id")({
  component: InvoiceView,
});

type EditableItem = {
  id: string;
  product_id: string | null;
  product_name: string;
  hsn: string | null;
  quantity: number;
  rate: number;
  discount: number;
  gst_rate: number;
  _deleted?: boolean;
};

function InvoiceView() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditableItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [reviseOpen, setReviseOpen] = useState(false);
  const biz = useMemo(() => getBusiness(), []);

  const { data } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const [inv, items, pays] = await Promise.all([
        supabase.from("invoices").select("*, customer:customers(*)").eq("id", id).single(),
        supabase.from("invoice_items").select("*").eq("invoice_id", id).order("created_at"),
        supabase.from("payments").select("*").eq("invoice_id", id),
      ]);
      return { invoice: inv.data, items: items.data ?? [], payments: pays.data ?? [] };
    },
  });

  useEffect(() => {
    if (data?.items && !editing) {
      setDraft(
        data.items.map((it: any) => ({
          id: it.id,
          product_id: it.product_id,
          product_name: it.product_name,
          hsn: it.hsn,
          quantity: Number(it.quantity),
          rate: Number(it.rate),
          discount: Number(it.discount),
          gst_rate: Number(it.gst_rate),
        })),
      );
    }
  }, [data?.items, editing]);

  // Warm up PDF library so first download is instant (non-blocking)
  useEffect(() => {
    prefetchInvoicePdf();
  }, []);

  if (!data?.invoice)
    return (
      <PageContainer>
        <div className="text-muted-foreground">Loading…</div>
      </PageContainer>
    );
  const inv = data.invoice;
  const c = inv.customer;
  const isInter = Number(inv.igst) > 0;
  const isVoid = inv.status === "void";

  const saveEdits = async () => {
    setSaving(true);
    try {
      // Batch delete deleted items (instead of N+1)
      const deletedItems = draft.filter((r) => r._deleted);
      if (deletedItems.length > 0) {
        const deletedIds = deletedItems.map((r) => r.id);
        await supabase.from("invoice_items").delete().in("id", deletedIds);
      }

      // Batch update modified items
      const updatedItems = draft.filter((r) => !r._deleted);
      const itemUpdates = updatedItems.map((row) => {
        const taxable = row.quantity * row.rate - row.discount;
        const tax_amount = (taxable * row.gst_rate) / 100;
        return {
          id: row.id,
          quantity: row.quantity,
          rate: row.rate,
          discount: row.discount,
          taxable,
          tax_amount,
          amount: taxable + tax_amount,
        };
      });

      for (const upd of itemUpdates) {
        const { id, ...fields } = upd;
        await supabase.from("invoice_items").update(fields).eq("id", id);
      }


      // Handle stock adjustments for changed quantities
      const stockMovements: any[] = [];
      const productUpdates: any[] = [];

      for (const row of updatedItems) {
        const original = (data.items ?? []).find((it: any) => it.id === row.id);
        if (original && row.product_id) {
          const delta = row.quantity - Number(original.quantity);
          if (delta !== 0) {
            const { data: p } = await supabase
              .from("products")
              .select("current_stock")
              .eq("id", row.product_id)
              .single();
            if (p) {
              const newStock = Number(p.current_stock) - delta;
              productUpdates.push({ id: row.product_id, current_stock: newStock });

              stockMovements.push({
                product_id: row.product_id,
                movement_type: delta > 0 ? "out" : "in",
                quantity: Math.abs(delta),
                ref_type: "invoice_edit",
                ref_id: inv.id,
                note: `Invoice ${inv.invoice_no} edited`,
              });
            }
          }
        }
      }

      // Batch product updates
      if (productUpdates.length > 0) {
        await supabase.from("products").upsert(productUpdates);
      }

      // Batch inventory movements
      if (stockMovements.length > 0) {
        await supabase.from("inventory_movements").insert(stockMovements);
      }

      toast.success("Invoice updated — balances recalculated");
      setEditing(false);
      await qc.invalidateQueries({ queryKey: ["invoice", id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update invoice");
    } finally {
      setSaving(false);
    }
  };

  const voidInvoice = async () => {
    try {
      // Batch stock restoration (instead of N+1)
      const stockMovements: any[] = [];
      const productUpdates: any[] = [];

      for (const it of data.items) {
        if (!it.product_id) continue;
        const { data: p } = await supabase
          .from("products")
          .select("current_stock")
          .eq("id", it.product_id)
          .single();
        if (p) {
          const newStock = Number(p.current_stock) + Number(it.quantity);
          productUpdates.push({ id: it.product_id, current_stock: newStock });

          stockMovements.push({
            product_id: it.product_id,
            movement_type: "in",
            quantity: Number(it.quantity),
            ref_type: "invoice_void",
            ref_id: inv.id,
            note: `Invoice ${inv.invoice_no} voided`,
          });
        }
      }

      // Batch product updates
      if (productUpdates.length > 0) {
        await supabase.from("products").upsert(productUpdates);
      }

      // Batch inventory movements
      if (stockMovements.length > 0) {
        await supabase.from("inventory_movements").insert(stockMovements);
      }

      const { error } = await supabase
        .from("invoices")
        .update({ status: "void" })
        .eq("id", inv.id);
      if (error) throw error;
      toast.success("Invoice voided — customer outstanding updated");
      await qc.invalidateQueries({ queryKey: ["invoice", id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to void invoice");
    }
  };

  const liveTotals = (() => {
    let subtotal = 0,
      tax = 0;
    for (const l of draft) {
      if (l._deleted) continue;
      const taxable = l.quantity * l.rate - l.discount;
      subtotal += taxable;
      tax += (taxable * l.gst_rate) / 100;
    }
    return { subtotal, tax, total: subtotal + tax };
  })();

  const printA4 = () => {
    document.body.classList.add("print-a4");
    document.body.classList.remove("print-thermal");
    window.print();
    setTimeout(() => document.body.classList.remove("print-a4"), 500);
  };
  const printThermal = () => {
    document.body.classList.add("print-thermal");
    document.body.classList.remove("print-a4");
    window.print();
    setTimeout(() => document.body.classList.remove("print-thermal"), 500);
  };

  const downloadPdf = async () => {
    try {
      const blob = await buildInvoicePdf(inv, data.items);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice-${inv.invoice_no}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Invoice PDF downloaded");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to generate PDF");
    }
  };


  // QR: UPI intent if VPA configured, else invoice URL
  const qrPayload = biz.upi_vpa
    ? upiIntent({
        payee: biz.name,
        vpa: biz.upi_vpa,
        amount: Number(inv.balance) > 0 ? Number(inv.balance) : Number(inv.total),
        note: `Inv ${inv.invoice_no}`,
      })
    : typeof window !== "undefined"
      ? window.location.href
      : inv.invoice_no;

  const items = editing ? draft.filter((d) => !d._deleted) : data.items;
  const totalQty = items.reduce((s: number, it: any) => s + Number(it.quantity), 0);

  return (
    <PageContainer>
      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 no-print">
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link to="/invoices">
            <ArrowLeft className="size-4" /> Back
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2 items-center">
          <StatusBadge status={inv.status} />
          {!editing && !isVoid && (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-1.5">
                <Pencil className="size-4" /> Edit items
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReviseOpen(true)}
                className="gap-1.5"
              >
                <History className="size-4" /> Revise Invoice
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5 text-destructive">
                    <Ban className="size-4" /> Void
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Void invoice {inv.invoice_no}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Stock will be restored and the customer's outstanding balance will be reduced
                      by {inr(inv.balance)}. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={voidInvoice}>Void invoice</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          {editing && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="gap-1.5">
                <X className="size-4" /> Cancel
              </Button>
              <Button size="sm" onClick={saveEdits} disabled={saving} className="gap-1.5">
                <Save className="size-4" /> {saving ? "Saving…" : "Save changes"}
              </Button>
            </>
          )}
          {!editing && (
            <>
              <InvoiceShareMenu invoice={inv} items={data.items} customer={c} />
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <Link to="/invoices/new" search={{ fromInvoice: inv.id }}>
                  <Copy className="size-4" /> Duplicate
                </Link>
              </Button>
              <Button size="sm" variant="outline" onClick={printThermal} className="gap-1.5">
                <Receipt className="size-4" /> Thermal
              </Button>
              <Button size="sm" variant="outline" onClick={printA4} className="gap-1.5">
                <Printer className="size-4" /> Print
              </Button>
              <Button size="sm" onClick={downloadPdf} className="gap-1.5">
                <Download className="size-4" /> Download PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Customer balance banner */}
      {c && (
        <div className="max-w-[210mm] mx-auto mb-4 no-print flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm">
          <div>
            <span className="text-muted-foreground">Customer: </span>
            <span className="font-semibold">{c.name}</span>
            {c.shop_name && <span className="text-muted-foreground"> · {c.shop_name}</span>}
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div>
              <span className="text-muted-foreground">This invoice balance: </span>
              <span
                className={`font-mono font-semibold ${Number(inv.balance) > 0 ? "text-destructive" : "text-success"}`}
              >
                {inr(inv.balance)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Total outstanding: </span>
              <span
                className={`font-mono font-semibold ${Number(c.outstanding) > 0 ? "text-destructive" : "text-success"}`}
              >
                {inr(c.outstanding)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* =========== A4 INVOICE =========== */}
      <div className="invoice-a4 mx-auto bg-white text-slate-900 shadow-sm border rounded-md print:rounded-none print:shadow-none print:border-0">
        {/* Header band */}
        <div className="relative">
          <div className="absolute inset-x-0 top-0 h-1 bg-primary print:bg-black" />
          <div className="p-6 sm:p-8 flex justify-between items-start gap-4 border-b">
            <div className="flex items-start gap-3">
              <div className="size-12 rounded-lg bg-primary print:bg-black grid place-items-center text-white shrink-0">
                <Milk className="size-6" />
              </div>
              <div>
                <div className="text-lg sm:text-xl font-bold tracking-tight leading-tight">
                  {biz.name}
                </div>
                {biz.legal_name && biz.legal_name !== biz.name && (
                  <div className="text-[11px] text-slate-500">{biz.legal_name}</div>
                )}
                <div className="text-[11px] text-slate-600 mt-1 whitespace-pre-line max-w-xs">
                  {biz.address}
                </div>
                <div className="text-[11px] text-slate-600 mt-1 space-x-2">
                  <span>📞 {biz.mobile}</span>
                  {biz.email && <span>· ✉ {biz.email}</span>}
                </div>
                <div className="text-[11px] mt-1 space-x-3">
                  <span>
                    <b>GSTIN:</b> <span className="font-mono">{biz.gstin}</span>
                  </span>
                  {biz.fssai && (
                    <span>
                      <b>FSSAI:</b> <span className="font-mono">{biz.fssai}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="inline-block px-3 py-1 rounded bg-primary/10 text-primary print:bg-slate-100 print:text-black text-[10px] font-bold uppercase tracking-widest">
                Tax Invoice
              </div>
              <div className="text-lg font-bold font-mono mt-2">{inv.invoice_no}</div>
              <div className="text-[11px] text-slate-500">
                {shortDate(inv.invoice_date)}
                {inv.due_date && <> · Due {shortDate(inv.due_date)}</>}
              </div>
              {isVoid && (
                <div className="mt-2 inline-block text-[10px] px-2 py-0.5 rounded bg-destructive/10 text-destructive font-bold uppercase">
                  Voided
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bill to / Ship to / Meta */}
        <div className="grid grid-cols-1 sm:grid-cols-3 border-b divide-y sm:divide-y-0 sm:divide-x text-[12px]">
          <div className="p-4">
            <div className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1">
              Billed to
            </div>
            <div className="font-semibold">{c?.name}</div>
            {c?.shop_name && <div className="text-slate-600">{c.shop_name}</div>}
            {c?.address && (
              <div className="text-slate-600 whitespace-pre-line leading-snug">{c.address}</div>
            )}
            {c?.mobile && (
              <div className="text-slate-600">
                📞 <span className="font-mono">{c.mobile}</span>
              </div>
            )}
            {c?.gstin && (
              <div>
                <b>GSTIN:</b> <span className="font-mono">{c.gstin}</span>
              </div>
            )}
          </div>
          <div className="p-4">
            <div className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1">
              Shipped to
            </div>
            <div className="font-semibold">{c?.name}</div>
            {c?.shop_name && <div className="text-slate-600">{c.shop_name}</div>}
            {c?.address && (
              <div className="text-slate-600 whitespace-pre-line leading-snug">{c.address}</div>
            )}
          </div>
          <div className="p-4 space-y-1">
            <MetaRow label="Invoice #" value={inv.invoice_no} mono />
            <MetaRow label="Invoice date" value={shortDate(inv.invoice_date)} />
            {inv.due_date && <MetaRow label="Due date" value={shortDate(inv.due_date)} />}
            <MetaRow
              label="Place of supply"
              value={`${biz.state ?? "-"}${biz.state_code ? ` (${biz.state_code})` : ""}`}
            />
            <MetaRow label="Supply type" value={isInter ? "Inter-state" : "Intra-state"} />
            <MetaRow label="Reverse charge" value="No" />
          </div>
        </div>

        {/* Items table */}
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border-collapse min-w-[720px]">
            <thead>
              <tr className="bg-slate-50 print:bg-slate-100 text-slate-700 border-b">
                <th className="text-left py-2 px-2 font-semibold w-8">#</th>
                <th className="text-left py-2 px-2 font-semibold">Item / Description</th>
                <th className="text-left py-2 px-2 font-semibold w-16">HSN</th>
                <th className="text-right py-2 px-2 font-semibold w-16">Qty</th>
                <th className="text-right py-2 px-2 font-semibold w-20">Rate</th>
                <th className="text-right py-2 px-2 font-semibold w-20">Taxable</th>
                {isInter ? (
                  <th className="text-right py-2 px-2 font-semibold w-24" colSpan={1}>
                    IGST
                  </th>
                ) : (
                  <>
                    <th className="text-right py-2 px-2 font-semibold w-24">CGST</th>
                    <th className="text-right py-2 px-2 font-semibold w-24">SGST</th>
                  </>
                )}
                <th className="text-right py-2 px-2 font-semibold w-24">Amount</th>
                {editing && <th className="w-6 no-print" />}
              </tr>
            </thead>
            <tbody>
              {(editing ? draft : data.items).map((it: any, i: number) => {
                if (editing && it._deleted) return null;
                const q = editing ? it.quantity : Number(it.quantity);
                const rate = editing ? it.rate : Number(it.rate);
                const disc = editing ? it.discount : Number(it.discount);
                const gstRate = editing ? it.gst_rate : Number(it.gst_rate);
                const taxable = q * rate - disc;
                const taxAmt = (taxable * gstRate) / 100;
                const half = taxAmt / 2;
                const amount = taxable + taxAmt;
                return (
                  <tr key={it.id} className="border-b align-top">
                    <td className="py-2 px-2 text-slate-500">{i + 1}</td>
                    <td className="py-2 px-2">
                      <div className="font-medium text-slate-900">{it.product_name}</div>
                      {disc > 0 && !editing && (
                        <div className="text-[10px] text-slate-500">Discount {inr(disc)}</div>
                      )}
                    </td>
                    <td className="py-2 px-2 font-mono text-[11px] text-slate-500">
                      {it.hsn ?? "0401"}
                    </td>
                    <td className="py-2 px-2 text-right font-mono">
                      {editing ? (
                        <Input
                          type="number"
                          value={q}
                          onChange={(e) =>
                            setDraft(
                              draft.map((r) =>
                                r.id === it.id
                                  ? { ...r, quantity: Number(e.target.value) }
                                  : r,
                              ),
                            )
                          }
                          className="h-8 w-16 text-right ml-auto"
                        />
                      ) : (
                        q
                      )}
                    </td>
                    <td className="py-2 px-2 text-right font-mono">
                      {editing ? (
                        <Input
                          type="number"
                          value={rate}
                          onChange={(e) =>
                            setDraft(
                              draft.map((r) =>
                                r.id === it.id ? { ...r, rate: Number(e.target.value) } : r,
                              ),
                            )
                          }
                          className="h-8 w-20 text-right ml-auto"
                        />
                      ) : (
                        inr(rate)
                      )}
                    </td>
                    <td className="py-2 px-2 text-right font-mono">{inr(taxable)}</td>
                    {isInter ? (
                      <td className="py-2 px-2 text-right font-mono">
                        <div>{inr(taxAmt)}</div>
                        <div className="text-[10px] text-slate-500">@{gstRate}%</div>
                      </td>
                    ) : (
                      <>
                        <td className="py-2 px-2 text-right font-mono">
                          <div>{inr(half)}</div>
                          <div className="text-[10px] text-slate-500">@{gstRate / 2}%</div>
                        </td>
                        <td className="py-2 px-2 text-right font-mono">
                          <div>{inr(half)}</div>
                          <div className="text-[10px] text-slate-500">@{gstRate / 2}%</div>
                        </td>
                      </>
                    )}
                    <td className="py-2 px-2 text-right font-mono font-semibold">
                      {inr(amount)}
                    </td>
                    {editing && (
                      <td className="py-2 px-1 text-right no-print">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() =>
                            setDraft(
                              draft.map((r) => (r.id === it.id ? { ...r, _deleted: true } : r)),
                            )
                          }
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
              <tr className="bg-slate-50 print:bg-slate-100 font-semibold">
                <td colSpan={3} className="py-2 px-2 text-right">
                  Totals
                </td>
                <td className="py-2 px-2 text-right font-mono">{totalQty}</td>
                <td />
                <td className="py-2 px-2 text-right font-mono">
                  {inr(editing ? liveTotals.subtotal : inv.subtotal)}
                </td>
                {isInter ? (
                  <td className="py-2 px-2 text-right font-mono">{inr(inv.igst)}</td>
                ) : (
                  <>
                    <td className="py-2 px-2 text-right font-mono">{inr(inv.cgst)}</td>
                    <td className="py-2 px-2 text-right font-mono">{inr(inv.sgst)}</td>
                  </>
                )}
                <td className="py-2 px-2 text-right font-mono">
                  {inr(editing ? liveTotals.total : inv.total)}
                </td>
                {editing && <td className="no-print" />}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bottom: bank + qr + totals */}
        <div className="grid grid-cols-1 sm:grid-cols-3 border-t">
          {/* Bank & payment */}
          <div className="p-4 border-b sm:border-b-0 sm:border-r text-[11px] space-y-2">
            <div>
              <div className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1">
                Payment details
              </div>
              {biz.bank_name && (
                <div>
                  <b>Bank:</b> {biz.bank_name}
                </div>
              )}
              {biz.bank_holder && (
                <div>
                  <b>A/c holder:</b> {biz.bank_holder}
                </div>
              )}
              {biz.bank_account && (
                <div>
                  <b>A/c no:</b> <span className="font-mono">{biz.bank_account}</span>
                </div>
              )}
              {biz.bank_ifsc && (
                <div>
                  <b>IFSC:</b> <span className="font-mono">{biz.bank_ifsc}</span>
                </div>
              )}
              {biz.bank_branch && (
                <div>
                  <b>Branch:</b> {biz.bank_branch}
                </div>
              )}
              {biz.upi_vpa && (
                <div>
                  <b>UPI:</b> <span className="font-mono">{biz.upi_vpa}</span>
                </div>
              )}
            </div>
          </div>

          {/* QR */}
          <div className="p-4 border-b sm:border-b-0 sm:border-r text-center">
            <img
              src={qrImage(qrPayload, 140)}
              alt="QR"
              className="mx-auto"
              width={140}
              height={140}
            />
            <div className="text-[10px] text-slate-500 mt-2">
              {biz.upi_vpa ? "Scan to pay via UPI" : "Scan to view invoice"}
            </div>
          </div>

          {/* Totals */}
          <div className="p-4 text-[12px]">
            {editing ? (
              <>
                <SummaryRow label="Subtotal (live)" value={inr(liveTotals.subtotal)} />
                <SummaryRow label="Tax (live)" value={inr(liveTotals.tax)} muted />
                <div className="border-t mt-2 pt-2 flex justify-between items-center bg-slate-50 -mx-4 px-4 py-2">
                  <span className="font-semibold">New total (on save)</span>
                  <span className="text-lg font-bold font-mono">{inr(liveTotals.total)}</span>
                </div>
                <div className="text-[10px] text-slate-500 pt-1">
                  Customer outstanding recalculates automatically when you save.
                </div>
              </>
            ) : (
              <>
                <SummaryRow label="Subtotal" value={inr(inv.subtotal)} />
                {Number(inv.discount) > 0 && (
                  <SummaryRow label="Discount" value={`− ${inr(inv.discount)}`} />
                )}
                {isInter ? (
                  <SummaryRow label="IGST" value={inr(inv.igst)} muted />
                ) : (
                  <>
                    <SummaryRow label="CGST" value={inr(inv.cgst)} muted />
                    <SummaryRow label="SGST" value={inr(inv.sgst)} muted />
                  </>
                )}
                <div className="border-t mt-2 pt-2 flex justify-between items-center bg-primary/5 print:bg-slate-100 -mx-4 px-4 py-2 rounded">
                  <span className="font-semibold">Grand Total</span>
                  <span className="text-lg font-bold font-mono">{inr(inv.total)}</span>
                </div>
                <SummaryRow label="Paid" value={inr(inv.paid)} muted />
                <div className="flex justify-between font-semibold pt-1">
                  <span>Balance due</span>
                  <span
                    className={`font-mono ${Number(inv.balance) > 0 ? "text-destructive" : "text-success"}`}
                  >
                    {inr(inv.balance)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Amount in words */}
        <div className="border-t p-4 text-[12px] bg-slate-50 print:bg-slate-100">
          <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mr-2">
            Amount in words:
          </span>
          <span className="font-semibold">
            {amountInWords(editing ? liveTotals.total : inv.total)}
          </span>
        </div>

        {/* Terms + signature */}
        <div className="grid grid-cols-1 sm:grid-cols-2 border-t">
          <div className="p-4 border-b sm:border-b-0 sm:border-r text-[11px]">
            <div className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1">
              Terms & conditions
            </div>
            <div className="text-slate-600 whitespace-pre-line leading-snug">
              {biz.terms ??
                "Payment due on delivery. Interest @18% p.a. on overdue amounts. Goods once sold will not be taken back."}
            </div>
            {inv.notes && (
              <div className="mt-3">
                <div className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1">
                  Notes
                </div>
                <div className="text-slate-600 whitespace-pre-line leading-snug">{inv.notes}</div>
              </div>
            )}
          </div>
          <div className="p-4 text-right text-[11px] flex flex-col justify-between">
            <div className="text-slate-500">Thank you for your business.</div>
            <div className="mt-10">
              <div className="border-t inline-block pt-1 px-8 text-slate-600">
                Authorised signatory
              </div>
              <div className="text-[10px] text-slate-500 mt-1">for {biz.name}</div>
            </div>
          </div>
        </div>
      </div>

      {/* =========== THERMAL 80mm RECEIPT (print-only) =========== */}
      <div className="invoice-thermal">
        <div className="t-center">
          <div className="t-title">{biz.name}</div>
          <div className="t-sm">{biz.address}</div>
          <div className="t-sm">GSTIN: {biz.gstin}</div>
          {biz.fssai && <div className="t-sm">FSSAI: {biz.fssai}</div>}
          <div className="t-sm">Ph: {biz.mobile}</div>
        </div>
        <div className="t-hr" />
        <div className="t-center t-bold">TAX INVOICE</div>
        <div className="t-hr" />
        <div className="t-row">
          <span>Inv #</span>
          <span>{inv.invoice_no}</span>
        </div>
        <div className="t-row">
          <span>Date</span>
          <span>{shortDate(inv.invoice_date)}</span>
        </div>
        <div className="t-row">
          <span>Bill to</span>
          <span>{c?.name}</span>
        </div>
        {c?.shop_name && (
          <div className="t-row">
            <span></span>
            <span>{c.shop_name}</span>
          </div>
        )}
        {c?.mobile && (
          <div className="t-row">
            <span>Ph</span>
            <span>{c.mobile}</span>
          </div>
        )}
        {c?.gstin && (
          <div className="t-row">
            <span>GSTIN</span>
            <span>{c.gstin}</span>
          </div>
        )}
        <div className="t-hr" />
        <div className="t-row t-bold">
          <span>Item</span>
          <span>Qty x Rate</span>
          <span>Amt</span>
        </div>
        <div className="t-hr" />
        {data.items.map((it: any) => {
          const taxable = Number(it.quantity) * Number(it.rate) - Number(it.discount);
          const amt = taxable + (taxable * Number(it.gst_rate)) / 100;
          return (
            <div key={it.id} className="t-item">
              <div className="t-item-name">{it.product_name}</div>
              <div className="t-row">
                <span>
                  GST {Number(it.gst_rate)}%
                </span>
                <span>
                  {Number(it.quantity)} x {inr(Number(it.rate))}
                </span>
                <span>{inr(amt)}</span>
              </div>
            </div>
          );
        })}
        <div className="t-hr" />
        <div className="t-row">
          <span>Subtotal</span>
          <span>{inr(inv.subtotal)}</span>
        </div>
        {!isInter ? (
          <>
            <div className="t-row">
              <span>CGST</span>
              <span>{inr(inv.cgst)}</span>
            </div>
            <div className="t-row">
              <span>SGST</span>
              <span>{inr(inv.sgst)}</span>
            </div>
          </>
        ) : (
          <div className="t-row">
            <span>IGST</span>
            <span>{inr(inv.igst)}</span>
          </div>
        )}
        <div className="t-hr" />
        <div className="t-row t-bold t-lg">
          <span>TOTAL</span>
          <span>{inr(inv.total)}</span>
        </div>
        <div className="t-row">
          <span>Paid</span>
          <span>{inr(inv.paid)}</span>
        </div>
        <div className="t-row t-bold">
          <span>Balance</span>
          <span>{inr(inv.balance)}</span>
        </div>
        <div className="t-hr" />
        <div className="t-sm">{amountInWords(inv.total)}</div>
        {biz.upi_vpa && (
          <>
            <div className="t-hr" />
            <div className="t-center">
              <img src={qrImage(qrPayload, 140)} alt="UPI QR" width={140} height={140} />
              <div className="t-sm">Pay UPI: {biz.upi_vpa}</div>
            </div>
          </>
        )}
        <div className="t-hr" />
        <div className="t-center t-sm">Thank you! Visit again.</div>
      </div>

      {/* Revision Dialog */}
      <ReviseInvoiceDialog
        invoiceId={id}
        invoiceNo={inv.invoice_no}
        items={data.items}
        open={reviseOpen}
        onOpenChange={setReviseOpen}
      />

      {/* Revision History */}
      <InvoiceRevisionHistory invoiceId={id} />
    </PageContainer>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className={mono ? "font-mono font-semibold" : "font-semibold"}>{value}</span>
    </div>
  );
}
function SummaryRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className={muted ? "text-slate-500" : ""}>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
