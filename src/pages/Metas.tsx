import { Progress } from "@/components/ui/progress";
import { Target, DollarSign, Users, Briefcase, TrendingUp, Star } from "lucide-react";

const goals = [
  { title: "Faturamento Mensal", current: 12450, target: 15000, unit: "R$", icon: DollarSign, color: "text-emerald-400" },
  { title: "Novos Clientes", current: 3, target: 5, unit: "", icon: Users, color: "text-blue-400" },
  { title: "Projetos Entregues", current: 4, target: 6, unit: "", icon: Briefcase, color: "text-purple-400" },
  { title: "Taxa de Conversão", current: 65, target: 80, unit: "%", icon: TrendingUp, color: "text-amber-400" },
  { title: "Nota de Satisfação", current: 4.7, target: 5, unit: "", icon: Star, color: "text-cyan-400" },
  { title: "Propostas Enviadas", current: 8, target: 10, unit: "", icon: Target, color: "text-pink-400" },
];

const Metas = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {goals.map((goal) => {
      const pct = Math.round((goal.current / goal.target) * 100);
      const Icon = goal.icon;
      return (
        <div key={goal.title} className="orbit-card p-5 hover:orbit-glow transition-all duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-muted">
              <Icon className={`h-5 w-5 ${goal.color}`} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{goal.title}</h3>
              <p className="text-xs text-muted-foreground">
                {goal.unit === "R$" ? `${goal.unit} ${goal.current.toLocaleString("pt-BR")}` : `${goal.current}${goal.unit}`}
                {" / "}
                {goal.unit === "R$" ? `${goal.unit} ${goal.target.toLocaleString("pt-BR")}` : `${goal.target}${goal.unit}`}
              </p>
            </div>
          </div>
          <Progress value={pct} className="h-2 bg-muted" />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">{pct}% concluído</span>
            <span className={`text-xs font-medium ${pct >= 80 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-red-400"}`}>
              {pct >= 80 ? "No caminho" : pct >= 50 ? "Atenção" : "Atrasado"}
            </span>
          </div>
        </div>
      );
    })}
  </div>
);

export default Metas;
