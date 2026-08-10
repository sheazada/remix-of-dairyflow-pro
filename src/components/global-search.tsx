// Global search command palette.
//
// Opens with Ctrl+K (or K on Mac). Searches across:
//   • Customers
//   • Orders
//   • Invoices
//   • Products
//   • Payments
//
// Results are grouped by entity, limited to 5 per group, and each result
// navigates to the appropriate detail page on selection.
//
// Keyboard:
//   Ctrl+K / ⌘K   open
//   Esc            close
//   ↑ / ↓          navigate results
//   Enter          open selected result
//   Backspace      clear query

import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { inr, shortDate } from "@/lib/format";
import {
  Users,
  ShoppingCart,
  ReceiptText,
  Package,
  Wallet,
  Search,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SearchState = "idle" | "open" | "closed";

/** Raw row shapes returned by the Supabase queries below. */
type CustomerRow = {
  id: string;
  name: string;
  shop_name: string | null;
  mobile: string | null;
  outstanding: number;
  status: string;
};
type CustomerRef = { name: string; shop_name: string | null } | null;
type OrderRow = {
  id: string;
  order_no: string;
  order_date: string;
  total: number;
  status: string;
  customer: CustomerRef;
};
type InvoiceRow = {
  id: string;
  invoice_no: string;
  invoice_date: string;
  total: number;
  balance: number;
  status: string;
  customer: CustomerRef;
};
type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  brand: string | null;
  current_stock: number;
  min_stock: number;
  selling_price: number;
  status: string;
};
type PaymentRow = {
  id: string;
  payment_no: string;
  payment_date: string;
  amount: number;
  mode: string;
  customer: CustomerRef;
};



type CustomerResult = {
  type: "customer";
  id: string;
  name: string;
  subtitle: string;
  meta: string;
  outstanding: number;
  status: string;
};

type OrderResult = {
  type: "order";
  id: string;
  name: string;
  subtitle: string;
  meta: string;
  total: number;
  status: string;
  order_date: string;
};

type InvoiceResult = {
  type: "invoice";
  id: string;
  name: string;
  subtitle: string;
  meta: string;
  total: number;
  balance: number;
  status: string;
  invoice_date: string;
};

type ProductResult = {
  type: "product";
  id: string;
  name: string;
  subtitle: string;
  meta: string;
  current_stock: number;
  min_stock: number;
  selling_price: number;
};

type PaymentResult = {
  type: "payment";
  id: string;
  name: string;
  subtitle: string;
  meta: string;
  amount: number;
  payment_date: string;
  mode: string;
};

type AnyResult =
  | CustomerResult
  | OrderResult
  | InvoiceResult
  | ProductResult
  | PaymentResult;

type GlobalSearchProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const navigate = useNavigate();

  // Search state
  const [query, setQuery] = useState("");

  // Debounce search queries to avoid hammering Supabase on every keystroke.
  const debouncedQuery = useDebouncedValue(query, 200);

  // ---- Fetch entities in parallel ---------------------------------------
  const { data: customers = [] } = useQuery({
    queryKey: ["global-search-customers", debouncedQuery],
    enabled: debouncedQuery.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, name, shop_name, mobile, outstanding, status")
        .ilike("name", `%${debouncedQuery}%`)
        .limit(5);
      return (data ?? []) as CustomerRow[];
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["global-search-orders", debouncedQuery],
    enabled: debouncedQuery.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_no, order_date, total, status, customer:customers(name, shop_name)")
        .ilike("order_no", `%${debouncedQuery}%`)
        .limit(5);
      return (data ?? []) as OrderRow[];
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["global-search-invoices", debouncedQuery],
    enabled: debouncedQuery.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_no, invoice_date, total, balance, status, customer:customers(name, shop_name)")
        .ilike("invoice_no", `%${debouncedQuery}%`)
        .limit(5);
      return (data ?? []) as InvoiceRow[];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["global-search-products", debouncedQuery],
    enabled: debouncedQuery.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, category, brand, current_stock, min_stock, selling_price, status")
        .ilike("name", `%${debouncedQuery}%`)
        .limit(5);
      return (data ?? []) as ProductRow[];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["global-search-payments", debouncedQuery],
    enabled: debouncedQuery.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("id, payment_no, payment_date, amount, mode, customer:customers(name, shop_name)")
        .ilike("payment_no", `%${debouncedQuery}%`)
        .limit(5);
      return (data ?? []) as PaymentRow[];
    },
  });

  // ---- Normalize results ------------------------------------------------
  const normalized = useMemo<AnyResult[]>(() => {
    const results: AnyResult[] = [];

    for (const c of customers) {
      results.push({
        type: "customer",
        id: c.id,
        name: c.name,
        subtitle: c.shop_name ?? "",
        meta: c.mobile ?? "",
        outstanding: Number(c.outstanding),
        status: c.status,
      });
    }
    for (const o of orders) {
      results.push({
        type: "order",
        id: o.id,
        name: o.order_no,
        subtitle: o.customer?.shop_name ?? o.customer?.name ?? "",
        meta: `${shortDate(o.order_date)} · ${inr(o.total)}`,
        total: Number(o.total),
        status: o.status,
        order_date: o.order_date,
      });
    }
    for (const inv of invoices) {
      results.push({
        type: "invoice",
        id: inv.id,
        name: inv.invoice_no,
        subtitle: inv.customer?.shop_name ?? inv.customer?.name ?? "",
        meta: `${shortDate(inv.invoice_date)} · ${inr(inv.total)}`,
        total: Number(inv.total),
        balance: Number(inv.balance),
        status: inv.status,
        invoice_date: inv.invoice_date,
      });
    }
    for (const p of products) {
      const low = Number(p.current_stock) <= Number(p.min_stock);
      results.push({
        type: "product",
        id: p.id,
        name: p.name,
        subtitle: [p.brand, p.category].filter(Boolean).join(" · "),
        meta: `${inr(p.selling_price)} · ${p.current_stock} in stock`,
        current_stock: Number(p.current_stock),
        min_stock: Number(p.min_stock),
        selling_price: Number(p.selling_price),
      });
    }
    for (const pay of payments) {
      results.push({
        type: "payment",
        id: pay.id,
        name: pay.payment_no,
        subtitle: pay.customer?.shop_name ?? pay.customer?.name ?? "",
        meta: `${shortDate(pay.payment_date)} · ${pay.mode.toUpperCase()} · ${inr(pay.amount)}`,
        amount: Number(pay.amount),
        payment_date: pay.payment_date,
        mode: pay.mode,
      });
    }

    return results;
  }, [customers, orders, invoices, products, payments]);

  // ---- Selection handling -----------------------------------------------
  const onSelect = useCallback(
    (result: AnyResult) => {
      onOpenChange(false);
      setQuery("");

      switch (result.type) {
        case "customer":
          navigate({ to: "/customers", search: { q: result.name } as any }).catch(() => {});
          break;
        case "order":
          navigate({ to: "/orders", search: { q: result.name } as any }).catch(() => {});
          break;
        case "invoice":
          navigate({ to: "/invoices/$id", params: { id: result.id } }).catch(() => {});
          break;
        case "product":
          navigate({ to: "/products", search: { q: result.name } as any }).catch(() => {});
          break;
        case "payment":
          navigate({ to: "/payments", search: { q: result.name } as any }).catch(() => {});
          break;
      }
    },
    [navigate, onOpenChange],
  );

  // ---- Render -----------------------------------------------------------
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Search customers, orders, invoices, products, payments…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {query.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Type to search across all records
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No results for "{query}"
              </div>
            )}
          </CommandEmpty>

          {/* Customers */}
          <ResultGroup
            label="Customers"
            icon={Users}
            items={normalized.filter((r) => r.type === "customer")}
            renderItem={(c) => <CustomerResultItem result={c} />}
            onSelect={onSelect}
          />

          {/* Orders */}
          <ResultGroup
            label="Orders"
            icon={ShoppingCart}
            items={normalized.filter((r) => r.type === "order")}
            renderItem={(o) => <OrderResultItem result={o} />}
            onSelect={onSelect}
          />

          {/* Invoices */}
          <ResultGroup
            label="Invoices"
            icon={ReceiptText}
            items={normalized.filter((r) => r.type === "invoice")}
            renderItem={(inv) => <InvoiceResultItem result={inv} />}
            onSelect={onSelect}
          />

          {/* Products */}
          <ResultGroup
            label="Products"
            icon={Package}
            items={normalized.filter((r) => r.type === "product")}
            renderItem={(p) => <ProductResultItem result={p} />}
            onSelect={onSelect}
          />

          {/* Payments */}
          <ResultGroup
            label="Payments"
            icon={Wallet}
            items={normalized.filter((r) => r.type === "payment")}
            renderItem={(pay) => <PaymentResultItem result={pay} />}
            onSelect={onSelect}
          />
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

