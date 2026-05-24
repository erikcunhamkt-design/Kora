import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  User,
  Building2,
  Palette,
  Bell,
  Shield,
  Crown,
  Plug,
  LifeBuoy,
  Database,
  Check,
  Sparkles,
  Globe,
  Smartphone,
  Mail,
  MessageCircle,
  Calendar,
  HardDrive,
  CreditCard,
  Bot,
  Webhook,
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  Lock,
  History,
  ShieldCheck,
  FileText,
  Link2,
  Copy,
  ExternalLink,
  Users,
} from "lucide-react";


import { PageHeader } from "@/components/layout/PageHeader";
import { SettingsNav, type SettingsNavItem } from "@/components/settings/SettingsNav";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useAppSettings, type NotificationSettings } from "@/hooks/useAppSettings";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { SupportDrawer } from "@/components/support/SupportDrawer";
import { ClientPortalSection } from "@/components/settings/ClientPortalSection";


const NAV_ITEMS: SettingsNavItem[] = [
  { id: "profile", label: "Perfil", icon: User },
  { id: "company", label: "Empresa", icon: Building2 },
  { id: "links", label: "Links públicos", icon: Link2 },
  { id: "appearance", label: "Aparência", icon: Palette },
  { id: "notifications", label: "Notificações", icon: Bell },
  { id: "security", label: "Segurança", icon: Shield },
  { id: "plan", label: "Plano", icon: Crown },
  { id: "integrations", label: "Integrações", icon: Plug },
  { id: "support", label: "Suporte", icon: LifeBuoy },
  { id: "portal", label: "Portal do Cliente", icon: Users },
  { id: "data", label: "Dados", icon: Database },
];


function initials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "K";
}

const SoonBadge = () => (
  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">Em breve</Badge>
);
const PlannedBadge = () => (
  <Badge variant="outline" className="text-[10px] uppercase tracking-wide text-muted-foreground">Planejado</Badge>
);
const ActiveBadge = () => (
  <Badge variant="success" className="text-[10px] uppercase tracking-wide">Ativo</Badge>
);

const TAB_ALIASES: Record<string, string> = {
  perfil: "profile",
  empresa: "company",
  links: "links",
  aparencia: "appearance",
  notificacoes: "notifications",
  seguranca: "security",
  plano: "plan",
  integracoes: "integrations",
  suporte: "support",
  portal: "portal",
  "portal-cliente": "portal",
  dados: "data",
};


