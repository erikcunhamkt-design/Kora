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
import { formatCurrency as intlCurrency, formatDate as intlDate } from "@/lib/format";

const PRIORITY_STYLES: Record<DayPriority, { dot: string; text: string; ring: string; label: string }> = {
  critical: {
    dot: "bg-[#F87171]",
    text: "text-[#F87171]",
    ring: "border-[#EF4444]/25 bg-gradient-to-br from-[#EF4444]/8 via-[#EF4444]/1 to-transparent shadow-[0_4px_20px_rgba(239,68,68,0.08)]",
    label: "Crítico",
  },
  high: {
    dot: "bg-[#FBBF24]",
    text: "text-[#FBBF24]",
    ring: "border-[#F59E0B]/20 bg-gradient-to-br from-[#F59E0B]/5 via-[#F59E0B]/0.5 to-transparent",
    label: "Alta",
  },
  medium: {
    dot: "bg-primary",
    text: "text-primary",
    ring: "border-primary/20 bg-gradient-to-br from-primary/5 via-primary/0.5 to-transparent",
    label: "Média",
  },
  low: {
    dot: "bg-muted-foreground/45",
    text: "text-muted-foreground/80",
    ring: "border-border/40 bg-muted/5",
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
  return intlCurrency(amount, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(iso?: string) {
  if (!iso) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y) return undefined;
  return intlDate(new Date(y, m - 1, d), { day: "2-digit", month: "short" });
}

function openDayCenter() {
  try {
    localStorage.setItem("kora.daycenter.opened.v1", "true");
    window.dispatchEvent(new Event("kora:onboarding:refresh"));
  } catch { /* noop */ }
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
    <div className="rounded-2xl border border-border/20 bg-card/25 backdrop-blur-xs p-6 space-y-5 animate-fade-up">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground leading-tight">Central do Dia</h3>
            <p className="text-xs text-muted-foreground/80 mt-0.5 font-normal">
              Suas prioridades calculadas em tempo real
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {todayCount > 0 && (
            <div
              className="hidden sm:flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/[0.04] px-2 py-1"
              title="Ações concluídas pela Central do Dia"
            >
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              <span className="text-[0.75rem] font-bold text-emerald-400 tabular-nums leading-none">
                {todayCount}
              </span>
              <span className="text-[0.7rem] text-muted-foreground/80 leading-none">
                resolvido{todayCount > 1 ? "s" : ""} hoje
              </span>
            </div>
          )}
          <Button size="sm" variant="outline" onClick={openDayCenter} className="h-8 text-xs font-semibold bg-background/50 border-border/40 hover:bg-muted/30">
            Abrir Central
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </div>

      {result.topAction ? (
        <TopActionCard item={result.topAction} onGo={go} />
      ) : (
        <EmptyTop />
      )}

      {nextItems.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-[0.75rem] font-bold uppercase tracking-wider text-muted-foreground/60">
              Próximos itens
            </h4>
            <span className="text-[0.7rem] text-muted-foreground/70">
              {result.counts.total} no total
            </span>
          </div>
          <div className="space-y-2">
            {nextItems.map((it) => (
              <NextRow key={it.id} item={it} onGo={go} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-border/10">
        {CATEGORY_GROUPS.map((g) => {
          const list = result.byCategory[g.key];
          const critical = list.filter((i) => i.priority === "critical").length;
          const high = list.filter((i) => i.priority === "high").length;
          const attention = critical + high;
          const Icon = CATEGORY_ICON[g.key];
          return (
            <div
              key={g.key}
              className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-xs px-3 py-2.5 flex flex-col gap-1"
            >
              <div className="flex items-center gap-1.5 text-muted-foreground/80">
                <Icon className="h-3 w-3" />
                <span className="text-[0.625rem] font-bold uppercase tracking-wider truncate">
                  {g.label}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[1rem] font-bold tabular-nums text-foreground">
                  {list.length}
                </span>
                {attention > 0 && (
                  <span
                    className={cn(
                      "text-[0.625rem] font-bold px-1.5 py-0.5 rounded",
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
  const isCritical = item.priority === "critical";
  return (
    <div className={cn("relative overflow-hidden rounded-xl border p-5 flex items-start gap-4 transition-all duration-300", style.ring)}>
      {/* Background Atmosphere Glow */}
      <div className={cn(
        "absolute -top-16 -left-16 w-36 h-36 rounded-full blur-[60px] pointer-events-none",
        isCritical ? "bg-destructive/15" : "bg-primary/15"
      )} />
      <div className="absolute -bottom-16 -right-16 w-36 h-36 rounded-full bg-[#EC4899]/5 blur-[60px] pointer-events-none" />

      <div className="h-10 w-10 rounded-lg bg-card-elevated/40 border border-border/40 flex items-center justify-center shrink-0 shadow-lg relative z-10">
        <Flame className={cn("h-5 w-5 animate-pulse", style.text)} />
      </div>
      <div className="flex-1 min-w-0 relative z-10">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Badge variant="outline" className="h-5 px-1.5 text-[9px] font-bold uppercase tracking-wider border-primary/20 bg-primary/5 text-primary">
            Próxima melhor ação
          </Badge>
          <Badge variant="outline" className="h-5 px-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80 border-border/50 bg-background/30">
            <Icon className="h-2.5 w-2.5 mr-1" />
            {DAY_CATEGORY_LABEL[item.category]}
          </Badge>
          <Badge variant="outline" className={cn("h-5 px-1.5 text-[9px] font-bold uppercase tracking-wider border-current/20 bg-current/5", style.text)}>
            {style.label}
          </Badge>
        </div>
        <p className="text-[0.95rem] font-bold text-foreground leading-snug tracking-tight line-clamp-2">{item.title}</p>
        {item.description && (
          <p className="text-xs text-muted-foreground/80 mt-1.5 font-normal leading-relaxed line-clamp-2">{item.description}</p>
        )}
        <div className="flex items-center gap-3 mt-4 flex-wrap pt-3 border-t border-border/10">
          {item.dueDate && (
            <span className="text-[10px] text-muted-foreground/85 inline-flex items-center gap-1 font-medium">
              <CalendarClock className="h-3 w-3" />
              {formatDate(item.dueDate)}
            </span>
          )}
          {item.amount !== undefined && (
            <span className="text-[10px] text-muted-foreground/85 font-semibold tabular-nums">
              {formatBR(item.amount)}
            </span>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <Button size="sm" variant="ghost" onClick={openDayCenter} className="h-7 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
              Central
            </Button>
            {item.route && (
              <Button size="sm" onClick={() => onGo(item.route)} className="h-7 px-3 text-xs font-semibold orbit-gradient text-white border-0">
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
      className="group w-full text-left rounded-xl border border-border/20 bg-card/30 backdrop-blur-xs hover:bg-card-elevated/50 hover:border-border/40 transition-all duration-300 px-4 py-3 flex items-center justify-between gap-4"
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <div className={cn("h-9 w-9 shrink-0 rounded-lg border flex items-center justify-center", style.ring)}>
          <Icon className={cn("h-4 w-4", style.text)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] text-muted-foreground/80 font-semibold uppercase tracking-wider">{DAY_CATEGORY_LABEL[item.category]}</span>
          </div>
          <p className="text-sm font-semibold text-foreground truncate leading-normal">{item.title}</p>
          {item.description && (
            <p className="text-xs text-muted-foreground/75 truncate mt-0.5 font-normal">{item.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="flex flex-col items-end gap-0.5 text-right transition-all duration-300 group-hover:translate-x-[-4px]">
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
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-all duration-300 group-hover:translate-x-1" />
      </div>
    </button>
  );
}

function EmptyTop() {
  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.02] p-5 flex items-start gap-3">
      <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[0.95rem] font-bold text-foreground tracking-tight">Tudo em ordem por hoje</p>
        <p className="text-xs text-muted-foreground/80 mt-1 font-normal leading-relaxed">
          Nenhuma prioridade crítica encontrada. Você pode revisar tarefas, oportunidades ou clientes sem próximo passo.
        </p>
        <Button size="sm" variant="outline" onClick={openDayCenter} className="h-8 text-xs font-semibold bg-background/50 border-border/40 hover:bg-muted/30 mt-3">
          Abrir Central do Dia
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </div>
  );
}
