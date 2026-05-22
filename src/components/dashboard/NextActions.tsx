import { FileText, Calculator, Image, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

const actions = [
  { icon: FileText, title: "Responder proposta pendente", desc: "Cliente aguardando retorno há 2 dias", priority: "Alta", route: "/vendas", tone: "destructive" as const },
  { icon: Calculator, title: "Revisar orçamento", desc: "Orçamento de identidade visual em rascunho", priority: "Média", route: "/financeiro", tone: "default" as const },
  { icon: Image, title: "Publicar projeto no portfólio", desc: "Último projeto concluído ainda não publicado", priority: "Baixa", route: "/portfolio", tone: "secondary" as const },
  { icon: Target, title: "Conferir meta mensal", desc: "Faltam R$ 3.550 para atingir a meta do mês", priority: "Média", route: "/metas", tone: "default" as const },
];

export function NextActions() {
  const navigate = useNavigate();
  return (
    <div className="orbit-card p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Próximas ações</h3>
        <p className="text-sm text-muted-foreground">Pendências e alertas para hoje</p>
      </div>
      <div className="space-y-2">
        {actions.map((a) => (
          <button
            key={a.title}
            onClick={() => navigate(a.route)}
            className="w-full flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors text-left"
          >
            <div className="h-9 w-9 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
              <a.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                <Badge variant={a.tone} className="shrink-0">{a.priority}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
