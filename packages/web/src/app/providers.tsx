import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, type ReactNode } from "react";
import { ThemeProvider } from "@/theme-provider";
import { I18nProvider } from "@/i18n/i18n-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { PwaUpdater } from "@/components/pwa/pwa-updater";
import { AuthProvider } from "@/features/auth/auth-provider";
import { createQueryClient } from "@/lib/query/client";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <I18nProvider>
      <ThemeProvider defaultTheme="light" storageKey="app-theme">
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delayDuration={200}>
            <AuthProvider>
              {children}
              <Toaster position="top-right" />
              <PwaUpdater />
            </AuthProvider>
          </TooltipProvider>
          {import.meta.env.DEV ? <ReactQueryDevtools buttonPosition="bottom-left" /> : null}
        </QueryClientProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
