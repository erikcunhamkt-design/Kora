import { Lightbulb, TrendingUp, AlertTriangle, Target } from "lucide-react";

const insights = [
  { icon: Target, color: "text-emerald-400 bg-emerald-400/10", text: "Você está próximo de bater sua meta mensal — faltam R$ 3.500!" },
  { icon: AlertTriangle, color: "text-amber-400 bg-amber-400/10", text: "3 tarefas estão atrasadas. Revise suas prioridades." },
  { icon: TrendingUp, color: "text-primary bg-primary/10", text: "Seu faturamento cresceu 20% em relação ao mês passado." },
  { icon: Lightbulb, color: "text-secondary bg-secondary/10", text: "Você tem 2 propostas aguardando resposta há mais de 5 dias." },
];

export function InsightsSection() {
  return (
    <div className="orbit-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-1">Insights</h3>
      <p className="text-xs text-muted-foreground mb-4">Dicas baseadas na sua atividade</p>
      <div className="space-y-3">
        {insights.map((ins, i) => {
          const Icon = ins.icon;
          return (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <div className={`p-1.5 rounded-lg ${ins.color} shrink-0 mt-0.5`}><Icon className="h-4 w-4" /></div>
              <p className="text-sm text-foreground leading-relaxed">{ins.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
