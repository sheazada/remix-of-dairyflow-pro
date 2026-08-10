// Generates a professional GST invoice PDF and triggers a browser download.
// Uses jsPDF + autoTable — loaded dynamically so the ~540KB bundle is only
// fetched when the user actually clicks "Download PDF".
//
// This is the single biggest perf win: jsPDF + jspdf-autotable together are
// ~540KB gzipped. By dynamic-importing them, every other page in the app
// loads ~540KB less.

import { supabase } from "@/integrations/supabase/client";
import { getBusiness } from "@/lib/business";
import { inr, shortDate } from "@/lib/format";
import { amountInWords } from "@/lib/amount-in-words";

// Lazy imports — these are the heavy dependencies (~540KB combined).
// We resolve them once and cache the promise so subsequent calls are free.
let jsPDFPromise: Promise<typeof import("jspdf").default> | null = null;
let autoTablePromise: Promise<typeof import("jspdf-autotable").default> | null = null;

function getJsPDF() {
  if (!jsPDFPromise) {
    jsPDFPromise = import("jspdf").then((m) => m.default);
  }
  return jsPDFPromise;
}

function getAutoTable() {
  if (!autoTablePromise) {
    autoTablePromise = import("jspdf-autotable").then((m) => m.default);
  }
  return autoTablePromise;
}

type Row = Record<string, any>;

async function loadInvoice(invoiceId: string) {
  const [inv, items] = await Promise.all([
    supabase.from("invoices").select("*, customer:customers(*)").eq("id", invoiceId).single(),
    supabase.from("invoice_items").select("*").eq("invoice_id", invoiceId).order("created_at"),
  ]);
  if (inv.error || !inv.data) throw inv.error ?? new Error("Invoice not found");
  return { invoice: inv.data as Row, items: (items.data ?? []) as Row[] };
}

export async function downloadInvoicePdf(invoiceId: string) {
  const { invoice, items } = await loadInvoice(invoiceId);
  const blob = await buildInvoicePdf(invoice, items);
  const filename = `Invoice-${invoice.invoice_no ?? invoiceId}.pdf`;
  triggerDownload(blob, filename);
}

