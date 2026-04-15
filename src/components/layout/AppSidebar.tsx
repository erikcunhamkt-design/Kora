import {
  LayoutDashboard, Briefcase, Users, TrendingUp,
  DollarSign, CheckSquare, Target, Settings, Orbit, Crown
} from "lucide-react";
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
  { title: "Financeiro", url: "/financeiro", icon: DollarSign },
  { title: "Tarefas", url: "/tarefas", icon: CheckSquare },
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
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border/40">
        <div className="orbit-gradient rounded-lg p-1.5 flex-shrink-0 shadow-[0_0_20px_hsl(263_84%_58%/0.25)]">
          <Orbit className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <span className="text-lg font-bold orbit-gradient-text tracking-tight">
            Orbit
          </span>
        )}
      </div>

      {/* Navigation */}
      <SidebarContent className="px-3 py-5">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className={`relative flex items-center gap-3.5 px-3.5 py-3 rounded-lg text-[0.9375rem] font-medium transition-all duration-200 ${
                          active
                            ? "bg-primary/8 text-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        }`}
                        activeClassName=""
                        style={active ? {
                          boxShadow: 'inset 0 0 0 1px hsl(263 84% 58% / 0.12), 0 0 16px hsl(263 84% 58% / 0.04)'
                        } : undefined}
                      >
                        {active && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full orbit-gradient shadow-[0_0_8px_hsl(263_84%_58%/0.3)]" />
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
        <SidebarFooter className="p-3">
          <button
            onClick={() => navigate("/upgrade")}
            className="w-full flex items-center gap-2.5 px-4 py-3 rounded-lg border border-primary/15 bg-primary/5 hover:bg-primary/8 transition-all duration-200 text-sm press-effect group"
          >
            <Crown className="h-4 w-4 text-primary shrink-0 group-hover:scale-110 transition-transform duration-200" />
            {!collapsed && <span className="text-primary font-medium">Upgrade Pro</span>}
          </button>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
