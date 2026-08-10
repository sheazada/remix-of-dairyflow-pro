// Skip navigation link — first focusable element on every page.
// Lets keyboard and screen-reader users bypass the nav bar and jump to main content.

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const MAIN_CONTENT_ID = "main-content";

export function SkipNav() {
  const anchorRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    // Ensure the main content region exists and is focusable
    const main = document.getElementById(MAIN_CONTENT_ID);
    if (main && !main.hasAttribute("tabindex")) {
      main.setAttribute("tabindex", "-1");
    }
  }, []);

  return (
    <a
      ref={anchorRef}
      href={`#${MAIN_CONTENT_ID}`}
      className={cn(
        "sr-only focus:not-sr-only",
        "fixed top-2 left-2 z-[9999]",
        "rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground",
        "shadow-lg ring-2 ring-ring focus:outline-none",
      )}
    >
      Skip to main content
    </a>
  );
}
