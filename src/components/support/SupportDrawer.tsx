import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Check, Mail, MessageCircle, MessagesSquare, Trash2 } from "lucide-react";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SUPPORT_EMAIL,
  SUPPORT_WHATSAPP_URL,
  useSupportTickets,
  type SupportTicketPriority,
  type SupportTicketType,
} from "@/hooks/useSupportTickets";
import { cn } from "@/lib/utils";

interface SupportDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TYPE_LABEL: Record<SupportTicketType, string> = {
  question: "Dúvida",
  bug: "Bug",
  feature: "Sugestão",
  billing: "Cobrança",
  account: "Conta",
  other: "Outro",
};

const PRIORITY_LABEL: Record<SupportTicketPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

const STATUS_LABEL = {
  open: "Aberto",
  in_review: "Em análise",
  resolved: "Resolvido",
} as const;

const QUICK_CATEGORIES: { value: SupportTicketType; label: string }[] = [
  { value: "question", label: "Dúvida" },
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Sugestão" },
];

type TabValue = "new" | "mine" | "chat" | "channels";

export function SupportDrawer({ open, onOpenChange }: SupportDrawerProps) {
  const { tickets, createTicket, resolveTicket, removeTicket } = useSupportTickets();
  const location = useLocation();
  const [tab, setTab] = useState<TabValue>("new");

  const [type, setType] = useState<SupportTicketType>("question");
  const [priority, setPriority] = useState<SupportTicketPriority>("medium");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const userTickets = useMemo(() => tickets.filter((t) => !t.isDemo), [tickets]);

  useEffect(() => {
    if (!open) return;
    setTab("new");
  }, [open]);

  const reset = () => {
    setType("question");
    setPriority("medium");
    setSubject("");
    setMessage("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error("Preencha assunto e mensagem.");
      return;
    }
    createTicket({
      type,
      priority,
      subject: subject.trim(),
      message: message.trim(),
      route: location.pathname,
    });
    toast.success("Chamado registrado.", {
      description: "O envio real será ativado quando o suporte oficial for configurado.",
    });
    reset();
    setTab("mine");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[460px] p-0 flex flex-col bg-card border-l border-border/60"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-5 border-b border-border/40 bg-gradient-to-b from-primary/[0.04] to-transparent">
          <div className="flex items-center gap-2">
            <h2 className="text-[1.0625rem] font-semibold text-foreground tracking-tight">Central de Suporte</h2>
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-success/20 text-success/70 bg-success/5 font-medium">
              Tickets ativos
            </Badge>
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-border/30 text-muted-foreground/50 bg-muted/20 font-medium">
              Chat em breve
            </Badge>
          </div>
          <p className="text-[0.8125rem] text-muted-foreground mt-1">Fale com a equipe KORA</p>
          <p className="text-[0.6875rem] text-muted-foreground/80 mt-2 leading-relaxed">
            Resposta por chamado enquanto o chat ao vivo não está ativo.
          </p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-4">
            <TabsList className="w-full grid grid-cols-4 h-9">
              <TabsTrigger value="new" className="text-[0.75rem]">Novo</TabsTrigger>
              <TabsTrigger value="mine" className="text-[0.75rem]">
                Meus
                {userTickets.length > 0 && (
                  <span className="ml-1 text-[10px] text-muted-foreground">{userTickets.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="channels" className="text-[0.75rem]">Canais</TabsTrigger>
              <TabsTrigger value="chat" className="text-[0.75rem]">Chat</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
            {/* Novo chamado */}
            <TabsContent value="new" className="mt-0 space-y-5">
              <div className="space-y-2.5">
                <div className="text-[0.8125rem] font-medium text-foreground">Como podemos ajudar?</div>
                <div className="flex gap-1.5 flex-wrap">
                  {QUICK_CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setType(c.value)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-[0.75rem] font-medium border transition-all",
                        type === c.value
                          ? "bg-primary/15 border-primary/40 text-primary"
                          : "bg-muted/40 border-border/50 text-muted-foreground hover:border-border hover:text-foreground",
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[0.75rem] font-medium text-muted-foreground">Tipo</label>
                    <Select value={type} onValueChange={(v) => setType(v as SupportTicketType)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(TYPE_LABEL) as SupportTicketType[]).map((k) => (
                          <SelectItem key={k} value={k}>{TYPE_LABEL[k]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[0.75rem] font-medium text-muted-foreground">Prioridade</label>
                    <Select value={priority} onValueChange={(v) => setPriority(v as SupportTicketPriority)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(PRIORITY_LABEL) as SupportTicketPriority[]).map((k) => (
                          <SelectItem key={k} value={k}>{PRIORITY_LABEL[k]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[0.75rem] font-medium text-muted-foreground">Assunto*</label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Ex: Erro ao criar orçamento"
                    className="h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[0.75rem] font-medium text-muted-foreground">Mensagem*</label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Conte o que aconteceu e o que você esperava..."
                    rows={5}
                  />
                </div>

                <p className="text-[0.75rem] text-muted-foreground leading-relaxed bg-muted/30 border border-border/40 rounded-lg px-3 py-2.5">
                  Incluiremos a página atual e informações técnicas básicas para ajudar no suporte.
                </p>

                <Button type="submit" className="w-full">Registrar chamado</Button>
              </form>
            </TabsContent>

            {/* Meus chamados */}
            <TabsContent value="mine" className="mt-0">
              {userTickets.length === 0 ? (
                <div className="text-center py-16">
                  <div className="mx-auto h-10 w-10 rounded-full bg-muted/40 border border-border/50 flex items-center justify-center mb-3">
                    <MessagesSquare className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-[0.9375rem] font-medium text-foreground">Nenhum chamado aberto</div>
                  <div className="text-[0.8125rem] text-muted-foreground mt-1">
                    Seus chamados aparecerão aqui.
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {userTickets.map((t) => (
                    <div
                      key={t.id}
                      className="rounded-lg border border-border/50 bg-background/40 px-4 py-3 hover:border-border transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-[0.875rem] font-medium text-foreground truncate">
                            {t.subject}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                              {TYPE_LABEL[t.type]}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={
                                t.priority === "high"
                                  ? "text-[10px] h-5 px-1.5 border-primary/40 text-primary"
                                  : "text-[10px] h-5 px-1.5"
                              }
                            >
                              {PRIORITY_LABEL[t.priority]}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={
                                t.status === "resolved"
                                  ? "text-[10px] h-5 px-1.5 border-success/40 text-success"
                                  : "text-[10px] h-5 px-1.5"
                              }
                            >
                              {STATUS_LABEL[t.status]}
                            </Badge>
                          </div>
                          <div className="text-[0.6875rem] text-muted-foreground mt-2">
                            {new Date(t.createdAt).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            <span className="mx-1.5">·</span>
                            <span className="font-mono">{t.route}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {t.status !== "resolved" && (
                            <button
                              onClick={() => resolveTicket(t.id)}
                              aria-label="Marcar como resolvido"
                              className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-success transition-colors"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => removeTicket(t.id)}
                            aria-label="Remover"
                            className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Chat ao vivo */}
            <TabsContent value="chat" className="mt-0 space-y-5">
              <div className="rounded-xl border border-border/50 bg-background/40 px-5 py-8 text-center">
                <div className="mx-auto h-10 w-10 rounded-full bg-muted/40 border border-border/50 flex items-center justify-center mb-3">
                  <MessagesSquare className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className="text-[0.9375rem] font-medium text-foreground">Chat ao vivo</span>
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-border/60 text-muted-foreground">
                    Indisponível agora
                  </Badge>
                </div>
                <p className="text-[0.8125rem] text-muted-foreground leading-relaxed max-w-[320px] mx-auto mt-2">
                  O atendimento em tempo real será ativado quando a equipe de suporte estiver configurada.
                </p>
                <Button disabled size="sm" className="mt-5 opacity-50 cursor-not-allowed">Em breve</Button>
              </div>

              <div className="rounded-lg border border-border/50 bg-background/40 px-5 py-5 text-center">
                <p className="text-[0.8125rem] text-muted-foreground leading-relaxed max-w-[320px] mx-auto">
                  Precisa de ajuda agora? Abra um chamado e nossa equipe responderá por lá.
                </p>
                <Button variant="secondary" size="sm" className="mt-3" onClick={() => setTab("new")}>
                  Criar chamado
                </Button>
              </div>
            </TabsContent>

            {/* Canais */}
            <TabsContent value="channels" className="mt-0 space-y-2">
              <ChannelRow
                icon={<MessageCircle className="h-4 w-4" />}
                title="WhatsApp oficial"
                description="Canal ainda não configurado."
                enabled={!!SUPPORT_WHATSAPP_URL}
              />
              <ChannelRow
                icon={<Mail className="h-4 w-4" />}
                title="E-mail de suporte"
                description="E-mail oficial ainda não configurado."
                enabled={!!SUPPORT_EMAIL}
              />
              <p className="text-[0.75rem] text-muted-foreground pt-3 leading-relaxed">
                Esses canais serão liberados assim que o suporte oficial for ativado.
              </p>
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function ChannelRow({
  icon,
  title,
  description,
  enabled,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border/50 bg-background/40">
      <div className="h-8 w-8 rounded-md bg-muted/60 flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[0.875rem] font-medium text-foreground">{title}</div>
        <div className="text-[0.75rem] text-muted-foreground">{description}</div>
      </div>
      <Button size="sm" variant="outline" disabled className="h-8 text-[0.75rem]">
        {enabled ? "Abrir" : "Configurar depois"}
      </Button>
    </div>
  );
}
