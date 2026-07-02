import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatCurrency as intlCurrency, formatDate as intlDate } from "@/lib/format";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FolderKanban, FileText, User, Calendar, DollarSign, Link2, MoreHorizontal,
  Check, Archive, Play, Plus, Circle, CheckCircle2, Clock, AlertTriangle, X,
} from "lucide-react";
import {
  type Project, type ProjectDeliverable, type ProjectStatus,
  PROJECT_STATUS_LABEL, useProjects,
} from "@/hooks/useProjects";
import { useTasks, formatPtBr, type Task, type TaskPriority } from "@/hooks/useTasks";
import { useClients } from "@/hooks/useClients";
import { ClientTechnicalSheetSnapshot } from "@/components/clients/ClientTechnicalSheetSnapshot";

interface ProjectDetailDrawerProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const fmtBRL = (v?: number) => intlCurrency(v ?? 0, { minimumFractionDigits: 0 });
const fmtDate = (iso?: string) => (iso ? intlDate(iso) : "—");

const STATUS_STYLE: Record<ProjectStatus, string> = {
  planning: "bg-muted text-foreground border-border",
  in_progress: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  review: "bg-secondary/15 text-secondary border-secondary/30",
  delivered: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  paused: "bg-muted/40 text-muted-foreground border-border/40",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
  archived: "bg-muted/40 text-muted-foreground/70 border-border/40",
};

const DELIV_STATUS_LABEL: Record<ProjectDeliverable["status"], string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluído",
};

const TASK_STATUS_LABEL: Record<Task["status"], string> = {
  a_fazer: "A fazer",
  em_andamento: "Em andamento",
  revisao: "Em revisão",
  concluido: "Concluído",
};

const TASK_STATUS_STYLE: Record<Task["status"], string> = {
  a_fazer: "border-border text-muted-foreground",
  em_andamento: "border-amber-500/30 text-amber-400 bg-amber-500/10",
  revisao: "border-secondary/30 text-secondary bg-secondary/10",
  concluido: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10",
};

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  alta: "border-destructive/30 text-destructive bg-destructive/10",
  média: "border-amber-500/30 text-amber-400 bg-amber-500/10",
  baixa: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10",
};

