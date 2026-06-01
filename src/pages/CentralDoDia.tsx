import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  FileText,
  Flame,
  ListChecks,
  RefreshCw,
  Sparkles,
  UserCircle2,
  Users,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useDayCenterData } from "@/hooks/useDayCenterData";
import { useDayCenterResolvedActions } from "@/hooks/useDayCenterResolvedActions";
import { useDayCenterActions } from "@/hooks/useDayCenterActions";
import {
  DAY_CATEGORY_LABEL,
  type DayActionItem,
  type DayCategory,
  type DayPriority,
} from "@/lib/dayCenter";

type Filter = "all" | "critical" | "today" | "commercial" | "finance" | "project" | "task" | "client" | "resolved";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "critical", label: "Críticos" },
  { key: "today", label: "Hoje" },
  { key: "commercial", label: "Comercial" },
  { key: "finance", label: "Financeiro" },
  { key: "project", label: "Projetos" },
  { key: "task", label: "Tarefas" },
  { key: "client", label: "Clientes" },
  { key: "resolved", label: "Resolvidos" },
];

const PRIORITY_STYLES: Record<DayPriority, { dot: string; text: string; ring: string; label: string }> = {
  critical: { 
    dot: "bg-[#F87171]", 
    text: "text-[#F87171]", 
    ring: "border-[#EF4444]/25 bg-gradient-to-br from-[#EF4444]/8 via-[#EF4444]/1 to-transparent shadow-[0_4px_20px_rgba(239,68,68,0.08)]", 
    label: "Crítico" 
  },
  high: { 
    dot: "bg-[#FBBF24]", 
    text: "text-[#FBBF24]", 
    ring: "border-[#F59E0B]/20 bg-gradient-to-br from-[#F59E0B]/5 via-[#F59E0B]/0.5 to-transparent", 
    label: "Alta" 
  },
  medium: { 
    dot: "bg-primary", 
    text: "text-primary", 
    ring: "border-primary/20 bg-gradient-to-br from-primary/5 via-primary/0.5 to-transparent", 
    label: "Média" 
  },
  low: { 
    dot: "bg-muted-foreground/45", 
    text: "text-muted-foreground/80", 
    ring: "border-border/40 bg-muted/5", 
    label: "Baixa" 
  },
};

const CATEGORY_ICON: Record<DayCategory, React.ComponentType<{ className?: string }>> = {
  task: ListChecks,
  commercial: Users,
  finance: DollarSign,
  project: Briefcase,
  client: UserCircle2,
  quote: FileText,
};

