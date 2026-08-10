// Server-side error reporting (runs in Cloudflare Workers / edge SSR).
// NOTE: @sentry/node must NOT be imported here — it depends on Node-only APIs
// that are unavailable in the Worker runtime and make every SSR request fail
// at module init (blank 500 on the deployed preview).

let serverInitialized = false;

export function initSentryServer(): void {
  if (serverInitialized) return;
  serverInitialized = true;

  const dsn = typeof process !== "undefined" ? process.env.SENTRY_DSN : undefined;
  if (!dsn) {
    console.log("[Sentry] No SENTRY_DSN configured — server error monitoring disabled");
  }
}

/**
 * Wrap an async server function with error capture.
 */
export async function withErrorCapture<T>(
  context: { userId?: string; userEmail?: string },
  functionName: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    try {
      const { reportError, setUserContext } = await import("./sentry");
      if (context.userId) {
        setUserContext({ id: context.userId, email: context.userEmail });
      }
      reportError(error, {
        message: `Error in server function: ${functionName}`,
        severity: "error",
        tags: { mechanism: "server_function", function_name: functionName },
        extras: { userId: context.userId, userEmail: context.userEmail },
      });
    } catch {
      console.error(`[Sentry] Failed to report error in ${functionName}`, error);
    }
    throw error;
  }
}

/**
 * Capture a critical backend failure and trigger an alert.
 */
export function captureCriticalFailure(
  event: string,
  error: unknown,
  metadata: Record<string, unknown> = {},
): void {
  console.error(`CRITICAL FAILURE: ${event}`, error, metadata);
  void import("./sentry")
    .then(({ reportError, addBreadcrumb }) => {
      addBreadcrumb("critical", `CRITICAL: ${event}`, { level: "fatal", data: metadata });
      reportError(error, {
        message: `CRITICAL FAILURE: ${event}`,
        severity: "fatal",
        tags: { mechanism: "critical_alert", event },
        extras: metadata,
        fingerprint: [`critical-${event}`],
      });
    })
    .catch(() => {});
}
