import { useCallback, useEffect, useState } from "react";

export interface AutomationActions {
  addTag?: string;
  setNextAction?: string;
  markWon?: boolean;
  markLost?: boolean;
  toast?: string;
}

export interface AutomationRule {
  id: string;
  pipelineId: string;
  triggerStageId: string;
  actions: AutomationActions;
  enabled: boolean;
}

const STORAGE_KEY = "kora.crm.pipelineAutomations.v1";

const newId = () => `a_${Math.random().toString(36).slice(2, 9)}`;

function load(): AutomationRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function usePipelineAutomations() {
  const [rules, setRules] = useState<AutomationRule[]>(() => load());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
    } catch {}
  }, [rules]);

  const addRule = useCallback(
    (data: Omit<AutomationRule, "id">) =>
      setRules((p) => [...p, { ...data, id: newId() }]),
    []
  );
  const updateRule = useCallback(
    (id: string, patch: Partial<AutomationRule>) =>
      setRules((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r))),
    []
  );
  const deleteRule = useCallback(
    (id: string) => setRules((p) => p.filter((r) => r.id !== id)),
    []
  );

  const getRulesForPipeline = useCallback(
    (pipelineId: string) => rules.filter((r) => r.pipelineId === pipelineId),
    [rules]
  );

  return { rules, addRule, updateRule, deleteRule, getRulesForPipeline };
}
