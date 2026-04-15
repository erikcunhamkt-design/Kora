import { Search, Bell, LogOut, User, ChevronDown, Crown, Zap } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/contexts/PlanContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Dashboard", subtitle: "Visão geral do seu negócio" },
  "/portfolio": { title: "Portfólio", subtitle: "Seus projetos e trabalhos" },
  "/clientes": { title: "Clientes", subtitle: "Gerencie sua base de clientes" },
  "/crm": { title: "CRM", subtitle: "Pipeline de oportunidades" },
  "/financeiro": { title: "Financeiro", subtitle: "Controle financeiro" },
  "/tarefas": { title: "Tarefas", subtitle: "Gerencie suas atividades" },
  "/metas": { title: "Metas", subtitle: "Acompanhe seus objetivos" },
  "/configuracoes": { title: "Configurações", subtitle: "Preferências do sistema" },
  "/upgrade": { title: "Upgrade", subtitle: "Desbloqueie todo o potencial" },
};

export function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const page = pageTitles[location.pathname] || pageTitles["/"];
  const { profile, signOut } = useAuth();
  const { isPro, plan } = usePlan();

  const initials = profile?.display_name
    ? profile.display_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "DS";

  return (
    <header className="h-16 border-b border-border/40 flex items-center justify-between px-6 glass-panel-subtle sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors duration-150" />
        <div>
          <h1 className="text-lg font-semibold text-foreground tracking-tight leading-tight">{page.title}</h1>
          <p className="text-[0.8125rem] text-muted-foreground mt-0.5">{page.subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            placeholder="Buscar..."
            className="pl-10 w-60 h-9 text-[0.8125rem] bg-muted/30 border border-border/40 rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all duration-200"
          />
        </div>

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
