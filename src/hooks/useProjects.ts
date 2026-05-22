import { useCallback, useEffect, useState } from "react";

export type ProjectStatus = "planning" | "in_progress" | "review" | "delivered" | "paused";
export type ProjectPriority = "low" | "medium" | "high";

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
  { id: "pj-demo-1", name: "Identidade visual Acme", clientName: "Acme Corp", description: "Rebranding completo com manual de marca.", serviceType: "Branding", status: "in_progress", priority: "high", startDate: addDays(-20), dueDate: addDays(10), budget: 8500, progress: 60, tags: ["branding", "logo"], createdAt: addDays(-20) },
  { id: "pj-demo-2", name: "Landing page Studio Zen", clientName: "Studio Zen", description: "Página institucional responsiva.", serviceType: "Web", status: "review", priority: "medium", startDate: addDays(-15), dueDate: addDays(4), budget: 4200, progress: 80, tags: ["web", "landing"], createdAt: addDays(-15) },
  { id: "pj-demo-3", name: "Social media mensal FitTrack", clientName: "FitTrack", description: "Pacote mensal de 12 posts e 8 stories.", serviceType: "Social", status: "in_progress", priority: "medium", startDate: addDays(-7), dueDate: addDays(23), budget: 1800, progress: 35, tags: ["social", "instagram"], createdAt: addDays(-7) },
  { id: "pj-demo-4", name: "Campanha de tráfego Nova", clientName: "Nova Design", description: "Gestão de tráfego pago Google e Meta.", serviceType: "Tráfego", status: "planning", priority: "high", startDate: addDays(3), dueDate: addDays(33), budget: 3500, progress: 10, tags: ["ads", "tráfego"], createdAt: addDays(-2) },
  { id: "pj-demo-5", name: "Rebranding Café & Arte", clientName: "Café & Arte", description: "Reposicionamento de marca completo.", serviceType: "Branding", status: "delivered", priority: "low", startDate: addDays(-60), dueDate: addDays(-5), budget: 6200, progress: 100, tags: ["branding", "entregue"], createdAt: addDays(-60) },
];

export const initialProjects: Project[] = rawDemo.map((p) => ({ ...p, isDemo: true }));
const SEED_IDS = new Set(rawDemo.map((p) => p.id));

function migrate(list: Project[]): Project[] {
  return list.map((p) => (p.isDemo === undefined && SEED_IDS.has(p.id) ? { ...p, isDemo: true } : p));
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return migrate(JSON.parse(raw) as Project[]);
    } catch {}
    return initialProjects;
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); } catch {}
  }, [projects]);

  const addProject = useCallback((data: Omit<Project, "id" | "isDemo" | "createdAt" | "progress"> & { progress?: number }) => {
    setProjects((prev) => [
      { ...data, progress: data.progress ?? 0, id: `pj-${Date.now()}`, createdAt: new Date().toISOString(), isDemo: false },
      ...prev,
    ]);
  }, []);

  const updateProjectStatus = useCallback((id: string, status: ProjectStatus) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
  }, []);

  const updateProjectProgress = useCallback((id: string, progress: number) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, progress: Math.max(0, Math.min(100, progress)) } : p)));
  }, []);

  const deleteProject = useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id || p.isDemo));
  }, []);

  return { projects, addProject, updateProjectStatus, updateProjectProgress, deleteProject };
}

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "Planejamento",
  in_progress: "Em andamento",
  review: "Em revisão",
  delivered: "Entregue",
  paused: "Pausado",
};

export const PROJECT_PRIORITY_LABEL: Record<ProjectPriority, string> = {
  low: "Baixa", medium: "Média", high: "Alta",
};
