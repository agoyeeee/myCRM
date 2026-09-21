"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { loadTokens, setUnauthorizedHandler, hasTokens } from "@/lib/api";

// Full page reload on 401 — clears all client state (query cache, forms).
// ponytail: swap to router.replace once api.ts exposes a router-aware handler.
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );

  useEffect(() => {
    if (!hasTokens()) loadTokens();
    setUnauthorizedHandler(() => {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- deliberate hard reset
      window.location.assign("/login");
    });
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
