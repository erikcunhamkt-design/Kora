import { CheckCircle2, Circle, AlertTriangle, Clock } from "lucide-react";

const tasks = [
  { title: "Revisão do layout — Brand Co", done: false, overdue: true, time: "09:00" },
  { title: "Enviar proposta — StartUp X", done: false, overdue: false, time: "11:00" },
  { title: "Reunião com Maria Fernanda", done: true, overdue: false, time: "14:00" },
  { title: "Ajustes finais — Studio Zen", done: false, overdue: true, time: "16:00" },
  { title: "Finalizar identidade visual", done: false, overdue: false, time: "17:30" },
];

export function TodayTasks() {
  return (
    <div className="orbit-card p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-foreground">Tarefas de Hoje</h3>
        <span className="text-xs text-muted-foreground">{tasks.filter(t => t.done).length}/{tasks.length}</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Sua agenda do dia</p>
      <div className="space-y-2">
        {tasks.map((t, i) => (
          <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${t.done ? "opacity-50" : "hover:bg-muted/50"}`}>
            {t.done
              ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              : t.overdue
                ? <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
            }
            <span className={`text-sm flex-1 ${t.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.title}</span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />{t.time}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
