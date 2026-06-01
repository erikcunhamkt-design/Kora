import React, { createContext, useContext, useState, useEffect } from "react";

export interface AccessibilitySettings {
  lowVision: boolean;
  autism: boolean;
  adhd: boolean;
  anxiety: boolean;
  dyslexia: boolean;
  dyscalculia: boolean;
  daltonism: "none" | "deuteranopia" | "protanopia" | "tritanopia";
  motor: boolean;
}

const DEFAULT_SETTINGS: AccessibilitySettings = {
  lowVision: false,
  autism: false,
  adhd: false,
  anxiety: false,
  dyslexia: false,
  dyscalculia: false,
  daltonism: "none",
  motor: false,
};

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSetting: <K extends keyof AccessibilitySettings>(key: K, value: AccessibilitySettings[K]) => void;
  resetSettings: () => void;
  hasCompletedOnboarding: boolean;
  completeOnboarding: () => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    try {
      const saved = localStorage.getItem("kora.accessibility.settings.v1");
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(() => {
    try {
      return localStorage.getItem("kora.accessibility.onboarding.completed.v1") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("kora.accessibility.settings.v1", JSON.stringify(settings));
    } catch (e) {
      console.error("Failed to save accessibility settings", e);
    }

    // Apply or remove body classes for CSS styling overrides
    const body = document.body;
    
    // Clean up previous accessibility classes
    const classesToRemove = [
      "acc-lowvision",
      "acc-autism",
      "acc-adhd",
      "acc-anxiety",
      "acc-dyslexia",
      "acc-dyscalculia",
      "acc-motor",
      "acc-daltonism-deuteranopia",
      "acc-daltonism-protanopia",
      "acc-daltonism-tritanopia"
    ];
    classesToRemove.forEach(cls => body.classList.remove(cls));

    // Add classes based on active profiles
    if (settings.lowVision) body.classList.add("acc-lowvision");
    if (settings.autism) body.classList.add("acc-autism");
    if (settings.adhd) body.classList.add("acc-adhd");
    if (settings.anxiety) body.classList.add("acc-anxiety");
    if (settings.dyslexia) body.classList.add("acc-dyslexia");
    if (settings.dyscalculia) body.classList.add("acc-dyscalculia");
    if (settings.motor) body.classList.add("acc-motor");
    
    if (settings.daltonism !== "none") {
      body.classList.add(`acc-daltonism-${settings.daltonism}`);
    }
  }, [settings]);

  const updateSetting = <K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K]
  ) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  const completeOnboarding = () => {
    try {
      localStorage.setItem("kora.accessibility.onboarding.completed.v1", "true");
      setHasCompletedOnboarding(true);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <AccessibilityContext.Provider
      value={{
        settings,
        updateSetting,
        resetSettings,
        hasCompletedOnboarding,
        completeOnboarding,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error("useAccessibility must be used within an AccessibilityProvider");
  }
  return context;
};
