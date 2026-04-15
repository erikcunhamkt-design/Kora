import { useState, useCallback, useEffect } from "react";
import { usePlan } from "@/contexts/PlanContext";
import { UsageBadge } from "@/components/plan/UsageBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Search, TrendingUp, DollarSign, CheckCircle2, BarChart3,
  Phone, Mail, Globe, Clock, MoreHorizontal, ChevronRight, ChevronLeft,
  User, Briefcase, Calendar, MessageCircle, StickyNote, X as XIcon,
  ArrowRight, XCircle, GripVertical, AlertCircle
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

// ---------- Types ----------
type Priority = "alta" | "média" | "baixa";
type StageKey = "lead" | "contato" | "proposta" | "negociacao" | "fechado" | "perdido";

interface Lead {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  serviceType: string;
  estimatedValue: number;
  priority: Priority;
  lastInteraction: string;
  stage: StageKey;
  description: string;
  history: { date: string; text: string }[];
  notes: string;
}

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

// ---------- Mock Data ----------
const initialLeads: Lead[] = [
  {
    id: 1, name: "Marina Costa", company: "Acme Corp", email: "marina@acme.com",
    phone: "(11) 99812-3456", serviceType: "Branding", estimatedValue: 8500,
    priority: "alta", lastInteraction: "12 Abr 2025", stage: "negociacao",
    description: "Rebranding completo incluindo logo, paleta e guidelines.",
    notes: "Prefere reuniões às terças.",
    history: [
      { date: "12 Abr", text: "Reunião de alinhamento sobre guidelines" },
      { date: "08 Abr", text: "Apresentação da proposta de rebranding" },
      { date: "02 Abr", text: "Primeiro contato via email" },
    ],
  },
  {
    id: 2, name: "Rafael Mendes", company: "Studio Zen", email: "rafael@studiozen.com",
    phone: "(21) 98765-4321", serviceType: "Web Design", estimatedValue: 12000,
    priority: "alta", lastInteraction: "10 Abr 2025", stage: "proposta",
    description: "Redesign completo do website institucional com e-commerce.",
    notes: "Deadline apertado — precisa entregar até maio.",
    history: [
      { date: "10 Abr", text: "Proposta enviada via email" },
      { date: "06 Abr", text: "Briefing detalhado recebido" },
      { date: "01 Abr", text: "Indicação do cliente Fernanda Lima" },
    ],
  },
  {
    id: 3, name: "Camila Andrade", company: "Nova Design", email: "camila@novadesign.com",
    phone: "(31) 97654-3210", serviceType: "Design Gráfico", estimatedValue: 4500,
    priority: "média", lastInteraction: "08 Abr 2025", stage: "proposta",
    description: "Catálogo digital de produtos para distribuição B2B.",
    notes: "Aguardando aprovação do diretor financeiro.",
    history: [
      { date: "08 Abr", text: "Proposta de catálogo digital enviada" },
      { date: "03 Abr", text: "Reunião online para entender o escopo" },
    ],
  },
  {
    id: 4, name: "Lucas Ferreira", company: "Tech Solutions", email: "lucas@techsol.com",
    phone: "(41) 96543-2109", serviceType: "Branding", estimatedValue: 3500,
    priority: "baixa", lastInteraction: "05 Abr 2025", stage: "lead",
    description: "Identidade visual para startup de tecnologia.",
    notes: "Contato feito via LinkedIn.",
    history: [
      { date: "05 Abr", text: "Primeiro contato via LinkedIn" },
    ],
  },
  {
    id: 5, name: "Juliana Rocha", company: "Brand Co", email: "juliana@brandco.com",
    phone: "(51) 95432-1098", serviceType: "Social Media", estimatedValue: 15000,
    priority: "alta", lastInteraction: "14 Abr 2025", stage: "fechado",
    description: "Pacote anual de gestão de redes sociais com criação de conteúdo.",
    notes: "Contrato assinado. Início em maio.",
    history: [
      { date: "14 Abr", text: "Contrato assinado ✓" },
      { date: "10 Abr", text: "Última rodada de negociação" },
      { date: "05 Abr", text: "Proposta ajustada conforme feedback" },
      { date: "28 Mar", text: "Primeira proposta enviada" },
    ],
  },
  {
    id: 6, name: "Diego Martins", company: "StartUp X", email: "diego@startupx.io",
    phone: "(11) 94321-0987", serviceType: "Web Design", estimatedValue: 2800,
    priority: "baixa", lastInteraction: "11 Abr 2025", stage: "contato",
    description: "Landing page para produto MVP.",
    notes: "Budget limitado. Avaliar pacote simplificado.",
    history: [
      { date: "11 Abr", text: "Call de 30min para entender necessidades" },
      { date: "07 Abr", text: "Respondeu formulário de contato no site" },
    ],
  },
  {
    id: 7, name: "Fernanda Lima", company: "FitTrack", email: "fernanda@fittrack.app",
    phone: "(21) 93210-9876", serviceType: "Design Gráfico", estimatedValue: 6000,
    priority: "média", lastInteraction: "13 Abr 2025", stage: "negociacao",
    description: "UI Kit e design system para o aplicativo FitTrack.",
    notes: "Contrato mensal de design de interfaces.",
    history: [
      { date: "13 Abr", text: "Negociação de escopo e timeline" },
      { date: "09 Abr", text: "Proposta apresentada em call" },
      { date: "04 Abr", text: "Briefing recebido" },
    ],
  },
  {
    id: 8, name: "André Souza", company: "Café & Arte", email: "andre@cafearte.com.br",
    phone: "(85) 92109-8765", serviceType: "Branding", estimatedValue: 5200,
    priority: "média", lastInteraction: "09 Abr 2025", stage: "fechado",
    description: "Identidade visual completa para cafeteria artesanal.",
    notes: "Projeto entregue. Avaliar pacote mensal de social media.",
    history: [
      { date: "09 Abr", text: "Projeto entregue com sucesso ✓" },
      { date: "01 Abr", text: "Revisão final aprovada" },
      { date: "20 Mar", text: "Primeira versão apresentada" },
    ],
  },
  {
    id: 9, name: "Patrícia Oliveira", company: "EcoVerde", email: "patricia@ecoverde.com.br",
    phone: "(62) 91098-7654", serviceType: "Social Media", estimatedValue: 3200,
    priority: "baixa", lastInteraction: "02 Abr 2025", stage: "perdido",
    description: "Gestão de redes sociais para marca sustentável.",
    notes: "Perdido por budget. Recontatar em 3 meses.",
    history: [
      { date: "02 Abr", text: "Cliente informou que não vai prosseguir" },
      { date: "28 Mar", text: "Proposta enviada" },
      { date: "22 Mar", text: "Primeiro contato" },
    ],
  },
  {
    id: 10, name: "Marcos Almeida", company: "PixelLab", email: "marcos@pixellab.design",
    phone: "(11) 90987-6543", serviceType: "Web Design", estimatedValue: 9500,
    priority: "alta", lastInteraction: "14 Abr 2025", stage: "lead",
    description: "Portal de cursos online com área de membros.",
    notes: "Grande potencial. Marcar call esta semana.",
    history: [
      { date: "14 Abr", text: "Recebeu indicação, enviou mensagem no WhatsApp" },
    ],
  },
  {
    id: 11, name: "Isabela Santos", company: "Moda Viva", email: "isabela@modaviva.com",
    phone: "(31) 99876-5432", serviceType: "Branding", estimatedValue: 7000,
    priority: "média", lastInteraction: "11 Abr 2025", stage: "contato",
    description: "Rebranding de marca de moda feminina.",
    notes: "Muito interessada, mas precisa aprovar com sócia.",
    history: [
      { date: "11 Abr", text: "Apresentação do portfólio por videochamada" },
      { date: "08 Abr", text: "Primeiro contato via Instagram" },
    ],
  },
];

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
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<number | null>(null);

  const filtered = leads.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q || l.name.toLowerCase().includes(q) || l.company.toLowerCase().includes(q);
    const matchStage = filterStage === "all" || l.stage === filterStage;
    const matchType = filterType === "all" || l.serviceType === filterType;
    return matchSearch && matchStage && matchType;
  });

  const moveLead = useCallback((id: number, newStage: StageKey) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, stage: newStage } : l));
    setSelectedLead(prev => prev?.id === id ? { ...prev, stage: newStage } : prev);
  }, []);

  const totalPipeline = leads.filter(l => !["fechado", "perdido"].includes(l.stage)).reduce((s, l) => s + l.estimatedValue, 0);
  const totalNegociacao = leads.filter(l => l.stage === "negociacao").reduce((s, l) => s + l.estimatedValue, 0);
  const fechadosMes = leads.filter(l => l.stage === "fechado").length;
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">CRM</h1>
          <p className="text-muted-foreground text-sm mt-1">Acompanhe seus leads e oportunidades de negócio</p>
        </div>
        <Button onClick={() => setNewLeadOpen(true)} className="orbit-gradient text-white border-0 gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Novo lead
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={TrendingUp} label="Total em pipeline" value={formatCurrency(totalPipeline)} />
        <SummaryCard icon={DollarSign} label="Em negociação" value={formatCurrency(totalNegociacao)} />
        <SummaryCard icon={CheckCircle2} label="Fechados no mês" value={String(fechadosMes)} sub={formatCurrency(leads.filter(l => l.stage === "fechado").reduce((s, l) => s + l.estimatedValue, 0))} />
        <SummaryCard icon={BarChart3} label="Taxa de conversão" value={`${taxaConversao}%`} />
      </div>

      {/* Filters */}
      <div className="orbit-card p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou empresa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-muted/50 border-border" />
        </div>
        <Select value={filterStage} onValueChange={setFilterStage}>
          <SelectTrigger className="w-[170px] bg-muted/50 border-border"><SelectValue placeholder="Etapa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as etapas</SelectItem>
            {stageConfigs.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[170px] bg-muted/50 border-border"><SelectValue placeholder="Serviço" /></SelectTrigger>
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
      <NewLeadDialog open={newLeadOpen} onOpenChange={setNewLeadOpen} />

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
const NewLeadDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Novo lead</DialogTitle>
          <DialogDescription className="text-muted-foreground">Adicione um novo lead ao seu pipeline.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Nome completo</Label>
            <Input placeholder="João Silva" className="bg-muted/50 border-border" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Empresa</Label>
            <Input placeholder="Empresa Ltda" className="bg-muted/50 border-border" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Email</Label>
            <Input type="email" placeholder="email@empresa.com" className="bg-muted/50 border-border" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Telefone</Label>
            <Input placeholder="(11) 99999-9999" className="bg-muted/50 border-border" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Tipo de serviço</Label>
            <Select>
              <SelectTrigger className="bg-muted/50 border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {serviceTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Valor estimado</Label>
            <Input type="number" placeholder="5000" className="bg-muted/50 border-border" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Prioridade</Label>
            <Select>
              <SelectTrigger className="bg-muted/50 border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="média">Média</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Etapa</Label>
            <Select>
              <SelectTrigger className="bg-muted/50 border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {stageConfigs.slice(0, -1).map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label className="text-sm text-muted-foreground">Descrição do projeto</Label>
            <Textarea placeholder="Descreva o projeto..." className="bg-muted/50 border-border min-h-[80px]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="orbit-gradient text-white border-0" onClick={() => onOpenChange(false)}>Adicionar lead</Button>
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
