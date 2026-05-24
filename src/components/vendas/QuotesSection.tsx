import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { FileText, Plus, X, Download, Send, Copy, Check, Trash2 } from "lucide-react";
import { useQuotes, type Quote, type QuoteItem, type QuoteStatus } from "@/hooks/useQuotes";
import { useServices } from "@/hooks/useServices";
import { useClients } from "@/hooks/useClients";

const BRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const STATUS_LABEL: Record<QuoteStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

const STATUS_STYLE: Record<QuoteStatus, string> = {
  rascunho: "bg-amber-500/15 text-amber-400",
  enviado: "bg-primary/15 text-primary",
  aprovado: "bg-emerald-500/15 text-emerald-400",
  recusado: "bg-destructive/15 text-destructive",
};

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border/60 bg-card ${className}`}>{children}</div>;
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-black ${accent ? "text-primary" : "text-foreground"}`}>{value}</div>
    </Card>
  );
}

export function QuotesSection() {
  const { quotes, addQuote, updateStatus, duplicateQuote } = useQuotes();
  const [modalOpen, setModalOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const totalSent = quotes.filter((q) => q.status === "enviado").length;
  const totalApproved = quotes.filter((q) => q.status === "aprovado").length;
  const openValue = quotes
    .filter((q) => q.status === "enviado" || q.status === "rascunho")
    .reduce((s, q) => s + q.total, 0);

  const preview = quotes.find((q) => q.id === previewId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Orçamentos</h1>
          <p className="text-muted-foreground">Crie propostas profissionais para fechar mais negócios.</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-xl border border-border px-4 py-2 text-sm font-bold text-primary hover:bg-primary hover:text-primary-foreground transition flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Novo orçamento
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Criados" value={String(quotes.length)} />
        <Metric label="Enviados" value={String(totalSent)} />
        <Metric label="Aprovados" value={String(totalApproved)} accent />
        <Metric label="Valor em aberto" value={BRL(openValue)} />
      </div>

      {quotes.length === 0 ? (
        <Card className="p-10 text-center">
          <FileText className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-xl font-black">Nenhum orçamento criado</h2>
          <p className="mt-1 text-sm text-muted-foreground">Crie seu primeiro orçamento para enviar ao cliente.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border/60">
                <th className="px-4 py-3 text-left">Título</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Validade</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {quotes.map((q) => (
                <tr key={q.id} className="hover:bg-muted/40/50 transition">
                  <td className="px-4 py-3 font-bold text-foreground">{q.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{q.clientName}</td>
                  <td className="px-4 py-3 text-right font-black text-primary">{BRL(q.total)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[q.status]}`}>
                      {STATUS_LABEL[q.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{q.createdAt}</td>
                  <td className="px-4 py-3 text-muted-foreground">{q.validityDays}d</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setPreviewId(q.id)}
                      className="rounded-lg border border-border/60 px-3 py-1.5 text-xs font-bold text-foreground hover:border-primary hover:text-primary transition"
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {modalOpen && (
        <NewQuoteWizard
          onClose={() => setModalOpen(false)}
          onSave={(data) => {
            addQuote(data);
            toast.success("Orçamento salvo");
            setModalOpen(false);
          }}
        />
      )}

      {preview && (
        <QuotePreview
          quote={preview}
          onClose={() => setPreviewId(null)}
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
            updateStatus(preview.id, "aprovado");
            toast.success("Orçamento aprovado");
          }}
        />
      )}
    </div>
  );
}

/* ---------------- Wizard ---------------- */

type WizardData = Omit<Quote, "id" | "createdAt" | "subtotal" | "total" | "isDemo">;

function NewQuoteWizard({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: WizardData) => void;
}) {
  const { services } = useServices();
  const { clients } = useClients();
  const [step, setStep] = useState(1);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientWhatsapp, setClientWhatsapp] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [discount, setDiscount] = useState("0");
  const [paymentCondition, setPaymentCondition] = useState("À vista no Pix");
  const [deliveryDeadline, setDeliveryDeadline] = useState("15 dias");
  const [validityDays, setValidityDays] = useState("15");

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
      title: title.trim(),
      description: description.trim(),
      items,
      discount: Number(discount || 0),
      paymentCondition: paymentCondition.trim(),
      deliveryDeadline: deliveryDeadline.trim(),
      validityDays: Number(validityDays) || 0,
      status: "rascunho",
    });
  }

  return (
    <Shell title={`Novo orçamento — Etapa ${step} de 4`} onClose={onClose} wide>
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
                  setClientEmail(c.email || "");
                  setClientWhatsapp(c.whatsapp || c.phone || "");
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
                  <button type="button" onClick={() => removeItem(it.id)} className="text-muted-foreground hover:text-red-400 p-2" aria-label="Remover">
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
          <WizardActions onClose={onClose} step={step} onBack={() => setStep(2)} />
        </form>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <Card className="p-5 space-y-3">
            <div>
              <div className="text-xs uppercase text-muted-foreground">Cliente</div>
              <div className="font-bold">{clientName}</div>
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
}: {
  quote: Quote;
  onClose: () => void;
  onDuplicate: () => void;
  onSend: () => void;
  onApprove: () => void;
}) {
  return (
    <Shell title="Preview do orçamento" onClose={onClose} wide>
      <div className="rounded-2xl border border-border/60 bg-white text-zinc-900 p-8 space-y-5">
        <div className="flex items-start justify-between border-b border-zinc-200 pb-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Orçamento</div>
            <div className="text-2xl font-black">KORA HUB</div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>Emitido em {quote.createdAt}</div>
            <div>Validade {quote.validityDays} dias</div>
          </div>
        </div>

        <div>
          <div className="text-xs uppercase text-muted-foreground">Cliente</div>
          <div className="font-bold">{quote.clientName}</div>
          {quote.clientEmail && <div className="text-sm text-zinc-600">{quote.clientEmail}</div>}
          {quote.clientWhatsapp && <div className="text-sm text-zinc-600">{quote.clientWhatsapp}</div>}
        </div>

        <div>
          <div className="text-xs uppercase text-muted-foreground">Projeto</div>
          <div className="font-bold">{quote.title}</div>
          {quote.description && <p className="text-sm text-zinc-600 mt-1">{quote.description}</p>}
        </div>

        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground border-b border-zinc-200">
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
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-2">
        <ActionButton icon={<Download className="h-4 w-4" />} label="Baixar PDF" onClick={() => toast.info("PDF será implementado na próxima etapa")} />
        <ActionButton icon={<Send className="h-4 w-4" />} label="Enviar" onClick={onSend} />
        <ActionButton icon={<Copy className="h-4 w-4" />} label="Duplicar" onClick={onDuplicate} />
        <ActionButton icon={<Check className="h-4 w-4" />} label="Aprovar" onClick={onApprove} primary />
      </div>
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
      .modal-input:focus { border-color: #fbbf24; }
      .modal-input::placeholder { color: #71717a; }
    `}</style>
  );
}
