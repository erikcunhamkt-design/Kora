import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Users,
  Eye,
  RotateCcw,
  Save,
  Send,
  ImageIcon,
  Sparkles,
  ShieldCheck,
  LayoutGrid,
} from "lucide-react";

import { SettingsSection } from "@/components/settings/SettingsSection";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  DEFAULT_CLIENT_PORTAL,
  type ClientPortalPermissions,
  type ClientPortalSettings,
  type ClientPortalStyle,
  type ClientPortalTabs,
  type CompanySettings,
} from "@/hooks/useAppSettings";
import { cn } from "@/lib/utils";

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

const STYLE_OPTIONS: { id: ClientPortalStyle; label: string; hint: string }[] = [
  { id: "essencial", label: "Essencial", hint: "Limpo e direto" },
  { id: "premium", label: "Premium", hint: "Visual sofisticado" },
  { id: "editorial", label: "Editorial", hint: "Tipografia em destaque" },
  { id: "minimal", label: "Minimal", hint: "Apenas o essencial visível" },
];

const PERMISSION_FIELDS: { id: keyof ClientPortalPermissions; label: string; hint: string }[] = [
  { id: "viewProjects", label: "Ver projetos", hint: "Acompanhar o andamento" },
  { id: "viewTasks", label: "Ver tarefas", hint: "Visualizar lista de tarefas" },
  { id: "createTasks", label: "Criar tarefas", hint: "Sugerir novas tarefas" },
  { id: "commentTasks", label: "Comentar tarefas", hint: "Trocar feedback rápido" },
  { id: "viewQuotes", label: "Ver orçamentos", hint: "Acessar propostas comerciais" },
  { id: "approveQuotes", label: "Aprovar orçamentos", hint: "Confirmar propostas online" },
  { id: "viewFiles", label: "Ver arquivos", hint: "Baixar entregas finais" },
  { id: "requestService", label: "Solicitar novo serviço", hint: "Pedidos diretos pelo portal" },
  { id: "viewReports", label: "Ver relatórios", hint: "Métricas e resultados" },
];

const TAB_FIELDS: { id: keyof ClientPortalTabs; label: string; hint: string }[] = [
  { id: "requests", label: "Aba Solicitações", hint: "Exibir lista de pedidos do cliente" },
  { id: "reports", label: "Aba Relatórios", hint: "Exibir dashboards e resultados" },
  { id: "projectProgress", label: "Progresso do projeto", hint: "Barra de andamento por projeto" },
  { id: "approvalHistory", label: "Histórico de aprovações", hint: "Linha do tempo de decisões" },
];

function initialsOf(value: string) {
  return (
    value
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "CP"
  );
}

interface Props {
  company: CompanySettings;
  clientPortal: ClientPortalSettings;
  updateClientPortal: (next: ClientPortalSettings) => void;
  resetClientPortal: () => void;
}

