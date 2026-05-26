import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Edit2, MessageCircle, Copy, Mail, Phone, AtSign, Globe, MapPin,
  FileText, Calendar, Clock, Target, StickyNote, Tag, Flame, Snowflake,
  Sparkles, DollarSign, TrendingUp, Archive, ArchiveRestore,
  Briefcase, FileSpreadsheet, FolderKanban, Wallet,
  ClipboardList, ChevronRight, Plus, Trash2, ExternalLink, UserCog,
  Crown, BadgeDollarSign, Users, CheckCircle2, AlertCircle, BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type Client, type ClientStatus, type ClientTemperature,
  type ClientAsset, type ClientTechnicalSheet, type ClientContact,
  CLIENT_CONTACT_ROLES, CLIENT_ASSET_TYPE_LABELS,
} from "@/hooks/useClients";
import { useLeads } from "@/hooks/useLeads";
import { useQuotes } from "@/hooks/useQuotes";
import { useProjects } from "@/hooks/useProjects";
import { useFinance } from "@/hooks/useFinance";
import { ClientLibrarySection } from "./ClientLibrarySection";
import { ClientActivitiesTab } from "./ClientActivitiesTab";

const statusBadge: Record<ClientStatus, string> = {
  "Ativo": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Em negociação": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "Potencial": "bg-sky-500/10 text-sky-400 border-sky-500/20",
  "Inativo": "bg-muted text-muted-foreground border-border",
  "Arquivado": "bg-muted/40 text-muted-foreground/70 border-border",
};

const tempConfig: Record<ClientTemperature, { icon: any; cls: string }> = {
  Frio: { icon: Snowflake, cls: "text-sky-400/80" },
  Morno: { icon: Sparkles, cls: "text-amber-400/80" },
  Quente: { icon: Flame, cls: "text-primary" },
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });

const fmtDateLong = (iso?: string) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return ""; }
};

const onlyDigits = (s: string) => (s || "").replace(/\D+/g, "");

const SectionTitle = ({ icon: Icon, children, action }: { icon: any; children: React.ReactNode; action?: React.ReactNode }) => (
  <div className="flex items-center justify-between mb-2.5">
    <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground/80 flex items-center gap-2">
      <Icon className="h-3.5 w-3.5" />{children}
    </h3>
    {action}
  </div>
);

const MiniStat = ({
  icon: Icon, label, value, hint, tone = "neutral",
}: {
  icon: any; label: string; value: string; hint?: string;
  tone?: "neutral" | "primary" | "success" | "warning" | "danger";
}) => {
  const toneCls: Record<string, string> = {
    neutral: "text-muted-foreground bg-muted/40",
    primary: "text-primary bg-primary/10",
    success: "text-emerald-400 bg-emerald-500/10",
    warning: "text-amber-400 bg-amber-500/10",
    danger: "text-destructive bg-destructive/10",
  };
  return (
    <div className="rounded-lg border border-border/60 bg-card/60 p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={cn("h-6 w-6 rounded-md flex items-center justify-center", toneCls[tone])}>
          <Icon className="h-3 w-3" />
        </div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</p>
      </div>
      <p className="text-sm font-semibold text-foreground leading-tight truncate">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">{hint}</p>}
    </div>
  );
};

const ContactRow = ({ icon: Icon, label, value }: { icon: any; label: string; value?: string }) => {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3 text-sm py-1.5">
      <span className="text-muted-foreground flex items-center gap-2 shrink-0">
        <Icon className="h-3.5 w-3.5" />{label}
      </span>
      <span className="text-foreground font-medium text-right truncate">{value}</span>
    </div>
  );
};

const copyText = async (text: string, label = "Copiado") => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error("Não foi possível copiar");
  }
};

const waLink = (phone?: string) => {
  const d = onlyDigits(phone || "");
  if (!d) return "";
  const full = d.length <= 11 ? `55${d}` : d;
  return `https://wa.me/${full}`;
};

// ============ Main ============

