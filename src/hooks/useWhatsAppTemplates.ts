import { useCallback, useEffect, useState } from "react";

export type WhatsAppTemplateCategory = "marketing" | "utility" | "authentication" | "service";
export type WhatsAppTemplateStatus = "draft" | "submitted" | "approved" | "rejected" | "paused";

export interface WhatsAppTemplate {
  id: string;
  name: string;
  category: WhatsAppTemplateCategory;
  status: WhatsAppTemplateStatus;
  language: string;
  body: string;
  variables: string[];
  cta?: { label: string; url: string } | null;
  notes?: string | null;
  lastUsedAt?: string | null;
  responseRate?: number | null;
  createdAt: string;
  isDemo: boolean;
}

const STORAGE_KEY = "orbyt.whatsapp.templates.v1";
const now = () => new Date().toISOString();

const seeds: WhatsAppTemplate[] = [
  {
    id: "wat-demo-1",
    name: "Boas-vindas — onboarding",
    category: "service",
    status: "approved",
    language: "pt_BR",
    body: "Olá, {{primeiro_nome}}! Seu projeto de {{serviço}} foi iniciado pela {{empresa}}. Estarei por aqui para qualquer dúvida 💬",
    variables: ["primeiro_nome", "serviço", "empresa"],
    cta: null,
    notes: "Disparado automaticamente quando um cliente é movido para 'Onboarding'.",
    lastUsedAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    responseRate: 0.62,
    createdAt: now(),
    isDemo: true,
  },
  {
    id: "wat-demo-2",
    name: "Lembrete de proposta",
    category: "utility",
    status: "approved",
    language: "pt_BR",
    body: "Oi {{nome}}, passando pra lembrar da proposta de {{serviço}} enviada em {{data}}. Posso te ajudar com algo?",
    variables: ["nome", "serviço", "data"],
    cta: { label: "Ver proposta", url: "{{link}}" },
    notes: null,
    lastUsedAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    responseRate: 0.41,
    createdAt: now(),
    isDemo: true,
  },
  {
    id: "wat-demo-3",
    name: "Lançamento de serviço",
    category: "marketing",
    status: "submitted",
    language: "pt_BR",
    body: "Novidade no estúdio! Acabamos de lançar {{serviço}}. Quer saber mais? Acesse {{link}}",
    variables: ["serviço", "link"],
    cta: { label: "Saber mais", url: "{{link}}" },
    notes: "Aguardando aprovação Meta.",
    lastUsedAt: null,
    responseRate: null,
    createdAt: now(),
    isDemo: true,
  },
  {
    id: "wat-demo-4",
    name: "Código de verificação",
    category: "authentication",
    status: "draft",
    language: "pt_BR",
    body: "Seu código de acesso é {{nome}}. Não compartilhe com ninguém.",
    variables: ["nome"],
    cta: null,
    notes: "Rascunho — revisar variável.",
    lastUsedAt: null,
    responseRate: null,
    createdAt: now(),
    isDemo: true,
  },
];

function load(): WhatsAppTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* noop */ }
  return seeds;
}

export function useWhatsAppTemplates() {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>(() => load());

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(templates)); } catch { /* noop */ }
  }, [templates]);

  const addTemplate = useCallback(
    (data: Omit<WhatsAppTemplate, "id" | "createdAt" | "isDemo" | "status"> & { status?: WhatsAppTemplateStatus }) => {
      const t: WhatsAppTemplate = {
        ...data,
        id: `wat-${Date.now()}`,
        createdAt: now(),
        isDemo: false,
        status: data.status ?? "draft",
      };
      setTemplates((p) => [t, ...p]);
      return t.id;
    },
    [],
  );

  const updateStatus = useCallback((id: string, status: WhatsAppTemplateStatus) => {
    setTemplates((p) => p.map((t) => (t.id === id ? { ...t, status } : t)));
  }, []);

  const deleteTemplate = useCallback((id: string) => {
    setTemplates((p) => p.filter((t) => t.id !== id));
  }, []);

  return { templates, addTemplate, updateStatus, deleteTemplate };
}
