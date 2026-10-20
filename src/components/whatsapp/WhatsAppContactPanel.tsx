import { useEffect, useState } from "react";
import {
  Briefcase,
  Copy,
  FileText,
  Headset,
  Link2,
  ListChecks,
  Phone,
  Plus,
  StickyNote,
  Tag,
  Trash2,
  User,
  UserCog,
  UserPlus,
  X,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  assignableAttendants,
  assignmentLabel,
  returnHint,
  type AssignmentOrigin,
  type WorkspaceAttendant,
} from "@/lib/whatsapp/assignment";
import { WhatsAppStatusBadge } from "./WhatsAppStatusBadge";
import { Link } from "react-router-dom";
import { formatCurrency as intlCurrency, formatDateTime as intlDateTime } from "@/lib/format";

export interface WhatsAppContactPanelProps {
  conversationId: string;
  workspaceId: string;
  contactName: string | null;
  contactPhone: string;
  status?: string | null;
  tags?: string[] | null;
  assignedTo?: string | null;
  /**
   * G101 — como a atribuição atual nasceu ('auto' = handover/assumir ao responder; 'manual' =
   * alguém atribuiu). Vem de `getAssignmentOrigin()` (leitura por `unknown`: a coluna é DRAFT
   * de migration §8-b). `null`/ausente = desconhecida => o rótulo não afirma nada.
   */
  assignmentOrigin?: AssignmentOrigin | null;
  /**
   * G101 — membros do workspace (id, nome, papel) vindos de `useWorkspaceAttendants`. O Select
   * oferece só quem atende (`assignableAttendants`: owner/admin/member); o nome de quem já está
   * atribuído resolve por aqui mesmo se o papel mudou. Vazio/ausente = Select desabilitado.
   */
  attendants?: WorkspaceAttendant[];
  /**
   * G101 — gate de papel: o controle (Select + "Remover atribuição") só é operável com `true`
   * (a página passa `useWorkspaceRole().isAdmin`, o mesmo gate do Robô IA). Sem permissão a
   * atribuição aparece só como texto.
   */
  canAssign?: boolean;
  /**
   * G103 (viewer somente-leitura) — pode editar as tags da conversa (`update_conversation_tags`)?
   * Default `true` (chamador antigo). A página passa `false` pro viewer: as tags aparecem sem "×" e
   * sem o campo de nova tag, em vez de oferecer uma ação que o servidor nega (403).
   */
  canEditTags?: boolean;
  /**
   * Etapa 9 · item 4 (R4) — quando a conversa foi ENTREGUE a humano (robô em silêncio).
   * Vem de `getHandoverAt()` (leitura por `unknown`: a coluna `handover_at` é DRAFT de
   * migration §8-b). `null`/ausente = não entregue OU coluna inexistente → nada é mostrado.
   * Independente de `assignedTo` (G48: a atribuição segue decisão de produto em aberto).
   */
  handoverAt?: string | null;
  avatarUrl?: string | null;
  lastActivity?: string | null;
  clientId?: string | null;
  onClose?: () => void;
  onClientLinked?: (clientId: string | null) => void;
  /** `userId = null` remove a atribuição. Pode ser assíncrono: o controle fica travado até resolver. */
  onAssign?: (userId: string | null) => void | Promise<unknown>;
  onUpdateTags?: (tags: string[]) => void;
}

interface Note {
  id: string;
  content: string;
  created_at: string;
  author_id: string | null;
}

interface ClientLite {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  company: string | null;
}

interface QuoteLite {
  id: string;
  title: string;
  total: number | null;
  status: string | null;
  created_at: string;
}

interface ProjectLite {
  id: string;
  title: string;
  status: string;
}

interface FinanceLite {
  id: string;
  title: string;
  amount: number;
  status: string;
  due_date: string | null;
}

