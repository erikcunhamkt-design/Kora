import React, { useState } from "react";
import { useSupabaseOpportunityQuotes } from "@/hooks/useSupabaseOpportunityQuotes";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, FileText, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { quotesRepository } from "@/repositories/quotesRepository";
import { QuoteActionDialog } from "@/components/crm/QuoteActionDialog";
import { CreateReceivableDialog } from "@/components/crm/CreateReceivableDialog";
import { CreateProjectFromQuoteDialog } from "@/components/crm/CreateProjectFromQuoteDialog";
import type { Quote } from "@/hooks/useQuotes";
import { toast } from "sonner";

interface LinkedQuotesSectionProps {
  opportunityId?: string;
  triggerRefreshToggle?: boolean;
}

export function LinkedQuotesSection({
  opportunityId,
  triggerRefreshToggle,
}: LinkedQuotesSectionProps) {
  const { quotes, loading, error, refresh } = useSupabaseOpportunityQuotes(opportunityId);
  const { workspace } = useCurrentWorkspace();
  const workspaceId = workspace?.id ?? "";
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // States for confirmation dialogs
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [selectedQuoteTitle, setSelectedQuoteTitle] = useState<string>("");
  const [receivableDialogOpen, setReceivableDialogOpen] = useState(false);
  const [receivableQuote, setReceivableQuote] = useState<Quote | null>(null);

  const handleCreateReceivableClick = (quote: Quote) => {
    const flagEnabled = localStorage.getItem("kora.quotes.supabaseCreateReceivable.enabled") === "true";
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
    const flagEnabled = localStorage.getItem("kora.quotes.supabaseCreateProject.enabled") === "true";
    if (!flagEnabled) {
      toast.info("Geração de projeto experimental entra nesta etapa experimental. Ative em Configurações.");
      return;
    }
    setProjectQuote(quote);
    setProjectDialogOpen(true);
  };

  // Trigger refresh when requested from parent (e.g. after a quote is successfully created)
  React.useEffect(() => {
    if (opportunityId) {
      refresh();
    }
  }, [opportunityId, triggerRefreshToggle, refresh]);

  const handleActionClick = (quoteId: string, title: string, type: "approve" | "reject") => {
    // 1. Verify feature flag
    const flagEnabled = localStorage.getItem("kora.quotes.supabaseApproval.enabled") === "true";
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
        await quotesRepository.approveQuote(workspaceId, selectedQuoteId);
        
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
        await quotesRepository.rejectQuote(workspaceId, selectedQuoteId);
        
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
    } catch (err: unknown) {
      console.error(err);
      toast.error("Erro ao atualizar status do orçamento.");
      refresh();
    } finally {
      setSubmittingId(null);
      setActionType(null);
      setSelectedQuoteId(null);
    }
  };

  if (!opportunityId) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Orçamentos vinculados
        </h3>
        <Button
          size="icon"
          variant="ghost"
          onClick={refresh}
          disabled={loading}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          title="Atualizar orçamento"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="orbit-card p-3 space-y-3">
        {loading ? (
          <div className="py-4 flex items-center justify-center text-xs text-muted-foreground gap-2">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
            Carregando orçamentos...
          </div>
        ) : error ? (
          <p className="text-xs text-destructive py-2">Erro ao carregar: {error}</p>
        ) : quotes.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2 italic text-center">
            Nenhum orçamento vinculado a esta oportunidade ainda.
          </p>
        ) : (
          <div className="space-y-2 max-h-[220px] overflow-y-auto divide-y divide-border/30">
            {quotes.map((quote) => (
              <div key={quote.id} className="pt-2 first:pt-0 flex flex-col gap-1 text-[11px]">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-semibold text-foreground truncate">{quote.title}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="outline" className="text-[9px] uppercase tracking-wide text-primary border-primary/30 py-0 px-1">
                      Supabase
                    </Badge>
                    <Badge variant="outline" className={`text-[9px] uppercase tracking-wide py-0 px-1 capitalize ${
                      quote.status === "approved" ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" :
                      quote.status === "rejected" ? "border-destructive/30 text-destructive bg-destructive/10" :
                      "bg-muted"
                    }`}>
                      {quote.status}
                    </Badge>
                  </div>
                </div>
                
                <div className="flex justify-between items-center text-muted-foreground text-[10px]">
                  <span>Total: <strong className="text-foreground">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(quote.total)}</strong></span>
                  {quote.createdAt && (
                    <span>Criado em: {new Date(quote.createdAt).toLocaleDateString()}</span>
                  )}
                </div>
                {quote.approvedAt && quote.status === "approved" && (
                  <p className="text-[10px] text-emerald-400 mt-0.5 truncate font-medium">
                    Aprovado em: {new Date(quote.approvedAt).toLocaleString()}
                  </p>
                )}
                {quote.rejectedAt && quote.status === "rejected" && (
                  <p className="text-[10px] text-destructive mt-0.5 truncate font-medium">
                    Rejeitado em: {new Date(quote.rejectedAt).toLocaleString()}
                  </p>
                )}

                {quote.status === "draft" && (
                  <div className="flex items-center gap-1.5 mt-1">
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

                {quote.status === "approved" && (
                  <div className="flex items-center gap-1.5 mt-1">
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
            ))}
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
          workspaceId={workspaceId}
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
          workspaceId={workspaceId}
          quoteId={projectQuote.id}
          clientId={projectQuote.clientId ? String(projectQuote.clientId) : undefined}
          opportunityId={projectQuote.opportunityId ? String(projectQuote.opportunityId) : undefined}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}

