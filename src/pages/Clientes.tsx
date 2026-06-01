import { PageHeader } from "@/components/layout/PageHeader";
import { useState, useEffect, useMemo } from "react";
import { usePlan } from "@/contexts/PlanContext";
import { UsageBadge } from "@/components/plan/UsageBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  useClients, type Client, type ClientStatus, type ClientTemperature,
} from "@/hooks/useClients";
import { useClientsDataSource } from "@/hooks/useClientsDataSource";
import { useSupabaseClients } from "@/hooks/useSupabaseClients";
import { useTranslation } from "@/contexts/LanguageContext";
import {
  Users, UserCheck, UserPlus, Search, SlidersHorizontal,
  Plus, ArrowUpDown, LayoutGrid, LayoutList, Phone, Mail, Globe,
  MessageCircle, Calendar, Clock, MoreHorizontal, AtSign,
  Briefcase, CheckSquare, StickyNote, DollarSign, AlertCircle, Share2, Database,
  Edit2, Archive, Trash2, Copy, ChevronDown, Flame, Snowflake, Sparkles, RefreshCw,
  Target, ArchiveRestore,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SignupLinkDrawer } from "@/components/clientes/SignupLinkDrawer";
import { SignupRequestsPanel } from "@/components/clientes/SignupRequestsPanel";
import { useSignupRequests, type SignupRequest } from "@/hooks/useSignupRequests";
import { useLeads } from "@/hooks/useLeads";

import { useClientTypes } from "@/hooks/useClientTypes";
import { NewClientTypeDialog } from "@/components/clientes/NewClientTypeDialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageToolbar } from "@/components/layout/PageToolbar";
import { ClientProfileDrawer } from "@/components/clients/ClientProfileDrawer";
import { cn } from "@/lib/utils";
import { useNavigate, useSearchParams } from "react-router-dom";

// ---------- Static configs ----------

const NEW_TYPE_VALUE = "__new_type__";
const statuses: ClientStatus[] = ["Ativo", "Em negociação", "Potencial", "Inativo", "Arquivado"];
const origins = ["Manual", "Indicação", "Formulário", "Instagram", "WhatsApp", "LinkedIn", "Site", "Tráfego pago", "Outro"];
const temperatures: ClientTemperature[] = ["Frio", "Morno", "Quente"];

const statusBadge: Record<ClientStatus, string> = {
  "Ativo": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Em negociação": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "Potencial": "bg-sky-500/10 text-sky-400 border-sky-500/20",
  "Inativo": "bg-muted text-muted-foreground border-border",
  "Arquivado": "bg-muted/40 text-muted-foreground/70 border-border",
};

const tempConfig: Record<ClientTemperature, { icon: typeof Flame; cls: string; label: string }> = {
  Frio: { icon: Snowflake, cls: "text-sky-400/80", label: "Frio" },
  Morno: { icon: Sparkles, cls: "text-amber-400/80", label: "Morno" },
  Quente: { icon: Flame, cls: "text-primary", label: "Quente" },
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });

const fmtDate = (iso?: string) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
};

const onlyDigits = (s: string) => s.replace(/\D+/g, "");

// ---------- KPI Card ----------
const KpiCard = ({
  icon: Icon, label, value, hint, tone = "neutral",
}: {
  icon: any; label: string; value: string | number; hint?: string;
  tone?: "neutral" | "primary" | "warning" | "success";
}) => {
  const toneCls: Record<string, string> = {
    neutral: "text-muted-foreground bg-muted/40",
    primary: "text-white bg-primary/25 border border-primary/30",
    warning: "text-amber-400 bg-amber-500/10",
    success: "text-emerald-400 bg-emerald-500/10",
  };
  return (
    <div className="orbit-card p-4 flex items-start gap-3 hover:border-border transition-colors">
      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", toneCls[tone])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80">{label}</p>
        <p className="text-xl font-semibold text-foreground leading-tight mt-0.5 truncate">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">{hint}</p>}
      </div>
    </div>
  );
};

// ---------- Temperature pill ----------
const TempPill = ({ t }: { t?: ClientTemperature }) => {
  if (!t) return <span className="text-xs text-muted-foreground/50">—</span>;
  const { icon: Icon, cls, label } = tempConfig[t];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", cls)}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
};

