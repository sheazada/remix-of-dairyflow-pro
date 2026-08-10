import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { inr, shortDate, isoDate, num } from "@/lib/format";
import {
  Plus,
  Search,
  Download,
  Pencil,
  Trash2,
  Filter,
  Fuel,
  Wrench,
  Users,
  Package,
  Home,
  Zap,
  FileText,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { toCsv, downloadCsv } from "@/lib/bulk";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/expenses")({
  component: Expenses,
});

type Category = {
  id: string;
  name: string;
  color: string;
  icon: string | null;
};

type Expense = {
  id: string;
  category_id: string;
  amount: number;
  description: string | null;
  expense_date: string;
  payment_mode: string | null;
  reference_no: string | null;
  notes: string | null;
  created_at: string;
  category?: { name: string; color: string } | null;
};

// Map category icon names to lucide icons
const ICON_MAP: Record<string, any> = {
  fuel: Fuel,
  wrench: Wrench,
  users: Users,
  package: Package,
  home: Home,
  zap: Zap,
  "file-text": FileText,
};

function getCategoryIcon(iconName: string | null) {
  if (!iconName) return HelpCircle;
  return ICON_MAP[iconName] ?? HelpCircle;
}

function Expenses() {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "today" | "week" | "month">("all");

  const { data: categories = [] } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("expense_categories")
        .select("*")
        .order("name");
      return (data ?? []) as Category[];
    },
  });

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("*, category:expense_categories(name, color)")
        .order("expense_date", { ascending: false });
      return (data ?? []) as Expense[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return expenses.filter((e) => {
      if (q) {
        const hay = [
          e.description ?? "",
          e.notes ?? "",
          e.category?.name ?? "",
          e.payment_mode ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter === "all") return true;
      const today = isoDate();
      const weekAgo = isoDate(new Date(Date.now() - 7 * 86400000));
      const monthAgo = isoDate(new Date(Date.now() - 30 * 86400000));
      if (filter === "today") return e.expense_date === today;
      if (filter === "week") return e.expense_date >= weekAgo;
      if (filter === "month") return e.expense_date >= monthAgo;
      return true;
    });
  }, [expenses, search, filter]);

  const totals = useMemo(() => {
    const byCategory = new Map<string, { name: string; color: string; total: number }>();
    let total = 0;
    for (const e of filtered) {
      total += Number(e.amount);
      const cat = e.category;
      if (cat) {
        const cur = byCategory.get(cat.name) ?? { name: cat.name, color: cat.color, total: 0 };
        cur.total += Number(e.amount);
        byCategory.set(cat.name, cur);
      }
    }
    return {
      total,
      byCategory: Array.from(byCategory.values()).sort((a, b) => b.total - a.total),
      count: filtered.length,
    };
  }, [filtered]);

  const exportToCsv = () => {
    const rows = filtered.map((e) => ({
      "Date": e.expense_date,
      "Category": e.category?.name ?? "",
      "Amount": e.amount,
      "Mode": e.payment_mode ?? "",
      "Description": e.description ?? "",
      "Reference": e.reference_no ?? "",
      "Notes": e.notes ?? "",
    }));
    const csv = toCsv(rows);
    downloadCsv(csv, `expenses_${isoDate()}.csv`);
    toast.success("Exported expenses to CSV");
  };

  return (
    <PageContainer>
      <PageHeader
        title="Expenses"
        description="Track fuel, maintenance, salaries, packaging and other operational costs."
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={exportToCsv} className="gap-1.5">
              <Download className="size-4" /> Export CSV
            </Button>
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5" onClick={() => setEditing(null)}>
                  <Plus className="size-4" /> Add Expense
                </Button>
              </DialogTrigger>
              <ExpenseDialog
                categories={categories}
                expense={editing}
                onClose={() => {
                  setEditOpen(false);
                  setEditing(null);
                }}
                onSaved={() => {
                  setEditOpen(false);
                  setEditing(null);
                  qc.invalidateQueries({ queryKey: ["expenses"] });
                }}
              />
            </Dialog>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Total ({filter === "all" ? "all" : filter})
          </div>
          <div className="text-2xl font-bold font-mono mt-1 text-destructive">
            {inr(totals.total)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{totals.count} expenses</div>
        </Card>

        {totals.byCategory.slice(0, 3).map((c) => {
          const Icon = getCategoryIcon(
            categories.find((x) => x.name === c.name)?.icon ?? null
          );
          return (
            <Card key={c.name} className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate pr-2">
                  {c.name}
                </div>
                <Icon className="size-4 text-muted-foreground shrink-0" />
              </div>
              <div className="text-xl font-bold font-mono mt-1">{inr(c.total)}</div>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card className="p-3 mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search description, category, notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <div className="flex rounded-md border overflow-hidden text-xs">
          {(["all", "today", "week", "month"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 font-medium capitalize transition-colors",
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-card hover:bg-muted",
              )}
            >
              {f === "week" ? "7 days" : f === "month" ? "30 days" : f}
            </button>
          ))}
        </div>
      </Card>

      {/* Category breakdown */}
      {totals.byCategory.length > 0 && (
        <Card className="p-4 mb-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Category Breakdown
          </div>
          <div className="space-y-2">
            {totals.byCategory.map((c) => {
              const pct = totals.total > 0 ? (c.total / totals.total) * 100 : 0;
              return (
                <div key={c.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{c.name}</span>
                    <span className="font-mono">
                      {inr(c.total)} · {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: c.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Expenses list */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-3 font-semibold">Date</th>
                <th className="text-left px-4 py-3 font-semibold">Category</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Description</th>
                <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Mode</th>
                <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Reference</th>
                <th className="text-right px-4 py-3 font-semibold">Amount</th>
                <th className="text-right px-4 py-3 font-semibold w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    No expenses found. Click "Add Expense" to record one.
                  </td>
                </tr>
              )}
              {filtered.map((e) => {
                const Icon = getCategoryIcon(
                  categories.find((x) => x.id === e.category_id)?.icon ?? null
                );
                return (
                  <tr key={e.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {shortDate(e.expense_date)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className="gap-1 text-[10px]"
                        style={{
                          color: e.category?.color,
                          borderColor: `${e.category?.color}40`,
                          backgroundColor: `${e.category?.color}10`,
                        }}
                      >
                        <Icon className="size-3" />
                        {e.category?.name ?? "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell max-w-[300px] truncate">
                      {e.description ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs uppercase tracking-wider font-semibold hidden sm:table-cell">
                      {e.payment_mode ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground hidden lg:table-cell">
                      {e.reference_no ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-destructive">
                      {inr(e.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => {
                            setEditing(e);
                            setEditOpen(true);
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-destructive/5 font-semibold">
                  <td colSpan={5} className="px-4 py-3 text-right">
                    Total ({filtered.length})
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-lg text-destructive">
                    {inr(totals.total)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </PageContainer>
  );
}

function ExpenseDialog({
  categories,
  expense,
  onClose,
  onSaved,
}: {
  categories: Category[];
  expense: Expense | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    category_id: expense?.category_id ?? "",
    amount: String(expense?.amount ?? ""),
    description: expense?.description ?? "",
    expense_date: expense?.expense_date ?? isoDate(),
    payment_mode: expense?.payment_mode ?? "cash",
    reference_no: expense?.reference_no ?? "",
    notes: expense?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.category_id) return toast.error("Select a category");
    const amount = Number(form.amount);
    if (!amount || amount <= 0) return toast.error("Enter a valid amount");
    setSaving(true);

    const payload = {
      category_id: form.category_id,
      amount,
      description: form.description || null,
      expense_date: form.expense_date,
      payment_mode: form.payment_mode,
      reference_no: form.reference_no || null,
      notes: form.notes || null,
    };

    try {
      if (expense) {
        const { error } = await supabase.from("expenses").update(payload).eq("id", expense.id);
        if (error) throw error;
        toast.success("Expense updated");
      } else {
        const { error } = await supabase.from("expenses").insert(payload);
        if (error) throw error;
        toast.success("Expense added");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const cat = categories.find((c) => c.id === form.category_id);

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{expense ? "Edit Expense" : "Add Expense"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Category *</Label>
          <Select
            value={form.category_id}
            onValueChange={(v) => setForm({ ...form, category_id: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => {
                const Icon = getCategoryIcon(c.icon);
                return (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="inline-flex items-center gap-2">
                      <Icon className="size-4" style={{ color: c.color }} />
                      {c.name}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Amount (₹) *</Label>
            <Input
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
              className="text-lg font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input
              type="date"
              value={form.expense_date}
              onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="e.g. Fuel for delivery truck"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Payment Mode</Label>
            <Select
              value={form.payment_mode}
              onValueChange={(v) => setForm({ ...form, payment_mode: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="bank">Bank Transfer</SelectItem>
                <SelectItem value="credit">Credit / Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Reference No</Label>
            <Input
              value={form.reference_no}
              onChange={(e) => setForm({ ...form, reference_no: e.target.value })}
              placeholder="UPI ref / cheque no"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Optional additional details…"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : expense ? "Update" : "Save Expense"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
