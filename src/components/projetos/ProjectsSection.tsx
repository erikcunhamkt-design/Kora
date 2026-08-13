import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { formatCurrency as intlCurrency, formatDate as intlDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Plus, Search, FolderOpen, Loader2, Eye, CheckCircle2, DollarSign, AlertTriangle, Calendar, User, Link2, FileText, Database, Cloud } from "lucide-react";
import { useProjects, PROJECT_STATUS_LABEL, PROJECT_PRIORITY_LABEL, type ProjectStatus, type ProjectPriority, type Project } from "@/hooks/useProjects";
import { useSupabaseProjects } from "@/hooks/useSupabaseProjects";
import { useClientsDataSource } from "@/hooks/useClientsDataSource";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { getProjectsDataSource, setProjectsDataSource, type DataSource } from "@/config/flags";
import { mapSupabaseProjectToLocal } from "@/services/projects/projectsMapper";
import { mirrorProjectToSupabase } from "@/services/projects/projectsCloudMirror";
import { isSupabaseProjectsWriteEnabled } from "@/hooks/useSupabaseProjectsWriteFlag";
import { ProjectDetailDrawer } from "@/components/projects/ProjectDetailDrawer";
import { toast } from "@/hooks/use-toast";

const SERVICE_TYPES = ["Branding", "Web", "Social", "Tráfego", "Vídeo", "Conteúdo", "Outro"];

const statusBadge: Record<ProjectStatus, string> = {
  planning: "bg-muted text-foreground border-border",
  in_progress: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  review: "bg-secondary/15 text-secondary border-secondary/30",
  delivered: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  paused: "bg-muted/40 text-muted-foreground border-border/40",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
  archived: "bg-muted/40 text-muted-foreground/70 border-border/40",
};

const priorityBadge: Record<ProjectPriority, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  low: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const fmtBRL = (v?: number) => intlCurrency(v ?? 0, { minimumFractionDigits: 0 });
const fmtDate = (iso?: string) => (iso ? intlDate(iso) : "—");

