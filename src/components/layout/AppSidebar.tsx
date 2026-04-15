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
    <Sidebar collapsible="icon" className="border-r border-border/60">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-border/60">
        <div className="orbit-gradient rounded-lg p-1.5 flex-shrink-0 shadow-[0_0_16px_hsl(263_84%_58%/0.2)]">
          <Orbit className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <span className="text-lg font-bold orbit-gradient-text tracking-tight">
            Orbit
          </span>
        )}
      </div>

      {/* Navigation */}
      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {navItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 ${
                          active
                            ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(263_84%_58%/0.15)]"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        }`}
                        activeClassName=""
                      >
                        {active && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full orbit-gradient" />
                        )}
                        <item.icon className={`h-4 w-4 flex-shrink-0 transition-colors duration-200 ${active ? "text-primary" : ""}`} />
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
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all duration-200 text-sm press-effect"
          >
            <Crown className="h-4 w-4 text-primary shrink-0" />
            {!collapsed && <span className="text-primary font-medium text-[13px]">Upgrade Pro</span>}
          </button>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
