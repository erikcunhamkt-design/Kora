import { useMemo, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Plus, Search, ChevronLeft, ChevronRight, Calendar as CalendarIcon, LayoutGrid,
  Sparkles, HelpCircle, MoreHorizontal, Users, ChevronDown, Eye, Trash2, Copy,
  Image as ImageIcon, Film, Heart, MessageCircle, Send, Bookmark, Play, Volume2,
  Music2, ThumbsUp, Share2, Globe, Mail, AtSign, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useContentItems,
  CONTENT_CHANNEL_LABEL, CONTENT_FORMAT_LABEL,
  CONTENT_STAGE_LABEL, CONTENT_STAGE_TONE,
  CONTENT_APPROVAL_LABEL, CONTENT_APPROVAL_TONE,
  type ContentItem, type ContentChannel, type ContentFormat,
  type ContentStage, type ContentApproval,
} from "@/hooks/useContentItems";
import { useClients } from "@/hooks/useClients";
import { toast } from "@/hooks/use-toast";

/* ------------------------------------------------------------------ */
/*  Constantes                                                        */
/* ------------------------------------------------------------------ */

const STAGES: ContentStage[] = ["planning", "copy", "design", "approval", "review", "approved", "publication"];
const ALL_CHANNELS = Object.keys(CONTENT_CHANNEL_LABEL) as ContentChannel[];
const FORMATS: ContentFormat[] = ["feed", "reel", "stories", "carousel", "tiktok", "youtube", "article", "email", "landing", "branding", "photo", "deck"];
const APPROVALS: ContentApproval[] = ["draft", "in_production", "in_review", "awaiting_client", "approved", "published"];

const ALL_CLIENTS = "__all__";

const monthLabel = (d: Date) => d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtDateShort = (iso?: string) => iso ? new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—";

const initialsOf = (name: string) => name.split(" ").map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";

/* ------------------------------------------------------------------ */
/*  Componente principal                                              */
/* ------------------------------------------------------------------ */

