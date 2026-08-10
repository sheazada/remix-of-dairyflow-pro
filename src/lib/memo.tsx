// React.memo wrappers for expensive table-row components.
// Table rows are the #1 cause of re-render storms in data-heavy pages.
// Wrapping them in React.memo prevents re-render when parent state changes
// but the row's props haven't.

import React from "react";

/**
 * Generic memoized table row.
 * Use for any <tr> in a data table where the row only depends on its own data prop.
 *
 * Usage:
 *   import { memoTableRow } from "@/lib/memo";
 *   const CustomerRow = memoTableRow(({ row, onEdit }: Props) => (
 *     <tr>...</tr>
 *   ));
 */
export function memoTableRow<P>(component: React.ComponentType<P>): React.MemoExoticComponent<React.ComponentType<P>> {
  return React.memo(component, (prevProps, nextProps) => {
    // Shallow compare props — re-render only if props changed
    const prevKeys = Object.keys(prevProps) as Array<keyof P>;
    for (const key of prevKeys) {
      if (prevProps[key] !== nextProps[key]) return false;
    }
    return true;
  });
}

/**
 * Memoized card wrapper — prevents re-render of entire cards when only
 * sibling cards change (common in dashboard grid layouts).
 */
export function memoCard<P>(component: React.ComponentType<P>): React.MemoExoticComponent<React.ComponentType<P>> {
  return React.memo(component);
}

/**
 * Memoized stat tile — prevents re-render of stat cards when only one KPI changes.
 */
export function memoStatTile<P>(component: React.ComponentType<P>): React.MemoExoticComponent<React.ComponentType<P>> {
  return React.memo(component);
}
