import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { tasksRepository } from "@/repositories/tasksRepository";

interface CreateProjectBaseTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  projectId: string;
  clientId?: string | null;
  quoteId?: string | null;
  opportunityId?: string | null;
  onSuccess: () => void;
}

interface EditableTask {
  checked: boolean;
  title: string;
  description: string;
  priority: string;
  dueDate: string;
}

const DEFAULT_TASKS = [
  { title: "Kickoff com cliente", description: "Reunião de alinhamento inicial do projeto.", priority: "medium", offsetDays: 2 },
  { title: "Coletar materiais", description: "Solicitar e agrupar assets e informações enviadas pelo cliente.", priority: "medium", offsetDays: 4 },
  { title: "Revisar briefing", description: "Leitura minuciosa das respostas do briefing e validação das premissas.", priority: "medium", offsetDays: 6 },
  { title: "Planejar entregas", description: "Definir marcos, cronograma preliminar e recursos internos.", priority: "medium", offsetDays: 8 },
  { title: "Produzir primeira entrega", description: "Desenvolvimento do primeiro rascunho/mockup principal.", priority: "high", offsetDays: 15 },
  { title: "Revisão interna", description: "Validação do material produzido com o time ou auto-revisão.", priority: "medium", offsetDays: 18 },
  { title: "Enviar para aprovação", description: "Apresentar a primeira entrega ao cliente para feedback.", priority: "medium", offsetDays: 20 },
  { title: "Ajustes finais", description: "Aplicar feedbacks solicitados pelo cliente.", priority: "medium", offsetDays: 25 },
  { title: "Encerramento do projeto", description: "Entrega de arquivos finais e solicitação de depoimento.", priority: "low", offsetDays: 30 },
];

export function CreateProjectBaseTasksDialog({
  open,
  onOpenChange,
  workspaceId,
  projectId,
  clientId,
  quoteId,
  opportunityId,
  onSuccess,
}: CreateProjectBaseTasksDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [taskList, setTaskList] = useState<EditableTask[]>([]);

  useEffect(() => {
    if (open) {
      const today = new Date();
      const initialList = DEFAULT_TASKS.map((t) => {
        const dueDate = new Date();
        dueDate.setDate(today.getDate() + t.offsetDays);
        return {
          checked: true,
          title: t.title,
          description: t.description,
          priority: t.priority,
          dueDate: dueDate.toISOString().slice(0, 10),
        };
      });
      setTaskList(initialList);
    }
  }, [open]);

  const handleToggle = (index: number) => {
    setTaskList((prev) =>
      prev.map((item, i) => (i === index ? { ...item, checked: !item.checked } : item))
    );
  };

  const handleFieldChange = (index: number, field: keyof EditableTask, value: string) => {
    setTaskList((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleConfirm = async () => {
    const selectedTasks = taskList.filter((t) => t.checked);
    if (selectedTasks.length === 0) {
      toast.error("Selecione pelo menos uma tarefa para gerar.");
      return;
    }

    if (selectedTasks.some((t) => !t.title.trim())) {
      toast.error("Todas as tarefas selecionadas devem ter um título.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Evitar duplicidade: verificar se já existem tarefas Supabase ativas para o project_id
      const existing = await tasksRepository.listTasksByProject(workspaceId, projectId);
      const hasBaseTasks = existing.some((t) => t.source === "project_template" && !t.deleted_at);
      if (hasBaseTasks) {
        toast.error("Este projeto já possui tarefas base geradas.");
        setSubmitting(false);
        return;
      }

      // 2. Persistir no Supabase
      const payload = selectedTasks.map((t, idx) => ({
        project_id: projectId,
        client_id: clientId || null,
        quote_id: quoteId || null,
        opportunity_id: opportunityId || null,
        title: t.title,
        description: t.description || null,
        status: "todo",
        priority: t.priority,
        due_date: t.dueDate || null,
        source: "project_template",
        sort_order: idx,
        is_demo: false,
        archived: false,
      }));

      const createdTasks = await tasksRepository.createProjectBaseTasks(workspaceId, payload);
      const createdIds = createdTasks.map((t) => t.id);

      // 3. Log local de sucesso no localStorage
      try {
        const logRaw = localStorage.getItem("kora.projects.supabaseBaseTasks.v1") || "[]";
        const logParsed = JSON.parse(logRaw);
        logParsed.push({
          projectId,
          taskIds: createdIds,
          count: createdIds.length,
          createdAt: new Date().toISOString(),
        });
        localStorage.setItem("kora.projects.supabaseBaseTasks.v1", JSON.stringify(logParsed));
      } catch (logErr) {
        console.error("Erro ao gravar log local de tarefas:", logErr);
      }

      toast.success("Tarefas base geradas com sucesso no Supabase!");
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      console.error("Erro ao gerar tarefas base:", err);
      toast.error("Erro ao gerar tarefas base no Supabase.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground text-sm font-semibold">Gerar tarefas base?</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-normal">
            Isso criará o checklist básico de tarefas no Supabase para este projeto. Ajuste prazos e prioridades conforme necessário.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-3 text-xs">
          <div className="border border-border/60 rounded-lg divide-y divide-border/40 overflow-hidden bg-background/25">
            {taskList.map((task, idx) => (
              <div key={idx} className={`p-3 flex items-start gap-3 transition-colors ${task.checked ? "bg-primary/[0.01]" : "opacity-50 bg-muted/5"}`}>
                <div className="pt-1">
                  <Checkbox
                    id={`task-check-${idx}`}
                    checked={task.checked}
                    onCheckedChange={() => handleToggle(idx)}
                    className="h-3.5 w-3.5"
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={task.title}
                      onChange={(e) => handleFieldChange(idx, "title", e.target.value)}
                      disabled={!task.checked}
                      className="bg-background/40 h-8 text-xs font-semibold py-1 px-2 flex-1 border-border/80"
                      placeholder="Título da tarefa"
                    />
                    <Select
                      value={task.priority}
                      onValueChange={(val) => handleFieldChange(idx, "priority", val)}
                      disabled={!task.checked}
                    >
                      <SelectTrigger className="w-24 h-8 text-xs bg-background/40 border-border/80">
                        <SelectValue placeholder="Prioridade" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="high" className="text-xs">Alta</SelectItem>
                        <SelectItem value="medium" className="text-xs">Média</SelectItem>
                        <SelectItem value="low" className="text-xs">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2 items-center">
                    <Input
                      value={task.description}
                      onChange={(e) => handleFieldChange(idx, "description", e.target.value)}
                      disabled={!task.checked}
                      className="bg-background/20 h-7 text-[11px] py-1 px-2 flex-1 border-border/40 text-muted-foreground"
                      placeholder="Descrição (opcional)"
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Label htmlFor={`task-due-${idx}`} className="text-[10px] text-muted-foreground">Prazo:</Label>
                      <Input
                        id={`task-due-${idx}`}
                        type="date"
                        value={task.dueDate}
                        onChange={(e) => handleFieldChange(idx, "dueDate", e.target.value)}
                        disabled={!task.checked}
                        className="bg-background/40 h-7 text-[10px] w-28 py-0.5 px-1.5 border-border/60"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-border text-foreground h-9 text-xs"
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            className="orbit-gradient text-white border-0 h-9 text-xs"
            disabled={submitting}
          >
            {submitting ? "Gerando..." : "Confirmar e Gerar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
