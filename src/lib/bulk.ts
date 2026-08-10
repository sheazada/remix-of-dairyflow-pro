// Shared bulk-operation helpers.
//
// Two things most bulk flows have in common:
//   1. A "select all / select page / deselect" state that needs to be
//      consistent across the UI and the actual mutation.
//   2. Progress reporting (toast + optional progress bar) while a batch
//      runs, since each Supabase call may take ~200-500ms.
//
// These helpers centralize that so each page only wires the UI + the
// mutation itself.

import { toast } from "sonner";

export type BulkProgress = {
  total: number;
  done: number;
  failed: number;
  current: string | null;
};

export type BulkCallbacks = {
  onProgress?: (progress: BulkProgress) => void;
  onSuccess?: (count: number) => void;
  onFailure?: (count: number) => void;
};

/**
 * Run an async action for every item in a list, reporting progress
 * along the way and collecting failures instead of throwing on the first
 * error. Returns { ok, failed }.
 *
 * Used for "process N items" flows where partial success is acceptable
 * (e.g. bulk-create invoices — you want to know which orders succeeded).
 */
export async function runBulk<T>(
  items: T[],
  action: (item: T) => Promise<void>,
  label: string,
  cbs: BulkCallbacks = {},
): Promise<{ ok: T[]; failed: { item: T; error: string }[] }> {
  const total = items.length;
  const ok: T[] = [];
  const failed: { item: T; error: string }[] = [];

  for (let i = 0; i < total; i++) {
    const item = items[i];
    try {
      await action(item);
      ok.push(item);
    } catch (e: any) {
      failed.push({ item, error: e?.message ?? "Unknown error" });
    }
    cbs.onProgress?.({
      total,
      done: ok.length + failed.length,
      failed: failed.length,
      current: label,
    });
  }

  if (ok.length > 0) {
    toast.success(`${ok.length} ${label} succeeded`);
    cbs.onSuccess?.(ok.length);
  }
  if (failed.length > 0) {
    toast.error(`${failed.length} ${label} failed`);
    cbs.onFailure?.(failed.length);
  }
  return { ok, failed };
}

/**
 * Parse a CSV string into an array of objects.
 * Simple implementation — handles quoted fields with commas and newlines.
 * No external dep needed.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    if (cells.length === 1 && cells[0].trim() === "") continue;
    const row: Record<string, string> = {};
    headers.forEach((h, j) => {
      row[h] = cells[j] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

/**
 * Build a CSV string from an array of objects. All values are stringified.
 */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const headerLine = headers.join(",");
  const body = rows.map((r) => headers.map((h) => escape(r[h])).join(",")).join("\n");
  return `${headerLine}\n${body}`;
}

/**
 * Download a CSV string as a file in the browser.
 */
export function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Read a file from a <input type="file"> as text.
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
