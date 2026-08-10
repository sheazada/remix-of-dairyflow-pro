// React Error Boundary with Sentry integration.
// Wraps routes to catch rendering errors and report them to Sentry with full context.

import React from "react";
import { reportError, addBreadcrumb, setUserContext } from "@/lib/sentry";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SentryErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  route?: string;
}

interface SentryErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  eventId: string | undefined;
}

export class SentryErrorBoundary extends React.Component<
  SentryErrorBoundaryProps,
  SentryErrorBoundaryState
> {
  constructor(props: SentryErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, eventId: undefined };
  }

  static getDerivedStateFromError(error: Error): SentryErrorBoundaryState {
    return { hasError: true, error, eventId: undefined };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Attach user context from session storage if available
    try {
      const userJson = sessionStorage.getItem("sb-user");
      if (userJson) {
        const user = JSON.parse(userJson);
        setUserContext({
          id: user.id,
          email: user.email,
        });
      }
    } catch {
      // ignore
    }

    const eventId = reportError(error, {
      message: `React error boundary caught error in route: ${this.props.route ?? "unknown"}`,
      severity: "error",
      tags: {
        mechanism: "react_error_boundary",
        component_stack: errorInfo.componentStack ?? "",
        route: this.props.route ?? "unknown",
      },
      extras: {
        route: this.props.route,
        componentStack: errorInfo.componentStack,
      },
      handled: true, // React caught this, so it's "handled" from Sentry's perspective
      fingerprint: [
        "react_error_boundary",
        this.props.route ?? "unknown",
        error.message.slice(0, 50),
      ],
    });

    addBreadcrumb("error", `Error boundary triggered: ${error.message}`, {
      level: "error",
      data: { route: this.props.route },
    });

    this.setState({ eventId });

    // Also log to console for local debugging
    console.error("[ErrorBoundary]", error, errorInfo.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, eventId: undefined });
    // Force a page reload to clear corrupted React state
    window.location.reload();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <DefaultErrorFallback
          error={this.state.error}
          eventId={this.state.eventId}
          onReset={this.handleReset}
        />
      );
    }
    return this.props.children;
  }
}

function DefaultErrorFallback({
  error,
  eventId,
  onReset,
}: {
  error: Error;
  eventId: string | undefined;
  onReset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
        <AlertTriangle className="mx-auto size-10 text-destructive" />
        <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">
          An unexpected error occurred. Our team has been notified.
        </p>
        {eventId && (
          <p className="text-xs font-mono text-muted-foreground">
            Event ID: {eventId.slice(0, 12)}
          </p>
        )}
        {process.env.NODE_ENV !== "production" && (
          <details className="text-left">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              Error details (dev only)
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-background p-2 text-xs">
              {error.message}
              {"\n"}
              {error.stack}
            </pre>
          </details>
        )}
        <Button onClick={onReset} className="gap-2">
          <RefreshCw className="size-4" />
          Try again
        </Button>
      </div>
    </div>
  );
}
