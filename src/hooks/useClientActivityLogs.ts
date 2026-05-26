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
  relatedContactId?: string;
  relatedProjectId?: string;
  relatedOpportunityId?: number;
  relatedQuoteId?: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "kora.client.activityLogs.v1";

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

export function useClientActivityLogs(clientId?: number) {
  const [all, setAll] = useState<ClientManualActivity[]>(() => loadAll());

  useEffect(() => {
    persist(all);
  }, [all]);

  const logs = useMemo(
    () => (clientId == null ? [] : all.filter((a) => a.clientId === clientId)),
    [all, clientId],
  );

  const addLog = useCallback(
    (data: Omit<ClientManualActivity, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString();
      const entry: ClientManualActivity = {
        ...data,
        id: `mact-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: now,
        updatedAt: now,
      };
      setAll((prev) => [entry, ...prev]);
      return entry;
    },
    [],
  );

  const updateLog = useCallback(
    (id: string, patch: Partial<Omit<ClientManualActivity, "id" | "clientId" | "createdAt">>) => {
      setAll((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a)),
      );
    },
    [],
  );

  const deleteLog = useCallback((id: string) => {
    setAll((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { logs, addLog, updateLog, deleteLog };
}
