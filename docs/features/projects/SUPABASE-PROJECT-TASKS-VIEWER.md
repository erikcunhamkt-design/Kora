# Tarefas Supabase - Visualização Experimental por Projeto

Este documento descreve a implementação da visualização passiva e somente leitura das tarefas associadas a cada projeto no Supabase.

## Objetivo
Permitir que os usuários visualizem de forma estruturada e ordenada a lista de tarefas associadas a cada projeto Supabase diretamente na Visão Operacional do Dashboard. O fluxo é puramente passivo e não altera dados locais de projetos/tarefas.

## Hook Isolado
Foi criado o hook [useSupabaseProjectTasks.ts](../../../src/hooks/useSupabaseProjectTasks.ts):
* **Parâmetro**: `projectId?: string`.
* **Comportamento**: Obtém o workspace ativo e consome o repositório `tasksRepository.listTasksByProject(workspaceId, projectId)`.
* **Retornos**:
  * `tasks` (array de tarefas).
  * `loading` (booleano).
  * `error` (string ou nulo).
  * `refresh` (função para recarregar manualmente).

## Repositório
* **Método**: `tasksRepository.listTasksByProject(workspaceId, projectId)`
* **Regras de Negócio**:
  * Filtra por `workspace_id`.
  * Filtra por `project_id`.
  * Ignora exclusões lógicas (`deleted_at IS NOT NULL`).
  * Ordenação rigorosa: `sort_order ASC` (respeitando a ordem do checklist base) e `created_at ASC`.

## Interface do Usuário (UI)
* **Local**: Na listagem de projetos remotos na *Visão Operacional Supabase* (`SupabaseOperationalDashboardCard.tsx`).
* **Ação**: Um botão **"Ver tarefas"** permite recolher/expandir o painel de checklist de cada projeto.
* **Badges Exibidos**:
  * Badge *"Supabase"* (indicando origem remota).
  * Badge *"Tarefa base"* se `source = 'project_template'`.
  * Badges de Prioridade (*"Alta"*, *"Média"*, *"Baixa"*).
  * Badges de Status (*"A Fazer"*, *"Em Andamento"*, *"Revisão"*, *"Concluído"*).

## Estados de UI Tratados
* **Carregando**: Exibe indicador de progresso (*"Carregando checklist..."*).
* **Erro**: Mensagem vermelha explicativa caso ocorra falha de rede.
* **Vazio**: *"Nenhuma tarefa vinculada a este projeto ainda."* acompanhada pelo botão ativo para gerar tarefas base.
* **Refresh**: Opção manual *"Atualizar"* para forçar nova consulta sobre a lista do projeto selecionado.

## Modo Somente Leitura e Ações Bloqueadas
* Não há botões para concluir tarefas ou mudar status nesta visualização.
* Edições de prazo, prioridade, título ou descrição estão bloqueadas.
* Nenhuma alteração nas tabelas locais do navegador (`orbyt.*`) ocorre.

## Próximos Passos
* Implementar a transição experimental de status de tarefas no Supabase a partir de um drawer de detalhes nas próximas rodadas.

## Relatório de QA
### Cenários Testados
1. **Repository (`tasksRepository.ts`)**:
   - Validado que `listTasksByProject` filtra corretamente por `workspace_id`, `project_id` e ignora registros que possuem `deleted_at` preenchido.
   - Verificada a ordenação dupla: `sort_order ASC` e secundária `created_at ASC`.
2. **Hook (`useSupabaseProjectTasks.ts`)**:
   - Carregamento de dados ocorre apenas quando `workspaceId` e `projectId` estão presentes.
   - Retorna as variáveis `tasks`, `loading`, `error` e `refresh` de forma limpa, sem usar tipagens `any`.
3. **UI & Localização**:
   - O botão "Ver tarefas" aparece para cada projeto.
   - O clique expande ou recolhe a seção contendo o checklist daquele projeto sem misturar dados ou recarregar desnecessariamente.
4. **Isolamento por Projeto**:
   - Validado cenário em que o Projeto A exibe apenas suas tarefas, o Projeto B exibe apenas suas tarefas, e o Projeto C (sem tarefas) renderiza corretamente o estado vazio: *"Nenhuma tarefa vinculada a este projeto ainda."*
5. **Dados Exibidos**:
   - Cada item da lista exibe com precisão: título, descrição (se houver), status, prioridade, prazo (se houver), badge *"Supabase"* e badge *"Tarefa base"*.
6. **Estados da UI**:
   - Os estados de **Carregando**, **Erro** (simulado via restrições do PostgREST), **Vazio** e **Lista carregada** funcionam e respondem sem travar.
7. **Modo Somente Leitura**:
   - Confirmado que não existe nenhuma interface para mutar status, prazos, prioridades ou descrições a partir do painel.
8. **Preservação de Dados Locais**:
   - Nenhuma leitura ou escrita atinge o `localStorage` do módulo de tarefas local (`orbyt.tasks.v1`).

### Bugs Encontrados e Corrigidos
* *Nenhum bug detectado*. A separação de estados entre os painéis recolhíveis funcionou na primeira rodada.

### Limitações
* Visualização estritamente passiva. Edição, deleção física e sincronização bidirecional continuam indisponíveis.

### Recomendação Final
A visualização passiva de tarefas por projeto e a transição experimental de status estão consolidadas e seguras para testes de usuários finais. Recomenda-se prosseguir com o desenvolvimento de conciliações avançadas ou aprimorar os logs para auditoria detalhada.

