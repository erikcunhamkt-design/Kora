import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePlan, PLAN_PRICE } from "@/contexts/plan-context-value";
import { Check, Crown, Zap, Rocket } from "lucide-react";
import { useNavigate } from "react-router-dom";

const resourceLabels: Record<string, string> = {
  clients: "clientes",
  projects: "projetos no portfólio",
  tasks: "tarefas",
  leads: "leads no CRM",
};

const benefits = [
  "Clientes ilimitados",
  "Projetos ilimitados",
  "Tarefas ilimitadas",
  "CRM completo",
  "Financeiro completo",
  "Metas completas",
  "Portfólio completo",
  "Sem limitações",
];

export function PaywallModal() {
  const { paywallOpen, closePaywall, paywallResource } = usePlan();
  const navigate = useNavigate();
  const label = resourceLabels[paywallResource] || paywallResource;

  return (
    <Dialog open={paywallOpen} onOpenChange={(v) => !v && closePaywall()}>
      <DialogContent className="bg-card border-border max-w-md p-0 overflow-hidden">
        {/* Gradient header */}
        <div className="orbit-gradient p-6 pb-8 text-center relative">
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative z-10">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm mb-4">
              <Crown className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">
              Você atingiu o limite do plano gratuito
            </h2>
            <p className="text-white/80 text-sm mt-2">
              Para continuar crescendo e gerenciar mais {label}, faça upgrade para o plano Pro.
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Benefits */}
          <div className="space-y-2.5">
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Desbloqueie com o Pro:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {benefits.map((b) => (
                <div key={b} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  {b}
                </div>
              ))}
            </div>
          </div>

          {/* Price */}
          <div className="text-center p-4 rounded-xl bg-muted/50 border border-border">
            <p className="text-3xl font-bold text-foreground">{PLAN_PRICE}<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
            <p className="text-xs text-muted-foreground mt-1">Cancele quando quiser</p>
          </div>

          {/* Buttons */}
          <div className="space-y-2">
            <Button
              className="w-full orbit-gradient border-0 h-11 text-base font-semibold gap-2"
              onClick={() => { closePaywall(); navigate("/upgrade"); }}
            >
              <Rocket className="h-4 w-4" /> Fazer upgrade
            </Button>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => { closePaywall(); navigate("/upgrade"); }}
            >
              Ver planos
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
