import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Activity, UserPlus, Users, Target, Trophy, XCircle,
  FileSpreadsheet, Send, CheckCircle2, AlertCircle, CalendarX,
  Wallet, DollarSign, Briefcase, Play, Flag, ClipboardList, BookOpen,
  ChevronRight, Sparkles,
} from "lucide-react";
import type { Client } from "@/hooks/useClients";
import { useLeads } from "@/hooks/useLeads";
import { useQuotes } from "@/hooks/useQuotes";
import { useFinance } from "@/hooks/useFinance";
import { useProjects } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";
import { EmptyState } from "@/components/ui/empty-state";

// ---------- Types ----------

type ActivityCategory = "all" | "commercial" | "finance" | "projects" | "tasks" | "materials";

type ActivityType =
  | "client_created" | "client_updated" | "contact_added"
  | "opportunity_created" | "opportunity_won" | "opportunity_lost"
  | "quote_created" | "quote_sent" | "quote_approved" | "quote_rejected" | "quote_expired"
  | "receivable_created" | "receivable_paid" | "receivable_overdue"
  | "project_created" | "project_started" | "project_completed" | "project_cancelled"
  | "task_created" | "task_completed"
  | "material_added" | "technical_sheet_updated";

type Tone = "neutral" | "success" | "warning" | "danger" | "primary";

interface ClientActivityEvent {
  id: string;
  type: ActivityType;
  category: Exclude<ActivityCategory, "all">;
  title: string;
  description?: string;
  date: string; // ISO
  status?: string;
  tone?: Tone;
  amount?: number;
  action?: { label: string; href: string };
}

// ---------- Helpers ----------

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
};

const parseDate = (s?: string): string | null => {
  if (!s) return null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString();
  return null;
};

const toneCls: Record<Tone, string> = {
  neutral: "bg-muted/50 text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-emerald-500/10 text-emerald-400",
  warning: "bg-amber-500/10 text-amber-400",
  danger: "bg-destructive/10 text-destructive",
};

const iconByType: Record<ActivityType, any> = {
  client_created: UserPlus,
  client_updated: Sparkles,
  contact_added: Users,
  opportunity_created: Target,
  opportunity_won: Trophy,
  opportunity_lost: XCircle,
  quote_created: FileSpreadsheet,
  quote_sent: Send,
  quote_approved: CheckCircle2,
  quote_rejected: XCircle,
  quote_expired: CalendarX,
  receivable_created: Wallet,
  receivable_paid: DollarSign,
  receivable_overdue: AlertCircle,
  project_created: Briefcase,
  project_started: Play,
  project_completed: Flag,
  project_cancelled: XCircle,
  task_created: ClipboardList,
  task_completed: CheckCircle2,
  material_added: BookOpen,
  technical_sheet_updated: BookOpen,
};

// ---------- Component ----------

