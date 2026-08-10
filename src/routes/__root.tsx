import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { SentryErrorBoundary } from "@/components/sentry-error-boundary";
import { initSentryClient } from "@/lib/sentry-client";
import { ThemeProvider } from "@/lib/theme";
import { SkipNav } from "@/components/skip-nav";
import { A11yProvider } from "@/components/a11y-live-region";

// Initialize Sentry client as early as possible
initSentryClient();

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">Please try again.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "DairyFlow Pro — Distribution ERP" },
      {
        name: "description",
        content:
          "Modern ERP for dairy distributors — customers, inventory, GST invoicing, payments, deliveries and reports.",
      },
      { property: "og:title", content: "DairyFlow Pro — Distribution ERP" },
      {
        property: "og:description",
        content: "Modern ERP for dairy distributors — customers, inventory, GST invoicing, payments, deliveries and reports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "DairyFlow Pro — Distribution ERP" },
      { name: "twitter:description", content: "Modern ERP for dairy distributors — customers, inventory, GST invoicing, payments, deliveries and reports." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/020ad1fb-b87f-4f9f-975a-691f7d0ad2a8" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/020ad1fb-b87f-4f9f-975a-691f7d0ad2a8" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap",
      },
    ],
    scripts: [
      {
        // Inline blocking script: apply <html class="dark"> BEFORE any paint
        // to prevent flash of wrong theme on refresh.
        type: "text/javascript",
        innerHTML: `
          (function() {
            var STORAGE_KEY = "dairyflow-theme";
            var stored = localStorage.getItem(STORAGE_KEY);
            var theme = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
            var resolved = theme === "system"
              ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
              : theme;
            if (resolved === "dark") document.documentElement.classList.add("dark");
            else document.documentElement.classList.remove("dark");
          })();
        `,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    // Lazy-import setUserContext / clearUserContext to avoid Sentry import in non-Sentry builds
    const sentryPromise = import("@/lib/sentry").catch(() => ({ setUserContext: () => {}, clearUserContext: () => {} }));

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();

      // Update Sentry user context on auth state change
      const { setUserContext, clearUserContext } = await sentryPromise;
      if (event === "SIGNED_OUT") {
        clearUserContext();
      } else if (session?.user) {
        // Resolve role
        let role = "unknown";
        try {
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id);
          role = (roles?.[0]?.role as string) ?? "unknown";
        } catch {
          // ignore
        }
        setUserContext({
          id: session.user.id,
          email: session.user.email,
          role,
        });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <ThemeProvider defaultTheme="system" storageKey="dairyflow-theme">
      <SkipNav />
      <A11yProvider>
        <QueryClientProvider client={queryClient}>
          <SentryErrorBoundary route="root">
            <Outlet />
          </SentryErrorBoundary>
          <Toaster position="top-right" richColors />
        </QueryClientProvider>
      </A11yProvider>
    </ThemeProvider>
  );
}
