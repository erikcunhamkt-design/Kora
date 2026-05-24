import { useCallback, useEffect, useState } from "react";

export type BillingCycle = "one_time" | "monthly" | "quarterly" | "yearly";
export type PlanStatus = "active" | "inactive";

export interface PlanItem {
  refId: string;
  kind: "service" | "product";
  name: string;
}

export interface CommercialPlan {
  id: string;
  name: string;
  description: string;
  billingCycle: BillingCycle;
  price: number;
  items: PlanItem[];
  highlight: boolean;
  status: PlanStatus;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "kora.commercialPlans.v1";
const now = () => new Date().toISOString();

const SEEDS: CommercialPlan[] = [
  {
    id: "plan-demo-1",
    name: "Essencial",
    description: "Para freelancers começando a estruturar o estúdio.",
    billingCycle: "monthly",
    price: 1800,
    items: [
      { refId: "svc-demo-2", kind: "service", name: "Social Media Mensal" },
    ],
    highlight: false,
    status: "active",
    isDemo: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "plan-demo-2",
    name: "Studio Pro",
    description: "Combo completo para estúdios com clientes recorrentes.",
    billingCycle: "monthly",
    price: 3800,
    items: [
      { refId: "svc-demo-2", kind: "service", name: "Social Media Mensal" },
      { refId: "svc-demo-4", kind: "service", name: "Gestão de Tráfego" },
      { refId: "svc-demo-5", kind: "service", name: "Copywriting" },
    ],
    highlight: true,
    status: "active",
    isDemo: true,
    createdAt: now(),
    updatedAt: now(),
  },
];

export function useCommercialPlans() {
  const [plans, setPlans] = useState<CommercialPlan[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as CommercialPlan[];
    } catch {}
    return SEEDS;
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(plans)); } catch {}
  }, [plans]);

  const addPlan = useCallback(
    (data: Omit<CommercialPlan, "id" | "isDemo" | "createdAt" | "updatedAt">) => {
      setPlans((p) => [
        { ...data, id: `plan-${Date.now()}`, isDemo: false, createdAt: now(), updatedAt: now() },
        ...p,
      ]);
    },
    []
  );

  const updatePlan = useCallback((id: string, patch: Partial<CommercialPlan>) => {
    setPlans((p) => p.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: now() } : x)));
  }, []);

  const removePlan = useCallback((id: string) => {
    setPlans((p) => p.filter((x) => x.id !== id));
  }, []);

  const duplicatePlan = useCallback((id: string) => {
    setPlans((p) => {
      const src = p.find((x) => x.id === id);
      if (!src) return p;
      return [
        { ...src, id: `plan-${Date.now()}`, name: `${src.name} (cópia)`, isDemo: false, createdAt: now(), updatedAt: now() },
        ...p,
      ];
    });
  }, []);

  return { plans, addPlan, updatePlan, removePlan, duplicatePlan };
}
