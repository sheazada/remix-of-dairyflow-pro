import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { inr, shortDate, isoDate } from "@/lib/format";
import { useRealtimeSync } from "@/lib/realtime";
import { AlertTriangle, CheckCircle2, Clock, Truck, XCircle, MapPin, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/delivery-status")({
  component: DeliveryStatusPage,
});

type DeliveryRow = {
  id: string;
  invoice_id: string | null;
  route_id: string | null;
  status: string;
  scheduled_date: string | null;
  delivered_at: string | null;
  assigned_to: string | null;
  collected_amount: number | null;
  invoice: {
    id: string;
    invoice_no: string;
    total: number;
    balance: number;
    customer: { id: string; name: string; shop_name: string | null; mobile: string | null } | null;
  } | null;
  route: { id: string; name: string; driver_name: string | null; vehicle_number: string | null } | null;
};

const ACTIVE = new Set(["planned", "pending", "en_route", "out_for_delivery"]);
const DONE = new Set(["delivered"]);
const PARTIAL = new Set(["partially_delivered", "partial"]);
const FAIL = new Set(["failed"]);

function DeliveryStatusPage() {
  // Live-update when deliveries change.
  useRealtimeSync({
    tableName: "deliveries",
    invalidateKeys: [["delivery-status"]],
  });

  const [date, setDate] = useState(isoDate(new Date()));

  const { data: deliveries, isLoading, refetch } = useQuery({
    queryKey: ["delivery-status", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select(
          "id, invoice_id, route_id, status, scheduled_date, delivered_at, assigned_to, collected_amount, invoice:invoices(id, invoice_no, total, balance, customer:customers(id, name, shop_name, mobile)), route:routes(id, name, driver_name, vehicle_number)"
        )
        .or(`scheduled_date.eq.${date},and(scheduled_date.is.null,created_at.gte.${date}T00:00:00,created_at.lt.${date}T23:59:59)`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DeliveryRow[];
    },
  });

  const rows = deliveries ?? [];
  const now = Date.now();
  const todayIso = isoDate(new Date());
  const isOverdue = (d: DeliveryRow) => {
    if (DONE.has(d.status) || FAIL.has(d.status)) return false;
    if (d.scheduled_date && d.scheduled_date < todayIso) return true;
    // Same-day but planned/en_route past 18:00 → overdue
    const cutoff = new Date(); cutoff.setHours(18, 0, 0, 0);
    if (date === todayIso && ACTIVE.has(d.status) && now > cutoff.getTime()) return true;
    return false;
  };

  const totals = useMemo(() => {
    let planned = 0, enroute = 0, delivered = 0, partial = 0, failed = 0, overdue = 0;
    let cashCollected = 0, outstandingRemaining = 0;
    rows.forEach((d) => {
      if (ACTIVE.has(d.status) && (d.status === "en_route" || d.status === "out_for_delivery")) enroute++;
      else if (ACTIVE.has(d.status)) planned++;
      if (DONE.has(d.status)) delivered++;
      if (PARTIAL.has(d.status)) partial++;
      if (FAIL.has(d.status)) failed++;
      if (isOverdue(d)) overdue++;
      cashCollected += Number(d.collected_amount ?? 0);
      if (!DONE.has(d.status) && d.invoice) outstandingRemaining += Number(d.invoice.balance ?? 0);
    });
    return { total: rows.length, planned, enroute, delivered, partial, failed, overdue, cashCollected, outstandingRemaining };
  }, [rows, date]);

  const byRoute = useMemo(() => {
    const m = new Map<string, { route: DeliveryRow["route"] | null; items: DeliveryRow[] }>();
    rows.forEach((d) => {
      const key = d.route?.id ?? "__unassigned__";
      const bucket = m.get(key) ?? { route: d.route ?? null, items: [] };
      bucket.items.push(d);
      m.set(key, bucket);
    });
    return Array.from(m.values()).sort((a, b) => (a.route?.name ?? "zzz").localeCompare(b.route?.name ?? "zzz"));
  }, [rows]);

  const exceptions = rows.filter((d) => FAIL.has(d.status) || PARTIAL.has(d.status) || isOverdue(d));

  return (
    <PageContainer>
      <PageHeader
        title="Delivery Status"
        description="Live snapshot of routes, stops, and exceptions."
        actions={
          <div className="flex items-center gap-2">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-40" />
            <Button variant="outline" size="sm" onClick={() => refetch()}>Refresh</Button>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Total stops" value={totals.total} icon={Truck} tone="default" />
        <Kpi label="Planned" value={totals.planned} icon={Clock} tone="default" />
        <Kpi label="En route" value={totals.enroute} icon={Truck} tone="primary" />
        <Kpi label="Delivered" value={totals.delivered} icon={CheckCircle2} tone="success" />
        <Kpi label="Partial" value={totals.partial} icon={AlertTriangle} tone="warning" />
        <Kpi label="Failed / Overdue" value={totals.failed + totals.overdue} icon={XCircle} tone="destructive" />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Cash collected today</div>
          <div className="mt-1 text-2xl font-semibold font-mono">{inr(totals.cashCollected)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Outstanding on pending stops</div>
          <div className="mt-1 text-2xl font-semibold font-mono text-destructive">{inr(totals.outstandingRemaining)}</div>
        </Card>
      </div>

      {/* Exceptions */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b bg-destructive/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" />
            <div className="font-semibold text-sm">Exceptions</div>
            <span className="text-xs text-muted-foreground">Failed, partial, or overdue stops</span>
          </div>
          <span className="text-xs font-mono text-muted-foreground">{exceptions.length}</span>
        </div>
        <div className="divide-y">
          {isLoading && <div className="p-6 text-sm text-muted-foreground text-center">Loading…</div>}
          {!isLoading && exceptions.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
              <CheckCircle2 className="size-4 text-success" /> No exceptions — everything on track.
            </div>
          )}
          {exceptions.map((d) => {
            const overdue = isOverdue(d);
            const reason = FAIL.has(d.status) ? "Failed" : PARTIAL.has(d.status) ? "Partially delivered" : "Overdue";
            return (
              <div key={d.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{d.invoice?.customer?.shop_name || d.invoice?.customer?.name || "—"}</span>
                    <StatusBadge status={d.status} />
                    {overdue && !FAIL.has(d.status) && !PARTIAL.has(d.status) && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset bg-destructive/10 text-destructive ring-destructive/20">
                        Overdue
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <span className="font-mono">{d.invoice?.invoice_no ?? "—"}</span>
                    <span className="flex items-center gap-1"><MapPin className="size-3" />{d.route?.name ?? "Unassigned"}</span>
                    {d.assigned_to && <span>Driver · {d.assigned_to}</span>}
                    {d.scheduled_date && <span>Scheduled {shortDate(d.scheduled_date)}</span>}
                    <span>Reason · {reason}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm">{inr(d.invoice?.total ?? 0)}</div>
                  {Number(d.invoice?.balance ?? 0) > 0 && (
                    <div className="text-[11px] text-destructive font-mono">Due {inr(d.invoice?.balance ?? 0)}</div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {d.invoice?.customer?.mobile && (
                    <Button asChild size="sm" variant="ghost" className="h-8">
                      <a href={`tel:${d.invoice.customer.mobile}`}><Phone className="size-3.5" /></a>
                    </Button>
                  )}
                  {d.invoice && (
                    <Button asChild size="sm" variant="outline" className="h-8">
                      <Link to="/invoices/$id" params={{ id: d.invoice.id }}>Open</Link>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* By route breakdown */}
      <div className="space-y-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">By route</div>
        {byRoute.length === 0 && !isLoading && (
          <Card className="p-8 text-center text-sm text-muted-foreground">No deliveries scheduled for this date.</Card>
        )}
        {byRoute.map(({ route, items }) => {
          const c = countByStatus(items, isOverdue);
          const totalAmt = items.reduce((s, d) => s + Number(d.invoice?.total ?? 0), 0);
          const collected = items.reduce((s, d) => s + Number(d.collected_amount ?? 0), 0);
          const progress = items.length > 0 ? Math.round(((c.delivered + c.partial) / items.length) * 100) : 0;
          return (
            <Card key={route?.id ?? "u"} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold">{route?.name ?? "Unassigned"}</div>
                    {route?.vehicle_number && <span className="text-xs text-muted-foreground font-mono">{route.vehicle_number}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {route?.driver_name ? `Driver · ${route.driver_name}` : "No driver assigned"} · {items.length} stops · Invoiced {inr(totalAmt)} · Collected {inr(collected)}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Chip tone="default" label="Planned" value={c.planned} />
                  <Chip tone="primary" label="En route" value={c.enroute} />
                  <Chip tone="success" label="Delivered" value={c.delivered} />
                  <Chip tone="warning" label="Partial" value={c.partial} />
                  <Chip tone="destructive" label="Failed" value={c.failed} />
                  <Chip tone="destructive" label="Overdue" value={c.overdue} />
                </div>
              </div>
              <div className="mt-3">
                <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                  <div className="bg-success" style={{ width: pct(c.delivered, items.length) }} />
                  <div className="bg-warning" style={{ width: pct(c.partial, items.length) }} />
                  <div className="bg-primary" style={{ width: pct(c.enroute, items.length) }} />
                  <div className="bg-destructive" style={{ width: pct(c.failed, items.length) }} />
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>{progress}% completed</span>
                  <Link to="/routes" className="text-primary hover:underline">Open route sheet →</Link>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </PageContainer>
  );
}

function pct(part: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function countByStatus(items: DeliveryRow[], isOverdue: (d: DeliveryRow) => boolean) {
  const c = { planned: 0, enroute: 0, delivered: 0, partial: 0, failed: 0, overdue: 0 };
  items.forEach((d) => {
    if (d.status === "en_route" || d.status === "out_for_delivery") c.enroute++;
    else if (ACTIVE.has(d.status)) c.planned++;
    if (DONE.has(d.status)) c.delivered++;
    if (PARTIAL.has(d.status)) c.partial++;
    if (FAIL.has(d.status)) c.failed++;
    if (isOverdue(d)) c.overdue++;
  });
  return c;
}

type Tone = "default" | "primary" | "success" | "warning" | "destructive";
const toneClasses: Record<Tone, { card: string; icon: string }> = {
  default: { card: "", icon: "text-muted-foreground" },
  primary: { card: "border-primary/30", icon: "text-primary" },
  success: { card: "border-success/30 bg-success/5", icon: "text-success" },
  warning: { card: "border-warning/40 bg-warning/5", icon: "text-warning" },
  destructive: { card: "border-destructive/30 bg-destructive/5", icon: "text-destructive" },
};

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: Tone }) {
  const t = toneClasses[tone];
  return (
    <Card className={cn("p-4", t.card)}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</div>
        <Icon className={cn("size-4", t.icon)} />
      </div>
      <div className="mt-1 text-2xl font-semibold font-mono">{value}</div>
    </Card>
  );
}

function Chip({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  if (value === 0) return null;
  const map: Record<Tone, string> = {
    default: "bg-muted text-muted-foreground ring-border",
    primary: "bg-primary-soft text-primary ring-primary/20",
    success: "bg-success/10 text-success ring-success/20",
    warning: "bg-warning/15 text-warning-foreground ring-warning/30",
    destructive: "bg-destructive/10 text-destructive ring-destructive/20",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset", map[tone])}>
      {label} <span className="font-mono">{value}</span>
    </span>
  );
}
