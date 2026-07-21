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
import { useFinance } from "@/hooks/useFinance";

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
  // Etapa 5 · Fatia 6 (F5-b, adendo 39851d7): workspaceId/quoteId/clientId/opportunityId
  // seguem no contrato de props (os 2 chamadores — LinkedQuotesSection.tsx e
  // SupabaseQuotesViewerCard.tsx — não precisam mudar), mas não são desestruturados
  // aqui: são UUIDs de NUVEM (este diálogo só existe para orçamentos já migrados),
  // sem equivalente de id LOCAL, então não entram no lançamento local abaixo. O
  // caminho nuvem (financeRepository.createReceivableFromQuote) fica DESATIVADO ATÉ
  // O CUTOVER de leitura de finance, não abandonado — reaparece aqui quando esse
  // cutover acontecer.
  open,
  onOpenChange,
  quoteTitle,
  quoteTotal,
  onSuccess,
}: CreateReceivableDialogProps) {
  const fin = useFinance();
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
      // F5-b: grava LOCAL (useFinance().addTransaction), nivelado ao mesmo caminho que
      // QuoteToReceivableDialog.tsx (Vendas) já usa em produção — Financeiro.tsx só lê
      // local hoje (ver docs/qa/etapa-5-fatia-6-finance.md §9), então é o único jeito
      // do usuário ver este lançamento na tela que realmente usa. O caminho nuvem
      // (financeRepository.createReceivableFromQuote/findReceivableByQuote) segue
      // existindo, intocado — DESATIVADO ATÉ O CUTOVER, não abandonado.
      const tx = fin.addTransaction({
        type: "income",
        title,
        description: description || `Gerado a partir do orçamento "${quoteTitle}".`,
        amount,
        category: "Serviços",
        quoteTitle,
        dueDate,
        status: "pending",
        paymentMethod: "pix",
        recurrence: "none",
        source: "quote",
      });

      // Log local de sucesso — sem quoteId de nuvem aqui de propósito (ver comentário
      // acima do destructuring): a proveniência fica registrada pelo quoteTitle.
      try {
        const logRaw = localStorage.getItem("kora.quotes.supabaseReceivables.v1") || "[]";
        const logParsed = JSON.parse(logRaw);
        logParsed.push({
          quoteTitle,
          receivableId: tx.id,
          title,
          amount,
          createdAt: new Date().toISOString(),
          gravadoLocal: true,
        });
        localStorage.setItem("kora.quotes.supabaseReceivables.v1", JSON.stringify(logParsed));
      } catch (logErr) {
        console.error("Erro ao registrar log local de recebível:", logErr);
      }

      toast.success("Recebível financeiro gerado. Veja em Financeiro.");
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      console.error(err);
      toast.error("Erro ao gerar recebível financeiro.");
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
            Esta ação criará um lançamento financeiro a receber, visível na tela Financeiro, a partir deste orçamento aprovado. Nenhum pagamento será cobrado automaticamente.
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
