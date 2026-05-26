import { useCallback, useEffect, useMemo, useState } from "react";

export type ManualActivityType =
  | "meeting"
  | "call"
  | "message"
  | "feedback"
  | "scope_change"
  | "material_request"
  | "decision"
  | "issue"
  | "internal_note"
  | "follow_up"
  | "other";

export const MANUAL_ACTIVITY_LABEL: Record<ManualActivityType, string> = {
  meeting: "Reunião",
  call: "Ligação",
  message: "Mensagem",
  feedback: "Feedback",
  scope_change: "Alteração de escopo",
  material_request: "Pedido de material",
  decision: "Decisão",
  issue: "Problema",
  internal_note: "Nota interna",
  follow_up: "Follow-up",
  other: "Outro",
};

export const MANUAL_ACTIVITY_TYPES: ManualActivityType[] = [
  "meeting", "call", "message", "feedback", "follow_up",
  "decision", "scope_change", "material_request", "issue",
  "internal_note", "other",
];

/** Mapeia tipo manual para a categoria usada pelos filtros da timeline. */
export function manualTypeToCategory(
  type: ManualActivityType,
): "commercial" | "finance" | "projects" | "tasks" | "materials" {
  switch (type) {
    case "scope_change":
    case "issue":
      return "projects";
    case "material_request":
      return "materials";
    default:
      return "commercial";
  }
}

export interface ClientManualActivity {
  id: string;
  clientId: number;
  type: ManualActivityType;
  title: string;
  description?: string;
  date: string; // ISO
  outcome?: string;
  nextStep?: string;
  /** Data planejada do próximo passo (yyyy-mm-dd ou ISO). Quando preenchida, entra na Central do Dia. */
  nextStepDate?: string;
  relatedContactId?: string;
  relatedProjectId?: string;
  relatedOpportunityId?: number;
  relatedQuoteId?: string;
  /** Marca quando o próximo passo foi resolvido. Quando preenchido, sai da Central do Dia. */
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "kora.client.activityLogs.v1";

export { STORAGE_KEY as CLIENT_ACTIVITY_LOGS_KEY };

function loadAll(): ClientManualActivity[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ClientManualActivity[]) : [];
  } catch {
    return [];
  }
}

function persist(list: ClientManualActivity[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

const SYNC_EVENT = "kora:client-activity-logs:changed";

function emitSync() {
  try { window.dispatchEvent(new Event(SYNC_EVENT)); } catch {}
}

function useAllLogsStore() {
  const [all, setAll] = useState<ClientManualActivity[]>(() => loadAll());

  useEffect(() => {
    const reload = () => setAll(loadAll());
    window.addEventListener(SYNC_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(SYNC_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  return [all, setAll] as const;
}

export function useClientActivityLogs(clientId?: number) {
  const [all, setAll] = useAllLogsStore();

  const logs = useMemo(
    () => (clientId == null ? all : all.filter((a) => a.clientId === clientId)),
    [all, clientId],
  );

  const commit = useCallback((next: ClientManualActivity[]) => {
    setAll(next);
    persist(next);
    emitSync();
  }, [setAll]);

  const addLog = useCallback(
    (data: Omit<ClientManualActivity, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString();
      const entry: ClientManualActivity = {
        ...data,
        id: `mact-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: now,
        updatedAt: now,
      };
      commit([entry, ...loadAll()]);
      return entry;
    },
    [commit],
  );

  const updateLog = useCallback(
    (id: string, patch: Partial<Omit<ClientManualActivity, "id" | "clientId" | "createdAt">>) => {
      const next = loadAll().map((a) =>
        a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a,
      );
      commit(next);
    },
    [commit],
  );

  const deleteLog = useCallback((id: string) => {
    commit(loadAll().filter((a) => a.id !== id));
  }, [commit]);

  return { logs, addLog, updateLog, deleteLog };
}

/** Hook somente-leitura para consumir todos os logs manuais agregados (Central do Dia). */
export function useAllClientActivityLogs(): ClientManualActivity[] {
  const [all] = useAllLogsStore();
  return all;
}
