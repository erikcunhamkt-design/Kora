import { useCallback, useEffect, useState } from "react";

export type Channel = "whatsapp" | "email" | "sms";
export type CampaignObjective = "nurture" | "announcement" | "follow_up" | "launch" | "reminder" | "custom";
export type CampaignStatus = "draft" | "scheduled" | "running" | "paused" | "completed" | "canceled";
export type ConsentStatus = "opted_in" | "opted_out" | "unknown";
export type ConsentSource = "form" | "manual" | "import" | "checkout" | "public_page" | "whatsapp";
export type TemplateCategory = "marketing" | "utility" | "reminder" | "follow_up";
export type TemplateStatus = "draft" | "pending_approval" | "approved" | "rejected";

export interface Campaign {
  id: string;
  name: string;
  channel: Channel;
  objective: CampaignObjective;
  status: CampaignStatus;
  audienceSegmentId: string;
  templateId: string;
  scheduledAt?: string;
  sentCount: number;
  deliveredCount: number;
  repliedCount: number;
  optOutCount: number;
  createdAt: string;
  isDemo: boolean;
}

export interface AudienceSegment {
  id: string;
  name: string;
  description: string;
  filters: string[];
  channel: Channel;
  estimatedContacts: number;
  optedInContacts: number;
  optedOutContacts: number;
  unknownContacts: number;
  consentRequired: true;
  isDemo: boolean;
}

export interface ConsentRecord {
  id: string;
  contactId: string;
  contactName: string;
  channel: Channel;
  consentStatus: ConsentStatus;
  consentSource: ConsentSource;
  consentText: string;
  consentDate: string;
  optOutDate?: string;
  isDemo: boolean;
}

export interface MessageTemplate {
  id: string;
  name: string;
  channel: Channel;
  category: TemplateCategory;
  status: TemplateStatus;
  body: string;
  variables: string[];
  isDemo: boolean;
}

const KEYS = {
  campaigns: "orbyt.campaigns.v1",
  segments: "orbyt.audienceSegments.v1",
  consents: "orbyt.consentRecords.v1",
  templates: "orbyt.messageTemplates.v1",
};

const now = () => new Date().toISOString();

const seedSegments: AudienceSegment[] = [
  { id: "seg-demo-1", name: "Leads com opt-in", description: "Leads que autorizaram receber comunicações.", filters: ["status: lead", "opt-in: true"], channel: "whatsapp", estimatedContacts: 48, optedInContacts: 48, optedOutContacts: 0, unknownContacts: 0, consentRequired: true, isDemo: true },
  { id: "seg-demo-2", name: "Clientes ativos", description: "Clientes com projetos em andamento e opt-in confirmado.", filters: ["status: cliente_ativo", "opt-in: true"], channel: "email", estimatedContacts: 22, optedInContacts: 22, optedOutContacts: 0, unknownContacts: 0, consentRequired: true, isDemo: true },
  { id: "seg-demo-3", name: "Propostas pendentes", description: "Leads com proposta enviada nos últimos 14 dias.", filters: ["status: proposta_enviada"], channel: "whatsapp", estimatedContacts: 15, optedInContacts: 9, optedOutContacts: 2, unknownContacts: 4, consentRequired: true, isDemo: true },
];

const seedTemplates: MessageTemplate[] = [
  { id: "tpl-demo-1", name: "Lembrete de proposta", channel: "whatsapp", category: "reminder", status: "approved", body: "Olá {{nome}}, passando para lembrar da sua proposta. Posso ajudar com algo?", variables: ["nome"], isDemo: true },
  { id: "tpl-demo-2", name: "Boas-vindas cliente", channel: "whatsapp", category: "utility", status: "approved", body: "Bem-vindo(a) {{nome}}! Seu projeto foi iniciado. Qualquer dúvida estou por aqui.", variables: ["nome"], isDemo: true },
  { id: "tpl-demo-3", name: "Newsletter mensal", channel: "email", category: "marketing", status: "draft", body: "Olá {{nome}}, veja os destaques do mês no estúdio.", variables: ["nome"], isDemo: true },
  { id: "tpl-demo-4", name: "Lançamento de serviço", channel: "whatsapp", category: "marketing", status: "pending_approval", body: "Novidade! Acabamos de lançar {{servico}}. Quer saber mais?", variables: ["servico"], isDemo: true },
];

const seedConsents: ConsentRecord[] = [
  { id: "cs-demo-1", contactId: "ct-1", contactName: "Ana Lima", channel: "whatsapp", consentStatus: "opted_in", consentSource: "form", consentText: "Aceito receber comunicações sobre projetos.", consentDate: now(), isDemo: true },
  { id: "cs-demo-2", contactId: "ct-2", contactName: "Bruno Costa", channel: "email", consentStatus: "opted_in", consentSource: "checkout", consentText: "Autorizo emails de atualização.", consentDate: now(), isDemo: true },
  { id: "cs-demo-3", contactId: "ct-3", contactName: "Carla Souza", channel: "whatsapp", consentStatus: "opted_out", consentSource: "whatsapp", consentText: "Solicitou descadastro.", consentDate: now(), optOutDate: now(), isDemo: true },
  { id: "cs-demo-4", contactId: "ct-4", contactName: "Diego Reis", channel: "whatsapp", consentStatus: "unknown", consentSource: "import", consentText: "Origem desconhecida — pendente confirmação.", consentDate: now(), isDemo: true },
];

