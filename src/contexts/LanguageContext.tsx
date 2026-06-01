import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type Language = "pt-BR" | "pt-PT" | "en" | "es";

interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, defaultValue?: string) => string;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

const translations: Record<Language, Record<string, string>> = {
  "pt-BR": {
    "sidebar.dashboard": "Início",
    "sidebar.portfolio": "Portfólio",
    "sidebar.clients": "Clientes",
    "sidebar.crm": "CRM",
    "sidebar.sales": "Vendas",
    "sidebar.finance": "Financeiro",
    "sidebar.tasks": "Tarefas",
    "sidebar.daycenter": "Central do Dia",
    "sidebar.briefings": "Briefings",
    "sidebar.goals": "Metas",
    "sidebar.automations": "Automações",
    "sidebar.presence": "Presença",
    "sidebar.settings": "Configurações",
    "sidebar.upgrade": "Upgrade",
    
    "topbar.search": "Buscar...",
    "topbar.plan.free": "Plano Free",
    "topbar.plan.pro": "Plano Pro",
    "topbar.plan.studio": "Plano Studio",
    "topbar.today": "Hoje",
    "topbar.ai": "IA",
    "topbar.support": "Suporte",
    "topbar.notifications": "Notificações",
    "topbar.profile": "Perfil",
    
    "clients.title": "Clientes",
    "clients.subtitle": "Gerencie sua base de clientes, contatos e oportunidades comerciais.",
    "clients.newClient": "Novo cliente",
    "clients.linkCadastro": "Link de cadastro",
    "clients.total": "Total",
    "clients.active": "Ativos",
    "clients.leads": "Leads / Prospects",
    "clients.potentialValue": "Valor potencial",
    "clients.nextStepNeeded": "Precisam de próximo passo",
    "clients.searchPlaceholder": "Buscar por nome, empresa, e-mail ou telefone...",
    
    "crm.title": "CRM",
    "crm.subtitle": "Acompanhe suas negociações, propostas e funis de vendas.",
    "crm.newOpportunity": "Nova oportunidade",
    "crm.pipelines": "Funis",
    "crm.automations": "Automações",
    "crm.searchPlaceholder": "Buscar oportunidades...",
    
    "settings.title": "Configurações",
    "settings.subtitle": "Gerencie sua conta, empresa e preferências do KORA HUB",
    "settings.language": "Idioma",
    "settings.appearance": "Aparência",
    "settings.accessibility": "Acessibilidade",
  },
  "pt-PT": {
    "sidebar.dashboard": "Painel",
    "sidebar.portfolio": "Portefólio",
    "sidebar.clients": "Clientes",
    "sidebar.crm": "CRM",
    "sidebar.sales": "Vendas",
    "sidebar.finance": "Financeiro",
    "sidebar.tasks": "Tarefas",
    "sidebar.daycenter": "Central do Dia",
    "sidebar.briefings": "Briefings",
    "sidebar.goals": "Metas",
    "sidebar.automations": "Automações",
    "sidebar.presence": "Presença",
    "sidebar.settings": "Definições",
    "sidebar.upgrade": "Upgrade",
    
    "topbar.search": "Procurar...",
    "topbar.plan.free": "Plano Gratuito",
    "topbar.plan.pro": "Plano Pro",
    "topbar.plan.studio": "Plano Studio",
    "topbar.today": "Hoje",
    "topbar.ai": "IA",
    "topbar.support": "Suporte",
    "topbar.notifications": "Notificações",
    "topbar.profile": "Perfil",
    
    "clients.title": "Clientes",
    "clients.subtitle": "Gerencie a sua base de clientes, contactos e oportunidades comerciais.",
    "clients.newClient": "Novo cliente",
    "clients.linkCadastro": "Link de registo",
    "clients.total": "Total",
    "clients.active": "Ativos",
    "clients.leads": "Leads / Prospects",
    "clients.potentialValue": "Valor potencial",
    "clients.nextStepNeeded": "Necessitam de próximo passo",
    "clients.searchPlaceholder": "Procurar por nome, empresa, e-mail ou telefone...",
    
    "crm.title": "CRM",
    "crm.subtitle": "Acompanhe as suas negociações, propostas e funis de vendas.",
    "crm.newOpportunity": "Nova oportunidade",
    "crm.pipelines": "Funis",
    "crm.automations": "Automações",
    "crm.searchPlaceholder": "Procurar oportunidades...",
    
    "settings.title": "Definições",
    "settings.subtitle": "Gerencie a sua conta, empresa e preferências do KORA HUB",
    "settings.language": "Idioma",
    "settings.appearance": "Aparência",
    "settings.accessibility": "Acessibilidade",
  },
  "en": {
    "sidebar.dashboard": "Dashboard",
    "sidebar.portfolio": "Portfolio",
    "sidebar.clients": "Clients",
    "sidebar.crm": "CRM",
    "sidebar.sales": "Sales",
    "sidebar.finance": "Finance",
    "sidebar.tasks": "Tasks",
    "sidebar.daycenter": "Daily Hub",
    "sidebar.briefings": "Briefings",
    "sidebar.goals": "Goals",
    "sidebar.automations": "Automations",
    "sidebar.presence": "Presence",
    "sidebar.settings": "Settings",
    "sidebar.upgrade": "Upgrade",
    
    "topbar.search": "Search...",
    "topbar.plan.free": "Free Plan",
    "topbar.plan.pro": "Pro Plan",
    "topbar.plan.studio": "Studio Plan",
    "topbar.today": "Today",
    "topbar.ai": "AI",
    "topbar.support": "Support",
    "topbar.notifications": "Notifications",
    "topbar.profile": "Profile",
    
    "clients.title": "Clients",
    "clients.subtitle": "Manage your client database, contacts, and business opportunities.",
    "clients.newClient": "New client",
    "clients.linkCadastro": "Registration link",
    "clients.total": "Total",
    "clients.active": "Active",
    "clients.leads": "Leads / Prospects",
    "clients.potentialValue": "Potential Value",
    "clients.nextStepNeeded": "Needs next step",
    "clients.searchPlaceholder": "Search by name, company, email or phone...",
    
    "crm.title": "CRM",
    "crm.subtitle": "Track your negotiations, proposals, and sales pipelines.",
    "crm.newOpportunity": "New opportunity",
    "crm.pipelines": "Pipelines",
    "crm.automations": "Automations",
    "crm.searchPlaceholder": "Search opportunities...",
    
    "settings.title": "Settings",
    "settings.subtitle": "Manage your account, company and KORA HUB preferences",
    "settings.language": "Language",
    "settings.appearance": "Appearance",
    "settings.accessibility": "Accessibility",
  },
  "es": {
    "sidebar.dashboard": "Inicio",
    "sidebar.portfolio": "Portafolio",
    "sidebar.clients": "Clientes",
    "sidebar.crm": "CRM",
    "sidebar.sales": "Ventas",
    "sidebar.finance": "Finanzas",
    "sidebar.tasks": "Tareas",
    "sidebar.daycenter": "Centro del Día",
    "sidebar.briefings": "Briefings",
    "sidebar.goals": "Metas",
    "sidebar.automations": "Automatizaciones",
    "sidebar.presence": "Presencia",
    "sidebar.settings": "Configuración",
    "sidebar.upgrade": "Actualizar",
    
    "topbar.search": "Buscar...",
    "topbar.plan.free": "Plan Gratis",
    "topbar.plan.pro": "Plan Pro",
    "topbar.plan.studio": "Plan Studio",
    "topbar.today": "Hoy",
    "topbar.ai": "IA",
    "topbar.support": "Soporte",
    "topbar.notifications": "Notificaciones",
    "topbar.profile": "Perfil",
    
    "clients.title": "Clientes",
    "clients.subtitle": "Gestione su base de clientes, contactos y oportunidades comerciales.",
    "clients.newClient": "Nuevo cliente",
    "clients.linkCadastro": "Enlace de registro",
    "clients.total": "Total",
    "clients.active": "Activos",
    "clients.leads": "Leads / Prospects",
    "clients.potentialValue": "Valor potencial",
    "clients.nextStepNeeded": "Necesitan próximo paso",
    "clients.searchPlaceholder": "Buscar por nombre, empresa, correo o teléfono...",
    
    "crm.title": "CRM",
    "crm.subtitle": "Siga sus negociaciones, propuestas y embudos de ventas.",
    "crm.newOpportunity": "Nueva oportunidad",
    "crm.pipelines": "Embudos",
    "crm.automations": "Automatizaciones",
    "crm.searchPlaceholder": "Buscar oportunidades...",
    
    "settings.title": "Configuración",
    "settings.subtitle": "Gestione su cuenta, empresa y preferencias de KORA HUB",
    "settings.language": "Idioma",
    "settings.appearance": "Apariencia",
    "settings.accessibility": "Accesibilidad",
  }
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem("kora.language.v1");
      if (saved === "pt-BR" || saved === "pt-PT" || saved === "en" || saved === "es") {
        return saved;
      }
    } catch {
      // Ignore
    }
    return "pt-BR";
  });

  const setLanguage = useCallback((lang: Language) => {
    try {
      localStorage.setItem("kora.language.v1", lang);
    } catch {
      // Ignore
    }
    setLanguageState(lang);
  }, []);

  const t = useCallback((key: string, defaultValue?: string): string => {
    const dict = translations[language];
    return dict[key] || defaultValue || key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  return context;
};
