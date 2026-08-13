import { createContext, useContext } from "react";
import type { OnboardingData } from "@/contexts/OnboardingContext";

export interface OnboardingContextValue {
  completed: boolean;
  data: OnboardingData | null;
  saveOnboarding: (data: OnboardingData) => void;
  resetOnboarding: () => void;
}

export const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used inside OnboardingProvider");
  return ctx;
}

export const onboardingDefaults: OnboardingData = {
  ownerName: "",
  studioName: "",
  phone: "",
  website: "",
  area: "",
  services: [],
  country: "Brasil",
  currency: "BRL",
  cityState: "",
  goals: [],
};
