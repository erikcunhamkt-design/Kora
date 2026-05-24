import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bug,
  CheckCircle2,
  Clock,
  HelpCircle,
  Lightbulb,
  Mail,
  MessageCircle,
  Compass,
  Send,
  Sparkles,
  X,
  AlertCircle,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  SUPPORT_EMAIL,
  SUPPORT_WHATSAPP_URL,
  useSupportTickets,
  type SupportTicketPriority,
  type SupportTicketType,
} from "@/hooks/useSupportTickets";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };
type View = "home" | "form";

const CATEGORIES: { value: SupportTicketType; label: string }[] = [
  { value: "question", label: "Dúvida" },
  { value: "bug", label: "Bug" },
  { value: "billing", label: "Cobrança" },
  { value: "feature", label: "Sugestão" },
  { value: "account", label: "Conta" },
  { value: "other", label: "Outro" },
];

const PRIORITIES: { value: SupportTicketPriority; label: string }[] = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
];

const QUICK_LINKS = [
  { label: "Dashboard", route: "/" },
  { label: "Clientes", route: "/clientes" },
  { label: "CRM", route: "/crm" },
  { label: "Vendas", route: "/vendas" },
  { label: "Financeiro", route: "/financeiro" },
  { label: "Automações", route: "/automacoes" },
  { label: "Presença", route: "/presenca" },
];

