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
import { financeRepository } from "@/repositories/financeRepository";

interface CreateReceivableDialogProps {
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

export function CreateReceivableDialog({
  open,
  onOpenChange,
  quoteTitle,
  quoteTotal,
  workspaceId,
  quoteId,
  clientId,
  opportunityId,
  onSuccess,
}: CreateReceivableDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [dueDate, setDueDate] = useState("");

  // Pre-fill fields when dialog opens or changes
  useEffect(() => {
    if (open) {
      setTitle(`Recebível - ${quoteTitle}`);
      setAmount(quoteTotal);
      setDescription("");
      
      // Default due date to 15 days from now
      const date = new Date();
      date.setDate(date.getDate() + 15);
      setDueDate(date.toISOString().slice(0, 10));
    }
  }, [open, quoteTitle, quoteTotal]);

  const handleConfirm = async () => {
    if (!title.trim()) {
      toast.error("O título do recebível é obrigatório.");
      return;
    }
    if (amount <= 0) {
      toast.error("O valor do recebível deve ser maior que zero.");
      return;
    }
    if (!dueDate) {
      toast.error("A data de vencimento é obrigatória.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Evitar duplicidade: verificar se já existe recebível Supabase com mesmo quote_id, source=quote, type=receivable, deleted_at=null
      const existing = await financeRepository.findReceivableByQuote(workspaceId, quoteId);
      if (existing && existing.length > 0) {
        toast.error("Este orçamento já possui um recebível vinculado.");
        setSubmitting(false);
        return;
      }

      // 2. Persistência no Supabase
      const created = await financeRepository.createReceivableFromQuote(workspaceId, {
        client_id: clientId || null,
        quote_id: quoteId,
        opportunity_id: opportunityId || null,
        title,
        description: description || null,
        amount,
        due_date: dueDate,
        type: "receivable",
        status: "pending",
        source: "quote",
        is_demo: false,
        archived: false,
      });

      // 3. Log local de sucesso
      try {
        const logRaw = localStorage.getItem("kora.quotes.supabaseReceivables.v1") || "[]";
        const logParsed = JSON.parse(logRaw);
        logParsed.push({
          quoteId,
          receivableId: created.id,
          title,
          amount,
          createdAt: new Date().toISOString(),
        });
        localStorage.setItem("kora.quotes.supabaseReceivables.v1", JSON.stringify(logParsed));
      } catch (logErr) {
        console.error("Erro ao registrar log local de recebível:", logErr);
      }

      toast.success("Recebível financeiro gerado com sucesso no Supabase!");
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      console.error(err);
      toast.error("Erro ao gerar recebível financeiro no Supabase.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-sm font-semibold">Gerar recebível?</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-normal">
            Esta ação criará um lançamento financeiro a receber no Supabase a partir deste orçamento aprovado. Nenhum pagamento será cobrado automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3 text-xs">
          <div className="space-y-1">
            <Label htmlFor="rec-title" className="text-muted-foreground">Título</Label>
            <Input
              id="rec-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-background/50 h-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="rec-amount" className="text-muted-foreground">Valor (R$)</Label>
              <Input
                id="rec-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="bg-background/50 h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rec-due" className="text-muted-foreground">Vencimento</Label>
              <Input
                id="rec-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-background/50 h-9"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="rec-desc" className="text-muted-foreground">Observações / Descrição</Label>
            <Textarea
              id="rec-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notas adicionais sobre a transação..."
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
