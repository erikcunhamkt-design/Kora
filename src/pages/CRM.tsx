import { PageHeader } from "@/components/layout/PageHeader";
import { useState, useEffect } from "react";
import { usePlan } from "@/contexts/PlanContext";
import { UsageBadge } from "@/components/plan/UsageBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useLeads, type Lead, type Priority, type StageKey } from "@/hooks/useLeads";
import {
  Plus, Search, TrendingUp, DollarSign, CheckCircle2, BarChart3,
  Phone, Mail, Globe, Clock, MoreHorizontal, ChevronRight, ChevronLeft,
  User, Briefcase, Calendar, MessageCircle, StickyNote, X as XIcon,
  ArrowRight, XCircle, GripVertical, AlertCircle, Sparkles, Flame
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface StageConfig {
  key: StageKey;
  label: string;
  color: string;
  bgAccent: string;
  dotColor: string;
}

// ---------- Stage config ----------
const stageConfigs: StageConfig[] = [
  { key: "lead", label: "Lead", color: "border-primary/60", bgAccent: "bg-primary/8", dotColor: "bg-primary" },
  { key: "contato", label: "Contato iniciado", color: "border-secondary/60", bgAccent: "bg-secondary/8", dotColor: "bg-secondary" },
  { key: "proposta", label: "Proposta enviada", color: "border-amber-500/60", bgAccent: "bg-amber-500/8", dotColor: "bg-amber-500" },
  { key: "negociacao", label: "Negociação", color: "border-accent/60", bgAccent: "bg-accent/8", dotColor: "bg-accent" },
  { key: "fechado", label: "Fechado", color: "border-emerald-500/60", bgAccent: "bg-emerald-500/8", dotColor: "bg-emerald-500" },
  { key: "perdido", label: "Perdido", color: "border-destructive/60", bgAccent: "bg-destructive/8", dotColor: "bg-destructive" },
];

const priorityStyles: Record<Priority, string> = {
  alta: "bg-destructive/10 text-destructive border-destructive/20",
  média: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  baixa: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const serviceTypes = ["Branding", "Social Media", "Web Design", "Design Gráfico"];
const origins = ["Indicação", "Instagram", "LinkedIn", "Site", "WhatsApp", "Outro"];

// Mock data lives in src/hooks/useLeads.ts

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });

