import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole, STAFF_ROLES, FINANCE_ROLES } from "@/lib/authz";
import { z } from "zod";

/**
 * Enqueue notification_logs rows for a delivery's current status.
 * Idempotent: DB unique key = delivery:{id}:{status}:{channel}.
 * Safe to call after every save; duplicates are dropped.
 */
export const enqueueDeliveryNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ deliveryId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireRole(context.supabase, context.userId, STAFF_ROLES);
    const { data: inserted, error } = await context.supabase.rpc(
      "enqueue_delivery_notifications",
      { _delivery_id: data.deliveryId },
    );
    if (error) throw new Error(error.message);
    return { enqueued: Number(inserted ?? 0) };
  });

/**
 * Process queued/failed-with-due-retry notification_logs rows.
 * Each row is claimed via optimistic UPDATE (queued/failed → sending) so
 * concurrent workers can't send twice. Dispatch failures fall back to
 * record_notification_attempt() which handles exponential backoff.
 */
export const processQueuedNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ limit: z.number().int().min(1).max(50).optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireRole(context.supabase, context.userId, FINANCE_ROLES);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const limit = data.limit ?? 20;

    // Pick candidates
    const { data: candidates, error: qErr } = await supabaseAdmin
      .from("notification_logs")
      .select("id")
      .in("status", ["queued", "failed"])
      .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (qErr) throw new Error(qErr.message);

    const results: Array<{ id: string; ok: boolean; reason?: string }> = [];

    for (const row of candidates ?? []) {
      // Atomically claim → "sending"
      const { data: claimed, error: cErr } = await supabaseAdmin
        .from("notification_logs")
        .update({ status: "sending", last_attempt_at: new Date().toISOString() })
        .eq("id", row.id)
        .in("status", ["queued", "failed"])
        .select("*")
        .maybeSingle();
      if (cErr || !claimed) continue; // taken by another worker

      let ok = false;
      let providerName: string | null = null;
      let providerMsgId: string | null = null;
      let errText: string | null = null;
      let suppressed = false;

      try {
        if (claimed.channel === "email") {
          const r = await sendEmail(claimed);
          providerName = "lovable-email";
          if (r.suppressed) { suppressed = true; ok = false; }
          else { ok = r.ok; providerMsgId = r.messageId ?? null; if (!ok) errText = r.error ?? "email send failed"; }
        } else if (claimed.channel === "sms" || claimed.channel === "whatsapp") {
          const r = await sendTwilio(claimed);
          providerName = "twilio";
          ok = r.ok; providerMsgId = r.messageId ?? null;
          if (!ok) errText = r.error ?? "twilio send failed";
        } else {
          errText = `Unsupported channel: ${claimed.channel}`;
        }
      } catch (e: any) {
        errText = e?.message ?? String(e);
      }

      const { error: rpcErr } = await supabaseAdmin.rpc("record_notification_attempt", {
        _id: claimed.id,
        _success: ok,
        _error: errText ?? undefined,
        _provider: providerName ?? undefined,
        _provider_msg: providerMsgId ?? undefined,
        _suppressed: suppressed,
      });
      if (rpcErr) {
        results.push({ id: claimed.id, ok: false, reason: rpcErr.message });
      } else {
        results.push({ id: claimed.id, ok, reason: errText ?? undefined });
      }
    }

    return {
      processed: results.length,
      sent: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  });

/* ---------------- providers ---------------- */

type Row = {
  id: string;
  channel: "email" | "sms" | "whatsapp";
  recipient: string;
  recipient_name: string | null;
  subject: string | null;
  body: string | null;
  template: string | null;
  template_data: any;
};

async function sendEmail(row: Row): Promise<{ ok: boolean; messageId?: string; error?: string; suppressed?: boolean }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  const senderDomain = process.env.SENDER_DOMAIN || process.env.FROM_DOMAIN;
  if (!apiKey) return { ok: false, error: "LOVABLE_API_KEY not configured" };
  if (!senderDomain) return { ok: false, error: "Email domain not configured (set up Cloud → Emails)" };

  try {
    const res = await fetch(`https://api.lovable.dev/v1/email/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: `notifications@${senderDomain}`,
        to: row.recipient,
        subject: row.subject ?? "Delivery update",
        text: row.body ?? "",
        idempotency_key: `notif:${row.id}`,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      if (res.status === 409 || /suppress/i.test(text)) return { ok: false, suppressed: true, error: text };
      return { ok: false, error: `[${res.status}] ${text.slice(0, 400)}` };
    }
    let msgId: string | undefined;
    try { msgId = JSON.parse(text)?.message_id; } catch { /* ignore */ }
    return { ok: true, messageId: msgId };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "email dispatch error" };
  }
}

async function sendTwilio(row: Row): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  const twilioKey = process.env.TWILIO_API_KEY;
  if (!apiKey) return { ok: false, error: "LOVABLE_API_KEY not configured" };
  if (!twilioKey) return { ok: false, error: "Twilio not connected (add Twilio connector)" };

  const fromSms = process.env.TWILIO_FROM_SMS;
  const fromWa = process.env.TWILIO_FROM_WHATSAPP;
  const isWa = row.channel === "whatsapp";
  const from = isWa ? fromWa : fromSms;
  if (!from) return { ok: false, error: `Missing ${isWa ? "TWILIO_FROM_WHATSAPP" : "TWILIO_FROM_SMS"} sender` };

  const to = isWa ? `whatsapp:${normalizeE164(row.recipient)}` : normalizeE164(row.recipient);
  const fromFmt = isWa ? (from.startsWith("whatsapp:") ? from : `whatsapp:${from}`) : from;

  try {
    const res = await fetch(`https://connector-gateway.lovable.dev/twilio/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Connection-Api-Key": twilioKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: fromFmt, Body: row.body ?? "" }),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `[${res.status}] ${text.slice(0, 400)}` };
    let sid: string | undefined;
    try { sid = JSON.parse(text)?.sid; } catch { /* ignore */ }
    return { ok: true, messageId: sid };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "twilio dispatch error" };
  }
}

function normalizeE164(v: string): string {
  const s = v.trim();
  if (s.startsWith("+")) return s;
  const digits = s.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`; // default India
  return `+${digits}`;
}
