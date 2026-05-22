import { useEffect, useState, useCallback } from "react";

export type Priority = "alta" | "média" | "baixa";
export type StageKey = "lead" | "contato" | "proposta" | "negociacao" | "fechado" | "perdido";

export interface Lead {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  serviceType: string;
  origin?: string;
  estimatedValue: number;
  priority: Priority;
  lastInteraction: string;
  stage: StageKey;
  nextAction?: string;
  description: string;
  history: { date: string; text: string }[];
  notes: string;
}

const STORAGE_KEY = "orbyt.leads.v1";

export const initialLeads: Lead[] = [
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
    history: [
      { date: "05 Abr", text: "Primeiro contato via LinkedIn" },
    ],
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
      { date: "05 Abr", text: "Proposta ajustada conforme feedback" },
      { date: "28 Mar", text: "Primeira proposta enviada" },
    ],
  },
  {
    id: 6, name: "Diego Martins", company: "StartUp X", email: "diego@startupx.io",
    phone: "(11) 94321-0987", serviceType: "Web Design", origin: "Site", estimatedValue: 2800,
    priority: "baixa", lastInteraction: "11 Abr 2025", stage: "contato",
    nextAction: "Enviar pacote simplificado",
    description: "Landing page para produto MVP.",
    notes: "Budget limitado. Avaliar pacote simplificado.",
    history: [
      { date: "11 Abr", text: "Call de 30min para entender necessidades" },
      { date: "07 Abr", text: "Respondeu formulário de contato no site" },
    ],
  },
  {
    id: 7, name: "Fernanda Lima", company: "FitTrack", email: "fernanda@fittrack.app",
    phone: "(21) 93210-9876", serviceType: "Design Gráfico", origin: "Indicação", estimatedValue: 6000,
    priority: "média", lastInteraction: "13 Abr 2025", stage: "negociacao",
    nextAction: "Revisar timeline esta semana",
    description: "UI Kit e design system para o aplicativo FitTrack.",
    notes: "Contrato mensal de design de interfaces.",
    history: [
      { date: "13 Abr", text: "Negociação de escopo e timeline" },
      { date: "09 Abr", text: "Proposta apresentada em call" },
      { date: "04 Abr", text: "Briefing recebido" },
    ],
  },
  {
    id: 8, name: "André Souza", company: "Café & Arte", email: "andre@cafearte.com.br",
    phone: "(85) 92109-8765", serviceType: "Branding", origin: "Instagram", estimatedValue: 5200,
    priority: "média", lastInteraction: "09 Abr 2025", stage: "fechado",
    description: "Identidade visual completa para cafeteria artesanal.",
    notes: "Projeto entregue. Avaliar pacote mensal de social media.",
    history: [
      { date: "09 Abr", text: "Projeto entregue com sucesso ✓" },
      { date: "01 Abr", text: "Revisão final aprovada" },
      { date: "20 Mar", text: "Primeira versão apresentada" },
    ],
  },
  {
    id: 9, name: "Patrícia Oliveira", company: "EcoVerde", email: "patricia@ecoverde.com.br",
    phone: "(62) 91098-7654", serviceType: "Social Media", origin: "Site", estimatedValue: 3200,
    priority: "baixa", lastInteraction: "02 Abr 2025", stage: "perdido",
    description: "Gestão de redes sociais para marca sustentável.",
    notes: "Perdido por budget. Recontatar em 3 meses.",
    history: [
      { date: "02 Abr", text: "Cliente informou que não vai prosseguir" },
      { date: "28 Mar", text: "Proposta enviada" },
      { date: "22 Mar", text: "Primeiro contato" },
    ],
  },
  {
    id: 10, name: "Marcos Almeida", company: "PixelLab", email: "marcos@pixellab.design",
    phone: "(11) 90987-6543", serviceType: "Web Design", origin: "Indicação", estimatedValue: 9500,
    priority: "alta", lastInteraction: "14 Abr 2025", stage: "lead",
    nextAction: "Marcar call esta semana",
    description: "Portal de cursos online com área de membros.",
    notes: "Grande potencial. Marcar call esta semana.",
    history: [
      { date: "14 Abr", text: "Recebeu indicação, enviou mensagem no WhatsApp" },
    ],
  },
  {
    id: 11, name: "Isabela Santos", company: "Moda Viva", email: "isabela@modaviva.com",
    phone: "(31) 99876-5432", serviceType: "Branding", origin: "Instagram", estimatedValue: 7000,
    priority: "média", lastInteraction: "11 Abr 2025", stage: "contato",
    nextAction: "Aguardar aprovação da sócia",
    description: "Rebranding de marca de moda feminina.",
    notes: "Muito interessada, mas precisa aprovar com sócia.",
    history: [
      { date: "11 Abr", text: "Apresentação do portfólio por videochamada" },
      { date: "08 Abr", text: "Primeiro contato via Instagram" },
    ],
  },
];

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as Lead[];
    } catch {}
    return initialLeads;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
    } catch {}
  }, [leads]);

  const addLead = useCallback(
    (data: Omit<Lead, "id" | "history" | "lastInteraction" | "notes" | "description"> & Partial<Pick<Lead, "notes" | "description" | "lastInteraction">>) => {
      setLeads((prev) => [
        {
          id: Date.now(),
          history: [{ date: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }), text: "Lead criado" }],
          lastInteraction: data.lastInteraction ?? new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }),
          notes: data.notes ?? "",
          description: data.description ?? "",
          ...data,
        } as Lead,
        ...prev,
      ]);
    },
    []
  );

  const moveLead = useCallback((id: number, newStage: StageKey) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, stage: newStage } : l)));
  }, []);

  return { leads, addLead, moveLead, setLeads };
}
