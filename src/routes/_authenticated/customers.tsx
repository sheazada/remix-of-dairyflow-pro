import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/status-badge";
import { inr, inrCompact } from "@/lib/format";
import { useRealtimeSync } from "@/lib/realtime";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Search, MessageCircle, Mail, Phone, ReceiptText, Users, Wallet, AlertTriangle, Pencil, BellOff, Bell, Send, CheckCircle2, XCircle, Clock, Ban, MessageSquare, BookOpen, Upload, Download } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { getBusiness } from "@/lib/business";
import { cn } from "@/lib/utils";
import { parseCsv, readFileAsText, toCsv, downloadCsv } from "@/lib/bulk";

export const Route = createFileRoute("/_authenticated/customers")({
  component: Customers,
});

function Customers() {
  // Live-update outstanding balances when payments are recorded.
  useRealtimeSync({
    tableName: "payments",
    invalidateKeys: [["customers"]],
  });

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "dues" | "clear">("all");
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const qc = useQueryClient();

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await supabase.from("customers").select("*").order("name")).data ?? [],
  });

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return (customers ?? []).filter((c) => {
      const match = !q ||
        c.name.toLowerCase().includes(s) ||
        (c.shop_name ?? "").toLowerCase().includes(s) ||
        (c.mobile ?? "").includes(s) ||
        (c.gstin ?? "").toLowerCase().includes(s);
      if (!match) return false;
      if (filter === "dues") return Number(c.outstanding) > 0;
      if (filter === "clear") return Number(c.outstanding) <= 0;
      return true;
    });
  }, [customers, q, filter]);

  const totals = useMemo(() => {
    const list = customers ?? [];
    const outstanding = list.reduce((s, c) => s + Number(c.outstanding), 0);
    const overLimit = list.filter((c) => Number(c.credit_limit) > 0 && Number(c.outstanding) > Number(c.credit_limit)).length;
    const withDues = list.filter((c) => Number(c.outstanding) > 0).length;
    return { outstanding, overLimit, withDues, total: list.length };
  }, [customers]);

  return (
    <PageContainer>
      <PageHeader
        title="Customers & Ledger"
        description="Retail shops, credit limits, outstanding dues and reminders."
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)} className="gap-1.5">
              <Upload className="size-4" /> Import CSV
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5"><Plus className="size-4" /> Add Customer</Button>
              </DialogTrigger>
              <CustomerDialog onSaved={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["customers"] }); }} />
            </Dialog>
          </div>
        }
      />

      {/* Top ledger bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <LedgerStat label="Total Retailers" value={String(totals.total)} icon={Users} />
        <LedgerStat label="Total Outstanding" value={inrCompact(totals.outstanding)} icon={Wallet} tone="destructive" />
        <LedgerStat label="Shops With Dues" value={String(totals.withDues)} icon={ReceiptText} />
        <LedgerStat label="Over Credit Limit" value={String(totals.overLimit)} icon={AlertTriangle} tone={totals.overLimit ? "destructive" : undefined} />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-56 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, shop, mobile, GSTIN" className="pl-9" />
          </div>
          <div className="flex rounded-md border overflow-hidden text-xs">
            {(["all", "dues", "clear"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 font-medium ${filter === f ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
              >
                {f === "all" ? "All" : f === "dues" ? "With Dues" : "Cleared"}
              </button>
            ))}
          </div>
          <div className="text-xs text-muted-foreground ml-auto">{filtered.length} shown</div>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y">
          {filtered.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No customers.</div>}
          {filtered.map((c) => (
            <div key={c.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.shop_name}</div>
                </div>
                <div className="text-right">
                  <div className={`font-mono font-semibold ${Number(c.outstanding) > 0 ? "text-destructive" : ""}`}>{inr(c.outstanding)}</div>
                  <div className="text-[10px] text-muted-foreground">Limit {inr(c.credit_limit)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={c.status} />
                <NotifyBadges customer={c} />
                <ReminderActions customer={c} />
                <CustomerNotificationsButton customer={c} />
                <Link to="/customer-ledger/$id" params={{ id: c.id }}>
                  <Button size="icon" variant="ghost" className="size-8" aria-label="View ledger / passbook" title="View ledger / passbook">
                    <BookOpen className="size-4" />
                  </Button>
                </Link>
                <EditCustomerButton customer={c} />
                <Link to="/invoices/new" search={{ customerId: c.id }} className="text-xs text-primary ml-auto hover:underline">Invoice →</Link>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-6 py-3 font-semibold">Customer</th>
                <th className="text-left px-6 py-3 font-semibold">Mobile</th>
                <th className="text-left px-6 py-3 font-semibold">GSTIN</th>
                <th className="text-right px-6 py-3 font-semibold">Credit Limit</th>
                <th className="text-right px-6 py-3 font-semibold">Outstanding</th>
                <th className="text-left px-6 py-3 font-semibold">Remind</th>
                <th className="text-left px-6 py-3 font-semibold">Notify</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No customers.</td></tr>
              )}
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-6 py-3">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.shop_name}</div>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground font-mono">{c.mobile ?? "—"}</td>
                  <td className="px-6 py-3 text-muted-foreground font-mono text-xs">{c.gstin ?? "—"}</td>
                  <td className="px-6 py-3 text-right font-mono">{inr(c.credit_limit)}</td>
                  <td className={`px-6 py-3 text-right font-mono font-semibold ${Number(c.outstanding) > 0 ? "text-destructive" : ""}`}>{inr(c.outstanding)}</td>
                  <td className="px-6 py-3"><ReminderActions customer={c} /></td>
                  <td className="px-6 py-3"><NotifyBadges customer={c} /></td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <Link to="/customer-ledger/$id" params={{ id: c.id }}>
                        <Button size="icon" variant="ghost" className="size-8" aria-label="View ledger / passbook" title="View ledger / passbook">
                          <BookOpen className="size-4" />
                        </Button>
                      </Link>
                      <CustomerNotificationsButton customer={c} />
                      <EditCustomerButton customer={c} />
                      <Link to="/invoices/new" search={{ customerId: c.id }} className="text-xs text-primary hover:underline">Invoice</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Import CSV Dialog */}
      {importOpen && (
        <ImportCsvDialog
          onClose={() => setImportOpen(false)}
          onSaved={() => {
            setImportOpen(false);
            qc.invalidateQueries({ queryKey: ["customers"] });
          }}
        />
      )}
    </PageContainer>
  );
}

