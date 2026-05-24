import { useCallback, useEffect, useState } from "react";
import { emitNotification } from "@/lib/notify";

export type AutomationTrigger = "new_lead" | "new_client" | "quote_approved" | "task_overdue" | "whatsapp_keyword" | "manual";
export type AutomationAction = "create_task" | "send_message" | "move_pipeline" | "notify" | "add_tag";

export interface AutomationRule {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  action: AutomationAction;
  description: string;
  active: boolean;
  createdAt: string;
  isDemo: boolean;
}

const STORAGE_KEY = "orbyt.automations.v1";

const seed: AutomationRule[] = [
  { id: "auto-demo-1", name: "Follow-up de novo lead", trigger: "new_lead", action: "create_task", description: "Cria tarefa de follow-up sempre que um novo lead entrar.", active: true, createdAt: new Date().toISOString(), isDemo: true },
  { id: "auto-demo-2", name: "Orçamento aprovado vira projeto", trigger: "quote_approved", action: "create_task", description: "Quando o orçamento for aprovado, cria projeto e tarefas iniciais.", active: true, createdAt: new Date().toISOString(), isDemo: true },
  { id: "auto-demo-3", name: "Notificar tarefa atrasada", trigger: "task_overdue", action: "notify", description: "Envia notificação quando uma tarefa estiver atrasada.", active: true, createdAt: new Date().toISOString(), isDemo: true },
  { id: "auto-demo-4", name: "Tag 'orçamento' no WhatsApp", trigger: "whatsapp_keyword", action: "add_tag", description: "Adiciona a tag 'orçamento' quando essa palavra aparecer na conversa.", active: false, createdAt: new Date().toISOString(), isDemo: true },
];

export function useAutomations() {
  const [rules, setRules] = useState<AutomationRule[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return seed;
  });
  const [executions, setExecutions] = useState(0);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rules)); } catch {}
  }, [rules]);

  const addRule = useCallback((data: Omit<AutomationRule, "id" | "createdAt" | "isDemo">) => {
    setRules((prev) => [
      { ...data, id: `auto-${Date.now()}`, createdAt: new Date().toISOString(), isDemo: false },
      ...prev,
    ]);
  }, []);

  const toggleRule = useCallback((id: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r)));
  }, []);

  const deleteRule = useCallback((id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const simulateExecution = useCallback(() => setExecutions((n) => n + 1), []);

  return { rules, executions, addRule, toggleRule, deleteRule, simulateExecution };
}