export function ContentSection() {
  const { items, clients: contentClients, addContentItem, addManyContentItems, updateContentItem, updateContentStage, deleteContentItem } = useContentItems();
  const { clients: realClients } = useClients();

  const [activeClient, setActiveClient] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tutorialOpen, setTutorialOpen] = useState(false);

  /* Cliente list unificada (cadastrados + que já têm conteúdo) */
  const clientList = useMemo(() => {
    const map = new Map<string, { name: string; count: number; company?: string }>();
    realClients.forEach(c => {
      const key = c.company || c.name;
      map.set(key, { name: key, count: 0, company: c.company });
    });
    contentClients.forEach(c => {
      const existing = map.get(c.name);
      if (existing) existing.count = c.count;
      else map.set(c.name, { name: c.name, count: c.count });
    });
    return Array.from(map.values())
      .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [realClients, contentClients, items, search]);

  const noClientCount = items.filter(i => !i.clientName).length;

  /* ----- Tela inicial (seleção de cliente) ----- */
  if (!activeClient) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Conteúdo por cliente</h2>
            <p className="text-xs text-muted-foreground mt-1">Escolha um cliente para abrir o workspace de conteúdo.</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-muted/40" />
          </div>
        </div>

        <button
          onClick={() => setActiveClient(ALL_CLIENTS)}
          className="orbit-card w-full p-4 flex items-center gap-4 hover:border-primary/40 transition-all text-left"
        >
          <div className="h-12 w-12 rounded-xl orbit-gradient flex items-center justify-center text-white">
            <Users className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Todos os conteúdos</p>
            <p className="text-xs text-muted-foreground">Visão consolidada de toda a produção · {items.length} {items.length === 1 ? "item" : "itens"}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {clientList.map(c => (
            <button
              key={c.name}
              onClick={() => setActiveClient(c.name)}
              className="orbit-card p-4 flex items-center gap-3 hover:border-primary/40 transition-all text-left"
            >
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/30 to-secondary/20 border border-border flex items-center justify-center text-sm font-semibold text-foreground shrink-0">
                {initialsOf(c.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                <p className="text-[11px] text-muted-foreground">{c.count} {c.count === 1 ? "conteúdo" : "conteúdos"}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
          {noClientCount > 0 && (
            <button
              onClick={() => setActiveClient("")}
              className="orbit-card p-4 flex items-center gap-3 hover:border-primary/40 transition-all text-left border-dashed"
            >
              <div className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Sem cliente</p>
                <p className="text-[11px] text-muted-foreground">{noClientCount} rascunhos sem cliente</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          )}
          {clientList.length === 0 && !noClientCount && (
            <div className="orbit-card p-10 col-span-full text-center space-y-3">
              <Users className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">Nenhum cliente encontrado. Cadastre clientes em Clientes ou comece em "Todos os conteúdos".</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ----- Workspace de conteúdo ----- */
  return (
    <ClientWorkspace
      clientName={activeClient}
      onBack={() => setActiveClient(null)}
      items={items}
      onAdd={addContentItem}
      onAddMany={addManyContentItems}
      onUpdate={updateContentItem}
      onStage={updateContentStage}
      onDelete={deleteContentItem}
      tutorialOpen={tutorialOpen}
      setTutorialOpen={setTutorialOpen}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Workspace                                                          */
/* ------------------------------------------------------------------ */

interface WorkspaceProps {
  clientName: string;
  onBack: () => void;
  items: ContentItem[];
  onAdd: (data: Omit<ContentItem, "id" | "isDemo" | "createdAt">) => void;
  onAddMany: (list: Omit<ContentItem, "id" | "isDemo" | "createdAt">[]) => void;
  onUpdate: (id: string, patch: Partial<ContentItem>) => void;
  onStage: (id: string, stage: ContentStage) => void;
  onDelete: (id: string) => void;
  tutorialOpen: boolean;
  setTutorialOpen: (v: boolean) => void;
}

const ClientWorkspace = ({
  clientName, onBack, items, onAdd, onAddMany, onUpdate, onStage, onDelete,
  tutorialOpen, setTutorialOpen,
}: WorkspaceProps) => {
  const isAll = clientName === ALL_CLIENTS;
  const isEmpty = clientName === "";
  const displayName = isAll ? "Todos os clientes" : (isEmpty ? "Sem cliente" : clientName);

  const clientItems = useMemo(() => items.filter(i => {
    if (isAll) return true;
    if (isEmpty) return !i.clientName;
    return i.clientName === clientName;
  }), [items, clientName, isAll, isEmpty]);

  const [view, setView] = useState<"calendar" | "production">("calendar");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newInitialDate, setNewInitialDate] = useState<string | undefined>(undefined);
  const [quickPlanOpen, setQuickPlanOpen] = useState(false);
  const [selected, setSelected] = useState<ContentItem | null>(null);
  const [filterChannel, setFilterChannel] = useState<string>("all");
  const [filterFormat, setFilterFormat] = useState<string>("all");
  const [filterApproval, setFilterApproval] = useState<string>("all");
  const [draggedId, setDraggedId] = useState<string | null>(null);

  /* manter selected sincronizado */
  useEffect(() => {
    if (!selected) return;
    const fresh = items.find(i => i.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
  }, [items]); // eslint-disable-line

  const filtered = useMemo(() => clientItems.filter(i => {
    if (filterChannel !== "all" && i.channel !== filterChannel) return false;
    if (filterFormat !== "all" && i.format !== filterFormat) return false;
    if (filterApproval !== "all" && i.approval !== filterApproval) return false;
    return true;
  }), [clientItems, filterChannel, filterFormat, filterApproval]);

  const metrics = useMemo(() => ({
    total: clientItems.length,
    notSent: clientItems.filter(i => i.approval === "draft").length,
    inReview: clientItems.filter(i => i.approval === "in_review").length,
    awaiting: clientItems.filter(i => i.approval === "awaiting_client").length,
    approved: clientItems.filter(i => i.approval === "approved").length,
    published: clientItems.filter(i => i.approval === "published").length,
  }), [clientItems]);

  const handleQuickPlan = (params: { goal: string; count: number; channels: ContentChannel[]; theme: string; startDate: string }) => {
    const drafts: Omit<ContentItem, "id" | "isDemo" | "createdAt">[] = [];
    const base = new Date(params.startDate + "T00:00:00");
    for (let i = 0; i < params.count; i++) {
      const ch = params.channels[i % params.channels.length] || "instagram";
      const fmt: ContentFormat = ch === "instagram" ? (i % 3 === 0 ? "carousel" : i % 3 === 1 ? "reel" : "feed")
        : ch === "tiktok" ? "tiktok"
        : ch === "youtube" ? "youtube"
        : ch === "email" ? "email"
        : ch === "blog" ? "article"
        : "feed";
      const d = new Date(base); d.setDate(d.getDate() + i * 2);
      drafts.push({
        title: `${params.theme || params.goal} — Ideia ${i + 1}`,
        channel: ch, format: fmt,
        status: "idea", stage: "planning", approval: "draft",
        publishDate: isoOf(d),
        clientName: isAll || isEmpty ? undefined : clientName,
        campaign: params.goal,
        caption: `Rascunho gerado em planejamento rápido — substitua pelo seu copy.`,
        briefing: `Objetivo: ${params.goal}. Tema: ${params.theme || "—"}. Etapa: planejamento.`,
        tags: ["rascunho", "planejamento-rapido"],
        checklist: [{ text: "Definir copy final", done: false }, { text: "Aprovar com cliente", done: false }],
      });
    }
    onAddMany(drafts);
    setQuickPlanOpen(false);
    toast({ title: `${params.count} rascunhos criados`, description: "Conteúdos adicionados à etapa Planejamento. Tudo simulado localmente." });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/30 to-secondary/20 border border-border flex items-center justify-center text-sm font-semibold text-foreground shrink-0">
            {isAll ? <Users className="h-5 w-5 text-primary" /> : initialsOf(displayName)}
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground truncate">{displayName}</h2>
            <p className="text-xs text-muted-foreground">Workspace de conteúdo</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)} className="gap-1.5">
            <Eye className="h-4 w-4" /> Preview
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTutorialOpen(true)} className="gap-1.5">
            <HelpCircle className="h-4 w-4" /> Tutorial
          </Button>
          <Button variant="outline" size="sm" onClick={() => setQuickPlanOpen(true)} className="gap-1.5">
            <Sparkles className="h-4 w-4" /> Planejamento rápido
          </Button>
          <Button size="sm" onClick={() => setNewOpen(true)} className="orbit-gradient text-white border-0 gap-1.5">
            <Plus className="h-4 w-4" /> Novo conteúdo
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setPreviewOpen(true)}>Abrir previews</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setView(view === "calendar" ? "production" : "calendar")}>
                Alternar visão
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onBack}>Trocar de cliente</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <Metric label="Total" value={metrics.total} />
        <Metric label="Não enviados" value={metrics.notSent} tone="muted" />
        <Metric label="Em revisão" value={metrics.inReview} tone="orange" />
        <Metric label="Aguardando" value={metrics.awaiting} tone="violet" />
        <Metric label="Aprovados" value={metrics.approved} tone="emerald" />
        <Metric label="Publicados" value={metrics.published} tone="primary" />
      </div>

      {/* Filtros + visão */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setView("calendar")}
            className={cn("px-3 py-1.5 text-sm inline-flex items-center gap-1.5",
              view === "calendar" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            <CalendarIcon className="h-3.5 w-3.5" /> Calendário
          </button>
          <button
            onClick={() => setView("production")}
            className={cn("px-3 py-1.5 text-sm inline-flex items-center gap-1.5",
              view === "production" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Produção
          </button>
        </div>
        <Select value={filterChannel} onValueChange={setFilterChannel}>
          <SelectTrigger className="w-[140px] h-9 bg-muted/40"><SelectValue placeholder="Plataforma" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Plataformas</SelectItem>
            {ALL_CHANNELS.map(c => <SelectItem key={c} value={c}>{CONTENT_CHANNEL_LABEL[c]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterFormat} onValueChange={setFilterFormat}>
          <SelectTrigger className="w-[130px] h-9 bg-muted/40"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent className="max-h-[280px]">
            <SelectItem value="all">Tipos</SelectItem>
            {FORMATS.map(f => <SelectItem key={f} value={f}>{CONTENT_FORMAT_LABEL[f]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterApproval} onValueChange={setFilterApproval}>
          <SelectTrigger className="w-[150px] h-9 bg-muted/40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Status</SelectItem>
            {APPROVALS.map(a => <SelectItem key={a} value={a}>{CONTENT_APPROVAL_LABEL[a]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Conteúdo */}
      {view === "calendar" ? (
        <CalendarView items={filtered} onSelect={setSelected} onCreateOnDay={(iso) => { setNewOpen(true); setNewInitialDate(iso); }} />
      ) : (
        <ProductionView
          items={filtered}
          draggedId={draggedId}
          setDraggedId={setDraggedId}
          onStage={onStage}
          onSelect={setSelected}
        />
      )}

      {/* Drawer detalhe / novo */}
      <NewContentDialog
        open={newOpen}
        onOpenChange={(o) => { setNewOpen(o); if (!o) setNewInitialDate(undefined); }}
        defaultClient={isAll || isEmpty ? undefined : clientName}
        defaultDate={newInitialDate}
        onCreate={(data) => { onAdd(data); setNewOpen(false); setNewInitialDate(undefined); toast({ title: "Conteúdo criado" }); }}
      />
      <ContentDetailSheet
        item={selected}
        onClose={() => setSelected(null)}
        onUpdate={onUpdate}
        onDelete={(id) => { onDelete(id); setSelected(null); toast({ title: "Conteúdo excluído" }); }}
        onDuplicate={(item) => {
          const { id, isDemo, createdAt, ...rest } = item;
          onAdd({ ...rest, title: `${rest.title} (cópia)` });
          toast({ title: "Conteúdo duplicado" });
        }}
      />
      <SocialPreviewSheet
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        clientName={displayName}
        items={filtered}
      />
      <QuickPlanDialog
        open={quickPlanOpen}
        onOpenChange={setQuickPlanOpen}
        onGenerate={handleQuickPlan}
      />
      <TutorialDialog open={tutorialOpen} onOpenChange={setTutorialOpen} />
    </div>
  );

  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  function _h() {} // placeholder

};


/* ------------------------------------------------------------------ */
/*  Métrica                                                           */
/* ------------------------------------------------------------------ */

const Metric = ({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "muted" | "orange" | "violet" | "emerald" | "primary" }) => {
  const tones: Record<string, string> = {
    default: "text-foreground",
    muted: "text-muted-foreground",
    orange: "text-orange-400",
    violet: "text-violet-400",
    emerald: "text-emerald-400",
    primary: "text-primary",
  };
  return (
    <div className="orbit-card px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">{label}</p>
      <p className={cn("text-xl font-semibold mt-1", tones[tone])}>{value}</p>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Calendário mensal                                                 */
/* ------------------------------------------------------------------ */

const WEEK_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const CalendarView = ({ items, onSelect, onCreateOnDay }: {
  items: ContentItem[];
  onSelect: (i: ContentItem) => void;
  onCreateOnDay: (iso: string) => void;
}) => {
  const [cursor, setCursor] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });

  const days = useMemo(() => {
    const first = new Date(cursor);
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    // Segunda como primeiro dia
    const leading = ((first.getDay() + 6) % 7);
    const cells: { iso: string; date: Date; current: boolean }[] = [];
    for (let i = leading - 1; i >= 0; i--) {
      const d = new Date(first); d.setDate(first.getDate() - i - 1);
      cells.push({ iso: isoOf(d), date: d, current: false });
    }
    for (let i = 1; i <= last.getDate(); i++) {
      const d = new Date(cursor.getFullYear(), cursor.getMonth(), i);
      cells.push({ iso: isoOf(d), date: d, current: true });
    }
    while (cells.length % 7 !== 0 || cells.length < 35) {
      const d = new Date(cells[cells.length - 1].date); d.setDate(d.getDate() + 1);
      cells.push({ iso: isoOf(d), date: d, current: false });
      if (cells.length >= 42) break;
    }
    return cells;
  }, [cursor]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, ContentItem[]>();
    items.forEach(i => {
      if (!i.publishDate) return;
      const arr = map.get(i.publishDate) || [];
      arr.push(i); map.set(i.publishDate, arr);
    });
    return map;
  }, [items]);

  const todayIso = isoOf(new Date());

  return (
    <div className="orbit-card overflow-hidden">
      {/* Header do mês */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-sm font-semibold text-foreground capitalize px-2">{monthLabel(cursor)}</h3>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); }}>Hoje</Button>
      </div>

      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {WEEK_DAYS.map(w => (
          <div key={w} className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 auto-rows-[minmax(110px,1fr)]">
        {days.map((d, idx) => {
          const dayItems = itemsByDay.get(d.iso) || [];
          const isToday = d.iso === todayIso;
          return (
            <div
              key={d.iso + idx}
              className={cn(
                "group border-r border-b border-border/60 p-1.5 flex flex-col gap-1 relative overflow-hidden",
                !d.current && "bg-muted/20 text-muted-foreground/50",
                (idx + 1) % 7 === 0 && "border-r-0",
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn(
                  "text-[11px] font-medium px-1.5 py-0.5 rounded",
                  isToday ? "bg-primary text-primary-foreground" : d.current ? "text-foreground" : "",
                )}>
                  {d.date.getDate()}
                </span>
                {d.current && (
                  <button
                    onClick={() => onCreateOnDay(d.iso)}
                    className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded bg-muted hover:bg-primary/20 hover:text-primary text-muted-foreground flex items-center justify-center transition-all"
                    aria-label="Adicionar conteúdo neste dia"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1 overflow-hidden">
                {dayItems.slice(0, 3).map(it => (
                  <button
                    key={it.id}
                    onClick={() => onSelect(it)}
                    className="text-left w-full truncate text-[10.5px] px-1.5 py-1 rounded bg-card border border-border/60 hover:border-primary/40 transition-colors flex items-center gap-1"
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", CONTENT_STAGE_TONE[it.stage])} />
                    <span className="truncate text-foreground">{it.title}</span>
                  </button>
                ))}
                {dayItems.length > 3 && (
                  <span className="text-[10px] text-muted-foreground px-1">+ {dayItems.length - 3} mais</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {items.length === 0 && (
        <div className="p-10 text-center space-y-2 border-t border-border">
          <CalendarIcon className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium text-foreground">Calendário vazio</p>
          <p className="text-xs text-muted-foreground">Clique em um dia para adicionar conteúdo ou use "Planejamento rápido".</p>
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Produção (kanban por etapas)                                      */
/* ------------------------------------------------------------------ */

const ProductionView = ({ items, draggedId, setDraggedId, onStage, onSelect }: {
  items: ContentItem[];
  draggedId: string | null;
  setDraggedId: (s: string | null) => void;
  onStage: (id: string, stage: ContentStage) => void;
  onSelect: (i: ContentItem) => void;
}) => (
  <div className="w-full max-w-full overflow-x-auto overflow-y-visible pb-3">
    <div className="flex gap-3 pr-6 min-w-min">
      {STAGES.map(stage => {
        const list = items.filter(i => i.stage === stage);
        return (
          <div
            key={stage}
            className="flex-shrink-0 w-[260px]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (draggedId) { onStage(draggedId, stage); setDraggedId(null); } }}
          >
            <div className="orbit-card p-2.5 mb-3 flex items-center justify-between border-t-2" style={{ borderTopColor: "transparent" }}>
              <div className="flex items-center gap-2">
                <div className={cn("h-2 w-2 rounded-full", CONTENT_STAGE_TONE[stage])} />
                <h4 className="text-sm font-semibold text-foreground">{CONTENT_STAGE_LABEL[stage]}</h4>
              </div>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{list.length}</span>
            </div>
            <div className="space-y-2 min-h-[80px]">
              {list.map(it => (
                <div
                  key={it.id}
                  draggable
                  onDragStart={() => setDraggedId(it.id)}
                  onDragEnd={() => setDraggedId(null)}
                  onClick={() => onSelect(it)}
                  className={cn(
                    "orbit-card p-3 space-y-2 cursor-pointer hover:border-primary/40 transition-all",
                    draggedId === it.id && "opacity-50 scale-95",
                  )}
                >
                  {it.mediaUrl && (
                    <div className="aspect-[4/3] rounded-md overflow-hidden bg-muted">
                      <img src={it.mediaUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground leading-snug">{it.title}</p>
                    {it.isDemo && <Badge variant="outline" className="text-[9px] shrink-0 h-4 px-1">demo</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-[10px] h-5 border-border text-muted-foreground">{CONTENT_CHANNEL_LABEL[it.channel]}</Badge>
                    <Badge variant="outline" className="text-[10px] h-5 border-border text-muted-foreground">{CONTENT_FORMAT_LABEL[it.format]}</Badge>
                    <Badge variant="outline" className={cn("text-[10px] h-5", CONTENT_APPROVAL_TONE[it.approval])}>{CONTENT_APPROVAL_LABEL[it.approval]}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3" />{fmtDateShort(it.publishDate)}</span>
                    {it.owner && <span className="truncate max-w-[110px]">@{it.owner}</span>}
                  </div>
                </div>
              ))}
              {list.length === 0 && (
                <div className="orbit-card border-dashed p-4 text-center text-[11px] text-muted-foreground">Solte aqui</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Dialog: novo conteúdo                                             */
/* ------------------------------------------------------------------ */

const NewContentDialog = ({ open, onOpenChange, defaultClient, defaultDate, onCreate }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultClient?: string;
  defaultDate?: string;
  onCreate: (data: Omit<ContentItem, "id" | "isDemo" | "createdAt">) => void;
}) => {
  const { clients } = useClients();
  const handle = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = (fd.get("title") as string).trim();
    if (!title) { toast({ title: "Informe o título", variant: "destructive" }); return; }
    const checklistRaw = (fd.get("checklist") as string) || "";
    const stage = (fd.get("stage") as ContentStage) || "planning";
    onCreate({
      title,
      channel: (fd.get("channel") as ContentChannel) || "instagram",
      format: (fd.get("format") as ContentFormat) || "feed",
      stage,
      approval: (fd.get("approval") as ContentApproval) || "draft",
      status: "idea",
      publishDate: (fd.get("publishDate") as string) || undefined,
      clientName: ((fd.get("clientName") as string) || "").trim() || undefined,
      campaign: ((fd.get("campaign") as string) || "").trim() || undefined,
      caption: ((fd.get("caption") as string) || "").trim() || undefined,
      briefing: ((fd.get("briefing") as string) || "").trim() || undefined,
      observations: ((fd.get("observations") as string) || "").trim() || undefined,
      mediaUrl: ((fd.get("mediaUrl") as string) || "").trim() || undefined,
      owner: ((fd.get("owner") as string) || "").trim() || undefined,
      tags: ((fd.get("tags") as string) || "").split(",").map(t => t.trim()).filter(Boolean),
      checklist: checklistRaw.split("\n").map(s => s.trim()).filter(Boolean).map(text => ({ text, done: false })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo conteúdo</DialogTitle>
          <DialogDescription>Planeje um post, e-mail, vídeo ou outro tipo de conteúdo para o cliente.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handle} className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Título*</Label>
            <Input name="title" placeholder="Ex: Carrossel sobre 5 erros em branding" className="bg-muted/40" />
          </div>
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Input name="clientName" defaultValue={defaultClient || ""} list="content-clients-dl" className="bg-muted/40" placeholder="Selecione ou digite" />
            <datalist id="content-clients-dl">
              {clients.map(c => <option key={c.id} value={c.company || c.name} />)}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label>Plataforma</Label>
            <Select name="channel" defaultValue="instagram">
              <SelectTrigger className="bg-muted/40"><SelectValue /></SelectTrigger>
              <SelectContent>{ALL_CHANNELS.map(c => <SelectItem key={c} value={c}>{CONTENT_CHANNEL_LABEL[c]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select name="format" defaultValue="feed">
              <SelectTrigger className="bg-muted/40"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-[260px]">{FORMATS.map(f => <SelectItem key={f} value={f}>{CONTENT_FORMAT_LABEL[f]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Data prevista</Label>
            <Input name="publishDate" type="date" defaultValue={defaultDate || ""} className="bg-muted/40" />
          </div>
          <div className="space-y-1.5">
            <Label>Etapa inicial</Label>
            <Select name="stage" defaultValue="planning">
              <SelectTrigger className="bg-muted/40"><SelectValue /></SelectTrigger>
              <SelectContent>{STAGES.map(s => <SelectItem key={s} value={s}>{CONTENT_STAGE_LABEL[s]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status de aprovação</Label>
            <Select name="approval" defaultValue="draft">
              <SelectTrigger className="bg-muted/40"><SelectValue /></SelectTrigger>
              <SelectContent>{APPROVALS.map(a => <SelectItem key={a} value={a}>{CONTENT_APPROVAL_LABEL[a]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Campanha</Label>
            <Input name="campaign" placeholder="Ex: Educacional Abril" className="bg-muted/40" />
          </div>
          <div className="space-y-1.5">
            <Label>Responsável</Label>
            <Input name="owner" placeholder="Ex: Marina" className="bg-muted/40" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Copy / legenda</Label>
            <Textarea name="caption" rows={3} placeholder="Texto principal que vai no post..." className="bg-muted/40" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Briefing</Label>
            <Textarea name="briefing" rows={3} placeholder="Direcionamento criativo, referências, tom de voz..." className="bg-muted/40" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Observações internas</Label>
            <Textarea name="observations" rows={2} placeholder="Notas para a equipe..." className="bg-muted/40" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>URL de mídia <span className="text-[10px] text-muted-foreground">(Upload em breve)</span></Label>
            <Input name="mediaUrl" placeholder="https://..." className="bg-muted/40" />
          </div>
          <div className="space-y-1.5">
            <Label>Tags (vírgulas)</Label>
            <Input name="tags" placeholder="branding, educativo" className="bg-muted/40" />
          </div>
          <div className="space-y-1.5 sm:col-span-1">
            <Label>Checklist (uma por linha)</Label>
            <Textarea name="checklist" rows={2} placeholder="Aprovar copy&#10;Enviar para revisão" className="bg-muted/40" />
          </div>

          <DialogFooter className="sm:col-span-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="orbit-gradient text-white border-0">Criar conteúdo</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/* ------------------------------------------------------------------ */
/*  Drawer detalhe                                                    */
/* ------------------------------------------------------------------ */

const ContentDetailSheet = ({ item, onClose, onUpdate, onDelete, onDuplicate }: {
  item: ContentItem | null;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<ContentItem>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (item: ContentItem) => void;
}) => {
  if (!item) return null;
  const checklist = item.checklist || [];
  const done = checklist.filter(c => c.done).length;

  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="bg-card border-border w-full sm:max-w-[520px] overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-lg text-foreground leading-tight">{item.title}</SheetTitle>
          <SheetDescription className="flex flex-wrap gap-1.5 mt-1">
            <Badge variant="outline">{CONTENT_CHANNEL_LABEL[item.channel]}</Badge>
            <Badge variant="outline">{CONTENT_FORMAT_LABEL[item.format]}</Badge>
            <Badge variant="outline" className={CONTENT_APPROVAL_TONE[item.approval]}>{CONTENT_APPROVAL_LABEL[item.approval]}</Badge>
            <Badge variant="outline"><span className={cn("h-1.5 w-1.5 rounded-full mr-1.5 inline-block", CONTENT_STAGE_TONE[item.stage])} />{CONTENT_STAGE_LABEL[item.stage]}</Badge>
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-wrap gap-2 my-4">
          <Button size="sm" variant="outline" onClick={() => onDuplicate(item)}><Copy className="h-3.5 w-3.5 mr-1" /> Duplicar</Button>
          <Button size="sm" variant="outline" className="text-destructive" onClick={() => onDelete(item.id)}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
          </Button>
        </div>

        <div className="space-y-5 pb-6">
          {item.mediaUrl && (
            <div className="orbit-card overflow-hidden">
              <div className="aspect-video bg-muted">
                <img src={item.mediaUrl} alt="" className="w-full h-full object-cover" />
              </div>
            </div>
          )}

          <div className="orbit-card p-4 space-y-3 text-sm">
            <Row label="Cliente">
              <Input defaultValue={item.clientName || ""} onBlur={(e) => onUpdate(item.id, { clientName: e.target.value || undefined })} className="h-8 bg-muted/40 text-sm" />
            </Row>
            <Row label="Data prevista">
              <Input type="date" defaultValue={item.publishDate || ""} onBlur={(e) => onUpdate(item.id, { publishDate: e.target.value || undefined })} className="h-8 bg-muted/40 text-sm" />
            </Row>
            <Row label="Etapa">
              <Select defaultValue={item.stage} onValueChange={(v) => onUpdate(item.id, { stage: v as ContentStage })}>
                <SelectTrigger className="h-8 bg-muted/40 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{STAGES.map(s => <SelectItem key={s} value={s}>{CONTENT_STAGE_LABEL[s]}</SelectItem>)}</SelectContent>
              </Select>
            </Row>
            <Row label="Aprovação">
              <Select defaultValue={item.approval} onValueChange={(v) => onUpdate(item.id, { approval: v as ContentApproval })}>
                <SelectTrigger className="h-8 bg-muted/40 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{APPROVALS.map(a => <SelectItem key={a} value={a}>{CONTENT_APPROVAL_LABEL[a]}</SelectItem>)}</SelectContent>
              </Select>
            </Row>
            <Row label="Responsável">
              <Input defaultValue={item.owner || ""} onBlur={(e) => onUpdate(item.id, { owner: e.target.value || undefined })} className="h-8 bg-muted/40 text-sm" />
            </Row>
            <Row label="Campanha">
              <Input defaultValue={item.campaign || ""} onBlur={(e) => onUpdate(item.id, { campaign: e.target.value || undefined })} className="h-8 bg-muted/40 text-sm" />
            </Row>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Copy / legenda</Label>
            <Textarea defaultValue={item.caption || ""} rows={3} onBlur={(e) => onUpdate(item.id, { caption: e.target.value || undefined })} className="bg-muted/40 text-sm" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Briefing</Label>
            <Textarea defaultValue={item.briefing || ""} rows={3} onBlur={(e) => onUpdate(item.id, { briefing: e.target.value || undefined })} className="bg-muted/40 text-sm" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Observações</Label>
            <Textarea defaultValue={item.observations || ""} rows={2} onBlur={(e) => onUpdate(item.id, { observations: e.target.value || undefined })} className="bg-muted/40 text-sm" />
          </div>

          {checklist.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Checklist · {done}/{checklist.length}</Label>
              <div className="orbit-card divide-y divide-border/60">
                {checklist.map((c, idx) => (
                  <label key={idx} className="flex items-center gap-3 px-3 py-2 cursor-pointer">
                    <Checkbox checked={c.done} onCheckedChange={() => {
                      const next = checklist.map((x, i) => i === idx ? { ...x, done: !x.done } : x);
                      onUpdate(item.id, { checklist: next });
                    }} />
                    <span className={cn("text-sm", c.done ? "line-through text-muted-foreground" : "text-foreground")}>{c.text}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map(t => <Badge key={t} variant="outline" className="text-[10px]">#{t}</Badge>)}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground border-t border-border pt-3">
            Criado em {new Date(item.createdAt).toLocaleDateString("pt-BR")}. Conteúdo armazenado localmente — sem publicação real.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[110px_1fr] items-center gap-3">
    <span className="text-xs text-muted-foreground">{label}</span>
    <div>{children}</div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Planejamento rápido                                               */
/* ------------------------------------------------------------------ */

const QuickPlanDialog = ({ open, onOpenChange, onGenerate }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onGenerate: (p: { goal: string; count: number; channels: ContentChannel[]; theme: string; startDate: string }) => void;
}) => {
  const [goal, setGoal] = useState("Engajamento");
  const [theme, setTheme] = useState("");
  const [count, setCount] = useState(6);
  const [startDate, setStartDate] = useState(isoOf(new Date()));
  const [channels, setChannels] = useState<ContentChannel[]>(["instagram"]);

  const toggleChannel = (c: ContentChannel) => {
    setChannels(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Planejamento rápido</DialogTitle>
          <DialogDescription>
            Gera rascunhos locais distribuídos no calendário. <span className="text-primary">Simulação</span> — nada é publicado.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>Objetivo</Label>
            <Select value={goal} onValueChange={setGoal}>
              <SelectTrigger className="bg-muted/40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Engajamento", "Vendas", "Autoridade", "Captação", "Recall de marca", "Educacional"].map(g =>
                  <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tema</Label>
            <Input value={theme} onChange={e => setTheme(e.target.value)} placeholder="Ex: Lançamento da nova linha" className="bg-muted/40" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Quantidade de posts</Label>
              <Input type="number" min={1} max={30} value={count} onChange={e => setCount(Math.min(30, Math.max(1, Number(e.target.value) || 1)))} className="bg-muted/40" />
            </div>
            <div className="space-y-1.5">
              <Label>Início</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-muted/40" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Plataformas</Label>
            <div className="flex flex-wrap gap-2">
              {(["instagram", "tiktok", "youtube", "blog", "email"] as ContentChannel[]).map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleChannel(c)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs border transition-colors",
                    channels.includes(c)
                      ? "bg-primary/15 text-primary border-primary/40"
                      : "text-muted-foreground border-border hover:text-foreground",
                  )}
                >
                  {CONTENT_CHANNEL_LABEL[c]}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
            ⚡ Esta geração é local. Sem IA real e sem chamadas externas.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            className="orbit-gradient text-white border-0"
            onClick={() => {
              if (channels.length === 0) { toast({ title: "Selecione ao menos uma plataforma", variant: "destructive" }); return; }
              onGenerate({ goal, count, channels, theme, startDate });
            }}
          >
            Gerar {count} rascunhos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ------------------------------------------------------------------ */
/*  Tutorial                                                          */
/* ------------------------------------------------------------------ */

const TutorialDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="bg-card border-border max-w-lg">
      <DialogHeader>
        <DialogTitle>Como usar o módulo de Conteúdo</DialogTitle>
        <DialogDescription>Um fluxo recomendado para sua agência.</DialogDescription>
      </DialogHeader>
      <ol className="space-y-3 text-sm text-foreground pt-1">
        {[
          ["Escolha um cliente", "Cada cliente tem seu próprio workspace de conteúdo."],
          ["Crie ou planeje", "Use 'Novo conteúdo' para um item ou 'Planejamento rápido' para gerar uma série de rascunhos."],
          ["Mova pelas etapas", "Use a visão Produção para arrastar entre Planejamento → Copy → Design → Aprovação → Revisão → Aprovado → Publicação."],
          ["Acompanhe no calendário", "Visualize o que está agendado em cada dia e ajuste datas no clique."],
          ["Preview social", "Abra o painel de preview para ver como Feed, Reels, TikTok e YouTube aparecem — tudo simulado, sem integração real."],
        ].map(([t, d], i) => (
          <li key={i} className="flex gap-3">
            <span className="h-6 w-6 rounded-full orbit-gradient text-white text-xs flex items-center justify-center shrink-0">{i + 1}</span>
            <div>
              <p className="font-medium text-foreground">{t}</p>
              <p className="text-xs text-muted-foreground">{d}</p>
            </div>
          </li>
        ))}
      </ol>
      <DialogFooter>
        <Button className="orbit-gradient text-white border-0" onClick={() => onOpenChange(false)}>Entendi</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

/* ------------------------------------------------------------------ */
/*  Preview social                                                    */
/* ------------------------------------------------------------------ */

const SocialPreviewSheet = ({ open, onOpenChange, clientName, items }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  clientName: string; items: ContentItem[];
}) => {
  const feed = items.filter(i => i.channel === "instagram" && (i.format === "feed" || i.format === "carousel" || i.format === "post"));
  const reels = items.filter(i => i.channel === "instagram" && (i.format === "reel" || i.format === "video"));
  const tiktoks = items.filter(i => i.channel === "tiktok");
  const yts = items.filter(i => i.channel === "youtube");

  const counters = {
    posts: items.length,
    approved: items.filter(i => i.approval === "approved" || i.approval === "published").length,
    published: items.filter(i => i.approval === "published").length,
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-card border-border w-full sm:max-w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><Eye className="h-4 w-4 text-primary" /> Preview social</SheetTitle>
          <SheetDescription className="flex items-center justify-between">
            <span>{clientName}</span>
            <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">simulação</Badge>
          </SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-3 gap-2 mt-4">
          <PreviewCounter label="Posts" value={counters.posts} />
          <PreviewCounter label="Aprovados" value={counters.approved} />
          <PreviewCounter label="Publicados" value={counters.published} />
        </div>

        <Tabs defaultValue="feed" className="mt-4">
          <TabsList className="w-full grid grid-cols-5 h-auto">
            <TabsTrigger value="feed" className="text-xs">Feed</TabsTrigger>
            <TabsTrigger value="reels" className="text-xs">Reels</TabsTrigger>
            <TabsTrigger value="tiktok" className="text-xs">TikTok</TabsTrigger>
            <TabsTrigger value="youtube" className="text-xs">YouTube</TabsTrigger>
            <TabsTrigger value="all" className="text-xs">Todos</TabsTrigger>
          </TabsList>

          <TabsContent value="feed" className="mt-4">
            <FeedGrid clientName={clientName} items={feed} />
          </TabsContent>
          <TabsContent value="reels" className="mt-4">
            <VerticalScroll clientName={clientName} items={reels} variant="reels" />
          </TabsContent>
          <TabsContent value="tiktok" className="mt-4">
            <VerticalScroll clientName={clientName} items={tiktoks} variant="tiktok" />
          </TabsContent>
          <TabsContent value="youtube" className="mt-4">
            <YouTubeList clientName={clientName} items={yts} />
          </TabsContent>
          <TabsContent value="all" className="mt-4 space-y-6">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Feed</p>
              <FeedGrid clientName={clientName} items={feed} compact />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Reels</p>
              <VerticalScroll clientName={clientName} items={reels} variant="reels" compact />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">TikTok</p>
              <VerticalScroll clientName={clientName} items={tiktoks} variant="tiktok" compact />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">YouTube</p>
              <YouTubeList clientName={clientName} items={yts} compact />
            </div>
          </TabsContent>
        </Tabs>

        <p className="text-[10px] text-muted-foreground text-center mt-6">
          Previews são mockups visuais. Nenhuma integração ou publicação real é feita.
        </p>
      </SheetContent>
    </Sheet>
  );
};

const PreviewCounter = ({ label, value }: { label: string; value: number }) => (
  <div className="orbit-card text-center px-2 py-2.5">
    <p className="text-lg font-semibold text-foreground">{value}</p>
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
  </div>
);

const Avatar = ({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) => (
  <div className={cn(
    "rounded-full orbit-gradient flex items-center justify-center text-white font-semibold shrink-0",
    size === "sm" ? "h-7 w-7 text-[10px]" : "h-10 w-10 text-xs",
  )}>
    {initialsOf(name)}
  </div>
);

const FeedGrid = ({ clientName, items, compact }: { clientName: string; items: ContentItem[]; compact?: boolean }) => {
  if (!items.length) return <EmptyPreview text="Nenhum post de feed planejado." />;
  return (
    <div className="orbit-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Avatar name={clientName} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground truncate">@{(clientName || "cliente").toLowerCase().replace(/\s+/g, "")}</p>
          <p className="text-[10px] text-muted-foreground">Feed · simulação</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-px bg-border">
        {items.slice(0, compact ? 6 : 12).map(it => (
          <div key={it.id} className="aspect-square bg-card relative overflow-hidden group">
            {it.mediaUrl ? (
              <img src={it.mediaUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/10 flex items-center justify-center p-2">
                <p className="text-[10px] text-foreground/80 text-center line-clamp-4 font-medium">{it.title}</p>
              </div>
            )}
            {it.format === "carousel" && (
              <div className="absolute top-1 right-1 bg-black/60 text-white p-0.5 rounded">
                <ImageIcon className="h-3 w-3" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
              <div className="flex items-center gap-2 text-white text-[10px]">
                <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {Math.floor(Math.random() * 900) + 100}</span>
                <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {Math.floor(Math.random() * 50) + 5}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const VerticalScroll = ({ clientName, items, variant, compact }: {
  clientName: string; items: ContentItem[]; variant: "reels" | "tiktok"; compact?: boolean;
}) => {
  if (!items.length) return <EmptyPreview text={variant === "reels" ? "Nenhum Reel planejado." : "Nenhum TikTok planejado."} />;
  return (
    <div className={cn("flex gap-3 overflow-x-auto pb-2", compact && "snap-x")}>
      {items.slice(0, compact ? 3 : 6).map(it => (
        <div key={it.id} className={cn("relative shrink-0 rounded-2xl overflow-hidden border border-border bg-black", compact ? "w-[140px] h-[240px]" : "w-[180px] h-[320px]")}>
          {it.mediaUrl ? (
            <img src={it.mediaUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-secondary/30 to-card" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
          <div className="absolute top-2 left-2 right-2 flex items-center gap-1.5">
            <Avatar name={clientName} />
            <p className="text-[10px] text-white font-medium truncate">@{(clientName || "cliente").toLowerCase().replace(/\s+/g, "")}</p>
          </div>
          <div className="absolute right-2 bottom-12 flex flex-col gap-3 items-center text-white">
            <div className="flex flex-col items-center"><Heart className="h-4 w-4" /><span className="text-[9px]">{Math.floor(Math.random() * 9) + 1}k</span></div>
            <div className="flex flex-col items-center"><MessageCircle className="h-4 w-4" /><span className="text-[9px]">{Math.floor(Math.random() * 400) + 20}</span></div>
            <div className="flex flex-col items-center"><Share2 className="h-4 w-4" /><span className="text-[9px]">{Math.floor(Math.random() * 200) + 10}</span></div>
            {variant === "tiktok" ? <Music2 className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          </div>
          <div className="absolute bottom-2 left-2 right-12">
            <p className="text-[10px] text-white font-medium leading-snug line-clamp-2">{it.title}</p>
            {it.caption && <p className="text-[9px] text-white/80 leading-snug line-clamp-2 mt-0.5">{it.caption}</p>}
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/15 backdrop-blur flex items-center justify-center">
            <Play className="h-4 w-4 text-white fill-white" />
          </div>
        </div>
      ))}
    </div>
  );
};

const YouTubeList = ({ clientName, items, compact }: { clientName: string; items: ContentItem[]; compact?: boolean }) => {
  if (!items.length) return <EmptyPreview text="Nenhum vídeo de YouTube planejado." />;
  return (
    <div className="space-y-3">
      {items.slice(0, compact ? 2 : 5).map(it => (
        <div key={it.id} className="orbit-card overflow-hidden">
          <div className="aspect-video bg-black relative">
            {it.mediaUrl ? (
              <img src={it.mediaUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-secondary/20 to-black" />
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-12 w-12 rounded-full bg-black/70 flex items-center justify-center">
                <Play className="h-5 w-5 text-white fill-white" />
              </div>
            </div>
            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded">
              {Math.floor(Math.random() * 12) + 3}:{String(Math.floor(Math.random() * 60)).padStart(2, "0")}
            </div>
          </div>
          <div className="p-3 flex gap-3">
            <Avatar name={clientName} size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">{it.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{clientName} · {Math.floor(Math.random() * 20) + 1}k visualizações · há {Math.floor(Math.random() * 6) + 1} dias</p>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1.5">
                <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> {Math.floor(Math.random() * 800) + 50}</span>
                <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {Math.floor(Math.random() * 100) + 5}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const EmptyPreview = ({ text }: { text: string }) => (
  <div className="orbit-card border-dashed p-6 text-center text-xs text-muted-foreground">
    {text}
  </div>
);
