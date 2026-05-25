import { useEffect, useState, useCallback } from "react";
import { DEFAULT_PIPELINE_ID } from "./usePipelines";

export type Priority = "alta" | "média" | "baixa";
export type StageKey = "lead" | "contato" | "proposta" | "negociacao" | "fechado" | "perdido";
export type LeadTemperature = "frio" | "morno" | "quente" | "não definida";

export interface Lead {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  serviceType: string;
  origin?: string;
  source?: string;
  estimatedValue: number;
  priority: Priority;
  lastInteraction: string;
  stage: StageKey;
  pipelineId?: string;
  stageId?: string;
  tags?: string[];
  archived?: boolean;
  converted?: boolean;
  nextAction?: string;
  description: string;
  history: { date: string; text: string }[];
  notes: string;
  /** Dados de demonstração — não contam para o limite do plano Free */
  isDemo?: boolean;

  // --- CRM v2: campos comerciais expandidos ---
  /** Cliente vinculado (oportunidade pode ser avulsa). */
  clientId?: number;
  /** Temperatura comercial — quando ausente, derive de `priority`. */
  temperature?: LeadTemperature;
  /** Próxima ação / follow-up (ISO date). */
  nextActionDate?: string;
  expectedCloseDate?: string;
  wonAt?: string;
  lostReason?: string;
  convertedClientId?: number;
  createdAt?: string;
  updatedAt?: string;
  /** v2 — orçamento vinculado (quote.id). */
  quoteId?: string;
  quoteTitle?: string;
}

/** Mapeia priority legado → temperatura. */
export const priorityToTemperature = (p?: Priority): LeadTemperature => {
  if (p === "alta") return "quente";
  if (p === "média") return "morno";
  if (p === "baixa") return "frio";
  return "não definida";
};

export const getLeadTemperature = (l: Pick<Lead, "temperature" | "priority">): LeadTemperature =>
  l.temperature ?? priorityToTemperature(l.priority);


const STORAGE_KEY = "orbyt.leads.v1";

