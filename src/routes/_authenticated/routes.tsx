import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
const RunMap = lazy(() => import("@/components/RunMap"));
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inr, num, isoDate, shortDate, genDocNo } from "@/lib/format";
import { ArrowDown, ArrowUp, Camera, CheckCircle2, Clock, Crosshair, Download, GripVertical, History, LocateFixed, MapPin, Package, Pencil, Play, Plus, Printer, Route as RouteIcon, Sparkles, Square, Trash2, Truck, UserPlus, Wallet, Wand2, XCircle } from "lucide-react";
import { optimizeStops } from "@/lib/route-optimize";
import { getCurrentPosition, captureGpsWithAudit, logGpsAudit, fmtLatLng, gmapsUrl, haversineKm } from "@/lib/geo";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { enqueueDeliveryNotifications, processQueuedNotifications } from "@/lib/notifications.functions";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export const Route = createFileRoute("/_authenticated/routes")({
  component: RoutePlanning,
});

type RouteRow = {
  id: string;
  name: string;
  area: string | null;
  driver_name: string | null;
  helper_name: string | null;
  active: boolean;
  notes: string | null;
  capacity_units: number | null;
  capacity_label: string | null;
  max_stops: number | null;
  vehicle_number: string | null;
  vehicle_type: string | null;
  start_latitude: number | null;
  start_longitude: number | null;
};

type DeliveryRun = {
  id: string;
  route_id: string;
  run_date: string;
  driver_name: string | null;
  helper_name: string | null;
  vehicle_number: string | null;
  vehicle_type: string | null;
  odometer_start: number | null;
  odometer_end: number | null;
  started_at: string | null;
  ended_at: string | null;
  status: string;
  delivery_status?: string | null;
  notes: string | null;
  pickup_confirmed_at: string | null;
  start_latitude: number | null;
  start_longitude: number | null;
  start_accuracy_m: number | null;
  end_latitude: number | null;
  end_longitude: number | null;
  end_accuracy_m: number | null;
};


type Stop = {
  id: string;
  route_id: string;
  customer_id: string;
  sequence: number;
  customer: {
    id: string;
    name: string;
    shop_name: string | null;
    address: string | null;
    mobile: string | null;
    outstanding: number;
    latitude: number | null;
    longitude: number | null;
  } | null;
};

function RoutePlanning() {
  const [tab, setTab] = useState<"plan" | "sheet">("plan");
  const [date, setDate] = useState(isoDate());

  return (
    <PageContainer>
      <PageHeader
        title="Route Planning"
        description="Group shops into delivery routes and generate daily driver sheets"
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "plan" | "sheet")}>
        <TabsList>
          <TabsTrigger value="plan"><MapPin className="size-4" /> Plan Routes</TabsTrigger>
          <TabsTrigger value="sheet"><Truck className="size-4" /> Daily Sheet</TabsTrigger>
        </TabsList>

        <TabsContent value="plan" className="mt-4">
          <PlanTab />
        </TabsContent>

        <TabsContent value="sheet" className="mt-4">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="sheet-date">Date</Label>
              <Input id="sheet-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
            </div>
            <Button variant="outline" onClick={() => window.print()} className="gap-1.5">
              <Printer className="size-4" /> Print all
            </Button>
          </div>
          <SheetTab date={date} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

/* ---------------- Plan tab ---------------- */

