import { useState } from "react";
import { Clock3, Lock, ShieldAlert, Sparkles } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Mode = "free" | "template";

export function CampaignModeBanner() {
  const [mode, setMode] = useState<Mode>("template");

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Tipo de envio
        </h3>
        <p className="text-[11px] text-muted-foreground">
          Defina se este disparo é para uma audiência (exige template aprovado) ou para conversas dentro
          da janela de 24h de atendimento.
        </p>
      </div>

      <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="grid gap-2">
        <ModeOption
          value="template"
          active={mode === "template"}
          icon={<ShieldAlert className="h-4 w-4 text-primary" />}
          title="Campanha com template aprovado"
          description="Obrigatório para audiências, listas frias e contatos sem janela ativa de 24h."
          badge="Recomendado"
        />
        <ModeOption
          value="free"
          active={mode === "free"}
          icon={<Clock3 className="h-4 w-4 text-amber-300" />}
          title="Mensagem livre — janela de atendimento"
          description="Permitido apenas para conversas iniciadas pelo cliente nas últimas 24h."
          badge="Janela 24h"
          badgeClassName="bg-amber-500/15 text-amber-300 border-amber-500/30"
        />
      </RadioGroup>

      {mode === "template" ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-start gap-2">
          <Lock className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-[12px] text-foreground/85 leading-relaxed">
            Texto livre <strong>está bloqueado</strong> neste modo. Selecione um template aprovado da biblioteca
            e confirme que todos os contatos da audiência possuem <strong>opt-in válido</strong>.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
          <Clock3 className="h-4 w-4 text-amber-300 mt-0.5 flex-shrink-0" />
          <p className="text-[12px] text-amber-200/90 leading-relaxed">
            Mensagens livres só podem ser enviadas dentro da janela de 24h de atendimento.
            Fora dela, o WhatsApp <strong>exige template aprovado</strong>.
          </p>
        </div>
      )}
    </section>
  );
}

function ModeOption({
  value, active, icon, title, description, badge, badgeClassName,
}: {
  value: string;
  active: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  badgeClassName?: string;
}) {
  return (
    <Label
      htmlFor={`mode-${value}`}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors",
        active ? "border-primary/50 bg-primary/5" : "border-border/50 bg-card/30 hover:border-border",
      )}
    >
      <RadioGroupItem id={`mode-${value}`} value={value} className="mt-0.5" />
      <span className="flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">{title}</span>
          {badge && (
            <Badge variant="outline" className={cn("text-[10px]", badgeClassName ?? "bg-primary/10 text-primary border-primary/30")}>
              {badge}
            </Badge>
          )}
        </div>
        <p className="text-[12px] text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </Label>
  );
}