const Configuracoes = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = TAB_ALIASES[searchParams.get("tab") ?? ""] ?? searchParams.get("tab") ?? "profile";
  const [active, setActive] = useState(initialTab);
  const [supportOpen, setSupportOpen] = useState(false);
  const { profile, company, notifications, publicLinks, clientPortal, updateProfile, updateCompany, updatePublicLinks, updateClientPortal, resetClientPortal, toggleNotification } = useAppSettings();
  const { resetOnboarding } = useOnboarding();

  useEffect(() => {
    const raw = searchParams.get("tab");
    const resolved = TAB_ALIASES[raw ?? ""] ?? raw;
    if (resolved && resolved !== active) setActive(resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSelect = (id: string) => {
    setActive(id);
    setSearchParams({ tab: id }, { replace: true });
  };

  // local form drafts so saving feels intentional
  const [profileDraft, setProfileDraft] = useState(profile);
  const [companyDraft, setCompanyDraft] = useState(company);
  const [linksDraft, setLinksDraft] = useState(publicLinks);

  const profileInitials = useMemo(() => initials(profileDraft.name), [profileDraft.name]);
  const companyInitials = useMemo(() => initials(companyDraft.name), [companyDraft.name]);

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Configurações"
        subtitle="Gerencie sua conta, empresa e preferências do KORA HUB"
      />

      <div className="grid md:grid-cols-[220px_1fr] gap-6 md:gap-8">
        <aside className="md:border-r md:border-border/40 md:pr-4">
          <SettingsNav items={NAV_ITEMS} active={active} onSelect={handleSelect} />
        </aside>

        <div className="min-w-0">
          {active === "profile" && (
            <SettingsSection title="Perfil" description="Suas informações pessoais visíveis no app.">
              <SettingsCard>
                <div className="flex items-center gap-4 mb-6">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="orbit-gradient text-white text-lg font-bold">
                      {profileInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground truncate">{profileDraft.name || "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground truncate">{profileDraft.email}</p>
                  </div>
                  <Button variant="outline" size="sm" disabled className="gap-2">
                    Alterar foto <SoonBadge />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Nome">
                    <Input value={profileDraft.name} onChange={(e) => setProfileDraft({ ...profileDraft, name: e.target.value })} />
                  </Field>
                  <Field label="E-mail" hint="Gerenciado pelo login">
                    <Input value={profileDraft.email} readOnly className="bg-muted/40" />
                  </Field>
                  <Field label="Telefone">
                    <Input value={profileDraft.phone} onChange={(e) => setProfileDraft({ ...profileDraft, phone: e.target.value })} />
                  </Field>
                  <Field label="Cargo / função">
                    <Input value={profileDraft.role} onChange={(e) => setProfileDraft({ ...profileDraft, role: e.target.value })} />
                  </Field>
                </div>
                <div className="flex justify-end mt-6">
                  <Button
                    onClick={() => {
                      updateProfile(profileDraft);
                      toast.success("Perfil atualizado");
                    }}
                  >
                    Salvar alterações
                  </Button>
                </div>
              </SettingsCard>
            </SettingsSection>
          )}

          {active === "company" && (
            <SettingsSection title="Empresa" description="Dados do seu estúdio ou negócio.">
              <SettingsCard>
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-16 w-16 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                    {companyInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground truncate">{companyDraft.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{companyDraft.segment}</p>
                  </div>
                  <Button variant="outline" size="sm" disabled className="gap-2">
                    Enviar logo <SoonBadge />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Nome da empresa">
                    <Input value={companyDraft.name} onChange={(e) => setCompanyDraft({ ...companyDraft, name: e.target.value })} />
                  </Field>
                  <Field label="Segmento">
                    <Input value={companyDraft.segment} onChange={(e) => setCompanyDraft({ ...companyDraft, segment: e.target.value })} />
                  </Field>
                  <Field label="CPF / CNPJ">
                    <Input value={companyDraft.taxId} onChange={(e) => setCompanyDraft({ ...companyDraft, taxId: e.target.value })} placeholder="000.000.000-00" />
                  </Field>
                  <Field label="Moeda padrão">
                    <Input value={companyDraft.currency} onChange={(e) => setCompanyDraft({ ...companyDraft, currency: e.target.value })} placeholder="BRL" />
                  </Field>
                  <Field label="Site">
                    <Input value={companyDraft.website} onChange={(e) => setCompanyDraft({ ...companyDraft, website: e.target.value })} />
                  </Field>
                  <Field label="WhatsApp">
                    <Input value={companyDraft.whatsapp} onChange={(e) => setCompanyDraft({ ...companyDraft, whatsapp: e.target.value })} />
                  </Field>
                  <Field label="Instagram">
                    <Input value={companyDraft.instagram} onChange={(e) => setCompanyDraft({ ...companyDraft, instagram: e.target.value })} />
                  </Field>
                  <Field label="País">
                    <Input value={companyDraft.country} onChange={(e) => setCompanyDraft({ ...companyDraft, country: e.target.value })} />
                  </Field>
                  <Field label="Cidade">
                    <Input value={companyDraft.city} onChange={(e) => setCompanyDraft({ ...companyDraft, city: e.target.value })} />
                  </Field>
                  <Field label="Estado">
                    <Input value={companyDraft.state} onChange={(e) => setCompanyDraft({ ...companyDraft, state: e.target.value })} />
                  </Field>
                  <Field label="Endereço">
                    <Input value={companyDraft.address} onChange={(e) => setCompanyDraft({ ...companyDraft, address: e.target.value })} />
                  </Field>
                  <Field label="Número">
                    <Input value={companyDraft.number} onChange={(e) => setCompanyDraft({ ...companyDraft, number: e.target.value })} />
                  </Field>
                  <Field label="CEP / Código postal">
                    <Input value={companyDraft.postalCode} onChange={(e) => setCompanyDraft({ ...companyDraft, postalCode: e.target.value })} />
                  </Field>
                </div>

                <div className="flex justify-end mt-6">
                  <Button
                    onClick={() => {
                      updateCompany(companyDraft);
                      toast.success("Dados da empresa atualizados");
                    }}
                  >
                    Salvar alterações
                  </Button>
                </div>
              </SettingsCard>
            </SettingsSection>
          )}

          {active === "links" && (
            <SettingsSection title="Links públicos" description="Slugs que apontam para suas páginas externas.">
              <SettingsCard>
                <div className="space-y-4">
                  <PublicLinkRow
                    label="Página pública"
                    hint="Perfil completo do seu estúdio"
                    basePath="/p/"
                    slug={linksDraft.profileSlug}
                    onChange={(v) => setLinksDraft({ ...linksDraft, profileSlug: v })}
                  />
                  <PublicLinkRow
                    label="Link da bio"
                    hint="Página estilo linktree"
                    basePath="/bio/"
                    slug={linksDraft.bioSlug}
                    onChange={(v) => setLinksDraft({ ...linksDraft, bioSlug: v })}
                  />
                  <PublicLinkRow
                    label="Agendamento"
                    hint="Página de agendamento de horários"
                    basePath="/agendar/"
                    slug={linksDraft.bookingSlug}
                    onChange={(v) => setLinksDraft({ ...linksDraft, bookingSlug: v })}
                  />
                </div>
                <div className="flex justify-end mt-6">
                  <Button
                    onClick={() => {
                      updatePublicLinks(linksDraft);
                      toast.success("Links públicos atualizados");
                    }}
                  >
                    Salvar links
                  </Button>
                </div>
              </SettingsCard>
              <p className="text-xs text-muted-foreground px-1">
                Domínio oficial será configurado em uma etapa futura. Por enquanto usamos o endereço atual.
              </p>
            </SettingsSection>
          )}



          {active === "appearance" && (
            <SettingsSection title="Aparência" description="Personalize o visual do KORA HUB.">
              <SettingsCard title="Tema" description="Modo escuro está ativo. Outros temas em breve.">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <ThemeOption label="Escuro" active />
                  <ThemeOption label="Claro" planned />
                  <ThemeOption label="Sistema" planned />
                </div>
              </SettingsCard>

              <SettingsCard title="Cor de destaque">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary border border-primary/40 shadow-[0_0_20px_hsl(348_94%_52%/0.4)]" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Magenta KORA</p>
                    <p className="text-xs text-muted-foreground">Identidade visual da plataforma</p>
                  </div>
                  <ActiveBadge />
                </div>
              </SettingsCard>

              <SettingsCard title="Densidade da interface">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ToggleRow label="Confortável" hint="Espaçamento padrão" active />
                  <ToggleRow label="Compacta" hint="Mais informação por tela" planned />
                </div>
              </SettingsCard>

              <SettingsCard title="Idioma">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <LangOption label="Português (BR)" active />
                  <LangOption label="English" planned />
                  <LangOption label="Español" planned />
                </div>
              </SettingsCard>
            </SettingsSection>
          )}

          {active === "notifications" && (
            <SettingsSection title="Notificações" description="Escolha o que você quer acompanhar.">
              <SettingsCard>
                <div className="divide-y divide-border/40">
                  <NotifRow id="tasks" label="Alertas de tarefas" hint="Tarefas atrasadas e lembretes" notifications={notifications} toggle={toggleNotification} />
                  <NotifRow id="leads" label="Leads sem follow-up" hint="Leads parados há mais de 3 dias" notifications={notifications} toggle={toggleNotification} />
                  <NotifRow id="quotes" label="Propostas vencendo" hint="Propostas próximas do vencimento" notifications={notifications} toggle={toggleNotification} />
                  <NotifRow id="finance" label="Financeiro" hint="Contas a pagar e receber" notifications={notifications} toggle={toggleNotification} />
                  <NotifRow id="support" label="Tickets de suporte" hint="Respostas em chamados abertos" notifications={notifications} toggle={toggleNotification} />
                  <NotifRow id="aiCredits" label="Créditos de IA baixos" hint="Avisos antes de acabar o saldo" notifications={notifications} toggle={toggleNotification} />
                  <NotifRow id="product" label="Notícias e novidades do produto" hint="Releases e mudanças importantes" notifications={notifications} toggle={toggleNotification} />
                </div>
              </SettingsCard>
              <p className="text-xs text-muted-foreground px-1">
                Envio por e-mail e push será ativado em uma etapa futura.
              </p>
            </SettingsSection>
          )}

          {active === "security" && (
            <SettingsSection title="Segurança" description="Proteja sua conta e dados.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SecurityCard icon={Lock} title="Senha e autenticação" hint="Gerenciado pelo Supabase Auth" status="managed" />
                <SecurityCard icon={History} title="Sessões ativas" hint="Veja onde sua conta está conectada" status="soon" />
                <SecurityCard icon={ShieldCheck} title="Proteção de conta" hint="2FA, recuperação e alertas" status="soon" />
                <SecurityCard icon={FileText} title="Exportar auditoria" hint="Histórico de eventos da conta" status="soon" />
              </div>
              <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-xs text-muted-foreground flex items-start gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                Configurações avançadas de segurança serão ativadas nas próximas etapas.
              </div>
            </SettingsSection>
          )}

          {active === "plan" && (
            <SettingsSection title="Plano" description="Sua assinatura atual e benefícios.">
              <SettingsCard>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-2xl font-bold text-foreground">Free</p>
                      <Badge variant="outline" className="text-[10px] uppercase">Atual</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Acesso aos módulos essenciais com limites do plano gratuito.</p>
                  </div>
                  <Button disabled className="gap-2">
                    Gerenciar assinatura <SoonBadge />
                  </Button>
                </div>
                <Separator className="my-5" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <UsageStat label="Projetos" value="3 / 5" />
                  <UsageStat label="Leads" value="12 / 50" />
                  <UsageStat label="Créditos IA" value="40 / 100" />
                </div>
              </SettingsCard>

              <SettingsCard title="Recursos inclusos">
                <ul className="space-y-2 text-sm">
                  <FeatureLi>CRM essencial e Kanban de leads</FeatureLi>
                  <FeatureLi>Tarefas, agenda e Central do Dia</FeatureLi>
                  <FeatureLi>Notificações e inbox premium</FeatureLi>
                  <FeatureLi muted>Comunidade KORA — disponível futuramente nos planos Pro/Studio</FeatureLi>
                  <FeatureLi muted>Integrações avançadas e automações ilimitadas (Pro)</FeatureLi>
                </ul>
              </SettingsCard>
            </SettingsSection>
          )}

          {active === "integrations" && (
            <SettingsSection title="Integrações" description="Conecte ferramentas externas ao seu fluxo.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <IntegrationCard icon={Calendar} name="Google Calendar" hint="Sincronização de agenda" state="disconnected" />
                <IntegrationCard icon={HardDrive} name="Google Drive" hint="Anexos de projetos" state="disconnected" />
                <IntegrationCard icon={MessageCircle} name="WhatsApp Business" hint="Mensagens no app" state="disconnected" />
                <IntegrationCard icon={CreditCard} name="Asaas" hint="Pix, boleto e cartão" state="disconnected" />
                <IntegrationCard icon={CreditCard} name="Stripe / Paddle" hint="Pagamentos internacionais" state="planned" />
                <IntegrationCard icon={Bot} name="IA generativa" hint="Modelos via Lovable AI" state="planned" />
                <IntegrationCard icon={Webhook} name="Webhooks" hint="Eventos para qualquer URL" state="soon" />
              </div>
            </SettingsSection>
          )}

          {active === "support" && (
            <SettingsSection title="Suporte" description="Estamos por perto quando você precisar.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SettingsCard>
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">E-mail oficial</p>
                      <p className="text-xs text-muted-foreground">A configurar</p>
                    </div>
                  </div>
                </SettingsCard>
                <SettingsCard>
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <MessageCircle className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">WhatsApp oficial</p>
                      <p className="text-xs text-muted-foreground">A configurar</p>
                    </div>
                  </div>
                </SettingsCard>
                <SettingsCard>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <LifeBuoy className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">Central de suporte</p>
                      <p className="text-xs text-muted-foreground">Abrir tickets e ver histórico</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => setSupportOpen(true)}>
                    Abrir central de suporte
                  </Button>
                </SettingsCard>
                <SettingsCard>
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground flex items-center gap-2">Comunidade KORA <PlannedBadge /></p>
                      <p className="text-xs text-muted-foreground">Disponível futuramente nos planos Pro/Studio</p>
                    </div>
                  </div>
                </SettingsCard>
              </div>

              <SettingsCard title="Onboarding">
                <p className="text-xs text-muted-foreground mb-3">
                  Reinicie o assistente inicial para reconfigurar os dados do seu estúdio.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    resetOnboarding();
                    window.location.href = "/onboarding";
                  }}
                >
                  Reiniciar onboarding
                </Button>
              </SettingsCard>
            </SettingsSection>
          )}

          {active === "data" && (
            <SettingsSection title="Dados" description="Exportação, importação e armazenamento.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DataCard icon={Download} title="Exportar dados" hint="Baixe seus dados em CSV/JSON" state="soon" />
                <DataCard icon={Upload} title="Importar dados" hint="Suba planilhas e migrações" state="soon" />
                <DataCard icon={Trash2} title="Limpar dados locais" hint="Remove dados de protótipo deste navegador" state="soon" danger />
                <DataCard icon={Database} title="Status de armazenamento" hint="Dados de protótipo salvos localmente" state="info" />
              </div>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300/90 flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Alguns dados ainda estão em modo local/protótipo e serão migrados para Supabase antes da produção.
              </div>
            </SettingsSection>
          )}
        </div>
      </div>

      <SupportDrawer open={supportOpen} onOpenChange={setSupportOpen} />
    </div>
  );
};

