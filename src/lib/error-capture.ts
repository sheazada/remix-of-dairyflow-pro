// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.
// Also forwards errors to Sentry for monitoring.

let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

function record(error: unknown) {
  lastCapturedError = { error, at: Date.now() };

  // Forward to Sentry server-side if available
  if (typeof process !== "undefined" && process.env.SENTRY_DSN) {
    try {
      import("./sentry").then(({ reportError }) => {
        reportError(error, {
          message: "Global captured error (h3 swallow)",
          severity: "error",
          tags: { mechanism: "h3_swallow" },
          handled: false,
        });
      }).catch(() => {
        // Sentry init failed — no-op
      });
    } catch {
      // ignore
    }
  }
}

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => record((event as ErrorEvent).error ?? event));
  globalThis.addEventListener("unhandledrejection", (event) =>
    record((event as PromiseRejectionEvent).reason),
  );
}

export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}
