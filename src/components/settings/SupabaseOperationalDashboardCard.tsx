import { useMemo, useEffect, useState } from "react";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useSupabaseOpportunities } from "@/hooks/useSupabaseOpportunities";
import { useSupabaseQuotes } from "@/hooks/useSupabaseQuotes";
import { useSupabaseFinancialSummary } from "@/hooks/useSupabaseFinancialSummary";
import { useSupabaseProjectsSummary } from "@/hooks/useSupabaseProjectsSummary";
import { useSupabaseProjectTasks } from "@/hooks/useSupabaseProjectTasks";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { formatCurrency as intlCurrency, formatDate as intlDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, FileText, TrendingUp, DollarSign, Briefcase, Activity, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { CreateProjectBaseTasksDialog } from "@/components/projects/CreateProjectBaseTasksDialog";
import { type SupabaseProject } from "@/repositories/projectsRepository";
import { getBooleanFlag } from "@/config/flags";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function ProjectTasksList({ projectId }: { projectId: string }) {
  const { tasks, loading, error, refresh, updateStatus } = useSupabaseProjectTasks(projectId);
  const [transitionEnabled, setTransitionEnabled] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<{
    id: string;
    fromStatus: string;
    toStatus: "todo" | "in_progress" | "done";
    projectId: string;
  } | null>(null);

  // Sync feature flag state on mount & Storage changes
  useEffect(() => {
    const checkFlag = () => {
      try {
        setTransitionEnabled(getBooleanFlag("tasksSupabaseStatusTransition"));
      } catch {
        setTransitionEnabled(false);
      }
    };
    checkFlag();
    window.addEventListener("storage", checkFlag);
    return () => {
      window.removeEventListener("storage", checkFlag);
    };
  }, []);

  const executeTransition = async (
    taskId: string,
    fromStatus: string,
    toStatus: "todo" | "in_progress" | "done",
    projId: string
  ) => {
    try {
      await updateStatus(taskId, toStatus);
      toast.success("Status da tarefa atualizado com sucesso!");

      // Log local in localStorage
      try {
        const logRaw = localStorage.getItem("kora.tasks.supabaseStatusTransitions.v1") || "[]";
        const logParsed = JSON.parse(logRaw);
        logParsed.push({
          taskId,
          projectId: projId,
          fromStatus,
          toStatus,
          changedAt: new Date().toISOString(),
        });
        localStorage.setItem("kora.tasks.supabaseStatusTransitions.v1", JSON.stringify(logParsed));
      } catch (logErr) {
        console.error("Erro ao registrar log de transação de tarefa:", logErr);
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro ao transicionar tarefa no Supabase.");
      refresh(); // Rollback visual
    }
  };

  const handleStatusChange = async (
    taskId: string,
    fromStatus: string,
    toStatus: "todo" | "in_progress" | "done",
    projId: string
  ) => {
    const isTransitionEnabled = getBooleanFlag("tasksSupabaseStatusTransition");
    if (!isTransitionEnabled) {
      toast.info("Transição de tarefas Supabase entra nesta etapa experimental. Ative em Configurações.");
      return;
    }

    if (toStatus === "done") {
      setPendingTransition({ id: taskId, fromStatus, toStatus, projectId: projId });
      setConfirmOpen(true);
      return;
    }

    // Direct transition for other status (todo, in_progress) without dialog confirmation
    await executeTransition(taskId, fromStatus, toStatus, projId);
  };

  const handleConfirmDone = async () => {
    if (pendingTransition) {
      await executeTransition(
        pendingTransition.id,
        pendingTransition.fromStatus,
        pendingTransition.toStatus,
        pendingTransition.projectId
      );
      setPendingTransition(null);
    }
    setConfirmOpen(false);
  };

  if (loading) {
    return (
      <div className="py-2 pl-6 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <RefreshCw className="h-3 w-3 animate-spin text-primary" />
        Carregando checklist...
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-2 pl-6 text-[11px] text-destructive">
        Erro ao carregar checklist.
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="py-2 pl-6 text-[11px] text-muted-foreground italic">
        Nenhuma tarefa vinculada a este projeto ainda.
      </div>
    );
  }

  return (
    <div className="mt-2 pl-6 space-y-1.5 border-l-2 border-border/40">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase">Tarefas do Projeto</span>
        <Button variant="ghost" size="sm" onClick={refresh} className="h-4 px-1.5 text-[9px] text-muted-foreground hover:bg-transparent hover:text-foreground">
          Atualizar
        </Button>
      </div>
      {tasks.map((task) => (
        <div key={task.id} className="p-1.5 bg-muted/10 border border-border/40 rounded flex items-center justify-between gap-3 text-[11px]">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground truncate">{task.title}</p>
            {task.description && (
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">{task.description}</p>
            )}
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <Badge variant="outline" className="text-[9px] uppercase border-primary/20 text-primary py-0 px-1 bg-primary/[0.02]">
                Supabase
              </Badge>
              {task.source === "project_template" && (
                <Badge variant="outline" className="text-[9px] uppercase border-border text-muted-foreground py-0 px-1 bg-muted/5">
                  Tarefa Base
                </Badge>
              )}
              {task.due_date && (
                <span className="text-[9px] text-muted-foreground">Prazo: {intlDate(task.due_date)}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="outline" className={`text-[9px] uppercase py-0 px-1 ${
              task.priority === "high" ? "border-destructive/30 text-destructive bg-destructive/[0.02]" :
              task.priority === "medium" ? "border-amber-500/30 text-amber-500 bg-amber-500/[0.02]" :
              "border-muted text-muted-foreground"
            }`}>
              {task.priority === "high" ? "Alta" : task.priority === "medium" ? "Média" : "Baixa"}
            </Badge>

            {transitionEnabled ? (
              <select
                value={task.status === "concluido" ? "done" : task.status === "a_fazer" ? "todo" : task.status === "em_andamento" ? "in_progress" : task.status}
                onChange={(e) => handleStatusChange(task.id, task.status, e.target.value as "todo" | "in_progress" | "done", projectId)}
                className="text-[10px] bg-background/50 border border-border/80 rounded px-1.5 py-0.5 h-6 text-foreground font-medium focus-visible:outline-none"
              >
                <option value="todo">A Fazer</option>
                <option value="in_progress">Em Andamento</option>
                <option value="done">Concluída</option>
              </select>
            ) : (
              <Badge 
                variant="outline" 
                onClick={() => toast.info("Transição de tarefas Supabase entra nesta etapa experimental. Ative em Configurações.")}
                className={`text-[9px] uppercase py-0.5 px-1 cursor-pointer hover:bg-muted/30 transition-colors ${
                  task.status === "todo" ? "border-blue-400/30 text-blue-400" :
                  task.status === "in_progress" ? "border-amber-400/30 text-amber-400" :
                  task.status === "revisao" ? "border-purple-400/30 text-purple-400" :
                  "border-emerald-400/30 text-emerald-400"
                }`}
              >
                {task.status === "todo" ? "A Fazer" : task.status === "in_progress" ? "Em Andamento" : task.status === "revisao" ? "Revisão" : "Concluído"}
              </Badge>
            )}
          </div>
        </div>
      ))}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground text-sm font-semibold">Concluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-normal">
              Esta ação marcará a tarefa como concluída no Supabase. Ela não criará automações, calendário ou notificações.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="border-border text-foreground h-9 text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDone} className="orbit-gradient text-white border-0 h-9 text-xs">
              Concluir tarefa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function SupabaseOperationalDashboardCard() {
  const { workspace } = useCurrentWorkspace();
  const [enabled, setEnabled] = useState(false);
  const [selectedProject, setSelectedProject] = useState<SupabaseProject | null>(null);
  const [tasksModalOpen, setTasksModalOpen] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});

  // Sync feature flag state on mount & Storage changes
  useEffect(() => {
    const checkFlag = () => {
      try {
        setEnabled(getBooleanFlag("supabaseOperationalDashboard"));
      } catch {
        setEnabled(false);
      }
    };
    checkFlag();
    window.addEventListener("storage", checkFlag);
    return () => {
      window.removeEventListener("storage", checkFlag);
    };
  }, []);

  const { opportunities, loading: crmLoading, error: crmError, refresh: crmRefresh } = useSupabaseOpportunities({ includeArchived: true });
  const { quotes, loading: quotesLoading, error: quotesError, refresh: quotesRefresh } = useSupabaseQuotes();
  const { receivables, loading: finLoading, error: finError, refresh: finRefresh } = useSupabaseFinancialSummary();
  const { projects, loading: projLoading, error: projError, refresh: projRefresh } = useSupabaseProjectsSummary();

  const loading = crmLoading || quotesLoading || finLoading || projLoading;
  const error = crmError || quotesError || finError || projError;

  const handleRefreshAll = () => {
    crmRefresh();
    quotesRefresh();
    finRefresh();
    projRefresh();
  };

  const handleGenerateTasksClick = (proj: SupabaseProject) => {
    try {
      const isFlagOn = getBooleanFlag("projectsSupabaseCreateBaseTasks");
      if (!isFlagOn) {
        toast.info("A geração experimental de tarefas base está desativada. Habilite nas configurações.");
        return;
      }
      setSelectedProject(proj);
      setTasksModalOpen(true);
    } catch {
      toast.error("Erro ao verificar feature flag.");
    }
  };

  const toggleProjectExpand = (projId: string) => {
    setExpandedProjects((prev) => ({
      ...prev,
      [projId]: !prev[projId],
    }));
  };

  // Metrics calculations
  const stats = useMemo(() => {
    // CRM
    const crmTotal = opportunities.length;
    const crmOpen = opportunities.filter((o) => o.status === "open" || o.status === null || (o.status !== "won" && o.status !== "lost")).length;
    const crmWon = opportunities.filter((o) => o.status === "won").length;
    const crmLost = opportunities.filter((o) => o.status === "lost").length;

    // Orçamentos
    const quotesTotal = quotes.length;
    const quotesDraft = quotes.filter((q) => q.status === "rascunho" || (q.status as string) === "draft").length;
    const quotesApproved = quotes.filter((q) => q.status === "aprovado" || (q.status as string) === "approved").length;
    const quotesRejected = quotes.filter((q) => q.status === "recusado" || (q.status as string) === "rejected").length;
    const quotesApprovedVal = quotes.filter((q) => q.status === "aprovado" || (q.status as string) === "approved").reduce((sum, q) => sum + (q.total || 0), 0);

    // Recebíveis
    const finTotal = receivables.length;
    const finPending = receivables.filter((r) => r.status === "pending").length;
    const finPaid = receivables.filter((r) => r.status === "paid").length;
    const finPendingVal = receivables.filter((r) => r.status === "pending").reduce((sum, r) => sum + Number(r.amount || 0), 0);

    // Projetos
    const projTotal = projects.length;
    const projActive = projects.filter((p) => p.status === "active" || p.status === "in_progress").length;
    const projArchived = projects.filter((p) => p.archived || p.status === "archived").length;
    const projBudgetVal = projects.reduce((sum, p) => sum + Number(p.budget || 0), 0);

    // Relações do Fluxo Comercial
    const oppsWithQuote = opportunities.filter((o) => o.quote_id !== null).length;
    const approvedWithReceivable = quotes.filter((q) => (q.status === "aprovado" || (q.status as string) === "approved") && receivables.some((r) => r.quote_id === q.id && r.type === "receivable" && !r.deleted_at)).length;
    const approvedWithProject = quotes.filter((q) => (q.status === "aprovado" || (q.status as string) === "approved") && projects.some((p) => p.quote_id === q.id && !p.deleted_at)).length;
    const approvedNoReceivable = quotes.filter((q) => (q.status === "aprovado" || (q.status as string) === "approved") && !receivables.some((r) => r.quote_id === q.id && r.type === "receivable" && !r.deleted_at)).length;
    const approvedNoProject = quotes.filter((q) => (q.status === "aprovado" || (q.status as string) === "approved") && !projects.some((p) => p.quote_id === q.id && !p.deleted_at)).length;

    return {
      crmTotal, crmOpen, crmWon, crmLost,
      quotesTotal, quotesDraft, quotesApproved, quotesRejected, quotesApprovedVal,
      finTotal, finPending, finPaid, finPendingVal,
      projTotal, projActive, projArchived, projBudgetVal,
      oppsWithQuote, approvedWithReceivable, approvedWithProject, approvedNoReceivable, approvedNoProject
    };
  }, [opportunities, quotes, receivables, projects]);

  if (!workspace) return null;

  if (!enabled) {
    return (
      <SettingsCard title="Visão Operacional Supabase">
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground leading-normal">
            Acompanhe dados experimentais já persistidos no Supabase. Esta visualização é somente leitura e não substitui os módulos locais.
          </p>
          <div className="py-8 border border-dashed border-border/60 rounded-lg text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
            <Activity className="h-8 w-8 text-muted-foreground/40" />
            <span>Painel desativado experimentalmente. Habilite nas configurações acima.</span>
          </div>
        </div>
      </SettingsCard>
    );
  }

  const formatBRL = (val: number) => intlCurrency(val, { maximumFractionDigits: 0 });

  return (
    <SettingsCard 
      title="Visão Operacional Supabase"
      headerActions={
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[9px] uppercase tracking-wide text-primary border-primary/30">
            Experimental
          </Badge>
          <Badge variant="outline" className="text-[9px] uppercase tracking-wide text-muted-foreground border-border bg-muted/20">
            Somente Leitura
          </Badge>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefreshAll} 
            disabled={loading}
            className="h-8 w-8 p-0"
            title="Atualizar painel"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <p className="text-xs text-muted-foreground leading-normal">
          Acompanhe dados experimentais já persistidos no Supabase. Esta visualização é somente leitura e não substitui os módulos locais.
        </p>

        {loading ? (
          <div className="py-12 flex items-center justify-center text-xs text-muted-foreground gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
            Carregando consolidação do Supabase...
          </div>
        ) : error ? (
          <div className="p-4 border border-destructive/30 bg-destructive/5 rounded-lg text-xs text-destructive flex flex-col gap-2">
            <p className="font-semibold">Erro ao carregar consolidado:</p>
            <p className="opacity-95">Falha em um ou mais serviços remotos do Supabase. Verifique a sua conexão.</p>
          </div>
        ) : (
          <>
            {/* Grid de Resumo das Entidades */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* CRM Card */}
              <div className="p-3 border border-border/60 bg-muted/10 rounded-lg space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[10px] font-semibold uppercase tracking-wide">CRM</span>
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-bold text-foreground">{stats.crmTotal}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Ativas: <span className="text-foreground font-semibold">{stats.crmOpen}</span> | Ganhas: <span className="text-foreground font-semibold">{stats.crmWon}</span>
                  </p>
                </div>
              </div>

              {/* Orçamentos Card */}
              <div className="p-3 border border-border/60 bg-muted/10 rounded-lg space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[10px] font-semibold uppercase tracking-wide">Orçamentos</span>
                  <FileText className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-bold text-foreground">{stats.quotesTotal}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Aprovados: <span className="text-emerald-400 font-semibold">{stats.quotesApproved}</span> ({formatBRL(stats.quotesApprovedVal)})
                  </p>
                </div>
              </div>

              {/* Recebíveis Card */}
              <div className="p-3 border border-border/60 bg-muted/10 rounded-lg space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[10px] font-semibold uppercase tracking-wide">Recebíveis</span>
                  <DollarSign className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-bold text-foreground">{stats.finTotal}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Pendentes: <span className="text-amber-400 font-semibold">{stats.finPending}</span> ({formatBRL(stats.finPendingVal)})
                  </p>
                </div>
              </div>

              {/* Projetos Card */}
              <div className="p-3 border border-border/60 bg-muted/10 rounded-lg space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[10px] font-semibold uppercase tracking-wide">Projetos</span>
                  <Briefcase className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-bold text-foreground">{stats.projTotal}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Ativos: <span className="text-foreground font-semibold">{stats.projActive}</span> | Budget: <span className="text-foreground font-semibold">{formatBRL(stats.projBudgetVal)}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Seção Fluxo Comercial */}
            <div className="pt-2">
              <h4 className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-primary" />
                Relações do Fluxo Comercial
              </h4>
              <div className="border border-border/60 rounded-lg divide-y divide-border/40 text-xs">
                <div className="p-2.5 flex items-center justify-between">
                  <span className="text-muted-foreground">Oportunidades com orçamento vinculado</span>
                  <span className="font-semibold text-foreground">{stats.oppsWithQuote}</span>
                </div>
                <div className="p-2.5 flex items-center justify-between">
                  <span className="text-muted-foreground text-emerald-400">Orçamentos aprovados com recebível gerado</span>
                  <span className="font-semibold text-emerald-400">{stats.approvedWithReceivable}</span>
                </div>
                <div className="p-2.5 flex items-center justify-between">
                  <span className="text-muted-foreground text-emerald-400">Orçamentos aprovados com projeto gerado</span>
                  <span className="font-semibold text-emerald-400">{stats.approvedWithProject}</span>
                </div>
                <div className="p-2.5 flex items-center justify-between">
                  <span className="text-muted-foreground text-destructive">Orçamentos aprovados pendentes de recebível</span>
                  <span className="font-semibold text-destructive">{stats.approvedNoReceivable}</span>
                </div>
                <div className="p-2.5 flex items-center justify-between">
                  <span className="text-muted-foreground text-destructive">Orçamentos aprovados pendentes de projeto</span>
                  <span className="font-semibold text-destructive">{stats.approvedNoProject}</span>
                </div>
              </div>
            </div>

            {/* Lista de Projetos Supabase */}
            <div className="pt-4 border-t border-border/40">
              <h4 className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-primary" />
                Listagem de Projetos Supabase (Experimental)
              </h4>
              {projects.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhum projeto encontrado no Supabase.</p>
              ) : (
                <div className="space-y-2">
                  {projects.map((proj) => (
                    <div key={proj.id} className="p-2.5 border border-border/60 bg-muted/5 rounded-lg text-xs space-y-2">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground truncate">{proj.title}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Status: <span className="capitalize text-foreground">{proj.status}</span> | Budget: {formatBRL(proj.budget || 0)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleProjectExpand(proj.id)}
                            className="h-8 text-[11px] px-2.5"
                          >
                            {expandedProjects[proj.id] ? "Ocultar tarefas" : "Ver tarefas"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleGenerateTasksClick(proj)}
                            className="h-8 text-[11px] gap-1 px-2.5"
                          >
                            <CheckSquare className="h-3 w-3 text-primary" />
                            Gerar tarefas base
                          </Button>
                        </div>
                      </div>
                      
                      {expandedProjects[proj.id] && (
                        <ProjectTasksList projectId={proj.id} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {selectedProject && (
        <CreateProjectBaseTasksDialog
          open={tasksModalOpen}
          onOpenChange={setTasksModalOpen}
          workspaceId={workspace.id}
          projectId={selectedProject.id}
          clientId={selectedProject.client_id}
          quoteId={selectedProject.quote_id}
          opportunityId={selectedProject.opportunity_id}
          onSuccess={projRefresh}
        />
      )}
    </SettingsCard>
  );
}
