import { Search, Bell, LogOut, User, ChevronDown, Crown, Zap, MessageCircleQuestion, Sparkles, CalendarCheck, Building2, Settings, CreditCard, Shield, LifeBuoy, Users, Brain } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/contexts/PlanContext";
import { useAccessibility } from "@/contexts/AccessibilityContext";
import { CommandCenter } from "@/components/command/CommandCenter";
import { SupportDrawer } from "@/components/support/SupportDrawer";
import { useSupportTickets } from "@/hooks/useSupportTickets";
import { NotificationInbox } from "@/components/notifications/NotificationInbox";
import { useNotificationsCenter } from "@/hooks/useNotificationsCenter";
import { AiCreditsDrawer } from "@/components/credits/AiCreditsDrawer";
import { useAiCredits } from "@/hooks/useAiCredits";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/LanguageContext";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function TopBar() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { isPro, plan } = usePlan();
  const { setDialogOpen } = useAccessibility();
  const { t } = useTranslation();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const { tickets } = useSupportTickets();
  const { unreadCount, hasHighPriorityUnread } = useNotificationsCenter();
  const { balance } = useAiCredits();
  const hasOpenTickets = tickets.some((t) => !t.isDemo && t.status !== "resolved");
  const lowCredits = balance <= 5;

  useEffect(() => {
    const onCredits = () => setCreditsOpen(true);
    const onDay = () => navigate("/central-do-dia");
    const onSupport = () => setSupportOpen(true);
    window.addEventListener("orbyt:open-credits", onCredits);
    window.addEventListener("kora:open-day", onDay);
    window.addEventListener("kora:open-support", onSupport);
    return () => {
      window.removeEventListener("orbyt:open-credits", onCredits);
      window.removeEventListener("kora:open-day", onDay);
      window.removeEventListener("kora:open-support", onSupport);
    };
  }, []);



  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  const initials = profile?.display_name
    ? profile.display_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "DS";

  return (
    <header className="h-16 shrink-0 border-b border-border/40 flex items-center justify-between gap-4 px-6 glass-panel-subtle sticky top-0 z-20">
      <div className="flex items-center gap-3 min-w-0">
        <SidebarTrigger className="text-muted-foreground/70 hover:text-foreground transition-colors duration-150" />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setCmdOpen(true)}
          className="relative hidden md:flex items-center gap-2.5 w-64 h-8 px-3 rounded-full bg-muted/5 border border-border/25 text-[0.75rem] text-muted-foreground/75 hover:border-border/40 hover:bg-muted/10 transition-all duration-300 group"
        >
          <Search className="h-3.5 w-3.5 text-muted-foreground/60" />
          <span className="flex-1 text-left">{t("topbar.search", "Buscar...")}</span>
          <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold bg-background/40 rounded border border-border/30 text-muted-foreground/60">
            {isMac ? "⌘" : "Ctrl"} K
          </kbd>
        </button>
        <button
          onClick={() => setDialogOpen(true)}
          aria-label="Acessibilidade e Neurodiversidade"
          title="Acessibilidade e Neurodiversidade"
          className="relative h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground/75 hover:text-foreground hover:bg-muted/10 transition-all duration-200"
        >
          <Brain className="h-4 w-4 text-purple-400" />
        </button>
        <button
          onClick={() => setCmdOpen(true)}
          aria-label="Buscar"
          className="md:hidden p-2 rounded-lg hover:bg-muted/30 transition-all duration-150"
        >
          <Search className="h-4 w-4 text-muted-foreground" />
        </button>

        <div className="hidden md:block w-px h-4 bg-border/20 mx-1" />

        {/* Plan badge — informativo, neutro */}
        {!isPro && (
          <button
            onClick={() => navigate("/upgrade")}
            className="hidden md:flex items-center gap-1.5 px-2.5 h-6 rounded-full border border-border/30 bg-muted/5 text-muted-foreground/85 text-[10px] font-bold uppercase tracking-wider hover:bg-muted/10 transition-all duration-300"
          >
            <Crown className="h-3 w-3 text-amber-400/70" />
            Free
          </button>
        )}
        {isPro && (
          <span className="hidden md:flex items-center gap-1.5 px-2.5 h-6 rounded-full border border-amber-500/20 bg-amber-500/[0.04] text-amber-400/90 text-[10px] font-bold uppercase tracking-wider">
            <Crown className="h-3 w-3" /> Pro
          </span>
        )}

        <button
          onClick={() => navigate("/central-do-dia")}
          aria-label={t("sidebar.daycenter", "Central do Dia")}
          title={t("sidebar.daycenter", "Central do Dia")}
          className="relative h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground/75 hover:text-foreground hover:bg-muted/10 transition-all duration-200"
        >
          <CalendarCheck className="h-4 w-4" />
        </button>

        <button
          onClick={() => setCreditsOpen(true)}
          aria-label={`Créditos de IA: ${balance}`}
          title="Créditos de IA"
          className={cn(
            "relative h-8 px-2.5 rounded-lg flex items-center gap-1 text-[0.75rem] font-bold tabular-nums transition-all duration-200",
            lowCredits
              ? "text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
              : "text-muted-foreground/75 hover:text-foreground hover:bg-muted/10",
          )}
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>{balance}</span>
          {lowCredits && (
            <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-400" />
          )}
        </button>

        <button
          onClick={() => setSupportOpen(true)}
          aria-label={t("topbar.support", "Suporte")}
          title={t("topbar.support", "Suporte")}
          className="relative h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground/75 hover:text-foreground hover:bg-muted/10 transition-all duration-200"
        >
          <MessageCircleQuestion className="h-4 w-4" />
          {hasOpenTickets && (
            <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-400" />
          )}
        </button>

        <button
          onClick={() => setInboxOpen(true)}
          aria-label={`Notificações${unreadCount > 0 ? `, ${unreadCount} não lidas` : ""}`}
          className="relative h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground/75 hover:text-foreground hover:bg-muted/10 transition-all duration-200"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              className={cn(
                "absolute top-1 right-1 min-w-[12px] h-[12px] px-0.5 rounded-full flex items-center justify-center text-[7px] font-bold text-white leading-none",
                hasHighPriorityUnread ? "bg-primary" : "bg-muted-foreground/60",
              )}
            >
              {unreadCount > 9 ? "9" : unreadCount}
            </span>
          )}
        </button>

        <div className="hidden md:block w-px h-4 bg-border/20 mx-1" />

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 focus:outline-none rounded-lg px-2 h-9 hover:bg-muted/10 transition-all duration-200">
            <Avatar className="h-7 w-7 border border-border/20">
              <AvatarFallback className="orbit-gradient text-white text-[10px] font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden md:block text-xs font-semibold text-foreground/90 max-w-[110px] truncate">
              {profile?.display_name || "Usuário"}
            </span>
            <ChevronDown className="h-3 w-3 text-muted-foreground/60 hidden md:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 p-0 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-4 bg-card-elevated/40 border-b border-border/40">
              <div className="flex items-center gap-3">
                <Avatar className="h-11 w-11 border border-border/50">
                  <AvatarFallback className="orbit-gradient text-white text-sm font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {profile?.display_name || "Usuário"}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">{profile?.email}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide border",
                    isPro
                      ? "border-amber-500/30 bg-amber-500/[0.06] text-amber-400/90"
                      : "border-border/50 bg-transparent text-muted-foreground",
                  )}
                >
                  <Crown className="h-2.5 w-2.5" />
                  {isPro ? "Pro" : "Free"}
                </span>
                {!isPro && (
                  <button
                    onClick={() => navigate("/upgrade")}
                    className="text-[11px] font-medium text-primary/90 hover:text-primary transition-colors"
                  >
                    Upgrade →
                  </button>
                )}
              </div>
            </div>

            {/* Account */}
            <div className="py-1">
              <DropdownMenuItem onClick={() => navigate("/configuracoes?tab=perfil")} className="gap-2.5 text-[0.8125rem]">
                <User className="h-4 w-4 text-muted-foreground" />
                {t("topbar.profile", "Perfil")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/configuracoes?tab=empresa")} className="gap-2.5 text-[0.8125rem]">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {t("sidebar.group.system", "Empresa")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/configuracoes")} className="gap-2.5 text-[0.8125rem]">
                <Settings className="h-4 w-4 text-muted-foreground" />
                {t("sidebar.settings", "Configurações")}
              </DropdownMenuItem>
            </div>

            <DropdownMenuSeparator />

            {/* Billing & security */}
            <div className="py-1">
              <DropdownMenuItem onClick={() => navigate("/configuracoes?tab=plano")} className="gap-2.5 text-[0.8125rem]">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                {t("sidebar.upgrade", "Assinatura")}
                <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                  {isPro ? "Pro" : "Free"}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/configuracoes?tab=seguranca")} className="gap-2.5 text-[0.8125rem]">
                <Shield className="h-4 w-4 text-muted-foreground" />
                {t("sidebar.security", "Segurança")}
              </DropdownMenuItem>
            </div>

            <DropdownMenuSeparator />

            {/* Support & community */}
            <div className="py-1">
              <DropdownMenuItem onClick={() => setSupportOpen(true)} className="gap-2.5 text-[0.8125rem]">
                <LifeBuoy className="h-4 w-4 text-muted-foreground" />
                Ajuda e suporte
                {hasOpenTickets && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.6)]" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => toast.info("Comunidade KORA será liberada em uma etapa futura.")}
                className="gap-2.5 text-[0.8125rem]"
              >
                <Users className="h-4 w-4 text-muted-foreground" />
                Comunidade KORA
                <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                  Em breve
                </span>
              </DropdownMenuItem>
            </div>

            <DropdownMenuSeparator />

            <div className="py-1">
              <DropdownMenuItem onClick={signOut} className="gap-2.5 text-[0.8125rem] text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4" />
                {t("topbar.logout", "Sair")}
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>
      <CommandCenter open={cmdOpen} onOpenChange={setCmdOpen} />
      <SupportDrawer open={supportOpen} onOpenChange={setSupportOpen} />
      <NotificationInbox open={inboxOpen} onOpenChange={setInboxOpen} />
      <AiCreditsDrawer open={creditsOpen} onOpenChange={setCreditsOpen} />
    </header>
  );
}
