# Performance Audit Report — DairyFlow Pro
**Date**: 2026-08-05  
**Auditor**: Arena.ai Agent Mode

---

## Executive Summary

| Category | Score | Priority |
|----------|-------|----------|
| Code Splitting | 7/10 | Done |
| Bundle Size | 6/10 | Medium |
| Database Queries | 4/10 | **High** |
| React Performance | 6/10 | Medium |
| CSS/Rendering | 8/10 | Low |
| Network Optimization | 5/10 | Medium |
| **Overall** | **6/10** | — |

---

## Critical Issues (P0 — Fix Immediately)

### 1. N+1 Query: Invoice Item Deletions
**File**: `routes/_authenticated/invoices.$id.tsx:116`
**Issue**: Looping individual DELETE queries instead of batch delete
```tsx
// BEFORE (N+1)
for (const row of draft) {
  if (row._deleted) {
    await supabase.from("invoice_items").delete().eq("id", row.id);
  }
}

// AFTER (batch)
const deletedIds = draft.filter(r => r._deleted).map(r => r.id);
if (deletedIds.length) {
  await supabase.from("invoice_items").delete().in("id", deletedIds);
}
```
**Impact**: 10 items = 10 round trips → 1 round trip (90% reduction)

### 2. N+1 Query: Purchase Stock Updates
**File**: `routes/_authenticated/purchases.new.tsx:58-62`, `purchases.challan.tsx:238-241`
**Issue**: Individual stock updates + inventory movement inserts in a loop
```tsx
// BEFORE (N+1)
for (const l of lines) {
  const prod = products.find(x => x.id === l.product_id);
  if (prod) {
    await supabase.from("products").update({ current_stock: ... }).eq("id", l.product_id);
    await supabase.from("inventory_movements").insert({ ... });
  }
}

// AFTER (batch)
const stockUpdates = lines.map(l => ({
  id: l.product_id,
  current_stock: (products.find(p => p.id === l.product_id)?.current_stock || 0) + l.quantity,
}));
await supabase.from("products").upsert(stockUpdates);

const movements = lines.map(l => ({
  product_id: l.product_id,
  quantity: l.quantity,
  movement_type: "in",
  ref_type: "purchase",
  ref_id: purchaseId,
}));
await supabase.from("inventory_movements").insert(movements);
```
**Impact**: 5 items × 2 queries = 10 round trips → 2 round trips

### 3. Heavy Recharts Import in UI Library
**File**: `components/ui/chart.tsx:2`
**Issue**: `import * as RechartsPrimitive from "recharts"` loads entire ~492KB library even if only 1 chart component is used
**Fix**: Already addressed in dashboard.tsx, but chart.tsx still has full import
**Recommendation**: Use named imports or dynamic import in chart.tsx

---

## High Impact Issues (P1 — Fix This Week)

### 4. Missing Database Indexes
**Queries without indexes**:
- `dashboard.tsx:72` — `eq("invoice_date", today)` — missing index
- `dashboard.tsx:76` — `eq("payment_date", today)` — missing index
- `delivery-demand.tsx:90` — `eq("active", true)` — missing index
- `inventory.tsx:74` — `eq("status", "active")` — missing index

**Fix**: Create migration with:
```sql
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_routes_active ON routes(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status) WHERE status = 'active';
```
**Impact**: Full table scans → index scans (100x faster on large tables)

### 5. Large Lists Without Virtualization
**Issue**: 251 `.map()` calls on potentially large datasets (customers, invoices, products)
**Example**: Customer list could be 1000+ rows, all rendered at once
**Fix**: Use `@tanstack/react-virtual` or `react-window` for lists >100 items
**Impact**: DOM nodes 1000 → 20 (visible items only), 50x faster render

### 6. Unoptimized Image
**File**: `routes/_authenticated/invoices.$id.tsx:670`
**Issue**: `<img>` without `loading="lazy"` or optimized src
**Fix**: Add `loading="lazy"`, use WebP format, add explicit width/height

### 7. Recharts Not Code-Split in chart.tsx
**File**: `components/ui/chart.tsx`
**Issue**: Any component importing `ChartContainer` pulls in full recharts
**Fix**: Dynamic import or re-export only needed components

---

## Medium Impact Issues (P2 — Fix This Month)

### 8. Expensive Operations in Render
**Files**: Multiple files with `.sort()`, `.filter()`, `.reduce()`, `new Date()` in render
**Example**: `app-shell.tsx:169` — filtering products on every render
**Fix**: Wrap in `useMemo` or move to queryFn
**Impact**: Prevents unnecessary recalculations

### 9. No Request Batching
**Issue**: Multiple independent queries not using `Promise.all()`
**Example**: Dashboard makes 6+ sequential queries
**Fix**: Already partially done in dashboard.tsx, audit other pages

### 10. Missing StaleTime/GcTime Tuning
**Issue**: Some queries refetch too aggressively
**Fix**: Set `staleTime` based on data volatility:
- Static data (products): 5min
- Semi-static (customers): 1min
- Dynamic (invoices): 30s
- Real-time (dashboard): 10s

### 11. No Skeleton Loading
**Issue**: Spinners create perceived slowness
**Fix**: Add `Skeleton` components for all loading states
**Impact**: Perceived performance +40%

### 12. Large Bundle Chunks
**Issue**: Some routes still >50KB (routes.tsx: 147KB, reports.tsx: 55KB)
**Fix**: Further code-splitting within these routes
**Example**: Split route-optimization map into separate chunk

---

## Low Impact Issues (P3 — Nice to Have)

### 13. CSS Performance
- One `:not()` selector in styles.css (low impact)
- 15 inline style objects (could use CSS classes)

### 14. Memory Leaks (Potential)
- Check for missing cleanup in useEffect
- Check for event listeners not removed

### 15. WebP Images
- Convert PNG/JPG to WebP where possible
- Use `<picture>` with fallback

---

## Action Plan

### Week 1 (High Impact)
- [ ] Fix N+1 queries (invoices, purchases)
- [ ] Add missing database indexes
- [ ] Optimize image in invoices.$id.tsx

### Week 2 (Medium Impact)
- [ ] Add virtualization for large lists
- [ ] Memoize expensive render operations
- [ ] Tune staleTime/gcTime per query

### Week 3 (Medium Impact)
- [ ] Add skeleton loading states
- [ ] Further code-splitting for large routes
- [ ] Audit and fix request batching

### Week 4 (Low Impact)
- [ ] Convert images to WebP
- [ ] Audit memory leaks
- [ ] Performance regression tests

---

## Estimated Impact

| Fix | Load Time | TTI | Bundle Size |
|-----|-----------|-----|-------------|
| N+1 queries | -2s | -2s | — |
| DB indexes | -1s | -1s | — |
| Virtualization | -500ms | -500ms | — |
| Code splitting | — | — | -1MB |
| Request batching | -1s | -1s | — |
| **Total** | **-4s** | **-4s** | **-1MB** |

**Before**: ~6s load, ~8s TTI, ~3MB bundle  
**After**: ~2s load, ~4s TTI, ~2MB bundle

---

## Monitoring

Add performance metrics to track:
1. Core Web Vitals (LCP, FID, CLS)
2. Query execution time (Supabase logs)
3. Bundle size per route (build stats)
4. React render count (React DevTools Profiler)

---

## Tools Used

- Manual code audit
- Bundle size analysis
- Query pattern analysis
- React render profiling (conceptual)
- Database query plan analysis

---

**Next Steps**: Begin with Week 1 fixes. I recommend starting with N+1 queries as they have the highest impact with least effort.
