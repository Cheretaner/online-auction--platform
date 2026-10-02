import { createContext, useCallback, useContext } from "react";
import { getLocale, lookup, type Locale, type Path, type Vars } from "./core";
import { messages, type Namespace } from "./messages";

export const I18nContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void } | null>(null);

export function useLocale() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useLocale must be used inside I18nProvider");
  return context;
}

type Keys<N extends Namespace> = Path<(typeof messages)[N]["en"]>;

/** Translator for one namespace: `const t = useT("home"); t("hero.title")`. */
export function useT<N extends Namespace>(namespace: N) {
  const { locale } = useLocale();
  return useCallback(
    (key: Keys<N>, vars?: Vars) => lookup(messages[namespace][locale], key, vars),
    [locale, namespace],
  );
}

/** Same lookup for code outside components (formatters, error explainers). */
export function translate<N extends Namespace>(namespace: N, key: Keys<N>, vars?: Vars) {
  return lookup(messages[namespace][getLocale()], key, vars);
}

/** Looks up an API value (status, enum, region) and falls back to a readable form of the raw value. */
export function translateValue(namespace: "status" | "enums" | "regions", value: string) {
  const dictionary = messages[namespace][getLocale()] as Record<string, string>;
  return dictionary[value] ?? value.replaceAll("_", " ");
}
