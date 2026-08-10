import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import { inr } from "@/lib/format";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Search, AlertTriangle, ArrowUpRight, ArrowDownLeft, Upload, Download } from "lucide-react";
import { StockAdjustButtons } from "@/components/stock-adjust-dialog";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/products")({
  component: Products,
});

function Products() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const qc = useQueryClient();

  const { data = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*").order("name");
      return data ?? [];
    },
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === data.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.map((p) => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const filtered = (data ?? []).filter((p) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return p.name.toLowerCase().includes(s) || (p.brand ?? "").toLowerCase().includes(s) || (p.barcode ?? "").includes(s);
  });

  return (
    <PageContainer>
      <PageHeader
        title="Products"
        description="Your SKU catalog — prices, GST rates and live stock levels."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="size-4" /> Add Product</Button></DialogTrigger>
            <ProductDialog onSaved={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["products"] }); }} />
          </Dialog>
        }
      />
      <Card className="p-0 overflow-hidden">
        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="p-3 bg-primary/5 border-b flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold">{selectedIds.size}</span>
              <span className="text-muted-foreground">selected</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </Button>
              <Button
                size="sm"
                onClick={() => setBulkEditOpen(true)}
                className="gap-1.5"
              >
                <ArrowUpRight className="size-4" />
                Edit Prices
              </Button>
            </div>
          </div>
        )}
        <div className="p-4 border-b flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products, brands, barcode" className="pl-9" />
          </div>
          <div className="text-xs text-muted-foreground">{filtered.length} product{filtered.length === 1 ? "" : "s"}</div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-6 py-3 font-semibold w-10">
                <Checkbox
                  checked={data.length > 0 && selectedIds.size === data.length}
                  onCheckedChange={toggleSelectAll}
                />
              </th>
              <th className="text-left px-6 py-3 font-semibold">Product</th>
              <th className="text-left px-6 py-3 font-semibold">Brand</th>
              <th className="text-left px-6 py-3 font-semibold">HSN</th>
              <th className="text-right px-6 py-3 font-semibold">MRP</th>
              <th className="text-right px-6 py-3 font-semibold">Selling</th>
              <th className="text-right px-6 py-3 font-semibold">GST %</th>
              <th className="text-center px-6 py-3 font-semibold">Stock</th>
              <th className="text-left px-6 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No products. Add one to get started.</td></tr>
            )}
              {filtered.map((p) => {
                const low = Number(p.current_stock) <= Number(p.min_stock);
                const isSelected = selectedIds.has(p.id);
                return (
                  <tr key={p.id} className={cn("hover:bg-muted/30", isSelected && "bg-primary/5")}>
                    <td className="px-6 py-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(p.id)}
                      />
                    </td>
                    <td className="px-6 py-3">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.category} · {p.unit}</div>
                    </td>
                  <td className="px-6 py-3 text-muted-foreground">{p.brand ?? "—"}</td>
                  <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{p.hsn ?? "—"}</td>
                  <td className="px-6 py-3 text-right font-mono">{inr(p.mrp)}</td>
                  <td className="px-6 py-3 text-right font-mono font-semibold">{inr(p.selling_price)}</td>
                  <td className="px-6 py-3 text-right font-mono">{Number(p.gst_rate)}%</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <div className="text-right">
                        <span className={low ? "text-destructive font-semibold" : ""}>
                          {low && <AlertTriangle className="size-3 inline mr-1" />}
                          {Number(p.current_stock)}
                        </span>
                        <span className="text-xs text-muted-foreground"> / {Number(p.min_stock)}</span>
                      </div>
                      <StockAdjustButtons
                        productId={p.id}
                        productName={p.name}
                        currentStock={Number(p.current_stock)}
                        unit={p.unit}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-3"><StatusBadge status={p.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Bulk Price Edit Dialog */}
      {bulkEditOpen && (
        <BulkPriceEditDialog
          products={filtered.filter((p) => selectedIds.has(p.id))}
          onClose={() => setBulkEditOpen(false)}
          onSaved={() => {
            setBulkEditOpen(false);
            setSelectedIds(new Set());
          }}
        />
      )}
    </PageContainer>
  );
}

function ProductDialog({ onSaved }: { onSaved: () => void }) {
  const [f, setF] = useState({
    name: "", brand: "", category: "Dairy", unit: "pcs", hsn: "0401", barcode: "",
    mrp: "0", selling_price: "0", purchase_price: "0", gst_rate: "5",
    current_stock: "0", min_stock: "0",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!f.name) return toast.error("Name required");
    setSaving(true);
    const { data: prod, error } = await supabase.from("products").insert({
      name: f.name, brand: f.brand || null, category: f.category, unit: f.unit,
      hsn: f.hsn || null, barcode: f.barcode || null,
      mrp: Number(f.mrp), selling_price: Number(f.selling_price), purchase_price: Number(f.purchase_price),
      gst_rate: Number(f.gst_rate), current_stock: Number(f.current_stock), min_stock: Number(f.min_stock),
    }).select().single();
    if (!error && prod && Number(f.current_stock) > 0) {
      await supabase.from("inventory_movements").insert({
        product_id: prod.id, movement_type: "in", quantity: Number(f.current_stock), note: "Opening stock",
      });
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Product added");
    onSaved();
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Add Product</DialogTitle></DialogHeader>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-1.5"><Label>Name *</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Brand</Label><Input value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} placeholder="Amul, Mother Dairy…" /></div>
        <div className="space-y-1.5"><Label>Category</Label><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Unit</Label><Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="L, kg, pcs" /></div>
        <div className="space-y-1.5"><Label>HSN</Label><Input value={f.hsn} onChange={(e) => setF({ ...f, hsn: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Barcode</Label><Input value={f.barcode} onChange={(e) => setF({ ...f, barcode: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>GST %</Label><Input type="number" value={f.gst_rate} onChange={(e) => setF({ ...f, gst_rate: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>MRP (₹)</Label><Input type="number" value={f.mrp} onChange={(e) => setF({ ...f, mrp: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Selling (₹)</Label><Input type="number" value={f.selling_price} onChange={(e) => setF({ ...f, selling_price: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Purchase (₹)</Label><Input type="number" value={f.purchase_price} onChange={(e) => setF({ ...f, purchase_price: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Opening stock</Label><Input type="number" value={f.current_stock} onChange={(e) => setF({ ...f, current_stock: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Min stock</Label><Input type="number" value={f.min_stock} onChange={(e) => setF({ ...f, min_stock: e.target.value })} /></div>
      </div>
      <DialogFooter><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save product"}</Button></DialogFooter>
    </DialogContent>
  );
}

function BulkPriceEditDialog({
  products,
  onClose,
  onSaved,
}: {
  products: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [prices, setPrices] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    products.forEach((p) => {
      init[p.id] = String(p.selling_price);
    });
    return init;
  });
  const [mrps, setMrps] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    products.forEach((p) => {
      init[p.id] = String(p.mrp);
    });
    return init;
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    let updated = 0;
    for (const p of products) {
      try {
        const { error } = await supabase
          .from("products")
          .update({
            selling_price: Number(prices[p.id]),
            mrp: Number(mrps[p.id]),
          })
          .eq("id", p.id);
        if (error) throw error;
        updated++;
      } catch (e: any) {
        console.error(`Failed to update ${p.name}:`, e);
      }
    }
    toast.success(`Updated prices for ${updated} product${updated !== 1 ? "s" : ""}`);
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bulk Price Edit</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Edit selling prices for {products.length} selected product{products.length !== 1 ? "s" : ""}.
          </p>
        </DialogHeader>

        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-2 font-semibold">Product</th>
                <th className="text-right px-4 py-2 font-semibold">Current Price</th>
                <th className="text-right px-4 py-2 font-semibold">New Selling Price</th>
                <th className="text-right px-4 py-2 font-semibold">New MRP</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 font-medium truncate max-w-[200px]">{p.name}</td>
                  <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                    {inr(p.selling_price)}
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      type="number"
                      value={prices[p.id]}
                      onChange={(e) => setPrices({ ...prices, [p.id]: e.target.value })}
                      className="h-8 w-24 text-right ml-auto"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      type="number"
                      value={mrps[p.id]}
                      onChange={(e) => setMrps({ ...mrps, [p.id]: e.target.value })}
                      className="h-8 w-24 text-right ml-auto"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : `Update ${products.length} Price${products.length !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
