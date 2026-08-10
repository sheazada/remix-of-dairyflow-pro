import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { inr, num, isoDate, shortDate } from "@/lib/format";
import { toast } from "sonner";
import {
  AlertTriangle,
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Filter,
  Layers,
  Package,
  Pencil,
  Printer,
  Search,
  ShieldCheck,
  Trash2,
  TrendingDown,
  TrendingUp,
  XCircle,
  Plus,
  Check,
  X,
  Warehouse,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StockAdjustButtons } from "@/components/stock-adjust-dialog";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: Inventory,
});

// Check if new inventory tables exist
async function checkTablesExist() {
  try {
    const { error } = await (supabase as any).from("warehouses").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}

function Inventory() {
  const [tab, setTab] = useState<"stock" | "batches" | "movements" | "adjustments" | "damaged">("stock");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [migrationNeeded, setMigrationNeeded] = useState(false);

  const qc = useQueryClient();

  // Products
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("status", "active").order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  // Batches
  const { data: batches = [] } = useQuery({
    queryKey: ["batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_batches")
        .select("*, product:products(name, unit)")
        .order("expiry_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Movements
  const { data: movements = [], error: movError } = useQuery({
    queryKey: ["movements", dateFilter],
    queryFn: async () => {
      let q = supabase
        .from("inventory_movements")
        .select("*, product:products(name, unit)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (dateFilter) q = q.gte("created_at", dateFilter + "T00:00:00").lte("created_at", dateFilter + "T23:59:59");
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  // Check if new tables exist
  const { data: hasNewTables } = useQuery({
    queryKey: ["has-new-inventory-tables"],
    queryFn: checkTablesExist,
    retry: false,
  });

  // Adjustments (only if tables exist)
  const { data: adjustments = [] as any[] } = useQuery<any[]>({
    queryKey: ["adjustments"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("stock_adjustments").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: hasNewTables === true,
    retry: false,
  });

  // Warehouses (only if tables exist)
  const { data: warehouses = [] as any[] } = useQuery<any[]>({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("warehouses").select("*").eq("is_active", true).order("name");
      return (data ?? []) as any[];
    },
    enabled: hasNewTables === true,
    retry: false,
  });

  // Near-expiry (only if function exists)
  const { data: nearExpiry = [] as any[] } = useQuery<any[]>({
    queryKey: ["near-expiry"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_near_expiry_stock", { _days: 30 });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: hasNewTables === true,
    retry: false,
  });

  // Stock valuation (only if function exists)
  const { data: valuation = [] as any[] } = useQuery<any[]>({
    queryKey: ["stock-valuation"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_stock_valuation");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: hasNewTables === true,
    retry: false,
  });

  const lowStockProducts = products.filter((p) => Number(p.current_stock) > 0 && Number(p.current_stock) <= Number(p.min_stock));
  const outOfStockProducts = products.filter((p) => Number(p.current_stock) <= 0);
  const expiringSoon = nearExpiry.filter((b: any) => b.days_remaining <= 7);
  const damagedBatches = batches.filter((b: any) => Number(b.damaged_qty ?? 0) > 0 || b.status === "expired");

  const totalStockValue = valuation.reduce((s: number, v: any) => s + Number(v.total_value ?? 0), 0);
  const totalDamaged = batches.reduce((s: number, b: any) => s + Number(b.damaged_qty ?? 0), 0);

  const tabs = hasNewTables
    ? [
        { value: "stock" as const, label: "Stock by Product", icon: Boxes },
        { value: "batches" as const, label: "Batches (FEFO)", icon: Layers },
        { value: "movements" as const, label: "Movements", icon: ArrowUpRight },
        { value: "adjustments" as const, label: "Adjustments", icon: Pencil },
        { value: "damaged" as const, label: "Damaged/Expired", icon: Trash2 },
      ]
    : [
        { value: "stock" as const, label: "Stock by Product", icon: Boxes },
        { value: "batches" as const, label: "Batches", icon: Layers },
        { value: "movements" as const, label: "Movements", icon: ArrowUpRight },
      ];

  return (
    <PageContainer>
      <PageHeader
        title="Inventory"
        description="Track stock levels, batches, movements, and valuation."
        actions={
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 no-print">
            <Printer className="size-4" /> Print
          </Button>
        }
      />

      {/* Migration needed banner */}
      {hasNewTables === false && (
        <Card className="p-4 mb-4 bg-amber-50 border-amber-200">
          <div className="flex items-start gap-3">
            <Database className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-amber-800">Database Migration Required</div>
              <div className="text-sm text-amber-700 mt-1">
                Full inventory features (adjustments, damaged/expired tracking, stock valuation) need a database migration.
              </div>
              <div className="text-sm text-amber-700 mt-2">
                <b>To fix:</b> Go to Supabase → SQL Editor → Paste the contents of{" "}
                <code className="bg-amber-100 px-1 rounded">supabase/migrations/20260725100000_full_inventory.sql</code> → Click Run
              </div>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 border-amber-300 text-amber-800 hover:bg-amber-100"
                onClick={() => {
                  navigator.clipboard.writeText(
                    "Go to Supabase Dashboard → SQL Editor → Run migration file: supabase/migrations/20260725100000_full_inventory.sql"
                  );
                  toast.success("Instructions copied to clipboard");
                }}
              >
                Copy Instructions
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <KpiCard label="Total SKUs" value={String(products.length)} icon={Package} />
        <KpiCard label="Low Stock" value={String(lowStockProducts.length)} icon={AlertTriangle} tone="warning" />
        <KpiCard label="Out of Stock" value={String(outOfStockProducts.length)} icon={XCircle} tone="destructive" />
        {hasNewTables && (
          <>
            <KpiCard label="Stock Value" value={inr(totalStockValue)} icon={TrendingUp} tone="success" />
            <KpiCard label="Expiring ≤30d" value={String(nearExpiry.length)} icon={Calendar} tone="warning" />
          </>
        )}
        {!hasNewTables && (
          <KpiCard label="Movements" value={String(movements.length)} icon={ArrowUpRight} />
        )}
      </div>

      {/* Alert panels */}
      {(lowStockProducts.length > 0 || (hasNewTables && nearExpiry.length > 0)) && (
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          {lowStockProducts.length > 0 && (
            <AlertPanel
              title="Low Stock Alert"
              icon={<AlertTriangle className="size-4 text-warning" />}
              tone="warning"
            >
              {lowStockProducts.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <span className="text-sm font-medium truncate">{p.name}</span>
                  <Badge variant="destructive" className="font-mono text-xs">
                    {num(p.current_stock, 1)} {p.unit}
                  </Badge>
                </div>
              ))}
            </AlertPanel>
          )}

          {hasNewTables && nearExpiry.length > 0 && (
            <AlertPanel
              title={`Expiring Soon (${nearExpiry.length} batches)`}
              icon={<Calendar className="size-4 text-destructive" />}
              tone="destructive"
            >
              {nearExpiry.slice(0, 5).map((b: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <span className="text-sm font-medium truncate">{b.product_name}</span>
                  <div className="text-right">
                    <div className="font-mono text-xs">{num(b.available_qty, 1)}</div>
                    <div className="text-[10px] text-destructive">{b.days_remaining}d left</div>
                  </div>
                </div>
              ))}
            </AlertPanel>
          )}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="flex-wrap h-auto">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
              <t.icon className="size-4" /> {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="stock" className="mt-4">
          <StockByProductTab products={products} valuation={valuation} />
        </TabsContent>

        <TabsContent value="batches" className="mt-4">
          <BatchesTab batches={batches} />
        </TabsContent>

        <TabsContent value="movements" className="mt-4">
          <MovementsTab movements={movements} dateFilter={dateFilter} setDateFilter={setDateFilter} />
        </TabsContent>

        {hasNewTables && (
          <>
            <TabsContent value="adjustments" className="mt-4">
              <AdjustmentsTab
                adjustments={adjustments}
                products={products}
                warehouses={warehouses}
              />
            </TabsContent>

            <TabsContent value="damaged" className="mt-4">
              <DamagedExpiredTab
                batches={damagedBatches}
                nearExpiry={nearExpiry}
                movements={movements.filter((m: any) => m.movement_type === "damaged" || m.movement_type === "expired")}
              />
            </TabsContent>
          </>
        )}
      </Tabs>
    </PageContainer>
  );
}

/* ═══════════════════════════════════════════
   Dashboard components
   ═══════════════════════════════════════════ */

function KpiCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone?: "default" | "success" | "warning" | "destructive" | "primary" }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className={cn(
          "size-4",
          tone === "success" ? "text-success" :
          tone === "warning" ? "text-warning" :
          tone === "destructive" ? "text-destructive" :
          tone === "primary" ? "text-primary" : "text-muted-foreground"
        )} />
      </div>
      <div className={cn(
        "text-2xl font-bold font-mono",
        tone === "destructive" ? "text-destructive" :
        tone === "warning" ? "text-warning" : ""
      )}>
        {value}
      </div>
    </Card>
  );
}

function AlertPanel({ title, icon, tone, children }: { title: string; icon: React.ReactNode; tone: "warning" | "destructive" | "primary"; children: React.ReactNode }) {
  return (
    <Card className={cn(
      "p-4",
      tone === "warning" ? "border-warning/30" :
      tone === "destructive" ? "border-destructive/30" : "border-primary/20"
    )}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <div className="text-xs font-semibold uppercase tracking-wider">{title}</div>
      </div>
      {children}
    </Card>
  );
}

/* ══════════════════════════════════════════
   Stock by Product Tab
   ═══════════════════════════════════════════ */

function StockByProductTab({ products, valuation }: { products: any[]; valuation: any[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");

  const valMap = useMemo(() => {
    const m = new Map<string, any>();
    valuation.forEach((v: any) => m.set(v.product_id, v));
    return m;
  }, [valuation]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => {
        if (q && !p.name.toLowerCase().includes(q) && !(p.category ?? "").toLowerCase().includes(q)) return false;
        if (filter === "low") return Number(p.current_stock) > 0 && Number(p.current_stock) <= Number(p.min_stock);
        if (filter === "out") return Number(p.current_stock) <= 0;
        return true;
      })
      .sort((a, b) => Number(a.current_stock) - Number(b.current_stock));
  }, [products, search, filter]);

  return (
    <div className="space-y-3">
      <Card className="p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search product or category…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
        </div>
        <div className="flex rounded-md border overflow-hidden text-xs">
          {(["all", "low", "out"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn("px-3 py-1.5 font-medium", filter === f ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>
              {f === "all" ? "All" : f === "low" ? "Low Stock" : "Out of Stock"}
            </button>
          ))}
        </div>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} products</div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-3 font-semibold">Product</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Category</th>
                <th className="text-center px-4 py-3 font-semibold">Stock</th>
                <th className="text-right px-4 py-3 font-semibold hidden sm:table-cell">Min</th>
                <th className="text-right px-4 py-3 font-semibold hidden md:table-cell">Avg Cost</th>
                <th className="text-right px-4 py-3 font-semibold">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No products match your filters.</td></tr>
              )}
              {filtered.map((p) => {
                const low = Number(p.current_stock) > 0 && Number(p.current_stock) <= Number(p.min_stock);
                const out = Number(p.current_stock) <= 0;
                const val = valMap.get(p.id);
                return (
                  <tr key={p.id} className={cn("hover:bg-muted/30", out && "bg-destructive/5")}>
                    <td className="px-4 py-3">
                      <div className="font-medium flex items-center gap-2">
                        {p.name}
                        {out && <XCircle className="size-3.5 text-destructive" />}
                        {low && !out && <AlertTriangle className="size-3.5 text-warning" />}
                      </div>
                      <div className="text-xs text-muted-foreground">{p.unit}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{p.category ?? "—"}</td>
                    <td className={cn("px-4 py-3 text-right font-mono font-semibold", out ? "text-destructive" : low ? "text-warning" : "")}>
                      <div className="flex items-center justify-end gap-2">
                        <span>{num(p.current_stock, 2)}</span>
                        <StockAdjustButtons
                          productId={p.id}
                          productName={p.name}
                          currentStock={Number(p.current_stock)}
                          unit={p.unit}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground hidden sm:table-cell">{num(p.min_stock, 2)}</td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground hidden md:table-cell">{inr(val?.avg_cost ?? p.purchase_price)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{inr(val?.total_value ?? Number(p.current_stock) * Number(p.purchase_price))}</td>
                  </tr>
                );
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-primary/5 font-semibold">
                  <td colSpan={2} className="px-4 py-3">Total Value</td>
                  <td colSpan={3}></td>
                  <td className="px-4 py-3 text-right font-mono text-lg">
                    {inr(filtered.reduce((s, p) => {
                      const val = valMap.get(p.id);
                      return s + (val?.total_value ?? Number(p.current_stock) * Number(p.purchase_price));
                    }, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Batches Tab (FEFO ordered)
   ═══════════════════════════════════════════ */

function BatchesTab({ batches }: { batches: any[] }) {
  const [search, setSearch] = useState("");
  const [showExpired, setShowExpired] = useState(false);

  const now = new Date();
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return batches
      .filter((b: any) => {
        const isExpired = b.expiry_date && new Date(b.expiry_date) < now;
        if (!showExpired && isExpired) return false;
        if (q && !(b.product?.name ?? "").toLowerCase().includes(q) && !(b.batch_no ?? "").toLowerCase().includes(q)) return false;
        return true;
      });
  }, [batches, search, showExpired, now]);

  return (
    <div className="space-y-3">
      <Card className="p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search product or batch…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
        </div>
        <Label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={showExpired} onChange={(e) => setShowExpired(e.target.checked)} className="size-4" />
          Show expired batches
        </Label>
        <div className="text-xs text-muted-foreground ml-auto">
          FEFO order · {filtered.length} batches
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-3 font-semibold">Product</th>
                <th className="text-left px-4 py-3 font-semibold">Batch</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Mfg Date</th>
                <th className="text-left px-4 py-3 font-semibold">Expiry</th>
                <th className="text-right px-4 py-3 font-semibold">Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No batches found.</td></tr>
              )}
              {filtered.map((b: any) => {
                const isExpired = b.expiry_date && new Date(b.expiry_date) < now;
                const isExpiringSoon = b.expiry_date && !isExpired && (new Date(b.expiry_date).getTime() - now.getTime()) <= 7 * 24 * 3600 * 1000;
                return (
                  <tr key={b.id} className={cn("hover:bg-muted/30", isExpired && "bg-destructive/5", isExpiringSoon && !isExpired && "bg-warning/5")}>
                    <td className="px-4 py-3 font-medium">{b.product?.name ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{b.batch_no ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">{b.mfg_date ? shortDate(b.mfg_date) : "—"}</td>
                    <td className="px-4 py-3 text-xs">
                      {b.expiry_date ? (
                        <span className={cn(isExpired ? "text-destructive font-semibold" : isExpiringSoon ? "text-warning font-semibold" : "")}>
                          {shortDate(b.expiry_date)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{num(b.quantity ?? b.available_qty, 2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Movements Tab
   ═══════════════════════════════════════════ */

function MovementsTab({ movements, dateFilter, setDateFilter }: { movements: any[]; dateFilter: string; setDateFilter: (v: string) => void }) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return movements.filter((m: any) => {
      if (typeFilter !== "all" && m.movement_type !== typeFilter) return false;
      if (search && !(m.product?.name ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [movements, typeFilter, search]);

  const movementColors: Record<string, string> = {
    in: "text-success",
    out: "text-destructive",
    damaged: "text-destructive",
    expired: "text-destructive",
    adjustment: "text-warning",
  };

  const totalIn = filtered.filter((m: any) => ["in"].includes(m.movement_type)).reduce((s: number, m: any) => s + Number(m.quantity), 0);
  const totalOut = filtered.filter((m: any) => ["out"].includes(m.movement_type)).reduce((s: number, m: any) => s + Number(m.quantity), 0);
  const totalDamaged = filtered.filter((m: any) => m.movement_type === "damaged").reduce((s: number, m: any) => s + Number(m.quantity), 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3"><div className="text-[10px] uppercase text-muted-foreground font-semibold">Total In</div><div className="text-lg font-mono font-bold text-success">+{num(totalIn, 1)}</div></Card>
        <Card className="p-3"><div className="text-[10px] uppercase text-muted-foreground font-semibold">Total Out</div><div className="text-lg font-mono font-bold text-destructive">-{num(totalOut, 1)}</div></Card>
        <Card className="p-3"><div className="text-[10px] uppercase text-muted-foreground font-semibold">Damaged</div><div className="text-lg font-mono font-bold text-destructive">{num(totalDamaged, 1)}</div></Card>
      </div>

      <Card className="p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search product…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-muted-foreground" />
          <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-36 h-9" />
          {dateFilter && <Button variant="ghost" size="sm" onClick={() => setDateFilter("")}>Clear</Button>}
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="in">Stock In</SelectItem>
            <SelectItem value="out">Stock Out</SelectItem>
            <SelectItem value="damaged">Damaged</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="adjustment">Adjustment</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-3 font-semibold">Time</th>
                <th className="text-left px-4 py-3 font-semibold">Product</th>
                <th className="text-left px-4 py-3 font-semibold">Type</th>
                <th className="text-right px-4 py-3 font-semibold">Qty</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No movements found.</td></tr>
              )}
              {filtered.map((m: any) => {
                const color = movementColors[m.movement_type] ?? "text-muted-foreground";
                const isIn = ["in", "adjustment"].includes(m.movement_type) && !["damaged", "expired"].includes(m.movement_type);
                return (
                  <tr key={m.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(m.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-4 py-3 font-medium">{m.product?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1 text-xs font-semibold uppercase", color)}>
                        {m.movement_type}
                      </span>
                    </td>
                    <td className={cn("px-4 py-3 text-right font-mono font-semibold", isIn ? "text-success" : "text-destructive")}>
                      {isIn ? "+" : "-"}{num(m.quantity, 2)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell max-w-[200px] truncate">{m.note ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Adjustments Tab (only with migration)
   ═══════════════════════════════════════════ */

function AdjustmentsTab({ adjustments, products, warehouses }: { adjustments: any[]; products: any[]; warehouses: any[] }) {
  return (
    <Card className="p-8 text-center">
      <Pencil className="size-10 mx-auto mb-3 text-muted-foreground" />
      <div className="text-lg font-semibold mb-1">Stock Adjustments</div>
      <div className="text-sm text-muted-foreground">
        {adjustments.length} adjustments recorded.
      </div>
      {adjustments.length === 0 && (
        <div className="text-xs text-muted-foreground mt-2">
          Use the "Stock Adjustment" button on the main inventory page to create adjustments.
        </div>
      )}
    </Card>
  );
}

/* ═══════════════════════════════════════════
   Damaged / Expired Tab
   ═══════════════════════════════════════════ */

function DamagedExpiredTab({ batches, nearExpiry, movements }: { batches: any[]; nearExpiry: any[]; movements: any[] }) {
  return (
    <div className="space-y-4">
      {/* Damaged stock */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b bg-destructive/5">
          <div className="flex items-center gap-2">
            <Trash2 className="size-4 text-destructive" />
            <h3 className="font-semibold text-sm">Damaged Stock</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-3 font-semibold">Product</th>
                <th className="text-left px-4 py-3 font-semibold">Batch</th>
                <th className="text-left px-4 py-3 font-semibold">Expiry</th>
                <th className="text-right px-4 py-3 font-semibold">Damaged Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {batches.length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No damaged stock.</td></tr>
              )}
              {batches.map((b: any) => (
                <tr key={b.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{b.product?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{b.batch_no ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">{b.expiry_date ? shortDate(b.expiry_date) : "—"}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-destructive">{num(b.damaged_qty ?? 0, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Near expiry */}
      {nearExpiry.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b bg-warning/5">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-warning" />
              <h3 className="font-semibold text-sm">Near Expiry (≤ 30 days)</h3>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left px-4 py-3 font-semibold">Product</th>
                  <th className="text-left px-4 py-3 font-semibold">Batch</th>
                  <th className="text-left px-4 py-3 font-semibold">Expiry Date</th>
                  <th className="text-right px-4 py-3 font-semibold">Days Left</th>
                  <th className="text-right px-4 py-3 font-semibold">Available Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {nearExpiry.map((b: any, i: number) => (
                  <tr key={i} className={cn("hover:bg-muted/20", b.days_remaining <= 7 && "bg-warning/5")}>
                    <td className="px-4 py-3 font-medium">{b.product_name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{b.batch_no ?? "—"}</td>
                    <td className="px-4 py-3 text-xs">{shortDate(b.expiry_date)}</td>
                    <td className="px-4 py-3 text-right">
                      <Badge variant={b.days_remaining <= 7 ? "destructive" : "outline"} className={cn("font-mono", b.days_remaining <= 7 && "text-destructive")}>
                        {b.days_remaining}d
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{num(b.available_qty, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Recent damage/expiry movements */}
      {movements.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h3 className="font-semibold text-sm">Recent Damage / Expiry Movements</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
                  <th className="text-left px-4 py-3 font-semibold">Time</th>
                  <th className="text-left px-4 py-3 font-semibold">Product</th>
                  <th className="text-left px-4 py-3 font-semibold">Type</th>
                  <th className="text-right px-4 py-3 font-semibold">Qty</th>
                  <th className="text-left px-4 py-3 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {movements.slice(0, 20).map((m: any) => (
                  <tr key={m.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-4 py-3 font-medium">{m.product?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="destructive" className="text-[10px] uppercase">{m.movement_type}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-destructive">{num(m.quantity, 2)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{m.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