function initials(name: string | null, phone: string) {
  const base = (name ?? phone).trim();
  if (!base) return "?";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Section({
  title,
  children,
  icon: Icon,
  action,
}: {
  title: string;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3 border-b border-border/40">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
          <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            {title}
          </h4>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function fmtCurrency(n: number | null | undefined) {
  if (n == null) return "—";
  return intlCurrency(n, {});
}

export function WhatsAppContactPanel({
  conversationId,
  workspaceId,
  contactName,
  contactPhone,
  status,
  tags: initialTags,
  assignedTo,
  assignmentOrigin,
  attendants,
  canAssign,
  canEditTags = true,
  handoverAt,
  avatarUrl,
  lastActivity,
  clientId: initialClientId,
  onClose,
  onClientLinked,
  onAssign,
  onUpdateTags,
}: WhatsAppContactPanelProps) {
  const [clientId, setClientId] = useState<string | null>(initialClientId ?? null);
  const [client, setClient] = useState<ClientLite | null>(null);
  const [quotes, setQuotes] = useState<QuoteLite[]>([]);
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [finance, setFinance] = useState<FinanceLite[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<ClientLite[]>([]);
  const [creatingOpportunity, setCreatingOpportunity] = useState(false);
  const [panelTags, setPanelTags] = useState<string[]>(initialTags ?? []);
  const [newTag, setNewTag] = useState("");
  // G101 — atribuição. O dono vem SEMPRE da prop (`assignedTo`, que o realtime da conversa
  // atualiza); o painel só trava o controle enquanto a chamada roda. (A leitura de membros que
  // morava aqui apontava pra uma relação inexistente e o resultado nunca era renderizado;
  // a lista agora vem pronta do servidor via `attendants`.)
  const [assigning, setAssigning] = useState(false);
  const assignable = assignableAttendants(attendants ?? []);
  const hint = returnHint(!!handoverAt, assignedTo, assignmentOrigin);
  const handleAssign = async (userId: string | null) => {
    if (!onAssign || assigning) return;
    setAssigning(true);
    try {
      await onAssign(userId);
    } finally {
      setAssigning(false);
    }
  };

  useEffect(() => {
    setClientId(initialClientId ?? null);
  }, [initialClientId, conversationId]);

  // Load notes
  useEffect(() => {
    if (!conversationId) return;
    let active = true;
    supabase
      .from("whatsapp_internal_notes")
      .select("id, content, created_at, author_id")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (active) setNotes((data ?? []) as Note[]);
      });
    return () => {
      active = false;
    };
  }, [conversationId]);

  // Try to auto-resolve client by phone if not linked
  useEffect(() => {
    if (clientId) return;
    // G108 — o painel NÃO é remontado ao trocar de conversa: sem este reset, o cliente da conversa
    // anterior ficava como "sugestão" (e o botão "Vincular a esta conversa" ligava a conversa nova a ele).
    setClient(null);
    if (!workspaceId || !contactPhone) return;
    const digits = contactPhone.replace(/\D/g, "");
    if (!digits) return;
    let active = true;
    supabase
      .from("clients")
      .select("id, name, email, phone, whatsapp, company")
      .eq("workspace_id", workspaceId)
      .or(`phone.ilike.%${digits.slice(-8)}%,whatsapp.ilike.%${digits.slice(-8)}%`)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data) setClient(data as ClientLite);
      });
    return () => {
      active = false;
    };
  }, [clientId, workspaceId, contactPhone]);

  // Load full client + quotes + projects + finance when linked
  useEffect(() => {
    if (!clientId) {
      // Sem cliente vinculado NENHUMA consulta de dado de cliente é feita (G108/G75).
      setQuotes([]);
      setProjects([]);
      setFinance([]);
      return;
    }
    // G108 — trocou de cliente (outra conversa): limpa o cliente e as listas do ANTERIOR antes de
    // buscar; senão elas ficavam na tela (e, se a busca falhasse, ficavam pra sempre) sob o novo vínculo.
    setClient((prev) => (prev && prev.id === clientId ? prev : null));
    setQuotes([]);
    setProjects([]);
    setFinance([]);
    let active = true;
    (async () => {
      const [c, q, p, f] = await Promise.all([
        supabase.from("clients").select("id, name, email, phone, whatsapp, company").eq("workspace_id", workspaceId).eq("id", clientId).maybeSingle(),
        // G108 — ESCOPO POR CLIENTE: antes só `workspace_id`, e a lista mostrava os 5 orçamentos mais
        // recentes do workspace (título e valor) sob o cliente vinculado.
        supabase.from("quotes").select("id, title, total, status, created_at").eq("workspace_id", workspaceId).eq("client_id", clientId).order("created_at", { ascending: false }).limit(5),
        supabase.from("projects").select("id, title, status").eq("workspace_id", workspaceId).eq("client_id", clientId).order("created_at", { ascending: false }).limit(5),
        supabase.from("financial_transactions").select("id, title, amount, status, due_date").eq("workspace_id", workspaceId).eq("client_id", clientId).neq("status", "paid").order("due_date", { ascending: true }).limit(5),
      ]);
      if (!active) return;
      // vínculo apontando pra cliente que não existe mais/não é do workspace: não deixa sobrar o anterior
      setClient(c.data ? (c.data as ClientLite) : null);
      setQuotes((q.data ?? []) as QuoteLite[]);
      setProjects((p.data ?? []) as ProjectLite[]);
      setFinance((f.data ?? []) as FinanceLite[]);
    })();
    return () => {
      active = false;
    };
  }, [clientId, workspaceId]);

  // Client search dialog
  useEffect(() => {
    if (!linkOpen || !workspaceId) return;
    const t = setTimeout(async () => {
      const q = supabase
        .from("clients")
        .select("id, name, email, phone, whatsapp, company")
        .eq("workspace_id", workspaceId)
        .order("name")
        .limit(15);
      const term = searchTerm.trim();
      if (term) {
        q.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,whatsapp.ilike.%${term}%,company.ilike.%${term}%`);
      }
      const { data } = await q;
      setSearchResults((data ?? []) as ClientLite[]);
    }, 200);
    return () => clearTimeout(t);
  }, [linkOpen, searchTerm, workspaceId]);

  async function persistConversationClient(newId: string | null) {
    const { error } = await supabase
      .from("whatsapp_conversations")
      .update({ client_id: newId })
      .eq("id", conversationId);
    if (error) {
      toast.error("Não foi possível vincular o cliente");
      return false;
    }
    setClientId(newId);
    onClientLinked?.(newId);
    toast.success(newId ? "Cliente vinculado" : "Cliente desvinculado");
    return true;
  }

  async function handleAddNote() {
    const content = newNote.trim();
    if (!content) return;
    setSavingNote(true);
    const { data: userRes } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("whatsapp_internal_notes")
      .insert({
        workspace_id: workspaceId,
        conversation_id: conversationId,
        author_id: userRes.user?.id ?? null,
        content,
      })
      .select("id, content, created_at, author_id")
      .single();
    setSavingNote(false);
    if (error || !data) {
      toast.error("Erro ao salvar nota");
      return;
    }
    setNotes((prev) => [data as Note, ...prev]);
    setNewNote("");
  }

  async function handleDeleteNote(id: string) {
    const prev = notes;
    setNotes((p) => p.filter((n) => n.id !== id));
    const { error } = await supabase.from("whatsapp_internal_notes").delete().eq("id", id);
    if (error) {
      setNotes(prev);
      toast.error("Erro ao excluir nota");
    }
  }

  async function handleCreateClient() {
    if (!workspaceId) return;
    const { data, error } = await supabase
      .from("clients")
      .insert({
        workspace_id: workspaceId,
        name: contactName ?? contactPhone,
        whatsapp: contactPhone,
        phone: contactPhone,
        source: "whatsapp",
      })
      .select("id, name, email, phone, whatsapp, company")
      .single();
    if (error || !data) {
      toast.error("Erro ao criar cliente");
      return;
    }
    setClient(data as ClientLite);
    await persistConversationClient(data.id);
  }

  async function handleCreateOpportunity() {
    if (!workspaceId) return;
    setCreatingOpportunity(true);
    const { data, error } = await supabase
      .from("crm_opportunities")
      .insert({
        workspace_id: workspaceId,
        client_id: clientId,
        title: `Oportunidade — ${contactName ?? contactPhone}`,
        contact_name: contactName,
        phone: contactPhone,
        whatsapp: contactPhone,
        stage: "lead",
        source: "whatsapp",
      })
      .select("id")
      .single();
    setCreatingOpportunity(false);
    if (error || !data) {
      toast.error("Erro ao criar oportunidade");
      return;
    }
    toast.success("Oportunidade criada no CRM");
  }

  function copyPhone() {
    navigator.clipboard.writeText(contactPhone);
    toast.success("Telefone copiado");
  }

  // G108 — "vinculado" exige que o cliente carregado seja o do vínculo (id igual): nunca o da
  // conversa anterior nem a sugestão por telefone.
  const linkedClient = clientId && client?.id === clientId ? client : null;

  return (
    <aside className="w-[320px] flex-shrink-0 border-l border-border/40 bg-card/20 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Contato
        </h3>
        {onClose && (
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="px-4 py-5 flex flex-col items-center text-center border-b border-border/40">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary/30 to-primary/5 border border-primary/20 flex items-center justify-center text-base font-semibold overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt={contactName ?? contactPhone} className="h-full w-full object-cover" />
            ) : (
              initials(contactName, contactPhone)
            )}
          </div>
          <h2 className="mt-3 text-sm font-semibold text-foreground truncate max-w-full">
            {contactName ?? contactPhone}
          </h2>
          <button
            onClick={copyPhone}
            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 mt-0.5 transition-colors"
            title="Copiar"
          >
            <Phone className="h-2.5 w-2.5" /> {contactPhone}
            <Copy className="h-2.5 w-2.5 opacity-60" />
          </button>
          {status && <WhatsAppStatusBadge status={status} className="mt-3" />}
          {handoverAt && (
            <div
              role="status"
              aria-label="Estado do atendimento"
              className="mt-3 flex flex-col items-center gap-0.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2"
            >
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                <Headset className="h-3 w-3" aria-hidden="true" />
                Entregue a atendimento humano
              </span>
              <span className="text-[10px] text-muted-foreground">
                desde {intlDateTime(handoverAt, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} — o robô está em silêncio nesta conversa
              </span>
            </div>
          )}
        </div>

        {/* G101 — atribuição: quem é o dono da conversa e (para quem pode) o controle pra mudar. */}
        <Section title="Atendente" icon={UserCog}>
          <p className="text-xs text-foreground/90" aria-label="Atribuição da conversa">
            {assignmentLabel(assignedTo, attendants ?? [], assignmentOrigin)}
          </p>
          {canAssign && onAssign && (
            <div className="mt-2 space-y-2">
              <Select
                // Valor só se o dono atual está entre os que podem ser escolhidos; senão vazio
                // (placeholder) — o rótulo acima continua dizendo quem é.
                value={assignedTo && assignable.some((a) => a.id === assignedTo) ? assignedTo : ""}
                onValueChange={(userId) => void handleAssign(userId)}
                disabled={assigning || assignable.length === 0}
              >
                <SelectTrigger className="h-8 text-xs" aria-label="Atribuir conversa a um atendente">
                  <SelectValue placeholder={assignable.length === 0 ? "Nenhum atendente disponível" : "Atribuir a…"} />
                </SelectTrigger>
                <SelectContent>
                  {assignable.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="text-xs">
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {assignedTo && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={assigning}
                  onClick={() => void handleAssign(null)}
                >
                  Remover atribuição
                </Button>
              )}
            </div>
          )}
          {/* O que "Devolver ao robô" faz com ESTA atribuição (D2) — só com origem conhecida e conversa entregue. */}
          {hint && <p className="mt-2 text-[10px] text-muted-foreground">{hint}</p>}
        </Section>

        {/* Quick actions */}
        <Section title="Ações rápidas" icon={Plus}>
          <div className="grid gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLinkOpen(true)}
              className="w-full justify-start gap-2 border-border/50 text-xs h-8"
            >
              <Link2 className="h-3.5 w-3.5" />
              {linkedClient ? "Trocar cliente vinculado" : "Vincular cliente"}
            </Button>
            {!linkedClient && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateClient}
                className="w-full justify-start gap-2 border-border/50 text-xs h-8"
              >
                <UserPlus className="h-3.5 w-3.5" /> Criar cliente
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateOpportunity}
              disabled={creatingOpportunity}
              className="w-full justify-start gap-2 border-border/50 text-xs h-8"
            >
              <Briefcase className="h-3.5 w-3.5" /> Criar oportunidade
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 border-border/50 text-xs h-8"
            >
              <Link to="/orcamentos/novo">
                <FileText className="h-3.5 w-3.5" /> Novo orçamento
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 border-border/50 text-xs h-8"
            >
              <Link to="/agenda">
                <ListChecks className="h-3.5 w-3.5" /> Agendar tarefa
              </Link>
            </Button>
          </div>
        </Section>

        {/* Cliente vinculado */}
        <Section
          title="Cliente"
          icon={User}
          action={
            linkedClient ? (
              <button
                onClick={() => persistConversationClient(null)}
                className="text-[10px] text-muted-foreground hover:text-destructive uppercase tracking-wider"
              >
                Desvincular
              </button>
            ) : undefined
          }
        >
          {linkedClient ? (
            <div className="space-y-1">
              <Link
                to={`/crm/clientes/${linkedClient.id}`}
                className="text-xs font-semibold text-foreground hover:text-primary"
              >
                {linkedClient.name}
              </Link>
              {linkedClient.company && (
                <p className="text-[11px] text-muted-foreground">{linkedClient.company}</p>
              )}
              {linkedClient.email && (
                <p className="text-[11px] text-muted-foreground">{linkedClient.email}</p>
              )}
            </div>
          ) : client ? (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">
                Encontramos um cliente com este telefone:
              </p>
              <div className="rounded-md border border-border/40 p-2 bg-background/40">
                <p className="text-xs font-medium">{client.name}</p>
                {client.company && (
                  <p className="text-[10px] text-muted-foreground">{client.company}</p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 text-[11px]"
                onClick={() => persistConversationClient(client.id)}
              >
                Vincular a esta conversa
              </Button>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">Nenhum cliente vinculado.</p>
          )}
        </Section>

        <Section title="Tags" icon={Tag}>
          <div className="flex flex-wrap gap-1.5">
            {panelTags.length > 0 ? (
              panelTags.map((t) =>
                canEditTags ? (
                  <Badge key={t} variant="outline" className="text-[10px] h-5 border-border/60 cursor-pointer hover:border-destructive hover:text-destructive"
                    onClick={() => {
                      const next = panelTags.filter((x) => x !== t);
                      setPanelTags(next);
                      onUpdateTags?.(next);
                    }}
                  >
                    {t} ×
                  </Badge>
                ) : (
                  // somente leitura (viewer): a tag aparece, mas não é clicável nem tem "×" (G29: nada que dê 403)
                  <Badge key={t} variant="outline" className="text-[10px] h-5 border-border/60">
                    {t}
                  </Badge>
                ),
              )
            ) : (
              <span className="text-[11px] text-muted-foreground italic">Sem tags</span>
            )}
          </div>
          {canEditTags && (
          <div className="flex items-center gap-1.5 mt-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Nova tag..."
              className="h-7 text-xs bg-background/60"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const v = newTag.trim();
                  if (v && !panelTags.includes(v)) {
                    const next = [...panelTags, v];
                    setPanelTags(next);
                    onUpdateTags?.(next);
                    setNewTag("");
                  }
                }
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => {
                const v = newTag.trim();
                if (v && !panelTags.includes(v)) {
                  const next = [...panelTags, v];
                  setPanelTags(next);
                  onUpdateTags?.(next);
                  setNewTag("");
                }
              }}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          )}
        </Section>

        {/* Orçamentos */}
        {!clientId && (
          // G108/G75 — sem vínculo NÃO se consulta nada; "Nenhum orçamento." seria falso (não há cliente
          // pra ter ou não orçamento). Mesma frase da seção "Cliente".
          <Section title="Orçamentos recentes" icon={FileText}>
            <p className="text-[11px] text-muted-foreground italic">Nenhum cliente vinculado.</p>
          </Section>
        )}
        {linkedClient && (
          <Section title="Orçamentos recentes" icon={FileText}>
            {quotes.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">Nenhum orçamento.</p>
            ) : (
              <ul className="space-y-1.5">
                {quotes.map((q) => (
                  <li key={q.id} className="flex items-center justify-between gap-2">
                    <Link
                      to={`/orcamentos/${q.id}`}
                      className="text-[11px] text-foreground hover:text-primary truncate flex-1"
                    >
                      {q.title}
                    </Link>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {fmtCurrency(q.total)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {/* Projetos */}
        {linkedClient && projects.length > 0 && (
          <Section title="Projetos" icon={Briefcase}>
            <ul className="space-y-1.5">
              {projects.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-foreground truncate flex-1">{p.title}</span>
                  <Badge variant="outline" className="text-[9px] h-4 border-border/60">
                    {p.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Financeiro em aberto */}
        {linkedClient && finance.length > 0 && (
          <Section title="Em aberto" icon={Briefcase}>
            <ul className="space-y-1.5">
              {finance.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-foreground truncate flex-1">{f.title}</span>
                  <span className="text-[10px] text-warning whitespace-nowrap">
                    {fmtCurrency(f.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Notas internas */}
        <Section title="Notas internas" icon={StickyNote}>
          <div className="space-y-2">
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Adicionar nota (apenas equipe)..."
              className="min-h-[60px] text-xs bg-background/40 border-border/50"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  handleAddNote();
                }
              }}
            />
            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={savingNote || !newNote.trim()}
              className="w-full h-7 text-[11px]"
            >
              Salvar nota
            </Button>

            {notes.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic pt-1">
                Nenhuma nota ainda.
              </p>
            ) : (
              <ul className="space-y-1.5 pt-1">
                {notes.map((n) => (
                  <li
                    key={n.id}
                    className="group rounded-md border border-warning/30 bg-warning/5 p-2 text-[11px] text-foreground relative"
                  >
                    <p className="whitespace-pre-wrap pr-5">{n.content}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[9px] text-muted-foreground">
                        {intlDateTime(n.created_at, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                      <button
                        onClick={() => handleDeleteNote(n.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>

        <Section title="Última atividade" icon={FileText}>
          <p className="text-[11px] text-muted-foreground">
            {lastActivity ? intlDateTime(lastActivity, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
          </p>
        </Section>
      </div>

      {/* Link client dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular cliente</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, e-mail, telefone..."
              className="pl-9"
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto -mx-2">
            {searchResults.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Nenhum cliente encontrado.
              </p>
            ) : (
              <ul className="divide-y divide-border/40">
                {searchResults.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={async () => {
                        const ok = await persistConversationClient(c.id);
                        if (ok) setLinkOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-muted/40 rounded-md"
                    >
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {c.company ?? c.email ?? c.phone ?? c.whatsapp ?? "—"}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCreateClient}>
              <UserPlus className="h-4 w-4 mr-1" /> Criar novo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
