import {
  LayoutDashboard, Briefcase, Users, TrendingUp,
  DollarSign, CheckSquare, Target, Settings, Orbit
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";

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

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <div className="flex items-center gap-2 px-4 py-5 border-b border-border">
        <div className="orbit-gradient rounded-lg p-1.5 flex-shrink-0">
          <Orbit className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <span className="text-lg font-bold orbit-gradient-text tracking-tight">
            Orbit
          </span>
        )}
      </div>
      <SidebarContent className="px-2 py-4">
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
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                          active
                            ? "orbit-gradient text-white shadow-lg"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                        activeClassName=""
                      >
                        <item.icon className="h-4 w-4 flex-shrink-0" />
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
    </Sidebar>
  );
}
