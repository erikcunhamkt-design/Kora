import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  FileText, Plus, X, Download, Send, Copy, Check, Trash2, Archive,
  Link2, AlertTriangle, Eye, MoreHorizontal, XCircle, User as UserIcon, Wallet,
  FolderKanban,
} from "lucide-react";
import {
  useQuotes, type Quote, type QuoteItem, type QuoteStatus, type QuoteSource,
  getQuoteDaysToExpire, isQuoteExpired,
} from "@/hooks/useQuotes";
import { useServices } from "@/hooks/useServices";
import { useClients } from "@/hooks/useClients";
import { useLeads } from "@/hooks/useLeads";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { QuoteToReceivableDialog } from "@/components/vendas/QuoteToReceivableDialog";
import { QuoteToProjectDialog } from "@/components/vendas/QuoteToProjectDialog";
import { formatCurrency as intlCurrency } from "@/lib/format";

const BRL = (n: number) =>
  intlCurrency(n, { minimumFractionDigits: 2 });

const STATUS_LABEL: Record<QuoteStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
  vencido: "Vencido",
  arquivado: "Arquivado",
};

const STATUS_STYLE: Record<QuoteStatus, string> = {
  rascunho: "bg-muted text-muted-foreground border border-border/60",
  enviado: "bg-sky-500/10 text-sky-400 border border-sky-500/20",
  aprovado: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  recusado: "bg-destructive/10 text-destructive border border-destructive/20",
  vencido: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  arquivado: "bg-muted/40 text-muted-foreground/70 border border-border/40",
};

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border/60 bg-card ${className}`}>{children}</div>;
}

function Metric({
  label, value, tone = "default", sub,
}: { label: string; value: string; tone?: "default" | "primary" | "warning" | "success"; sub?: string }) {
  const valueCls =
    tone === "primary" ? "text-primary"
    : tone === "warning" ? "text-amber-400"
    : tone === "success" ? "text-emerald-400"
    : "text-foreground";
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground/80">{label}</div>
      <div className={`mt-1 text-2xl font-black ${valueCls}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

/** Resolve effective status (computes "vencido" on the fly without mutating data). */
const effectiveStatus = (q: Quote): QuoteStatus => (isQuoteExpired(q) ? "vencido" : q.status);