export function ProjectDetailDrawer({ project, open, onOpenChange }: ProjectDetailDrawerProps) {
  const navigate = useNavigate();
  const { updateProject } = useProjects();
  const { tasks, addTask, moveTask } = useTasks();
  const { clients } = useClients();
  const linkedClient = useMemo(
    () => (project?.clientId ? clients.find((c) => c.id === project.clientId) ?? null : null),
    [clients, project],
  );

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");
  const [showNewTask, setShowNewTask] = useState(false);

  const linkedTasks = useMemo(
    () => (project ? tasks.filter((t) => t.projectId === project.id && !t.archived) : []),
    [tasks, project],
  );

  const deliverables = project?.deliverables ?? [];
  const doneDeliverables = deliverables.filter((d) => d.status === "concluido").length;
  const pendingDeliverables = deliverables.length - doneDeliverables;
  const openTasks = linkedTasks.filter((t) => t.status !== "concluido").length;

  const computedProgress = deliverables.length
    ? Math.round((doneDeliverables / deliverables.length) * 100)
    : (project?.progress ?? 0);

  if (!project) return null;

  const setDeliverableStatus = (id: string, status: ProjectDeliverable["status"]) => {
    const next = deliverables.map((d) => (d.id === id ? { ...d, status } : d));
    const done = next.filter((d) => d.status === "concluido").length;
    const progress = next.length ? Math.round((done / next.length) * 100) : project.progress;
    updateProject(project.id, { deliverables: next, progress });
  };

  const handleStatus = (status: ProjectStatus) => {
    const patch: Partial<Project> = { status };
    if (status === "delivered") patch.progress = 100;
    updateProject(project.id, patch);
    toast.success(`Projeto atualizado: ${PROJECT_STATUS_LABEL[status]}`);
  };

  const handleCreateTask = () => {
    if (!newTaskTitle.trim()) return toast.error("Informe o título da tarefa");
    const iso = newTaskDate || new Date().toISOString().slice(0, 10);
    addTask({
      title: newTaskTitle.trim(),
      description: "",
      client: project.clientName,
      project: project.name,
      projectId: project.id,
      clientId: project.clientId,
      quoteId: project.quoteId,
      source: "projeto",
      scope: "work",
      priority: "média",
      deadline: formatPtBr(iso),
      dueDate: iso,
      status: "a_fazer",
      tags: [],
      subtasks: [],
      comments: [],
      recurrence: "none",
    });
    toast.success("Tarefa criada");
    setNewTaskTitle("");
    setNewTaskDate("");
    setShowNewTask(false);
  };

  const fromQuote = project.source === "orçamento";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto bg-card border-border p-0">
        {/* Header */}
        <div className="p-6 border-b border-border space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <FolderKanban className="h-3 w-3" />
                {fromQuote ? "Origem: Orçamento" : "Origem: Manual"}
              </div>
              <SheetHeader className="text-left space-y-1 p-0">
                <SheetTitle className="text-lg font-semibold text-foreground truncate">
                  {project.name}
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" /> {project.clientName}
                  {project.company && <span>· {project.company}</span>}
                </SheetDescription>
              </SheetHeader>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded-lg border border-border/60 p-1.5 text-muted-foreground hover:text-foreground transition"
                  aria-label="Ações"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border w-52">
                {project.status === "planning" && (
                  <DropdownMenuItem onClick={() => handleStatus("in_progress")}>
                    <Play className="h-3.5 w-3.5 mr-2" /> Iniciar projeto
                  </DropdownMenuItem>
                )}
                {project.status !== "delivered" && project.status !== "archived" && project.status !== "cancelled" && (
                  <DropdownMenuItem onClick={() => handleStatus("delivered")}>
                    <Check className="h-3.5 w-3.5 mr-2" /> Concluir projeto
                  </DropdownMenuItem>
                )}
                {project.status !== "paused" && project.status !== "delivered" && project.status !== "archived" && (
                  <DropdownMenuItem onClick={() => handleStatus("paused")}>
                    <Clock className="h-3.5 w-3.5 mr-2" /> Pausar
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {project.quoteId && (
                  <DropdownMenuItem onClick={() => navigate(`/vendas?tab=orcamentos&quote=${project.quoteId}`)}>
                    <FileText className="h-3.5 w-3.5 mr-2" /> Ver orçamento
                  </DropdownMenuItem>
                )}
                {project.clientId && (
                  <DropdownMenuItem onClick={() => navigate(`/clientes?client=${project.clientId}`)}>
                    <User className="h-3.5 w-3.5 mr-2" /> Ver cliente
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {project.status !== "archived" ? (
                  <DropdownMenuItem onClick={() => handleStatus("archived")}>
                    <Archive className="h-3.5 w-3.5 mr-2" /> Arquivar
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => handleStatus("planning")}>
                    <Archive className="h-3.5 w-3.5 mr-2" /> Restaurar
                  </DropdownMenuItem>
                )}
                {project.status !== "cancelled" && project.status !== "delivered" && (
                  <DropdownMenuItem onClick={() => handleStatus("cancelled")} className="text-destructive focus:text-destructive">
                    <X className="h-3.5 w-3.5 mr-2" /> Cancelar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className={`text-[10px] ${STATUS_STYLE[project.status]}`}>
              {PROJECT_STATUS_LABEL[project.status]}
            </Badge>
            {fromQuote && (
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/10 inline-flex items-center gap-1">
                <Link2 className="h-3 w-3" /> {project.quoteTitle || "Orçamento"}
              </Badge>
            )}
            {project.serviceType && (
              <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                {project.serviceType}
              </Badge>
            )}
          </div>

          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Progresso</span><span>{computedProgress}%</span>
            </div>
            <Progress value={computedProgress} />
          </div>
        </div>

        {/* Operational summary */}
        <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <SummaryCard icon={DollarSign} label="Valor" value={fmtBRL(project.budget)} />
          <SummaryCard icon={Calendar} label="Prazo" value={fmtDate(project.dueDate)} />
          <SummaryCard icon={Circle} label="Entregáveis" value={`${pendingDeliverables}/${deliverables.length}`} sub="pendentes" />
          <SummaryCard icon={CheckCircle2} label="Tarefas" value={String(openTasks)} sub="abertas" />
        </div>

        <Separator className="bg-border/60" />

        {/* Deliverables */}
        <section className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Entregáveis</h3>
            <span className="text-[11px] text-muted-foreground">{doneDeliverables} de {deliverables.length} concluídos</span>
          </div>
          {deliverables.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
              Nenhum entregável registrado.
            </div>
          ) : (
            <ul className="space-y-2">
              {deliverables.map((d) => {
                const done = d.status === "concluido";
                return (
                  <li key={d.id} className="rounded-lg border border-border/60 bg-background/40 p-3 flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => setDeliverableStatus(d.id, done ? "pendente" : "concluido")}
                      className={`mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center transition ${
                        done ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400" : "border-border text-transparent hover:border-primary"
                      }`}
                      aria-label={done ? "Reabrir entregável" : "Concluir entregável"}
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-medium truncate ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {d.title}
                      </div>
                      {d.description && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">{d.description}</div>
                      )}
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${
                      done ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                      : d.status === "em_andamento" ? "border-amber-500/30 text-amber-400 bg-amber-500/10"
                      : "border-border text-muted-foreground"
                    }`}>
                      {DELIV_STATUS_LABEL[d.status]}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <Separator className="bg-border/60" />

        {/* Tasks */}
        <section className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Tarefas vinculadas</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowNewTask((v) => !v)}
              className="h-7 gap-1 text-xs"
            >
              <Plus className="h-3 w-3" /> Nova tarefa
            </Button>
          </div>

          {showNewTask && (
            <div className="rounded-lg border border-border/60 bg-background/40 p-3 space-y-2">
              <Input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Título da tarefa"
                maxLength={140}
                className="h-9"
              />
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={newTaskDate}
                  onChange={(e) => setNewTaskDate(e.target.value)}
                  className="h-9 flex-1"
                />
                <Button size="sm" onClick={handleCreateTask} className="h-9 gap-1">
                  <Check className="h-3.5 w-3.5" /> Criar
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Tarefa será vinculada ao projeto, cliente e orçamento (quando houver).
              </p>
            </div>
          )}

          {linkedTasks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground space-y-2">
              <div>Nenhuma tarefa vinculada a este projeto.</div>
              {!showNewTask && (
                <Button size="sm" variant="outline" onClick={() => setShowNewTask(true)} className="gap-1">
                  <Plus className="h-3 w-3" /> Criar tarefa
                </Button>
              )}
            </div>
          ) : (
            <ul className="space-y-2">
              {linkedTasks.map((t) => {
                const done = t.status === "concluido";
                return (
                  <li key={t.id} className="rounded-lg border border-border/60 bg-background/40 p-3 flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => moveTask(t.id, done ? "a_fazer" : "concluido")}
                      className={`mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center transition ${
                        done ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400" : "border-border text-transparent hover:border-primary"
                      }`}
                      aria-label={done ? "Reabrir tarefa" : "Concluir tarefa"}
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-medium truncate ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {t.title}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <Badge variant="outline" className={`text-[10px] ${TASK_STATUS_STYLE[t.status]}`}>
                          {TASK_STATUS_LABEL[t.status]}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] ${PRIORITY_STYLE[t.priority]}`}>
                          {t.priority}
                        </Badge>
                        {t.dueDate && (
                          <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                            <Calendar className="h-2.5 w-2.5" /> {formatPtBr(t.dueDate)}
                          </span>
                        )}
                        {t.source && t.source !== "manual" && (
                          <span className="text-[10px] text-muted-foreground/80">· {t.source}</span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <Separator className="bg-border/60" />

        {/* Notes */}
        <section className="p-6 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Observações</h3>
          {project.notes ? (
            <p className="text-xs text-muted-foreground whitespace-pre-line">{project.notes}</p>
          ) : (
            <p className="text-xs text-muted-foreground/70">Nenhuma observação registrada.</p>
          )}
        </section>

        <Separator className="bg-border/60" />

        {/* Client Technical Sheet snapshot */}
        {project.clientId && linkedClient ? (
          <>
            <ClientTechnicalSheetSnapshot client={linkedClient} defaultOpen={false} />
            <Separator className="bg-border/60" />
          </>
        ) : project.clientId && !linkedClient ? (
          <>
            <section className="p-6">
              <p className="text-xs text-muted-foreground/80">
                Cliente vinculado não foi encontrado nos registros locais.
              </p>
            </section>
            <Separator className="bg-border/60" />
          </>
        ) : (
          <>
            <section className="p-6">
              <p className="text-xs text-muted-foreground/80">
                Este projeto ainda não possui cliente vinculado.
              </p>
            </section>
            <Separator className="bg-border/60" />
          </>
        )}

        {/* Connections */}
        <section className="p-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Conexões do projeto</h3>
          <div className="grid grid-cols-1 gap-2">
            <ConnectionRow
              icon={User}
              label="Cliente"
              value={project.clientName}
              actionLabel={project.clientId ? "Ver" : undefined}
              onAction={project.clientId ? () => navigate(`/clientes?client=${project.clientId}`) : undefined}
            />
            <ConnectionRow
              icon={FileText}
              label="Orçamento"
              value={project.quoteTitle ?? (project.quoteId ? "Vinculado" : "—")}
              actionLabel={project.quoteId ? "Ver" : undefined}
              onAction={project.quoteId ? () => navigate(`/vendas?tab=orcamentos&quote=${project.quoteId}`) : undefined}
            />
            <ConnectionRow
              icon={Link2}
              label="Oportunidade"
              value={project.opportunityTitle ?? (project.opportunityId ? "Vinculada" : "—")}
              actionLabel={project.opportunityId ? "Ver" : undefined}
              onAction={project.opportunityId ? () => navigate("/crm") : undefined}
            />
            <ConnectionRow icon={AlertTriangle} label="Portal do cliente" value="Em etapa futura" muted />
            <ConnectionRow icon={AlertTriangle} label="Arquivos" value="Exigem Storage seguro" muted />
            <ConnectionRow icon={AlertTriangle} label="Notificações" value="Exigem backend" muted />
          </div>
        </section>
      </SheetContent>
    </Sheet>
  );
}

function SummaryCard({
  icon: Icon, label, value, sub,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="text-sm font-bold text-foreground mt-1 truncate">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function ConnectionRow({
  icon: Icon, label, value, actionLabel, onAction, muted,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  actionLabel?: string;
  onAction?: () => void;
  muted?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2 flex items-center gap-3">
      <Icon className={`h-3.5 w-3.5 ${muted ? "text-muted-foreground/60" : "text-primary"}`} />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-xs truncate ${muted ? "text-muted-foreground/70" : "text-foreground"}`}>{value}</div>
      </div>
      {actionLabel && onAction && (
        <Button size="sm" variant="ghost" onClick={onAction} className="h-7 text-xs">{actionLabel}</Button>
      )}
    </div>
  );
}