export function ClientPortalSection({ company, clientPortal, updateClientPortal, resetClientPortal }: Props) {
  const [draft, setDraft] = useState<ClientPortalSettings>(clientPortal);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    setDraft(clientPortal);
  }, [clientPortal]);

  const effectiveBrand = draft.brandName.trim() || company.name || "Sua marca";

  const hexErrors = useMemo(() => {
    return {
      primaryColor: !HEX_RE.test(draft.primaryColor),
      buttonTextColor: !HEX_RE.test(draft.buttonTextColor),
      backgroundColor: !HEX_RE.test(draft.backgroundColor),
      loginBgColor: !HEX_RE.test(draft.loginBgColor),
    };
  }, [draft]);

  const hasInvalid = Object.values(hexErrors).some(Boolean);

  const setField = <K extends keyof ClientPortalSettings>(key: K, value: ClientPortalSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const togglePermission = (id: keyof ClientPortalPermissions) =>
    setDraft((d) => ({ ...d, permissions: { ...d.permissions, [id]: !d.permissions[id] } }));

  const toggleTab = (id: keyof ClientPortalTabs) =>
    setDraft((d) => ({ ...d, tabs: { ...d.tabs, [id]: !d.tabs[id] } }));

  const handleSave = () => {
    if (hasInvalid) {
      toast.error("Verifique as cores. Use formato HEX #RRGGBB.");
      return;
    }
    updateClientPortal(draft);
    toast.success("Rascunho do portal salvo localmente");
  };

  const handleReset = () => {
    setDraft(DEFAULT_CLIENT_PORTAL);
    resetClientPortal();
    toast.info("Configurações do portal restauradas");
  };

  const handlePublish = () =>
    toast.info("Publicação do portal será ativada futuramente.");

  return (
    <SettingsSection
      title="Portal do Cliente"
      description="Configure a experiência que seus clientes verão futuramente."
      actions={
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
          Esboço
        </Badge>
      }
    >
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground flex items-start gap-2">
        <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
        Esta é uma prévia local. O portal real será ativado em uma etapa futura com login,
        permissões e dados seguros.
      </div>

      {/* Preview */}
      <SettingsCard title="Prévia do portal" description="Visual aproximado do que o cliente verá.">
        <PortalPreview brand={effectiveBrand} draft={draft} compact />
        <div className="flex justify-end mt-3">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-3.5 w-3.5" /> Pré-visualizar em tela cheia
          </Button>
        </div>
      </SettingsCard>

      {/* Identidade visual */}
      <SettingsCard title="Identidade visual" description="Marca e cores do portal.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldLabel label="Nome exibido da marca" hint="Aparece no cabeçalho do portal">
            <Input
              value={draft.brandName}
              placeholder={company.name || "Sua marca"}
              onChange={(e) => setField("brandName", e.target.value)}
            />
          </FieldLabel>
          <FieldLabel label="Estilo do portal">
            <div className="grid grid-cols-2 gap-2">
              {STYLE_OPTIONS.map((opt) => {
                const active = draft.style === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setField("style", opt.id)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left transition-colors",
                      active
                        ? "border-primary/40 bg-primary/10"
                        : "border-border/60 bg-muted/10 hover:border-primary/20",
                    )}
                  >
                    <p className="text-xs font-semibold text-foreground">{opt.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{opt.hint}</p>
                  </button>
                );
              })}
            </div>
          </FieldLabel>

          <ColorField
            label="Cor principal"
            value={draft.primaryColor}
            invalid={hexErrors.primaryColor}
            onChange={(v) => setField("primaryColor", v)}
          />
          <ColorField
            label="Cor do texto do botão"
            value={draft.buttonTextColor}
            invalid={hexErrors.buttonTextColor}
            onChange={(v) => setField("buttonTextColor", v)}
          />
          <ColorField
            label="Cor de fundo"
            value={draft.backgroundColor}
            invalid={hexErrors.backgroundColor}
            onChange={(v) => setField("backgroundColor", v)}
          />
        </div>
      </SettingsCard>

      {/* Tela de login */}
      <SettingsCard title="Tela de login" description="Personalize a entrada do cliente.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldLabel label="Título">
            <Input value={draft.loginTitle} onChange={(e) => setField("loginTitle", e.target.value)} />
          </FieldLabel>
          <FieldLabel label="Mensagem curta">
            <Input value={draft.loginMessage} onChange={(e) => setField("loginMessage", e.target.value)} />
          </FieldLabel>
          <ColorField
            label="Cor de fundo (sem imagem)"
            value={draft.loginBgColor}
            invalid={hexErrors.loginBgColor}
            onChange={(v) => setField("loginBgColor", v)}
          />
          <FieldLabel label="Imagem de fundo">
            <Button variant="outline" size="sm" disabled className="gap-2 w-full justify-start">
              <ImageIcon className="h-3.5 w-3.5" /> Enviar imagem
              <Badge variant="outline" className="ml-auto text-[10px] uppercase">Em breve</Badge>
            </Button>
          </FieldLabel>
        </div>
      </SettingsCard>

      {/* Permissões */}
      <SettingsCard
        title="Permissões do cliente"
        description="Rascunho local. Nenhuma permissão real é aplicada ainda."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 divide-y divide-border/40 sm:divide-y-0">
          {PERMISSION_FIELDS.map((p) => (
            <ToggleLine
              key={p.id}
              label={p.label}
              hint={p.hint}
              checked={draft.permissions[p.id]}
              onChange={() => togglePermission(p.id)}
            />
          ))}
        </div>
      </SettingsCard>

      {/* Abas */}
      <SettingsCard title="Abas e seções visíveis" description="O que aparece dentro do portal.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          {TAB_FIELDS.map((t) => (
            <ToggleLine
              key={t.id}
              label={t.label}
              hint={t.hint}
              checked={draft.tabs[t.id]}
              onChange={() => toggleTab(t.id)}
            />
          ))}
        </div>
      </SettingsCard>

      {/* Plano */}
      <SettingsCard title="Disponibilidade por plano">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <PlanTier name="Free" badge="Atual" hint="Prévia local. Publicação futura bloqueada." />
          <PlanTier name="Pro / Studio" badge="Em breve" highlight hint="Publicação do portal do cliente." />
          <PlanTier name="Scale / Agency" badge="Em breve" hint="White-label e layouts avançados." />
        </div>
      </SettingsCard>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 justify-end pt-2">
        <Button variant="ghost" size="sm" onClick={handleReset} className="gap-2">
          <RotateCcw className="h-3.5 w-3.5" /> Restaurar padrão
        </Button>
        <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)} className="gap-2">
          <Eye className="h-3.5 w-3.5" /> Pré-visualizar
        </Button>
        <Button size="sm" onClick={handleSave} disabled={hasInvalid} className="gap-2">
          <Save className="h-3.5 w-3.5" /> Salvar rascunho
        </Button>
        <Button size="sm" variant="secondary" onClick={handlePublish} disabled className="gap-2">
          <Send className="h-3.5 w-3.5" /> Publicar portal
          <Badge variant="outline" className="text-[10px] uppercase">Em breve</Badge>
        </Button>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Prévia do Portal do Cliente
            </DialogTitle>
            <DialogDescription>
              Visualização mockada. Nenhum dado real do cliente é exibido.
            </DialogDescription>
          </DialogHeader>
          <PortalPreview brand={effectiveBrand} draft={draft} />
        </DialogContent>
      </Dialog>
    </SettingsSection>
  );
}

