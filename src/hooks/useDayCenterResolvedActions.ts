import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "kora.dayCenter.resolvedActions.v1";

export type DayCenterResolvedActionType =
  | "task_completed"
  | "manual_followup_resolved"
  | "receivable_paid";

export type DayCenterRelatedType = "task" | "manual_activity" | "finance_transaction";

export interface DayCenterResolvedAction {
  id: string;
  type: DayCenterResolvedActionType;
  relatedId: string;
  relatedType: DayCenterRelatedType;
  title: string;
  clientId?: number;
  amount?: number;
  resolvedAt: string;
  source: "day_center";
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function readStorage(): DayCenterResolvedAction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a: unknown): a is DayCenterResolvedAction =>
        !!a &&
        typeof a === "object" &&
        typeof (a as DayCenterResolvedAction).id === "string" &&
        typeof (a as DayCenterResolvedAction).type === "string" &&
        typeof (a as DayCenterResolvedAction).relatedId === "string" &&
        typeof (a as DayCenterResolvedAction).resolvedAt === "string",
    );
  } catch {
    return [];
  }
}

function writeStorage(actions: DayCenterResolvedAction[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
  } catch {
    /* ignore */
  }
}

const EVENT = "kora:day-center-resolved-changed";

export function useDayCenterResolvedActions() {
  const [actions, setActions] = useState<DayCenterResolvedAction[]>(() => readStorage());

  useEffect(() => {
    const refresh = () => setActions(readStorage());
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const addAction = useCallback(
    (input: Omit<DayCenterResolvedAction, "id" | "source" | "resolvedAt"> & { resolvedAt?: string }) => {
      const resolvedAt = input.resolvedAt ?? new Date().toISOString();
      const current = readStorage();
      // dedupe: same relatedId + type on same day
      const dup = current.find(
        (a) => a.relatedId === input.relatedId && a.type === input.type && isToday(a.resolvedAt),
      );
      if (dup) return dup;
      const action: DayCenterResolvedAction = {
        id: `dcra-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        source: "day_center",
        resolvedAt,
        ...input,
      };
      const next = [action, ...current];
      writeStorage(next);
      setActions(next);
      window.dispatchEvent(new Event(EVENT));
      return action;
    },
    [],
  );

  const todayActions = actions.filter((a) => isToday(a.resolvedAt));

  return {
    actions,
    todayActions,
    todayCount: todayActions.length,
    addAction,
  };
}