export function QuotesSection() {
  const { quotes, addQuote, updateStatus, updateQuote, duplicateQuote, deleteQuote } = useQuotes();
  const { clients } = useClients();
  const { leads, updateLead } = useLeads();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [modalOpen, setModalOpen] = useState(false);
  const [initialData, setInitialData] = useState<Partial<Quote> | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Quote | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | QuoteStatus>("all");
  const [receivableQuote, setReceivableQuote] = useState<Quote | null>(null);
  const [projectQuote, setProjectQuote] = useState<Quote | null>(null);

  /** Deep link: ?newQuote=1[&opportunityId=X][&clientId=Y] */
  useEffect(() => {
    if (searchParams.get("newQuote") !== "1") return;
    const oppId = Number(searchParams.get("opportunityId"));
    const cliId = Number(searchParams.get("clientId"));
    const seed: Partial<Quote> = {};
    if (oppId) {
      const opp = leads.find((l) => l.id === oppId);
      if (opp) {
        seed.opportunityId = opp.id;
        seed.opportunityTitle = opp.serviceType || opp.name;
        seed.source = "oportunidade";
        seed.title = opp.serviceType ? `Proposta — ${opp.serviceType}` : `Proposta — ${opp.name}`;
        if (opp.clientId) seed.clientId = opp.clientId;
        seed.clientName = opp.name;
        seed.company = opp.company;
        seed.clientEmail = opp.email;
        seed.clientWhatsapp = opp.phone;
        seed.notes = opp.description || opp.notes;
      }
    }
    if (!seed.clientId && cliId) {
      const cli = clients.find((c) => c.id === cliId);
      if (cli) {
        seed.source = seed.source || "cliente";
        seed.clientId = cli.id;
        seed.clientName = cli.name;
        seed.company = cli.company;
        seed.clientEmail = cli.email;
        seed.clientWhatsapp = cli.whatsapp || cli.phone;
      }
    }
    setInitialData(Object.keys(seed).length ? seed : null);
    setModalOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("newQuote"); next.delete("opportunityId"); next.delete("clientId");
    setSearchParams(next, { replace: true });
  }, [searchParams, leads, clients, setSearchParams]);

  /** Deep link: ?quote=<id> abre preview do orçamento */
  const [highlightedQuoteId, setHighlightedQuoteId] = useState<string | null>(null);
  useEffect(() => {
    const qid = searchParams.get("quote");
    if (!qid) return;
    if (!quotes.some((q) => q.id === qid)) return;
    setPreviewId(qid);
    setHighlightedQuoteId(qid);
  }, [searchParams, quotes]);

  useEffect(() => {
    if (!highlightedQuoteId) return;
    const t = setTimeout(() => setHighlightedQuoteId(null), 4000);
    return () => clearTimeout(t);
  }, [highlightedQuoteId]);

  const clearQuoteParam = () => {
    if (!searchParams.get("quote")) return;
    const next = new URLSearchParams(searchParams);
    next.delete("quote");
    setSearchParams(next, { replace: true });
  };

  // KPIs ---
  const openQuotes = quotes.filter((q) => effectiveStatus(q) === "rascunho" || effectiveStatus(q) === "enviado");
  const openValue = openQuotes.reduce((s, q) => s + q.total, 0);
  const approvedQuotes = quotes.filter((q) => q.status === "aprovado");
  const approvedPendingFinance = approvedQuotes.filter((q) => !q.financeEntryId);
  const approvedPendingValue = approvedPendingFinance.reduce((s, q) => s + q.total, 0);
  const expiringSoon = quotes.filter((q) => {
    const d = getQuoteDaysToExpire(q);
    return q.status === "enviado" && d !== null && d >= 0 && d <= 5;
  }).length;

  const filtered = useMemo(() => {
    if (filterStatus === "all") return quotes.filter((q) => q.status !== "arquivado");
    return quotes.filter((q) => effectiveStatus(q) === filterStatus);
  }, [quotes, filterStatus]);

  const preview = quotes.find((q) => q.id === previewId) ?? null;

  const handleSave = (data: Omit<Quote, "id" | "createdAt" | "subtotal" | "total" | "isDemo">) => {
    const created = addQuote(data);
    if (created.opportunityId) {
      updateLead(created.opportunityId, { quoteId: created.id, quoteTitle: created.title });
    }
    toast.success("Orçamento salvo");
    setModalOpen(false);
    setInitialData(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Orçamentos</h1>
          <p className="text-muted-foreground">Crie propostas profissionais para fechar mais negócios.</p>
        </div>
        <button
          type="button"
          onClick={() => { setInitialData(null); setModalOpen(true); }}
          className="rounded-xl border border-border px-4 py-2 text-sm font-bold text-primary hover:bg-primary hover:text-primary-foreground transition flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Novo orçamento
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Em aberto" value={String(openQuotes.length)} sub="Rascunho + enviado" />
        <Metric label="Valor em propostas" value={BRL(openValue)} tone="primary" />
        <Metric
          label="Aprovados"
          value={String(approvedQuotes.length)}
          tone="success"
          sub={
            approvedPendingFinance.length > 0
              ? `${approvedPendingFinance.length} sem recebível · ${BRL(approvedPendingValue)} pendente`
              : "Todos lançados no financeiro"
          }
        />
        <Metric
          label="Vencendo em breve"
          value={String(expiringSoon)}
          tone={expiringSoon > 0 ? "warning" : "default"}
          sub={expiringSoon > 0 ? "Até 5 dias para expirar" : "Tudo dentro do prazo"}
        />
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-1.5">
        {(["all", "rascunho", "enviado", "aprovado", "recusado", "vencido", "arquivado"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`text-xs font-medium rounded-full px-3 py-1.5 border transition ${
              filterStatus === s
                ? "bg-primary/10 border-primary/30 text-primary"
                : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            {s === "all" ? "Todos ativos" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <FileText className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-xl font-black">Nenhum orçamento por aqui</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie seu primeiro orçamento ou ajuste o filtro acima.
          </p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border/60">
                <th className="px-4 py-3 text-left">Título</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Vínculo</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-left">Validade</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.map((q) => {
                const eff = effectiveStatus(q);
                const days = getQuoteDaysToExpire(q);
                return (
                  <tr key={q.id} className={`hover:bg-muted/30 transition ${highlightedQuoteId === q.id ? "ring-2 ring-primary/30 bg-primary/5" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="font-bold text-foreground">{q.title}</div>
                      <div className="text-xs text-muted-foreground">{q.createdAt}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div className="text-foreground">{q.clientName}</div>
                      {q.company && <div className="text-xs">{q.company}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {q.opportunityId ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/crm`)}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          title="Ver oportunidade no CRM"
                        >
                          <Link2 className="h-3 w-3" /> {q.opportunityTitle || "Oportunidade"}
                        </button>
                      ) : q.clientId ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/clientes?client=${q.clientId}`)}
                          className="inline-flex items-center gap-1 text-xs text-sky-400 hover:underline"
                        >
                          <UserIcon className="h-3 w-3" /> Cliente
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">Manual</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[eff]}`}>
                        {STATUS_LABEL[eff]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-black text-foreground">{BRL(q.total)}</td>
                    <td className="px-4 py-3">
                      {days === null ? (
                        <span className="text-xs text-muted-foreground/60">—</span>
                      ) : days < 0 ? (
                        <span className="text-xs text-amber-400 inline-flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> vencido
                        </span>
                      ) : days <= 5 && q.status === "enviado" ? (
                        <span className="text-xs text-amber-400">vence em {days}d</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{q.validityDays}d</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewId(q.id)}
                          className="rounded-lg border border-border/60 px-3 py-1.5 text-xs font-bold text-foreground hover:border-primary hover:text-primary transition inline-flex items-center gap-1"
                        >
                          <Eye className="h-3 w-3" /> Ver
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="rounded-lg border border-border/60 p-1.5 text-muted-foreground hover:text-foreground transition"
                              aria-label="Mais ações"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-card border-border w-52">
                            {q.status !== "enviado" && q.status !== "aprovado" && q.status !== "arquivado" && (
                              <DropdownMenuItem onClick={() => { updateStatus(q.id, "enviado"); toast.success("Marcado como enviado"); }}>
                                <Send className="h-3.5 w-3.5 mr-2" /> Marcar como enviado
                              </DropdownMenuItem>
                            )}
                            {q.status !== "aprovado" && q.status !== "arquivado" && (
                              <DropdownMenuItem onClick={() => { updateStatus(q.id, "aprovado"); toast.success("Orçamento aprovado"); }}>
                                <Check className="h-3.5 w-3.5 mr-2" /> Marcar como aprovado
                              </DropdownMenuItem>
                            )}
                            {q.status !== "recusado" && q.status !== "arquivado" && (
                              <DropdownMenuItem onClick={() => { updateStatus(q.id, "recusado"); toast("Marcado como recusado"); }}>
                                <XCircle className="h-3.5 w-3.5 mr-2" /> Marcar como recusado
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => { duplicateQuote(q.id); toast.success("Orçamento duplicado"); }}>
                              <Copy className="h-3.5 w-3.5 mr-2" /> Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {q.status === "aprovado" && !q.financeEntryId && (
                              <DropdownMenuItem onClick={() => setReceivableQuote(q)}>
                                <Wallet className="h-3.5 w-3.5 mr-2" /> Gerar conta a receber
                              </DropdownMenuItem>
                            )}
                            {q.financeEntryId && (
                              <DropdownMenuItem onClick={() => navigate(`/financeiro?tab=receivables&entryId=${q.financeEntryId}`)}>
                                <Wallet className="h-3.5 w-3.5 mr-2" /> Ver recebível
                              </DropdownMenuItem>
                            )}
                            {q.status === "aprovado" && !q.projectId && (
                              <DropdownMenuItem onClick={() => setProjectQuote(q)}>
                                <FolderKanban className="h-3.5 w-3.5 mr-2" /> Gerar projeto
                              </DropdownMenuItem>
                            )}
                            {q.projectId && (
                              <DropdownMenuItem onClick={() => navigate(`/portfolio?tab=projetos&projectId=${q.projectId}`)}>
                                <FolderKanban className="h-3.5 w-3.5 mr-2" /> Ver projeto
                              </DropdownMenuItem>
                            )}
                            {q.status === "aprovado" && q.projectId && (
                              <DropdownMenuItem
                                onClick={() => toast("Este orçamento já possui um projeto vinculado.")}
                                className="hidden"
                              >
                                <FolderKanban className="h-3.5 w-3.5 mr-2" /> Projeto vinculado
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {q.status !== "arquivado" ? (
                              <DropdownMenuItem onClick={() => { updateStatus(q.id, "arquivado"); toast("Orçamento arquivado"); }}>
                                <Archive className="h-3.5 w-3.5 mr-2" /> Arquivar
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => { updateStatus(q.id, "rascunho"); toast.success("Orçamento restaurado"); }}>
                                <Archive className="h-3.5 w-3.5 mr-2" /> Restaurar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => setConfirmDelete(q)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {modalOpen && (
        <NewQuoteWizard
          initial={initialData}
          onClose={() => { setModalOpen(false); setInitialData(null); }}
          onSave={handleSave}
        />
      )}

      {preview && (
        <QuotePreview
          quote={preview}
          onClose={() => { setPreviewId(null); clearQuoteParam(); }}
          onDuplicate={() => {
            duplicateQuote(preview.id);
            toast.success("Orçamento duplicado");
            setPreviewId(null);
          }}
          onSend={() => {
            updateStatus(preview.id, "enviado");
            toast.success("Marcado como enviado");
          }}
          onApprove={() => {
            const wasApproved = preview.status === "aprovado";
            updateStatus(preview.id, "aprovado");
            toast.success("Orçamento aprovado");
            if (!wasApproved && !preview.financeEntryId) {
              // Offer receivable generation as a natural next step.
              setTimeout(() => setReceivableQuote({ ...preview, status: "aprovado" }), 250);
            }
          }}
          onGenerateReceivable={!preview.financeEntryId ? () => setReceivableQuote(preview) : undefined}
          onOpenReceivable={preview.financeEntryId ? () => navigate(`/financeiro?tab=receivables&entryId=${preview.financeEntryId}`) : undefined}
          onOpenOpportunity={preview.opportunityId ? () => navigate("/crm") : undefined}
          onOpenClient={preview.clientId ? () => navigate(`/clientes?client=${preview.clientId}`) : undefined}
          onGenerateProject={preview.status === "aprovado" && !preview.projectId ? () => setProjectQuote(preview) : undefined}
          onOpenProject={preview.projectId ? () => navigate(`/portfolio?tab=projetos&projectId=${preview.projectId}`) : undefined}
        />
      )}

      <QuoteToReceivableDialog
        quote={receivableQuote}
        open={!!receivableQuote}
        onOpenChange={(v) => !v && setReceivableQuote(null)}
        onGenerated={(entryId) => {
          if (receivableQuote) {
            updateQuote(receivableQuote.id, { financeEntryId: entryId });
          }
        }}
      />

      <QuoteToProjectDialog
        quote={projectQuote}
        open={!!projectQuote}
        onOpenChange={(v) => !v && setProjectQuote(null)}
        onGenerated={(project) => {
          if (projectQuote) {
            updateQuote(projectQuote.id, { projectId: project.id, projectTitle: project.name });
          }
        }}
      />


      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir orçamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove permanentemente <strong>{confirmDelete?.title}</strong>. Não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (confirmDelete) { deleteQuote(confirmDelete.id); toast.success("Orçamento excluído"); setConfirmDelete(null); } }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


/* ---------------- Wizard ---------------- */

type WizardData = Omit<Quote, "id" | "createdAt" | "subtotal" | "total" | "isDemo">;

function NewQuoteWizard({
  initial,
  onClose,
  onSave,
}: {
  initial: Partial<Quote> | null;
  onClose: () => void;
  onSave: (data: WizardData) => void;
}) {
  const { services } = useServices();
  const { clients } = useClients();
  const [step, setStep] = useState(1);

  const [clientName, setClientName] = useState(initial?.clientName ?? "");
  const [clientId, setClientId] = useState<number | undefined>(initial?.clientId);
  const [company, setCompany] = useState(initial?.company ?? "");
  const [clientEmail, setClientEmail] = useState(initial?.clientEmail ?? "");
  const [clientWhatsapp, setClientWhatsapp] = useState(initial?.clientWhatsapp ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [items, setItems] = useState<QuoteItem[]>(initial?.items ?? []);
  const [discount, setDiscount] = useState(String(initial?.discount ?? "0"));
  const [paymentCondition, setPaymentCondition] = useState(initial?.paymentCondition ?? "À vista no Pix");
  const [deliveryDeadline, setDeliveryDeadline] = useState(initial?.deliveryDeadline ?? "15 dias");
  const [validityDays, setValidityDays] = useState(String(initial?.validityDays ?? 15));
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const opportunityId = initial?.opportunityId;
  const opportunityTitle = initial?.opportunityTitle;
  const source: QuoteSource = initial?.source ?? "manual";

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const total = Math.max(subtotal - Number(discount || 0), 0);

  function addServiceItem(serviceId: string) {
    const svc = services.find((s) => s.id === serviceId);
    if (!svc) return;
    setItems((prev) => [
      ...prev,
      { id: `it-${Date.now()}`, serviceId: svc.id, name: svc.name, quantity: 1, unitPrice: svc.price },
    ]);
  }

  function addManualItem() {
    setItems((prev) => [
      ...prev,
      { id: `it-${Date.now()}`, name: "", quantity: 1, unitPrice: 0 },
    ]);
  }

  function updateItem(id: string, patch: Partial<QuoteItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function next(e: FormEvent) {
    e.preventDefault();
    if (step === 1) {
      if (!clientName.trim()) return toast.error("Informe o cliente");
      if (!title.trim()) return toast.error("Informe o título do orçamento");
    }
    if (step === 2) {
      if (items.length === 0) return toast.error("Adicione pelo menos 1 item");
      if (items.some((i) => !i.name.trim() || i.unitPrice <= 0))
        return toast.error("Preencha nome e valor de todos os itens");
    }
    setStep((s) => Math.min(s + 1, 4));
  }

  function save() {
    onSave({
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim(),
      clientWhatsapp: clientWhatsapp.trim(),
      company: company.trim() || undefined,
      clientId,
      opportunityId,
      opportunityTitle,
      source,
      title: title.trim(),
      description: description.trim(),
      items,
      discount: Number(discount || 0),
      paymentCondition: paymentCondition.trim(),
      deliveryDeadline: deliveryDeadline.trim(),
      validityDays: Number(validityDays) || 0,
      notes: notes.trim() || undefined,
      status: "rascunho",
    });
  }

  const sourceBadge =
    source === "oportunidade" ? { label: "Origem: oportunidade", cls: "bg-primary/10 text-primary border-primary/30" }
    : source === "cliente" ? { label: "Origem: cliente", cls: "bg-sky-500/10 text-sky-400 border-sky-500/20" }
    : null;

  return (
    <Shell title={`Novo orçamento — Etapa ${step} de 4`} onClose={onClose} wide>
      {sourceBadge && (
        <div className={`mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide rounded-full px-3 py-1 border ${sourceBadge.cls}`}>
          <Link2 className="h-3 w-3" />
          {sourceBadge.label}
          {opportunityTitle && <span className="text-muted-foreground normal-case">— {opportunityTitle}</span>}
        </div>
      )}

      <div className="mb-5 flex gap-1">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full ${s <= step ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>

      {step === 1 && (
        <form onSubmit={next} className="space-y-4">
          <FieldLabel label="Cliente*">
            <input
              list="quote-clients"
              value={clientName}
              onChange={(e) => {
                const v = e.target.value;
                setClientName(v);
                const c = clients.find((cl) => cl.name === v);
                if (c) {
                  setClientId(c.id);
                  setCompany(c.company || "");
                  setClientEmail(c.email || "");
                  setClientWhatsapp(c.whatsapp || c.phone || "");
                } else {
                  setClientId(undefined);
                }
              }}
              placeholder="Nome do cliente"
              maxLength={100}
              className="modal-input"
            />
            <datalist id="quote-clients">
              {clients.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </FieldLabel>
          <FieldLabel label="Empresa">
            <input value={company} onChange={(e) => setCompany(e.target.value)} maxLength={120} placeholder="Razão social, opcional" className="modal-input" />
          </FieldLabel>
          <div className="grid gap-4 md:grid-cols-2">
            <FieldLabel label="Email">
              <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} maxLength={120} placeholder="cliente@email.com" className="modal-input" />
            </FieldLabel>
            <FieldLabel label="WhatsApp">
              <input value={clientWhatsapp} onChange={(e) => setClientWhatsapp(e.target.value)} maxLength={30} placeholder="(11) 99999-9999" className="modal-input" />
            </FieldLabel>
          </div>
          <FieldLabel label="Título do orçamento*">
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Ex: Rebranding 2026" className="modal-input" />
          </FieldLabel>
          <FieldLabel label="Descrição">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} placeholder="Contexto do projeto..." className="modal-input resize-none" />
          </FieldLabel>
          <WizardActions onClose={onClose} step={step} canBack={false} />
        </form>
      )}

      {step === 2 && (
        <form onSubmit={next} className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <select
              onChange={(e) => {
                if (e.target.value) addServiceItem(e.target.value);
                e.target.value = "";
              }}
              className="modal-input max-w-xs"
              defaultValue=""
            >
              <option value="" disabled>+ Adicionar serviço do catálogo</option>
              {services.filter((s) => s.active).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {BRL(s.price)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addManualItem}
              className="rounded-xl border border-border/60 px-4 py-2 text-sm font-bold text-foreground hover:border-primary hover:text-primary transition"
            >
              + Item manual
            </button>
          </div>

          {items.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Nenhum item adicionado ainda.
            </Card>
          ) : (
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.id} className="rounded-xl border border-border/60 bg-card p-3 grid gap-2 md:grid-cols-[1fr_80px_120px_auto] items-center">
                  <input
                    value={it.name}
                    onChange={(e) => updateItem(it.id, { name: e.target.value })}
                    placeholder="Nome do item"
                    maxLength={80}
                    className="modal-input"
                  />
                  <input
                    type="number"
                    min={1}
                    value={it.quantity}
                    onChange={(e) => updateItem(it.id, { quantity: Number(e.target.value) || 1 })}
                    className="modal-input"
                  />
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={it.unitPrice}
                    onChange={(e) => updateItem(it.id, { unitPrice: Number(e.target.value) || 0 })}
                    className="modal-input"
                  />
                  <button type="button" onClick={() => removeItem(it.id)} className="text-muted-foreground hover:text-destructive p-2" aria-label="Remover">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3 pt-3 border-t border-border/60">
            <FieldLabel label="Subtotal">
              <div className="modal-input flex items-center">{BRL(subtotal)}</div>
            </FieldLabel>
            <FieldLabel label="Desconto (R$)">
              <input type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} className="modal-input" />
            </FieldLabel>
            <FieldLabel label="Total">
              <div className="modal-input flex items-center font-black text-primary">{BRL(total)}</div>
            </FieldLabel>
          </div>

          <WizardActions onClose={onClose} step={step} onBack={() => setStep(1)} />
        </form>
      )}

      {step === 3 && (
        <form onSubmit={next} className="space-y-4">
          <FieldLabel label="Forma de pagamento">
            <input value={paymentCondition} onChange={(e) => setPaymentCondition(e.target.value)} maxLength={120} className="modal-input" />
          </FieldLabel>
          <FieldLabel label="Prazo de entrega">
            <input value={deliveryDeadline} onChange={(e) => setDeliveryDeadline(e.target.value)} maxLength={60} className="modal-input" />
          </FieldLabel>
          <FieldLabel label="Validade da proposta (dias)">
            <input type="number" min={1} value={validityDays} onChange={(e) => setValidityDays(e.target.value)} className="modal-input" />
          </FieldLabel>
          <FieldLabel label="Observações / escopo">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={600} placeholder="O que está incluso, exclusões, condições adicionais..." className="modal-input resize-none" />
          </FieldLabel>
          <WizardActions onClose={onClose} step={step} onBack={() => setStep(2)} />
        </form>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <Card className="p-5 space-y-3">
            <div>
              <div className="text-xs uppercase text-muted-foreground">Cliente</div>
              <div className="font-bold">{clientName}</div>
              {company && <div className="text-xs text-muted-foreground">{company}</div>}
              {clientEmail && <div className="text-xs text-muted-foreground">{clientEmail}</div>}
              {clientWhatsapp && <div className="text-xs text-muted-foreground">{clientWhatsapp}</div>}
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Orçamento</div>
              <div className="font-bold">{title}</div>
              {description && <div className="text-xs text-muted-foreground mt-1">{description}</div>}
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-2">Itens</div>
              <ul className="space-y-1 text-sm">
                {items.map((it) => (
                  <li key={it.id} className="flex justify-between border-b border-border/60 py-1">
                    <span>{it.name} × {it.quantity}</span>
                    <span className="font-bold">{BRL(it.quantity * it.unitPrice)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{BRL(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Desconto</span>
              <span>- {BRL(Number(discount || 0))}</span>
            </div>
            <div className="flex justify-between text-lg pt-2 border-t border-border/60">
              <span className="font-bold">Total</span>
              <span className="font-black text-primary">{BRL(total)}</span>
            </div>
            <div className="grid gap-1 text-xs text-muted-foreground pt-2 border-t border-border/60">
              <div>Pagamento: {paymentCondition}</div>
              <div>Prazo: {deliveryDeadline}</div>
              <div>Validade: {validityDays} dias</div>
              {notes && <div>Obs.: {notes}</div>}
            </div>
          </Card>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex-1 rounded-xl border border-border/60 px-4 py-2.5 text-sm font-bold text-foreground hover:border-primary hover:text-primary transition"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={save}
              className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-black text-primary hover:bg-primary hover:text-primary-foreground transition flex items-center justify-center gap-2"
            >
              <Check className="h-4 w-4" /> Salvar orçamento
            </button>
          </div>
        </div>
      )}

      <ModalStyles />
    </Shell>
  );
}

/* ---------------- Preview ---------------- */

function QuotePreview({
  quote,
  onClose,
  onDuplicate,
  onSend,
  onApprove,
  onOpenOpportunity,
  onOpenClient,
  onGenerateReceivable,
  onOpenReceivable,
  onGenerateProject,
  onOpenProject,
}: {
  quote: Quote;
  onClose: () => void;
  onDuplicate: () => void;
  onSend: () => void;
  onApprove: () => void;
  onOpenOpportunity?: () => void;
  onOpenClient?: () => void;
  onGenerateReceivable?: () => void;
  onOpenReceivable?: () => void;
  onGenerateProject?: () => void;
  onOpenProject?: () => void;
}) {
  const eff = effectiveStatus(quote);
  const days = getQuoteDaysToExpire(quote);

  return (
    <Shell title="Preview do orçamento" onClose={onClose} wide>
      <div className="mb-3 flex items-center flex-wrap gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[eff]}`}>
          {STATUS_LABEL[eff]}
        </span>
        {quote.opportunityId && onOpenOpportunity && (
          <button onClick={onOpenOpportunity} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
            <Link2 className="h-3 w-3" /> {quote.opportunityTitle || "Oportunidade vinculada"}
          </button>
        )}
        {!quote.opportunityId && quote.clientId && onOpenClient && (
          <button onClick={onOpenClient} className="text-xs text-sky-400 hover:underline inline-flex items-center gap-1">
            <UserIcon className="h-3 w-3" /> Ver cliente
          </button>
        )}
        {days !== null && days < 0 && (
          <span className="text-xs text-amber-400 inline-flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Proposta vencida
          </span>
        )}
        {days !== null && days >= 0 && days <= 5 && quote.status === "enviado" && (
          <span className="text-xs text-amber-400">vence em {days}d</span>
        )}
      </div>

      <div className="rounded-2xl border border-border/60 bg-white text-zinc-900 p-8 space-y-5">
        <div className="flex items-start justify-between border-b border-zinc-200 pb-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-500">Proposta comercial</div>
            <div className="text-2xl font-black">KORA HUB</div>
          </div>
          <div className="text-right text-xs text-zinc-500">
            <div>Emitido em {quote.createdAt}</div>
            <div>Validade {quote.validityDays} dias</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs uppercase text-zinc-500">Cliente</div>
            <div className="font-bold">{quote.clientName}</div>
            {quote.company && <div className="text-sm text-zinc-600">{quote.company}</div>}
            {quote.clientEmail && <div className="text-sm text-zinc-600">{quote.clientEmail}</div>}
            {quote.clientWhatsapp && <div className="text-sm text-zinc-600">{quote.clientWhatsapp}</div>}
          </div>
          <div>
            <div className="text-xs uppercase text-zinc-500">Projeto</div>
            <div className="font-bold">{quote.title}</div>
            {quote.description && <p className="text-sm text-zinc-600 mt-1">{quote.description}</p>}
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-zinc-500 border-b border-zinc-200">
            <tr>
              <th className="py-2 text-left">Item</th>
              <th className="py-2 text-center w-16">Qtd</th>
              <th className="py-2 text-right w-32">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {quote.items.map((it) => (
              <tr key={it.id}>
                <td className="py-2">{it.name}</td>
                <td className="py-2 text-center">{it.quantity}</td>
                <td className="py-2 text-right font-bold">{BRL(it.quantity * it.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{BRL(quote.subtotal)}</span></div>
          <div className="flex justify-between"><span>Desconto</span><span>- {BRL(quote.discount)}</span></div>
          <div className="flex justify-between text-lg pt-2 border-t border-zinc-200">
            <span className="font-bold">Total</span>
            <span className="font-black">{BRL(quote.total)}</span>
          </div>
        </div>

        <div className="grid gap-1 text-xs text-zinc-600 pt-3 border-t border-zinc-200">
          <div><strong>Pagamento:</strong> {quote.paymentCondition}</div>
          <div><strong>Prazo:</strong> {quote.deliveryDeadline}</div>
          {quote.notes && <div className="mt-2"><strong>Observações:</strong> {quote.notes}</div>}
        </div>
      </div>

      {quote.status === "aprovado" && (
        <div className="mt-4 rounded-xl border border-border/60 bg-card p-4 flex flex-wrap items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Wallet className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground/80">Financeiro</div>
            <div className="text-sm font-semibold text-foreground">
              {quote.financeEntryId ? "Conta a receber gerada" : "Sem conta a receber ainda"}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {quote.financeEntryId
                ? "Acompanhe o recebimento e marque como pago no financeiro."
                : "Transforme este orçamento aprovado em uma receita prevista."}
            </div>
          </div>
          {quote.financeEntryId ? (
            <button
              type="button"
              onClick={onOpenReceivable}
              className="rounded-lg border border-border/60 px-3 py-1.5 text-xs font-bold text-foreground hover:border-primary hover:text-primary transition inline-flex items-center gap-1"
            >
              <Eye className="h-3 w-3" /> Ver recebível
            </button>
          ) : (
            <button
              type="button"
              onClick={onGenerateReceivable}
              className="rounded-lg border border-border bg-primary/10 text-primary px-3 py-1.5 text-xs font-bold hover:bg-primary hover:text-primary-foreground transition inline-flex items-center gap-1"
            >
              <Wallet className="h-3 w-3" /> Gerar conta a receber
            </button>
          )}
        </div>
      )}

      {quote.status === "aprovado" && (
        <div className="mt-3 rounded-xl border border-border/60 bg-card p-4 flex flex-wrap items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <FolderKanban className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground/80">Entrega / Projeto</div>
            <div className="text-sm font-semibold text-foreground">
              {quote.projectId ? "Projeto criado" : "Projeto ainda não criado"}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {quote.projectId
                ? (quote.projectTitle ?? "Acompanhe a entrega no módulo de projetos.")
                : "Transforme este orçamento aprovado em um projeto com entregáveis."}
            </div>
          </div>
          {quote.projectId ? (
            <button
              type="button"
              onClick={onOpenProject}
              className="rounded-lg border border-border/60 px-3 py-1.5 text-xs font-bold text-foreground hover:border-primary hover:text-primary transition inline-flex items-center gap-1"
            >
              <Eye className="h-3 w-3" /> Ver projeto
            </button>
          ) : (
            <button
              type="button"
              onClick={onGenerateProject}
              className="rounded-lg border border-border bg-primary/10 text-primary px-3 py-1.5 text-xs font-bold hover:bg-primary hover:text-primary-foreground transition inline-flex items-center gap-1"
            >
              <FolderKanban className="h-3 w-3" /> Gerar projeto
            </button>
          )}
        </div>
      )}


      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-2">
        <ActionButton icon={<Download className="h-4 w-4" />} label="Baixar PDF" onClick={() => toast("Geração de PDF chega em breve.")} />
        <ActionButton icon={<Send className="h-4 w-4" />} label="Marcar enviado" onClick={onSend} />
        <ActionButton icon={<Copy className="h-4 w-4" />} label="Duplicar" onClick={onDuplicate} />
        <ActionButton icon={<Check className="h-4 w-4" />} label="Aprovar" onClick={onApprove} primary />
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Envio por WhatsApp/e-mail, aprovação online, PIX automático e checkout real chegam em etapa futura.
      </p>
    </Shell>
  );
}

function ActionButton({ icon, label, onClick, primary }: { icon: ReactNode; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
        primary
          ? "border-border text-primary hover:bg-primary hover:text-primary-foreground"
          : "border-border/60 text-foreground hover:border-primary hover:text-primary"
      }`}
    >
      {icon} {label}
    </button>
  );
}

/* ---------------- Helpers ---------------- */

function Shell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-card/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className={`relative max-h-[90vh] w-full overflow-auto rounded-[28px] border border-border/60 bg-[#101012] p-6 md:p-8 text-foreground shadow-2xl ${wide ? "max-w-2xl" : "max-w-xl"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-black">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:text-foreground" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold uppercase text-primary">{label}</label>
      {children}
    </div>
  );
}

function WizardActions({ onClose, step, onBack, canBack = true }: { onClose: () => void; step: number; onBack?: () => void; canBack?: boolean }) {
  return (
    <div className="flex gap-3 pt-3">
      {canBack ? (
        <button type="button" onClick={onBack ?? onClose} className="flex-1 rounded-xl border border-border/60 px-4 py-2.5 text-sm font-bold text-foreground hover:border-primary hover:text-primary transition">
          Voltar
        </button>
      ) : (
        <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border/60 px-4 py-2.5 text-sm font-bold text-foreground hover:border-primary hover:text-primary transition">
          Cancelar
        </button>
      )}
      <button type="submit" className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-black text-primary hover:bg-primary hover:text-primary-foreground transition">
        Continuar
      </button>
    </div>
  );
}

function ModalStyles() {
  return (
    <style>{`
      .modal-input {
        width: 100%;
        border-radius: 12px;
        border: 1px solid hsl(0 0% 15%);
        background: #000;
        padding: 10px 14px;
        font-size: 0.875rem;
        color: white;
        outline: none;
      }
      .modal-input:focus { border-color: hsl(var(--primary)); }
      .modal-input::placeholder { color: #71717a; }
    `}</style>
  );
}
