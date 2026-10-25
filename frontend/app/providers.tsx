"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { PropsWithChildren, useState } from "react";
import { AuthHydrator } from "@/components/auth/auth-hydrator";
import { scopedQueryKeyHash } from "@/lib/query-scope";

export function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            queryKeyHashFn: scopedQueryKeyHash,
          },
        },
      }),
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <AuthHydrator />
        {children}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
