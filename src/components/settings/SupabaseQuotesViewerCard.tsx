import { useEffect, useMemo, useState } from "react";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useSupabaseQuotes } from "@/hooks/useSupabaseQuotes";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, FileText, Check, X } from "lucide-react";
import { QuoteActionDialog } from "@/components/crm/QuoteActionDialog";
import { CreateReceivableDialog } from "@/components/crm/CreateReceivableDialog";
import { CreateProjectFromQuoteDialog } from "@/components/crm/CreateProjectFromQuoteDialog";
import type { Quote } from "@/hooks/useQuotes";
import { toast } from "sonner";
import { formatCurrency as intlCurrency, formatDate as intlDate, formatDateTime as intlDateTime } from "@/lib/format";
import { getBooleanFlag } from "@/config/flags";

interface ImportMeta {
  importedMap?: Record<string, string>;
}

export function SupabaseQuotesViewerCard() {
  const { workspace } = useCurrentWorkspace();
  const { quotes, loading, error, refresh, approveQuote, rejectQuote } = useSupabaseQuotes();
  const [metadata, setMetadata] = useState<ImportMeta | null>(null);

  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [selectedQuoteTitle, setSelectedQuoteTitle] = useState<string>("");
  const [receivableDialogOpen, setReceivableDialogOpen] = useState(false);
  const [receivableQuote, setReceivableQuote] = useState<Quote | null>(null);

  const handleCreateReceivableClick = (quote: Quote) => {
    const flagEnabled = getBooleanFlag("quotesSupabaseCreateReceivable");
    if (!flagEnabled) {
      toast.info("Geração de recebível financeiro entra nesta etapa experimental. Ative em Configurações.");
      return;
    }
    setReceivableQuote(quote);
    setReceivableDialogOpen(true);
  };

  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectQuote, setProjectQuote] = useState<Quote | null>(null);

  const handleCreateProjectClick = (quote: Quote) => {
    const flagEnabled = getBooleanFlag("quotesSupabaseCreateProject");
    if (!flagEnabled) {
      toast.info("Geração de projeto experimental entra nesta etapa experimental. Ative em Configurações.");
      return;
    }
    setProjectQuote(quote);
    setProjectDialogOpen(true);
  };

  // Read metadata to check if quote is imported from local
  useEffect(() => {
    try {
      const raw = localStorage.getItem("kora.quotes.supabaseImport.v1");
      if (raw) {
        setMetadata(JSON.parse(raw));
      }
    } catch (e) {
      console.error(e);
    }
  }, [quotes]);

  const isImportedFromLocal = useMemo(() => {
    if (!metadata?.importedMap) return new Set<string>();
    return new Set<string>(Object.values(metadata.importedMap));
  }, [metadata]);

  const visibleQuotes = useMemo(() => {
    return (quotes || []).slice(0, 10);
  }, [quotes]);

  const experimentalEnabled = useMemo(() => {
    try {
      return getBooleanFlag("quotesSupabaseExperimental");
    } catch {
      return false;
    }
  }, []);

  const handleActionClick = (quoteId: string, title: string, type: "approve" | "reject") => {
    const flagEnabled = getBooleanFlag("quotesSupabaseApproval");
    if (!flagEnabled) {
      toast.info("Aprovação de orçamentos Supabase entra nesta etapa experimental. Ative em Configurações.");
      return;
    }
    setSelectedQuoteId(quoteId);
    setSelectedQuoteTitle(title);
    setActionType(type);
  };

  const handleConfirmAction = async () => {
    if (!selectedQuoteId || !actionType) return;
    setSubmittingId(selectedQuoteId);

    try {
      if (actionType === "approve") {
        await approveQuote(selectedQuoteId);
        
        // Log local approval
        try {
          const logRaw = localStorage.getItem("kora.quotes.supabaseApprovals.v1") || "[]";
          const logParsed = JSON.parse(logRaw);
          logParsed.push({
            quoteId: selectedQuoteId,
            title: selectedQuoteTitle,
            approvedAt: new Date().toISOString(),
          });
          localStorage.setItem("kora.quotes.supabaseApprovals.v1", JSON.stringify(logParsed));
        } catch (err) {
          console.error("Erro ao gravar log local:", err);
        }

        toast.success("Orçamento aprovado com sucesso!");
      } else {
        await rejectQuote(selectedQuoteId);
        
        // Log local rejection
        try {
          const logRaw = localStorage.getItem("kora.quotes.supabaseRejections.v1") || "[]";
          const logParsed = JSON.parse(logRaw);
          logParsed.push({
            quoteId: selectedQuoteId,
            title: selectedQuoteTitle,
            rejectedAt: new Date().toISOString(),
          });
          localStorage.setItem("kora.quotes.supabaseRejections.v1", JSON.stringify(logParsed));
        } catch (err) {
          console.error("Erro ao gravar log local:", err);
        }

        toast.success("Orçamento rejeitado com sucesso!");
      }
      refresh();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar status do orçamento.");
      refresh();
    } finally {
      setSubmittingId(null);
      setActionType(null);
      setSelectedQuoteId(null);
    }
  };

  if (!workspace || !experimentalEnabled) return null;

  return (
    <SettingsCard 
      title="Orçamentos no Supabase (Experimental)" 
      headerActions={
        <Button 
          variant="outline" 
          size="sm" 
          onClick={refresh} 
          disabled={loading}
          className="h-8 gap-1.5 px-2.5"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Visualização passiva de somente leitura dos orçamentos salvos no Supabase.
        </p>

        <div className="rounded-lg border border-primary/20 bg-primary/[0.02] p-3 text-xs text-muted-foreground/90">
          Esta visualização confirma os orçamentos no Supabase para o workspace ativo. A tela principal de Vendas/Orçamentos ainda usa localStorage.
        </div>

        {loading ? (
          <div className="py-8 flex items-center justify-center text-xs text-muted-foreground gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
            Carregando orçamentos do Supabase...
          </div>
        ) : error ? (
          <div className="p-4 border border-destructive/30 bg-destructive/5 rounded-lg text-xs text-destructive flex flex-col gap-2">
            <p className="font-semibold">Erro ao carregar orçamentos:</p>
            <p className="opacity-90">{error}</p>
            <Button variant="outline" size="sm" onClick={refresh} className="w-fit self-end mt-2">
              Tentar novamente
            </Button>
          </div>
        ) : quotes.length === 0 ? (
          <div className="py-8 border border-dashed border-border/60 rounded-lg text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
            <FileText className="h-8 w-8 text-muted-foreground/60" />
            <span>Nenhum orçamento encontrado no Supabase para este workspace.</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="border border-border/60 rounded-lg overflow-hidden bg-muted/5 divide-y divide-border/40">
              {visibleQuotes.map((quote) => {
                const imported = isImportedFromLocal.has(quote.id);
                return (
                  <div key={quote.id} className="p-3 flex flex-col gap-2 text-xs">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground truncate">{quote.title}</span>
                          <Badge variant="outline" className="text-[9px] uppercase tracking-wide text-primary border-primary/30 py-0 px-1.5">
                            Supabase
                          </Badge>
                          {imported && (
                            <Badge variant="outline" className="text-[9px] uppercase tracking-wide text-emerald-400 border-emerald-500/20 bg-emerald-500/10 py-0 px-1.5">
                              Importado do local
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          Cliente: {quote.clientName} ({quote.clientEmail})
                        </p>
                        {(quote as any).validUntil && (
                          <p className="text-[10px] text-muted-foreground/80 mt-0.5 truncate">
                            Validade: {intlDate((quote as any).validUntil)}
                          </p>
                        )}
                        {quote.approvedAt && (quote.status as string) === "approved" && (
                          <p className="text-[10px] text-emerald-400 mt-0.5 truncate font-medium">
                            Aprovado em: {intlDateTime(quote.approvedAt, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </p>
                        )}
                        {quote.rejectedAt && (quote.status as string) === "rejected" && (
                          <p className="text-[10px] text-destructive mt-0.5 truncate font-medium">
                            Rejeitado em: {intlDateTime(quote.rejectedAt, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <span className="font-bold text-foreground">
                          {intlCurrency(quote.total)}
                        </span>
                        <Badge variant="outline" className={`text-[10px] uppercase py-0 px-1.5 capitalize ${
                          (quote.status as string) === "approved" ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" :
                          (quote.status as string) === "rejected" ? "border-destructive/30 text-destructive bg-destructive/10" :
                          "bg-muted"
                        }`}>
                          {quote.status}
                        </Badge>
                      </div>
                    </div>

                    {(quote.status as string) === "draft" && (
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleActionClick(quote.id, quote.title, "approve")}
                          disabled={submittingId === quote.id}
                          className="h-6 px-2 text-[10px] gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                        >
                          <Check className="h-3 w-3" /> Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleActionClick(quote.id, quote.title, "reject")}
                          disabled={submittingId === quote.id}
                          className="h-6 px-2 text-[10px] gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                        >
                          <X className="h-3 w-3" /> Rejeitar
                        </Button>
                      </div>
                    )}

                    {(quote.status as string) === "approved" && (
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCreateReceivableClick(quote)}
                          className="h-6 px-2 text-[10px] gap-1 border-primary/30 text-primary hover:bg-primary/10"
                        >
                          Gerar recebível
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCreateProjectClick(quote)}
                          className="h-6 px-2 text-[10px] gap-1 border-primary/30 text-primary hover:bg-primary/10"
                        >
                          Gerar projeto
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center text-[11px] text-muted-foreground">
              <span>Total no Supabase: {quotes.length} orçamento(s)</span>
              {quotes.length > 10 && (
                <span>Mostrando os 10 primeiros</span>
              )}
            </div>
          </div>
        )}
      </div>

      <QuoteActionDialog
        open={actionType !== null}
        onOpenChange={(open) => !open && setActionType(null)}
        title={actionType === "approve" ? "Aprovar orçamento?" : "Rejeitar orçamento?"}
        description={
          actionType === "approve"
            ? "Esta ação marcará o orçamento como aprovado no Supabase. Ela não criará financeiro, projeto ou envio automático nesta etapa."
            : "Esta ação marcará o orçamento como rejeitado no Supabase. Ela não excluirá o orçamento."
        }
        confirmLabel={actionType === "approve" ? "Aprovar orçamento" : "Rejeitar orçamento"}
        onConfirm={handleConfirmAction}
        submitting={submittingId !== null}
      />

      {receivableQuote && (
        <CreateReceivableDialog
          open={receivableDialogOpen}
          onOpenChange={setReceivableDialogOpen}
          quoteTitle={receivableQuote.title}
          quoteTotal={receivableQuote.total}
          workspaceId={workspace.id}
          quoteId={receivableQuote.id}
          clientId={receivableQuote.clientId ? String(receivableQuote.clientId) : undefined}
          opportunityId={receivableQuote.opportunityId ? String(receivableQuote.opportunityId) : undefined}
          onSuccess={refresh}
        />
      )}

      {projectQuote && (
        <CreateProjectFromQuoteDialog
          open={projectDialogOpen}
          onOpenChange={setProjectDialogOpen}
          quoteTitle={projectQuote.title}
          quoteTotal={projectQuote.total}
          workspaceId={workspace.id}
          quoteId={projectQuote.id}
          clientId={projectQuote.clientId ? String(projectQuote.clientId) : undefined}
          opportunityId={projectQuote.opportunityId ? String(projectQuote.opportunityId) : undefined}
          onSuccess={refresh}
        />
      )}
    </SettingsCard>
  );
}

