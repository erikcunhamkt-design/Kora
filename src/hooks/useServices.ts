import { useCallback, useEffect, useState } from "react";

export type BillingType = "único" | "mensal" | "recorrente" | "personalizado" | "pacote";

export interface Service {
  id: string;
  name: string;
  description: string;
  /** Legado: nome da categoria como string (mantido para compat) */
  category: string;
  /** Nova referência para categoria do hook useServiceCategories */
  categoryId?: string;
  price: number;
  billingType: BillingType;
  deliveryDays: number;
  active: boolean;
  tags?: string[];
  availableInQuotes?: boolean;
  showInPublicCatalog?: boolean;
  notes?: string;
  /** Demo data — does not count toward Free plan limit */
  isDemo?: boolean;
}

const STORAGE_KEY = "orbyt.services.v1";

const rawInitialServices: Omit<Service, "isDemo">[] = [
  { id: "svc-demo-1", name: "Identidade Visual", description: "Logo, paleta, tipografia e mini-guia de marca.", category: "Branding", categoryId: "cat-branding", price: 3500, billingType: "único", deliveryDays: 15, active: true, availableInQuotes: true },
  { id: "svc-demo-2", name: "Social Media Mensal", description: "12 posts + 8 stories + planejamento de conteúdo.", category: "Social Media", categoryId: "cat-social", price: 1800, billingType: "mensal", deliveryDays: 30, active: true, availableInQuotes: true },
  { id: "svc-demo-3", name: "Landing Page", description: "Página de conversão com copy, design e implementação.", category: "Web Design", categoryId: "cat-web", price: 4200, billingType: "único", deliveryDays: 20, active: true, availableInQuotes: true },
  { id: "svc-demo-4", name: "Gestão de Tráfego", description: "Campanhas Meta + Google Ads com relatórios semanais.", category: "Tráfego Pago", categoryId: "cat-ads", price: 1500, billingType: "mensal", deliveryDays: 30, active: true, availableInQuotes: true },
  { id: "svc-demo-5", name: "Copywriting", description: "Textos para site, anúncios e e-mails.", category: "Conteúdo", categoryId: "cat-content", price: 1200, billingType: "personalizado", deliveryDays: 7, active: true, availableInQuotes: true },
  { id: "svc-demo-6", name: "Edição de Vídeo", description: "Edição de até 4 vídeos curtos por mês.", category: "Conteúdo", categoryId: "cat-content", price: 2200, billingType: "mensal", deliveryDays: 30, active: true, availableInQuotes: true },
  { id: "svc-demo-7", name: "Consultoria Estratégica", description: "Diagnóstico + plano de ação para 90 dias.", category: "Consultoria", categoryId: "cat-consult", price: 2800, billingType: "único", deliveryDays: 10, active: false, availableInQuotes: true },
];

export const initialServices: Service[] = rawInitialServices.map((s) => ({ ...s, isDemo: true }));

const SEED_IDS = new Set(rawInitialServices.map((s) => s.id));

function migrate(list: Service[]): Service[] {
  return list.map((s) => ({
    ...s,
    isDemo: s.isDemo === undefined && SEED_IDS.has(s.id) ? true : s.isDemo,
    availableInQuotes: s.availableInQuotes ?? true,
  }));
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
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(services)); } catch {}
  }, [services]);

  const addService = useCallback((data: Omit<Service, "id" | "isDemo">) => {
    setServices((prev) => [
      { ...data, id: `svc-${Date.now()}`, isDemo: false },
      ...prev,
    ]);
  }, []);

  const updateService = useCallback((id: string, patch: Partial<Service>) => {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const duplicateService = useCallback((id: string) => {
    setServices((prev) => {
      const src = prev.find((s) => s.id === id);
      if (!src) return prev;
      return [
        { ...src, id: `svc-${Date.now()}`, name: `${src.name} (cópia)`, isDemo: false },
        ...prev,
      ];
    });
  }, []);

  const toggleActive = useCallback((id: string) => {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s)));
  }, []);

  const removeService = useCallback((id: string) => {
    setServices((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { services, addService, updateService, duplicateService, toggleActive, removeService, setServices };
}
