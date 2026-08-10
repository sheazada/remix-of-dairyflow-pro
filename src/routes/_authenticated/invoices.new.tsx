import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { inr, genDocNo, isoDate, num } from "@/lib/format";
import {
  Trash2,
  Plus,
  Minus,
  Search,
  ShoppingCart,
  User,
  ArrowLeft,
  Check,
  AlertTriangle,
  Wallet,
  Copy,
  Percent,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  customerId: z.string().optional(),
  fromInvoice: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/invoices/new")({
  validateSearch: searchSchema,
  component: NewInvoice,
});

type Line = {
  product_id: string;
  product_name: string;
  hsn: string;
  quantity: number;
  rate: number;
  discount: number;
  gst_rate: number;
  stock: number;
};

type PayMode = "cash" | "upi" | "bank" | "cod" | "";

function NewInvoice() {
  const nav = useNavigate();
  const { customerId: initialCust, fromInvoice } = Route.useSearch();
  const [customerId, setCustomerId] = useState(initialCust ?? "");
  const [invoiceDate, setInvoiceDate] = useState(isoDate());
  const [interstate, setInterstate] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [collectNow, setCollectNow] = useState(false);
  const [payMode, setPayMode] = useState<PayMode>("cash");
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payRef, setPayRef] = useState("");
  const [prefilledFrom, setPrefilledFrom] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () =>
      (await supabase.from("customers").select("*").order("name")).data ?? [],
  });
  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () =>
      (await supabase.from("products").select("*").eq("status", "active").order("name")).data ?? [],
  });

  // Recent products bought by this customer (last 90 days, up to 6)
  const { data: recentProducts } = useQuery({
    enabled: !!customerId,
    queryKey: ["recent-products", customerId],
    queryFn: async () => {
      const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
      const { data: invs } = await supabase
        .from("invoices")
        .select("id")
        .eq("customer_id", customerId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(15);
      const ids = (invs ?? []).map((r: any) => r.id);
      if (!ids.length) return [];
      const { data: items } = await supabase
        .from("invoice_items")
        .select("product_id, product_name, quantity")
        .in("invoice_id", ids);
      const counts = new Map<string, { name: string; qty: number }>();
      for (const it of items ?? []) {
        if (!it.product_id) continue;
        const c = counts.get(it.product_id) ?? { name: it.product_name, qty: 0 };
        c.qty += Number(it.quantity) || 0;
        counts.set(it.product_id, c);
      }
      return [...counts.entries()]
        .sort((a, b) => b[1].qty - a[1].qty)
        .slice(0, 6)
        .map(([id, v]) => ({ id, name: v.name }));
    },
  });

  // Last invoice for the customer (for Duplicate button)
  const { data: lastInvoice } = useQuery({
    enabled: !!customerId,
    queryKey: ["last-invoice", customerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_no, invoice_date")
        .eq("customer_id", customerId)
        .neq("status", "void")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const selectedCustomer = useMemo(
    () => (customers ?? []).find((c) => c.id === customerId),
    [customers, customerId],
  );

  const totals = useMemo(() => {
    let subtotal = 0,
      discount = 0,
      tax = 0;
    for (const l of lines) {
      const gross = l.quantity * l.rate;
      const disc = l.discount;
      const taxable = Math.max(gross - disc, 0);
      const t = (taxable * l.gst_rate) / 100;
      subtotal += taxable;
      discount += disc;
      tax += t;
    }
    const cgst = interstate ? 0 : tax / 2;
    const sgst = interstate ? 0 : tax / 2;
    const igst = interstate ? tax : 0;
    return { subtotal, discount, tax, cgst, sgst, igst, total: subtotal + tax };
  }, [lines, interstate]);

  const creditInfo = useMemo(() => {
    if (!selectedCustomer) return null;
    const limit = Number(selectedCustomer.credit_limit ?? 0);
    const outstanding = Number(selectedCustomer.outstanding ?? 0);
    const projected = outstanding + totals.total;
    const over = limit > 0 && projected > limit;
    return { limit, outstanding, projected, over };
  }, [selectedCustomer, totals.total]);

  // Prefill from previous invoice
  const prefillFromInvoice = async (invoiceId: string) => {
    const { data: srcInv } = await supabase
      .from("invoices")
      .select("customer_id, igst, notes")
      .eq("id", invoiceId)
      .single();
    if (!srcInv) return toast.error("Source invoice not found");
    const { data: srcItems } = await supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoiceId);
    if (!srcItems || srcItems.length === 0) return toast.error("No items to copy");
    setCustomerId(srcInv.customer_id);
    setInterstate(Number(srcInv.igst) > 0);
    const prodMap = new Map((products ?? []).map((p: any) => [p.id, p]));
    setLines(
      srcItems.map((it: any) => {
        const p = it.product_id ? prodMap.get(it.product_id) : null;
        return {
          product_id: it.product_id,
          product_name: it.product_name,
          hsn: it.hsn ?? "",
          quantity: Number(it.ordered_quantity ?? it.quantity) || 1,
          rate: Number(it.rate),
          discount: Number(it.discount) || 0,
          gst_rate: Number(it.gst_rate),
          stock: p ? Number((p as any).current_stock) : 0,
        };
      }),
    );
    setPrefilledFrom(invoiceId);
    toast.success("Copied from previous invoice");
  };

  useEffect(() => {
    if (fromInvoice && (products?.length ?? 0) > 0 && prefilledFrom !== fromInvoice) {
      prefillFromInvoice(fromInvoice);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromInvoice, products]);

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    const list = products ?? [];
    if (!q) return list.slice(0, 8);
    return list
      .filter(
        (p: any) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku ?? "").toLowerCase().includes(q) ||
          (p.hsn ?? "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [products, productQuery]);

  const addProduct = (p: any) => {
    const existingIdx = lines.findIndex((l) => l.product_id === p.id);
    if (existingIdx >= 0) {
      setLines(lines.map((l, i) => (i === existingIdx ? { ...l, quantity: l.quantity + 1 } : l)));
    } else {
      setLines([
        ...lines,
        {
          product_id: p.id,
          product_name: p.name,
          hsn: p.hsn ?? "",
          quantity: 1,
          rate: Number(p.selling_price),
          discount: 0,
          gst_rate: Number(p.gst_rate),
          stock: Number(p.current_stock),
        },
      ]);
    }
    setProductQuery("");
  };

  const addProductById = (id: string) => {
    const p = (products ?? []).find((x: any) => x.id === id);
    if (p) addProduct(p);
  };

  const updateLine = (i: number, patch: Partial<Line>) =>
    setLines(lines.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const rmLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));

  // Keyboard shortcuts: "/" focuses search, Ctrl/Cmd+S saves
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (e.key === "/" && !isInput) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, lines, collectNow, payAmount, payMode]);

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && filteredProducts[0]) {
      e.preventDefault();
      addProduct(filteredProducts[0]);
    }
    if (e.key === "Escape") setProductQuery("");
  };

  const save = async () => {
    if (!customerId) return toast.error("Select customer");
    if (lines.length === 0) return toast.error("Add at least one item");
    if (saving) return;
    if (creditInfo?.over) {
      const ok = window.confirm(
        `Credit limit exceeded. Projected outstanding ${inr(creditInfo.projected)} exceeds limit ${inr(creditInfo.limit)}. Continue?`,
      );
      if (!ok) return;
    }
    setSaving(true);
    const invoice_no = genDocNo("INV");
    const { data: inv, error } = await supabase
      .from("invoices")
      .insert({
        invoice_no,
        customer_id: customerId,
        invoice_date: invoiceDate,
        subtotal: totals.subtotal,
        discount: totals.discount,
        cgst: totals.cgst,
        sgst: totals.sgst,
        igst: totals.igst,
        total: totals.total,
        balance: totals.total,
        notes: notes || null,
      })
      .select()
      .single();

    if (!error && inv) {
      const itemRows = lines.map((l) => {
        const taxable = Math.max(l.quantity * l.rate - l.discount, 0);
        const tax = (taxable * l.gst_rate) / 100;
        return {
          invoice_id: inv.id,
          product_id: l.product_id,
          product_name: l.product_name,
          hsn: l.hsn || null,
          quantity: l.quantity,
          rate: l.rate,
          discount: l.discount,
          gst_rate: l.gst_rate,
          taxable,
          tax_amount: tax,
          amount: taxable + tax,
        };
      });
      await supabase.from("invoice_items").insert(itemRows);

      // Batch stock updates (instead of N+1 loop)
      const stockUpdates = lines
        .map((l) => {
          const p = (products ?? []).find((x) => x.id === l.product_id);
          return p ? { id: l.product_id, current_stock: Number(p.current_stock) - l.quantity } : null;
        })
        .filter((u): u is { id: string; current_stock: number } => u !== null);
      
      const movements = lines
        .filter((l) => (products ?? []).some((x) => x.id === l.product_id))
        .map((l) => ({
          product_id: l.product_id,
          movement_type: "out" as const,
          quantity: l.quantity,
          ref_type: "invoice" as const,
          ref_id: inv.id,
          note: `Invoice ${invoice_no}`,
        }));

      if (stockUpdates.length > 0) {
        await supabase.from("products").upsert(stockUpdates as never);
      }
      if (movements.length > 0) {
        await supabase.from("inventory_movements").insert(movements);
      }

      // Collect payment now (creates payment; triggers recalc balance + outstanding)
      if (collectNow && payAmount > 0 && payMode) {
        const { error: payErr } = await supabase.from("payments").insert({
          payment_no: genDocNo("PMT"),
          invoice_id: inv.id,
          customer_id: customerId,
          amount: payAmount,
          mode: payMode,
          reference: payRef || null,
          payment_date: invoiceDate,
        });
        if (payErr) toast.error(`Invoice saved, payment failed: ${payErr.message}`);
      }

      await supabase.from("deliveries").insert({ invoice_id: inv.id, status: "pending" });
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Invoice created");
    nav({ to: "/invoices/$id", params: { id: inv!.id } });
  };

  return (
    <PageContainer>
      <PageHeader
        title="Generate Invoice"
        description="Create a GST-compliant invoice. Stock, ledger and delivery update automatically."
        actions={
          <div className="flex items-center gap-2">
            {lastInvoice && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => prefillFromInvoice(lastInvoice.id)}
              >
                <Copy className="size-3.5" /> Duplicate last ({lastInvoice.invoice_no})
              </Button>
            )}
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => nav({ to: "/invoices" })}>
              <ArrowLeft className="size-4" /> Back
            </Button>
          </div>
        }
      />

      <div className="grid lg:grid-cols-[1fr_360px] gap-4 lg:gap-6 pb-32 lg:pb-6">
        <div className="space-y-4">
          {/* Customer + Date */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <User className="size-4 text-primary" />
              <h3 className="font-semibold text-sm">Bill to</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Customer *</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Choose a retail shop" />
                  </SelectTrigger>
                  <SelectContent>
                    {(customers ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <div className="flex flex-col text-left">
                          <span className="font-medium">{c.name}</span>
                          <span className="text-xs text-muted-foreground">{c.shop_name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Invoice date</Label>
                <Input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>

            {selectedCustomer && (
              <div className="mt-3 p-3 rounded-lg bg-muted/40 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                {selectedCustomer.gstin && (
                  <div>
                    <span className="text-muted-foreground">GSTIN: </span>
                    <span className="font-mono font-medium">{selectedCustomer.gstin}</span>
                  </div>
                )}
                {selectedCustomer.mobile && (
                  <div>
                    <span className="text-muted-foreground">Phone: </span>
                    <span className="font-medium">{selectedCustomer.mobile}</span>
                  </div>
                )}
                <div className="ml-auto">
                  <span className="text-muted-foreground">Outstanding: </span>
                  <span
                    className={cn(
                      "font-mono font-semibold",
                      Number(selectedCustomer.outstanding) > 0 && "text-destructive",
                    )}
                  >
                    {inr(selectedCustomer.outstanding)}
                  </span>
                </div>
              </div>
            )}

            {creditInfo && creditInfo.limit > 0 && (
              <div
                className={cn(
                  "mt-2 flex items-start gap-2 rounded-lg border p-2.5 text-xs",
                  creditInfo.over
                    ? "border-destructive/40 bg-destructive/5 text-destructive"
                    : "border-border bg-muted/30 text-muted-foreground",
                )}
              >
                <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                <div className="flex-1">
                  Projected outstanding after this invoice:{" "}
                  <span className="font-mono font-semibold">{inr(creditInfo.projected)}</span> of{" "}
                  <span className="font-mono">{inr(creditInfo.limit)}</span> limit
                  {creditInfo.over && " — exceeds credit limit"}.
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center gap-2">
              <Switch checked={interstate} onCheckedChange={setInterstate} id="ist" />
              <Label htmlFor="ist" className="cursor-pointer text-xs">
                Interstate sale (charge IGST)
              </Label>
            </div>
          </Card>

          {/* Product picker */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="size-4 text-primary" />
                <h3 className="font-semibold text-sm">Items</h3>
                {lines.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {lines.length}
                  </Badge>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground hidden sm:block">
                Press <kbd className="px-1 py-0.5 border rounded bg-muted">/</kbd> to search ·{" "}
                <kbd className="px-1 py-0.5 border rounded bg-muted">Enter</kbd> to add
              </span>
            </div>

            {(recentProducts?.length ?? 0) > 0 && lines.length === 0 && (
              <div className="mb-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  Recent for this customer
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recentProducts!.map((rp) => (
                    <button
                      key={rp.id}
                      type="button"
                      onClick={() => addProductById(rp.id)}
                      className="text-xs px-2.5 py-1 rounded-full border hover:bg-primary hover:text-primary-foreground hover:border-primary transition"
                    >
                      + {rp.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Search product to add…  (press / to focus)"
                className="pl-9 h-10"
              />
              {(productQuery || filteredProducts.length > 0) && (
                <div className="mt-2 border rounded-lg divide-y max-h-72 overflow-y-auto bg-card">
                  {filteredProducts.length === 0 && (
                    <div className="p-4 text-center text-xs text-muted-foreground">No products match.</div>
                  )}
                  {filteredProducts.map((p: any, idx: number) => {
                    const stock = Number(p.current_stock);
                    const inCart = lines.some((l) => l.product_id === p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addProduct(p)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left",
                          idx === 0 && productQuery && "bg-muted/30",
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate flex items-center gap-2">
                            {p.name}
                            {inCart && <Check className="size-3.5 text-primary shrink-0" />}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex gap-2 flex-wrap">
                            <span>{inr(p.selling_price)}</span>
                            <span>·</span>
                            <span>GST {Number(p.gst_rate)}%</span>
                            {p.hsn && (
                              <>
                                <span>·</span>
                                <span>HSN {p.hsn}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant={stock > 0 ? "outline" : "destructive"}
                          className="text-[10px] font-mono shrink-0"
                        >
                          Stock: {num(stock, 0)}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {lines.length > 0 && (
              <>
                <Separator className="my-4" />
                <div className="lg:hidden space-y-3">
                  {lines.map((l, i) => {
                    const taxable = Math.max(l.quantity * l.rate - l.discount, 0);
                    const amount = taxable + (taxable * l.gst_rate) / 100;
                    const gross = l.quantity * l.rate;
                    const discPct = gross > 0 ? (l.discount / gross) * 100 : 0;
                    return (
                      <div key={i} className="border rounded-lg p-3 space-y-2 bg-card">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">{l.product_name}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {l.hsn && `HSN ${l.hsn} · `}GST {l.gst_rate}%
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0"
                            onClick={() => rmLine(i)}
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center border rounded-lg">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Decrease quantity">
                              <Minus className="size-3" aria-hidden />
                            </Button>
                            <Input
                              type="number"
                              aria-label="Quantity" value={l.quantity}
                              onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                              className="h-8 w-14 border-0 text-center px-1 focus-visible:ring-0"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 rounded-l-none"
                              onClick={() => updateLine(i, { quantity: l.quantity + 1 })}
                              aria-label="Increase quantity"
                            >
                              <Plus className="size-3" aria-hidden />
                            </Button>
                          </div>
                          <span className="text-xs text-muted-foreground">×</span>
                          <Input
                            type="number"
                            value={l.rate}
                            onChange={(e) => updateLine(i, { rate: Number(e.target.value) })}
                            className="h-8 flex-1 text-right"
                          />
                          <div className="text-sm font-mono font-semibold w-24 text-right">
                            {inr(amount)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <Label className="text-muted-foreground">Discount ₹</Label>
                          <Input
                            type="number"
                            value={l.discount}
                            onChange={(e) => updateLine(i, { discount: Number(e.target.value) })}
                            className="h-7 max-w-24 text-right"
                          />
                          <div className="relative">
                            <Input
                              type="number"
                              value={Number(discPct.toFixed(2))}
                              onChange={(e) => {
                                const pct = Number(e.target.value);
                                updateLine(i, { discount: Math.max(0, (gross * pct) / 100) });
                              }}
                              className="h-7 w-20 text-right pr-6"
                            />
                            <Percent className="size-3 absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden lg:block border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="text-left px-3 py-2 font-semibold">Product</th>
                        <th className="text-center px-3 py-2 font-semibold w-32">Qty</th>
                        <th className="text-right px-3 py-2 font-semibold w-24">Rate</th>
                        <th className="text-right px-3 py-2 font-semibold w-24">Disc ₹</th>
                        <th className="text-right px-3 py-2 font-semibold w-16">GST%</th>
                        <th className="text-right px-3 py-2 font-semibold w-28">Amount</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {lines.map((l, i) => {
                        const taxable = Math.max(l.quantity * l.rate - l.discount, 0);
                        const amount = taxable + (taxable * l.gst_rate) / 100;
                        return (
                          <tr key={i}>
                            <td className="px-3 py-2">
                              <div className="font-medium text-sm">{l.product_name}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {l.hsn && `HSN ${l.hsn}`}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center border rounded-md mx-auto w-fit">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Decrease quantity">
                                  <Minus className="size-3" aria-hidden />
                                </Button>
                                <Input
                                  type="number"
                                  aria-label="Quantity" value={l.quantity}
                                  onChange={(e) =>
                                    updateLine(i, { quantity: Number(e.target.value) })
                                  }
                                  className="h-7 w-12 border-0 text-center px-1 focus-visible:ring-0"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 rounded-l-none"
                                  onClick={() => updateLine(i, { quantity: l.quantity + 1 })}
                                  aria-label="Increase quantity"
                                >
                                  <Plus className="size-3" aria-hidden />
                                </Button>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                value={l.rate}
                                onChange={(e) => updateLine(i, { rate: Number(e.target.value) })}
                                className="h-8 text-right"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                value={l.discount}
                                onChange={(e) =>
                                  updateLine(i, { discount: Number(e.target.value) })
                                }
                                className="h-8 text-right"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                value={l.gst_rate}
                                onChange={(e) =>
                                  updateLine(i, { gst_rate: Number(e.target.value) })
                                }
                                className="h-8 text-right"
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-semibold">
                              {inr(amount)}
                            </td>
                            <td className="px-3 py-2">
                              <Button variant="ghost" size="icon" onClick={() => rmLine(i)} aria-label="Remove line item">
                                <Trash2 className="size-3.5 text-destructive" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {lines.length === 0 && (
              <div className="mt-4 text-center py-8 border-2 border-dashed rounded-lg text-sm text-muted-foreground">
                Search above to add products to this invoice.
              </div>
            )}
          </Card>

          {/* Collect payment now */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="size-4 text-primary" />
                <h3 className="font-semibold text-sm">Collect payment now</h3>
                <span className="text-[11px] text-muted-foreground">Optional</span>
              </div>
              <Switch
                checked={collectNow}
                onCheckedChange={(v) => {
                  setCollectNow(v);
                  if (v && payAmount === 0) setPayAmount(Number(totals.total.toFixed(2)));
                }}
              />
            </div>
            {collectNow && (
              <div className="mt-3 grid sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Mode</Label>
                  <Select value={payMode} onValueChange={(v) => setPayMode(v as PayMode)}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="bank">Bank transfer</SelectItem>
                      <SelectItem value="cod">Cash on delivery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Amount</Label>
                  <Input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="h-10 text-right font-mono"
                  />
                  <div className="flex gap-1 text-[10px]">
                    <button
                      type="button"
                      className="underline text-muted-foreground hover:text-foreground"
                      onClick={() => setPayAmount(Number(totals.total.toFixed(2)))}
                    >
                      Full
                    </button>
                    <button
                      type="button"
                      className="underline text-muted-foreground hover:text-foreground ml-auto"
                      onClick={() => setPayAmount(Number((totals.total / 2).toFixed(2)))}
                    >
                      Half
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Reference (optional)</Label>
                  <Input
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    placeholder="Txn ID / cheque no."
                    className="h-10"
                  />
                </div>
              </div>
            )}
          </Card>

          {/* Notes */}
          <Card className="p-4 sm:p-5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Notes / Terms
            </Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment terms, delivery notes, etc."
              className="mt-2"
            />
          </Card>
        </div>

        {/* Summary */}
        <div className="hidden lg:block">
          <Card className="p-5 sticky top-20 space-y-3">
            <h3 className="font-semibold text-sm">Summary</h3>
            <Separator />
            <SummaryRows totals={totals} interstate={interstate} />
            {collectNow && payAmount > 0 && (
              <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Collecting now</span>
                  <span className="font-mono font-semibold">{inr(payAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Balance after</span>
                  <span className="font-mono">{inr(Math.max(totals.total - payAmount, 0))}</span>
                </div>
              </div>
            )}
            <Button className="w-full h-11" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save invoice"}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => nav({ to: "/invoices" })}>
              Cancel
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">
              Shortcut: <kbd className="px-1 border rounded bg-muted">Ctrl</kbd>+
              <kbd className="px-1 border rounded bg-muted">S</kbd> to save
            </p>
          </Card>
        </div>
      </div>

      {/* Mobile footer */}
      <div className="lg:hidden fixed bottom-16 inset-x-0 z-20 bg-background/95 backdrop-blur border-t p-3 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Grand total</div>
            <div className="text-xl font-semibold font-mono">{inr(totals.total)}</div>
          </div>
          <div className="text-right text-[11px] text-muted-foreground">
            <div>
              {lines.length} item{lines.length !== 1 && "s"}
            </div>
            <div>Tax {inr(totals.tax)}</div>
            {collectNow && payAmount > 0 && (
              <div className="text-primary">Collecting {inr(payAmount)}</div>
            )}
          </div>
        </div>
        <Button className="w-full h-11" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save invoice"}
        </Button>
      </div>
    </PageContainer>
  );
}

function SummaryRows({
  totals,
  interstate,
}: {
  totals: {
    subtotal: number;
    discount: number;
    cgst: number;
    sgst: number;
    igst: number;
    tax: number;
    total: number;
  };
  interstate: boolean;
}) {
  return (
    <div className="space-y-2 text-sm">
      <Row label="Subtotal" value={inr(totals.subtotal)} />
      {totals.discount > 0 && <Row label="Discount" value={`− ${inr(totals.discount)}`} />}
      {!interstate ? (
        <>
          <Row label="CGST" value={inr(totals.cgst)} muted />
          <Row label="SGST" value={inr(totals.sgst)} muted />
        </>
      ) : (
        <Row label="IGST" value={inr(totals.igst)} muted />
      )}
      <Separator />
      <div className="flex justify-between items-center pt-1">
        <span className="font-semibold">Grand Total</span>
        <span className="text-2xl font-semibold font-mono">{inr(totals.total)}</span>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
