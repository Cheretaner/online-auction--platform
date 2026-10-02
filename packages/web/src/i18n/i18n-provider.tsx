import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { z } from "zod";
import { LOCALE_STORAGE_KEY, lookup, readStoredLocale, setCurrentLocale, type Locale } from "./core";
import { I18nContext } from "./context";
import { messages } from "./messages";
import { zodErrorMap } from "./zod-error-map";

// One map for every form; it reads the current locale on each validation.
z.setErrorMap(zodErrorMap);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  // Formatters and validation messages read the module-level locale, so keep it
  // in step before children render with the new value.
  setCurrentLocale(locale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = lookup(messages.common[locale], "metaTitle");
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable (private mode); the choice still applies for this visit.
    }
    setLocaleState(next);
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
