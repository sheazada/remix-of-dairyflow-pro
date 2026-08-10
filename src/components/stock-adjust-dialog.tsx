import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

export type AdjustmentDirection = "in" | "out" | "damaged" | "expired";

export function QuickStockAdjust({
  productId,
  productName,
  currentStock,
  unit,
  open,
  onOpenChange,
}: {
  productId: string;
  productName: string;
  currentStock: number;
  unit: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [direction, setDirection] = useState<AdjustmentDirection>("in");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdjust = async () => {
    const qty = Number(quantity);
    if (!qty || qty <= 0) return toast.error("Enter a valid quantity");
    setSaving(true);

    const signedQty = direction === "in" ? qty : -qty;
    const newStock = Math.max(0, currentStock + signedQty);

    const { error: updateErr } = await supabase
      .from("products")
      .update({ current_stock: newStock, updated_at: new Date().toISOString() })
      .eq("id", productId);

    if (updateErr) {
      setSaving(false);
      return toast.error(updateErr.message);
    }

    const { error: moveErr } = await supabase.from("inventory_movements").insert({
      product_id: productId,
      movement_type: direction,
      quantity: qty,
      note: reason || `${direction === "in" ? "Stock added" : "Stock reduced"}`,
      created_at: new Date().toISOString(),
    });

    setSaving(false);
    if (moveErr) {
      toast.warning(`Stock updated but movement log failed: ${moveErr.message}`);
    } else {
      toast.success(
        `${direction === "in" ? "+" : "<span aria-hidden>−</span>"}${qty} ${unit} · New stock: ${newStock}`
      );
    }

    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["stock-valuation"] });
    qc.invalidateQueries({ queryKey: ["movements"] });

    // Reset
    setQuantity("");
    setReason("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {direction === "in" ? (
              <ArrowUpRight className="size-5 text-success" />
            ) : (
              <ArrowDownLeft className="size-5 text-destructive" />
            )}
            Quick Stock Adjust
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <div className="font-semibold">{productName}</div>
            <div className="text-xs text-muted-foreground">
              Current stock: <span className="font-mono font-semibold">{currentStock}</span> {unit}
            </div>
          </div>

          <div>
            <Label>Type</Label>
            <Select value={direction} onValueChange={(v) => setDirection(v as AdjustmentDirection)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in">📦 Stock In (restock, purchase)</SelectItem>
                <SelectItem value="out">📤 Stock Out (sale, transfer)</SelectItem>
                <SelectItem value="damaged">💔 Damaged</SelectItem>
                <SelectItem value="expired">📅 Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Quantity *</Label>
            <Input
              type="number"
              inputMode="numeric"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={`Enter ${unit}`}
              className="mt-1 text-lg font-mono"
              autoFocus
            />
            {quantity && (
              <div className="text-xs text-muted-foreground mt-1">
                New stock:{" "}
                <span
                  className={
                    Math.max(0, currentStock + (direction === "in" ? Number(quantity) : -Number(quantity))) === 0
                      ? "text-destructive font-semibold"
                      : "font-semibold"
                  }
                >
                  {Math.max(0, currentStock + (direction === "in" ? Number(quantity) : -Number(quantity)))}
                </span>{" "}
                {unit}
              </div>
            )}
          </div>

          <div>
            <Label>Reason (optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Received from supplier, damaged in transit…"
              rows={2}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAdjust}
            disabled={saving || !quantity || Number(quantity) <= 0}
            className={direction === "in" ? "bg-success hover:bg-success/90" : "bg-destructive hover:bg-destructive/90"}
          >
            {saving ? "Saving…" : direction === "in" ? `+${quantity || 0} ${unit}` : `<span aria-hidden>−</span>${quantity || 0} ${unit}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Small inline +/- buttons used in table rows
export function StockAdjustButtons({
  productId,
  productName,
  currentStock,
  unit,
}: {
  productId: string;
  productName: string;
  currentStock: number;
  unit: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="inline-flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-destructive hover:bg-destructive/10"
          aria-label="Reduce stock" title="Reduce stock"
          onClick={() => setOpen(true)}
        >
          <span aria-hidden>−</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-success hover:bg-success/10"
          aria-label="Add stock" title="Add stock"
          onClick={() => setOpen(true)}
        >
          <span aria-hidden>+</span>
        </Button>
      </div>
      <QuickStockAdjust
        productId={productId}
        productName={productName}
        currentStock={currentStock}
        unit={unit}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
