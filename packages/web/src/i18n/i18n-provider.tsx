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
  const { session, isLoading } = useAuth();
  const { mutate: updateProfile } = useUpdateProfileMutation();
  const [storedLocale, setStoredLocale] = useState<Locale>(readStoredLocale);
  const [userSelection, setUserSelection] = useState<{ userId: string; locale: Locale } | null>(null);
  const syncedPreference = useRef<string | null>(null);
  const user = session?.user;
  const locale =
    userSelection?.userId === user?.id
      ? userSelection?.locale ?? storedLocale
      : user?.preferredLanguage ?? storedLocale;

  // Formatters and validation messages read the module-level locale, so keep it
  // in step before children render with the new value.
  setCurrentLocale(locale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = lookup(messages.common[locale], "metaTitle");
  }, [locale]);

  useEffect(() => {
    if (isLoading || !user) {
      syncedPreference.current = null;
      return;
    }
    if (user.preferredLanguage) {
      syncedPreference.current = `${user.id}:${user.preferredLanguage}`;
      try {
        localStorage.setItem(LOCALE_STORAGE_KEY, user.preferredLanguage);
      } catch {
        // The profile preference still applies for this session.
      }
      return;
    }
    const key = `${user.id}:${locale}`;
    if (syncedPreference.current === key) return;
    syncedPreference.current = key;
    updateProfile({ preferredLanguage: locale });
  }, [isLoading, locale, user, updateProfile]);

  const setLocale = useCallback((next: Locale) => {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable (private mode); the choice still applies for this visit.
    }
    setStoredLocale(next);
    if (user) {
      setUserSelection({ userId: user.id, locale: next });
      syncedPreference.current = `${user.id}:${next}`;
      updateProfile({ preferredLanguage: next });
    }
  }, [user, updateProfile]);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
