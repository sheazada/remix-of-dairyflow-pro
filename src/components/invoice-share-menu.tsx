// Enhanced share menu for invoices with WhatsApp template options.
// Offers: Send Invoice, Payment Reminder, Statement, plus Email/SMS/Download

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  Share2,
  MessageCircle,
  Mail,
  MessageSquare,
  Download,
  ReceiptText,
  Bell,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { buildInvoicePdf } from "@/lib/invoice-pdf";
import { getBusiness } from "@/lib/business";
import { inr, shortDate } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { quickSendInvoice, quickSendReminder, formatStatementMessage, normalizePhoneForWhatsApp } from "@/lib/whatsapp";

type Props = {
  invoice: any;
  items?: any[];
  itemsLoader?: () => Promise<any[]>;
  customer?: any;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "default";
  label?: string;
  align?: "start" | "end";
};

type Channel = "whatsapp" | "email" | "sms" | "download_pdf" | "copy_summary";

export function InvoiceShareMenu({
  invoice,
  items,
  itemsLoader,
  customer,
  size = "sm",
  variant = "outline",
  label = "Share",
  align = "end",
}: Props) {
  const [busy, setBusy] = useState(false);
  const biz = getBusiness();
  const c = customer ?? invoice.customer;

  const phone = (c?.mobile ?? "").replace(/\D/g, "");
  const hasWhatsApp = phone && phone.length >= 10;

  const url = typeof window !== "undefined" ? window.location.origin + `/invoices/${invoice.id}` : "";

  const summary =
    `*${biz.name}* — Tax Invoice\n` +
    `Invoice #: ${invoice.invoice_no}\n` +
    `Date: ${shortDate(invoice.invoice_date)}\n` +
    (c?.name ? `Bill to: ${c.name}${c.shop_name ? " · " + c.shop_name : ""}\n` : "") +
    `Amount: ${inr(invoice.total)}\n` +
    (Number(invoice.balance) > 0 ? `Balance due: ${inr(invoice.balance)}\n` : `Paid in full ✓\n`) +
    (biz.upi_vpa ? `\nPay via UPI: ${biz.upi_vpa}\n` : "") +
    `\nView: ${url}`;

  const logShare = async (channel: Channel, recipient?: string | null) => {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const u = userRes?.user;
      await supabase.from("share_activity_logs").insert({
        invoice_id: invoice.id ?? null,
        invoice_no: invoice.invoice_no ?? null,
        customer_id: c?.id ?? invoice.customer_id ?? null,
        channel,
        recipient: recipient || null,
        user_id: u?.id ?? null,
        user_email: u?.email ?? null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
      });
    } catch {
      // Non-blocking
    }
  };

  const buildPdfFile = async (): Promise<File> => {
    const rows = items ?? (itemsLoader ? await itemsLoader() : []);
    const blob = await buildInvoicePdf(invoice, rows);
    return new File([blob], `Invoice-${invoice.invoice_no}.pdf`, { type: "application/pdf" });
  };

  // WhatsApp actions
  const sendInvoiceViaWhatsApp = () => {
    const invData = {
      invoice_no: invoice.invoice_no,
      invoice_date: invoice.invoice_date,
      total: Number(invoice.total),
      paid: Number(invoice.paid ?? 0),
      balance: Number(invoice.balance),
      items: items?.map((it: any) => ({
        product_name: it.product_name,
        quantity: Number(it.quantity),
        rate: Number(it.rate),
        amount: Number(it.amount ?? it.quantity * it.rate),
      })),
    };
    quickSendInvoice(
      invData,
      { name: c?.name ?? "", shop_name: c?.shop_name, mobile: c?.mobile },
      { name: biz.name, mobile: biz.mobile, upi_vpa: biz.upi_vpa, bank_name: biz.bank_name, bank_account: biz.bank_account, bank_ifsc: biz.bank_ifsc, bank_holder: biz.bank_holder },
    );
    void logShare("whatsapp", c?.mobile ?? null);
  };

  const sendReminderViaWhatsApp = (stage: "gentle" | "firm" | "final") => {
    const invData = {
      invoice_no: invoice.invoice_no,
      invoice_date: invoice.invoice_date,
      total: Number(invoice.total),
      paid: Number(invoice.paid ?? 0),
      balance: Number(invoice.balance),
    };
    quickSendReminder(
      invData,
      { name: c?.name ?? "", shop_name: c?.shop_name, mobile: c?.mobile },
      { name: biz.name, mobile: biz.mobile, upi_vpa: biz.upi_vpa },
      stage,
    );
    void logShare("whatsapp", c?.mobile ?? null);
  };

  const sendStatementViaWhatsApp = () => {
    // For statement, we'd need all unpaid invoices - use current as placeholder
    const invData = {
      invoice_no: invoice.invoice_no,
      invoice_date: invoice.invoice_date,
      total: Number(invoice.total),
      balance: Number(invoice.balance),
    };
    const msg = formatStatementMessage(
      { name: c?.name ?? "", shop_name: c?.shop_name },
      { name: biz.name, mobile: biz.mobile, upi_vpa: biz.upi_vpa },
      [invData],
      Number(invoice.balance),
    );
    const normalized = normalizePhoneForWhatsApp(c?.mobile);
    const url = normalized
      ? `https://wa.me/${normalized}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    void logShare("whatsapp", c?.mobile ?? null);
  };

  const email = () => {
    const to = c?.email ?? "";
    const subject = `Invoice ${invoice.invoice_no} from ${biz.name}`;
    const href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(summary)}`;
    window.location.href = href;
    void logShare("email", to || null);
  };

  const sms = () => {
    const phoneNum = (c?.mobile ?? "").replace(/[^\\d+]/g, "");
    const href = `sms:${phoneNum}?&body=${encodeURIComponent(summary)}`;
    window.location.href = href;
    void logShare("sms", phoneNum || null);
  };

  const downloadPdf = async () => {
    setBusy(true);
    try {
      const rows = items ?? (itemsLoader ? await itemsLoader() : []);
      const blob = await buildInvoicePdf(invoice, rows);
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = `Invoice-${invoice.invoice_no}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 1000);
      await logShare("download_pdf");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate PDF");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant={variant} className="gap-1.5" disabled={busy}>
          <Share2 className="size-4" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-60">
        <DropdownMenuLabel>WhatsApp</DropdownMenuLabel>

        {/* Send Invoice via WhatsApp */}
        <DropdownMenuItem onClick={sendInvoiceViaWhatsApp} disabled={!hasWhatsApp}>
          <MessageCircle className="size-4 mr-2 text-green-600" />
          Send Invoice
          {!hasWhatsApp && <span className="ml-auto text-[10px] text-muted-foreground">No phone</span>}
        </DropdownMenuItem>

        {/* Payment Reminder submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={!hasWhatsApp}>
            <Bell className="size-4 mr-2 text-amber-600" />
            Payment Reminder
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => sendReminderViaWhatsApp("gentle")}>
              Gentle reminder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => sendReminderViaWhatsApp("firm")}>
              Firm follow-up
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => sendReminderViaWhatsApp("final")}>
              Final notice
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Statement */}
        <DropdownMenuItem onClick={sendStatementViaWhatsApp} disabled={!hasWhatsApp}>
          <FileText className="size-4 mr-2 text-blue-600" />
          Send Statement
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Other</DropdownMenuLabel>

        <DropdownMenuItem onClick={email}>
          <Mail className="size-4 mr-2 text-blue-600" /> Email
        </DropdownMenuItem>

        <DropdownMenuItem onClick={sms}>
          <MessageSquare className="size-4 mr-2" /> SMS
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={downloadPdf}>
          <Download className="size-4 mr-2" /> Download PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
