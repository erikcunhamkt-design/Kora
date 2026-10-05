import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FolderKanban, Link2 } from "lucide-react";
import { toast } from "sonner";
import type { Quote } from "@/hooks/useQuotes";
import {
  useProjects, PROJECT_STATUS_LABEL,
  type ProjectStatus, type ProjectDeliverable, type Project,
} from "@/hooks/useProjects";
import { useTasks, formatPtBr, type Task } from "@/hooks/useTasks";
import { formatCurrency as intlCurrency } from "@/lib/format";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { mirrorProjectToSupabase } from "@/services/projects/projectsCloudMirror";
import { isSupabaseProjectsWriteEnabled } from "@/hooks/useSupabaseProjectsWriteFlag";
import { getProjectsDataSource, getTasksDataSource } from "@/config/flags";
import { useSupabaseProjects } from "@/hooks/useSupabaseProjects";
import { useSupabaseTasksAll } from "@/hooks/useSupabaseTasksAll";
import { useSupabaseTasksWriteFlag } from "@/hooks/useSupabaseTasksWriteFlag";
import { getFriendlyMessage } from "@/lib/supabase/errors";

const addDaysISO = (base: Date, days: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

function parseDeliveryDeadlineToISO(label: string | undefined): string | undefined {
  if (!label) return undefined;
  const m = label.match(/(\d+)\s*dia/i);
  if (m) return addDaysISO(new Date(), Number(m[1]));
  // If user already saved an ISO yyyy-mm-dd directly
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) return label;
  return undefined;
}

export interface QuoteToProjectDialogProps {
  quote: Quote | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Called with the created project once generated. */
  onGenerated: (project: Project) => void;
}

const STARTER_TASKS = [
  "Revisar escopo aprovado",
  "Organizar materiais do cliente",
  "Criar cronograma de entrega",
  "Enviar primeira atualização ao cliente",
];

