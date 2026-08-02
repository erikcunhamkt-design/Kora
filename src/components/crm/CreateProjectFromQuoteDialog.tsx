import React, { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useProjects } from "@/hooks/useProjects";
import { projectsRepository } from "@/repositories/projectsRepository";

interface CreateProjectFromQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteTitle: string;
  quoteTotal: number;
  clientName: string;
  workspaceId: string;
  quoteId: string;
  clientId?: string | null;
  opportunityId?: string | null;
  onSuccess: () => void;
}

export function CreateProjectFromQuoteDialog({
  // G22 (Fase B, dashboard-g22-fix): dual-write — o projeto local continua sendo a
  // fonte que a tela Projetos lê (invariante "local nunca refém da nuvem"), mas
  // workspaceId/quoteId/clientId/opportunityId agora alimentam também um espelho em
  // projectsRepository.createProjectFromQuote (nuvem), pra fechar o gap que deixava
  // a reconciliação do dashboard Supabase sempre vendo 0 projetos pra orçamentos
  // aprovados por aqui.
  open,
  onOpenChange,
  quoteTitle,
  quoteTotal,
  clientName,
  workspaceId,
  quoteId,
  clientId,
  opportunityId,
  onSuccess,
}: CreateProjectFromQuoteDialogProps) {
  const { addProject } = useProjects();
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [budget, setBudget] = useState(0);

  // Pre-fill fields when modal opens
  useEffect(() => {
    if (open) {
      setTitle(`Projeto - ${quoteTitle}`);
      setBudget(quoteTotal);
      setDescription(`Projeto gerado a partir do orçamento experimental aprovado: ${quoteTitle}.`);
      
      const todayStr = new Date().toISOString().slice(0, 10);
      setStartDate(todayStr);

      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 30);
      setDueDate(targetDate.toISOString().slice(0, 10));
    }
  }, [open, quoteTitle, quoteTotal]);

  const handleConfirm = async () => {
    if (!title.trim()) {
      toast.error("O título do projeto é obrigatório.");
      return;
    }
    if (budget < 0) {
      toast.error("O orçamento do projeto não pode ser negativo.");
      return;
    }
    if (!startDate) {
      toast.error("A data de início é obrigatória.");
      return;
    }
    if (!dueDate) {
      toast.error("A data de vencimento/prazo é obrigatória.");
      return;
    }

    setSubmitting(true);
    try {
      // F5-equivalente (padrão F5-b): grava LOCAL (useProjects().addProject()),
      // nivelado ao mesmo caminho que QuoteToProjectDialog.tsx (Vendas) já usa em
      // produção — ProjectsSection.tsx só lê local hoje (ver
      // docs/qa/etapa-5-fatia-7-projects.md §2.4/§11), então é o único jeito do
      // usuário ver este projeto na tela que realmente usa. O caminho nuvem
      // (projectsRepository.createProjectFromQuote/findProjectByQuote) segue
      // existindo, intocado — DESATIVADO ATÉ O CUTOVER, não abandonado.
      const project = addProject({
        name: title,
        clientName,
        quoteTitle,
        description: description || undefined,
        budget,
        startDate,
        dueDate,
        status: "planning",
        priority: "medium",
        source: "orçamento",
        tags: [],
      });

      // G22 (Fase B) — espelho nuvem, best-effort: reusa createProjectFromQuote, já
      // idempotente contra o UNIQUE PARCIAL ux_projects_from_quote via
      // catch(23505)+re-consulta (precedente P8b, docs/architecture/espelho-reversivel.md
      // §5) — nunca upsert direto contra um índice parcial. Falha aqui NUNCA desfaz
      // nem bloqueia o projeto local acima (espelho nunca é refém, nem o local é
      // refém dele).
      try {
        await projectsRepository.createProjectFromQuote(workspaceId, {
          quote_id: quoteId,
          client_id: clientId ?? null,
          opportunity_id: opportunityId ?? null,
          title,
          description: description || undefined,
          budget,
          start_date: startDate,
          due_date: dueDate,
        });
      } catch (mirrorErr) {
        console.error("Espelho nuvem do projeto falhou (local já gravado):", mirrorErr);
        toast.warning("Projeto salvo localmente, mas o espelho no Supabase falhou.", {
          description: "Rode a importação manual em Configurações → Dados quando possível.",
        });
      }

      // Log local de sucesso — sem quoteId de nuvem aqui de propósito (ver comentário
      // acima do destructuring): a proveniência fica registrada pelo quoteTitle.
      try {
        const logRaw = localStorage.getItem("kora.quotes.supabaseProjects.v1") || "[]";
        const logParsed = JSON.parse(logRaw);
        logParsed.push({
          quoteTitle,
          projectId: project.id,
          title,
          budget,
          createdAt: new Date().toISOString(),
          gravadoLocal: true,
        });
        localStorage.setItem("kora.quotes.supabaseProjects.v1", JSON.stringify(logParsed));
      } catch (logErr) {
        console.error("Erro ao registrar log local de projeto:", logErr);
      }

      toast.success("Projeto criado. Veja em Projetos.");
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      console.error(err);
      toast.error("Erro ao gerar projeto.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-sm font-semibold">Gerar projeto?</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-normal">
            Esta ação criará um projeto local, visível na tela Projetos, a partir deste orçamento aprovado. Tarefas, cronogramas e automações não serão criados nesta etapa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3 text-xs">
          <div className="space-y-1">
            <Label htmlFor="proj-title" className="text-muted-foreground">Título do Projeto</Label>
            <Input
              id="proj-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-background/50 h-9"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="proj-budget" className="text-muted-foreground">Orçamento / Budget (R$)</Label>
            <Input
              id="proj-budget"
              type="number"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="bg-background/50 h-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="proj-start" className="text-muted-foreground">Data de Início</Label>
              <Input
                id="proj-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-background/50 h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="proj-due" className="text-muted-foreground">Prazo Final</Label>
              <Input
                id="proj-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-background/50 h-9"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="proj-desc" className="text-muted-foreground">Descrição / Observações</Label>
            <Textarea
              id="proj-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-background/50 min-h-[70px] resize-none"
            />
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
            {submitting ? "Processando..." : "Confirmar e Gerar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
