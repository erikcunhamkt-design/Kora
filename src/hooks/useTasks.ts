import { useCallback, useEffect, useState } from "react";

export type TaskPriority = "alta" | "média" | "baixa";
export type TaskStatus = "a_fazer" | "em_andamento" | "revisao" | "concluido";
export type TaskRecurrence = "none" | "daily" | "weekly" | "monthly" | "weekdays";
export type TaskScope = "work" | "personal";

export interface SubTask { text: string; done: boolean }
export interface TaskComment { author: string; text: string; date: string }

export type TaskSource = "manual" | "projeto" | "orçamento";

export interface Task {
  id: number;
  title: string;
  description: string;
  client: string;
  project: string;
  projectId?: string;
  /** ID do projeto de tarefa (useTaskProjects) — separado de projectId de useProjects */
  taskProjectId?: string;
  scope?: TaskScope;
  priority: TaskPriority;
  /** Display string em pt-BR — mantido por compatibilidade */
  deadline: string;
  /** ISO yyyy-mm-dd quando houver — fonte preferencial para filtros */
  dueDate?: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt?: string;
  tags: string[];
  subtasks: SubTask[];
  comments: TaskComment[];
  recurrence?: TaskRecurrence;
  archived?: boolean;
  isDemo?: boolean;
  /** Lembrete local — ISO datetime */
  reminderAt?: string;
  reminderEnabled?: boolean;
  reminderSentAt?: string;
  // --- v2 commercial linkage (optional) ---
  clientId?: number;
  quoteId?: string;
  milestoneId?: string;
  source?: TaskSource;
}


const STORAGE_KEY = "orbyt.tasks.v1";

const PT_MONTHS: Record<string, number> = {
  jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5,
  jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11,
};

const pad = (n: number) => String(n).padStart(2, "0");

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parsePtBrDate(s?: string): string | undefined {
  if (!s) return undefined;
  const m = s.toLowerCase().match(/(\d{1,2})\s+([a-zç]{3,})\.?\s+(\d{4})/);
  if (!m) return undefined;
  const month = PT_MONTHS[m[2].slice(0, 3)];
  if (month === undefined) return undefined;
  const d = new Date(Number(m[3]), month, Number(m[1]));
  if (isNaN(d.getTime())) return undefined;
  return toIsoDate(d);
}

