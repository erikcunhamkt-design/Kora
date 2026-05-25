import { Lightbulb, TrendingUp, AlertTriangle, Target, ArrowRight, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Insight {
  icon: LucideIcon;
  tone: "success" | "warning" | "info" | "primary";
  title: string;
  desc: string;
  cta?: string;
  route?: string;
}

const insights: Insight[] = [
  {
    icon: Target,
    tone: "success",
    title: "Você está próximo da meta",
    desc: "Faltam R$ 3.500 para bater a meta do mês.",
    cta: "Ver metas",
    route: "/metas",
  },
  {
    icon: AlertTriangle,
    tone: "warning",
    title: "Tarefas atrasadas",
    desc: "3 tarefas passaram do prazo. Vale revisar prioridades.",
    cta: "Abrir tarefas",
    route: "/tarefas",
  },
  {
    icon: TrendingUp,
    tone: "primary",
    title: "Faturamento crescendo",
    desc: "Sua receita subiu 20% em relação ao mês passado.",
    cta: "Ver financeiro",
    route: "/financeiro",
  },
  {
    icon: Lightbulb,
    tone: "info",
    title: "Propostas sem resposta",
    desc: "2 propostas aguardam retorno há mais de 5 dias.",
    cta: "Revisar propostas",
    route: "/vendas?tab=orcamentos",
  },
];

const toneStyles: Record<Insight["tone"], string> = {
  success: "text-emerald-400 bg-emerald-500/10",
  warning: "text-amber-400 bg-amber-500/10",
  info: "text-sky-400 bg-sky-500/10",
  primary: "text-primary bg-primary/10",
};

export function InsightsSection() {
  const navigate = useNavigate();
  return (
    <div className="orbit-card p-6 animate-fade-up">
      <h3 className="text-base font-semibold text-foreground">Insights</h3>
      <p className="text-[0.8125rem] text-muted-foreground mt-0.5 mb-5">Recomendações baseadas na sua atividade</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {insights.map((ins) => {
          const Icon = ins.icon;
          return (
            <div
              key={ins.title}
              className="flex items-start gap-3 p-4 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors duration-150"
            >
              <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${toneStyles[ins.tone]}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[0.9375rem] font-medium text-foreground leading-tight">{ins.title}</p>
                <p className="text-[0.8125rem] text-muted-foreground mt-1 leading-relaxed">{ins.desc}</p>
                {ins.cta && ins.route && (
                  <button
                    onClick={() => navigate(ins.route!)}
                    className="mt-2 inline-flex items-center gap-1 text-[0.75rem] font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    {ins.cta}
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
