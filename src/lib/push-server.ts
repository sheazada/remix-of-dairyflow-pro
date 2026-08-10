/**
 * Server-side push notification sender.
 * 
 * This module is imported by other server functions (order creation, delivery
 * updates, etc.) to send browser push notifications to users.
 * 
 * Usage from a server function:
 *   import { sendPushNotification } from "@/lib/push-server";
 *   await sendPushNotification(supabaseAdmin, { userId, title: "New order", body: "...", type: "order" });
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

export type NotificationType = "order" | "delivery" | "payment" | "low_stock" | "expiry" | "general";

export interface SendPushOptions {
  userId: string;
  title: string;
  body: string;
  type?: NotificationType;
  url?: string;
  data?: Record<string, unknown>;
  tag?: string;
  /** If true, skip creating the notification DB record (e.g. if caller already inserted it) */
  skipDbRecord?: boolean;
}

/**
 * Send a push notification to a user.
 * Creates a notification record in the DB, then sends browser push to all
 * of the user's subscriptions.
 */
export async function sendPushNotification(
  supabaseAdmin: SupabaseClient<Database>,
  opts: SendPushOptions,
): Promise<{ notificationId?: string; sentCount: number }> {
  let notificationId: string | undefined;

  // 1. Create notification record
  if (!opts.skipDbRecord) {
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: opts.userId,
        type: opts.type ?? "general",
        title: opts.title,
        body: opts.body,
        data: (opts.data ?? {}) as Json,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[push-server] Failed to insert notification:", error.message);
    } else {
      notificationId = data.id;
    }
  }

  // 2. Get user's push subscriptions
  const { data: subscriptions } = await supabaseAdmin
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", opts.userId);

  if (!subscriptions || subscriptions.length === 0) {
    return { notificationId, sentCount: 0 };
  }

  // 3. Get VAPID keys
  const { data: pubKey } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "vapid_public_key")
    .maybeSingle();

  const { data: privKey } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "vapid_private_key")
    .maybeSingle();

  if (!pubKey?.value || !privKey?.value) {
    console.warn("[push-server] VAPID keys not configured — skipping push send");
    return { notificationId, sentCount: 0 };
  }

  // 4. Configure web-push
  const webpush = await import("web-push");
  webpush.setVapidDetails(
    "mailto:notifications@dairyflow.app",
    pubKey.value,
    privKey.value,
  );

  const payload = JSON.stringify({
    title: opts.title,
    body: opts.body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: opts.tag ?? notificationId ?? "default",
    requireInteraction: false,
    data: {
      ...opts.data,
      notificationId,
      url: opts.url ?? "/notifications",
    },
  });

  // 5. Send to all subscriptions
  let sentCount = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.default.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
      );
      sentCount++;
    } catch (err: any) {
      // Remove expired subscriptions (410 Gone)
      if (err.statusCode === 410) {
        await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
      } else {
        console.warn("[push-server] Push send failed for sub", sub.id, ":", err.message);
      }
    }
  }

  return { notificationId, sentCount };
}

/**
 * Send push notification to multiple users (e.g. all admins).
 */
export async function sendPushToUsers(
  supabaseAdmin: SupabaseClient<Database>,
  userIds: string[],
  opts: Omit<SendPushOptions, "userId">,
): Promise<{ totalSent: number }> {
  let totalSent = 0;
  for (const userId of userIds) {
    const result = await sendPushNotification(supabaseAdmin, { ...opts, userId });
    totalSent += result.sentCount;
  }
  return { totalSent };
}
