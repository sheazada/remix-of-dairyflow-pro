// Supabase Realtime subscriptions.
//
// Purpose: when another user (driver, admin, etc.) mutates a table, every
// other open browser tab sees the change within ~1 second — no manual refresh.
//
// How it works:
//   1. A React hook subscribes to `postgres_changes` events on a table.
//   2. On INSERT / UPDATE / DELETE, the hook calls
//      `queryClient.invalidateQueries()` for the keys we care about.
//   3. React Query refetches → UI updates automatically.
//   4. Cleanup: subscription is removed when the component unmounts.
//
// Pre-requisites in Supabase:
//   - Realtime must be enabled for the tables you want to listen to:
//     Database → Replication → toggle tables ON for Realtime.
//   - Row Level Security still applies; subscriptions respect the user's
//     policies.

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

type Subscription = {
  channel: RealtimeChannel;
  tableName: string;
  events: RealtimeEvent[];
  invalidateKeys: string[][];
};

const ACTIVE_SUBSCRIPTIONS = new Map<string, Subscription>();

/**
 * Subscribe to postgres_changes on a table and invalidate React Query keys
 * when a change is detected.
 *
 * De-duplicates subscriptions: if another component already listens to the
 * same (table, events, keys) tuple, we reuse that channel instead of opening
 * a second one.
 */
export function useRealtimeSync(options: {
  /** Table to listen to, e.g. "orders", "deliveries". */
  tableName: string;
  /** Events to listen for. Default: all three. */
  events?: RealtimeEvent[];
  /** Query keys to invalidate when a change fires. */
  invalidateKeys: string[][];
  /** Filter by a column value (e.g. { customer_id: userId }). Optional. */
  filter?: Record<string, string | number | boolean>;
  /** Skip the subscription entirely (e.g. when user isn't logged in). */
  enabled?: boolean;
  /** Debounce refetches in ms. Default 200. */
  debounceMs?: number;
}) {
  const {
    tableName,
    events = ["INSERT", "UPDATE", "DELETE"],
    invalidateKeys,
    filter,
    enabled = true,
    debounceMs = 200,
  } = options;

  const qc = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // De-dupe key.
    const key = [
      tableName,
      events.sort().join(","),
      invalidateKeys.map((k) => k.join("|")).sort().join(";"),
    ].join("::");

    if (ACTIVE_SUBSCRIPTIONS.has(key)) {
      // Channel already exists — just extend its invalidate set.
      const existing = ACTIVE_SUBSCRIPTIONS.get(key)!;
      const existingKeys = existing.invalidateKeys
        .map((k) => k.join("|"))
        .join(";");
      const newKeys = invalidateKeys.map((k) => k.join("|")).join(";");
      if (existingKeys !== newKeys) {
        existing.invalidateKeys = invalidateKeys;
      }
      return () => {
        // No-op: shared channel stays alive until the last subscriber leaves.
      };
    }

    let channel = supabase
      .channel(`rt-${tableName}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: tableName,
          ...(filter ? { filter: buildFilterString(filter) } : {}),
        },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
          }, debounceMs);
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(`[realtime] ${tableName} channel ${status}`);
        }
      });

    const sub: Subscription = {
      channel,
      tableName,
      events,
      invalidateKeys,
    };
    ACTIVE_SUBSCRIPTIONS.set(key, sub);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      // Remove the shared channel only when this is the last subscriber.
      ACTIVE_SUBSCRIPTIONS.delete(key);
      channel.unsubscribe();
      cleanupRef.current = null;
    };
  }, [
    tableName,
    events.join(","),
    JSON.stringify(invalidateKeys),
    JSON.stringify(filter),
    enabled,
    debounceMs,
    qc,
  ]);
}

/**
 * Build a Supabase filter string, e.g. "status=eq.delivered".
 * Only supports equality for now — sufficient for per-user subscriptions.
 */
function buildFilterString(filter: Record<string, string | number | boolean>): string {
  const parts = Object.entries(filter).map(([col, val]) => {
    const v = typeof val === "boolean" ? (val ? "true" : "false") : String(val);
    return `${col}=eq.${v}`;
  });
  return parts.join(",");
}

/**
 * Higher-level hook: subscribe to several tables at once. Useful for the
 * dashboard, which needs to watch orders + deliveries + payments together.
 */
export function useRealtimeDashboard() {
  useRealtimeSync({
    tableName: "orders",
    invalidateKeys: [["dashboard-stats"]],
  });
  useRealtimeSync({
    tableName: "invoices",
    invalidateKeys: [["dashboard-stats"]],
  });
  useRealtimeSync({
    tableName: "payments",
    invalidateKeys: [["dashboard-stats"]],
  });
  useRealtimeSync({
    tableName: "deliveries",
    invalidateKeys: [["dashboard-stats"]],
  });
}

/** Debug helper: inspect active subscriptions from the console. */
export function getActiveRealtimeSubscriptions(): Subscription[] {
  return Array.from(ACTIVE_SUBSCRIPTIONS.values());
}
