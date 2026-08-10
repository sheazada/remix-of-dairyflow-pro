import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { inr, shortDate, isoDate } from "@/lib/format";
import { useRealtimeSync } from "@/lib/realtime";
import { Plus, Search, ShoppingCart, Download, X } from "lucide-react";
import { InvoiceShareMenu } from "@/components/invoice-share-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { toCsv, downloadCsv } from "@/lib/bulk";

export const Route = createFileRoute("/_authenticated/invoices/")({
  component: Invoices,
});

type StatusFilter = "all" | "pending" | "partial" | "paid" | "void" | "overdue";

const daysBetween = (a: string | null | undefined, b = new Date()) => {
  if (!a) return 0;
  const ms = b.getTime() - new Date(a).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
};

function Invoices() {
  // Live-update when invoices or payments change (payments affect balance).
  useRealtimeSync({
    tableName: "invoices",
    invalidateKeys: [["invoices"]],
  });
  useRealtimeSync({
    tableName: "payments",
    invalidateKeys: [["invoices"]],
  });

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // CSV Export with GST breakdown
  const exportToCsv = () => {
    const rows = (data ?? []).map((inv) => ({
      "Invoice #": inv.invoice_no,
      "Customer": inv.customer?.shop_name ?? inv.customer?.name ?? "",
      "Date": shortDate(inv.invoice_date),
      "Subtotal": inv.subtotal,
      "CGST": inv.cgst,
      "SGST": inv.sgst,
      "IGST": inv.igst,
      "Total": inv.total,
      "Paid": inv.paid,
      "Balance": inv.balance,
      "Status": inv.status,
    }));
    const csv = toCsv(rows);
    downloadCsv(csv, `invoices_${isoDate()}.csv`);
    toast.success("Exported invoices to CSV with GST breakdown");
  };
  const { data } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () =>
      (
        await supabase
          .from("invoices")
          .select("*, customer:customers(name, shop_name, gstin)")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data ?? []).filter((i: any) => {
      if (s) {
        const hit =
          i.invoice_no.toLowerCase().includes(s) ||
          i.customer?.name?.toLowerCase().includes(s) ||
          i.customer?.shop_name?.toLowerCase().includes(s);
        if (!hit) return false;
      }
      if (from && i.invoice_date < from) return false;
      if (to && i.invoice_date > to) return false;
      if (status === "all") return true;
      if (status === "overdue") {
        return Number(i.balance) > 0 && i.status !== "void" && daysBetween(i.invoice_date) > 30;
      }
      return i.status === status;
    });
  }, [data, q, from, to, status]);

  const totals = useMemo(() => {
    let total = 0,
      balance = 0,
      paid = 0;
    for (const i of filtered) {
      total += Number(i.total);
      balance += Number(i.balance);
      paid += Number(i.paid ?? 0);
    }
    return { total, balance, paid, count: filtered.length };
  }, [filtered]);

  const counts = useMemo(() => {
    const c = { all: 0, pending: 0, partial: 0, paid: 0, void: 0, overdue: 0 };
    for (const i of data ?? []) {
      c.all++;
      const st = i.status as keyof typeof c;
      if (st in c) c[st]++;
      if (Number(i.balance) > 0 && i.status !== "void" && daysBetween(i.invoice_date) > 30)
        c.overdue++;
    }
    return c;
  }, [data]);

  const exportCsv = () => {
    const rows = [
      ["Invoice No", "Date", "Customer", "Shop", "Subtotal", "Tax", "Total", "Paid", "Balance", "Status"],
      ...filtered.map((i: any) => [
        i.invoice_no,
        i.invoice_date,
        i.customer?.name ?? "",
        i.customer?.shop_name ?? "",
        i.subtotal,
        Number(i.cgst) + Number(i.sgst) + Number(i.igst),
        i.total,
        i.paid ?? 0,
        i.balance,
        i.status,
      ]),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} invoices`);
  };

  const clearFilters = () => {
    setQ("");
    setStatus("all");
    setFrom("");
    setTo("");
  };

  const hasFilters = q || status !== "all" || from || to;

  return (
    <PageContainer>
      <PageHeader
        title="Invoices"
        description="GST-compliant invoices with CGST/SGST/IGST split."
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={exportCsv}>
              <Download className="size-4" /> Export
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link to="/orders/new">
                <ShoppingCart className="size-4" /> Add Sale
              </Link>
            </Button>
            <Button asChild size="sm" className="gap-1.5">
              <Link to="/invoices/new">
                <Plus className="size-4" /> Generate Invoice
              </Link>
            </Button>
          </div>
        }
      />

      {/* Totals bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Invoices" value={String(totals.count)} />
        <KpiCard label="Total" value={inr(totals.total)} />
        <KpiCard label="Paid" value={inr(totals.paid)} tone="success" />
        <KpiCard label="Outstanding" value={inr(totals.balance)} tone={totals.balance > 0 ? "danger" : "default"} />
      </div>

      <Card className="p-0 overflow-hidden">
        {/* Filter bar */}
        <div className="p-4 border-b space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["all", "All"],
                ["pending", "Pending"],
                ["partial", "Partial"],
                ["paid", "Paid"],
                ["overdue", "Overdue"],
                ["void", "Void"],
              ] as [StatusFilter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setStatus(key)}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-full border transition",
                  status === key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-muted",
                )}
              >
                {label}{" "}
                <span className="opacity-70 ml-0.5">({counts[key as keyof typeof counts]})</span>
              </button>
            ))}
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 h-7 text-xs ml-auto">
                <X className="size-3" /> Clear
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search invoice # or customer"
                className="pl-9 h-9"
              />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">From</span>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-36" />
              <span className="text-muted-foreground">to</span>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-36" />
            </div>
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-6 py-3 font-semibold">Invoice</th>
                <th className="text-left px-6 py-3 font-semibold">Customer</th>
                <th className="text-left px-6 py-3 font-semibold">Date</th>
                <th className="text-right px-6 py-3 font-semibold">Total</th>
                <th className="text-right px-6 py-3 font-semibold">Balance</th>
                <th className="text-left px-6 py-3 font-semibold">Status</th>
                <th className="text-right px-6 py-3 font-semibold">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    No invoices match. <Link to="/invoices/new" className="text-primary hover:underline">Generate one</Link>.
                  </td>
                </tr>
              )}
              {filtered.map((i: any) => {
                const age = daysBetween(i.invoice_date);
                const overdue = Number(i.balance) > 0 && i.status !== "void" && age > 30;
                return (
                  <tr key={i.id} className="hover:bg-muted/30">
                    <td className="px-6 py-3 font-mono text-xs">
                      <Link
                        to="/invoices/$id"
                        params={{ id: i.id }}
                        className="text-primary hover:underline"
                      >
                        {i.invoice_no}
                      </Link>
                    </td>
                    <td className="px-6 py-3">
                      <div className="font-medium">{i.customer?.name}</div>
                      <div className="text-xs text-muted-foreground">{i.customer?.shop_name}</div>
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">
                      <div>{shortDate(i.invoice_date)}</div>
                      {overdue && (
                        <div className="text-[10px] text-destructive font-medium">
                          {age}d overdue
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right font-mono font-semibold">{inr(i.total)}</td>
                    <td
                      className={`px-6 py-3 text-right font-mono ${
                        Number(i.balance) > 0 ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      {inr(i.balance)}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={i.status} />
                        {overdue && (
                          <Badge variant="destructive" className="text-[10px]">
                            Overdue
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <InvoiceShareMenu
                        invoice={i}
                        customer={i.customer}
                        label="Share"
                        itemsLoader={async () => {
                          const { data, error } = await supabase
                            .from("invoice_items")
                            .select("*")
                            .eq("invoice_id", i.id)
                            .order("created_at");
                          if (error) {
                            toast.error(error.message);
                            return [];
                          }
                          return data ?? [];
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No invoices match.
            </div>
          )}
          {filtered.map((i: any) => {
            const age = daysBetween(i.invoice_date);
            const overdue = Number(i.balance) > 0 && i.status !== "void" && age > 30;
            return (
              <div key={i.id} className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <Link
                    to="/invoices/$id"
                    params={{ id: i.id }}
                    className="font-mono text-xs text-primary"
                  >
                    {i.invoice_no}
                  </Link>
                  <StatusBadge status={i.status} />
                </div>
                <div className="font-medium text-sm">{i.customer?.name}</div>
                <div className="text-xs text-muted-foreground mb-2">
                  {i.customer?.shop_name} · {shortDate(i.invoice_date)}
                  {overdue && (
                    <span className="text-destructive ml-2 font-medium">{age}d overdue</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Total </span>
                    <span className="font-mono font-semibold">{inr(i.total)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Bal </span>
                    <span
                      className={cn(
                        "font-mono font-semibold",
                        Number(i.balance) > 0 && "text-destructive",
                      )}
                    >
                      {inr(i.balance)}
                    </span>
                  </div>
                  <InvoiceShareMenu
                    invoice={i}
                    customer={i.customer}
                    itemsLoader={async () => {
                      const { data } = await supabase
                        .from("invoice_items")
                        .select("*")
                        .eq("invoice_id", i.id)
                        .order("created_at");
                      return data ?? [];
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </PageContainer>
  );
}

function KpiCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "danger";
}) {
  return (
    <Card className="p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={cn(
          "text-lg font-semibold font-mono mt-0.5",
          tone === "success" && "text-emerald-600",
          tone === "danger" && "text-destructive",
        )}
      >
        {value}
      </div>
    </Card>
  );
}
