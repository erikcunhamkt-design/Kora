import { useCallback, useEffect, useState } from "react";
import { emitNotification } from "@/lib/notify";

export type IntegrationStatus = "connected" | "disconnected" | "coming_soon";

export interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  status: IntegrationStatus;
  isDemo: boolean;
}

const STORAGE_KEY = "orbyt.integrations.v1";

const seed: Integration[] = [
  { id: "google-calendar", name: "Google Calendar", description: "Sincronize agendamentos e reuniões.", category: "Produtividade", status: "disconnected", isDemo: true },
  { id: "google-drive", name: "Google Drive", description: "Anexe arquivos de projetos diretamente.", category: "Arquivos", status: "disconnected", isDemo: true },
  { id: "whatsapp", name: "WhatsApp Business", description: "Receba e responda mensagens no app.", category: "Comunicação", status: "disconnected", isDemo: true },
  { id: "asaas", name: "Asaas", description: "Cobrança via Pix, boleto e cartão.", category: "Pagamentos", status: "disconnected", isDemo: true },
  { id: "stripe", name: "Stripe", description: "Pagamentos internacionais e assinaturas.", category: "Pagamentos", status: "disconnected", isDemo: true },
  { id: "zapier", name: "Zapier", description: "Conecte com milhares de outros apps.", category: "Automação", status: "coming_soon", isDemo: true },
  { id: "webhooks", name: "Webhooks", description: "Receba eventos do Orbyt em qualquer URL.", category: "Desenvolvedor", status: "disconnected", isDemo: true },
  { id: "meta-ads", name: "Meta Ads", description: "Importe métricas de campanhas do Facebook e Instagram.", category: "Marketing", status: "coming_soon", isDemo: true },
];

export function useIntegrations() {
  const [items, setItems] = useState<Integration[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return seed;
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
  }, [items]);

  const toggleConnection = useCallback((id: string) => {
    setItems((prev) => prev.map((i) => {
      if (i.id !== id || i.status === "coming_soon") return i;
      return { ...i, status: i.status === "connected" ? "disconnected" : "connected" };
    }));
  }, []);

  return { items, toggleConnection };
}