function LedgerStat({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone?: "destructive" }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className={`text-2xl font-semibold font-mono tracking-tight ${tone === "destructive" ? "text-destructive" : ""}`}>{value}</div>
    </Card>
  );
}

function ReminderActions({ customer }: { customer: any }) {
  const due = Number(customer.outstanding);
  const disabled = due <= 0;
  const biz = getBusiness();
  const msg = `Hello ${customer.name}, this is a friendly reminder from ${biz.name || "us"}. Your current outstanding balance is ₹${due.toLocaleString("en-IN")}. Kindly clear it at your earliest. Thank you.`;
  const wa = customer.mobile ? `https://wa.me/91${String(customer.mobile).replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(msg)}` : "";
  const sms = customer.mobile ? `sms:${customer.mobile}?body=${encodeURIComponent(msg)}` : "";
  const mail = customer.email ? `mailto:${customer.email}?subject=${encodeURIComponent("Payment reminder")}&body=${encodeURIComponent(msg)}` : "";
  const tel = customer.mobile ? `tel:${customer.mobile}` : "";

  const btn = (href: string, Icon: any, label: string, enabled: boolean) => (
    <Button
      asChild={enabled}
      size="icon"
      variant="ghost"
      className="size-8"
      disabled={!enabled || disabled}
      title={disabled ? "No dues" : label}
      aria-label={disabled ? `No dues for ${label}` : label}
      onClick={disabled ? undefined : () => { if (enabled) toast.success(`${label} opened`); }}
    >
      {enabled ? <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer"><Icon className="size-4" aria-hidden /></a> : <span><Icon className="size-4" aria-hidden /></span>}
    </Button>
  );

  return (
    <div className="flex items-center gap-0.5">
      {btn(wa, MessageCircle, "WhatsApp reminder", !!wa)}
      {btn(sms, ReceiptText, "SMS reminder", !!sms)}
      {btn(mail, Mail, "Email reminder", !!mail)}
      {btn(tel, Phone, "Call", !!tel)}
    </div>
  );
}

function EditCustomerButton({ customer }: { customer: any }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="size-8" aria-label="Edit customer" title="Edit customer">
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <CustomerDialog
        customer={customer}
        onSaved={() => {
          setOpen(false);
          qc.invalidateQueries({ queryKey: ["customers"] });
        }}
      />
    </Dialog>
  );
}