const seedCampaigns: Campaign[] = [
  { id: "cmp-demo-1", name: "Reativação de leads antigos", channel: "whatsapp", objective: "nurture", status: "draft", audienceSegmentId: "seg-demo-1", templateId: "tpl-demo-1", sentCount: 0, deliveredCount: 0, repliedCount: 0, optOutCount: 0, createdAt: now(), isDemo: true },
  { id: "cmp-demo-2", name: "Lembrete de proposta", channel: "whatsapp", objective: "reminder", status: "completed", audienceSegmentId: "seg-demo-3", templateId: "tpl-demo-1", sentCount: 9, deliveredCount: 9, repliedCount: 3, optOutCount: 1, createdAt: now(), isDemo: true },
  { id: "cmp-demo-3", name: "Lançamento de serviço", channel: "whatsapp", objective: "launch", status: "scheduled", audienceSegmentId: "seg-demo-2", templateId: "tpl-demo-4", scheduledAt: now(), sentCount: 0, deliveredCount: 0, repliedCount: 0, optOutCount: 0, createdAt: now(), isDemo: true },
];

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {}
  return fallback;
}

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => load(KEYS.campaigns, seedCampaigns));
  const [segments, setSegments] = useState<AudienceSegment[]>(() => load(KEYS.segments, seedSegments));
  const [consents, setConsents] = useState<ConsentRecord[]>(() => load(KEYS.consents, seedConsents));
  const [templates, setTemplates] = useState<MessageTemplate[]>(() => load(KEYS.templates, seedTemplates));

  useEffect(() => { try { localStorage.setItem(KEYS.campaigns, JSON.stringify(campaigns)); } catch {} }, [campaigns]);
  useEffect(() => { try { localStorage.setItem(KEYS.segments, JSON.stringify(segments)); } catch {} }, [segments]);
  useEffect(() => { try { localStorage.setItem(KEYS.consents, JSON.stringify(consents)); } catch {} }, [consents]);
  useEffect(() => { try { localStorage.setItem(KEYS.templates, JSON.stringify(templates)); } catch {} }, [templates]);

  const addCampaign = useCallback((data: Omit<Campaign, "id" | "createdAt" | "isDemo" | "sentCount" | "deliveredCount" | "repliedCount" | "optOutCount" | "status"> & { status?: CampaignStatus }) => {
    const c: Campaign = { ...data, status: data.status ?? "draft", id: `cmp-${Date.now()}`, createdAt: now(), isDemo: false, sentCount: 0, deliveredCount: 0, repliedCount: 0, optOutCount: 0 };
    setCampaigns((p) => [c, ...p]);
    return c.id;
  }, []);

  const simulateSend = useCallback((id: string) => {
    setCampaigns((p) => p.map((c) => {
      if (c.id !== id) return c;
      const seg = segments.find((s) => s.id === c.audienceSegmentId);
      const sent = seg?.optedInContacts ?? 0;
      const delivered = Math.floor(sent * 0.95);
      const replied = Math.floor(delivered * 0.18);
      const optOut = Math.floor(delivered * 0.02);
      return { ...c, status: "completed", sentCount: sent, deliveredCount: delivered, repliedCount: replied, optOutCount: optOut };
    }));
  }, [segments]);

  const deleteCampaign = useCallback((id: string) => setCampaigns((p) => p.filter((c) => c.id !== id)), []);

  const addSegment = useCallback((data: Omit<AudienceSegment, "id" | "consentRequired" | "isDemo" | "estimatedContacts" | "optedInContacts" | "optedOutContacts" | "unknownContacts"> & { estimatedContacts?: number }) => {
    const optedIn = consents.filter((c) => c.consentStatus === "opted_in" && c.channel === data.channel).length;
    const optedOut = consents.filter((c) => c.consentStatus === "opted_out" && c.channel === data.channel).length;
    const unknown = consents.filter((c) => c.consentStatus === "unknown" && c.channel === data.channel).length;
    const s: AudienceSegment = { ...data, id: `seg-${Date.now()}`, consentRequired: true, isDemo: false, estimatedContacts: data.estimatedContacts ?? optedIn, optedInContacts: optedIn, optedOutContacts: optedOut, unknownContacts: unknown };
    setSegments((p) => [s, ...p]);
    return s.id;
  }, [consents]);

  const deleteSegment = useCallback((id: string) => setSegments((p) => p.filter((s) => s.id !== id)), []);

  const addTemplate = useCallback((data: Omit<MessageTemplate, "id" | "isDemo" | "status"> & { status?: TemplateStatus }) => {
    const initialStatus: TemplateStatus = data.channel === "whatsapp" ? (data.status === "pending_approval" ? "pending_approval" : "draft") : (data.status ?? "draft");
    const t: MessageTemplate = { ...data, id: `tpl-${Date.now()}`, isDemo: false, status: initialStatus };
    setTemplates((p) => [t, ...p]);
    return t.id;
  }, []);

  const simulateApprove = useCallback((id: string) => setTemplates((p) => p.map((t) => t.id === id ? { ...t, status: "approved" } : t)), []);
  const deleteTemplate = useCallback((id: string) => setTemplates((p) => p.filter((t) => t.id !== id)), []);

  const setConsentStatus = useCallback((id: string, status: ConsentStatus) => {
    setConsents((p) => p.map((c) => c.id === id ? { ...c, consentStatus: status, optOutDate: status === "opted_out" ? now() : c.optOutDate } : c));
  }, []);

  const addConsent = useCallback((data: Omit<ConsentRecord, "id" | "isDemo" | "consentDate">) => {
    const c: ConsentRecord = { ...data, id: `cs-${Date.now()}`, isDemo: false, consentDate: now() };
    setConsents((p) => [c, ...p]);
    return c.id;
  }, []);

  return {
    campaigns, segments, consents, templates,
    addCampaign, simulateSend, deleteCampaign,
    addSegment, deleteSegment,
    addTemplate, simulateApprove, deleteTemplate,
    setConsentStatus, addConsent,
  };
}