function PlanTab() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<RouteRow | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: routes } = useQuery({
    queryKey: ["routes"],
    queryFn: async (): Promise<RouteRow[]> => {
      const { data, error } = await supabase.from("routes").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const activeId = selectedId ?? routes?.[0]?.id ?? null;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["routes"] });

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      {/* Routes list */}
      <Card className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Routes</div>
          <Button size="sm" variant="outline" onClick={() => setCreating(true)} className="gap-1"><Plus className="size-3.5" /> New</Button>
        </div>
        <div className="space-y-1">
          {(routes ?? []).length === 0 && (
            <div className="text-xs text-muted-foreground px-2 py-6 text-center">No routes yet.</div>
          )}
          {(routes ?? []).map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={`w-full text-left px-2.5 py-2 rounded-lg text-sm transition-colors ${
                activeId === r.id ? "bg-secondary font-medium" : "hover:bg-muted"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{r.name}</span>
                {!r.active && <Badge variant="outline" className="text-[10px]">off</Badge>}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">{r.area || "—"}</div>
              <div className="text-[11px] text-muted-foreground truncate">
                {r.driver_name ? `🚛 ${r.driver_name}` : "no driver"}
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Detail */}
      <div>
        {activeId ? (
          <RouteDetail routeId={activeId} route={routes?.find((r) => r.id === activeId) ?? null} onEdit={setEditing} />
        ) : (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            Create your first route to start assigning shops.
          </Card>
        )}
      </div>

      <RouteFormDialog
        open={creating || !!editing}
        route={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={(id) => { invalidate(); if (id) setSelectedId(id); }}
      />
    </div>
  );
}

function SortableStopRow({
  stop,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onRemove,
  onSetGps,
}: {
  stop: Stop;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onSetGps: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : "auto" as const,
  };
  const hasGps = typeof stop.customer?.latitude === "number" && typeof stop.customer?.longitude === "number";
  return (
    <li ref={setNodeRef} style={style} className={`px-5 py-3 flex items-center gap-3 bg-background ${isDragging ? "shadow-lg" : ""}`}>
      <button
        type="button"
        className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0 p-1 -ml-1"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="size-8 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold shrink-0">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate flex items-center gap-1.5">
          {stop.customer?.shop_name || stop.customer?.name}
          {hasGps && <MapPin className="size-3 text-primary" aria-label="GPS captured" />}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {stop.customer?.address || "—"}
          {stop.customer?.mobile ? ` · ${stop.customer.mobile}` : ""}
        </div>
      </div>
      <div className="text-xs text-right shrink-0">
        <div className="text-muted-foreground">Due</div>
        <div className="font-mono font-semibold">{inr(stop.customer?.outstanding ?? 0)}</div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onSetGps}
          aria-label={hasGps ? "Update GPS" : "Capture GPS at this shop"}
          title={hasGps ? "Update GPS from current location" : "Capture GPS at this shop"}
          className={hasGps ? "text-primary" : ""}
        >
          <Crosshair className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onMoveUp} disabled={index === 0} aria-label="Move up"><ArrowUp className="size-4" /></Button>
        <Button variant="ghost" size="icon" onClick={onMoveDown} disabled={index === total - 1} aria-label="Move down"><ArrowDown className="size-4" /></Button>
        <Button variant="ghost" size="icon" onClick={onRemove} className="text-destructive" aria-label="Remove"><Trash2 className="size-4" /></Button>
      </div>
    </li>
  );
}



function RouteDetail({ routeId, route, onEdit }: { routeId: string; route: RouteRow | null; onEdit: (r: RouteRow) => void }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const { data: stops } = useQuery({
    queryKey: ["route-stops", routeId],
    queryFn: async (): Promise<Stop[]> => {
      const { data, error } = await supabase
        .from("route_stops")
        .select("id, route_id, customer_id, sequence, customer:customers(id, name, shop_name, address, mobile, outstanding, latitude, longitude)")
        .eq("route_id", routeId)
        .order("sequence");
      if (error) throw error;
      return (data ?? []) as unknown as Stop[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["route-stops", routeId] });

  const move = async (id: string, dir: -1 | 1) => {
    const list = stops ?? [];
    const idx = list.findIndex((s) => s.id === id);
    const swap = list[idx + dir];
    if (!swap) return;
    const a = list[idx];
    await Promise.all([
      supabase.from("route_stops").update({ sequence: swap.sequence }).eq("id", a.id),
      supabase.from("route_stops").update({ sequence: a.sequence }).eq("id", swap.id),
    ]);
    invalidate();
  };

  const persistOrder = async (ordered: Stop[]) => {
    // Two-phase to avoid unique(route_id, sequence) collisions if such a constraint exists.
    const offset = 100000;
    const phase1 = ordered.map((s, i) =>
      supabase.from("route_stops").update({ sequence: offset + i + 1 }).eq("id", s.id),
    );
    const r1 = await Promise.all(phase1);
    if (r1.some((r) => r.error)) {
      toast.error("Failed to reorder stops");
      invalidate();
      return;
    }
    const phase2 = ordered.map((s, i) =>
      supabase.from("route_stops").update({ sequence: i + 1 }).eq("id", s.id),
    );
    const r2 = await Promise.all(phase2);
    if (r2.some((r) => r.error)) {
      toast.error("Failed to finalize stop order");
    } else {
      toast.success("Stop order updated");
    }
    invalidate();
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const list = stops ?? [];
    const oldIndex = list.findIndex((s) => s.id === active.id);
    const newIndex = list.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(list, oldIndex, newIndex);
    // Optimistic update
    qc.setQueryData(["route-stops", routeId], reordered.map((s, i) => ({ ...s, sequence: i + 1 })));
    persistOrder(reordered);
  };

  const remove = async (id: string) => {
    await supabase.from("route_stops").delete().eq("id", id);
    invalidate();
    toast.success("Stop removed");
  };

  const [optimizing, setOptimizing] = useState(false);
  const optimize = async () => {
    const list = stops ?? [];
    if (list.length < 2) return toast.info("Need at least 2 stops to optimize");
    const withGeo = list.filter(
      (s) => typeof s.customer?.latitude === "number" && typeof s.customer?.longitude === "number",
    ).length;
    if (withGeo < 2) {
      return toast.error(
        "Add GPS to at least 2 shops first — tap the crosshair on each stop while standing there.",
      );
    }
    setOptimizing(true);
    const res = optimizeStops(
      list.map((s) => ({
        id: s.id,
        lat: s.customer?.latitude ?? null,
        lng: s.customer?.longitude ?? null,
        _raw: s,
      })),
      route?.start_latitude != null && route?.start_longitude != null
        ? { lat: route.start_latitude, lng: route.start_longitude }
        : null,
    );
    const orderedStops = res.ordered.map((o: any) => o._raw as Stop);
    qc.setQueryData(
      ["route-stops", routeId],
      orderedStops.map((s, i) => ({ ...s, sequence: i + 1 })),
    );
    await persistOrder(orderedStops);
    setOptimizing(false);
    const saved = Math.max(0, res.beforeKm - res.afterKm);
    toast.success(
      `Optimized ${res.optimizedCount} stops · ${res.afterKm.toFixed(1)} km` +
        (saved > 0.05 ? ` (saved ${saved.toFixed(1)} km)` : "") +
        (res.skippedCount ? ` · ${res.skippedCount} without GPS kept at end` : ""),
    );
  };

  const setStopGps = async (customerId: string) => {
    toast.info("Getting current location…");
    const { fix, error } = await captureGpsWithAudit("shop_geotag", { customer_id: customerId, route_id: route?.id ?? null });
    if (!fix) return toast.error(error?.message || "Could not get location");
    const { error: uErr } = await supabase
      .from("customers")
      .update({ latitude: fix.latitude, longitude: fix.longitude })
      .eq("id", customerId);
    if (uErr) return toast.error(uErr.message);
    toast.success(`Saved GPS · ${fix.latitude.toFixed(5)}, ${fix.longitude.toFixed(5)}`);
    invalidate();
  };

  const total = stops?.length ?? 0;
  const outstanding = (stops ?? []).reduce((s, x) => s + Number(x.customer?.outstanding ?? 0), 0);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-lg font-semibold flex items-center gap-2">
              {route?.name}
              {route && !route.active && <Badge variant="outline">Inactive</Badge>}
            </div>
            <div className="text-sm text-muted-foreground">{route?.area || "No area"}</div>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>Driver: <b className="text-foreground">{route?.driver_name || "—"}</b></span>
              <span>Helper: <b className="text-foreground">{route?.helper_name || "—"}</b></span>
              <span>Vehicle: <b className="text-foreground">{route?.vehicle_number || "—"}{route?.vehicle_type ? ` · ${route.vehicle_type}` : ""}</b></span>
              <span>Stops: <b className="text-foreground">{total}</b></span>
              <span>Capacity: <b className="text-foreground">{route?.capacity_units ? `${num(route.capacity_units, 0)} ${route.capacity_label || ""}` : "—"}</b></span>
              <span>Outstanding: <b className="text-foreground">{inr(outstanding)}</b></span>
            </div>

            {route?.notes && <div className="mt-2 text-xs text-muted-foreground italic">{route.notes}</div>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => route && onEdit(route)}>Edit route</Button>
            <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1"><UserPlus className="size-4" /> Add stops</Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold">Stops in delivery order</div>
            <div className="text-xs text-muted-foreground">Drag <GripVertical className="inline size-3 -mt-0.5" /> to reorder, use arrows, or auto-optimize by GPS.</div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={optimize}
            disabled={optimizing || (stops ?? []).length < 2}
            className="gap-1.5"
            title="Reorder stops using shortest-drive heuristic (nearest-neighbor + 2-opt) based on GPS"
          >
            <Wand2 className="size-4" />
            {optimizing ? "Optimizing…" : "Optimize sequence"}
          </Button>
        </div>
        {(stops ?? []).length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No stops yet. Click "Add stops" to assign shops.</div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={(stops ?? []).map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <ol className="divide-y">
                {(stops ?? []).map((s, i) => (
                  <SortableStopRow
                    key={s.id}
                    stop={s}
                    index={i}
                    total={stops?.length ?? 0}
                    onMoveUp={() => move(s.id, -1)}
                    onMoveDown={() => move(s.id, 1)}
                    onRemove={() => remove(s.id)}
                    onSetGps={() => setStopGps(s.customer_id)}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}
      </Card>


      <AddStopsDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        routeId={routeId}
        existing={new Set((stops ?? []).map((s) => s.customer_id))}
        nextSeq={(stops ?? []).length}
        onSaved={invalidate}
      />
    </div>
  );
}

function RouteFormDialog({
  open, route, onClose, onSaved,
}: {
  open: boolean; route: RouteRow | null; onClose: () => void; onSaved: (id?: string) => void;
}) {
  const isEdit = !!route;
  const [name, setName] = useState(route?.name ?? "");
  const [area, setArea] = useState(route?.area ?? "");
  const [driver, setDriver] = useState(route?.driver_name ?? "");
  const [helper, setHelper] = useState(route?.helper_name ?? "");
  const [active, setActive] = useState(route?.active ?? true);
  const [notes, setNotes] = useState(route?.notes ?? "");
  const [capacity, setCapacity] = useState<string>(route?.capacity_units != null ? String(route.capacity_units) : "");
  const [capacityLabel, setCapacityLabel] = useState(route?.capacity_label ?? "L");
  const [maxStops, setMaxStops] = useState<string>(route?.max_stops != null ? String(route.max_stops) : "");
  const [vehicleNumber, setVehicleNumber] = useState(route?.vehicle_number ?? "");
  const [vehicleType, setVehicleType] = useState(route?.vehicle_type ?? "");
  const [startLat, setStartLat] = useState<string>(route?.start_latitude != null ? String(route.start_latitude) : "");
  const [startLng, setStartLng] = useState<string>(route?.start_longitude != null ? String(route.start_longitude) : "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(route?.name ?? "");
      setArea(route?.area ?? "");
      setDriver(route?.driver_name ?? "");
      setHelper(route?.helper_name ?? "");
      setActive(route?.active ?? true);
      setNotes(route?.notes ?? "");
      setCapacity(route?.capacity_units != null ? String(route.capacity_units) : "");
      setCapacityLabel(route?.capacity_label ?? "L");
      setMaxStops(route?.max_stops != null ? String(route.max_stops) : "");
      setVehicleNumber(route?.vehicle_number ?? "");
      setVehicleType(route?.vehicle_type ?? "");
      setStartLat(route?.start_latitude != null ? String(route.start_latitude) : "");
      setStartLng(route?.start_longitude != null ? String(route.start_longitude) : "");
    }
  }, [open, route]);

  const captureStartHere = async () => {
    toast.info("Getting current location…");
    const { fix, error } = await captureGpsWithAudit("route_start_point", { route_id: route?.id ?? null });
    if (!fix) return toast.error(error?.message || "Could not get location");
    setStartLat(fix.latitude.toFixed(6));
    setStartLng(fix.longitude.toFixed(6));
    toast.success("Start point set to current location");
  };

  const save = async () => {
    if (!name.trim()) return toast.error("Name required");
    setSaving(true);
    const payload = {
      name: name.trim(), area: area || null, driver_name: driver || null, helper_name: helper || null,
      active, notes: notes || null,
      capacity_units: capacity ? Number(capacity) : null,
      capacity_label: capacityLabel || null,
      max_stops: maxStops.trim() ? Number(maxStops) : null,
      vehicle_number: vehicleNumber || null,
      vehicle_type: vehicleType || null,
      start_latitude: startLat.trim() ? Number(startLat) : null,
      start_longitude: startLng.trim() ? Number(startLng) : null,
    };

    if (isEdit && route) {
      const { error } = await supabase.from("routes").update(payload).eq("id", route.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      onSaved(route.id);
    } else {
      const { data, error } = await supabase.from("routes").insert(payload).select().single();
      setSaving(false);
      if (error) return toast.error(error.message);
      onSaved(data?.id);
    }
    toast.success(isEdit ? "Route updated" : "Route created");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? "Edit route" : "New route"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Barari South" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Area</Label><Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Barari" /></div>
            <div><Label>Status</Label>
              <Select value={active ? "1" : "0"} onValueChange={(v) => setActive(v === "1")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Active</SelectItem>
                  <SelectItem value="0">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Driver</Label><Input value={driver} onChange={(e) => setDriver(e.target.value)} /></div>
            <div><Label>Helper</Label><Input value={helper} onChange={(e) => setHelper(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><Label>Vehicle capacity</Label><Input type="number" inputMode="decimal" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="e.g. 400" /></div>
            <div><Label>Unit</Label><Input value={capacityLabel} onChange={(e) => setCapacityLabel(e.target.value)} placeholder="L / crates / kg" /></div>
          </div>
          <div><Label>Max stops per run</Label><Input type="number" inputMode="numeric" value={maxStops} onChange={(e) => setMaxStops(e.target.value)} placeholder="e.g. 25 (leave blank for no limit)" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Vehicle number</Label><Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())} placeholder="e.g. BR10AB1234" /></div>
            <div><Label>Vehicle type</Label>
              <Select value={vehicleType || "none"} onValueChange={(v) => setVehicleType(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="bike">Bike</SelectItem>
                  <SelectItem value="auto">Auto / Rickshaw</SelectItem>
                  <SelectItem value="tempo">Tempo</SelectItem>
                  <SelectItem value="mini_truck">Mini truck</SelectItem>
                  <SelectItem value="truck">Truck</SelectItem>
                  <SelectItem value="van">Refrigerated van</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Start point (depot / pickup)</Label>
              <Button type="button" variant="outline" size="sm" onClick={captureStartHere} className="gap-1.5 h-8">
                <LocateFixed className="size-3.5" /> Use my location
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Latitude</Label><Input value={startLat} onChange={(e) => setStartLat(e.target.value)} placeholder="e.g. 25.2425" inputMode="decimal" /></div>
              <div><Label className="text-xs">Longitude</Label><Input value={startLng} onChange={(e) => setStartLng(e.target.value)} placeholder="e.g. 86.9842" inputMode="decimal" /></div>
            </div>
            <p className="text-xs text-muted-foreground">Used by the sequence optimizer as the driver's starting point.</p>
          </div>
          <div><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Landmarks, timing…" /></div>

        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddStopsDialog({
  open, onClose, routeId, existing, nextSeq, onSaved,
}: {
  open: boolean; onClose: () => void; routeId: string; existing: Set<string>; nextSeq: number; onSaved: () => void;
}) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const { data: customers } = useQuery({
    queryKey: ["customers-picker"],
    queryFn: async () => {
      const { data } = await supabase
        .from("customers").select("id, name, shop_name, address, outstanding")
        .eq("status", "active").order("name");
      return data ?? [];
    },
    enabled: open,
  });

  useMemo(() => { if (open) { setPicked(new Set()); setQ(""); } }, [open]);

  const filtered = (customers ?? []).filter((c: any) => {
    if (existing.has(c.id)) return false;
    const s = (q || "").toLowerCase();
    if (!s) return true;
    return (c.name?.toLowerCase().includes(s) || c.shop_name?.toLowerCase().includes(s) || c.address?.toLowerCase().includes(s));
  });

  const toggle = (id: string) => {
    const n = new Set(picked);
    n.has(id) ? n.delete(id) : n.add(id);
    setPicked(n);
  };

  const save = async () => {
    if (picked.size === 0) return onClose();
    setSaving(true);
    const rows = Array.from(picked).map((cid, i) => ({
      route_id: routeId, customer_id: cid, sequence: nextSeq + i + 1,
    }));
    const { error } = await supabase.from("route_stops").insert(rows);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Added ${picked.size} shop${picked.size === 1 ? "" : "s"}`);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add shops to route</DialogTitle></DialogHeader>
        <Input placeholder="Search shops…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="max-h-80 overflow-auto border rounded-lg divide-y">
          {filtered.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No matching shops.</div>}
          {filtered.map((c: any) => (
            <label key={c.id} className="flex items-center gap-3 p-3 hover:bg-muted/40 cursor-pointer">
              <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} className="size-4" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{c.shop_name || c.name}</div>
                <div className="text-xs text-muted-foreground truncate">{c.address || "—"}</div>
              </div>
              <div className="text-xs font-mono">{inr(c.outstanding)}</div>
            </label>
          ))}
        </div>
        <DialogFooter>
          <div className="flex-1 text-xs text-muted-foreground">{picked.size} selected</div>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Sheet tab ---------------- */

type InvoiceRow = {
  id: string;
  invoice_no: string;
  invoice_date: string;
  total: number;
  balance: number;
  customer_id: string;
  customer: { id: string; name: string; shop_name: string | null; address: string | null; mobile: string | null; outstanding: number; latitude: number | null; longitude: number | null } | null;
  items: { id: string; product_name: string; quantity: number; ordered_quantity: number | null; delivered_quantity: number | null; rate: number; amount: number }[];
};

function SheetTab({ date }: { date: string }) {
  const { data: routes } = useQuery({
    queryKey: ["routes-active"],
    queryFn: async () => {
      const { data } = await supabase.from("routes").select("*").eq("active", true).order("name");
      return (data ?? []) as RouteRow[];
    },
  });

  const { data: stops } = useQuery({
    queryKey: ["all-route-stops-with-addr"],
    queryFn: async () => {
      const { data } = await supabase
        .from("route_stops")
        .select("route_id, customer_id, sequence, customer:customers(id, address, latitude, longitude)")
        .order("sequence");
      return data ?? [];
    },
  });

  const { data: invoices } = useQuery({
    queryKey: ["invoices-for-sheet", date],
    queryFn: async (): Promise<InvoiceRow[]> => {
      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_no, invoice_date, total, balance, customer_id, customer:customers(id, name, shop_name, address, mobile, outstanding, latitude, longitude), items:invoice_items(id, product_name, quantity, ordered_quantity, delivered_quantity, rate, amount)")
        .eq("invoice_date", date)
        .neq("status", "void");
      return (data ?? []) as unknown as InvoiceRow[];
    },
  });

  const custToRoute = useMemo(() => {
    const m = new Map<string, { route_id: string; sequence: number }>();
    (stops ?? []).forEach((s: any) => {
      const prev = m.get(s.customer_id);
      if (!prev || prev.sequence > s.sequence) m.set(s.customer_id, { route_id: s.route_id, sequence: s.sequence });
    });
    return m;
  }, [stops]);

  const grouped = useMemo(() => {
    const byRoute = new Map<string, InvoiceRow[]>();
    const unassigned: InvoiceRow[] = [];
    (invoices ?? []).forEach((inv) => {
      const link = custToRoute.get(inv.customer_id);
      if (!link) unassigned.push(inv);
      else {
        const arr = byRoute.get(link.route_id) ?? [];
        arr.push(inv);
        byRoute.set(link.route_id, arr);
      }
    });
    // sort each route by stop sequence
    for (const [rid, arr] of byRoute) {
      arr.sort((a, b) => (custToRoute.get(a.customer_id)?.sequence ?? 0) - (custToRoute.get(b.customer_id)?.sequence ?? 0));
      byRoute.set(rid, arr);
    }
    return { byRoute, unassigned };
  }, [invoices, custToRoute]);

  const qc = useQueryClient();
  const [assigning, setAssigning] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [undoPreviewOpen, setUndoPreviewOpen] = useState(false);
  const [lastAssign, setLastAssign] = useState<{
    date: string;
    createdStops: { route_id: string; customer_id: string }[];
    deliveryPrev: { id: string; customer_id: string; invoice_no: string | null; prev_route_id: string | null; new_route_id: string }[];
    total: number;
  } | null>(null);


  const tokens = (s?: string | null) =>
    (s ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3);

  const autoAssign = async () => {
    const unassigned = grouped.unassigned;
    const active = (routes ?? []).filter((r) => r.active);
    if (unassigned.length === 0) return toast.info("Nothing to assign — every shop already has a route.");
    if (active.length === 0) return toast.error("No active routes to assign to.");

    // Build per-route address vocabulary, load, next-sequence, and geo cluster
    const routeVocab = new Map<string, Set<string>>();
    const routeLoad = new Map<string, number>();
    const routeNextSeq = new Map<string, number>();
    const routePoints = new Map<string, { lat: number; lng: number }[]>();
    active.forEach((r) => {
      const set = new Set<string>(tokens(r.area));
      routeVocab.set(r.id, set);
      routeLoad.set(r.id, 0);
      routeNextSeq.set(r.id, 0);
      const pts: { lat: number; lng: number }[] = [];
      if (r.start_latitude != null && r.start_longitude != null) {
        pts.push({ lat: Number(r.start_latitude), lng: Number(r.start_longitude) });
      }
      routePoints.set(r.id, pts);
    });
    (stops ?? []).forEach((s: any) => {
      const set = routeVocab.get(s.route_id);
      if (set) tokens(s.customer?.address).forEach((t) => set.add(t));
      routeLoad.set(s.route_id, (routeLoad.get(s.route_id) ?? 0) + 1);
      routeNextSeq.set(s.route_id, Math.max(routeNextSeq.get(s.route_id) ?? 0, s.sequence ?? 0));
      const lat = s.customer?.latitude;
      const lng = s.customer?.longitude;
      if (lat != null && lng != null) {
        const arr = routePoints.get(s.route_id);
        if (arr) arr.push({ lat: Number(lat), lng: Number(lng) });
      }
    });
    // Include today's already-planned load
    (invoices ?? []).forEach((inv) => {
      const link = custToRoute.get(inv.customer_id);
      if (link) routeLoad.set(link.route_id, (routeLoad.get(link.route_id) ?? 0) + 1);
    });

    // Precompute route centroids from cluster points
    const routeCentroid = new Map<string, { lat: number; lng: number } | null>();
    for (const r of active) {
      const pts = routePoints.get(r.id) ?? [];
      if (pts.length === 0) { routeCentroid.set(r.id, null); continue; }
      const lat = pts.reduce((a, p) => a + p.lat, 0) / pts.length;
      const lng = pts.reduce((a, p) => a + p.lng, 0) / pts.length;
      routeCentroid.set(r.id, { lat, lng });
    }

    // Nearest existing stop distance (km) — better than centroid for spread-out routes
    const nearestKm = (rid: string, lat: number, lng: number) => {
      const pts = routePoints.get(rid) ?? [];
      if (pts.length === 0) return null;
      let min = Infinity;
      for (const p of pts) {
        const d = haversineKm(lat, lng, p.lat, p.lng);
        if (d < min) min = d;
      }
      return min;
    };

    const routeLimit = (r: RouteRow) => {
      const cap = Number(r.capacity_units || 0);
      const ms = Number(r.max_stops || 0);
      const limits = [cap, ms].filter((n) => n > 0);
      return limits.length ? Math.min(...limits) : Infinity;
    };

    const pickRoute = (cust: { address?: string | null; latitude?: number | null; longitude?: number | null } | null | undefined) => {
      const address = cust?.address ?? null;
      const cLat = cust?.latitude != null ? Number(cust.latitude) : null;
      const cLng = cust?.longitude != null ? Number(cust.longitude) : null;
      const custTokens = tokens(address);
      let best: { rid: string; score: number } | null = null;
      for (const r of active) {
        // Hard capacity guard — never assign to a route already at its per-run limit.
        const load = routeLoad.get(r.id) ?? 0;
        const limit = routeLimit(r);
        if (load >= limit) continue;

        const vocab = routeVocab.get(r.id)!;
        let overlap = 0;
        custTokens.forEach((t) => { if (vocab.has(t)) overlap += 1; });
        // area substring bonus
        const areaLc = (r.area ?? "").toLowerCase().trim();
        const addrLc = (address ?? "").toLowerCase();
        const areaBonus = areaLc && addrLc.includes(areaLc) ? 5 : 0;
        // soft near-capacity penalty (kicks in in the last 20% of slots)
        const nearCap = Number.isFinite(limit) && load >= Math.max(1, Math.floor(limit * 0.8)) ? -3 : 0;

        // distance score — dominant signal when both sides have coordinates
        let distScore = 0;
        if (cLat != null && cLng != null) {
          const near = nearestKm(r.id, cLat, cLng);
          const centroid = routeCentroid.get(r.id) ?? null;
          const centDist = centroid ? haversineKm(cLat, cLng, centroid.lat, centroid.lng) : null;
          // Weighted blend: nearest stop dominates, centroid smooths
          const d = near != null && centDist != null ? near * 0.7 + centDist * 0.3
                  : near ?? centDist;
          if (d != null) {
            // Convert km → score: 0km ≈ +25, 5km ≈ +5, 10km ≈ -5, capped at -15
            distScore = Math.max(-15, 25 - d * 4);
          }
        }

        const score = distScore + overlap * 2 + areaBonus - load * 0.05 + nearCap;
        if (!best || score > best.score) best = { rid: r.id, score };
      }
      return best?.rid ?? null;
    };


    setAssigning(true);
    try {
      // Fetch delivery rows for unassigned invoices to update route_id
      const invIds = unassigned.map((i) => i.id);
      const { data: delRows } = await supabase
        .from("deliveries")
        .select("id, invoice_id")
        .in("invoice_id", invIds);
      const delByInv = new Map<string, string>();
      (delRows ?? []).forEach((d: any) => delByInv.set(d.invoice_id, d.id));

      const stopInserts: { route_id: string; customer_id: string; sequence: number }[] = [];
      const deliveryUpdates = new Map<string, string[]>(); // route_id -> delivery ids
      const delMeta = new Map<string, { customer_id: string; invoice_no: string | null; new_route_id: string }>();
      const perRouteCount = new Map<string, number>();
      const seen = new Set<string>(); // route+customer dedupe
      let skipped = 0;

      for (const inv of unassigned) {
        const rid = pickRoute(inv.customer);
        if (!rid) { skipped += 1; continue; }
        const key = `${rid}::${inv.customer_id}`;
        if (!seen.has(key)) {
          seen.add(key);
          const next = (routeNextSeq.get(rid) ?? 0) + 1;
          routeNextSeq.set(rid, next);
          stopInserts.push({ route_id: rid, customer_id: inv.customer_id, sequence: next });
        }
        const delId = delByInv.get(inv.id);
        if (delId) {
          const arr = deliveryUpdates.get(rid) ?? [];
          arr.push(delId);
          deliveryUpdates.set(rid, arr);
          delMeta.set(delId, { customer_id: inv.customer_id, invoice_no: (inv as any).invoice_no ?? null, new_route_id: rid });
        }
        // Reserve a slot on the chosen route so subsequent picks respect capacity.
        routeLoad.set(rid, (routeLoad.get(rid) ?? 0) + 1);
        perRouteCount.set(rid, (perRouteCount.get(rid) ?? 0) + 1);
      }

      // Determine which stops are genuinely new (for undo)
      let createdStops: { route_id: string; customer_id: string }[] = [];
      if (stopInserts.length > 0) {
        const custIds = Array.from(new Set(stopInserts.map((s) => s.customer_id)));
        const { data: existing } = await supabase
          .from("route_stops")
          .select("route_id, customer_id")
          .in("customer_id", custIds);
        const existingSet = new Set((existing ?? []).map((e: any) => `${e.route_id}::${e.customer_id}`));
        createdStops = stopInserts
          .filter((s) => !existingSet.has(`${s.route_id}::${s.customer_id}`))
          .map((s) => ({ route_id: s.route_id, customer_id: s.customer_id }));

        const { error } = await supabase
          .from("route_stops")
          .upsert(stopInserts, { onConflict: "route_id,customer_id", ignoreDuplicates: true });
        if (error) throw error;
      }

      // Capture previous route_id for deliveries about to be updated (for undo)
      const allDelIds = Array.from(new Set(Array.from(deliveryUpdates.values()).flat()));
      let deliveryPrev: { id: string; customer_id: string; invoice_no: string | null; prev_route_id: string | null; new_route_id: string }[] = [];
      if (allDelIds.length > 0) {
        const { data: prevRows } = await supabase
          .from("deliveries")
          .select("id, route_id")
          .in("id", allDelIds);
        deliveryPrev = (prevRows ?? []).map((r: any) => {
          const meta = delMeta.get(r.id);
          return {
            id: r.id,
            customer_id: meta?.customer_id ?? "",
            invoice_no: meta?.invoice_no ?? null,
            prev_route_id: r.route_id,
            new_route_id: meta?.new_route_id ?? "",
          };
        });
      }

      for (const [rid, ids] of deliveryUpdates) {
        if (ids.length === 0) continue;
        const { error } = await supabase.from("deliveries").update({ route_id: rid }).in("id", ids);
        if (error) throw error;
      }

      const routesTouched = perRouteCount.size;
      const total = Array.from(perRouteCount.values()).reduce((a, b) => a + b, 0);
      setLastAssign({ date, createdStops, deliveryPrev, total });

      toast.success(`Auto-assigned ${total} shop${total === 1 ? "" : "s"} across ${routesTouched} route${routesTouched === 1 ? "" : "s"}.`);
      if (skipped > 0) {
        toast.warning(`${skipped} shop${skipped === 1 ? "" : "s"} skipped — all eligible routes are at capacity or max stops. Raise the limits or add a route.`);
      }
      qc.invalidateQueries({ queryKey: ["all-route-stops-with-addr"] });
      qc.invalidateQueries({ queryKey: ["deliveries-for-sheet", date] });
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      qc.invalidateQueries({ queryKey: ["route-stops"] });
    } catch (e: any) {
      toast.error(e?.message || "Auto-assign failed");
    } finally {
      setAssigning(false);
    }
  };

  const undoAutoAssign = async () => {
    if (!lastAssign || lastAssign.date !== date) return;
    setUndoing(true);
    try {
      // Restore delivery route_id assignments
      const groups = new Map<string, string[]>(); // prev_route_id ("" for null) -> ids
      lastAssign.deliveryPrev.forEach((d) => {
        const k = d.prev_route_id ?? "";
        const arr = groups.get(k) ?? [];
        arr.push(d.id);
        groups.set(k, arr);
      });
      for (const [prev, ids] of groups) {
        const { error } = await supabase
          .from("deliveries")
          .update({ route_id: prev === "" ? null : prev })
          .in("id", ids);
        if (error) throw error;
      }
      // Remove newly created route_stops
      for (const s of lastAssign.createdStops) {
        const { error } = await supabase
          .from("route_stops")
          .delete()
          .eq("route_id", s.route_id)
          .eq("customer_id", s.customer_id);
        if (error) throw error;
      }
      toast.success(`Reverted auto-assign of ${lastAssign.total} shop${lastAssign.total === 1 ? "" : "s"}.`);
      setLastAssign(null);
      qc.invalidateQueries({ queryKey: ["all-route-stops-with-addr"] });
      qc.invalidateQueries({ queryKey: ["deliveries-for-sheet", date] });
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      qc.invalidateQueries({ queryKey: ["route-stops"] });
    } catch (e: any) {
      toast.error(e?.message || "Undo failed");
    } finally {
      setUndoing(false);
    }
  };

  if (!invoices) return <Card className="p-10 text-center text-sm text-muted-foreground">Loading…</Card>;
  if (invoices.length === 0)
    return <Card className="p-10 text-center text-sm text-muted-foreground">No invoices for {shortDate(date)}.</Card>;

  return (
    <div className="space-y-4">
      {grouped.unassigned.length > 0 && (
        <Card className="p-3 flex flex-wrap items-center gap-3 bg-primary/5 border-primary/20">
          <Sparkles className="size-4 text-primary shrink-0" />
          <div className="text-sm flex-1 min-w-0">
            <b>{grouped.unassigned.length}</b> shop{grouped.unassigned.length === 1 ? "" : "s"} not on any route yet. Auto-match by area and existing route mix.
          </div>
          <Button size="sm" onClick={autoAssign} disabled={assigning || undoing} className="gap-1.5">
            <Sparkles className="size-4" /> {assigning ? "Assigning…" : "Auto-assign"}
          </Button>
        </Card>
      )}
      {lastAssign && lastAssign.date === date && (lastAssign.createdStops.length > 0 || lastAssign.deliveryPrev.length > 0) && (
        <Card className="p-3 flex flex-wrap items-center gap-3 bg-amber-50 border-amber-200">
          <div className="text-sm flex-1 min-w-0">
            Last auto-assign added <b>{lastAssign.total}</b> shop{lastAssign.total === 1 ? "" : "s"} for {shortDate(date)}.
          </div>
          <Button size="sm" variant="outline" onClick={() => setUndoPreviewOpen(true)} disabled={undoing || assigning} className="gap-1.5">
            {undoing ? "Undoing…" : "Preview & undo"}
          </Button>
        </Card>
      )}
      <UndoAutoAssignPreview
        open={undoPreviewOpen}
        onOpenChange={setUndoPreviewOpen}
        lastAssign={lastAssign}
        routes={routes ?? []}
        invoices={invoices ?? []}
        stops={stops ?? []}
        undoing={undoing}
        onConfirm={async () => {
          await undoAutoAssign();
          setUndoPreviewOpen(false);
        }}
      />

      {(routes ?? []).map((r) => {
        const list = grouped.byRoute.get(r.id) ?? [];
        if (list.length === 0) return null;
        return <RouteSheet key={r.id} route={r} invoices={list} date={date} />;
      })}
      {grouped.unassigned.length > 0 && (
        <RouteSheet
          key="unassigned"
          route={{ id: "u", name: "Unassigned shops", area: null, driver_name: null, helper_name: null, active: true, notes: "Shops not yet on any route", capacity_units: null, capacity_label: null, max_stops: null, vehicle_number: null, vehicle_type: null, start_latitude: null, start_longitude: null }}
          invoices={grouped.unassigned}
          date={date}
        />
      )}
    </div>
  );
}

type DeliveryRow = {
  id: string;
  invoice_id: string;
  status: string;
  delivered_at: string | null;
  received_by: string | null;
  pod_photo_url: string | null;
  pod_signature: string | null;
  collected_amount: number | null;
  collected_mode: string | null;
  route_id: string | null;
  pod_latitude: number | null;
  pod_longitude: number | null;
  pod_accuracy_m: number | null;
  pod_captured_at: string | null;
};

function RouteSheet({ route, invoices, date }: { route: RouteRow; invoices: InvoiceRow[]; date: string }) {
  const qc = useQueryClient();
  const [podFor, setPodFor] = useState<{ inv: InvoiceRow; delivery: DeliveryRow | null } | null>(null);

  const invoiceIds = invoices.map((i) => i.id);
  const { data: deliveries } = useQuery({
    queryKey: ["deliveries-for-sheet", date, invoiceIds.join(",")],
    enabled: invoiceIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("deliveries")
        .select("id, invoice_id, status, delivered_at, received_by, pod_photo_url, pod_signature, collected_amount, collected_mode, route_id, pod_latitude, pod_longitude, pod_accuracy_m, pod_captured_at")
        .in("invoice_id", invoiceIds);
      return (data ?? []) as DeliveryRow[];
    },
  });
  const dByInv = useMemo(() => {
    const m = new Map<string, DeliveryRow>();
    (deliveries ?? []).forEach((d) => m.set(d.invoice_id, d));
    return m;
  }, [deliveries]);

  const pickup = useMemo(() => {
    const m = new Map<string, number>();
    invoices.forEach((inv) => inv.items?.forEach((it) => {
      m.set(it.product_name, (m.get(it.product_name) ?? 0) + Number(it.quantity));
    }));
    return Array.from(m, ([product, qty]) => ({ product, qty })).sort((a, b) => b.qty - a.qty);
  }, [invoices]);

  const totalValue = invoices.reduce((s, i) => s + Number(i.total), 0);
  const totalDue = invoices.reduce((s, i) => s + Number(i.balance), 0);
  const load = pickup.reduce((s, p) => s + p.qty, 0);
  const cap = Number(route.capacity_units || 0);
  const pct = cap > 0 ? Math.min(100, (load / cap) * 100) : 0;
  const over = cap > 0 && load > cap;

  const doneCount = invoices.filter((i) => dByInv.get(i.id)?.status === "delivered").length;

  const setStatus = async (delId: string | undefined, invId: string, status: string) => {
    if (!delId) return;
    const patch: any = { status, route_id: route.id === "u" ? null : route.id };
    if (status === "delivered") patch.delivered_at = new Date().toISOString();
    if (status !== "delivered") patch.delivered_at = null;
    const { error } = await supabase.from("deliveries").update(patch).eq("id", delId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["deliveries-for-sheet", date, invoiceIds.join(",")] });
    qc.invalidateQueries({ queryKey: ["deliveries"] });
  };

  const assignAll = async () => {
    if (route.id === "u") return;
    const ids = (deliveries ?? []).filter((d) => d.route_id !== route.id).map((d) => d.id);
    if (ids.length === 0) return toast.info("All stops already on this route");
    const currentOnRoute = (deliveries ?? []).filter((d) => d.route_id === route.id).length;
    const ms = Number(route.max_stops || 0);
    if (ms > 0 && currentOnRoute + ids.length > ms) {
      return toast.error(`Can't assign — ${route.name} allows max ${ms} stops per run (already ${currentOnRoute}). Raise the limit or split across routes.`);
    }
    const capUnits = Number(route.capacity_units || 0);
    if (capUnits > 0 && load > capUnits) {
      return toast.error(`Can't assign — load ${num(load, 1)} ${route.capacity_label || ""} exceeds capacity ${num(capUnits, 0)}.`);
    }
    const { error } = await supabase.from("deliveries").update({ route_id: route.id }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`Linked ${ids.length} delivery${ids.length === 1 ? "" : "ies"} to ${route.name}`);
    qc.invalidateQueries({ queryKey: ["deliveries-for-sheet", date, invoiceIds.join(",")] });
    qc.invalidateQueries({ queryKey: ["deliveries"] });
  };

  const sheetDomId = `route-sheet-${route.id}`;
  const printThis = () => {
    document.body.classList.add("print-single");
    const el = document.getElementById(sheetDomId);
    el?.classList.add("print-target");
    const cleanup = () => {
      document.body.classList.remove("print-single");
      el?.classList.remove("print-target");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    setTimeout(() => window.print(), 50);
  };
  const exportCsv = () => {
    const rows: string[][] = [];
    rows.push([`Delivery Sheet - ${route.name}`]);
    rows.push([`Date`, shortDate(date)]);
    if (route.area) rows.push([`Area`, route.area]);
    if (route.driver_name) rows.push([`Driver`, route.driver_name]);
    if (route.helper_name) rows.push([`Helper`, route.helper_name]);
    if (route.capacity_units) rows.push([`Capacity`, `${route.capacity_units} ${route.capacity_label || ""}`]);
    rows.push([]);
    rows.push(["Pickup summary"]);
    rows.push(["Product", "Quantity"]);
    pickup.forEach((p) => rows.push([p.product, String(p.qty)]));
    rows.push([]);
    rows.push(["Stops"]);
    rows.push(["#", "Shop", "Address", "Mobile", "Invoice", "Item", "Qty", "Rate", "Amount", "Invoice Total", "Collect"]);
    invoices.forEach((inv, i) => {
      const shop = inv.customer?.shop_name || inv.customer?.name || "";
      const addr = inv.customer?.address || "";
      const mob = inv.customer?.mobile || "";
      const items = inv.items ?? [];
      if (items.length === 0) {
        rows.push([String(i + 1), shop, addr, mob, inv.invoice_no, "", "", "", "", String(inv.total), String(inv.balance)]);
      } else {
        items.forEach((it, k) => rows.push([
          k === 0 ? String(i + 1) : "",
          k === 0 ? shop : "",
          k === 0 ? addr : "",
          k === 0 ? mob : "",
          k === 0 ? inv.invoice_no : "",
          it.product_name,
          String(it.quantity),
          String(it.rate),
          String(it.amount),
          k === 0 ? String(inv.total) : "",
          k === 0 ? String(inv.balance) : "",
        ]));
      }
    });
    rows.push([]);
    rows.push(["", "", "", "", "", "", "", "", "TOTAL", String(totalValue), String(totalDue)]);
    const csv = rows.map((r) => r.map((c) => {
      const s = String(c ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `delivery-${route.name.replace(/\s+/g, "-").toLowerCase()}-${date}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  return (
    <Card id={sheetDomId} className="route-sheet overflow-hidden print:break-inside-avoid print:mb-6">
      <div className="px-5 py-3 border-b bg-muted/30 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold flex items-center gap-2">
            <RouteIcon className="size-4 text-primary" /> {route.name}
            {route.area && <span className="text-xs text-muted-foreground font-normal">· {route.area}</span>}
          </div>
          <div className="text-xs text-muted-foreground">
            {shortDate(date)} · {invoices.length} stop{invoices.length === 1 ? "" : "s"} · {doneCount} delivered
            {route.driver_name ? ` · Driver: ${route.driver_name}` : ""}
            {route.helper_name ? ` · Helper: ${route.helper_name}` : ""}
            {route.vehicle_number ? ` · 🚛 ${route.vehicle_number}` : ""}
          </div>

        </div>
        <div className="flex items-center gap-3 text-xs">
          <div>Value <span className="font-mono font-semibold">{inr(totalValue)}</span></div>
          <div>Collect <span className="font-mono font-semibold text-destructive">{inr(totalDue)}</span></div>
          <Button size="sm" variant="outline" onClick={printThis} className="no-print gap-1.5"><Printer className="size-3.5" /> Print</Button>
          <Button size="sm" variant="outline" onClick={exportCsv} className="no-print gap-1.5"><Download className="size-3.5" /> CSV</Button>
          {route.id !== "u" && (
            <Button size="sm" variant="outline" onClick={assignAll} className="no-print">Assign to route</Button>
          )}
        </div>
      </div>

      {route.id !== "u" && <RunPanel route={route} date={date} invoiceIds={invoiceIds} />}

      {/* Pickup summary + capacity bar */}

      <div className="px-5 py-3 border-b space-y-3">
        {route.max_stops != null && route.max_stops > 0 && (
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-semibold uppercase tracking-wider text-muted-foreground">Stops used</span>
              <span className={`font-mono ${invoices.length > route.max_stops ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                {invoices.length} / {route.max_stops}
                {invoices.length > route.max_stops && ` · OVER by ${invoices.length - route.max_stops}`}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className={`h-full ${invoices.length > route.max_stops ? "bg-destructive" : "bg-primary"}`} style={{ width: `${Math.min(100, (invoices.length / route.max_stops) * 100)}%` }} />
            </div>
          </div>
        )}
        {cap > 0 && (
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-semibold uppercase tracking-wider text-muted-foreground">Load vs capacity</span>
              <span className={`font-mono ${over ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                {num(load, 1)} / {num(cap, 0)} {route.capacity_label || ""}
                {over && ` · OVER by ${num(load - cap, 1)}`}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className={`h-full ${over ? "bg-destructive" : "bg-primary"}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Pickup for this route</div>
          <div className="flex flex-wrap gap-2">
            {pickup.map((p) => (
              <div key={p.product} className="text-xs px-2.5 py-1 rounded-md bg-primary/5 border border-primary/10">
                <span className="font-medium">{p.product}</span>
                <span className="ml-2 font-mono font-semibold">{num(p.qty, 2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stops */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left w-10">#</th>
              <th className="px-4 py-2 text-left">Shop</th>
              <th className="px-4 py-2 text-left">Items</th>
              <th className="px-4 py-2 text-right">Value</th>
              <th className="px-4 py-2 text-right">Collect</th>
              <th className="px-4 py-2 text-center w-44 no-print">Status</th>
              <th className="px-4 py-2 text-center w-40 no-print">Delivery entry</th>
              <th className="px-4 py-2 text-center w-20 print:table-cell hidden">Signed</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {invoices.map((inv, i) => {
              const d = dByInv.get(inv.id);
              const delivered = d?.status === "delivered";
              return (
                <tr key={inv.id} className={delivered ? "bg-emerald-500/5" : ""}>
                  <td className="px-4 py-3 align-top font-semibold text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium flex items-center gap-1.5">
                      {inv.customer?.shop_name || inv.customer?.name}
                      {delivered && <CheckCircle2 className="size-3.5 text-emerald-600" />}
                    </div>
                    <div className="text-xs text-muted-foreground">{inv.customer?.address || "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {inv.customer?.mobile ? `📞 ${inv.customer.mobile} · ` : ""}Inv {inv.invoice_no}
                    </div>
                    {d?.received_by && (
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
                        Received by <b>{d.received_by}</b>
                        {d.collected_amount ? ` · ${inr(d.collected_amount)} ${(d.collected_mode || "").toUpperCase()}` : ""}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-xs">
                    {(inv.items ?? []).map((it, k) => (
                      <div key={k} className="flex justify-between gap-3 border-b last:border-0 py-0.5">
                        <span className="truncate">{it.product_name}</span>
                        <span className="font-mono">{num(it.quantity, 2)}</span>
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-3 align-top text-right font-mono">{inr(inv.total)}</td>
                  <td className="px-4 py-3 align-top text-right font-mono font-semibold text-destructive">{inr(inv.balance)}</td>
                  <td className="px-4 py-3 align-top text-center no-print">
                    <Select value={d?.status ?? "planned"} onValueChange={(v) => setStatus(d?.id, inv.id, v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planned">Planned</SelectItem>
                        <SelectItem value="en_route">En Route</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="partially_delivered">Partially Delivered</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3 align-top text-center no-print">
                    <Button size="sm" variant={delivered ? "outline" : "default"} className="gap-1.5 w-full"
                      disabled={!d}
                      onClick={() => setPodFor({ inv, delivery: d ?? null })}>
                      {delivered ? <><Camera className="size-3.5" /> POD</> : <><Wallet className="size-3.5" /> Deliver</>}
                    </Button>
                  </td>
                  <td className="px-4 py-3 align-top text-center hidden print:table-cell">
                    <span className="inline-block w-16 border-b border-dashed h-5" />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-muted/30 font-semibold">
            <tr>
              <td colSpan={3} className="px-4 py-2 text-right">Totals</td>
              <td className="px-4 py-2 text-right font-mono">{inr(totalValue)}</td>
              <td className="px-4 py-2 text-right font-mono text-destructive">{inr(totalDue)}</td>
              <td className="no-print" colSpan={2} />
              <td className="hidden print:table-cell" />
            </tr>
          </tfoot>
        </table>
      </div>

      <DeliverStopDialog
        open={!!podFor}
        onClose={() => setPodFor(null)}
        payload={podFor}
        route={route}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["deliveries-for-sheet", date, invoiceIds.join(",")] });
          qc.invalidateQueries({ queryKey: ["deliveries"] });
          qc.invalidateQueries({ queryKey: ["invoices-for-sheet", date] });
          qc.invalidateQueries({ queryKey: ["customers"] });
          setPodFor(null);
        }}
      />
    </Card>
  );
}

/* ---------------- Deliver dialog with POD ---------------- */

function DeliverStopDialog({
  open, onClose, payload, route, onSaved,
}: {
  open: boolean; onClose: () => void;
  payload: { inv: InvoiceRow; delivery: DeliveryRow | null } | null;
  route: RouteRow; onSaved: () => void;
}) {
  const [receivedBy, setReceivedBy] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"cash" | "upi" | "bank">("cash");
  const [reference, setReference] = useState("");
  const [signature, setSignature] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [cratesIssued, setCratesIssued] = useState("");
  const [cratesReturned, setCratesReturned] = useState("");
  const enqueueNotifs = useServerFn(enqueueDeliveryNotifications);
  const processNotifs = useServerFn(processQueuedNotifications);

  useEffect(() => {
    if (open && payload) {
      setReceivedBy(payload.delivery?.received_by ?? "");
      setAmount("");
      setMode((payload.delivery?.collected_mode as any) ?? "cash");
      setReference("");
      setSignature(payload.delivery?.pod_signature ?? "");
      setFile(null);
      setCratesIssued("");
      setCratesReturned("");
      const init: Record<string, string> = {};
      (payload.inv.items ?? []).forEach((it) => {
        const ordered = Number(it.ordered_quantity ?? it.quantity ?? 0);
        const delivered = it.delivered_quantity != null ? Number(it.delivered_quantity) : ordered;
        init[it.id] = String(delivered);
      });
      setQtys(init);
    }
  }, [open, payload]);

  if (!payload) return null;
  const { inv, delivery } = payload;
  const bal = Number(inv.balance);

  const items = inv.items ?? [];
  const derivedStatus = (() => {
    if (items.length === 0) return "delivered" as const;
    let allFull = true, allZero = true;
    for (const it of items) {
      const ordered = Number(it.ordered_quantity ?? it.quantity ?? 0);
      const d = Math.max(0, Math.min(Number(qtys[it.id] || 0), ordered));
      if (d < ordered) allFull = false;
      if (d > 0) allZero = false;
    }
    if (allZero) return "failed" as const;
    if (allFull) return "delivered" as const;
    return "partially_delivered" as const;
  })();

  const setQty = (id: string, v: string) => setQtys((s) => ({ ...s, [id]: v }));

  const save = async () => {
    if (!delivery) return toast.error("No delivery record");
    if (!receivedBy.trim() && derivedStatus !== "failed") return toast.error("Who received it?");
    setSaving(true);
    try {
      // 1. Apply per-item delivered quantities (recomputes invoice via triggers)
      const payloadItems = items.map((it) => {
        const ordered = Number(it.ordered_quantity ?? it.quantity ?? 0);
        return { id: it.id, delivered: Math.max(0, Math.min(Number(qtys[it.id] || 0), ordered)) };
      });
      const { data: statusData, error: rpcErr } = await supabase.rpc("apply_delivery_quantities", {
        _invoice_id: inv.id,
        _items: payloadItems as any,
      });
      if (rpcErr) throw rpcErr;
      const finalStatus = (statusData as string) || derivedStatus;

      // 2. POD upload
      let podUrl = delivery.pod_photo_url;
      if (file) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${inv.id}/${Date.now()}.${ext}`;
        const up = await supabase.storage.from("pod").upload(path, file, { upsert: true, contentType: file.type });
        if (up.error) throw up.error;
        podUrl = path;
      }

      // 3. Payment (if any)
      const amt = Number(amount || 0);
      if (amt > 0 && inv.customer) {
        const { error: pErr } = await supabase.from("payments").insert({
          payment_no: genDocNo("RCP"),
          customer_id: inv.customer.id,
          invoice_id: inv.id,
          amount: amt,
          mode,
          reference: reference || null,
          notes: `Collected on delivery · route ${route.name}`,
        });
        if (pErr) throw pErr;
      }

      // 3b. Capture POD GPS (non-blocking on failure, logged to gps_audit_logs)
      let podLat: number | null = null, podLng: number | null = null, podAcc: number | null = null, podAt: string | null = null;
      const podCap = await captureGpsWithAudit("delivery_pod", {
        delivery_id: delivery.id,
        invoice_id: inv.id,
        customer_id: inv.customer?.id ?? null,
        route_id: route.id === "u" ? null : route.id,
        run_id: (delivery as any).run_id ?? null,
      });
      if (podCap.fix) {
        podLat = podCap.fix.latitude; podLng = podCap.fix.longitude;
        podAcc = podCap.fix.accuracy; podAt = podCap.fix.capturedAt;
      } else if (podCap.error) {
        toast.warning(`Saved without GPS: ${podCap.error.message}`);
      }

      // 4. Update delivery row
      const { error: dErr } = await supabase.from("deliveries").update({
        status: finalStatus,
        delivered_at: new Date().toISOString(),
        received_by: receivedBy.trim() || null,
        pod_photo_url: podUrl,
        pod_signature: signature || null,
        collected_amount: amt > 0 ? amt : delivery.collected_amount,
        collected_mode: amt > 0 ? mode : delivery.collected_mode,
        route_id: route.id === "u" ? null : route.id,
        pod_latitude: podLat ?? (delivery as any).pod_latitude ?? null,
        pod_longitude: podLng ?? (delivery as any).pod_longitude ?? null,
        pod_accuracy_m: podAcc ?? (delivery as any).pod_accuracy_m ?? null,
        pod_captured_at: podAt ?? (delivery as any).pod_captured_at ?? null,
      }).eq("id", delivery.id);
      if (dErr) throw dErr;

      // 4b. Save crate transactions (if any)
      const cratesIssuedQty = Number(cratesIssued || 0);
      const cratesReturnedQty = Number(cratesReturned || 0);
      if ((cratesIssuedQty > 0 || cratesReturnedQty > 0) && inv.customer && finalStatus !== "failed") {
        // Get the default crate type (first one)
        const { data: defaultCrateType } = await supabase
          .from("crate_types")
          .select("id")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        if (defaultCrateType) {
          const { data: user } = await supabase.auth.getUser();
          const crateTransactions: any[] = [];

          if (cratesIssuedQty > 0) {
            crateTransactions.push({
              crate_type_id: defaultCrateType.id,
              retailer_id: inv.customer.id,
              delivery_id: delivery.id,
              route_id: route.id === "u" ? null : route.id,
              transaction_type: "issue",
              quantity: cratesIssuedQty,
              transaction_date: new Date().toISOString().split("T")[0],
              notes: `Issued with delivery ${inv.invoice_no}`,
              created_by: user?.user?.id ?? null,
            });
          }

          if (cratesReturnedQty > 0) {
            crateTransactions.push({
              crate_type_id: defaultCrateType.id,
              retailer_id: inv.customer.id,
              delivery_id: delivery.id,
              route_id: route.id === "u" ? null : route.id,
              transaction_type: "return",
              quantity: cratesReturnedQty,
              transaction_date: new Date().toISOString().split("T")[0],
              notes: `Returned with delivery ${inv.invoice_no}`,
              created_by: user?.user?.id ?? null,
            });
          }

          if (crateTransactions.length > 0) {
            const { error: crateErr } = await supabase.from("crate_transactions").insert(crateTransactions);
            if (crateErr) {
              console.warn("Failed to save crate transactions:", crateErr);
              // Don't throw - delivery was successful, crate tracking is secondary
            }
          }
        }
      }

      // 5. Enqueue retailer notifications (idempotent) and kick off dispatch.
      // Fire-and-forget so a provider outage never blocks the delivery save.
      try {
        const { enqueued } = await enqueueNotifs({ data: { deliveryId: delivery.id } });
        if (enqueued > 0) {
          processNotifs({ data: { limit: 10 } }).catch((err) => {
            console.warn("notification dispatch failed:", err);
          });
        }
      } catch (err) {
        console.warn("notification enqueue failed:", err);
      }

      toast.success(
        finalStatus === "delivered" ? "Delivered" :
        finalStatus === "partially_delivered" ? "Marked partially delivered" :
        "Marked as failed"
      );
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const setAllFull = () => {
    const next: Record<string, string> = {};
    items.forEach((it) => { next[it.id] = String(Number(it.ordered_quantity ?? it.quantity ?? 0)); });
    setQtys(next);
  };
  const setAllZero = () => {
    const next: Record<string, string> = {};
    items.forEach((it) => { next[it.id] = "0"; });
    setQtys(next);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Delivery · {inv.customer?.shop_name || inv.customer?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/40 p-3 text-sm flex items-center justify-between">
            <div>
              <div className="font-medium">Invoice {inv.invoice_no}</div>
              <div className="text-xs text-muted-foreground">{items.length} items · {inr(inv.total)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Balance</div>
              <div className="font-mono font-semibold text-destructive">{inr(bal)}</div>
            </div>
          </div>

          {/* Per-item delivered quantities */}
          <div className="rounded-lg border">
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Delivered quantities</div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={setAllFull}>All full</Button>
                <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={setAllZero}>All zero</Button>
              </div>
            </div>
            <div className="divide-y">
              {items.map((it) => {
                const ordered = Number(it.ordered_quantity ?? it.quantity ?? 0);
                const d = Math.max(0, Math.min(Number(qtys[it.id] || 0), ordered));
                const short = ordered - d;
                return (
                  <div key={it.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{it.product_name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Ordered {ordered} · Rate {inr(it.rate)}
                        {short > 0 && <span className="text-destructive"> · Short {short}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button type="button" size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setQty(it.id, String(Math.max(0, d - 1)))}>−</Button>
                      <Input
                        type="number"
                        inputMode="decimal"
                        className="h-8 w-20 text-center"
                        value={qtys[it.id] ?? ""}
                        onChange={(e) => setQty(it.id, e.target.value)}
                      />
                      <Button type="button" size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setQty(it.id, String(Math.min(ordered, d + 1)))}>+</Button>
                    </div>
                    <div className="w-14 text-right text-[11px] text-muted-foreground font-mono">/ {ordered}</div>
                  </div>
                );
              })}
              {items.length === 0 && <div className="px-3 py-4 text-xs text-muted-foreground">No items on this invoice.</div>}
            </div>
            <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/20 text-xs">
              <span className="text-muted-foreground">Auto-status</span>
              <StatusBadge status={derivedStatus} />
            </div>
          </div>

          {/* Crate tracking */}
          {derivedStatus !== "failed" && (
            <div className="rounded-lg border bg-muted/20">
              <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Package className="size-3.5" />
                  Crate Tracking
                </div>
                <span className="text-[10px] text-muted-foreground">Optional</span>
              </div>
              <div className="p-3 grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Crates Issued</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <Button type="button" size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setCratesIssued(String(Math.max(0, Number(cratesIssued || 0) - 1)))}>−</Button>
                    <Input
                      type="number"
                      inputMode="numeric"
                      className="h-8 w-20 text-center"
                      value={cratesIssued}
                      onChange={(e) => setCratesIssued(e.target.value)}
                      placeholder="0"
                    />
                    <Button type="button" size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setCratesIssued(String(Number(cratesIssued || 0) + 1))}>+</Button>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">New crates given</div>
                </div>
                <div>
                  <Label className="text-xs">Crates Returned</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <Button type="button" size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setCratesReturned(String(Math.max(0, Number(cratesReturned || 0) - 1)))}>−</Button>
                    <Input
                      type="number"
                      inputMode="numeric"
                      className="h-8 w-20 text-center"
                      value={cratesReturned}
                      onChange={(e) => setCratesReturned(e.target.value)}
                      placeholder="0"
                    />
                    <Button type="button" size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setCratesReturned(String(Number(cratesReturned || 0) + 1))}>+</Button>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">Empty crates taken back</div>
                </div>
              </div>
            </div>
          )}

          <div>
            <Label>Received by {derivedStatus !== "failed" && "*"}</Label>
            <Input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} placeholder="Person accepting the goods" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cash collected</Label>
              <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={bal > 0 ? String(bal) : "0"} />
            </div>
            <div>
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {mode !== "cash" && (
            <div>
              <Label>Reference</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Txn id / UTR" />
            </div>
          )}

          <div>
            <Label>Signature (typed name)</Label>
            <Input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Signed as…" />
          </div>

          <div>
            <Label>Proof photo</Label>
            <Input type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {delivery?.pod_photo_url && !file && (
              <div className="text-[11px] text-muted-foreground mt-1">Existing photo on file · uploading a new one will replace it.</div>
            )}
          </div>

          {delivery?.pod_latitude != null && delivery?.pod_longitude != null && (
            <div className="rounded-md border bg-muted/30 p-2 text-xs flex items-center gap-2">
              <MapPin className="size-3.5 text-primary" />
              <span>Last POD location:</span>
              <a
                href={gmapsUrl(delivery.pod_latitude, delivery.pod_longitude)!}
                target="_blank" rel="noreferrer"
                className="font-mono text-primary hover:underline"
              >
                {fmtLatLng(delivery.pod_latitude, delivery.pod_longitude)}
              </a>
              {delivery.pod_accuracy_m != null && (
                <span className="text-muted-foreground">±{Math.round(delivery.pod_accuracy_m)}m</span>
              )}
            </div>
          )}
          <div className="text-[11px] text-muted-foreground">
            A fresh GPS location will be captured when you save this delivery.
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" :
              derivedStatus === "delivered" ? "Mark Delivered" :
              derivedStatus === "partially_delivered" ? "Save Partial Delivery" :
              "Mark Failed"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Delivery run panel ---------------- */

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function durationMin(a: string | null, b: string | null) {
  if (!a || !b) return null;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
}

function RunPanel({ route, date, invoiceIds }: { route: RouteRow; date: string; invoiceIds: string[] }) {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  const { data: run } = useQuery({
    queryKey: ["delivery-run", route.id, date],
    queryFn: async (): Promise<DeliveryRun | null> => {
      const { data, error } = await supabase
        .from("delivery_runs")
        .select("*")
        .eq("route_id", route.id)
        .eq("run_date", date)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as DeliveryRun) ?? null;
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["delivery-run", route.id, date] });

  const [busy, setBusy] = useState<"pickup" | "start" | "end" | null>(null);

  const confirmPickup = async () => {
    setBusy("pickup");
    const now = new Date().toISOString();
    try {
      if (run) {
        const { error } = await supabase.from("delivery_runs").update({
          pickup_confirmed_at: now,
        }).eq("id", run.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("delivery_runs").insert({
          route_id: route.id, run_date: date,
          driver_name: route.driver_name, helper_name: route.helper_name,
          vehicle_number: route.vehicle_number, vehicle_type: route.vehicle_type,
          status: "scheduled", pickup_confirmed_at: now,
        });
        if (error) throw error;
      }
      toast.success("Pickup confirmed from Sudha");
      invalidate();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setBusy(null);
    }
  };

  const startRun = async () => {
    if (!run?.pickup_confirmed_at) {
      return toast.error("Confirm pickup from Sudha first");
    }
    setBusy("start");
    const now = new Date().toISOString();
    try {
      const cap = await captureGpsWithAudit("run_start", { run_id: run?.id ?? null, route_id: route.id });
      const fix = cap.fix;
      if (!fix && cap.error) toast.warning(`Starting without GPS: ${cap.error.message}`);
      const { error } = await supabase.from("delivery_runs").update({
        started_at: run.started_at ?? now,
        status: "in_progress",
        start_latitude: fix?.latitude ?? run.start_latitude,
        start_longitude: fix?.longitude ?? run.start_longitude,
        start_accuracy_m: fix?.accuracy ?? run.start_accuracy_m,
      }).eq("id", run.id);
      if (error) throw error;
      toast.success(fix ? "Run started · location captured" : "Run started");
      invalidate();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setBusy(null);
    }
  };

  const endRun = async () => {
    if (!run) return;
    setBusy("end");
    const now = new Date().toISOString();
    try {
      const cap = await captureGpsWithAudit("run_end", { run_id: run?.id ?? null, route_id: route.id });
      const fix = cap.fix;
      if (!fix && cap.error) toast.warning(`Ending without GPS: ${cap.error.message}`);
      const { error } = await supabase.from("delivery_runs").update({
        ended_at: now, status: "completed",
        end_latitude: fix?.latitude ?? run.end_latitude,
        end_longitude: fix?.longitude ?? run.end_longitude,
        end_accuracy_m: fix?.accuracy ?? run.end_accuracy_m,
      }).eq("id", run.id);
      if (error) throw error;
      toast.success(fix ? "Run ended · location captured" : "Run ended");
      invalidate();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setBusy(null);
    }
  };

  const dur = durationMin(run?.started_at ?? null, run?.ended_at ?? null);
  const startLoc = fmtLatLng(run?.start_latitude, run?.start_longitude);
  const endLoc = fmtLatLng(run?.end_latitude, run?.end_longitude);
  const startMap = gmapsUrl(run?.start_latitude, run?.start_longitude);
  const endMap = gmapsUrl(run?.end_latitude, run?.end_longitude);

  return (
    <div className="px-5 py-3 border-b bg-primary/5 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 text-xs">
        <Truck className="size-4 text-primary" />
        <span className="font-semibold uppercase tracking-wider text-muted-foreground">Delivery run</span>
        <Badge variant={run?.status === "completed" ? "outline" : run?.status === "in_progress" ? "default" : "secondary"} className="capitalize">
          {run?.status?.replace("_", " ") || "not started"}
        </Badge>
        {run?.delivery_status && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">Auto:</span>
            <StatusBadge status={run.delivery_status} />
          </>
        )}
        {run?.pickup_confirmed_at && (
          <Badge variant="outline" className="gap-1 text-emerald-700 border-emerald-300 bg-emerald-50">
            <CheckCircle2 className="size-3" /> Pickup {fmtTime(run.pickup_confirmed_at)}
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap gap-4 text-xs">
        <span>Start <b className="font-mono text-foreground">{fmtTime(run?.started_at ?? null)}</b></span>
        <span>End <b className="font-mono text-foreground">{fmtTime(run?.ended_at ?? null)}</b></span>
        {dur != null && <span>Duration <b className="font-mono text-foreground">{Math.floor(dur / 60)}h {dur % 60}m</b></span>}
        {run?.odometer_start != null && (
          <span>Odo <b className="font-mono text-foreground">{num(run.odometer_start, 0)}{run.odometer_end != null ? ` → ${num(run.odometer_end, 0)} (${num(Number(run.odometer_end) - Number(run.odometer_start), 0)} km)` : ""}</b></span>
        )}
        {startLoc && (
          <a href={startMap!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
            <MapPin className="size-3" /> Start {startLoc}
          </a>
        )}
        {endLoc && (
          <a href={endMap!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
            <MapPin className="size-3" /> End {endLoc}
          </a>
        )}
      </div>
      <div className="ml-auto flex gap-2 no-print">
        {!run?.pickup_confirmed_at && (
          <Button size="sm" variant="secondary" onClick={confirmPickup} disabled={busy === "pickup"} className="gap-1.5">
            <CheckCircle2 className="size-4" /> {busy === "pickup" ? "Saving…" : "Confirm pickup from Sudha"}
          </Button>
        )}
        {run?.pickup_confirmed_at && !run?.started_at && (
          <Button size="sm" onClick={startRun} disabled={busy === "start"} className="gap-1.5">
            <LocateFixed className="size-4" /> {busy === "start" ? "Getting GPS…" : "Start run (capture GPS)"}
          </Button>
        )}
        {run?.started_at && !run?.ended_at && (
          <Button size="sm" variant="destructive" onClick={endRun} disabled={busy === "end"} className="gap-1.5">
            <LocateFixed className="size-4" /> {busy === "end" ? "Getting GPS…" : "End run (capture GPS)"}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => setMapOpen(true)} className="gap-1.5"><MapPin className="size-4" /> Map</Button>
        <Button size="sm" variant="outline" onClick={() => setTimelineOpen(true)} className="gap-1.5"><History className="size-4" /> Timeline</Button>
        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>Details</Button>
      </div>
      <RunEditDialog open={editOpen} onClose={() => setEditOpen(false)} route={route} date={date} run={run ?? null} onSaved={invalidate} />
      <RunTimelineDialog open={timelineOpen} onClose={() => setTimelineOpen(false)} route={route} date={date} invoiceIds={invoiceIds} />
      <RunMapDialog open={mapOpen} onClose={() => setMapOpen(false)} route={route} date={date} invoiceIds={invoiceIds} />
    </div>
  );
}

function RunEditDialog({
  open, onClose, route, date, run, onSaved,
}: {
  open: boolean; onClose: () => void; route: RouteRow; date: string; run: DeliveryRun | null; onSaved: () => void;
}) {
  const toLocal = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
  };
  const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

  const [driver, setDriver] = useState("");
  const [helper, setHelper] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [vtype, setVtype] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [endedAt, setEndedAt] = useState("");
  const [odoS, setOdoS] = useState("");
  const [odoE, setOdoE] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("scheduled");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDriver(run?.driver_name ?? route.driver_name ?? "");
    setHelper(run?.helper_name ?? route.helper_name ?? "");
    setVehicle(run?.vehicle_number ?? route.vehicle_number ?? "");
    setVtype(run?.vehicle_type ?? route.vehicle_type ?? "");
    setStartedAt(toLocal(run?.started_at ?? null));
    setEndedAt(toLocal(run?.ended_at ?? null));
    setOdoS(run?.odometer_start != null ? String(run.odometer_start) : "");
    setOdoE(run?.odometer_end != null ? String(run.odometer_end) : "");
    setNotes(run?.notes ?? "");
    setStatus(run?.status ?? "scheduled");
  }, [open, run, route]);

  const save = async () => {
    setSaving(true);
    const payload = {
      route_id: route.id, run_date: date,
      driver_name: driver || null, helper_name: helper || null,
      vehicle_number: vehicle || null, vehicle_type: vtype || null,
      started_at: fromLocal(startedAt), ended_at: fromLocal(endedAt),
      odometer_start: odoS ? Number(odoS) : null,
      odometer_end: odoE ? Number(odoE) : null,
      notes: notes || null, status,
    };
    const q = run
      ? supabase.from("delivery_runs").update(payload).eq("id", run.id)
      : supabase.from("delivery_runs").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Run saved");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Delivery run · {route.name} · {shortDate(date)}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Driver</Label><Input value={driver} onChange={(e) => setDriver(e.target.value)} /></div>
            <div><Label>Helper</Label><Input value={helper} onChange={(e) => setHelper(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Vehicle number</Label><Input value={vehicle} onChange={(e) => setVehicle(e.target.value.toUpperCase())} /></div>
            <div><Label>Vehicle type</Label><Input value={vtype} onChange={(e) => setVtype(e.target.value)} placeholder="tempo / mini_truck…" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Started at</Label><Input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} /></div>
            <div><Label>Ended at</Label><Input type="datetime-local" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Odometer start (km)</Label><Input type="number" inputMode="decimal" value={odoS} onChange={(e) => setOdoS(e.target.value)} /></div>
            <div><Label>Odometer end (km)</Label><Input type="number" inputMode="decimal" value={odoE} onChange={(e) => setOdoE(e.target.value)} /></div>
          </div>
          <div><Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Fuel, incidents, delays…" /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save run"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Run timeline ---------------- */

type FieldChange = { field: string; from: string | null; to: string | null };

type TimelineEvent = {
  at: string;
  kind: "run_created" | "pickup" | "run_started" | "run_ended" | "run_edited"
      | "delivered" | "partial" | "failed" | "en_route" | "stop_edited" | "payment"
      | "gps_ok" | "gps_failed";
  title: string;
  detail?: string | null;
  location?: { lat: number | null; lng: number | null; acc?: number | null } | null;
  by?: string | null;
  changes?: FieldChange[] | null;
};

const FIELD_LABELS: Record<string, string> = {
  driver_name: "Driver", helper_name: "Helper", vehicle_number: "Vehicle #",
  vehicle_type: "Vehicle type", odometer_start: "Odo start", odometer_end: "Odo end",
  started_at: "Started at", ended_at: "Ended at", pickup_confirmed_at: "Pickup at",
  status: "Status", delivery_status: "Delivery status", notes: "Notes",
  delivered_at: "Delivered at", received_by: "Received by",
  collected_amount: "Collected", collected_mode: "Mode", route_id: "Route",
  assigned_to: "Assigned to", scheduled_date: "Scheduled",
  pod_photo_url: "POD photo", pod_signature: "POD signature",
};

function prettyFieldValue(field: string, v: string | null): string {
  if (v == null || v === "") return "—";
  if (field === "collected_amount") { const n = Number(v); return Number.isFinite(n) ? inr(Number(v)) : v; }
  if (field === "pod_photo_url" || field === "pod_signature") return "attached";
  if (/_at$/.test(field)) { const d = new Date(v); return isNaN(d.getTime()) ? v : fmtDateTime(v); }
  if (field === "status" || field === "delivery_status") return String(v).replace(/_/g, " ");
  return v;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString([], {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    day: "2-digit", month: "short",
  });
}

function eventStyle(kind: TimelineEvent["kind"]) {
  switch (kind) {
    case "pickup": return { Icon: CheckCircle2, cls: "bg-emerald-100 text-emerald-700 border-emerald-300" };
    case "run_started": return { Icon: Play, cls: "bg-primary/10 text-primary border-primary/30" };
    case "run_ended": return { Icon: Square, cls: "bg-slate-200 text-slate-700 border-slate-300" };
    case "delivered": return { Icon: CheckCircle2, cls: "bg-emerald-100 text-emerald-700 border-emerald-300" };
    case "partial": return { Icon: Truck, cls: "bg-amber-100 text-amber-700 border-amber-300" };
    case "failed": return { Icon: XCircle, cls: "bg-destructive/10 text-destructive border-destructive/30" };
    case "en_route": return { Icon: Truck, cls: "bg-blue-100 text-blue-700 border-blue-300" };
    case "run_created": return { Icon: Sparkles, cls: "bg-violet-100 text-violet-700 border-violet-300" };
    case "run_edited": return { Icon: Pencil, cls: "bg-slate-100 text-slate-700 border-slate-300" };
    case "stop_edited": return { Icon: Pencil, cls: "bg-slate-100 text-slate-700 border-slate-300" };
    case "payment": return { Icon: Wallet, cls: "bg-emerald-100 text-emerald-700 border-emerald-300" };
    case "gps_ok": return { Icon: MapPin, cls: "bg-sky-100 text-sky-700 border-sky-300" };
    case "gps_failed": return { Icon: XCircle, cls: "bg-amber-100 text-amber-700 border-amber-300" };
    default: return { Icon: Clock, cls: "bg-muted text-foreground border-border" };
  }
}

function RunTimelineDialog({
  open, onClose, route, date, invoiceIds,
}: { open: boolean; onClose: () => void; route: RouteRow; date: string; invoiceIds: string[] }) {
  const { data, isLoading } = useQuery({
    enabled: open,
    queryKey: ["run-timeline", route.id, date, invoiceIds.join(",")],
    queryFn: async (): Promise<TimelineEvent[]> => {
      // Fetch all runs for this route+date (there may be multiple sessions)
      const { data: runs, error: rErr } = await supabase
        .from("delivery_runs")
        .select("*")
        .eq("route_id", route.id)
        .eq("run_date", date)
        .order("created_at", { ascending: true });
      if (rErr) throw rErr;

      // Fetch deliveries for the invoices shown on this route sheet (date scoped)
      const dels = invoiceIds.length === 0 ? [] : await (async () => {
        const { data, error } = await supabase
          .from("deliveries")
          .select("id, invoice_id, status, delivered_at, created_at, updated_at, received_by, collected_amount, collected_mode, pod_latitude, pod_longitude, pod_accuracy_m, pod_captured_at, invoice:invoices(invoice_no, customer:customers(name, shop_name))")
          .in("invoice_id", invoiceIds);
        if (error) throw error;
        return data ?? [];
      })();

      // Fetch GPS audit rows scoped to this route+date (via run_id list + route_id fallback)
      const runIds = (runs ?? []).map((r: any) => r.id);
      const delIds = (dels ?? []).map((d: any) => d.id);
      const dayStart = new Date(`${date}T00:00:00`).toISOString();
      const dayEnd = new Date(`${date}T23:59:59.999`).toISOString();
      const gpsRows = await (async () => {
        let q = supabase
          .from("gps_audit_logs" as any)
          .select("id, event_type, success, latitude, longitude, accuracy, error_code, error_message, run_id, delivery_id, route_id, customer_id, created_at")
          .gte("created_at", dayStart).lte("created_at", dayEnd)
          .order("created_at", { ascending: true });
        // Match rows for this route OR any of its runs/deliveries
        const orParts = [`route_id.eq.${route.id}`];
        if (runIds.length) orParts.push(`run_id.in.(${runIds.join(",")})`);
        if (delIds.length) orParts.push(`delivery_id.in.(${delIds.join(",")})`);
        q = q.or(orParts.join(","));
        const { data, error } = await q;
        if (error) { console.warn("gps audit fetch failed", error); return []; }
        return data ?? [];
      })();

      const ev: TimelineEvent[] = [];

      for (const r of runs ?? []) {
        const rr = r as any;
        const who = [rr.driver_name, rr.helper_name].filter(Boolean).join(" & ");
        if (rr.created_at) ev.push({
          at: rr.created_at, kind: "run_created",
          title: "Run created",
          detail: [who && `Team: ${who}`, rr.vehicle_number && `🚛 ${rr.vehicle_number}`].filter(Boolean).join(" · "),
        });
        if (rr.pickup_confirmed_at) ev.push({
          at: rr.pickup_confirmed_at, kind: "pickup",
          title: "Pickup confirmed from Sudha",
        });
        if (rr.started_at) ev.push({
          at: rr.started_at, kind: "run_started",
          title: "Run started",
          detail: rr.odometer_start != null ? `Odo ${num(rr.odometer_start, 0)} km` : null,
          location: rr.start_latitude != null ? { lat: rr.start_latitude, lng: rr.start_longitude, acc: rr.start_accuracy_m } : null,
        });
        if (rr.ended_at) ev.push({
          at: rr.ended_at, kind: "run_ended",
          title: "Run ended",
          detail: rr.odometer_end != null
            ? `Odo ${num(rr.odometer_end, 0)} km${rr.odometer_start != null ? ` · ${num(Number(rr.odometer_end) - Number(rr.odometer_start), 0)} km driven` : ""}`
            : null,
          location: rr.end_latitude != null ? { lat: rr.end_latitude, lng: rr.end_longitude, acc: rr.end_accuracy_m } : null,
        });
      }

      // Deliveries: milestone + payment events (edits are covered by audit-log below)
      for (const d of dels ?? []) {
        const dd = d as any;
        const inv = dd.invoice as { invoice_no?: string | null; customer?: { name?: string | null; shop_name?: string | null } | null } | null;
        const shop = inv?.customer?.shop_name || inv?.customer?.name || "Shop";
        const invNo = inv?.invoice_no ? ` · ${inv.invoice_no}` : "";
        if (dd.created_at) ev.push({
          at: dd.created_at, kind: "en_route",
          title: `Assigned to route: ${shop}`,
          detail: invNo || null,
        });
        if (dd.delivered_at) {
          const kind: TimelineEvent["kind"] =
            dd.status === "delivered" ? "delivered" :
            dd.status === "partially_delivered" ? "partial" :
            dd.status === "failed" ? "failed" : "en_route";
          const label =
            dd.status === "delivered" ? "Delivered" :
            dd.status === "partially_delivered" ? "Partially delivered" :
            dd.status === "failed" ? "Failed delivery" : "Status updated";
          const bits: string[] = [];
          if (dd.received_by) bits.push(`Received by ${dd.received_by}`);
          if (dd.collected_amount) bits.push(`${inr(dd.collected_amount)} ${dd.collected_mode || ""}`.trim());
          ev.push({
            at: dd.delivered_at, kind,
            title: `${label}: ${shop}${invNo}`,
            detail: bits.join(" · ") || null,
            location: dd.pod_latitude != null ? { lat: dd.pod_latitude, lng: dd.pod_longitude, acc: dd.pod_accuracy_m } : null,
          });
          if (dd.collected_amount && Number(dd.collected_amount) > 0) {
            ev.push({
              at: dd.delivered_at, kind: "payment",
              title: `Payment collected: ${shop}`,
              detail: `${inr(dd.collected_amount)} via ${dd.collected_mode || "cash"}`,
            });
          }
        }
      }

      // Fetch structured edit-audit rows for this route/date and turn them into diff events
      const editRows = await (async () => {
        const orParts: string[] = [];
        if (runIds.length) orParts.push(`run_id.in.(${runIds.join(",")})`);
        if (delIds.length) orParts.push(`delivery_id.in.(${delIds.join(",")})`);
        if (orParts.length === 0) return [];
        const { data, error } = await supabase
          .from("edit_audit_logs" as any)
          .select("record_type, run_id, delivery_id, action, field, old_value, new_value, created_at")
          .or(orParts.join(","))
          .eq("action", "updated")
          .order("created_at", { ascending: true });
        if (error) { console.warn("edit audit fetch failed", error); return []; }
        return data ?? [];
      })();

      // Group edits by (record + second-precision timestamp) so one save = one timeline card
      const shopByDelivery = new Map<string, string>();
      for (const d of dels ?? []) {
        const dd = d as any;
        const inv = dd.invoice as { invoice_no?: string | null; customer?: { name?: string | null; shop_name?: string | null } | null } | null;
        const shop = inv?.customer?.shop_name || inv?.customer?.name || "Shop";
        shopByDelivery.set(dd.id, `${shop}${inv?.invoice_no ? ` · ${inv.invoice_no}` : ""}`);
      }
      const groups = new Map<string, { at: string; kind: "run_edited" | "stop_edited"; title: string; changes: FieldChange[] }>();
      for (const g of editRows as any[]) {
        const bucket = new Date(g.created_at); bucket.setMilliseconds(0);
        const key = `${g.record_type}:${g.run_id || g.delivery_id}:${bucket.toISOString()}`;
        if (!groups.has(key)) {
          if (g.record_type === "delivery_run") {
            groups.set(key, { at: g.created_at, kind: "run_edited", title: "Run details edited", changes: [] });
          } else {
            const label = shopByDelivery.get(g.delivery_id) || "Stop";
            groups.set(key, { at: g.created_at, kind: "stop_edited", title: `Stop edited: ${label}`, changes: [] });
          }
        }
        groups.get(key)!.changes.push({ field: g.field, from: g.old_value, to: g.new_value });
      }
      for (const grp of groups.values()) {
        ev.push({ at: grp.at, kind: grp.kind, title: grp.title, changes: grp.changes });
      }

      // GPS audit events (attempts + failures)
      const eventLabel: Record<string, string> = {
        run_start: "Run start", run_end: "Run end", pickup_confirm: "Pickup",
        delivery_pod: "Delivery POD", shop_geotag: "Shop geotag", route_start_point: "Route start point",
      };
      for (const g of gpsRows as any[]) {
        const label = eventLabel[g.event_type] || g.event_type;
        if (g.success) {
          ev.push({
            at: g.created_at, kind: "gps_ok",
            title: `GPS captured · ${label}`,
            detail: g.accuracy != null ? `±${Math.round(g.accuracy)}m accuracy` : null,
            location: g.latitude != null ? { lat: g.latitude, lng: g.longitude, acc: g.accuracy } : null,
          });
        } else {
          ev.push({
            at: g.created_at, kind: "gps_failed",
            title: `GPS failed · ${label}`,
            detail: [g.error_code, g.error_message].filter(Boolean).join(" · ") || "Unknown error",
          });
        }
      }

      return ev.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-5 text-primary" />
            Timeline · {route.name}
          </DialogTitle>
          <div className="text-xs text-muted-foreground">
            {shortDate(date)} · all run, edit, and delivery events
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading timeline…</div>
        ) : !data || data.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No events yet for this route on {shortDate(date)}.
          </div>
        ) : (
          <ol className="relative border-l-2 border-border ml-3 space-y-4 pl-6 py-2">
            {data.map((e, i) => {
              const { Icon, cls } = eventStyle(e.kind);
              const map = e.location ? gmapsUrl(e.location.lat, e.location.lng) : null;
              const loc = e.location ? fmtLatLng(e.location.lat, e.location.lng) : null;
              return (
                <li key={i} className="relative">
                  <span className={`absolute -left-[34px] top-0 flex size-6 items-center justify-center rounded-full border ${cls}`}>
                    <Icon className="size-3.5" />
                  </span>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-sm font-medium">{e.title}</span>
                    <span className="text-[11px] font-mono text-muted-foreground">{fmtDateTime(e.at)}</span>
                  </div>
                  {e.detail && <div className="text-xs text-muted-foreground mt-0.5">{e.detail}</div>}
                  {e.changes && e.changes.length > 0 && (
                    <ul className="mt-1.5 space-y-1 rounded-md border border-border/70 bg-muted/40 p-2">
                      {e.changes.map((c, ci) => (
                        <li key={ci} className="text-[11px] leading-snug">
                          <span className="font-medium text-foreground">{FIELD_LABELS[c.field] || c.field}</span>
                          <span className="mx-1.5 text-muted-foreground">·</span>
                          <span className="line-through text-muted-foreground break-all">{prettyFieldValue(c.field, c.from)}</span>
                          <span className="mx-1.5 text-muted-foreground">→</span>
                          <span className="font-medium text-emerald-700 break-all">{prettyFieldValue(c.field, c.to)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {loc && map && (
                    <a href={map} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                      <MapPin className="size-3" /> {loc}
                      {e.location?.acc != null && <span className="text-muted-foreground">±{Math.round(e.location.acc)}m</span>}
                    </a>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


/* ---------------- Run map dialog ---------------- */

function RunMapDialog({
  open, onClose, route, date, invoiceIds,
}: { open: boolean; onClose: () => void; route: RouteRow; date: string; invoiceIds: string[] }) {
  const { data, isLoading } = useQuery({
    enabled: open,
    queryKey: ["run-map", route.id, date, invoiceIds.join(",")],
    queryFn: async () => {
      const { data: runs } = await supabase
        .from("delivery_runs").select("*")
        .eq("route_id", route.id).eq("run_date", date)
        .order("created_at", { ascending: true });

      const dels = invoiceIds.length === 0 ? [] : (await supabase
        .from("deliveries")
        .select("id, invoice_id, status, delivered_at, pod_latitude, pod_longitude, pod_accuracy_m, pod_captured_at, invoice:invoices(invoice_no, customer:customers(id, name, shop_name, latitude, longitude))")
        .in("invoice_id", invoiceIds)).data ?? [];

      const runIds = (runs ?? []).map((r: any) => r.id);
      const delIds = (dels ?? []).map((d: any) => d.id);
      const dayStart = new Date(`${date}T00:00:00`).toISOString();
      const dayEnd = new Date(`${date}T23:59:59.999`).toISOString();
      const orParts = [`route_id.eq.${route.id}`];
      if (runIds.length) orParts.push(`run_id.in.(${runIds.join(",")})`);
      if (delIds.length) orParts.push(`delivery_id.in.(${delIds.join(",")})`);
      const { data: gps } = await supabase
        .from("gps_audit_logs" as any)
        .select("id, event_type, success, latitude, longitude, accuracy, created_at, run_id, delivery_id")
        .gte("created_at", dayStart).lte("created_at", dayEnd)
        .or(orParts.join(","));

      return { runs: runs ?? [], dels, gps: gps ?? [] } as any;
    },
  });

  // Load ordered stop sequence to number POD markers
  const { data: stops } = useQuery({
    enabled: open,
    queryKey: ["route-stops-for-map", route.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("route_stops").select("customer_id, sequence")
        .eq("route_id", route.id).order("sequence", { ascending: true });
      return data ?? [];
    },
  });

  const points = useMemo(() => {
    if (!data) return [] as import("@/components/RunMap").MapPoint[];
    const pts: import("@/components/RunMap").MapPoint[] = [];
    if (route.start_latitude != null && route.start_longitude != null) {
      pts.push({
        id: `route-start-${route.id}`,
        kind: "pickup_start",
        lat: Number(route.start_latitude), lng: Number(route.start_longitude),
        title: `Route start · ${route.name}`,
        subtitle: "Configured pickup / start point",
      });
    }
    const orderMap = new Map<string, number>();
    (stops ?? []).forEach((s: any, i: number) => orderMap.set(s.customer_id, i + 1));

    for (const r of data.runs as any[]) {
      if (r.start_latitude != null) pts.push({
        id: `run-start-${r.id}`, kind: "run_start",
        lat: Number(r.start_latitude), lng: Number(r.start_longitude),
        title: "Run started", accuracy: r.start_accuracy_m, when: r.started_at,
        subtitle: [r.driver_name, r.vehicle_number].filter(Boolean).join(" · ") || undefined,
      });
      if (r.end_latitude != null) pts.push({
        id: `run-end-${r.id}`, kind: "run_end",
        lat: Number(r.end_latitude), lng: Number(r.end_longitude),
        title: "Run ended", accuracy: r.end_accuracy_m, when: r.ended_at,
      });
    }

    for (const d of data.dels as any[]) {
      const shop = d.invoice?.customer?.shop_name || d.invoice?.customer?.name || "Shop";
      const invNo = d.invoice?.invoice_no ? ` · ${d.invoice.invoice_no}` : "";
      const cid = d.invoice?.customer?.id;
      const ord = cid ? orderMap.get(cid) ?? null : null;
      if (d.pod_latitude != null) {
        pts.push({
          id: `pod-${d.id}`, kind: "pod",
          lat: Number(d.pod_latitude), lng: Number(d.pod_longitude),
          title: `POD · ${shop}${invNo}`,
          subtitle: `Status: ${String(d.status || "").replace("_", " ")}`,
          accuracy: d.pod_accuracy_m, when: d.pod_captured_at || d.delivered_at,
          order: ord,
        });
      } else if (d.invoice?.customer?.latitude != null && d.invoice?.customer?.longitude != null) {
        pts.push({
          id: `shop-${d.id}`, kind: "shop",
          lat: Number(d.invoice.customer.latitude), lng: Number(d.invoice.customer.longitude),
          title: `Shop · ${shop}${invNo}`,
          subtitle: "Geotagged shop location (no POD captured yet)",
          order: ord,
        });
      }
    }

    for (const g of data.gps as any[]) {
      if (g.latitude == null || g.longitude == null) continue;
      // avoid duplicates with run start/end/pod already added
      if (g.run_id || g.delivery_id) continue;
      pts.push({
        id: `gps-${g.id}`, kind: g.success ? "gps_ok" : "gps_failed",
        lat: Number(g.latitude), lng: Number(g.longitude),
        title: `GPS · ${g.event_type}`, accuracy: g.accuracy, when: g.created_at,
      });
    }
    return pts;
  }, [data, stops, route]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { pod: 0, run_start: 0, run_end: 0, pickup_start: 0, shop: 0 };
    points.forEach(p => { c[p.kind] = (c[p.kind] ?? 0) + 1; });
    return c;
  }, [points]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="size-5 text-primary" />
            Map · {route.name}
          </DialogTitle>
          <div className="text-xs text-muted-foreground">
            {shortDate(date)} · pickup, POD and captured GPS points
          </div>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className="border-amber-300 text-amber-700">● Pickup/start ({counts.pickup_start})</Badge>
          <Badge variant="outline" className="border-emerald-300 text-emerald-700">● Run start ({counts.run_start})</Badge>
          <Badge variant="outline" className="border-red-300 text-red-700">● Run end ({counts.run_end})</Badge>
          <Badge variant="outline" className="border-blue-300 text-blue-700">● POD ({counts.pod})</Badge>
          <Badge variant="outline" className="border-slate-300 text-slate-700">● Shop ({counts.shop})</Badge>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading map…</div>
        ) : (
          <ClientOnly fallback={<div className="h-[480px] rounded-md border bg-muted/30" />}>
            <Suspense fallback={<div className="h-[480px] rounded-md border bg-muted/30" />}>
              <RunMap points={points} height={520} />
            </Suspense>
          </ClientOnly>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------- Undo auto-assign preview --------
function UndoAutoAssignPreview({
  open,
  onOpenChange,
  lastAssign,
  routes,
  invoices,
  stops,
  undoing,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lastAssign: {
    date: string;
    createdStops: { route_id: string; customer_id: string }[];
    deliveryPrev: { id: string; customer_id: string; invoice_no: string | null; prev_route_id: string | null; new_route_id: string }[];
    total: number;
  } | null;
  routes: RouteRow[];
  invoices: InvoiceRow[];
  stops: any[];
  undoing: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const routeName = (id: string | null | undefined) => {
    if (!id) return "— Unassigned —";
    return routes.find((r) => r.id === id)?.name ?? "(deleted route)";
  };
  const custName = useMemo(() => {
    const m = new Map<string, string>();
    invoices.forEach((inv: any) => {
      if (inv.customer_id && inv.customer) {
        m.set(inv.customer_id, inv.customer.shop_name || inv.customer.name || "Shop");
      }
    });
    stops.forEach((s: any) => {
      if (s.customer_id && !m.has(s.customer_id)) {
        m.set(s.customer_id, s.customer?.shop_name || s.customer?.name || s.customer?.address || "Shop");
      }
    });
    return m;
  }, [invoices, stops]);

  if (!lastAssign) return null;

  // Group created stops by route
  const stopsByRoute = new Map<string, string[]>();
  lastAssign.createdStops.forEach((s) => {
    const arr = stopsByRoute.get(s.route_id) ?? [];
    arr.push(custName.get(s.customer_id) ?? "Shop");
    stopsByRoute.set(s.route_id, arr);
  });

  // Group deliveries by (prev -> new)
  const reassignByPair = new Map<string, { prev: string | null; next: string; items: { shop: string; invoice: string | null }[] }>();
  lastAssign.deliveryPrev.forEach((d) => {
    const key = `${d.prev_route_id ?? ""}::${d.new_route_id}`;
    const entry = reassignByPair.get(key) ?? { prev: d.prev_route_id, next: d.new_route_id, items: [] };
    entry.items.push({ shop: custName.get(d.customer_id) ?? "Shop", invoice: d.invoice_no });
    reassignByPair.set(key, entry);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Undo auto-assign — impact preview</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm max-h-[60vh] overflow-y-auto pr-1">
          <div className="text-muted-foreground">
            Reverting the last auto-assign for <b>{shortDate(lastAssign.date)}</b>. Review the changes below, then confirm.
          </div>

          <section>
            <div className="font-medium mb-2 flex items-center gap-2">
              <Trash2 className="size-4 text-rose-600" />
              Route stops to remove <Badge variant="secondary">{lastAssign.createdStops.length}</Badge>
            </div>
            {stopsByRoute.size === 0 ? (
              <div className="text-muted-foreground text-xs pl-6">No new stops were created.</div>
            ) : (
              <div className="space-y-2 pl-6">
                {Array.from(stopsByRoute.entries()).map(([rid, shops]) => (
                  <div key={rid} className="rounded border border-rose-200 bg-rose-50 p-2">
                    <div className="font-medium">{routeName(rid)} <span className="text-muted-foreground font-normal">— removing {shops.length}</span></div>
                    <ul className="mt-1 space-y-0.5">
                      {shops.map((s, i) => (
                        <li key={i} className="text-xs line-through decoration-rose-400">{s}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="font-medium mb-2 flex items-center gap-2">
              <RouteIcon className="size-4 text-primary" />
              Delivery re-assignments <Badge variant="secondary">{lastAssign.deliveryPrev.length}</Badge>
            </div>
            {reassignByPair.size === 0 ? (
              <div className="text-muted-foreground text-xs pl-6">No deliveries were re-routed.</div>
            ) : (
              <div className="space-y-2 pl-6">
                {Array.from(reassignByPair.values()).map((g, i) => (
                  <div key={i} className="rounded border border-amber-200 bg-amber-50 p-2">
                    <div className="text-xs flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="bg-rose-50 border-rose-200 text-rose-700 line-through">{routeName(g.next)}</Badge>
                      <span className="text-muted-foreground">→ revert to</span>
                      <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700">{routeName(g.prev)}</Badge>
                      <span className="text-muted-foreground">({g.items.length})</span>
                    </div>
                    <ul className="mt-1 space-y-0.5">
                      {g.items.map((it, j) => (
                        <li key={j} className="text-xs">
                          {it.shop}
                          {it.invoice ? <span className="text-muted-foreground"> · #{it.invoice}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={undoing}>Cancel</Button>
          <Button onClick={onConfirm} disabled={undoing} className="gap-1.5">
            {undoing ? "Undoing…" : "Confirm undo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
