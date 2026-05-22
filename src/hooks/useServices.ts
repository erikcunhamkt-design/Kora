import { useCallback, useEffect, useState } from "react";

export type BillingType = "único" | "mensal" | "recorrente" | "personalizado";

export interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  billingType: BillingType;
  deliveryDays: number;
  active: boolean;
  /** Demo data — does not count toward Free plan limit */
  isDemo?: boolean;
}

const STORAGE_KEY = "orbyt.services.v1";

const rawInitialServices: Omit<Service, "isDemo">[] = [
  { id: "svc-demo-1", name: "Identidade Visual", description: "Logo, paleta, tipografia e mini-guia de marca.", category: "Branding", price: 3500, billingType: "único", deliveryDays: 15, active: true },
  { id: "svc-demo-2", name: "Social Media Mensal", description: "12 posts + 8 stories + planejamento de conteúdo.", category: "Social Media", price: 1800, billingType: "mensal", deliveryDays: 30, active: true },
  { id: "svc-demo-3", name: "Landing Page", description: "Página de conversão com copy, design e implementação.", category: "Web", price: 4200, billingType: "único", deliveryDays: 20, active: true },
  { id: "svc-demo-4", name: "Gestão de Tráfego", description: "Campanhas Meta + Google Ads com relatórios semanais.", category: "Tráfego", price: 1500, billingType: "mensal", deliveryDays: 30, active: true },
  { id: "svc-demo-5", name: "Copywriting", description: "Textos para site, anúncios e e-mails.", category: "Conteúdo", price: 1200, billingType: "personalizado", deliveryDays: 7, active: true },
  { id: "svc-demo-6", name: "Edição de Vídeo", description: "Edição de até 4 vídeos curtos por mês.", category: "Vídeo", price: 2200, billingType: "mensal", deliveryDays: 30, active: true },
  { id: "svc-demo-7", name: "Consultoria Estratégica", description: "Diagnóstico + plano de ação para 90 dias.", category: "Consultoria", price: 2800, billingType: "único", deliveryDays: 10, active: false },
];

export const initialServices: Service[] = rawInitialServices.map((s) => ({ ...s, isDemo: true }));

const SEED_IDS = new Set(rawInitialServices.map((s) => s.id));

function migrate(list: Service[]): Service[] {
  return list.map((s) =>
    s.isDemo === undefined && SEED_IDS.has(s.id) ? { ...s, isDemo: true } : s
  );
}

export function useServices() {
  const [services, setServices] = useState<Service[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return migrate(JSON.parse(raw) as Service[]);
    } catch {}
    return initialServices;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(services));
    } catch {}
  }, [services]);

  const addService = useCallback((data: Omit<Service, "id" | "isDemo">) => {
    setServices((prev) => [
      { ...data, id: `svc-${Date.now()}`, isDemo: false },
      ...prev,
    ]);
  }, []);

  const toggleActive = useCallback((id: string) => {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s)));
  }, []);

  return { services, addService, toggleActive, setServices };
}
