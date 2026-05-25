import { BarChart3, Bot, Sparkles, MessageCircle } from "lucide-react";

const items = [
  { icon: BarChart3, title: "Relatórios avançados", desc: "Receita, conversão e produtividade em um só lugar." },
  { icon: Bot, title: "Agentes de IA", desc: "Assistentes treinados no seu estúdio. Em beta privado." },
  { icon: Sparkles, title: "Automações por gatilho", desc: "Fluxos sem código para CRM, tarefas e financeiro." },
  { icon: MessageCircle, title: "WhatsApp oficial", desc: "Atendimento integrado ao CRM. Requer configuração." },
];

export function ComingSoon() {
  return (
    <div className="orbit-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Recursos em breve</h3>
          <p className="text-sm text-muted-foreground">Próximos avanços do KORA HUB</p>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded border border-border/60 bg-muted/30 text-muted-foreground">
          Roadmap
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((it) => (
          <div
            key={it.title}
            className="flex items-start gap-3 p-3 rounded-lg border border-border/60 bg-muted/10"
          >
            <div className="h-9 w-9 shrink-0 rounded-lg bg-primary/8 border border-primary/15 flex items-center justify-center">
              <it.icon className="h-4 w-4 text-primary/80" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground truncate">{it.title}</p>
                <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border border-border/60 bg-background/60 text-muted-foreground">
                  Em breve
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{it.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