// ---------- Summary Card ----------
const SummaryCard = ({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) => (
  <div className="orbit-card p-4 flex items-center gap-4">
    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
      <Icon className="h-5 w-5 text-primary" />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground truncate">{label}</p>
      <p className="text-xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  </div>
);

// ---------- Main Component ----------
const CRM = () => {
  const { leads, addLead, moveLead } = useLeads();
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterOrigin, setFilterOrigin] = useState("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const { wouldExceed, showPaywall, setUsage } = usePlan();

  const activeLeads = leads.filter(l => !["fechado", "perdido"].includes(l.stage)).length;
  useEffect(() => { setUsage("leads", activeLeads); }, [activeLeads, setUsage]);

  // Keep selectedLead in sync after moves
  useEffect(() => {
    if (selectedLead) {
      const fresh = leads.find(l => l.id === selectedLead.id);
      if (fresh && fresh.stage !== selectedLead.stage) setSelectedLead(fresh);
    }
  }, [leads, selectedLead]);

  const handleNewLead = () => {
    if (wouldExceed("maxLeads", activeLeads)) {
      showPaywall("leads");
      return;
    }
    setNewLeadOpen(true);
  };

  const filtered = leads.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q || l.name.toLowerCase().includes(q) || l.company.toLowerCase().includes(q) || (l.serviceType || "").toLowerCase().includes(q);
    const matchStage = filterStage === "all" || l.stage === filterStage;
    const matchType = filterType === "all" || l.serviceType === filterType;
    const matchPriority = filterPriority === "all" || l.priority === filterPriority;
    const matchOrigin = filterOrigin === "all" || l.origin === filterOrigin;
    return matchSearch && matchStage && matchType && matchPriority && matchOrigin;
  });

  const totalPipeline = leads.filter(l => !["fechado", "perdido"].includes(l.stage)).reduce((s, l) => s + l.estimatedValue, 0);
  const totalNegociacao = leads.filter(l => l.stage === "negociacao").reduce((s, l) => s + l.estimatedValue, 0);
  const fechadosMes = leads.filter(l => l.stage === "fechado").length;
  const novosLeads = leads.filter(l => l.stage === "lead").length;
  const valorPerdido = leads.filter(l => l.stage === "perdido").reduce((s, l) => s + l.estimatedValue, 0);
  const totalLeads = leads.filter(l => !["perdido"].includes(l.stage)).length;
  const taxaConversao = totalLeads > 0 ? Math.round((fechadosMes / totalLeads) * 100) : 0;

  // Drag handlers
  const handleDragStart = (id: number) => setDraggedId(id);
  const handleDragEnd = () => setDraggedId(null);
  const handleDrop = (stage: StageKey) => {
    if (draggedId !== null) {
      moveLead(draggedId, stage);
      setDraggedId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM"
        subtitle="Acompanhe seus leads e oportunidades de negócio"
        actions={
          <>
            <UsageBadge resource="leads" label="leads" />
            <Button onClick={handleNewLead} className="orbit-gradient text-white border-0 gap-2 shrink-0">
              <Plus className="h-4 w-4" /> Novo lead
            </Button>
          </>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <SummaryCard icon={TrendingUp} label="Total em pipeline" value={formatCurrency(totalPipeline)} />
        <SummaryCard icon={DollarSign} label="Em negociação" value={formatCurrency(totalNegociacao)} />
        <SummaryCard icon={Sparkles} label="Leads novos" value={String(novosLeads)} />
        <SummaryCard icon={CheckCircle2} label="Fechados no mês" value={String(fechadosMes)} sub={formatCurrency(leads.filter(l => l.stage === "fechado").reduce((s, l) => s + l.estimatedValue, 0))} />
        <SummaryCard icon={BarChart3} label="Taxa de conversão" value={`${taxaConversao}%`} />
        <SummaryCard icon={XCircle} label="Valor perdido" value={formatCurrency(valorPerdido)} />
      </div>

      {/* Filters */}
      <div className="orbit-card p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, empresa ou serviço..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-muted/50 border-border" />
        </div>
        <Select value={filterStage} onValueChange={setFilterStage}>
          <SelectTrigger className="w-[160px] bg-muted/50 border-border"><SelectValue placeholder="Etapa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as etapas</SelectItem>
            {stageConfigs.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[150px] bg-muted/50 border-border">
            <Flame className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Temperatura" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="média">Média</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterOrigin} onValueChange={setFilterOrigin}>
          <SelectTrigger className="w-[150px] bg-muted/50 border-border"><SelectValue placeholder="Origem" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as origens</SelectItem>
            {origins.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px] bg-muted/50 border-border"><SelectValue placeholder="Serviço" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {serviceTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
        {stageConfigs.map(stage => {
          const stageLeads = filtered.filter(l => l.stage === stage.key);
          const stageTotal = stageLeads.reduce((s, l) => s + l.estimatedValue, 0);

          return (
            <div
              key={stage.key}
              className="flex-shrink-0 w-[280px]"
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(stage.key)}
            >
              {/* Column header */}
              <div className={`orbit-card p-3 border-t-2 ${stage.color} mb-3`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${stage.dotColor}`} />
                    <h3 className="text-sm font-semibold text-foreground">{stage.label}</h3>
                  </div>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{stageLeads.length}</span>
                </div>
                {stageTotal > 0 && (
                  <p className="text-xs text-muted-foreground mt-1.5">{formatCurrency(stageTotal)}</p>
                )}
              </div>

              {/* Cards */}
              <div className="space-y-3 min-h-[120px]">
                {stageLeads.map(lead => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={() => handleDragStart(lead.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => setSelectedLead(lead)}
                    className={`orbit-card p-4 cursor-pointer hover:border-primary/30 transition-all duration-200 group ${draggedId === lead.id ? "opacity-50 scale-95" : ""}`}
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full orbit-gradient flex items-center justify-center text-xs font-bold text-white shrink-0">
                          {lead.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{lead.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{lead.company}</p>
                        </div>
                      </div>
                      <GripVertical className="h-4 w-4 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-grab" />
                    </div>

                    {/* Service & Priority */}
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className="text-[10px] bg-muted/50 border-border text-muted-foreground">{lead.serviceType}</Badge>
                      <Badge variant="outline" className={`text-[10px] ${priorityStyles[lead.priority]}`}>{lead.priority}</Badge>
                    </div>

                    {/* Value & Date */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-foreground">{formatCurrency(lead.estimatedValue)}</span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{lead.lastInteraction}</span>
                    </div>
                  </div>
                ))}

                {stageLeads.length === 0 && (
                  <div className="orbit-card border-dashed p-6 flex items-center justify-center">
                    <p className="text-xs text-muted-foreground">Nenhum lead</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* New Lead Dialog */}
      <NewLeadDialog open={newLeadOpen} onOpenChange={setNewLeadOpen} onSave={addLead} />

      {/* Lead Detail Sheet */}
      <LeadDetailSheet
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onMove={moveLead}
        stages={stageConfigs}
      />
    </div>
  );
};

// ---------- New Lead Dialog ----------
const emptyLead = {
  name: "", company: "", email: "", phone: "", serviceType: "",
  origin: "", estimatedValue: "", priority: "média" as Priority,
  stage: "lead" as StageKey, nextAction: "", description: "",
};

const NewLeadDialog = ({
  open, onOpenChange, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (data: Omit<Lead, "id" | "history" | "lastInteraction" | "notes" | "description"> & Partial<Pick<Lead, "description">>) => void;
}) => {
  const [form, setForm] = useState(emptyLead);
  const set = (k: keyof typeof emptyLead, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  useEffect(() => { if (open) setForm(emptyLead); }, [open]);

  const handleSave = () => {
    if (!form.name.trim()) return toast.error("Informe o nome do lead");
    if (!form.email.trim() && !form.phone.trim()) {
      return toast.error("Informe email ou WhatsApp/telefone");
    }
    onSave({
      name: form.name.trim(),
      company: form.company.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      serviceType: form.serviceType || "—",
      origin: form.origin || undefined,
      estimatedValue: Number(form.estimatedValue) || 0,
      priority: form.priority,
      stage: form.stage,
      nextAction: form.nextAction.trim() || undefined,
      description: form.description.trim(),
    });
    toast.success("Lead adicionado ao pipeline");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Novo lead</DialogTitle>
          <DialogDescription className="text-muted-foreground">Adicione um novo lead ao seu pipeline.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Nome completo*</Label>
            <Input placeholder="João Silva" value={form.name} onChange={e => set("name", e.target.value)} className="bg-muted/50 border-border" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Empresa</Label>
            <Input placeholder="Empresa Ltda" value={form.company} onChange={e => set("company", e.target.value)} className="bg-muted/50 border-border" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Email</Label>
            <Input type="email" placeholder="email@empresa.com" value={form.email} onChange={e => set("email", e.target.value)} className="bg-muted/50 border-border" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">WhatsApp / Telefone</Label>
            <Input placeholder="(11) 99999-9999" value={form.phone} onChange={e => set("phone", e.target.value)} className="bg-muted/50 border-border" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Serviço de interesse</Label>
            <Select value={form.serviceType} onValueChange={v => set("serviceType", v)}>
              <SelectTrigger className="bg-muted/50 border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {serviceTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Valor estimado (R$)</Label>
            <Input type="number" placeholder="5000" value={form.estimatedValue} onChange={e => set("estimatedValue", e.target.value)} className="bg-muted/50 border-border" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Origem</Label>
            <Select value={form.origin} onValueChange={v => set("origin", v)}>
              <SelectTrigger className="bg-muted/50 border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {origins.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Temperatura</Label>
            <Select value={form.priority} onValueChange={v => set("priority", v)}>
              <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="média">Média</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Etapa inicial</Label>
            <Select value={form.stage} onValueChange={v => set("stage", v)}>
              <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {stageConfigs.slice(0, -1).map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Próxima ação</Label>
            <Input placeholder="Ex.: Marcar call de diagnóstico" value={form.nextAction} onChange={e => set("nextAction", e.target.value)} className="bg-muted/50 border-border" />
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label className="text-sm text-muted-foreground">Observações</Label>
            <Textarea placeholder="Descreva o projeto ou contexto..." className="bg-muted/50 border-border min-h-[80px]" value={form.description} onChange={e => set("description", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="orbit-gradient text-white border-0" onClick={handleSave}>Adicionar lead</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------- Lead Detail Sheet ----------
const LeadDetailSheet = ({
  lead, onClose, onMove, stages
}: {
  lead: Lead | null;
  onClose: () => void;
  onMove: (id: number, stage: StageKey) => void;
  stages: StageConfig[];
}) => {
  const [noteText, setNoteText] = useState("");

  if (!lead) return null;

  const currentIdx = stages.findIndex(s => s.key === lead.stage);
  const stageConfig = stages[currentIdx];
  const canAdvance = currentIdx >= 0 && currentIdx < stages.length - 2; // can't advance past "fechado"
  const nextStage = canAdvance ? stages[currentIdx + 1] : null;

  const Section = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Icon className="h-4 w-4 text-primary" />{title}</h3>
      {children}
    </div>
  );

  return (
    <Sheet open={!!lead} onOpenChange={v => !v && onClose()}>
      <SheetContent className="bg-card border-border w-full sm:max-w-[480px] overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-foreground text-xl flex items-center gap-3">
            <div className="h-10 w-10 rounded-full orbit-gradient flex items-center justify-center text-sm font-bold text-white shrink-0">
              {lead.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </div>
            {lead.name}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`${stageConfig ? `border-t-0 ${priorityStyles[lead.priority]}` : ""}`}>{lead.priority}</Badge>
            <span className="text-muted-foreground">· {lead.company}</span>
          </SheetDescription>
        </SheetHeader>

        {/* Stage indicator */}
        <div className="my-4">
          <div className="flex items-center gap-1">
            {stages.map((s, i) => (
              <div key={s.key} className="flex items-center gap-1 flex-1">
                <div className={`h-1.5 rounded-full flex-1 transition-colors ${i <= currentIdx ? s.dotColor : "bg-muted"}`} />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Etapa atual: <span className="text-foreground font-medium">{stageConfig?.label}</span></p>
        </div>

        {/* Quick actions */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {nextStage && (
            <Button size="sm" className="orbit-gradient text-white border-0 gap-1.5" onClick={() => onMove(lead.id, nextStage.key)}>
              <ArrowRight className="h-3.5 w-3.5" /> Avançar para {nextStage.label}
            </Button>
          )}
          {lead.stage !== "fechado" && (
            <Button size="sm" variant="outline" className="gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" onClick={() => onMove(lead.id, "fechado")}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Fechar
            </Button>
          )}
          {lead.stage !== "perdido" && (
            <Button size="sm" variant="outline" className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => onMove(lead.id, "perdido")}>
              <XCircle className="h-3.5 w-3.5" /> Perdido
            </Button>
          )}
        </div>

        <div className="space-y-6 pb-6">
          {/* Project info */}
          <Section title="Projeto" icon={Briefcase}>
            <div className="orbit-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Serviço</span>
                <span className="text-sm text-foreground font-medium">{lead.serviceType}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Valor estimado</span>
                <span className="text-sm text-foreground font-bold">{formatCurrency(lead.estimatedValue)}</span>
              </div>
              <Separator className="bg-border" />
              <p className="text-sm text-muted-foreground leading-relaxed">{lead.description}</p>
            </div>
          </Section>

          {/* Contact */}
          <Section title="Contato" icon={User}>
            <div className="orbit-card p-4 space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2"><Mail className="h-3.5 w-3.5" />Email</span>
                <span className="text-foreground font-medium">{lead.email}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2"><Phone className="h-3.5 w-3.5" />Telefone</span>
                <span className="text-foreground font-medium">{lead.phone}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2"><Calendar className="h-3.5 w-3.5" />Última interação</span>
                <span className="text-foreground font-medium">{lead.lastInteraction}</span>
              </div>
            </div>
          </Section>

          {/* History */}
          <Section title="Histórico" icon={Clock}>
            <div className="space-y-0">
              {lead.history.map((h, i) => (
                <div key={i} className="flex gap-3 pb-4 last:pb-0">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    {i < lead.history.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                  </div>
                  <div className="pb-1">
                    <p className="text-xs text-muted-foreground">{h.date}</p>
                    <p className="text-sm text-foreground">{h.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Notes */}
          <Section title="Observações" icon={StickyNote}>
            <div className="orbit-card p-4">
              <p className="text-sm text-muted-foreground leading-relaxed">{lead.notes}</p>
            </div>
            <div className="flex gap-2">
              <Textarea
                placeholder="Adicionar nota..."
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                className="bg-muted/50 border-border min-h-[60px] text-sm"
              />
            </div>
            {noteText && (
              <Button size="sm" variant="outline" className="mt-2" onClick={() => setNoteText("")}>
                Salvar nota
              </Button>
            )}
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CRM;
