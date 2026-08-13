import { createContext, useContext } from "react";
import type { AccessibilitySettings } from "@/contexts/AccessibilityContext";

export interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSetting: <K extends keyof AccessibilitySettings>(key: K, value: AccessibilitySettings[K]) => void;
  resetSettings: () => void;
  hasCompletedOnboarding: boolean;
  completeOnboarding: () => void;
  isDialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
}

export const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error("useAccessibility must be used within an AccessibilityProvider");
  }
  return context;
};
