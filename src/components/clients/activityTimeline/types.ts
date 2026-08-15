// Timeline de atividades do cliente — tipos compartilhados entre os
// construtores por domínio (buildCommercialEvents/buildFinanceEvents/
// buildProjectEvents/buildTaskEvents/buildMaterialEvents) e o merge com
// atividades manuais. Extraído de ClientActivitiesTab.tsx (etapa-5-flip-
// tarefas-pacote.md §4, refactor preventivo antes da bifurcação de Tarefas).
import type { ManualActivityType, ClientManualActivity } from "@/hooks/useClientActivityLogs";

export type ActivityCategory = "all" | "commercial" | "finance" | "projects" | "tasks" | "materials";

export type InferredType =
  | "client_created" | "client_updated" | "contact_added"
  | "opportunity_created" | "opportunity_won" | "opportunity_lost"
  | "quote_created" | "quote_sent" | "quote_approved" | "quote_rejected" | "quote_expired"
  | "receivable_created" | "receivable_paid" | "receivable_overdue"
  | "project_created" | "project_started" | "project_completed" | "project_cancelled"
  | "task_created" | "task_completed"
  | "material_added" | "technical_sheet_updated";

export type Tone = "neutral" | "success" | "warning" | "danger" | "primary";

export interface BaseEvent {
  id: string;
  category: Exclude<ActivityCategory, "all">;
  title: string;
  description?: string;
  date: string; // ISO
  status?: string;
  tone?: Tone;
  amount?: number;
  action?: { label: string; href: string };
}

export interface InferredEvent extends BaseEvent {
  origin: "inferred";
  type: InferredType;
}

export interface ManualEvent extends BaseEvent {
  origin: "manual";
  type: ManualActivityType;
  raw: ClientManualActivity;
}

export type ClientActivityEvent = InferredEvent | ManualEvent;
