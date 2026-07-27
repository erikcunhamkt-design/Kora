import React, { useState } from "react";
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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { quotesRepository } from "@/repositories/quotesRepository";
import { buildNativeSourceLocalId } from "@/lib/installId";
import type { Lead } from "@/hooks/useLeads";
import { formatCurrency as intlCurrency } from "@/lib/format";

interface CreateCrmSupabaseQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  onSuccess: (quoteId: string, total: number) => void;
}

interface QuoteItemInput {
  name: string;
  description: string;
  quantity: number;
  price: number;
}

export function CreateCrmSupabaseQuoteDialog({
  open,
  onOpenChange,
  lead,
  onSuccess,
}: CreateCrmSupabaseQuoteDialogProps) {
  const { workspace } = useCurrentWorkspace();
  const [submitting, setSubmitting] = useState(false);

  // Pre-filled fields from CRM opportunity
  const [title, setTitle] = useState(`Orçamento - ${lead.name}`);
  const [clientName, setClientName] = useState(lead.name);
  const [company, setCompany] = useState(lead.company || "");
  const [email, setEmail] = useState(lead.email || "");
  const [phone, setPhone] = useState(lead.phone || "");
  const [validUntil, setValidUntil] = useState("");
  const [description, setDescription] = useState("");
  const [terms, setTerms] = useState("");

  const [items, setItems] = useState<QuoteItemInput[]>([
    { name: "Serviço de Design", description: lead.serviceType || "", quantity: 1, price: lead.estimatedValue || 0 },
  ]);

  const handleAddItem = () => {
    setItems((prev) => [...prev, { name: "", description: "", quantity: 1, price: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.error("O orçamento deve conter pelo menos 1 item.");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = <K extends keyof QuoteItemInput>(
    index: number,
    key: K,
    val: QuoteItemInput[K]
  ) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [key]: val } : item))
    );
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  };

  const handleCreate = async () => {
    if (!title.trim()) return toast.error("O título do orçamento é obrigatório.");
    if (!clientName.trim()) return toast.error("O nome do cliente é obrigatório.");
    if (!email.trim()) return toast.error("O e-mail do cliente é obrigatório.");
    if (items.some((item) => !item.name.trim())) {
      return toast.error("Todos os itens do orçamento devem ter um nome.");
    }

    if (!workspace) {
      return toast.error("Workspace ativo não encontrado.");
    }

    setSubmitting(true);

    try {
      // 1. Resolve potential Supabase UUID for client_id from client mapping
      let supabaseClientId: string | null = null;
      if (lead.clientId) {
        try {
          const rawMap = localStorage.getItem("kora.clients.supabaseImport.v1");
          if (rawMap) {
            const parsed = JSON.parse(rawMap);
            const mappedUuid = parsed.importedMap?.[String(lead.clientId)];
            if (mappedUuid) {
              supabaseClientId = mappedUuid;
            }
          }
        } catch (err) {
          console.error("Erro ao ler mapeamento de cliente:", err);
        }
      }

      const totalVal = calculateTotal();

      // Etapa 5 · Fatia 10 (item 1, Q10) — criação atômica via RPC, sempre: pai +
      // itens na MESMA transação (import_quote_with_items), nunca duas chamadas
      // separadas. source_local_id sintético — esta quote não vem de um registro
      // local a importar (ver src/lib/installId.ts, buildNativeSourceLocalId).
      //
      // Nomes de coluna corrigidos aqui de propósito: a versão anterior deste
      // payload usava client_phone/client_company/valid_until/terms/description
      // (item)/total_price/order_index — NENHUMA dessas colunas existe no schema
      // real (public.quotes/public.quote_items). Toda invocação real desta tela
      // teria falhado com "column does not exist" antes mesmo do problema de
      // atomicidade se manifestar — um bug pré-existente e não documentado,
      // corrigido de quebra ao reconstruir o payload pra bater com a RPC.
      // validUntil/terms não têm coluna própria — preservados em `notes`, não
      // descartados. O campo "descrição" por item também nunca teve coluna real
      // em quote_items (só name/quantity/unit_price) — continua sem persistir,
      // mesma limitação de antes, não uma regressão desta correção.
      const notesParts: string[] = [];
      if (validUntil) notesParts.push(`Validade: ${validUntil}`);
      if (terms.trim()) notesParts.push(`Termos: ${terms.trim()}`);

      const resultQuote = await quotesRepository.importQuoteWithItems(
        workspace.id,
        buildNativeSourceLocalId(),
        {
          client_id: supabaseClientId,
          opportunity_id: lead.supabaseId || null,
          client_name: clientName.trim(),
          client_email: email.trim(),
          title: title.trim(),
          description: description.trim() || null,
          subtotal: totalVal,
          discount: 0,
          total: totalVal,
          status: "draft",
          archived: false,
          client_whatsapp: phone.trim() || null,
          company: company.trim() || null,
          notes: notesParts.length ? notesParts.join(" · ") : null,
        },
        items.map((item) => ({
          name: item.name.trim(),
          quantity: item.quantity,
          unit_price: item.price,
        })),
      );
      const createdQuoteId = resultQuote.id;

      // Log successful creation locally
      try {
        const logRaw = localStorage.getItem("kora.crm.supabaseCreatedQuotes.v1") || "[]";
        const logParsed = JSON.parse(logRaw);
        logParsed.push({
          opportunityId: lead.supabaseId || null,
          quoteId: createdQuoteId,
          title: title.trim(),
          total: totalVal,
          createdAt: new Date().toISOString(),
        });
        localStorage.setItem("kora.crm.supabaseCreatedQuotes.v1", JSON.stringify(logParsed));
      } catch (err) {
        console.error("Erro ao gravar log local do orçamento criado:", err);
      }

      toast.success("Orçamento criado com sucesso no Supabase!");
      onSuccess(createdQuoteId, totalVal);
      onOpenChange(false);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("Erro ao criar orçamento no Supabase:", err);
      toast.error(`Falha ao criar orçamento: ${err.message || "Erro desconhecido"}`);
      // Sem rollback manual: a RPC é transacional (pai+itens na mesma transação),
      // uma falha aqui nunca deixa uma quote "decapitada" (sem itens) na nuvem.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Criar orçamento a partir da oportunidade</DialogTitle>
          <DialogDescription>
            Preencha os dados do orçamento experimental no Supabase. Os itens serão associados a esta oportunidade.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2 text-xs">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-muted-foreground">Título do orçamento*</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 bg-muted/40 border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground">Nome do Cliente*</Label>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} className="h-8 bg-muted/40 border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground">Empresa</Label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} className="h-8 bg-muted/40 border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground">E-mail*</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-8 bg-muted/40 border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground">Telefone / WhatsApp</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-8 bg-muted/40 border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground">Validade</Label>
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="h-8 bg-muted/40 border-border" />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex justify-between items-center mb-1">
              <Label className="text-muted-foreground font-semibold">Itens do Orçamento ({items.length})</Label>
              <Button type="button" size="sm" variant="outline" onClick={handleAddItem} className="h-7 text-[11px] gap-1">
                <Plus className="h-3 w-3" /> Adicionar item
              </Button>
            </div>

            <div className="space-y-2 border border-border/40 rounded-lg p-2.5 bg-muted/10">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_2fr_60px_100px_30px] gap-2 items-start py-2 border-b border-border/30 last:border-b-0">
                  <div className="space-y-1">
                    <Input placeholder="Nome" value={item.name} onChange={(e) => handleItemChange(idx, "name", e.target.value)} className="h-8 bg-background border-border text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Input placeholder="Descrição" value={item.description} onChange={(e) => handleItemChange(idx, "description", e.target.value)} className="h-8 bg-background border-border text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Input type="number" min="1" value={item.quantity} onChange={(e) => handleItemChange(idx, "quantity", Number(e.target.value) || 1)} className="h-8 bg-background border-border text-xs text-center" />
                  </div>
                  <div className="space-y-1">
                    <Input type="number" placeholder="Valor" value={item.price || ""} onChange={(e) => handleItemChange(idx, "price", Number(e.target.value) || 0)} className="h-8 bg-background border-border text-xs text-right" />
                  </div>
                  <Button type="button" size="icon" variant="ghost" onClick={() => handleRemoveItem(idx)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-muted-foreground">Observações</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[50px] bg-muted/40 border-border text-xs" />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-muted-foreground">Termos e Condições</Label>
            <Textarea value={terms} onChange={(e) => setTerms(e.target.value)} className="min-h-[50px] bg-muted/40 border-border text-xs" />
          </div>
        </div>

        <div className="flex justify-between items-center text-xs mt-3 pt-3 border-t border-border/40">
          <span className="text-muted-foreground">Total Calculado:</span>
          <span className="text-base font-bold text-foreground">
            {intlCurrency(calculateTotal())}
          </span>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={submitting}
            size="sm"
            className="orbit-gradient text-white border-0 gap-1"
          >
            {submitting ? "Criando..." : "Criar Orçamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
