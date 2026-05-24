import { useMemo, useState } from "react";
import {
  Bot, Plus, Sparkles, Power, Send, MessageSquare, Coins, ShoppingCart,
  Compass, LineChart, Wallet, SearchCheck, Radar, Handshake, Tag,
  Shield, ListChecks, Workflow, CalendarClock, PenLine, Palette, LifeBuoy,
  KeyRound, Lock, Info, Star, Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAiAgents, AgentCategory, AiAgent, AgentBadge } from "@/hooks/useAiAgents";
import { useAiCredits, openCreditsWallet } from "@/hooks/useAiCredits";
import { cn } from "@/lib/utils";

const categoryLabels: Record<AgentCategory, string> = {
  strategy: "Estratégia",
  commercial: "Comercial",
  operations: "Operação",
  content: "Conteúdo",
  client: "Cliente",
};

const categoryOrder: AgentCategory[] = ["strategy", "commercial", "operations", "content", "client"];

const presetIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  orchestrator: Compass,
  analyst: LineChart,
  financial: Wallet,
  bottleneck: SearchCheck,
  "revenue-radar": Radar,
  sales: Handshake,
  pricing: Tag,
  "scope-guardian": Shield,
  operations: ListChecks,
  "automation-architect": Workflow,
  meeting: CalendarClock,
  copywriter: PenLine,
  "creative-director": Palette,
  concierge: LifeBuoy,
};