const rawInitialLeads: Omit<Lead, "isDemo">[] = [
  {
    id: 1, name: "Marina Costa", company: "Acme Corp", email: "marina@acme.com",
    phone: "(11) 99812-3456", serviceType: "Branding", origin: "Indicação", estimatedValue: 8500,
    priority: "alta", lastInteraction: "12 Abr 2025", stage: "negociacao",
    nextAction: "Confirmar guidelines até sexta",
    description: "Rebranding completo incluindo logo, paleta e guidelines.",
    notes: "Prefere reuniões às terças.",
    history: [
      { date: "12 Abr", text: "Reunião de alinhamento sobre guidelines" },
      { date: "08 Abr", text: "Apresentação da proposta de rebranding" },
      { date: "02 Abr", text: "Primeiro contato via email" },
    ],
  },
  {
    id: 2, name: "Rafael Mendes", company: "Studio Zen", email: "rafael@studiozen.com",
    phone: "(21) 98765-4321", serviceType: "Web Design", origin: "Indicação", estimatedValue: 12000,
    priority: "alta", lastInteraction: "10 Abr 2025", stage: "proposta",
    nextAction: "Aguardar feedback da proposta",
    description: "Redesign completo do website institucional com e-commerce.",
    notes: "Deadline apertado — precisa entregar até maio.",
    history: [
      { date: "10 Abr", text: "Proposta enviada via email" },
      { date: "06 Abr", text: "Briefing detalhado recebido" },
      { date: "01 Abr", text: "Indicação do cliente Fernanda Lima" },
    ],
  },
  {
    id: 3, name: "Camila Andrade", company: "Nova Design", email: "camila@novadesign.com",
    phone: "(31) 97654-3210", serviceType: "Design Gráfico", origin: "Site", estimatedValue: 4500,
    priority: "média", lastInteraction: "08 Abr 2025", stage: "proposta",
    nextAction: "Follow-up em 3 dias",
    description: "Catálogo digital de produtos para distribuição B2B.",
    notes: "Aguardando aprovação do diretor financeiro.",
    history: [
      { date: "08 Abr", text: "Proposta de catálogo digital enviada" },
      { date: "03 Abr", text: "Reunião online para entender o escopo" },
    ],
  },
  {
    id: 4, name: "Lucas Ferreira", company: "Tech Solutions", email: "lucas@techsol.com",
    phone: "(41) 96543-2109", serviceType: "Branding", origin: "LinkedIn", estimatedValue: 3500,
    priority: "baixa", lastInteraction: "05 Abr 2025", stage: "lead",
    nextAction: "Marcar call de diagnóstico",
    description: "Identidade visual para startup de tecnologia.",
    notes: "Contato feito via LinkedIn.",
    history: [{ date: "05 Abr", text: "Primeiro contato via LinkedIn" }],
  },
  {
    id: 5, name: "Juliana Rocha", company: "Brand Co", email: "juliana@brandco.com",
    phone: "(51) 95432-1098", serviceType: "Social Media", origin: "Indicação", estimatedValue: 15000,
    priority: "alta", lastInteraction: "14 Abr 2025", stage: "fechado",
    nextAction: "Iniciar onboarding em maio",
    description: "Pacote anual de gestão de redes sociais com criação de conteúdo.",
    notes: "Contrato assinado. Início em maio.",
    history: [
      { date: "14 Abr", text: "Contrato assinado ✓" },
      { date: "10 Abr", text: "Última rodada de negociação" },
    ],
  },
  {
    id: 6, name: "Diego Martins", company: "StartUp X", email: "diego@startupx.io",
    phone: "(11) 94321-0987", serviceType: "Web Design", origin: "Site", estimatedValue: 2800,
    priority: "baixa", lastInteraction: "11 Abr 2025", stage: "contato",
    nextAction: "Enviar pacote simplificado",
    description: "Landing page para produto MVP.",
    notes: "Budget limitado.",
    history: [{ date: "11 Abr", text: "Call de 30min para entender necessidades" }],
  },
  {
    id: 7, name: "Fernanda Lima", company: "FitTrack", email: "fernanda@fittrack.app",
    phone: "(21) 93210-9876", serviceType: "Design Gráfico", origin: "Indicação", estimatedValue: 6000,
    priority: "média", lastInteraction: "13 Abr 2025", stage: "negociacao",
    nextAction: "Revisar timeline esta semana",
    description: "UI Kit e design system para o aplicativo FitTrack.",
    notes: "Contrato mensal de design de interfaces.",
    history: [{ date: "13 Abr", text: "Negociação de escopo e timeline" }],
  },
  {
    id: 8, name: "André Souza", company: "Café & Arte", email: "andre@cafearte.com.br",
    phone: "(85) 92109-8765", serviceType: "Branding", origin: "Instagram", estimatedValue: 5200,
    priority: "média", lastInteraction: "09 Abr 2025", stage: "fechado",
    description: "Identidade visual completa para cafeteria artesanal.",
    notes: "Projeto entregue.",
    history: [{ date: "09 Abr", text: "Projeto entregue com sucesso ✓" }],
  },
  {
    id: 9, name: "Patrícia Oliveira", company: "EcoVerde", email: "patricia@ecoverde.com.br",
    phone: "(62) 91098-7654", serviceType: "Social Media", origin: "Site", estimatedValue: 3200,
    priority: "baixa", lastInteraction: "02 Abr 2025", stage: "perdido",
    description: "Gestão de redes sociais para marca sustentável.",
    notes: "Perdido por budget. Recontatar em 3 meses.",
    history: [{ date: "02 Abr", text: "Cliente informou que não vai prosseguir" }],
  },
  {
    id: 10, name: "Marcos Almeida", company: "PixelLab", email: "marcos@pixellab.design",
    phone: "(11) 90987-6543", serviceType: "Web Design", origin: "Indicação", estimatedValue: 9500,
    priority: "alta", lastInteraction: "14 Abr 2025", stage: "lead",
    nextAction: "Marcar call esta semana",
    description: "Portal de cursos online com área de membros.",
    notes: "Grande potencial.",
    history: [{ date: "14 Abr", text: "Recebeu indicação via WhatsApp" }],
  },
  {
    id: 11, name: "Isabela Santos", company: "Moda Viva", email: "isabela@modaviva.com",
    phone: "(31) 99876-5432", serviceType: "Branding", origin: "Instagram", estimatedValue: 7000,
    priority: "média", lastInteraction: "11 Abr 2025", stage: "contato",
    nextAction: "Aguardar aprovação da sócia",
    description: "Rebranding de marca de moda feminina.",
    notes: "Muito interessada.",
    history: [{ date: "11 Abr", text: "Apresentação do portfólio" }],
  },
];

export const initialLeads: Lead[] = rawInitialLeads.map((l) => ({
  ...l,
  isDemo: true,
  pipelineId: DEFAULT_PIPELINE_ID,
  stageId: l.stage,
  tags: [],
  archived: false,
  source: l.origin,
}));

const SEED_IDS = new Set(rawInitialLeads.map((l) => l.id));

