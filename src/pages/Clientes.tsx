import { useState } from "react";
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
import {
  Users, UserCheck, UserPlus, FolderKanban, Search, SlidersHorizontal,
  Plus, ArrowUpDown, LayoutGrid, LayoutList, Phone, Mail, Globe,
  MessageCircle, ExternalLink, Calendar, Clock, MoreHorizontal, AtSign,
  Briefcase, FileText, CheckSquare, StickyNote
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

// ---------- Types ----------
interface Client {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  site: string;
  serviceType: string;
  status: "Ativo" | "Em negociação" | "Inativo" | "Potencial";
  lastProject: string;
  lastInteraction: string;
  observations: string;
  projects: { name: string; status: string }[];
  tasks: { name: string; done: boolean }[];
}

// ---------- Mock Data ----------
const initialClients: Client[] = [
  {
    id: 1, name: "Marina Costa", company: "Acme Corp", email: "marina@acme.com",
    phone: "(11) 99812-3456", whatsapp: "(11) 99812-3456", instagram: "@acmecorp",
    site: "acme.com", serviceType: "Branding", status: "Ativo",
    lastProject: "Rebranding Acme 2025", lastInteraction: "12 Abr 2025",
    observations: "Cliente desde 2023. Prefere reuniões às terças.",
    projects: [{ name: "Rebranding Acme 2025", status: "Em andamento" }, { name: "Website Acme", status: "Concluído" }],
    tasks: [{ name: "Enviar proposta atualizada", done: false }, { name: "Revisão logo final", done: true }],
  },
  {
    id: 2, name: "Rafael Mendes", company: "Studio Zen", email: "rafael@studiozen.com",
    phone: "(21) 98765-4321", whatsapp: "(21) 98765-4321", instagram: "@studiozen",
    site: "studiozen.com", serviceType: "Web Design", status: "Ativo",
    lastProject: "Landing Page Studio Zen", lastInteraction: "10 Abr 2025",
    observations: "Projeto recorrente mensal de social media.",
    projects: [{ name: "Landing Page Studio Zen", status: "Em andamento" }],
    tasks: [{ name: "Wireframe da home", done: false }],
  },
  {
    id: 3, name: "Camila Andrade", company: "Nova Design", email: "camila@novadesign.com",
    phone: "(31) 97654-3210", whatsapp: "(31) 97654-3210", instagram: "@novadesign",
    site: "novadesign.com", serviceType: "Design Gráfico", status: "Em negociação",
    lastProject: "Catálogo Digital Nova", lastInteraction: "08 Abr 2025",
    observations: "Aguardando aprovação de orçamento.",
    projects: [{ name: "Catálogo Digital Nova", status: "Proposta" }],
    tasks: [{ name: "Montar orçamento detalhado", done: false }],
  },
  {
    id: 4, name: "Lucas Ferreira", company: "Tech Solutions", email: "lucas@techsol.com",
    phone: "(41) 96543-2109", whatsapp: "(41) 96543-2109", instagram: "@techsolutions",
    site: "techsol.com", serviceType: "Branding", status: "Potencial",
    lastProject: "—", lastInteraction: "05 Abr 2025",
    observations: "Contato feito via LinkedIn. Interessado em identidade visual.",
    projects: [], tasks: [],
  },
  {
    id: 5, name: "Juliana Rocha", company: "Brand Co", email: "juliana@brandco.com",
    phone: "(51) 95432-1098", whatsapp: "(51) 95432-1098", instagram: "@brandco",
    site: "brandco.com", serviceType: "Social Media", status: "Inativo",
    lastProject: "Social Media Q3 2024", lastInteraction: "15 Jan 2025",
    observations: "Parou de contratar por corte de budget. Recontatar em 6 meses.",
    projects: [{ name: "Social Media Q3 2024", status: "Concluído" }, { name: "Branding Brand Co", status: "Concluído" }],
    tasks: [],
  },
  {
    id: 6, name: "Diego Martins", company: "StartUp X", email: "diego@startupx.io",
    phone: "(11) 94321-0987", whatsapp: "(11) 94321-0987", instagram: "@startupx",
    site: "startupx.io", serviceType: "Web Design", status: "Em negociação",
    lastProject: "—", lastInteraction: "11 Abr 2025",
    observations: "Startup em estágio inicial. Budget limitado.",
    projects: [], tasks: [{ name: "Enviar portfólio", done: true }],
  },
  {
    id: 7, name: "Fernanda Lima", company: "FitTrack", email: "fernanda@fittrack.app",
    phone: "(21) 93210-9876", whatsapp: "(21) 93210-9876", instagram: "@fittrackapp",
    site: "fittrack.app", serviceType: "Design Gráfico", status: "Ativo",
    lastProject: "App UI FitTrack", lastInteraction: "13 Abr 2025",
    observations: "Contrato mensal de design de interfaces.",
    projects: [{ name: "App UI FitTrack", status: "Em andamento" }],
    tasks: [{ name: "Entregar telas do onboarding", done: false }],
  },
  {
    id: 8, name: "André Souza", company: "Café & Arte", email: "andre@cafearte.com.br",
    phone: "(85) 92109-8765", whatsapp: "(85) 92109-8765", instagram: "@cafearte",
    site: "cafearte.com.br", serviceType: "Branding", status: "Ativo",
    lastProject: "Identidade Visual Café & Arte", lastInteraction: "09 Abr 2025",
    observations: "Projeto de branding completo entregue. Avaliando pacote mensal.",
    projects: [{ name: "Identidade Visual Café & Arte", status: "Concluído" }],
    tasks: [{ name: "Proposta pacote mensal", done: false }],
  },
];

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
  const [clients] = useState<Client[]>(initialClients);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [sortAsc, setSortAsc] = useState(true);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie seus clientes, contatos e informações importantes em um só lugar</p>
        </div>
        <Button onClick={() => setNewClientOpen(true)} className="orbit-gradient text-white border-0 gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Novo cliente
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={Users} label="Total de clientes" value={clients.length} />
        <SummaryCard icon={UserCheck} label="Clientes ativos" value={activeCount} accent="bg-emerald-500/15" />
        <SummaryCard icon={UserPlus} label="Novos este mês" value={newThisMonth} accent="bg-secondary/15" />
        <SummaryCard icon={FolderKanban} label="Projetos em andamento" value={ongoingProjects} accent="bg-accent/15" />
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
      <NewClientDialog open={newClientOpen} onOpenChange={setNewClientOpen} />

      {/* Client Detail Sheet */}
      <ClientDetailSheet client={selectedClient} onClose={() => setSelectedClient(null)} />
    </div>
  );
};

