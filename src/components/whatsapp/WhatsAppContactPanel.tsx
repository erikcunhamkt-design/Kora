import { useEffect, useState } from "react";
import {
  Briefcase,
  Copy,
  FileText,
  Link2,
  ListChecks,
  Phone,
  Plus,
  StickyNote,
  Tag,
  Trash2,
  User,
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
  avatarUrl?: string | null;
  lastActivity?: string | null;
  clientId?: string | null;
  onClose?: () => void;
  onClientLinked?: (clientId: string | null) => void;
  onAssign?: (userId: string | null) => void;
  onUpdateTags?: (tags: string[]) => void;
}

interface Note {
  id: string;
  content: string;
  created_at: string;
  author_id: string | null;
}

interface WorkspaceMemberQueryRow {
  user_id: string;
  role: string;
  users: { email: string | null; raw_user_meta_data: { name?: string | null } | null } | null;
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
  assignedTo: initialAssignedTo,
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
  const [members, setMembers] = useState<{ id: string; name: string | null; email: string | null }[]>([]);
  const [assigned, setAssigned] = useState<string | null>(initialAssignedTo ?? null);

  // Load workspace members for assignment
  useEffect(() => {
    if (!workspaceId) return;
    let active = true;
    supabase
      .from("workspace_members")
      .select("user_id, role, users:user_id(email, raw_user_meta_data)")
      .eq("workspace_id", workspaceId)
      .then(({ data }) => {
        if (!active || !data) return;
        const list = (data as unknown as WorkspaceMemberQueryRow[]).map((d) => ({
          id: d.user_id as string,
          name: (d.users?.raw_user_meta_data?.name ?? d.users?.email ?? "") as string | null,
          email: (d.users?.email ?? "") as string | null,
        }));
        setMembers(list);
      });
    return () => { active = false; };
  }, [workspaceId]);

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
    if (clientId || !workspaceId || !contactPhone) {
      if (!clientId) setClient(null);
      return;
    }
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
      setQuotes([]);
      setProjects([]);
      setFinance([]);
      return;
    }
    let active = true;
    (async () => {
      const [c, q, p, f] = await Promise.all([
        supabase.from("clients").select("id, name, email, phone, whatsapp, company").eq("id", clientId).maybeSingle(),
        supabase.from("quotes").select("id, title, total, status, created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(5),
        supabase.from("projects").select("id, title, status").eq("workspace_id", workspaceId).eq("client_id", clientId).order("created_at", { ascending: false }).limit(5),
        supabase.from("financial_transactions").select("id, title, amount, status, due_date").eq("workspace_id", workspaceId).eq("client_id", clientId).neq("status", "paid").order("due_date", { ascending: true }).limit(5),
      ]);
      if (!active) return;
      if (c.data) setClient(c.data as ClientLite);
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

  const linkedClient = clientId ? client : null;

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
        </div>

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
              panelTags.map((t) => (
                <Badge key={t} variant="outline" className="text-[10px] h-5 border-border/60 cursor-pointer hover:border-destructive hover:text-destructive"
                  onClick={() => {
                    const next = panelTags.filter((x) => x !== t);
                    setPanelTags(next);
                    onUpdateTags?.(next);
                  }}
                >
                  {t} ×
                </Badge>
              ))
            ) : (
              <span className="text-[11px] text-muted-foreground italic">Sem tags</span>
            )}
          </div>
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
        </Section>

        {/* Orçamentos */}
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