export function formatPtBr(iso?: string): string {
  if (!iso) return "—";
  const [y, mo, d] = iso.split("-").map(Number);
  if (!y) return "—";
  const date = new Date(y, mo - 1, d);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

const rawDemo: Omit<Task, "isDemo">[] = [
  { id: 1, title: "Criar logo principal", description: "Desenvolver 3 propostas de logo para aprovação do cliente.", client: "Acme Corp", project: "Rebranding Acme 2025", priority: "alta", deadline: "18 Abr 2025", status: "em_andamento", createdAt: "05 Abr 2025", tags: ["branding", "logo"], subtasks: [{ text: "Pesquisa de referências", done: true }, { text: "Esboços iniciais", done: true }, { text: "Versão digital 1", done: false }, { text: "Apresentação ao cliente", done: false }], comments: [{ author: "Você", text: "Referências aprovadas.", date: "12 Abr" }] },
  { id: 2, title: "Wireframe da landing page", description: "Criar wireframe de alta fidelidade para a landing page.", client: "Studio Zen", project: "Landing Page Studio Zen", priority: "alta", deadline: "16 Abr 2025", status: "a_fazer", createdAt: "08 Abr 2025", tags: ["web", "wireframe"], subtasks: [{ text: "Estrutura de seções", done: false }, { text: "Wireframe mobile", done: false }], comments: [] },
  { id: 3, title: "Revisar proposta", description: "Ajustar proposta conforme feedback.", client: "Nova Design", project: "Catálogo Digital Nova", priority: "média", deadline: "20 Abr 2025", status: "revisao", createdAt: "10 Abr 2025", tags: ["proposta"], subtasks: [{ text: "Revisar escopo", done: true }, { text: "Aprovar valor", done: false }], comments: [] },
  { id: 4, title: "Publicar case no portfólio", description: "Subir o projeto da Acme no portfólio.", client: "Acme Corp", project: "Portfólio", priority: "baixa", deadline: "22 Abr 2025", status: "a_fazer", createdAt: "11 Abr 2025", tags: ["portfólio"], subtasks: [], comments: [] },
  { id: 5, title: "Aprovar calendário editorial", description: "Validar os 12 posts do mês.", client: "FitTrack", project: "Social Media FitTrack", priority: "alta", deadline: "15 Abr 2025", status: "concluido", createdAt: "08 Abr 2025", tags: ["social"], subtasks: [{ text: "Revisar copies", done: true }, { text: "Aprovar designs", done: true }], comments: [] },
];

export const initialTasks: Task[] = rawDemo.map((t) => ({
  ...t,
  isDemo: true,
  dueDate: parsePtBrDate(t.deadline),
  archived: false,
  recurrence: "none",
}));
const SEED_IDS = new Set(rawDemo.map((t) => t.id));

function migrate(list: Task[]): Task[] {
  return list.map((t) => ({
    ...t,
    isDemo: t.isDemo === undefined && SEED_IDS.has(t.id) ? true : t.isDemo,
    dueDate: t.dueDate ?? parsePtBrDate(t.deadline),
    archived: t.archived ?? false,
    recurrence: t.recurrence ?? "none",
    scope: t.scope ?? (t.client ? "work" : (t.scope || "work")),
    taskProjectId: t.taskProjectId ?? (t.project && t.project.trim() !== "" ? undefined : "tp-noproject"),
    reminderEnabled: t.reminderEnabled ?? false,
  }));
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return migrate(JSON.parse(raw) as Task[]);
    } catch {}
    return initialTasks;
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch {}
  }, [tasks]);

  const addTask = useCallback((data: Omit<Task, "id" | "isDemo" | "createdAt">) => {
    const nowIso = new Date().toISOString();
    const display = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
    setTasks((prev) => [
      {
        ...data,
        deadline: data.deadline || (data.dueDate ? formatPtBr(data.dueDate) : "—"),
        dueDate: data.dueDate ?? parsePtBrDate(data.deadline),
        archived: data.archived ?? false,
        recurrence: data.recurrence ?? "none",
        id: Date.now(),
        createdAt: display,
        updatedAt: nowIso,
        isDemo: false,
      },
      ...prev,
    ]);
  }, []);

  const updateTask = useCallback((id: number, patch: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      const next = { ...t, ...patch, updatedAt: new Date().toISOString() };
      if (patch.dueDate !== undefined) next.deadline = formatPtBr(patch.dueDate);
      return next;
    }));
  }, []);

  const moveTask = useCallback((id: number, status: TaskStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t)));
  }, []);

  const toggleSubtask = useCallback((taskId: number, idx: number) => {
    setTasks((prev) => prev.map((t) => {
      if (t.id !== taskId) return t;
      const subs = [...t.subtasks];
      subs[idx] = { ...subs[idx], done: !subs[idx].done };
      return { ...t, subtasks: subs, updatedAt: new Date().toISOString() };
    }));
  }, []);

  const addSubtask = useCallback((taskId: number, text: string) => {
    setTasks((prev) => prev.map((t) =>
      t.id === taskId ? { ...t, subtasks: [...t.subtasks, { text, done: false }], updatedAt: new Date().toISOString() } : t
    ));
  }, []);

  const duplicateTask = useCallback((id: number) => {
    setTasks((prev) => {
      const src = prev.find((t) => t.id === id);
      if (!src) return prev;
      return [
        { ...src, id: Date.now(), title: `${src.title} (cópia)`, isDemo: false, status: "a_fazer", createdAt: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }), updatedAt: new Date().toISOString() },
        ...prev,
      ];
    });
  }, []);

  const archiveTask = useCallback((id: number, archived = true) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, archived, updatedAt: new Date().toISOString() } : t)));
  }, []);

  const deleteTask = useCallback((id: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== id || t.isDemo));
  }, []);

  return { tasks, setTasks, addTask, updateTask, moveTask, toggleSubtask, addSubtask, duplicateTask, archiveTask, deleteTask };
}
