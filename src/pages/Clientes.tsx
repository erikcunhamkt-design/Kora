import { PageHeader } from "@/components/layout/PageHeader";
import { useState, useEffect } from "react";
import { usePlan } from "@/contexts/PlanContext";
import { UsageBadge } from "@/components/plan/UsageBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useClients, type Client, type ClientStatus } from "@/hooks/useClients";
import {
  Users, UserCheck, UserPlus, FolderKanban, Search, SlidersHorizontal,
  Plus, ArrowUpDown, LayoutGrid, LayoutList, Phone, Mail, Globe,
  MessageCircle, ExternalLink, Calendar, Clock, MoreHorizontal, AtSign,
  Briefcase, FileText, CheckSquare, StickyNote, DollarSign, AlertCircle, Share2
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { SignupLinkDrawer } from "@/components/clientes/SignupLinkDrawer";
import { SignupRequestsPanel } from "@/components/clientes/SignupRequestsPanel";
import { useSignupRequests } from "@/hooks/useSignupRequests";

// ---------- Static configs ----------

const statusStyles: Record<string, string> = {
  "Ativo": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Em negociação": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "Inativo": "bg-red-500/10 text-red-400 border-red-500/20",
  "Potencial": "bg-primary/10 text-primary border-primary/20",
};

const serviceTypes = ["Branding", "Social Media", "Web Design", "Design Gráfico"];
const statuses = ["Ativo", "Em negociação", "Inativo", "Potencial"];

// ---------- Summary Card ----------
const SummaryCard = ({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string | number; accent?: string }) => (
  <div className="orbit-card p-5 flex items-center gap-4">
    <div className={`h-11 w-11 rounded-lg flex items-center justify-center ${accent || "bg-primary/10"}`}>
      <Icon className={`h-5 w-5 ${accent ? "text-white" : "text-primary"}`} />
    </div>
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  </div>
);

// ---------- Main Component ----------
const Clientes = () => {
  const { clients, addClient } = useClients();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [sortAsc, setSortAsc] = useState(true);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [signupLinkOpen, setSignupLinkOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const { wouldExceed, showPaywall, setUsage } = usePlan();
  const { pendingCount } = useSignupRequests();

  const realClientsCount = clients.filter((c) => !c.isDemo).length;
  useEffect(() => { setUsage("clients", realClientsCount); }, [realClientsCount, setUsage]);

  const handleNewClient = () => {
    if (wouldExceed("maxClients", realClientsCount)) {
      showPaywall("clients");
      return;
    }
    setNewClientOpen(true);
  };

  // Filtering & sorting
  const filtered = clients
    .filter(c => {
      const q = search.toLowerCase();
      const matchSearch = !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.company.toLowerCase().includes(q);
      const matchStatus = filterStatus === "all" || c.status === filterStatus;
      const matchType = filterType === "all" || c.serviceType === filterType;
      return matchSearch && matchStatus && matchType;
    })
    .sort((a, b) => sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));

  const activeCount = clients.filter(c => c.status === "Ativo").length;
  const newThisMonth = 3;
  const ongoingProjects = clients.reduce((sum, c) => sum + c.projects.filter(p => p.status === "Em andamento").length, 0);
  const potentialValue = clients.reduce((s, c) => s + (c.potentialValue || 0), 0);
  const now = Date.now();
  const noFollowUp = clients.filter(c => {
    const parsed = Date.parse(c.lastInteraction);
    if (Number.isNaN(parsed)) return false;
    return (now - parsed) > 1000 * 60 * 60 * 24 * 30; // 30 dias
  }).length;
  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        subtitle="Gerencie seus clientes, contatos e informações importantes em um só lugar"
        actions={
          <>
            <UsageBadge resource="clients" label="clientes" />
            <Button onClick={handleNewClient} className="orbit-gradient text-white border-0 gap-2 shrink-0">
              <Plus className="h-4 w-4" /> Novo cliente
            </Button>
          </>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <SummaryCard icon={Users} label="Total" value={clients.length} />
        <SummaryCard icon={UserCheck} label="Ativos" value={activeCount} accent="bg-emerald-500/15" />
        <SummaryCard icon={UserPlus} label="Novos este mês" value={newThisMonth} accent="bg-secondary/15" />
        <SummaryCard icon={FolderKanban} label="Projetos ativos" value={ongoingProjects} accent="bg-accent/15" />
        <SummaryCard icon={DollarSign} label="Valor potencial" value={fmtBRL(potentialValue)} accent="bg-primary/15" />
        <SummaryCard icon={AlertCircle} label="Sem follow-up" value={noFollowUp} accent="bg-amber-500/15" />
      </div>

      {/* Actions bar */}
      <div className="orbit-card p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou empresa..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-muted/50 border-border"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px] bg-muted/50 border-border">
            <SlidersHorizontal className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[170px] bg-muted/50 border-border">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {serviceTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => setSortAsc(!sortAsc)} className="border-border">
          <ArrowUpDown className="h-4 w-4" />
        </Button>
        <div className="flex border border-border rounded-lg overflow-hidden">
          <Button variant={viewMode === "table" ? "secondary" : "ghost"} size="icon" className="rounded-none h-9 w-9" onClick={() => setViewMode("table")}>
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="icon" className="rounded-none h-9 w-9" onClick={() => setViewMode("grid")}>
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Client listing */}
      {viewMode === "table" ? (
        <div className="orbit-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Nome / Empresa</TableHead>
                <TableHead className="text-muted-foreground">Contato</TableHead>
                <TableHead className="text-muted-foreground">Serviço</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Último projeto</TableHead>
                <TableHead className="text-muted-foreground">Última interação</TableHead>
                <TableHead className="text-muted-foreground text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.id} className="border-border hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedClient(c)}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.company}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{c.serviceType}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusStyles[c.status]}>{c.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">{c.lastProject}</TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{c.lastInteraction}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedClient(c)}>Ver detalhes</DropdownMenuItem>
                        <DropdownMenuItem>Editar</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">Nenhum cliente encontrado.</div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <div key={c.id} className="orbit-card p-5 space-y-3 cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setSelectedClient(c)}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.company}</p>
                </div>
                <Badge variant="outline" className={statusStyles[c.status]}>{c.status}</Badge>
              </div>
              <Separator className="bg-border" />
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <p className="flex items-center gap-2"><Mail className="h-3 w-3" />{c.email}</p>
                <p className="flex items-center gap-2"><Phone className="h-3 w-3" />{c.phone}</p>
                <p className="flex items-center gap-2"><Briefcase className="h-3 w-3" />{c.serviceType}</p>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{c.lastInteraction}</span>
                <span className="truncate max-w-[120px]">{c.lastProject}</span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground text-sm">Nenhum cliente encontrado.</div>
          )}
        </div>
      )}

      {/* New Client Modal */}
      <NewClientDialog open={newClientOpen} onOpenChange={setNewClientOpen} onSave={addClient} />

      {/* Client Detail Sheet */}
      <ClientDetailSheet client={selectedClient} onClose={() => setSelectedClient(null)} />
    </div>
  );
};

