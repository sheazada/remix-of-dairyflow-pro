// Shared Sentry helpers — used by both client and server code.
//
// IMPORTANT: this module must NOT statically import any @sentry/* package.
// Doing so pulls the whole SDK into the app entry chunk, where the production
// bundler's circular chunk-init ordering can throw
// `init_multiplexed is not defined` before React ever mounts (blank page).
// Everything here therefore resolves the SDK through a lazy dynamic import
// and degrades to a no-op until it has loaded.

type SentryModule = typeof import("@sentry/core");

let sentryModule: SentryModule | undefined;
let sentryPromise: Promise<SentryModule | undefined> | undefined;

function loadSentry(): Promise<SentryModule | undefined> {
  if (!sentryPromise) {
    sentryPromise = import("@sentry/core")
      .then((mod) => {
        sentryModule = mod;
        return mod;
      })
      .catch(() => undefined);
  }
  return sentryPromise;
}

function withSentry(fn: (sentry: SentryModule) => void): void {
  if (sentryModule) {
    try {
      fn(sentryModule);
    } catch {
      // never let telemetry break the app
    }
    return;
  }
  void loadSentry().then((mod) => {
    if (!mod) return;
    try {
      fn(mod);
    } catch {
      // ignore
    }
  });
}

// Severity levels aligned with Sentry's severity
export type ErrorSeverity = "fatal" | "error" | "warning" | "info" | "debug";

// Which severities trigger a PagerDuty / Slack webhook alert
// (configured in Sentry project → Alerts → Rules)
const CRITICAL_SEVERITIES: ErrorSeverity[] = ["fatal", "error"];

export function isCriticalSeverity(severity: ErrorSeverity): boolean {
  return CRITICAL_SEVERITIES.includes(severity);
}

export function reportError(
  error: unknown,
  context: {
    message?: string;
    severity?: ErrorSeverity;
    tags?: Record<string, string>;
    extras?: Record<string, unknown>;
    handled?: boolean;
    fingerprint?: string[];
  } = {},
): string | undefined {
  let eventId: string | undefined;
  withSentry((Sentry) => {
    eventId = Sentry.captureException(error, {
      level: context.severity ?? "error",
      tags: {
        ...context.tags,
        handled: String(context.handled ?? true),
      },
      extra: {
        ...context.extras,
        message: context.message,
      },
      fingerprint: context.fingerprint,
    });
  });
  return eventId;
}

export function reportMessage(
  message: string,
  options: {
    severity?: ErrorSeverity;
    tags?: Record<string, string>;
    extras?: Record<string, unknown>;
  } = {},
): string | undefined {
  let eventId: string | undefined;
  withSentry((Sentry) => {
    eventId = Sentry.captureMessage(message, {
      level: options.severity ?? "info",
      tags: options.tags,
      extra: options.extras,
    });
  });
  return eventId;
}

export function addBreadcrumb(
  category: string,
  message: string,
  options: {
    level?: "debug" | "info" | "warning" | "error" | "fatal";
    data?: Record<string, unknown>;
  } = {},
): void {
  withSentry((Sentry) => {
    Sentry.addBreadcrumb({
      category,
      message,
      level: options.level ?? "info",
      data: options.data,
      timestamp: Date.now() / 1000,
    });
  });
}

export function setUserContext(user: {
  id?: string;
  email?: string;
  role?: string;
  tenant?: string;
}): void {
  withSentry((Sentry) => {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.role,
    });
    if (user.role) Sentry.setTag("user.role", user.role);
    if (user.tenant) Sentry.setTag("tenant", user.tenant);
  });
}

export function clearUserContext(): void {
  withSentry((Sentry) => {
    Sentry.setUser(null);
    Sentry.setTag("user.role", "");
    Sentry.setTag("tenant", "");
  });
}

export function setRouteContext(route: string): void {
  withSentry((Sentry) => {
    Sentry.setTag("route", route);
  });
  addBreadcrumb("navigation", `Navigated to ${route}`);
}