function NotifyBadges({ customer }: { customer: any }) {
  const email = customer.notify_email !== false;
  const sms = customer.notify_sms !== false;
  if (email && sms) {
    return <span className="text-[10px] font-medium text-muted-foreground">Email · SMS</span>;
  }
  if (!email && !sms) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-destructive">
        <BellOff className="size-3" /> Muted
      </span>
    );
  }
  return (
    <span className="text-[10px] font-medium text-muted-foreground">
      {email ? "Email only" : "SMS only"}
    </span>
  );
}

function CustomerDialog({ onSaved, customer }: { onSaved: () => void; customer?: any }) {
  const isEdit = !!customer;
  const [f, setF] = useState({
    name: customer?.name ?? "",
    shop_name: customer?.shop_name ?? "",
    mobile: customer?.mobile ?? "",
    email: customer?.email ?? "",
    gstin: customer?.gstin ?? "",
    address: customer?.address ?? "",
    credit_limit: String(customer?.credit_limit ?? "0"),
    notes: customer?.notes ?? "",
    notify_email: customer?.notify_email ?? true,
    notify_sms: customer?.notify_sms ?? true,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!f.name) return toast.error("Name required");
    setSaving(true);
    const payload = {
      name: f.name,
      shop_name: f.shop_name || null,
      mobile: f.mobile || null,
      email: f.email || null,
      gstin: f.gstin || null,
      address: f.address || null,
      credit_limit: Number(f.credit_limit) || 0,
      notes: f.notes || null,
      notify_email: !!f.notify_email,
      notify_sms: !!f.notify_sms,
    };
    const { error } = isEdit
      ? await supabase.from("customers").update(payload).eq("id", customer.id)
      : await supabase.from("customers").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isEdit ? "Customer updated" : "Customer added");
    onSaved();
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{isEdit ? "Edit Customer" : "Add Customer"}</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>Contact name *</Label>
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Shop name</Label>
          <Input value={f.shop_name} onChange={(e) => setF({ ...f, shop_name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Mobile</Label>
          <Input value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>GSTIN</Label>
          <Input value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} />
        </div>
        <div className="space-y-1.5">
          <Label>Credit limit (₹)</Label>
          <Input type="number" value={f.credit_limit} onChange={(e) => setF({ ...f, credit_limit: e.target.value })} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Address</Label>
          <Textarea rows={2} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Notes</Label>
          <Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </div>
        <div className="col-span-2 rounded-md border p-3 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notification preferences</div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Email updates</div>
              <div className="text-xs text-muted-foreground">Send delivery status emails to this retailer.</div>
            </div>
            <Switch checked={!!f.notify_email} onCheckedChange={(v) => setF({ ...f, notify_email: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">SMS updates</div>
              <div className="text-xs text-muted-foreground">Send delivery status SMS to this retailer.</div>
            </div>
            <Switch checked={!!f.notify_sms} onCheckedChange={(v) => setF({ ...f, notify_sms: v })} />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : isEdit ? "Save changes" : "Save customer"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

const NOTIF_STATUS_META: Record<string, { label: string; cls: string; icon: any }> = {
  queued: { label: "Queued", cls: "bg-muted text-muted-foreground ring-border", icon: Clock },
  sending: { label: "Sending", cls: "bg-primary-soft text-primary ring-primary/20", icon: Send },
  sent: { label: "Sent", cls: "bg-success/10 text-success ring-success/20", icon: CheckCircle2 },
  failed: { label: "Failed", cls: "bg-destructive/10 text-destructive ring-destructive/20", icon: XCircle },
  suppressed: { label: "Suppressed", cls: "bg-warning/15 text-warning-foreground ring-warning/30", icon: Ban },
  cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground ring-border", icon: Ban },
};

const CHANNEL_META: Record<string, { label: string; icon: any }> = {
  email: { label: "Email", icon: Mail },
  sms: { label: "SMS", icon: MessageSquare },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
};

function CustomerNotificationsButton({ customer }: { customer: any }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="size-8" aria-label="Notification history" title="Notification history">
          <Bell className="size-4" />
        </Button>
      </DialogTrigger>
      {open && <CustomerNotificationsDialog customer={customer} />}
    </Dialog>
  );
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function CustomerNotificationsDialog({ customer }: { customer: any }) {
  const { data, isLoading } = useQuery({
    queryKey: ["customer-notifications", customer.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_logs")
        .select("id, channel, status, recipient, subject, body, template, attempts, max_attempts, last_error, provider, last_attempt_at, next_retry_at, sent_at, created_at, invoice:invoices(invoice_no), delivery_id")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const summary = useMemo(() => {
    const rows = data ?? [];
    const byChannel: Record<string, { sent: number; failed: number; queued: number; lastSent: string | null }> = {
      email: { sent: 0, failed: 0, queued: 0, lastSent: null },
      sms: { sent: 0, failed: 0, queued: 0, lastSent: null },
      whatsapp: { sent: 0, failed: 0, queued: 0, lastSent: null },
    };
    for (const r of rows as any[]) {
      const ch = byChannel[r.channel];
      if (!ch) continue;
      if (r.status === "sent") {
        ch.sent += 1;
        if (!ch.lastSent || (r.sent_at && r.sent_at > ch.lastSent)) ch.lastSent = r.sent_at;
      } else if (r.status === "failed") ch.failed += 1;
      else if (r.status === "queued" || r.status === "sending") ch.queued += 1;
    }
    return byChannel;
  }, [data]);

  return (
    <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Bell className="size-4" /> Notifications · {customer.shop_name || customer.name}
        </DialogTitle>
      </DialogHeader>

      <div className="grid grid-cols-3 gap-2">
        {(["email", "sms", "whatsapp"] as const).map((ch) => {
          const Icon = CHANNEL_META[ch].icon;
          const s = summary[ch];
          return (
            <div key={ch} className="rounded-md border p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Icon className="size-3" /> {CHANNEL_META[ch].label}
              </div>
              <div className="mt-1 text-sm font-medium">
                <span className="text-success">{s.sent}</span>
                <span className="text-muted-foreground"> sent · </span>
                <span className="text-destructive">{s.failed}</span>
                <span className="text-muted-foreground"> failed</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {s.lastSent ? `Last: ${fmtDateTime(s.lastSent)}` : "No sends yet"}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto -mx-6 px-6 pt-2">
        {isLoading && <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">No notifications sent to this customer yet.</div>
        )}
        {!isLoading && (data?.length ?? 0) > 0 && (
          <ol className="relative border-l border-border ml-2 space-y-4">
            {(data as any[]).map((r) => {
              const meta = NOTIF_STATUS_META[r.status] ?? NOTIF_STATUS_META.queued;
              const StatusIcon = meta.icon;
              const ChIcon = CHANNEL_META[r.channel]?.icon ?? Mail;
              return (
                <li key={r.id} className="ml-4">
                  <span className="absolute -left-[7px] mt-1.5 size-3 rounded-full bg-card ring-2 ring-border" />
                  <div className="rounded-md border p-3 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset", meta.cls)}>
                        <StatusIcon className="size-3" /> {meta.label}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <ChIcon className="size-3" /> {CHANNEL_META[r.channel]?.label ?? r.channel}
                      </span>
                      {r.invoice?.invoice_no && (
                        <span className="text-[10px] font-mono text-muted-foreground">#{r.invoice.invoice_no}</span>
                      )}
                      <span className="ml-auto text-[10px] text-muted-foreground">{fmtDateTime(r.created_at)}</span>
                    </div>
                    {r.subject && <div className="text-sm font-medium truncate">{r.subject}</div>}
                    <div className="text-xs text-muted-foreground font-mono truncate">→ {r.recipient}</div>
                    <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                      <span>Attempts: {r.attempts}/{r.max_attempts}</span>
                      {r.sent_at && <span>Sent: {fmtDateTime(r.sent_at)}</span>}
                      {r.last_attempt_at && !r.sent_at && <span>Last try: {fmtDateTime(r.last_attempt_at)}</span>}
                      {r.next_retry_at && <span>Retry at: {fmtDateTime(r.next_retry_at)}</span>}
                      {r.provider && <span>via {r.provider}</span>}
                    </div>
                    {r.last_error && (
                      <div className="text-[11px] text-destructive bg-destructive/5 rounded px-2 py-1 border border-destructive/20">
                        {r.last_error}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </DialogContent>
  );
}

function ImportCsvDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [saving, setSaving] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    try {
      const text = await readFileAsText(f);
      const rows = parseCsv(text);
      setPreview(rows);
    } catch (e: any) {
      toast.error(`Failed to read file: ${e.message}`);
    }
  };

  const downloadTemplate = () => {
    const rows = [
      { shop_name: "Sample Store", owner_name: "John Doe", mobile: "9876543210", address: "123 Main St", credit_limit: "50000" },
    ];
    const csv = toCsv(rows);
    downloadCsv(csv, "customer_import_template.csv");
  };

  const importRows = async () => {
    if (preview.length === 0) return;
    setSaving(true);
    const rowsToInsert = preview.map((r) => ({
      name: r.owner_name || r.shop_name || "Unknown",
      shop_name: r.shop_name || null,
      mobile: r.mobile || null,
      address: r.address || null,
      credit_limit: Number(r.credit_limit) || 0,
      status: "active",
    }));

    const { error } = await supabase.from("customers").insert(rowsToInsert);
    setSaving(false);

    if (error) {
      toast.error(`Import failed: ${error.message}`);
    } else {
      toast.success(`Imported ${rowsToInsert.length} customer${rowsToInsert.length !== 1 ? "s" : ""}`);
      onSaved();
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import Customers from CSV</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Upload a CSV file to bulk-import customers.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5">
              <Download className="size-4" /> Download Template
            </Button>
            <div className="text-xs text-muted-foreground">
              CSV columns: shop_name, owner_name, mobile, address, credit_limit
            </div>
          </div>

          <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center">
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              className="hidden"
              id="csv-upload"
            />
            <Label htmlFor="csv-upload" className="cursor-pointer">
              <Upload className="size-8 mx-auto mb-2 text-muted-foreground" />
              <div className="text-sm font-medium">
                {file ? file.name : "Click to upload CSV"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {file ? `${preview.length} rows parsed` : "or drag and drop"}
              </div>
            </Label>
          </div>

          {preview.length > 0 && (
            <div className="border rounded-md overflow-hidden">
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="text-left px-3 py-2 font-semibold">Shop</th>
                      <th className="text-left px-3 py-2 font-semibold">Owner</th>
                      <th className="text-left px-3 py-2 font-semibold">Mobile</th>
                      <th className="text-right px-3 py-2 font-semibold">Credit Limit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.slice(0, 20).map((row, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 truncate max-w-[200px]">{row.shop_name}</td>
                        <td className="px-3 py-2 truncate max-w-[150px]">{row.owner_name}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.mobile}</td>
                        <td className="px-3 py-2 text-right font-mono">{inr(Number(row.credit_limit) || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 20 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30">
                    Showing 20 of {preview.length} rows
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={importRows} disabled={saving || preview.length === 0}>
            {saving ? "Importing…" : `Import ${preview.length} Customer${preview.length !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
