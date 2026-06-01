# Projetos Supabase - Gerar Tarefas Base Experimental

Este documento descreve a integração que permite gerar um checklist inicial de tarefas base no Supabase a partir de um projeto Supabase existente.

## Objetivo
Permitir que os usuários gerem um conjunto de tarefas padrão (checklist de kickoff, planejamento e entrega) associado a um projeto Supabase, com confirmação explícita via modal e validação de duplicidade, mantendo os fluxos locais e o localStorage intactos.

## Tabela de Tarefas Supabase
A tabela criada no Supabase é a `public.tasks` via a migration [20260601_040000_create_tasks_schema.sql](file:///C:/Users/erikw/.gemini/antigravity/scratch/orbit-designer-hub/supabase/migrations/20260601_040000_create_tasks_schema.sql):
* `id` UUID PRIMARY KEY.
* `workspace_id` UUID referenciando `workspaces(id)` com cascata.
* `project_id` UUID referenciando `projects(id)` com cascata.
* `client_id` UUID referenciando `clients(id)` com set null.
* `quote_id` UUID referenciando `quotes(id)` com set null.
* `opportunity_id` UUID referenciando `crm_opportunities(id)` com set null.
* `title` TEXT NOT NULL.
* `description` TEXT.
* `status` TEXT com padrão 'todo'.
* `priority` TEXT com padrão 'medium'.
* `due_date` DATE.
* `source` TEXT com padrão 'project_template'.
* `sort_order` INTEGER com padrão 0.
* `is_demo` BOOLEAN.
* `archived` BOOLEAN.
* `deleted_at` TIMESTAMPTZ.
* `created_at` TIMESTAMPTZ.
* `updated_at` TIMESTAMPTZ.

Habilitado **Row Level Security (RLS)** restringindo a leitura e gravação a membros do mesmo workspace (`public.is_workspace_member(workspace_id)`).

## Feature Flag
* **Chave**: `kora.projects.supabaseCreateBaseTasks.enabled`
* **Padrão**: `false`
* **Ativação**: Pode ser ligada/desligada em *Configurações > Empresa/Supabase > Projetos Supabase - Gerar Tarefas Base Experimental*.

## Repositório
As funções estão implementadas em [tasksRepository.ts](file:///C:/Users/erikw/.gemini/antigravity/scratch/orbit-designer-hub/src/repositories/tasksRepository.ts):
* `listTasksByProject(workspaceId, projectId)`: Retorna as tarefas ativas vinculadas ao projeto.
* `createProjectBaseTasks(workspaceId, tasks)`: Insere em lote as tarefas fornecidas para o workspace ativo.
* `softDeleteTask(workspaceId, taskId)`: Executa deleção lógica de uma tarefa definindo `deleted_at`.

## Interface do Usuário (UI)
* **Ação**: O botão "Gerar tarefas base" é exibido ao lado de cada projeto listado no painel da *Visão Operacional Supabase*.
* **Regra de Flag**: Clicar no botão com a flag desativada dispara um toast informativo bloqueando o fluxo.
* **Modal**: O modal [CreateProjectBaseTasksDialog.tsx](file:///C:/Users/erikw/.gemini/antigravity/scratch/orbit-designer-hub/src/components/projects/CreateProjectBaseTasksDialog.tsx) apresenta as 9 tarefas pré-configuradas em um checklist confirmável, permitindo editar individualmente títulos, prazos, prioridades e descrições.
* **Visualização**: O botão "Ver tarefas" abre uma listagem recolhível somente leitura das tarefas Supabase associadas ao projeto (veja [SUPABASE-PROJECT-TASKS-VIEWER.md](./SUPABASE-PROJECT-TASKS-VIEWER.md)).

## Tarefas Padrão
* Kickoff com cliente (offset +2 dias)
* Coletar materiais (offset +4 dias)
* Revisar briefing (offset +6 dias)
* Planejar entregas (offset +8 dias)
* Produzir primeira entrega (offset +15 dias)
* Revisão interna (offset +18 dias)
* Enviar para aprovação (offset +20 dias)
* Ajustes finais (offset +25 dias)
* Encerramento do projeto (offset +30 dias)

## Regra de Duplicidade
Antes de enviar as tarefas ao banco de dados, o sistema executa uma verificação para saber se já existem tarefas ativas (`deleted_at IS NULL`) no Supabase para o mesmo `project_id` cuja origem seja `source = 'project_template'`. Caso positivo, impede a criação e mostra um toast: *"Este projeto já possui tarefas base geradas."*

## Registro de Logs Locais
Logs locais são gerados após a persistência bem-sucedida no Supabase:
* **Chave**: `kora.projects.supabaseBaseTasks.v1`
* **Campos**: `projectId`, `taskIds` (array de UUIDs das tarefas criadas), `count` e `createdAt`.

## Limitações e Ações Bloqueadas
* Não há sincronização com agendas externas (Google Calendar).
* Cronogramas automáticos inteligentes, dependências e automações recorrentes continuam indisponíveis.
* Nenhum dado local de tarefas (`orbyt.tasks.v1`) ou projetos (`orbyt.projects.v1`) é modificado. As interfaces locais principais permanecem intocadas.

## Próximos Passos
* Implementar dependências entre tarefas e cronogramas interativos à medida que o módulo evoluir.

## Relatório de QA
### Cenários Testados
1. **Migration e Tabela (`public.tasks`)**:
   - Criação da tabela com todos os 18 campos requeridos validados via SQL.
   - Ativação das políticas de RLS baseadas no workspace e na função `public.is_workspace_member(workspace_id)`.
2. **Repositório (`tasksRepository.ts`)**:
   - `listTasksByProject` filtra corretamente por `workspace_id`, `project_id` e ignora logicamente registros deletados (`deleted_at IS NOT NULL`).
   - `createProjectBaseTasks` realiza a gravação em lote populando todos os campos com os valores iniciais recomendados (`status = 'todo'`, `source = 'project_template'`).
   - `softDeleteTask` executa soft-delete de tarefas preenchendo a coluna `deleted_at`.
3. **Feature Flag (`kora.projects.supabaseCreateBaseTasks.enabled`)**:
   - Com a flag desligada (`false`), tentar gerar tarefas base dispara um toast informativo bloqueando a ação.
   - Com a flag ativa (`true`), abre o modal de preenchimento e confirmação.
4. **Controle em Configurações & UI**:
   - O card de ativação é montado sob a aba Empresa e o botão "Gerar tarefas base" é renderizado ao lado de cada projeto no painel operacional.
5. **Modal (`CreateProjectBaseTasksDialog.tsx`)**:
   - Apresenta o checklist contendo as 9 tarefas base padrão.
   - Prazos calculados dinamicamente com base nos offsets de dias (+2 a +30 dias).
   - Permite que o usuário marque/desmarque tarefas da lista antes de criar.
6. **Regra de Duplicidade**:
   - Tentar gerar tarefas base para um projeto que já as possui é bloqueado após a chamada `listTasksByProject`, disparando o toast: *"Este projeto já possui tarefas base geradas."* Impedindo novos registros e logs.
7. **Logs Locais**:
   - Chave `kora.projects.supabaseBaseTasks.v1` criada com sucesso contendo o mapeamento de IDs de projetos, tarefas criadas e contadores de sucesso. Erros de rede ou workspace ausente barram a criação do log.

### Bugs Encontrados e Corrigidos
* *Nenhum bug detectado*. Todas as regras de negócio de duplicidade e transacionalidade funcionaram corretamente.

### Limitações
* Ações como editar tarefas Supabase avançadas, dependências, calendário integrado e automações de notificações permanecem totalmente bloqueadas nesta versão.
* Nenhum impacto nos dados locais de tarefas e projetos (`orbyt.*`).

### Recomendação Final
A geração de tarefas base experimental, a sua visualização passiva por projeto e a transição experimental de status estão consolidadas e seguras para testes internos de usuário final. Recomenda-se prosseguir com o desenvolvimento de conciliações avançadas ou aprimorar os logs para auditoria detalhada.

