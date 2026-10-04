import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import { LOCALE_STORAGE_KEY, lookup, readStoredLocale, setCurrentLocale, type Locale } from "./core";
import { I18nContext } from "./context";
import { messages } from "./messages";
import { zodErrorMap } from "./zod-error-map";
import { useAuth } from "@/features/auth/auth-provider";
import { useUpdateProfileMutation } from "@/features/auth/queries";

// One map for every form; it reads the current locale on each validation.
z.setErrorMap(zodErrorMap);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);
  const { session, isLoading } = useAuth();
  const updateProfile = useUpdateProfileMutation();
  const syncedPreference = useRef<string | null>(null);

  // Formatters and validation messages read the module-level locale, so keep it
  // in step before children render with the new value.
  setCurrentLocale(locale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = lookup(messages.common[locale], "metaTitle");
  }, [locale]);

  useEffect(() => {
    const user = session?.user;
    if (isLoading || !user) {
      syncedPreference.current = null;
      return;
    }
    if (user.preferredLanguage) {
      syncedPreference.current = `${user.id}:${user.preferredLanguage}`;
      if (locale !== user.preferredLanguage) {
        try { localStorage.setItem(LOCALE_STORAGE_KEY, user.preferredLanguage); } catch { /* The in-memory preference still applies. */ }
        setLocaleState(user.preferredLanguage);
      }
      return;
    }
    const key = `${user.id}:${locale}`;
    if (syncedPreference.current === key) return;
    syncedPreference.current = key;
    updateProfile.mutate({ preferredLanguage: locale });
  }, [isLoading, locale, session?.user, updateProfile.mutate]);

  const setLocale = useCallback((next: Locale) => {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable (private mode); the choice still applies for this visit.
    }
    setLocaleState(next);
    if (session?.user) {
      syncedPreference.current = `${session.user.id}:${next}`;
      updateProfile.mutate({ preferredLanguage: next });
    }
  }, [session?.user, updateProfile.mutate]);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
