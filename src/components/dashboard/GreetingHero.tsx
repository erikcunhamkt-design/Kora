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
  try {
    localStorage.setItem("kora.daycenter.opened.v1", "true");
    window.dispatchEvent(new Event("kora:onboarding:refresh"));
  } catch { /* noop */ }
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
    <section className="relative overflow-hidden rounded-2xl border border-border/20 bg-card/25 backdrop-blur-xs px-7 py-9 sm:px-10 sm:py-12 animate-fade-up">
      {/* Ambient glow */}
      <div className="absolute -top-32 -right-24 h-80 w-80 rounded-full bg-primary/[0.12] blur-[120px] pointer-events-none" aria-hidden />
      <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-[#EC4899]/[0.06] blur-[100px] pointer-events-none" aria-hidden />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(348_94%_52%_/_0.06),transparent_55%)] pointer-events-none" aria-hidden />

      <div className="relative grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 lg:gap-12 items-center">
        <div className="min-w-0">
          <p className="text-[0.6875rem] uppercase tracking-[0.22em] text-muted-foreground/60 font-semibold">
            {dateLabel}
          </p>
          <h1 className="mt-3 text-[2rem] sm:text-[2.5rem] font-extrabold tracking-tight text-foreground leading-[1.05]">
            {getGreeting()}, <span className="orbit-gradient-text">{name}</span>.
          </h1>
          <p className="mt-3 text-[0.9375rem] text-muted-foreground/90 max-w-lg leading-relaxed font-normal">
            {subtext}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={openDayCenter} className="gap-1.5 h-9 font-semibold bg-background/50 border-border/40 hover:bg-muted/30">
              <CalendarCheck className="h-3.5 w-3.5 text-primary" />
              Abrir Central do Dia
            </Button>
          </div>
        </div>

        {topAction ? (
          <div
            className={cn(
              "relative overflow-hidden rounded-xl border p-5 transition-all duration-300",
              isCritical
                ? "border-destructive/20 bg-destructive/[0.02] shadow-[0_4px_24px_rgba(239,68,68,0.06)]"
                : "border-primary/20 bg-primary/[0.02] shadow-[0_4px_24px_rgba(236,72,153,0.06)]",
            )}
          >
            {/* Action Card Backlight Glow */}
            <div className={cn(
              "absolute -top-16 -left-16 w-36 h-36 rounded-full blur-[60px] pointer-events-none",
              isCritical ? "bg-destructive/15" : "bg-primary/15"
            )} />
            <div className="absolute -bottom-16 -right-16 w-36 h-36 rounded-full bg-[#EC4899]/5 blur-[60px] pointer-events-none" />

            <div className="relative z-10 flex items-center gap-2 mb-3 flex-wrap">
              <div
                className={cn(
                  "h-7 w-7 rounded-md border flex items-center justify-center",
                  isCritical ? "border-destructive/20 bg-destructive/5 text-destructive" : "border-primary/20 bg-primary/5 text-primary",
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
                  "text-[0.6875rem] uppercase tracking-[0.16em] font-bold",
                  isCritical ? "text-destructive" : "text-primary",
                )}
              >
                Próxima melhor ação
              </p>
              <Badge
                variant="outline"
                className="h-5 px-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80 border-border/50 bg-background/30 ml-auto"
              >
                {DAY_CATEGORY_LABEL[topAction.category]}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "h-5 px-1.5 text-[9px] font-bold uppercase tracking-wider border-current/20 bg-current/5",
                  isCritical ? "text-destructive" : "text-primary",
                )}
              >
                {PRIORITY_LABEL[topAction.priority]}
              </Badge>
            </div>
            <p className="relative z-10 text-[0.95rem] font-bold text-foreground leading-snug tracking-tight line-clamp-2">
              {topAction.title}
            </p>
            {topAction.description && (
              <p className="relative z-10 mt-1.5 text-xs text-muted-foreground/80 leading-relaxed font-normal line-clamp-2">
                {topAction.description}
              </p>
            )}
            <div className="relative z-10 mt-4 flex items-center justify-end">
              <Button
                size="sm"
                onClick={openDayCenter}
                className="h-8 text-xs font-semibold bg-primary/15 text-white border border-primary/30 hover:bg-primary/25 transition-all duration-300"
              >
                Abrir Central do Dia
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative rounded-xl border border-emerald-500/20 bg-emerald-500/[0.02] p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <p className="text-[0.6875rem] uppercase tracking-[0.16em] font-semibold text-emerald-400">
                Nenhuma prioridade crítica agora
              </p>
            </div>
            <p className="text-[0.95rem] font-bold text-foreground leading-snug tracking-tight">
              Sua operação está sem alertas importantes neste momento.
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground/80 leading-relaxed font-normal">
              Aproveite para planejar próximos passos ou revisar clientes sem follow-up.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
