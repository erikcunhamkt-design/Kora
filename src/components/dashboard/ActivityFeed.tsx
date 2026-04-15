import { UserPlus, CheckCircle2, FileText, DollarSign, Clock } from "lucide-react";

const activities = [
  { icon: DollarSign, color: "text-emerald-400 bg-emerald-500/10", text: "Pagamento recebido de Maria Fernanda", time: "Há 2h" },
  { icon: CheckCircle2, color: "text-primary bg-primary/10", text: "Tarefa 'Criar logo principal' concluída", time: "Há 3h" },
  { icon: FileText, color: "text-muted-foreground bg-muted/60", text: "Proposta enviada para StartUp X", time: "Há 5h" },
  { icon: UserPlus, color: "text-accent bg-accent/10", text: "Novo cliente: Studio Zen", time: "Ontem" },
  { icon: DollarSign, color: "text-emerald-400 bg-emerald-500/10", text: "Fatura de R$ 3.500 paga por Acme Corp", time: "Ontem" },
  { icon: CheckCircle2, color: "text-primary bg-primary/10", text: "Tarefa 'Wireframe da landing page' concluída", time: "2 dias" },
];

export function ActivityFeed() {
  return (
    <div className="orbit-card p-6 animate-fade-up">
      <h3 className="text-base font-semibold text-foreground mb-1">Atividade Recente</h3>
      <p className="text-[0.8125rem] text-muted-foreground mb-5">Últimas ações no sistema</p>
      <div className="space-y-3">
        {activities.map((a, i) => {
          const Icon = a.icon;
          return (
            <div key={i} className="flex items-start gap-3 group">
              <div className={`p-2 rounded-lg ${a.color} shrink-0 mt-0.5`}><Icon className="h-4 w-4" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-[0.9375rem] text-foreground/90 truncate">{a.text}</p>
                <div className="flex items-center gap-1 mt-1"><Clock className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-[0.8125rem] text-muted-foreground">{a.time}</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
