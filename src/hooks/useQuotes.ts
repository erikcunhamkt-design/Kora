import { useCallback, useEffect, useState } from "react";
import { emitNotification } from "@/lib/notify";

export type QuoteStatus = "rascunho" | "enviado" | "aprovado" | "recusado";

export interface QuoteItem {
  id: string;
  serviceId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface Quote {
  id: string;
  clientName: string;
  clientEmail: string;
  clientWhatsapp: string;
  title: string;
  description: string;
  items: QuoteItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentCondition: string;
  deliveryDeadline: string;
  validityDays: number;
  status: QuoteStatus;
  createdAt: string;
  /** Demo data — does not count toward Free plan limit */
  isDemo?: boolean;
}

const STORAGE_KEY = "orbyt.quotes.v1";

function makeQuote(partial: Omit<Quote, "subtotal" | "total" | "isDemo">): Omit<Quote, "isDemo"> {
  const subtotal = partial.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const total = Math.max(subtotal - partial.discount, 0);
  return { ...partial, subtotal, total };
}

const rawInitialQuotes: Omit<Quote, "isDemo">[] = [
  makeQuote({
    id: "qt-demo-1",
    clientName: "Marina Costa",
    clientEmail: "marina@acme.com",
    clientWhatsapp: "(11) 99812-3456",
    title: "Rebranding Acme 2025",
    description: "Reformulação completa da identidade visual com nova paleta e guidelines.",
    items: [
      { id: "i1", name: "Identidade Visual", quantity: 1, unitPrice: 3500 },
      { id: "i2", name: "Manual de Marca", quantity: 1, unitPrice: 1800 },
    ],
    discount: 300,
    paymentCondition: "50% entrada + 50% na entrega",
    deliveryDeadline: "30 dias",
    validityDays: 15,
    status: "enviado",
    createdAt: "2025-04-10",
  }),
  makeQuote({
    id: "qt-demo-2",
    clientName: "Rafael Mendes",
    clientEmail: "rafael@studiozen.com",
    clientWhatsapp: "(21) 98765-4321",
    title: "Landing Page Studio Zen",
    description: "Página de conversão com integração de formulário.",
    items: [{ id: "i1", name: "Landing Page", quantity: 1, unitPrice: 4200 }],
    discount: 0,
    paymentCondition: "À vista no Pix",
    deliveryDeadline: "20 dias",
    validityDays: 10,
    status: "aprovado",
    createdAt: "2025-04-06",
  }),
  makeQuote({
    id: "qt-demo-3",
    clientName: "Camila Andrade",
    clientEmail: "camila@novadesign.com",
    clientWhatsapp: "(31) 97654-3210",
    title: "Catálogo Digital Nova",
    description: "Catálogo digital interativo para distribuição B2B.",
    items: [
      { id: "i1", name: "Design de catálogo (30 páginas)", quantity: 1, unitPrice: 3200 },
      { id: "i2", name: "Diagramação extra", quantity: 2, unitPrice: 350 },
    ],
    discount: 0,
    paymentCondition: "3x sem juros no boleto",
    deliveryDeadline: "25 dias",
    validityDays: 15,
    status: "rascunho",
    createdAt: "2025-04-08",
  }),
];

export const initialQuotes: Quote[] = rawInitialQuotes.map((q) => ({ ...q, isDemo: true }));

const SEED_IDS = new Set(rawInitialQuotes.map((q) => q.id));

function migrate(list: Quote[]): Quote[] {
  return list.map((q) =>
    q.isDemo === undefined && SEED_IDS.has(q.id) ? { ...q, isDemo: true } : q
  );
}

export function useQuotes() {
  const [quotes, setQuotes] = useState<Quote[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return migrate(JSON.parse(raw) as Quote[]);
    } catch {}
    return initialQuotes;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
    } catch {}
  }, [quotes]);

  const addQuote = useCallback(
    (data: Omit<Quote, "id" | "createdAt" | "subtotal" | "total" | "isDemo">) => {
      const subtotal = data.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      const total = Math.max(subtotal - data.discount, 0);
      const quote: Quote = {
        ...data,
        id: `qt-${Date.now()}`,
        createdAt: new Date().toISOString().slice(0, 10),
        subtotal,
        total,
        isDemo: false,
      };
      setQuotes((prev) => [quote, ...prev]);
      return quote;
    },
    []
  );

  const updateStatus = useCallback((id: string, status: QuoteStatus) => {
    setQuotes((prev) => {
      const quote = prev.find((q) => q.id === id);
      if (quote && quote.status !== "aprovado" && status === "aprovado") {
        emitNotification({
          title: "Proposta aprovada",
          description: quote.title,
          category: "commercial",
          type: "success",
          priority: "high",
          actionLabel: "Ver vendas",
          actionRoute: "/vendas",
          sourceId: quote.id,
          sourceType: "quote",
        });
      }
      return prev.map((q) => (q.id === id ? { ...q, status } : q));
    });
  }, []);

  const duplicateQuote = useCallback((id: string) => {
    setQuotes((prev) => {
      const original = prev.find((q) => q.id === id);
      if (!original) return prev;
      const copy: Quote = {
        ...original,
        id: `qt-${Date.now()}`,
        title: `${original.title} (cópia)`,
        status: "rascunho",
        createdAt: new Date().toISOString().slice(0, 10),
        isDemo: false,
      };
      return [copy, ...prev];
    });
  }, []);

  return { quotes, addQuote, updateStatus, duplicateQuote, setQuotes };
}