export function QuoteToProjectDialog({
  quote, open, onOpenChange, onGenerated,
}: QuoteToProjectDialogProps) {
  const { addProject } = useProjects();
  const { addTask } = useTasks();
  const { workspace } = useCurrentWorkspace();

  // Caso 7.2 (homologação de Tarefas) — cutover total do "Gerar projeto":
  // antes desta fatia, o projeto usava só o padrão de espelho best-effort
  // (G22, mirrorCreateToSupabase abaixo) e as STARTER_TASKS iam SEMPRE pro
  // useTasks() local cru — em modo Supabase elas nunca chegavam na nuvem
  // (nenhum espelho pra tasks existe), ficando invisíveis assim que
  // Tarefas.tsx passasse a ler da nuvem (useBifurcatedTasks). Mesmo
  // condição de gate que ProjectsSection.tsx já usa pra criação nativa de
  // projeto (dataSource === "supabase", sem flag extra — o write-flag de
  // projetos só gateia o ESPELHO em modo local); tasks usam a condição
  // própria de Tarefas.tsx (dataSource === "supabase" && tasksWriteEnabled)
  // — cloudTaskMode SÓ fica true quando cloudMode também está, garantindo
  // que toda task nativa sempre recebe um project_id uuid real (nunca um id
  // local órfão): se o projeto for nativo mas o flag de escrita de tasks
  // estiver desligado, as tasks caem pro caminho local (addTask), gravando
  // localmente com um projectId que referencia um projeto só-nuvem — mesmo
  // padrão de referência mista já usado em outros lugares do app (ex.:
  // ClientActivitiesTab casando tarefa local por clientProjectIds vindo da
  // nuvem).
  const cloudMode = getProjectsDataSource() === "supabase";
  const { enabled: tasksWriteEnabled } = useSupabaseTasksWriteFlag();
  const cloudTaskMode = cloudMode && getTasksDataSource() === "supabase" && tasksWriteEnabled;
  const { createProject: createSupabaseProject } = useSupabaseProjects();
  const { createTask: createSupabaseTask } = useSupabaseTasksAll();

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planning");
  const [notes, setNotes] = useState("");
  const [createTasks, setCreateTasks] = useState(true);
  const [createDeliverables, setCreateDeliverables] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fallbackDueDate = useMemo(() => addDaysISO(new Date(), 30), []);

  useEffect(() => {
    if (!quote || !open) return;
    setName(`Projeto — ${quote.title}`);
    setStartDate(new Date().toISOString().slice(0, 10));
    setDueDate(parseDeliveryDeadlineToISO(quote.deliveryDeadline) ?? fallbackDueDate);
    setStatus("planning");
    setNotes(`Gerado a partir do orçamento "${quote.title}".`);
    setCreateTasks(true);
    setCreateDeliverables(true);
  }, [quote, open, fallbackDueDate]);

  if (!quote) return null;

  // G37 — mesmo payload local nos 2 modos (local addTask / nativo
  // createSupabaseTask aceitam o mesmo shape NewTaskInput, ver
  // useSupabaseTasksAll.ts). status/priority saem nos literais oficiais do
  // banco (a_fazer/média — G40/G49, sem tradução) — os CHECKs
  // tasks_status_known_chk/tasks_priority_known_chk (ativos em produção,
  // provados na homologação de Tarefas com erro 23514) exigem exatamente
  // esses valores. source: "projeto" (não "project_template") de propósito
  // — esse literal é exclusivo do produtor de CreateProjectBaseTasksDialog.tsx
  // e sua checagem de duplicidade (`source === "project_template"`); usar o
  // mesmo valor aqui faria essa tela pensar que o projeto já tem tarefas
  // base quando na verdade são as starter tasks deste dialog.
  const buildStarterTaskInputs = (project: Project): Omit<Task, "id" | "isDemo" | "createdAt">[] => {
    const baseDue = startDate || new Date().toISOString().slice(0, 10);
    const firstItem = quote.items[0]?.name;
    const titles = [...STARTER_TASKS];
    if (firstItem) titles.splice(3, 0, `Iniciar entrega: ${firstItem}`);
    return titles.map((title, idx) => {
      const iso = addDaysISO(new Date(baseDue), Math.min(idx * 2 + 2, 14));
      return {
        title,
        description: "",
        client: quote.clientName,
        project: project.name,
        projectId: project.id,
        clientId: quote.clientId,
        quoteId: quote.id,
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
      };
    });
  };

  const handleGenerate = async () => {
    if (!name.trim()) return toast.error("Informe o nome do projeto");
    if (!dueDate) return toast.error("Informe o prazo final");

    const deliverables: ProjectDeliverable[] = createDeliverables && quote.items.length
      ? quote.items.map((it, i) => ({
          id: `dl-${Date.now()}-${i}`,
          title: it.name || `Entregável ${i + 1}`,
          description: undefined,
          status: "pendente",
        }))
      : [];

    const projectInput = {
      name: name.trim(),
      clientName: quote.clientName,
      clientId: quote.clientId,
      company: quote.company,
      quoteId: quote.id,
      quoteTitle: quote.title,
      opportunityId: quote.opportunityId,
      opportunityTitle: quote.opportunityTitle,
      source: "orçamento" as const,
      description: quote.description,
      serviceType: undefined,
      status,
      priority: "medium" as const,
      startDate: startDate || undefined,
      dueDate: dueDate || undefined,
      budget: quote.total,
      tags: [] as string[],
      deliverables: deliverables.length ? deliverables : undefined,
      notes: notes.trim() || undefined,
    };

    // Cutover total (Caso 7.2): em modo Supabase, projeto E starter tasks
    // vão direto pra nuvem — mesmo padrão nativo que ProjectDetailDrawer/
    // ProjectsSection/Tarefas.tsx já usam pós-flip, nunca local+espelho.
    if (cloudMode) {
      if (!workspace) {
        toast.error("Nenhum workspace ativo — não foi possível criar o projeto.");
        return;
      }
      setSubmitting(true);
      try {
        const createdRow = await createSupabaseProject(projectInput);
        const createdProject: Project = {
          ...projectInput,
          id: createdRow.id,
          createdAt: createdRow.created_at,
          isDemo: false,
          progress: 0,
        };

        if (createTasks) {
          const taskInputs = buildStarterTaskInputs(createdProject);
          if (cloudTaskMode) {
            const results = await Promise.allSettled(taskInputs.map((t) => createSupabaseTask(t)));
            const failedCount = results.filter((r) => r.status === "rejected").length;
            if (failedCount > 0) {
              toast.warning(
                `Projeto criado, mas ${failedCount} de ${taskInputs.length} tarefas iniciais falharam ao salvar na nuvem.`,
              );
            }
          } else {
            // cloudMode true + tasksWriteEnabled false (raro, flag isolado
            // desligado): tarefas caem pro caminho local — referenciando o
            // uuid do projeto nativo, mesmo padrão de referência mista já
            // usado em outros lugares do app.
            taskInputs.forEach((t) => addTask(t));
          }
        }

        toast.success("Projeto criado", {
          description: `${createdProject.name} — vinculado ao orçamento`,
        });
        onGenerated(createdProject);
        onOpenChange(false);
      } catch (err) {
        console.error("Falha ao criar projeto no Supabase:", err);
        toast.error("Falha ao criar projeto no Supabase", { description: getFriendlyMessage(err) });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Modo local — comportamento intocado (addProject + espelho best-effort
    // de projeto, tarefas sempre locais).
    const project = addProject(projectInput);

    if (createTasks) {
      buildStarterTaskInputs(project).forEach((t) => addTask(t));
    }

    toast.success("Projeto criado", {
      description: `${project.name} — vinculado ao orçamento`,
    });
    mirrorCreateToSupabase(project);
    onGenerated(project);
    onOpenChange(false);
  };

  // Etapa 5 · Pacote do Flip (projects) — Fase B, item 2 (achado (a),
  // risco R5 da Fase A do flip): antes desta fatia, este era o ÚNICO
  // caminho de "quote vira projeto" sem nenhum espelho — um projeto criado
  // aqui ficava permanentemente invisível assim que a tela principal
  // passasse a ler da nuvem por padrão. Mesmo padrão G22 já usado em
  // ProjectsSection.tsx (fatia N): local sempre autoritativo e grava
  // primeiro (acima); isto só tenta espelhar quando o flag mestre está ON.
  // Falha aqui NUNCA desfaz nem bloqueia o local — só avisa.
  const mirrorCreateToSupabase = (project: Project) => {
    if (!isSupabaseProjectsWriteEnabled() || !workspace) return;
    mirrorProjectToSupabase(workspace.id, project).catch((mirrorErr) => {
      console.error("Espelho nuvem do projeto falhou (local já gravado):", mirrorErr);
      toast.warning("Projeto salvo localmente, mas o espelho no Supabase falhou.", {
        description: "Rode a importação manual em Configurações → Dados quando possível.",
      });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-primary" />
            Gerar projeto
          </DialogTitle>
          <DialogDescription>
            {`Transforme este orçamento aprovado em um projeto ${cloudMode ? "na nuvem (Supabase)" : "local"} com entregáveis e tarefas iniciais.`}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
          <Link2 className="h-3.5 w-3.5 text-primary" />
          Vinculado ao orçamento <span className="text-foreground font-medium">{quote.title}</span>
          {quote.clientName && <> · cliente <span className="text-foreground font-medium">{quote.clientName}</span></>}
        </div>

        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="qtp-name">Nome do projeto</Label>
            <Input id="qtp-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={140} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qtp-start">Data de início</Label>
              <Input id="qtp-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qtp-due">Prazo final</Label>
              <Input id="qtp-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status inicial</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["planning", "in_progress", "paused"] as ProjectStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor contratado</Label>
              <Input value={intlCurrency(quote.total)} readOnly className="bg-muted/30" />
            </div>
          </div>

          <div className="rounded-lg border border-border/60 px-3 py-2.5 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-foreground">Criar marcos a partir dos itens</div>
              <div className="text-[11px] text-muted-foreground">
                {quote.items.length} {quote.items.length === 1 ? "item vira entregável" : "itens viram entregáveis"}.
              </div>
            </div>
            <Switch checked={createDeliverables} onCheckedChange={setCreateDeliverables} disabled={!quote.items.length} />
          </div>

          <div className="rounded-lg border border-border/60 px-3 py-2.5 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-foreground">Criar tarefas iniciais</div>
              <div className="text-[11px] text-muted-foreground">
                Revisão de escopo, materiais, cronograma e primeira atualização.
              </div>
            </div>
            <Switch checked={createTasks} onCheckedChange={setCreateTasks} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qtp-notes">Observações</Label>
            <Textarea id="qtp-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={400} />
          </div>

          <p className="text-[11px] text-muted-foreground">
            Portal do cliente, upload de arquivos, aprovação online e notificações automáticas chegam em etapa futura.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Agora não</Button>
          <Button onClick={handleGenerate} className="gap-1.5" disabled={submitting}>
            <FolderKanban className="h-4 w-4" /> {submitting ? "Gerando..." : "Gerar projeto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
