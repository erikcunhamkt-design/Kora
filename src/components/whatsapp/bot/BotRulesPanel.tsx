import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Sparkles,
  PowerOff,
  Clock,
  Tag,
  ShieldCheck,
  UserCog,
  Save,
  Play,
  Activity,
  Building2,
  Wrench,
  DollarSign,
  HelpCircle,
  CalendarClock,
  Link2,
  Check,
  ChevronRight,
  MessageSquare,
  Sparkle,
  Pause,
  Hand,
  CircleDot,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STORAGE_KEY = "orbyt.whatsapp.bot.rules.v1";

type BotMode = "off" | "suggest" | "assistant" | "after_hours" | "tagged";
type GlobalStatus = "active" | "paused" | "test" | "off";

const MODES: Array<{
  id: BotMode;
  icon: typeof Bot;
  title: string;
  description: string;
  badge?: { label: string; variant: "default" | "success" | "warning" | "secondary" };
}> = [
  { id: "off", icon: PowerOff, title: "Desligado", description: "O robô não responde nem sugere." },
  { id: "suggest", icon: Sparkles, title: "Modo sugestão", description: "A IA sugere respostas, mas o humano envia.", badge: { label: "Seguro", variant: "success" } },
  { id: "assistant", icon: Bot, title: "Modo assistente", description: "A IA responde conversas iniciadas pelo cliente até um humano assumir.", badge: { label: "Recomendado", variant: "default" } },
  { id: "after_hours", icon: Clock, title: "Fora do horário", description: "A IA cobre ausências e plantões." },
  { id: "tagged", icon: Tag, title: "Por tag", description: "Ativa apenas em conversas marcadas." },
];

type AudienceRules = {
  newConversations: boolean;
  insideWindow: boolean;
  noAgent: boolean;
  noClient: boolean;
  specificTag: boolean;
  neverCampaigns: boolean;
  neverColdStart: boolean;
};

type StopRules = {
  humanTakeover: boolean;
  askedAgent: boolean;
  angry: boolean;
  resolved: boolean;
  complex: boolean;
  complaint: boolean;
  outsideWindow: boolean;
  onError: boolean;
};

type BotRulesState = {
  mode: BotMode;
  status: GlobalStatus;
  audience: AudienceRules;
  stop: StopRules;
};

const DEFAULT_STATE: BotRulesState = {
  mode: "suggest",
  status: "test",
  audience: {
    newConversations: true,
    insideWindow: true,
    noAgent: true,
    noClient: false,
    specificTag: false,
    neverCampaigns: true,
    neverColdStart: true,
  },
  stop: {
    humanTakeover: true,
    askedAgent: true,
    angry: true,
    resolved: true,
    complex: true,
    complaint: true,
    outsideWindow: true,
    onError: true,
  },
};

function load(): BotRulesState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<BotRulesState>;
    return {
      mode: parsed.mode ?? DEFAULT_STATE.mode,
      status: parsed.status ?? DEFAULT_STATE.status,
      audience: { ...DEFAULT_STATE.audience, ...(parsed.audience ?? {}) },
      stop: { ...DEFAULT_STATE.stop, ...(parsed.stop ?? {}) },
    };
  } catch {
    return DEFAULT_STATE;
  }
}

const STATUS_META: Record<GlobalStatus, { label: string; dot: string; ring: string; text: string }> = {
  active: { label: "Ativo", dot: "bg-emerald-400", ring: "shadow-[0_0_24px_-4px_hsl(160_84%_50%/0.6)]", text: "text-emerald-300" },
  paused: { label: "Pausado", dot: "bg-amber-400", ring: "shadow-[0_0_24px_-4px_hsl(38_92%_55%/0.55)]", text: "text-amber-300" },
  test: { label: "Modo teste", dot: "bg-sky-400", ring: "shadow-[0_0_24px_-4px_hsl(205_92%_55%/0.55)]", text: "text-sky-300" },
  off: { label: "Desligado", dot: "bg-muted-foreground/60", ring: "", text: "text-muted-foreground" },
};

