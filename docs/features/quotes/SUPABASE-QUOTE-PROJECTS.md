# Orçamentos Supabase - Gerar Projeto Experimental

Este documento descreve a integração que permite gerar um projeto no Supabase a partir de um orçamento aprovado.

## Objetivo
Permitir que usuários criem um projeto base no Supabase a partir de propostas/orçamentos aprovados de forma controlada por feature flag (`kora.quotes.supabaseCreateProject.enabled`), com confirmação explícita via modal e validação de duplicidade, mantendo os fluxos locais isolados.

## Tabela de Projetos Supabase
A tabela criada no Supabase é a `public.projects` via a migration [20260601_030000_create_projects_schema.sql](file:///C:/Users/erikw/.gemini/antigravity/scratch/orbit-designer-hub/supabase/migrations/20260601_030000_create_projects_schema.sql):
* `id` UUID PRIMARY KEY.
* `workspace_id` UUID referenciando `workspaces(id)` com cascata.
* `client_id` UUID referenciando `clients(id)` com set null.
* `quote_id` UUID referenciando `quotes(id)` com set null.
* `opportunity_id` UUID referenciando `crm_opportunities(id)` com set null.
* `title` TEXT NOT NULL.
* `description` TEXT.
* `status` TEXT com padrão 'active'.
* `start_date` DATE.
* `due_date` DATE.
* `budget` NUMERIC.
* `source` TEXT com padrão 'quote'.
* `is_demo` BOOLEAN.
* `archived` BOOLEAN.
* `deleted_at` TIMESTAMPTZ.

Habilitado **Row Level Security (RLS)** restringindo a leitura e gravação a membros do mesmo workspace (`public.is_workspace_member(workspace_id)`).

## Feature Flag
* **Chave**: `kora.quotes.supabaseCreateProject.enabled`
* **Padrão**: `false`
* **Ativação**: Pode ser ligada/desligada em *Configurações > Empresa > Orçamentos Supabase - Gerar Projeto Experimental*.

## Repositório
As funções estão implementadas em [projectsRepository.ts](file:///C:/Users/erikw/.gemini/antigravity/scratch/orbit-designer-hub/src/repositories/projectsRepository.ts):
* `findProjectByQuote(workspaceId, quoteId)`: Busca projetos existentes para evitar duplicidade.
* `createProjectFromQuote(workspaceId, input)`: Insere o projeto base associando `quote_id`, `client_id`, `opportunity_id` com status `'active'` e source `'quote'`.
* `softDeleteProject(workspaceId, projectId)`: Executa deleção lógica do projeto definindo `deleted_at`.

## Interface do Usuário (UI)
* **Ação**: O botão "Gerar projeto" aparece apenas quando o orçamento está com status `'approved'`.
* **Locais**:
  1. No card de visualização experimental em Configurações (`SupabaseQuotesViewerCard.tsx`).
  2. Na seção de orçamentos vinculados no drawer de CRM (`LinkedQuotesSection.tsx`).
* **Modal de Entrada**: O modal [CreateProjectFromQuoteDialog.tsx](file:///C:/Users/erikw/.gemini/antigravity/scratch/orbit-designer-hub/src/components/crm/CreateProjectFromQuoteDialog.tsx) pré-preenche título, orçamento/budget e IDs vinculados, permitindo editar título, orçamento, vencimento, data de início e descrição.

## Regra de Duplicidade
Antes de efetuar a gravação, o sistema verifica se já existe um projeto com `quote_id` idêntico, `source = 'quote'` e `deleted_at IS NULL`. Se encontrado, o fluxo é cancelado e um toast de erro é disparado: *"Este orçamento já possui um projeto vinculado."*

## Registro de Logs Locais
Em caso de sucesso na transação real com o Supabase, o log é inserido no array do `localStorage`:
* **Chave**: `kora.quotes.supabaseProjects.v1`
* **Campos**: `quoteId`, `projectId`, `title`, `budget`, `createdAt`.

## Limitações e Ações Bloqueadas
* Criação de tarefas automáticas, cronogramas automáticos, checklists e faturamento adicional continuam bloqueados.
* Nenhum dado local de projetos (`orbyt.projects.v1`) ou tarefas (`orbyt.tasks.v1`) é modificado.
* As telas locais continuam usando o `localStorage`.
* A contagem consolidada de projetos criados remotamente é visível somente leitura no [Dashboard Operacional](../dashboard/SUPABASE-OPERATIONAL-DASHBOARD.md).
