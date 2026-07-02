// Reactive formatting hook (Batch 4b). Binds the central format layer to the
// active workspace locale / currency / time zone from LanguageContext, so every
// value re-renders when the user switches market. Use this inside components;
// outside React, import the bare functions from "@/lib/format" instead.
import { useMemo } from "react";
import { useTranslation } from "@/contexts/LanguageContext";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatDate,
  formatDateTime,
  formatPhone,
  type CurrencyOptions,
  type NumberOptions,
  type DateOptions,
} from "@/lib/format";

type DateInput = Date | string | number | null | undefined;
type Numeric = number | null | undefined;

export function useFormat() {
  const { language, currency, timeZone } = useTranslation();

  return useMemo(() => {
    const defaults = { locale: language, currency, timeZone };
    return {
      locale: language,
      currency,
      timeZone,
      currencyFmt: (value: Numeric, options: CurrencyOptions = {}) =>
        formatCurrency(value, { ...defaults, ...options }),
      number: (value: Numeric, options: NumberOptions = {}) =>
        formatNumber(value, { locale: language, ...options }),
      percent: (value: Numeric, options: NumberOptions & { whole?: boolean } = {}) =>
        formatPercent(value, { locale: language, ...options }),
      date: (value: DateInput, options: DateOptions = {}) =>
        formatDate(value, { ...defaults, ...options }),
      dateTime: (value: DateInput, options: DateOptions = {}) =>
        formatDateTime(value, { ...defaults, ...options }),
      phone: (value: string | null | undefined) => formatPhone(value),
    };
  }, [language, currency, timeZone]);
}