function formatBR(amount?: number) {
  if (typeof amount !== "number") return undefined;
  return `R$ ${amount.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(iso?: string) {
  if (!iso) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y) return undefined;
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const RESOLVED_TYPE_LABEL: Record<string, string> = {
  task_completed: "Tarefa concluída",
  manual_followup_resolved: "Follow-up resolvido",
  receivable_paid: "Recebível pago",
};

export default function CentralDoDia() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [, setTick] = useState(0);
  const [payConfirm, setPayConfirm] = useState<DayActionItem | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem("kora.daycenter.opened.v1", "true");
      window.dispatchEvent(new Event("kora:onboarding:refresh"));
    } catch { /* noop */ }
  }, []);

  const result = useDayCenterData();
  const { todayActions, todayCount } = useDayCenterResolvedActions();
  const { completeTask, resolveManualFollowUp, markReceivablePaid, canMarkPaid } = useDayCenterActions();

  const go = (route?: string) => {
    if (!route) return;
    navigate(route);
  };

  const requestPay = (item: DayActionItem) => setPayConfirm(item);
  const confirmPay = () => {
    if (payConfirm) markReceivablePaid(payConfirm);
    setPayConfirm(null);
  };

  const filtered = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    switch (filter) {
      case "all": return result.items;
      case "critical": return result.items.filter((i) => i.priority === "critical");
      case "today": return result.items.filter((i) => i.dueDate === todayIso);
      case "commercial": return result.items.filter((i) => i.category === "commercial" || i.category === "quote");
      case "finance": return result.items.filter((i) => i.category === "finance");
      case "project": return result.items.filter((i) => i.category === "project");
      case "task": return result.items.filter((i) => i.category === "task");
      case "client": return result.items.filter((i) => i.category === "client");
      case "resolved": return [];
    }
  }, [filter, result.items]);

  return (
    <PageContainer>
      <PageHeader
        title="Central do Dia"
        description="Prioridades, follow-ups, tarefas, financeiro e entregas que precisam da sua atenção hoje."
        primaryAction={{ label: "Atualizar", icon: RefreshCw, onClick: () => setTick((t) => t + 1) }}
        secondaryAction={{ label: "Ver tarefas", onClick: () => navigate("/tarefas") }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Hero operacional */}
          {result.topAction ? (
            <HeroAction
              item={result.topAction}
              onGo={go}
              onCompleteTask={completeTask}
              onResolveFollowUp={resolveManualFollowUp}
              onMarkPaid={requestPay}
              canMarkPaid={canMarkPaid(result.topAction)}
            />
          ) : (
            <EmptyHero onGo={go} />
          )}

          {/* Filtros */}
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "h-8 px-3 rounded-full text-[0.75rem] font-medium border transition-all",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-transparent text-muted-foreground border-border/60 hover:text-foreground hover:border-border",
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Lista operacional ou Resolvidos */}
          {filter === "resolved" ? (
            <ResolvedList actions={todayActions} />
          ) : filtered.length === 0 ? (
            <EmptyHero onGo={go} compact />
          ) : (
            <div className="space-y-6">
              {(["critical", "high", "medium", "low"] as DayPriority[]).map((prio) => {
                const items = filtered.filter((i) => i.priority === prio);
                if (items.length === 0) return null;
                return (
                  <div key={prio} className="space-y-2.5">
                    <div className="flex items-center gap-2 pt-2 first:pt-0">
                      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", PRIORITY_STYLES[prio].dot)} />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                        {PRIORITY_STYLES[prio].label}
                      </span>
                      <div className="h-px flex-1 bg-border/20" />
                    </div>
                    <div className="space-y-2">
                      {items.map((it) => (
                        <ActionRow
                          key={it.id}
                          item={it}
                          onGo={go}
                          onCompleteTask={completeTask}
                          onResolveFollowUp={resolveManualFollowUp}
                          onMarkPaid={requestPay}
                          canMarkPaid={canMarkPaid(it)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Coluna lateral */}
        <aside className="space-y-6">
          {/* Métricas */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Críticos" value={result.counts.critical} icon={AlertTriangle} accent="destructive" />
            <MetricCard label="Alta prioridade" value={result.counts.high} icon={Flame} accent="amber" />
            <MetricCard label="Tarefas de hoje" value={result.byCategory.task.length} icon={ListChecks} accent="primary" />
            <MetricCard label="Follow-ups" value={result.counts.followUps} icon={Users} accent="amber" />
            <MetricCard label="Financeiro" value={result.counts.receivables} icon={DollarSign} accent="emerald" />
            <MetricCard label="Resolvidos hoje" value={todayCount} icon={CheckCircle2} accent="emerald" />
          </div>

          {/* Resolvidos hoje (preview) */}
          {filter !== "resolved" && todayActions.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-[0.875rem] font-semibold text-foreground">Resolvidos hoje</h3>
                </div>
                <button
                  onClick={() => setFilter("resolved")}
                  className="text-[0.7rem] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  Ver todos <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              <ul className="space-y-2">
                {todayActions.slice(0, 4).map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-[0.8125rem]">
                    <span className="text-muted-foreground tabular-nums shrink-0">{formatTime(a.resolvedAt)}</span>
                    <span className="text-foreground truncate flex-1">{a.title}</span>
                    {a.amount !== undefined && (
                      <span className="text-emerald-400 font-semibold tabular-nums shrink-0">
                        {formatBR(a.amount)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>

      <AlertDialog open={!!payConfirm} onOpenChange={(v) => !v && setPayConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar como pago?</AlertDialogTitle>
            <AlertDialogDescription>
              O recebível {payConfirm?.title ? `"${payConfirm.title}"` : ""} será marcado como pago
              com a data de hoje. Você poderá ajustar depois no Financeiro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPay}>Marcar como pago</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

// ===== Sub-componentes =====

function MetricCard({
  label, value, icon: Icon, accent,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: "primary" | "destructive" | "amber" | "emerald";
}) {
  const colors = {
    primary: "text-[#EC4899] bg-[#EC4899]/5 border-[#EC4899]/15",
    destructive: "text-[#F87171] bg-[#EF4444]/5 border-[#EF4444]/15",
    amber: "text-[#FBBF24] bg-[#F59E0B]/5 border-[#F59E0B]/15",
    emerald: "text-[#34D399] bg-[#10B981]/5 border-[#10B981]/15",
  } as const;

  const textGradient = {
    primary: "bg-gradient-to-r from-[#EC4899] to-[#F43F5E] bg-clip-text text-transparent",
    destructive: "bg-gradient-to-r from-[#F87171] to-[#EF4444] bg-clip-text text-transparent",
    amber: "bg-gradient-to-r from-[#FBBF24] to-[#D97706] bg-clip-text text-transparent",
    emerald: "bg-gradient-to-r from-[#34D399] to-[#059669] bg-clip-text text-transparent",
  } as const;

  return (
    <div className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-xs p-4 flex flex-col gap-2 hover:border-border/50 hover:bg-card-elevated/40 transition-all duration-300">
      <div className="flex items-center justify-between">
        <span className="text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground/60">
          {label}
        </span>
        <div className={cn("h-6 w-6 rounded-md border flex items-center justify-center", colors[accent])}>
          <Icon className="h-3 w-3" />
        </div>
      </div>
      <span className={cn("text-[1.75rem] font-extrabold tracking-tight tabular-nums leading-none mt-1", textGradient[accent])}>
        {value}
      </span>
    </div>
  );
}

interface ActionHandlers {
  onCompleteTask: (i: DayActionItem) => void;
  onResolveFollowUp: (i: DayActionItem) => void;
  onMarkPaid: (i: DayActionItem) => void;
  canMarkPaid: boolean;
}

function HeroAction({ item, onGo, ...h }: { item: DayActionItem; onGo: (r?: string) => void } & ActionHandlers) {
  const style = PRIORITY_STYLES[item.priority];
  const Icon = CATEGORY_ICON[item.category];
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border p-6 flex items-start gap-4 transition-all duration-300", style.ring)}>
      {/* Background atmosphere glow for Hero card */}
      <div className="absolute -top-20 -left-20 w-48 h-48 rounded-full bg-primary/10 blur-[80px] pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-48 h-48 rounded-full bg-[#EC4899]/5 blur-[80px] pointer-events-none" />

      <div className="h-12 w-12 rounded-xl bg-card-elevated/40 border border-border/40 flex items-center justify-center shrink-0 shadow-lg relative z-10">
        <Flame className={cn("h-6 w-6 animate-pulse", style.text)} />
      </div>
      <div className="flex-1 min-w-0 relative z-10">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Badge variant="outline" className="h-5 px-2 text-[9px] font-bold uppercase tracking-wider border-primary/20 bg-primary/5 text-primary">
            Próxima melhor ação
          </Badge>
          <Badge variant="outline" className="h-5 px-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80 border-border/50 bg-background/30">
            <Icon className="h-3 w-3 mr-1" />
            {DAY_CATEGORY_LABEL[item.category]}
          </Badge>
          <Badge variant="outline" className={cn("h-5 px-2 text-[9px] font-bold uppercase tracking-wider border-current/20 bg-current/5", style.text)}>
            {style.label}
          </Badge>
        </div>
        <h2 className="text-xl font-bold text-foreground leading-snug tracking-tight">{item.title}</h2>
        {item.description && (
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed font-normal">
            {item.description}
          </p>
        )}
        <div className="flex items-center gap-4 mt-5 flex-wrap pt-3 border-t border-border/10">
          {item.dueDate && (
            <span className="text-xs text-muted-foreground/85 inline-flex items-center gap-1.5 font-medium">
              <CalendarClock className="h-3.5 w-3.5" />
              {formatDate(item.dueDate)}
            </span>
          )}
          {item.amount !== undefined && (
            <span className="text-xs text-muted-foreground/85 font-semibold tabular-nums">
              {formatBR(item.amount)}
            </span>
          )}
          {item.clientName && (
            <span className="text-xs text-muted-foreground/85 font-medium truncate">
              {item.clientName}
            </span>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <QuickAction item={item} {...h} />
            {item.route && (
              <Button size="sm" onClick={() => onGo(item.route)} className="h-8 px-3 text-[0.8125rem] font-semibold orbit-gradient text-white border-0">
                {item.actionLabel ?? "Abrir item"}
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionRow({ item, onGo, ...h }: { item: DayActionItem; onGo: (r?: string) => void } & ActionHandlers) {
  const style = PRIORITY_STYLES[item.priority];
  const Icon = CATEGORY_ICON[item.category];
  return (
    <div className="group relative rounded-xl border border-border/20 bg-card/30 backdrop-blur-xs hover:bg-card-elevated/50 hover:border-border/40 transition-all duration-300 px-4 py-3.5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <div className={cn("h-9 w-9 shrink-0 rounded-lg border flex items-center justify-center", style.ring)}>
          <Icon className={cn("h-4 w-4", style.text)} />
        </div>
        <button onClick={() => onGo(item.route)} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] text-muted-foreground/80 font-semibold uppercase tracking-wider">{DAY_CATEGORY_LABEL[item.category]}</span>
          </div>
          <p className="text-sm font-semibold text-foreground truncate leading-normal">{item.title}</p>
          {item.description && (
            <p className="text-xs text-muted-foreground/70 truncate mt-0.5 font-normal">{item.description}</p>
          )}
        </button>
      </div>

      <div className="flex items-center gap-4 shrink-0 relative min-w-[120px] justify-end">
        <div className="flex flex-col items-end gap-0.5 text-right transition-all duration-300 group-hover:opacity-0 group-hover:-translate-x-2">
          {item.dueDate && (
            <span className="text-[10px] text-muted-foreground/70 inline-flex items-center gap-1 font-medium">
              <CalendarClock className="h-3 w-3" />
              {formatDate(item.dueDate)}
            </span>
          )}
          {item.amount !== undefined && (
            <span className="text-xs font-bold tabular-nums text-foreground/90">
              {formatBR(item.amount)}
            </span>
          )}
        </div>

        {/* Action buttons fade/translate in on hover */}
        <div className="flex items-center gap-1.5 absolute right-0 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 pointer-events-none group-hover:pointer-events-auto">
          <QuickAction item={item} {...h} />
          {item.route && (
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={(e) => { e.stopPropagation(); onGo(item.route); }} 
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-border/20 rounded-lg transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickAction({ item, onCompleteTask, onResolveFollowUp, onMarkPaid, canMarkPaid }: { item: DayActionItem } & ActionHandlers) {
  const cls = "h-8 px-3 text-[11px] font-bold tracking-wide uppercase border border-emerald-500/20 text-emerald-400 bg-emerald-500/[0.04] hover:bg-emerald-500/10 transition-colors";
  if (item.relatedType === "task") {
    return (
      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onCompleteTask(item); }} className={cls}>
        <Check className="h-3.5 w-3.5 mr-1" /> Concluir
      </Button>
    );
  }
  if (item.relatedType === "manual_activity") {
    return (
      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onResolveFollowUp(item); }} className={cls}>
        <Check className="h-3.5 w-3.5 mr-1" /> Resolver
      </Button>
    );
  }
  if (item.relatedType === "finance_transaction" && canMarkPaid) {
    return (
      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onMarkPaid(item); }} className={cls}>
        <Check className="h-3.5 w-3.5 mr-1" /> Marcar pago
      </Button>
    );
  }
  return null;
}

function ResolvedList({ actions }: { actions: ReturnType<typeof useDayCenterResolvedActions>["todayActions"] }) {
  if (actions.length === 0) {
    return (
      <Card className="p-8 text-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-3" />
        <p className="text-[0.9375rem] font-semibold text-foreground">Nada resolvido hoje ainda</p>
        <p className="text-[0.8125rem] text-muted-foreground mt-1">
          Conforme você usa as ações rápidas, elas aparecem aqui.
        </p>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {actions.map((a) => (
        <div key={a.id} className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <Badge variant="outline" className="h-4 px-1.5 text-[9px] text-emerald-400 border-emerald-500/30 uppercase">
                {RESOLVED_TYPE_LABEL[a.type] ?? a.type}
              </Badge>
              <span className="text-[0.7rem] text-muted-foreground">via Central do Dia</span>
            </div>
            <p className="text-[0.875rem] font-medium text-foreground truncate">{a.title}</p>
          </div>
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            <span className="text-[0.7rem] text-muted-foreground tabular-nums">{formatTime(a.resolvedAt)}</span>
            {a.amount !== undefined && (
              <span className="text-[0.8125rem] font-semibold tabular-nums text-emerald-400">
                {formatBR(a.amount)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyHero({ onGo, compact = false }: { onGo: (r?: string) => void; compact?: boolean }) {
  return (
    <div className={cn(
      "rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.04] flex items-start gap-4",
      compact ? "p-5" : "p-6",
    )}>
      <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shrink-0">
        <Sparkles className="h-6 w-6 text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="text-lg font-semibold text-foreground">Tudo em ordem por hoje</h2>
        <p className="text-[0.875rem] text-muted-foreground mt-1">
          Nenhuma prioridade crítica encontrada. Você ainda pode revisar tarefas, clientes e oportunidades.
        </p>
        <Button size="sm" variant="outline" onClick={() => onGo("/tarefas")} className="h-8 text-[0.75rem] mt-3">
          Ver tarefas
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </div>
  );
}