export function SupportCenter({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { tickets, createTicket, resolveTicket } = useSupportTickets();

  const [view, setView] = useState<View>("home");
  const [type, setType] = useState<SupportTicketType>("question");
  const [priority, setPriority] = useState<SupportTicketPriority>("medium");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [includeContext, setIncludeContext] = useState(true);

  const recent = useMemo(() => tickets.slice(0, 4), [tickets]);

  const reset = () => {
    setView("home");
    setType("question");
    setPriority("medium");
    setSubject("");
    setMessage("");
    setIncludeContext(true);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const openForm = (preset: SupportTicketType) => {
    setType(preset);
    setSubject("");
    setMessage("");
    setPriority(preset === "bug" ? "high" : "medium");
    setView("form");
  };

  const submit = () => {
    if (!subject.trim()) {
      toast.error("Informe o assunto.");
      return;
    }
    if (!message.trim()) {
      toast.error("Descreva a mensagem.");
      return;
    }
    createTicket({
      type,
      subject: subject.trim(),
      message: message.trim(),
      priority,
      route: includeContext ? location.pathname : "—",
    });
    toast.success("Solicitação registrada. O envio real será ativado quando o suporte for configurado.");
    reset();
  };

  const goTo = (route: string) => {
    onOpenChange(false);
    setTimeout(() => navigate(route), 50);
  };

  const whatsappAvailable = Boolean(SUPPORT_WHATSAPP_URL);
  const emailAvailable = Boolean(SUPPORT_EMAIL);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl max-w-[680px] w-[calc(100vw-24px)] max-h-[80vh] sm:max-h-[78vh] flex flex-col"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/40 flex items-start gap-4">
          {view === "form" && (
            <button
              onClick={() => setView("home")}
              className="mt-1 p-1.5 rounded-md hover:bg-muted/40 transition-colors"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg orbit-gradient flex items-center justify-center shadow-[0_0_20px_hsl(263_84%_58%/0.3)]">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Central de Suporte</h2>
            </div>
            <p className="text-sm text-muted-foreground mt-1.5">
              {view === "home" ? "Como podemos ajudar?" : "Conte os detalhes — vamos cuidar disso."}
            </p>
          </div>
          <button
            onClick={() => handleOpenChange(false)}
            className="p-1.5 rounded-md hover:bg-muted/40 transition-colors"
            aria-label="Fechar"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {view === "home" ? (
            <div className="space-y-6">
              {/* Action grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ActionCard
                  icon={HelpCircle}
                  title="Enviar uma dúvida"
                  description="Tire suas dúvidas sobre o KORA HUB"
                  status="Disponível"
                  statusVariant="success"
                  onClick={() => openForm("question")}
                />
                <ActionCard
                  icon={Bug}
                  title="Reportar bug"
                  description="Algo não está funcionando bem?"
                  status="Disponível"
                  statusVariant="success"
                  onClick={() => openForm("bug")}
                />
                <ActionCard
                  icon={Lightbulb}
                  title="Sugerir melhoria"
                  description="Compartilhe ideias para evoluir o produto"
                  status="Disponível"
                  statusVariant="success"
                  onClick={() => openForm("feature")}
                />
                <ActionCard
                  icon={MessageCircle}
                  title="Falar no WhatsApp"
                  description={
                    whatsappAvailable
                      ? "Atendimento direto pelo WhatsApp"
                      : "WhatsApp de suporte ainda não configurado."
                  }
                  status={whatsappAvailable ? "Disponível" : "Configurar depois"}
                  statusVariant={whatsappAvailable ? "success" : "muted"}
                  disabled={!whatsappAvailable}
                  onClick={() => {
                    if (!whatsappAvailable) {
                      toast("Configure o WhatsApp oficial de suporte antes de ativar este canal.");
                      return;
                    }
                  }}
                />
                <ActionCard
                  icon={Mail}
                  title="Enviar e-mail"
                  description={
                    emailAvailable
                      ? "Mande um e-mail para o suporte"
                      : "E-mail de suporte ainda não configurado."
                  }
                  status={emailAvailable ? "Disponível" : "Configurar depois"}
                  statusVariant={emailAvailable ? "success" : "muted"}
                  disabled={!emailAvailable}
                  onClick={() => {
                    if (!emailAvailable) {
                      toast("Configure o e-mail oficial de suporte antes de ativar este canal.");
                      return;
                    }
                  }}
                />
                <ActionCard
                  icon={Compass}
                  title="Guia rápido"
                  description="Navegue direto para uma área do app"
                  status="Atalhos"
                  statusVariant="primary"
                  onClick={() => {
                    const el = document.getElementById("support-quick-guide");
                    el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                />
              </div>

              {/* Quick guide */}
              <section id="support-quick-guide" className="space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Guia rápido
                </h3>
                <div className="flex flex-wrap gap-2">
                  {QUICK_LINKS.map((l) => (
                    <button
                      key={l.route}
                      onClick={() => goTo(l.route)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border/50 bg-muted/20 text-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all"
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Recent tickets */}
              {recent.length > 0 && (
                <section className="space-y-2.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Solicitações recentes
                  </h3>
                  <div className="space-y-1.5">
                    {recent.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-muted/15 hover:border-border/70 transition-colors"
                      >
                        <div className="mt-0.5">
                          {t.status === "resolved" ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          ) : t.status === "in_review" ? (
                            <Clock className="h-4 w-4 text-amber-400" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground truncate">{t.subject}</p>
                            {t.isDemo && (
                              <Badge variant="outline" className="text-[10px] py-0">
                                demo
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {CATEGORIES.find((c) => c.value === t.type)?.label} ·{" "}
                            {new Date(t.createdAt).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        {t.status !== "resolved" && (
                          <button
                            onClick={() => {
                              resolveTicket(t.id);
                              toast.success("Marcada como resolvida.");
                            }}
                            className="text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors"
                          >
                            Resolver
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sup-subject">
                  Assunto <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="sup-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Descreva em poucas palavras"
                  maxLength={120}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setType(c.value)}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-xs font-medium border transition-all",
                          type === c.value
                            ? "bg-primary/15 border-primary/40 text-primary"
                            : "border-border/50 bg-muted/20 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <div className="flex gap-1.5">
                    {PRIORITIES.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setPriority(p.value)}
                        className={cn(
                          "flex-1 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all",
                          priority === p.value
                            ? "bg-primary/15 border-primary/40 text-primary"
                            : "border-border/50 bg-muted/20 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sup-message">
                  Mensagem <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="sup-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Conte com mais detalhes o que aconteceu ou o que você precisa..."
                  rows={5}
                  maxLength={2000}
                />
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-border/40 bg-muted/15 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeContext}
                  onChange={(e) => setIncludeContext(e.target.checked)}
                  className="mt-0.5 accent-primary"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Incluir contexto da página</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Rota atual ({location.pathname}), navegador e data/hora. Sem dados sensíveis.
                  </p>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        {view === "form" && (
          <div className="px-6 py-4 border-t border-border/40 flex items-center justify-between gap-3 bg-muted/10">
            <p className="text-[11px] text-muted-foreground hidden sm:block">
              Salvo localmente. Envio real ativará após configurar os canais.
            </p>
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="ghost" size="sm" onClick={() => setView("home")}>
                Cancelar
              </Button>
              <Button size="sm" onClick={submit}>
                <Send className="h-3.5 w-3.5" />
                Enviar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ActionCard({
  icon: Icon,
  title,
  description,
  status,
  statusVariant,
  disabled,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  status: string;
  statusVariant: "success" | "muted" | "primary";
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group text-left p-4 rounded-xl border bg-card/60 transition-all duration-200",
        disabled
          ? "border-border/40 opacity-70 cursor-not-allowed"
          : "border-border/50 hover:border-primary/40 hover:bg-primary/[0.03] hover:shadow-[0_0_24px_hsl(263_84%_58%/0.08)] press-effect",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-colors",
            disabled
              ? "bg-muted/30 text-muted-foreground"
              : "bg-primary/10 text-primary group-hover:bg-primary/15",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-foreground">{title}</p>
            <span
              className={cn(
                "text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide",
                statusVariant === "success" && "bg-emerald-500/15 text-emerald-400",
                statusVariant === "primary" && "bg-primary/15 text-primary",
                statusVariant === "muted" && "bg-muted/40 text-muted-foreground",
              )}
            >
              {status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{description}</p>
        </div>
      </div>
    </button>
  );
}
