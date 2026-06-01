import {
  LayoutDashboard, Users, TrendingUp, ShoppingBag, FileText,
  DollarSign, CheckSquare, FolderKanban, Image as ImageIcon,
  Settings, Crown, Zap, Globe, CalendarCheck, LifeBuoy,
  ClipboardList, BarChart3, Link as LinkIcon, Calendar, Sparkles,
  Bot, Plug, CreditCard, Activity, ShieldCheck,
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
import { useTranslation } from "@/contexts/LanguageContext";

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
      { title: "Central do Dia", url: "/central-do-dia", icon: CalendarCheck },
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
      { title: "Checkout", icon: CreditCard, badge: "soon", disabled: true },
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
      { title: "Diagnósticos", icon: Activity, badge: "soon", disabled: true },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Configurações", url: "/configuracoes", icon: Settings },
      { title: "Integrações", url: "/automacoes?tab=integracoes", icon: Plug },
      { title: "Assinatura", url: "/upgrade", icon: CreditCard },
      { title: "Suporte", event: "kora:open-support", icon: LifeBuoy },
      { title: "Segurança", url: "/configuracoes?tab=seguranca", icon: ShieldCheck },
    ],
  },
];

const badgeStyles: Record<Badge, { label: string; className: string }> = {
  soon: { label: "Em breve", className: "border-border/40 bg-transparent text-muted-foreground/60" },
  beta: { label: "Beta", className: "border-border/40 bg-transparent text-muted-foreground/70" },
  pro: { label: "Pro", className: "border-amber-500/25 bg-transparent text-amber-400/80" },
};

const groupKeys: Record<string, string> = {
  "Principal": "sidebar.group.principal",
  "Operação": "sidebar.group.operation",
  "Vendas": "sidebar.group.sales",
  "Presença": "sidebar.group.presence",
  "Inteligência": "sidebar.group.intelligence",
  "Sistema": "sidebar.group.system",
};

const itemKeys: Record<string, string> = {
  "Dashboard": "sidebar.dashboard",
  "Portfólio": "sidebar.portfolio",
  "Clientes": "sidebar.clients",
  "CRM": "sidebar.crm",
  "Projetos": "sidebar.projects",
  "Tarefas": "sidebar.tasks",
  "Conteúdo": "sidebar.content",
  "Briefings": "sidebar.briefings",
  "Serviços": "sidebar.services",
  "Orçamentos": "sidebar.quotes",
  "Checkout": "sidebar.checkout",
  "Financeiro": "sidebar.finance",
  "Relatórios": "sidebar.reports",
  "Página Pública": "sidebar.publicpage",
  "Link da Bio": "sidebar.biolink",
  "Formulários": "sidebar.forms",
  "Agendamento": "sidebar.booking",
  "Agentes de IA": "sidebar.aiagents",
  "Automações": "sidebar.automations",
  "Créditos de IA": "sidebar.aicredits",
  "Diagnósticos": "sidebar.diagnostics",
  "Configurações": "sidebar.settings",
  "Integrações": "sidebar.integrations",
  "Assinatura": "sidebar.upgrade",
  "Suporte": "sidebar.support",
  "Segurança": "sidebar.security",
  "Central do Dia": "sidebar.daycenter",
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { isPro } = usePlan();
  const { t } = useTranslation();

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
            <span className="text-[0.625rem] text-muted-foreground/60 tracking-wider uppercase leading-tight truncate font-semibold">
              WORKSPACE
            </span>
          </div>
        )}
      </div>

      <SidebarContent className={collapsed ? "px-2 py-4" : "px-3 py-5"}>
        {navGroups.map((group) => {
          const groupTitle = t(groupKeys[group.label] || "", group.label);
          return (
            <SidebarGroup key={group.label} className={collapsed ? "p-0 mb-2" : "mb-4"}>
              {!collapsed && (
                <SidebarGroupLabel className="px-3 mb-1 text-[0.6rem] font-medium uppercase tracking-[0.16em] text-muted-foreground/35">
                  {groupTitle}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu className="space-y-0.5 items-stretch">
                  {group.items.map((item) => {
                    const active = isActive(item);
                    const Icon = item.icon;
                    const badge = item.badge ? badgeStyles[item.badge] : null;
                    const translatedTitle = t(itemKeys[item.title] || "", item.title);
                    const baseClass = `relative flex items-center rounded-lg font-medium transition-all duration-200 ${
                      collapsed
                        ? "h-10 w-10 mx-auto justify-center p-0"
                        : "gap-3 px-3 py-2 text-[0.875rem]"
                    } ${
                      item.disabled
                        ? "text-muted-foreground/35 cursor-not-allowed hover:bg-transparent"
                        : active
                        ? "bg-card-elevated text-foreground"
                        : "text-muted-foreground/85 hover:text-foreground hover:bg-muted/30"
                    }`;

                    const content = (
                      <>
                        {active && !collapsed && !item.disabled && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r-full bg-primary/70" />
                        )}
                        <Icon className={`h-[18px] w-[18px] flex-shrink-0 transition-colors duration-200 ${active && !item.disabled ? "text-primary/90" : ""}`} />
                        {!collapsed && (
                          <>
                            <span className="truncate flex-1">{translatedTitle}</span>
                            {badge && (
                              <span className={`text-[9px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded border ${badge.className}`}>
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
                          tooltip={translatedTitle + (badge ? ` · ${badge.label}` : "")}
                          className="group-data-[collapsible=icon]:!w-10 group-data-[collapsible=icon]:!h-10 group-data-[collapsible=icon]:!p-0"
                        >
                          {item.disabled ? (
                            <button
                              type="button"
                              onClick={() => toast.info(`${translatedTitle} estará disponível em breve.`)}
                              title={collapsed ? `${translatedTitle} · Em breve` : undefined}
                              className={baseClass + " w-full text-left"}
                            >
                              {content}
                            </button>
                          ) : item.url ? (
                            <NavLink
                              to={item.url}
                              end={item.url === "/"}
                              title={collapsed ? translatedTitle : undefined}
                              className={baseClass}
                              activeClassName=""
                              
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
          );
        })}
      </SidebarContent>

      {!isPro && (
        <SidebarFooter className={collapsed ? "p-2" : "p-3"}>
          <button
            onClick={() => navigate("/upgrade")}
            title="Upgrade Pro"
            className={`flex items-center rounded-lg border border-border/50 bg-card-elevated/60 hover:bg-card-elevated hover:border-amber-500/30 transition-all duration-200 text-sm press-effect group ${
              collapsed ? "h-10 w-10 mx-auto justify-center p-0" : "w-full gap-2.5 px-4 py-2.5"
            }`}
          >
            <Crown className="h-4 w-4 text-amber-400/80 shrink-0 group-hover:scale-110 transition-transform duration-200" />
            {!collapsed && <span className="text-foreground/85 font-medium">Upgrade Pro</span>}
          </button>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
