import { FileText, Calculator, Image, Target, ArrowRight, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface NextAction {
  icon: LucideIcon;
  title: string;
  reason: string;
  cta?: string;
  route?: string;
  priority?: "alta" | "média" | "baixa";
}

const actions: NextAction[] = [
  { icon: FileText, title: "Follow-up pendente", reason: "Proposta da Acme Corp sem resposta há 3 dias.", cta: "Abrir proposta", route: "/vendas?tab=orcamentos", priority: "alta" },
  { icon: Calculator, title: "Revisar orçamento", reason: "Orçamento de identidade visual em rascunho.", cta: "Continuar", route: "/vendas?tab=orcamentos", priority: "média" },
  { icon: Image, title: "Publicar projeto no portfólio", reason: "Último projeto concluído ainda não publicado.", cta: "Abrir portfólio", route: "/portfolio", priority: "baixa" },
  { icon: Target, title: "Conferir meta mensal", reason: "Faltam R$ 3.550 para atingir a meta do mês.", cta: "Ver metas", route: "/metas", priority: "média" },
];

const priorityDot: Record<NonNullable<NextAction["priority"]>, string> = {
  alta: "bg-destructive",
  média: "bg-amber-400",
  baixa: "bg-emerald-400",
};

export function NextActions() {
  const navigate = useNavigate();
  return (
    <div className="orbit-card p-6 space-y-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">Próximas ações</h3>
        <p className="text-[0.8125rem] text-muted-foreground mt-0.5">O que merece sua atenção agora</p>
      </div>
      <div className="space-y-1.5">
        {actions.map((a) => (
          <div
            key={a.title}
            className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors duration-150"
          >
            <div className="relative h-9 w-9 shrink-0 rounded-lg bg-muted/40 flex items-center justify-center">
              <a.icon className="h-4 w-4 text-muted-foreground" />
              {a.priority && (
                <span className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-card ${priorityDot[a.priority]}`} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[0.9375rem] font-medium text-foreground leading-tight">{a.title}</p>
              <p className="text-[0.8125rem] text-muted-foreground mt-0.5 leading-snug">{a.reason}</p>
            </div>
            {a.cta && a.route && (
              <button
                onClick={() => navigate(a.route!)}
                className="shrink-0 inline-flex items-center gap-1 text-[0.8125rem] font-medium text-primary hover:text-primary/80 transition-colors mt-1"
              >
                {a.cta}
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
