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
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { SettingsNav, type SettingsNavItem } from "@/components/settings/SettingsNav";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useAppSettings, type NotificationSettings } from "@/hooks/useAppSettings";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { SupportDrawer } from "@/components/support/SupportDrawer";
import { ClientPortalSection } from "@/components/settings/ClientPortalSection";
import { PlanSection } from "@/components/settings/PlanSection";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocalClientsImport } from "@/hooks/useLocalClientsImport";
import { useLocalTechnicalSheetsImport } from "@/hooks/useLocalTechnicalSheetsImport";
import { useLocalOpportunitiesImport } from "@/hooks/useLocalOpportunitiesImport";
import { LocalQuotesImportCard } from "@/components/settings/LocalQuotesImportCard";
import { QuotesSupabaseExperimentalToggleCard } from "@/components/settings/QuotesSupabaseExperimentalToggleCard";
import { SupabaseQuotesViewerCard } from "@/components/settings/SupabaseQuotesViewerCard";
import { CrmSupabaseCreateQuoteToggleCard } from "@/components/settings/CrmSupabaseCreateQuoteToggleCard";
import { QuotesSupabaseApprovalToggleCard } from "@/components/settings/QuotesSupabaseApprovalToggleCard";
import { QuotesSupabaseReceivableToggleCard } from "@/components/settings/QuotesSupabaseReceivableToggleCard";
import { QuotesSupabaseProjectToggleCard } from "@/components/settings/QuotesSupabaseProjectToggleCard";
import { SupabaseOperationalDashboardToggleCard } from "@/components/settings/SupabaseOperationalDashboardToggleCard";
import { SupabaseOperationalDashboardCard } from "@/components/settings/SupabaseOperationalDashboardCard";
import { QuotesSupabaseBaseTasksToggleCard } from "@/components/settings/QuotesSupabaseBaseTasksToggleCard";
import { QuotesSupabaseStatusTransitionToggleCard } from "@/components/settings/QuotesSupabaseStatusTransitionToggleCard";
import { QuotesSupabaseTechnicalSheetsAutoSaveToggleCard } from "@/components/settings/QuotesSupabaseTechnicalSheetsAutoSaveToggleCard";
import { useSupabaseClients } from "@/hooks/useSupabaseClients";
import { useAccessibility } from "@/contexts/AccessibilityContext";
import { useTranslation } from "@/contexts/LanguageContext";





