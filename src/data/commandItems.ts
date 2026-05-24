import {
  LayoutDashboard, Users, Target, ShoppingCart, DollarSign, CheckSquare,
  Trophy, Briefcase, Bot, Globe, Settings, UserPlus, UserCheck, Plus,
  FileText, Wrench, Link2, FormInput, Calendar, MessageCircle, Zap, Plug,
  ShoppingBag, Package, Layers, CreditCard, Image as ImageIcon, FolderKanban,
  Receipt, Sparkles, CalendarCheck, LifeBuoy,
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
  { id: "nav-day", title: "Central do Dia", description: "Foco e missões de hoje", icon: CalendarCheck, group: "Principal", route: "/?day=1", aliases: ["hoje", "today", "foco", "dia"] },
  { id: "nav-clientes", title: "Clientes", description: "Gerenciar contatos", icon: Users, group: "Principal", route: "/clientes", aliases: ["cliente", "customer", "contato", "contatos"] },
  { id: "nav-crm", title: "CRM", description: "Pipeline e leads", icon: Target, group: "Principal", route: "/crm", aliases: ["lead", "leads", "pipeline", "funil"] },
  { id: "nav-catalogo", title: "Catálogo Comercial", description: "Serviços, produtos, planos e checkout", icon: ShoppingBag, group: "Principal", route: "/vendas?tab=servicos", aliases: ["catalogo", "servicos", "produtos", "planos", "vendas", "oferta"] },
  { id: "nav-orcamentos", title: "Orçamentos", description: "Propostas comerciais", icon: FileText, group: "Principal", route: "/vendas?tab=orcamentos", aliases: ["orcamento", "proposta", "quote"] },
  { id: "nav-vendas", title: "Vendas & Catálogo", description: "Prospects, ranking, demandas", icon: ShoppingCart, group: "Principal", route: "/vendas", aliases: ["vendas", "comercial"] },
  { id: "nav-financeiro", title: "Financeiro", description: "Receitas, despesas e relatórios", icon: DollarSign, group: "Principal", route: "/financeiro", aliases: ["dinheiro", "receita", "despesa", "caixa", "transacao"] },
  { id: "nav-tarefas", title: "Tarefas", description: "To-dos estilo Todoist", icon: CheckSquare, group: "Principal", route: "/tarefas", aliases: ["task", "todo", "afazer"] },
  { id: "nav-projetos", title: "Projetos", description: "Gestão de entregas", icon: FolderKanban, group: "Principal", route: "/portfolio?tab=projetos", aliases: ["projeto", "entrega"] },
  { id: "nav-conteudo", title: "Conteúdo", description: "Produção de conteúdo", icon: ImageIcon, group: "Principal", route: "/portfolio?tab=conteudo", aliases: ["conteudo", "content", "post", "carrossel"] },
  { id: "nav-metas", title: "Metas", description: "Objetivos do estúdio", icon: Trophy, group: "Principal", route: "/metas", aliases: ["goal", "objetivo"] },
  { id: "nav-portfolio", title: "Portfólio público", description: "Projetos publicados", icon: Briefcase, group: "Principal", route: "/portfolio?tab=publicados", aliases: ["portfolio", "trabalhos"] },
  { id: "nav-automacoes", title: "Automações & IA", description: "Agentes, regras e fluxos", icon: Bot, group: "Principal", route: "/automacoes", aliases: ["automacao", "automation", "fluxo", "ia", "ai"] },
  { id: "nav-presenca", title: "Presença", description: "Página pública e bio", icon: Globe, group: "Principal", route: "/presenca", aliases: ["site", "bio", "publico", "perfil"] },
  { id: "nav-config", title: "Configurações", description: "Preferências da conta", icon: Settings, group: "Principal", route: "/configuracoes", aliases: ["settings", "ajustes", "perfil"] },
  { id: "nav-suporte", title: "Ajuda & Suporte", description: "Tickets e dúvidas", icon: LifeBuoy, group: "Principal", route: "/configuracoes?tab=suporte", aliases: ["ajuda", "suporte", "help", "ticket"] },

  // Ações rápidas
  { id: "act-cliente", title: "Novo cliente", description: "Adicionar contato", icon: UserPlus, group: "Ações rápidas", route: "/clientes?new=1", aliases: ["cliente", "contato", "customer"] },
  { id: "act-lead", title: "Novo lead", description: "Adicionar ao pipeline", icon: UserCheck, group: "Ações rápidas", route: "/crm?new=1", aliases: ["lead", "pipeline"] },
  { id: "act-tarefa", title: "Nova tarefa", description: "Criar to-do", icon: Plus, group: "Ações rápidas", route: "/tarefas?new=1", aliases: ["task", "todo"] },
  { id: "act-transacao", title: "Nova transação", description: "Receita ou despesa", icon: DollarSign, group: "Ações rápidas", route: "/financeiro?new=1", aliases: ["receita", "despesa", "dinheiro"] },
  { id: "act-venda-rapida", title: "Venda rápida", description: "Lançar receita no caixa", icon: Sparkles, group: "Ações rápidas", route: "/financeiro?new=income", aliases: ["venda", "receita", "entrada"] },
  { id: "act-despesa", title: "Lançar despesa", description: "Nova conta a pagar", icon: Receipt, group: "Ações rápidas", route: "/financeiro?new=expense", aliases: ["despesa", "conta", "pagar"] },
  { id: "act-projeto", title: "Novo projeto", description: "Adicionar entrega", icon: Briefcase, group: "Ações rápidas", route: "/portfolio?tab=projetos&new=1", aliases: ["projeto", "entrega"] },
  { id: "act-conteudo", title: "Novo conteúdo", description: "Post, carrossel ou story", icon: ImageIcon, group: "Ações rápidas", route: "/portfolio?tab=conteudo&new=1", aliases: ["conteudo", "post", "carrossel"] },
  { id: "act-orcamento", title: "Novo orçamento", description: "Criar proposta", icon: FileText, group: "Ações rápidas", route: "/vendas?tab=orcamentos&new=quote", aliases: ["orcamento", "proposta", "quote"] },
  { id: "act-servico", title: "Novo serviço", description: "Cadastrar serviço no catálogo", icon: Wrench, group: "Ações rápidas", route: "/vendas?tab=servicos&new=service", aliases: ["servico", "service", "catalogo"] },
  { id: "act-produto", title: "Novo produto", description: "Cadastrar produto", icon: Package, group: "Ações rápidas", route: "/vendas?tab=servicos&new=product", aliases: ["produto", "product"] },
  { id: "act-plano", title: "Novo plano", description: "Pacote ou recorrência", icon: Layers, group: "Ações rápidas", route: "/vendas?tab=servicos&new=plan", aliases: ["plano", "pacote", "recorrencia"] },
  { id: "act-checkout", title: "Abrir Checkout", description: "Personalizar link de checkout", icon: CreditCard, group: "Ações rápidas", route: "/vendas?tab=servicos&view=checkout", aliases: ["checkout", "pagamento", "link"] },


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
