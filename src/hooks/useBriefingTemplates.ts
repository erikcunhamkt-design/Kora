import { useCallback, useEffect, useState } from "react";

export type BriefingFieldType = "text" | "textarea" | "select" | "number" | "url" | "date";

export interface BriefingField {
  id: string;
  label: string;
  type: BriefingFieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  help?: string;
}

export interface BriefingTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  fields: BriefingField[];
  isDemo?: boolean;
}

const STORAGE_KEY = "kora.briefingTemplates.v1";

const seedTemplates: BriefingTemplate[] = [
  {
    id: "tpl-brand",
    name: "Briefing de Identidade Visual",
    category: "Branding",
    description: "Descoberta de marca para projetos de identidade visual.",
    isDemo: true,
    fields: [
      { id: "f1", label: "Nome da marca", type: "text", required: true },
      { id: "f2", label: "Descreva o negócio em 2 frases", type: "textarea", required: true },
      { id: "f3", label: "Público-alvo principal", type: "textarea", required: true },
      { id: "f4", label: "Personalidade da marca", type: "select", options: ["Sofisticada", "Jovem", "Minimalista", "Divertida", "Confiável"], required: true },
      { id: "f5", label: "Referências visuais (links)", type: "textarea" },
      { id: "f6", label: "Concorrentes diretos", type: "textarea" },
      { id: "f7", label: "Prazo desejado", type: "date" },
    ],
  },
  {
    id: "tpl-social",
    name: "Briefing de Social Media",
    category: "Social Media",
    description: "Levantamento para gestão de redes sociais.",
    isDemo: true,
    fields: [
      { id: "f1", label: "Nome da empresa", type: "text", required: true },
      { id: "f2", label: "Instagram atual", type: "url" },
      { id: "f3", label: "Objetivos com o conteúdo", type: "textarea", required: true },
      { id: "f4", label: "Tom de voz", type: "select", options: ["Formal", "Casual", "Bem-humorado", "Inspirador"] },
      { id: "f5", label: "Quantidade de posts/mês", type: "number" },
      { id: "f6", label: "Concorrentes de referência", type: "textarea" },
    ],
  },
  {
    id: "tpl-site",
    name: "Briefing de Site / Landing Page",
    category: "Web",
    description: "Levantamento para projetos web.",
    isDemo: true,
    fields: [
      { id: "f1", label: "Objetivo do site", type: "textarea", required: true },
      { id: "f2", label: "Páginas necessárias", type: "textarea", required: true },
      { id: "f3", label: "Domínio (se existir)", type: "url" },
      { id: "f4", label: "Referências de sites", type: "textarea" },
      { id: "f5", label: "Possui logo e identidade?", type: "select", options: ["Sim", "Não", "Parcial"] },
    ],
  },
];

export function useBriefingTemplates() {
  const [templates, setTemplates] = useState<BriefingTemplate[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return seedTemplates;
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(templates)); } catch {}
  }, [templates]);

  const addTemplate = useCallback((data: Omit<BriefingTemplate, "id" | "isDemo">) => {
    const id = `tpl-${Date.now()}`;
    setTemplates((prev) => [{ ...data, id, isDemo: false }, ...prev]);
    return id;
  }, []);

  const updateTemplate = useCallback((id: string, patch: Partial<BriefingTemplate>) => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const removeTemplate = useCallback((id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const duplicateTemplate = useCallback((id: string) => {
    setTemplates((prev) => {
      const src = prev.find((t) => t.id === id);
      if (!src) return prev;
      return [{ ...src, id: `tpl-${Date.now()}`, name: `${src.name} (cópia)`, isDemo: false }, ...prev];
    });
  }, []);

  return { templates, addTemplate, updateTemplate, removeTemplate, duplicateTemplate };
}
