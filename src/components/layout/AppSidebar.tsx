import {
  LayoutDashboard, Users, TrendingUp, ShoppingBag, FileText,
  DollarSign, CheckSquare, FolderKanban, Image as ImageIcon,
  Settings, Crown, Zap, Globe, CalendarCheck, LifeBuoy,
  ClipboardList, BarChart3, Link as LinkIcon, Calendar, Sparkles,
  Bot, Plug, CreditCard,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import koraLogo from "@/assets/kora-logo.png";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar, SidebarFooter,
} from "@/components/ui/sidebar";
import { usePlan } from "@/contexts/PlanContext";

type Badge = "soon" | "beta" | "pro";

type NavItem = {
  title: string;
  icon: LucideIcon;
  url?: string;
  event?: string;
  badge?: Badge;
  disabled?: boolean;
};

type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: "Principal",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Central do Dia", event: "kora:open-day", icon: CalendarCheck },
      { title: "Clientes", url: "/clientes", icon: Users },
      { title: "CRM", url: "/crm", icon: TrendingUp },
    ],
  },
  {
    label: "Operação",
    items: [
      { title: "Projetos", url: "/portfolio?tab=projetos", icon: FolderKanban },
      { title: "Tarefas", url: "/tarefas", icon: CheckSquare },
      { title: "Conteúdo", url: "/portfolio?tab=conteudo", icon: ImageIcon },
      { title: "Briefings", url: "/briefings", icon: ClipboardList },
    ],
  },
  {
    label: "Vendas",
    items: [
      { title: "Serviços", url: "/vendas?tab=servicos", icon: ShoppingBag },
      { title: "Orçamentos", url: "/vendas?tab=orcamentos", icon: FileText },
      { title: "Financeiro", url: "/financeiro", icon: DollarSign },
      { title: "Relatórios", icon: BarChart3, badge: "soon", disabled: true },
    ],
  },
  {
    label: "Presença",
    items: [
      { title: "Página Pública", url: "/presenca?tab=publica", icon: Globe },
      { title: "Portfólio", url: "/portfolio", icon: ImageIcon },
      { title: "Link da Bio", url: "/presenca?tab=bio", icon: LinkIcon },
      { title: "Formulários", url: "/presenca?tab=forms", icon: FileText, badge: "beta" },
      { title: "Agendamento", url: "/presenca?tab=agenda", icon: Calendar, badge: "beta" },
    ],
  },
  {
    label: "Inteligência",
    items: [
      { title: "Agentes de IA", url: "/automacoes?tab=ia", icon: Bot, badge: "beta" },
      { title: "Automações", url: "/automacoes?tab=automacoes", icon: Zap, badge: "beta" },
      { title: "Créditos de IA", event: "orbyt:open-credits", icon: Sparkles },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Integrações", url: "/automacoes?tab=integracoes", icon: Plug },
      { title: "Configurações", url: "/configuracoes", icon: Settings },
      { title: "Suporte", event: "kora:open-support", icon: LifeBuoy },
      { title: "Assinatura", url: "/upgrade", icon: CreditCard },
    ],
  },
];

const badgeStyles: Record<Badge, { label: string; className: string }> = {
  soon: { label: "Em breve", className: "border-border/60 bg-muted/40 text-muted-foreground" },
  beta: { label: "Beta", className: "border-primary/25 bg-primary/10 text-primary" },
  pro: { label: "Pro", className: "border-primary/30 bg-primary/15 text-primary" },
};

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
    if (path === "/") return location.pathname === "/";
    const pathMatch = location.pathname === path || location.pathname.startsWith(path + "/");
    if (!pathMatch) return false;
    if (query) {
      const tab = new URLSearchParams(query).get("tab");
      return tab === currentTab;
    }
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
          <SidebarGroup key={group.label} className={collapsed ? "p-0 mb-1" : "mb-2"}>
            {!collapsed && (
              <SidebarGroupLabel className="px-3 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground/45">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5 items-stretch">
                {group.items.map((item) => {
                  const active = isActive(item);
                  const Icon = item.icon;
                  const badge = item.badge ? badgeStyles[item.badge] : null;
                  const baseClass = `relative flex items-center rounded-lg font-medium transition-all duration-200 ${
                    collapsed
                      ? "h-10 w-10 mx-auto justify-center p-0"
                      : "gap-3 px-3 py-2 text-[0.875rem]"
                  } ${
                    item.disabled
                      ? "text-muted-foreground/40 cursor-not-allowed"
                      : active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`;
                  const style = active && !item.disabled
                    ? { boxShadow: "inset 0 0 0 1px hsl(348 94% 52% / 0.25)" }
                    : undefined;

                  const content = (
                    <>
                      {active && !collapsed && !item.disabled && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full orbit-gradient" />
                      )}
                      <Icon className={`h-[18px] w-[18px] flex-shrink-0 transition-colors duration-200 ${active && !item.disabled ? "text-primary" : ""}`} />
                      {!collapsed && (
                        <>
                          <span className="truncate flex-1">{item.title}</span>
                          {badge && (
                            <span className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${badge.className}`}>
                              {badge.label}
                            </span>
                          )}
                        </>
                      )}
                    </>
                  );

                  return (
                    <SidebarMenuItem key={item.title} className={collapsed ? "flex justify-center" : undefined}>
                      <SidebarMenuButton
                        asChild
                        tooltip={item.title + (badge ? ` · ${badge.label}` : "")}
                        className="group-data-[collapsible=icon]:!w-10 group-data-[collapsible=icon]:!h-10 group-data-[collapsible=icon]:!p-0"
                      >
                        {item.disabled ? (
                          <button
                            type="button"
                            onClick={() => toast.info(`${item.title} estará disponível em breve.`)}
                            title={collapsed ? `${item.title} · Em breve` : undefined}
                            className={baseClass + " w-full text-left"}
                          >
                            {content}
                          </button>
                        ) : item.url ? (
                          <NavLink
                            to={item.url}
                            end={item.url === "/"}
                            title={collapsed ? item.title : undefined}
                            className={baseClass}
                            activeClassName=""
                            style={style}
                          >
                            {content}
                          </NavLink>
                        ) : (
                          <button
                            type="button"
                            onClick={() => item.event && dispatchEvent(item.event)}
                            title={collapsed ? item.title : undefined}
                            className={baseClass + " w-full text-left"}
                          >
                            {content}
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
