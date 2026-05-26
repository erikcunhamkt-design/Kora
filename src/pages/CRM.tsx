import { PageHeader } from "@/components/layout/PageHeader";
import { useEffect, useMemo, useState } from "react";
import { usePlan } from "@/contexts/PlanContext";
import { UsageBadge } from "@/components/plan/UsageBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useLeads, type Lead, type Priority, type StageKey, type LeadTemperature, getLeadTemperature } from "@/hooks/useLeads";
import { usePipelines, type Pipeline, type PipelineStage } from "@/hooks/usePipelines";
import { usePipelineAutomations } from "@/hooks/usePipelineAutomations";
import {
  Plus, Search, TrendingUp, DollarSign, CheckCircle2, BarChart3,
  Phone, Mail, Clock, MoreHorizontal, User, Briefcase, Calendar,
  StickyNote, X as XIcon, ArrowRight, XCircle, GripVertical, Sparkles,
  Flame, LayoutGrid, List, Settings2, Zap, FileSpreadsheet, MessageCircle,
  Archive, Trash2, Tag as TagIcon, ChevronDown, FileText,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent,
  DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { PipelineEditorDialog } from "@/components/crm/PipelineEditorDialog";
import { PipelineAutomationsDialog } from "@/components/crm/PipelineAutomationsDialog";
import { ComingSoonDialog } from "@/components/crm/ComingSoonDialog";
import { ScheduleMeetingDialog } from "@/components/crm/ScheduleMeetingDialog";
import { EditTagsDialog } from "@/components/crm/EditTagsDialog";
import { MoveToPipelineDialog } from "@/components/crm/MoveToPipelineDialog";
import { useClients, type Client } from "@/hooks/useClients";
import { useClientTypes } from "@/hooks/useClientTypes";
import { NewClientTypeDialog } from "@/components/clientes/NewClientTypeDialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useNavigate, useSearchParams } from "react-router-dom";

const priorityStyles: Record<Priority, string> = {
  alta: "bg-destructive/10 text-destructive border-destructive/20",
  média: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  baixa: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const temperatureStyles: Record<LeadTemperature, string> = {
  quente: "bg-primary/10 text-primary border-primary/25",
  morno: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  frio: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  "não definida": "bg-muted text-muted-foreground/80 border-border/60",
};

// Quantos dias considera "parado" (sem interação)
const STALE_DAYS = 14;

const parseDateBR = (s?: string): Date | null => {
  if (!s) return null;
  // tenta ISO primeiro
  const iso = new Date(s);
  if (!isNaN(iso.getTime())) return iso;
  // "12 Abr 2025"
  const months: Record<string, number> = { jan:0,fev:1,mar:2,abr:3,mai:4,jun:5,jul:6,ago:7,set:8,out:9,nov:10,dez:11 };
  const m = s.toLowerCase().match(/(\d{1,2})\s+([a-zç]{3,})\s+(\d{4})/);
  if (m) {
    const mo = months[m[2].slice(0, 3) as string];
    if (mo !== undefined) return new Date(Number(m[3]), mo, Number(m[1]));
  }
  return null;
};

const daysSince = (s?: string): number | null => {
  const d = parseDateBR(s);
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
};

const NEW_TYPE_VALUE = "__new_type__";
const origins = ["Indicação", "Instagram", "LinkedIn", "Site", "WhatsApp", "Outro"];

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });

const SummaryCard = ({ icon: Icon, label, value, sub, accent }: { icon: any; label: string; value: string; sub?: string; accent?: "primary" | "success" | "danger" | "muted" }) => {
  const tone =
    accent === "success" ? "text-emerald-400 bg-emerald-500/10"
    : accent === "danger" ? "text-destructive bg-destructive/10"
    : accent === "muted" ? "text-muted-foreground bg-muted/60"
    : "text-primary bg-primary/10";
  return (
    <div className="orbit-card px-3.5 py-2.5 flex items-center gap-3 min-h-0">
      <div className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 ${tone}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground/80 truncate leading-tight">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <p className="text-base font-bold text-foreground leading-tight truncate">{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
        </div>
      </div>
    </div>
  );
};

