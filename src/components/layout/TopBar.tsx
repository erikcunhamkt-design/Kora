import { Search, Bell } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Dashboard", subtitle: "Visão geral do seu negócio" },
  "/portfolio": { title: "Portfólio", subtitle: "Seus projetos e trabalhos" },
  "/clientes": { title: "Clientes", subtitle: "Gerencie sua base de clientes" },
  "/crm": { title: "CRM", subtitle: "Pipeline de oportunidades" },
  "/financeiro": { title: "Financeiro", subtitle: "Controle financeiro" },
  "/tarefas": { title: "Tarefas", subtitle: "Gerencie suas atividades" },
  "/metas": { title: "Metas", subtitle: "Acompanhe seus objetivos" },
  "/configuracoes": { title: "Configurações", subtitle: "Preferências do sistema" },
};

export function TopBar() {
  const location = useLocation();
  const page = pageTitles[location.pathname] || pageTitles["/"];

  return (
    <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <div>
          <h1 className="text-lg font-semibold text-foreground">{page.title}</h1>
          <p className="text-xs text-muted-foreground">{page.subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            className="pl-9 w-64 bg-muted border-border h-9 text-sm"
          />
        </div>
        <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full orbit-gradient" />
        </button>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="orbit-gradient text-white text-xs font-semibold">
            DS
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
