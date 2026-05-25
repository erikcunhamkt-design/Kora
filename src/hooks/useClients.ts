import { useEffect, useState, useCallback } from "react";

export type ClientStatus = "Ativo" | "Em negociação" | "Inativo" | "Potencial" | "Arquivado";
export type ClientTemperature = "Frio" | "Morno" | "Quente";

export type ClientAssetType =
  | "drive" | "figma" | "canva" | "identidade_visual" | "tipografia"
  | "fotos_ensaios" | "videos" | "briefing" | "contrato" | "referencias"
  | "redes_sociais" | "outro";

export type ClientAssetAccessStatus =
  | "liberado" | "solicitar_acesso" | "publico" | "privado" | "expirado" | "revisar";

export const CLIENT_ASSET_TYPE_LABELS: Record<ClientAssetType, string> = {
  drive: "Google Drive",
  figma: "Figma",
  canva: "Canva",
  identidade_visual: "Identidade visual",
  tipografia: "Tipografias",
  fotos_ensaios: "Fotos/Ensaios",
  videos: "Vídeos",
  briefing: "Briefing",
  contrato: "Contrato",
  referencias: "Referências",
  redes_sociais: "Redes sociais",
  outro: "Outro",
};

export const CLIENT_ASSET_ACCESS_LABELS: Record<ClientAssetAccessStatus, string> = {
  liberado: "Acesso liberado",
  solicitar_acesso: "Precisa solicitar acesso",
  publico: "Link público",
  privado: "Link privado",
  expirado: "Expirado",
  revisar: "Revisar permissão",
};

export interface ClientAsset {
  id: string;
  title: string;
  type: ClientAssetType;
  url: string;
  description?: string;
  tags?: string[];
  accessStatus: ClientAssetAccessStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  site: string;
  serviceType: string;
  origin?: string;
  status: ClientStatus;
  potentialValue: number;
  /** Receita total já gerada (futuro: integra com Financeiro) */
  totalRevenue?: number;
  lastProject: string;
  lastInteraction: string;
  observations: string;
  projects: { name: string; status: string }[];
  tasks: { name: string; done: boolean }[];
  /** Dados de demonstração — não contam para o limite do plano Free */
  isDemo?: boolean;

  // --- Novos campos opcionais (preparação para CRM/Financeiro) ---
  document?: string;
  city?: string;
  state?: string;
  address?: string;
  tags?: string[];
  temperature?: ClientTemperature;
  nextAction?: string;
  nextActionDate?: string; // ISO date
  createdAt?: string;
  updatedAt?: string;
  archived?: boolean;
  assets?: ClientAsset[];
}

const STORAGE_KEY = "orbyt.clients.v1";