// ---------- New Client Dialog ----------
const origins = ["Indicação", "Instagram", "LinkedIn", "Site", "Outro"];

const emptyForm = {
  name: "", company: "", email: "", phone: "", whatsapp: "",
  instagram: "", site: "", serviceType: "", origin: "",
  status: "Potencial" as ClientStatus, potentialValue: "", observations: "",
};

const NewClientDialog = ({
  open, onOpenChange, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (data: Omit<Client, "id" | "projects" | "tasks" | "lastProject" | "lastInteraction">) => void;
}) => {
  const [form, setForm] = useState(emptyForm);
  const set = (k: keyof typeof emptyForm, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  useEffect(() => { if (open) setForm(emptyForm); }, [open]);

  const handleSave = () => {
    if (!form.name.trim()) return toast.error("Informe o nome do cliente");
    if (!form.email.trim() && !form.whatsapp.trim() && !form.phone.trim()) {
      return toast.error("Informe pelo menos um contato (email, telefone ou WhatsApp)");
    }
    onSave({
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
      potentialValue: Number(form.potentialValue) || 0,
      observations: form.observations.trim(),
    });
    toast.success("Cliente adicionado");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Novo cliente</DialogTitle>
          <DialogDescription className="text-muted-foreground">Preencha as informações do novo cliente.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
          <FormField label="Nome completo*" placeholder="João Silva" value={form.name} onChange={v => set("name", v)} />
          <FormField label="Empresa" placeholder="Empresa Ltda" value={form.company} onChange={v => set("company", v)} />
          <FormField label="Email" placeholder="email@empresa.com" type="email" value={form.email} onChange={v => set("email", v)} />
          <FormField label="Telefone" placeholder="(11) 99999-9999" value={form.phone} onChange={v => set("phone", v)} />
          <FormField label="WhatsApp" placeholder="(11) 99999-9999" icon={<MessageCircle className="h-4 w-4" />} value={form.whatsapp} onChange={v => set("whatsapp", v)} />
          <FormField label="Instagram" placeholder="@usuario" icon={<AtSign className="h-4 w-4" />} value={form.instagram} onChange={v => set("instagram", v)} />
          <FormField label="Site" placeholder="www.site.com" icon={<Globe className="h-4 w-4" />} value={form.site} onChange={v => set("site", v)} />
          <FormField label="Valor potencial (R$)" placeholder="5000" type="number" value={form.potentialValue} onChange={v => set("potentialValue", v)} />
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Serviço de interesse</Label>
            <Select value={form.serviceType} onValueChange={v => set("serviceType", v)}>
              <SelectTrigger className="bg-muted/50 border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {serviceTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Origem</Label>
            <Select value={form.origin} onValueChange={v => set("origin", v)}>
              <SelectTrigger className="bg-muted/50 border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {origins.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Status</Label>
            <Select value={form.status} onValueChange={v => set("status", v as ClientStatus)}>
              <SelectTrigger className="bg-muted/50 border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label className="text-sm text-muted-foreground">Observações</Label>
            <Textarea placeholder="Notas sobre o cliente..." className="bg-muted/50 border-border min-h-[80px]" value={form.observations} onChange={e => set("observations", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="orbit-gradient text-white border-0" onClick={handleSave}>Salvar cliente</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const FormField = ({ label, placeholder, type = "text", icon, value, onChange }: { label: string; placeholder: string; type?: string; icon?: React.ReactNode; value?: string; onChange?: (v: string) => void }) => (
  <div className="space-y-2">
    <Label className="text-sm text-muted-foreground">{label}</Label>
    <div className="relative">
      {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>}
      <Input type={type} placeholder={placeholder} value={value} onChange={e => onChange?.(e.target.value)} className={`bg-muted/50 border-border ${icon ? "pl-9" : ""}`} />
    </div>
  </div>
);

// ---------- Client Detail Sheet ----------
const ClientDetailSheet = ({ client, onClose }: { client: Client | null; onClose: () => void }) => {
  if (!client) return null;

  const Section = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Icon className="h-4 w-4 text-primary" />{title}</h3>
      {children}
    </div>
  );

  const InfoRow = ({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) => (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground flex items-center gap-2">{icon}{label}</span>
      <span className="text-foreground font-medium text-right max-w-[200px] truncate">{value}</span>
    </div>
  );

  return (
    <Sheet open={!!client} onOpenChange={v => !v && onClose()}>
      <SheetContent className="bg-card border-border w-full sm:max-w-[480px] overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-foreground text-xl">{client.name}</SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <Badge variant="outline" className={statusStyles[client.status]}>{client.status}</Badge>
            <span className="text-muted-foreground">· {client.company}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 pb-6">
          {/* Contact */}
          <Section title="Contato" icon={Mail}>
            <div className="orbit-card p-4 space-y-2.5">
              <InfoRow label="Email" value={client.email} icon={<Mail className="h-3.5 w-3.5" />} />
              <InfoRow label="Telefone" value={client.phone} icon={<Phone className="h-3.5 w-3.5" />} />
              <InfoRow label="WhatsApp" value={client.whatsapp} icon={<MessageCircle className="h-3.5 w-3.5" />} />
              <InfoRow label="Instagram" value={client.instagram} icon={<AtSign className="h-3.5 w-3.5" />} />
              <InfoRow label="Site" value={client.site} icon={<Globe className="h-3.5 w-3.5" />} />
            </div>
          </Section>

          {/* Info */}
          <Section title="Informações" icon={Briefcase}>
            <div className="orbit-card p-4 space-y-2.5">
              <InfoRow label="Serviço" value={client.serviceType} />
              <InfoRow label="Último projeto" value={client.lastProject} />
              <InfoRow label="Última interação" value={client.lastInteraction} icon={<Calendar className="h-3.5 w-3.5" />} />
            </div>
          </Section>

          {/* Projects */}
          <Section title="Projetos vinculados" icon={FolderKanban}>
            {client.projects.length > 0 ? (
              <div className="space-y-2">
                {client.projects.map((p, i) => (
                  <div key={i} className="orbit-card p-3 flex items-center justify-between">
                    <span className="text-sm text-foreground">{p.name}</span>
                    <Badge variant="outline" className="text-xs bg-muted/50 border-border text-muted-foreground">{p.status}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum projeto vinculado.</p>
            )}
          </Section>

          {/* Tasks */}
          <Section title="Tarefas vinculadas" icon={CheckSquare}>
            {client.tasks.length > 0 ? (
              <div className="space-y-2">
                {client.tasks.map((t, i) => (
                  <div key={i} className="orbit-card p-3 flex items-center gap-3">
                    <div className={`h-4 w-4 rounded border flex items-center justify-center ${t.done ? "bg-emerald-500/20 border-emerald-500/40" : "border-border"}`}>
                      {t.done && <CheckSquare className="h-3 w-3 text-emerald-400" />}
                    </div>
                    <span className={`text-sm ${t.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma tarefa vinculada.</p>
            )}
          </Section>

          {/* Notes */}
          <Section title="Observações" icon={StickyNote}>
            <div className="orbit-card p-4">
              <p className="text-sm text-muted-foreground leading-relaxed">{client.observations}</p>
            </div>
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default Clientes;