function migrate(list: Lead[]): Lead[] {
  return list.map((l) => {
    const next = { ...l };
    if (next.isDemo === undefined && SEED_IDS.has(next.id)) next.isDemo = true;
    if (!next.pipelineId) next.pipelineId = DEFAULT_PIPELINE_ID;
    if (!next.stageId) next.stageId = next.stage;
    if (!Array.isArray(next.tags)) next.tags = [];
    if (next.archived === undefined) next.archived = false;
    if (!next.source) next.source = next.origin;
    return next;
  });
}

const todayShort = () =>
  new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
const todayFull = () =>
  new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return migrate(JSON.parse(raw) as Lead[]);
    } catch {}
    return initialLeads;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
    } catch {}
  }, [leads]);

  const addLead = useCallback(
    (
      data: Omit<
        Lead,
        "id" | "history" | "lastInteraction" | "notes" | "description" | "isDemo"
      > &
        Partial<Pick<Lead, "notes" | "description" | "lastInteraction">>
    ) => {
      setLeads((prev) => [
        {
          id: Date.now(),
          history: [{ date: todayShort(), text: "Lead criado" }],
          lastInteraction: data.lastInteraction ?? todayFull(),
          notes: data.notes ?? "",
          description: data.description ?? "",
          tags: data.tags ?? [],
          archived: false,
          pipelineId: data.pipelineId ?? DEFAULT_PIPELINE_ID,
          stageId: data.stageId ?? data.stage,
          source: data.source ?? data.origin,
          ...data,
          isDemo: false,
        } as Lead,
        ...prev,
      ]);
    },
    []
  );

  const updateLead = useCallback((id: number, patch: Partial<Lead>) => {
    setLeads((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, ...patch, lastInteraction: todayFull() } : l
      )
    );
  }, []);

  const moveLead = useCallback((id: number, newStage: StageKey) => {
    setLeads((prev) =>
      prev.map((l) =>
        l.id === id
          ? { ...l, stage: newStage, stageId: newStage, lastInteraction: todayFull() }
          : l
      )
    );
  }, []);

  /** Move within same pipeline to a new stageId. Also syncs `stage` to known StageKey if matching. */
  const moveLeadToStage = useCallback(
    (id: number, stageId: string, type?: "open" | "won" | "lost") => {
      setLeads((prev) =>
        prev.map((l) => {
          if (l.id !== id) return l;
          const known: StageKey[] = ["lead", "contato", "proposta", "negociacao", "fechado", "perdido"];
          const nextStage: StageKey = (known as string[]).includes(stageId)
            ? (stageId as StageKey)
            : type === "won"
              ? "fechado"
              : type === "lost"
                ? "perdido"
                : l.stage;
          return {
            ...l,
            stageId,
            stage: nextStage,
            lastInteraction: todayFull(),
            history: [{ date: todayShort(), text: `Movido para nova etapa` }, ...l.history],
          };
        })
      );
    },
    []
  );

  const moveLeadToPipeline = useCallback(
    (id: number, pipelineId: string, stageId: string) => {
      setLeads((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
                ...l,
                pipelineId,
                stageId,
                lastInteraction: todayFull(),
                history: [
                  { date: todayShort(), text: "Movido para outro pipeline" },
                  ...l.history,
                ],
              }
            : l
        )
      );
    },
    []
  );

  const archiveLead = useCallback((id: number, archived = true) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, archived } : l)));
  }, []);

  const deleteLead = useCallback((id: number) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const addTag = useCallback((id: number, tag: string) => {
    const clean = tag.trim();
    if (!clean) return;
    setLeads((prev) =>
      prev.map((l) =>
        l.id === id
          ? { ...l, tags: Array.from(new Set([...(l.tags ?? []), clean])) }
          : l
      )
    );
  }, []);

  const removeTag = useCallback((id: number, tag: string) => {
    setLeads((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, tags: (l.tags ?? []).filter((t) => t !== tag) } : l
      )
    );
  }, []);

  const setLeadTags = useCallback((id: number, tags: string[]) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, tags } : l)));
  }, []);

  const markConverted = useCallback((id: number, convertedClientId?: number) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, converted: true, convertedClientId: convertedClientId ?? l.convertedClientId } : l))
    );
  }, []);

  return {
    leads,
    addLead,
    moveLead,
    moveLeadToStage,
    moveLeadToPipeline,
    updateLead,
    archiveLead,
    deleteLead,
    addTag,
    removeTag,
    setLeadTags,
    markConverted,
    setLeads,
  };
}
