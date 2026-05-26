import { useMemo, useState } from "react";
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
  Briefcase,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  FileText,
  Flame,
  ListChecks,
  RefreshCw,
  Sparkles,
  Target,
  UserCircle2,
  Users,
} from "lucide-react";
import { useDayCenterData } from "@/hooks/useDayCenterData";
import {
  DAY_CATEGORY_LABEL,
  type DayActionItem,
  type DayCategory,
  type DayPriority,
} from "@/lib/dayCenter";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type Filter = "all" | "task" | "commercial" | "finance" | "project";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "task", label: "Tarefas" },
  { key: "commercial", label: "Comercial" },
  { key: "finance", label: "Financeiro" },
  { key: "project", label: "Projetos" },
];

const PRIORITY_STYLES: Record<DayPriority, { dot: string; text: string; ring: string; label: string }> = {
  critical: {
    dot: "bg-destructive",
    text: "text-destructive",
    ring: "border-destructive/40 bg-[hsl(0_70%_8%)]",
    label: "Crítico",
  },
  high: {
    dot: "bg-amber-400",
    text: "text-amber-400",
    ring: "border-amber-500/30 bg-amber-500/[0.05]",
    label: "Alta",
  },
  medium: {
    dot: "bg-primary",
    text: "text-primary",
    ring: "border-primary/30 bg-primary/[0.05]",
    label: "Média",
  },
  low: {
    dot: "bg-muted-foreground/60",
    text: "text-muted-foreground",
    ring: "border-border/60 bg-muted/20",
    label: "Baixa",
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

export function DayCenter({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { tasks } = useTasks();
  const { leads } = useLeads();
  const { transactions } = useFinance();
  const { quotes } = useQuotes();
  const { projects } = useProjects();
  const { clients } = useClients();
  const [filter, setFilter] = useState<Filter>("all");
  const [tick, setTick] = useState(0);

  const result = useMemo(
    () => computeDayCenter({ tasks, leads, quotes, transactions, projects, clients }),
    [tasks, leads, quotes, transactions, projects, clients, tick],
  );

  const go = (route?: string) => {
    if (!route) return;
    onOpenChange(false);
    navigate(route);
  };

  const filtered = useMemo(() => {
    if (filter === "all") return result.items;
    if (filter === "commercial")
      return result.items.filter((i) => i.category === "commercial" || i.category === "quote" || i.category === "client");
    return result.items.filter((i) => i.category === filter);
  }, [result.items, filter]);

  const sectionsToShow: DayCategory[] = ["task", "commercial", "quote", "finance", "project", "client"];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[720px] p-0 flex flex-col bg-card border-l border-border/60"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40 space-y-3">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-[1rem] font-semibold flex items-center gap-2">
                Central do Dia
                {result.counts.critical > 0 && (
                  <Badge variant="destructive" className="h-5 px-2 text-[10px]">
                    {result.counts.critical} crítico{result.counts.critical > 1 ? "s" : ""}
                  </Badge>
                )}
              </SheetTitle>
              <SheetDescription className="text-[0.8125rem] text-muted-foreground leading-snug">
                Prioridades, tarefas, follow-ups e alertas para manter sua operação em movimento.
              </SheetDescription>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setTick((t) => t + 1)}
                className="h-8 px-2 text-muted-foreground"
                title="Atualizar"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => go("/tarefas")}
                className="h-8 text-[0.75rem]"
              >
                Ver tarefas
              </Button>
            </div>
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-5 gap-2">
            <MiniStat icon={CalendarClock} label="Hoje" value={result.counts.today} accent="primary" />
            <MiniStat icon={AlertTriangle} label="Atrasados" value={result.counts.overdue} accent="destructive" />
            <MiniStat icon={Users} label="Follow-ups" value={result.counts.followUps} accent="amber" />
            <MiniStat icon={DollarSign} label="Recebíveis" value={result.counts.receivables} accent="emerald" />
            <MiniStat icon={Briefcase} label="Projetos" value={result.counts.projectsAttention} accent="primary" />
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-5 space-y-6">
            {/* Prioridade principal */}
            {result.topAction ? (
              <TopActionCard item={result.topAction} onGo={go} />
            ) : (
              <EmptyTopState onGo={go} />
            )}

            {/* Filtros */}
            {result.items.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {FILTERS.map((f) => {
                  const active = filter === f.key;
                  return (
                    <button
                      key={f.key}
                      onClick={() => setFilter(f.key)}
                      className={cn(
                        "h-7 px-3 rounded-full text-[0.75rem] font-medium border transition-all duration-150",
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
            )}

            {/* Sections */}
            {filter === "all" ? (
              <div className="space-y-6">
                {sectionsToShow.map((cat) => {
                  const items = result.byCategory[cat];
                  if (!items.length) return null;
                  return (
                    <CategorySection
                      key={cat}
                      title={DAY_CATEGORY_LABEL[cat]}
                      icon={CATEGORY_ICON[cat]}
                      items={items}
                      onGo={go}
                    />
                  );
                })}
                {result.items.length === 0 && <EmptyListState onGo={go} />}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.length === 0 ? (
                  <EmptyListState onGo={go} />
                ) : (
                  filtered.map((it) => <ActionRow key={it.id} item={it} onGo={go} />)
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ===== Componentes auxiliares =====

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
    destructive: "text-destructive bg-destructive/10 border-destructive/25",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  } as const;
  return (
    <div className="rounded-lg border border-border/50 bg-card/60 px-2.5 py-2 flex flex-col items-start gap-1 min-w-0">
      <div className={cn("h-5 w-5 rounded-md border flex items-center justify-center", accentMap[accent])}>
        <Icon className="h-2.5 w-2.5" />
      </div>
      <span className="text-[1.1rem] font-semibold tabular-nums leading-none text-foreground">{value}</span>
      <span className="text-[0.625rem] font-semibold text-muted-foreground uppercase tracking-wider truncate w-full">
        {label}
      </span>
    </div>
  );
}

function TopActionCard({ item, onGo }: { item: DayActionItem; onGo: (r?: string) => void }) {
  const style = PRIORITY_STYLES[item.priority];
  const Icon = CATEGORY_ICON[item.category];
  return (
    <div
      className={cn(
        "rounded-xl border p-4 flex items-start gap-3 transition-all",
        style.ring,
      )}
    >
      <div className="h-10 w-10 rounded-lg bg-card/80 border border-border/40 flex items-center justify-center shrink-0">
        <Flame className={cn("h-5 w-5", style.text)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px] border-current", style.text)}>
            <span className={cn("h-1.5 w-1.5 rounded-full mr-1", style.dot)} />
            Próxima melhor ação
          </Badge>
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-muted-foreground border-border/60">
            <Icon className="h-2.5 w-2.5 mr-1" />
            {DAY_CATEGORY_LABEL[item.category]}
          </Badge>
        </div>
        <p className="text-[0.95rem] font-semibold text-foreground leading-snug line-clamp-2">{item.title}</p>
        {item.description && (
          <p className="text-[0.8125rem] text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
        )}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          {item.dueDate && (
            <span className="text-[0.7rem] text-muted-foreground inline-flex items-center gap-1">
              <CalendarClock className="h-3 w-3" />
              {formatDate(item.dueDate)}
            </span>
          )}
          {item.amount !== undefined && (
            <span className="text-[0.7rem] text-muted-foreground font-medium tabular-nums">
              {formatBR(item.amount)}
            </span>
          )}
          <Button size="sm" onClick={() => onGo(item.route)} className="h-7 px-3 text-[0.75rem] ml-auto">
            {item.actionLabel ?? "Abrir"}
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function CategorySection({
  title,
  icon: Icon,
  items,
  onGo,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: DayActionItem[];
  onGo: (r?: string) => void;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[0.8125rem] font-semibold text-foreground flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          {title}
          <Badge variant="outline" className="h-4 px-1.5 text-[10px] text-muted-foreground border-border/60">
            {items.length}
          </Badge>
        </h3>
      </div>
      <div className="space-y-1.5">
        {items.slice(0, 5).map((it) => (
          <ActionRow key={it.id} item={it} onGo={onGo} />
        ))}
      </div>
    </section>
  );
}

function ActionRow({ item, onGo }: { item: DayActionItem; onGo: (r?: string) => void }) {
  const style = PRIORITY_STYLES[item.priority];
  const Icon = CATEGORY_ICON[item.category];
  return (
    <button
      onClick={() => onGo(item.route)}
      className="group w-full text-left rounded-lg border border-border/50 bg-card hover:bg-muted/15 hover:border-border transition-all duration-150 px-3 py-2.5 flex items-center gap-3"
    >
      <div className={cn("h-9 w-9 shrink-0 rounded-md border flex items-center justify-center", style.ring)}>
        <Icon className={cn("h-4 w-4", style.text)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[0.8125rem] font-medium text-foreground truncate flex-1">{item.title}</p>
          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", style.dot)} title={style.label} />
        </div>
        {item.description && (
          <p className="text-[0.7rem] text-muted-foreground truncate mt-0.5">{item.description}</p>
        )}
      </div>
      {item.amount !== undefined && (
        <span className="text-[0.75rem] font-semibold tabular-nums text-foreground/80 shrink-0">
          {formatBR(item.amount)}
        </span>
      )}
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
    </button>
  );
}

function EmptyTopState({ onGo }: { onGo: (r?: string) => void }) {
  return (
    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] p-5 flex items-start gap-3">
      <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shrink-0">
        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[0.95rem] font-semibold text-foreground">Tudo em ordem por hoje</p>
        <p className="text-[0.8125rem] text-muted-foreground mt-1">
          Nenhuma prioridade crítica encontrada. Você pode revisar tarefas, oportunidades ou clientes
          sem próximo passo.
        </p>
        <div className="flex gap-2 mt-3">
          <Button size="sm" variant="outline" onClick={() => onGo("/tarefas")} className="h-7 text-[0.75rem]">
            Ver tarefas
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onGo("/crm")} className="h-7 text-[0.75rem]">
            <Target className="h-3 w-3 mr-1" /> Abrir CRM
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptyListState({ onGo }: { onGo: (r?: string) => void }) {
  return (
    <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-4 py-6 text-center flex flex-col items-center gap-2">
      <div className="h-8 w-8 rounded-full bg-muted/40 flex items-center justify-center">
        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-[0.8125rem] font-medium text-foreground">Nada por aqui</p>
      <p className="text-[0.7rem] text-muted-foreground max-w-[320px]">
        Nenhum item nesta categoria precisa de atenção agora.
      </p>
      <Button size="sm" variant="outline" onClick={() => onGo("/tarefas")} className="h-7 text-[0.75rem] mt-1">
        Ver tarefas
      </Button>
    </div>
  );
}
