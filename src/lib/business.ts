// Business profile persisted to localStorage. Used by invoice header, QR, terms, bank block.
// Replace later with a `company_settings` DB table if the user wants multi-device sync.

import { z } from "zod";

export type BusinessProfile = {
  name: string;
  legal_name?: string;
  gstin: string;
  fssai?: string;
  pan?: string;
  state?: string;
  state_code?: string; // 2-digit GST state code
  mobile: string;
  email: string;
  address: string;
  // Payment
  upi_vpa?: string; // e.g. dairyflow@okhdfcbank
  bank_name?: string;
  bank_account?: string;
  bank_ifsc?: string;
  bank_branch?: string;
  bank_holder?: string;
  // Invoice
  terms?: string;
  invoice_prefix?: string;
};

// ---- Format regexes ---------------------------------------------------------
// GSTIN: 2-digit state + 10-char PAN + entity digit + 'Z' + checksum
export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const FSSAI_RE = /^[0-9]{14}$/;
// NPCI: alphanum/./_/- handle, @ handle, alpha bank handle
export const UPI_VPA_RE = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/;
export const BANK_ACCOUNT_RE = /^[0-9]{9,18}$/;
export const STATE_CODE_RE = /^[0-9]{2}$/;
export const MOBILE_RE = /^\+?[0-9 ()-]{7,20}$/;

// Optional-friendly wrapper: treat "" / undefined as "not set" and skip regex.
const optionalPattern = (re: RegExp, msg: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => v === "" || re.test(v), { message: msg })
    .optional();

export const businessSchema = z
  .object({
    name: z.string().trim().min(1, "Trade name is required").max(120),
    legal_name: z.string().trim().max(160).optional().or(z.literal("")),
    gstin: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .refine((v) => v === "" || GSTIN_RE.test(v), {
        message: "GSTIN must be 15 chars: 2-digit state + PAN + entity + Z + checksum",
      }),
    pan: optionalPattern(PAN_RE, "PAN must be 10 chars: AAAAA1234A"),
    fssai: z
      .string()
      .trim()
      .refine((v) => v === "" || FSSAI_RE.test(v), { message: "FSSAI must be 14 digits" })
      .optional(),
    state: z.string().trim().max(60).optional().or(z.literal("")),
    state_code: z
      .string()
      .trim()
      .refine((v) => v === "" || STATE_CODE_RE.test(v), { message: "State code must be 2 digits" })
      .optional(),
    invoice_prefix: z
      .string()
      .trim()
      .max(8)
      .regex(/^[A-Z0-9\-\/]*$/i, "Only letters, digits, - or /")
      .optional()
      .or(z.literal("")),
    mobile: z
      .string()
      .trim()
      .refine((v) => v === "" || MOBILE_RE.test(v), { message: "Enter a valid phone number" }),
    email: z
      .string()
      .trim()
      .refine((v) => v === "" || z.string().email().safeParse(v).success, {
        message: "Enter a valid email",
      }),
    address: z.string().trim().max(400),
    // Payment
    upi_vpa: z
      .string()
      .trim()
      .refine((v) => v === "" || UPI_VPA_RE.test(v), {
        message: "UPI VPA must look like name@bank (e.g. dairyflow@okhdfcbank)",
      })
      .optional(),
    bank_name: z.string().trim().max(80).optional().or(z.literal("")),
    bank_holder: z.string().trim().max(120).optional().or(z.literal("")),
    bank_account: z
      .string()
      .trim()
      .refine((v) => v === "" || BANK_ACCOUNT_RE.test(v), {
        message: "Account number must be 9–18 digits",
      })
      .optional(),
    bank_ifsc: optionalPattern(IFSC_RE, "IFSC must be 11 chars: 4 letters + 0 + 6 alphanum"),
    bank_branch: z.string().trim().max(120).optional().or(z.literal("")),
    terms: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .superRefine((val, ctx) => {
    // Cross-field: first 2 chars of GSTIN must match state_code when both set.
    if (val.gstin && val.state_code && val.gstin.slice(0, 2) !== val.state_code) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["state_code"],
        message: `State code must match GSTIN prefix (${val.gstin.slice(0, 2)})`,
      });
    }
    // First 5 chars of GSTIN's PAN block must match PAN when both set.
    if (val.gstin && val.pan && val.gstin.slice(2, 12) !== val.pan) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pan"],
        message: "PAN must match the PAN embedded inside GSTIN",
      });
    }
  });

export type BusinessValidationErrors = Partial<Record<keyof BusinessProfile, string>>;

export function validateBusiness(b: BusinessProfile): {
  ok: boolean;
  errors: BusinessValidationErrors;
} {
  const res = businessSchema.safeParse(b);
  if (res.success) return { ok: true, errors: {} };
  const errors: BusinessValidationErrors = {};
  for (const issue of res.error.issues) {
    const key = issue.path[0] as keyof BusinessProfile | undefined;
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}

// Mask helpers for display — keep last N visible, dot the rest. Preserves length.
export function maskTail(value: string | undefined | null, visible = 4): string {
  if (!value) return "";
  const s = String(value);
  if (s.length <= visible) return s;
  return "•".repeat(s.length - visible) + s.slice(-visible);
}
export function maskMiddle(value: string | undefined | null, head = 2, tail = 4): string {
  if (!value) return "";
  const s = String(value);
  if (s.length <= head + tail) return s;
  return s.slice(0, head) + "•".repeat(s.length - head - tail) + s.slice(-tail);
}
export function maskVpa(value: string | undefined | null): string {
  if (!value) return "";
  const [h, d] = String(value).split("@");
  if (!d) return maskTail(value, 2);
  return maskTail(h, 2) + "@" + d;
}


const KEY = "dairyflow.business";

export const DEFAULT_BUSINESS: BusinessProfile = {
  name: "DairyFlow Distributors",
  legal_name: "DairyFlow Distributors Pvt Ltd",
  gstin: "07AAAAA0000A1Z5",
  fssai: "10012345000123",
  pan: "AAAAA0000A",
  state: "Delhi",
  state_code: "07",
  mobile: "+91 98100 00000",
  email: "hello@dairyflow.example",
  address: "Shop 12, Wholesale Dairy Market, New Delhi 110001",
  upi_vpa: "",
  bank_name: "HDFC Bank",
  bank_account: "501000000000",
  bank_ifsc: "HDFC0000000",

  bank_branch: "New Delhi",
  bank_holder: "DairyFlow Distributors",
  terms:
    "1. Payment due on delivery. Interest @18% p.a. on overdue.\n2. Goods once sold will not be taken back.\n3. Subject to Delhi jurisdiction.",
  invoice_prefix: "INV",
};

export function getBusiness(): BusinessProfile {
  if (typeof window === "undefined") return DEFAULT_BUSINESS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_BUSINESS;
    return { ...DEFAULT_BUSINESS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_BUSINESS;
  }
}

export function saveBusiness(b: BusinessProfile) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(b));
}

// UPI intent string. Empty when no VPA configured.
export function upiIntent(opts: { payee: string; vpa?: string; amount: number; note: string }) {
  if (!opts.vpa) return "";
  const params = new URLSearchParams({
    pa: opts.vpa,
    pn: opts.payee,
    am: opts.amount.toFixed(2),
    cu: "INR",
    tn: opts.note,
  });
  return `upi://pay?${params.toString()}`;
}

// Google Chart-style QR image via public qrserver.com (no dependency).
export function qrImage(data: string, size = 160) {
  const encoded = encodeURIComponent(data);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=0&data=${encoded}`;
}
