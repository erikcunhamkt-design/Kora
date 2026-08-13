import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Crown, Sparkles, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePlan, PLAN_PRICE } from "@/contexts/plan-context-value";
import { useToast } from "@/hooks/use-toast";

const features = [
  { label: "Clientes", free: "1", pro: "Ilimitados" },
  { label: "Projetos no portfólio", free: "1", pro: "Ilimitados" },
  { label: "Tarefas", free: "3", pro: "Ilimitadas" },
  { label: "Leads no CRM", free: "1 ativo", pro: "Ilimitados" },
  { label: "Financeiro", free: "Visualização básica", pro: "Completo" },
  { label: "Metas", free: "Limitado", pro: "Completas" },
  { label: "Relatórios", free: "—", pro: "Completos" },
  { label: "Suporte", free: "Comunidade", pro: "Prioritário" },
];

const Upgrade = () => {
  const navigate = useNavigate();
  const { isPro } = usePlan();
  const { toast } = useToast();

  const handleUpgrade = () => {
    toast({
      title: "Em breve!",
      description: "O pagamento será integrado em breve. Seu interesse foi registrado.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Back */}
        <Button variant="ghost" className="mb-8 text-muted-foreground" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>

        {/* Hero */}
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
            <Sparkles className="h-4 w-4" /> Desbloqueie todo o potencial
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">
            Profissionalize seu fluxo<br />de trabalho
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Use sem limites. Gerencie clientes, projetos e finanças como um profissional.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Free */}
          <Card className="border-border bg-card p-6 space-y-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Free</p>
              <p className="text-3xl font-bold text-foreground mt-1">R$ 0<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
              <p className="text-sm text-muted-foreground mt-2">Para quem está começando</p>
            </div>
            <div className="space-y-3">
              {features.map((f) => (
                <div key={f.label} className="flex items-center gap-3 text-sm">
                  <Check className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{f.label}:</span>
                  <span className="text-foreground font-medium ml-auto">{f.free}</span>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full" disabled>
              Plano atual
            </Button>
          </Card>

          {/* Pro */}
          <Card className="border-primary/40 bg-card p-6 space-y-6 relative ring-2 ring-primary/20">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full orbit-gradient text-white text-xs font-semibold flex items-center gap-1.5">
              <Crown className="h-3 w-3" /> Mais popular
            </div>
            <div>
              <p className="text-sm font-medium text-primary">Pro</p>
              <p className="text-3xl font-bold text-foreground mt-1">{PLAN_PRICE}<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
              <p className="text-sm text-muted-foreground mt-2">Para designers profissionais</p>
            </div>
            <div className="space-y-3">
              {features.map((f) => (
                <div key={f.label} className="flex items-center gap-3 text-sm">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-muted-foreground">{f.label}:</span>
                  <span className="text-foreground font-medium ml-auto">{f.pro}</span>
                </div>
              ))}
            </div>
            {isPro ? (
              <Button className="w-full" disabled>Seu plano atual</Button>
            ) : (
              <Button className="w-full orbit-gradient border-0 h-11 text-base font-semibold" onClick={handleUpgrade}>
                Fazer upgrade
              </Button>
            )}
          </Card>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-12">
          <p className="text-sm text-muted-foreground">
            Cancele quando quiser. Sem taxas ocultas.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Upgrade;
