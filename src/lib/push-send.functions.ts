import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import { withErrorCapture } from "./sentry-server";

const pushPayloadSchema = z.object({
  userId: z.string().uuid(),
  title: z.string(),
  body: z.string(),
  type: z.enum(["order", "delivery", "payment", "low_stock", "expiry", "general"]),
  url: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  tag: z.string().optional(),
});

/**
 * Send a browser push notification to a specific user.
 * Uses web-push library with VAPID keys stored in app_settings.
 */
export const sendPushToUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => pushPayloadSchema.parse(i))
  .handler(async ({ data, context }) => {
    return withErrorCapture({ userId: context.userId }, "sendPushToUser", async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Create notification record
    const { data: notification, error: notifError } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: data.userId,
        type: data.type,
        title: data.title,
        body: data.body,
        data: (data.data ?? {}) as Json,
      })
      .select()
      .single();

    if (notifError) {
      console.error("[Push] Failed to create notification record:", notifError.message);
      return { sent: false, error: notifError.message };
    }

    // 2. Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", data.userId);

    if (subError || !subscriptions || subscriptions.length === 0) {
      console.log("[Push] No push subscriptions found for user:", data.userId);
      return { sent: false, notificationId: notification?.id, error: "No subscriptions" };
    }

    // 3. Get VAPID keys from app_settings
    const { data: publicKeyRow } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "vapid_public_key")
      .single();

    const { data: privateKeyRow } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "vapid_private_key")
      .single();

    if (!publicKeyRow?.value || !privateKeyRow?.value) {
      console.error("[Push] VAPID keys not configured in app_settings");
      return { sent: false, error: "VAPID keys not configured" };
    }

    // 4. Send push to each subscription
    const webpush = await import("web-push");
    webpush.setVapidDetails(
      "mailto:notifications@dairyflow.app",
      publicKeyRow.value,
      privateKeyRow.value,
    );

    const payload = JSON.stringify({
      title: data.title,
      body: data.body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: data.tag ?? notification.id,
      requireInteraction: false,
      data: {
        ...data.data,
        notificationId: notification.id,
        url: data.url ?? "/notifications",
      },
    });

    let sentCount = 0;
    const errors: string[] = [];

    for (const sub of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        await webpush.default.sendNotification(pushSubscription, payload);
        sentCount++;
      } catch (err: any) {
        console.error("[Push] Failed to send to subscription:", sub.id, err.message);

        // If subscription is gone (410), remove it
        if (err.statusCode === 410) {
          await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
          console.log("[Push] Removed expired subscription:", sub.id);
        }

        errors.push(err.message);
      }
    }

    return {
      sent: sentCount > 0,
      sentCount,
      notificationId: notification.id,
      errors: errors.length > 0 ? errors : undefined,
    };
    });
  });

const broadcastPayloadSchema = z.object({
  title: z.string(),
  body: z.string(),
  type: z.enum(["order", "delivery", "payment", "low_stock", "expiry", "general"]),
  url: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Send a browser push notification to all users (admin broadcast).
 */
export const sendPushBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => broadcastPayloadSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Get VAPID keys
    const { data: publicKeyRow } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "vapid_public_key")
      .single();

    const { data: privateKeyRow } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "vapid_private_key")
      .single();

    if (!publicKeyRow?.value || !privateKeyRow?.value) {
      return { sent: false, error: "VAPID keys not configured" };
    }

    // Get all push subscriptions
    const { data: subscriptions, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*");

    if (error || !subscriptions || subscriptions.length === 0) {
      return { sent: false, error: "No subscriptions found" };
    }

    const webpush = await import("web-push");
    webpush.setVapidDetails(
      "mailto:notifications@dairyflow.app",
      publicKeyRow.value,
      privateKeyRow.value,
    );

    const payload = JSON.stringify({
      title: data.title,
      body: data.body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: "broadcast",
      requireInteraction: false,
      data: {
        ...data.data,
        url: data.url ?? "/notifications",
      },
    });

    // Group by user to create one notification record per user
    const userEndpoints = new Map<string, typeof subscriptions>();
    for (const sub of subscriptions) {
      if (!userEndpoints.has(sub.user_id)) {
        userEndpoints.set(sub.user_id, []);
      }
      userEndpoints.get(sub.user_id)!.push(sub);
    }

    let sentCount = 0;
    let failedUsers = 0;

    for (const [userId, userSubs] of userEndpoints) {
      // Create notification record
      await supabaseAdmin.from("notifications").insert({
        user_id: userId,
        type: data.type,
        title: data.title,
        body: data.body,
        data: (data.data ?? {}) as Json,
      });

      // Send push to each subscription
      for (const sub of userSubs) {
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
          if (err.statusCode === 410) {
            await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
          }
          failedUsers++;
        }
      }
    }

    return {
      sent: sentCount > 0,
      sentCount,
      userCount: userEndpoints.size,
      failedUsers,
    };
  });

/**
 * Get unread notification count for the current user.
 */
export const getUnreadNotificationCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    if (!userId) return { count: 0 };

    const { data: result } = await supabaseAdmin.rpc("get_unread_notification_count", {
      _user_id: userId,
    });

    return { count: (result as number) ?? 0 };
  });
