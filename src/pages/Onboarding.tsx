import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Plus, Sparkles, X } from "lucide-react";
import orbitLogo from "@/assets/orbit-logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  OnboardingData,
  OnboardingService,
  onboardingDefaults,
  useOnboarding,
} from "@/contexts/OnboardingContext";

const areas = [
  "Designer / Diretor de Arte",
  "Social Media",
  "Videomaker / Editor",
  "Gestor de Tráfego",
  "Desenvolvedor Web / Sites",
  "Fotógrafo",
  "Copywriter / Redator",
  "Agência / Marketing Digital",
  "Outro",
];

const serviceSuggestions: Record<string, string[]> = {
  "Designer / Diretor de Arte": ["Identidade visual", "Design de apresentação", "Design editorial", "Consultoria"],
  "Social Media": ["Social media mensal", "Gestão de redes", "Calendário de conteúdo", "Copywriting"],
  "Videomaker / Editor": ["Vídeo institucional", "Reels mensais", "Edição de vídeo", "VSL"],
  "Gestor de Tráfego": ["Gestão de tráfego", "Setup de campanhas", "Relatórios mensais"],
  "Desenvolvedor Web / Sites": ["Landing page", "Site institucional", "E-commerce", "Manutenção mensal"],
  "Fotógrafo": ["Ensaio fotográfico", "Fotografia de produto", "Cobertura de evento"],
  "Copywriter / Redator": ["Copywriting", "Roteiros", "E-mails", "Páginas de venda"],
  "Agência / Marketing Digital": ["Identidade visual", "Social media mensal", "Gestão de tráfego", "Landing page"],
  Outro: ["Consultoria", "Projeto sob medida"],
};

const countries = ["Brasil", "Portugal", "Estados Unidos", "Outro"];
const currencies = [
  { code: "BRL", label: "R$ Real Brasileiro" },
  { code: "EUR", label: "€ Euro" },
  { code: "USD", label: "$ Dólar Americano" },
];

const goalsList = [
  "Quero captar mais clientes",
  "Quero organizar meus projetos",
  "Quero controlar financeiro",
  "Quero montar portfólio",
  "Quero vender serviços",
  "Quero usar IA para criar conteúdo",
];

const TOTAL_STEPS = 7;

