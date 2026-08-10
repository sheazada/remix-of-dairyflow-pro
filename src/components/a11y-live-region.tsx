// Screen reader live region — announces dynamic changes (toast toasts,
// form errors, route changes) to assistive technology without visual UI.
//
// Usage:
//   import { A11yAnnouncer, announce } from "@/components/a11y-live-region";
//   <A11yAnnouncer />  {/* render once, e.g. in root layout */}
//   announce("Invoice saved successfully");

import { useEffect, useState, createContext, useContext, useCallback } from "react";

type AnnounceOptions = {
  /** "polite" waits for user pause; "assertive" interrupts immediately. */
  priority?: "polite" | "assertive";
  /** How long before the announcement is cleared (ms). Default 5000. */
  ttl?: number;
};

const A11yContext = createContext<{
  announce: (message: string, options?: AnnounceOptions) => void;
} | null>(null);

export function A11yProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"polite" | "assertive">("polite");

  const announce = useCallback(
    (msg: string, options?: AnnounceOptions) => {
      // Clear first so the same message can be re-announced
      setMessage("");
      setPriority(options?.priority ?? "polite");

      // Small delay to ensure the DOM update is detected by the SR
      requestAnimationFrame(() => {
        setMessage(msg);
      });

      // Auto-clear after TTL
      const ttl = options?.ttl ?? 5000;
      setTimeout(() => setMessage(""), ttl);
    },
    [],
  );

  return (
    <A11yContext.Provider value={{ announce }}>
      {children}
      {/* The live region — visually hidden, announced by screen readers */}
      <div
        role="status"
        aria-live={priority}
        aria-atomic="true"
        className="sr-only"
        key={message}
      >
        {message}
      </div>
    </A11yContext.Provider>
  );
}

export function useA11yAnnounce() {
  const ctx = useContext(A11yContext);
  if (!ctx) {
    // Fallback if provider not mounted — just console.log
    return {
      announce: (message: string) => {
        console.log("[a11y]", message);
      },
    };
  }
  return ctx;
}

// Non-React utility: announce to the global live region (if one exists)
// Useful from plain JS callbacks, timers, or third-party code.
export function announceToLiveRegion(message: string): void {
  const region = document.getElementById("a11y-live-region");
  if (region) {
    region.textContent = "";
    requestAnimationFrame(() => {
      region.textContent = message;
    });
  }
}
