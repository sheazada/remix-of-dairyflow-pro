import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDownLeft, ArrowUpRight, Clock, History } from "lucide-react";
import { inr, shortDate } from "@/lib/format";

type Revision = {
  id: string;
  invoice_id: string;
  revision_number: number;
  revision_reason: string;
  changes_json: any[];
  original_total: number;
  revised_total: number;
  revised_invoice_no: string;
  created_at: string;
  revised_by: string;
};

export function InvoiceRevisionHistory({ invoiceId }: { invoiceId: string }) {
  const { data: revisions = [] as Revision[], isLoading } = useQuery({
    queryKey: ["invoice-revisions", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_revisions")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("revision_number", { ascending: true });
      if (error) throw error;
      return data as Revision[];
    },
  });

  if (isLoading) return null;
  if (revisions.length === 0) return null;

  return (
    <Card className="p-4 mt-4">
      <div className="flex items-center gap-2 mb-4">
        <History className="size-5 text-primary" />
        <h3 className="font-semibold">Revision History</h3>
        <Badge variant="secondary">{revisions.length}</Badge>
      </div>

      <div className="space-y-4">
        {revisions.map((rev, idx) => (
          <div key={rev.id} className="relative pl-6 border-l-2 border-primary/20">
            {/* Timeline dot */}
            <div className="absolute left-0 top-0 size-3 rounded-full bg-primary border-2 border-background -translate-x-[7px]" />
            
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  Rev #{rev.revision_number}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {shortDate(rev.created_at)}
                </span>
              </div>
              {rev.revised_invoice_no && (
                <Badge variant="secondary" className="font-mono text-xs">
                  {rev.revised_invoice_no}
                </Badge>
              )}
            </div>

            {/* Reason */}
            <div className="text-sm mb-3">
              <span className="text-muted-foreground">Reason: </span>
              <span className="font-medium">{rev.revision_reason}</span>
            </div>

            {/* Changes */}
            <div className="space-y-1 mb-3">
              {rev.changes_json?.map((change: any, i: number) => {
                const diff = change.revised_qty - change.original_qty;
                return (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="font-medium">{change.product_name}</span>
                    <span className="text-muted-foreground">
                      {change.original_qty} → {change.revised_qty}
                    </span>
                    {diff > 0 ? (
                      <span className="text-success flex items-center gap-0.5">
                        <ArrowUpRight className="size-3" />
                        +{diff}
                      </span>
                    ) : diff < 0 ? (
                      <span className="text-destructive flex items-center gap-0.5">
                        <ArrowDownLeft className="size-3" />
                        {diff}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="flex items-center gap-3 text-xs bg-muted/30 p-2 rounded">
              <div>
                <span className="text-muted-foreground">Original: </span>
                <span className="font-mono font-semibold">₹{rev.original_total.toFixed(2)}</span>
              </div>
              <span className="text-muted-foreground">→</span>
              <div>
                <span className="text-muted-foreground">Revised: </span>
                <span className="font-mono font-semibold">₹{rev.revised_total.toFixed(2)}</span>
              </div>
              <div className={`ml-auto font-mono font-semibold ${
                rev.revised_total > rev.original_total ? "text-success" :
                rev.revised_total < rev.original_total ? "text-destructive" : ""
              }`}>
                {rev.revised_total > rev.original_total ? "+" : ""}
                ₹{(rev.revised_total - rev.original_total).toFixed(2)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
