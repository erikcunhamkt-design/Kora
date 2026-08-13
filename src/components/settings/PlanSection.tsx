import { useMemo, useState } from "react";
import { toast } from "sonner";
import { formatCurrency as intlCurrency } from "@/lib/format";
import {
  Check,
  Crown,
  Sparkles,
  History,
  Users,
  User as UserIcon,
  ArrowRight,
  Zap,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { SettingsSection } from "./SettingsSection";
import { SettingsCard } from "./SettingsCard";
import { PlanAdvisor } from "./PlanAdvisor";
import { usePlan } from "@/contexts/plan-context-value";

type Billing = "monthly" | "yearly";
type Profile = "individual" | "team";

const PRICES: Record<"free" | "pro" | "studio", { monthly: number | null; yearly: number | null }> = {
  free: { monthly: 0, yearly: 0 },
  pro: { monthly: 49.9, yearly: 39.9 },
  studio: { monthly: 99.9, yearly: 79.9 },
};

const TEAM_PER_MEMBER: Record<Billing, number> = { monthly: 29.9, yearly: 23.9 };
const TEAM_SIZES = [3, 6, 10, 20];

function fmt(value: number | null) {
  if (value === null) return "Preço a definir";
  if (value === 0) return "R$ 0";
  return intlCurrency(value);
}

const showCheckoutToast = () =>
  toast.info("Checkout real será implementado em uma etapa futura.");

export function PlanSection() {
  const { plan } = usePlan();
  const [billing, setBilling] = useState<Billing>("yearly");
  const [profile, setProfile] = useState<Profile>("individual");
  const [teamSize, setTeamSize] = useState(6);
  const [historyOpen, setHistoryOpen] = useState(false);

  const trialDaysLeft = 0; // No trial em curso por padrão
  const isTrial = false;

  const currentLabel = plan === "pro" ? "Pro" : "Free";

  const teamMonthly = useMemo(
    () => TEAM_PER_MEMBER[billing] * teamSize,
    [billing, teamSize],
  );
  const teamYearlyTotal = useMemo(
    () => TEAM_PER_MEMBER.yearly * teamSize * 12,
    [teamSize],
  );

  return (
    <SettingsSection title="Assinatura" description="Gerencie seu plano, cobrança e benefícios do KORA HUB.">
      {/* 1. Card superior — assinatura atual */}
      <SettingsCard>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <p className="text-2xl font-bold text-foreground">{currentLabel}</p>
              <Badge variant="success" className="text-[10px] uppercase">Ativo</Badge>
              {isTrial && (
                <Badge variant="outline" className="text-[10px] uppercase">Trial</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {plan === "pro"
                ? "Acesso completo aos módulos profissionais do KORA HUB."
                : "Acesso aos módulos essenciais com limites do plano gratuito."}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-xs">
              <Meta label="Próxima renovação" value="—" />
              <Meta label="Último pagamento" value="—" />
              <Meta label="Método de cobrança" value="Não configurado" />
            </div>
            {isTrial && (
              <div className="mt-4 max-w-sm">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                  <span>Trial em andamento</span>
                  <span>{trialDaysLeft} dias restantes</span>
                </div>
                <Progress value={Math.max(0, Math.min(100, (trialDaysLeft / 14) * 100))} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)} className="gap-2">
              <History className="h-4 w-4" /> Ver histórico
            </Button>
            <Button size="sm" onClick={showCheckoutToast} className="gap-2">
              Escolher plano <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SettingsCard>

      {/* Assistente de Plano */}
      <PlanAdvisor
        onSeePlan={(p) => {
          if (p === "scale") setProfile("team");
          else setProfile("individual");
          document.getElementById("kora-plans-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />

      {/* 2. Hero de conversão */}
      <div id="kora-plans-grid" className="rounded-xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8 text-center space-y-3">

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-semibold uppercase tracking-wide">
          <Sparkles className="h-3.5 w-3.5" /> Planos KORA HUB
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
          Escolha o plano ideal para o seu estúdio
        </h2>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto">
          Continue organizando clientes, projetos, vendas e automações em um só lugar.
        </p>
        <p className="text-[11px] text-muted-foreground/80">
          Checkout real será ativado em uma etapa futura.
        </p>

        {/* 3 & 4. Toggles */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
          <SegToggle
            value={billing}
            onChange={(v) => setBilling(v as Billing)}
            options={[
              { value: "monthly", label: "Mensal" },
              { value: "yearly", label: "Anual", badge: "-20%" },
            ]}
          />
          <SegToggle
            value={profile}
            onChange={(v) => setProfile(v as Profile)}
            options={[
              { value: "individual", label: "Individual", icon: UserIcon },
              { value: "team", label: "Equipe", icon: Users },
            ]}
          />
        </div>
      </div>

      {/* 5. Planos individuais */}
      {profile === "individual" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PlanCard
            name="Free"
            position="Para quem está começando agora"
            price={fmt(PRICES.free[billing])}
            cadence={billing === "monthly" ? "/mês" : "/mês • anual"}
            benefits={[
              "CRM essencial e Kanban",
              "Até 1 cliente ativo",
              "Tarefas e Central do Dia",
              "Notificações no app",
            ]}
            ctaLabel="Plano atual"
            ctaDisabled={plan !== "pro"}
            onCta={showCheckoutToast}
          />
          <PlanCard
            name="Pro"
            position="Para designers profissionais"
            price={fmt(PRICES.pro[billing])}
            cadence={billing === "monthly" ? "/mês" : "/mês • cobrado anualmente"}
            benefits={[
              "Clientes, projetos e leads ilimitados",
              "Financeiro completo",
              "Automações e integrações",
              "Portal do Cliente (em breve)",
            ]}
            ctaLabel={plan === "pro" ? "Seu plano atual" : "Selecionar plano"}
            ctaDisabled={plan === "pro"}
            onCta={showCheckoutToast}
            highlight
            highlightLabel="Mais escolhido"
          />
          <PlanCard
            name="Studio"
            position="Para estúdios em crescimento"
            price={fmt(PRICES.studio[billing])}
            cadence={billing === "monthly" ? "/mês" : "/mês • cobrado anualmente"}
            benefits={[
              "Tudo do Pro",
              "Relatórios premium (em breve)",
              "Personalização de marca (em breve)",
              "Suporte prioritário",
            ]}
            ctaLabel="Selecionar plano"
            onCta={showCheckoutToast}
            recommended
          />
        </div>
      )}

      {/* 6. Plano Equipe */}
      {profile === "team" && (
        <SettingsCard title="Plano Equipe" description="Cobrança por membro. Cancele quando quiser.">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-xs text-muted-foreground mr-1">Tamanho da equipe:</span>
            {TEAM_SIZES.map((n) => (
              <button
                key={n}
                onClick={() => setTeamSize(n)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  teamSize === n
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/60 bg-muted/10 text-muted-foreground hover:text-foreground"
                }`}
              >
                {n} membros
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            <Meta label="Preço por membro" value={`${fmt(TEAM_PER_MEMBER[billing])} /mês`} />
            <Meta label={`Total mensal • ${teamSize} membros`} value={intlCurrency(teamMonthly)} />
            <Meta label="Total anual" value={intlCurrency(teamYearlyTotal)} />
          </div>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-5">
            <Bullet>Membros e permissões</Bullet>
            <Bullet>Dashboard do time</Bullet>
            <Bullet>Projetos e tarefas por responsável</Bullet>
            <Bullet>Suporte prioritário</Bullet>
            <Bullet muted>Ranking/evolução da equipe (em breve)</Bullet>
            <Bullet muted>Relatórios por equipe (em breve)</Bullet>
          </ul>

          <div className="flex justify-end">
            <Button onClick={showCheckoutToast} className="gap-2">
              Selecionar plano Equipe <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            Preços mock — valores definitivos serão configurados antes do lançamento.
          </p>
        </SettingsCard>
      )}

      {/* 7. O que você desbloqueia */}
      <SettingsCard title="O que você desbloqueia" description="Benefícios reais ao evoluir seu plano.">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <UnlockCard icon={Users} title="Clientes, leads e projetos ilimitados" badge="Disponível" tone="now" />
          <UnlockCard icon={Zap} title="Automações e integrações" badge="Disponível" tone="now" />
          <UnlockCard icon={Sparkles} title="IA avançada com mais créditos" badge="Em breve" tone="soon" />
          <UnlockCard icon={UserIcon} title="Portal do Cliente" badge="Em breve" tone="soon" />
          <UnlockCard icon={Star} title="Relatórios premium" badge="Studio" tone="studio" />
          <UnlockCard icon={Crown} title="Personalização de marca" badge="Studio" tone="studio" />
          <UnlockCard icon={Check} title="Suporte prioritário" badge="Pro" tone="pro" />
        </div>
      </SettingsCard>

      {/* 8. Comparação */}
      <SettingsCard title="Comparação de recursos" description="Veja o que cada plano inclui.">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="compare" className="border-0">
            <AccordionTrigger className="text-sm font-medium hover:no-underline py-2">
              Mostrar tabela completa
            </AccordionTrigger>
            <AccordionContent>
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30 text-muted-foreground">
                    <tr>
                      <th className="text-left p-3 font-semibold">Recurso</th>
                      <th className="text-left p-3 font-semibold">Free</th>
                      <th className="text-left p-3 font-semibold">Pro</th>
                      <th className="text-left p-3 font-semibold">Studio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    <Row label="Clientes" free="1" pro="Ilimitado" studio="Ilimitado" />
                    <Row label="Leads" free="1 ativo" pro="Ilimitado" studio="Ilimitado" />
                    <Row label="Projetos" free="1" pro="Ilimitado" studio="Ilimitado" />
                    <Row label="Tarefas" free="3" pro="Ilimitado" studio="Ilimitado" />
                    <Row label="Financeiro" free="Básico" pro="Completo" studio="Completo" />
                    <Row label="Orçamentos" free="—" pro="Ilimitado" studio="Ilimitado" />
                    <Row label="IA" free="Limitada" pro="Avançada" studio="Avançada+" />
                    <Row label="Automações" free="—" pro="Sim" studio="Sim" />
                    <Row label="Portal do Cliente" free="—" pro="Em breve" studio="Em breve" />
                    <Row label="Relatórios" free="—" pro="Padrão" studio="Premium" />
                    <Row label="Suporte" free="Comunidade" pro="Prioritário" studio="Dedicado" />
                    <Row label="Modo Team" free="—" pro="—" studio="Sim" />
                  </tbody>
                </table>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </SettingsCard>

      {/* 10. CTA final */}
      <div className="rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-foreground">Pronto para evoluir seu estúdio?</p>
          <p className="text-sm text-muted-foreground">Comece quando quiser. Sem compromisso longo.</p>
        </div>
        <Button size="lg" onClick={showCheckoutToast} className="gap-2">
          Selecionar plano <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* 9. Histórico */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Histórico de pagamentos</DialogTitle>
            <DialogDescription>Faturas e cobranças do KORA HUB.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-8 text-center">
            <History className="h-8 w-8 text-muted-foreground/60 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">Nenhum pagamento encontrado ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Quando o checkout for ativado, suas faturas aparecerão aqui.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </SettingsSection>
  );
}

/* ---------- helpers ---------- */

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
      <p className="text-sm font-semibold text-foreground mt-0.5 truncate">{value}</p>
    </div>
  );
}

function SegToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; badge?: string; icon?: typeof UserIcon }[];
}) {
  return (
    <div className="inline-flex rounded-lg border border-border/60 bg-muted/20 p-1">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {opt.label}
            {opt.badge && (
              <span className="ml-1 text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function PlanCard({
  name,
  position,
  price,
  cadence,
  benefits,
  ctaLabel,
  ctaDisabled,
  onCta,
  highlight,
  highlightLabel,
  recommended,
}: {
  name: string;
  position: string;
  price: string;
  cadence: string;
  benefits: string[];
  ctaLabel: string;
  ctaDisabled?: boolean;
  onCta: () => void;
  highlight?: boolean;
  highlightLabel?: string;
  recommended?: boolean;
}) {
  const isFeatured = highlight || recommended;
  return (
    <div
      className={`relative rounded-xl border p-5 flex flex-col gap-4 ${
        isFeatured
          ? "border-primary/40 bg-primary/[0.03] shadow-[0_0_24px_hsl(348_94%_52%/0.08)]"
          : "border-border/60 bg-card"
      }`}
    >
      {(highlight || recommended) && (
        <div className="absolute -top-2.5 left-5 px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-[10px] font-semibold uppercase tracking-wide">
          {highlightLabel || "Mais recomendado"}
        </div>
      )}
      <div>
        <p className="text-sm font-semibold text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">{position}</p>
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{price}</p>
        <p className="text-[11px] text-muted-foreground">{cadence}</p>
      </div>
      <ul className="space-y-2 text-sm flex-1">
        {benefits.map((b) => (
          <li key={b} className="flex items-start gap-2">
            <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
            <span className="text-foreground">{b}</span>
          </li>
        ))}
      </ul>
      <Button
        onClick={onCta}
        disabled={ctaDisabled}
        variant={isFeatured ? "default" : "outline"}
        className="w-full"
      >
        {ctaLabel}
      </Button>
    </div>
  );
}

function UnlockCard({
  icon: Icon,
  title,
  badge,
  tone,
}: {
  icon: typeof Users;
  title: string;
  badge: string;
  tone: "now" | "soon" | "pro" | "studio";
}) {
  const badgeClass =
    tone === "now"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
      : tone === "soon"
        ? "bg-muted/40 text-muted-foreground border-border/60"
        : "bg-primary/15 text-primary border-primary/20";
  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 p-3 flex items-start gap-3">
      <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <span className={`inline-block mt-1.5 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border font-semibold ${badgeClass}`}>
          {badge}
        </span>
      </div>
    </div>
  );
}

function Bullet({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <li className="flex items-start gap-2">
      <Check className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${muted ? "text-muted-foreground" : "text-primary"}`} />
      <span className={muted ? "text-muted-foreground" : "text-foreground"}>{children}</span>
    </li>
  );
}

function Row({ label, free, pro, studio }: { label: string; free: string; pro: string; studio: string }) {
  return (
    <tr className="hover:bg-muted/20">
      <td className="p-3 font-medium text-foreground">{label}</td>
      <td className="p-3 text-muted-foreground">{free}</td>
      <td className="p-3 text-foreground">{pro}</td>
      <td className="p-3 text-foreground">{studio}</td>
    </tr>
  );
}
