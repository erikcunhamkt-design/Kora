import { PageHeader } from "@/components/layout/PageHeader";
import { useState, useEffect, useMemo, useCallback } from "react";
import { formatDateTime as intlDateTime } from "@/lib/format";
import { useSearchParams } from "react-router-dom";
import { usePlan } from "@/contexts/PlanContext";
import { UsageBadge } from "@/components/plan/UsageBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Search, LayoutList, LayoutGrid, Clock, Calendar,
  MoreHorizontal, GripVertical, CheckCircle2, AlertCircle, Timer,
  Briefcase, Tag, MessageSquare, ListChecks, CalendarDays, CircleDot, Flag,
  Inbox, Archive, Copy, Trash2, Sparkles, ChevronRight, Filter, Sun, CalendarRange,
  Bell, BellRing, BellOff, FolderKanban, User, Pencil, FolderPlus, Move,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  useTasks, type Task, type TaskStatus, type TaskPriority, type TaskRecurrence, type TaskScope,
  toIsoDate, formatPtBr,
} from "@/hooks/useTasks";
import { useTaskProjects, type TaskProject, type TaskProjectType } from "@/hooks/useTaskProjects";
import {
  useTaskReminders, computeReminderAt, REMINDER_PRESET_LABELS, type ReminderPreset,
} from "@/hooks/useTaskReminders";
import { toast } from "@/hooks/use-toast";

/* ------------------------------------------------------------------ */
/*  Constantes & helpers                                              */
/* ------------------------------------------------------------------ */

type ViewKey =
  | "hoje" | "proximos" | "entrada" | "atrasadas" | "minhas"
  | "sem-projeto" | "concluidas" | "arquivadas" | "kanban";

interface ColumnConfig { key: TaskStatus; label: string; dotColor: string; accent: string; }
const columns: ColumnConfig[] = [
  { key: "a_fazer",       label: "A fazer",       dotColor: "bg-primary",       accent: "border-primary/50" },
  { key: "em_andamento",  label: "Em andamento",  dotColor: "bg-amber-500",     accent: "border-amber-500/50" },
  { key: "revisao",       label: "Revisão",       dotColor: "bg-sky-500",       accent: "border-sky-500/50" },
  { key: "concluido",     label: "Concluído",     dotColor: "bg-emerald-500",   accent: "border-emerald-500/50" },
];

const statusLabels: Record<TaskStatus, string> = {
  a_fazer: "A fazer", em_andamento: "Em andamento", revisao: "Revisão", concluido: "Concluído",
};
const statusBadgeStyle: Record<TaskStatus, string> = {
  a_fazer: "bg-primary/25 text-white border-primary/35 border",
  em_andamento: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  revisao: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  concluido: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const priorityMeta: Record<TaskPriority, { label: string; short: string; badge: string; flag: string; ring: string }> = {
  alta:  { label: "Alta",  short: "P1", badge: "bg-destructive/10 text-destructive border-destructive/25", flag: "text-destructive", ring: "ring-destructive/60" },
  média: { label: "Média", short: "P2", badge: "bg-amber-500/10 text-amber-400 border-amber-500/25",      flag: "text-amber-400",   ring: "ring-amber-500/50" },
  baixa: { label: "Baixa", short: "P3", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25", flag: "text-emerald-400", ring: "ring-emerald-500/50" },
};

const recurrenceLabels: Record<TaskRecurrence, string> = {
  none: "Sem recorrência", daily: "Diária", weekly: "Semanal", monthly: "Mensal", weekdays: "Dias úteis",
};

const clientsList = ["Acme Corp", "Studio Zen", "Nova Design", "FitTrack", "Café & Arte", "Brand Co", "StartUp X"];

const TODAY_ISO = toIsoDate(new Date());

const addDaysIso = (n: number) => {
  const d = new Date(); d.setDate(d.getDate() + n); return toIsoDate(d);
};
const TOMORROW_ISO = addDaysIso(1);
const WEEK_END_ISO = addDaysIso(7);
const NEXT_WEEK_END_ISO = addDaysIso(14);

function getDueIso(t: Task): string | undefined { return t.dueDate; }
function isOverdue(t: Task) {
  const d = getDueIso(t); return !!d && d < TODAY_ISO && t.status !== "concluido";
}
function isToday(t: Task) { return getDueIso(t) === TODAY_ISO; }
function dueBucket(t: Task): "atrasada" | "hoje" | "amanha" | "semana" | "proxima" | "futuro" | "sem-data" {
  const d = getDueIso(t);
  if (!d) return "sem-data";
  if (d < TODAY_ISO) return "atrasada";
  if (d === TODAY_ISO) return "hoje";
  if (d === TOMORROW_ISO) return "amanha";
  if (d <= WEEK_END_ISO) return "semana";
  if (d <= NEXT_WEEK_END_ISO) return "proxima";
  return "futuro";
}

/* Parser leve para captura rápida: "Texto p1 #tag" */
function parseQuick(text: string): { title: string; priority: TaskPriority; tags: string[] } {
  let title = text.trim();
  let priority: TaskPriority = "média";
  const tags: string[] = [];
  const pm = title.match(/(?:^|\s)p([123])(?=\s|$)/i);
  if (pm) {
    priority = pm[1] === "1" ? "alta" : pm[1] === "2" ? "média" : "baixa";
    title = (title.slice(0, pm.index!) + title.slice(pm.index! + pm[0].length)).trim();
  }
  const tagRe = /#([\p{L}\d_-]+)/gu;
  let tm: RegExpExecArray | null;
  while ((tm = tagRe.exec(text))) tags.push(tm[1]);
  title = title.replace(tagRe, "").replace(/\s+/g, " ").trim();
  return { title, priority, tags };
}

/* ------------------------------------------------------------------ */
/*  Mini componentes                                                  */
/* ------------------------------------------------------------------ */

const MetricChip = ({ icon: Icon, label, value, tone = "default", active, onClick }: {
  icon: LucideIcon; label: string; value: number;
  tone?: "default" | "danger" | "warn" | "success" | "info";
  active?: boolean; onClick?: () => void;
}) => {
  const tones: Record<string, string> = {
    default: "text-foreground",
    danger:  "text-destructive",
    warn:    "text-amber-400",
    success: "text-emerald-400",
    info:    "text-sky-400",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "orbit-card px-3 py-2.5 flex items-center gap-2.5 text-left transition-all hover:border-primary/30",
        active && "border-primary/50 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]",
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", tones[tone])} />
      <div className="min-w-0">
        <p className="text-[10.5px] uppercase tracking-wider text-muted-foreground leading-none">{label}</p>
        <p className={cn("text-base font-semibold leading-tight mt-0.5", tones[tone])}>{value}</p>
      </div>
    </button>
  );
};

const ViewChip = ({ label, count, active, onClick, icon: Icon }: {
  label: string; count?: number; active?: boolean; onClick: () => void; icon: LucideIcon;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "inline-flex items-center gap-2 h-9 px-3 rounded-lg text-sm whitespace-nowrap transition-all border",
      active
        ? "bg-primary text-white border-0 shadow-md shadow-primary/20 hover:bg-primary/90"
        : "bg-card text-muted-foreground border-border/60 hover:text-foreground hover:border-border",
    )}
  >
    <Icon className="h-3.5 w-3.5" />
    <span className="font-medium">{label}</span>
    {typeof count === "number" && (
      <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full",
        active ? "bg-white/20 text-white font-medium" : "bg-muted text-muted-foreground")}>
        {count}
      </span>
    )}
  </button>
);

