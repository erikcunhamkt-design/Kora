import {
  LayoutDashboard, Briefcase, Users, TrendingUp,
  DollarSign, CheckSquare, Target, Settings, Crown, Trophy, Zap, Globe
} from "lucide-react";
import koraLogo from "@/assets/kora-logo.png";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar, SidebarFooter,
} from "@/components/ui/sidebar";
import { usePlan } from "@/contexts/PlanContext";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Portfólio", url: "/portfolio", icon: Briefcase },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "CRM", url: "/crm", icon: TrendingUp },
  { title: "Vendas", url: "/vendas", icon: Trophy },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign },
  { title: "Tarefas", url: "/tarefas", icon: CheckSquare },
  { title: "Automações", url: "/automacoes", icon: Zap },
  { title: "Presença", url: "/presenca", icon: Globe },
  { title: "Metas", url: "/metas", icon: Target },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { isPro } = usePlan();

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <Sidebar collapsible="icon" className="border-r border-border/40">
      {/* Logo */}
      <div className={`flex items-center border-b border-border/40 ${collapsed ? "justify-center px-2 py-4" : "gap-2.5 px-5 py-5"}`}>
        <div className="flex-shrink-0">
          <img src={koraLogo} alt="KORA HUB" className={collapsed ? "h-8 w-8 object-contain" : "h-10 w-10 object-contain"} />
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-lg font-bold tracking-tight leading-tight truncate">
              <span className="orbit-gradient-text">KORA</span>{" "}
              <span className="text-foreground">HUB</span>
            </span>
            <span className="text-[0.625rem] text-muted-foreground/60 tracking-wide uppercase leading-tight truncate">
              CLARITY FOR WORK
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <SidebarContent className={collapsed ? "px-2 py-5" : "px-3 py-5"}>
        <SidebarGroup className={collapsed ? "p-0" : undefined}>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1 items-stretch">
              {navItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title} className={collapsed ? "flex justify-center" : undefined}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      className="group-data-[collapsible=icon]:!w-10 group-data-[collapsible=icon]:!h-10 group-data-[collapsible=icon]:!p-0"
                    >
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        title={collapsed ? item.title : undefined}
                        className={`relative flex items-center rounded-lg font-medium transition-all duration-200 ${
                          collapsed
                            ? "h-10 w-10 mx-auto justify-center p-0"
                            : "gap-3.5 px-3.5 py-3 text-[0.9375rem]"
                        } ${
                          active
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        }`}
                        activeClassName=""
                        style={active ? {
                          boxShadow: 'inset 0 0 0 1px hsl(348 94% 52% / 0.25)'
                        } : undefined}
                      >
                        {active && !collapsed && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full orbit-gradient" />
                        )}
                        <item.icon className={`h-[18px] w-[18px] flex-shrink-0 transition-colors duration-200 ${active ? "text-primary" : ""}`} />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Upgrade Footer */}
      {!isPro && (
        <SidebarFooter className={collapsed ? "p-2" : "p-3"}>
          <button
            onClick={() => navigate("/upgrade")}
            title="Upgrade Pro"
            className={`flex items-center rounded-lg border border-primary/15 bg-primary/5 hover:bg-primary/8 transition-all duration-200 text-sm press-effect group ${
              collapsed ? "h-10 w-10 mx-auto justify-center p-0" : "w-full gap-2.5 px-4 py-3"
            }`}
          >
            <Crown className="h-4 w-4 text-primary shrink-0 group-hover:scale-110 transition-transform duration-200" />
            {!collapsed && <span className="text-primary font-medium">Upgrade Pro</span>}
          </button>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
