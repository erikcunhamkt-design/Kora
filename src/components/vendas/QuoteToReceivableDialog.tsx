import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Wallet, Link2 } from "lucide-react";
import { toast } from "sonner";
import type { Quote } from "@/hooks/useQuotes";
import {
  useFinance, formatBRL, type PaymentMethod,
} from "@/hooks/useFinance";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { financeRepository } from "@/repositories/financeRepository";
import { resolveFinanceFk } from "@/services/finance/financeMapper";

const paymentLabels: Record<PaymentMethod, string> = {
  pix: "PIX",
  card: "Cartão",
  boleto: "Boleto",
  transfer: "Transferência",
  cash: "Dinheiro",
  other: "Outro",
};

const addDaysISO = (base: Date, days: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export interface QuoteToReceivableDialogProps {
  quote: Quote | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Called with the created receivable id once the entry is generated. */
  onGenerated: (entryId: string) => void;
}

export function QuoteToReceivableDialog({
  quote, open, onOpenChange, onGenerated,
}: QuoteToReceivableDialogProps) {
  const fin = useFinance();
  const { workspace } = useCurrentWorkspace();

  const incomeCategories = useMemo(
    () => fin.categories.filter((c) => c.type === "income"),
    [fin.categories],
  );
  const defaultCategory = useMemo(() => {
    const preferred = incomeCategories.find((c) => c.name === "Serviços")
      ?? incomeCategories.find((c) => c.name === "Projetos")
      ?? incomeCategories[0];
    return preferred?.name ?? "Serviços";
  }, [incomeCategories]);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState<string>(defaultCategory);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [notes, setNotes] = useState("");

  // Reseed fields whenever a new quote is opened
  useEffect(() => {
    if (!quote || !open) return;
    setTitle(`Orçamento aprovado — ${quote.title}`);
    setAmount(String(quote.total ?? 0));
    const today = new Date();
    const validity = quote.validityDays || 7;
    setDueDate(addDaysISO(today, Math.max(validity, 7)));
    setCategory(defaultCategory);
    setPaymentMethod("pix");
    setNotes(`Gerado a partir do orçamento "${quote.title}".`);
  }, [quote, open, defaultCategory]);

  if (!quote) return null;

  const numericAmount = Number(amount) || 0;

  const handleGenerate = () => {
    if (!title.trim()) return toast.error("Informe um título");
    if (numericAmount <= 0) return toast.error("Informe um valor maior que zero");
    if (!dueDate) return toast.error("Informe a data de vencimento");

    const tx = fin.addTransaction({
      type: "income",
      title: title.trim(),
      description: quote.description || undefined,
      amount: numericAmount,
      category,
      clientName: quote.clientName,
      clientId: quote.clientId,
      quoteId: quote.id,
      quoteTitle: quote.title,
      opportunityId: quote.opportunityId,
      dueDate,
      status: "pending",
      paymentMethod,
      recurrence: "none",
      source: "quote",
      notes: notes.trim() || undefined,
    });

    toast.success("Conta a receber gerada", {
      description: `${title.trim()} · ${formatBRL(numericAmount)}`,
    });
    mirrorReceivableToSupabase(tx.id);
    onGenerated(tx.id);
    onOpenChange(false);
  };

  // Etapa 5 · Financeiro Fase B (Pacote do Flip, §5.1 do desenho) — o gap
  // real que sobrou do G41 (kora-hub-auditoria-e-plano.md): este diálogo só
  // gravava local, sem mirror nenhum, enquanto CreateReceivableDialog.tsx
  // (CRM) já tinha o dual-write G22 desde dashboard-g22-fix. Mesmo padrão:
  // local sempre autoritativo e grava primeiro (acima); isto só tenta
  // espelhar DEPOIS, best-effort, nunca bloqueia nem desfaz o local.
  // Unificando de propósito o comportamento dos 2 diálogos: mesma função
  // (`createReceivableFromQuote`, já idempotente contra 23505/
  // ux_ft_receivable_from_quote), sem gate de flag nenhum — CreateReceivableDialog.tsx
  // também nunca gateou o próprio mirror, e este diálogo replica esse
  // comportamento de propósito, não por omissão. "Payload completo desde o
  // dia 1" (G37): diferente do mirror de CreateReceivableDialog.tsx (que
  // não tem category/paymentMethod pra enviar — são hardcoded lá, achado
  // G41), aqui os 2 campos são escolhidos pelo usuário e viajam de verdade.
  // client_id/opportunity_id passam por resolveFinanceFk — se quote.clientId/
  // opportunityId já forem uuid real (quote lida da nuvem), o passthrough
  // (G37 por desenho, §2.2) encaminha direto; se forem id local sem mapa
  // (cenário comum aqui — sem import-map disponível neste componente),
  // resolve null, nunca um id cru na coluna uuid (padrão Q4).
  const mirrorReceivableToSupabase = (localTransactionId: string) => {
    if (!workspace) return;
    financeRepository.createReceivableFromQuote(workspace.id, {
      quote_id: quote.id,
      client_id: resolveFinanceFk(quote.clientId, {}),
      opportunity_id: resolveFinanceFk(quote.opportunityId, {}),
      title: title.trim(),
      description: quote.description || undefined,
      amount: numericAmount,
      due_date: dueDate,
      category,
      payment_method: paymentMethod,
    }).catch((mirrorErr) => {
      console.error("Espelho nuvem do recebível falhou (local já gravado):", mirrorErr, { localTransactionId });
      toast.warning("Recebível salvo localmente, mas o espelho no Supabase falhou.", {
        description: "Rode a importação manual em Configurações → Dados quando possível.",
      });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            Gerar conta a receber
          </DialogTitle>
          <DialogDescription>
            Transforme este orçamento aprovado em uma <strong>receita prevista</strong> no financeiro.
            Pagamento real, PIX e checkout chegam em etapa futura.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
          <Link2 className="h-3.5 w-3.5 text-primary" />
          Vinculado ao orçamento <span className="text-foreground font-medium">{quote.title}</span>
          {quote.clientName && <> · cliente <span className="text-foreground font-medium">{quote.clientName}</span></>}
        </div>

        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="qtr-title">Título</Label>
            <Input id="qtr-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qtr-amount">Valor (R$)</Label>
              <Input
                id="qtr-amount"
                type="number"
                min={0}
                step={50}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qtr-due">Vencimento</Label>
              <Input
                id="qtr-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {incomeCategories.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Forma de pagamento</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(paymentLabels) as PaymentMethod[]).map((p) => (
                    <SelectItem key={p} value={p}>{paymentLabels[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qtr-notes">Observações</Label>
            <Textarea
              id="qtr-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={400}
            />
          </div>

          <p className="text-[11px] text-muted-foreground">
            Pagamento real requer integração futura. Por enquanto a conta entra como <strong>pendente</strong> no
            financeiro e pode ser marcada como recebida manualmente.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Agora não</Button>
          <Button onClick={handleGenerate} className="gap-1.5">
            <Wallet className="h-4 w-4" /> Gerar conta a receber
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
