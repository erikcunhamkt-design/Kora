import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatCurrency as intlCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  LucideIcon,
  Activity, UserPlus, Users, Target, Trophy, XCircle,
  FileSpreadsheet, Send, CheckCircle2, AlertCircle, CalendarX,
  Wallet, DollarSign, Briefcase, Play, Flag, ClipboardList, BookOpen,
  ChevronRight, Sparkles, Plus, MoreHorizontal, Pencil, Trash2,
  Phone, MessageSquare, MessageCircle, CalendarDays, AlertTriangle,
  StickyNote, Bell, GitBranch, FileQuestion, HelpCircle,
} from "lucide-react";
import type { Client } from "@/hooks/useClients";
import { useLeads } from "@/hooks/useLeads";
import { useQuotes } from "@/hooks/useQuotes";
import { useBifurcatedFinance } from "@/hooks/useBifurcatedFinance";
import { useBifurcatedProjects } from "@/hooks/useBifurcatedProjects";
import { useBifurcatedTasks } from "@/hooks/useBifurcatedTasks";
import { EmptyState } from "@/components/ui/empty-state";
import {
  useClientActivityLogs,
  type ClientManualActivity,
  type ManualActivityType,
} from "@/hooks/useClientActivityLogs";
import { ClientActivityLogDialog } from "./ClientActivityLogDialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import type { ActivityCategory, InferredType, Tone, ClientActivityEvent } from "./activityTimeline/types";
import { fmtDate } from "./activityTimeline/format";
import { buildCommercialEvents } from "./activityTimeline/buildCommercialEvents";
import { buildFinanceEvents } from "./activityTimeline/buildFinanceEvents";
import { buildProjectEvents } from "./activityTimeline/buildProjectEvents";
import { buildTaskEvents } from "./activityTimeline/buildTaskEvents";
import { buildMaterialEvents } from "./activityTimeline/buildMaterialEvents";
import { mergeManualAndInferredActivities } from "./activityTimeline/mergeActivities";

// ---------- Helpers ----------

const fmtBRL = (v: number) => intlCurrency(v, { minimumFractionDigits: 0 });

const toneCls: Record<Tone, string> = {
  neutral: "bg-muted/50 text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-emerald-500/10 text-emerald-400",
  warning: "bg-amber-500/10 text-amber-400",
  danger: "bg-destructive/10 text-destructive",
};

