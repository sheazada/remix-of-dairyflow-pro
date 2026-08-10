import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { reviseInvoice } from "@/lib/invoice-revision.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, History, Minus, Plus } from "lucide-react";

export type RevisionItem = {
  product_id: string;
  product_name: string;
  original_qty: number;
  revised_qty: number;
  rate: number;
  original_amount: number;
  revised_amount: number;
};

export function ReviseInvoiceDialog({
  invoiceId,
  invoiceNo,
  items,
  open,
  onOpenChange,
}: {
  invoiceId: string;
  invoiceNo: string;
  items: {
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    rate: number;
    amount: number;
  }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const callReviseInvoice = useServerFn(reviseInvoice);
  const [revisionItems, setRevisionItems] = useState<RevisionItem[]>(
    items.map((i) => ({
      product_id: i.product_id,
      product_name: i.product_name,
      original_qty: Number(i.quantity),
      revised_qty: Number(i.quantity),
      rate: Number(i.rate),
      original_amount: Number(i.amount),
      revised_amount: Number(i.amount),
    }))
  );
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const updateItem = (index: number, field: keyof RevisionItem, value: string | number) => {
    const updated = [...revisionItems];
    const item = updated[index];
    
    if (field === "revised_qty") {
      const qty = Math.max(0, Number(value) || 0);
      item.revised_qty = qty;
      item.revised_amount = qty * item.rate;
    }
    
    updated[index] = item;
    setRevisionItems(updated);
  };

  const originalTotal = revisionItems.reduce((s, i) => s + i.original_amount, 0);
  const revisedTotal = revisionItems.reduce((s, i) => s + i.revised_amount, 0);
  const difference = revisedTotal - originalTotal;

  const handleRevise = async () => {
    if (!reason.trim()) return toast.error("Please enter a reason for revision");
    
    const hasChanges = revisionItems.some(
      (i) => i.revised_qty !== i.original_qty
    );
    if (!hasChanges) return toast.error("No changes to save");

    setSaving(true);

    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      setSaving(false);
      return toast.error("Not authenticated");
    }

    const revisedItemsPayload = revisionItems
      .filter((i) => i.revised_qty !== i.original_qty)
      .map((i) => ({
        product_id: i.product_id,
        qty: i.revised_qty,
        rate: i.rate,
        amount: i.revised_amount,
      }));

    let result: { revised_invoice_no?: string };
    try {
      result = await callReviseInvoice({
        data: {
          invoiceId,
          reason: reason.trim(),
          items: revisedItemsPayload,
        },
      });
    } catch (err) {
      setSaving(false);
      return toast.error((err as Error)?.message ?? "Could not revise this invoice.");
    }

    setSaving(false);

    toast.success(`Invoice revised! New invoice: ${result.revised_invoice_no ?? ""}`);
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
    qc.invalidateQueries({ queryKey: ["invoice-revisions", invoiceId] });
    
    // Reset
    setReason("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-5 text-primary" />
            Revise Invoice {invoiceNo}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Reason */}
          <div>
            <Label>Reason for Revision *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Retailer refused 2L milk, damaged during delivery..."
              rows={2}
              className="mt-1"
            />
          </div>

          {/* Items table */}
          <div>
            <Label>Adjust Quantities</Label>
            <div className="mt-2 border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="text-left px-3 py-2 font-semibold">Product</th>
                    <th className="text-center px-3 py-2 font-semibold">Original</th>
                    <th className="text-center px-3 py-2 font-semibold">Revised</th>
                    <th className="text-right px-3 py-2 font-semibold">Difference</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {revisionItems.map((item, idx) => {
                    const diff = item.revised_qty - item.original_qty;
                    return (
                      <tr key={idx} className="hover:bg-muted/20">
                        <td className="px-3 py-2">
                          <div className="font-medium">{item.product_name}</div>
                          <div className="text-xs text-muted-foreground">
                            ₹{item.rate}/unit
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Badge variant="outline" className="font-mono">
                            {item.original_qty}
                          </Badge>
                          <div className="text-xs text-muted-foreground mt-1">
                            ₹{item.original_amount}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-6"
                              onClick={() => updateItem(idx, "revised_qty", Math.max(0, item.revised_qty - 1))}
                              aria-label={`Decrease ${item.product_name} quantity`}
                            >
                              <Minus className="size-3" aria-hidden />
                            </Button>
                            <Input
                              type="number"
                              min="0"
                              value={item.revised_qty}
                              onChange={(e) => updateItem(idx, "revised_qty", e.target.value)}
                              className="h-7 w-16 text-center font-mono"
                              aria-label={`Revised quantity for ${item.product_name}`}
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-6"
                              onClick={() => updateItem(idx, "revised_qty", item.revised_qty + 1)}
                              aria-label={`Increase ${item.product_name} quantity`}
                            >
                              <Plus className="size-3" aria-hidden />
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 text-right">
                            ₹{item.revised_amount}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {diff === 0 ? (
                            <span className="text-muted-foreground text-xs">—</span>
                          ) : diff > 0 ? (
                            <div className="flex items-center gap-1 justify-end text-success">
                              <ArrowUpRight className="size-3" />
                              <span className="font-mono text-xs">+{diff}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 justify-end text-destructive">
                              <ArrowDownLeft className="size-3" />
                              <span className="font-mono text-xs">{diff}</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals summary */}
          <div className="grid grid-cols-3 gap-3 p-4 bg-muted/30 rounded-md">
            <div>
              <div className="text-xs text-muted-foreground">Original Total</div>
              <div className="font-mono font-semibold">₹{originalTotal.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Revised Total</div>
              <div className="font-mono font-semibold">₹{revisedTotal.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Difference</div>
              <div className={`font-mono font-semibold ${difference > 0 ? "text-success" : difference < 0 ? "text-destructive" : ""}`}>
                {difference > 0 ? "+" : ""}₹{difference.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleRevise}
            disabled={saving || !reason.trim() || revisedTotal === originalTotal}
          >
            {saving ? "Revising..." : "Revise Invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
