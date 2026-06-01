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
import { projectsRepository } from "@/repositories/projectsRepository";

interface CreateProjectFromQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteTitle: string;
  quoteTotal: number;
  workspaceId: string;
  quoteId: string;
  clientId?: string | null;
  opportunityId?: string | null;
  onSuccess: () => void;
}

export function CreateProjectFromQuoteDialog({
  open,
  onOpenChange,
  quoteTitle,
  quoteTotal,
  workspaceId,
  quoteId,
  clientId,
  opportunityId,
  onSuccess,
}: CreateProjectFromQuoteDialogProps) {
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
      // 1. Evitar duplicidade: verificar se já existe projeto Supabase com quote_id, source=quote, deleted_at=null
      const existing = await projectsRepository.findProjectByQuote(workspaceId, quoteId);
      if (existing && existing.length > 0) {
        toast.error("Este orçamento já possui um projeto vinculado.");
        setSubmitting(false);
        return;
      }

      // 2. Persistência no Supabase
      const created = await projectsRepository.createProjectFromQuote(workspaceId, {
        client_id: clientId || null,
        quote_id: quoteId,
        opportunity_id: opportunityId || null,
        title,
        description: description || null,
        budget,
        start_date: startDate,
        due_date: dueDate,
        status: "active",
        source: "quote",
        is_demo: false,
        archived: false,
      });

      // 3. Log local de sucesso
      try {
        const logRaw = localStorage.getItem("kora.quotes.supabaseProjects.v1") || "[]";
        const logParsed = JSON.parse(logRaw);
        logParsed.push({
          quoteId,
          projectId: created.id,
          title,
          budget,
          createdAt: new Date().toISOString(),
        });
        localStorage.setItem("kora.quotes.supabaseProjects.v1", JSON.stringify(logParsed));
      } catch (logErr) {
        console.error("Erro ao registrar log local de projeto:", logErr);
      }

      toast.success("Projeto gerado com sucesso no Supabase!");
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      console.error(err);
      toast.error("Erro ao gerar projeto no Supabase.");
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
            Esta ação criará um projeto base no Supabase a partir deste orçamento aprovado. Tarefas, cronogramas e automações locais não serão criados nesta etapa.
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
