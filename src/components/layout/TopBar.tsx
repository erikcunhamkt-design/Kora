import { Search, Bell, LogOut, User, ChevronDown, Crown, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/contexts/PlanContext";
import { CommandCenter } from "@/components/command/CommandCenter";
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

        <button className="relative p-2.5 rounded-lg hover:bg-muted/40 transition-all duration-150 press-effect">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full orbit-gradient shadow-[0_0_6px_hsl(263_84%_58%/0.5)]" />
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
    </header>
  );
}
