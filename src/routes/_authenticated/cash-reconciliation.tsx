import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { inr, isoDate, shortDate, genDocNo } from "@/lib/format";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Minus,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Truck,
  Wallet,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cash-reconciliation")({
  component: CashReconciliation,
});

type UnpaidInvoice = {
  id: string;
  invoice_no: string;
  customer_id: string;
  total: number;
  paid: number;
  balance: number;
  customer: { name: string; shop_name: string | null } | null;
};

type Allocation = {
  customer_id: string;
  customer_name: string;
  shop_name: string | null;
  invoice_id: string | null;
  invoice_no: string | null;
  amount: number;
};

function CashReconciliation() {
  const qc = useQueryClient();
  const [deliveryDate, setDeliveryDate] = useState(isoDate());
  const [driverName, setDriverName] = useState("");
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Fetch unpaid invoices for the selected date
  const { data: unpaidInvoices = [] } = useQuery({
    queryKey: ["unpaid-invoices", deliveryDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_no, customer_id, total, paid, balance, customer:customers(name, shop_name)")
        .eq("invoice_date", deliveryDate)
        .gt("balance", 0)
        .neq("status", "paid")
        .order("customer_id");
      if (error) throw error;
      return data as UnpaidInvoice[];
    },
  });

  const expectedTotal = useMemo(
    () => unpaidInvoices.reduce((s, i) => s + Number(i.balance), 0),
    [unpaidInvoices]
  );

  const collectedTotal = useMemo(
    () => allocations.reduce((s, a) => s + a.amount, 0),
    [allocations]
  );

  const mismatch = collectedTotal - expectedTotal;

  // Filter unpaid invoices by search
  const filteredInvoices = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return unpaidInvoices;
    return unpaidInvoices.filter(
      (i) =>
        i.customer?.name?.toLowerCase().includes(q) ||
        i.customer?.shop_name?.toLowerCase().includes(q) ||
        i.invoice_no.toLowerCase().includes(q)
    );
  }, [unpaidInvoices, search]);

  // Add allocation
  const addAllocation = (invoice: UnpaidInvoice) => {
    if (selectedInvoices.has(invoice.id)) return;
    setSelectedInvoices(new Set(selectedInvoices).add(invoice.id));
    setAllocations([
      ...allocations,
      {
        customer_id: invoice.customer_id,
        customer_name: invoice.customer?.name ?? "",
        shop_name: invoice.customer?.shop_name ?? null,
        invoice_id: invoice.id,
        invoice_no: invoice.invoice_no,
        amount: Number(invoice.balance),
      },
    ]);
  };

  // Remove allocation
  const removeAllocation = (invoiceId: string) => {
    setSelectedInvoices(new Set([...selectedInvoices].filter((id) => id !== invoiceId)));
    setAllocations(allocations.filter((a) => a.invoice_id !== invoiceId));
  };

  // Update allocation amount
  const updateAllocation = (invoiceId: string, amount: number) => {
    setAllocations(
      allocations.map((a) =>
        a.invoice_id === invoiceId ? { ...a, amount } : a
      )
    );
  };

  // Save reconciliation
  const handleReconcile = async () => {
    if (allocations.length === 0) return toast.error("Add at least one allocation");
    if (!driverName.trim()) return toast.error("Enter driver name");

    setSaving(true);
    try {
      // Create driver collection
      const collectionNo = genDocNo("COL");
      const { data: collection, error: collErr } = await supabase
        .from("driver_collections")
        .insert({
          collection_no: collectionNo,
          driver_name: driverName.trim(),
          delivery_date: deliveryDate,
          expected_amount: expectedTotal,
          collected_amount: collectedTotal,
          mismatch_amount: mismatch,
          status: mismatch === 0 ? "reconciled" : "investigating",
          reconciled_at: mismatch === 0 ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (collErr) throw collErr;

      // Insert allocations
      for (const alloc of allocations) {
        const { error: allocErr } = await supabase
          .from("collection_allocations")
          .insert({
            driver_collection_id: collection.id,
            customer_id: alloc.customer_id,
            invoice_id: alloc.invoice_id,
            allocated_amount: alloc.amount,
            payment_mode: "cash",
          });
        if (allocErr) throw allocErr;

        // Mark invoice as paid if allocation covers full balance
        if (alloc.invoice_id && alloc.amount >= Number(unpaidInvoices.find((i) => i.id === alloc.invoice_id)?.balance ?? 0)) {
          await supabase
            .from("invoices")
            .update({ status: "paid", paid: alloc.amount })
            .eq("id", alloc.invoice_id);
        }
      }

      toast.success(`Collection ${collectionNo} saved! ${mismatch === 0 ? "Balanced" : `Mismatch: ${inr(mismatch)}`}`);
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["unpaid-invoices"] });

      // Reset
      setAllocations([]);
      setSelectedInvoices(new Set());
      setDriverName("");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to reconcile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Cash Reconciliation"
        description="Match driver's collected cash to invoices. Auto-marks invoices as paid."
      />

      {/* Driver info */}
      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Driver Name *</Label>
            <Input
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              placeholder="e.g. Rajesh Kumar"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Delivery Date *</Label>
            <Input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Search Customer/Invoice</Label>
            <div className="relative mt-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find unpaid invoices..."
                className="pl-8"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Expected (Unpaid)
            </div>
            <Wallet className="size-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold font-mono">{inr(expectedTotal)}</div>
          <div className="text-xs text-muted-foreground mt-1">{unpaidInvoices.length} invoices</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Collected
            </div>
            <CheckCircle2 className="size-4 text-success" />
          </div>
          <div className="text-2xl font-bold font-mono text-success">{inr(collectedTotal)}</div>
          <div className="text-xs text-muted-foreground mt-1">{allocations.length} allocations</div>
        </Card>

        <Card className={cn("p-4", mismatch === 0 ? "bg-success/5" : mismatch > 0 ? "bg-primary/5" : "bg-destructive/5")}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {mismatch === 0 ? "Balanced" : mismatch > 0 ? "Extra Collected" : "Short"}
            </div>
            {mismatch === 0 ? (
              <CheckCircle2 className="size-4 text-success" />
            ) : (
              <AlertTriangle className={cn("size-4", mismatch > 0 ? "text-primary" : "text-destructive")} />
            )}
          </div>
          <div className={cn(
            "text-2xl font-bold font-mono",
            mismatch === 0 ? "text-success" : mismatch > 0 ? "text-primary" : "text-destructive"
          )}>
            {mismatch === 0 ? "✓ Balanced" : inr(Math.abs(mismatch))}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {mismatch > 0 ? "Driver collected more" : mismatch < 0 ? "Driver collected less" : "Perfect match"}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Unpaid invoices */}
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Receipt className="size-4" />
              Unpaid Invoices ({filteredInvoices.length})
            </h3>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {filteredInvoices.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No unpaid invoices for {shortDate(deliveryDate)}.
              </div>
            ) : (
              <div className="divide-y">
                {filteredInvoices.map((inv) => {
                  const isSelected = selectedInvoices.has(inv.id);
                  return (
                    <div
                      key={inv.id}
                      className={cn(
                        "p-3 flex items-center gap-3 hover:bg-muted/20 transition-colors",
                        isSelected && "bg-primary/5"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {inv.customer?.shop_name ?? inv.customer?.name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {inv.invoice_no} · {inr(inv.balance)}
                        </div>
                      </div>
                      {!isSelected ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addAllocation(inv)}
                          className="gap-1"
                        >
                          <Plus className="size-3" /> Add
                        </Button>
                      ) : (
                        <Badge variant="secondary">Added</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        {/* Right: Allocations */}
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b bg-primary/5">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <CheckCircle2 className="size-4 text-primary" />
              Collected Cash ({allocations.length})
            </h3>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {allocations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No allocations yet. Add invoices from the left panel.
              </div>
            ) : (
              <div className="divide-y">
                {allocations.map((alloc) => (
                  <div key={alloc.invoice_id} className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {alloc.shop_name ?? alloc.customer_name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {alloc.invoice_no}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-6"
                        onClick={() => updateAllocation(alloc.invoice_id!, Math.max(0, alloc.amount - 10))}
                      >
                        <Minus className="size-3" />
                      </Button>
                      <Input
                        type="number"
                        value={alloc.amount}
                        onChange={(e) => updateAllocation(alloc.invoice_id!, Number(e.target.value))}
                        className="h-7 w-20 text-right font-mono"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-6"
                        onClick={() => updateAllocation(alloc.invoice_id!, alloc.amount + 10)}
                      >
                        <Plus className="size-3" />
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive"
                      onClick={() => removeAllocation(alloc.invoice_id!)}
                    >
                      <XCircle className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Save button */}
          <div className="p-4 border-t bg-muted/30">
            <Button
              onClick={handleReconcile}
              disabled={saving || allocations.length === 0 || !driverName.trim()}
              className="w-full gap-2"
              size="lg"
            >
              {saving ? (
                <>
                  <RefreshCw className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Save Reconciliation ({inr(collectedTotal)})
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
