// Shared locale resolver for code paths that run OUTSIDE React context
// (repositories, the error-normalization layer, the root error fallback) and
// therefore can't use the LanguageContext `useTranslation` hook. Reads the same
// localStorage key the LanguageProvider persists to, so it stays in sync.

export type Lang = "pt-BR" | "pt-PT" | "en" | "es";

export const DEFAULT_LANG: Lang = "pt-BR";

export const LANGUAGE_STORAGE_KEY = "kora.language.v1";

export function resolveLang(): Lang {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === "pt-BR" || saved === "pt-PT" || saved === "en" || saved === "es") {
      return saved;
    }
  } catch {
    /* ignore (SSR / storage disabled) */
  }
  return DEFAULT_LANG;
}

/** Pick the string for the active locale, falling back to pt-BR then any value. */
export function pickLocale(map: Partial<Record<Lang, string>>): string {
  const lang = resolveLang();
  return map[lang] ?? map[DEFAULT_LANG] ?? Object.values(map)[0] ?? "";
}
