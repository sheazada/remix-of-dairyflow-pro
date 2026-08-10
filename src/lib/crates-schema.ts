import { z } from "zod";

export const crateTypeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  is_active: z.boolean(),
});
export type CrateType = z.infer<typeof crateTypeSchema>;

export const crateTransactionTypeSchema = z.enum([
  "issue",
  "return",
  "damaged",
  "lost",
  "issue_correction",
  "return_correction",
]);

export const crateTransactionSchema = z.object({
  id: z.string().uuid(),
  crate_type_id: z.string().uuid(),
  retailer_id: z.string().uuid().nullable(),
  delivery_id: z.string().uuid().nullable(),
  route_id: z.string().uuid().nullable(),
  transaction_type: crateTransactionTypeSchema,
  quantity: z.number().int().nonnegative(),
  transaction_date: z.string().min(1),
  notes: z.string().nullable(),
  created_at: z.string(),
  crate_type: z
    .object({ id: z.string().uuid(), name: z.string() })
    .nullable()
    .optional(),
  retailer: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      shop_name: z.string().nullable(),
    })
    .nullable()
    .optional(),
});
export type CrateTransaction = z.infer<typeof crateTransactionSchema>;

export const crateBalanceSchema = z.object({
  retailer_id: z.string().uuid(),
  retailer_name: z.string(),
  shop_name: z.string().nullable(),
  crate_type_id: z.string().uuid().optional(),
  crate_type_name: z.string(),
  balance: z.coerce.number(),
});
export type CrateBalance = z.infer<typeof crateBalanceSchema>;

/**
 * Parse an array of raw rows through a Zod schema, dropping malformed rows
 * and logging a warning so the UI never renders undefined/mismatched shapes.
 */
export function safeParseList<T>(
  schema: z.ZodType<T>,
  rows: unknown,
  label: string,
): T[] {
  if (!Array.isArray(rows)) {
    if (rows != null) console.warn(`[${label}] expected array, got`, typeof rows);
    return [];
  }
  const out: T[] = [];
  for (const row of rows) {
    const parsed = schema.safeParse(row);
    if (parsed.success) {
      out.push(parsed.data);
    } else {
      console.warn(`[${label}] dropped invalid row`, parsed.error.issues, row);
    }
  }
  return out;
}
