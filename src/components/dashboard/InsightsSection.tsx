import { Lightbulb, TrendingUp, AlertTriangle, Target } from "lucide-react";

const insights = [
  { icon: Target, color: "text-emerald-400 bg-emerald-500/10", text: "Você está próximo de bater sua meta mensal — faltam R$ 3.500!" },
  { icon: AlertTriangle, color: "text-amber-400 bg-amber-500/10", text: "3 tarefas estão atrasadas. Revise suas prioridades." },
  { icon: TrendingUp, color: "text-primary bg-primary/10", text: "Seu faturamento cresceu 20% em relação ao mês passado." },
  { icon: Lightbulb, color: "text-accent bg-accent/10", text: "Você tem 2 propostas aguardando resposta há mais de 5 dias." },
];

export function InsightsSection() {
  return (
    <div className="orbit-card p-6 animate-fade-up">
      <h3 className="text-base font-semibold text-foreground mb-1">Insights</h3>
      <p className="text-[0.8125rem] text-muted-foreground mb-5">Dicas baseadas na sua atividade</p>
      <div className="space-y-2.5">
        {insights.map((ins, i) => {
          const Icon = ins.icon;
          return (
            <div key={i} className="flex items-start gap-3 p-3.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all duration-200 border border-transparent hover:border-border/50">
              <div className={`p-2 rounded-lg ${ins.color} shrink-0 mt-0.5`}><Icon className="h-4 w-4" /></div>
              <p className="text-[0.9375rem] text-foreground/90 leading-relaxed">{ins.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
