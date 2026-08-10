// Error reporting bridge — forwards errors to Sentry (primary sink) while
// keeping the legacy Lovable reporter as a fallback for environments without
// Sentry configured.
//
// In production with Sentry DSN set, all errors go to Sentry first.
// The Lovable reporter is always called so Lovable's dashboard still shows errors.

type LovableErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type LovableEvents = {
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: LovableErrorOptions,
  ) => void;
};

declare global {
  interface Window {
    __lovableEvents?: LovableEvents;
  }
}

function toSentrySeverity(severity?: string): "fatal" | "error" | "warning" | "info" {
  if (severity === "warning") return "warning";
  if (severity === "info") return "info";
  return "error";
}

export function reportLovableError(error: unknown, context: Record<string, unknown> = {}) {
  // 1. Sentry (primary) — if available
  try {
    // Dynamic import to avoid bundling @sentry/react in non-Sentry builds
    const sentryPromise = import("./sentry").then(({ reportError }) => {
      reportError(error, {
        message: String(context.message ?? context.source ?? "Unknown error"),
        severity: toSentrySeverity(context.severity as string),
        tags: {
          ...(context.tags as Record<string, string>),
          source: String(context.source ?? "unknown"),
          route: String(context.route ?? "unknown"),
        },
        extras: context,
        handled: (context.handled as boolean) ?? false,
      });
    });
    // Don't await — fire-and-forget so we never block the error path
    sentryPromise.catch(() => {
      // Sentry not configured, fall back to Lovable
    });
  } catch {
    // Sentry module not available
  }

  // 2. Lovable reporter (fallback / always-on)
  if (typeof window !== "undefined") {
    window.__lovableEvents?.captureException?.(
      error,
      {
        source: "react_error_boundary",
        route: window.location.pathname,
        ...context,
      },
      {
        mechanism: "react_error_boundary",
        handled: false,
        severity: (context.severity as "error" | "warning" | "info") ?? "error",
      },
    );
  }
}

/**
 * Report a critical backend failure that requires immediate attention.
 * Triggers a Sentry alert even if handled = true.
 */
export function reportCriticalFailure(
  event: string,
  error: unknown,
  metadata: Record<string, unknown> = {},
): void {
  try {
    import("./sentry").then(({ reportError, addBreadcrumb }) => {
      addBreadcrumb("critical", `CRITICAL: ${event}`, {
        level: "fatal",
        data: metadata,
      });
      reportError(error, {
        message: `CRITICAL: ${event}`,
        severity: "fatal",
        tags: {
          mechanism: "critical_alert",
          event,
        },
        extras: metadata,
        fingerprint: [`critical-${event}`],
      });
    });
  } catch {
    console.error(`[CRITICAL] ${event}`, error, metadata);
  }
}
