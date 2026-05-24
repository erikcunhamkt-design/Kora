import { useCallback, useEffect, useState } from "react";

export type AgentCategory = "strategy" | "commercial" | "operations" | "content" | "client";
export type AgentStatus = "active" | "inactive";
export type AgentBadge = "simulated" | "coming-soon" | "uses-credits" | "own-api";

// NOTE: systemPrompt and final agent prompts must live on the backend when real AI execution is activated.
// Frontend stores only structural metadata for planning/local simulation.

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
  /** Slug identifying a built-in agent (Orquestrador, Radar, etc.) */
  preset?: string;
  /** Example use cases to show in the card */
  examples?: string[];
  /** Status badges */
  badges?: AgentBadge[];
  /** Highlight this card as the hero copilot */
  hero?: boolean;
  /** If true: only shows informational UI, can't run yet */
  comingSoon?: boolean;
  /** Structural fields for local planning — not system prompts */
  mission?: string;
  dataSources?: string[];
  capabilities?: string[];
  outputExamples?: string[];
  suggestedActions?: string[];
}

const STORAGE_KEY = "orbyt.ai.agents.v2";

const now = () => new Date().toISOString();

const seed: AiAgent[] = [
  // ---------- Estratégia ----------
  {
    id: "agent-orchestrator",
    preset: "orchestrator",
    name: "Orquestrador KORA",
    role: "Copiloto do estúdio",
    description: "Prioriza o que precisa acontecer agora no seu estúdio com base em CRM, tarefas, financeiro e metas.",
    category: "strategy",
    status: "active",
    usageCount: 1,
    systemPrompt: "Você é o copiloto estratégico do estúdio...",
    createdAt: now(),
    isDemo: true,
    hero: true,
    badges: ["simulated", "uses-credits"],
    examples: ["Prioridades do dia", "Riscos da semana", "Oportunidades de receita", "Gargalos operacionais"],
    mission: "Sintetizar sinais do estúdio em prioridades acionáveis",
    dataSources: ["CRM/pipeline", "tarefas", "financeiro", "metas"],
    capabilities: ["Priorização", "Risco", "Sugestão de ação"],
    outputExamples: ["Top 3 prioridades", "Alerta de risco", "Próxima ação sugerida"],
    suggestedActions: ["Reordenar tarefas", "Notificar responsável", "Gerar resumo"],
  },
  {
    id: "agent-analyst",
    preset: "analyst",
    name: "Analista",
    role: "Diagnóstico do negócio",
    description: "Lê funil, tarefas, financeiro, metas e produtividade para apontar onde focar.",
    category: "strategy",
    status: "active",
    usageCount: 0,
    systemPrompt: "Você é um analista de negócio de estúdios criativos...",
    createdAt: now(),
    isDemo: true,
    badges: ["simulated", "uses-credits"],
    examples: ["Diagnóstico do funil", "Análise de produtividade", "Metas em risco"],
    mission: "Diagnosticar saúde do negócio com dados locais",
    dataSources: ["funil", "tarefas", "financeiro", "metas"],
    capabilities: ["Diagnóstico", "Benchmark", "Tendência"],
  },
  {
    id: "agent-financial",
    preset: "financial",
    name: "Financeiro",
    role: "Gestão financeira",
    description: "Apoio em fluxo de caixa, ticket médio, margem, preço sugerido e contas pendentes.",
    category: "strategy",
    status: "active",
    usageCount: 0,
    systemPrompt: "Você é um analista financeiro de estúdios...",
    createdAt: now(),
    isDemo: true,
    badges: ["simulated", "uses-credits"],
    examples: ["Projeção de caixa", "Margem por projeto", "Cobranças pendentes"],
    mission: "Proteger saúde financeira do estúdio",
    dataSources: ["projetos", "preços", "pagamentos"],
    capabilities: ["Projeção", "Precificação", "Alerta de inadimplência"],
  },
  {
    id: "agent-bottleneck",
    preset: "bottleneck",
    name: "Detetive de Gargalos",
    role: "Caça desperdício",
    description: "Descobre onde o estúdio perde tempo, dinheiro ou cliente.",
    category: "strategy",
    status: "active",
    usageCount: 0,
    systemPrompt: "Você investiga gargalos operacionais...",
    createdAt: now(),
    isDemo: true,
    badges: ["simulated", "uses-credits"],
    examples: ["Tarefas paradas", "Etapas lentas do funil", "Projetos sem avanço"],
    mission: "Identificar e quantificar desperdício operacional",
    dataSources: ["tarefas", "pipeline", "timeline"],
    capabilities: ["Detecção", "Custo do gargalo", "Sugestão de correção"],
  },

  // ---------- Comercial ----------
  {
    id: "agent-revenue-radar",
    preset: "revenue-radar",
    name: "Radar de Receita",
    role: "Detecta dinheiro parado",
    description: "Encontra propostas esquecidas, leads quentes sem follow-up, upsell e contas pendentes.",
    category: "commercial",
    status: "active",
    usageCount: 0,
    systemPrompt: "Você caça oportunidades de receita imediata...",
    createdAt: now(),
    isDemo: true,
    badges: ["simulated", "uses-credits"],
    examples: ["Propostas paradas há 7+ dias", "Leads quentes esquecidos", "Sugestões de upsell"],
    mission: "Maximizar receita com leads e contas existentes",
    dataSources: ["pipeline", "propostas", "histórico de follow-up"],
    capabilities: ["Detecção", "Sugestão de ação", "Upsell"],
  },
  {
    id: "agent-sales",
    preset: "sales",
    name: "Comercial",
    role: "Apoio em vendas",
    description: "Qualifica lead, sugere follow-up, abordagem, argumentos e próxima ação no pipeline.",
    category: "commercial",
    status: "active",
    usageCount: 0,
    systemPrompt: "Você é um closer consultivo...",
    createdAt: now(),
    isDemo: true,
    badges: ["simulated", "uses-credits"],
    examples: ["Qualificar lead", "Próximo follow-up", "Argumento de venda"],
    mission: "Aumentar taxa de conversão do pipeline",
    dataSources: ["leads", "interações", "propostas"],
    capabilities: ["Qualificação", "Follow-up", "Argumentação"],
  },
  {
    id: "agent-pricing",
    preset: "pricing",
    name: "Mentor de Precificação",
    role: "Faixa de preço inteligente",
    description: "Sugere faixa de preço com base em complexidade, histórico, margem e posicionamento.",
    category: "commercial",
    status: "active",
    usageCount: 0,
    systemPrompt: "Você é um mentor de precificação para criativos...",
    createdAt: now(),
    isDemo: true,
    badges: ["simulated", "uses-credits"],
    examples: ["Preço sugerido", "Comparar com histórico", "Faixa por complexidade"],
    mission: "Precificar com confiança e margem saudável",
    dataSources: ["projetos anteriores", "escopo", "posicionamento"],
    capabilities: ["Benchmark de preço", "Margem", "Escopo"],
  },

  // ---------- Operação ----------
  {
    id: "agent-scope-guardian",
    preset: "scope-guardian",
    name: "Guardião de Escopo",
    role: "Protege margem e prazo",
    description: "Detecta excesso de revisão, pedidos fora do combinado e sugere cobrança ou alinhamento educado.",
    category: "operations",
    status: "active",
    usageCount: 0,
    systemPrompt: "Você protege escopo e margem do estúdio...",
    createdAt: now(),
    isDemo: true,
    badges: ["simulated", "uses-credits"],
    examples: ["Detectar revisões extras", "Mensagem de alinhamento", "Sugerir cobrança adicional"],
    mission: "Proteger margem e prazo contra escopo creep",
    dataSources: ["revisões", "checklist", "timeline"],
    capabilities: ["Detecção de creep", "Mensagem de alinhamento", "Cobrança sugerida"],
  },
  {
    id: "agent-operations",
    preset: "operations",
    name: "Operações",
    role: "Organiza a entrega",
    description: "Transforma projeto em tarefas, cria checklist, detecta atraso e reorganiza prioridades.",
    category: "operations",
    status: "active",
    usageCount: 0,
    systemPrompt: "Você é um gestor de operação de estúdios...",
    createdAt: now(),
    isDemo: true,
    badges: ["simulated", "uses-credits"],
    examples: ["Briefing → tarefas", "Checklist de entrega", "Detectar atrasos"],
    mission: "Garantir entrega no prazo com qualidade",
    dataSources: ["projetos", "tarefas", "checklists"],
    capabilities: ["Decomposição", "Checklist", "Alerta de atraso"],
  },
  {
    id: "agent-automation-architect",
    preset: "automation-architect",
    name: "Arquiteto de Automação",
    role: "Regras em linguagem natural",
    description: "Você descreve uma regra em português e ele sugere a automação correspondente.",
    category: "operations",
    status: "active",
    usageCount: 0,
    systemPrompt: "Você converte regras em linguagem natural em automações...",
    createdAt: now(),
    isDemo: true,
    badges: ["simulated", "uses-credits"],
    examples: ['"Quando orçamento aprovado, criar projeto e cobrança"', "Sugestão de gatilhos", "Sugestão de ações"],
    mission: "Traduzir regras de negócio em automações operacionais",
    dataSources: ["regras descritas", "fluxos existentes"],
    capabilities: ["Gatilho", "Ação", "Sequência"],
  },
  {
    id: "agent-meeting",
    preset: "meeting",
    name: "Assistente de Reunião",
    role: "Antes e depois da call",
    description: "Antes: resume cliente, histórico e pendências. Depois: gera ata, tarefas e follow-ups.",
    category: "operations",
    status: "active",
    usageCount: 0,
    systemPrompt: "Você prepara e finaliza reuniões de estúdio...",
    createdAt: now(),
    isDemo: true,
    badges: ["simulated", "uses-credits"],
    examples: ["Briefing pré-reunião", "Ata e follow-up", "Tarefas geradas"],
    mission: "Preparar e documentar reuniões com contexto",
    dataSources: ["histórico do cliente", "pendências", "calendário"],
    capabilities: ["Pré-briefing", "Ata", "Tarefas pós-call"],
  },

  // ---------- Conteúdo ----------
  {
    id: "agent-copywriter",
    preset: "copywriter",
    name: "Copywriter",
    role: "Textos prontos para usar",
    description: "Posts, anúncios, e-mails, mensagens, propostas e variações A/B.",
    category: "content",
    status: "active",
    usageCount: 0,
    systemPrompt: "Você é um copywriter sênior...",
    createdAt: now(),
    isDemo: true,
    badges: ["simulated", "uses-credits"],
    examples: ["Legenda para post", "Texto de anúncio", "Proposta comercial"],
    mission: "Produzir textos comerciais e criativos sob demanda",
    dataSources: ["briefing", "tom de voz", "público-alvo"],
    capabilities: ["Legenda", "Anúncio", "E-mail", "Proposta"],
    outputExamples: ["Legenda para Instagram", "Variação A/B de headline"],
  },
  {
    id: "agent-creative-director",
    preset: "creative-director",
    name: "Diretor Criativo",
    role: "Direção, não geração",
    description: "Gera direção criativa, prompts para ferramentas externas, briefing visual, checklist de marca e revisão de consistência. Não gera imagens dentro do KORA.",
    category: "content",
    status: "active",
    usageCount: 0,
    systemPrompt: "Você é um diretor criativo. Você nunca gera imagens; gera direção...",
    createdAt: now(),
    isDemo: true,
    badges: ["simulated", "uses-credits"],
    examples: ["Prompt para Midjourney/Sora", "Moodboard textual", "Checklist de marca", "Revisão de consistência"],
    mission: "Direcionar qualidade criativa sem gerar imagens nativamente",
    dataSources: ["briefing", "guia de marca", "referências"],
    capabilities: ["Direção criativa", "Prompt para ferramentas externas", "Checklist de marca"],
    outputExamples: ["Prompt otimizado para Midjourney", "Moodboard textual"],
  },

  // ---------- Cliente ----------
  {
    id: "agent-concierge",
    preset: "concierge",
    name: "Concierge do Cliente",
    role: "Portal e suporte",
    description: "Coleta briefing, responde dúvidas simples, organiza solicitações e encaminha para humano.",
    category: "client",
    status: "inactive",
    usageCount: 0,
    systemPrompt: "Você é o concierge do portal do cliente...",
    createdAt: now(),
    isDemo: true,
    comingSoon: true,
    badges: ["coming-soon"],
    examples: ["Coleta de briefing", "FAQ do cliente", "Triagem de solicitações"],
    mission: "Acolher e triar demandas do cliente no portal",
    dataSources: ["portal do cliente", "FAQ", "solicitações"],
    capabilities: ["Coleta", "FAQ", "Triagem"],
  },
];

export function useAiAgents() {
  const [agents, setAgents] = useState<AiAgent[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AiAgent[];
        // Re-merge with seed to ensure new built-in agents appear
        const byId = new Map(parsed.map((a) => [a.id, a]));
        const merged = seed.map((s) => {
          const existing = byId.get(s.id);
          if (!existing) return s;
          return { ...s, status: existing.status, usageCount: existing.usageCount, lastUsedAt: existing.lastUsedAt };
        });
        const customs = parsed.filter((a) => !a.isDemo && !seed.find((s) => s.id === a.id));
        return [...merged, ...customs];
      }
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
