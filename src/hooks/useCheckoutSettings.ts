import { useCallback, useEffect, useState } from "react";

export interface CheckoutSettings {
  primaryColor: string;
  logoUrl: string;
  buttonLabel: string;
  confirmationMessage: string;
  terms: string;
}

const STORAGE_KEY = "kora.checkoutSettings.v1";

const DEFAULTS: CheckoutSettings = {
  primaryColor: "#F81040",
  logoUrl: "",
  buttonLabel: "Finalizar compra",
  confirmationMessage: "Obrigado! Em breve enviaremos os próximos passos por e-mail.",
  terms: "Ao continuar você concorda com nossos termos de serviço.",
};

export function useCheckoutSettings() {
  const [settings, setSettings] = useState<CheckoutSettings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch { /* intentionally empty */ }
    return DEFAULTS;
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* intentionally empty */ }
  }, [settings]);

  const update = useCallback((patch: Partial<CheckoutSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  return { settings, update };
}