const NAV_ITEMS: SettingsNavItem[] = [
  { id: "profile", label: "Perfil", icon: User },
  { id: "company", label: "Empresa", icon: Building2 },
  { id: "links", label: "Links públicos", icon: Link2 },
  { id: "appearance", label: "Aparência", icon: Palette },
  { id: "accessibility", label: "Acessibilidade", icon: Sparkles },
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
  acessibilidade: "accessibility",
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
  const { t, language, setLanguage } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = TAB_ALIASES[searchParams.get("tab") ?? ""] ?? searchParams.get("tab") ?? "profile";
  const [active, setActive] = useState(initialTab);
  const [supportOpen, setSupportOpen] = useState(false);
  const { profile, company, notifications, publicLinks, clientPortal, updateProfile, updateCompany, updatePublicLinks, updateClientPortal, resetClientPortal, toggleNotification } = useAppSettings();
  const { resetOnboarding } = useOnboarding();
  const { workspace, membership, loading: wsLoading } = useCurrentWorkspace();
  const { settings: accSettings, updateSetting: updateAccSetting } = useAccessibility();

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

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: "profile" | "company",
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Formato inválido. Use PNG, JPEG ou WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 2MB.");
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (target === "profile") {
        const next = { ...profileDraft, avatarUrl: dataUrl };
        setProfileDraft(next);
        updateProfile({ avatarUrl: dataUrl });
        toast.success("Foto de perfil atualizada");
      } else {
        const next = { ...companyDraft, logoUrl: dataUrl };
        setCompanyDraft(next);
        updateCompany({ logoUrl: dataUrl });
        toast.success("Logo da empresa atualizado");
      }
    } catch {
      toast.error("Não foi possível ler o arquivo.");
    }
  };

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={t("settings.title", "Configurações")}
        subtitle={t("settings.subtitle", "Gerencie sua conta, empresa e preferências do KORA HUB")}
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
                    {profileDraft.avatarUrl ? <AvatarImage src={profileDraft.avatarUrl} alt={profileDraft.name} /> : null}
                    <AvatarFallback className="orbit-gradient text-white text-lg font-bold">
                      {profileInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground truncate">{profileDraft.name || "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground truncate">{profileDraft.email}</p>
                  </div>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, "profile")}
                    />
                    <Button variant="outline" size="sm" className="gap-2 pointer-events-none">
                      <Upload className="h-4 w-4" />
                      {profileDraft.avatarUrl ? "Trocar foto" : "Alterar foto"}
                    </Button>
                  </label>
                  {profileDraft.avatarUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setProfileDraft({ ...profileDraft, avatarUrl: undefined });
                        updateProfile({ avatarUrl: undefined });
                        toast.success("Foto removida");
                      }}
                    >
                      Remover
                    </Button>
                  )}
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

              <SettingsCard title={t("settings.language", "Idioma")} className="mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <LangOption
                    label="Português (BR)"
                    active={language === "pt-BR"}
                    onClick={() => setLanguage("pt-BR")}
                  />
                  <LangOption
                    label="Português (PT)"
                    active={language === "pt-PT"}
                    onClick={() => setLanguage("pt-PT")}
                  />
                  <LangOption
                    label="English"
                    active={language === "en"}
                    onClick={() => setLanguage("en")}
                  />
                  <LangOption
                    label="Español"
                    active={language === "es"}
                    onClick={() => setLanguage("es")}
                  />
                </div>
              </SettingsCard>
            </SettingsSection>
          )}

          {active === "company" && (
            <SettingsSection title="Empresa" description="Dados do seu estúdio ou negócio.">



              <SettingsCard>
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-16 w-16 rounded-xl bg-primary/25 border border-primary/35 flex items-center justify-center text-white font-bold text-lg">
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

              <SettingsCard title={t("settings.language", "Idioma")}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <LangOption
                    label="Português (BR)"
                    active={language === "pt-BR"}
                    onClick={() => setLanguage("pt-BR")}
                  />
                  <LangOption
                    label="Português (PT)"
                    active={language === "pt-PT"}
                    onClick={() => setLanguage("pt-PT")}
                  />
                  <LangOption
                    label="English"
                    active={language === "en"}
                    onClick={() => setLanguage("en")}
                  />
                  <LangOption
                    label="Español"
                    active={language === "es"}
                    onClick={() => setLanguage("es")}
                  />
                </div>
              </SettingsCard>
            </SettingsSection>
          )}

          {active === "accessibility" && (
            <SettingsSection title="Acessibilidade" description="Personalize a interface com base no seu perfil visual ou cognitivo.">
              <SettingsCard title="Necessidades Visuais" description="Ajustes de contraste, zoom e daltonismo.">
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">Deficiência Visual / Baixa Visão</p>
                      <p className="text-xs text-muted-foreground">Aumenta a escala do texto da interface e adiciona bordas de alto contraste.</p>
                    </div>
                    <Switch checked={accSettings.lowVision} onCheckedChange={(v) => updateAccSetting("lowVision", v)} />
                  </div>
                  
                  {accSettings.lowVision && (
                    <div className="pl-6 border-l border-border/40 space-y-2 py-1">
                      <p className="text-xs font-semibold text-muted-foreground">Tamanho da Fonte Base (Escala):</p>
                      <div className="flex gap-2">
                        {([1.0, 1.15, 1.30] as const).map((scale) => (
                          <button
                            key={scale}
                            type="button"
                            onClick={() => updateAccSetting("fontSizeScale", scale)}
                            className={cn(
                              "px-3 py-1.5 text-xs font-semibold rounded border transition-all",
                              accSettings.fontSizeScale === scale
                                ? "border-primary bg-primary/10 text-primary font-bold"
                                : "border-border bg-background text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {scale === 1.0 ? "Padrão (100%)" : scale === 1.15 ? "Médio (115%)" : "Grande (130%)"}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator className="bg-border/30" />
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">Otimizar para Dislexia</p>
                      <p className="text-xs text-muted-foreground">Aumenta o espaçamento de caracteres e ajusta o fundo de texto.</p>
                    </div>
                    <Switch checked={accSettings.dyslexia} onCheckedChange={(v) => updateAccSetting("dyslexia", v)} />
                  </div>

                  {accSettings.dyslexia && (
                    <div className="pl-6 border-l border-border/40 flex items-center justify-between py-1">
                      <div>
                        <p className="text-xs font-semibold text-foreground">Forçar Fonte OpenDyslexic</p>
                        <p className="text-[10px] text-muted-foreground">Substitui a fonte do sistema por uma fonte geometricamente balanceada para leitura disléxica.</p>
                      </div>
                      <Switch checked={accSettings.dyslexicFontActive} onCheckedChange={(v) => updateAccSetting("dyslexicFontActive", v)} />
                    </div>
                  )}
                </div>
              </SettingsCard>

              <SettingsCard title="Filtros de Daltonismo">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["none", "deuteranopia", "protanopia", "tritanopia"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => updateAccSetting("daltonism", mode)}
                      className={cn(
                        "px-3 py-2 text-xs font-medium rounded-md border text-center transition-all capitalize",
                        accSettings.daltonism === mode
                          ? "border-primary bg-primary text-white"
                          : "border-border/80 bg-background text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {mode === "none" ? "Nenhum" : mode}
                    </button>
                  ))}
                </div>
              </SettingsCard>

              <SettingsCard title="Otimização Cognitiva / Neurodiversidade" description="Ajustes de estímulo, foco e tom de voz.">
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">TDAH / Foco Dinâmico</p>
                      <p className="text-xs text-muted-foreground">Desativa animações e transições de tela interativas.</p>
                    </div>
                    <Switch checked={accSettings.adhd} onCheckedChange={(v) => updateAccSetting("adhd", v)} />
                  </div>

                  {accSettings.adhd && (
                    <div className="pl-6 border-l border-border/40 flex items-center justify-between py-1">
                      <div>
                        <p className="text-xs font-semibold text-foreground">Modo Lanterna (Focus Spotlight)</p>
                        <p className="text-[10px] text-muted-foreground">Escurece as bordas da tela e ilumina apenas a área ao redor do cursor.</p>
                      </div>
                      <Switch checked={accSettings.focusSpotlightActive} onCheckedChange={(v) => updateAccSetting("focusSpotlightActive", v)} />
                    </div>
                  )}

                  <Separator className="bg-border/30" />
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">Autismo (TEA)</p>
                      <p className="text-xs text-muted-foreground">Tom de voz literal, desativa pop-ups de comemoração e modais automáticos.</p>
                    </div>
                    <Switch checked={accSettings.autism} onCheckedChange={(v) => updateAccSetting("autism", v)} />
                  </div>
                  <Separator className="bg-border/30" />
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">Reduzir Ansiedade / Depressão</p>
                      <p className="text-xs text-muted-foreground">Substitui alertas vermelhos por sugestões tranquilizadoras.</p>
                    </div>
                    <Switch checked={accSettings.anxiety} onCheckedChange={(v) => updateAccSetting("anxiety", v)} />
                  </div>
                  <Separator className="bg-border/30" />
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">Oscilação de Ritmo / Bipolaridade</p>
                      <p className="text-xs text-muted-foreground">Habilita ritmos flexíveis de prazos de entrega e adaptabilidade para dias de alta vs. baixa energia produtiva.</p>
                    </div>
                    <Switch checked={accSettings.bipolar} onCheckedChange={(v) => updateAccSetting("bipolar", v)} />
                  </div>
                  <Separator className="bg-border/30" />
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">Otimizar para Números / Discalculia</p>
                      <p className="text-xs text-muted-foreground">Arredonda faturamentos e valores numéricos complexos nos cartões principais.</p>
                    </div>
                    <Switch checked={accSettings.dyscalculia} onCheckedChange={(v) => updateAccSetting("dyscalculia", v)} />
                  </div>
                </div>
              </SettingsCard>

              <SettingsCard title="Limitações Motoras">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Limitações Motoras ( Parkinson / Tremores )</p>
                    <p className="text-xs text-muted-foreground">Amplia as áreas de clique e adiciona contornos nítidos para uso com teclado.</p>
                  </div>
                  <Switch checked={accSettings.motor} onCheckedChange={(v) => updateAccSetting("motor", v)} />
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

          {active === "plan" && <PlanSection />}


          {active === "integrations" && (
            <SettingsSection title="Integrações" description="Conecte ferramentas externas ao seu fluxo.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <IntegrationCard icon={Calendar} name="Google Calendar" hint="Sincronização de agenda" state="disconnected" />
                <IntegrationCard icon={HardDrive} name="Google Drive" hint="Anexos de projetos" state="disconnected" />
                <IntegrationCard icon={MessageCircle} name="WhatsApp Business" hint="Mensagens no app" state="disconnected" />
                <IntegrationCard icon={CreditCard} name="Asaas" hint="Pix, boleto e cartão" state="disconnected" />
                <IntegrationCard icon={CreditCard} name="Stripe / Paddle" hint="Pagamentos internacionais" state="planned" />
                <IntegrationCard icon={Bot} name="IA generativa" hint="Modelos de IA generativa" state="planned" />
                <IntegrationCard icon={Webhook} name="Webhooks" hint="Eventos para qualquer URL" state="soon" />
              </div>
            </SettingsSection>
          )}

          {active === "support" && (
            <SettingsSection title="Suporte" description="Estamos por perto quando você precisar.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SettingsCard>
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/25 border border-primary/35 text-white flex items-center justify-center">
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
                    <div className="h-10 w-10 rounded-lg bg-primary/25 border border-primary/35 text-white flex items-center justify-center">
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
                    <div className="h-10 w-10 rounded-lg bg-primary/25 border border-primary/35 text-white flex items-center justify-center">
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
                    <div className="h-10 w-10 rounded-lg bg-primary/25 border border-primary/35 text-white flex items-center justify-center">
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
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">
                      Reinicie o assistente inicial para reconfigurar os dados do seu estúdio (Geral).
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
                  </div>
                  <div className="pt-2 border-t border-border/40">
                    <p className="text-xs text-muted-foreground mb-2">
                      Reinicie o checklist de ativação comercial e operacional no Dashboard.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        try {
                          localStorage.removeItem("kora.onboarding.v1");
                          localStorage.removeItem("kora.daycenter.opened.v1");
                          window.dispatchEvent(new Event("kora:onboarding:refresh"));
                          toast.success("Checklist de ativação reiniciado!");
                        } catch {
                          toast.error("Erro ao reiniciar checklist.");
                        }
                      }}
                    >
                      Reativar checklist de ativação
                    </Button>
                  </div>
                </div>
              </SettingsCard>
            </SettingsSection>
          )}

          {active === "portal" && (
            <ClientPortalSection
              company={company}
              clientPortal={clientPortal}
              updateClientPortal={updateClientPortal}
              resetClientPortal={resetClientPortal}
            />
          )}

          {active === "data" && (
            <SettingsSection title="Dados" description="Exportação, importação e armazenamento.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DataCard icon={Download} title="Exportar dados" hint="Baixe seus dados em CSV/JSON" state="soon" />
                <DataCard icon={Upload} title="Importar dados" hint="Suba planilhas e migrações" state="soon" />
                <DataCard icon={Trash2} title="Limpar dados locais" hint="Remove dados de protótipo deste navegador" state="soon" danger />
                <DataCard icon={Database} title="Status de armazenamento" hint="Dados de protótipo salvos localmente" state="info" />
              </div>

              <div className="mt-6 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Migração de Dados Locais para o Supabase</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <LocalClientsImportCard />
                  <LocalOpportunitiesImportCard />
                  <LocalTechnicalSheetsImportCard />
                  <LocalQuotesImportCard />
                </div>
              </div>

              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300/90 flex items-start gap-2 mt-6">
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

function LangOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg border p-3 flex items-center justify-between transition-all ${
        active
          ? "border-primary/40 bg-primary/5 cursor-default text-foreground"
          : "border-border/60 bg-muted/10 hover:border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      <div className="flex items-center gap-2">
        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      {active && <ActiveBadge />}
    </button>
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
        <div className="h-10 w-10 rounded-lg bg-primary/25 border border-primary/35 text-white flex items-center justify-center shrink-0">
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
        <div className="h-10 w-10 rounded-lg bg-primary/25 border border-primary/35 text-white flex items-center justify-center shrink-0">
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

function LocalClientsImportCard() {
  const { workspace } = useCurrentWorkspace();
  const { candidates, importing, importSelected, metadata } = useLocalClientsImport();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const eligibleCandidates = useMemo(() => {
    return candidates.filter((c) => c.matchStatus !== "imported");
  }, [candidates]);

  const handleOpenDialog = () => {
    const initialSelected = candidates
      .filter((c) => c.matchStatus === "new")
      .map((c) => c.id);
    setSelectedIds(initialSelected);
    setIsOpen(true);
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === eligibleCandidates.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(eligibleCandidates.map((c) => c.id));
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleImport = async () => {
    if (selectedIds.length === 0) return;
    await importSelected(selectedIds);
    setIsOpen(false);
  };

  const totalLocals = candidates.length;
  const totalNew = candidates.filter((c) => c.matchStatus === "new").length;
  const totalDuplicate = candidates.filter((c) => c.matchStatus === "duplicate").length;
  const totalImported = candidates.filter((c) => c.matchStatus === "imported").length;

  if (!workspace) {
    return (
      <SettingsCard title="Importar clientes locais">
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Para importar seus clientes locais para o Supabase, você precisa de um Workspace ativo.
          </p>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300/90 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Nenhum Workspace Supabase ativo detectado. Conecte sua conta para habilitar esta importação.
          </div>
        </div>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard title="Importar clientes locais">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Detecte clientes salvos no armazenamento local (localStorage) deste navegador e envie-os para o workspace Supabase atual.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-3 bg-muted/10 border border-border/40 rounded-lg text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total Local</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{totalLocals}</p>
          </div>
          <div className="p-3 bg-muted/10 border border-border/40 rounded-lg text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Pendentes</p>
            <p className="text-lg font-bold text-emerald-400 mt-0.5">{eligibleCandidates.length}</p>
          </div>
          <div className="p-3 bg-muted/10 border border-border/40 rounded-lg text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Duplicados</p>
            <p className="text-lg font-bold text-amber-400 mt-0.5">{totalDuplicate}</p>
          </div>
          <div className="p-3 bg-muted/10 border border-border/40 rounded-lg text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Já Importados</p>
            <p className="text-lg font-bold text-blue-400 mt-0.5">{totalImported}</p>
          </div>
        </div>

        {metadata?.lastImportedAt && (
          <p className="text-[11px] text-muted-foreground italic">
            Última importação: {new Date(metadata.lastImportedAt).toLocaleString()}
          </p>
        )}

        <div className="rounded-lg border border-primary/20 bg-primary/[0.02] p-3 text-xs text-muted-foreground/90">
          <p className="font-semibold text-foreground mb-1">Aviso Híbrido:</p>
          Os clientes importados serão enviados para o Supabase, mas a tela Clientes ainda usa dados locais até a próxima etapa. Nenhum dado local será excluído. Para testar a leitura Supabase na tela Clientes, ative a fonte Supabase experimental.
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={handleOpenDialog}
              disabled={eligibleCandidates.length === 0 || importing}
              className="w-full gap-2 orbit-gradient text-white border-0"
            >
              Analisar importação
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl bg-card border-border/80 text-foreground">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Análise de Importação de Clientes</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Selecione os clientes locais que deseja importar para o Supabase. Duplicados foram sinalizados com base em e-mail, telefone ou nome e empresa iguais.
              </DialogDescription>
            </DialogHeader>

            <div className="my-4 border border-border/60 rounded-lg overflow-hidden bg-muted/5">
              <div className="grid grid-cols-[auto_1fr_120px_100px] items-center gap-4 bg-muted/30 px-4 py-2 text-xs font-semibold text-muted-foreground border-b border-border/60">
                <div className="flex items-center">
                  <Checkbox
                    id="select-all"
                    checked={eligibleCandidates.length > 0 && selectedIds.length === eligibleCandidates.length}
                    onCheckedChange={handleToggleSelectAll}
                    disabled={eligibleCandidates.length === 0}
                  />
                </div>
                <div>Cliente / Empresa</div>
                <div>Status</div>
                <div className="text-right font-medium">Ação</div>
              </div>

              {candidates.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Nenhum cliente local encontrado.
                </div>
              ) : (
                <div className="max-h-[300px] overflow-y-auto divide-y divide-border/40">
                  {candidates.map((candidate) => {
                    const isImported = candidate.matchStatus === "imported";
                    const isDuplicate = candidate.matchStatus === "duplicate";
                    const isChecked = selectedIds.includes(candidate.id);

                    return (
                      <div
                        key={candidate.id}
                        className={`grid grid-cols-[auto_1fr_120px_100px] items-center gap-4 px-4 py-3 text-xs ${
                          isImported ? "opacity-60 bg-muted/10" : ""
                        }`}
                      >
                        <div>
                          <Checkbox
                            id={`client-${candidate.id}`}
                            checked={isChecked || isImported}
                            onCheckedChange={() => handleToggleSelect(candidate.id)}
                            disabled={isImported}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{candidate.name}</p>
                          {candidate.company && (
                            <p className="text-[10px] text-muted-foreground truncate">{candidate.company}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground/80 truncate">
                            {candidate.email || "Sem e-mail"} {candidate.phone ? `• ${candidate.phone}` : ""}
                          </p>
                        </div>
                        <div>
                          {isImported ? (
                            <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20">
                              Já Importado
                            </Badge>
                          ) : isDuplicate ? (
                            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20">
                              Duplicado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                              Novo
                            </Badge>
                          )}
                        </div>
                        <div className="text-right">
                          {isImported ? (
                            <span className="text-[10px] text-muted-foreground">Importado</span>
                          ) : isChecked ? (
                            <span className="text-[10px] text-emerald-400 font-medium">Selecionado</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">Ignorar</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>{selectedIds.length} selecionado(s) para importação</span>
              {totalDuplicate > 0 && (
                <span className="text-amber-400/90 font-medium flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> {totalDuplicate} duplicado(s) detectado(s)
                </span>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0 mt-4">
              <Button variant="outline" size="sm" onClick={() => setIsOpen(false)} disabled={importing}>
                Cancelar
              </Button>
              <Button
                onClick={handleImport}
                disabled={selectedIds.length === 0 || importing}
                size="sm"
                className="gap-1.5 orbit-gradient text-white border-0"
              >
                {importing ? "Importando..." : "Importar selecionados"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SettingsCard>
  );
}

function SupabaseClientsViewerCard() {
  const { workspace } = useCurrentWorkspace();
  const { clients, loading, error, refreshClients } = useSupabaseClients();
  const { metadata } = useLocalClientsImport();

  const isImportedFromLocal = useMemo(() => {
    if (!metadata?.importedMap) return new Set<string>();
    return new Set<string>(Object.values(metadata.importedMap));
  }, [metadata]);

  const visibleClients = useMemo(() => {
    return (clients || []).slice(0, 10);
  }, [clients]);

  if (!workspace) return null;

  return (
    <SettingsCard 
      title="Clientes no Supabase" 
      headerActions={
        <Button 
          variant="outline" 
          size="sm" 
          onClick={refreshClients} 
          disabled={loading}
          className="h-8 gap-1.5 px-2.5"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Visualização em tempo real dos clientes armazenados na nuvem (Supabase) para o workspace atual.
        </p>

        <div className="rounded-lg border border-primary/20 bg-primary/[0.02] p-3 text-xs text-muted-foreground/90">
          Esta visualização confirma os dados já importados para o Supabase. A tela principal de Clientes ainda usa localStorage nesta fase.
        </div>

        {loading ? (
          <div className="py-8 flex items-center justify-center text-xs text-muted-foreground gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
            Carregando clientes do Supabase...
          </div>
        ) : error ? (
          <div className="p-4 border border-destructive/30 bg-destructive/5 rounded-lg text-xs text-destructive flex flex-col gap-2">
            <p className="font-semibold">Erro ao carregar clientes:</p>
            <p className="opacity-90">{error.message || "Erro desconhecido"}</p>
            <Button variant="outline" size="sm" onClick={refreshClients} className="w-fit self-end mt-2">
              Tentar novamente
            </Button>
          </div>
        ) : !clients || clients.length === 0 ? (
          <div className="py-8 border border-dashed border-border/60 rounded-lg text-center text-xs text-muted-foreground">
            Nenhum cliente encontrado no Supabase para este workspace.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="border border-border/60 rounded-lg overflow-hidden bg-muted/5 divide-y divide-border/40">
              {visibleClients.map((client: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                const imported = isImportedFromLocal.has(client.id);
                return (
                  <div key={client.id} className="p-3 flex items-start justify-between gap-4 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground truncate">{client.name}</span>
                        <Badge variant="outline" className="text-[9px] uppercase tracking-wide text-primary border-primary/30 py-0 px-1.5">
                          Supabase
                        </Badge>
                        {imported && (
                          <Badge variant="outline" className="text-[9px] uppercase tracking-wide text-emerald-400 border-emerald-500/20 bg-emerald-500/10 py-0 px-1.5">
                            Importado do local
                          </Badge>
                        )}
                      </div>
                      {client.company && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{client.company}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/80 mt-0.5 truncate">
                        {client.email || "Sem e-mail"} {client.phone ? `• ${client.phone}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant="outline" className="text-[10px] bg-muted capitalize">
                        {client.status || "Ativo"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center text-[11px] text-muted-foreground">
              <span>Total no Supabase: {clients.length} cliente(s)</span>
              {clients.length > 10 && (
                <span>Mostrando os 10 primeiros</span>
              )}
            </div>
          </div>
        )}
      </div>
    </SettingsCard>
  );
}

function LocalTechnicalSheetsImportCard() {
  const { workspace } = useCurrentWorkspace();
  const { candidates, importing, importSelected, metadata } = useLocalTechnicalSheetsImport();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const eligibleCandidates = useMemo(() => {
    return candidates.filter((c) => c.status === "pronto");
  }, [candidates]);

  const handleOpenDialog = () => {
    setSelectedIds(eligibleCandidates.map((c) => c.localClientId));
    setIsOpen(true);
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === eligibleCandidates.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(eligibleCandidates.map((c) => c.localClientId));
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleImport = async () => {
    if (selectedIds.length === 0) return;
    await importSelected(selectedIds);
    setIsOpen(false);
  };

  const totalWithSheet = candidates.filter((c) => c.status !== "sem_ficha").length;
  const totalClientImported = candidates.filter((c) => c.supabaseClientId).length;
  const totalPending = candidates.filter((c) => c.status === "pronto").length;
  const totalExists = candidates.filter((c) => c.status === "existe").length;

  if (!workspace) return null;

  return (
    <SettingsCard title="Importar Fichas Técnicas">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Importe as Fichas Técnicas (Briefing, Marcas, Personas e referências de links) dos clientes que já foram importados para o Supabase.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-3 bg-muted/10 border border-border/40 rounded-lg text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Locais c/ Ficha</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{totalWithSheet}</p>
          </div>
          <div className="p-3 bg-muted/10 border border-border/40 rounded-lg text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Cliente na Nuvem</p>
            <p className="text-lg font-bold text-blue-400 mt-0.5">{totalClientImported}</p>
          </div>
          <div className="p-3 bg-muted/10 border border-border/40 rounded-lg text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Prontos</p>
            <p className="text-lg font-bold text-emerald-400 mt-0.5">{totalPending}</p>
          </div>
          <div className="p-3 bg-muted/10 border border-border/40 rounded-lg text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Já Importados</p>
            <p className="text-lg font-bold text-amber-400 mt-0.5">{totalExists}</p>
          </div>
        </div>

        {metadata?.lastImportedAt && (
          <p className="text-[11px] text-muted-foreground italic">
            Última importação de fichas: {new Date(metadata.lastImportedAt).toLocaleString()}
          </p>
        )}

        <div className="rounded-lg border border-primary/20 bg-primary/[0.02] p-3 text-xs text-muted-foreground/90">
          <p className="font-semibold text-foreground mb-1">Aviso de Backup Híbrido:</p>
          A página Ficha Técnica principal continua usando localStorage nesta fase. O backup no Supabase servirá para transição futura. Arquivos binários locais não são migrados.
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={handleOpenDialog}
              disabled={eligibleCandidates.length === 0 || importing}
              className="w-full gap-2 orbit-gradient text-white border-0"
            >
              Analisar importação
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl bg-card border-border/80 text-foreground">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Análise de Importação de Fichas Técnicas</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Selecione as fichas técnicas dos clientes importados que deseja migrar para o Supabase.
              </DialogDescription>
            </DialogHeader>

            <div className="my-4 border border-border/60 rounded-lg overflow-hidden bg-muted/5">
              <div className="grid grid-cols-[auto_1fr_150px_100px] items-center gap-4 bg-muted/30 px-4 py-2 text-xs font-semibold text-muted-foreground border-b border-border/60">
                <div className="flex items-center">
                  <Checkbox
                    id="select-all-sheets"
                    checked={eligibleCandidates.length > 0 && selectedIds.length === eligibleCandidates.length}
                    onCheckedChange={handleToggleSelectAll}
                    disabled={eligibleCandidates.length === 0}
                  />
                </div>
                <div>Cliente / Empresa</div>
                <div>Status</div>
                <div className="text-right font-medium">Ação</div>
              </div>

              {candidates.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Nenhum cliente local com ficha técnica elegível encontrado.
                </div>
              ) : (
                <div className="max-h-[300px] overflow-y-auto divide-y divide-border/40">
                  {candidates.map((candidate) => {
                    const isPronto = candidate.status === "pronto";
                    const isChecked = selectedIds.includes(candidate.localClientId);

                    return (
                      <div
                        key={candidate.localClientId}
                        className={`grid grid-cols-[auto_1fr_150px_100px] items-center gap-4 px-4 py-3 text-xs ${
                          !isPronto ? "opacity-60 bg-muted/10" : ""
                        }`}
                      >
                        <div>
                          <Checkbox
                            id={`sheet-${candidate.localClientId}`}
                            checked={isChecked || candidate.status === "existe"}
                            onCheckedChange={() => handleToggleSelect(candidate.localClientId)}
                            disabled={!isPronto}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{candidate.name}</p>
                          {candidate.company && (
                            <p className="text-[10px] text-muted-foreground truncate">{candidate.company}</p>
                          )}
                        </div>
                        <div>
                          {candidate.status === "existe" ? (
                            <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20">
                              Já Importada
                            </Badge>
                          ) : candidate.status === "sem_cliente" ? (
                            <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-400 border-red-500/20">
                              Cliente não importado
                            </Badge>
                          ) : candidate.status === "sem_ficha" ? (
                            <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                              Sem ficha
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                              Pronto para importar
                            </Badge>
                          )}
                        </div>
                        <div className="text-right">
                          {candidate.status === "existe" ? (
                            <span className="text-[10px] text-muted-foreground">Importada</span>
                          ) : isChecked && isPronto ? (
                            <span className="text-[10px] text-emerald-400 font-medium">Selecionada</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">Ignorar</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>{selectedIds.length} selecionada(s) para importação</span>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 mt-4">
              <Button variant="outline" size="sm" onClick={() => setIsOpen(false)} disabled={importing}>
                Cancelar
              </Button>
              <Button
                onClick={handleImport}
                disabled={selectedIds.length === 0 || importing}
                size="sm"
                className="gap-1.5 orbit-gradient text-white border-0"
              >
                {importing ? "Importando..." : "Importar selecionadas"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SettingsCard>
  );
}

function SupabaseExperimentalToggleCard() {
  const [enabled, setEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem("kora.technicalSheets.supabaseExperimental.enabled");
      return saved === "false" ? false : true; // Default to true
    } catch {
      return true;
    }
  });

  const handleToggle = () => {
    const nextVal = !enabled;
    try {
      localStorage.setItem("kora.technicalSheets.supabaseExperimental.enabled", String(nextVal));
    } catch (e) {
      console.error(e);
    }
    setEnabled(nextVal);
    toast.success(`Modo experimental da Ficha Técnica ${nextVal ? "ativado" : "desativado"}.`);
  };

  return (
    <SettingsCard title="Modo Supabase Experimental da Ficha Técnica">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground leading-normal">
          Permite testar a leitura e salvamento manual da Ficha Técnica no Supabase. O modo local continua preservado.
        </p>
        <div className="flex items-center justify-between gap-4 py-2 px-3 border border-border/60 bg-muted/10 rounded-lg">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${enabled ? "bg-emerald-500" : "bg-muted-foreground/45"}`} />
            <span className="text-xs font-semibold text-foreground">
              Status: {enabled ? "Ativo" : "Inativo"}
            </span>
          </div>
          <Button
            size="sm"
            variant={enabled ? "destructive" : "default"}
            className="text-xs h-8"
            onClick={handleToggle}
          >
            {enabled ? "Desativar" : "Ativar"}
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}

function CrmSupabaseExperimentalToggleCard() {
  const [enabled, setEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem("kora.crm.supabaseExperimental.enabled");
      return saved === "true"; // Default to false
    } catch {
      return false;
    }
  });

  const handleToggle = () => {
    const nextVal = !enabled;
    try {
      localStorage.setItem("kora.crm.supabaseExperimental.enabled", String(nextVal));
    } catch (e) {
      console.error(e);
    }
    setEnabled(nextVal);
    toast.success(`CRM Supabase Experimental ${nextVal ? "ativado" : "desativado"}.`);
  };

  return (
    <SettingsCard title="CRM Supabase Experimental">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground leading-normal">
          Permite visualizar oportunidades importadas no Supabase. O CRM operacional continua local nesta etapa.
        </p>
        <div className="flex items-center justify-between gap-4 py-2 px-3 border border-border/60 bg-muted/10 rounded-lg">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${enabled ? "bg-emerald-500" : "bg-muted-foreground/45"}`} />
            <span className="text-xs font-semibold text-foreground">
              Status: {enabled ? "Ativo" : "Inativo"}
            </span>
          </div>
          <Button
            size="sm"
            variant={enabled ? "destructive" : "default"}
            className="text-xs h-8"
            onClick={handleToggle}
          >
            {enabled ? "Desativar" : "Ativar"}
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}

function CrmSupabaseStageMoveToggleCard() {
  const [enabled, setEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem("kora.crm.supabaseStageMove.enabled");
      return saved === "true"; // Default to false
    } catch {
      return false;
    }
  });

  const handleToggle = () => {
    const nextVal = !enabled;
    try {
      localStorage.setItem("kora.crm.supabaseStageMove.enabled", String(nextVal));
    } catch (e) {
      console.error(e);
    }
    setEnabled(nextVal);
    toast.success(`Movimentação de estágio no CRM Supabase ${nextVal ? "ativada" : "desativada"}.`);
  };

  return (
    <SettingsCard title="CRM Supabase - Mover Estágio Experimental">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground leading-normal">
          Permitir mover estágio no CRM Supabase. Permite testar a movimentação de oportunidades entre etapas diretamente no Supabase. Criação, edição e exclusão continuam bloqueadas.
        </p>
        <div className="flex items-center justify-between gap-4 py-2 px-3 border border-border/60 bg-muted/10 rounded-lg">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${enabled ? "bg-emerald-500" : "bg-muted-foreground/45"}`} />
            <span className="text-xs font-semibold text-foreground">
              Status: {enabled ? "Ativo" : "Inativo"}
            </span>
          </div>
          <Button
            size="sm"
            variant={enabled ? "destructive" : "default"}
            className="text-xs h-8"
            onClick={handleToggle}
          >
            {enabled ? "Desativar" : "Ativar"}
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}

function CrmSupabaseBasicEditToggleCard() {
  const [enabled, setEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem("kora.crm.supabaseBasicEdit.enabled");
      return saved === "true"; // Default to false
    } catch {
      return false;
    }
  });

  const handleToggle = () => {
    const nextVal = !enabled;
    try {
      localStorage.setItem("kora.crm.supabaseBasicEdit.enabled", String(nextVal));
    } catch (e) {
      console.error(e);
    }
    setEnabled(nextVal);
    toast.success(`CRM Supabase - Edição Básica Experimental ${nextVal ? "ativado" : "desativado"}.`);
  };

  return (
    <SettingsCard title="CRM Supabase - Edição Básica Experimental">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground leading-normal">
          Permite editar campos básicos de oportunidades no Supabase. Criação, exclusão, conversão e orçamentos continuam bloqueados.
        </p>
        <div className="flex items-center justify-between gap-4 py-2 px-3 border border-border/60 bg-muted/10 rounded-lg">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${enabled ? "bg-emerald-500" : "bg-muted-foreground/45"}`} />
            <span className="text-xs font-semibold text-foreground">
              Status: {enabled ? "Ativo" : "Inativo"}
            </span>
          </div>
          <Button
            size="sm"
            variant={enabled ? "destructive" : "default"}
            className="text-xs h-8"
            onClick={handleToggle}
          >
            {enabled ? "Desativar" : "Ativar"}
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}

function CrmSupabaseCreateToggleCard() {
  const [enabled, setEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem("kora.crm.supabaseCreate.enabled");
      return saved === "true"; // Default to false
    } catch {
      return false;
    }
  });

  const handleToggle = () => {
    const nextVal = !enabled;
    try {
      localStorage.setItem("kora.crm.supabaseCreate.enabled", String(nextVal));
    } catch (e) {
      console.error(e);
    }
    setEnabled(nextVal);
    toast.success(`CRM Supabase - Criar Oportunidade Experimental ${nextVal ? "ativado" : "desativado"}.`);
  };

  return (
    <SettingsCard title="CRM Supabase - Criar Oportunidade Experimental">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground leading-normal">
          Permite criar oportunidades diretamente no Supabase. Arquivar, excluir, converter e criar orçamento continuam bloqueados.
        </p>
        <div className="flex items-center justify-between gap-4 py-2 px-3 border border-border/60 bg-muted/10 rounded-lg">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${enabled ? "bg-emerald-500" : "bg-muted-foreground/45"}`} />
            <span className="text-xs font-semibold text-foreground">
              Status: {enabled ? "Ativo" : "Inativo"}
            </span>
          </div>
          <Button
            size="sm"
            variant={enabled ? "destructive" : "default"}
            className="text-xs h-8"
            onClick={handleToggle}
          >
            {enabled ? "Desativar" : "Ativar"}
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}

function CrmSupabaseArchiveToggleCard() {
  const [enabled, setEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem("kora.crm.supabaseArchive.enabled");
      return saved === "true"; // Default to false
    } catch {
      return false;
    }
  });

  const handleToggle = () => {
    const nextVal = !enabled;
    try {
      localStorage.setItem("kora.crm.supabaseArchive.enabled", String(nextVal));
    } catch (e) {
      console.error(e);
    }
    setEnabled(nextVal);
    toast.success(`CRM Supabase - Arquivar Oportunidade Experimental ${nextVal ? "ativado" : "desativado"}.`);
  };

  return (
    <SettingsCard title="CRM Supabase - Arquivar Oportunidade Experimental">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground leading-normal">
          Permite arquivar oportunidades no Supabase. Exclusão definitiva, restauração, conversão e orçamentos continuam bloqueados.
        </p>
        <div className="flex items-center justify-between gap-4 py-2 px-3 border border-border/60 bg-muted/10 rounded-lg">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${enabled ? "bg-emerald-500" : "bg-muted-foreground/45"}`} />
            <span className="text-xs font-semibold text-foreground">
              Status: {enabled ? "Ativo" : "Inativo"}
            </span>
          </div>
          <Button
            size="sm"
            variant={enabled ? "destructive" : "default"}
            className="text-xs h-8"
            onClick={handleToggle}
          >
            {enabled ? "Desativar" : "Ativar"}
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}

function CrmSupabaseRestoreArchiveToggleCard() {
  const [enabled, setEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem("kora.crm.supabaseRestoreArchive.enabled");
      return saved === "true"; // Default to false
    } catch {
      return false;
    }
  });

  const handleToggle = () => {
    const nextVal = !enabled;
    try {
      localStorage.setItem("kora.crm.supabaseRestoreArchive.enabled", String(nextVal));
    } catch (e) {
      console.error(e);
    }
    setEnabled(nextVal);
    toast.success(`CRM Supabase - Restaurar Arquivadas Experimental ${nextVal ? "ativado" : "desativado"}.`);
  };

  return (
    <SettingsCard title="CRM Supabase - Restaurar Arquivadas Experimental">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground leading-normal">
          Permite restaurar oportunidades arquivadas no Supabase. Exclusão definitiva, conversão e orçamentos continuam bloqueados.
        </p>
        <div className="flex items-center justify-between gap-4 py-2 px-3 border border-border/60 bg-muted/10 rounded-lg">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${enabled ? "bg-emerald-500" : "bg-muted-foreground/45"}`} />
            <span className="text-xs font-semibold text-foreground">
              Status: {enabled ? "Ativo" : "Inativo"}
            </span>
          </div>
          <Button
            size="sm"
            variant={enabled ? "destructive" : "default"}
            className="text-xs h-8"
            onClick={handleToggle}
          >
            {enabled ? "Desativar" : "Ativar"}
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}

function LocalOpportunitiesImportCard() {
  const { workspace } = useCurrentWorkspace();
  const { candidates, importing, importSelected, metadata } = useLocalOpportunitiesImport();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const eligibleCandidates = useMemo(() => {
    return candidates.filter((c) => c.matchStatus !== "imported");
  }, [candidates]);

  const handleOpenDialog = () => {
    setSelectedIds(eligibleCandidates.map((c) => c.id));
    setIsOpen(true);
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === eligibleCandidates.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(eligibleCandidates.map((c) => c.id));
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleImport = async () => {
    if (selectedIds.length === 0) return;
    await importSelected(selectedIds);
    setIsOpen(false);
  };

  const totalLocals = candidates.length;
  const totalPending = eligibleCandidates.filter((c) => c.matchStatus === "new").length;
  const totalDuplicate = eligibleCandidates.filter((c) => c.matchStatus === "duplicate").length;
  const totalImported = candidates.filter((c) => c.matchStatus === "imported").length;

  if (!workspace) return null;

  return (
    <SettingsCard title="Importar Oportunidades Locais">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Importe as Oportunidades e Leads comerciais locais armazenados no navegador para a nuvem do Supabase.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-3 bg-muted/10 border border-border/40 rounded-lg text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total Local</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{totalLocals}</p>
          </div>
          <div className="p-3 bg-muted/10 border border-border/40 rounded-lg text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Novos</p>
            <p className="text-lg font-bold text-emerald-400 mt-0.5">{totalPending}</p>
          </div>
          <div className="p-3 bg-muted/10 border border-border/40 rounded-lg text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Duplicados</p>
            <p className="text-lg font-bold text-amber-400 mt-0.5">{totalDuplicate}</p>
          </div>
          <div className="p-3 bg-muted/10 border border-border/40 rounded-lg text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Já Importados</p>
            <p className="text-lg font-bold text-blue-400 mt-0.5">{totalImported}</p>
          </div>
        </div>

        {metadata?.lastImportedAt && (
          <p className="text-[11px] text-muted-foreground italic">
            Última importação de oportunidades: {new Date(metadata.lastImportedAt).toLocaleString()}
          </p>
        )}

        <div className="rounded-lg border border-primary/20 bg-primary/[0.02] p-3 text-xs text-muted-foreground/90">
          <p className="font-semibold text-foreground mb-1">Aviso Híbrido:</p>
          As oportunidades importadas serão enviadas para o Supabase, mas a tela principal de CRM ainda usa dados locais nesta fase até a homologação completa.
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={handleOpenDialog}
              disabled={eligibleCandidates.length === 0 || importing}
              className="w-full gap-2 orbit-gradient text-white border-0"
            >
              Analisar importação
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl bg-card border-border/80 text-foreground">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Análise de Importação de Oportunidades</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Selecione as oportunidades comerciais que deseja importar para o Supabase. Duplicados foram sinalizados com base em e-mail, whatsapp ou título e empresa idênticos.
              </DialogDescription>
            </DialogHeader>

            <div className="my-4 border border-border/60 rounded-lg overflow-hidden bg-muted/5">
              <div className="grid grid-cols-[auto_1fr_120px_100px] items-center gap-4 bg-muted/30 px-4 py-2 text-xs font-semibold text-muted-foreground border-b border-border/60">
                <div className="flex items-center">
                  <Checkbox
                    id="select-all-opps"
                    checked={eligibleCandidates.length > 0 && selectedIds.length === eligibleCandidates.length}
                    onCheckedChange={handleToggleSelectAll}
                    disabled={eligibleCandidates.length === 0}
                  />
                </div>
                <div>Oportunidade / Empresa</div>
                <div>Status</div>
                <div className="text-right font-medium">Ação</div>
              </div>

              {candidates.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Nenhuma oportunidade local elegível encontrada.
                </div>
              ) : (
                <div className="max-h-[300px] overflow-y-auto divide-y divide-border/40">
                  {candidates.map((candidate) => {
                    const isImported = candidate.matchStatus === "imported";
                    const isDuplicate = candidate.matchStatus === "duplicate";
                    const isChecked = selectedIds.includes(candidate.id);

                    return (
                      <div
                        key={candidate.id}
                        className={`grid grid-cols-[auto_1fr_120px_100px] items-center gap-4 px-4 py-3 text-xs ${
                          isImported ? "opacity-60 bg-muted/10" : ""
                        }`}
                      >
                        <div>
                          <Checkbox
                            id={`opp-${candidate.id}`}
                            checked={isChecked || isImported}
                            onCheckedChange={() => handleToggleSelect(candidate.id)}
                            disabled={isImported}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{candidate.name}</p>
                          {candidate.company && (
                            <p className="text-[10px] text-muted-foreground truncate">{candidate.company}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground/80 truncate">
                            {candidate.email || "Sem e-mail"} {candidate.phone ? `• ${candidate.phone}` : ""}
                          </p>
                        </div>
                        <div>
                          {isImported ? (
                            <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20">
                              Já Importada
                            </Badge>
                          ) : isDuplicate ? (
                            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20">
                              Duplicado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                              Novo
                            </Badge>
                          )}
                        </div>
                        <div className="text-right">
                          {isImported ? (
                            <span className="text-[10px] text-muted-foreground">Importada</span>
                          ) : isChecked ? (
                            <span className="text-[10px] text-emerald-400 font-medium">Selecionada</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">Ignorar</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>{selectedIds.length} selecionada(s) para importação</span>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 mt-4">
              <Button variant="outline" size="sm" onClick={() => setIsOpen(false)} disabled={importing}>
                Cancelar
              </Button>
              <Button
                onClick={handleImport}
                disabled={selectedIds.length === 0 || importing}
                size="sm"
                className="gap-1.5 orbit-gradient text-white border-0"
              >
                {importing ? "Importando..." : "Importar selecionadas"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SettingsCard>
  );
}

function SupabaseCrmViewerCard() {
  return (
    <SettingsCard title="CRM Supabase">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 uppercase font-mono">
            Infraestrutura pronta / experimental
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground leading-normal">
          A persistência de oportunidades no Supabase foi preparada. A tela CRM principal ainda usa dados locais até a etapa de importação e validação.
        </p>
      </div>
    </SettingsCard>
  );
}

export default Configuracoes;
