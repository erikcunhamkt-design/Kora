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
import { useTasks, formatPtBr } from "@/hooks/useTasks";
import { formatCurrency as intlCurrency } from "@/lib/format";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { mirrorProjectToSupabase } from "@/services/projects/projectsCloudMirror";
import { isSupabaseProjectsWriteEnabled } from "@/hooks/useSupabaseProjectsWriteFlag";

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

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planning");
  const [notes, setNotes] = useState("");
  const [createTasks, setCreateTasks] = useState(true);
  const [createDeliverables, setCreateDeliverables] = useState(true);

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

  const handleGenerate = () => {
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

    const project = addProject({
      name: name.trim(),
      clientName: quote.clientName,
      clientId: quote.clientId,
      company: quote.company,
      quoteId: quote.id,
      quoteTitle: quote.title,
      opportunityId: quote.opportunityId,
      opportunityTitle: quote.opportunityTitle,
      source: "orçamento",
      description: quote.description,
      serviceType: undefined,
      status,
      priority: "medium",
      startDate: startDate || undefined,
      dueDate: dueDate || undefined,
      budget: quote.total,
      tags: [],
      deliverables: deliverables.length ? deliverables : undefined,
      notes: notes.trim() || undefined,
    });

    if (createTasks) {
      const baseDue = startDate || new Date().toISOString().slice(0, 10);
      const firstItem = quote.items[0]?.name;
      const titles = [...STARTER_TASKS];
      if (firstItem) titles.splice(3, 0, `Iniciar entrega: ${firstItem}`);
      titles.forEach((title, idx) => {
        const iso = addDaysISO(new Date(baseDue), Math.min(idx * 2 + 2, 14));
        addTask({
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
        });
      });
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
            Transforme este orçamento aprovado em um projeto local com entregáveis e tarefas iniciais.
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Agora não</Button>
          <Button onClick={handleGenerate} className="gap-1.5">
            <FolderKanban className="h-4 w-4" /> Gerar projeto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
