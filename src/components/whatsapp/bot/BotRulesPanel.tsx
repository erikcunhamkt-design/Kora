import { useEffect, useState } from "react";
import {
  Bot,
  Sparkles,
  PowerOff,
  MessageSquare,
  Clock,
  Tag,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  AlertTriangle,
  Save,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STORAGE_KEY = "orbyt.whatsapp.bot.rules.v1";

type BotMode = "off" | "suggest" | "assistant" | "after_hours" | "tagged";

const MODES: Array<{
  id: BotMode;
  icon: typeof Bot;
  title: string;
  description: string;
  badge?: { label: string; variant: "default" | "success" | "warning" | "secondary" | "destructive" };
}> = [
  { id: "off", icon: PowerOff, title: "Desligado", description: "O robô não responde nem sugere mensagens.", badge: { label: "Inativo", variant: "secondary" } },
  { id: "suggest", icon: Sparkles, title: "Modo sugestão", description: "A IA sugere respostas para o atendente, mas não envia sozinha.", badge: { label: "Seguro", variant: "success" } },
  { id: "assistant", icon: Bot, title: "Modo assistente", description: "Responde novas conversas iniciadas pelo cliente até um humano assumir.", badge: { label: "Recomendado", variant: "default" } },
  { id: "after_hours", icon: Clock, title: "Fora do horário", description: "Responde apenas fora do horário comercial.", badge: { label: "Condicional", variant: "warning" } },
  { id: "tagged", icon: Tag, title: "Por tag", description: "Responde apenas conversas com a tag “IA ativa”.", badge: { label: "Manual", variant: "secondary" } },
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
  audience: AudienceRules;
  stop: StopRules;
};

const DEFAULT_STATE: BotRulesState = {
  mode: "suggest",
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
      audience: { ...DEFAULT_STATE.audience, ...(parsed.audience ?? {}) },
      stop: { ...DEFAULT_STATE.stop, ...(parsed.stop ?? {}) },
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function BotRulesPanel() {
  const [state, setState] = useState<BotRulesState>(DEFAULT_STATE);
  const [dirty, setDirty] = useState(false);

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
      toast.success("Regras do Robô IA salvas");
    } catch (e) {
      toast.error("Falha ao salvar regras", { description: (e as Error).message });
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2 text-foreground/90">
            <ShieldCheck className="h-5 w-5 text-primary" /> Regras de Atendimento do Robô IA
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Defina quando o robô pode responder automaticamente e em que situações deve parar.
          </p>
        </div>
        <Button onClick={handleSave} disabled={!dirty} size="sm" className="h-9 gap-2">
          <Save className="h-3.5 w-3.5" /> Salvar regras
        </Button>
      </div>

      {/* Safety banners */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3.5 flex gap-3">
          <ShieldAlert className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-foreground/85 leading-relaxed">
            <strong className="text-destructive">Sem conversas frias.</strong> O Robô IA não inicia conversas. Para campanhas e reativação fora da janela de atendimento, use <strong>Modelos de Mensagem</strong>.
          </p>
        </div>
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3.5 flex gap-3">
          <UserCog className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-foreground/85 leading-relaxed">
            <strong className="text-primary">Humano sempre no controle.</strong> Qualquer atendente pode assumir uma conversa a qualquer momento e o robô para imediatamente.
          </p>
        </div>
      </div>

      {/* Seção 1 - Modo de operação */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Modo de operação</CardTitle>
          <CardDescription className="text-xs">Escolha como o robô deve atuar no atendimento.</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={state.mode}
            onValueChange={(v) => update("mode", v as BotMode)}
            className="grid gap-2.5 sm:grid-cols-2"
          >
            {MODES.map((m) => {
              const Icon = m.icon;
              const active = state.mode === m.id;
              return (
                <label
                  key={m.id}
                  htmlFor={`mode-${m.id}`}
                  className={cn(
                    "relative flex gap-3 rounded-xl border p-3.5 cursor-pointer transition-all",
                    active
                      ? "border-primary/60 bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]"
                      : "border-border/50 bg-card/40 hover:border-border hover:bg-card/60",
                  )}
                >
                  <RadioGroupItem value={m.id} id={`mode-${m.id}`} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Icon className={cn("h-3.5 w-3.5", active ? "text-primary" : "text-muted-foreground")} />
                      <span className="text-sm font-semibold">{m.title}</span>
                      {m.badge && (
                        <Badge variant={m.badge.variant} className="text-[10px]">
                          {m.badge.label}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{m.description}</p>
                  </div>
                </label>
              );
            })}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Seção 2 - Quem o robô pode atender */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" /> Quem o robô pode atender?
          </CardTitle>
          <CardDescription className="text-xs">
            Limites que o robô respeita ao decidir responder. Recomendamos manter os bloqueios de campanha e conversa fria sempre ativos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {(
            [
              { k: "newConversations", label: "Todas as novas conversas iniciadas pelo cliente" },
              { k: "insideWindow", label: "Apenas conversas dentro da janela de atendimento (24h)" },
              { k: "noAgent", label: "Apenas contatos sem atendente atribuído" },
              { k: "noClient", label: "Apenas contatos sem cliente vinculado" },
              { k: "specificTag", label: "Apenas contatos com tag específica (“IA ativa”)" },
              { k: "neverCampaigns", label: "Nunca responder campanhas e listas", protect: true },
              { k: "neverColdStart", label: "Nunca iniciar conversa fria", protect: true },
            ] as Array<{ k: keyof AudienceRules; label: string; protect?: boolean }>
          ).map((row) => (
            <div
              key={row.k}
              className={cn(
                "flex items-center justify-between gap-3 py-2.5 border-b border-border/30 last:border-b-0",
                row.protect && "bg-destructive/[0.04] -mx-3 px-3 rounded-md border-destructive/20",
              )}
            >
              <div className="min-w-0 flex items-center gap-2">
                <span className="text-xs text-foreground/90">{row.label}</span>
                {row.protect && (
                  <Badge variant="destructive" className="text-[9px]">Proteção</Badge>
                )}
              </div>
              <Switch checked={state.audience[row.k]} onCheckedChange={() => toggleAudience(row.k)} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Seção 3 - Quando parar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" /> Quando parar a IA?
          </CardTitle>
          <CardDescription className="text-xs">
            Gatilhos que pausam o robô e devolvem a conversa ao humano.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {(
            [
              { k: "humanTakeover", label: "Quando um humano assumir a conversa" },
              { k: "askedAgent", label: "Quando o cliente pedir atendente" },
              { k: "angry", label: "Quando o cliente demonstrar irritação" },
              { k: "resolved", label: "Quando a conversa for marcada como resolvida" },
              { k: "complex", label: "Quando detectar pedido complexo" },
              { k: "complaint", label: "Quando detectar reclamação" },
              { k: "outsideWindow", label: "Quando sair da janela de atendimento" },
              { k: "onError", label: "Quando houver erro na resposta da IA" },
            ] as Array<{ k: keyof StopRules; label: string }>
          ).map((row) => (
            <div
              key={row.k}
              className="flex items-center justify-between gap-3 py-2.5 border-b border-border/30 last:border-b-0"
            >
              <span className="text-xs text-foreground/90">{row.label}</span>
              <Switch checked={state.stop[row.k]} onCheckedChange={() => toggleStop(row.k)} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Seção 4 - Preview Inbox */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Preview de controles na Inbox</CardTitle>
          <CardDescription className="text-xs">
            Estes badges e botões aparecerão no topo de cada conversa. Lógica real será conectada na próxima fase.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-card/40 p-3.5">
            <Badge variant="success" className="gap-1">
              <Bot className="h-3 w-3" /> IA ativa
            </Badge>
            <Badge variant="warning" className="gap-1">
              <Sparkles className="h-3 w-3" /> Modo sugestão
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" /> Fora da janela
            </Badge>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" disabled className="h-8 text-xs">
                Pausar IA
              </Button>
              <Button size="sm" variant="outline" disabled className="h-8 text-xs">
                Assumir conversa
              </Button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
              <strong className="text-foreground/90">Aviso:</strong> IA pausada por humano.
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200/90">
              <strong>Aviso:</strong> Fora da janela de atendimento — use modelo de mensagem ativo.
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground italic">
            Tooltip exibido nos botões: “IA só responde conversas iniciadas pelo cliente.”
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
