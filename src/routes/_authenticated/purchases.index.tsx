import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { inr, shortDate } from "@/lib/format";
import { Plus, ScanLine } from "lucide-react";

export const Route = createFileRoute("/_authenticated/purchases/")({
  component: Purchases,
});

function Purchases() {
  const { data } = useQuery({
    queryKey: ["purchases"],
    queryFn: async () => (await supabase.from("purchases").select("*, supplier:suppliers(name, company)").order("created_at", { ascending: false })).data ?? [],
  });
  return (
    <PageContainer>
      <PageHeader
        title="Purchases"
        description="Record stock received from your dairy suppliers."
        actions={
          <>
            <Button asChild variant="outline" size="sm" className="gap-1.5"><Link to="/purchases/challan"><ScanLine className="size-4" /> Scan Challan</Link></Button>
            <Button asChild size="sm" className="gap-1.5"><Link to="/purchases/new"><Plus className="size-4" /> New Purchase</Link></Button>
          </>
        }
      />
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-6 py-3 font-semibold">Bill No</th>
              <th className="text-left px-6 py-3 font-semibold">Supplier</th>
              <th className="text-left px-6 py-3 font-semibold">Date</th>
              <th className="text-right px-6 py-3 font-semibold">Total</th>
              <th className="text-left px-6 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(data ?? []).length === 0 && <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No purchases yet. <Link to="/purchases/new" className="text-primary hover:underline">Record one</Link>.</td></tr>}
            {(data ?? []).map((p: any) => (
              <tr key={p.id} className="hover:bg-muted/30">
                <td className="px-6 py-3 font-mono text-xs">{p.bill_no}</td>
                <td className="px-6 py-3">
                  {p.supplier_id ? (
                    <Link to="/suppliers/$id" params={{ id: p.supplier_id }} className="hover:text-primary">
                      <div className="font-medium">{p.supplier?.name}</div>
                      <div className="text-xs text-muted-foreground">{p.supplier?.company}</div>
                    </Link>
                  ) : (
                    <div className="font-medium">{p.supplier?.name ?? "—"}</div>
                  )}
                </td>
                <td className="px-6 py-3 text-muted-foreground">{shortDate(p.purchase_date)}</td>
                <td className="px-6 py-3 text-right font-mono font-semibold">{inr(p.total)}</td>
                <td className="px-6 py-3"><StatusBadge status={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </PageContainer>
  );
}
