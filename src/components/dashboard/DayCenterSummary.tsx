import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  FileText,
  Flame,
  ListChecks,
  Sparkles,
  UserCircle2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDayCenterData } from "@/hooks/useDayCenterData";
import { useDayCenterResolvedActions } from "@/hooks/useDayCenterResolvedActions";
import {
  DAY_CATEGORY_LABEL,
  type DayActionItem,
  type DayCategory,
  type DayPriority,
} from "@/lib/dayCenter";

const PRIORITY_STYLES: Record<DayPriority, { dot: string; text: string; ring: string; label: string }> = {
  critical: {
    dot: "bg-destructive",
    text: "text-destructive",
    ring: "border-destructive/30 bg-[hsl(0_70%_8%)]",
    label: "Crítico",
  },
  high: {
    dot: "bg-amber-400",
    text: "text-amber-400",
    ring: "border-amber-500/25 bg-amber-500/[0.05]",
    label: "Alta",
  },
  medium: {
    dot: "bg-primary",
    text: "text-primary",
    ring: "border-primary/25 bg-primary/[0.05]",
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

function openDayCenter() {
  window.dispatchEvent(new Event("kora:open-day"));
}

const CATEGORY_GROUPS: { key: DayCategory; label: string }[] = [
  { key: "task", label: "Tarefas" },
  { key: "commercial", label: "Comercial" },
  { key: "finance", label: "Financeiro" },
  { key: "project", label: "Projetos" },
  { key: "quote", label: "Orçamentos" },
  { key: "client", label: "Clientes" },
];

export function DayCenterSummary() {
  const navigate = useNavigate();
  const result = useDayCenterData();
  const { todayCount } = useDayCenterResolvedActions();

  const nextItems = useMemo(() => {
    const top = result.topAction;
    return result.items.filter((i) => !top || i.id !== top.id).slice(0, 3);
  }, [result]);

  const go = (route?: string) => {
    if (!route) return;
    navigate(route);
  };

  return (
    <div className="orbit-card p-6 space-y-5 animate-fade-up">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground leading-tight">Central do Dia</h3>
            <p className="text-[0.8125rem] text-muted-foreground mt-0.5">
              Suas prioridades calculadas em tempo real
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={openDayCenter} className="h-8 text-[0.75rem] shrink-0">
          Abrir Central
          <ArrowRight className="h-3 w-3" />
        </Button>
      </div>

      {result.topAction ? (
        <TopActionCard item={result.topAction} onGo={go} />
      ) : (
        <EmptyTop />
      )}

      {nextItems.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[0.75rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Próximos itens
            </h4>
            <span className="text-[0.7rem] text-muted-foreground">
              {result.counts.total} no total
            </span>
          </div>
          <div className="space-y-1.5">
            {nextItems.map((it) => (
              <NextRow key={it.id} item={it} onGo={go} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-border/40">
        {CATEGORY_GROUPS.map((g) => {
          const list = result.byCategory[g.key];
          const critical = list.filter((i) => i.priority === "critical").length;
          const high = list.filter((i) => i.priority === "high").length;
          const attention = critical + high;
          const Icon = CATEGORY_ICON[g.key];
          return (
            <div
              key={g.key}
              className="rounded-lg border border-border/50 bg-card/60 px-2.5 py-2 flex flex-col gap-1"
            >
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Icon className="h-3 w-3" />
                <span className="text-[0.625rem] font-semibold uppercase tracking-wider truncate">
                  {g.label}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[1rem] font-semibold tabular-nums text-foreground">
                  {list.length}
                </span>
                {attention > 0 && (
                  <span
                    className={cn(
                      "text-[0.625rem] font-semibold px-1.5 py-0.5 rounded",
                      critical > 0
                        ? "text-destructive bg-destructive/10"
                        : "text-amber-400 bg-amber-500/10",
                    )}
                  >
                    {attention} {critical > 0 ? "crít" : "alta"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopActionCard({ item, onGo }: { item: DayActionItem; onGo: (r?: string) => void }) {
  const style = PRIORITY_STYLES[item.priority];
  const Icon = CATEGORY_ICON[item.category];
  return (
    <div className={cn("rounded-xl border p-4 flex items-start gap-3", style.ring)}>
      <div className="h-10 w-10 rounded-lg bg-card/80 border border-border/40 flex items-center justify-center shrink-0">
        <Flame className={cn("h-5 w-5", style.text)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px] border-current", style.text)}>
            <span className={cn("h-1.5 w-1.5 rounded-full mr-1", style.dot)} />
            Próxima melhor ação
          </Badge>
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-muted-foreground border-border/60">
            <Icon className="h-2.5 w-2.5 mr-1" />
            {DAY_CATEGORY_LABEL[item.category]}
          </Badge>
          <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px] border-current", style.text)}>
            {style.label}
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
          <div className="flex items-center gap-2 ml-auto">
            <Button size="sm" variant="ghost" onClick={openDayCenter} className="h-7 px-2 text-[0.75rem]">
              Central
            </Button>
            {item.route && (
              <Button size="sm" onClick={() => onGo(item.route)} className="h-7 px-3 text-[0.75rem]">
                {item.actionLabel ?? "Abrir"}
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NextRow({ item, onGo }: { item: DayActionItem; onGo: (r?: string) => void }) {
  const style = PRIORITY_STYLES[item.priority];
  const Icon = CATEGORY_ICON[item.category];
  return (
    <button
      onClick={() => onGo(item.route)}
      className="group w-full text-left rounded-lg border border-border/50 bg-card hover:bg-muted/15 hover:border-border transition-all duration-150 px-3 py-2.5 flex items-center gap-3"
    >
      <div className={cn("h-8 w-8 shrink-0 rounded-md border flex items-center justify-center", style.ring)}>
        <Icon className={cn("h-3.5 w-3.5", style.text)} />
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
      {item.dueDate && (
        <span className="text-[0.7rem] text-muted-foreground shrink-0 hidden sm:inline">
          {formatDate(item.dueDate)}
        </span>
      )}
      {item.amount !== undefined && (
        <span className="text-[0.75rem] font-semibold tabular-nums text-foreground/80 shrink-0">
          {formatBR(item.amount)}
        </span>
      )}
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
    </button>
  );
}

function EmptyTop() {
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
        <Button size="sm" variant="outline" onClick={openDayCenter} className="h-7 text-[0.75rem] mt-3">
          Abrir Central do Dia
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </div>
  );
}

