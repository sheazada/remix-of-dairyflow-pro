import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { inr, num, isoDate, shortDate } from "@/lib/format";
import { extractChallan, type ChallanExtraction } from "@/lib/challan-ocr.functions";
import { Upload, ScanLine, Trash2, Plus, Sparkles, CheckCircle2, AlertTriangle, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/purchases/challan")({
  component: ChallanOcr,
});

type ReviewLine = {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  ordered_qty?: number; // From demand consolidation
  rate: number;
  gst_rate: number;
  variance_type?: "ok" | "short" | "extra" | "damaged" | "rejected";
  variance_notes?: string;
};

type ConsolidationItem = {
  id: string;
  product_name: string;
  product_id: string | null;
  total_ordered_qty: number;
};

function ChallanOcr() {
  const nav = useNavigate();
  const runExtract = useServerFn(extractChallan);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extraction, setExtraction] = useState<ChallanExtraction | null>(null);

  // review-form state
  const [supplierId, setSupplierId] = useState("");
  const [billNo, setBillNo] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(isoDate());
  const [lines, setLines] = useState<ReviewLine[]>([]);

  const { data: suppliers } = useQuery({ queryKey: ["suppliers"], queryFn: async () => (await supabase.from("suppliers").select("*").order("name")).data ?? [] });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: async () => (await supabase.from("products").select("*").order("name")).data ?? [] });

  // Auto-fetch consolidation for the current date
  const { data: consolidations = [] } = useQuery({
    queryKey: ["demand-consolidations", purchaseDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_consolidations")
        .select("id, consolidation_no, consolidation_date, delivery_cycle_id, status")
        .eq("consolidation_date", purchaseDate)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Use first consolidation for this date (auto-link)
  const autoConsolidation = (consolidations ?? []).length > 0 ? (consolidations as any[])[0] : null;

  // Fetch consolidation items for auto-compare
  const { data: consolidationItems = [] } = useQuery({
    queryKey: ["consolidation-items", autoConsolidation?.id],
    queryFn: async () => {
      if (!autoConsolidation) return [];
      const { data, error } = await supabase
        .from("demand_consolidation_items")
        .select("id, product_name, product_id, total_ordered_qty")
        .eq("demand_consolidation_id", autoConsolidation.id);
      if (error) throw error;
      return (data ?? []) as ConsolidationItem[];
    },
    enabled: !!autoConsolidation,
  });

  const totals = useMemo(() => {
    let subtotal = 0, gst = 0;
    for (const l of lines) {
      const g = l.quantity * l.rate;
      subtotal += g;
      gst += (g * l.gst_rate) / 100;
    }
    return { subtotal, gst, total: subtotal + gst };
  }, [lines]);

  // Load items from consolidation (before OCR)
  const onFile = (f: File | null) => {
    setFile(f);
    setPreview(null);
    setDataUrl(null);
    setExtraction(null);
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) return toast.error("File too large (max 8 MB)");
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setDataUrl(url);
      if (f.type.startsWith("image/")) setPreview(url);
    };
    reader.readAsDataURL(f);
  };

  const matchProduct = (name: string) => {
    const n = name.toLowerCase();
    return (products ?? []).find((p) => p.name.toLowerCase() === n)
      ?? (products ?? []).find((p) => n.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(n));
  };

  const runOcr = async () => {
    if (!dataUrl) return toast.error("Upload a challan first");
    setExtracting(true);
    try {
      const result = await runExtract({ data: { fileDataUrl: dataUrl } });
      setExtraction(result);
      // Prefill review form
      if (result.challan_no) setBillNo(result.challan_no);
      if (result.challan_date) setPurchaseDate(result.challan_date);
      // Match supplier
      const sup = (suppliers ?? []).find((s) => result.supplier_name && s.name.toLowerCase().includes(result.supplier_name.toLowerCase().split(" ")[0]));
      if (sup) setSupplierId(sup.id);
      // Map items to products and compare with consolidation if selected
      const mapped: ReviewLine[] = result.items.map((it) => {
        const p = matchProduct(it.product_name);
        const consolidationItem = consolidationItems.find((ci) => 
          ci.product_name.toLowerCase() === (p?.name ?? it.product_name).toLowerCase()
        );
        const orderedQty = consolidationItem ? Number(consolidationItem.total_ordered_qty) : undefined;
        const receivedQty = it.quantity;
        const diff = receivedQty - (orderedQty ?? receivedQty);
        let varianceType: "ok" | "short" | "extra" | "damaged" | "rejected" | undefined;
        if (orderedQty !== undefined) {
          if (diff === 0) varianceType = "ok";
          else if (diff > 0) varianceType = "extra";
          else varianceType = "short";
        }
        return {
          id: crypto.randomUUID(),
          product_id: p?.id ?? "",
          product_name: p?.name ?? it.product_name,
          quantity: receivedQty,
          ordered_qty: orderedQty,
          rate: it.rate,
          gst_rate: it.gst_rate,
          variance_type: varianceType,
        };
      });
      setLines(mapped);
      toast.success(`Extracted ${result.items.length} line item${result.items.length === 1 ? "" : "s"}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Extraction failed");
    } finally {
      setExtracting(false);
    }
  };

  const setLine = (i: number, l: ReviewLine) => {
    const updated = lines.map((x, idx) => (idx === i ? l : x));
    // Auto-calculate variance when quantity changes
    if (l.ordered_qty !== undefined) {
      const diff = l.quantity - l.ordered_qty;
      updated[i].variance_type = diff === 0 ? "ok" : diff > 0 ? "extra" : "short";
    }
    setLines(updated);
  };
  const rmLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const addLine = () => setLines([...lines, { id: crypto.randomUUID(), product_id: "", product_name: "", quantity: 1, rate: 0, gst_rate: 5 }]);

  const approve = async () => {
    if (!supplierId) return toast.error("Choose supplier");
    if (!billNo) return toast.error("Bill / challan number required");
    if (lines.length === 0) return toast.error("Add at least one item");
    const unmapped = lines.filter((l) => !l.product_id);
    if (unmapped.length) return toast.error(`Match ${unmapped.length} unmapped product${unmapped.length === 1 ? "" : "s"} to catalog products`);

    setSaving(true);

    // Upload challan file to storage if provided
    let challanUrl: string | null = null;
    if (file) {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${supplierId}/${Date.now()}-${billNo.replace(/[^a-zA-Z0-9]+/g, "_")}.${ext}`;
      const up = await supabase.storage.from("challans").upload(path, file, { upsert: false, contentType: file.type });
      if (up.error) {
        setSaving(false);
        return toast.error(`Challan upload failed: ${up.error.message}`);
      }
      challanUrl = path;
    }

    const { data: p, error } = await supabase.from("purchases").insert({
      bill_no: billNo,
      supplier_id: supplierId,
      purchase_date: purchaseDate,
      delivery_cycle_id: autoConsolidation?.delivery_cycle_id ?? null,
      subtotal: totals.subtotal,
      gst: totals.gst,
      total: totals.total,
      challan_url: challanUrl,
      notes: extraction?.notes ?? null,
    }).select().single();

    if (error || !p) {
      setSaving(false);
      return toast.error(error?.message ?? "Failed to create purchase");
    }

    await supabase.from("purchase_items").insert(lines.map((l) => ({
      purchase_id: p.id,
      product_id: l.product_id,
      product_name: l.product_name,
      quantity: l.quantity,
      rate: l.rate,
      gst_rate: l.gst_rate,
      amount: l.quantity * l.rate,
      ordered_qty: l.ordered_qty,
      variance_type: l.variance_type,
      variance_qty: l.ordered_qty ? Math.abs(l.quantity - l.ordered_qty) : null,
      variance_notes: l.variance_notes,
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
        note: `Challan OCR · ${billNo}`,
      }));

    if (stockUpdates.length > 0) {
      await supabase.from("products").upsert(stockUpdates as never);
    }
    if (movements.length > 0) {
      await supabase.from("inventory_movements").insert(movements);
    }

    setSaving(false);
    toast.success("Purchase approved and stock updated");
    nav({ to: "/suppliers/$id", params: { id: supplierId } });
  };

  return (
    <PageContainer>
      <PageHeader
        title="Challan OCR"
        description="Upload a supplier challan, let AI extract the details, then review and approve to create the purchase."
      />

      <div className="space-y-6">
        {/* Upload section */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Upload className="size-4 text-primary" /> Upload challan
          </div>
          <label className="block border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition">
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
            {!file && (
              <>
                <Upload className="size-8 mx-auto text-muted-foreground mb-2" />
                <div className="text-sm font-medium">Click to select image or PDF</div>
                <div className="text-xs text-muted-foreground mt-1">JPG, PNG, HEIC, or PDF up to 8 MB</div>
              </>
            )}
            {file && (
              <div className="text-sm">
                <div className="font-medium truncate">{file.name}</div>
                <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</div>
              </div>
            )}
          </label>

          {preview && (
            <div className="rounded-lg overflow-hidden border">
              <img src={preview} alt="Challan preview" className="w-full max-h-80 object-contain bg-muted/20" />
            </div>
          )}
          {file && !preview && (
            <div className="rounded-lg border bg-muted/20 p-4 text-xs text-muted-foreground text-center">
              PDF selected — no preview. Extraction still works.
            </div>
          )}

          <Button className="w-full gap-2" onClick={runOcr} disabled={!dataUrl || extracting}>
            <Sparkles className="size-4" />
            {extracting ? "Extracting…" : extraction ? "Re-extract" : "Extract with AI"}
          </Button>

          {extraction && (
            <div className="text-xs rounded-lg bg-primary-soft/60 border border-primary/20 p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-primary">
                <ScanLine className="size-3.5" /> Extracted
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono">
                <span className="text-muted-foreground">Challan</span><span>{extraction.challan_no ?? "—"}</span>
                <span className="text-muted-foreground">Date</span><span>{extraction.challan_date ?? "—"}</span>
                <span className="text-muted-foreground">Supplier</span><span className="truncate">{extraction.supplier_name ?? "—"}</span>
                <span className="text-muted-foreground">Items</span><span>{extraction.items.length}</span>
                <span className="text-muted-foreground">Total</span><span>{inr(extraction.total)}</span>
              </div>
              {extraction.notes && <div className="text-muted-foreground pt-1 italic">{extraction.notes}</div>}
            </div>
          )}
        </Card>

        {/* Auto-linked consolidation info */}
        {autoConsolidation && consolidationItems.length > 0 && (
          <Card className="p-3 bg-primary/5 border-primary/20 flex items-center gap-3">
            <ShoppingCart className="size-4 text-primary shrink-0" />
            <div className="text-sm flex-1">
              <b>{autoConsolidation.consolidation_no}</b> linked automatically · {consolidationItems.length} item{consolidationItems.length === 1 ? "" : "s"} · ordered vs received will auto-compare
            </div>
          </Card>
        )}

        {/* Review form */}
        <Card className="p-5 space-y-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="size-4 text-success" /> Review & approve
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Supplier *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="Choose supplier" /></SelectTrigger>
                <SelectContent>
                  {(suppliers ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Challan / Bill No *</Label>
              <Input value={billNo} onChange={(e) => setBillNo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <Label>Line items</Label>
              <Button variant="outline" size="sm" onClick={addLine} className="gap-1"><Plus className="size-3" /> Add</Button>
            </div>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="text-left px-3 py-2 font-semibold">Product</th>
                    <th className="text-right px-3 py-2 font-semibold w-16">Ordered</th>
                    <th className="text-right px-3 py-2 font-semibold w-20">Received</th>
                    <th className="text-center px-3 py-2 font-semibold w-20">Variance</th>
                    <th className="text-right px-3 py-2 font-semibold w-24">Rate</th>
                    <th className="text-right px-3 py-2 font-semibold w-20">GST%</th>
                    <th className="text-right px-3 py-2 font-semibold w-28">Amount</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lines.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-muted-foreground text-xs">Extract a challan to populate items, or add manually.</td></tr>
                  )}
                  {lines.map((l, i) => (
                    <tr key={i} className={!l.product_id ? "bg-destructive/5" : ""}>
                      <td className="px-3 py-2 min-w-48">
                        <Select value={l.product_id} onValueChange={(v) => {
                          const p = (products ?? []).find((x) => x.id === v);
                          if (p) setLine(i, { ...l, product_id: v, product_name: p.name, gst_rate: l.gst_rate || Number(p.gst_rate) });
                        }}>
                          <SelectTrigger className="h-8"><SelectValue placeholder={l.product_name || "Select product"} /></SelectTrigger>
                          <SelectContent>{(products ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                        {!l.product_id && l.product_name && (
                          <div className="text-[10px] text-destructive mt-1">Extracted: “{l.product_name}” — pick a catalog product</div>
                        )}
                      </td>
                      <td className="px-3 py-2"><Input type="number" className="h-8 text-right" value={l.quantity} onChange={(e) => setLine(i, { ...l, quantity: Number(e.target.value) })} /></td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">{l.ordered_qty !== undefined ? num(l.ordered_qty, 1) : "—"}</td>
                      <td className="px-3 py-2 text-center">{l.variance_type && <Badge variant={l.variance_type === "ok" ? "outline" : l.variance_type === "short" ? "destructive" : l.variance_type === "extra" ? "default" : "secondary"}>{l.variance_type.toUpperCase()}</Badge>}</td>
                      <td className="px-3 py-2"><Input type="number" className="h-8 text-right" value={l.rate} onChange={(e) => setLine(i, { ...l, rate: Number(e.target.value) })} /></td>
                      <td className="px-3 py-2"><Input type="number" className="h-8 text-right" value={l.gst_rate} onChange={(e) => setLine(i, { ...l, gst_rate: Number(e.target.value) })} /></td>
                      <td className="px-3 py-2 text-right font-mono">{inr(l.quantity * l.rate * (1 + l.gst_rate / 100))}</td>
                      <td className="px-3 py-2"><Button variant="ghost" size="icon" onClick={() => rmLine(i)} aria-label="Remove line item"><Trash2 className="size-3.5" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="text-xs text-muted-foreground max-w-sm">
              Review carefully. On approve we create the purchase, add every line item, and increase stock for each matched product.
            </div>
            <div className="border rounded-xl p-4 bg-muted/30 space-y-1 text-sm w-full sm:w-64">
              <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">{inr(totals.subtotal)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>GST</span><span className="font-mono">{inr(totals.gst)}</span></div>
              <div className="border-t pt-1 mt-1 flex justify-between items-center">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-semibold font-mono">{inr(totals.total)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => nav({ to: "/purchases" })}>Cancel</Button>
            <Button onClick={approve} disabled={saving || lines.length === 0} className="gap-1.5">
              <CheckCircle2 className="size-4" />
              {saving ? "Approving…" : "Approve & create purchase"}
            </Button>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
