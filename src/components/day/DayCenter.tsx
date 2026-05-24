import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  FileText,
  ListChecks,
  PhoneCall,
  Sparkles,
  Users,
  CalendarDays,
} from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { useLeads } from "@/hooks/useLeads";
import { useFinance } from "@/hooks/useFinance";
import { useQuotes } from "@/hooks/useQuotes";
import { useScheduling } from "@/hooks/useScheduling";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type Priority = "alta" | "média" | "baixa";

interface PriorityItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  route: string;
  action: string;
}

const PRIORITY_STYLE: Record<Priority, string> = {
  alta: "border-destructive/40 bg-destructive/[0.06] text-destructive/90",
  média: "border-primary/30 bg-primary/[0.06] text-primary/90",
  baixa: "border-border/60 bg-muted/30 text-muted-foreground",
};

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function DayCenter({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { tasks } = useTasks();
  const { leads } = useLeads();
  const { transactions } = useFinance();
  const { quotes } = useQuotes();
  const { appointments, meetingTypes } = useScheduling();

  const data = useMemo(() => {
    const iso = todayISO();

    const openTasks = tasks.filter((t) => t.status !== "concluido");
    const highTasks = openTasks
      .filter((t) => t.priority === "alta")
      .slice(0, 4);
    const overdueTasksCount = openTasks.filter((t) => t.priority === "alta").length;

    const followUps = leads
      .filter(
        (l) =>
          !["fechado", "perdido"].includes(l.stage) &&
          (l.priority === "alta" || !!l.nextAction),
      )
      .slice(0, 5);

    const overdueFinance = transactions.filter(
      (t) => t.status === "overdue" || (t.status === "pending" && t.dueDate <= iso),
    );

    const pendingQuotes = quotes.filter((q) => q.status === "enviado");

    const todayAppointments = appointments.filter(
      (a) => a.date === iso && a.status === "scheduled",
    );

    const priority: PriorityItem[] = [];

    if (overdueTasksCount > 0) {
      priority.push({
        id: "p-tasks",
        icon: ListChecks,
        title: `${overdueTasksCount} ${overdueTasksCount === 1 ? "tarefa de alta prioridade" : "tarefas de alta prioridade"}`,
        description: highTasks[0]?.title ?? "Revise sua lista de prioridades",
        category: "Tarefas",
        priority: "alta",
        route: "/tarefas",
        action: "Abrir tarefas",
      });
    }

    if (pendingQuotes.length > 0) {
      priority.push({
        id: "p-quote",
        icon: FileText,
        title: pendingQuotes.length === 1 ? "Proposta aguardando retorno" : `${pendingQuotes.length} propostas aguardando`,
        description: pendingQuotes[0].clientName + " · " + pendingQuotes[0].title,
        category: "Vendas",
        priority: "média",
        route: "/vendas",
        action: "Abrir vendas",
      });
    }

    const hotLead = leads.find((l) => l.priority === "alta" && !["fechado", "perdido"].includes(l.stage));
    if (hotLead) {
      priority.push({
        id: "p-lead",
        icon: PhoneCall,
        title: "Lead quente sem follow-up",
        description: `${hotLead.name} · ${hotLead.company}`,
        category: "CRM",
        priority: "alta",
        route: "/crm",
        action: "Abrir CRM",
      });
    }

    if (overdueFinance.length > 0) {
      const totalOverdue = overdueFinance.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
      priority.push({
        id: "p-finance",
        icon: DollarSign,
        title: overdueFinance.length === 1 ? "Conta vencida" : `${overdueFinance.length} contas vencidas`,
        description: `Saldo afetado: R$ ${Math.abs(totalOverdue).toLocaleString("pt-BR")}`,
        category: "Financeiro",
        priority: "alta",
        route: "/financeiro",
        action: "Abrir financeiro",
      });
    }

    return {
      counts: {
        tasks: openTasks.length,
        overdue: overdueTasksCount + overdueFinance.length,
        followUps: followUps.length,
        agenda: todayAppointments.length,
      },
      priority,
      followUps,
      overdueFinance: overdueFinance.slice(0, 4),
      highTasks,
      todayAppointments,
    };
  }, [tasks, leads, transactions, quotes, appointments]);

  const totalPending =
    data.counts.tasks + data.counts.overdue + data.counts.followUps + data.counts.agenda;

  const go = (route: string) => {
    onOpenChange(false);
    navigate(route);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[440px] p-0 flex flex-col bg-card border-l border-border/60"
      >
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/40 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-[0.95rem] font-semibold flex items-center gap-2">
                Central do Dia
                {totalPending > 0 && (
                  <Badge
                    variant="outline"
                    className="h-5 px-2 text-[10px] font-semibold bg-primary/10 text-primary border-primary/30"
                  >
                    {totalPending} {totalPending === 1 ? "item" : "itens"}
                  </Badge>
                )}
              </SheetTitle>
              <SheetDescription className="text-[0.78rem] text-muted-foreground">
                O que precisa da sua atenção agora
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-5 py-4 space-y-6">
            {/* Mini counters */}
            <div className="grid grid-cols-4 gap-2">
              <MiniStat icon={ListChecks} label="Tarefas" value={data.counts.tasks} accent="primary" />
              <MiniStat icon={AlertTriangle} label="Atrasadas" value={data.counts.overdue} accent="destructive" />
              <MiniStat icon={Users} label="Follow-ups" value={data.counts.followUps} accent="amber" />
              <MiniStat icon={CalendarDays} label="Agenda" value={data.counts.agenda} accent="emerald" />
            </div>

            {/* Prioridade agora */}
            <Section title="Prioridade agora" hint="Itens com maior impacto hoje">
              {data.priority.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="Tudo sob controle"
                  description="Você não tem prioridades urgentes neste momento."
                />
              ) : (
                <div className="space-y-2">
                  {data.priority.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => go(item.route)}
                        className="group w-full text-left rounded-lg border border-border/60 bg-card hover:bg-muted/20 hover:border-primary/30 transition-all duration-150 px-3 py-2.5 flex items-center gap-3"
                      >
                        <div
                          className={cn(
                            "h-9 w-9 shrink-0 rounded-md border flex items-center justify-center",
                            PRIORITY_STYLE[item.priority],
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <p className="text-[0.8125rem] font-medium text-foreground line-clamp-2 leading-snug flex-1">
                              {item.title}
                            </p>
                            <Badge
                              variant="outline"
                              className="h-4 px-1 text-[9px] font-medium border-border/60 text-muted-foreground shrink-0 mt-0.5"
                            >
                              {item.category}
                            </Badge>
                          </div>
                          <p className="text-[0.7rem] text-muted-foreground truncate mt-1">
                            {item.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-[0.7rem] font-medium text-primary/90 group-hover:text-primary shrink-0 self-center">
                          <span className="hidden sm:inline whitespace-nowrap">{item.action}</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* Agenda */}
            <Section title="Minha agenda" hint="Compromissos de hoje">
              {data.todayAppointments.length === 0 ? (
                <EmptyState
                  icon={CalendarClock}
                  title="Sem reuniões para hoje"
                  description="Quando o Google Calendar for conectado, seus compromissos aparecerão aqui."
                />
              ) : (
                <div className="space-y-1.5">
                  {data.todayAppointments.map((a) => {
                    const mt = meetingTypes.find((m) => m.id === a.meetingTypeId);
                    return (
                      <button
                        key={a.id}
                        onClick={() => go("/presenca")}
                        className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg border border-border/50 bg-card hover:bg-muted/20 transition-colors"
                      >
                        <div className="flex flex-col items-center justify-center w-12 shrink-0">
                          <span className="text-[0.65rem] text-muted-foreground uppercase tracking-wide">Hoje</span>
                          <span className="text-[0.875rem] font-semibold text-foreground tabular-nums">{a.time}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[0.8125rem] font-medium text-foreground truncate">{a.name}</p>
                          <p className="text-[0.7rem] text-muted-foreground truncate">
                            {mt?.name ?? "Reunião"} · {mt?.durationMinutes ?? 30} min
                          </p>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* Tarefas */}
            <Section title="Tarefas de hoje" hint="Suas prioridades abertas">
              {data.highTasks.length === 0 ? (
                <EmptyState
                  icon={ListChecks}
                  title="Nenhuma tarefa urgente"
                  description="Você está em dia. Que tal planejar algo novo?"
                  action={
                    <Button size="sm" variant="outline" onClick={() => go("/tarefas")}>
                      Abrir tarefas
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-1.5">
                  {data.highTasks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => go("/tarefas")}
                      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg border border-border/50 bg-card hover:bg-muted/20 transition-colors"
                    >
                      <Clock className="h-3.5 w-3.5 text-primary/80 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.8125rem] font-medium truncate">{t.title}</p>
                        <p className="text-[0.7rem] text-muted-foreground/80 truncate">
                          {t.client} · {t.deadline}
                        </p>
                      </div>
                      <Badge variant="outline" className="h-4 px-1 text-[9px] border-primary/30 text-primary/90">
                        {t.priority}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </Section>

            {/* Follow-ups */}
            <Section title="Follow-ups" hint="Leads que precisam de retorno">
              {data.followUps.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="Nenhum follow-up urgente agora."
                  description="Seu pipeline está fluindo."
                />
              ) : (
                <div className="space-y-1.5">
                  {data.followUps.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => go("/crm")}
                      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg border border-border/50 bg-card hover:bg-muted/20 transition-colors"
                    >
                      <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[0.65rem] font-semibold text-primary shrink-0">
                        {l.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.8125rem] font-medium truncate">{l.name}</p>
                        <p className="text-[0.7rem] text-muted-foreground/80 truncate">
                          {l.nextAction ?? `${l.company} · ${l.stage}`}
                        </p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </Section>

            {/* Financeiro */}
            <Section title="Financeiro do dia" hint="Contas vencendo ou vencidas">
              {data.overdueFinance.length === 0 ? (
                <EmptyState
                  icon={DollarSign}
                  title="Sem pendências hoje"
                  description="Nenhuma conta vencendo no momento."
                />
              ) : (
                <div className="space-y-1.5">
                  {data.overdueFinance.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => go("/financeiro")}
                      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg border border-border/50 bg-card hover:bg-muted/20 transition-colors"
                    >
                      <div
                        className={cn(
                          "h-7 w-7 rounded-md flex items-center justify-center shrink-0 border",
                          t.type === "income"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500/90"
                            : "border-destructive/30 bg-destructive/10 text-destructive/90",
                        )}
                      >
                        <DollarSign className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.8125rem] font-medium truncate">{t.title}</p>
                        <p className="text-[0.7rem] text-muted-foreground/80 truncate">
                          {t.clientName ?? t.category} · vence {t.dueDate}
                        </p>
                      </div>
                      <span className="text-[0.8125rem] font-semibold tabular-nums">
                        R$ {t.amount.toLocaleString("pt-BR")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent: "primary" | "destructive" | "amber" | "emerald";
}) {
  const accentMap = {
    primary: "text-primary/90 bg-primary/10 border-primary/20",
    destructive: "text-destructive/90 bg-destructive/10 border-destructive/25",
    amber: "text-amber-500/90 bg-amber-500/10 border-amber-500/20",
    emerald: "text-emerald-500/90 bg-emerald-500/10 border-emerald-500/20",
  } as const;
  return (
    <div className="rounded-lg border border-border/50 bg-card/60 px-2 py-2 flex flex-col items-start gap-1">
      <div className={cn("h-6 w-6 rounded-md border flex items-center justify-center", accentMap[accent])}>
        <Icon className="h-3 w-3" />
      </div>
      <span className="text-[1.1rem] font-semibold tabular-nums leading-none">{value}</span>
      <span className="text-[0.65rem] text-muted-foreground/80 uppercase tracking-wide">{label}</span>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[0.8125rem] font-semibold text-foreground">{title}</h3>
        {hint && <span className="text-[0.65rem] text-muted-foreground/70">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border/50 bg-muted/10 px-4 py-5 text-center flex flex-col items-center gap-2">
      <div className="h-8 w-8 rounded-full bg-muted/40 flex items-center justify-center">
        <Icon className="h-4 w-4 text-muted-foreground/70" />
      </div>
      <p className="text-[0.8125rem] font-medium text-foreground/90">{title}</p>
      <p className="text-[0.7rem] text-muted-foreground/70 max-w-[280px]">{description}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