// ---- Result group wrapper ----------------------------------------------
function ResultGroup<T extends { id: string }>({
  label,
  icon: Icon,
  items,
  renderItem,
  onSelect,
}: {
  label: string;
  icon: any;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  onSelect: (item: T) => void;
}) {
  if (items.length === 0) return null;
  return (
    <CommandGroup heading={label}>
      {items.map((item) => (
        <CommandItem
          key={item.id}
          value={`${label}-${item.id}`}
          onSelect={() => onSelect(item)}
          className="gap-2"
        >
          {renderItem(item)}
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

// ---- Per-entity result renderers ---------------------------------------
function CustomerResultItem({ result }: { result: CustomerResult }) {
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <Users className="size-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{result.name}</div>
        <div className="text-xs text-muted-foreground truncate">
          {result.subtitle}
          {result.meta && <span className="ml-2">· {result.meta}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {Number(result.outstanding) > 0 ? (
          <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
            <TrendingUp className="size-3 mr-1" />
            {inr(result.outstanding)}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] text-success border-success/30">
            <CheckCircle2 className="size-3 mr-1" />
            Paid
          </Badge>
        )}
      </div>
    </div>
  );
}

function OrderResultItem({ result }: { result: OrderResult }) {
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <ShoppingCart className="size-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate font-mono">{result.name}</div>
        <div className="text-xs text-muted-foreground truncate">
          {result.subtitle} · {result.meta}
        </div>
      </div>
      <OrderStatusBadge status={result.status} />
    </div>
  );
}

function InvoiceResultItem({ result }: { result: InvoiceResult }) {
  const overdue = result.balance > 0 && result.status === "pending";
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <ReceiptText className="size-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate font-mono">{result.name}</div>
        <div className="text-xs text-muted-foreground truncate">
          {result.subtitle} · {result.meta}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {overdue && (
          <AlertTriangle className="size-3 text-destructive" />
        )}
        <Badge
          variant="outline"
          className={cn(
            "text-[10px]",
            result.balance <= 0
              ? "text-success border-success/30"
              : overdue
                ? "text-destructive border-destructive/30"
                : "text-warning border-warning/30",
          )}
        >
          {result.balance <= 0 ? "Paid" : inr(result.balance)}
        </Badge>
      </div>
    </div>
  );
}

function ProductResultItem({ result }: { result: ProductResult }) {
  const low = result.current_stock <= result.min_stock;
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <Package className="size-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{result.name}</div>
        <div className="text-xs text-muted-foreground truncate">{result.subtitle}</div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {low ? (
          <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
            <AlertTriangle className="size-3 mr-1" />
            {result.current_stock} in stock
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">
            {result.current_stock} in stock
          </Badge>
        )}
      </div>
    </div>
  );
}

function PaymentResultItem({ result }: { result: PaymentResult }) {
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <Wallet className="size-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate font-mono">{result.name}</div>
        <div className="text-xs text-muted-foreground truncate">
          {result.subtitle} · {result.meta}
        </div>
      </div>
      <Badge variant="outline" className="text-[10px] text-success border-success/30">
        {inr(result.amount)}
      </Badge>
    </div>
  );
}

// ---- Order status badge -------------------------------------------------
function OrderStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "text-warning border-warning/30",
    approved: "text-primary border-primary/30",
    invoiced: "text-success border-success/30",
    delivered: "text-muted-foreground border-border",
  };
  const icons: Record<string, any> = {
    pending: Clock,
    approved: CheckCircle2,
    invoiced: ReceiptText,
    delivered: CheckCircle2,
  };
  const Icon = icons[status] ?? Clock;
  return (
    <Badge variant="outline" className={cn("text-[10px] capitalize", styles[status] ?? "")}>
      <Icon className="size-3 mr-1" />
      {status}
    </Badge>
  );
}

// ---- Debounced value hook -----------------------------------------------
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

// ---- Hook to trigger global search --------------------------------------
export function useGlobalSearchTrigger() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Don't steal focus from form fields.
      const inField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key === "k" && !inField) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const trigger = useCallback(() => setOpen(true), []);

  return { open, setOpen, trigger };
}
