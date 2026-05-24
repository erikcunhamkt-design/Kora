import {
  LayoutDashboard, Users, TrendingUp, ShoppingBag, FileText,
  DollarSign, CheckSquare, FolderKanban, Image as ImageIcon,
  Target, Settings, Crown, Zap, Globe, CalendarCheck, LifeBuoy,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import koraLogo from "@/assets/kora-logo.png";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar, SidebarFooter,
} from "@/components/ui/sidebar";
import { usePlan } from "@/contexts/PlanContext";

type NavItem = {
  title: string;
  icon: LucideIcon;
  url?: string;
  event?: string;
};

type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: "Principal",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Central do Dia", event: "kora:open-day", icon: CalendarCheck },
    ],
  },
  {
    label: "Comercial",
    items: [
      { title: "Clientes", url: "/clientes", icon: Users },
      { title: "CRM", url: "/crm", icon: TrendingUp },
      { title: "Catálogo Comercial", url: "/vendas?tab=servicos", icon: ShoppingBag },
      { title: "Orçamentos", url: "/vendas?tab=orcamentos", icon: FileText },
    ],
  },
  {
    label: "Operação",
    items: [
      { title: "Tarefas", url: "/tarefas", icon: CheckSquare },
      { title: "Briefings", url: "/briefings", icon: ClipboardList },
      { title: "Projetos", url: "/portfolio?tab=projetos", icon: FolderKanban },
      { title: "Conteúdo", url: "/portfolio?tab=conteudo", icon: ImageIcon },
    ],
  },
  {
    label: "Gestão",
    items: [
      { title: "Financeiro", url: "/financeiro", icon: DollarSign },
    ],
  },
  {
    label: "Crescimento",
    items: [
      { title: "Automações & IA", url: "/automacoes", icon: Zap },
      { title: "Presença", url: "/presenca", icon: Globe },
      { title: "Metas", url: "/metas", icon: Target },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Configurações", url: "/configuracoes", icon: Settings },
      { title: "Ajuda & Suporte", event: "kora:open-support", icon: LifeBuoy },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { isPro } = usePlan();

  const currentTab = new URLSearchParams(location.search).get("tab");

  const isActive = (item: NavItem) => {
    if (!item.url) return false;
    const [path, query] = item.url.split("?");
    if (path === "/") {
      // Dashboard active only on root without ?tab specialization
      return location.pathname === "/";
    }
    const pathMatch = location.pathname === path || location.pathname.startsWith(path + "/");
    if (!pathMatch) return false;
    if (query) {
      const tab = new URLSearchParams(query).get("tab");
      return tab === currentTab;
    }
    // For items without specific tab, only active if no specific tab item also matches
    return !currentTab;
  };

  const dispatchEvent = (eventName: string) => {
    window.dispatchEvent(new CustomEvent(eventName));
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border/40">
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

      <SidebarContent className={collapsed ? "px-2 py-4" : "px-3 py-4"}>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className={collapsed ? "p-0 mb-1" : "mb-1"}>
            {!collapsed && (
              <SidebarGroupLabel className="px-3 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5 items-stretch">
                {group.items.map((item) => {
                  const active = isActive(item);
                  const Icon = item.icon;
                  const baseClass = `relative flex items-center rounded-lg font-medium transition-all duration-200 ${
                    collapsed
                      ? "h-10 w-10 mx-auto justify-center p-0"
                      : "gap-3 px-3 py-2.5 text-[0.875rem]"
                  } ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`;
                  const style = active
                    ? { boxShadow: "inset 0 0 0 1px hsl(348 94% 52% / 0.25)" }
                    : undefined;

                  return (
                    <SidebarMenuItem key={item.title} className={collapsed ? "flex justify-center" : undefined}>
                      <SidebarMenuButton
                        asChild
                        tooltip={item.title}
                        className="group-data-[collapsible=icon]:!w-10 group-data-[collapsible=icon]:!h-10 group-data-[collapsible=icon]:!p-0"
                      >
                        {item.url ? (
                          <NavLink
                            to={item.url}
                            end={item.url === "/"}
                            title={collapsed ? item.title : undefined}
                            className={baseClass}
                            activeClassName=""
                            style={style}
                          >
                            {active && !collapsed && (
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full orbit-gradient" />
                            )}
                            <Icon className={`h-[18px] w-[18px] flex-shrink-0 transition-colors duration-200 ${active ? "text-primary" : ""}`} />
                            {!collapsed && <span className="truncate">{item.title}</span>}
                          </NavLink>
                        ) : (
                          <button
                            type="button"
                            onClick={() => item.event && dispatchEvent(item.event)}
                            title={collapsed ? item.title : undefined}
                            className={baseClass + " w-full text-left"}
                          >
                            <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                            {!collapsed && <span className="truncate">{item.title}</span>}
                          </button>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

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
