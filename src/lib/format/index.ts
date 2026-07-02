// Central locale-aware formatting layer (Batch 4b).
//
// Every currency / date / number that reaches the UI should go through here so
// the app can render for ANY market — a user in the US sees "$1,234.50" and
// "07/02/2026", a user in Brazil sees "R$ 1.234,50" and "02/07/2026" — instead
// of the pt-BR/BRL that was hardcoded in ~65 files.
//
// Two ways to use it:
//   • React components → `useFormat()` (reactive to the active workspace locale
//     and currency; see src/hooks/useFormat.ts).
//   • Outside React (repositories, utils, notifications) → the bare functions
//     below, which resolve locale/currency from `resolveFormatSettings()`
//     (localStorage), mirroring how the error layer uses `resolveLang()`.
//
// Defaults are chosen to PRESERVE today's behavior for existing Brazilian
// workspaces: with nothing stored, locale falls back to the active language and
// currency to BRL, so R$ keeps rendering exactly as before until a workspace
// explicitly picks another market.
import { resolveLang, type Lang } from "@/lib/i18n/locale";

export const CURRENCY_STORAGE_KEY = "kora.currency.v1";
export const TIMEZONE_STORAGE_KEY = "kora.timezone.v1";

/** Fallback currency per language when a workspace hasn't chosen one yet. */
export const LANG_CURRENCY: Record<Lang, string> = {
  "pt-BR": "BRL",
  "pt-PT": "EUR",
  en: "USD",
  es: "EUR",
};

export interface FormatSettings {
  /** BCP-47 locale, e.g. "pt-BR", "en-US". */
  locale: string;
  /** ISO 4217 code, e.g. "BRL", "USD", "EUR". */
  currency: string;
  /** IANA time zone, e.g. "America/Sao_Paulo". `undefined` = browser local. */
  timeZone?: string;
}

/**
 * Resolve the active formatting settings for code paths OUTSIDE React context.
 * Reads the same localStorage keys the LanguageProvider writes, so it stays in
 * sync with the UI. Falls back to the active language + its default currency.
 */
export function resolveFormatSettings(): FormatSettings {
  const locale = resolveLang();
  let currency = LANG_CURRENCY[locale] ?? "BRL";
  let timeZone: string | undefined;
  try {
    const c = localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (c) currency = c;
    const tz = localStorage.getItem(TIMEZONE_STORAGE_KEY);
    if (tz) timeZone = tz;
  } catch {
    /* ignore (SSR / storage disabled) */
  }
  return { locale, currency, timeZone };
}

type Numeric = number | null | undefined;
type DateInput = Date | string | number | null | undefined;

function toNumber(value: Numeric): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toDate(value: DateInput): Date | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface CurrencyOptions extends Partial<FormatSettings> {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

/**
 * Format a monetary amount. Drop-in for the old
 * `(v ?? 0).toLocaleString("pt-BR", { style:"currency", currency:"BRL", ... })`.
 * Non-finite input renders as the currency's zero, matching prior behavior.
 */
export function formatCurrency(value: Numeric, options: CurrencyOptions = {}): string {
  const base = resolveFormatSettings();
  const { locale = base.locale, currency = base.currency, minimumFractionDigits, maximumFractionDigits } = options;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(toNumber(value));
}

export interface NumberOptions extends Pick<Partial<FormatSettings>, "locale"> {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

/** Format a plain number in the active locale (thousands separators, etc.). */
export function formatNumber(value: Numeric, options: NumberOptions = {}): string {
  const { locale = resolveFormatSettings().locale, ...rest } = options;
  return new Intl.NumberFormat(locale, rest).format(toNumber(value));
}

/** Format a 0–1 ratio (or a 0–100 value when `whole` is true) as a percentage. */
export function formatPercent(
  value: Numeric,
  options: NumberOptions & { whole?: boolean } = {},
): string {
  const { locale = resolveFormatSettings().locale, whole, minimumFractionDigits, maximumFractionDigits } = options;
  const n = toNumber(value);
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(whole ? n / 100 : n);
}

export interface DateOptions extends Partial<FormatSettings>, Intl.DateTimeFormatOptions {}

const DEFAULT_DATE_OPTS: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" };
const DEFAULT_DATETIME_OPTS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

/** Format a date (locale-aware order: DD/MM vs MM/DD). Invalid input → "". */
export function formatDate(value: DateInput, options: DateOptions = {}): string {
  const d = toDate(value);
  if (!d) return "";
  const base = resolveFormatSettings();
  const { locale = base.locale, currency: _c, timeZone = base.timeZone, ...intlOpts } = options;
  const opts = Object.keys(intlOpts).length ? intlOpts : DEFAULT_DATE_OPTS;
  return new Intl.DateTimeFormat(locale, { ...opts, timeZone }).format(d);
}

/** Format a date + time. Invalid input → "". */
export function formatDateTime(value: DateInput, options: DateOptions = {}): string {
  const d = toDate(value);
  if (!d) return "";
  const base = resolveFormatSettings();
  const { locale = base.locale, currency: _c, timeZone = base.timeZone, ...intlOpts } = options;
  const opts = Object.keys(intlOpts).length ? intlOpts : DEFAULT_DATETIME_OPTS;
  return new Intl.DateTimeFormat(locale, { ...opts, timeZone }).format(d);
}

/**
 * Format a phone number for display. E.164 input (with or without "+") is
 * grouped by the international spacing; anything else is returned as-is. This is
 * intentionally simple — replacing the Brazil-only `formatPhoneBR` without
 * pulling in a heavy dependency. If richer parsing is needed later, swap the
 * body for libphonenumber-js behind this same signature.
 */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D+/g, "");
  if (!digits) return trimmed;
  // Brazilian numbers (DDI 55) keep the familiar +55 (11) 91234-5678 shape.
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    const mid = rest.length === 9 ? `${rest.slice(0, 5)}-${rest.slice(5)}` : `${rest.slice(0, 4)}-${rest.slice(4)}`;
    return `+55 (${ddd}) ${mid}`;
  }
  // Generic international: "+<country> <groups>" — light, locale-neutral.
  return hasPlus ? `+${digits}` : digits;
}
