import { UserPlus, UserCheck, CheckSquare, DollarSign, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

const shortcuts = [
  { icon: UserPlus, label: "Novo cliente", route: "/clientes" },
  { icon: UserCheck, label: "Novo lead", route: "/crm" },
  { icon: FileText, label: "Nova proposta", route: "/vendas?tab=orcamentos" },
  { icon: DollarSign, label: "Novo lançamento", route: "/financeiro" },
  { icon: CheckSquare, label: "Nova tarefa", route: "/tarefas" },
];

export function QuickShortcuts() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[0.75rem] uppercase tracking-[0.12em] font-semibold text-muted-foreground/70 mr-1">
        Atalhos
      </span>
      {shortcuts.map((s) => (
        <button
          key={s.label}
          onClick={() => navigate(s.route)}
          className="group inline-flex items-center gap-2 h-9 px-3.5 rounded-full border border-border/60 bg-card/60 hover:border-primary/40 hover:bg-primary/[0.06] hover:text-primary transition-all duration-150 text-[0.8125rem] font-medium text-foreground/90"
        >
          <s.icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors duration-150" />
          {s.label}
        </button>
      ))}
    </div>
  );
}
