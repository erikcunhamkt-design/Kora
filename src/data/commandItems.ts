import {
  LayoutDashboard, Users, Target, ShoppingCart, DollarSign, CheckSquare,
  Trophy, Briefcase, Bot, Globe, Settings, UserPlus, UserCheck, Plus,
  FileText, Wrench, Link2, FormInput, Calendar, MessageCircle, Zap, Plug,
  type LucideIcon,
} from "lucide-react";

export type CommandItem = {
  id: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  group: "Principal" | "Ações rápidas" | "Presença" | "IA e automações";
  route: string;
  shortcut?: string;
  aliases?: string[];
};

export const commandItems: CommandItem[] = [
  // Principal
  { id: "nav-dashboard", title: "Dashboard", description: "Visão geral do estúdio", icon: LayoutDashboard, group: "Principal", route: "/", aliases: ["inicio", "home", "painel"] },
  { id: "nav-clientes", title: "Clientes", description: "Gerenciar contatos", icon: Users, group: "Principal", route: "/clientes", aliases: ["cliente", "customer", "contato", "contatos"] },
  { id: "nav-crm", title: "CRM", description: "Pipeline e leads", icon: Target, group: "Principal", route: "/crm", aliases: ["lead", "leads", "pipeline", "funil"] },
  { id: "nav-vendas", title: "Vendas", description: "Orçamentos e serviços", icon: ShoppingCart, group: "Principal", route: "/vendas", aliases: ["orcamento", "proposta", "servico"] },
  { id: "nav-financeiro", title: "Financeiro", description: "Receitas e despesas", icon: DollarSign, group: "Principal", route: "/financeiro", aliases: ["dinheiro", "receita", "despesa", "caixa", "transacao"] },
  { id: "nav-tarefas", title: "Tarefas", description: "To-dos e produtividade", icon: CheckSquare, group: "Principal", route: "/tarefas", aliases: ["task", "todo", "afazer"] },
  { id: "nav-metas", title: "Metas", description: "Objetivos do estúdio", icon: Trophy, group: "Principal", route: "/metas", aliases: ["goal", "objetivo"] },
  { id: "nav-portfolio", title: "Portfólio", description: "Projetos e conteúdos", icon: Briefcase, group: "Principal", route: "/portfolio", aliases: ["projeto", "projetos", "trabalhos"] },
  { id: "nav-automacoes", title: "Automações", description: "Regras e fluxos", icon: Bot, group: "Principal", route: "/automacoes", aliases: ["automacao", "automation", "fluxo"] },
  { id: "nav-presenca", title: "Presença", description: "Página pública e bio", icon: Globe, group: "Principal", route: "/presenca", aliases: ["site", "bio", "publico", "perfil"] },
  { id: "nav-config", title: "Configurações", description: "Preferências da conta", icon: Settings, group: "Principal", route: "/configuracoes", aliases: ["settings", "ajustes", "perfil"] },

  // Ações rápidas
  { id: "act-cliente", title: "Novo cliente", description: "Adicionar contato", icon: UserPlus, group: "Ações rápidas", route: "/clientes?new=1", aliases: ["cliente", "contato", "customer"] },
  { id: "act-lead", title: "Novo lead", description: "Adicionar ao pipeline", icon: UserCheck, group: "Ações rápidas", route: "/crm?new=1", aliases: ["lead", "pipeline"] },
  { id: "act-tarefa", title: "Nova tarefa", description: "Criar to-do", icon: Plus, group: "Ações rápidas", route: "/tarefas?new=1", aliases: ["task", "todo"] },
  { id: "act-transacao", title: "Nova transação", description: "Receita ou despesa", icon: DollarSign, group: "Ações rápidas", route: "/financeiro?new=1", aliases: ["receita", "despesa", "dinheiro"] },
  { id: "act-projeto", title: "Novo projeto", description: "Adicionar ao portfólio", icon: Briefcase, group: "Ações rápidas", route: "/portfolio?new=1", aliases: ["projeto", "portfolio"] },
  { id: "act-orcamento", title: "Novo orçamento", description: "Criar proposta", icon: FileText, group: "Ações rápidas", route: "/vendas?new=quote", aliases: ["orcamento", "proposta", "quote"] },
  { id: "act-servico", title: "Novo serviço", description: "Cadastrar serviço", icon: Wrench, group: "Ações rápidas", route: "/vendas?new=service", aliases: ["servico", "service"] },

  // Presença
  { id: "pres-publico", title: "Página pública", description: "Seu site público", icon: Globe, group: "Presença", route: "/presenca?tab=publico", aliases: ["site", "publico"] },
  { id: "pres-bio", title: "Link da bio", description: "Bio links", icon: Link2, group: "Presença", route: "/presenca?tab=bio", aliases: ["bio", "linktree"] },
  { id: "pres-forms", title: "Formulários", description: "Captação de leads", icon: FormInput, group: "Presença", route: "/presenca?tab=forms", aliases: ["formulario", "form"] },
  { id: "pres-agenda", title: "Agendamento", description: "Reuniões e horários", icon: Calendar, group: "Presença", route: "/presenca?tab=agenda", aliases: ["agenda", "schedule", "reuniao"] },

  // IA e automações
  { id: "ia-agents", title: "Assistentes de IA", description: "Agentes inteligentes", icon: Bot, group: "IA e automações", route: "/automacoes?tab=ai", aliases: ["ia", "ai", "agente", "assistente"] },
  { id: "ia-whatsapp", title: "WhatsApp", description: "Atendimento e mensagens", icon: MessageCircle, group: "IA e automações", route: "/automacoes?tab=whatsapp", aliases: ["zap", "whatsapp", "atendimento", "mensagem"] },
  { id: "ia-rules", title: "Regras de automação", description: "Fluxos automáticos", icon: Zap, group: "IA e automações", route: "/automacoes?tab=rules", aliases: ["regra", "fluxo", "automacao"] },
  { id: "ia-integ", title: "Integrações", description: "Conectar serviços", icon: Plug, group: "IA e automações", route: "/automacoes?tab=integrations", aliases: ["integracao", "integration", "conectar"] },
];
