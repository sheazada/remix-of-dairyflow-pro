// WhatsApp message formatters and sender for DairyFlow ERP
// Uses wa.me links for text messages (no API key required)
// For PDF attachments: WhatsApp Business API needed (not included here)

import { inr, shortDate, num } from "./format";

// ─── Phone normalization ─────────────────────────────────────────────────────

/**
 * Normalize a phone number for WhatsApp wa.me links.
 * Strips non-digits, adds +91 prefix if Indian number without country code.
 * Returns empty string if no valid number.
 */
export function normalizePhoneForWhatsApp(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 0) return "";
  // If starts with 91 and total 12 digits, keep as is
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  // If 10 digits, assume Indian number, add 91
  if (digits.length === 10) return "91" + digits;
  // If starts with +, strip it and use as-is
  return digits;
}

/**
 * Open WhatsApp with a pre-filled message.
 * If phone is provided, opens chat with that number.
 * If not, opens WhatsApp with contact picker.
 */
export function sendWhatsApp(phone: string | null | undefined, message: string): void {
  const normalized = normalizePhoneForWhatsApp(phone);
  const encoded = encodeURIComponent(message);
  const url = normalized
    ? `https://wa.me/${normalized}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

// ─── Message templates ────────────────────────────────────────────────────────

type BusinessInfo = {
  name: string;
  mobile?: string;
  upi_vpa?: string;
  bank_name?: string;
  bank_account?: string;
  bank_ifsc?: string;
  bank_holder?: string;
};

type CustomerInfo = {
  name: string;
  shop_name?: string;
  mobile?: string;
};

type InvoiceInfo = {
  invoice_no: string;
  invoice_date: string;
  total: number;
  paid: number;
  balance: number;
  items?: Array<{
    product_name: string;
    quantity: number;
    rate: number;
    amount: number;
  }>;
};

/**
 * Format an invoice message for WhatsApp.
 * Includes: header, invoice details, itemized list (if provided), balance due, payment info.
 */
export function formatInvoiceMessage(
  invoice: InvoiceInfo,
  customer: CustomerInfo,
  business: BusinessInfo,
): string {
  const header = ` *${business.name}*\n_Tax Invoice_\n\n`;
  const greet = `Dear ${customer.shop_name ?? customer.name},\n\n`;

  const details = [
    `📋 *Invoice:* ${invoice.invoice_no}`,
    ` *Date:* ${shortDate(invoice.invoice_date)}`,
    `💰 *Total:* ${inr(invoice.total)}`,
  ].join("\n");

  let itemsSection = "";
  if (invoice.items && invoice.items.length > 0) {
    itemsSection = "\n\n*Items:*\n";
    itemsSection += invoice.items
      .map(
        (it) =>
          `  • ${it.product_name}  × ${num(it.quantity, 1)}  @ ${inr(it.rate)}  = ${inr(it.amount)}`,
      )
      .join("\n");
    if (invoice.items.length > 10) {
      itemsSection += `\n  _...and ${invoice.items.length - 10} more items_`;
    }
  }

  const balance = Number(invoice.balance);
  const balanceLine = balance > 0
    ? `\n\n⏳ *Balance Due: ${inr(balance)}*`
    : "\n\n✅ *Paid in full — Thank you!*";

  const paymentInfo = buildPaymentInfo(business);

  const footer = `\n\n_For queries, call ${business.mobile ?? "us"}._\n_Thank you for your business!_`;

  return (
    header +
    greet +
    details +
    itemsSection +
    balanceLine +
    paymentInfo +
    footer
  );
}

/**
 * Format a payment reminder message.
 * Friendly but clear tone for overdue payments.
 */
export function formatPaymentReminder(
  invoice: InvoiceInfo,
  customer: CustomerInfo,
  business: BusinessInfo,
  reminderStage: "gentle" | "firm" | "final" = "gentle",
): string {
  const stageEmoji = { gentle: "", firm: "⚠️", final: "🚨" };
  const stageTitle = {
    gentle: "Payment Reminder",
    firm: "Payment Follow-up",
    final: "Final Payment Notice",
  };
  const stageBody = {
    gentle: "This is a gentle reminder about your outstanding invoice.",
    firm: "We haven't received payment for the invoice below. Kindly clear it at your earliest.",
    final: "Your invoice is significantly overdue. Please clear the outstanding amount immediately to avoid service interruption.",
  };

  return [
    `${stageEmoji[reminderStage]} *${business.name}*`,
    `_${stageTitle[reminderStage]}_`,
    "",
    `Dear ${customer.shop_name ?? customer.name},`,
    "",
    stageBody[reminderStage],
    "",
    `📋 *Invoice:* ${invoice.invoice_no}`,
    `📅 *Date:* ${shortDate(invoice.invoice_date)}`,
    `💰 *Amount Due: ${inr(invoice.balance)}*`,
    buildPaymentInfo(business),
    "",
    `If you have already paid, please ignore this message.`,
    "",
    `_Thank you,_`,
    `_ ${business.name}_`,
    `_Ph: ${business.mobile ?? "—"}_`,
  ].join("\n");
}

/**
 * Format an order confirmation message.
 * Sent to retailer when admin creates an order on their behalf.
 */
export function formatOrderConfirmation(
  orderNo: string,
  orderDate: string,
  total: number,
  items: Array<{ product_name: string; quantity: number; rate: number }>,
  customer: CustomerInfo,
  business: BusinessInfo,
): string {
  return [
    `✅ *${business.name}*`,
    "_Order Confirmed_",
    "",
    `Dear ${customer.shop_name ?? customer.name},`,
    "",
    `Your order has been confirmed:`,
    "",
    `📋 *Order:* ${orderNo}`,
    `📅 *Date:* ${shortDate(orderDate)}`,
    `💰 *Total:* ${inr(total)}`,
    "",
    "*Items:*",
    ...items.map(
      (it) => `  • ${it.product_name}  × ${num(it.quantity, 1)}  @ ${inr(it.rate)}`,
    ),
    "",
    `_Your order will be delivered as per schedule._`,
    "",
    `_Thank you!_`,
    `_${business.name}_`,
  ].join("\n");
}

/**
 * Format a delivery notification message.
 * Sent when the order is out for delivery.
 */
export function formatDeliveryNotification(
  orderNo: string,
  invoiceNo: string | null,
  customer: CustomerInfo,
  business: BusinessInfo,
  driverName?: string,
): string {
  return [
    `🚚 *${business.name}*`,
    "_Out for Delivery_",
    "",
    `Dear ${customer.shop_name ?? customer.name},`,
    "",
    `Your order is on the way!`,
    "",
    invoiceNo ? `📋 *Invoice:* ${invoiceNo}` : ` *Order:* ${orderNo}`,
    driverName ? `👤 *Driver:* ${driverName}` : "",
    "",
    `Please keep the payment ready.`,
    "",
    `_Thank you!_`,
    `_${business.name}_`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Format a daily statement / outstanding summary.
 * Shows all unpaid invoices and total outstanding.
 */
export function formatStatementMessage(
  customer: CustomerInfo,
  business: BusinessInfo,
  invoices: Array<{
    invoice_no: string;
    invoice_date: string;
    total: number;
    balance: number;
  }>,
  totalOutstanding: number,
): string {
  const unpaid = invoices.filter((inv) => Number(inv.balance) > 0);

  let msg = [
    `📊 *${business.name}*`,
    "_Account Statement_",
    "",
    `Dear ${customer.shop_name ?? customer.name},`,
    "",
    `Here's your current outstanding:`,
    "",
    `💰 *Total Due: ${inr(totalOutstanding)}*`,
    "",
  ];

  if (unpaid.length > 0) {
    msg.push("*Unpaid Invoices:*");
    unpaid.forEach((inv) => {
      msg.push(`  • ${inv.invoice_no}  (${shortDate(inv.invoice_date)})  ${inr(inv.balance)}`);
    });
    msg.push("");
  }

  msg = msg.concat([
    buildPaymentInfo(business),
    "",
    `_For any discrepancies, please contact us._`,
    "",
    `_Thank you!_`,
    `_${business.name}_`,
  ]);

  return msg.join("\n");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildPaymentInfo(business: BusinessInfo): string {
  const lines: string[] = [];
  if (business.upi_vpa) lines.push(` *Pay via UPI:* ${business.upi_vpa}`);
  if (business.bank_name && business.bank_account) {
    lines.push(`🏦 *Bank:* ${business.bank_name}`);
    if (business.bank_holder) lines.push(`   A/c: ${business.bank_holder}`);
    lines.push(`   A/c No: ${business.bank_account}`);
    if (business.bank_ifsc) lines.push(`   IFSC: ${business.bank_ifsc}`);
  }
  return lines.length > 0 ? "\n\n*Payment Details:*\n" + lines.join("\n") : "";
}

// ─── Quick helpers for common scenarios ──────────────────────────────────────

/**
 * One-click: send invoice to retailer's WhatsApp.
 * Opens WhatsApp with pre-filled message.
 */
export function quickSendInvoice(
  invoice: InvoiceInfo,
  customer: CustomerInfo,
  business: BusinessInfo,
): void {
  sendWhatsApp(customer.mobile, formatInvoiceMessage(invoice, customer, business));
}

/**
 * One-click: send payment reminder.
 */
export function quickSendReminder(
  invoice: InvoiceInfo,
  customer: CustomerInfo,
  business: BusinessInfo,
  stage: "gentle" | "firm" | "final" = "gentle",
): void {
  sendWhatsApp(
    customer.mobile,
    formatPaymentReminder(invoice, customer, business, stage),
  );
}