export async function buildInvoicePdf(invoice: Row, items: Row[]): Promise<Blob> {
  const [jsPDF, autoTable] = await Promise.all([getJsPDF(), getAutoTable()]);
  const biz = getBusiness();
  const c = invoice.customer ?? {};
  const isInter = Number(invoice.igst) > 0;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 12;

  // Top accent bar
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, W, 2, "F");

  // Header — business
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(biz.name || "Your Business", M, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const headerLines = [
    biz.legal_name && biz.legal_name !== biz.name ? biz.legal_name : "",
    biz.address || "",
    [biz.state, biz.state_code && `State code ${biz.state_code}`].filter(Boolean).join(" · "),
    [biz.mobile && `☎ ${biz.mobile}`, biz.email && `✉ ${biz.email}`].filter(Boolean).join("   "),
    [biz.gstin && `GSTIN: ${biz.gstin}`, biz.pan && `PAN: ${biz.pan}`, biz.fssai && `FSSAI: ${biz.fssai}`]
      .filter(Boolean)
      .join("   "),
  ].filter(Boolean);
  let y = 20;
  headerLines.forEach((l) => {
    doc.text(l as string, M, y);
    y += 4.2;
  });

  // Invoice title block (right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text("TAX INVOICE", W - M, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const meta = [
    `Invoice #: ${invoice.invoice_no ?? ""}`,
    `Date: ${invoice.invoice_date ? shortDate(invoice.invoice_date) : ""}`,
    invoice.due_date ? `Due: ${shortDate(invoice.due_date)}` : "",
    `Status: ${(invoice.status ?? "").toUpperCase()}`,
  ].filter(Boolean);
  let ry = 20;
  meta.forEach((l) => {
    doc.text(l, W - M, ry, { align: "right" });
    ry += 4.2;
  });

  y = Math.max(y, ry) + 2;

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.line(M, y, W - M, y);
  y += 5;

  // Bill To
  const billBoxTop = y;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("BILL TO", M, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  y += 5;
  doc.text(c.name || "—", M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const billLines = [
    c.shop_name || "",
    c.address || "",
    [c.city, c.state].filter(Boolean).join(", "),
    c.mobile ? `☎ ${c.mobile}` : "",
    c.gstin ? `GSTIN: ${c.gstin}` : "",
  ].filter(Boolean);
  billLines.forEach((l) => {
    y += 4.2;
    doc.text(l as string, M, y);
  });

  // Place of supply (right column)
  let py = billBoxTop;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("PLACE OF SUPPLY", W - M, py, { align: "right" });
  py += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(c.state || biz.state || "—", W - M, py, { align: "right" });
  py += 5;
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(isInter ? "Inter-state (IGST)" : "Intra-state (CGST + SGST)", W - M, py, { align: "right" });

  y = Math.max(y, py) + 6;

  // Items table
  const head = isInter
    ? [["#", "Item", "HSN", "Qty", "Rate", "Disc", "Taxable", "IGST %", "IGST", "Amount"]]
    : [["#", "Item", "HSN", "Qty", "Rate", "Disc", "Taxable", "GST %", "CGST", "SGST", "Amount"]];

  const body = items.map((it, idx) => {
    const qty = Number(it.quantity ?? 0);
    const rate = Number(it.rate ?? 0);
    const disc = Number(it.discount ?? 0);
    const taxable = Number(it.taxable ?? qty * rate - disc);
    const taxAmt = Number(it.tax_amount ?? 0);
    const amount = Number(it.amount ?? taxable + taxAmt);
    const gst = Number(it.gst_rate ?? 0);
    if (isInter) {
      return [
        String(idx + 1),
        it.product_name ?? "",
        it.hsn ?? "",
        qty.toString(),
        rate.toFixed(2),
        disc.toFixed(2),
        taxable.toFixed(2),
        `${gst}%`,
        taxAmt.toFixed(2),
        amount.toFixed(2),
      ];
    }
    return [
      String(idx + 1),
      it.product_name ?? "",
      it.hsn ?? "",
      qty.toString(),
      rate.toFixed(2),
      disc.toFixed(2),
      taxable.toFixed(2),
      `${gst}%`,
      (taxAmt / 2).toFixed(2),
      (taxAmt / 2).toFixed(2),
      amount.toFixed(2),
    ];
  });

  autoTable(doc, {
    head,
    body,
    startY: y,
    margin: { left: M, right: M },
    styles: { fontSize: 8.5, cellPadding: 2, textColor: [15, 23, 42], lineColor: [226, 232, 240] },
    headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      1: { cellWidth: "auto" },
      2: { halign: "center", cellWidth: 16 },
      3: { halign: "right", cellWidth: 12 },
      4: { halign: "right", cellWidth: 16 },
      5: { halign: "right", cellWidth: 14 },
      6: { halign: "right", cellWidth: 20 },
      7: { halign: "center", cellWidth: 14 },
      8: { halign: "right", cellWidth: 18 },
      9: { halign: "right", cellWidth: 18 },
      10: { halign: "right", cellWidth: 20 },
    },
  });

  let ay = (doc as any).lastAutoTable.finalY + 6;

  // Totals block (right)
  const subtotal = Number(invoice.subtotal ?? 0);
  const discount = Number(invoice.discount ?? 0);
  const cgst = Number(invoice.cgst ?? 0);
  const sgst = Number(invoice.sgst ?? 0);
  const igst = Number(invoice.igst ?? 0);
  const roundOff = Number(invoice.round_off ?? 0);
  const total = Number(invoice.total ?? 0);
  const paid = Number(invoice.paid ?? 0);
  const balance = Number(invoice.balance ?? total - paid);

  const totalsRows: [string, string][] = [
    ["Subtotal", inr(subtotal)],
    ...(discount ? ([["Discount", `- ${inr(discount)}`]] as [string, string][]) : []),
    ...(isInter
      ? ([["IGST", inr(igst)]] as [string, string][])
      : ([
          ["CGST", inr(cgst)],
          ["SGST", inr(sgst)],
        ] as [string, string][])),
    ...(roundOff ? ([["Round off", inr(roundOff)]] as [string, string][]) : []),
  ];

  const boxW = 80;
  const boxX = W - M - boxW;
  const rowH = 6;
  const totalsH = totalsRows.length * rowH + 12;
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(boxX, ay, boxW, totalsH, 1.5, 1.5);

  doc.setFontSize(9.5);
  totalsRows.forEach((r, i) => {
    const ry2 = ay + 5 + i * rowH;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(r[0], boxX + 3, ry2);
    doc.setTextColor(15, 23, 42);
    doc.text(r[1], boxX + boxW - 3, ry2, { align: "right" });
  });
  const totalY = ay + 5 + totalsRows.length * rowH + 1;
  doc.setDrawColor(226, 232, 240);
  doc.line(boxX + 2, totalY, boxX + boxW - 2, totalY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Grand Total", boxX + 3, totalY + 5);
  doc.text(inr(total), boxX + boxW - 3, totalY + 5, { align: "right" });

  // Left: amount in words + payment status
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("AMOUNT IN WORDS", M, ay + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  const words = doc.splitTextToSize(amountInWords(total), boxX - M - 4);
  doc.text(words, M, ay + 9);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("PAYMENT", M, ay + 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`Paid: ${inr(paid)}`, M, ay + 27);
  doc.setTextColor(balance > 0 ? 220 : 22, balance > 0 ? 38 : 163, balance > 0 ? 38 : 74);
  doc.setFont("helvetica", "bold");
  doc.text(balance > 0 ? `Balance due: ${inr(balance)}` : "Paid in full", M, ay + 32);

  ay += totalsH + 8;

  // Bank & UPI footer
  if (biz.upi_vpa || biz.bank_account) {
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(M, ay, W - 2 * M, 22, 1.5, 1.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("PAYMENT DETAILS", M + 3, ay + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    const payLines = [
      biz.upi_vpa ? `UPI: ${biz.upi_vpa}` : "",
      biz.bank_holder ? `A/C Holder: ${biz.bank_holder}` : "",
      biz.bank_name
        ? `Bank: ${biz.bank_name}${biz.bank_branch ? ` (${biz.bank_branch})` : ""}`
        : "",
      biz.bank_account ? `A/C No: ${biz.bank_account}` : "",
      biz.bank_ifsc ? `IFSC: ${biz.bank_ifsc}` : "",
    ].filter(Boolean);
    payLines.forEach((l, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      doc.text(l as string, M + 3 + col * ((W - 2 * M) / 2), ay + 10 + row * 4.2);
    });
    ay += 26;
  }

  // Terms + signature
  const pageH = doc.internal.pageSize.getHeight();
  const footerY = Math.max(ay, pageH - 40);
  if (biz.terms) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("TERMS & CONDITIONS", M, footerY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const terms = doc.splitTextToSize(biz.terms, W - 2 * M - 60);
    doc.text(terms, M, footerY + 4);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`For ${biz.name || "Business"}`, W - M, footerY + 4, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Authorised Signatory", W - M, footerY + 20, { align: "right" });

  // Footer note
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "This is a computer-generated invoice and does not require a physical signature.",
    W / 2,
    pageH - 6,
    { align: "center" },
  );

  return doc.output("blob");
}

function triggerDownload(blob: Blob, filename: string) {
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
 * Warm up the PDF libraries so the first download is instant.
 * Call from invoice page components on mount (or on hover of a "Download" button).
 */
export function prefetchInvoicePdf(): void {
  getJsPDF();
  getAutoTable();
}
