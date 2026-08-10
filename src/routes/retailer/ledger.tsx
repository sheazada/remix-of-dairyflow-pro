import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { inr, shortDate } from "@/lib/format";
import { makeRetailerCustomerQueryFn } from "@/lib/retailer-customer";
import { Wallet, RefreshCw, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/retailer/ledger")({
  component: Ledger,
});

type LedgerEntry = {
  id: string;
  entry_no: string;
  entry_date: string;
  transaction_type: string;
  debit_amount: number;
  credit_amount: number;
  running_balance: number;
  reference_type: string | null;
  reference_id: string | null;
  invoice?: { invoice_no: string } | null;
};

function Ledger() {
  const { data: me } = useQuery({
    queryKey: ["retailer-me"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return null;
      const fn = makeRetailerCustomerQueryFn(userRes.user.id, userRes.user.email ?? null);
      return fn();
    },
    retry: 1,
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["retailer-ledger", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const { data } = await supabase
        .from("retailer_ledger_entries")
        .select("*, invoice:invoices(invoice_no)")
        .eq("retailer_id", me!.id)
        .order("entry_date", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const retailer = me;
  const outstanding = Number(retailer?.outstanding ?? 0);
  const creditLimit = Number(retailer?.credit_limit ?? 0);

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Account Ledger</h1>
        <p className="text-sm text-muted-foreground">Your account passbook</p>
      </div>

      {/* Balance Card */}
      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Current Outstanding
            </p>
            <div className={cn("text-3xl font-bold font-mono mt-1", outstanding > 0 ? "text-destructive" : "text-success")}>
              {inr(outstanding)}
            </div>
          </div>
          <Wallet className="size-10 text-primary opacity-20" />
        </div>
        {creditLimit > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Credit Limit</span>
              <span className="font-mono">{inr(creditLimit)}</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-muted-foreground">Available</span>
              <span className="font-mono font-semibold text-success">
                {inr(Math.max(0, creditLimit - outstanding))}
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Ledger Entries */}
      {isLoading ? (
        <div className="text-center py-12">
          <RefreshCw className="size-8 mx-auto mb-3 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading ledger...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12">
          <Wallet className="size-10 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-sm font-semibold">No transactions yet</p>
          <p className="text-xs text-muted-foreground mt-1">Your account activity will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry: any) => {
            const isDebit = entry.transaction_type === "invoice" || entry.transaction_type === "opening_balance";
            const amount = isDebit ? entry.debit_amount : entry.credit_amount;
            return (
              <Card key={entry.id} className="p-3">
                <div className="flex items-start gap-3">
                  <div className={cn("size-10 rounded-lg flex items-center justify-center shrink-0", isDebit ? "bg-destructive/10" : "bg-success/10")}>
                    {isDebit ? (
                      <ArrowUpRight className="size-5 text-destructive" />
                    ) : (
                      <ArrowDownLeft className="size-5 text-success" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm capitalize">
                        {entry.transaction_type.replace(/_/g, " ")}
                      </span>
                      {entry.invoice?.invoice_no && (
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {entry.invoice.invoice_no}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {shortDate(entry.entry_date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={cn("font-mono font-bold text-sm", isDebit ? "text-destructive" : "text-success")}>
                      {isDebit ? "+" : "-"}{inr(amount)}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Balance: {inr(entry.running_balance)}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
