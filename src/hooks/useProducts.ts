import { useCallback, useEffect, useState } from "react";

export type ProductType = "digital" | "physical" | "addon" | "template" | "consulting";
export type ProductStatus = "active" | "inactive";

export interface Product {
  id: string;
  name: string;
  description: string;
  categoryId?: string;
  price: number;
  cost?: number;
  stock?: number;
  type: ProductType;
  status: ProductStatus;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "kora.products.v1";

const now = () => new Date().toISOString();

const SEEDS: Product[] = [
  {
    id: "prod-demo-1",
    name: "Template Notion — Estúdio",
    description: "Workspace pronto para gerenciar projetos de design.",
    categoryId: "cat-content",
    price: 97,
    cost: 0,
    type: "template",
    status: "active",
    isDemo: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "prod-demo-2",
    name: "Pack de Mockups Premium",
    description: "30 mockups editáveis para apresentação de marca.",
    categoryId: "cat-branding",
    price: 149,
    cost: 0,
    type: "digital",
    status: "active",
    isDemo: true,
    createdAt: now(),
    updatedAt: now(),
  },
];

export function useProducts() {
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as Product[];
    } catch { /* intentionally empty */ }
    return SEEDS;
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(products)); } catch { /* intentionally empty */ }
  }, [products]);

  const addProduct = useCallback(
    (data: Omit<Product, "id" | "isDemo" | "createdAt" | "updatedAt">) => {
      setProducts((p) => [
        { ...data, id: `prod-${Date.now()}`, isDemo: false, createdAt: now(), updatedAt: now() },
        ...p,
      ]);
    },
    []
  );

  const updateProduct = useCallback((id: string, patch: Partial<Product>) => {
    setProducts((p) => p.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: now() } : x)));
  }, []);

  const removeProduct = useCallback((id: string) => {
    setProducts((p) => p.filter((x) => x.id !== id));
  }, []);

  return { products, addProduct, updateProduct, removeProduct };
}
