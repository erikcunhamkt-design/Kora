import { useCallback, useEffect, useState } from "react";

export type AgentCategory = "copywriter" | "designer" | "analyst" | "strategist" | "support" | "custom";
export type AgentStatus = "active" | "inactive";

export interface AiAgent {
  id: string;
  name: string;
  role: string;
  description: string;
  category: AgentCategory;
  status: AgentStatus;
  usageCount: number;
  lastUsedAt?: string;
  systemPrompt: string;
  createdAt: string;
  isDemo: boolean;
}

const STORAGE_KEY = "orbyt.ai.agents.v1";

const seed: AiAgent[] = [
  { id: "agent-demo-1", name: "Copy Pro", role: "Copywriter de campanhas", description: "Cria textos persuasivos para anúncios, e-mails e landing pages.", category: "copywriter", status: "active", usageCount: 12, systemPrompt: "Você é um copywriter sênior...", createdAt: new Date().toISOString(), isDemo: true },
  { id: "agent-demo-2", name: "Design Mentor", role: "Diretor de arte", description: "Sugere paletas, tipografia e referências visuais.", category: "designer", status: "active", usageCount: 8, systemPrompt: "Você é um diretor de arte...", createdAt: new Date().toISOString(), isDemo: true },
  { id: "agent-demo-3", name: "Insight Analyst", role: "Analista de métricas", description: "Interpreta dados de campanhas e gera insights.", category: "analyst", status: "active", usageCount: 5, systemPrompt: "Você é um analista de dados...", createdAt: new Date().toISOString(), isDemo: true },
  { id: "agent-demo-4", name: "Growth Strategist", role: "Estrategista de crescimento", description: "Cria planos de aquisição e retenção.", category: "strategist", status: "inactive", usageCount: 3, systemPrompt: "Você é um estrategista...", createdAt: new Date().toISOString(), isDemo: true },
  { id: "agent-demo-5", name: "Atendente Orbyt", role: "Suporte ao cliente", description: "Responde dúvidas frequentes com tom amigável.", category: "support", status: "active", usageCount: 21, systemPrompt: "Você é um agente de suporte...", createdAt: new Date().toISOString(), isDemo: true },
];

export function useAiAgents() {
  const [agents, setAgents] = useState<AiAgent[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return seed;
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(agents)); } catch {}
  }, [agents]);

  const addAgent = useCallback((data: Omit<AiAgent, "id" | "createdAt" | "isDemo" | "usageCount">) => {
    setAgents((prev) => [
      { ...data, id: `agent-${Date.now()}`, createdAt: new Date().toISOString(), usageCount: 0, isDemo: false },
      ...prev,
    ]);
  }, []);

  const updateAgent = useCallback((id: string, patch: Partial<AiAgent>) => {
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, []);

  const toggleAgentStatus = useCallback((id: string) => {
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, status: a.status === "active" ? "inactive" : "active" } : a)));
  }, []);

  const incrementUsage = useCallback((id: string) => {
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, usageCount: a.usageCount + 1, lastUsedAt: new Date().toISOString() } : a)));
  }, []);

  return { agents, addAgent, updateAgent, toggleAgentStatus, incrementUsage };
}