// ---------- Main Component ----------
const Clientes = () => {
  const { t } = useTranslation();
  const { addClient: localAdd, updateClient: localUpdate, archiveClient: localArchive, restoreClient: localRestore, deleteClient: localDelete } = useClients();
  const { addClient: supabaseAdd, updateClient: supabaseUpdate, archiveClient: supabaseArchive, deleteClient: supabaseDelete } = useSupabaseClients();
  const { source, setSource, clients, loading, error, isSupabaseAvailable } = useClientsDataSource();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeTypes } = useClientTypes();

  const addClient = async (data: any) => {
    if (source === "supabase") {
      try {
        await supabaseAdd({
          name: data.name,
          company: data.company || "",
          email: data.email || "",
          phone: data.phone || "",
          whatsapp: data.whatsapp || "",
          instagram: data.instagram || "",
          website: data.site || "",
          type: data.serviceType || "",
          source: data.origin || "",
          status: data.status || "Ativo",
          potential_value: data.potentialValue || 0,
          notes: data.observations || "",
          tags: data.tags || [],
          temperature: data.temperature || "Morno",
          next_action: data.nextAction || "",
          next_action_date: data.nextActionDate || "",
          city: data.city || "",
          state: data.state || "",
          address: data.address || "",
          document: data.document || "",
        });
        toast.success("Cliente criado no Supabase.");
      } catch (err) {
        toast.error("Erro ao criar cliente no Supabase.");
      }
    } else {
      localAdd(data);
      toast.success("Cliente cadastrado localmente.");
    }
  };

  const updateClient = async (id: number, data: Partial<Client>) => {
    if (source === "supabase") {
      try {
        const patch: any = {};
        if (data.name !== undefined) patch.name = data.name;
        if (data.company !== undefined) patch.company = data.company;
        if (data.email !== undefined) patch.email = data.email;
        if (data.phone !== undefined) patch.phone = data.phone;
        if (data.whatsapp !== undefined) patch.whatsapp = data.whatsapp;
        if (data.instagram !== undefined) patch.instagram = data.instagram;
        if (data.site !== undefined) patch.website = data.site;
        if (data.serviceType !== undefined) patch.type = data.serviceType;
        if (data.origin !== undefined) patch.source = data.origin;
        if (data.status !== undefined) patch.status = data.status;
        if (data.potentialValue !== undefined) patch.potential_value = data.potentialValue;
        if (data.observations !== undefined) patch.notes = data.observations;
        if (data.tags !== undefined) patch.tags = data.tags;
        if (data.temperature !== undefined) patch.temperature = data.temperature;
        if (data.nextAction !== undefined) patch.next_action = data.nextAction;
        if (data.nextActionDate !== undefined) patch.next_action_date = data.nextActionDate;
        if (data.city !== undefined) patch.city = data.city;
        if (data.state !== undefined) patch.state = data.state;
        if (data.address !== undefined) patch.address = data.address;
        if (data.document !== undefined) patch.document = data.document;

        await supabaseUpdate(id.toString(), patch);
        toast.success("Cliente atualizado no Supabase.");
      } catch (err) {
        toast.error("Erro ao atualizar cliente no Supabase.");
      }
    } else {
      localUpdate(id, data);
      toast.success("Cliente atualizado localmente.");
    }
  };

  const archiveClient = async (id: number) => {
    if (source === "supabase") {
      try {
        await supabaseArchive(id.toString(), true);
        toast.success("Cliente arquivado no Supabase.");
      } catch (err) {
        toast.error("Erro ao arquivar cliente no Supabase.");
      }
    } else {
      localArchive(id);
      toast.success("Cliente arquivado localmente.");
    }
  };

  const restoreClient = async (id: number) => {
    if (source === "supabase") {
      try {
        await supabaseArchive(id.toString(), false);
        toast.success("Cliente restaurado no Supabase.");
      } catch (err) {
        toast.error("Erro ao restaurar cliente no Supabase.");
      }
    } else {
      localRestore(id);
      toast.success("Cliente restaurado localmente.");
    }
  };

  const deleteClient = async (id: number) => {
    if (source === "supabase") {
      try {
        await supabaseDelete(id.toString());
        toast.success("Cliente excluído do Supabase.");
      } catch (err) {
        toast.error("Erro ao excluir cliente do Supabase.");
      }
    } else {
      localDelete(id);
      toast.success("Cliente excluído localmente.");
    }
  };

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterTemp, setFilterTemp] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [sortAsc, setSortAsc] = useState(true);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  const [newClientOpen, setNewClientOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [signupLinkOpen, setSignupLinkOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [newTypeOpen, setNewTypeOpen] = useState(false);

  // Deep linking via ?client=<id>&tab=activities&activity=<id>
  const queryClientId = searchParams.get("client");
  const queryTab = searchParams.get("tab") ?? undefined;
  const queryActivity = searchParams.get("activity") ?? undefined;

  useEffect(() => {
    if (!queryClientId) return;
    const idNum = Number(queryClientId);
    if (!Number.isFinite(idNum)) return;
    const found = clients.find((c) => c.id === idNum);
    if (found && (!selectedClient || selectedClient.id !== found.id)) {
      setSelectedClient(found);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClientId, clients]);

  const clearDeepLinkParams = () => {
    const next = new URLSearchParams(searchParams);
    let changed = false;
    ["client", "tab", "activity"].forEach((k) => {
      if (next.has(k)) { next.delete(k); changed = true; }
    });
    if (changed) setSearchParams(next, { replace: true });
  };

  const closeDrawer = () => {
    setSelectedClient(null);
    clearDeepLinkParams();
  };

  const { addLead } = useLeads();


  const { wouldExceed, showPaywall, setUsage } = usePlan();
  const { pendingCount } = useSignupRequests();

  const realClientsCount = clients.filter((c) => !c.isDemo && !c.archived).length;
  useEffect(() => { setUsage("clients", realClientsCount); }, [realClientsCount, setUsage]);

  const handleNewClient = () => {
    if (wouldExceed("maxClients", realClientsCount)) {
      showPaywall("clients");
      return;
    }
    setNewClientOpen(true);
  };

  // Filtering & sorting
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clients
      .filter((c) => {
        if (!showArchived && c.archived) return false;
        if (showArchived && !c.archived) return false;
        const matchSearch = !q
          || c.name.toLowerCase().includes(q)
          || c.email.toLowerCase().includes(q)
          || c.company.toLowerCase().includes(q)
          || c.phone.toLowerCase().includes(q);
        const matchStatus = filterStatus === "all" || c.status === filterStatus;
        const matchType = filterType === "all" || c.serviceType === filterType;
        const matchTemp = filterTemp === "all" || c.temperature === filterTemp;
        return matchSearch && matchStatus && matchType && matchTemp;
      })
      .sort((a, b) => sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
  }, [clients, search, filterStatus, filterType, filterTemp, sortAsc, showArchived]);

  // KPIs
  const visible = clients.filter((c) => !c.archived);
  const totalCount = visible.length;
  const activeCount = visible.filter((c) => c.status === "Ativo").length;
  const leadCount = visible.filter((c) => c.status === "Potencial" || c.status === "Em negociação").length;
  const potentialValue = visible.reduce((s, c) => s + (c.potentialValue || 0), 0);
  const noNextActionCount = visible.filter((c) => !c.nextAction || !c.nextAction.trim()).length;

  const handleOpenWhatsApp = (c: Client) => {
    const num = onlyDigits(c.whatsapp || c.phone);
    if (!num) return toast.error("Cliente sem telefone/WhatsApp");
    window.open(`https://wa.me/55${num}`, "_blank", "noopener");
  };

  const handleCopyContact = async (c: Client) => {
    const parts = [c.name, c.company, c.email, c.phone].filter(Boolean).join(" · ");
    try {
      await navigator.clipboard.writeText(parts);
      toast.success("Contato copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleArchive = (c: Client) => {
    archiveClient(c.id);
    toast.success(`${c.name} arquivado`);
  };

  const handleRestore = (c: Client) => {
    restoreClient(c.id);
    toast.success(`${c.name} restaurado`);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteClient(deleteTarget.id);
    toast.success(`${deleteTarget.name} excluído`);
    setDeleteTarget(null);
  };

  // --- Signup request handlers ---
  const approveAsClient = (req: SignupRequest) => {
    if (wouldExceed("maxClients", realClientsCount)) {
      showPaywall("clients");
      return;
    }
    addClient({
      name: req.name,
      company: req.company || "",
      email: req.email || "",
      phone: req.phone || "",
      whatsapp: req.phone || "",
      instagram: "",
      site: "",
      serviceType: req.project_interest || "—",
      origin: "Formulário",
      status: "Potencial",
      potentialValue: 0,
      observations: req.message || "",
    } as any);
  };

  const convertRequestToLead = (req: SignupRequest) => {
    addLead({
      name: req.name,
      company: req.company || "",
      email: req.email || "",
      phone: req.phone || "",
      serviceType: req.project_interest || "—",
      origin: "Formulário",
      source: "Link de cadastro",
      estimatedValue: 0,
      priority: "média",
      stage: "lead",
      tags: [],
      nextAction: "Entrar em contato",
      description: req.message || "",
    } as any);
  };

  const noClients = clients.length === 0;


  return (
    <div className="space-y-6">
      <PageHeader
        title={t("clients.title", "Clientes")}
        subtitle={t("clients.subtitle", "Gerencie sua base de clientes, contatos e oportunidades comerciais.")}
        actions={
          <>
            <UsageBadge resource="clients" label="clientes" />
            <Button
              variant="outline"
              onClick={() => setSignupLinkOpen(true)}
              className="gap-2 relative"
            >
              <Share2 className="h-4 w-4" /> {t("clients.linkCadastro", "Link de cadastro")}
              {pendingCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </Button>
            <Button onClick={handleNewClient} className="orbit-gradient text-white border-0 gap-2 shrink-0">
              <Plus className="h-4 w-4" /> {t("clients.newClient", "Novo cliente")}
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard icon={Users} label={t("clients.total", "Total")} value={totalCount} />
        <KpiCard icon={UserCheck} label={t("clients.active", "Ativos")} value={activeCount} tone="success" />
        <KpiCard icon={UserPlus} label={t("clients.leads", "Leads / Prospects")} value={leadCount} tone="primary" />
        <KpiCard icon={DollarSign} label={t("clients.potentialValue", "Valor potencial")} value={fmtBRL(potentialValue)} hint="Soma da base" />
        <KpiCard
          icon={AlertCircle}
          label={t("clients.nextStepNeeded", "Precisam de próximo passo")}
          value={noNextActionCount}
          tone={noNextActionCount > 0 ? "warning" : "neutral"}
          hint={noNextActionCount > 0 ? "Defina follow-ups para manter o relacionamento ativo" : "Tudo em dia"}
        />
      </div>

      {/* Toolbar */}
      <PageToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t("clients.searchPlaceholder", "Buscar por nome, empresa, e-mail ou telefone...")}
        filters={
          <>


            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px] bg-muted/40 border-border/60">
                <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select
              value={filterType}
              onValueChange={(v) => {
                if (v === NEW_TYPE_VALUE) { setNewTypeOpen(true); return; }
                setFilterType(v);
              }}
            >
              <SelectTrigger className="w-[160px] bg-muted/40 border-border/60">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent className="max-h-[280px]">
                <SelectItem value="all">Todos os tipos</SelectItem>
                {activeTypes.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                <div className="my-1 h-px bg-border" />
                <SelectItem value={NEW_TYPE_VALUE} className="text-primary">+ Novo tipo</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterTemp} onValueChange={setFilterTemp}>
              <SelectTrigger className="w-[140px] bg-muted/40 border-border/60">
                <SelectValue placeholder="Temperatura" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {temperatures.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        }
        actions={
          <>
            <Button
              variant={showArchived ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowArchived((v) => !v)}
              className="h-9 gap-1.5"
              title="Mostrar arquivados"
            >
              <Archive className="h-3.5 w-3.5" />
              {showArchived ? "Arquivados" : "Ativos"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSortAsc(!sortAsc)}
              className="border-border/60 h-9 w-9"
              title={sortAsc ? "Ordem A→Z" : "Ordem Z→A"}
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </>
        }
        viewToggle={
          <>
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="icon"
              className="rounded-none h-9 w-9"
              onClick={() => setViewMode("table")}
              title="Tabela"
            >
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="rounded-none h-9 w-9"
              onClick={() => setViewMode("grid")}
              title="Cards"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </>
        }
      />

      {/* Client listing */}
      {noClients ? (
        <EmptyState
          icon={Users}
          title="Comece pela sua base de clientes"
          description="Cadastre seus clientes ou compartilhe um link de cadastro para centralizar contatos, oportunidades e próximos passos."
          primaryAction={{ label: "Novo cliente", onClick: handleNewClient }}
          secondaryAction={{ label: "Compartilhar link de cadastro", onClick: () => setSignupLinkOpen(true), variant: "outline" }}
        />
      ) : loading ? (
        <div className="py-12 flex items-center justify-center text-xs text-muted-foreground gap-2">
          <RefreshCw className="h-5 w-5 animate-spin text-primary" />
          Carregando clientes do Supabase...
        </div>
      ) : viewMode === "table" ? (
        <div className="orbit-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Temperatura</TableHead>
                <TableHead className="text-right">Valor potencial</TableHead>
                <TableHead>Próxima ação</TableHead>
                <TableHead>Última interação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow
                  key={c.id}
                  className="border-border hover:bg-muted/40 cursor-pointer"
                  onClick={() => setSelectedClient(c)}
                >
                  <TableCell>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.company || "—"}{c.city ? ` · ${c.city}${c.state ? `/${c.state}` : ""}` : ""}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.serviceType || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusBadge[c.status]}>{c.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {c.temperature ? (
                      <TempPill t={c.temperature} />
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground/60 border-border/60">Não definido</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums">
                    {c.potentialValue ? fmtBRL(c.potentialValue) : <span className="text-muted-foreground/50">—</span>}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    {c.nextAction ? (
                      <div className="min-w-0">
                        <p className="text-sm text-foreground truncate">{c.nextAction}</p>
                        {c.nextActionDate && (
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />{fmtDate(c.nextActionDate)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/80 inline-flex items-center gap-1">
                        <Target className="h-3 w-3" /> Definir follow-up
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />{c.lastInteraction}
                    </span>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <ClientRowMenu
                      c={c}
                      onView={() => setSelectedClient(c)}
                      onEdit={() => setEditClient(c)}
                      onWhats={() => handleOpenWhatsApp(c)}
                      onCopy={() => handleCopyContact(c)}
                      onArchive={() => handleArchive(c)}
                      onRestore={() => handleRestore(c)}
                      onDelete={() => setDeleteTarget(c)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length === 0 && (
            <div className="py-14 text-center text-muted-foreground text-sm">
              Nenhum cliente encontrado com esses filtros.
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="orbit-card p-4 space-y-3 cursor-pointer hover:border-border transition-colors"
              onClick={() => setSelectedClient(c)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.company || "—"}</p>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <ClientRowMenu
                    c={c}
                    onView={() => setSelectedClient(c)}
                    onEdit={() => setEditClient(c)}
                    onWhats={() => handleOpenWhatsApp(c)}
                    onCopy={() => handleCopyContact(c)}
                    onArchive={() => handleArchive(c)}
                    onRestore={() => handleRestore(c)}
                    onDelete={() => setDeleteTarget(c)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={statusBadge[c.status]}>{c.status}</Badge>
                {c.serviceType && c.serviceType !== "—" && (
                  <span className="text-[11px] text-muted-foreground">{c.serviceType}</span>
                )}
                <TempPill t={c.temperature} />
              </div>

              <Separator className="bg-border/60" />

              <div className="flex items-center justify-between text-sm">
                <span className="text-xs text-muted-foreground">Valor potencial</span>
                <span className="font-medium tabular-nums">
                  {c.potentialValue ? fmtBRL(c.potentialValue) : "—"}
                </span>
              </div>

              <div className="rounded-md bg-muted/30 border border-border/60 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80">Próxima ação</p>
                {c.nextAction ? (
                  <p className="text-sm text-foreground mt-0.5 line-clamp-2">{c.nextAction}</p>
                ) : (
                  <p className="text-xs text-muted-foreground/80 mt-0.5 flex items-center gap-1">
                    <Target className="h-3 w-3" /> Adicionar próximo passo
                  </p>
                )}
                {c.nextActionDate && (
                  <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />{fmtDate(c.nextActionDate)}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />{c.lastInteraction}
                </span>
                {(c.whatsapp || c.phone) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpenWhatsApp(c); }}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    <MessageCircle className="h-3 w-3" /> WhatsApp
                  </button>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-14 text-center text-muted-foreground text-sm">
              Nenhum cliente encontrado com esses filtros.
            </div>
          )}
        </div>
      )}

      {/* Public signup requests — opened from drawer or pending badge */}
      <Sheet open={requestsOpen} onOpenChange={setRequestsOpen}>
        <SheetContent className="bg-background border-border w-full sm:max-w-3xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Solicitações recebidas</SheetTitle>
            <SheetDescription>
              Aprove como cliente, converta em lead/oportunidade ou arquive os cadastros enviados pelo seu link público.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-5">
            <SignupRequestsPanel
              onApproveAsClient={approveAsClient}
              onConvertLead={convertRequestToLead}
            />
          </div>
        </SheetContent>
      </Sheet>


      {/* New / Edit Client Dialog */}
      <ClientFormDialog
        open={newClientOpen}
        onOpenChange={setNewClientOpen}
        onSave={(data) => addClient(data)}
      />
      <ClientFormDialog
        open={!!editClient}
        onOpenChange={(v) => !v && setEditClient(null)}
        initial={editClient ?? undefined}
        onSave={(data) => {
          if (editClient) updateClient(editClient.id, data as Partial<Client>);
        }}
      />

      <NewClientTypeDialog open={newTypeOpen} onOpenChange={setNewTypeOpen} onCreated={(name) => setFilterType(name)} />

      <SignupLinkDrawer
        open={signupLinkOpen}
        onOpenChange={setSignupLinkOpen}
        pendingCount={pendingCount}
        onOpenRequests={() => setRequestsOpen(true)}
      />


      <ClientProfileDrawer
        client={selectedClient}
        initialTab={queryTab}
        highlightedActivityId={queryActivity}
        onClose={closeDrawer}
        onEdit={(c) => { closeDrawer(); setEditClient(c); }}
        onWhats={handleOpenWhatsApp}
        onArchive={handleArchive}
        onRestore={handleRestore}
        onCreateOpportunity={(c) => {
          closeDrawer();
          navigate(`/crm?newOpportunity=1&clientId=${c.id}`);
        }}
        onCreateQuote={(c) => {
          closeDrawer();
          navigate(`/vendas?tab=orcamentos&newQuote=1&clientId=${c.id}`);
        }}
        onUpdateAssets={(id, assets) => {
          updateClient(id, { assets });
          setSelectedClient((prev) => (prev && prev.id === id ? { ...prev, assets } : prev));
        }}
        onUpdateTechnicalSheet={(id, technicalSheet) => {
          updateClient(id, { technicalSheet });
          setSelectedClient((prev) => (prev && prev.id === id ? { ...prev, technicalSheet } : prev));
        }}
        onUpdateContacts={(id, contacts) => {
          updateClient(id, { contacts });
          setSelectedClient((prev) => (prev && prev.id === id ? { ...prev, contacts } : prev));
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente. {deleteTarget?.name} e seus dados locais serão removidos.
              Para preservar histórico, considere arquivar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ---------- Row menu ----------
const ClientRowMenu = ({
  c, onView, onEdit, onWhats, onCopy, onArchive, onRestore, onDelete,
}: {
  c: Client;
  onView: () => void; onEdit: () => void; onWhats: () => void; onCopy: () => void;
  onArchive: () => void; onRestore: () => void; onDelete: () => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="h-8 w-8">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-52">
      <DropdownMenuItem onClick={onView}>
        <Users className="h-3.5 w-3.5 mr-2" /> Ver detalhes
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onEdit}>
        <Edit2 className="h-3.5 w-3.5 mr-2" /> Editar
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onWhats} disabled={!c.whatsapp && !c.phone}>
        <MessageCircle className="h-3.5 w-3.5 mr-2" /> Abrir WhatsApp
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onCopy}>
        <Copy className="h-3.5 w-3.5 mr-2" /> Copiar contato
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => toast("Criar oportunidade chega em breve no CRM.")}>
        <Target className="h-3.5 w-3.5 mr-2" /> Criar oportunidade
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      {c.archived ? (
        <DropdownMenuItem onClick={onRestore}>
          <ArchiveRestore className="h-3.5 w-3.5 mr-2" /> Restaurar
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem onClick={onArchive}>
          <Archive className="h-3.5 w-3.5 mr-2" /> Arquivar
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
        <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

// ---------- Client Form Dialog (create/edit) ----------
type FormState = {
  name: string; company: string; email: string; phone: string; whatsapp: string;
  instagram: string; site: string; serviceType: string; origin: string;
  status: ClientStatus; temperature: ClientTemperature | "";
  potentialValue: string; nextAction: string; nextActionDate: string;
  city: string; state: string; observations: string;
};

const emptyForm: FormState = {
  name: "", company: "", email: "", phone: "", whatsapp: "",
  instagram: "", site: "", serviceType: "", origin: "",
  status: "Potencial", temperature: "",
  potentialValue: "", nextAction: "", nextActionDate: "",
  city: "", state: "", observations: "",
};

const ClientFormDialog = ({
  open, onOpenChange, initial, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Client;
  onSave: (data: any) => void;
}) => {
  const { activeTypes } = useClientTypes();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [commercialOpen, setCommercialOpen] = useState(true);
  const isEdit = !!initial;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        name: initial.name || "",
        company: initial.company || "",
        email: initial.email || "",
        phone: initial.phone || "",
        whatsapp: initial.whatsapp || "",
        instagram: initial.instagram || "",
        site: initial.site || "",
        serviceType: initial.serviceType || "",
        origin: initial.origin || "",
        status: initial.status || "Potencial",
        temperature: initial.temperature || "",
        potentialValue: initial.potentialValue ? String(initial.potentialValue) : "",
        nextAction: initial.nextAction || "",
        nextActionDate: initial.nextActionDate || "",
        city: initial.city || "",
        state: initial.state || "",
        observations: initial.observations || "",
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, initial]);

  const handleSave = () => {
    if (!form.name.trim()) return toast.error("Informe o nome do cliente");
    if (!form.email.trim() && !form.whatsapp.trim() && !form.phone.trim()) {
      return toast.error("Informe pelo menos um contato (email, telefone ou WhatsApp)");
    }
    const payload = {
      name: form.name.trim(),
      company: form.company.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      whatsapp: form.whatsapp.trim(),
      instagram: form.instagram.trim(),
      site: form.site.trim(),
      serviceType: form.serviceType || "—",
      origin: form.origin || undefined,
      status: form.status,
      temperature: (form.temperature || undefined) as ClientTemperature | undefined,
      potentialValue: Number(form.potentialValue) || 0,
      nextAction: form.nextAction.trim() || undefined,
      nextActionDate: form.nextActionDate || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      observations: form.observations.trim(),
    };
    onSave(payload);
    toast.success(isEdit ? "Cliente atualizado" : "Cliente adicionado");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize os dados deste cliente."
              : "Cadastre um novo cliente. Você pode completar os dados comerciais depois."}
          </DialogDescription>
        </DialogHeader>

        {/* Block 1: Dados principais */}
        <FormBlock title="Dados principais">
          <FormGrid>
            <FormField label="Nome*" placeholder="João Silva" value={form.name} onChange={(v) => set("name", v)} />
            <FormField label="Empresa" placeholder="Empresa Ltda" value={form.company} onChange={(v) => set("company", v)} />
            <FormField label="Email" type="email" placeholder="email@empresa.com" value={form.email} onChange={(v) => set("email", v)} />
            <FormField label="Telefone" placeholder="(11) 99999-9999" value={form.phone} onChange={(v) => set("phone", v)} />
            <FormField label="WhatsApp" placeholder="(11) 99999-9999" icon={<MessageCircle className="h-4 w-4" />} value={form.whatsapp} onChange={(v) => set("whatsapp", v)} />
            <FormField label="Instagram" placeholder="@usuario" icon={<AtSign className="h-4 w-4" />} value={form.instagram} onChange={(v) => set("instagram", v)} />
            <FormField label="Cidade" placeholder="São Paulo" value={form.city} onChange={(v) => set("city", v)} />
            <FormField label="Estado (UF)" placeholder="SP" value={form.state} onChange={(v) => set("state", v.toUpperCase().slice(0, 2))} />
          </FormGrid>
        </FormBlock>

        {/* Block 2: Dados comerciais (collapsible) */}
        <Collapsible open={commercialOpen} onOpenChange={setCommercialOpen} className="border-t border-border/60 pt-4 mt-2">
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center justify-between text-left group">
              <div>
                <p className="text-sm font-semibold text-foreground">Informações comerciais</p>
                <p className="text-xs text-muted-foreground">Tipo, status, origem, temperatura, valor e próxima ação</p>
              </div>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", commercialOpen && "rotate-180")} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <FormGrid>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Tipo / segmento</Label>
                <Select
                  value={form.serviceType}
                  onValueChange={(v) => {
                    if (v === NEW_TYPE_VALUE) { setTypeDialogOpen(true); return; }
                    set("serviceType", v);
                  }}
                >
                  <SelectTrigger className="bg-muted/50 border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="max-h-[280px]">
                    {activeTypes.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                    <div className="my-1 h-px bg-border" />
                    <SelectItem value={NEW_TYPE_VALUE} className="text-primary">+ Novo tipo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Status</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v as ClientStatus)}>
                  <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statuses.filter((s) => s !== "Arquivado").map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Origem</Label>
                <Select value={form.origin} onValueChange={(v) => set("origin", v)}>
                  <SelectTrigger className="bg-muted/50 border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {origins.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Temperatura</Label>
                <Select value={form.temperature} onValueChange={(v) => set("temperature", v as ClientTemperature)}>
                  <SelectTrigger className="bg-muted/50 border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {temperatures.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <FormField
                label="Valor potencial (R$)"
                type="number"
                placeholder="5000"
                value={form.potentialValue}
                onChange={(v) => set("potentialValue", v)}
              />
              <FormField
                label="Data da próxima ação"
                type="date"
                value={form.nextActionDate}
                onChange={(v) => set("nextActionDate", v)}
              />
              <div className="sm:col-span-2 space-y-2">
                <Label className="text-sm text-muted-foreground">Próxima ação</Label>
                <Input
                  placeholder="Ex.: Enviar proposta de retainer"
                  value={form.nextAction}
                  onChange={(e) => set("nextAction", e.target.value)}
                  className="bg-muted/50 border-border"
                />
              </div>
            </FormGrid>
          </CollapsibleContent>
        </Collapsible>

        {/* Block 3: Observações */}
        <FormBlock title="Observações">
          <Textarea
            placeholder="Notas, contexto, preferências de contato..."
            className="bg-muted/50 border-border min-h-[80px]"
            value={form.observations}
            onChange={(e) => set("observations", e.target.value)}
          />
        </FormBlock>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="orbit-gradient text-white border-0" onClick={handleSave}>
            {isEdit ? "Salvar alterações" : "Salvar cliente"}
          </Button>
        </DialogFooter>

        <NewClientTypeDialog
          open={typeDialogOpen}
          onOpenChange={setTypeDialogOpen}
          onCreated={(name) => set("serviceType", name)}
        />
      </DialogContent>
    </Dialog>
  );
};

const FormBlock = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-3 pt-2">
    <p className="text-sm font-semibold text-foreground">{title}</p>
    {children}
  </div>
);

const FormGrid = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
);

const FormField = ({
  label, placeholder, type = "text", icon, value, onChange,
}: {
  label: string; placeholder?: string; type?: string; icon?: React.ReactNode;
  value?: string; onChange?: (v: string) => void;
}) => (
  <div className="space-y-2">
    <Label className="text-sm text-muted-foreground">{label}</Label>
    <div className="relative">
      {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>}
      <Input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className={cn("bg-muted/50 border-border h-10", icon && "pl-9")}
      />
    </div>
  </div>
);


export default Clientes;
