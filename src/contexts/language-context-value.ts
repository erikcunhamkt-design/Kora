import { createContext, useContext } from "react";
import type { Language } from "@/contexts/LanguageContext";

export interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  /** Active ISO 4217 currency for money formatting (workspace-level). */
  currency: string;
  setCurrency: (currency: string) => void;
  /** Active IANA time zone, or undefined = browser local. */
  timeZone: string | undefined;
  setTimeZone: (timeZone: string | undefined) => void;
  t: (key: string, defaultValue?: string) => string;
}

export const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  return context;
};