export const ClientActivitiesTab = ({
  client,
  onClose,
  onCreateOpportunity,
}: {
  client: Client;
  onClose: () => void;
  onCreateOpportunity?: (c: Client) => void;
}) => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<ActivityCategory>("all");

  const { leads } = useLeads();
  const { quotes } = useQuotes();
  const { transactions } = useFinance();
  const { projects } = useProjects();
  const { tasks } = useTasks();

  const events = useMemo<ClientActivityEvent[]>(() => {
    const evts: ClientActivityEvent[] = [];
    const today = new Date();
    const matchesByName = (name?: string) =>
      !!name && name.toLowerCase() === client.name.toLowerCase();

    // --- Client ---
    if (client.createdAt) {
      evts.push({
        id: `cli-created-${client.id}`, type: "client_created", category: "commercial",
        title: "Cliente cadastrado", description: client.company || undefined,
        date: client.createdAt, tone: "primary",
      });
    }
    if (client.updatedAt && client.updatedAt !== client.createdAt) {
      evts.push({
        id: `cli-updated-${client.id}`, type: "client_updated", category: "commercial",
        title: "Cliente atualizado", date: client.updatedAt, tone: "neutral",
      });
    }

    // --- Contacts ---
    (client.contacts ?? []).forEach((c) => {
      const d = parseDate(c.createdAt);
      if (!d) return;
      evts.push({
        id: `contact-${c.id}`, type: "contact_added", category: "commercial",
        title: "Contato adicionado", description: `${c.name}${c.role ? ` · ${c.role}` : ""}`,
        date: d, tone: "neutral",
      });
    });

    // --- Opportunities (leads) ---
    const clientLeads = leads.filter(
      (l) => l.clientId === client.id || l.convertedClientId === client.id || matchesByName(l.name) || matchesByName(l.company),
    );
    clientLeads.forEach((l) => {
      const created = parseDate(l.createdAt);
      if (created) {
        evts.push({
          id: `lead-c-${l.id}`, type: "opportunity_created", category: "commercial",
          title: "Oportunidade criada", description: l.description || l.name,
          amount: l.estimatedValue, date: created, tone: "primary",
          action: { label: "Ver no CRM", href: "/crm" },
        });
      }
      if (l.wonAt) {
        const w = parseDate(l.wonAt);
        if (w) evts.push({
          id: `lead-w-${l.id}`, type: "opportunity_won", category: "commercial",
          title: "Oportunidade ganha", description: l.name, amount: l.estimatedValue,
          date: w, status: "Ganho", tone: "success",
          action: { label: "Ver no CRM", href: "/crm" },
        });
      }
      if (l.stage === "perdido" && l.lostReason) {
        const lostDate = parseDate(l.updatedAt) ?? parseDate(l.createdAt);
        if (lostDate) evts.push({
          id: `lead-l-${l.id}`, type: "opportunity_lost", category: "commercial",
          title: "Oportunidade perdida", description: l.lostReason,
          date: lostDate, status: "Perdido", tone: "danger",
        });
      }
    });

    // --- Quotes ---
    const clientQuotes = quotes.filter(
      (q) => q.clientId === client.id || matchesByName(q.clientName),
    );
    clientQuotes.forEach((q) => {
      const created = parseDate(q.createdAt);
      if (created) evts.push({
        id: `qt-c-${q.id}`, type: "quote_created", category: "commercial",
        title: "Orçamento criado", description: q.title, amount: q.total,
        date: created, tone: "neutral",
        action: { label: "Ver orçamento", href: "/vendas" },
      });
      const sent = parseDate(q.sentAt);
      if (sent) evts.push({
        id: `qt-s-${q.id}`, type: "quote_sent", category: "commercial",
        title: "Orçamento enviado", description: q.title, amount: q.total,
        date: sent, status: "Enviado", tone: "warning",
        action: { label: "Ver orçamento", href: "/vendas" },
      });
      const approved = parseDate(q.approvedAt);
      if (approved) evts.push({
        id: `qt-a-${q.id}`, type: "quote_approved", category: "commercial",
        title: "Orçamento aprovado", description: q.title, amount: q.total,
        date: approved, status: "Aprovado", tone: "success",
        action: { label: "Ver orçamento", href: "/vendas" },
      });
      const rejected = parseDate(q.rejectedAt);
      if (rejected) evts.push({
        id: `qt-r-${q.id}`, type: "quote_rejected", category: "commercial",
        title: "Orçamento recusado", description: q.title,
        date: rejected, status: "Recusado", tone: "danger",
      });
      if (q.status === "vencido") {
        const d = parseDate(q.updatedAt) ?? parseDate(q.sentAt) ?? parseDate(q.createdAt);
        if (d) evts.push({
          id: `qt-e-${q.id}`, type: "quote_expired", category: "commercial",
          title: "Orçamento vencido", description: q.title,
          date: d, status: "Vencido", tone: "warning",
        });
      }
    });

    // --- Finance (income only) ---
    const clientTxs = transactions.filter(
      (t) => t.type === "income" && (t.clientId === client.id || matchesByName(t.clientName)),
    );
    clientTxs.forEach((t) => {
      const created = parseDate(t.createdAt);
      if (created) evts.push({
        id: `tx-c-${t.id}`, type: "receivable_created", category: "finance",
        title: "Conta a receber gerada",
        description: `${t.title} · venc. ${fmtDate(t.dueDate)}`,
        amount: t.amount, date: created, tone: "neutral",
        action: { label: "Ver financeiro", href: "/financeiro" },
      });
      if (t.status === "paid" && t.paidDate) {
        const p = parseDate(t.paidDate);
        if (p) evts.push({
          id: `tx-p-${t.id}`, type: "receivable_paid", category: "finance",
          title: "Pagamento recebido", description: t.title,
          amount: t.amount, date: p, status: "Pago", tone: "success",
          action: { label: "Ver financeiro", href: "/financeiro" },
        });
      }
      const dueDate = new Date(t.dueDate);
      const isOverdue = t.status === "overdue" || (t.status === "pending" && !isNaN(dueDate.getTime()) && dueDate < today);
      if (isOverdue) {
        evts.push({
          id: `tx-o-${t.id}`, type: "receivable_overdue", category: "finance",
          title: "Recebível vencido", description: `${t.title} · venceu em ${fmtDate(t.dueDate)}`,
          amount: t.amount, date: parseDate(t.dueDate) ?? created ?? new Date().toISOString(),
          status: "Vencido", tone: "danger",
        });
      }
    });

    // --- Projects ---
    const clientProjects = projects.filter(
      (p) => p.clientId === client.id || matchesByName(p.clientName),
    );
    const clientProjectIds = new Set(clientProjects.map((p) => p.id));
    clientProjects.forEach((p) => {
      const created = parseDate(p.createdAt);
      if (created) evts.push({
        id: `pj-c-${p.id}`, type: "project_created", category: "projects",
        title: "Projeto criado", description: p.name,
        date: created, tone: "primary",
        action: { label: "Ver projeto", href: `/portfolio?project=${p.id}` },
      });
      if (p.status === "in_progress" && p.startDate) {
        const s = parseDate(p.startDate);
        if (s) evts.push({
          id: `pj-s-${p.id}`, type: "project_started", category: "projects",
          title: "Projeto iniciado", description: p.name,
          date: s, status: "Em andamento", tone: "warning",
          action: { label: "Ver projeto", href: `/portfolio?project=${p.id}` },
        });
      }
      if (p.completedAt) {
        const d = parseDate(p.completedAt);
        if (d) evts.push({
          id: `pj-done-${p.id}`, type: "project_completed", category: "projects",
          title: "Projeto concluído", description: p.name,
          date: d, status: "Entregue", tone: "success",
          action: { label: "Ver projeto", href: `/portfolio?project=${p.id}` },
        });
      }
      if (p.status === "cancelled") {
        const d = parseDate(p.updatedAt) ?? parseDate(p.createdAt);
        if (d) evts.push({
          id: `pj-x-${p.id}`, type: "project_cancelled", category: "projects",
          title: "Projeto cancelado", description: p.name,
          date: d, status: "Cancelado", tone: "danger",
        });
      }
    });

    // --- Tasks ---
    const clientTasks = tasks.filter(
      (t) =>
        (t as any).clientId === client.id ||
        matchesByName((t as any).client) ||
        (t.projectId && clientProjectIds.has(t.projectId)),
    );
    clientTasks.forEach((t) => {
      const created = parseDate((t as any).createdAt);
      if (created) evts.push({
        id: `tk-c-${t.id}`, type: "task_created", category: "tasks",
        title: "Tarefa criada", description: t.title,
        date: created, tone: "neutral",
      });
      if (t.status === "concluido") {
        const d = parseDate((t as any).updatedAt) ?? created;
        if (d) evts.push({
          id: `tk-done-${t.id}`, type: "task_completed", category: "tasks",
          title: "Tarefa concluída", description: t.title,
          date: d, status: "Concluída", tone: "success",
        });
      }
    });

    // --- Materials (technical sheet assets) ---
    (client.technicalSheet?.assets ?? []).forEach((a) => {
      const d = parseDate(a.createdAt);
      if (!d) return;
      evts.push({
        id: `mat-${a.id}`, type: "material_added", category: "materials",
        title: "Material adicionado", description: a.title,
        date: d, tone: "neutral",
        action: { label: "Ver Ficha Técnica", href: `/clientes/${client.id}/ficha-tecnica` },
      });
    });

    // Deduplicate by id and sort desc
    const seen = new Set<string>();
    const dedup = evts.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
    dedup.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return dedup;
  }, [client, leads, quotes, transactions, projects, tasks]);

  const filtered = filter === "all" ? events : events.filter((e) => e.category === filter);

  const filters: { key: ActivityCategory; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "commercial", label: "Comercial" },
    { key: "finance", label: "Financeiro" },
    { key: "projects", label: "Projetos" },
    { key: "tasks", label: "Tarefas" },
    { key: "materials", label: "Materiais" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Activity className="h-4 w-4" /> Histórico do relacionamento
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Eventos comerciais, financeiros e operacionais deste cliente.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors",
                active
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "bg-card/40 text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted/40",
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Nenhuma atividade registrada ainda"
          description="As ações comerciais, financeiras e operacionais deste cliente aparecerão aqui conforme você usar o KORA."
          primaryAction={
            onCreateOpportunity
              ? { label: "Criar oportunidade", onClick: () => onCreateOpportunity(client) }
              : undefined
          }
          compact
        />
      ) : (
        <ol className="relative space-y-2 pl-5 before:absolute before:left-[9px] before:top-1 before:bottom-1 before:w-px before:bg-border/60">
          {filtered.map((e) => {
            const Icon = iconByType[e.type] ?? Activity;
            const tone = e.tone ?? "neutral";
            return (
              <li key={e.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-5 top-3 h-4 w-4 rounded-full ring-2 ring-card flex items-center justify-center",
                    toneCls[tone],
                  )}
                >
                  <Icon className="h-2.5 w-2.5" />
                </span>
                <div className="rounded-lg border border-border/60 bg-card/40 p-3 ml-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground">{e.title}</p>
                        {e.status && (
                          <Badge variant="outline" className={cn("text-[10px]", toneCls[tone], "border-transparent")}>
                            {e.status}
                          </Badge>
                        )}
                        {typeof e.amount === "number" && e.amount > 0 && (
                          <span className="text-[11px] font-semibold text-foreground/90">{fmtBRL(e.amount)}</span>
                        )}
                      </div>
                      {e.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{e.description}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/70 mt-1">{fmtDate(e.date)}</p>
                    </div>
                    {e.action && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[11px] gap-1 shrink-0"
                        onClick={() => {
                          onClose();
                          navigate(e.action!.href);
                        }}
                      >
                        {e.action.label} <ChevronRight className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};
