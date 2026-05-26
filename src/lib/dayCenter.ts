/**
 * Day Center — lógica local que calcula o que precisa de atenção HOJE.
 * Não usa backend. Não inventa dados. Só lê dos hooks locais.
 */
import type { Task } from "@/hooks/useTasks";
import type { Lead } from "@/hooks/useLeads";
import type { Quote } from "@/hooks/useQuotes";
import type { Transaction } from "@/hooks/useFinance";
import type { Project } from "@/hooks/useProjects";
import type { Client } from "@/hooks/useClients";
import type { ClientManualActivity, ManualActivityType } from "@/hooks/useClientActivityLogs";

export type DayPriority = "critical" | "high" | "medium" | "low";
export type DayCategory =
  | "task"
  | "commercial"
  | "finance"
  | "project"
  | "client"
  | "quote";

export interface DayActionItem {
  id: string;
  category: DayCategory;
  priority: DayPriority;
  title: string;
  description?: string;
  dueDate?: string;
  amount?: number;
  clientId?: number;
  clientName?: string;
  relatedId?: string | number;
  relatedType?: string;
  actionLabel?: string;
  route?: string;
  icon?: string; // identifier for the renderer
}

const PRIORITY_WEIGHT: Record<DayPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const MANUAL_TYPE_TO_DAY_CATEGORY: Record<ManualActivityType, DayCategory> = {
  meeting: "commercial",
  call: "commercial",
  message: "commercial",
  feedback: "commercial",
  follow_up: "commercial",
  decision: "commercial",
  scope_change: "project",
  issue: "project",
  material_request: "client",
  internal_note: "client",
  other: "client",
};

const MANUAL_TYPE_LABEL: Record<ManualActivityType, string> = {
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
  other: "Atividade",
};

const pad = (n: number) => String(n).padStart(2, "0");
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA + "T00:00:00");
  const b = new Date(isoB + "T00:00:00");
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

