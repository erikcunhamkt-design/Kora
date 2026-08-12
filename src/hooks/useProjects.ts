import { useCallback, useEffect, useState } from "react";

export type ProjectStatus =
  | "planning"
  | "in_progress"
  | "review"
  | "delivered"
  | "paused"
  | "cancelled"
  | "archived";
export type ProjectPriority = "low" | "medium" | "high";
export type ProjectSource = "manual" | "orçamento";

export interface ProjectDeliverable {
  id: string;
  title: string;
  description?: string;
  status: "pendente" | "em_andamento" | "concluido";
}

export interface Project {
  id: string;
  name: string;
  clientName: string;
  description?: string;
  serviceType?: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  startDate?: string;
  dueDate?: string;
  budget?: number;
  progress: number;
  tags: string[];
  createdAt: string;
  isDemo?: boolean;

  // --- v2 commercial linkage (all optional / backward-compatible) ---
  clientId?: number;
  company?: string;
  quoteId?: string;
  quoteTitle?: string;
  opportunityId?: number;
  opportunityTitle?: string;
  source?: ProjectSource;
  deliverables?: ProjectDeliverable[];
  notes?: string;
  updatedAt?: string;
  completedAt?: string;

  // Etapa 5 · Flip Projetos — presente só em projetos lidos da nuvem com
  // `status` bruto não reconhecido (mesmo padrão de Quote.cloudStatusRaw,
  // quoteMapper.ts). UI nunca mascara: mostra o status de fallback + este
  // valor bruto lado a lado.
  cloudStatusRaw?: string;
}

const STORAGE_KEY = "orbyt.projects.v1";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const today = new Date();
const addDays = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return iso(d);
};

const rawDemo: Omit<Project, "isDemo">[] = [
  { id: "pj-demo-1", name: "Identidade visual Acme", clientName: "Acme Corp", description: "Rebranding completo com manual de marca.", serviceType: "Branding", status: "in_progress", priority: "high", startDate: addDays(-20), dueDate: addDays(10), budget: 8500, progress: 60, tags: ["branding", "logo"], createdAt: addDays(-20), source: "manual" },
  { id: "pj-demo-2", name: "Landing page Studio Zen", clientName: "Studio Zen", description: "Página institucional responsiva.", serviceType: "Web", status: "review", priority: "medium", startDate: addDays(-15), dueDate: addDays(4), budget: 4200, progress: 80, tags: ["web", "landing"], createdAt: addDays(-15), source: "manual" },
  { id: "pj-demo-3", name: "Social media mensal FitTrack", clientName: "FitTrack", description: "Pacote mensal de 12 posts e 8 stories.", serviceType: "Social", status: "in_progress", priority: "medium", startDate: addDays(-7), dueDate: addDays(23), budget: 1800, progress: 35, tags: ["social", "instagram"], createdAt: addDays(-7), source: "manual" },
  { id: "pj-demo-4", name: "Campanha de tráfego Nova", clientName: "Nova Design", description: "Gestão de tráfego pago Google e Meta.", serviceType: "Tráfego", status: "planning", priority: "high", startDate: addDays(3), dueDate: addDays(33), budget: 3500, progress: 10, tags: ["ads", "tráfego"], createdAt: addDays(-2), source: "manual" },
  { id: "pj-demo-5", name: "Rebranding Café & Arte", clientName: "Café & Arte", description: "Reposicionamento de marca completo.", serviceType: "Branding", status: "delivered", priority: "low", startDate: addDays(-60), dueDate: addDays(-5), budget: 6200, progress: 100, tags: ["branding", "entregue"], createdAt: addDays(-60), source: "manual" },
];

export const initialProjects: Project[] = rawDemo.map((p) => ({ ...p, isDemo: true }));
const SEED_IDS = new Set(rawDemo.map((p) => p.id));

function migrate(list: Project[]): Project[] {
  return list.map((p) => ({
    ...p,
    isDemo: p.isDemo === undefined && SEED_IDS.has(p.id) ? true : p.isDemo,
    source: p.source ?? "manual",
  }));
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return migrate(JSON.parse(raw) as Project[]);
    } catch { /* intentionally empty */ }
    return initialProjects;
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); } catch { /* intentionally empty */ }
  }, [projects]);

  const addProject = useCallback((data: Omit<Project, "id" | "isDemo" | "createdAt" | "progress"> & { progress?: number }) => {
    const project: Project = {
      ...data,
      progress: data.progress ?? 0,
      id: `pj-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: data.source ?? "manual",
      isDemo: false,
    };
    setProjects((prev) => [project, ...prev]);
    return project;
  }, []);

  const updateProject = useCallback((id: string, patch: Partial<Project>) => {
    setProjects((prev) => prev.map((p) => {
      if (p.id !== id) return p;
      const next: Project = { ...p, ...patch, updatedAt: new Date().toISOString() };
      if (patch.status === "delivered" && !p.completedAt) next.completedAt = new Date().toISOString();
      return next;
    }));
  }, []);

  const updateProjectStatus = useCallback((id: string, status: ProjectStatus) => {
    updateProject(id, { status });
  }, [updateProject]);

  const updateProjectProgress = useCallback((id: string, progress: number) => {
    updateProject(id, { progress: Math.max(0, Math.min(100, progress)) });
  }, [updateProject]);

  const deleteProject = useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id || p.isDemo));
  }, []);

  return { projects, addProject, updateProject, updateProjectStatus, updateProjectProgress, deleteProject };
}

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "Planejado",
  in_progress: "Em andamento",
  review: "Em revisão",
  delivered: "Concluído",
  paused: "Pausado",
  cancelled: "Cancelado",
  archived: "Arquivado",
};

export const PROJECT_PRIORITY_LABEL: Record<ProjectPriority, string> = {
  low: "Baixa", medium: "Média", high: "Alta",
};