const KNOWLEDGE_CARDS: Array<{
  id: string;
  title: string;
  description: string;
  icon: typeof Building2;
  status: "configured" | "incomplete" | "soon";
}> = [
  { id: "company", title: "Empresa", description: "Nome, posicionamento, tom de voz.", icon: Building2, status: "incomplete" },
  { id: "services", title: "Serviços", description: "O que o estúdio oferece e diferenciais.", icon: Wrench, status: "incomplete" },
  { id: "pricing", title: "Preços", description: "Faixas, condições e o que não falar.", icon: DollarSign, status: "soon" },
  { id: "faq", title: "Perguntas frequentes", description: "Dúvidas reais que clientes enviam.", icon: HelpCircle, status: "incomplete" },
  { id: "hours", title: "Horários", description: "Janela de atendimento e fusos.", icon: CalendarClock, status: "configured" },
  { id: "links", title: "Links úteis", description: "Portfólio, agenda, formulários.", icon: Link2, status: "soon" },
];

const KNOWLEDGE_STATUS_META: Record<"configured" | "incomplete" | "soon", { label: string; variant: "success" | "secondary" | "warning" }> = {
  configured: { label: "Configurado", variant: "success" },
  incomplete: { label: "Incompleto", variant: "warning" },
  soon: { label: "Em breve", variant: "secondary" },
};

const GUARDRAILS = [
  "Responder apenas conversas iniciadas pelo cliente",
  "Respeitar janela de atendimento de 24h",
  "Nunca iniciar conversa fria",
  "Pausar imediatamente quando humano assumir",
];