function addDaysIso(isoStart: string, days: number): string {
  const d = new Date(isoStart + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function safeIso(s?: string): string | undefined {
  if (!s) return undefined;
  // Accept already-ISO yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // Try Date parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return undefined;
}

export interface DayCenterInputs {
  tasks: Task[];
  leads: Lead[];
  quotes: Quote[];
  transactions: Transaction[];
  projects: Project[];
  clients: Client[];
  manualActivities?: ClientManualActivity[];
}

export interface DayCenterResult {
  items: DayActionItem[];
  byCategory: Record<DayCategory, DayActionItem[]>;
  topAction: DayActionItem | null;
  counts: {
    today: number;
    overdue: number;
    followUps: number;
    receivables: number;
    projectsAttention: number;
    total: number;
    critical: number;
    high: number;
  };
}

export function computeDayCenter(inputs: DayCenterInputs): DayCenterResult {
  const today = todayISO();
  const items: DayActionItem[] = [];

  // ===== TAREFAS =====
  for (const t of inputs.tasks) {
    if (t.status === "concluido" || t.archived) continue;
    const due = safeIso(t.dueDate);
    if (due) {
      const diff = daysBetween(due, today);
      if (diff < 0) {
        items.push({
          id: `task-${t.id}`,
          category: "task",
          priority: "critical",
          title: t.title,
          description: `${t.client || "Sem cliente"} · atrasada ${Math.abs(diff)}d`,
          dueDate: due,
          relatedId: t.id,
          relatedType: "task",
          clientId: t.clientId,
          clientName: t.client,
          actionLabel: "Abrir tarefa",
          route: `/tarefas?task=${t.id}`,
          icon: "task",
        });
      } else if (diff === 0) {
        items.push({
          id: `task-${t.id}`,
          category: "task",
          priority: t.priority === "alta" ? "high" : "medium",
          title: t.title,
          description: `${t.client || "Sem cliente"} · vence hoje`,
          dueDate: due,
          relatedId: t.id,
          relatedType: "task",
          clientId: t.clientId,
          clientName: t.client,
          actionLabel: "Abrir tarefa",
          route: `/tarefas?task=${t.id}`,
          icon: "task",
        });
      }
    } else if (t.priority === "alta") {
      items.push({
        id: `task-${t.id}`,
        category: "task",
        priority: "medium",
        title: t.title,
        description: `${t.client || "Sem cliente"} · alta prioridade, sem data`,
        relatedId: t.id,
        relatedType: "task",
        clientName: t.client,
        actionLabel: "Abrir tarefa",
        route: `/tarefas?task=${t.id}`,
        icon: "task",
      });
    }
  }

  // ===== FOLLOW-UPS (LEADS) =====
  for (const l of inputs.leads) {
    if (["fechado", "perdido"].includes(l.stage)) continue;
    if (l.archived) continue;
    const due = safeIso(l.nextActionDate);
    if (due) {
      const diff = daysBetween(due, today);
      if (diff < 0) {
        items.push({
          id: `lead-${l.id}`,
          category: "commercial",
          priority: "critical",
          title: l.nextAction || `Retomar ${l.name}`,
          description: `${l.name} · ${l.company} · atrasado ${Math.abs(diff)}d`,
          dueDate: due,
          amount: l.estimatedValue,
          clientId: l.clientId,
          clientName: l.company,
          relatedId: l.id,
          relatedType: "lead",
          actionLabel: "Ver oportunidade",
          route: `/crm?lead=${l.id}`,
          icon: "lead",
        });
      } else if (diff === 0) {
        items.push({
          id: `lead-${l.id}`,
          category: "commercial",
          priority: "high",
          title: l.nextAction || `Follow-up com ${l.name}`,
          description: `${l.name} · ${l.company} · hoje`,
          dueDate: due,
          amount: l.estimatedValue,
          clientId: l.clientId,
          clientName: l.company,
          relatedId: l.id,
          relatedType: "lead",
          actionLabel: "Ver oportunidade",
          route: `/crm?lead=${l.id}`,
          icon: "lead",
        });
      } else if (diff <= 7) {
        items.push({
          id: `lead-${l.id}`,
          category: "commercial",
          priority: "medium",
          title: l.nextAction || `Follow-up com ${l.name}`,
          description: `${l.name} · ${l.company} · em ${diff}d`,
          dueDate: due,
          amount: l.estimatedValue,
          clientId: l.clientId,
          clientName: l.company,
          relatedId: l.id,
          relatedType: "lead",
          actionLabel: "Ver oportunidade",
          route: `/crm?lead=${l.id}`,
          icon: "lead",
        });
      }
    } else if (l.priority === "alta" && l.nextAction) {
      items.push({
        id: `lead-${l.id}`,
        category: "commercial",
        priority: "medium",
        title: l.nextAction,
        description: `${l.name} · ${l.company} · sem data`,
        amount: l.estimatedValue,
        clientId: l.clientId,
        clientName: l.company,
        relatedId: l.id,
        relatedType: "lead",
        actionLabel: "Ver oportunidade",
        route: `/crm?lead=${l.id}`,
        icon: "lead",
      });
    }
  }

  // ===== ORÇAMENTOS =====
  for (const q of inputs.quotes) {
    if (q.status === "arquivado" || q.status === "recusado") continue;
    const created = safeIso(q.createdAt);
    const expires = created
      ? addDaysIso(created, Math.max(q.validityDays || 0, 0))
      : undefined;

    if (q.status === "enviado" && expires) {
      const diff = daysBetween(expires, today);
      if (diff < 0) {
        items.push({
          id: `quote-${q.id}`,
          category: "quote",
          priority: "critical",
          title: `Orçamento vencido · ${q.title}`,
          description: `${q.clientName} · venceu há ${Math.abs(diff)}d`,
          dueDate: expires,
          amount: q.total,
          clientId: q.clientId,
          clientName: q.clientName,
          relatedId: q.id,
          relatedType: "quote",
          actionLabel: "Ver orçamento",
          route: `/vendas?tab=orcamentos&quote=${q.id}`,
          icon: "quote",
        });
      } else if (diff <= 3) {
        items.push({
          id: `quote-${q.id}`,
          category: "quote",
          priority: "high",
          title: `Orçamento vence em ${diff}d · ${q.title}`,
          description: `${q.clientName}`,
          dueDate: expires,
          amount: q.total,
          clientId: q.clientId,
          clientName: q.clientName,
          relatedId: q.id,
          relatedType: "quote",
          actionLabel: "Ver orçamento",
          route: `/vendas?tab=orcamentos&quote=${q.id}`,
          icon: "quote",
        });
      } else if (diff <= 7) {
        items.push({
          id: `quote-${q.id}`,
          category: "quote",
          priority: "medium",
          title: `Orçamento vence em ${diff}d · ${q.title}`,
          description: `${q.clientName}`,
          dueDate: expires,
          amount: q.total,
          clientId: q.clientId,
          clientName: q.clientName,
          relatedId: q.id,
          relatedType: "quote",
          actionLabel: "Ver orçamento",
          route: `/vendas?tab=orcamentos&quote=${q.id}`,
          icon: "quote",
        });
      }
    }

    if (q.status === "aprovado" && !q.financeEntryId) {
      items.push({
        id: `quote-recv-${q.id}`,
        category: "quote",
        priority: "high",
        title: `Aprovado sem recebível · ${q.title}`,
        description: `${q.clientName} · gerar conta a receber`,
        amount: q.total,
        clientId: q.clientId,
        clientName: q.clientName,
        relatedId: q.id,
        relatedType: "quote",
        actionLabel: "Gerar recebível",
        route: `/vendas?tab=orcamentos&quote=${q.id}`,
        icon: "quote",
      });
    }
  }

  // ===== FINANCEIRO =====
  for (const tx of inputs.transactions) {
    if (tx.status === "paid" || tx.status === "canceled") continue;
    const due = safeIso(tx.dueDate);
    if (!due) continue;
    const diff = daysBetween(due, today);
    const isIncome = tx.type === "income";
    const labelKind = isIncome ? "Recebível" : "Pagamento";

    if (tx.status === "overdue" || diff < 0) {
      items.push({
        id: `fin-${tx.id}`,
        category: "finance",
        priority: "critical",
        title: `${labelKind} vencido · ${tx.title}`,
        description: `${tx.clientName ?? tx.category} · ${Math.abs(diff)}d em atraso`,
        dueDate: due,
        amount: tx.amount,
        clientId: tx.clientId,
        clientName: tx.clientName,
        relatedId: tx.id,
        relatedType: "finance_transaction",
        actionLabel: isIncome ? "Ver recebível" : "Ver pagamento",
        route: `/financeiro?tab=${isIncome ? "receivables" : "payables"}&entryId=${tx.id}`,
        icon: isIncome ? "receivable" : "payable",
      });
    } else if (diff === 0) {
      items.push({
        id: `fin-${tx.id}`,
        category: "finance",
        priority: "high",
        title: `${labelKind} vence hoje · ${tx.title}`,
        description: `${tx.clientName ?? tx.category}`,
        dueDate: due,
        amount: tx.amount,
        clientId: tx.clientId,
        clientName: tx.clientName,
        relatedId: tx.id,
        relatedType: "finance_transaction",
        actionLabel: isIncome ? "Ver recebível" : "Ver pagamento",
        route: `/financeiro?tab=${isIncome ? "receivables" : "payables"}&entryId=${tx.id}`,
        icon: isIncome ? "receivable" : "payable",
      });
    } else if (diff <= 7) {
      items.push({
        id: `fin-${tx.id}`,
        category: "finance",
        priority: "medium",
        title: `${labelKind} em ${diff}d · ${tx.title}`,
        description: `${tx.clientName ?? tx.category}`,
        dueDate: due,
        amount: tx.amount,
        clientId: tx.clientId,
        clientName: tx.clientName,
        relatedId: tx.id,
        relatedType: "finance_transaction",
        actionLabel: isIncome ? "Ver recebível" : "Ver pagamento",
        route: `/financeiro?tab=${isIncome ? "receivables" : "payables"}&entryId=${tx.id}`,
        icon: isIncome ? "receivable" : "payable",
      });
    }
  }

  // ===== PROJETOS =====
  for (const p of inputs.projects) {
    if (["delivered", "cancelled", "archived", "paused"].includes(p.status)) continue;
    const due = safeIso(p.dueDate);
    if (!due) continue;
    const diff = daysBetween(due, today);
    if (diff < 0) {
      items.push({
        id: `project-${p.id}`,
        category: "project",
        priority: "critical",
        title: `Projeto atrasado · ${p.name}`,
        description: `${p.clientName} · ${Math.abs(diff)}d após o prazo`,
        dueDate: due,
        clientId: p.clientId,
        clientName: p.clientName,
        relatedId: p.id,
        relatedType: "project",
        actionLabel: "Ver projeto",
        route: `/portfolio?tab=projetos&projectId=${p.id}`,
        icon: "project",
      });
    } else if (diff <= 3) {
      items.push({
        id: `project-${p.id}`,
        category: "project",
        priority: "high",
        title: `Prazo em ${diff}d · ${p.name}`,
        description: `${p.clientName}`,
        dueDate: due,
        clientId: p.clientId,
        clientName: p.clientName,
        relatedId: p.id,
        relatedType: "project",
        actionLabel: "Ver projeto",
        route: `/portfolio?tab=projetos&projectId=${p.id}`,
        icon: "project",
      });
    } else if (diff <= 7) {
      items.push({
        id: `project-${p.id}`,
        category: "project",
        priority: "medium",
        title: `Prazo em ${diff}d · ${p.name}`,
        description: `${p.clientName}`,
        dueDate: due,
        clientId: p.clientId,
        clientName: p.clientName,
        relatedId: p.id,
        relatedType: "project",
        actionLabel: "Ver projeto",
        route: `/portfolio?tab=projetos&projectId=${p.id}`,
        icon: "project",
      });
    }
  }

  // ===== CLIENTES SEM PRÓXIMO PASSO =====
  for (const c of inputs.clients) {
    if (c.status !== "Ativo" && c.status !== "Potencial") continue;
    if (c.nextAction && c.nextAction.trim().length > 0) continue;
    items.push({
      id: `client-${c.id}`,
      category: "client",
      priority: "low",
      title: `Definir próximo passo · ${c.name}`,
      description: `${c.company ?? ""} · sem follow-up agendado`.trim(),
      clientId: c.id,
      clientName: c.company || c.name,
      relatedId: c.id,
      relatedType: "client",
      actionLabel: "Abrir cliente",
      route: `/clientes?client=${c.id}`,
      icon: "client",
    });
  }

  // ===== LOGS MANUAIS DE RELACIONAMENTO =====
  const clientById = new Map<number, Client>();
  for (const c of inputs.clients) clientById.set(c.id, c);

  for (const log of inputs.manualActivities ?? []) {
    if (log.resolvedAt) continue;
    if (!log.nextStep || !log.nextStep.trim()) continue;
    const due = safeIso(log.nextStepDate);
    if (!due) continue;
    const diff = daysBetween(due, today);
    if (diff > 7) continue;

    const client = clientById.get(log.clientId);
    const clientName = client?.company || client?.name;
    const category = MANUAL_TYPE_TO_DAY_CATEGORY[log.type];
    const priority: DayPriority = diff < 0 ? "critical" : diff === 0 ? "high" : "medium";
    const whenLabel = diff < 0 ? `atrasado ${Math.abs(diff)}d` : diff === 0 ? "hoje" : `em ${diff}d`;
    const typeLabel = MANUAL_TYPE_LABEL[log.type];

    items.push({
      id: `manual-${log.id}`,
      category,
      priority,
      title: log.nextStep.trim(),
      description: `${typeLabel}${clientName ? ` · ${clientName}` : ""} · ${whenLabel}`,
      dueDate: due,
      clientId: log.clientId,
      clientName,
      relatedId: log.id,
      relatedType: "manual_activity",
      actionLabel: "Ver atividade",
      route: `/clientes?client=${log.clientId}&tab=activities&activity=${log.id}`,
      icon: "manual",
    });
  }

  // ===== ORDENAÇÃO =====
  items.sort((a, b) => {
    const pw = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
    if (pw !== 0) return pw;
    const ad = a.dueDate ?? "9999-12-31";
    const bd = b.dueDate ?? "9999-12-31";
    return ad.localeCompare(bd);
  });

  const byCategory: Record<DayCategory, DayActionItem[]> = {
    task: [],
    commercial: [],
    finance: [],
    project: [],
    client: [],
    quote: [],
  };
  for (const it of items) byCategory[it.category].push(it);

  // Top action: highest priority following a small preferred order
  const PREFERRED: DayCategory[] = ["finance", "task", "quote", "commercial", "project", "client"];
  const sortedForTop = [...items].sort((a, b) => {
    const pw = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
    if (pw !== 0) return pw;
    return PREFERRED.indexOf(a.category) - PREFERRED.indexOf(b.category);
  });
  const topAction = sortedForTop[0] ?? null;

  const counts = {
    today: items.filter((i) => i.dueDate === today).length,
    overdue: items.filter((i) => i.priority === "critical").length,
    followUps: byCategory.commercial.length,
    receivables: items.filter(
      (i) => i.category === "finance" && i.icon === "receivable",
    ).length,
    projectsAttention: byCategory.project.length,
    total: items.length,
    critical: items.filter((i) => i.priority === "critical").length,
    high: items.filter((i) => i.priority === "high").length,
  };

  return { items, byCategory, topAction, counts };
}

export const DAY_PRIORITY_LABEL: Record<DayPriority, string> = {
  critical: "Crítico",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

export const DAY_CATEGORY_LABEL: Record<DayCategory, string> = {
  task: "Tarefa",
  commercial: "Comercial",
  finance: "Financeiro",
  project: "Projeto",
  client: "Cliente",
  quote: "Orçamento",
};
