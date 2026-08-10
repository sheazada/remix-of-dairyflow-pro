import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inr, shortDate, isoDate, genDocNo } from "@/lib/format";
import { toast } from "sonner";
import {
  Package,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  AlertCircle,
  Calendar,
  Filter,
  Edit,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  crateTypeSchema,
  crateTransactionSchema,
  crateBalanceSchema,
  safeParseList,
  type CrateType,
  type CrateTransaction,
  type CrateBalance,
} from "@/lib/crates-schema";
import { typed } from "@/lib/typed-db";


export const Route = createFileRoute("/_authenticated/crates")({
  component: CratesManagement,
});


function CratesManagement() {
  const [tab, setTab] = useState<"balance" | "transactions" | "setup">("balance");

  return (
    <PageContainer>
      <PageHeader
        title="Crate Tracking"
        description="Track crate issue, return, damage, and loss across retailers"
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="balance">
            <TrendingUp className="size-4" />
            Balance
          </TabsTrigger>
          <TabsTrigger value="transactions">
            <Package className="size-4" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="setup">
            <Edit className="size-4" />
            Crate Types
          </TabsTrigger>
        </TabsList>

        <TabsContent value="balance" className="mt-4">
          <CrateBalanceTab />
        </TabsContent>

        <TabsContent value="transactions" className="mt-4">
          <CrateTransactionsTab />
        </TabsContent>

        <TabsContent value="setup" className="mt-4">
          <CrateTypesTab />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

function CrateBalanceTab() {
  const [asOfDate, setAsOfDate] = useState(isoDate());
  const [selectedCrateType, setSelectedCrateType] = useState<string>("all");

  const { data: crateTypes } = useQuery({
    queryKey: ["crate-types"],
    queryFn: async () => {
      const { data, error } = await typed("crate_types")
        .selectAll()
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return safeParseList(crateTypeSchema, data, "crate_types");
    },
  });


  const { data: balances, isLoading } = useQuery({
    queryKey: ["crate-balance", asOfDate, selectedCrateType],
    queryFn: async () => {
      const crateTypeId = selectedCrateType === "all" ? undefined : selectedCrateType;
      const { data, error } = await supabase.rpc("get_crate_balance_as_of", {
        p_as_of_date: asOfDate,
        ...(crateTypeId ? { p_crate_type_id: crateTypeId } : {}),
      });
      if (error) throw error;
      return safeParseList(crateBalanceSchema, data, "crate_balance");
    },
  });

  const summary = {
    totalPositive: balances?.filter((b) => b.balance > 0).length ?? 0,
    totalNegative: balances?.filter((b) => b.balance < 0).length ?? 0,
    totalZero: balances?.filter((b) => b.balance === 0).length ?? 0,
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
            <Label>As of:</Label>
            <Input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="w-40"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <Label>Crate Type:</Label>
            <Select value={selectedCrateType} onValueChange={setSelectedCrateType}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {crateTypes?.map((ct) => (
                  <SelectItem key={ct.id} value={ct.id}>
                    {ct.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="ml-auto flex gap-2">
            <Badge variant="secondary">
              <TrendingUp className="size-3 mr-1" />
              {summary.totalPositive} with crates
            </Badge>
            <Badge variant="secondary">
              <TrendingDown className="size-3 mr-1" />
              {summary.totalNegative} returned excess
            </Badge>
          </div>
        </div>
      </Card>

      {/* Balance Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-3 font-semibold">Retailer</th>
                <th className="text-left px-4 py-3 font-semibold">Shop</th>
                <th className="text-left px-4 py-3 font-semibold">Crate Type</th>
                <th className="text-right px-4 py-3 font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              )}
              {!isLoading && balances?.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-muted-foreground">
                    No crate balances found
                  </td>
                </tr>
              )}
              {balances?.map((b, i) => (
                <tr key={`${b.retailer_id}-${b.crate_type_name}-${i}`} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{b.retailer_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{b.shop_name ?? "—"}</td>
                  <td className="px-4 py-3">{b.crate_type_name}</td>
                  <td className="px-4 py-3 text-right">
                    <Badge
                      variant={b.balance > 0 ? "destructive" : b.balance < 0 ? "default" : "secondary"}
                      className={cn(
                        "font-mono",
                        b.balance > 0 && "bg-red-100 text-red-800 hover:bg-red-100",
                        b.balance < 0 && "bg-blue-100 text-blue-800 hover:bg-blue-100"
                      )}
                    >
                      {b.balance > 0 && <ArrowUpRight className="size-3 mr-1" />}
                      {b.balance < 0 && <ArrowDownLeft className="size-3 mr-1" />}
                      {Math.abs(b.balance)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="text-xs text-muted-foreground">
        <p>
          <strong>Positive balance</strong> = Retailer owes crates (issued more than returned)
        </p>
        <p>
          <strong>Negative balance</strong> = Excess crates returned (returned more than issued)
        </p>
      </div>
    </div>
  );
}

function CrateTransactionsTab() {
  const qc = useQueryClient();
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [crateTypeFilter, setCrateTypeFilter] = useState<string>("all");
  const [retailerFilter, setRetailerFilter] = useState<string>("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const { data: crateTypes } = useQuery({
    queryKey: ["crate-types"],
    queryFn: async () => {
      const { data, error } = await typed("crate_types").selectAll().order("name");
      if (error) throw error;
      return safeParseList(crateTypeSchema, data, "crate_types");
    },
  });

  const { data: retailers } = useQuery({
    queryKey: ["retailers-for-crates"],
    queryFn: async () => {
      const { data, error } = await typed("customers")
        .raw<{ id: string; name: string; shop_name: string | null }>(
          "id, name, shop_name",
        )
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });


  const { data: transactions, isLoading } = useQuery({
    queryKey: ["crate-transactions", dateFilter, typeFilter, crateTypeFilter, retailerFilter],
    queryFn: async () => {
      let query = typed("crate_transactions")
        .raw<CrateTransaction>(
          "*, crate_type:crate_types(id, name), retailer:customers(id, name, shop_name)",
        )
        .order("transaction_date", { ascending: false });

      if (dateFilter !== "all") {
        query = query.eq("transaction_date", dateFilter);
      }
      if (typeFilter !== "all") {
        query = query.eq(
          "transaction_type",
          typeFilter as CrateTransaction["transaction_type"],
        );
      }
      if (crateTypeFilter !== "all") {
        query = query.eq("crate_type_id", crateTypeFilter);
      }
      if (retailerFilter !== "all") {
        query = query.eq("retailer_id", retailerFilter);
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;
      const parsed = safeParseList(crateTransactionSchema, data, "crate_transactions");
      // Filter out rows that lack the joined retailer/crate_type shape the UI relies on.
      return parsed.filter(
        (t): t is CrateTransaction & {
          crate_type: { id: string; name: string };
          retailer: { id: string; name: string; shop_name: string | null };
        } => Boolean(t.crate_type && t.retailer),
      );
    },
  });


  const summary = {
    totalIssue: transactions?.filter((t) => t.transaction_type === "issue").reduce((s, t) => s + t.quantity, 0) ?? 0,
    totalReturn: transactions?.filter((t) => t.transaction_type === "return").reduce((s, t) => s + t.quantity, 0) ?? 0,
    totalDamaged: transactions?.filter((t) => t.transaction_type === "damaged").reduce((s, t) => s + t.quantity, 0) ?? 0,
    totalLost: transactions?.filter((t) => t.transaction_type === "lost").reduce((s, t) => s + t.quantity, 0) ?? 0,
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;

    const { error } = await typed("crate_transactions").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete transaction");
      return;
    }
    toast.success("Transaction deleted");
    qc.invalidateQueries({ queryKey: ["crate-transactions"] });
    qc.invalidateQueries({ queryKey: ["crate-balance"] });
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Issued</div>
              <div className="text-2xl font-bold text-red-600">{summary.totalIssue}</div>
            </div>
            <ArrowUpRight className="size-8 text-red-600 opacity-20" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Returned</div>
              <div className="text-2xl font-bold text-blue-600">{summary.totalReturn}</div>
            </div>
            <ArrowDownLeft className="size-8 text-blue-600 opacity-20" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Damaged</div>
              <div className="text-2xl font-bold text-orange-600">{summary.totalDamaged}</div>
            </div>
            <AlertTriangle className="size-8 text-orange-600 opacity-20" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Lost</div>
              <div className="text-2xl font-bold text-gray-600">{summary.totalLost}</div>
            </div>
            <AlertCircle className="size-8 text-gray-600 opacity-20" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
            <Label>Date:</Label>
            <Input
              type="date"
              value={dateFilter === "all" ? "" : dateFilter}
              onChange={(e) => setDateFilter(e.target.value || "all")}
              className="w-40"
            />
            <Button variant="ghost" size="sm" onClick={() => setDateFilter("all")}>
              Clear
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <Label>Type:</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="issue">Issue</SelectItem>
                <SelectItem value="return">Return</SelectItem>
                <SelectItem value="damaged">Damaged</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label>Crate:</Label>
            <Select value={crateTypeFilter} onValueChange={setCrateTypeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {crateTypes?.map((ct) => (
                  <SelectItem key={ct.id} value={ct.id}>
                    {ct.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label>Retailer:</Label>
            <Select value={retailerFilter} onValueChange={setRetailerFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {retailers?.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.shop_name ?? r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button className="ml-auto" onClick={() => setAddDialogOpen(true)}>
            <Plus className="size-4 mr-2" />
            Add Transaction
          </Button>
        </div>
      </Card>

      {/* Transactions Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-3 font-semibold">Date</th>
                <th className="text-left px-4 py-3 font-semibold">Type</th>
                <th className="text-left px-4 py-3 font-semibold">Crate Type</th>
                <th className="text-left px-4 py-3 font-semibold">Retailer</th>
                <th className="text-right px-4 py-3 font-semibold">Quantity</th>
                <th className="text-left px-4 py-3 font-semibold">Notes</th>
                <th className="text-right px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              )}
              {!isLoading && transactions?.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    No transactions found
                  </td>
                </tr>
              )}
              {transactions?.map((t) => (
                <tr key={t.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3">{shortDate(t.transaction_date)}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        t.transaction_type === "issue"
                          ? "destructive"
                          : t.transaction_type === "return"
                          ? "default"
                          : t.transaction_type === "damaged"
                          ? "secondary"
                          : "outline"
                      }
                      className={cn(
                        "capitalize",
                        t.transaction_type === "issue" && "bg-red-100 text-red-800 hover:bg-red-100",
                        t.transaction_type === "return" && "bg-blue-100 text-blue-800 hover:bg-blue-100",
                        t.transaction_type === "damaged" && "bg-orange-100 text-orange-800 hover:bg-orange-100"
                      )}
                    >
                      {t.transaction_type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{t.crate_type?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    {t.retailer ? (
                      <div>
                        <div className="font-medium">{t.retailer.shop_name ?? t.retailer.name}</div>
                        {t.retailer.shop_name && (
                          <div className="text-xs text-muted-foreground">{t.retailer.name}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">{t.quantity}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.notes ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(t.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Transaction Dialog */}
      <AddCrateTransactionDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        crateTypes={crateTypes ?? []}
        retailers={retailers ?? []}
      />
    </div>
  );
}

function AddCrateTransactionDialog({
  open,
  onOpenChange,
  crateTypes,
  retailers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  crateTypes: CrateType[];
  retailers: { id: string; name: string; shop_name: string | null }[];
}) {
  const qc = useQueryClient();
  const [transactionType, setTransactionType] = useState<"issue" | "return" | "damaged" | "lost">("issue");
  const [crateTypeId, setCrateTypeId] = useState("");
  const [retailerId, setRetailerId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [transactionDate, setTransactionDate] = useState(isoDate());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!crateTypeId) {
      toast.error("Please select a crate type");
      return;
    }
    if (!retailerId) {
      toast.error("Please select a retailer");
      return;
    }
    if (!quantity || parseInt(quantity) <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }

    setSaving(true);
    const { data: user } = await supabase.auth.getUser();

    const { error } = await typed("crate_transactions").insert({
      crate_type_id: crateTypeId,
      retailer_id: retailerId,
      transaction_type: transactionType,
      quantity: parseInt(quantity),
      transaction_date: transactionDate,
      notes: notes || null,
      created_by: user?.user?.id ?? null,
    });


    setSaving(false);

    if (error) {
      toast.error("Failed to add transaction");
      console.error(error);
      return;
    }

    toast.success("Transaction added successfully");
    onOpenChange(false);

    // Reset form
    setTransactionType("issue");
    setCrateTypeId("");
    setRetailerId("");
    setQuantity("");
    setTransactionDate(isoDate());
    setNotes("");

    // Refresh data
    qc.invalidateQueries({ queryKey: ["crate-transactions"] });
    qc.invalidateQueries({ queryKey: ["crate-balance"] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Crate Transaction</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Transaction Type *</Label>
            <Select
              value={transactionType}
              onValueChange={(v) => setTransactionType(v as any)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="issue">Issue (to retailer)</SelectItem>
                <SelectItem value="return">Return (from retailer)</SelectItem>
                <SelectItem value="damaged">Damaged</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Crate Type *</Label>
            <Select value={crateTypeId} onValueChange={setCrateTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select crate type" />
              </SelectTrigger>
              <SelectContent>
                {crateTypes.map((ct) => (
                  <SelectItem key={ct.id} value={ct.id}>
                    {ct.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Retailer *</Label>
            <Select value={retailerId} onValueChange={setRetailerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select retailer" />
              </SelectTrigger>
              <SelectContent>
                {retailers.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.shop_name ?? r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Quantity *</Label>
            <Input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity"
            />
          </div>

          <div>
            <Label>Date *</Label>
            <Input
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
            />
          </div>

          <div>
            <Label>Notes</Label>
            <Input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Adding..." : "Add Transaction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CrateTypesTab() {
  const qc = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const { data: crateTypes, isLoading } = useQuery({
    queryKey: ["crate-types"],
    queryFn: async () => {
      const { data, error } = await typed("crate_types").selectAll().order("name");
      if (error) throw error;
      return safeParseList(crateTypeSchema, data, "crate_types");
    },
  });

  const handleToggleActive = async (id: string, isActive: boolean) => {
    const { error } = await typed("crate_types")
      .update({ is_active: !isActive })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update crate type");
      return;
    }

    toast.success(isActive ? "Crate type deactivated" : "Crate type activated");
    qc.invalidateQueries({ queryKey: ["crate-types"] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? This will delete all related transactions.")) return;

    const { error } = await typed("crate_types").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete crate type");
      return;
    }

    toast.success("Crate type deleted");
    qc.invalidateQueries({ queryKey: ["crate-types"] });
    qc.invalidateQueries({ queryKey: ["crate-transactions"] });
    qc.invalidateQueries({ queryKey: ["crate-balance"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="size-4 mr-2" />
          Add Crate Type
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-3 font-semibold">Name</th>
                <th className="text-left px-4 py-3 font-semibold">Description</th>
                <th className="text-center px-4 py-3 font-semibold">Status</th>
                <th className="text-right px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              )}
              {!isLoading && crateTypes?.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-muted-foreground">
                    No crate types found
                  </td>
                </tr>
              )}
              {crateTypes?.map((ct) => (
                <tr key={ct.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{ct.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{ct.description ?? "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={ct.is_active ? "default" : "secondary"}>
                      {ct.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(ct.id, ct.is_active)}
                    >
                      {ct.is_active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(ct.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <AddCrateTypeDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
    </div>
  );
}

function AddCrateTypeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Please enter a crate type name");
      return;
    }

    setSaving(true);
    const { error } = await typed("crate_types").insert({
      name: name.trim(),
      description: description.trim() || null,
      is_active: true,
    });


    setSaving(false);

    if (error) {
      if (error.code === "23505") {
        toast.error("A crate type with this name already exists");
      } else {
        toast.error("Failed to add crate type");
      }
      console.error(error);
      return;
    }

    toast.success("Crate type added successfully");
    onOpenChange(false);
    setName("");
    setDescription("");
    qc.invalidateQueries({ queryKey: ["crate-types"] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Crate Type</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Name *</Label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Milk Crate 20L"
            />
          </div>

          <div>
            <Label>Description</Label>
            <Input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Adding..." : "Add Crate Type"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
