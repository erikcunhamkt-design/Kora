

# Orbit — SaaS para Designers

## Visão Geral
Aplicativo web SaaS chamado **Orbit** para organização e gestão de designers. Estrutura base completa com layout premium, dark theme futurista e navegação funcional entre 8 páginas.

## Design System
- **Tema escuro**: fundo grafite (#0F1117), cards (#1A1D27), bordas sutis
- **Cores de destaque**: azul (#3B82F6), roxo (#8B5CF6), ciano (#06B6D4) como acentos
- **Tipografia**: hierarquia clara com títulos bold, subtítulos em muted, corpo legível
- **Componentes**: bordas arredondadas (radius 12px), sombras suaves, hover states elegantes

## Layout Principal
- **Sidebar fixa** à esquerda com logo Orbit, ícones Lucide, navegação entre as 8 páginas, indicador de rota ativa com destaque em gradiente azul/roxo
- **Topbar** com título da página atual, barra de busca e avatar do usuário
- **Área de conteúdo** responsiva com padding consistente e scroll suave

## Páginas (todas com título, subtítulo e estrutura visual)

### 1. Dashboard
- 6 cards de métricas: Faturamento do Mês (R$ 12.450), Clientes Ativos (24), Tarefas Pendentes (8), Propostas em Andamento (5), Meta Mensal (78%), Projetos no Portfólio (16)
- Gráfico de desempenho mensal (barras com Recharts)
- Lista de tarefas recentes (5 itens fictícios)
- Pipeline visual do CRM (colunas: Lead → Proposta → Negociação → Fechado)
- Seção de metas com barras de progresso

### 2. Portfólio
- Grid de cards de projetos com thumbnail placeholder, título, categoria e data

### 3. Clientes
- Tabela moderna com nome, email, status, projetos e valor total

### 4. CRM
- Kanban simplificado com colunas de status e cards de oportunidades

### 5. Financeiro
- Cards de resumo (receita, despesas, lucro) + tabela de transações recentes

### 6. Tarefas
- Lista de tarefas com checkbox, prioridade, prazo e status

### 7. Metas
- Cards de metas com barras de progresso e indicadores visuais

### 8. Configurações
- Formulário de perfil com inputs estilizados e seções organizadas

## Estrutura de Código
- `src/components/layout/` — AppSidebar, TopBar, MainLayout
- `src/components/dashboard/` — MetricCard, RecentTasks, CRMPipeline, PerformanceChart, GoalsSection
- `src/pages/` — uma página por seção
- Rotas configuradas no App.tsx com React Router
- Dados fictícios em constantes dentro dos componentes