// ---------- New Client Dialog ----------
const NewClientDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Novo cliente</DialogTitle>
          <DialogDescription className="text-muted-foreground">Preencha as informações do novo cliente.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
          <FormField label="Nome completo" placeholder="João Silva" />
          <FormField label="Empresa" placeholder="Empresa Ltda" />
          <FormField label="Email" placeholder="email@empresa.com" type="email" />
          <FormField label="Telefone" placeholder="(11) 99999-9999" />
          <FormField label="WhatsApp" placeholder="(11) 99999-9999" icon={<MessageCircle className="h-4 w-4" />} />
          <FormField label="Instagram" placeholder="@usuario" icon={<Instagram className="h-4 w-4" />} />
          <FormField label="Site" placeholder="www.site.com" icon={<Globe className="h-4 w-4" />} />
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Tipo de serviço</Label>
            <Select>
              <SelectTrigger className="bg-muted/50 border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {serviceTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Status</Label>
            <Select>
              <SelectTrigger className="bg-muted/50 border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label className="text-sm text-muted-foreground">Observações</Label>
            <Textarea placeholder="Notas sobre o cliente..." className="bg-muted/50 border-border min-h-[80px]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="orbit-gradient text-white border-0" onClick={() => onOpenChange(false)}>Salvar cliente</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const FormField = ({ label, placeholder, type = "text", icon }: { label: string; placeholder: string; type?: string; icon?: React.ReactNode }) => (
  <div className="space-y-2">
    <Label className="text-sm text-muted-foreground">{label}</Label>
    <div className="relative">
      {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>}
      <Input type={type} placeholder={placeholder} className={`bg-muted/50 border-border ${icon ? "pl-9" : ""}`} />
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
              <InfoRow label="Instagram" value={client.instagram} icon={<Instagram className="h-3.5 w-3.5" />} />
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
