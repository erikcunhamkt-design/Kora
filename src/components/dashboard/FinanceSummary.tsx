import { Progress } from "@/components/ui/progress";
import { TrendingUp, ArrowUpRight } from "lucide-react";

export function FinanceSummary() {
  const revenue = 6500;
  const target = 10000;
  const pct = Math.round((revenue / target) * 100);

  return (
    <div className="orbit-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-1">Resumo Financeiro</h3>
      <p className="text-xs text-muted-foreground mb-4">Faturamento vs Meta</p>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-2xl font-bold text-foreground">R$ {revenue.toLocaleString("pt-BR")}</span>
        <span className="text-sm text-muted-foreground">/ R$ {target.toLocaleString("pt-BR")}</span>
      </div>
      <Progress value={pct} className="h-2 bg-muted mt-2" />
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-muted-foreground">{pct}% da meta</span>
        <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium"><ArrowUpRight className="h-3 w-3" />+20% vs mês anterior</span>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
        {[
          { label: "Receita", val: "R$ 8.200", color: "text-emerald-400" },
          { label: "Despesas", val: "R$ 1.700", color: "text-destructive" },
          { label: "Lucro", val: "R$ 6.500", color: "text-primary" },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-sm font-semibold ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