export const ClientProfileDrawer = ({
  client, onClose, onEdit, onWhats, onArchive, onRestore,
  onCreateOpportunity, onCreateQuote,
  onUpdateAssets, onUpdateTechnicalSheet, onUpdateContacts,
  initialTab, highlightedActivityId,
}: {
  client: Client | null;
  onClose: () => void;
  onEdit: (c: Client) => void;
  onWhats: (c: Client) => void;
  onArchive?: (c: Client) => void;
  onRestore?: (c: Client) => void;
  onCreateOpportunity?: (c: Client) => void;
  onCreateQuote?: (c: Client) => void;
  onUpdateAssets?: (clientId: number, assets: ClientAsset[]) => void;
  onUpdateTechnicalSheet?: (clientId: number, sheet: ClientTechnicalSheet) => void;
  onUpdateContacts?: (clientId: number, contacts: ClientContact[]) => void;
  initialTab?: string;
  highlightedActivityId?: string;
}) => {
  const navigate = useNavigate();
  const VALID_TABS = ["overview", "activities", "contacts", "commercial", "projects", "finance", "materials", "sheet"];
  const safeInitial = initialTab && VALID_TABS.includes(initialTab) ? initialTab : "overview";
  const [tab, setTab] = useState<string>(safeInitial);
  useEffect(() => { setTab(safeInitial); }, [safeInitial, client?.id]);
  if (!client) return null;

  const hasPhone = !!(client.whatsapp || client.phone);
  const TempIcon = client.temperature ? tempConfig[client.temperature].icon : null;
  const tempCls = client.temperature ? tempConfig[client.temperature].cls : "";
  const location = [client.city, client.state].filter(Boolean).join("/");

  const handleCopyAll = () => {
    const parts = [client.name, client.company, client.email, client.phone].filter(Boolean).join(" · ");
    copyText(parts, "Contato copiado");
  };

  const handleWhats = () => {
    if (!hasPhone) return toast.error("Cliente sem telefone/WhatsApp");
    onWhats(client);
  };

  return (
    <Sheet open={!!client} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="bg-card border-border w-full sm:max-w-[760px] overflow-y-auto p-0">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border/60">
          <SheetHeader className="space-y-2">
            <SheetTitle className="text-foreground text-xl">{client.name}</SheetTitle>
            <SheetDescription asChild>
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {client.company && (
                  <span className="text-foreground/80 font-medium">{client.company}</span>
                )}
                <Badge variant="outline" className={statusBadge[client.status]}>{client.status}</Badge>
                {client.temperature && TempIcon ? (
                  <span className={cn("inline-flex items-center gap-1", tempCls)}>
                    <TempIcon className="h-3 w-3" /> {client.temperature}
                  </span>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground/70">Temperatura não definida</Badge>
                )}
                {client.serviceType && client.serviceType !== "—" && (
                  <span className="text-muted-foreground">· {client.serviceType}</span>
                )}
                {location && (
                  <span className="text-muted-foreground inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />{location}
                  </span>
                )}
              </div>
            </SheetDescription>
          </SheetHeader>

          <div className="flex gap-2 mt-4">
            <Button size="sm" className="flex-1 gap-2" onClick={() => onEdit(client)}>
              <Edit2 className="h-3.5 w-3.5" /> Editar
            </Button>
            <Button size="sm" variant="outline" className="flex-1 gap-2" disabled={!hasPhone} onClick={handleWhats}>
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </Button>
            <Button size="sm" variant="outline" className="gap-2" onClick={handleCopyAll} title="Copiar contato">
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="px-6 pt-5">
          <TabsList className="w-full h-auto p-1 flex flex-wrap gap-1 justify-start bg-muted/40">
            <TabsTrigger value="overview" className="text-xs">Visão geral</TabsTrigger>
            <TabsTrigger value="activities" className="text-xs">Atividades</TabsTrigger>
            <TabsTrigger value="contacts" className="text-xs">Contatos</TabsTrigger>
            <TabsTrigger value="commercial" className="text-xs">Comercial</TabsTrigger>
            <TabsTrigger value="projects" className="text-xs">Projetos</TabsTrigger>
            <TabsTrigger value="finance" className="text-xs">Financeiro</TabsTrigger>
            <TabsTrigger value="materials" className="text-xs">Materiais</TabsTrigger>
            <TabsTrigger value="sheet" className="text-xs">Ficha Técnica</TabsTrigger>
          </TabsList>

          <div className="py-5 space-y-7">
            <TabsContent value="overview" className="mt-0 space-y-6">
              <OverviewTab client={client} onEdit={onEdit} />
            </TabsContent>

            <TabsContent value="activities" className="mt-0">
              <ClientActivitiesTab client={client} onClose={onClose} onCreateOpportunity={onCreateOpportunity} highlightedActivityId={highlightedActivityId} />
            </TabsContent>

            <TabsContent value="contacts" className="mt-0">
              <ContactsTab client={client} onUpdateContacts={onUpdateContacts} />
            </TabsContent>

            <TabsContent value="commercial" className="mt-0">
              <CommercialTab
                client={client}
                onCreateOpportunity={onCreateOpportunity}
                onCreateQuote={onCreateQuote}
              />
            </TabsContent>

            <TabsContent value="projects" className="mt-0">
              <ProjectsTab client={client} onClose={onClose} />
            </TabsContent>

            <TabsContent value="finance" className="mt-0">
              <FinanceTab client={client} onClose={onClose} />
            </TabsContent>

            <TabsContent value="materials" className="mt-0">
              <MaterialsTab client={client} onUpdateAssets={onUpdateAssets} />
            </TabsContent>

            <TabsContent value="sheet" className="mt-0">
              <SheetTab client={client} onOpen={() => navigate(`/clientes/${client.id}/ficha-tecnica`)} />
            </TabsContent>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 pt-4 pb-6 border-t border-border/60 mt-4">
            {client.archived ? (
              onRestore && (
                <Button variant="outline" size="sm" className="gap-2" onClick={() => { onRestore(client); onClose(); }}>
                  <ArchiveRestore className="h-3.5 w-3.5" /> Restaurar
                </Button>
              )
            ) : (
              onArchive && (
                <Button variant="outline" size="sm" className="gap-2" onClick={() => { onArchive(client); onClose(); }}>
                  <Archive className="h-3.5 w-3.5" /> Arquivar
                </Button>
              )
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

// ============ Overview tab ============

const OverviewTab = ({ client, onEdit }: { client: Client; onEdit: (c: Client) => void }) => {
  const location = [client.city, client.state].filter(Boolean).join("/");
  return (
    <>
      <section>
        <SectionTitle icon={TrendingUp}>Resumo</SectionTitle>
        <div className="grid grid-cols-2 gap-2.5">
          <MiniStat
            icon={DollarSign} label="Valor potencial"
            value={client.potentialValue ? fmtBRL(client.potentialValue) : "—"}
            tone={client.potentialValue ? "primary" : "neutral"}
          />
          <MiniStat
            icon={Wallet} label="Receita gerada"
            value={client.totalRevenue ? fmtBRL(client.totalRevenue) : "—"}
            tone={client.totalRevenue ? "success" : "neutral"}
          />
          <MiniStat
            icon={Target} label="Próxima ação"
            value={client.nextAction || "Sem follow-up"}
            hint={client.nextActionDate ? fmtDateLong(client.nextActionDate) : undefined}
            tone={client.nextAction ? "neutral" : "warning"}
          />
          <MiniStat icon={Clock} label="Última interação" value={client.lastInteraction || "—"} />
        </div>
      </section>

      <section>
        <SectionTitle icon={Mail}>Contato principal</SectionTitle>
        <div className="rounded-lg border border-border/60 bg-card/40 px-3.5 py-1 divide-y divide-border/40">
          <ContactRow icon={Mail} label="E-mail" value={client.email} />
          <ContactRow icon={Phone} label="Telefone" value={client.phone} />
          <ContactRow icon={MessageCircle} label="WhatsApp" value={client.whatsapp} />
          <ContactRow icon={AtSign} label="Instagram" value={client.instagram} />
          <ContactRow icon={Globe} label="Site" value={client.site} />
          <ContactRow icon={FileText} label="Documento" value={client.document} />
          <ContactRow icon={MapPin} label="Localização" value={location} />
          <ContactRow icon={MapPin} label="Endereço" value={client.address} />
        </div>
      </section>

      <section>
        <SectionTitle icon={Tag}>Tags e origem</SectionTitle>
        <div className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Origem</span>
            <span className="text-foreground font-medium">{client.origin || "—"}</span>
          </div>
          <Separator className="bg-border/40" />
          <div>
            <p className="text-xs text-muted-foreground mb-2">Tags</p>
            {client.tags && client.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {client.tags.map((t) => (
                  <Badge key={t} variant="outline" className="text-muted-foreground border-border/70">{t}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/70">Nenhuma tag aplicada.</p>
            )}
          </div>
        </div>
      </section>

      <section>
        <SectionTitle icon={StickyNote}>Observações</SectionTitle>
        <div className="rounded-lg border border-border/60 bg-card/40 p-4">
          {client.observations ? (
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{client.observations}</p>
          ) : (
            <p className="text-xs text-muted-foreground/70">Nenhuma observação registrada.</p>
          )}
        </div>
      </section>

      <section>
        <SectionTitle icon={FolderKanban}>Atalhos rápidos</SectionTitle>
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => onEdit(client)}>
            <Edit2 className="h-3.5 w-3.5" /> Editar dados
          </Button>
          <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => onEdit(client)}>
            <Target className="h-3.5 w-3.5" /> Definir follow-up
          </Button>
        </div>
      </section>
    </>
  );
};

// ============ Contacts tab ============

const emptyContact = (): ClientContact => ({
  id: `ct-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: "", role: "Outro", email: "", phone: "", whatsapp: "",
  isPrimary: false, isFinancial: false, isDecisionMaker: false, notes: "",
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
});

const ContactsTab = ({
  client, onUpdateContacts,
}: {
  client: Client;
  onUpdateContacts?: (clientId: number, contacts: ClientContact[]) => void;
}) => {
  const [editing, setEditing] = useState<ClientContact | null>(null);
  const [deleting, setDeleting] = useState<ClientContact | null>(null);
  const contacts = client.contacts ?? [];

  const save = (c: ClientContact) => {
    const exists = contacts.some((x) => x.id === c.id);
    const next = exists
      ? contacts.map((x) => (x.id === c.id ? { ...c, updatedAt: new Date().toISOString() } : x))
      : [...contacts, c];
    onUpdateContacts?.(client.id, next);
    toast.success(exists ? "Contato atualizado" : "Contato adicionado");
    setEditing(null);
  };

  const remove = (id: string) => {
    onUpdateContacts?.(client.id, contacts.filter((c) => c.id !== id));
    toast.success("Contato removido");
    setDeleting(null);
  };

  return (
    <>
      <section>
        <SectionTitle
          icon={Users}
          action={
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => setEditing(emptyContact())}>
              <Plus className="h-3 w-3" /> Novo contato
            </Button>
          }
        >
          Contato principal
        </SectionTitle>
        <div className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
              {client.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{client.name}</p>
              <p className="text-xs text-muted-foreground truncate">{client.company || "—"}</p>
            </div>
            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary/90">
              <Crown className="h-2.5 w-2.5 mr-1" /> Principal
            </Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
            {client.email && <ContactActionRow icon={Mail} value={client.email} type="email" />}
            {client.phone && <ContactActionRow icon={Phone} value={client.phone} type="phone" />}
            {client.whatsapp && <ContactActionRow icon={MessageCircle} value={client.whatsapp} type="whatsapp" />}
          </div>
        </div>
      </section>

      <section className="mt-6">
        <SectionTitle icon={UserCog}>Contatos adicionais</SectionTitle>
        {contacts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 bg-card/30 p-6 text-center">
            <Users className="h-6 w-6 text-muted-foreground/60 mx-auto mb-2" />
            <p className="text-sm text-foreground">Nenhum contato adicional</p>
            <p className="text-xs text-muted-foreground/80 mt-0.5">
              Cadastre decisores, financeiro e outros pontos de contato deste cliente.
            </p>
            <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={() => setEditing(emptyContact())}>
              <Plus className="h-3.5 w-3.5" /> Adicionar contato
            </Button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {contacts.map((c) => (
              <div key={c.id} className="rounded-lg border border-border/60 bg-card/40 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-muted text-foreground/80 flex items-center justify-center text-xs font-semibold shrink-0">
                      {(c.name || "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{c.name || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.role || "Outro"}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {c.isPrimary && (
                          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary/90">
                            <Crown className="h-2.5 w-2.5 mr-1" />Principal
                          </Badge>
                        )}
                        {c.isDecisionMaker && (
                          <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">Decisor</Badge>
                        )}
                        {c.isFinancial && (
                          <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
                            <BadgeDollarSign className="h-2.5 w-2.5 mr-1" />Financeiro
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(c)} title="Editar">
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleting(c)} title="Excluir">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2.5">
                  {c.email && <ContactActionRow icon={Mail} value={c.email} type="email" />}
                  {c.phone && <ContactActionRow icon={Phone} value={c.phone} type="phone" />}
                  {c.whatsapp && <ContactActionRow icon={MessageCircle} value={c.whatsapp} type="whatsapp" />}
                </div>
                {c.notes && (
                  <p className="text-xs text-muted-foreground mt-2.5 border-t border-border/40 pt-2 leading-relaxed">
                    {c.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <ContactDialog
        contact={editing}
        onClose={() => setEditing(null)}
        onSave={save}
      />

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contato?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.name || "Este contato"} será removido. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && remove(deleting.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const ContactActionRow = ({
  icon: Icon, value, type,
}: { icon: any; value: string; type: "email" | "phone" | "whatsapp" }) => {
  const openWa = () => {
    const link = waLink(value);
    if (link) window.open(link, "_blank");
  };
  return (
    <div className="flex items-center justify-between gap-2 text-xs rounded-md bg-muted/30 px-2.5 py-1.5">
      <span className="flex items-center gap-1.5 text-muted-foreground min-w-0">
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate text-foreground/90">{value}</span>
      </span>
      <div className="flex items-center gap-0.5 shrink-0">
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyText(value)} title="Copiar">
          <Copy className="h-3 w-3" />
        </Button>
        {type === "whatsapp" || type === "phone" ? (
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={openWa} title="WhatsApp">
            <MessageCircle className="h-3 w-3" />
          </Button>
        ) : (
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => window.open(`mailto:${value}`)} title="Enviar e-mail">
            <ExternalLink className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
};

const ContactDialog = ({
  contact, onClose, onSave,
}: {
  contact: ClientContact | null;
  onClose: () => void;
  onSave: (c: ClientContact) => void;
}) => {
  const [draft, setDraft] = useState<ClientContact | null>(contact);
  // sync when prop changes
  useMemo(() => { setDraft(contact); }, [contact]);

  if (!draft) return null;

  const update = (patch: Partial<ClientContact>) => setDraft({ ...draft, ...patch });

  return (
    <Dialog open={!!contact} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{contact?.name ? "Editar contato" : "Novo contato"}</DialogTitle>
          <DialogDescription>Adicione um ponto de contato adicional deste cliente.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome *</Label>
            <Input value={draft.name} onChange={(e) => update({ name: e.target.value })} placeholder="Nome completo" />
          </div>
          <div>
            <Label className="text-xs">Função</Label>
            <Select value={typeof draft.role === "string" ? draft.role : "Outro"} onValueChange={(v) => update({ role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CLIENT_CONTACT_ROLES.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label className="text-xs">E-mail</Label>
              <Input type="email" value={draft.email || ""} onChange={(e) => update({ email: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input value={draft.phone || ""} onChange={(e) => update({ phone: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">WhatsApp</Label>
                <Input value={draft.whatsapp || ""} onChange={(e) => update({ whatsapp: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-md border border-border/60 p-3 bg-muted/20">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={!!draft.isPrimary} onCheckedChange={(v) => update({ isPrimary: !!v })} />
              Marcar como contato principal
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={!!draft.isDecisionMaker} onCheckedChange={(v) => update({ isDecisionMaker: !!v })} />
              É decisor
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={!!draft.isFinancial} onCheckedChange={(v) => update({ isFinancial: !!v })} />
              É contato financeiro
            </label>
          </div>

          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea
              value={draft.notes || ""}
              onChange={(e) => update({ notes: e.target.value })}
              rows={3}
              placeholder="Horários, preferências, contexto…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => {
              if (!draft.name.trim()) return toast.error("Informe o nome do contato");
              onSave(draft);
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============ Commercial tab ============

const CommercialTab = ({
  client, onCreateOpportunity, onCreateQuote,
}: {
  client: Client;
  onCreateOpportunity?: (c: Client) => void;
  onCreateQuote?: (c: Client) => void;
}) => {
  const { leads } = useLeads();
  const { quotes } = useQuotes();

  const clientLeads = useMemo(
    () => leads.filter((l) => l.clientId === client.id),
    [leads, client.id]
  );
  const clientQuotes = useMemo(
    () => quotes.filter((q) => q.clientId === client.id || q.clientName === client.name),
    [quotes, client.id, client.name]
  );

  const approvedTotal = clientQuotes.filter((q) => q.status === "aprovado").reduce((s, q) => s + (q.total || 0), 0);
  const openTotal = clientQuotes.filter((q) => ["rascunho", "enviado"].includes(q.status)).reduce((s, q) => s + (q.total || 0), 0);

  return (
    <>
      <section>
        <div className="grid grid-cols-2 gap-2.5">
          <MiniStat icon={DollarSign} label="Em aberto" value={fmtBRL(openTotal)} tone={openTotal ? "warning" : "neutral"} />
          <MiniStat icon={CheckCircle2} label="Aprovado" value={fmtBRL(approvedTotal)} tone={approvedTotal ? "success" : "neutral"} />
          <MiniStat icon={Target} label="Oportunidades" value={String(clientLeads.length)} />
          <MiniStat icon={FileSpreadsheet} label="Orçamentos" value={String(clientQuotes.length)} />
        </div>
      </section>

      <section className="mt-6">
        <SectionTitle
          icon={Target}
          action={
            <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={() => onCreateOpportunity?.(client)}>
              <Plus className="h-3 w-3" /> Nova oportunidade
            </Button>
          }
        >
          Oportunidades
        </SectionTitle>
        {clientLeads.length === 0 ? (
          <EmptyBlock icon={Target} message="Nenhuma oportunidade vinculada." />
        ) : (
          <div className="space-y-2">
            {clientLeads.map((l) => (
              <div key={l.id} className="rounded-lg border border-border/60 bg-card/40 p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{l.name}</p>
                  <p className="text-[11px] text-muted-foreground capitalize">{l.stage} · {fmtBRL(l.estimatedValue || 0)}</p>
                </div>
                <Badge variant="outline" className="text-[10px]">{l.stage}</Badge>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <SectionTitle
          icon={FileSpreadsheet}
          action={
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => onCreateQuote?.(client)}>
              <Plus className="h-3 w-3" /> Novo orçamento
            </Button>
          }
        >
          Orçamentos
        </SectionTitle>
        {clientQuotes.length === 0 ? (
          <EmptyBlock icon={FileSpreadsheet} message="Nenhum orçamento vinculado." />
        ) : (
          <div className="space-y-2">
            {clientQuotes.map((q) => (
              <div key={q.id} className="rounded-lg border border-border/60 bg-card/40 p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{q.title || "Sem título"}</p>
                  <p className="text-[11px] text-muted-foreground">{fmtBRL(q.total || 0)} · {fmtDateLong(q.createdAt)}</p>
                </div>
                <Badge variant="outline" className="text-[10px] capitalize">{q.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </section>

      {client.nextAction && (
        <section className="mt-6">
          <SectionTitle icon={Target}>Próxima ação comercial</SectionTitle>
          <div className="rounded-lg border border-border/60 bg-card/40 p-3.5">
            <p className="text-sm text-foreground">{client.nextAction}</p>
            {client.nextActionDate && (
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />{fmtDateLong(client.nextActionDate)}
              </p>
            )}
          </div>
        </section>
      )}
    </>
  );
};

// ============ Projects tab ============

const projectStatusLabels: Record<string, string> = {
  planning: "Planejamento", in_progress: "Em andamento", review: "Revisão",
  delivered: "Entregue", paused: "Pausado", cancelled: "Cancelado", archived: "Arquivado",
};

const ProjectsTab = ({ client, onClose }: { client: Client; onClose: () => void }) => {
  const navigate = useNavigate();
  const { projects } = useProjects();
  const items = useMemo(
    () => projects.filter((p) => p.clientId === client.id || p.clientName === client.name),
    [projects, client.id, client.name]
  );

  if (items.length === 0) {
    return <EmptyBlock icon={Briefcase} message="Nenhum projeto vinculado a este cliente." />;
  }

  return (
    <div className="space-y-2.5">
      {items.map((p) => (
        <div key={p.id} className="rounded-lg border border-border/60 bg-card/40 p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className="text-[10px]">{projectStatusLabels[p.status] ?? p.status}</Badge>
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  {p.source === "orçamento" ? "Via orçamento" : "Manual"}
                </Badge>
                {p.dueDate && (
                  <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />{fmtDateLong(p.dueDate)}
                  </span>
                )}
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, p.progress || 0)}%` }} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{p.progress || 0}% concluído</p>
            </div>
            <Button
              size="sm" variant="outline" className="gap-1.5 text-xs shrink-0"
              onClick={() => { onClose(); navigate(`/portfolio?project=${p.id}`); }}
            >
              Ver <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

// ============ Finance tab ============

const FinanceTab = ({ client, onClose }: { client: Client; onClose: () => void }) => {
  const navigate = useNavigate();
  const { transactions } = useFinance();
  const items = useMemo(
    () => transactions.filter((t) => t.type === "income" && (t.clientId === client.id || t.clientName === client.name)),
    [transactions, client.id, client.name]
  );

  const totals = useMemo(() => {
    const paid = items.filter((t) => t.status === "paid");
    const pending = items.filter((t) => t.status === "pending");
    const overdue = items.filter((t) => t.status === "overdue");
    const sum = (arr: typeof items) => arr.reduce((s, t) => s + (t.amount || 0), 0);
    return {
      paid: sum(paid), pending: sum(pending), overdue: sum(overdue),
      total: sum(items),
      countPaid: paid.length, countPending: pending.length, countOverdue: overdue.length,
    };
  }, [items]);

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <MiniStat icon={CheckCircle2} label="Recebido" value={fmtBRL(totals.paid)} hint={`${totals.countPaid} pagas`} tone={totals.paid ? "success" : "neutral"} />
        <MiniStat icon={Clock} label="A receber" value={fmtBRL(totals.pending)} hint={`${totals.countPending} pendentes`} tone={totals.pending ? "warning" : "neutral"} />
        <MiniStat icon={AlertCircle} label="Vencido" value={fmtBRL(totals.overdue)} hint={`${totals.countOverdue} atrasadas`} tone={totals.overdue ? "danger" : "neutral"} />
        <MiniStat icon={Wallet} label="Previsto total" value={fmtBRL(totals.total)} />
      </div>

      <div className="mt-5 flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80">Recebíveis vinculados</p>
        <Button
          size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
          onClick={() => { onClose(); navigate("/financeiro"); }}
        >
          Ver no financeiro <ChevronRight className="h-3 w-3" />
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="mt-2">
          <EmptyBlock icon={Wallet} message="Nenhum recebível vinculado a este cliente." />
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {items.map((t) => (
            <div key={t.id} className="rounded-lg border border-border/60 bg-card/40 p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {fmtBRL(t.amount)} · venc. {fmtDateLong(t.dueDate)}
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn("text-[10px] capitalize",
                  t.status === "paid" && "border-emerald-500/30 text-emerald-400",
                  t.status === "pending" && "border-amber-500/30 text-amber-400",
                  t.status === "overdue" && "border-destructive/40 text-destructive",
                )}
              >
                {t.status === "paid" ? "Pago" : t.status === "pending" ? "Pendente" : t.status === "overdue" ? "Vencido" : t.status}
              </Badge>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground/70 mt-3">
        Geração de cobrança real ainda não disponível — gerencie status diretamente no módulo Financeiro.
      </p>
    </>
  );
};

// ============ Materials tab ============

const MaterialsTab = ({
  client, onUpdateAssets,
}: {
  client: Client;
  onUpdateAssets?: (clientId: number, assets: ClientAsset[]) => void;
}) => {
  const navigate = useNavigate();
  const sheetAssets = client.technicalSheet?.assets ?? [];
  const social = client.technicalSheet?.socialLinks;

  const socialEntries = [
    social?.instagram && { label: "Instagram", url: social.instagram },
    social?.youtube && { label: "YouTube", url: social.youtube },
    social?.tiktok && { label: "TikTok", url: social.tiktok },
    social?.linkedin && { label: "LinkedIn", url: social.linkedin },
    social?.facebook && { label: "Facebook", url: social.facebook },
    social?.website && { label: "Website", url: social.website },
    ...(social?.otherLinks ?? []),
  ].filter(Boolean) as { label: string; url: string }[];

  return (
    <>
      <section>
        <SectionTitle
          icon={BookOpen}
          action={
            <Button
              size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
              onClick={() => navigate(`/clientes/${client.id}/ficha-tecnica`)}
            >
              Gerenciar na Ficha Técnica <ChevronRight className="h-3 w-3" />
            </Button>
          }
        >
          Materiais da Ficha Técnica
        </SectionTitle>
        {sheetAssets.length === 0 ? (
          <EmptyBlock icon={BookOpen} message="Nenhum material cadastrado na ficha técnica." />
        ) : (
          <div className="space-y-2">
            {sheetAssets.map((a) => (
              <LinkRow key={a.id} title={a.title} subtitle={CLIENT_ASSET_TYPE_LABELS[a.type] ?? "Outro"} url={a.url} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <SectionTitle icon={Globe}>Redes & links</SectionTitle>
        {socialEntries.length === 0 ? (
          <EmptyBlock icon={Globe} message="Nenhum link de rede cadastrado." />
        ) : (
          <div className="space-y-2">
            {socialEntries.map((s, i) => (
              <LinkRow key={`${s.label}-${i}`} title={s.label} url={s.url} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <SectionTitle icon={FolderKanban}>Biblioteca do cliente</SectionTitle>
        <ClientLibrarySection
          assets={client.assets ?? []}
          onChange={(next) => onUpdateAssets?.(client.id, next)}
        />
      </section>
    </>
  );
};

const LinkRow = ({ title, subtitle, url }: { title: string; subtitle?: string; url: string }) => (
  <div className="rounded-lg border border-border/60 bg-card/40 p-3 flex items-center justify-between gap-2">
    <div className="min-w-0">
      <p className="text-sm font-medium text-foreground truncate">{title}</p>
      {subtitle && <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>}
      <p className="text-[11px] text-muted-foreground/70 truncate">{url}</p>
    </div>
    <div className="flex items-center gap-1 shrink-0">
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyText(url, "Link copiado")} title="Copiar">
        <Copy className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="icon" variant="ghost" className="h-7 w-7"
        onClick={() => {
          const safe = /^https?:\/\//i.test(url) ? url : `https://${url}`;
          window.open(safe, "_blank");
        }}
        title="Abrir"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </Button>
    </div>
  </div>
);

// ============ Sheet tab ============

const SheetTab = ({ client, onOpen }: { client: Client; onOpen: () => void }) => {
  const s = client.technicalSheet ?? {};
  const branding = !!(s.branding && (s.branding.logoUrl || s.branding.slogan || s.branding.voiceTone || s.branding.brandNotes || s.branding.colors?.length));
  const persona = !!(s.persona && (s.persona.name || s.persona.pains || s.persona.desires || s.persona.behavior));
  const editorial = !!(s.editorialLine && (s.editorialLine.pillars?.length || s.editorialLine.postingFrequency || s.editorialLine.preferredFormats?.length));
  const typography = !!(s.typography && (s.typography.primaryFont || s.typography.secondaryFont));
  const sl = s.socialLinks ?? {};
  const social = [sl.instagram, sl.youtube, sl.tiktok, sl.linkedin, sl.facebook, sl.website].filter(Boolean).length + (sl.otherLinks?.length ?? 0);
  const accesses = s.accesses?.length ?? 0;
  const assets = s.assets?.length ?? 0;

  const sections = [
    { label: "Branding", ok: branding },
    { label: "Persona", ok: persona },
    { label: "Linha editorial", ok: editorial },
    { label: "Tipografia", ok: typography },
    { label: "Redes", ok: social > 0, count: social },
    { label: "Acessos", ok: accesses > 0, count: accesses },
    { label: "Materiais", ok: assets > 0, count: assets },
  ];
  const filled = sections.filter((x) => x.ok).length;
  const total = sections.length;

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-5">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-foreground">Ficha técnica do cliente</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Centraliza branding, persona, linha editorial, acessos e materiais da marca.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-muted-foreground">Preenchimento</span>
          <span className="text-foreground font-medium">{filled} / {total} seções</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${(filled / total) * 100}%` }} />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-4">
        {sections.map((sec) => (
          <span
            key={sec.label}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px]",
              sec.ok
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                : "border-border/60 bg-muted/40 text-muted-foreground"
            )}
          >
            {sec.label}{typeof sec.count === "number" && sec.count > 0 ? ` · ${sec.count}` : ""}
          </span>
        ))}
      </div>

      <Button className="w-full mt-5 gap-2" onClick={onOpen}>
        <ClipboardList className="h-4 w-4" /> Abrir ficha técnica
      </Button>
    </div>
  );
};

// ============ Empty helper ============

const EmptyBlock = ({ icon: Icon, message }: { icon: any; message: string }) => (
  <div className="rounded-lg border border-dashed border-border/60 bg-card/30 p-6 text-center">
    <Icon className="h-6 w-6 text-muted-foreground/60 mx-auto mb-2" />
    <p className="text-sm text-muted-foreground">{message}</p>
  </div>
);

export default ClientProfileDrawer;
