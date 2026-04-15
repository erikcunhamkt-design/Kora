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
    <div className="orbit-card p-6 animate-fade-up">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-semibold text-foreground">Tarefas de Hoje</h3>
        <span className="text-[0.8125rem] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">{tasks.filter(t => t.done).length}/{tasks.length}</span>
      </div>
      <p className="text-[0.8125rem] text-muted-foreground mb-5">Sua agenda do dia</p>
      <div className="space-y-1.5">
        {tasks.map((t, i) => (
          <div key={i} className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-150 ${t.done ? "opacity-40" : "hover:bg-muted/40"}`}>
            {t.done
              ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              : t.overdue
                ? <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
            }
            <span className={`text-[0.9375rem] flex-1 ${t.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.title}</span>
            <div className="flex items-center gap-1 text-[0.8125rem] text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />{t.time}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
