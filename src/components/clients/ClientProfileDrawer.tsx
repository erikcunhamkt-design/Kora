import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Edit2, MessageCircle, Copy, Mail, Phone, AtSign, Globe, MapPin,
  FileText, Calendar, Clock, Target, StickyNote, Tag, Flame, Snowflake,
  Sparkles, DollarSign, TrendingUp, Activity, Archive, ArchiveRestore,
  Briefcase, FileSpreadsheet, FolderKanban, Wallet, CheckSquare,
  ClipboardList, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Client, ClientStatus, ClientTemperature, ClientAsset, ClientTechnicalSheet } from "@/hooks/useClients";
import { ClientLibrarySection } from "./ClientLibrarySection";
import { ClientTechnicalSheetDialog } from "./ClientTechnicalSheetDialog";

const statusBadge: Record<ClientStatus, string> = {
  "Ativo": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Em negociação": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "Potencial": "bg-sky-500/10 text-sky-400 border-sky-500/20",
  "Inativo": "bg-muted text-muted-foreground border-border",
  "Arquivado": "bg-muted/40 text-muted-foreground/70 border-border",
};

const tempConfig: Record<ClientTemperature, { icon: any; cls: string; label: string }> = {
  Frio: { icon: Snowflake, cls: "text-sky-400/80", label: "Frio" },
  Morno: { icon: Sparkles, cls: "text-amber-400/80", label: "Morno" },
  Quente: { icon: Flame, cls: "text-primary", label: "Quente" },
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

// ---------- Sub-components ----------

const SectionTitle = ({ icon: Icon, children }: { icon: any; children: React.ReactNode }) => (
  <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground/80 flex items-center gap-2 mb-2">
    <Icon className="h-3.5 w-3.5" />{children}
  </h3>
);

const MiniStat = ({
  icon: Icon, label, value, hint, tone = "neutral",
}: {
  icon: any; label: string; value: string; hint?: string;
  tone?: "neutral" | "primary" | "success" | "warning";
}) => {
  const toneCls: Record<string, string> = {
    neutral: "text-muted-foreground bg-muted/40",
    primary: "text-primary bg-primary/10",
    success: "text-emerald-400 bg-emerald-500/10",
    warning: "text-amber-400 bg-amber-500/10",
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

const ContactRow = ({
  icon: Icon, label, value,
}: { icon: any; label: string; value?: string }) => {
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

const ConnectionCard = ({
  icon: Icon, label, hint, onClick, ctaLabel = "Em breve",
}: {
  icon: any; label: string; hint: string; onClick?: () => void; ctaLabel?: string;
}) => (
  <button
    onClick={onClick}
    className="text-left rounded-lg border border-border/60 bg-card/40 p-3 hover:border-border hover:bg-card/70 transition-colors w-full"
  >
    <div className="flex items-center gap-2 mb-1">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">{label}</p>
    </div>
    <p className="text-[11px] text-muted-foreground/80 leading-snug mb-2">{hint}</p>
    <span className="text-[11px] text-muted-foreground/60">{ctaLabel}</span>
  </button>
);

// ---------- Main ----------

export const ClientProfileDrawer = ({
  client, onClose, onEdit, onWhats, onArchive, onRestore, onCreateOpportunity, onCreateQuote, onUpdateAssets, onUpdateTechnicalSheet,
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
}) => {
  const [techOpen, setTechOpen] = useState(false);
  if (!client) return null;

  const hasPhone = !!(client.whatsapp || client.phone);
  const TempIcon = client.temperature ? tempConfig[client.temperature].icon : null;
  const tempCls = client.temperature ? tempConfig[client.temperature].cls : "";

  const handleCopy = async () => {
    const parts = [client.name, client.company, client.email, client.phone].filter(Boolean).join(" · ");
    try {
      await navigator.clipboard.writeText(parts);
      toast.success("Contato copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleWhats = () => {
    if (!hasPhone) return toast.error("Cliente sem telefone/WhatsApp");
    onWhats(client);
  };

  const location = [client.city, client.state].filter(Boolean).join("/");

  return (
    <Sheet open={!!client} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="bg-card border-border w-full sm:max-w-[520px] overflow-y-auto p-0">
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

          {/* Quick actions */}
          <div className="flex gap-2 mt-4">
            <Button size="sm" className="flex-1 gap-2" onClick={() => onEdit(client)}>
              <Edit2 className="h-3.5 w-3.5" /> Editar
            </Button>
            <Button
              size="sm" variant="outline" className="flex-1 gap-2"
              disabled={!hasPhone}
              onClick={handleWhats}
            >
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </Button>
            <Button size="sm" variant="outline" className="gap-2" onClick={handleCopy} title="Copiar contato">
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-7">
          {/* Resumo comercial */}
          <section>
            <SectionTitle icon={TrendingUp}>Resumo comercial</SectionTitle>
            <div className="grid grid-cols-2 gap-2.5">
              <MiniStat
                icon={DollarSign}
                label="Valor potencial"
                value={client.potentialValue ? fmtBRL(client.potentialValue) : "—"}
                tone={client.potentialValue ? "primary" : "neutral"}
              />
              <MiniStat
                icon={Wallet}
                label="Receita gerada"
                value={client.totalRevenue ? fmtBRL(client.totalRevenue) : "—"}
                tone={client.totalRevenue ? "success" : "neutral"}
              />
              <MiniStat
                icon={Target}
                label="Próxima ação"
                value={client.nextAction || "Sem follow-up"}
                hint={client.nextActionDate ? fmtDateLong(client.nextActionDate) : undefined}
                tone={client.nextAction ? "neutral" : "warning"}
              />
              <MiniStat
                icon={Clock}
                label="Última interação"
                value={client.lastInteraction || "—"}
              />
            </div>
          </section>

          {/* Contatos */}
          <section>
            <SectionTitle icon={Mail}>Contatos</SectionTitle>
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

          {/* Próxima ação */}
          <section>
            <SectionTitle icon={Target}>Próxima ação</SectionTitle>
            <div className="rounded-lg border border-border/60 bg-card/40 p-4">
              {client.nextAction ? (
                <>
                  <p className="text-sm text-foreground font-medium">{client.nextAction}</p>
                  {client.nextActionDate && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" />{fmtDateLong(client.nextActionDate)}
                    </p>
                  )}
                  <Button
                    variant="outline" size="sm" className="mt-3 gap-2"
                    onClick={() => onEdit(client)}
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Editar próxima ação
                  </Button>
                </>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-md bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                    <Target className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground">Nenhum follow-up definido</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Defina o próximo passo para manter o relacionamento ativo.
                    </p>
                    <Button
                      variant="outline" size="sm" className="mt-3 gap-2"
                      onClick={() => onEdit(client)}
                    >
                      <Target className="h-3.5 w-3.5" /> Definir follow-up
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Tags & origem */}
          <section>
            <SectionTitle icon={Tag}>Tags e origem</SectionTitle>
            <div className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Origem</span>
                <span className="text-foreground font-medium">{client.origin || "—"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Temperatura</span>
                {client.temperature && TempIcon ? (
                  <span className={cn("inline-flex items-center gap-1 font-medium", tempCls)}>
                    <TempIcon className="h-3.5 w-3.5" /> {client.temperature}
                  </span>
                ) : (
                  <span className="text-muted-foreground/70 text-xs">Não definida</span>
                )}
              </div>
              <Separator className="bg-border/40" />
              <div>
                <p className="text-xs text-muted-foreground mb-2">Tags</p>
                {client.tags && client.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {client.tags.map((t) => (
                      <Badge key={t} variant="outline" className="text-muted-foreground border-border/70">
                        {t}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/70">Nenhuma tag aplicada.</p>
                )}
              </div>
            </div>
          </section>

          {/* Observações */}
          <section>
            <SectionTitle icon={StickyNote}>Observações</SectionTitle>
            <div className="rounded-lg border border-border/60 bg-card/40 p-4">
              {client.observations ? (
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
                  {client.observations}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground/70">Nenhuma observação registrada.</p>
              )}
            </div>
          </section>

          {/* Ficha técnica */}
          <section>
            <SectionTitle icon={ClipboardList}>Ficha técnica</SectionTitle>
            <button
              onClick={() => setTechOpen(true)}
              className="w-full text-left rounded-xl border border-border/60 bg-card/40 hover:bg-card/70 hover:border-border transition-all p-4"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Ficha técnica</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    Branding, persona, redes, acessos e materiais da marca.
                  </p>
                  <TechSummary sheet={client.technicalSheet} />
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
              </div>
              <div className="mt-3">
                <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                  Abrir ficha técnica <ChevronRight className="h-3 w-3" />
                </span>
              </div>
            </button>
          </section>

          {/* Biblioteca do cliente */}
          <ClientLibrarySection
            assets={client.assets ?? []}
            onChange={(next) => onUpdateAssets?.(client.id, next)}
          />


          {/* Timeline */}
          <section>
            <SectionTitle icon={Activity}>Histórico</SectionTitle>
            <ol className="relative border-l border-border/60 ml-2 space-y-4 pl-5">
              {client.createdAt && (
                <li className="relative">
                  <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full bg-emerald-500/60 ring-4 ring-card" />
                  <p className="text-sm text-foreground">Cliente criado</p>
                  <p className="text-[11px] text-muted-foreground">{fmtDateLong(client.createdAt)}</p>
                </li>
              )}
              {client.nextAction && client.nextActionDate && (
                <li className="relative">
                  <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full bg-primary/70 ring-4 ring-card" />
                  <p className="text-sm text-foreground">Próxima ação definida</p>
                  <p className="text-[11px] text-muted-foreground">{client.nextAction} · {fmtDateLong(client.nextActionDate)}</p>
                </li>
              )}
              {client.updatedAt && (
                <li className="relative">
                  <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full bg-sky-500/60 ring-4 ring-card" />
                  <p className="text-sm text-foreground">Última atualização</p>
                  <p className="text-[11px] text-muted-foreground">{fmtDateLong(client.updatedAt)}</p>
                </li>
              )}
              {client.archived && (
                <li className="relative">
                  <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full bg-muted-foreground/60 ring-4 ring-card" />
                  <p className="text-sm text-foreground">Cliente arquivado</p>
                  <p className="text-[11px] text-muted-foreground">Não conta para o limite do plano</p>
                </li>
              )}
              {!client.createdAt && !client.updatedAt && !client.nextAction && !client.archived && (
                <li className="relative">
                  <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full bg-muted-foreground/40 ring-4 ring-card" />
                  <p className="text-xs text-muted-foreground/80">Sem eventos registrados ainda.</p>
                </li>
              )}
            </ol>
          </section>

          {/* Conexões futuras */}
          <section>
            <SectionTitle icon={FolderKanban}>Conexões do cliente</SectionTitle>
            <div className="grid grid-cols-2 gap-2.5">
              <ConnectionCard
                icon={Target}
                label="Oportunidades"
                hint="Acompanhe negociações no pipeline."
                ctaLabel="Criar oportunidade"
                onClick={() => {
                  if (onCreateOpportunity) onCreateOpportunity(client);
                  else toast("Criar oportunidade chega em breve no CRM.");
                }}
              />
              <ConnectionCard
                icon={FileSpreadsheet}
                label="Orçamentos"
                hint="Envie propostas vinculadas a este cliente."
                ctaLabel="Criar orçamento"
                onClick={() => {
                  if (onCreateQuote) onCreateQuote(client);
                  else toast("Orçamentos por cliente em breve.");
                }}
              />

              <ConnectionCard
                icon={Briefcase}
                label="Projetos"
                hint="Entregas e marcos ativos."
                ctaLabel="Em breve"
                onClick={() => toast("Vínculo de projetos por cliente em breve.")}
              />
              <ConnectionCard
                icon={Wallet}
                label="Financeiro"
                hint="Receitas e cobranças relacionadas."
                ctaLabel="Ainda não conectado"
                onClick={() => toast("Financeiro por cliente em breve.")}
              />
              <ConnectionCard
                icon={CheckSquare}
                label="Tarefas"
                hint="To-dos ligados a este cliente."
                ctaLabel="Nova tarefa em breve"
                onClick={() => toast("Tarefas vinculadas chegam em breve.")}
              />
            </div>
          </section>

          {/* Footer actions */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
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
        </div>
      </SheetContent>

      <ClientTechnicalSheetDialog
        open={techOpen}
        onOpenChange={setTechOpen}
        client={client}
        onSave={(id, sheet) => onUpdateTechnicalSheet?.(id, sheet)}
      />
    </Sheet>
  );
};

// Summary chips showing what's filled in the technical sheet
const TechSummary = ({ sheet }: { sheet?: ClientTechnicalSheet }) => {
  const s = sheet ?? {};
  const branding = !!(s.branding && (s.branding.logoUrl || s.branding.slogan || s.branding.voiceTone || s.branding.brandNotes || s.branding.colors?.length));
  const persona = !!(s.persona && (s.persona.name || s.persona.pains || s.persona.desires || s.persona.behavior));
  const socialCount = (() => {
    const sl = s.socialLinks ?? {};
    const base = [sl.instagram, sl.youtube, sl.tiktok, sl.linkedin, sl.facebook, sl.website].filter(Boolean).length;
    return base + (sl.otherLinks?.length ?? 0);
  })();
  const accesses = s.accesses?.length ?? 0;
  const assets = s.assets?.length ?? 0;

  const chip = (label: string, ok: boolean, count?: number) => (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px]",
        ok
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
          : "border-border/60 bg-muted/40 text-muted-foreground"
      )}
    >
      {label}{typeof count === "number" && count > 0 ? ` · ${count}` : ""}
    </span>
  );

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {chip("Branding", branding)}
      {chip("Persona", persona)}
      {chip("Redes", socialCount > 0, socialCount)}
      {chip("Acessos", accesses > 0, accesses)}
      {chip("Materiais", assets > 0, assets)}
    </div>
  );
};

export default ClientProfileDrawer;
