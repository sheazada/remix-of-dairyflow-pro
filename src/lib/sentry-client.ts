// Client-side Sentry initialization (runs only in the browser).
//
// The SDK is loaded with a dynamic import AFTER the app has mounted so that
// @sentry/react never ends up in the entry chunk. Bundling it there caused a
// circular chunk-init crash (`init_multiplexed is not defined`) in the
// production build, which blanked every page.

import { addBreadcrumb } from "./sentry";

let clientInitialized = false;

export function initSentryClient(): void {
  if (clientInitialized) return;
  if (typeof window === "undefined") return;
  clientInitialized = true;

  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.VITE_ENV || "development";

  if (!dsn) return;

  void import("@sentry/react")
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment,
        release: `dairyflow@${import.meta.env.VITE_APP_VERSION || "dev"}`,

        tracesSampleRate: environment === "production" ? 0.1 : 0,
        replaysSessionSampleRate: environment === "production" ? 0.05 : 0,
        replaysOnErrorSampleRate: 1.0,

        ignoreErrors: [
          /ResizeObserver loop limit exceeded/,
          /NetworkError when attempting to fetch resource/,
          /Loading chunk \d+ failed/,
          /Non-Error promise rejection captured/,
        ],

        denyUrls: [
          /chrome-extension:\/\//,
          /moz-extension:\/\//,
          /extensions\//,
          /google-analytics\.com/,
        ],

        sendDefaultPii: false,
        beforeSend(event) {
          if (environment === "development" || environment === "test") return null;
          return event;
        },

        maxBreadcrumbs: 100,
        beforeBreadcrumb(breadcrumb) {
          if (
            breadcrumb.category === "ui.click" &&
            breadcrumb.message?.includes("data-sentry-noop")
          ) {
            return null;
          }
          return breadcrumb;
        },

        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration({
            maskAllText: true,
            maskAllInputs: true,
            blockAllMedia: true,
          }),
        ],
      });

      window.addEventListener("error", (event) => {
        addBreadcrumb("error", `Global error: ${event.message}`, {
          level: "error",
          data: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
          },
        });
      });

      window.addEventListener("unhandledrejection", (event) => {
        const reason =
          event.reason instanceof Error ? event.reason.message : String(event.reason);
        addBreadcrumb("error", `Unhandled rejection: ${reason}`, { level: "error" });
      });
    })
    .catch(() => {
      // Monitoring is optional — never block the app on it.
    });
}