/* ---------- helpers ---------- */

function FieldLabel({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground font-medium">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ColorField({
  label,
  value,
  invalid,
  onChange,
}: {
  label: string;
  value: string;
  invalid: boolean;
  onChange: (v: string) => void;
}) {
  const safe = HEX_RE.test(value) ? value : "#000000";
  return (
    <FieldLabel label={label} hint={invalid ? "Formato inválido. Use #RRGGBB." : undefined}>
      <div className="flex items-stretch gap-2">
        <div className="relative h-11 w-11 rounded-lg border border-border overflow-hidden shrink-0">
          <div className="absolute inset-0" style={{ backgroundColor: safe }} />
          <input
            type="color"
            value={safe}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 opacity-0 cursor-pointer"
            aria-label={label}
          />
        </div>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#RRGGBB"
          className={cn(invalid && "border-destructive/60 focus-visible:ring-destructive/40")}
        />
      </div>
    </FieldLabel>
  );
}

function ToggleLine({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-border/40 last:border-b-0 sm:border-b">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function PlanTier({
  name,
  badge,
  hint,
  highlight,
}: {
  name: string;
  badge: string;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        highlight ? "border-primary/30 bg-primary/5" : "border-border/60 bg-muted/10",
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-foreground">{name}</p>
        <Badge variant="outline" className="text-[10px] uppercase">{badge}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function PortalPreview({
  brand,
  draft,
  compact,
}: {
  brand: string;
  draft: ClientPortalSettings;
  compact?: boolean;
}) {
  const bg = HEX_RE.test(draft.backgroundColor) ? draft.backgroundColor : "#0D0D0D";
  const primary = HEX_RE.test(draft.primaryColor) ? draft.primaryColor : "#F81040";
  const btnText = HEX_RE.test(draft.buttonTextColor) ? draft.buttonTextColor : "#FFFFFF";
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 overflow-hidden",
        compact ? "min-h-[220px]" : "min-h-[360px]",
      )}
      style={{ backgroundColor: bg }}
    >
      <div className="px-5 py-3 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2">
          <div
            className="h-7 w-7 rounded-md flex items-center justify-center text-[11px] font-bold"
            style={{ backgroundColor: primary, color: btnText }}
          >
            {initialsOf(brand)}
          </div>
          <span className="text-sm font-semibold text-white truncate max-w-[160px]">{brand}</span>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase border-white/20 text-white/70">
          {draft.style}
        </Badge>
      </div>

      <div className="p-6 flex flex-col items-center text-center gap-3">
        <div className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <ShieldCheck className="h-4 w-4" style={{ color: primary }} />
        </div>
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-white">{draft.loginTitle}</h3>
          <p className="text-xs sm:text-sm text-white/60 mt-1 max-w-md">{draft.loginMessage}</p>
        </div>
        <button
          type="button"
          onClick={() => toast.info("Portal real será ativado futuramente.")}
          className="mt-1 rounded-lg px-5 py-2 text-sm font-semibold"
          style={{ backgroundColor: primary, color: btnText }}
        >
          Entrar no portal
        </button>
        <p className="text-[10px] text-white/40">Prévia mockada · sem login real</p>
      </div>

      {!compact && (
        <div className="px-5 py-3 border-t border-white/5 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-[10px] uppercase border-white/20 text-white/60">
            <LayoutGrid className="h-3 w-3 mr-1" /> Projetos
          </Badge>
          {draft.tabs.requests && (
            <Badge variant="outline" className="text-[10px] uppercase border-white/20 text-white/60">
              Solicitações
            </Badge>
          )}
          {draft.tabs.reports && (
            <Badge variant="outline" className="text-[10px] uppercase border-white/20 text-white/60">
              Relatórios
            </Badge>
          )}
          {draft.tabs.approvalHistory && (
            <Badge variant="outline" className="text-[10px] uppercase border-white/20 text-white/60">
              Aprovações
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
