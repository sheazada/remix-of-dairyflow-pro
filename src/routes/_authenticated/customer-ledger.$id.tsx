import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { inr, shortDate, isoDate } from "@/lib/format";
import { getBusiness } from "@/lib/business";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Calendar,
  ChevronLeft,
  Download,
  Filter,
  Printer,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  Wallet,
  FileText,
  CreditCard,
  BanknoteIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/customer-ledger/$id")({
  component: CustomerLedger,
});

type InvoiceRow = {
  id: string;
  invoice_no: string;
  invoice_date: string;
  total: number;
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  discount: number;
  paid: number;
  balance: number;
  status: string;
  due_date: string | null;
  notes: string | null;
};

type PaymentRow = {
  id: string;
  payment_no: string;
  payment_date: string;
  amount: number;
  mode: string;
  reference: string | null;
  notes: string | null;
  invoice_id: string | null;
};

type LedgerEntry = {
  date: string;
  type: "opening" | "invoice" | "payment";
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  details?: {
    items?: number;
    gstBreakup?: { cgst: number; sgst: number; igst: number };
    subtotal?: number;
    mode?: string;
    status?: string;
  };
};

function CustomerLedger() {
  const { id } = Route.useParams();
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return isoDate(d);
  });
  const [toDate, setToDate] = useState(isoDate);
  const [typeFilter, setTypeFilter] = useState<"all" | "invoice" | "payment">("all");
  const [search, setSearch] = useState("");

  // Fetch customer
  const { data: customer } = useQuery({
    queryKey: ["customer-ledger-info", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, shop_name, mobile, email, gstin, address, credit_limit, outstanding, status")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch invoices
  const { data: invoices = [] } = useQuery({
    queryKey: ["customer-invoices", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("customer_id", id)
        .neq("status", "void")
        .order("invoice_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as InvoiceRow[];
    },
  });

  // Fetch payments
  const { data: payments = [] } = useQuery({
    queryKey: ["customer-payments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("customer_id", id)
        .order("payment_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PaymentRow[];
    },
  });

  // Build ledger entries
  const allEntries = useMemo<LedgerEntry[]>(() => {
    const entries: LedgerEntry[] = [];

    // Opening balance entry
    const openingBal = Number(customer?.outstanding ?? 0);
    // Find earliest transaction date
    const earliestInv = invoices.length > 0 ? invoices[0].invoice_date : null;
    const earliestPay = payments.length > 0 ? payments[0].payment_date : null;
    let earliestDate: string;
    if (earliestInv && earliestPay) {
      earliestDate = earliestInv < earliestPay ? earliestInv : earliestPay;
    } else {
      earliestDate = earliestInv ?? earliestPay ?? isoDate();
    }

    if (openingBal !== 0) {
      entries.push({
        date: earliestDate,
        type: "opening",
        reference: "OPEN",
        description: "Opening Balance",
        debit: openingBal > 0 ? openingBal : 0,
        credit: openingBal < 0 ? Math.abs(openingBal) : 0,
        balance: openingBal,
        details: { status: "carried-forward" },
      });
    }

    // Build a running total from all transactions
    let runningBalance = 0;

    // Add all invoices
    for (const inv of invoices) {
      runningBalance += Number(inv.total);
      entries.push({
        date: inv.invoice_date,
        type: "invoice",
        reference: inv.invoice_no,
        description: `Invoice ${inv.invoice_no}`,
        debit: Number(inv.total),
        credit: 0,
        balance: runningBalance,
        details: {
          subtotal: Number(inv.subtotal),
          gstBreakup: {
            cgst: Number(inv.cgst),
            sgst: Number(inv.sgst),
            igst: Number(inv.igst),
          },
          status: inv.status,
        },
      });
    }

    // Add all payments — need to merge with invoices by date for correct ordering
    for (const pay of payments) {
      runningBalance -= Number(pay.amount);
      entries.push({
        date: pay.payment_date,
        type: "payment",
        reference: pay.payment_no,
        description: `Payment via ${pay.mode.toUpperCase()}${pay.reference ? ` · Ref ${pay.reference}` : ""}`,
        debit: 0,
        credit: Number(pay.amount),
        balance: runningBalance,
        details: {
          mode: pay.mode,
        },
      });
    }

    // Sort by date, then by type (opening first, then invoices, then payments on same day)
    const typeOrder = { opening: 0, invoice: 1, payment: 2 };
    entries.sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return typeOrder[a.type] - typeOrder[b.type];
    });

    // Recalculate running balance after sorting
    let bal = 0;
    for (const entry of entries) {
      bal = bal + entry.debit - entry.credit;
      entry.balance = bal;
    }

    return entries;
  }, [customer, invoices, payments]);

  // Filter entries by date range
  const filteredEntries = useMemo(() => {
    return allEntries.filter((e) => {
      if (e.date < fromDate || e.date > toDate) return false;
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !e.reference.toLowerCase().includes(q) &&
          !e.description.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [allEntries, fromDate, toDate, typeFilter, search]);

  // Compute period summary
  const summary = useMemo(() => {
    // Opening balance before the period
    const entriesBeforePeriod = allEntries.filter((e) => e.date < fromDate);
    const openingBalance =
      entriesBeforePeriod.length > 0
        ? entriesBeforePeriod[entriesBeforePeriod.length - 1].balance
        : 0;

    const totalDebit = filteredEntries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = filteredEntries.reduce((s, e) => s + e.credit, 0);
    const closingBalance = openingBalance + totalDebit - totalCredit;

    return { openingBalance, totalDebit, totalCredit, closingBalance };
  }, [allEntries, filteredEntries, fromDate]);

  // Export CSV
  const exportCsv = () => {
    if (!customer) return;
    const rows: string[][] = [];
    rows.push([`Statement of Account — ${customer.shop_name || customer.name}`]);
    rows.push([`Mobile: ${customer.mobile ?? "—"}`, `GSTIN: ${customer.gstin ?? "—"}`]);
    rows.push([`Period: ${shortDate(fromDate)} to ${shortDate(toDate)}`]);
    rows.push([]);
    rows.push(["Date", "Type", "Reference", "Description", "Debit", "Credit", "Balance"]);

    // Opening balance
    if (summary.openingBalance !== 0) {
      rows.push([
        shortDate(fromDate),
        "Opening",
        "",
        "Balance brought forward",
        summary.openingBalance > 0 ? summary.openingBalance.toFixed(2) : "",
        summary.openingBalance < 0 ? Math.abs(summary.openingBalance).toFixed(2) : "",
        summary.openingBalance.toFixed(2),
      ]);
    }

    for (const e of filteredEntries) {
      if (e.type === "opening") continue;
      rows.push([
        shortDate(e.date),
        e.type === "invoice" ? "Invoice" : "Payment",
        e.reference,
        e.description,
        e.debit > 0 ? e.debit.toFixed(2) : "",
        e.credit > 0 ? e.credit.toFixed(2) : "",
        e.balance.toFixed(2),
      ]);
    }

    rows.push([]);
    rows.push(["", "", "", "TOTAL", summary.totalDebit.toFixed(2), summary.totalCredit.toFixed(2), summary.closingBalance.toFixed(2)]);

    const csv = rows
      .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger-${customer.name.replace(/\s+/g, "-").toLowerCase()}-${fromDate}-to-${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!customer) {
    return (
      <PageContainer>
        <div className="p-10 text-center text-muted-foreground">Loading customer…</div>
      </PageContainer>
    );
  }

  const biz = getBusiness();

  return (
    <PageContainer>
      <PageHeader
        title="Customer Ledger"
        description={`Statement of account for ${customer.shop_name || customer.name}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 no-print">
              <Printer className="size-4" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5 no-print">
              <Download className="size-4" /> CSV
            </Button>
            <Button asChild variant="outline" size="sm" className="no-print">
              <Link to="/customers">
                <ChevronLeft className="size-4" /> Back
              </Link>
            </Button>
          </div>
        }
      />

      {/* Customer info card */}
      <Card className="p-4 mb-4 no-print">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="size-12 rounded-full bg-primary/10 text-primary grid place-items-center text-lg font-bold shrink-0">
              {(customer.shop_name || customer.name)?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-lg font-semibold">{customer.shop_name || customer.name}</div>
              <div className="text-sm text-muted-foreground">{customer.name}</div>
              <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                {customer.mobile && <span>📞 {customer.mobile}</span>}
                {customer.email && <span>✉️ {customer.email}</span>}
                {customer.gstin && <span>GSTIN: {customer.gstin}</span>}
                {customer.address && <span>📍 {customer.address}</span>}
              </div>
            </div>
          </div>
          <div className="text-right space-y-1">
            <div className="text-xs text-muted-foreground">Current Outstanding</div>
            <div className={cn(
              "text-2xl font-bold font-mono",
              Number(customer.outstanding) > 0 ? "text-destructive" : "text-success"
            )}>
              {inr(customer.outstanding)}
            </div>
            <div className="text-xs text-muted-foreground">
              Credit Limit: {inr(customer.credit_limit)}
            </div>
            {Number(customer.credit_limit) > 0 && (
              <div className="flex items-center gap-1 justify-end">
                <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      Number(customer.outstanding) > Number(customer.credit_limit)
                        ? "bg-destructive"
                        : Number(customer.outstanding) > Number(customer.credit_limit) * 0.8
                          ? "bg-warning"
                          : "bg-success"
                    )}
                    style={{
                      width: `${Math.min(100, (Number(customer.outstanding) / Number(customer.credit_limit)) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono">
                  {Math.round((Number(customer.outstanding) / Number(customer.credit_limit)) * 100)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Print header (only visible on print) */}
      <div className="hidden print:block mb-6">
        <div className="flex items-start justify-between border-b pb-4 mb-4">
          <div>
            <h1 className="text-xl font-bold">{biz.name}</h1>
            <p className="text-sm text-muted-foreground">{biz.address}</p>
            <p className="text-sm text-muted-foreground">
              GSTIN: {biz.gstin} · {biz.mobile}
            </p>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-semibold">Statement of Account</h2>
            <p className="text-sm">Period: {shortDate(fromDate)} to {shortDate(toDate)}</p>
          </div>
        </div>
        <div className="text-sm space-y-0.5 mb-4">
          <div><b>Customer:</b> {customer.shop_name || customer.name}</div>
          <div><b>Contact:</b> {customer.name} · {customer.mobile ?? "—"}</div>
          {customer.gstin && <div><b>GSTIN:</b> {customer.gstin}</div>}
          {customer.address && <div><b>Address:</b> {customer.address}</div>}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <SummaryCard
          label="Opening Balance"
          value={summary.openingBalance}
          icon={Wallet}
          tone={summary.openingBalance > 0 ? "destructive" : "default"}
        />
        <SummaryCard
          label="Total Debits (Invoices)"
          value={summary.totalDebit}
          icon={TrendingUp}
          tone="destructive"
          isDebit
        />
        <SummaryCard
          label="Total Credits (Payments)"
          value={summary.totalCredit}
          icon={TrendingDown}
          tone="success"
        />
        <SummaryCard
          label="Closing Balance"
          value={summary.closingBalance}
          icon={Wallet}
          tone={summary.closingBalance > 0 ? "destructive" : "success"}
        />
      </div>

      {/* Filters */}
      <Card className="p-3 mb-4 no-print">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-36 h-8"
            />
            <span className="text-muted-foreground text-sm">to</span>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-36 h-8"
            />
          </div>
          <div className="flex rounded-md border overflow-hidden text-xs">
            {(["all", "invoice", "payment"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  "px-3 py-1.5 font-medium transition-colors",
                  typeFilter === t
                    ? "bg-primary text-primary-foreground"
                    : "bg-card hover:bg-muted"
                )}
              >
                {t === "all" ? "All" : t === "invoice" ? "Invoices" : "Payments"}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Input
              placeholder="Search reference…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          </div>
          <div className="text-xs text-muted-foreground ml-auto">
            {filteredEntries.length} entries
          </div>
        </div>
      </Card>

      {/* Ledger table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-3 font-semibold w-28">Date</th>
                <th className="text-left px-4 py-3 font-semibold w-24">Type</th>
                <th className="text-left px-4 py-3 font-semibold">Reference</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Description</th>
                <th className="text-right px-4 py-3 font-semibold w-28">Debit</th>
                <th className="text-right px-4 py-3 font-semibold w-28">Credit</th>
                <th className="text-right px-4 py-3 font-semibold w-28">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {/* Opening balance row */}
              {summary.openingBalance !== 0 && (
                <tr className="bg-muted/20 font-medium">
                  <td className="px-4 py-3 text-muted-foreground">{shortDate(fromDate)}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-[10px]">Opening</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">—</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">Balance brought forward</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {summary.openingBalance > 0 && (
                      <span className="text-destructive">{inr(summary.openingBalance)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {summary.openingBalance < 0 && (
                      <span className="text-success">{inr(Math.abs(summary.openingBalance))}</span>
                    )}
                  </td>
                  <td className={cn(
                    "px-4 py-3 text-right font-mono font-semibold",
                    summary.openingBalance > 0 ? "text-destructive" : "text-success"
                  )}>
                    {inr(Math.abs(summary.openingBalance))}
                  </td>
                </tr>
              )}

              {filteredEntries.length === 0 && summary.openingBalance === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    <BookOpen className="size-8 mx-auto mb-2 opacity-50" />
                    No transactions in this period.
                  </td>
                </tr>
              )}

              {filteredEntries.map((entry, i) => (
                <LedgerRow key={`${entry.date}-${entry.type}-${entry.reference}-${i}`} entry={entry} />
              ))}

              {/* Closing balance row */}
              {filteredEntries.length > 0 && (
                <tr className="bg-primary/5 font-semibold border-t-2 border-primary/20">
                  <td className="px-4 py-3" colSpan={4}>
                    <span className="text-sm font-semibold">Closing Balance</span>
                    <span className="text-xs text-muted-foreground ml-2">as of {shortDate(toDate)}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-destructive">
                    {summary.totalDebit > 0 && inr(summary.totalDebit)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-success">
                    {summary.totalCredit > 0 && inr(summary.totalCredit)}
                  </td>
                  <td className={cn(
                    "px-4 py-3 text-right font-mono text-lg font-bold",
                    summary.closingBalance > 0 ? "text-destructive" : summary.closingBalance < 0 ? "text-success" : ""
                  )}>
                    {inr(Math.abs(summary.closingBalance))}
                    {summary.closingBalance > 0 && <span className="text-[10px] block font-normal text-muted-foreground">Dr (owed by customer)</span>}
                    {summary.closingBalance < 0 && <span className="text-[10px] block font-normal text-muted-foreground">Cr (advance)</span>}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Print footer */}
      <div className="hidden print:block mt-8 text-xs text-muted-foreground text-center border-t pt-4">
        <p>This is a computer-generated statement from {biz.name}.</p>
        <p>Generated on {new Date().toLocaleString("en-IN")} · For queries, contact {biz.mobile}</p>
      </div>
    </PageContainer>
  );
}

function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const isInvoice = entry.type === "invoice";
  const isPayment = entry.type === "payment";

  return (
    <tr className={cn("hover:bg-muted/20", isPayment && "bg-success/[0.02]")}>
      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{shortDate(entry.date)}</td>
      <td className="px-4 py-3">
        {isInvoice && (
          <Badge variant="outline" className="gap-1 text-[10px] bg-destructive/5 text-destructive border-destructive/20">
            <ReceiptText className="size-3" /> Invoice
          </Badge>
        )}
        {isPayment && (
          <Badge variant="outline" className="gap-1 text-[10px] bg-success/5 text-success border-success/20">
            <CreditCard className="size-3" /> Payment
          </Badge>
        )}
      </td>
      <td className="px-4 py-3 font-mono text-xs">{entry.reference}</td>
      <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
        <div className="flex flex-col gap-0.5">
          <span>{entry.description}</span>
          {entry.details?.gstBreakup && (
            <span className="text-[10px]">
              Subtotal: {inr(entry.details.subtotal ?? 0)}
              {entry.details.gstBreakup.cgst > 0 && ` · CGST ${inr(entry.details.gstBreakup.cgst)}`}
              {entry.details.gstBreakup.sgst > 0 && ` · SGST ${inr(entry.details.gstBreakup.sgst)}`}
              {entry.details.gstBreakup.igst > 0 && ` · IGST ${inr(entry.details.gstBreakup.igst)}`}
            </span>
          )}
          {entry.details?.mode && (
            <span className="text-[10px]">Mode: {entry.details.mode.toUpperCase()}</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right font-mono">
        {entry.debit > 0 && (
          <span className="text-destructive font-semibold">{inr(entry.debit)}</span>
        )}
      </td>
      <td className="px-4 py-3 text-right font-mono">
        {entry.credit > 0 && (
          <span className="text-success font-semibold">{inr(entry.credit)}</span>
        )}
      </td>
      <td className={cn(
        "px-4 py-3 text-right font-mono font-semibold",
        entry.balance > 0 ? "text-destructive" : entry.balance < 0 ? "text-success" : "text-muted-foreground"
      )}>
        {inr(Math.abs(entry.balance))}
        {entry.balance > 0 && <span className="text-[9px] text-muted-foreground ml-0.5">Dr</span>}
        {entry.balance < 0 && <span className="text-[9px] text-muted-foreground ml-0.5">Cr</span>}
      </td>
    </tr>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
  isDebit,
}: {
  label: string;
  value: number;
  icon: any;
  tone?: "default" | "destructive" | "success";
  isDebit?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <Icon className={cn(
          "size-4",
          tone === "destructive" ? "text-destructive" : tone === "success" ? "text-success" : "text-muted-foreground"
        )} />
      </div>
      <div className={cn(
        "text-xl font-bold font-mono",
        tone === "destructive" ? "text-destructive" : tone === "success" ? "text-success" : ""
      )}>
        {isDebit ? "↑ " : ""}{inr(Math.abs(value))}
      </div>
    </Card>
  );
}
