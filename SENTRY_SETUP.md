# Sentry Error Monitoring Setup

## Overview

DairyFlow Pro uses Sentry for centralized error monitoring across both frontend and backend.

### What's monitored

| Layer | What | How |
|-------|------|-----|
| **Frontend** | React render errors, unhandled promises, global JS errors | `SentryErrorBoundary` + global handlers |
| **Backend** | Server function failures, SSR errors, unhandled rejections | `withErrorCapture` + `initSentryServer` |
| **User context** | Auth state changes auto-attach user ID, email, role | `setUserContext` on auth state change |
| **Navigation** | Route changes tracked as breadcrumbs | `setRouteContext` |
| **Session replay** | Recording of user sessions when errors occur (prod only) | `Sentry.replayIntegration` |

### Severity levels & alert routing

| Severity | Sentry UI | Alerts |
|----------|-----------|--------|
| `fatal` | Red | ⚠️ **Triggers alert** (PagerDuty/Slack) |
| `error` | Red | ⚠️ **Triggers alert** |
| `warning` | Orange | No auto-alert |
| `info` | Blue | No auto-alert |
| `debug` | Grey | No auto-alert |

## Setup

### 1. Create a Sentry project

1. Go to [sentry.io](https://sentry.io) and create a new project
2. Choose **React** as the platform
3. Copy the **DSN** (looks like `https://abc123@o123.ingest.sentry.io/4567890`)

### 2. Configure environment variables

**In Lovable** (project → Settings → Environment Variables):
- `VITE_SENTRY_DSN` — Client-side DSN
- `SENTRY_DSN` — Server-side DSN (same value is fine)
- `VITE_ENV` — `development`, `staging`, or `production`

**Locally** (`.env`):
```bash
VITE_SENTRY_DSN=https://abc123@o123.ingest.sentry.io/4567890
SENTRY_DSN=https://abc123@o123.ingest.sentry.io/4567890
VITE_ENV=development
```

### 3. Configure alerts in Sentry

1. Go to **Project → Alerts → Create Rule**
2. Condition: `Issue priority is fatal or error`
3. Action: Send to Slack channel or PagerDuty
4. Filters: `environment = production` (don't alert on dev)

## Usage

### From frontend components

```tsx
import { reportError, addBreadcrumb } from "@/lib/sentry";

try {
  await riskyOperation();
} catch (error) {
  reportError(error, {
    severity: "error",
    tags: { feature: "invoices" },
    extras: { invoiceId },
  });
}

// Breadcrumbs (for context, not alerts)
addBreadcrumb("api", "Called /api/invoices", {
  level: "info",
  data: { method: "POST", status: 201 },
});
```

### From server functions

```typescript
import { withErrorCapture, captureCriticalFailure } from "@/lib/sentry-server";

export const myFunction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    return withErrorCapture({ userId: context.userId }, "myFunction", async () => {
      // Your logic here — errors auto-captured
      await doStuff();
      return { ok: true };
    });
  });

// Critical failures (always alerts)
if (paymentFailed) {
  captureCriticalFailure("payment_failed", error, {
    amount, invoiceId, userId,
  });
}
```

### React Error Boundary (already wired)

The root layout wraps everything in `SentryErrorBoundary`. Any uncaught React render error is:
1. Caught and displayed as a user-friendly error screen
2. Sent to Sentry with component stack trace
3. Fingerprinted so duplicate errors group together

## Architecture

```
┌─────────────────────┐     ┌──────────────────────────┐
│   Browser (Client)  │     │   Server (Cloudflare)    │
│                     │     │                          │
│  SentryErrorBoundary│     │  initSentryServer()      │
│  ↓                  │     │  ↓                       │
│  reportError()      │     │  withErrorCapture()      │
│  ↓                  │     │  ↓                       │
│  @sentry/react      │     │  @sentry/node            │
│                     │     │                          │
│  + global handlers  │     │  + unhandledRejection    │
│  + auth user ctx    │     │  + uncaughtException     │
└──────────┬──────────┘     └────────────┬─────────────┘
           │                             │
           └──────────┬──────────────────┘
                      ▼
                ┌─────────────┐
                │   Sentry    │
                │  (cloud)    │
                └─────────────┘
                      │
                      ▼
              ┌───────────────┐
              │ Slack/PagerDuty│
              │ (alerts)      │
              └───────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `src/lib/sentry.ts` | Shared severity helpers, report API, user context |
| `src/lib/sentry-client.ts` | Browser init, global handlers, replay |
| `src/lib/sentry-server.ts` | Server init, `withErrorCapture`, critical alerts |
| `src/lib/sentry.functions.ts` | Client → server error reporting bridge |
| `src/components/sentry-error-boundary.tsx` | React Error Boundary with Sentry |
| `src/lib/lovable-error-reporting.ts` | Bridge: Lovable + Sentry (defense in depth) |
| `src/lib/error-capture.ts` | SSR h3-swallow recovery → Sentry |

## Testing

```bash
# Trigger a test error from browser console (after logging in):
import { reportError } from "@/lib/sentry";
reportError(new Error("Test error"), { severity: "error" });

# Trigger from server (use "Send Test Push" button — errors appear in Sentry)
```

## Cost notes

- Sentry free tier: **5,000 errors/month**, 1 replay session/week
- Replay sampling: 5% of sessions, 100% on error (configurable)
- Tracing: 10% in production (reduce if over quota)

## Disabling Sentry

Remove the DSN environment variables. The code gracefully degrades — errors still go to the Lovable reporter and console, just not to Sentry.
