import { ArrowRight, Sparkles, CalendarCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

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

interface GreetingHeroProps {
  nextAction?: { title: string; desc: string; cta: string; onClick?: () => void };
}

export function GreetingHero({ nextAction }: GreetingHeroProps) {
  const { profile } = useAuth();
  const name = (profile?.display_name || "").split(" ")[0] || "por aqui";
  const dateLabel = weekdayLong.format(new Date());

  const openDay = () => window.dispatchEvent(new CustomEvent("kora:open-day"));

  return (
    <section className="orbit-card relative overflow-hidden p-6 sm:p-8 animate-fade-up">
      <div className="absolute -top-24 -right-20 h-72 w-72 rounded-full bg-primary/[0.08] blur-3xl pointer-events-none" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent pointer-events-none" aria-hidden />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[0.75rem] uppercase tracking-[0.18em] text-muted-foreground/70 font-semibold">
            {dateLabel}
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {getGreeting()}, <span className="orbit-gradient-text">{name}</span>.
          </h1>
          <p className="mt-1.5 text-[0.9375rem] text-muted-foreground max-w-xl">
            Aqui está o estado do seu negócio. Comece pelo que importa agora.
          </p>
        </div>

        {nextAction && (
          <div className="relative w-full lg:max-w-md shrink-0 rounded-xl border border-primary/20 bg-primary/[0.05] p-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[0.6875rem] uppercase tracking-wider font-semibold text-primary/80">
                  Próxima melhor ação
                </p>
                <p className="mt-1 text-[0.9375rem] font-semibold text-foreground leading-tight">
                  {nextAction.title}
                </p>
                <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{nextAction.desc}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={nextAction.onClick}
                  className="mt-2 -ml-2 h-8 px-2 text-primary hover:bg-primary/10"
                >
                  {nextAction.cta}
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="relative mt-6 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={openDay} className="gap-1.5">
          <CalendarCheck className="h-3.5 w-3.5" />
          Abrir Central do Dia
        </Button>
      </div>
    </section>
  );
}
