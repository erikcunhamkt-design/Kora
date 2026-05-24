import { useCallback, useEffect, useState } from "react";

export type TaskProjectType = "work" | "personal";

export interface TaskProject {
  id: string;
  name: string;
  color: string;
  clientId?: string;
  type: TaskProjectType;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  isSeed?: boolean;
}

const STORAGE_KEY = "kora.taskProjects.v1";

const PALETTE = [
  "#F81040", "#F59E0B", "#10B981", "#3B82F6",
  "#8B5CF6", "#EC4899", "#14B8A6", "#F97316",
];

const SEEDS: TaskProject[] = [
  { id: "tp-inbox",     name: "Entrada",     color: "#94A3B8", type: "work",     archived: false, createdAt: "", updatedAt: "", isSeed: true },
  { id: "tp-personal",  name: "Pessoal",     color: "#EC4899", type: "personal", archived: false, createdAt: "", updatedAt: "", isSeed: true },
  { id: "tp-work",      name: "Trabalho",    color: "#F81040", type: "work",     archived: false, createdAt: "", updatedAt: "", isSeed: true },
  { id: "tp-noproject", name: "Sem projeto", color: "#64748B", type: "work",     archived: false, createdAt: "", updatedAt: "", isSeed: true },
];

function migrate(list: TaskProject[]): TaskProject[] {
  const ids = new Set(list.map(p => p.id));
  const merged = [...list];
  SEEDS.forEach(s => { if (!ids.has(s.id)) merged.push(s); });
  return merged.map(p => ({
    ...p,
    archived: p.archived ?? false,
    type: p.type ?? "work",
    color: p.color || "#64748B",
  }));
}

export function useTaskProjects() {
  const [projects, setProjects] = useState<TaskProject[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return migrate(JSON.parse(raw) as TaskProject[]);
    } catch {}
    return SEEDS;
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); } catch {}
  }, [projects]);

  const addProject = useCallback((data: { name: string; type?: TaskProjectType; color?: string; clientId?: string }) => {
    const now = new Date().toISOString();
    const color = data.color || PALETTE[Math.floor(Math.random() * PALETTE.length)];
    const id = `tp-${Date.now()}`;
    setProjects(prev => [...prev, {
      id, name: data.name.trim(), color, clientId: data.clientId,
      type: data.type || "work", archived: false, createdAt: now, updatedAt: now,
    }]);
    return id;
  }, []);

  const renameProject = useCallback((id: string, name: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name: name.trim(), updatedAt: new Date().toISOString() } : p));
  }, []);

  const archiveProject = useCallback((id: string, archived = true) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, archived, updatedAt: new Date().toISOString() } : p));
  }, []);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id || p.isSeed));
  }, []);

  return { projects, addProject, renameProject, archiveProject, deleteProject };
}

export const TASK_PROJECT_PALETTE = PALETTE;
