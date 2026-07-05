import { Progress } from "@/components/ui/progress";
import { formatNumber as intlNumber } from "@/lib/format";

const goals = [
  { title: "Faturamento Mensal", current: 12450, target: 15000, unit: "R$" },
  { title: "Novos Clientes", current: 3, target: 5, unit: "" },
  { title: "Projetos Entregues", current: 4, target: 6, unit: "" },
];

export function GoalsSection() {
  return (
    <div className="orbit-card p-6 animate-fade-up">
      <h3 className="text-base font-semibold text-foreground mb-1">Metas do Mês</h3>
      <p className="text-[0.8125rem] text-muted-foreground mb-5">Progresso atual</p>
      <div className="space-y-6">
        {goals.map((goal) => {
          const pct = Math.round((goal.current / goal.target) * 100);
          const isComplete = pct >= 100;
          return (
            <div key={goal.title}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[0.9375rem] font-medium text-foreground">{goal.title}</span>
                <span className="text-[0.8125rem] text-muted-foreground font-medium">
                  {goal.unit} {intlNumber(goal.current)} / {goal.unit} {intlNumber(goal.target)}
                </span>
              </div>
              <Progress value={pct} className="h-1.5 bg-muted" />
              <p className={`text-[0.8125rem] mt-2 font-medium ${isComplete ? "text-emerald-400" : "text-muted-foreground"}`}>
                {pct}% concluído
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
