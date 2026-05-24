import { useCallback, useEffect, useState } from "react";

export type BriefingStatus = "rascunho" | "enviado" | "respondido" | "arquivado";

export interface BriefingResponse {
  fieldId: string;
  value: string;
}

export interface Briefing {
  id: string;
  templateId: string;
  templateName: string;
  clientName: string;
  clientEmail?: string;
  projectName?: string;
  notes?: string;
  status: BriefingStatus;
  publicToken: string;
  createdAt: string;
  sentAt?: string;
  respondedAt?: string;
  responses?: BriefingResponse[];
  isDemo?: boolean;
}

const STORAGE_KEY = "kora.briefings.v1";
const RESPONSES_KEY = "kora.briefingResponses.v1";

function genToken() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const seedBriefings: Briefing[] = [
  {
    id: "brf-demo-1",
    templateId: "tpl-brand",
    templateName: "Briefing de Identidade Visual",
    clientName: "Ana Souza — Floricultura Bem-Querer",
    clientEmail: "ana@bemquerer.com",
    projectName: "Rebrand 2026",
    status: "respondido",
    publicToken: "demo-token-1",
    createdAt: new Date(Date.now() - 86400000 * 6).toISOString(),
    sentAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    respondedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    responses: [
      { fieldId: "f1", value: "Bem-Querer Flores" },
      { fieldId: "f2", value: "Floricultura artesanal com curadoria de espécies raras." },
    ],
    isDemo: true,
  },
  {
    id: "brf-demo-2",
    templateId: "tpl-social",
    templateName: "Briefing de Social Media",
    clientName: "Lucas Mendes — Studio LM",
    clientEmail: "lucas@studiolm.com",
    projectName: "Social Q1",
    status: "enviado",
    publicToken: "demo-token-2",
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    sentAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    isDemo: true,
  },
  {
    id: "brf-demo-3",
    templateId: "tpl-site",
    templateName: "Briefing de Site / Landing Page",
    clientName: "Mariana Lopes",
    status: "rascunho",
    publicToken: "demo-token-3",
    createdAt: new Date().toISOString(),
    isDemo: true,
  },
];

export function useBriefings() {
  const [briefings, setBriefings] = useState<Briefing[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return seedBriefings;
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(briefings)); } catch {}
  }, [briefings]);

  const addBriefing = useCallback((data: Omit<Briefing, "id" | "publicToken" | "createdAt" | "status" | "isDemo">) => {
    const id = `brf-${Date.now()}`;
    const briefing: Briefing = {
      ...data,
      id,
      status: "rascunho",
      publicToken: genToken(),
      createdAt: new Date().toISOString(),
      isDemo: false,
    };
    setBriefings((prev) => [briefing, ...prev]);
    return briefing;
  }, []);

  const updateBriefing = useCallback((id: string, patch: Partial<Briefing>) => {
    setBriefings((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }, []);

  const removeBriefing = useCallback((id: string) => {
    setBriefings((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const markSent = useCallback((id: string) => {
    setBriefings((prev) => prev.map((b) => (b.id === id ? { ...b, status: "enviado", sentAt: new Date().toISOString() } : b)));
  }, []);

  const submitResponse = useCallback((token: string, responses: BriefingResponse[]) => {
    setBriefings((prev) => prev.map((b) => (
      b.publicToken === token
        ? { ...b, status: "respondido", respondedAt: new Date().toISOString(), responses }
        : b
    )));
    try {
      const raw = localStorage.getItem(RESPONSES_KEY);
      const all = raw ? JSON.parse(raw) : {};
      all[token] = { submittedAt: new Date().toISOString(), responses };
      localStorage.setItem(RESPONSES_KEY, JSON.stringify(all));
    } catch {}
  }, []);

  const findByToken = useCallback((token: string) => {
    return briefings.find((b) => b.publicToken === token);
  }, [briefings]);

  return { briefings, addBriefing, updateBriefing, removeBriefing, markSent, submitResponse, findByToken };
}