/* ------------------------------------------------------------------ */
/*  Página                                                            */
/* ------------------------------------------------------------------ */

const Tarefas = () => {
  const {
    tasks, addTask, updateTask, moveTask, toggleSubtask, addSubtask,
    duplicateTask, archiveTask, deleteTask,
  } = useTasks();
  const {
    projects: taskProjects, addProject: addTaskProject, renameProject: renameTaskProject,
    archiveProject: archiveTaskProject, deleteProject: deleteTaskProject,
  } = useTaskProjects();
  const { wouldExceed, showPaywall, setUsage } = usePlan();

  const [view, setView] = useState<ViewKey>("hoje");
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTag, setFilterTag] = useState("all");
  const [filterScope, setFilterScope] = useState<"all" | TaskScope>("all");
  const [filterTaskProject, setFilterTaskProject] = useState<string>("all");
  const [quick, setQuick] = useState("");
  const [quickDate, setQuickDate] = useState<string>("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Task | null>(null);
  const [projectsOpen, setProjectsOpen] = useState(false);

  // Reminders locais (Notification API + fallback toast)
  const { permission, requestPermission, supported: notifSupported } = useTaskReminders(
    tasks,
    (id, sentAt) => updateTask(id, { reminderSentAt: sentAt }),
  );

  const realTaskCount = tasks.filter(t => !t.isDemo).length;
  useEffect(() => { setUsage("tasks", realTaskCount); }, [realTaskCount, setUsage]);

  /* Re-sincroniza o item selecionado quando a lista muda */
  useEffect(() => {
    if (!selectedTask) return;
    const fresh = tasks.find(t => t.id === selectedTask.id);
    if (fresh && fresh !== selectedTask) setSelectedTask(fresh);
  }, [tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  // Deep link: /tarefas?task=<id>
  const [searchParams, setSearchParams] = useSearchParams();
  const [highlightedTaskId, setHighlightedTaskId] = useState<number | null>(null);
  useEffect(() => {
    const raw = searchParams.get("task");
    if (!raw) return;
    const id = Number(raw);
    if (!Number.isFinite(id)) return;
    const found = tasks.find(t => t.id === id);
    if (found) {
      setSelectedTask(found);
      setHighlightedTaskId(id);
    }
  }, [searchParams, tasks]);

  useEffect(() => {
    if (highlightedTaskId === null) return;
    const t = setTimeout(() => setHighlightedTaskId(null), 4000);
    return () => clearTimeout(t);
  }, [highlightedTaskId]);

  const clearTaskParam = () => {
    if (!searchParams.get("task")) return;
    const next = new URLSearchParams(searchParams);
    next.delete("task");
    setSearchParams(next, { replace: true });
  };

  const allTags = useMemo(() => {
    const s = new Set<string>();
    tasks.forEach(t => t.tags.forEach(tg => s.add(tg)));
    return Array.from(s).sort();
  }, [tasks]);

  /* ---------------- Counters por visão ---------------- */
  const counts = useMemo(() => {
    const active = tasks.filter(t => !t.archived);
    return {
      hoje: active.filter(t => isToday(t) && t.status !== "concluido").length,
      proximos: active.filter(t => {
        const d = getDueIso(t); return d && d > TODAY_ISO && t.status !== "concluido";
      }).length,
      entrada: active.filter(t => (!t.project || t.project.trim() === "") && t.status !== "concluido").length,
      atrasadas: active.filter(isOverdue).length,
      minhas: active.filter(t => t.status !== "concluido").length,
      "sem-projeto": active.filter(t => !t.project || t.project.trim() === "").length,
      concluidas: active.filter(t => t.status === "concluido").length,
      arquivadas: tasks.filter(t => t.archived).length,
      kanban: active.length,
    };
  }, [tasks]);

  /* ---------------- Métricas topo ---------------- */
  const metrics = useMemo(() => {
    const active = tasks.filter(t => !t.archived);
    return {
      hoje: counts.hoje,
      atrasadas: counts.atrasadas,
      inProgress: active.filter(t => t.status === "em_andamento").length,
      done: active.filter(t => t.status === "concluido").length,
      high: active.filter(t => t.priority === "alta" && t.status !== "concluido").length,
    };
  }, [tasks, counts]);

  /* ---------------- Pipeline de filtros ---------------- */
  const visibleTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter(t => {
      // Visão
      if (view === "arquivadas") {
        if (!t.archived) return false;
      } else if (t.archived) return false;

      switch (view) {
        case "hoje":
          if (!(isToday(t) && t.status !== "concluido") && !isOverdue(t)) return false;
          break;
        case "proximos": {
          const d = getDueIso(t);
          if (!d || d <= TODAY_ISO || t.status === "concluido") return false;
          break;
        }
        case "entrada":
          if (t.project && t.project.trim() !== "") return false;
          if (t.status === "concluido") return false;
          break;
        case "atrasadas":
          if (!isOverdue(t)) return false;
          break;
        case "minhas":
          if (t.status === "concluido") return false;
          break;
        case "sem-projeto":
          if (t.project && t.project.trim() !== "") return false;
          break;
        case "concluidas":
          if (t.status !== "concluido") return false;
          break;
        case "kanban": break;
      }

      // Filtros
      if (q && !t.title.toLowerCase().includes(q) && !t.client.toLowerCase().includes(q) && !t.project.toLowerCase().includes(q)) return false;
      if (filterClient !== "all" && t.client !== filterClient) return false;
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterTag !== "all" && !t.tags.includes(filterTag)) return false;
      if (filterScope !== "all" && (t.scope ?? "work") !== filterScope) return false;
      if (filterTaskProject !== "all" && (t.taskProjectId ?? "tp-noproject") !== filterTaskProject) return false;
      return true;
    });
  }, [tasks, view, search, filterClient, filterPriority, filterStatus, filterTag, filterScope, filterTaskProject]);

  /* ---------------- Ações ---------------- */
  const handleQuickCreate = () => {
    const text = quick.trim();
    if (!text) return;
    if (wouldExceed("maxTasks", realTaskCount)) { showPaywall("tasks"); return; }
    const { title, priority, tags } = parseQuick(text);
    const dueIso = quickDate || undefined;
    addTask({
      title, description: "", client: "", project: "",
      priority, status: "a_fazer",
      deadline: dueIso ? formatPtBr(dueIso) : "—",
      dueDate: dueIso,
      tags, subtasks: [], comments: [], recurrence: "none", archived: false,
    });
    setQuick(""); setQuickDate("");
    toast({ title: "Tarefa adicionada", description: title });
  };

  const handleNewTask = () => {
    if (wouldExceed("maxTasks", realTaskCount)) { showPaywall("tasks"); return; }
    setNewTaskOpen(true);
  };

  const handleToggleComplete = useCallback((t: Task) => {
    moveTask(t.id, t.status === "concluido" ? "a_fazer" : "concluido");
  }, [moveTask]);

  const handleDrop = (status: TaskStatus) => {
    if (draggedId !== null) { moveTask(draggedId, status); setDraggedId(null); }
  };

  /* ---------------- Render ---------------- */
  return (
    <div className="space-y-5">
      <PageHeader
        title="Tarefas"
        subtitle="Capture, priorize e acompanhe tudo que precisa ser feito"
        actions={
          <>
            <UsageBadge resource="tasks" label="tarefas" />
            {permission !== "granted" && (
              <Button variant="outline" onClick={requestPermission} className="gap-2" title="Ativar lembretes locais">
                {permission === "denied" ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                <span className="hidden sm:inline">Ativar notificações</span>
              </Button>
            )}
            <Button variant="outline" onClick={() => setProjectsOpen(true)} className="gap-2">
              <FolderKanban className="h-4 w-4" />
              <span className="hidden sm:inline">Projetos</span>
            </Button>
            <Button onClick={handleNewTask} className="orbit-gradient text-white border-0 gap-2 shrink-0">
              <Plus className="h-4 w-4" /> Nova tarefa
            </Button>
          </>
        }
      />
      {permission === "denied" && (
        <p className="text-[11px] text-muted-foreground -mt-3">
          Notificações bloqueadas. Para reativar, ajuste as permissões do site no seu navegador. Lembretes locais funcionam enquanto o app estiver aberto — integração com Google Calendar será adicionada em uma etapa futura.
        </p>
      )}

      {/* Métricas compactas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <MetricChip icon={Sun} label="Hoje" value={metrics.hoje} active={view === "hoje"} onClick={() => setView("hoje")} />
        <MetricChip icon={AlertCircle} label="Atrasadas" value={metrics.atrasadas} tone="danger" active={view === "atrasadas"} onClick={() => setView("atrasadas")} />
        <MetricChip icon={Timer} label="Em andamento" value={metrics.inProgress} tone="warn" />
        <MetricChip icon={CheckCircle2} label="Concluídas" value={metrics.done} tone="success" active={view === "concluidas"} onClick={() => setView("concluidas")} />
        <MetricChip icon={Flag} label="Alta prioridade" value={metrics.high} tone="danger" />
      </div>

      {/* Captura rápida */}
      <div className="orbit-card p-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/70" />
          <Input
            id="quick-capture"
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleQuickCreate(); } }}
            placeholder="Adicionar tarefa: Ex. Revisar proposta amanhã #Acme p1"
            className="pl-9 bg-muted/40"
          />
        </div>
        <div className="flex gap-2">
          <Input
            type="date"
            value={quickDate}
            onChange={(e) => setQuickDate(e.target.value)}
            className="bg-muted/40 w-[150px]"
          />
          <Button onClick={handleQuickCreate} className="orbit-gradient text-white border-0 gap-1.5 shrink-0">
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </div>
      </div>

      {/* Chips de visão */}
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        <ViewChip icon={Sun}          label="Hoje"           count={counts.hoje}        active={view === "hoje"}        onClick={() => setView("hoje")} />
        <ViewChip icon={CalendarRange} label="Próximos"      count={counts.proximos}    active={view === "proximos"}    onClick={() => setView("proximos")} />
        <ViewChip icon={Inbox}        label="Entrada"        count={counts.entrada}     active={view === "entrada"}     onClick={() => setView("entrada")} />
        <ViewChip icon={AlertCircle}  label="Atrasadas"      count={counts.atrasadas}   active={view === "atrasadas"}   onClick={() => setView("atrasadas")} />
        <ViewChip icon={ListChecks}   label="Minhas tarefas" count={counts.minhas}      active={view === "minhas"}      onClick={() => setView("minhas")} />
        <ViewChip icon={Briefcase}    label="Sem projeto"    count={counts["sem-projeto"]} active={view === "sem-projeto"} onClick={() => setView("sem-projeto")} />
        <ViewChip icon={CheckCircle2} label="Concluídas"     count={counts.concluidas}  active={view === "concluidas"}  onClick={() => setView("concluidas")} />
        <ViewChip icon={Archive}      label="Arquivadas"     count={counts.arquivadas}  active={view === "arquivadas"}  onClick={() => setView("arquivadas")} />
        <ViewChip icon={LayoutGrid}   label="Kanban"         count={counts.kanban}      active={view === "kanban"}      onClick={() => setView("kanban")} />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar título, cliente ou projeto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-muted/40 h-10"
          />
        </div>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[120px] bg-muted/40 h-10"><SelectValue placeholder="Prio." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Prioridades</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="média">Média</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[130px] bg-muted/40 h-10"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Status</SelectItem>
            {columns.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-[140px] bg-muted/40 h-10"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent className="max-h-[280px]">
            <SelectItem value="all">Clientes</SelectItem>
            {clientsList.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterTag} onValueChange={setFilterTag}>
          <SelectTrigger className="w-[130px] bg-muted/40 h-10"><SelectValue placeholder="Etiqueta" /></SelectTrigger>
          <SelectContent className="max-h-[280px]">
            <SelectItem value="all">Etiquetas</SelectItem>
            {allTags.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterScope} onValueChange={(v) => setFilterScope(v as "all" | TaskScope)}>
          <SelectTrigger className="w-[130px] bg-muted/40 h-10"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="work">Trabalho</SelectItem>
            <SelectItem value="personal">Pessoais</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterTaskProject} onValueChange={setFilterTaskProject}>
          <SelectTrigger className="w-[160px] bg-muted/40 h-10"><SelectValue placeholder="Projeto" /></SelectTrigger>
          <SelectContent className="max-h-[280px]">
            <SelectItem value="all">Todos os projetos</SelectItem>
            {taskProjects.filter(p => !p.archived).map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search || filterClient !== "all" || filterPriority !== "all" || filterStatus !== "all" || filterTag !== "all" || filterScope !== "all" || filterTaskProject !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => {
            setSearch(""); setFilterClient("all"); setFilterPriority("all"); setFilterStatus("all"); setFilterTag("all");
            setFilterScope("all"); setFilterTaskProject("all");
          }}>
            Limpar
          </Button>
        )}
      </div>

      {/* Conteúdo */}
      {view === "kanban" ? (
        <KanbanView
          tasks={visibleTasks}
          taskProjects={taskProjects}
          draggedId={draggedId}
          setDraggedId={setDraggedId}
          onSelect={setSelectedTask}
          onDrop={handleDrop}
          highlightedTaskId={highlightedTaskId}
        />
      ) : (
        <ListView
          view={view}
          tasks={visibleTasks}
          taskProjects={taskProjects}
          onSelect={setSelectedTask}
          highlightedTaskId={highlightedTaskId}
          onToggleComplete={handleToggleComplete}
          onArchive={(id) => archiveTask(id, true)}
          onUnarchive={(id) => archiveTask(id, false)}
          onDuplicate={duplicateTask}
          onDelete={(t) => setConfirmDelete(t)}
          onMoveToProject={(taskId, projectId) => {
            const p = taskProjects.find(x => x.id === projectId);
            updateTask(taskId, { taskProjectId: projectId, scope: p?.type === "personal" ? "personal" : "work" });
            toast({ title: "Tarefa movida", description: p?.name });
          }}
        />
      )}

      <NewTaskDialog
        open={newTaskOpen}
        onOpenChange={setNewTaskOpen}
        onCreate={addTask}
        taskProjects={taskProjects}
      />
      <TaskDetailSheet
        task={selectedTask}
        taskProjects={taskProjects}
        onClose={() => { setSelectedTask(null); clearTaskParam(); }}
        onMove={moveTask}
        onToggleSubtask={toggleSubtask}
        onAddSubtask={addSubtask}
        onUpdate={updateTask}
        onDuplicate={(id) => { duplicateTask(id); toast({ title: "Tarefa duplicada" }); }}
        onArchive={(id, v) => { archiveTask(id, v); toast({ title: v ? "Tarefa arquivada" : "Tarefa restaurada" }); setSelectedTask(null); }}
        onDelete={(t) => setConfirmDelete(t)}
      />

      <ProjectsSheet
        open={projectsOpen}
        onOpenChange={setProjectsOpen}
        projects={taskProjects}
        tasks={tasks}
        onAdd={(name, type) => { addTaskProject({ name, type }); }}
        onRename={renameTaskProject}
        onArchive={archiveTaskProject}
        onDelete={(id) => {
          const used = tasks.some(t => (t.taskProjectId ?? "tp-noproject") === id);
          if (used) {
            const ok = window.confirm("Este projeto contém tarefas. Excluir mesmo assim? As tarefas serão movidas para Sem projeto.");
            if (!ok) return;
            tasks.forEach(t => {
              if ((t.taskProjectId ?? "tp-noproject") === id) updateTask(t.id, { taskProjectId: "tp-noproject" });
            });
          }
          deleteTaskProject(id);
          toast({ title: "Projeto excluído" });
        }}
        onFilter={(id) => { setFilterTaskProject(id); setProjectsOpen(false); }}
      />


      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.isDemo
                ? "Esta é uma tarefa de demonstração e não pode ser excluída — você pode arquivá-la."
                : `"${confirmDelete?.title}" será removida permanentemente.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {!confirmDelete?.isDemo && (
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={() => {
                  if (confirmDelete) {
                    deleteTask(confirmDelete.id);
                    toast({ title: "Tarefa excluída" });
                    setSelectedTask(prev => prev?.id === confirmDelete.id ? null : prev);
                  }
                  setConfirmDelete(null);
                }}
              >
                Excluir
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Lista                                                             */
/* ------------------------------------------------------------------ */

const ListView = ({
  view, tasks, taskProjects, onSelect, onToggleComplete, onArchive, onUnarchive, onDuplicate, onDelete, onMoveToProject, highlightedTaskId,
}: {
  view: ViewKey;
  tasks: Task[];
  taskProjects: TaskProject[];
  onSelect: (t: Task) => void;
  onToggleComplete: (t: Task) => void;
  onArchive: (id: number) => void;
  onUnarchive: (id: number) => void;
  onDuplicate: (id: number) => void;
  onDelete: (t: Task) => void;
  onMoveToProject: (taskId: number, projectId: string) => void;
  highlightedTaskId?: number | null;
}) => {
  const groups = useMemo(() => {
    const g: { key: string; label: string; items: Task[] }[] = [];
    const push = (key: string, label: string, items: Task[]) => {
      if (items.length) g.push({ key, label, items });
    };

    if (view === "hoje") {
      push("atrasadas", "Atrasadas", tasks.filter(isOverdue).sort(sortByDue));
      push("hoje", "Hoje", tasks.filter(t => isToday(t) && t.status !== "concluido").sort(sortByPriority));
      push("sem-data", "Sem prazo", tasks.filter(t => !getDueIso(t) && t.status !== "concluido").sort(sortByPriority));
    } else if (view === "proximos") {
      push("amanha",  "Amanhã",        tasks.filter(t => dueBucket(t) === "amanha").sort(sortByDue));
      push("semana",  "Esta semana",   tasks.filter(t => dueBucket(t) === "semana").sort(sortByDue));
      push("proxima", "Próxima semana", tasks.filter(t => dueBucket(t) === "proxima").sort(sortByDue));
      push("futuro",  "Futuro",        tasks.filter(t => dueBucket(t) === "futuro").sort(sortByDue));
    } else if (view === "entrada") {
      push("entrada", "Entrada", [...tasks].sort(sortByCreated));
    } else {
      push("all", "", [...tasks].sort(sortByDueOrPriority));
    }
    return g;
  }, [tasks, view]);

  if (!tasks.length) {
    return <EmptyState view={view} />;
  }

  return (
    <div className="space-y-6">
      {view === "entrada" && (
        <p className="text-xs text-muted-foreground -mt-2">Capture rápido agora, organize depois.</p>
      )}
      {groups.map(group => (
        <div key={group.key} className="space-y-2">
          {group.label && (
            <div className="flex items-center justify-between px-1">
              <h3 className={cn(
                "text-xs font-semibold uppercase tracking-wider",
                group.key === "atrasadas" ? "text-destructive" : "text-muted-foreground",
              )}>
                {group.label}
              </h3>
              <span className="text-[10px] text-muted-foreground">{group.items.length}</span>
            </div>
          )}
          <div className="orbit-card divide-y divide-border/60 overflow-hidden">
            {group.items.map(t => (
              <TaskRow
                key={t.id}
                task={t}
                taskProjects={taskProjects}
                onSelect={onSelect}
                onToggleComplete={onToggleComplete}
                onArchive={onArchive}
                onUnarchive={onUnarchive}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                onMoveToProject={onMoveToProject}
                highlighted={highlightedTaskId === t.id}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const sortByDue = (a: Task, b: Task) => (getDueIso(a) || "9999").localeCompare(getDueIso(b) || "9999");
const PRIO_ORDER: Record<TaskPriority, number> = { alta: 0, média: 1, baixa: 2 };
const sortByPriority = (a: Task, b: Task) => PRIO_ORDER[a.priority] - PRIO_ORDER[b.priority];
const sortByCreated = (a: Task, b: Task) => b.id - a.id;
const sortByDueOrPriority = (a: Task, b: Task) => {
  const ad = getDueIso(a), bd = getDueIso(b);
  if (ad && bd) return ad.localeCompare(bd);
  if (ad) return -1;
  if (bd) return 1;
  return PRIO_ORDER[a.priority] - PRIO_ORDER[b.priority];
};

/* ------------------------------------------------------------------ */
/*  Linha da lista                                                    */
/* ------------------------------------------------------------------ */

const TaskRow = ({
  task, taskProjects, onSelect, onToggleComplete, onArchive, onUnarchive, onDuplicate, onDelete, onMoveToProject, highlighted,
}: {
  task: Task;
  taskProjects: TaskProject[];
  onSelect: (t: Task) => void;
  onToggleComplete: (t: Task) => void;
  onArchive: (id: number) => void;
  onUnarchive: (id: number) => void;
  onDuplicate: (id: number) => void;
  onDelete: (t: Task) => void;
  onMoveToProject: (taskId: number, projectId: string) => void;
  highlighted?: boolean;
}) => {
  const done = task.status === "concluido";
  const overdue = isOverdue(task);
  const subsDone = task.subtasks.filter(s => s.done).length;
  const prio = priorityMeta[task.priority];
  const isPersonal = (task.scope ?? "work") === "personal";
  const tProj = taskProjects.find(p => p.id === (task.taskProjectId ?? "tp-noproject"));

  return (
    <div
      className={cn(
        "group flex items-start gap-3 px-3 sm:px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors",
        done && "opacity-60",
        highlighted && "bg-primary/5 ring-2 ring-primary/30",
      )}
      onClick={() => onSelect(task)}
    >
      {/* Checkbox grande */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleComplete(task); }}
        className={cn(
          "mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0",
          done
            ? "bg-emerald-500 border-emerald-500 text-white"
            : `border-border hover:ring-2 ${prio.ring}`,
        )}
        aria-label={done ? "Reabrir" : "Concluir"}
      >
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Flag className={cn("h-2.5 w-2.5 opacity-0 group-hover:opacity-100", prio.flag)} />}
      </button>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm font-medium leading-snug", done ? "line-through text-muted-foreground" : "text-foreground")}>
            {task.title}
          </p>
          <Badge variant="outline" className={cn("text-[10px] shrink-0 h-5", prio.badge)}>
            <Flag className={cn("h-2.5 w-2.5 mr-1", prio.flag)} /> {prio.short}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-muted-foreground">
          {task.client && (
            <span className="inline-flex items-center gap-1 max-w-[160px] truncate">
              <CircleDot className="h-3 w-3" /> {task.client}
            </span>
          )}
          {task.project && (
            <span className="inline-flex items-center gap-1 max-w-[180px] truncate">
              <Briefcase className="h-3 w-3" /> {task.project}
            </span>
          )}
          {task.subtasks.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <ListChecks className="h-3 w-3" /> {subsDone}/{task.subtasks.length}
            </span>
          )}
          <span className={cn(
            "inline-flex items-center gap-1",
            overdue && "text-destructive font-medium",
          )}>
            <Clock className="h-3 w-3" /> {task.dueDate ? formatPtBr(task.dueDate) : (task.deadline && task.deadline !== "—" ? task.deadline : "Sem prazo")}
          </span>
          <Badge variant="outline" className={cn("text-[10px] h-4.5 py-0", statusBadgeStyle[task.status])}>
            {statusLabels[task.status]}
          </Badge>
          {isPersonal && (
            <Badge variant="outline" className="text-[10px] h-4.5 py-0 bg-pink-500/10 text-pink-400 border-pink-500/25">
              <User className="h-2.5 w-2.5 mr-1" /> Pessoal
            </Badge>
          )}
          {tProj && tProj.id !== "tp-noproject" && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: tProj.color }} />
              {tProj.name}
            </span>
          )}
          {task.reminderEnabled && task.reminderAt && (
            <span className="inline-flex items-center gap-1 text-[10px] text-primary">
              <BellRing className="h-3 w-3" />
              {intlDateTime(task.reminderAt, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {task.tags.slice(0, 3).map(tg => (
            <span key={tg} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">#{tg}</span>
          ))}
        </div>
      </div>

      {/* Ações */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 shrink-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => onSelect(task)}>
            <ChevronRight className="h-4 w-4 mr-2" /> Abrir
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onToggleComplete(task)}>
            <CheckCircle2 className="h-4 w-4 mr-2" /> {done ? "Reabrir" : "Concluir"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDuplicate(task.id)}>
            <Copy className="h-4 w-4 mr-2" /> Duplicar
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Move className="h-4 w-4 mr-2" /> Mover para projeto
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {taskProjects.filter(p => !p.archived).map(p => (
                <DropdownMenuItem key={p.id} onClick={() => onMoveToProject(task.id, p.id)}>
                  <span className="h-2 w-2 rounded-full mr-2" style={{ background: p.color }} />
                  {p.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          {task.archived ? (
            <DropdownMenuItem onClick={() => onUnarchive(task.id)}>
              <Archive className="h-4 w-4 mr-2" /> Restaurar
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => onArchive(task.id)}>
              <Archive className="h-4 w-4 mr-2" /> Arquivar
            </DropdownMenuItem>
          )}
          <DropdownMenuItem className="text-destructive" onClick={() => onDelete(task)}>
            <Trash2 className="h-4 w-4 mr-2" /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Estado vazio                                                      */
/* ------------------------------------------------------------------ */

const EmptyState = ({ view }: { view: ViewKey }) => {
  const map: Record<ViewKey, { title: string; sub: string; icon: LucideIcon }> = {
    hoje:       { title: "Nada urgente agora.", sub: "Você está livre para focar no que importa.", icon: Sun },
    proximos:   { title: "Nada agendado pra frente.", sub: "Capture algo novo na barra acima.", icon: CalendarRange },
    entrada:    { title: "Entrada limpa.", sub: "Capture rápido agora, organize depois.", icon: Inbox },
    atrasadas:  { title: "Sem atrasos. 👏", sub: "Continue assim.", icon: CheckCircle2 },
    minhas:     { title: "Nenhuma tarefa ativa.", sub: "Crie uma nova para começar.", icon: ListChecks },
    "sem-projeto": { title: "Tudo organizado em projetos.", sub: "Boa!", icon: Briefcase },
    concluidas: { title: "Nada concluído ainda.", sub: "Suas vitórias aparecerão aqui.", icon: CheckCircle2 },
    arquivadas: { title: "Arquivo vazio.", sub: "Tarefas arquivadas ficam por aqui.", icon: Archive },
    kanban:     { title: "Nenhuma tarefa.", sub: "Crie uma para usar o Kanban.", icon: LayoutGrid },
  };
  const m = map[view];
  return (
    <div className="orbit-card p-10 flex flex-col items-center text-center gap-3">
      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
        <m.icon className="h-6 w-6 text-primary" />
      </div>
      <div>
        <p className="text-base font-semibold text-foreground">{m.title}</p>
        <p className="text-sm text-muted-foreground mt-1">{m.sub}</p>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Kanban                                                            */
/* ------------------------------------------------------------------ */

const KanbanView = ({ tasks, taskProjects, draggedId, setDraggedId, onSelect, onDrop, highlightedTaskId }: {
  tasks: Task[];
  taskProjects: TaskProject[];
  draggedId: number | null;
  setDraggedId: (n: number | null) => void;
  onSelect: (t: Task) => void;
  onDrop: (status: TaskStatus) => void;
  highlightedTaskId?: number | null;
}) => (
  <div className="w-full max-w-full overflow-x-auto overflow-y-visible pb-4">
    <div className="flex gap-4 pr-6 min-w-min">
      {columns.map(col => {
        const colTasks = tasks.filter(t => t.status === col.key);
        return (
          <div
            key={col.key}
            className="flex-shrink-0 w-[290px]"
            onDragOver={e => e.preventDefault()}
            onDrop={() => onDrop(col.key)}
          >
            <div className={`orbit-card p-3 border-t-2 ${col.accent} mb-3`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${col.dotColor}`} />
                  <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
                </div>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{colTasks.length}</span>
              </div>
            </div>
            <div className="space-y-3 min-h-[100px]">
              {colTasks.map(task => {
                const prio = priorityMeta[task.priority];
                const overdue = isOverdue(task);
                const isPersonal = (task.scope ?? "work") === "personal";
                const tProj = taskProjects.find(p => p.id === (task.taskProjectId ?? "tp-noproject"));
                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => setDraggedId(task.id)}
                    onDragEnd={() => setDraggedId(null)}
                    onClick={() => onSelect(task)}
                    className={cn(
                      "orbit-card p-4 cursor-pointer hover:border-primary/30 transition-all duration-200 group",
                      draggedId === task.id && "opacity-50 scale-95",
                      highlightedTaskId === task.id && "ring-2 ring-primary/30 bg-primary/5",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                      {isPersonal && (
                        <Badge variant="outline" className="text-[10px] h-5 py-0 bg-pink-500/10 text-pink-400 border-pink-500/25">
                          <User className="h-2.5 w-2.5 mr-1" /> Pessoal
                        </Badge>
                      )}
                      {tProj && tProj.id !== "tp-noproject" && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/60">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: tProj.color }} />
                          {tProj.name}
                        </span>
                      )}
                      {task.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">#{tag}</span>
                      ))}
                    </div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-semibold text-foreground leading-tight">{task.title}</p>
                      <GripVertical className="h-4 w-4 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-grab" />
                    </div>
                    {(task.client || task.project) && (
                      <p className="text-xs text-muted-foreground mb-3 truncate">
                        {[task.client, task.project].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {task.subtasks.length > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                          <span className="flex items-center gap-1"><ListChecks className="h-3 w-3" />Subtarefas</span>
                          <span>{task.subtasks.filter(s => s.done).length}/{task.subtasks.length}</span>
                        </div>
                        <div className="h-1 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(task.subtasks.filter(s => s.done).length / task.subtasks.length) * 100}%` }} />
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={cn("text-[10px]", prio.badge)}>
                        <Flag className={cn("h-2.5 w-2.5 mr-1", prio.flag)} />{prio.label}
                      </Badge>
                      <span className={cn("text-[10px] flex items-center gap-1",
                        overdue ? "text-destructive" : "text-muted-foreground")}>
                        {task.reminderEnabled && task.reminderAt && <BellRing className="h-3 w-3 text-primary" />}
                        <Clock className="h-3 w-3" />
                        {task.dueDate ? formatPtBr(task.dueDate) : (task.deadline || "—")}
                      </span>
                    </div>
                  </div>
                );
              })}
              {colTasks.length === 0 && (
                <div className="orbit-card border-dashed p-6 flex items-center justify-center">
                  <p className="text-xs text-muted-foreground">Solte aqui</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Dialog: nova tarefa                                               */
/* ------------------------------------------------------------------ */

const NewTaskDialog = ({ open, onOpenChange, onCreate, taskProjects }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onCreate: (data: Omit<Task, "id" | "isDemo" | "createdAt">) => void;
  taskProjects: TaskProject[];
}) => {
  const [scope, setScope] = useState<TaskScope>("work");
  const [reminderPreset, setReminderPreset] = useState<ReminderPreset>("none");
  const visibleProjects = taskProjects.filter(p => !p.archived && (scope === "personal" ? p.type === "personal" : p.type === "work"));

  // Reset scope-dependent fields when dialog opens
  useEffect(() => { if (open) { setScope("work"); setReminderPreset("none"); } }, [open]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = (fd.get("title") as string).trim();
    if (!title) { toast({ title: "Informe o título da tarefa", variant: "destructive" }); return; }
    const taskProjectId = (fd.get("taskProjectId") as string) || "tp-noproject";
    const projectName = taskProjects.find(p => p.id === taskProjectId)?.name || "";
    const dueIso = (fd.get("deadline") as string) || "";
    const checklistRaw = (fd.get("checklist") as string) || "";
    const customReminder = (fd.get("reminderCustom") as string) || "";
    const reminderAt = computeReminderAt(dueIso, reminderPreset, customReminder ? new Date(customReminder).toISOString() : undefined);

    onCreate({
      title,
      description: (fd.get("description") as string) || "",
      client: scope === "personal" ? "" : ((fd.get("client") as string) || ""),
      project: scope === "personal" ? projectName : projectName,
      taskProjectId,
      scope,
      priority: ((fd.get("priority") as TaskPriority) || "média"),
      deadline: dueIso ? formatPtBr(dueIso) : "—",
      dueDate: dueIso || undefined,
      status: ((fd.get("status") as TaskStatus) || "a_fazer"),
      tags: ((fd.get("tags") as string) || "").split(",").map(t => t.trim()).filter(Boolean),
      subtasks: checklistRaw.split("\n").map(l => l.trim()).filter(Boolean).map(text => ({ text, done: false })),
      comments: [],
      recurrence: ((fd.get("recurrence") as TaskRecurrence) || "none"),
      archived: false,
      reminderAt,
      reminderEnabled: !!reminderAt,
    });
    onOpenChange(false);
    toast({ title: "Tarefa criada" });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
          <DialogDescription>Capture com calma todos os detalhes da tarefa.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          <div className="sm:col-span-2 space-y-2">
            <Label className="text-sm text-muted-foreground">Título*</Label>
            <Input name="title" placeholder="Ex: Criar logo principal" className="bg-muted/40" />
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label className="text-sm text-muted-foreground">Descrição</Label>
            <Textarea name="description" placeholder="Detalhes, contexto, links..." className="bg-muted/40 min-h-[80px]" />
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label className="text-sm text-muted-foreground">Tipo</Label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setScope("work")}
                className={cn("flex-1 h-10 rounded-lg border text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors",
                  scope === "work" ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-muted/40 text-muted-foreground hover:text-foreground")}>
                <Briefcase className="h-4 w-4" /> Trabalho
              </button>
              <button type="button" onClick={() => setScope("personal")}
                className={cn("flex-1 h-10 rounded-lg border text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors",
                  scope === "personal" ? "border-pink-500/50 bg-pink-500/10 text-pink-400" : "border-border bg-muted/40 text-muted-foreground hover:text-foreground")}>
                <User className="h-4 w-4" /> Pessoal
              </button>
            </div>
          </div>
          {scope === "work" && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Cliente</Label>
              <Select name="client">
                <SelectTrigger className="bg-muted/40"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{clientsList.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className={cn("space-y-2", scope === "personal" && "sm:col-span-2")}>
            <Label className="text-sm text-muted-foreground">Projeto</Label>
            <Select name="taskProjectId" defaultValue="tp-noproject" key={scope}>
              <SelectTrigger className="bg-muted/40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {visibleProjects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Prioridade</Label>
            <Select name="priority" defaultValue="média">
              <SelectTrigger className="bg-muted/40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alta">Alta (P1)</SelectItem>
                <SelectItem value="média">Média (P2)</SelectItem>
                <SelectItem value="baixa">Baixa (P3)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Prazo</Label>
            <Input name="deadline" type="date" className="bg-muted/40" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Status</Label>
            <Select name="status" defaultValue="a_fazer">
              <SelectTrigger className="bg-muted/40"><SelectValue /></SelectTrigger>
              <SelectContent>{columns.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Recorrência</Label>
            <Select name="recurrence" defaultValue="none">
              <SelectTrigger className="bg-muted/40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(recurrenceLabels) as TaskRecurrence[]).map(k =>
                  <SelectItem key={k} value={k}>{recurrenceLabels[k]}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className={cn("space-y-2", reminderPreset === "custom" ? "" : "sm:col-span-2")}>
            <Label className="text-sm text-muted-foreground flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" /> Lembrete</Label>
            <Select value={reminderPreset} onValueChange={(v) => setReminderPreset(v as ReminderPreset)}>
              <SelectTrigger className="bg-muted/40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(REMINDER_PRESET_LABELS) as ReminderPreset[]).map(k =>
                  <SelectItem key={k} value={k}>{REMINDER_PRESET_LABELS[k]}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          {reminderPreset === "custom" && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Data e hora do lembrete</Label>
              <Input type="datetime-local" name="reminderCustom" className="bg-muted/40" />
            </div>
          )}
          <p className="sm:col-span-2 text-[11px] text-muted-foreground -mt-1">
            Lembretes locais funcionam enquanto o app estiver aberto. Integração com Google Calendar será adicionada futuramente.
          </p>
          <div className="sm:col-span-2 space-y-2">
            <Label className="text-sm text-muted-foreground">Etiquetas (vírgulas)</Label>
            <Input name="tags" placeholder="Ex: branding, logo" className="bg-muted/40" />
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label className="text-sm text-muted-foreground">Checklist inicial</Label>
            <Textarea name="checklist" placeholder="Uma subtarefa por linha..." className="bg-muted/40 min-h-[60px]" />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="orbit-gradient text-white border-0">Criar tarefa</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/* ------------------------------------------------------------------ */
/*  Drawer de detalhes                                                */
/* ------------------------------------------------------------------ */

const TaskDetailSheet = ({
  task, taskProjects, onClose, onMove, onToggleSubtask, onAddSubtask, onUpdate, onDuplicate, onArchive, onDelete,
}: {
  task: Task | null;
  taskProjects: TaskProject[];
  onClose: () => void;
  onMove: (id: number, status: TaskStatus) => void;
  onToggleSubtask: (taskId: number, idx: number) => void;
  onAddSubtask: (taskId: number, text: string) => void;
  onUpdate: (id: number, patch: Partial<Task>) => void;
  onDuplicate: (id: number) => void;
  onArchive: (id: number, archived: boolean) => void;
  onDelete: (t: Task) => void;
}) => {
  const [newSub, setNewSub] = useState("");
  if (!task) return null;
  const subsDone = task.subtasks.filter(s => s.done).length;
  const overdue = isOverdue(task);
  const prio = priorityMeta[task.priority];

  const Section = ({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) => (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />{title}
      </h3>
      {children}
    </div>
  );

  return (
    <Sheet open={!!task} onOpenChange={v => !v && onClose()}>
      <SheetContent className="bg-card border-border w-full sm:max-w-[480px] overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-foreground text-lg leading-tight">{task.title}</SheetTitle>
          <SheetDescription className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={prio.badge}>
              <Flag className={cn("h-3 w-3 mr-1", prio.flag)} />{prio.label}
            </Badge>
            <Badge variant="outline" className={cn("text-xs", statusBadgeStyle[task.status])}>
              {statusLabels[task.status]}
            </Badge>
            {task.archived && <Badge variant="outline" className="text-xs">Arquivada</Badge>}
          </SheetDescription>
        </SheetHeader>

        {/* Ações rápidas */}
        <div className="flex gap-2 my-4 flex-wrap">
          <Button
            size="sm"
            onClick={() => onMove(task.id, task.status === "concluido" ? "a_fazer" : "concluido")}
            className={task.status === "concluido" ? "" : "orbit-gradient text-white border-0"}
            variant={task.status === "concluido" ? "outline" : "default"}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            {task.status === "concluido" ? "Reabrir" : "Concluir"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDuplicate(task.id)}>
            <Copy className="h-3.5 w-3.5 mr-1" /> Duplicar
          </Button>
          <Button size="sm" variant="outline" onClick={() => onArchive(task.id, !task.archived)}>
            <Archive className="h-3.5 w-3.5 mr-1" /> {task.archived ? "Restaurar" : "Arquivar"}
          </Button>
          <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => onDelete(task)}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
          </Button>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          {columns.filter(c => c.key !== task.status).map(c => (
            <Button key={c.key} size="sm" variant="ghost" className="text-xs gap-1.5 border border-border/60" onClick={() => onMove(task.id, c.key)}>
              <div className={`h-2 w-2 rounded-full ${c.dotColor}`} /> {c.label}
            </Button>
          ))}
        </div>

        <div className="space-y-6 pb-6">
          {task.description && (
            <Section title="Descrição" icon={Briefcase}>
              <div className="orbit-card p-4"><p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{task.description}</p></div>
            </Section>
          )}

          <Section title="Informações" icon={CircleDot}>
            <div className="orbit-card p-4 space-y-2.5">
              <div className="flex justify-between text-sm gap-3">
                <span className="text-muted-foreground">Cliente</span>
                <span className="text-foreground font-medium truncate">{task.client || "—"}</span>
              </div>
              <div className="flex justify-between text-sm gap-3">
                <span className="text-muted-foreground">Projeto</span>
                <span className="text-foreground font-medium truncate">{task.project || "—"}</span>
              </div>
              <div className="flex justify-between text-sm gap-3">
                <span className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Criada</span>
                <span className="text-foreground font-medium">{task.createdAt}</span>
              </div>
              <div className="flex justify-between text-sm gap-3 items-center">
                <span className={cn("flex items-center gap-1", overdue && "text-destructive")}>
                  <Clock className="h-3.5 w-3.5" />Prazo
                </span>
                <Input
                  type="date"
                  defaultValue={task.dueDate || ""}
                  onBlur={(e) => onUpdate(task.id, { dueDate: e.target.value || undefined })}
                  className="h-8 w-[160px] bg-muted/40 text-sm"
                />
              </div>
              <div className="flex justify-between text-sm gap-3 items-center">
                <span className="text-muted-foreground">Prioridade</span>
                <Select defaultValue={task.priority} onValueChange={(v) => onUpdate(task.id, { priority: v as TaskPriority })}>
                  <SelectTrigger className="h-8 w-[140px] bg-muted/40 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">Alta (P1)</SelectItem>
                    <SelectItem value="média">Média (P2)</SelectItem>
                    <SelectItem value="baixa">Baixa (P3)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-between text-sm gap-3 items-center">
                <span className="text-muted-foreground">Recorrência</span>
                <Select defaultValue={task.recurrence || "none"} onValueChange={(v) => onUpdate(task.id, { recurrence: v as TaskRecurrence })}>
                  <SelectTrigger className="h-8 w-[160px] bg-muted/40 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(recurrenceLabels) as TaskRecurrence[]).map(k =>
                      <SelectItem key={k} value={k}>{recurrenceLabels[k]}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-between text-sm gap-3 items-center">
                <span className="text-muted-foreground flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />Projeto</span>
                <Select
                  defaultValue={task.taskProjectId || "tp-noproject"}
                  onValueChange={(v) => {
                    const p = taskProjects.find(x => x.id === v);
                    onUpdate(task.id, { taskProjectId: v, scope: p?.type === "personal" ? "personal" : (task.scope ?? "work") });
                  }}>
                  <SelectTrigger className="h-8 w-[180px] bg-muted/40 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {taskProjects.filter(p => !p.archived).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-between text-sm gap-3 items-center">
                <span className="text-muted-foreground flex items-center gap-1"><User className="h-3.5 w-3.5" />Tipo</span>
                <Select defaultValue={task.scope ?? "work"} onValueChange={(v) => onUpdate(task.id, { scope: v as TaskScope })}>
                  <SelectTrigger className="h-8 w-[140px] bg-muted/40 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="work">Trabalho</SelectItem>
                    <SelectItem value="personal">Pessoal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-between text-sm gap-3 items-center">
                <span className="text-muted-foreground flex items-center gap-1"><Bell className="h-3.5 w-3.5" />Lembrete</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="datetime-local"
                    defaultValue={task.reminderAt ? new Date(task.reminderAt).toISOString().slice(0, 16) : ""}
                    onBlur={(e) => {
                      const v = e.target.value;
                      onUpdate(task.id, {
                        reminderAt: v ? new Date(v).toISOString() : undefined,
                        reminderEnabled: !!v,
                        reminderSentAt: undefined,
                      });
                    }}
                    className="h-8 w-[200px] bg-muted/40 text-sm"
                  />
                  <Button
                    type="button" variant="ghost" size="icon" className="h-8 w-8"
                    onClick={() => onUpdate(task.id, { reminderEnabled: !task.reminderEnabled, reminderSentAt: undefined })}
                    title={task.reminderEnabled ? "Desativar lembrete" : "Ativar lembrete"}
                  >
                    {task.reminderEnabled ? <BellRing className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </div>
              </div>
            </div>
          </Section>

          {task.tags.length > 0 && (
            <Section title="Etiquetas" icon={Tag}>
              <div className="flex flex-wrap gap-2">
                {task.tags.map(tag => (
                  <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">#{tag}</span>
                ))}
              </div>
            </Section>
          )}

          <Section title={`Subtarefas (${subsDone}/${task.subtasks.length})`} icon={ListChecks}>
            <div className="space-y-1">
              {task.subtasks.map((sub, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => onToggleSubtask(task.id, i)}>
                  <Checkbox checked={sub.done} className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                  <span className={cn("text-sm", sub.done ? "line-through text-muted-foreground" : "text-foreground")}>{sub.text}</span>
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <Input
                  value={newSub}
                  onChange={(e) => setNewSub(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newSub.trim()) {
                      onAddSubtask(task.id, newSub.trim()); setNewSub("");
                    }
                  }}
                  placeholder="Adicionar subtarefa..."
                  className="h-9 bg-muted/40 text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { if (newSub.trim()) { onAddSubtask(task.id, newSub.trim()); setNewSub(""); } }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Section>

          <Section title="Comentários e anotações" icon={MessageSquare}>
            {task.comments.length > 0 ? (
              <div className="space-y-3">
                {task.comments.map((c, i) => (
                  <div key={i} className="orbit-card p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-foreground">{c.author}</span>
                      <span className="text-[10px] text-muted-foreground">{c.date}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{c.text}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Nenhuma anotação ainda.</p>}
            <Textarea placeholder="Escrever uma anotação local..." className="bg-muted/40 min-h-[60px] text-sm mt-2" />
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
};

/* ------------------------------------------------------------------ */
/*  Drawer de Projetos de tarefas                                     */
/* ------------------------------------------------------------------ */

const ProjectsSheet = ({
  open, onOpenChange, projects, tasks, onAdd, onRename, onArchive, onDelete, onFilter,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  projects: TaskProject[];
  tasks: Task[];
  onAdd: (name: string, type: TaskProjectType) => void;
  onRename: (id: string, name: string) => void;
  onArchive: (id: string, archived: boolean) => void;
  onDelete: (id: string) => void;
  onFilter: (id: string) => void;
}) => {
  const [name, setName] = useState("");
  const [type, setType] = useState<TaskProjectType>("work");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const countFor = (id: string) =>
    tasks.filter(t => (t.taskProjectId ?? "tp-noproject") === id && !t.archived).length;

  const active = projects.filter(p => !p.archived);
  const archived = projects.filter(p => p.archived);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-card border-border w-full sm:max-w-[420px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-foreground flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-primary" /> Projetos de tarefas
          </SheetTitle>
          <SheetDescription>
            Organize tarefas por cliente, entrega ou área da vida.
          </SheetDescription>
        </SheetHeader>

        <div className="orbit-card p-3 mt-4 space-y-2">
          <Label className="text-xs text-muted-foreground">Novo projeto</Label>
          <Input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Casa, Cliente Acme, Lançamento..."
            className="bg-muted/40 h-9 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) {
                onAdd(name.trim(), type); setName("");
                toast({ title: "Projeto criado" });
              }
            }}
          />
          <div className="flex gap-2">
            <Select value={type} onValueChange={(v) => setType(v as TaskProjectType)}>
              <SelectTrigger className="bg-muted/40 h-9 text-sm flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="work">Trabalho</SelectItem>
                <SelectItem value="personal">Pessoal</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm" className="orbit-gradient text-white border-0"
              onClick={() => {
                if (!name.trim()) return;
                onAdd(name.trim(), type); setName("");
                toast({ title: "Projeto criado" });
              }}
            >
              <FolderPlus className="h-3.5 w-3.5 mr-1" /> Criar
            </Button>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground px-1">Ativos</h4>
          {active.length === 0 && (
            <p className="text-xs text-muted-foreground px-1">Crie projetos para organizar tarefas por cliente, entrega ou área da vida.</p>
          )}
          {active.map(p => {
            const count = countFor(p.id);
            const isEditing = editing === p.id;
            return (
              <div key={p.id} className="orbit-card p-2.5 flex items-center gap-2 group">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                {isEditing ? (
                  <Input
                    value={editName} onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                    onBlur={() => { if (editName.trim()) onRename(p.id, editName); setEditing(null); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { if (editName.trim()) onRename(p.id, editName); setEditing(null); }
                      if (e.key === "Escape") setEditing(null);
                    }}
                    className="h-7 text-sm bg-muted/40 flex-1"
                  />
                ) : (
                  <button onClick={() => onFilter(p.id)} className="flex-1 text-left text-sm font-medium text-foreground truncate hover:text-primary">
                    {p.name}
                  </button>
                )}
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{count}</span>
                {p.type === "personal" && (
                  <Badge variant="outline" className="text-[9px] h-4 py-0 bg-pink-500/10 text-pink-400 border-pink-500/25">Pessoal</Badge>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => { setEditing(p.id); setEditName(p.name); }} disabled={p.isSeed}>
                      <Pencil className="h-3.5 w-3.5 mr-2" /> Renomear
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onArchive(p.id, true)} disabled={p.isSeed}>
                      <Archive className="h-3.5 w-3.5 mr-2" /> Arquivar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => onDelete(p.id)} disabled={p.isSeed}>
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>

        {archived.length > 0 && (
          <div className="mt-6 space-y-2">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground px-1">Arquivados</h4>
            {archived.map(p => (
              <div key={p.id} className="orbit-card p-2.5 flex items-center gap-2 opacity-70">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                <span className="flex-1 text-sm text-muted-foreground truncate">{p.name}</span>
                <Button size="sm" variant="ghost" onClick={() => onArchive(p.id, false)}>Restaurar</Button>
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground mt-6 px-1">
          Google Calendar e lembretes sincronizados serão ativados em uma etapa futura.
        </p>
      </SheetContent>
    </Sheet>
  );
};

export default Tarefas;

