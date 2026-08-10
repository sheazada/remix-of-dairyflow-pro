import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Report an error from the client to the server for Sentry capture.
 * Use when the client catches an error that the server should know about
 * (e.g., API failure, data inconsistency detected client-side).
 */
export const reportClientError = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        message: z.string(),
        name: z.string().optional(),
        stack: z.string().optional(),
        url: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
        severity: z.enum(["fatal", "error", "warning", "info"]).default("error"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { reportError, setUserContext, addBreadcrumb } = await import("@/lib/sentry");

    // Attach user context from the authenticated session
    setUserContext({
      id: context.userId,
    });

    addBreadcrumb("client_report", data.message, {
      level: data.severity === "fatal" ? "fatal" : data.severity === "warning" ? "warning" : "error",
      data: { url: data.url },
    });

    // Reconstruct a proper Error object for better stack traces
    const error = new Error(data.message);
    if (data.name) error.name = data.name;
    if (data.stack) error.stack = data.stack;

    const eventId = reportError(error, {
      severity: data.severity,
      tags: {
        mechanism: "client_report",
        url: data.url ?? "unknown",
      },
      extras: data.metadata,
      fingerprint: ["client_report", data.message.slice(0, 50)],
    });

    return { ok: true, eventId };
  });

/**
 * Manually trigger a critical alert from the admin UI.
 * Used for testing alert routing or reporting data-quality issues.
 */
export const triggerCriticalAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        event: z.string(),
        message: z.string(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { captureCriticalFailure } = await import("@/lib/sentry-server");

    const error = new Error(`Admin-triggered critical alert: ${data.message}`);
    const eventId = captureCriticalFailure(data.event, error, {
      ...data.metadata,
      triggeredBy: context.userId,
    });

    return { ok: true, eventId };
  });
