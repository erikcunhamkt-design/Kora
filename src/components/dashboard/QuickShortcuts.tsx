import { UserPlus, UserCheck, CheckSquare, DollarSign, Briefcase } from "lucide-react";
import { useNavigate } from "react-router-dom";

const shortcuts = [
  { icon: UserPlus, label: "Novo cliente", route: "/clientes" },
  { icon: UserCheck, label: "Novo lead", route: "/crm" },
  { icon: CheckSquare, label: "Nova tarefa", route: "/tarefas" },
  { icon: DollarSign, label: "Nova transação", route: "/financeiro" },
  { icon: Briefcase, label: "Novo projeto", route: "/portfolio" },
];

export function QuickShortcuts() {
  const navigate = useNavigate();
  return (
    <div className="orbit-card p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Atalhos rápidos</h3>
        <p className="text-sm text-muted-foreground">Crie itens em segundos</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {shortcuts.map((s) => (
          <button
            key={s.label}
            onClick={() => navigate(s.route)}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border border-border bg-muted/20 hover:bg-primary/10 hover:border-primary/40 transition-all group"
          >
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <s.icon className="h-5 w-5 text-primary" />
            </div>
            <span className="text-xs font-medium text-foreground text-center">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