export function BotRulesPanel() {
  const [state, setState] = useState<BotRulesState>(DEFAULT_STATE);
  const [dirty, setDirty] = useState(false);
  const [simInput, setSimInput] = useState("Olá, vocês fazem identidade visual para restaurante?");
  const [simResult, setSimResult] = useState<{ reply: string; intent: string; next: string } | null>(null);

  useEffect(() => {
    setState(load());
  }, []);

  const update = <K extends keyof BotRulesState>(key: K, value: BotRulesState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
    setDirty(true);
  };

  const toggleAudience = (k: keyof AudienceRules) => {
    setState((s) => ({ ...s, audience: { ...s.audience, [k]: !s.audience[k] } }));
    setDirty(true);
  };

  const toggleStop = (k: keyof StopRules) => {
    setState((s) => ({ ...s, stop: { ...s.stop, [k]: !s.stop[k] } }));
    setDirty(true);
  };

  const handleSave = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setDirty(false);
      toast.success("Alterações salvas");
    } catch (e) {
      toast.error("Falha ao salvar", { description: (e as Error).message });
    }
  };

  const runSimulator = () => {
    if (!simInput.trim()) return;
    setSimResult({
      reply:
        "Olá! Sim, atendemos restaurantes — fazemos identidade visual completa (logo, paleta, cardápio e papelaria). Quer que eu te envie alguns cases? Posso também conectar você com um humano se preferir.",
      intent: "Interesse em identidade visual — segmento gastronomia",
      next: "Coletar nome, cidade e prazo, e oferecer agenda",
    });
    toast.message("Prévia gerada", { description: "Nenhuma mensagem foi enviada ao cliente." });
  };

  const currentMode = useMemo(() => MODES.find((m) => m.id === state.mode), [state.mode]);
  const statusMeta = STATUS_META[state.status];

  return (
    <TooltipProvider delayDuration={150}>
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        {/* ===== Header ===== */}
        <Card className="border-border/50 bg-gradient-to-br from-card via-card to-card/60 overflow-hidden">
          <div className="relative p-6 sm:p-7">
            <div className="absolute inset-0 pointer-events-none opacity-[0.06] bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)),transparent_55%)]" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4 min-w-0">
                <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                      Robô IA de Atendimento
                    </h1>
                    <div className={cn("flex items-center gap-2 px-2.5 py-1 rounded-full bg-card/70 border border-border/60", statusMeta.ring)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", statusMeta.dot)} />
                      <span className={cn("text-[11px] font-medium tracking-wide", statusMeta.text)}>{statusMeta.label}</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
                    Configure como a IA atende conversas iniciadas pelos clientes.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/30 border border-border/50">
                  {(["active", "paused", "test", "off"] as GlobalStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => update("status", s)}
                      className={cn(
                        "px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all",
                        state.status === s
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {STATUS_META[s].label}
                    </button>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="h-9 gap-2" onClick={runSimulator}>
                  <Play className="h-3.5 w-3.5" /> Testar robô
                </Button>
                <Button onClick={handleSave} disabled={!dirty} size="sm" className="h-9 gap-2">
                  <Save className="h-3.5 w-3.5" /> Salvar alterações
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* ===== Status operacional ===== */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: "Modo atual", value: currentMode?.title ?? "—", icon: Sparkle },
            { label: "Conversas elegíveis", value: "Somente iniciadas", icon: MessageSquare },
            { label: "Janela 24h", value: "Respeitada", icon: Clock },
            { label: "Humano assume", value: "Protegido", icon: UserCog },
            { label: "Última atualização", value: dirty ? "Não salvo" : "Sincronizado", icon: Activity },
          ].map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.label}
                className="rounded-xl border border-border/50 bg-card/40 p-3.5 hover:bg-card/60 transition-colors"
              >
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium">
                  <Icon className="h-3 w-3" /> {m.label}
                </div>
                <div className="mt-1.5 text-sm font-semibold text-foreground/90 truncate">{m.value}</div>
              </div>
            );
          })}
        </div>

        {/* ===== Modo de atendimento ===== */}
        <section className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Modo de atendimento</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Como o robô deve atuar nas conversas.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MODES.map((m) => {
              const Icon = m.icon;
              const active = state.mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => update("mode", m.id)}
                  className={cn(
                    "group relative text-left rounded-xl border p-4 transition-all",
                    active
                      ? "border-primary/50 bg-primary/[0.06] shadow-[0_0_0_1px_hsl(var(--primary)/0.35),0_8px_30px_-12px_hsl(var(--primary)/0.4)]"
                      : "border-border/50 bg-card/40 hover:border-border hover:bg-card/70",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={cn(
                      "h-9 w-9 rounded-lg flex items-center justify-center border transition-colors",
                      active ? "bg-primary/15 border-primary/30 text-primary" : "bg-muted/40 border-border/50 text-muted-foreground"
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    {m.badge && (
                      <Badge variant={m.badge.variant} className="text-[10px]">{m.badge.label}</Badge>
                    )}
                  </div>
                  <div className="mt-3.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{m.title}</span>
                      {active && <CircleDot className="h-3 w-3 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{m.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ===== Guardrails + Simulador (lado a lado em desktop) ===== */}
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Guardrails */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" /> Regras de segurança
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Fundação que mantém o robô seguro e respeitoso com o cliente.
                  </CardDescription>
                </div>
                <Badge variant="success" className="text-[10px]">Ativas</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {GUARDRAILS.map((g) => (
                <div key={g} className="flex items-start gap-3 py-1.5">
                  <div className="h-5 w-5 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="h-3 w-3 text-emerald-400" />
                  </div>
                  <span className="text-[13px] text-foreground/90 leading-relaxed">{g}</span>
                </div>
              ))}
              <div className="pt-2 mt-1 border-t border-border/40 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Humano pode assumir a qualquer momento.</span>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                  Editar regras <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Simulador */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" /> Teste antes de ativar
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Modo teste — nada é enviado ao cliente.
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="text-[10px]">Sandbox</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
                  Mensagem do cliente
                </label>
                <Textarea
                  value={simInput}
                  onChange={(e) => setSimInput(e.target.value)}
                  rows={2}
                  className="mt-1.5 text-sm bg-background/50 border-border/60 resize-none"
                  placeholder="Cole uma mensagem real para ver como a IA responderia..."
                />
              </div>
              <Button onClick={runSimulator} size="sm" variant="outline" className="h-8 text-xs gap-2">
                <Sparkle className="h-3 w-3" /> Gerar prévia
              </Button>
              {simResult ? (
                <div className="space-y-2.5 pt-1">
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Resposta sugerida</div>
                    <p className="text-[13px] text-foreground/90 leading-relaxed">{simResult.reply}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-border/40 bg-card/40 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Intenção</div>
                      <div className="text-[12px] text-foreground/85 mt-0.5">{simResult.intent}</div>
                    </div>
                    <div className="rounded-lg border border-border/40 bg-card/40 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Próxima ação</div>
                      <div className="text-[12px] text-foreground/85 mt-0.5">{simResult.next}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-muted-foreground italic pt-1">
                  Use exemplos reais do seu atendimento para validar tom e regras.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ===== Regras avançadas (accordion) ===== */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Regras avançadas</CardTitle>
            <CardDescription className="text-xs">Refinamentos opcionais. Recolha o que não precisar agora.</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" defaultValue={["elig"]} className="w-full">
              <AccordionItem value="elig" className="border-border/40">
                <AccordionTrigger className="text-sm font-medium hover:no-underline">Elegibilidade</AccordionTrigger>
                <AccordionContent>
                  <RuleList
                    rows={[
                      { k: "noAgent", label: "Apenas contatos sem atendente atribuído" },
                      { k: "noClient", label: "Apenas contatos sem cliente vinculado" },
                      { k: "specificTag", label: "Apenas contatos com tag “IA ativa”" },
                      { k: "insideWindow", label: "Apenas dentro da janela de atendimento" },
                      { k: "newConversations", label: "Todas as novas conversas iniciadas pelo cliente" },
                    ]}
                    state={state.audience}
                    onToggle={toggleAudience}
                  />
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="handoff" className="border-border/40">
                <AccordionTrigger className="text-sm font-medium hover:no-underline">Transferência para humano</AccordionTrigger>
                <AccordionContent>
                  <RuleList
                    rows={[
                      { k: "askedAgent", label: "Cliente pediu atendente" },
                      { k: "angry", label: "Irritação detectada" },
                      { k: "complaint", label: "Reclamação" },
                      { k: "complex", label: "Pedido complexo" },
                      { k: "onError", label: "Erro da IA" },
                      { k: "humanTakeover", label: "Quando um humano assumir" },
                      { k: "resolved", label: "Conversa marcada como resolvida" },
                      { k: "outsideWindow", label: "Saiu da janela de atendimento" },
                    ]}
                    state={state.stop}
                    onToggle={toggleStop}
                  />
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="limits" className="border-border/40 border-b-0">
                <AccordionTrigger className="text-sm font-medium hover:no-underline">Limites</AccordionTrigger>
                <AccordionContent>
                  <RuleList
                    rows={[
                      { k: "neverCampaigns", label: "Não responder campanhas e listas", locked: true },
                      { k: "neverColdStart", label: "Nunca iniciar conversa fria", locked: true },
                    ]}
                    state={state.audience}
                    onToggle={toggleAudience}
                  />
                  <p className="text-[11px] text-muted-foreground mt-3 px-1">
                    Campanhas usam modelos de mensagem, não o Robô IA.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* ===== Conhecimento do Robô ===== */}
        <section className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Conhecimento do Robô</h2>
              <p className="text-xs text-muted-foreground mt-0.5">A IA só responde bem quando sabe sobre você.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {KNOWLEDGE_CARDS.map((card) => {
              const Icon = card.icon;
              const meta = KNOWLEDGE_STATUS_META[card.status];
              const disabled = card.status === "soon";
              return (
                <div
                  key={card.id}
                  className="rounded-xl border border-border/50 bg-card/40 p-4 hover:bg-card/60 transition-colors flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="h-9 w-9 rounded-lg bg-muted/40 border border-border/50 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-foreground/70" />
                    </div>
                    <Badge variant={meta.variant} className="text-[10px]">{meta.label}</Badge>
                  </div>
                  <div className="min-h-[48px]">
                    <div className="text-sm font-semibold text-foreground">{card.title}</div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{card.description}</p>
                  </div>
                  {disabled ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-block">
                          <Button variant="ghost" size="sm" disabled className="h-7 text-xs w-full">
                            Em breve
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        Configuração real entra na próxima fase
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-7 text-xs justify-between">
                      {card.status === "configured" ? "Editar" : "Adicionar"}
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ===== Inbox preview ===== */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Preview da Inbox</CardTitle>
            <CardDescription className="text-xs">Como os controles aparecem no topo de cada conversa.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border/50 bg-gradient-to-br from-muted/20 to-transparent p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="success" className="gap-1"><Bot className="h-3 w-3" /> IA ativa</Badge>
                <Badge variant="secondary" className="gap-1"><Sparkles className="h-3 w-3" /> Modo sugestão</Badge>
                <Badge variant="secondary" className="gap-1"><UserCog className="h-3 w-3" /> Humano assumiu</Badge>
                <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Fora da janela</Badge>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="outline" disabled className="h-8 text-xs gap-1.5">
                    <Pause className="h-3 w-3" /> Pausar IA
                  </Button>
                  <Button size="sm" variant="outline" disabled className="h-8 text-xs gap-1.5">
                    <Hand className="h-3 w-3" /> Assumir conversa
                  </Button>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground italic mt-3">
                A IA só atende quem chamou primeiro.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ===== Atividade ===== */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-foreground/70" /> Atividade do Robô
            </CardTitle>
            <CardDescription className="text-xs">Decisões, pausas e transferências aparecem aqui.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-6 py-10 text-center">
              <div className="mx-auto h-10 w-10 rounded-full bg-muted/40 border border-border/50 flex items-center justify-center">
                <Activity className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground/90 mt-3">Nenhuma atividade ainda</p>
              <p className="text-[12px] text-muted-foreground mt-1 max-w-sm mx-auto">
                Quando o robô começar a operar, as decisões e pausas aparecerão aqui.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ===== Sticky save bar (mobile) ===== */}
        {dirty && (
          <div className="lg:hidden sticky bottom-3 z-20">
            <div className="rounded-xl border border-border/60 bg-card/95 backdrop-blur px-3 py-2.5 shadow-lg flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Alterações não salvas</span>
              <Button onClick={handleSave} size="sm" className="h-8 gap-1.5">
                <Save className="h-3.5 w-3.5" /> Salvar
              </Button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

function RuleList<T extends Record<string, boolean>>({
  rows,
  state,
  onToggle,
}: {
  rows: Array<{ k: keyof T; label: string; locked?: boolean }>;
  state: T;
  onToggle: (k: keyof T) => void;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-2">
      {rows.map((row) => (
        <div
          key={String(row.k)}
          className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-transparent hover:border-border/40 hover:bg-muted/20 transition-colors"
        >
          <div className="min-w-0 flex items-center gap-2">
            <span className="text-[13px] text-foreground/90 truncate">{row.label}</span>
            {row.locked && (
              <Badge variant="secondary" className="text-[9px]">Protegido</Badge>
            )}
          </div>
          <Switch checked={!!state[row.k]} onCheckedChange={() => onToggle(row.k)} disabled={row.locked} />
        </div>
      ))}
    </div>
  );
}
