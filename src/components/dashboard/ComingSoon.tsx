import { BarChart3, Bot, Sparkles, MessageCircle } from "lucide-react";

const items = [
  { icon: BarChart3, title: "Relatórios avançados", desc: "Receita, conversão e produtividade." },
  { icon: Bot, title: "Agentes de IA", desc: "Assistentes treinados no seu estúdio." },
  { icon: Sparkles, title: "Automações por gatilho", desc: "Fluxos sem código para CRM e financeiro." },
  { icon: MessageCircle, title: "WhatsApp oficial", desc: "Atendimento integrado ao CRM." },
];

export function ComingSoon() {
  return (
    <div className="rounded-xl border border-border/40 bg-card/40 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[0.9375rem] font-semibold text-muted-foreground">Roadmap</h3>
          <p className="text-[0.75rem] text-muted-foreground/70">Próximos avanços do KORA HUB</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {items.map((it) => (
          <div
            key={it.title}
            className="flex items-start gap-2.5 p-3 rounded-lg border border-border/30 bg-background/40"
          >
            <it.icon className="h-3.5 w-3.5 text-muted-foreground/70 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[0.8125rem] font-medium text-foreground/80 truncate">{it.title}</p>
              </div>
              <p className="text-[0.6875rem] text-muted-foreground/70 mt-0.5 leading-snug">{it.desc}</p>
              <span className="mt-1.5 inline-block text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                Em breve
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
