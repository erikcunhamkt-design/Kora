import { Progress } from "@/components/ui/progress";
import { ArrowUpRight } from "lucide-react";

export function FinanceSummary() {
  const revenue = 6500;
  const target = 10000;
  const pct = Math.round((revenue / target) * 100);

  return (
    <div className="orbit-card p-6 animate-fade-up">
      <h3 className="text-base font-semibold text-foreground mb-1">Resumo Financeiro</h3>
      <p className="text-[0.8125rem] text-muted-foreground mb-5">Faturamento vs Meta</p>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[2rem] font-bold text-foreground tracking-tight leading-none">R$ {revenue.toLocaleString("pt-BR")}</span>
        <span className="text-[0.9375rem] text-muted-foreground">/ R$ {target.toLocaleString("pt-BR")}</span>
      </div>
      <Progress value={pct} className="h-1.5 bg-muted mt-3" />
      <div className="flex items-center justify-between mt-2.5">
        <span className="text-[0.8125rem] text-muted-foreground">{pct}% da meta</span>
        <span className="flex items-center gap-1 text-[0.8125rem] text-emerald-400 font-medium"><ArrowUpRight className="h-3.5 w-3.5" />+20% vs mês anterior</span>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-divider">
        {[
          { label: "Receita", val: "R$ 8.200", color: "text-emerald-400" },
          { label: "Despesas", val: "R$ 1.700", color: "text-destructive" },
          { label: "Lucro", val: "R$ 6.500", color: "text-primary" },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-[0.8125rem] text-muted-foreground mb-1">{s.label}</p>
            <p className={`text-[0.9375rem] font-bold ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
