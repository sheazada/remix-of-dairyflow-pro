import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole, FINANCE_ROLES } from "@/lib/authz";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Process Payment Reminders
 * 
 * Logic:
 * 1. Fetch all active reminder templates.
 * 2. For each template (e.g., "3 Days Overdue"), calculate the cutoff date (Today - 3 days).
 * 3. Find all invoices where `balance > 0` AND `due_date <= cutoff_date`.
 * 4. Check `reminder_logs` to see if we already sent this specific reminder for this invoice.
 * 5. If NOT sent:
 *    - Format the message using template variables ({customer_name}, {outstanding}, etc.)
 *    - Insert into `notification_logs` to trigger the actual send (Email/WhatsApp/SMS).
 *    - Insert into `reminder_logs` to record that we sent it (prevents duplicates).
 */
export const processPaymentReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ dryRun: z.boolean().optional() }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    await requireRole(context.supabase, context.userId, FINANCE_ROLES);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Fetch active templates
    const { data: templates, error: tErr } = await supabaseAdmin
      .from("reminder_templates")
      .select("*")
      .eq("is_active", true);

    if (tErr) throw new Error(tErr.message);
    if (!templates || templates.length === 0) return { message: "No active reminder templates found." };

    let totalProcessed = 0;
    const results: { invoice_no: string; customer: string; template: string; channel: string }[] = [];

    // 2. Loop through each template rule
    for (const template of templates) {
      // Calculate cutoff date: e.g., if template is "3 Days Overdue", cutoff is 3 days ago.
      // We want invoices due ON or BEFORE that date.
      const cutoffDate = new Date(today);
      cutoffDate.setDate(today.getDate() - template.days_overdue);
      const cutoffStr = cutoffDate.toISOString();

      // 3. Find overdue invoices for this template
      // We look for invoices with balance > 0 and due_date <= cutoff
      const { data: invoices, error: iErr } = await supabaseAdmin
        .from("invoices")
        .select(
          "id, invoice_no, balance, due_date, customer_id, customer:customers(name, shop_name, mobile, email, notify_whatsapp, notify_email, notify_sms, whatsapp)"
        )
        .gt("balance", 0)
        .lte("due_date", cutoffStr)
        .neq("status", "paid") // Ensure not fully paid
        .limit(100); // Safety limit per run

      if (iErr) throw new Error(iErr.message);
      if (!invoices) continue;

      // 4. Check and Send
      for (const invoice of invoices) {
        // Check if we already sent this specific template for this invoice
        const { data: logs, error: lErr } = await supabaseAdmin
          .from("reminder_logs")
          .select("id")
          .eq("invoice_id", invoice.id)
          .eq("template_id", template.id)
          .eq("status", "sent")
          .limit(1);

        if (lErr) throw new Error(lErr.message);

        // If logs exist, we already sent it. Skip.
        if (logs && logs.length > 0) continue;

        // --- FORMAT MESSAGE ---
        const customerName = invoice.customer?.shop_name || invoice.customer?.name || "Customer";
        const message = template.body
          .replace(/{customer_name}/g, customerName)
          .replace(/{outstanding}/g, `₹${Number(invoice.balance).toLocaleString("en-IN")}`)
          .replace(/{invoice_no}/g, invoice.invoice_no)
          .replace(/{due_date}/g, invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("en-IN") : "—");

        const subject = template.subject?.replace(/{invoice_no}/g, invoice.invoice_no) || `Payment Reminder: Invoice ${invoice.invoice_no}`;

        // Determine recipient and channel preference
        // Priority: WhatsApp (if enabled and number exists) -> Email (if enabled and email exists) -> SMS
        // For MVP, we'll stick to the template's defined channel, but check if customer has it enabled.
        let recipient = "";
        const channel = template.channel as "email" | "sms" | "whatsapp";

        if (template.channel === "whatsapp") {
          const num = invoice.customer?.whatsapp || invoice.customer?.mobile;
          if (!num || invoice.customer?.notify_whatsapp === false) continue; // Skip if no number or opted out
          recipient = num;
        } else if (template.channel === "email") {
          if (!invoice.customer?.email || invoice.customer?.notify_email === false) continue;
          recipient = invoice.customer.email;
        } else if (template.channel === "sms") {
          if (!invoice.customer?.mobile || invoice.customer?.notify_sms === false) continue;
          recipient = invoice.customer.mobile;
        }

        if (!recipient) continue;

        // --- EXECUTE (or Dry Run) ---
        if (!data.dryRun) {
          // Insert into Notification Logs (triggers the actual sending via existing system)
          const { error: nErr } = await supabaseAdmin.from("notification_logs").insert({
            channel: channel,
            recipient: recipient,
            recipient_name: customerName,
            subject: subject,
            body: message,
            template: template.name,
            customer_id: invoice.customer_id,
            invoice_id: invoice.id,
            status: "queued", // The existing processQueuedNotifications function will pick this up
            max_attempts: 3,
          });

          if (nErr) {
            console.error("Failed to queue notification:", nErr);
            // Log failure but continue
            await supabaseAdmin.from("reminder_logs").insert({
              customer_id: invoice.customer_id,
              invoice_id: invoice.id,
              template_id: template.id,
              channel: channel,
              status: "failed",
              error_message: nErr.message,
            });
            continue;
          }

          // Record in Reminder Logs (Success)
          await supabaseAdmin.from("reminder_logs").insert({
            customer_id: invoice.customer_id,
            invoice_id: invoice.id,
            template_id: template.id,
            channel: channel,
            status: "sent",
          });
        }

        totalProcessed++;
        results.push({
          invoice_no: invoice.invoice_no,
          customer: customerName,
          template: template.name,
          channel: channel,
        });
      }
    }

    return {
      message: data.dryRun 
        ? `Dry Run: Found ${totalProcessed} reminders to send.` 
        : `Processed ${totalProcessed} reminders.`,
      count: totalProcessed,
      details: results,
      dryRun: data.dryRun || false,
    };
  });
