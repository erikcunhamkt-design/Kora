import { Search, Bell, LogOut, User, ChevronDown, Crown, Zap, MessageCircleQuestion, Sparkles, CalendarCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/contexts/PlanContext";
import { CommandCenter } from "@/components/command/CommandCenter";
import { SupportDrawer } from "@/components/support/SupportDrawer";
import { useSupportTickets } from "@/hooks/useSupportTickets";
import { NotificationInbox } from "@/components/notifications/NotificationInbox";
import { useNotificationsCenter } from "@/hooks/useNotificationsCenter";
import { AiCreditsDrawer } from "@/components/credits/AiCreditsDrawer";
import { DayCenter } from "@/components/day/DayCenter";
import { useAiCredits } from "@/hooks/useAiCredits";
import { cn } from "@/lib/utils";

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
    const handler = () => setCreditsOpen(true);
    window.addEventListener("orbyt:open-credits", handler);
    return () => window.removeEventListener("orbyt:open-credits", handler);
  }, []);


  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  const initials = profile?.display_name
    ? profile.display_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "DS";

  return (
    <header className="h-16 shrink-0 border-b border-border/40 flex items-center justify-between gap-3 px-6 glass-panel-subtle sticky top-0 z-20">
      <div className="flex items-center gap-3 min-w-0">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors duration-150" />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setCmdOpen(true)}
          className="relative hidden md:flex items-center gap-2 w-64 h-9 px-3 bg-muted/30 border border-border/40 rounded-lg text-[0.8125rem] text-muted-foreground/70 hover:border-primary/40 hover:text-foreground transition-all duration-200 group"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Buscar...</span>
          <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-background/60 rounded border border-border/40 text-muted-foreground">
            {isMac ? "⌘" : "Ctrl"} K
          </kbd>
        </button>
        <button
          onClick={() => setCmdOpen(true)}
          aria-label="Buscar"
          className="md:hidden p-2.5 rounded-lg hover:bg-muted/40 transition-all duration-150 press-effect"
        >
          <Search className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Plan badge */}
        {!isPro && (
          <button
            onClick={() => navigate("/upgrade")}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/15 bg-primary/5 text-primary text-[0.75rem] font-medium hover:bg-primary/8 transition-all duration-200 press-effect"
          >
            <Crown className="h-3 w-3" />
            Free
            <Zap className="h-3 w-3 ml-0.5" />
          </button>
        )}
        {isPro && (
          <span className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg orbit-gradient text-white text-[0.75rem] font-semibold shadow-[0_0_16px_hsl(263_84%_58%/0.2)]">
            <Crown className="h-3 w-3" /> Pro
          </span>
        )}

        <button
          onClick={() => setCreditsOpen(true)}
          aria-label={`Créditos de IA: ${balance}`}
          title="Créditos de IA"
          className={cn(
            "relative flex items-center gap-1.5 px-2.5 md:px-3 py-2 rounded-lg border transition-all duration-150 press-effect",
            lowCredits
              ? "border-primary/30 bg-primary/[0.06] text-primary hover:bg-primary/[0.1]"
              : "border-border/40 bg-muted/20 text-muted-foreground hover:text-foreground hover:bg-muted/40",
          )}
        >
          <Sparkles className={cn("h-3.5 w-3.5", lowCredits && "text-primary")} />
          <span className="text-[0.75rem] font-semibold tabular-nums">{balance}</span>
          <span className="hidden lg:inline text-[0.75rem] text-muted-foreground/80">créditos</span>
          {lowCredits && (
            <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.7)]" />
          )}
        </button>

        <button
          onClick={() => setSupportOpen(true)}
          aria-label="Suporte"
          title="Suporte"
          className="relative flex items-center gap-1.5 px-2.5 md:px-3 py-2 rounded-lg hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-all duration-150 press-effect"
        >
          <MessageCircleQuestion className="h-4 w-4" />
          <span className="hidden md:inline text-[0.8125rem] font-medium">Ajuda</span>
          {hasOpenTickets && (
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.6)]" />
          )}
        </button>



        <button
          onClick={() => setInboxOpen(true)}
          aria-label={`Notificações${unreadCount > 0 ? `, ${unreadCount} não lidas` : ""}`}
          className="relative p-2.5 rounded-lg hover:bg-muted/40 transition-all duration-150 press-effect"
        >
          <Bell className={cn("h-4 w-4", unreadCount > 0 ? "text-foreground" : "text-muted-foreground")} />
          {unreadCount > 0 && (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center text-[9px] font-bold text-white border border-card",
                hasHighPriorityUnread
                  ? "bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.7)]"
                  : "bg-primary/70",
              )}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2.5 focus:outline-none rounded-lg px-2 py-1.5 hover:bg-muted/30 transition-all duration-150">
            <Avatar className="h-8 w-8 border border-border/40">
              <AvatarFallback className="orbit-gradient text-white text-[11px] font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden md:block text-[0.875rem] font-medium text-foreground max-w-[120px] truncate">
              {profile?.display_name || "Usuário"}
            </span>
            <ChevronDown className="h-3 w-3 text-muted-foreground hidden md:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-[0.875rem] font-medium">{profile?.display_name || "Usuário"}</p>
                <p className="text-[0.8125rem] text-muted-foreground">{profile?.email}</p>
                <p className="text-[0.8125rem] text-muted-foreground capitalize">Plano {plan}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {!isPro && (
              <>
                <DropdownMenuItem onClick={() => navigate("/upgrade")} className="text-primary focus:text-primary">
                  <Crown className="mr-2 h-4 w-4" />
                  Upgrade para Pro
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => navigate("/configuracoes")}>
              <User className="mr-2 h-4 w-4" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
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
