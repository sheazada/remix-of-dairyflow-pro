import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Don't refetch on every window focus (noisy for data-heavy ERP)
        refetchOnWindowFocus: false,
        // Don't refetch on reconnect (avoids duplicate fetches on flaky networks)
        refetchOnReconnect: false,
        // Retry transient errors up to 2 times with exponential backoff
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        // Stale after 60s — balances freshness vs network usage
        staleTime: 60_000,
        // Keep unused queries in cache for 5 minutes (quick back-navigation)
        gcTime: 5 * 60_000,
      },
      mutations: {
        // Mutations retry once on network errors
        retry: 1,
        retryDelay: 1000,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Preload route code on link hover (default 50ms — fast enough)
    defaultPreloadStaleTime: 0,
    // Enable link-hover prefetching for route code (JS chunks)
    defaultPreload: "intent",
  });

  return router;
};
