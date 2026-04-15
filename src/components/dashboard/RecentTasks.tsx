import { CheckCircle2, Circle, Clock } from "lucide-react";

const tasks = [
  { title: "Finalizar landing page Acme Corp", status: "done", priority: "Alta" },
  { title: "Revisar wireframes app mobile", status: "pending", priority: "Média" },
  { title: "Enviar proposta Studio Zen", status: "pending", priority: "Alta" },
  { title: "Atualizar portfólio Behance", status: "progress", priority: "Baixa" },
  { title: "Reunião com cliente Nova Design", status: "pending", priority: "Média" },
];

const statusIcon = {
  done: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  pending: <Circle className="h-4 w-4 text-muted-foreground" />,
  progress: <Clock className="h-4 w-4 text-primary" />,
};

const priorityColor = {
  Alta: "text-red-400 bg-red-400/10",
  Média: "text-amber-400 bg-amber-400/10",
  Baixa: "text-emerald-400 bg-emerald-400/10",
};

export function RecentTasks() {
  return (
    <div className="orbit-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-1">Tarefas Recentes</h3>
      <p className="text-xs text-muted-foreground mb-4">Suas últimas atividades</p>
      <div className="space-y-3">
        {tasks.map((task, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            {statusIcon[task.status as keyof typeof statusIcon]}
            <span className="flex-1 text-sm text-foreground">{task.title}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColor[task.priority as keyof typeof priorityColor]}`}>
              {task.priority}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
