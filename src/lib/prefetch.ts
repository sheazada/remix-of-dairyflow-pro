// Prefetch utilities — load data for likely-next pages before the user navigates.
//
// Strategy:
//   1. On hover (150ms delay) → prefetch route code + query data
//   2. On click → instant transition (data already warm)
//
// TanStack Start's router.preloadRoute() loads the JS chunk. We additionally
// warm up React Query caches so the page has data on mount.
//
// Usage:
//   import { usePrefetch, prefetchCustomers } from "@/lib/prefetch";
//   const handlers = usePrefetch();
//   <Link to="/invoices" {...handlers.hover("/invoices", () => prefetchInvoices(qc))}>

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Prefetch a route's JS chunk so navigation is instant. */
export function useRoutePrefetch() {
  const router = useRouter();

  const prefetch = useCallback(
    (to: string, delayMs = 150) => {
      const timer = setTimeout(() => {
        try {
          router.preloadRoute({ to } as any).catch(() => {
            // Route doesn't exist or failed to load — ignore
          });
        } catch {
          // Preload not supported — ignore
        }
      }, delayMs);
      return () => clearTimeout(timer);
    },
    [router],
  );

  return prefetch;
}

/** Hook that returns onMouseEnter/onMouseLeave for prefetching. */
export function usePrefetch(to: string, onPrefetch?: () => void) {
  const routePrefetch = useRoutePrefetch();
  const cancelRef = useRef<(() => void) | null>(null);

  const onMouseEnter = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = routePrefetch(to, 150);
    onPrefetch?.();
  }, [to, routePrefetch, onPrefetch]);

  const onMouseLeave = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
  }, []);

  return { onMouseEnter, onMouseLeave };
}

/** Prefetch the invoices list — triggered when hovering "Invoices" in sidebar. */
export function prefetchInvoices(queryClient: ReturnType<typeof useQueryClient>): void {
  queryClient.prefetchQuery({
    queryKey: ["invoices", "all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_no, invoice_date, customer_id, total, paid, balance, status, customer:customers(name, shop_name)")
        .order("invoice_date", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    staleTime: 30_000, // 30s — short, invoice list changes often
  });
}

/** Prefetch the customers list — triggered when hovering "Customers" in sidebar. */
export function prefetchCustomers(queryClient: ReturnType<typeof useQueryClient>): void {
  queryClient.prefetchQuery({
    queryKey: ["customers", "all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, name, shop_name, mobile, outstanding, status")
        .order("name")
        .limit(100);
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

/** Prefetch the dashboard data — small, fast to load. */
export function prefetchDashboard(queryClient: ReturnType<typeof useQueryClient>): void {
  queryClient.prefetchQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: async () => {
      const [{ data: invoices }, { data: products }] = await Promise.all([
        supabase
          .from("invoices")
          .select("id, total, status, invoice_date")
          .gte("invoice_date", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
          .limit(100),
        supabase.from("products").select("id, current_stock, min_stock").eq("status", "active"),
      ]);
      return { invoices: invoices ?? [], products: products ?? [] };
    },
    staleTime: 15_000, // Dashboard data changes frequently
  });
}
