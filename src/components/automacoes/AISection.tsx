import { useState } from "react";
import { Bot, Plus, Sparkles, Power, Send, MessageSquare, Coins, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAiAgents, AgentCategory, AiAgent } from "@/hooks/useAiAgents";
import { useAiCredits, openCreditsWallet } from "@/hooks/useAiCredits";

const categoryLabels: Record<AgentCategory, string> = {
  copywriter: "Copywriter", designer: "Designer", analyst: "Analista", strategist: "Estrategista", support: "Atendimento", custom: "Personalizado",
};

const packs = [
  { id: "spark", name: "Spark", credits: 500, price: "R$ 49" },
  { id: "boost", name: "Boost", credits: 1500, price: "R$ 119" },
  { id: "power", name: "Power", credits: 2500, price: "R$ 179" },
  { id: "mega", name: "Mega", credits: 5000, price: "R$ 299" },
];

export function AISection() {
  const { agents, addAgent, toggleAgentStatus, incrementUsage } = useAiAgents();
  const credits = useAiCredits();
  const [newOpen, setNewOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [chatAgent, setChatAgent] = useState<AiAgent | null>(null);
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");

  const [form, setForm] = useState({ name: "", role: "", category: "custom" as AgentCategory, description: "", systemPrompt: "", active: true });

  const activeCount = agents.filter((a) => a.status === "active").length;
  const totalUsage = agents.reduce((s, a) => s + a.usageCount, 0);
  const customCount = agents.filter((a) => !a.isDemo).length;

  const handleCreate = () => {
    if (!form.name.trim()) return toast.error("Nome é obrigatório");
    if (!form.role.trim()) return toast.error("Função é obrigatória");
    addAgent({ name: form.name, role: form.role, description: form.description, category: form.category, systemPrompt: form.systemPrompt, status: form.active ? "active" : "inactive" });
    toast.success("Assistente criado");
    setForm({ name: "", role: "", category: "custom", description: "", systemPrompt: "", active: true });
    setNewOpen(false);
  };

  const openChat = (agent: AiAgent) => {
    setChatAgent(agent);
    setChatHistory([{ role: "assistant", text: `Olá! Sou o ${agent.name}. Em que posso ajudar?` }]);
  };

  const sendChat = () => {
    if (!chatInput.trim() || !chatAgent) return;
    if (credits.balance <= 0) {
      toast.error("Você precisa de créditos para usar assistentes de IA.");
      openCreditsWallet();
      return;
    }
    const ok = credits.consumeCredit(1, `Uso simulado — ${chatAgent.name}`);
    if (!ok) {
      openCreditsWallet();
      return;
    }
    setChatHistory((h) => [...h, { role: "user", text: chatInput }, { role: "assistant", text: "Resposta simulada do assistente. A integração real será ativada em uma etapa futura." }]);
    incrementUsage(chatAgent.id);
    setChatInput("");
  };

  const buy = (pack: typeof packs[number]) => {
    credits.simulatePurchase({ name: pack.name, credits: pack.credits });
    toast.success("Compra simulada. O checkout real será ativado futuramente.");
    setBuyOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Assistentes de IA</h2>
        <Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> Novo assistente</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Assistentes ativos" value={activeCount} icon={<Bot className="h-4 w-4" />} />
        <MetricCard label="Usos simulados" value={totalUsage} icon={<Sparkles className="h-4 w-4" />} />
        <MetricCard label="Créditos disponíveis" value={credits.balance} icon={<Coins className="h-4 w-4" />} />
        <MetricCard label="Personalizados" value={customCount} icon={<Plus className="h-4 w-4" />} />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <Card key={agent.id} className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold truncate">{agent.name}</h3>
                  {agent.isDemo && <Badge variant="outline" className="text-[10px]">demo</Badge>}
                </div>
                <p className="text-xs text-muted-foreground truncate">{agent.role}</p>
              </div>
              <Badge variant={agent.status === "active" ? "default" : "secondary"} className="shrink-0">{agent.status === "active" ? "Ativo" : "Inativo"}</Badge>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{agent.description}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{categoryLabels[agent.category]}</span>
              <span>{agent.usageCount} usos</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => openChat(agent)}><MessageSquare className="h-3.5 w-3.5" /> Usar</Button>
              <Button size="sm" variant="outline" onClick={() => toggleAgentStatus(agent.id)}><Power className="h-3.5 w-3.5" /></Button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><Coins className="h-4 w-4 text-primary" /> Créditos de IA</h3>
            <p className="text-xs text-muted-foreground">Saldo atual: <strong className="text-foreground">{credits.balance}</strong> créditos</p>
          </div>
          <Button onClick={() => setBuyOpen(true)} variant="outline"><ShoppingCart className="h-4 w-4" /> Comprar créditos</Button>
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

      {/* New agent modal */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo assistente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Função *</Label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Ex: Copywriter de campanhas" /></div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as AgentCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
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

      {/* Chat modal */}
      <Dialog open={!!chatAgent} onOpenChange={(o) => !o && setChatAgent(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{chatAgent?.name}</DialogTitle></DialogHeader>
          <div className="h-64 overflow-y-auto space-y-2 p-3 bg-muted/20 rounded-lg">
            {chatHistory.map((m, i) => (
              <div key={i} className={`text-sm p-2 rounded-lg max-w-[85%] ${m.role === "user" ? "bg-primary/20 ml-auto" : "bg-muted/60"}`}>{m.text}</div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Digite uma mensagem..." onKeyDown={(e) => e.key === "Enter" && sendChat()} />
            <Button onClick={sendChat}><Send className="h-4 w-4" /></Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Buy credits modal */}
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
          <p className="text-xs text-muted-foreground text-center">Compras são simuladas nesta versão.</p>
        </DialogContent>
      </Dialog>
    </div>
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
