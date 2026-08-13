import { useEffect, useState, ReactNode } from "react";
import { OnboardingContext } from "@/contexts/onboarding-context-value";

export interface OnboardingService {
  name: string;
  price?: string;
}

export interface OnboardingData {
  ownerName: string;
  studioName: string;
  phone: string;
  website: string;
  area: string;
  services: OnboardingService[];
  country: string;
  currency: string;
  cityState: string;
  goals: string[];
}

const STORAGE_KEY = "orbyt.onboarding.v1";
const COMPLETED_KEY = "orbyt.onboarding.completed.v1";

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [completed, setCompleted] = useState<boolean>(() => {
    try { return localStorage.getItem(COMPLETED_KEY) === "1"; } catch { return false; }
  });
  const [data, setData] = useState<OnboardingData | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as OnboardingData) : null;
    } catch { return null; }
  });

  useEffect(() => {
    try {
      if (data) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { /* noop */ }
  }, [data]);

  const saveOnboarding = (next: OnboardingData) => {
    setData(next);
    setCompleted(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      localStorage.setItem(COMPLETED_KEY, "1");
    } catch { /* noop */ }
  };

  const resetOnboarding = () => {
    setCompleted(false);
    setData(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(COMPLETED_KEY);
    } catch { /* noop */ }
  };

  return (
    <OnboardingContext.Provider value={{ completed, data, saveOnboarding, resetOnboarding }}>
      {children}
    </OnboardingContext.Provider>
  );
}
