import React, { useState, useEffect } from "react";
import { AccessibilityContext } from "@/contexts/accessibility-context-value";

export interface AccessibilitySettings {
  lowVision: boolean;
  autism: boolean;
  adhd: boolean;
  anxiety: boolean;
  dyslexia: boolean;
  dyscalculia: boolean;
  daltonism: "none" | "deuteranopia" | "protanopia" | "tritanopia";
  motor: boolean;
  bipolar: boolean;
  
  // Advanced V2 Properties
  fontSizeScale: number; // 1.0 (default), 1.15 (medium), 1.30 (high)
  dyslexicFontActive: boolean;
  focusSpotlightActive: boolean;
  bipolarEnergyLevel: "high" | "low";
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
  bipolar: false,
  
  // Advanced V2 Defaults
  fontSizeScale: 1.0,
  dyslexicFontActive: false,
  focusSpotlightActive: false,
  bipolarEnergyLevel: "high",
};

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

  const [isDialogOpen, setDialogOpen] = useState(!hasCompletedOnboarding);

  useEffect(() => {
    try {
      localStorage.setItem("kora.accessibility.settings.v1", JSON.stringify(settings));
    } catch (e) {
      console.error("Failed to save accessibility settings", e);
    }

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
      "acc-bipolar",
      "acc-dyslexic-font",
      "acc-spotlight-active",
      "acc-energy-low",
      "acc-energy-high",
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
    if (settings.bipolar) body.classList.add("acc-bipolar");
    
    if (settings.dyslexicFontActive) body.classList.add("acc-dyslexic-font");
    if (settings.focusSpotlightActive) body.classList.add("acc-spotlight-active");
    if (settings.bipolarEnergyLevel === "low") {
      body.classList.add("acc-energy-low");
    } else {
      body.classList.add("acc-energy-high");
    }

    if (settings.daltonism !== "none") {
      body.classList.add(`acc-daltonism-${settings.daltonism}`);
    }

    // Dynamic data-attribute for root scale factor
    body.setAttribute("data-acc-scale", settings.fontSizeScale.toString());
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
        isDialogOpen,
        setDialogOpen,
      }}
    >
      <svg style={{ display: "none", position: "absolute", width: 0, height: 0 }} aria-hidden="true">
        <defs>
          <filter id="deuteranopia-filter">
            <feColorMatrix type="matrix" values="0.625, 0.375, 0, 0, 0, 0.7, 0.3, 0, 0, 0, 0, 0.3, 0.7, 0, 0, 0, 0, 0, 1, 0" />
          </filter>
          <filter id="protanopia-filter">
            <feColorMatrix type="matrix" values="0.567, 0.433, 0, 0, 0, 0.558, 0.442, 0, 0, 0, 0, 0.242, 0.758, 0, 0, 0, 0, 0, 1, 0" />
          </filter>
          <filter id="tritanopia-filter">
            <feColorMatrix type="matrix" values="0.95, 0.05, 0, 0, 0, 0, 0, 0.433, 0.567, 0, 0, 0, 0.475, 0.525, 0, 0, 0, 0, 0, 1, 0" />
          </filter>
        </defs>
      </svg>
      {children}
    </AccessibilityContext.Provider>
  );
};

