import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

const tasks = [
  { title: "Finalizar landing page Acme Corp", priority: "Alta", deadline: "17 Jun", status: "Em andamento", done: false },
  { title: "Revisar wireframes app mobile", priority: "Média", deadline: "18 Jun", status: "Pendente", done: false },
  { title: "Enviar proposta Studio Zen", priority: "Alta", deadline: "16 Jun", status: "Pendente", done: false },
  { title: "Atualizar portfólio Behance", priority: "Baixa", deadline: "20 Jun", status: "Pendente", done: false },
  { title: "Reunião com cliente Nova Design", priority: "Média", deadline: "19 Jun", status: "Agendada", done: false },
  { title: "Criar mockups e-commerce", priority: "Alta", deadline: "22 Jun", status: "Pendente", done: false },
  { title: "Design system Brand Co", priority: "Média", deadline: "25 Jun", status: "Em andamento", done: false },
  { title: "Entrega final FitTrack", priority: "Alta", deadline: "15 Jun", status: "Concluída", done: true },
];

const priorityStyle: Record<string, string> = {
  Alta: "bg-red-400/10 text-red-400 border-red-400/20",
  Média: "bg-amber-400/10 text-amber-400 border-amber-400/20",
  Baixa: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
};

const Tarefas = () => (
  <div className="space-y-3">
    {tasks.map((task, i) => (
      <div key={i} className={`orbit-card p-4 flex items-center gap-4 hover:orbit-glow transition-all duration-300 ${task.done ? "opacity-60" : ""}`}>
        <Checkbox checked={task.done} className="border-muted-foreground data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${task.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{task.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Prazo: {task.deadline}</p>
        </div>
        <Badge variant="outline" className={priorityStyle[task.priority]}>{task.priority}</Badge>
        <span className="text-xs text-muted-foreground hidden sm:block">{task.status}</span>
      </div>
    ))}
  </div>
);

export default Tarefas;
