import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { inr, shortDate } from "@/lib/format";
import { toast } from "sonner";
import {
  Bell,
  BellOff,
  CheckCircle2,
  Clock,
  Mail,
  MessageCircle,
  MessageSquare,
  Play,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { processPaymentReminders } from "@/lib/payment-reminders";

export const Route = createFileRoute("/_authenticated/payment-reminders")({
  component: PaymentReminders,
});

type Template = {
  id: string;
  name: string;
  days_overdue: number;
  channel: "email" | "sms" | "whatsapp";
  subject: string | null;
  body: string;
  is_active: boolean;
};

type ReminderLog = {
  id: string;
  customer_id: string;
  invoice_id: string | null;
  template_id: string | null;
  sent_at: string;
  channel: string;
  status: string;
  error_message: string | null;
  customer?: { name: string; shop_name: string | null } | null;
  invoice?: { invoice_no: string; balance: number } | null;
  template?: { name: string } | null;
};

function PaymentReminders() {
  const [tab, setTab] = useState<"templates" | "history">("templates");
  const [processing, setProcessing] = useState(false);
  const qc = useQueryClient();

  const { data: templates = [], isLoading: tLoading } = useQuery({
    queryKey: ["reminder-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminder_templates")
        .select("*")
        .order("days_overdue", { ascending: true });
      if (error) throw error;
      return data as Template[];
    },
  });

  const { data: logs = [], isLoading: lLoading } = useQuery({
    queryKey: ["reminder-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminder_logs")
        .select("*, customer:customers(name, shop_name), invoice:invoices(invoice_no, balance), template:reminder_templates(name)")
        .order("sent_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as ReminderLog[];
    },
  });

  const handleSendReminders = async () => {
    setProcessing(true);
    try {
      const result = await processPaymentReminders({ data: { dryRun: false } });
      toast.success(result.message);
      qc.invalidateQueries({ queryKey: ["reminder-logs"] });
    } catch (e: any) {
      toast.error(e?.message || "Failed to process reminders");
    } finally {
      setProcessing(false);
    }
  };

  const handleToggleTemplate = async (templateId: string, isActive: boolean) => {
    const { error } = await supabase
      .from("reminder_templates")
      .update({ is_active: isActive })
      .eq("id", templateId);
    if (error) return toast.error(error.message);
    toast.success(isActive ? "Template activated" : "Template paused");
    qc.invalidateQueries({ queryKey: ["reminder-templates"] });
  };

  const channelIcons = {
    email: <Mail className="size-3.5" />,
    sms: <MessageSquare className="size-3.5" />,
    whatsapp: <MessageCircle className="size-3.5" />,
  };

  return (
    <PageContainer>
      <PageHeader
        title="Payment Reminders"
        description="Automate follow-ups for overdue invoices. Configure templates and send reminders in bulk."
        actions={
          <Button onClick={handleSendReminders} disabled={processing} className="gap-2">
            {processing ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Play className="size-4" />
                Send Reminders Now
              </>
            )}
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="templates" className="gap-2">
            <Bell className="size-4" /> Templates ({templates.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Clock className="size-4" /> History ({logs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4 space-y-4">
          <Card className="p-4 bg-primary/5 border-primary/20">
            <div className="flex items-start gap-3">
              <Bell className="size-5 text-primary shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-sm">How it works</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Active templates automatically match overdue invoices. Clicking "Send Reminders Now" will find all unpaid invoices that match a template's days-overdue rule, format the message, and send it via your chosen channel. The system prevents duplicate reminders.
                </div>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            {tLoading && <div className="text-center py-8 text-muted-foreground">Loading templates...</div>}
            {!tLoading && templates.length === 0 && (
              <Card className="p-8 text-center">
                <BellOff className="size-10 mx-auto mb-3 text-muted-foreground" />
                <div className="text-lg font-semibold mb-1">No templates configured</div>
                <div className="text-sm text-muted-foreground">Default templates were seeded in the database. If you don't see them, run the migration.</div>
              </Card>
            )}
            {templates.map((t) => (
              <Card key={t.id} className="p-0 overflow-hidden">
                <div className="p-4 flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 text-sm font-semibold">
                        {channelIcons[t.channel]}
                        <span className="capitalize">{t.channel}</span>
                      </div>
                      <Badge variant="secondary" className="font-mono">
                        {t.days_overdue} days overdue
                      </Badge>
                      <Badge variant={t.is_active ? "default" : "outline"} className={cn(t.is_active ? "bg-success/20 text-success" : "")}>
                        {t.is_active ? "Active" : "Paused"}
                      </Badge>
                    </div>
                    <div className="text-sm font-medium">{t.name}</div>
                    {t.subject && <div className="text-xs text-muted-foreground">Subject: {t.subject}</div>}
                    <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-md font-mono whitespace-pre-wrap">
                      {t.body}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Status</div>
                      <Switch checked={t.is_active} onCheckedChange={(v) => handleToggleTemplate(t.id, v)} className="mt-1" />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="text-left px-4 py-3 font-semibold">Time</th>
                    <th className="text-left px-4 py-3 font-semibold">Customer</th>
                    <th className="text-left px-4 py-3 font-semibold">Invoice</th>
                    <th className="text-left px-4 py-3 font-semibold">Template</th>
                    <th className="text-left px-4 py-3 font-semibold">Channel</th>
                    <th className="text-center px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lLoading && (
                    <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Loading history...</td></tr>
                  )}
                  {!lLoading && logs.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No reminders sent yet. Click "Send Reminders Now" to start.</td></tr>
                  )}
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.sent_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {log.customer?.shop_name ?? log.customer?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs">{log.invoice?.invoice_no ?? "—"}</div>
                        {log.invoice && <div className="text-xs text-muted-foreground">{inr(log.invoice.balance)}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs">{log.template?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs capitalize">
                          {channelIcons[log.channel as keyof typeof channelIcons]}
                          {log.channel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {log.status === "sent" ? (
                          <Badge variant="outline" className="text-success border-success/30 bg-success/5">
                            <CheckCircle2 className="size-3 mr-1" /> Sent
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/5">
                            <XCircle className="size-3 mr-1" /> Failed
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
