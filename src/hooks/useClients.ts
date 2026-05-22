import { useEffect, useState, useCallback } from "react";

export type ClientStatus = "Ativo" | "Em negociação" | "Inativo" | "Potencial";

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
  lastProject: string;
  lastInteraction: string;
  observations: string;
  projects: { name: string; status: string }[];
  tasks: { name: string; done: boolean }[];
  /** Dados de demonstração — não contam para o limite do plano Free */
  isDemo?: boolean;
}

const STORAGE_KEY = "orbyt.clients.v1";

const rawInitialClients: Omit<Client, "isDemo">[] = [
  {
    id: 1, name: "Marina Costa", company: "Acme Corp", email: "marina@acme.com",
    phone: "(11) 99812-3456", whatsapp: "(11) 99812-3456", instagram: "@acmecorp",
    site: "acme.com", serviceType: "Branding", origin: "Indicação", status: "Ativo",
    potentialValue: 12000,
    lastProject: "Rebranding Acme 2025", lastInteraction: "12 Abr 2025",
    observations: "Cliente desde 2023. Prefere reuniões às terças.",
    projects: [{ name: "Rebranding Acme 2025", status: "Em andamento" }, { name: "Website Acme", status: "Concluído" }],
    tasks: [{ name: "Enviar proposta atualizada", done: false }, { name: "Revisão logo final", done: true }],
  },
  {
    id: 2, name: "Rafael Mendes", company: "Studio Zen", email: "rafael@studiozen.com",
    phone: "(21) 98765-4321", whatsapp: "(21) 98765-4321", instagram: "@studiozen",
    site: "studiozen.com", serviceType: "Web Design", origin: "Instagram", status: "Ativo",
    potentialValue: 8500,
    lastProject: "Landing Page Studio Zen", lastInteraction: "10 Abr 2025",
    observations: "Projeto recorrente mensal de social media.",
    projects: [{ name: "Landing Page Studio Zen", status: "Em andamento" }],
    tasks: [{ name: "Wireframe da home", done: false }],
  },
  {
    id: 3, name: "Camila Andrade", company: "Nova Design", email: "camila@novadesign.com",
    phone: "(31) 97654-3210", whatsapp: "(31) 97654-3210", instagram: "@novadesign",
    site: "novadesign.com", serviceType: "Design Gráfico", origin: "Site", status: "Em negociação",
    potentialValue: 4500,
    lastProject: "Catálogo Digital Nova", lastInteraction: "08 Abr 2025",
    observations: "Aguardando aprovação de orçamento.",
    projects: [{ name: "Catálogo Digital Nova", status: "Proposta" }],
    tasks: [{ name: "Montar orçamento detalhado", done: false }],
  },
  {
    id: 4, name: "Lucas Ferreira", company: "Tech Solutions", email: "lucas@techsol.com",
    phone: "(41) 96543-2109", whatsapp: "(41) 96543-2109", instagram: "@techsolutions",
    site: "techsol.com", serviceType: "Branding", origin: "LinkedIn", status: "Potencial",
    potentialValue: 6000,
    lastProject: "—", lastInteraction: "05 Jan 2025",
    observations: "Contato feito via LinkedIn. Interessado em identidade visual.",
    projects: [], tasks: [],
  },
  {
    id: 5, name: "Juliana Rocha", company: "Brand Co", email: "juliana@brandco.com",
    phone: "(51) 95432-1098", whatsapp: "(51) 95432-1098", instagram: "@brandco",
    site: "brandco.com", serviceType: "Social Media", origin: "Indicação", status: "Inativo",
    potentialValue: 0,
    lastProject: "Social Media Q3 2024", lastInteraction: "15 Jan 2025",
    observations: "Parou de contratar por corte de budget. Recontatar em 6 meses.",
    projects: [{ name: "Social Media Q3 2024", status: "Concluído" }, { name: "Branding Brand Co", status: "Concluído" }],
    tasks: [],
  },
  {
    id: 6, name: "Diego Martins", company: "StartUp X", email: "diego@startupx.io",
    phone: "(11) 94321-0987", whatsapp: "(11) 94321-0987", instagram: "@startupx",
    site: "startupx.io", serviceType: "Web Design", origin: "Site", status: "Em negociação",
    potentialValue: 2800,
    lastProject: "—", lastInteraction: "11 Abr 2025",
    observations: "Startup em estágio inicial. Budget limitado.",
    projects: [], tasks: [{ name: "Enviar portfólio", done: true }],
  },
  {
    id: 7, name: "Fernanda Lima", company: "FitTrack", email: "fernanda@fittrack.app",
    phone: "(21) 93210-9876", whatsapp: "(21) 93210-9876", instagram: "@fittrackapp",
    site: "fittrack.app", serviceType: "Design Gráfico", origin: "Indicação", status: "Ativo",
    potentialValue: 9000,
    lastProject: "App UI FitTrack", lastInteraction: "13 Abr 2025",
    observations: "Contrato mensal de design de interfaces.",
    projects: [{ name: "App UI FitTrack", status: "Em andamento" }],
    tasks: [{ name: "Entregar telas do onboarding", done: false }],
  },
  {
    id: 8, name: "André Souza", company: "Café & Arte", email: "andre@cafearte.com.br",
    phone: "(85) 92109-8765", whatsapp: "(85) 92109-8765", instagram: "@cafearte",
    site: "cafearte.com.br", serviceType: "Branding", origin: "Instagram", status: "Ativo",
    potentialValue: 5200,
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
    setClients((prev) => [
      {
        id: Date.now(),
        projects: [],
        tasks: [],
        lastProject: data.lastProject ?? "—",
        lastInteraction: data.lastInteraction ?? new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }),
        ...data,
        isDemo: false,
      } as Client,
      ...prev,
    ]);
  }, []);

  return { clients, addClient, setClients };
}
