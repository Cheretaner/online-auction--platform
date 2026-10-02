/**
 * Minimal typed i18n. Every namespace keeps English and Amharic side by side
 * (see ./messages); `defineMessages` makes the compiler reject an Amharic
 * dictionary that is missing a key or has an extra one.
 */
export type Locale = "en" | "am";

export interface LocaleInfo {
  code: Locale;
  label: string;
  short: string;
  intl: string;
}

export const DEFAULT_LOCALE: LocaleInfo = { code: "en", label: "English", short: "EN", intl: "en-GB" };

export const LOCALES: LocaleInfo[] = [DEFAULT_LOCALE, { code: "am", label: "አማርኛ", short: "አማ", intl: "am-ET" }];

export const LOCALE_STORAGE_KEY = "cheretanet.locale";

/** Same shape as T, with every leaf widened to string. */
export type Dictionary<T> = T extends string ? string : { readonly [K in keyof T]: Dictionary<T[K]> };

export function defineMessages<const T>(en: T, am: Dictionary<T>) {
  return { en: en as Dictionary<T>, am };
}

/** Dotted key paths of a dictionary, e.g. "hero.title". */
export type Path<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Path<T[K]>}`;
}[keyof T & string];

export type Vars = Record<string, string | number>;

let currentLocale: Locale = readStoredLocale();

export function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return stored === "am" || stored === "en" ? stored : "en";
  } catch {
    return "en";
  }
}

/** Locale for code that runs outside React (formatters, error explainers). */
export function getLocale(): Locale {
  return currentLocale;
}

export function setCurrentLocale(locale: Locale) {
  currentLocale = locale;
}

export function intlLocale(locale: Locale = currentLocale) {
  return (LOCALES.find((entry) => entry.code === locale) ?? DEFAULT_LOCALE).intl;
}

export function lookup(dictionary: unknown, key: string, vars?: Vars): string {
  const value = key.split(".").reduce<unknown>(
    (node, part) => (node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined),
    dictionary,
  );
  if (typeof value !== "string") return key;
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}