const rawInitialClients: Omit<Client, "isDemo">[] = [
  {
    id: 1, name: "Marina Costa", company: "Acme Corp", email: "marina@acme.com",
    phone: "(11) 99812-3456", whatsapp: "(11) 99812-3456", instagram: "@acmecorp",
    site: "acme.com", serviceType: "Branding", origin: "Indicação", status: "Ativo",
    potentialValue: 12000, totalRevenue: 28000, temperature: "Quente",
    nextAction: "Enviar proposta de retainer", nextActionDate: "2025-04-22",
    city: "São Paulo", state: "SP", tags: ["VIP", "Branding"],
    lastProject: "Rebranding Acme 2025", lastInteraction: "12 Abr 2025",
    observations: "Cliente desde 2023. Prefere reuniões às terças.",
    projects: [{ name: "Rebranding Acme 2025", status: "Em andamento" }, { name: "Website Acme", status: "Concluído" }],
    tasks: [{ name: "Enviar proposta atualizada", done: false }, { name: "Revisão logo final", done: true }],
  },
  {
    id: 2, name: "Rafael Mendes", company: "Studio Zen", email: "rafael@studiozen.com",
    phone: "(21) 98765-4321", whatsapp: "(21) 98765-4321", instagram: "@studiozen",
    site: "studiozen.com", serviceType: "Web Design", origin: "Instagram", status: "Ativo",
    potentialValue: 8500, totalRevenue: 14000, temperature: "Morno",
    nextAction: "Apresentar wireframe", nextActionDate: "2025-04-18",
    city: "Rio de Janeiro", state: "RJ", tags: ["Recorrente"],
    lastProject: "Landing Page Studio Zen", lastInteraction: "10 Abr 2025",
    observations: "Projeto recorrente mensal de social media.",
    projects: [{ name: "Landing Page Studio Zen", status: "Em andamento" }],
    tasks: [{ name: "Wireframe da home", done: false }],
  },
  {
    id: 3, name: "Camila Andrade", company: "Nova Design", email: "camila@novadesign.com",
    phone: "(31) 97654-3210", whatsapp: "(31) 97654-3210", instagram: "@novadesign",
    site: "novadesign.com", serviceType: "Design Gráfico", origin: "Site", status: "Em negociação",
    potentialValue: 4500, temperature: "Quente",
    nextAction: "Follow-up do orçamento", nextActionDate: "2025-04-17",
    city: "Belo Horizonte", state: "MG",
    lastProject: "Catálogo Digital Nova", lastInteraction: "08 Abr 2025",
    observations: "Aguardando aprovação de orçamento.",
    projects: [{ name: "Catálogo Digital Nova", status: "Proposta" }],
    tasks: [{ name: "Montar orçamento detalhado", done: false }],
  },
  {
    id: 4, name: "Lucas Ferreira", company: "Tech Solutions", email: "lucas@techsol.com",
    phone: "(41) 96543-2109", whatsapp: "(41) 96543-2109", instagram: "@techsolutions",
    site: "techsol.com", serviceType: "Branding", origin: "LinkedIn", status: "Potencial",
    potentialValue: 6000, temperature: "Frio",
    city: "Curitiba", state: "PR",
    lastProject: "—", lastInteraction: "05 Jan 2025",
    observations: "Contato feito via LinkedIn. Interessado em identidade visual.",
    projects: [], tasks: [],
  },
  {
    id: 5, name: "Juliana Rocha", company: "Brand Co", email: "juliana@brandco.com",
    phone: "(51) 95432-1098", whatsapp: "(51) 95432-1098", instagram: "@brandco",
    site: "brandco.com", serviceType: "Social Media", origin: "Indicação", status: "Inativo",
    potentialValue: 0, totalRevenue: 9000, temperature: "Frio",
    city: "Porto Alegre", state: "RS",
    lastProject: "Social Media Q3 2024", lastInteraction: "15 Jan 2025",
    observations: "Parou de contratar por corte de budget. Recontatar em 6 meses.",
    projects: [{ name: "Social Media Q3 2024", status: "Concluído" }, { name: "Branding Brand Co", status: "Concluído" }],
    tasks: [],
  },
  {
    id: 6, name: "Diego Martins", company: "StartUp X", email: "diego@startupx.io",
    phone: "(11) 94321-0987", whatsapp: "(11) 94321-0987", instagram: "@startupx",
    site: "startupx.io", serviceType: "Web Design", origin: "Site", status: "Em negociação",
    potentialValue: 2800, temperature: "Morno",
    nextAction: "Enviar portfólio detalhado",
    city: "São Paulo", state: "SP",
    lastProject: "—", lastInteraction: "11 Abr 2025",
    observations: "Startup em estágio inicial. Budget limitado.",
    projects: [], tasks: [{ name: "Enviar portfólio", done: true }],
  },
  {
    id: 7, name: "Fernanda Lima", company: "FitTrack", email: "fernanda@fittrack.app",
    phone: "(21) 93210-9876", whatsapp: "(21) 93210-9876", instagram: "@fittrackapp",
    site: "fittrack.app", serviceType: "Design Gráfico", origin: "Indicação", status: "Ativo",
    potentialValue: 9000, totalRevenue: 22000, temperature: "Quente",
    nextAction: "Entregar telas do onboarding", nextActionDate: "2025-04-20",
    city: "Rio de Janeiro", state: "RJ", tags: ["Recorrente", "VIP"],
    lastProject: "App UI FitTrack", lastInteraction: "13 Abr 2025",
    observations: "Contrato mensal de design de interfaces.",
    projects: [{ name: "App UI FitTrack", status: "Em andamento" }],
    tasks: [{ name: "Entregar telas do onboarding", done: false }],
  },
  {
    id: 8, name: "André Souza", company: "Café & Arte", email: "andre@cafearte.com.br",
    phone: "(85) 92109-8765", whatsapp: "(85) 92109-8765", instagram: "@cafearte",
    site: "cafearte.com.br", serviceType: "Branding", origin: "Instagram", status: "Ativo",
    potentialValue: 5200, totalRevenue: 7800, temperature: "Morno",
    nextAction: "Enviar proposta pacote mensal", nextActionDate: "2025-04-19",
    city: "Fortaleza", state: "CE",
    lastProject: "Identidade Visual Café & Arte", lastInteraction: "09 Abr 2025",
    observations: "Projeto de branding completo entregue. Avaliando pacote mensal.",
    projects: [{ name: "Identidade Visual Café & Arte", status: "Concluído" }],
    tasks: [{ name: "Proposta pacote mensal", done: false }],
  },
];

export const initialClients: Client[] = rawInitialClients.map((c) => ({ ...c, isDemo: true }));

const SEED_IDS = new Set(rawInitialClients.map((c) => c.id));

function migrate(list: Client[]): Client[] {
  return list.map((c) =>
    c.isDemo === undefined && SEED_IDS.has(c.id) ? { ...c, isDemo: true } : c
  );
}

export function useClients() {
  const [clients, setClients] = useState<Client[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return migrate(JSON.parse(raw) as Client[]);
    } catch {}
    return initialClients;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
    } catch {}
  }, [clients]);

  const addClient = useCallback((data: Omit<Client, "id" | "projects" | "tasks" | "lastProject" | "lastInteraction" | "isDemo"> & Partial<Pick<Client, "lastInteraction" | "lastProject">>) => {
    const now = new Date().toISOString();
    setClients((prev) => [
      {
        id: Date.now(),
        projects: [],
        tasks: [],
        lastProject: data.lastProject ?? "—",
        lastInteraction: data.lastInteraction ?? new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }),
        createdAt: now,
        updatedAt: now,
        ...data,
        isDemo: false,
      } as Client,
      ...prev,
    ]);
  }, []);

  const updateClient = useCallback((id: number, patch: Partial<Client>) => {
    setClients((prev) => prev.map((c) => c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c));
  }, []);

  const archiveClient = useCallback((id: number) => {
    setClients((prev) => prev.map((c) => c.id === id ? { ...c, archived: true, status: "Arquivado" as ClientStatus, updatedAt: new Date().toISOString() } : c));
  }, []);

  const restoreClient = useCallback((id: number) => {
    setClients((prev) => prev.map((c) => c.id === id ? { ...c, archived: false, status: "Ativo" as ClientStatus, updatedAt: new Date().toISOString() } : c));
  }, []);

  const deleteClient = useCallback((id: number) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return { clients, addClient, updateClient, archiveClient, restoreClient, deleteClient, setClients };
}
