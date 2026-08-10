/**
 * Type-safe wrapper around the generated Supabase client.
 *
 * Goals:
 *  - Table names constrained to real `public.*` tables from the generated types.
 *  - Filter/order column names constrained to columns of the chosen table's Row.
 *  - Insert/Update payloads constrained to the generated Insert/Update shapes.
 *
 * Effect: typos like `.from("crate_typs")`, `.eq("is_actve", true)` or
 * `.insert({ is_active: 1 })` fail at compile time rather than at runtime.
 *
 * The wrapper intentionally exposes a small surface. Complex embedded selects
 * (foreign-table joins) still go through `raw()` which returns the underlying
 * builder — the table name is still typed, only the select-string parsing is
 * skipped so consumers must call `.returns<T>()` to pin the row shape.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { PostgrestError, PostgrestSingleResponse } from "@supabase/supabase-js";

type PublicSchema = Database["public"];
type PublicTables = PublicSchema["Tables"];

export type TableName = keyof PublicTables & string;
export type Row<T extends TableName> = PublicTables[T]["Row"];
export type Insert<T extends TableName> = PublicTables[T]["Insert"];
export type Update<T extends TableName> = PublicTables[T]["Update"];
export type Column<T extends TableName> = keyof Row<T> & string;

type Result<R> = { data: R; error: null } | { data: null; error: PostgrestError };

/**
 * Chainable SELECT builder — column names in .eq/.in/.ilike/.order are checked
 * against Row<T> at compile time. Terminates with `await` or `.maybeSingle()`.
 */
class TypedSelect<T extends TableName, R> implements PromiseLike<Result<R[]>> {
  constructor(private builder: any) {}

  eq<K extends Column<T>>(column: K, value: Row<T>[K]): TypedSelect<T, R> {
    return new TypedSelect<T, R>(this.builder.eq(column as string, value));
  }
  in<K extends Column<T>>(column: K, values: ReadonlyArray<Row<T>[K]>): TypedSelect<T, R> {
    return new TypedSelect<T, R>(this.builder.in(column as string, values as unknown[]));
  }
  ilike<K extends Column<T>>(column: K, pattern: string): TypedSelect<T, R> {
    return new TypedSelect<T, R>(this.builder.ilike(column as string, pattern));
  }
  gte<K extends Column<T>>(column: K, value: Row<T>[K]): TypedSelect<T, R> {
    return new TypedSelect<T, R>(this.builder.gte(column as string, value));
  }
  lte<K extends Column<T>>(column: K, value: Row<T>[K]): TypedSelect<T, R> {
    return new TypedSelect<T, R>(this.builder.lte(column as string, value));
  }
  order<K extends Column<T>>(column: K, opts?: { ascending?: boolean }): TypedSelect<T, R> {
    return new TypedSelect<T, R>(this.builder.order(column as string, opts));
  }
  limit(n: number): TypedSelect<T, R> {
    return new TypedSelect<T, R>(this.builder.limit(n));
  }

  maybeSingle(): Promise<Result<R | null>> {
    return this.builder.maybeSingle() as Promise<Result<R | null>>;
  }
  single(): Promise<Result<R>> {
    return this.builder.single() as Promise<Result<R>>;
  }

  then<TResult1 = Result<R[]>, TResult2 = never>(
    onfulfilled?: ((value: Result<R[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return (this.builder as PromiseLike<Result<R[]>>).then(onfulfilled, onrejected);
  }
}

/**
 * Chainable mutation builder — same column-name safety on .eq filters.
 */
class TypedMutation<T extends TableName> implements PromiseLike<PostgrestSingleResponse<null>> {
  constructor(private builder: any) {}

  eq<K extends Column<T>>(column: K, value: Row<T>[K]): TypedMutation<T> {
    return new TypedMutation<T>(this.builder.eq(column as string, value));
  }
  in<K extends Column<T>>(column: K, values: ReadonlyArray<Row<T>[K]>): TypedMutation<T> {
    return new TypedMutation<T>(this.builder.in(column as string, values as unknown[]));
  }

  then<TResult1 = PostgrestSingleResponse<null>, TResult2 = never>(
    onfulfilled?: ((value: PostgrestSingleResponse<null>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return (this.builder as PromiseLike<PostgrestSingleResponse<null>>).then(onfulfilled, onrejected);
  }
}

class TypedTable<T extends TableName> {
  constructor(private readonly table: T) {}

  /** SELECT * — returns rows typed as Row<T>. */
  selectAll(): TypedSelect<T, Row<T>> {
    return new TypedSelect<T, Row<T>>(supabase.from(this.table).select("*"));
  }

  /**
   * Escape hatch for embedded joins / column projections. Table name stays
   * typed; caller pins the resulting row shape with `<R>`.
   *
   *   typed("orders").raw<{ id: string; customers: { name: string } | null }>(
   *     "id, customers(name)",
   *   ).eq("id", orderId)
   */
  raw<R>(selectString: string): TypedSelect<T, R> {
    return new TypedSelect<T, R>(supabase.from(this.table).select(selectString));
  }

  insert(values: Insert<T> | Insert<T>[]): TypedMutation<T> {
    return new TypedMutation<T>(supabase.from(this.table).insert(values as any));
  }

  update(values: Update<T>): TypedMutation<T> {
    return new TypedMutation<T>(supabase.from(this.table).update(values as any));
  }

  delete(): TypedMutation<T> {
    return new TypedMutation<T>(supabase.from(this.table).delete());
  }
}

/**
 * Entry point. `typed("crate_types")` — only real public tables typecheck.
 */
export function typed<T extends TableName>(table: T): TypedTable<T> {
  return new TypedTable<T>(table);
}