const badgeMeta: Record<AgentBadge, { label: string; className: string }> = {
  simulated: { label: "Simulado", className: "bg-muted/60 text-muted-foreground border-border/60" },
  "coming-soon": { label: "Em breve", className: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
  "uses-credits": { label: "Usa créditos", className: "bg-primary/10 text-primary border-primary/30" },
  "own-api": { label: "API própria", className: "bg-sky-500/10 text-sky-300 border-sky-500/30" },
};

const packs = [
  { id: "spark", name: "Spark", credits: 500, price: "R$ 49" },
  { id: "boost", name: "Boost", credits: 1500, price: "R$ 119" },
  { id: "power", name: "Power", credits: 2500, price: "R$ 179" },
  { id: "mega", name: "Mega", credits: 5000, price: "R$ 299" },
];

export function AISection() {
  const { agents, toggleAgentStatus, incrementUsage } = useAiAgents();
  const credits = useAiCredits();

  const [tab, setTab] = useState<"all" | AgentCategory>("all");
  const [buyOpen, setBuyOpen] = useState(false);
  const [apiOpen, setApiOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestText, setSuggestText] = useState("");
  const [chatAgent, setChatAgent] = useState<AiAgent | null>(null);
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");

  const heroAgent = agents.find((a) => a.hero);
  const visibleAgents = useMemo(() => agents.filter((a) => !a.hero), [agents]);
  const grouped = useMemo(() => {
    const g: Record<AgentCategory, AiAgent[]> = {
      strategy: [], commercial: [], operations: [], content: [], client: [],
    };
    visibleAgents.forEach((a) => g[a.category]?.push(a));
    return g;
  }, [visibleAgents]);

  const activeCount = agents.filter((a) => a.status === "active").length;
  const totalUsage = agents.reduce((s, a) => s + a.usageCount, 0);
  const koraAgentCount = agents.filter((a) => a.isDemo).length;

  const handleSuggest = () => {
    if (!suggestText.trim()) return toast.error("Descreva o agente que você gostaria de ver");
    toast.success("Sugestão enviada. Obrigado!");
    setSuggestText("");
    setSuggestOpen(false);
  };

  const openChat = (agent: AiAgent) => {
    if (agent.comingSoon) {
      toast.info("Este agente ficará disponível em breve.");
      return;
    }
    setChatAgent(agent);
    setChatHistory([
      { role: "assistant", text: `Olá! Sou o ${agent.name}. ${agent.role}. As respostas aqui ainda são simuladas — a execução real será ativada quando o backend de IA estiver pronto.` },
    ]);
  };

  const sendChat = () => {
    if (!chatInput.trim() || !chatAgent) return;
    if (credits.balance <= 0) {
      toast.error("Você precisa de créditos para usar agentes de IA.");
      openCreditsWallet();
      return;
    }
    const ok = credits.consumeCredit(1, `Uso simulado — ${chatAgent.name}`);
    if (!ok) { openCreditsWallet(); return; }
    setChatHistory((h) => [
      ...h,
      { role: "user", text: chatInput },
      { role: "assistant", text: "Resposta simulada. A integração real será ativada em uma etapa futura, com execução segura no servidor." },
    ]);
    incrementUsage(chatAgent.id);
    setChatInput("");
  };

  const buy = (pack: typeof packs[number]) => {
    credits.simulatePurchase({ name: pack.name, credits: pack.credits });
    toast.success("Compra simulada. O checkout real será ativado futuramente.");
    setBuyOpen(false);
  };

  const renderAgentList = (list: AiAgent[]) =>
    list.length === 0 ? (
      <p className="text-sm text-muted-foreground py-6 text-center">Nenhum agente nesta categoria.</p>
    ) : (
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {list.map((agent) => <AgentCard key={agent.id} agent={agent} onOpen={openChat} onToggle={toggleAgentStatus} />)}
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Agentes de IA</h2>
          <p className="text-xs text-muted-foreground">Uma camada inteligente para gestão de estúdio. Execução real é ativada em etapa futura.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setApiOpen(true)}>
            <KeyRound className="h-4 w-4" /> Usar minha própria API
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSuggestOpen(true)}>
            <Lightbulb className="h-4 w-4" /> Sugerir agente
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground -mt-4">
        Os agentes KORA são curados para fluxos de estúdio. Agentes personalizados serão avaliados em uma etapa futura.
      </p>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Agentes ativos" value={activeCount} icon={<Bot className="h-4 w-4" />} />
        <MetricCard label="Usos simulados" value={totalUsage} icon={<Sparkles className="h-4 w-4" />} />
        <MetricCard label="Créditos disponíveis" value={credits.balance} icon={<Coins className="h-4 w-4" />} />
        <MetricCard label="Personalizados" value={customCount} icon={<Plus className="h-4 w-4" />} />
      </div>

      {/* Hero copilot */}
      {heroAgent && <HeroCopilot agent={heroAgent} onOpen={() => openChat(heroAgent)} />}

      {/* Tabs by category */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">Todos</TabsTrigger>
          {categoryOrder.map((c) => (
            <TabsTrigger key={c} value={c}>{categoryLabels[c]}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="space-y-6">
          {categoryOrder.map((c) => grouped[c].length > 0 && (
            <section key={c} className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">{categoryLabels[c]}</h3>
                <span className="text-xs text-muted-foreground">· {grouped[c].length}</span>
              </div>
              {renderAgentList(grouped[c])}
            </section>
          ))}
        </TabsContent>

        {categoryOrder.map((c) => (
          <TabsContent key={c} value={c}>{renderAgentList(grouped[c])}</TabsContent>
        ))}
      </Tabs>

      {/* Wallet */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><Coins className="h-4 w-4 text-primary" /> Créditos de IA</h3>
            <p className="text-xs text-muted-foreground">Saldo: <strong className="text-foreground">{credits.balance}</strong> créditos · compras e usos atuais são simulados</p>
          </div>
          <Button onClick={() => setBuyOpen(true)} variant="outline" size="sm"><ShoppingCart className="h-4 w-4" /> Comprar créditos</Button>
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {credits.transactions.slice(0, 8).map((t) => (
            <div key={t.id} className="flex items-center justify-between text-sm border-b border-border/40 pb-2 last:border-0">
              <div className="min-w-0">
                <p className="truncate">{t.description}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(t.createdAt).toLocaleDateString("pt-BR")}</p>
              </div>
              <span className={t.amount >= 0 ? "text-emerald-400" : "text-rose-400"}>{t.amount >= 0 ? "+" : ""}{t.amount}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* New agent */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo agente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Função *</Label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Ex: Copywriter de campanhas" /></div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as AgentCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categoryOrder.map((c) => <SelectItem key={c} value={c}>{categoryLabels[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div><Label>Prompt base</Label><Textarea value={form.systemPrompt} onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })} rows={3} /></div>
            <div className="flex items-center justify-between"><Label>Ativo</Label><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chat */}
      <Dialog open={!!chatAgent} onOpenChange={(o) => !o && setChatAgent(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {chatAgent && <AgentIcon agent={chatAgent} className="h-4 w-4 text-primary" />}
              {chatAgent?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">{chatAgent?.role} · respostas simuladas nesta etapa</DialogDescription>
          </DialogHeader>
          <div className="h-64 overflow-y-auto space-y-2 p-3 bg-muted/20 rounded-lg">
            {chatHistory.map((m, i) => (
              <div key={i} className={cn("text-sm p-2 rounded-lg max-w-[85%]", m.role === "user" ? "bg-primary/20 ml-auto" : "bg-muted/60")}>{m.text}</div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Digite uma mensagem..." onKeyDown={(e) => e.key === "Enter" && sendChat()} />
            <Button onClick={sendChat}><Send className="h-4 w-4" /></Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Buy credits */}
      <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Comprar créditos</DialogTitle></DialogHeader>
          <div className="grid sm:grid-cols-2 gap-3">
            {packs.map((p) => (
              <Card key={p.id} className="p-4 space-y-2 hover:border-primary/40 transition-colors">
                <h4 className="font-semibold">{p.name}</h4>
                <p className="text-2xl font-bold">{p.credits.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">créditos</span></p>
                <p className="text-sm text-muted-foreground">{p.price}</p>
                <Button className="w-full" onClick={() => buy(p)}>Selecionar</Button>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center">Compras são simuladas nesta versão. O checkout real será ativado em uma etapa futura.</p>
        </DialogContent>
      </Dialog>

      {/* Own API */}
      <Dialog open={apiOpen} onOpenChange={setApiOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /> Usar minha própria API</DialogTitle>
            <DialogDescription className="text-xs">
              Você poderá conectar sua chave da OpenAI, Anthropic ou Gemini. As chaves serão criptografadas no servidor em uma etapa futura.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Provedor</Label>
              <Select defaultValue="openai" disabled>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>API key</Label>
              <Input type="password" placeholder="sk-..." disabled />
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
              <Lock className="h-4 w-4 shrink-0 mt-0.5" />
              <p>Armazenamento seguro de chaves será ativado em uma etapa futura. Por segurança, sua chave não é salva no navegador.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApiOpen(false)}>Fechar</Button>
            <Button disabled>Validar e salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------- Subcomponents -------------------- */

function AgentIcon({ agent, className }: { agent: AiAgent; className?: string }) {
  const Icon = (agent.preset && presetIcons[agent.preset]) || Bot;
  return <Icon className={className} />;
}

function HeroCopilot({ agent, onOpen }: { agent: AiAgent; onOpen: () => void }) {
  return (
    <Card className="relative overflow-hidden p-6 border-primary/40 bg-gradient-to-br from-primary/15 via-card to-card">
      <div className="absolute inset-0 pointer-events-none opacity-30 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.4),transparent_60%)]" />
      <div className="relative flex flex-col lg:flex-row lg:items-center gap-5">
        <div className="h-12 w-12 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0">
          <AgentIcon agent={agent} className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-primary/20 text-primary border-primary/40 gap-1"><Star className="h-3 w-3" /> Copiloto principal</Badge>
            {agent.badges?.map((b) => (
              <Badge key={b} variant="outline" className={cn("text-[10px]", badgeMeta[b].className)}>{badgeMeta[b].label}</Badge>
            ))}
          </div>
          <h3 className="text-xl font-semibold">Seu copiloto de estúdio</h3>
          <p className="text-sm text-muted-foreground max-w-2xl">{agent.description}</p>
          {agent.examples && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {agent.examples.map((ex) => (
                <span key={ex} className="text-[11px] px-2 py-0.5 rounded-md bg-muted/40 border border-border/40 text-muted-foreground">{ex}</span>
              ))}
            </div>
          )}
        </div>
        <Button onClick={onOpen} className="shrink-0"><MessageSquare className="h-4 w-4" /> Abrir copiloto</Button>
      </div>
    </Card>
  );
}

function AgentCard({ agent, onOpen, onToggle }: {
  agent: AiAgent; onOpen: (a: AiAgent) => void; onToggle: (id: string) => void;
}) {
  return (
    <Card className={cn("p-4 space-y-3 transition-colors hover:border-primary/40", agent.comingSoon && "opacity-80")}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-muted/40 border border-border/40 flex items-center justify-center shrink-0">
            <AgentIcon agent={agent} className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">{agent.name}</h3>
            <p className="text-[11px] text-muted-foreground truncate">{agent.role}</p>
          </div>
        </div>
        <Badge variant={agent.status === "active" ? "default" : "secondary"} className="shrink-0 text-[10px]">
          {agent.status === "active" ? "Ativo" : "Inativo"}
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground line-clamp-2">{agent.description}</p>

      {agent.examples && agent.examples.length > 0 && (
        <ul className="space-y-1">
          {agent.examples.slice(0, 3).map((ex) => (
            <li key={ex} className="text-[11px] text-muted-foreground flex gap-1.5">
              <span className="text-primary mt-0.5">·</span><span className="truncate">{ex}</span>
            </li>
          ))}
        </ul>
      )}

      {agent.badges && agent.badges.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {agent.badges.map((b) => (
            <Badge key={b} variant="outline" className={cn("text-[10px]", badgeMeta[b].className)}>{badgeMeta[b].label}</Badge>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button size="sm" className="flex-1" onClick={() => onOpen(agent)} disabled={agent.comingSoon}>
          <MessageSquare className="h-3.5 w-3.5" /> {agent.comingSoon ? "Em breve" : "Abrir"}
        </Button>
        {!agent.comingSoon && (
          <Button size="sm" variant="outline" onClick={() => onToggle(agent.id)} title={agent.status === "active" ? "Desativar" : "Ativar"}>
            <Power className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </Card>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span>{label}</span>{icon}
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </Card>
  );
}
