import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect, useState, type ReactNode } from "react";
import { ThemeProvider } from "@/theme-provider";
import { I18nProvider } from "@/i18n/i18n-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { PwaUpdater } from "@/components/pwa/pwa-updater";
import { AuthProvider } from "@/features/auth/auth-provider";
import { createQueryClient } from "@/lib/query/client";
import { persistPublicAuctionCache, restorePublicAuctionCache } from "@/lib/query/public-cache";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => {
    const client = createQueryClient();
    restorePublicAuctionCache(client);
    return client;
  });

  useEffect(() => persistPublicAuctionCache(queryClient), [queryClient]);

  return (
    <ThemeProvider defaultTheme="light" storageKey="app-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <I18nProvider>
            <TooltipProvider delayDuration={200}>
              {children}
              <Toaster position="top-right" />
              <PwaUpdater />
            </TooltipProvider>
          </I18nProvider>
          {import.meta.env.DEV ? <ReactQueryDevtools buttonPosition="bottom-left" /> : null}
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
