import { ArrowRight, CalendarCheck, CheckCircle2, Flame, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useDayCenterData } from "@/hooks/useDayCenterData";
import { DAY_CATEGORY_LABEL, type DayPriority } from "@/lib/dayCenter";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const weekdayLong = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
});

const PRIORITY_LABEL: Record<DayPriority, string> = {
  critical: "Crítico",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

function openDayCenter() {
  window.dispatchEvent(new Event("kora:open-day"));
}

export function GreetingHero() {
  const { profile } = useAuth();
  const name = (profile?.display_name || "").split(" ")[0] || "por aqui";
  const dateLabel = weekdayLong.format(new Date());

  const { topAction, counts } = useDayCenterData();

  let subtext = "Tudo em ordem por hoje. Revise sua operação com calma.";
  if (counts.critical > 0) {
    subtext = "Existe uma prioridade crítica pedindo atenção agora.";
  } else if (counts.high > 0) {
    subtext = "Você tem prioridades importantes para resolver hoje.";
  }

  const isCritical = topAction?.priority === "critical";

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-card via-card to-card/80 px-7 py-9 sm:px-10 sm:py-12 animate-fade-up">
      {/* Ambient glow */}
      <div className="absolute -top-32 -right-24 h-80 w-80 rounded-full bg-primary/[0.07] blur-[120px] pointer-events-none" aria-hidden />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(348_94%_52%_/_0.04),transparent_55%)] pointer-events-none" aria-hidden />

      <div className="relative grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 lg:gap-12 items-center">
        <div className="min-w-0">
          <p className="text-[0.6875rem] uppercase tracking-[0.22em] text-muted-foreground/60 font-semibold">
            {dateLabel}
          </p>
          <h1 className="mt-3 text-[2rem] sm:text-[2.5rem] font-bold tracking-tight text-foreground leading-[1.05]">
            {getGreeting()}, <span className="orbit-gradient-text">{name}</span>.
          </h1>
          <p className="mt-3 text-[1rem] text-muted-foreground max-w-lg leading-relaxed">
            {subtext}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={openDayCenter} className="gap-1.5 h-9">
              <CalendarCheck className="h-3.5 w-3.5" />
              Abrir Central do Dia
            </Button>
          </div>
        </div>

        {topAction ? (
          <div
            className={cn(
              "relative rounded-xl border p-5",
              isCritical
                ? "border-destructive/30 bg-[hsl(0_70%_8%)] shadow-[0_0_40px_-12px_hsl(0_70%_30%/0.4)]"
                : "border-primary/25 bg-primary/[0.06] shadow-[0_0_40px_-12px_hsl(348_94%_52%_/_0.25)]",
            )}
          >
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <div
                className={cn(
                  "h-7 w-7 rounded-md flex items-center justify-center",
                  isCritical ? "bg-destructive/20" : "bg-primary/20",
                )}
              >
                {isCritical ? (
                  <Flame className="h-3.5 w-3.5 text-destructive" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                )}
              </div>
              <p
                className={cn(
                  "text-[0.6875rem] uppercase tracking-[0.16em] font-semibold",
                  isCritical ? "text-destructive" : "text-primary",
                )}
              >
                Próxima melhor ação
              </p>
              <Badge
                variant="outline"
                className="h-5 px-1.5 text-[10px] text-muted-foreground border-border/60 ml-auto"
              >
                {DAY_CATEGORY_LABEL[topAction.category]}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "h-5 px-1.5 text-[10px] border-current",
                  isCritical ? "text-destructive" : "text-primary",
                )}
              >
                {PRIORITY_LABEL[topAction.priority]}
              </Badge>
            </div>
            <p className="text-[1.0625rem] font-semibold text-foreground leading-snug line-clamp-2">
              {topAction.title}
            </p>
            {topAction.description && (
              <p className="mt-1.5 text-[0.875rem] text-muted-foreground leading-relaxed line-clamp-2">
                {topAction.description}
              </p>
            )}
            <Button
              size="sm"
              onClick={openDayCenter}
              className="mt-4 h-8 gap-1 bg-primary/15 text-primary border border-primary/25 hover:bg-primary/25"
            >
              Abrir Central do Dia
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="relative rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-md bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <p className="text-[0.6875rem] uppercase tracking-[0.16em] font-semibold text-emerald-400">
                Nenhuma prioridade crítica agora
              </p>
            </div>
            <p className="text-[0.95rem] font-medium text-foreground leading-snug">
              Sua operação está sem alertas importantes neste momento.
            </p>
            <p className="mt-1.5 text-[0.8125rem] text-muted-foreground leading-relaxed">
              Aproveite para planejar próximos passos ou revisar clientes sem follow-up.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