const CRM = () => {
  const {
    leads, addLead, moveLead, moveLeadToStage, moveLeadToPipeline,
    updateLead, archiveLead, deleteLead, setLeadTags, markConverted,
  } = useLeads();
  const {
    pipelines, activePipeline, activePipelineId, setActivePipelineId,
    addPipeline, updatePipeline, deletePipeline,
  } = usePipelines();
  const { getRulesForPipeline } = usePipelineAutomations();
  const { addClient, clients } = useClients();
  const { activeTypes } = useClientTypes();
  const { wouldExceed, showPaywall, setUsage } = usePlan();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [newTypeOpen, setNewTypeOpen] = useState(false);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("all");
  const [filterOrigin, setFilterOrigin] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterTemperature, setFilterTemperature] = useState<"all" | LeadTemperature>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [newLeadInitial, setNewLeadInitial] = useState<Partial<Lead> | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);

  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null);
  const [pipelineEditorOpen, setPipelineEditorOpen] = useState(false);
  const [automationsOpen, setAutomationsOpen] = useState(false);

  const [comingSoon, setComingSoon] = useState<null | {
    title: string; description: string; bullets?: string[];
  }>(null);

  const [tagsLeadId, setTagsLeadId] = useState<number | null>(null);
  const [scheduleLeadId, setScheduleLeadId] = useState<number | null>(null);
  const [movePipelineLeadId, setMovePipelineLeadId] = useState<number | null>(null);

  // ----- Deep link: ?newOpportunity=1&clientId=X -----
  useEffect(() => {
    if (searchParams.get("newOpportunity") !== "1") return;
    const cid = Number(searchParams.get("clientId"));
    const client = clients.find((c) => c.id === cid);
    if (client) {
      const tempMap: Record<string, LeadTemperature> = { Quente: "quente", Morno: "morno", Frio: "frio" };
      setNewLeadInitial({
        clientId: client.id,
        name: client.name,
        company: client.company,
        email: client.email,
        phone: client.whatsapp || client.phone,
        estimatedValue: client.potentialValue || 0,
        temperature: (client.temperature && tempMap[client.temperature]) || "não definida",
        nextAction: client.nextAction,
        nextActionDate: client.nextActionDate,
        serviceType: client.serviceType,
        origin: client.origin,
      });
    } else {
      setNewLeadInitial(null);
    }
    setNewLeadOpen(true);
    // limpa params para não reabrir em refresh
    const next = new URLSearchParams(searchParams);
    next.delete("newOpportunity");
    next.delete("clientId");
    setSearchParams(next, { replace: true });
  }, [searchParams, clients, setSearchParams]);

  // ----- Deep link: ?lead=<id> abre o drawer da oportunidade -----
  useEffect(() => {
    const raw = searchParams.get("lead");
    if (!raw) return;
    const id = Number(raw);
    if (!Number.isFinite(id)) return;
    const lead = leads.find((l) => l.id === id);
    if (lead) setSelectedLead(lead);
    // não limpamos aqui — o param é limpo no onClose do drawer
  }, [searchParams, leads]);

  const clearLeadParam = () => {
    if (!searchParams.get("lead")) return;
    const next = new URLSearchParams(searchParams);
    next.delete("lead");
    setSearchParams(next, { replace: true });
  };

  // Sort stages of active pipeline
  const stages = useMemo(
    () => (activePipeline ? [...activePipeline.stages].sort((a, b) => a.order - b.order) : []),
    [activePipeline]
  );

  // Active pipeline leads
  const pipelineLeads = useMemo(
    () => leads.filter((l) => (l.pipelineId || "default") === activePipelineId && (showArchived || !l.archived)),
    [leads, activePipelineId, showArchived]
  );

  const realActiveLeads = leads.filter(
    (l) => !l.isDemo && !l.archived && !["fechado", "perdido"].includes(l.stage)
  ).length;
  useEffect(() => { setUsage("leads", realActiveLeads); }, [realActiveLeads, setUsage]);

  // Keep selectedLead in sync after moves
  useEffect(() => {
    if (selectedLead) {
      const fresh = leads.find((l) => l.id === selectedLead.id);
      if (fresh) setSelectedLead(fresh);
    }
    // eslint-disable-next-line
  }, [leads]);

  const handleNewLead = () => {
    if (wouldExceed("maxLeads", realActiveLeads)) {
      showPaywall("leads");
      return;
    }
    setNewLeadInitial(null);
    setNewLeadOpen(true);
  };

  // Filtering
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return pipelineLeads.filter((l) => {
      const matchSearch =
        !q ||
        l.name.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.phone.toLowerCase().includes(q);
      const matchStage = filterStage === "all" || l.stageId === filterStage;
      const matchOrigin = filterOrigin === "all" || (l.origin || l.source) === filterOrigin;
      const matchType = filterType === "all" || l.serviceType === filterType;
      const matchTemp = filterTemperature === "all" || getLeadTemperature(l) === filterTemperature;
      return matchSearch && matchStage && matchOrigin && matchType && matchTemp;
    });
  }, [pipelineLeads, search, filterStage, filterOrigin, filterType, filterTemperature]);

  // ---------- KPIs ----------
  const openLeads = pipelineLeads.filter((l) => {
    const stage = stages.find((s) => s.id === l.stageId);
    return stage?.type !== "won" && stage?.type !== "lost";
  });
  const totalPipeline = openLeads.reduce((s, l) => s + l.estimatedValue, 0);
  const wonCount = pipelineLeads.filter((l) => stages.find((s) => s.id === l.stageId)?.type === "won").length;
  const wonValue = pipelineLeads.filter((l) => stages.find((s) => s.id === l.stageId)?.type === "won").reduce((s, l) => s + l.estimatedValue, 0);
  const totalActive = pipelineLeads.filter((l) => stages.find((s) => s.id === l.stageId)?.type !== "lost").length;
  const conversion = totalActive > 0 ? Math.round((wonCount / totalActive) * 100) : 0;

  // Follow-ups pendentes: aberto e (sem próxima ação ou data passou)
  const today = new Date(); today.setHours(0,0,0,0);
  const followupsPending = openLeads.filter((l) => {
    if (!l.nextAction) return true;
    if (l.nextActionDate) {
      const d = new Date(l.nextActionDate);
      if (!isNaN(d.getTime()) && d < today) return true;
    }
    return false;
  }).length;

  const leadCountByStage = useMemo(() => {
    const map: Record<string, number> = {};
    pipelineLeads.forEach((l) => {
      if (l.stageId) map[l.stageId] = (map[l.stageId] || 0) + 1;
    });
    return map;
  }, [pipelineLeads]);

  // --- Automations runner ---
  const runAutomations = (leadId: number, stage: PipelineStage) => {
    const rules = getRulesForPipeline(activePipelineId).filter(
      (r) => r.enabled && r.triggerStageId === stage.id
    );
    rules.forEach((r) => {
      const lead = leads.find((l) => l.id === leadId);
      if (r.actions.addTag) {
        const current = lead?.tags || [];
        if (!current.includes(r.actions.addTag)) {
          setLeadTags(leadId, [...current, r.actions.addTag]);
        }
      }
      if (r.actions.setNextAction) {
        updateLead(leadId, { nextAction: r.actions.setNextAction });
      }
      if (r.actions.toast) {
        toast.success(r.actions.toast);
      }
    });
  };

  // --- Move lead handler ---
  const handleMoveToStage = (leadId: number, stage: PipelineStage) => {
    moveLeadToStage(leadId, stage.id, stage.type);
    runAutomations(leadId, stage);
    if (stage.type === "won") toast.success("Lead marcado como ganho 🎉");
    else if (stage.type === "lost") toast("Lead marcado como perdido");
  };

  // --- Drag handlers ---
  const handleDragStart = (id: number) => setDraggedId(id);
  const handleDragEnd = () => setDraggedId(null);
  const handleDrop = (stage: PipelineStage) => {
    if (draggedId !== null) {
      handleMoveToStage(draggedId, stage);
      setDraggedId(null);
    }
  };

  // --- Pipeline editor handlers ---
  const handleSavePipeline = (data: any) => {
    if (data.id) {
      updatePipeline(data.id, { name: data.name, stages: data.stages });
    } else {
      const created = addPipeline({ name: data.name, stages: data.stages });
      setActivePipelineId(created.id);
    }
  };

  const handleConvertToClient = (lead: Lead) => {
    try {
      addClient({
        name: lead.name,
        company: lead.company,
        email: lead.email,
        phone: lead.phone,
        whatsapp: lead.phone,
        instagram: "",
        site: "",
        serviceType: lead.serviceType,
        origin: lead.origin,
        status: "Ativo",
        potentialValue: lead.estimatedValue,
        observations: lead.notes || lead.description,
      });
      markConverted(lead.id);
      toast.success("Cliente criado a partir do lead");
    } catch {
      markConverted(lead.id);
      toast.success("Lead marcado como convertido");
    }
  };

  const tagsLead = leads.find((l) => l.id === tagsLeadId) || null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM"
        subtitle="Acompanhe oportunidades, negociações e próximas ações comerciais."
        actions={
          <>
            <UsageBadge resource="leads" label="oportunidades" />
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 shrink-0"
              onClick={() => { setEditingPipeline(activePipeline); setPipelineEditorOpen(true); }}
            >
              <Settings2 className="h-4 w-4" /> <span className="hidden sm:inline">Gerenciar funis</span>
            </Button>
            <Button size="sm" onClick={handleNewLead} className="orbit-gradient text-white border-0 gap-1.5 shrink-0">
              <Plus className="h-4 w-4" /> Nova oportunidade
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5 shrink-0 text-muted-foreground hover:text-foreground">
                  <span className="hidden sm:inline">Mais ações</span>
                  <MoreHorizontal className="h-4 w-4 sm:hidden" />
                  <ChevronDown className="h-3.5 w-3.5 hidden sm:inline" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border w-56">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground/70">Ações</DropdownMenuLabel>
                <DropdownMenuItem onClick={handleNewLead}>
                  <Plus className="h-4 w-4 mr-2" /> Nova negociação
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setEditingPipeline(null); setPipelineEditorOpen(true); }}>
                  <Settings2 className="h-4 w-4 mr-2" /> Novo pipeline
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground/70">Em breve</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setComingSoon({
                  title: "Importar planilha",
                  description: "Importação em lote de leads a partir de arquivos CSV ou XLSX.",
                  bullets: ["Mapeamento de colunas", "Detecção de duplicados", "Importação para pipeline específico"],
                })} className="text-muted-foreground focus:text-foreground">
                  <FileSpreadsheet className="h-4 w-4 mr-2 opacity-70" /> Importar planilha
                  <Badge variant="outline" className="ml-auto text-[9px] border-border text-muted-foreground">soon</Badge>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setComingSoon({
                  title: "Captura por formulário",
                  description: "Crie formulários públicos que geram leads automaticamente no seu pipeline.",
                  bullets: ["Link público compartilhável", "Campos personalizáveis", "Atribuição automática de pipeline e etapa"],
                })} className="text-muted-foreground focus:text-foreground">
                  <Sparkles className="h-4 w-4 mr-2 opacity-70" /> Captura por formulário
                  <Badge variant="outline" className="ml-auto text-[9px] border-border text-muted-foreground">soon</Badge>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setComingSoon({
                  title: "Auto-lead WhatsApp",
                  description: "Receba mensagens no WhatsApp e crie leads automaticamente no CRM.",
                  bullets: ["Conexão com WhatsApp Business", "Captura de nome e telefone", "Tag automática 'whatsapp'"],
                })} className="text-muted-foreground focus:text-foreground">
                  <MessageCircle className="h-4 w-4 mr-2 opacity-70" /> Auto-lead WhatsApp
                  <Badge variant="outline" className="ml-auto text-[9px] border-border text-muted-foreground">soon</Badge>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {/* KPIs — foco em oportunidades abertas, valor e follow-ups */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <SummaryCard icon={TrendingUp} label="Oportunidades abertas" value={String(openLeads.length)} accent="primary" />
        <SummaryCard icon={DollarSign} label="Valor no funil" value={formatCurrency(totalPipeline)} accent="primary" />
        <SummaryCard
          icon={Clock}
          label="Follow-ups pendentes"
          value={String(followupsPending)}
          sub={followupsPending > 0 ? "definir próximo passo" : "tudo em dia"}
          accent={followupsPending > 0 ? "danger" : "muted"}
        />
        <SummaryCard icon={BarChart3} label="Conversão" value={`${conversion}%`} accent="muted" />
        <SummaryCard icon={CheckCircle2} label="Ganhas no período" value={String(wonCount)} sub={wonValue > 0 ? formatCurrency(wonValue) : undefined} accent="success" />
      </div>

      {/* Premium toolbar: pipeline + view + filters */}
      <div className="orbit-card p-2.5 sm:p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2 bg-muted/40 border-border rounded-full pl-2.5 pr-2.5 h-8">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="font-semibold text-foreground text-[13px]">{activePipeline?.name || "—"}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-card border-border w-56">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground/70">Pipelines</DropdownMenuLabel>
                {pipelines.map((p) => (
                  <DropdownMenuItem key={p.id} onClick={() => setActivePipelineId(p.id)}>
                    <div className="h-2 w-2 rounded-full bg-primary mr-2" />
                    <span className="flex-1">{p.name}</span>
                    {p.isDefault && <Badge variant="outline" className="text-[9px]">padrão</Badge>}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setEditingPipeline(null); setPipelineEditorOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" /> Novo pipeline
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {activePipeline && (
              <>
                <Separator orientation="vertical" className="h-5 mx-0.5 bg-border hidden sm:block" />
                <Button size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground hover:text-foreground gap-1.5"
                  onClick={() => { setEditingPipeline(activePipeline); setPipelineEditorOpen(true); }}>
                  <Settings2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Editar</span>
                </Button>
                <Button size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground hover:text-foreground gap-1.5"
                  onClick={() => setAutomationsOpen(true)}>
                  <Zap className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Automações</span>
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              className={`h-8 px-2 gap-1.5 ${showArchived ? "text-foreground bg-muted" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setShowArchived((v) => !v)}
            >
              <Archive className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{showArchived ? "Ocultar arquivados" : "Arquivados"}</span>
            </Button>
            <Tabs value={view} onValueChange={(v) => setView(v as any)}>
              <TabsList className="bg-muted/50 border border-border h-8 p-0.5">
                <TabsTrigger value="kanban" className="gap-1.5 h-7 px-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
                  <LayoutGrid className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Kanban</span>
                </TabsTrigger>
                <TabsTrigger value="list" className="gap-1.5 h-7 px-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
                  <List className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Lista</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <Separator className="bg-border/60" />

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar nome, empresa, e-mail ou telefone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 bg-muted/40 border-border text-[13px]"
            />
          </div>
          <Select value={filterStage} onValueChange={setFilterStage}>
            <SelectTrigger className="w-[140px] h-8 bg-muted/40 border-border text-[13px]"><SelectValue placeholder="Etapas" /></SelectTrigger>
            <SelectContent className="max-h-[280px]">
              <SelectItem value="all">Etapas</SelectItem>
              {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterTemperature} onValueChange={(v) => setFilterTemperature(v as any)}>
            <SelectTrigger className="w-[150px] h-8 bg-muted/40 border-border text-[13px]"><SelectValue placeholder="Temperatura" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Temperaturas</SelectItem>
              <SelectItem value="quente">Quente</SelectItem>
              <SelectItem value="morno">Morno</SelectItem>
              <SelectItem value="frio">Frio</SelectItem>
              <SelectItem value="não definida">Não definida</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterOrigin} onValueChange={setFilterOrigin}>
            <SelectTrigger className="w-[140px] h-8 bg-muted/40 border-border text-[13px]"><SelectValue placeholder="Origens" /></SelectTrigger>
            <SelectContent className="max-h-[280px]">
              <SelectItem value="all">Origens</SelectItem>
              {origins.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select
            value={filterType}
            onValueChange={(v) => {
              if (v === NEW_TYPE_VALUE) { setNewTypeOpen(true); return; }
              setFilterType(v);
            }}
          >
            <SelectTrigger className="w-[150px] h-8 bg-muted/40 border-border text-[13px]"><SelectValue placeholder="Tipos" /></SelectTrigger>
            <SelectContent className="max-h-[280px]">
              <SelectItem value="all">Tipos</SelectItem>
              {activeTypes.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
              <div className="my-1 h-px bg-border" />
              <SelectItem value={NEW_TYPE_VALUE} className="text-primary">+ Novo tipo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* View */}
      {leads.filter((l) => !l.archived).length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Seu pipeline ainda está vazio"
          description="Crie oportunidades para acompanhar negociações, propostas enviadas e próximos passos comerciais."
          primaryAction={{ label: "Criar oportunidade", onClick: handleNewLead }}
          secondaryAction={{ label: "Ver clientes", onClick: () => navigate("/clientes"), variant: "outline" }}
        />
      ) : view === "kanban" ? (
        <div className="w-full max-w-full overflow-x-auto overflow-y-visible pb-4">
          <div className="flex gap-4 pr-6 min-w-min">
          {stages.map((stage) => {
            const stageLeads = filtered.filter((l) => l.stageId === stage.id);
            const stageTotal = stageLeads.reduce((s, l) => s + l.estimatedValue, 0);
            return (
              <div
                key={stage.id}
                className="flex-shrink-0 w-[280px]"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(stage)}
              >
                <div className="mb-2.5 px-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: stage.color }} />
                      <h3 className="text-[13px] font-semibold text-foreground truncate uppercase tracking-wide">{stage.name}</h3>
                      {stage.type === "won" && <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-400 px-1.5 py-0">ganho</Badge>}
                      {stage.type === "lost" && <Badge variant="outline" className="text-[9px] border-destructive/40 text-destructive px-1.5 py-0">perdido</Badge>}
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md min-w-[22px] text-center">{stageLeads.length}</span>
                  </div>
                  {stageTotal > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-1 pl-4">{formatCurrency(stageTotal)}</p>
                  )}
                  <div className="mt-2 h-px w-full" style={{ background: `linear-gradient(to right, ${stage.color}55, transparent)` }} />
                </div>

                <div className="space-y-2 min-h-[120px]">
                  {stageLeads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      stages={stages}
                      pipelines={pipelines}
                      activePipelineId={activePipelineId}
                      dragged={draggedId === lead.id}
                      onDragStart={() => handleDragStart(lead.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => setSelectedLead(lead)}
                      onMoveToStage={(s) => handleMoveToStage(lead.id, s)}
                      onMovePipeline={() => setMovePipelineLeadId(lead.id)}
                      onEditTags={() => setTagsLeadId(lead.id)}
                      onSchedule={() => setScheduleLeadId(lead.id)}
                      onArchive={() => { archiveLead(lead.id, true); toast.success("Lead arquivado"); }}
                      onUnarchive={() => { archiveLead(lead.id, false); toast.success("Lead restaurado"); }}
                      onDelete={() => {
                        if (window.confirm("Excluir este lead?")) {
                          deleteLead(lead.id);
                          toast.success("Lead excluído");
                        }
                      }}
                      onConvert={() => handleConvertToClient(lead)}
                    />
                  ))}

                  {stageLeads.length === 0 && (
                    <div className="border border-dashed border-border/60 rounded-lg p-5 flex flex-col items-center justify-center text-center gap-1">
                      <p className="text-[11px] text-muted-foreground/70">Vazio</p>
                      <p className="text-[10px] text-muted-foreground/50">Arraste cards aqui</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      ) : (
        <div className="orbit-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Última int.</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">
                      Nenhum lead encontrado neste pipeline
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((lead) => {
                  const stage = stages.find((s) => s.id === lead.stageId);
                  return (
                    <TableRow key={lead.id} className="cursor-pointer" onClick={() => setSelectedLead(lead)}>
                      <TableCell>
                        <div className="font-medium text-foreground">{lead.name}</div>
                        <div className="text-xs text-muted-foreground">{lead.company}</div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div>{lead.email}</div>
                        <div>{lead.phone}</div>
                      </TableCell>
                      <TableCell className="text-xs">{lead.origin || lead.source || "—"}</TableCell>
                      <TableCell>
                        {stage && (
                          <Badge variant="outline" style={{ borderColor: stage.color + "55", color: stage.color }}>
                            {stage.name}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[160px]">
                          {(lead.tags || []).slice(0, 3).map((t) => (
                            <Badge key={t} variant="outline" className="text-[10px] bg-muted/50">{t}</Badge>
                          ))}
                          {(lead.tags?.length || 0) > 3 && <span className="text-[10px] text-muted-foreground">+{(lead.tags?.length || 0) - 3}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(lead.estimatedValue)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{lead.lastInteraction}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <LeadActionsMenu
                          lead={lead}
                          stages={stages}
                          onMoveToStage={(s) => handleMoveToStage(lead.id, s)}
                          onMovePipeline={() => setMovePipelineLeadId(lead.id)}
                          onEditTags={() => setTagsLeadId(lead.id)}
                          onSchedule={() => setScheduleLeadId(lead.id)}
                          onArchive={() => { archiveLead(lead.id, true); toast.success("Lead arquivado"); }}
                          onUnarchive={() => { archiveLead(lead.id, false); toast.success("Lead restaurado"); }}
                          onConvert={() => handleConvertToClient(lead)}
                          onDelete={() => {
                            if (window.confirm("Excluir este lead?")) {
                              deleteLead(lead.id);
                              toast.success("Lead excluído");
                            }
                          }}
                          onEdit={() => setSelectedLead(lead)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <NewLeadDialog
        open={newLeadOpen}
        onOpenChange={(v) => { setNewLeadOpen(v); if (!v) setNewLeadInitial(null); }}
        stages={stages}
        pipelineId={activePipelineId}
        initial={newLeadInitial}
        onSave={(data) => {
          addLead(data);
          toast.success(data.clientId ? "Oportunidade vinculada ao cliente" : "Oportunidade adicionada ao pipeline");
        }}
      />

      <LeadDetailSheet
        lead={selectedLead}
        stages={stages}
        onClose={() => { setSelectedLead(null); clearLeadParam(); }}
        onMoveToStage={(s) => selectedLead && handleMoveToStage(selectedLead.id, s)}
        onEditTags={() => selectedLead && setTagsLeadId(selectedLead.id)}
        onSchedule={() => selectedLead && setScheduleLeadId(selectedLead.id)}
        onUpdate={(patch) => selectedLead && updateLead(selectedLead.id, patch)}
        onOpenClient={(cid) => navigate(`/clientes?focus=${cid}`)}
        onCreateQuote={() => selectedLead && navigate(`/vendas?tab=orcamentos&newQuote=1&opportunityId=${selectedLead.id}`)}
        onOpenQuote={() => navigate(`/vendas?tab=orcamentos`)}
      />


      <PipelineEditorDialog
        open={pipelineEditorOpen}
        onOpenChange={setPipelineEditorOpen}
        pipeline={editingPipeline}
        onSave={handleSavePipeline}
        onDelete={(id) => deletePipeline(id)}
        leadCountByStage={leadCountByStage}
      />

      {activePipeline && (
        <PipelineAutomationsDialog
          open={automationsOpen}
          onOpenChange={setAutomationsOpen}
          pipeline={activePipeline}
        />
      )}

      <ComingSoonDialog
        open={!!comingSoon}
        onOpenChange={(v) => !v && setComingSoon(null)}
        title={comingSoon?.title || ""}
        description={comingSoon?.description || ""}
        bullets={comingSoon?.bullets}
      />

      <EditTagsDialog
        open={!!tagsLead}
        onOpenChange={(v) => !v && setTagsLeadId(null)}
        initialTags={tagsLead?.tags || []}
        onSave={(tags) => { if (tagsLead) setLeadTags(tagsLead.id, tags); toast.success("Tags atualizadas"); }}
      />

      <ScheduleMeetingDialog
        open={scheduleLeadId !== null}
        onOpenChange={(v) => !v && setScheduleLeadId(null)}
        onSave={(action) => { if (scheduleLeadId) updateLead(scheduleLeadId, { nextAction: action }); }}
      />

      {movePipelineLeadId !== null && (
        <MoveToPipelineDialog
          open={movePipelineLeadId !== null}
          onOpenChange={(v) => !v && setMovePipelineLeadId(null)}
          pipelines={pipelines}
          currentPipelineId={activePipelineId}
          onConfirm={(pid, sid) => {
            moveLeadToPipeline(movePipelineLeadId!, pid, sid);
            toast.success("Lead movido para outro pipeline");
          }}
        />
      )}

      <NewClientTypeDialog
        open={newTypeOpen}
        onOpenChange={setNewTypeOpen}
        onCreated={(name) => setFilterType(name)}
      />
    </div>
  );
};

// ---------- Lead Card ----------
const LeadCard = ({
  lead, stages, pipelines, activePipelineId, dragged,
  onDragStart, onDragEnd, onClick,
  onMoveToStage, onMovePipeline, onEditTags, onSchedule,
  onArchive, onUnarchive, onDelete, onConvert,
}: {
  lead: Lead;
  stages: PipelineStage[];
  pipelines: Pipeline[];
  activePipelineId: string;
  dragged: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
  onMoveToStage: (s: PipelineStage) => void;
  onMovePipeline: () => void;
  onEditTags: () => void;
  onSchedule: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  onConvert: () => void;
}) => {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`orbit-card p-3 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all duration-200 group ${
        dragged ? "opacity-50 scale-[0.97]" : ""
      } ${lead.archived ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-full bg-muted border border-border flex items-center justify-center text-[10px] font-semibold text-foreground shrink-0">
            {lead.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-foreground truncate leading-tight">{lead.name}</p>
            {lead.company && <p className="text-[11px] text-muted-foreground truncate leading-tight">{lead.company}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <LeadActionsMenu
            lead={lead}
            stages={stages}
            onMoveToStage={onMoveToStage}
            onMovePipeline={onMovePipeline}
            onEditTags={onEditTags}
            onSchedule={onSchedule}
            onArchive={onArchive}
            onUnarchive={onUnarchive}
            onConvert={onConvert}
            onDelete={onDelete}
            onEdit={onClick}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(lead.estimatedValue)}</span>
        {(() => {
          const t = getLeadTemperature(lead);
          return (
            <Badge variant="outline" className={`text-[9px] h-4 px-1.5 capitalize ${temperatureStyles[t]}`}>
              {t === "quente" ? <Flame className="h-2.5 w-2.5 mr-0.5" /> : null}
              {t}
            </Badge>
          );
        })()}
      </div>

      {(lead.serviceType || lead.origin) && (
        <div className="flex items-center gap-1 mb-2 flex-wrap">
          {lead.serviceType && lead.serviceType !== "—" && (
            <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-muted/40 border-border/60 text-muted-foreground font-normal">
              {lead.serviceType}
            </Badge>
          )}
          {lead.origin && (
            <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-muted/40 border-border/60 text-muted-foreground font-normal">
              {lead.origin}
            </Badge>
          )}
        </div>
      )}

      {lead.tags && lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {lead.tags.slice(0, 3).map((t) => (
            <span key={t} className="text-[9px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
              #{t}
            </span>
          ))}
          {lead.tags.length > 3 && (
            <span className="text-[9px] text-muted-foreground">+{lead.tags.length - 3}</span>
          )}
        </div>
      )}

      {lead.nextAction ? (
        <div className="text-[11px] text-muted-foreground/90 border-l-2 border-primary/40 pl-2 mb-2 line-clamp-2 italic">
          {lead.nextAction}
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onSchedule(); }}
          className="text-[11px] text-muted-foreground/80 hover:text-foreground border-l-2 border-border/60 pl-2 mb-2 italic block w-full text-left"
        >
          Definir follow-up
        </button>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-border/40">
        <span className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" /> {lead.lastInteraction}
        </span>
        {(() => {
          const d = daysSince(lead.lastInteraction);
          if (d !== null && d >= STALE_DAYS) {
            return (
              <span className="text-[10px] text-amber-400/80 flex items-center gap-1" title="Parada há muitos dias">
                <Clock className="h-2.5 w-2.5" /> {d}d parada
              </span>
            );
          }
          return null;
        })()}
      </div>
    </div>
  );
};

// ---------- Lead Actions Menu ----------
const LeadActionsMenu = ({
  lead, stages, onEdit, onMoveToStage, onMovePipeline, onEditTags, onSchedule,
  onArchive, onUnarchive, onConvert, onDelete,
}: {
  lead: Lead;
  stages: PipelineStage[];
  onEdit: () => void;
  onMoveToStage: (s: PipelineStage) => void;
  onMovePipeline: () => void;
  onEditTags: () => void;
  onSchedule: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onConvert: () => void;
  onDelete: () => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="bg-card border-border w-52">
      <DropdownMenuItem onClick={onEdit}>
        <User className="h-4 w-4 mr-2" /> Editar lead
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onEditTags}>
        <TagIcon className="h-4 w-4 mr-2" /> Editar tags
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onSchedule}>
        <Calendar className="h-4 w-4 mr-2" /> Agendar reunião
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <ArrowRight className="h-4 w-4 mr-2" /> Mover para etapa
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="bg-card border-border">
          {stages.map((s) => (
            <DropdownMenuItem key={s.id} disabled={s.id === lead.stageId} onClick={() => onMoveToStage(s)}>
              <div className="h-2 w-2 rounded-full mr-2" style={{ backgroundColor: s.color }} />
              {s.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuItem onClick={onMovePipeline}>
        <Settings2 className="h-4 w-4 mr-2" /> Mover para pipeline
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onConvert} disabled={lead.converted}>
        <CheckCircle2 className="h-4 w-4 mr-2" />
        {lead.converted ? "Já convertido" : "Converter em cliente"}
      </DropdownMenuItem>
      {lead.archived ? (
        <DropdownMenuItem onClick={onUnarchive}>
          <Archive className="h-4 w-4 mr-2" /> Restaurar
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem onClick={onArchive}>
          <Archive className="h-4 w-4 mr-2" /> Arquivar
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
        <Trash2 className="h-4 w-4 mr-2" /> Excluir lead
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

// ---------- New Opportunity Dialog ----------
const tempToPriority = (t: LeadTemperature): Priority =>
  t === "quente" ? "alta" : t === "frio" ? "baixa" : "média";

const NewLeadDialog = ({
  open, onOpenChange, onSave, stages, pipelineId, initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (data: any) => void;
  stages: PipelineStage[];
  pipelineId: string;
  initial?: Partial<Lead> | null;
}) => {
  const { activeTypes } = useClientTypes();
  const emptyForm = {
    name: "", company: "", email: "", phone: "", serviceType: "",
    origin: "", estimatedValue: "",
    temperature: "não definida" as LeadTemperature,
    stageId: stages[0]?.id || "", nextAction: "", nextActionDate: "", description: "",
    clientId: undefined as number | undefined,
  };
  const [form, setForm] = useState(emptyForm);
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const set = <K extends keyof typeof emptyForm>(k: K, v: any) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setForm({
      ...emptyForm,
      stageId: stages[0]?.id || "",
      ...(initial
        ? {
            name: initial.name || "",
            company: initial.company || "",
            email: initial.email || "",
            phone: initial.phone || "",
            serviceType: initial.serviceType && initial.serviceType !== "—" ? initial.serviceType : "",
            origin: initial.origin || "",
            estimatedValue: initial.estimatedValue ? String(initial.estimatedValue) : "",
            temperature: (initial.temperature as LeadTemperature) || "não definida",
            nextAction: initial.nextAction || "",
            nextActionDate: initial.nextActionDate || "",
            clientId: initial.clientId,
          }
        : {}),
    });
    // eslint-disable-next-line
  }, [open, initial]);

  const handleSave = () => {
    if (!form.name.trim()) return toast.error("Informe o nome da oportunidade ou do contato");
    if (!form.email.trim() && !form.phone.trim())
      return toast.error("Informe email ou WhatsApp/telefone");

    const known: StageKey[] = ["lead", "contato", "proposta", "negociacao", "fechado", "perdido"];
    const stageKey: StageKey = (known as string[]).includes(form.stageId)
      ? (form.stageId as StageKey)
      : "lead";

    onSave({
      name: form.name.trim(),
      company: form.company.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      serviceType: form.serviceType || "—",
      origin: form.origin || undefined,
      source: form.origin || undefined,
      estimatedValue: Number(form.estimatedValue) || 0,
      priority: tempToPriority(form.temperature),
      temperature: form.temperature,
      stage: stageKey,
      stageId: form.stageId,
      pipelineId,
      tags: [],
      nextAction: form.nextAction.trim() || undefined,
      nextActionDate: form.nextActionDate || undefined,
      description: form.description.trim(),
      clientId: form.clientId,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Nova oportunidade</DialogTitle>
          <DialogDescription>
            {form.clientId ? "Vinculada a um cliente existente." : "Adicione uma oportunidade ao pipeline ativo."}
          </DialogDescription>
        </DialogHeader>
        {form.clientId && (
          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-[12px] text-foreground flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-primary" /> Cliente vinculado: <span className="font-medium">{form.name}</span>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Nome / contato*</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} className="bg-muted/50 border-border" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Empresa</Label>
            <Input value={form.company} onChange={(e) => set("company", e.target.value)} className="bg-muted/50 border-border" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Email</Label>
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="bg-muted/50 border-border" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">WhatsApp / Telefone</Label>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} className="bg-muted/50 border-border" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Serviço</Label>
            <Select
              value={form.serviceType}
              onValueChange={(v) => {
                if (v === NEW_TYPE_VALUE) { setTypeDialogOpen(true); return; }
                set("serviceType", v);
              }}
            >
              <SelectTrigger className="bg-muted/50 border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent className="max-h-[280px]">
                {activeTypes.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                <div className="my-1 h-px bg-border" />
                <SelectItem value={NEW_TYPE_VALUE} className="text-primary">+ Novo tipo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Valor potencial (R$)</Label>
            <Input type="number" value={form.estimatedValue} onChange={(e) => set("estimatedValue", e.target.value)} className="bg-muted/50 border-border" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Origem</Label>
            <Select value={form.origin} onValueChange={(v) => set("origin", v)}>
              <SelectTrigger className="bg-muted/50 border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {origins.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Temperatura</Label>
            <Select value={form.temperature} onValueChange={(v) => set("temperature", v as LeadTemperature)}>
              <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="quente">Quente</SelectItem>
                <SelectItem value="morno">Morno</SelectItem>
                <SelectItem value="frio">Frio</SelectItem>
                <SelectItem value="não definida">Não definida</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Etapa inicial</Label>
            <Select value={form.stageId} onValueChange={(v) => set("stageId", v)}>
              <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Próxima ação</Label>
            <Input value={form.nextAction} onChange={(e) => set("nextAction", e.target.value)} className="bg-muted/50 border-border" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Data da próxima ação</Label>
            <Input type="date" value={form.nextActionDate} onChange={(e) => set("nextActionDate", e.target.value)} className="bg-muted/50 border-border" />
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label className="text-sm text-muted-foreground">Observações</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} className="bg-muted/50 border-border min-h-[80px]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="orbit-gradient text-white border-0" onClick={handleSave}>Criar oportunidade</Button>
        </DialogFooter>
        <NewClientTypeDialog
          open={typeDialogOpen}
          onOpenChange={setTypeDialogOpen}
          onCreated={(name) => set("serviceType", name)}
        />
      </DialogContent>
    </Dialog>
  );
};


// ---------- Lead Detail Sheet ----------
const LeadDetailSheet = ({
  lead, stages, onClose, onMoveToStage, onEditTags, onSchedule, onUpdate, onOpenClient,
  onCreateQuote, onOpenQuote,
}: {
  lead: Lead | null;
  stages: PipelineStage[];
  onClose: () => void;
  onMoveToStage: (s: PipelineStage) => void;
  onEditTags: () => void;
  onSchedule: () => void;
  onUpdate: (patch: Partial<Lead>) => void;
  onOpenClient?: (clientId: number) => void;
  onCreateQuote?: () => void;
  onOpenQuote?: () => void;
}) => {
  const [noteText, setNoteText] = useState("");
  if (!lead) return null;

  const stageConfig = stages.find((s) => s.id === lead.stageId);
  const currentIdx = stages.findIndex((s) => s.id === lead.stageId);
  const nextStage = currentIdx >= 0 && stageConfig?.type === "open"
    ? stages.slice(currentIdx + 1).find((s) => s.type !== "lost")
    : null;
  const wonStage = stages.find((s) => s.type === "won");
  const lostStage = stages.find((s) => s.type === "lost");
  const temperature = getLeadTemperature(lead);

  return (
    <Sheet open={!!lead} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="bg-card border-border w-full sm:max-w-[480px] overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-foreground text-xl flex items-center gap-3">
            <div className="h-10 w-10 rounded-full orbit-gradient flex items-center justify-center text-sm font-bold text-white shrink-0">
              {lead.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            {lead.name}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`capitalize ${temperatureStyles[temperature]}`}>{temperature}</Badge>
            {lead.company && <span className="text-muted-foreground">· {lead.company}</span>}
            {lead.clientId && onOpenClient && (
              <Button
                size="sm" variant="ghost"
                className="h-6 px-2 text-[11px] gap-1 text-primary hover:text-primary hover:bg-primary/10"
                onClick={() => onOpenClient(lead.clientId!)}
              >
                <User className="h-3 w-3" /> Ver cliente
              </Button>
            )}
          </SheetDescription>
        </SheetHeader>


        <div className="my-4">
          <div className="flex items-center gap-1">
            {stages.map((s, i) => (
              <div key={s.id} className="flex-1">
                <div
                  className="h-1.5 rounded-full transition-colors"
                  style={{ backgroundColor: i <= currentIdx ? s.color : "hsl(var(--muted))" }}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Etapa atual: <span className="text-foreground font-medium">{stageConfig?.name || "—"}</span>
          </p>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          {nextStage && (
            <Button size="sm" className="orbit-gradient text-white border-0 gap-1.5" onClick={() => onMoveToStage(nextStage)}>
              <ArrowRight className="h-3.5 w-3.5" /> Avançar para {nextStage.name}
            </Button>
          )}
          {wonStage && lead.stageId !== wonStage.id && (
            <Button size="sm" variant="outline" className="gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" onClick={() => onMoveToStage(wonStage)}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Ganho
            </Button>
          )}
          {lostStage && lead.stageId !== lostStage.id && (
            <Button size="sm" variant="outline" className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => onMoveToStage(lostStage)}>
              <XCircle className="h-3.5 w-3.5" /> Perdido
            </Button>
          )}
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onEditTags}>
            <TagIcon className="h-3.5 w-3.5" /> Tags
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onSchedule}>
            <Calendar className="h-3.5 w-3.5" /> Agendar
          </Button>
          {lead.quoteId ? (
            <Button size="sm" variant="outline" className="gap-1.5 text-primary border-primary/30 hover:bg-primary/10" onClick={onOpenQuote}>
              <FileText className="h-3.5 w-3.5" /> Ver orçamento
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onCreateQuote}>
              <FileText className="h-3.5 w-3.5" /> Criar orçamento
            </Button>
          )}
        </div>


        <div className="space-y-6 pb-6">
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
              {lead.nextAction && (
                <>
                  <Separator className="bg-border" />
                  <div>
                    <span className="text-xs text-muted-foreground">Próxima ação</span>
                    <p className="text-sm text-foreground mt-0.5">{lead.nextAction}</p>
                  </div>
                </>
              )}
              {lead.description && (
                <>
                  <Separator className="bg-border" />
                  <p className="text-sm text-muted-foreground leading-relaxed">{lead.description}</p>
                </>
              )}
            </div>
          </Section>

          {lead.tags && lead.tags.length > 0 && (
            <Section title="Tags" icon={TagIcon}>
              <div className="flex flex-wrap gap-1.5">
                {lead.tags.map((t) => (
                  <Badge key={t} variant="outline" className="bg-primary/10 border-primary/30">{t}</Badge>
                ))}
              </div>
            </Section>
          )}

          <Section title="Contato" icon={User}>
            <div className="orbit-card p-4 space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2"><Mail className="h-3.5 w-3.5" />Email</span>
                <span className="text-foreground font-medium truncate ml-2">{lead.email || "—"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2"><Phone className="h-3.5 w-3.5" />Telefone</span>
                <span className="text-foreground font-medium">{lead.phone || "—"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2"><Calendar className="h-3.5 w-3.5" />Última interação</span>
                <span className="text-foreground font-medium">{lead.lastInteraction}</span>
              </div>
            </div>
          </Section>

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

          <Section title="Observações" icon={StickyNote}>
            {lead.notes && (
              <div className="orbit-card p-4">
                <p className="text-sm text-muted-foreground leading-relaxed">{lead.notes}</p>
              </div>
            )}
            <Textarea
              placeholder="Adicionar nota..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="bg-muted/50 border-border min-h-[60px] text-sm"
            />
            {noteText && (
              <Button size="sm" variant="outline" className="mt-2" onClick={() => {
                onUpdate({ notes: (lead.notes ? lead.notes + "\n\n" : "") + noteText });
                setNoteText("");
                toast.success("Nota salva");
              }}>
                Salvar nota
              </Button>
            )}
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const Section = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
  <div className="space-y-3">
    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      {title}
    </h3>
    {children}
  </div>
);

export default CRM;
