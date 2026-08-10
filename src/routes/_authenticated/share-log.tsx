import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Share2,
  MessageCircle,
  Mail,
  MessageSquare,
  Send,
  Link as LinkIcon,
  Download,
  Share,
  Search,
  DownloadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/share-log")({
  component: ShareLogPage,
  head: () => ({
    meta: [
      { title: "Share Activity Log · Compliance" },
      {
        name: "description",
        content:
          "Audit trail of every invoice share, copy, and download action performed in the ERP.",
      },
      { property: "og:title", content: "Share Activity Log · Compliance" },
      {
        property: "og:description",
        content: "Append-only compliance log for invoice sharing activity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const CHANNEL_META: Record<
  string,
  { label: string; icon: typeof Share2; tone: string }
> = {
  whatsapp: { label: "WhatsApp", icon: MessageCircle, tone: "text-green-600" },
  email: { label: "Email", icon: Mail, tone: "text-blue-600" },
  sms: { label: "SMS", icon: MessageSquare, tone: "text-foreground" },
  telegram: { label: "Telegram", icon: Send, tone: "text-sky-500" },
  native: { label: "Device share", icon: Share, tone: "text-foreground" },
  copy_link: { label: "Copy link", icon: LinkIcon, tone: "text-muted-foreground" },
  copy_summary: { label: "Copy summary", icon: LinkIcon, tone: "text-muted-foreground" },
  download_pdf: { label: "Download PDF", icon: Download, tone: "text-primary" },
};

function ShareLogPage() {
  const [q, setQ] = useState("");
  const [channel, setChannel] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["share-activity-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("share_activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data ?? []).filter((r: any) => {
      if (channel !== "all" && r.channel !== channel) return false;
      if (from && r.created_at < from) return false;
      if (to && r.created_at > to + "T23:59:59") return false;
      if (!s) return true;
      return (
        (r.invoice_no ?? "").toLowerCase().includes(s) ||
        (r.user_email ?? "").toLowerCase().includes(s) ||
        (r.recipient ?? "").toLowerCase().includes(s)
      );
    });
  }, [data, q, channel, from, to]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const r of data ?? []) {
      c.all++;
      c[r.channel] = (c[r.channel] ?? 0) + 1;
    }
    return c;
  }, [data]);

  const exportCsv = () => {
    const rows = [
      ["Timestamp", "Invoice", "Channel", "Recipient", "User", "User Agent"],
      ...filtered.map((r: any) => [
        r.created_at,
        r.invoice_no ?? "",
        r.channel,
        r.recipient ?? "",
        r.user_email ?? "",
        r.user_agent ?? "",
      ]),
    ];
    const csv = rows
      .map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `share-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} entries`);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Share Activity Log"
        description="Append-only audit trail of every invoice share, copy and download action."
        actions={
          <Button size="sm" variant="outline" className="gap-1.5" onClick={exportCsv}>
            <DownloadCloud className="size-4" /> Export CSV
          </Button>
        }
      />

      <Card className="p-4 mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search invoice, user or recipient"
            className="pl-9 h-9"
          />
        </div>
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels ({counts.all ?? 0})</SelectItem>
            {Object.entries(CHANNEL_META).map(([key, meta]) => (
              <SelectItem key={key} value={key}>
                {meta.label} ({counts[key] ?? 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">From</span>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-36" />
          <span className="text-muted-foreground">to</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-36" />
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {data?.length ?? 0} entries
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-3 font-semibold">When</th>
                <th className="text-left px-4 py-3 font-semibold">Channel</th>
                <th className="text-left px-4 py-3 font-semibold">Invoice</th>
                <th className="text-left px-4 py-3 font-semibold">Recipient</th>
                <th className="text-left px-4 py-3 font-semibold">By</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-muted-foreground text-sm">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-muted-foreground text-sm">
                    No share activity matches the current filters.
                  </td>
                </tr>
              )}
              {filtered.map((r: any) => {
                const meta = CHANNEL_META[r.channel] ?? {
                  label: r.channel,
                  icon: Share2,
                  tone: "text-foreground",
                };
                const Icon = meta.icon;
                const dt = new Date(r.created_at);
                return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm">{dt.toLocaleString()}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="gap-1.5 font-normal">
                        <Icon className={cn("size-3.5", meta.tone)} />
                        {meta.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {r.invoice_id ? (
                        <Link
                          to="/invoices/$id"
                          params={{ id: r.invoice_id }}
                          className="text-primary hover:underline font-mono text-xs"
                        >
                          {r.invoice_no ?? r.invoice_id.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="font-mono text-xs text-muted-foreground">
                          {r.invoice_no ?? "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="font-mono text-xs">{r.recipient ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>{r.user_email ?? "—"}</div>
                      {r.user_agent && (
                        <div
                          className="text-[10px] text-muted-foreground truncate max-w-[280px]"
                          title={r.user_agent}
                        >
                          {r.user_agent}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </PageContainer>
  );
}