/* ---------- helper sub-components ---------- */

function PublicLinkRow({
  label,
  hint,
  basePath,
  slug,
  onChange,
}: {
  label: string;
  hint: string;
  basePath: string;
  slug: string;
  onChange: (v: string) => void;
}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const fullUrl = `${origin}${basePath}${slug}`;
  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase">Ativo</Badge>
      </div>
      <div className="flex items-stretch gap-1.5 flex-wrap">
        <div className="flex items-center flex-1 min-w-[200px] rounded-md border border-border/60 bg-background/40 overflow-hidden">
          <span className="px-2.5 text-[11px] text-muted-foreground whitespace-nowrap border-r border-border/40 py-2">
            {basePath}
          </span>
          <Input
            value={slug}
            onChange={(e) => onChange(e.target.value.replace(/\s/g, "-").toLowerCase())}
            className="border-0 bg-transparent h-9 px-2 text-[0.8125rem] focus-visible:ring-0"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            navigator.clipboard?.writeText(fullUrl);
            toast.success("Link copiado");
          }}
          className="gap-1.5"
        >
          <Copy className="h-3.5 w-3.5" /> Copiar
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(fullUrl, "_blank", "noopener,noreferrer")}
          className="gap-1.5"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Abrir
        </Button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground font-medium">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ThemeOption({ label, active, planned }: { label: string; active?: boolean; planned?: boolean }) {
  return (
    <div
      className={`rounded-lg border p-3 flex items-center justify-between ${
        active ? "border-primary/40 bg-primary/5" : "border-border/60 bg-muted/10"
      }`}
    >
      <span className={`text-sm font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
      {active ? <ActiveBadge /> : planned ? <PlannedBadge /> : null}
    </div>
  );
}

function ToggleRow({ label, hint, active, planned }: { label: string; hint?: string; active?: boolean; planned?: boolean }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 p-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {active ? <ActiveBadge /> : planned ? <PlannedBadge /> : null}
    </div>
  );
}

function LangOption({ label, active, planned }: { label: string; active?: boolean; planned?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 flex items-center justify-between ${active ? "border-primary/40 bg-primary/5" : "border-border/60 bg-muted/10"}`}>
      <div className="flex items-center gap-2">
        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
        <span className={`text-sm font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
      </div>
      {active ? <ActiveBadge /> : planned ? <PlannedBadge /> : null}
    </div>
  );
}

function NotifRow({
  id,
  label,
  hint,
  notifications,
  toggle,
}: {
  id: keyof NotificationSettings;
  label: string;
  hint?: string;
  notifications: NotificationSettings;
  toggle: (k: keyof NotificationSettings) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={notifications[id]} onCheckedChange={() => toggle(id)} />
    </div>
  );
}

function SecurityCard({
  icon: Icon,
  title,
  hint,
  status,
}: {
  icon: typeof Lock;
  title: string;
  hint: string;
  status: "managed" | "soon";
}) {
  return (
    <SettingsCard>
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
          <div className="mt-2">
            {status === "managed" ? (
              <Badge variant="outline" className="text-[10px]">Gerenciado pelo Supabase Auth</Badge>
            ) : (
              <SoonBadge />
            )}
          </div>
        </div>
      </div>
    </SettingsCard>
  );
}

function UsageStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
      <p className="text-sm font-semibold text-foreground mt-0.5">{value}</p>
    </div>
  );
}

function FeatureLi({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <li className="flex items-start gap-2">
      <Check className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${muted ? "text-muted-foreground" : "text-primary"}`} />
      <span className={muted ? "text-muted-foreground" : "text-foreground"}>{children}</span>
    </li>
  );
}

function IntegrationCard({
  icon: Icon,
  name,
  hint,
  state,
}: {
  icon: typeof Calendar;
  name: string;
  hint: string;
  state: "disconnected" | "planned" | "soon";
}) {
  const handle = () =>
    toast.info("Integração real será ativada em uma etapa futura.");
  return (
    <SettingsCard>
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        {state === "soon" ? <SoonBadge /> : state === "planned" ? <PlannedBadge /> : (
          <Badge variant="outline" className="text-[10px] uppercase">Desconectado</Badge>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full mt-3"
        onClick={handle}
        disabled={state !== "disconnected"}
      >
        {state === "disconnected" ? "Conectar" : "Em breve"}
      </Button>
    </SettingsCard>
  );
}

function DataCard({
  icon: Icon,
  title,
  hint,
  state,
  danger,
}: {
  icon: typeof Download;
  title: string;
  hint: string;
  state: "soon" | "info";
  danger?: boolean;
}) {
  return (
    <SettingsCard>
      <div className="flex items-start gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${danger ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        {state === "soon" ? <SoonBadge /> : <Badge variant="outline" className="text-[10px] uppercase">Local</Badge>}
      </div>
    </SettingsCard>
  );
}

export default Configuracoes;
