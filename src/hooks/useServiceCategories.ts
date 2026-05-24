import { useCallback, useEffect, useState } from "react";

export interface ServiceCategory {
  id: string;
  name: string;
  color: string;
  isDemo?: boolean;
}

const STORAGE_KEY = "kora.serviceCategories.v1";

const SEEDS: Omit<ServiceCategory, "isDemo">[] = [
  { id: "cat-branding", name: "Branding", color: "#F81040" },
  { id: "cat-social", name: "Social Media", color: "#8B5CF6" },
  { id: "cat-web", name: "Web Design", color: "#3B82F6" },
  { id: "cat-consult", name: "Consultoria", color: "#10B981" },
  { id: "cat-ads", name: "Tráfego Pago", color: "#F59E0B" },
  { id: "cat-content", name: "Conteúdo", color: "#EC4899" },
  { id: "cat-auto", name: "Automação", color: "#06B6D4" },
];

const initial: ServiceCategory[] = SEEDS.map((c) => ({ ...c, isDemo: true }));

export function useServiceCategories() {
  const [categories, setCategories] = useState<ServiceCategory[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as ServiceCategory[];
    } catch {}
    return initial;
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(categories)); } catch {}
  }, [categories]);

  const addCategory = useCallback((data: Omit<ServiceCategory, "id" | "isDemo">) => {
    setCategories((p) => [{ ...data, id: `cat-${Date.now()}`, isDemo: false }, ...p]);
  }, []);

  const updateCategory = useCallback((id: string, patch: Partial<ServiceCategory>) => {
    setCategories((p) => p.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const removeCategory = useCallback((id: string) => {
    setCategories((p) => p.filter((c) => c.id !== id));
  }, []);

  return { categories, addCategory, updateCategory, removeCategory };
}