export function ProjectsSection() {
  const { projects: localProjects, addProject } = useProjects();

  // Etapa 5 · Flip Projetos (item 2) — seletor de dataSource, default LOCAL
  // (kora.projects.dataSource.v1, config/flags.ts). Os dois hooks abaixo
  // rodam sempre; só um alimenta a tela por vez — mesmo padrão já usado em
  // CRM.tsx/QuotesSection.tsx.
  const {
    projects: supabaseProjectsRaw, loading: supabaseLoading, error: supabaseError,
    createProject: createSupabaseProject,
  } = useSupabaseProjects();
  const { clients: dsClients } = useClientsDataSource();
  const { workspace } = useCurrentWorkspace();
  const clientNameById = useMemo(() => {
    const map: Record<string, string> = {};
    dsClients.forEach((c) => { map[String(c.id)] = c.name; });
    return map;
  }, [dsClients]);
  const supabaseProjects: Project[] = useMemo(
    () => supabaseProjectsRaw.map((sp) => mapSupabaseProjectToLocal(sp, clientNameById)),
    [supabaseProjectsRaw, clientNameById],
  );

  const [dataSource, setDataSourceState] = useState<DataSource>(() => getProjectsDataSource());
  const projects = dataSource === "supabase" ? supabaseProjects : localProjects;

  const handleSourceChange = (next: DataSource) => {
    setProjectsDataSource(next);
    setDataSourceState(next);
    toast({ title: `Fonte dos projetos alterada para ${next === "supabase" ? "Supabase (leitura)" : "Local"}.` });
  };

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterService, setFilterService] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [open, setOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Deep-link: ?projectId=X — opens drawer, scrolls into view, then clears URL.
  useEffect(() => {
    const pid = searchParams.get("projectId");
    if (!pid) return;
    if (!projects.some((p) => p.id === pid)) return;
    setHighlightId(pid);
    setDetailId(pid);
    const el = cardRefs.current[pid];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    const next = new URLSearchParams(searchParams);
    next.delete("projectId");
    setSearchParams(next, { replace: true });
    const t = setTimeout(() => setHighlightId(null), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, projects.length]);

  const detailProject = detailId ? projects.find((p) => p.id === detailId) ?? null : null;

  const filtered = useMemo(() => projects.filter((p) => {
    const q = search.toLowerCase();
    if (q && !p.name.toLowerCase().includes(q) && !p.clientName.toLowerCase().includes(q)) return false;
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    if (filterService !== "all" && p.serviceType !== filterService) return false;
    if (filterPriority !== "all" && p.priority !== filterPriority) return false;
    return true;
  }), [projects, search, filterStatus, filterService, filterPriority]);

  const metrics = useMemo(() => {
    const today = new Date();
    const in7 = (iso?: string) => {
      if (!iso) return false;
      const d = new Date(iso);
      const diff = (d.getTime() - today.getTime()) / 86400000;
      return diff <= 7 && diff >= -1;
    };
    return {
      total: projects.length,
      inProgress: projects.filter((p) => p.status === "in_progress").length,
      review: projects.filter((p) => p.status === "review").length,
      delivered: projects.filter((p) => p.status === "delivered").length,
      value: projects.reduce((s, p) => s + (p.budget || 0), 0),
      critical: projects.filter((p) => p.status !== "delivered" && in7(p.dueDate)).length,
    };
  }, [projects]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = (fd.get("name") as string).trim();
    const clientName = (fd.get("clientName") as string).trim();
    if (!name) { toast({ title: "Informe o nome do projeto", variant: "destructive" }); return; }
    if (!clientName) { toast({ title: "Informe o cliente", variant: "destructive" }); return; }
    const projectData = {
      name,
      clientName,
      description: (fd.get("description") as string) || "",
      serviceType: (fd.get("serviceType") as string) || "Outro",
      status: (fd.get("status") as ProjectStatus) || "planning",
      priority: (fd.get("priority") as ProjectPriority) || "medium",
      startDate: (fd.get("startDate") as string) || undefined,
      dueDate: (fd.get("dueDate") as string) || undefined,
      budget: Number(fd.get("budget")) || 0,
      tags: ((fd.get("tags") as string) || "").split(",").map((t) => t.trim()).filter(Boolean),
    };

    // Etapa 5 · Pacote do Flip (Fase B) — em modo Supabase, escrita vai
    // DIRETO pra nuvem (createSupabaseProject, criação nativa); em modo
    // local, continua gravando local + espelho best-effort (padrão G22,
    // fatia N) — mesma bifurcação de QuotesSection.tsx.
    if (dataSource === "supabase") {
      if (!workspace) {
        toast({ title: "Nenhum workspace ativo — não foi possível criar o projeto.", variant: "destructive" });
        return;
      }
      try {
        await createSupabaseProject(projectData);
        setOpen(false);
        toast({ title: "Projeto criado" });
      } catch (err) {
        console.error("Falha ao criar projeto no Supabase:", err);
        toast({ title: "Falha ao criar projeto no Supabase", description: "Tente novamente ou volte para Local.", variant: "destructive" });
      }
      return;
    }

    const project = addProject(projectData);
    setOpen(false);
    toast({ title: "Projeto criado" });
    mirrorCreateToSupabase(project);
  };

  // Etapa 5 · Flip Projetos (item 4) — espelho best-effort, padrão G22:
  // local já gravado ACIMA (addProject, autoritativo); isto só tenta
  // espelhar na nuvem quando o flag mestre está ON. Falha aqui NUNCA desfaz
  // nem bloqueia o local — só avisa (mesmo contrato de
  // CreateProjectFromQuoteDialog.tsx).
  const mirrorCreateToSupabase = (project: Project) => {
    if (!isSupabaseProjectsWriteEnabled() || !workspace) return;
    mirrorProjectToSupabase(workspace.id, project).catch((mirrorErr) => {
      console.error("Espelho nuvem do projeto falhou (local já gravado):", mirrorErr);
      toast({
        title: "Projeto salvo localmente, mas o espelho no Supabase falhou.",
        description: "Rode a importação manual em Configurações → Dados quando possível.",
        variant: "destructive",
      });
    });
  };

  const cards = [
    { label: "Total", value: metrics.total, icon: FolderOpen, accent: "text-primary" },
    { label: "Em andamento", value: metrics.inProgress, icon: Loader2, accent: "text-amber-400" },
    { label: "Em revisão", value: metrics.review, icon: Eye, accent: "text-secondary" },
    { label: "Entregues", value: metrics.delivered, icon: CheckCircle2, accent: "text-emerald-400" },
    { label: "Valor em projetos", value: fmtBRL(metrics.value), icon: DollarSign, accent: "text-foreground" },
    { label: "Prazo crítico", value: metrics.critical, icon: AlertTriangle, accent: "text-destructive" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Projetos</h2>
          <p className="text-xs text-muted-foreground">Acompanhe a entrega de cada job.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button onClick={() => setOpen(true)} className="orbit-gradient hover:opacity-90 gap-2"><Plus className="h-4 w-4" /> Novo projeto</Button>
          <DialogContent className="bg-card border-border max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Novo Projeto</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2"><Label>Nome do projeto*</Label><Input name="name" required className="mt-1.5" /></div>
              <div><Label>Cliente*</Label><Input name="clientName" required className="mt-1.5" /></div>
              <div><Label>Serviço</Label>
                <Select name="serviceType" defaultValue="Branding">
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{SERVICE_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2"><Label>Descrição</Label><Textarea name="description" className="mt-1.5" rows={2} /></div>
              <div><Label>Status</Label>
                <Select name="status" defaultValue="planning">
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROJECT_STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Prioridade</Label>
                <Select name="priority" defaultValue="medium">
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROJECT_PRIORITY_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Data início</Label><Input name="startDate" type="date" className="mt-1.5" /></div>
              <div><Label>Prazo</Label><Input name="dueDate" type="date" className="mt-1.5" /></div>
              <div><Label>Orçamento (R$)</Label><Input name="budget" type="number" min="0" step="100" className="mt-1.5" /></div>
              <div className="sm:col-span-2"><Label>Tags (vírgulas)</Label><Input name="tags" className="mt-1.5" placeholder="branding, landing" /></div>
              <DialogFooter className="sm:col-span-2 mt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" className="orbit-gradient hover:opacity-90">Criar projeto</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Etapa 5 · Flip Projetos (item 2) — seletor de fonte, mesmo padrão de
          "Fonte dos orçamentos" (QuotesSection.tsx)/"Fonte do CRM" (CRM.tsx). */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card/30">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Fonte dos projetos:</span>
          {dataSource === "supabase" && (
            <Badge variant="outline" className="text-[10px] uppercase font-mono py-0 text-primary border-primary/30 bg-primary/5">
              Modo leitura
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSourceChange("local")}
            className={`text-xs px-3 h-8 rounded-md border transition ${
              dataSource === "local"
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-foreground hover:bg-muted/40"
            }`}
          >
            Local
          </button>
          <button
            type="button"
            onClick={() => handleSourceChange("supabase")}
            className={`text-xs px-3 h-8 rounded-md border transition ${
              dataSource === "supabase"
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-foreground hover:bg-muted/40"
            }`}
          >
            Supabase experimental
          </button>
        </div>
      </div>

      {dataSource === "supabase" && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg border border-primary/20 bg-primary/5 text-xs text-foreground">
          <Cloud className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
          <div className="flex-1">
            <span className="font-semibold block">Projetos em modo leitura (Supabase)</span>
            <span className="text-muted-foreground">
              Escrita ainda chega numa próxima fatia — volte para "Local" para editar.
            </span>
          </div>
        </div>
      )}

      {dataSource === "supabase" && supabaseLoading && (
        <p className="text-xs text-muted-foreground">Carregando projetos do Supabase...</p>
      )}
      {dataSource === "supabase" && supabaseError && (
        <p className="text-xs text-destructive">Erro ao carregar projetos do Supabase: {supabaseError}</p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="orbit-card p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className={`h-4 w-4 ${c.accent}`} />{c.label}</div>
              <p className="text-lg font-bold text-foreground mt-1">{c.value}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar projeto ou cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {Object.entries(PROJECT_STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterService} onValueChange={setFilterService}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Serviço" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos serviços</SelectItem>
            {SERVICE_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {Object.entries(PROJECT_PRIORITY_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((p) => {
          const isHL = highlightId === p.id;
          const fromQuote = p.source === "orçamento";
          const deliverables = p.deliverables ?? [];
          const nextDeliverable = deliverables.find((d) => d.status !== "concluido");
          return (
            <div
              key={p.id}
              ref={(el) => { cardRefs.current[p.id] = el; }}
              role="button"
              tabIndex={0}
              onClick={() => setDetailId(p.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetailId(p.id); } }}
              className={`orbit-card p-4 space-y-3 hover:orbit-glow transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40 ${isHL ? "ring-2 ring-primary/60 orbit-glow" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground truncate">{p.name}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><User className="h-3 w-3" />{p.clientName}{p.company && ` · ${p.company}`}</p>
                </div>
                {p.isDemo && <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">demo</Badge>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className={`text-[10px] ${statusBadge[p.status]}`}>{PROJECT_STATUS_LABEL[p.status]}</Badge>
                <Badge variant="outline" className={`text-[10px] ${priorityBadge[p.priority]}`}>{PROJECT_PRIORITY_LABEL[p.priority]}</Badge>
                {p.serviceType && <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">{p.serviceType}</Badge>}
                {fromQuote ? (
                  <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/10 inline-flex items-center gap-1">
                    <Link2 className="h-3 w-3" /> Orçamento
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">Manual</Badge>
                )}
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Progresso</span><span>{p.progress}%</span>
                </div>
                <Progress value={p.progress} />
              </div>
              {deliverables.length > 0 && (
                <div className="text-[11px] text-muted-foreground">
                  {nextDeliverable
                    ? <>Próxima entrega: <span className="text-foreground">{nextDeliverable.title}</span></>
                    : <>{deliverables.length} entregáveis concluídos</>}
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(p.dueDate)}</span>
                <span className="font-medium text-foreground">{fmtBRL(p.budget)}</span>
              </div>
              {p.quoteId && (
                <div className="pt-2 border-t border-border/40">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); navigate(`/vendas?tab=orcamentos`); }}
                    className="text-[11px] inline-flex items-center gap-1 text-primary hover:underline"
                    title="Abrir orçamento vinculado"
                  >
                    <FileText className="h-3 w-3" /> Ver orçamento{p.quoteTitle ? ` — ${p.quoteTitle}` : ""}
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3 orbit-card p-10 text-center text-muted-foreground">
            <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" /> Nenhum projeto encontrado.
          </div>
        )}
      </div>

      <ProjectDetailDrawer
        project={detailProject}
        open={!!detailProject}
        onOpenChange={(v) => { if (!v) setDetailId(null); }}
        dataSource={dataSource}
      />
    </div>
  );
}