export default function Onboarding() {
  const navigate = useNavigate();
  const { saveOnboarding } = useOnboarding();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(onboardingDefaults);
  const [customService, setCustomService] = useState("");
  const [customPrice, setCustomPrice] = useState("");

  const update = <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) =>
    setData((d) => ({ ...d, [key]: value }));

  const suggestions = useMemo(() => serviceSuggestions[data.area] ?? [], [data.area]);

  const toggleService = (name: string) => {
    setData((d) => {
      const exists = d.services.find((s) => s.name === name);
      return {
        ...d,
        services: exists ? d.services.filter((s) => s.name !== name) : [...d.services, { name }],
      };
    });
  };

  const addCustomService = () => {
    const name = customService.trim();
    if (!name) return;
    setData((d) => ({
      ...d,
      services: [...d.services.filter((s) => s.name !== name), { name, price: customPrice.trim() || undefined }],
    }));
    setCustomService("");
    setCustomPrice("");
  };

  const removeService = (name: string) =>
    setData((d) => ({ ...d, services: d.services.filter((s) => s.name !== name) }));

  const updateServicePrice = (name: string, price: string) =>
    setData((d) => ({
      ...d,
      services: d.services.map((s) => (s.name === name ? { ...s, price: price || undefined } : s)),
    }));

  const toggleGoal = (goal: string) =>
    setData((d) => ({
      ...d,
      goals: d.goals.includes(goal) ? d.goals.filter((g) => g !== goal) : [...d.goals, goal],
    }));

  const skip = () => {
    saveOnboarding({ ...onboardingDefaults });
    toast.message("Onboarding pulado. Você pode reiniciar em Configurações.");
    navigate("/", { replace: true });
  };

  const finish = () => {
    saveOnboarding(data);
    toast.success("Estúdio configurado!");
    navigate("/", { replace: true });
  };

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const canAdvance = () => {
    switch (step) {
      case 1: return data.ownerName.trim() && data.studioName.trim();
      case 2: return !!data.area;
      case 4: return !!data.country && !!data.currency;
      default: return true;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <img src={orbitLogo} alt="Orbyt Studio" className="h-10 w-10 object-contain" />
          <span className="text-lg font-bold tracking-tight">
            <span className="orbit-gradient-text">Orbyt</span>{" "}
            <span className="text-foreground">Studio</span>
          </span>
        </div>
        {step < TOTAL_STEPS - 1 && (
          <button onClick={skip} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Pular por enquanto
          </button>
        )}
      </header>

      {/* Progress */}
      <div className="px-6 pt-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
            <span>Passo {step + 1} de {TOTAL_STEPS}</span>
            <span>{Math.round(((step + 1) / TOTAL_STEPS) * 100)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full orbit-gradient transition-all duration-300"
              style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 flex items-start justify-center px-6 py-10 overflow-y-auto">
        <div className="w-full max-w-2xl orbit-card p-8 animate-fade-up">
          {step === 0 && (
            <div className="text-center space-y-5">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl orbit-gradient">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Vamos configurar seu estúdio</h1>
              <p className="text-muted-foreground max-w-md mx-auto">
                São poucos passos para personalizar o Orbyt Studio à sua rotina. Você pode pular e configurar mais tarde.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Button onClick={next} size="lg" className="orbit-gradient text-white border-0 gap-2">
                  Começar <ArrowRight className="h-4 w-4" />
                </Button>
                <Button onClick={skip} variant="outline" size="lg">
                  Pular por enquanto
                </Button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <StepHeading title="Dados do negócio" subtitle="Conte um pouco sobre você e seu estúdio." />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nome do responsável *">
                  <Input value={data.ownerName} onChange={(e) => update("ownerName", e.target.value)} placeholder="Seu nome" />
                </Field>
                <Field label="Nome do estúdio/empresa *">
                  <Input value={data.studioName} onChange={(e) => update("studioName", e.target.value)} placeholder="Ex: Orbyt Studio" />
                </Field>
                <Field label="Telefone/WhatsApp">
                  <Input value={data.phone} onChange={(e) => update("phone", e.target.value)} placeholder="(11) 99999-0000" />
                </Field>
                <Field label="Website (opcional)">
                  <Input value={data.website} onChange={(e) => update("website", e.target.value)} placeholder="seusite.com" />
                </Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <StepHeading title="Área de atuação" subtitle="Selecione a que melhor descreve seu trabalho." />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {areas.map((area) => {
                  const active = data.area === area;
                  return (
                    <button
                      key={area}
                      type="button"
                      onClick={() => update("area", area)}
                      className={`text-left px-4 py-3.5 rounded-lg border transition-all ${
                        active
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border/60 hover:border-primary/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="text-sm font-medium">{area}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <StepHeading title="Serviços oferecidos" subtitle="Escolha os serviços e, se quiser, informe o preço." />

              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => {
                    const active = data.services.some((x) => x.name === s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleService(s)}
                        className={`px-3.5 py-2 rounded-full text-xs font-medium border transition-all ${
                          active
                            ? "border-primary bg-primary/15 text-foreground"
                            : "border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40"
                        }`}
                      >
                        {active && <Check className="inline h-3 w-3 mr-1" />}
                        {s}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Adicionar serviço personalizado</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input value={customService} onChange={(e) => setCustomService(e.target.value)} placeholder="Ex: Branding completo" />
                  <Input value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} placeholder="Preço (opcional)" className="sm:w-40" />
                  <Button type="button" onClick={addCustomService} variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" /> Adicionar
                  </Button>
                </div>
              </div>

              {data.services.length > 0 && (
                <div className="space-y-2 pt-2">
                  <Label className="text-xs text-muted-foreground">Selecionados ({data.services.length})</Label>
                  {data.services.map((s) => (
                    <div key={s.name} className="flex items-center gap-2 p-3 rounded-lg border border-border/60 bg-muted/30">
                      <span className="text-sm font-medium flex-1 truncate">{s.name}</span>
                      <Input
                        value={s.price ?? ""}
                        onChange={(e) => updateServicePrice(s.name, e.target.value)}
                        placeholder="Preço"
                        className="w-32 h-8 text-xs"
                      />
                      <button type="button" onClick={() => removeService(s.name)} className="p-1 text-muted-foreground hover:text-destructive">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <StepHeading title="Dados regionais" subtitle="Onde você atende e qual moeda usa." />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="País *">
                  <Select value={data.country} onValueChange={(v) => update("country", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Moeda *">
                  <Select value={data.currency} onValueChange={(v) => update("currency", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Cidade/Estado (opcional)">
                  <Input value={data.cityState} onChange={(e) => update("cityState", e.target.value)} placeholder="São Paulo, SP" />
                </Field>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <StepHeading title="Preferências iniciais" subtitle="Selecione o que faz mais sentido para você agora." />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {goalsList.map((g) => {
                  const active = data.goals.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGoal(g)}
                      className={`text-left px-4 py-3.5 rounded-lg border transition-all flex items-center gap-3 ${
                        active
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border/60 hover:border-primary/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${active ? "bg-primary border-primary" : "border-border"}`}>
                        {active && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <span className="text-sm font-medium">{g}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-5">
              <StepHeading title="Tudo pronto!" subtitle="Confira o resumo da configuração do seu estúdio." />
              <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-5">
                <SummaryRow label="Responsável" value={data.ownerName || "—"} />
                <SummaryRow label="Estúdio" value={data.studioName || "—"} />
                <SummaryRow label="Contato" value={[data.phone, data.website].filter(Boolean).join(" · ") || "—"} />
                <SummaryRow label="Área" value={data.area || "—"} />
                <SummaryRow label="Serviços" value={data.services.length ? data.services.map((s) => s.name).join(", ") : "—"} />
                <SummaryRow label="Região" value={[data.country, data.cityState].filter(Boolean).join(" · ") + ` (${data.currency})`} />
                <SummaryRow label="Objetivos" value={data.goals.length ? data.goals.join(", ") : "—"} />
              </div>
              <Button onClick={finish} size="lg" className="w-full orbit-gradient text-white border-0 gap-2">
                Ir para o Dashboard <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Footer nav */}
          {step > 0 && step < TOTAL_STEPS - 1 && (
            <div className="flex items-center justify-between pt-8 mt-2 border-t border-border/40">
              <Button variant="ghost" onClick={back} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
              <Button
                onClick={next}
                disabled={!canAdvance()}
                className="orbit-gradient text-white border-0 gap-2"
              >
                Continuar <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-foreground text-right break-words">{value}</span>
    </div>
  );
}