const inferredIcon: Record<InferredType, LucideIcon> = {
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

const manualIcon: Record<ManualActivityType, LucideIcon> = {
  meeting: CalendarDays,
  call: Phone,
  message: MessageCircle,
  feedback: MessageSquare,
  scope_change: GitBranch,
  material_request: FileQuestion,
  decision: CheckCircle2,
  issue: AlertTriangle,
  internal_note: StickyNote,
  follow_up: Bell,
  other: HelpCircle,
};

// ---------- Component ----------
//
// Timeline montada por composição: cada hook bifurcado alimenta 1 construtor
// por domínio (activityTimeline/build*Events.ts), depois merge/dedup/sort
// (activityTimeline/mergeActivities.ts). Tarefas bifurcou nesta rodada (B4,
// etapa-5-flip-tarefas-pacote.md §7) — a mudança ficou confinada ao hook de
// tasks (useBifurcatedTasks) + buildTaskEvents.ts, exatamente como esta nota
// previu quando só existia o refactor preventivo (G54).

export const ClientActivitiesTab = ({
  client,
  onClose,
  onCreateOpportunity,
  highlightedActivityId,
}: {
  client: Client;
  onClose: () => void;
  onCreateOpportunity?: (c: Client) => void;
  highlightedActivityId?: string;
}) => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<ActivityCategory>("all");

  const { leads } = useLeads();
  const { quotes } = useQuotes();
  // Etapa 5 · Pacote do Flip (projects) — Fase B, item 2 (achado (a)):
  // timeline ficava incompleta pra clientes com projetos só na nuvem.
  const projects = useBifurcatedProjects();
  // Etapa 5 · Financeiro Fase B (Pacote do Flip, §3.2 do desenho) — mesmo
  // achado, 2º domínio: recebível gerado via CreateReceivableDialog (CRM)
  // não batia por clientId/clientName em modo local puro (G41, achado não
  // mecânico — client_id ali é uuid da nuvem, Transaction.clientId local é
  // number, sem mapa reverso). Lendo via useBifurcatedFinance() em modo
  // Supabase, a transação já vem da nuvem com client_id (cast uuid->number,
  // mesmo precedente de clientId/opportunityId em mapSupabaseProjectToLocal)
  // — bate por p.clientId === client.id sem precisar de mapa reverso nenhum.
  const transactions = useBifurcatedFinance();
  const tasks = useBifurcatedTasks();
  const { logs, addLog, updateLog, deleteLog } = useClientActivityLogs(client.id);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClientManualActivity | null>(null);
  const [toDelete, setToDelete] = useState<ClientManualActivity | null>(null);

  const events = useMemo<ClientActivityEvent[]>(() => {
    const { events: projectEvents, projectIds } = buildProjectEvents({ client, projects });
    const inferred = [
      ...buildCommercialEvents({ client, leads, quotes }),
      ...buildFinanceEvents({ client, transactions }),
      ...projectEvents,
      ...buildTaskEvents({ client, tasks, clientProjectIds: projectIds }),
      ...buildMaterialEvents({ client }),
    ];
    return mergeManualAndInferredActivities(inferred, logs);
  }, [client, leads, quotes, transactions, projects, tasks, logs]);

  const filtered = filter === "all" ? events : events.filter((e) => e.category === filter);
  const hasInferred = events.some((e) => e.origin === "inferred");
  const hasManual = logs.length > 0;

  const highlightRef = useRef<HTMLLIElement | null>(null);
  const [highlightActive, setHighlightActive] = useState(false);
  useEffect(() => {
    if (!highlightedActivityId) { setHighlightActive(false); return; }
    setHighlightActive(true);
    const el = highlightRef.current;
    if (el) {
      try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch { /* noop */ }
    }
    const t = window.setTimeout(() => setHighlightActive(false), 4000);
    return () => window.clearTimeout(t);
  }, [highlightedActivityId, client.id]);


  const filters: { key: ActivityCategory; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "commercial", label: "Comercial" },
    { key: "finance", label: "Financeiro" },
    { key: "projects", label: "Projetos" },
    { key: "tasks", label: "Tarefas" },
    { key: "materials", label: "Materiais" },
  ];

  const openCreate = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (m: ClientManualActivity) => { setEditing(m); setDialogOpen(true); };

  const handleSubmit = (data: Omit<ClientManualActivity, "id" | "createdAt" | "updatedAt">) => {
    if (editing) {
      const nextStepDateChanged =
        !!data.nextStepDate && data.nextStepDate !== editing.nextStepDate;
      const patch: Partial<ClientManualActivity> = { ...data };
      if (nextStepDateChanged && editing.resolvedAt) {
        patch.resolvedAt = undefined;
      }
      updateLog(editing.id, patch);
      toast.success("Atividade atualizada");
    } else {
      addLog(data);
      toast.success("Atividade registrada");
    }
    setEditing(null);
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    deleteLog(toDelete.id);
    toast.success("Atividade excluída");
    setToDelete(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Activity className="h-4 w-4" /> Histórico de Relacionamento
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Eventos comerciais, financeiros e operacionais deste cliente.
          </p>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5 shrink-0">
          <Plus className="h-3.5 w-3.5" /> Registrar atividade
        </Button>
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

      {hasInferred && !hasManual && (
        <p className="text-[11px] text-muted-foreground/80 italic">
          Registre reuniões, ligações e decisões importantes para completar o histórico do cliente.
        </p>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Nenhuma atividade registrada ainda"
          description="As ações comerciais, financeiras e operacionais deste cliente aparecerão aqui conforme você usar o KORA."
          primaryAction={{ label: "Registrar atividade", onClick: openCreate }}
          secondaryAction={
            onCreateOpportunity
              ? { label: "Criar oportunidade", onClick: () => onCreateOpportunity(client) }
              : undefined
          }
          compact
        />
      ) : (
        <ol className="relative space-y-2 pl-5 before:absolute before:left-[9px] before:top-1 before:bottom-1 before:w-px before:bg-border/60">
          {filtered.map((e) => {
            const Icon = e.origin === "manual" ? manualIcon[e.type] : (inferredIcon[e.type] ?? Activity);
            const tone = e.tone ?? "neutral";
            const isHighlighted = highlightActive && e.origin === "manual" && e.raw.id === highlightedActivityId;
            return (
              <li
                key={e.id}
                ref={isHighlighted ? highlightRef : undefined}
                className={cn("relative transition-all", isHighlighted && "rounded-lg ring-2 ring-primary/40 bg-primary/5")}
              >
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
                        {e.origin === "manual" && (
                          <Badge variant="outline" className="text-[9px] px-1.5 h-4 border-primary/30 text-primary/90">
                            Manual
                          </Badge>
                        )}
                        {e.origin === "manual" && e.raw.resolvedAt && (
                          <Badge variant="outline" className="text-[9px] px-1.5 h-4 border-emerald-500/30 text-emerald-400">
                            Resolvido
                          </Badge>
                        )}
                        {e.origin === "manual" && !e.raw.resolvedAt && e.raw.nextStep && e.raw.nextStepDate && (
                          <Badge variant="outline" className="text-[9px] px-1.5 h-4 border-amber-500/30 text-amber-400">
                            Vai para Central do Dia
                          </Badge>
                        )}
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
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-3">{e.description}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/70 mt-1">{fmtDate(e.date)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {e.action && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px] gap-1"
                          onClick={() => { onClose(); navigate(e.action!.href); }}
                        >
                          {e.action.label} <ChevronRight className="h-3 w-3" />
                        </Button>
                      )}
                      {e.origin === "manual" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(e.raw)}>
                              <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setToDelete(e.raw)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <ClientActivityLogDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(null); }}
        client={client}
        editing={editing}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir atividade?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O registro será removido do histórico do cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
