import { useCallback, useEffect, useState } from "react";

export type TaskPriority = "alta" | "média" | "baixa";
export type TaskStatus = "a_fazer" | "em_andamento" | "revisao" | "concluido";

export interface SubTask { text: string; done: boolean }
export interface TaskComment { author: string; text: string; date: string }

export interface Task {
  id: number;
  title: string;
  description: string;
  client: string;
  project: string;
  projectId?: string;
  priority: TaskPriority;
  deadline: string;
  status: TaskStatus;
  createdAt: string;
  tags: string[];
  subtasks: SubTask[];
  comments: TaskComment[];
  isDemo?: boolean;
}

const STORAGE_KEY = "orbyt.tasks.v1";

const rawDemo: Omit<Task, "isDemo">[] = [
  { id: 1, title: "Criar logo principal", description: "Desenvolver 3 propostas de logo para aprovação do cliente.", client: "Acme Corp", project: "Rebranding Acme 2025", priority: "alta", deadline: "18 Abr 2025", status: "em_andamento", createdAt: "05 Abr 2025", tags: ["branding", "logo"], subtasks: [{ text: "Pesquisa de referências", done: true }, { text: "Esboços iniciais", done: true }, { text: "Versão digital 1", done: false }, { text: "Apresentação ao cliente", done: false }], comments: [{ author: "Você", text: "Referências aprovadas.", date: "12 Abr" }] },
  { id: 2, title: "Wireframe da landing page", description: "Criar wireframe de alta fidelidade para a landing page.", client: "Studio Zen", project: "Landing Page Studio Zen", priority: "alta", deadline: "16 Abr 2025", status: "a_fazer", createdAt: "08 Abr 2025", tags: ["web", "wireframe"], subtasks: [{ text: "Estrutura de seções", done: false }, { text: "Wireframe mobile", done: false }], comments: [] },
  { id: 3, title: "Revisar proposta", description: "Ajustar proposta conforme feedback.", client: "Nova Design", project: "Catálogo Digital Nova", priority: "média", deadline: "20 Abr 2025", status: "revisao", createdAt: "10 Abr 2025", tags: ["proposta"], subtasks: [{ text: "Revisar escopo", done: true }, { text: "Aprovar valor", done: false }], comments: [] },
  { id: 4, title: "Publicar case no portfólio", description: "Subir o projeto da Acme no portfólio.", client: "Acme Corp", project: "Portfólio", priority: "baixa", deadline: "22 Abr 2025", status: "a_fazer", createdAt: "11 Abr 2025", tags: ["portfólio"], subtasks: [], comments: [] },
  { id: 5, title: "Aprovar calendário editorial", description: "Validar os 12 posts do mês.", client: "FitTrack", project: "Social Media FitTrack", priority: "alta", deadline: "15 Abr 2025", status: "concluido", createdAt: "08 Abr 2025", tags: ["social"], subtasks: [{ text: "Revisar copies", done: true }, { text: "Aprovar designs", done: true }], comments: [] },
];

export const initialTasks: Task[] = rawDemo.map((t) => ({ ...t, isDemo: true }));
const SEED_IDS = new Set(rawDemo.map((t) => t.id));

function migrate(list: Task[]): Task[] {
  return list.map((t) => (t.isDemo === undefined && SEED_IDS.has(t.id) ? { ...t, isDemo: true } : t));
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
    setTasks((prev) => [
      { ...data, id: Date.now(), createdAt: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }), isDemo: false },
      ...prev,
    ]);
  }, []);

  const moveTask = useCallback((id: number, status: TaskStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
  }, []);

  const toggleSubtask = useCallback((taskId: number, idx: number) => {
    setTasks((prev) => prev.map((t) => {
      if (t.id !== taskId) return t;
      const subs = [...t.subtasks];
      subs[idx] = { ...subs[idx], done: !subs[idx].done };
      return { ...t, subtasks: subs };
    }));
  }, []);

  const deleteTask = useCallback((id: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== id || t.isDemo));
  }, []);

  return { tasks, setTasks, addTask, moveTask, toggleSubtask, deleteTask };
}
