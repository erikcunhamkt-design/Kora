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
  // G22 (Fase B, dashboard-g22-fix): dual-write — o lançamento local continua sendo
  // a fonte que a tela Financeiro lê (invariante "local nunca refém da nuvem"), mas
  // workspaceId/quoteId/clientId/opportunityId agora alimentam também um espelho em
  // financeRepository.createReceivableFromQuote (nuvem), pra fechar o gap que deixava
  // a reconciliação do dashboard Supabase sempre vendo 0 recebíveis pra orçamentos
  // aprovados por aqui.
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
        quoteId,
        dueDate,
        status: "pending",
        paymentMethod: "pix",
        recurrence: "none",
        source: "quote",
      });

      // G22 (Fase B) — espelho nuvem, best-effort: reusa createReceivableFromQuote,
      // já idempotente contra o UNIQUE PARCIAL ux_ft_receivable_from_quote via
      // catch(23505)+re-consulta (precedente P8b, docs/architecture/espelho-reversivel.md
      // §5) — nunca upsert direto contra um índice parcial. Falha aqui NUNCA desfaz
      // nem bloqueia o lançamento local acima (espelho nunca é refém, nem o local é
      // refém dele).
      try {
        await financeRepository.createReceivableFromQuote(workspaceId, {
          quote_id: quoteId,
          client_id: clientId ?? null,
          opportunity_id: opportunityId ?? null,
          title,
          description: description || `Gerado a partir do orçamento "${quoteTitle}".`,
          amount,
          due_date: dueDate,
        });
      } catch (mirrorErr) {
        console.error("Espelho nuvem do recebível falhou (local já gravado):", mirrorErr);
        toast.warning("Recebível salvo localmente, mas o espelho no Supabase falhou.", {
          description: "Rode a importação manual em Configurações → Dados quando possível.",
        });
      }

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
