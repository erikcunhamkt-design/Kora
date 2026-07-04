# Tarefas Supabase - Transição de Status Experimental

Este documento descreve a transição experimental de status de tarefas Supabase a partir do Dashboard Operacional.

## Objetivo
Permitir que usuários atualizem o status de tarefas persistidas no Supabase de forma controlada por feature flag, com confirmação visual para conclusão e auditoria por log local, mantendo os fluxos locais e o localStorage principal intocados.

## Feature Flag
* **Chave**: `kora.tasks.supabaseStatusTransition.enabled`
* **Padrão**: `false`
* **Ativação**: Pode ser ligada/desligada em *Configurações > Empresa/Supabase > Tarefas Supabase - Transição de Status Experimental*.

## Repositório
Foi implementada a função no repositório [tasksRepository.ts](file:///C:/Users/erikw/.gemini/antigravity/scratch/orbit-designer-hub/src/repositories/tasksRepository.ts):
* `updateTaskStatus(workspaceId: string, taskId: string, status: "todo" | "in_progress" | "done")`
  * Filtra por `workspace_id` e `id` da tarefa.
  * Ignora logicamente deletados (`deleted_at IS NOT NULL`).
  * Atualiza estritamente as colunas `status` e `updated_at`.

## Hook
* **Função**: `updateStatus(taskId, status)` exposta pelo hook [useSupabaseProjectTasks.ts](file:///C:/Users/erikw/.gemini/antigravity/scratch/orbit-designer-hub/src/hooks/useSupabaseProjectTasks.ts).
* **Fluxo**: Invoca a chamada ao repository, atualiza o checklist reativo chamando `refresh()` em caso de sucesso, e expõe mensagens de erro claras de forma isolada sem alterar `localStorage` diretamente no hook.

## Interface do Usuário (UI)
* **Com a flag OFF**:
  * O status da tarefa aparece como um Badge somente leitura.
  * Tentar clicar ou alterar o status exibe um toast informativo: *"Transição de tarefas Supabase entra nesta etapa experimental. Ative em Configurações."*
* **Com a flag ON**:
  * O Badge de status é substituído por um elemento HTML `<select>` contendo as opções **"A Fazer"** (todo), **"Em Andamento"** (in_progress) e **"Concluída"** (done).

## Confirmação
* **Decisão de Design**:
  * Para marcar uma tarefa como **Concluída (`done`)**, um modal `AlertDialog` é aberto exigindo confirmação explícita.
    * Título: *"Concluir tarefa?"*
    * Descrição: *"Esta ação marcará a tarefa como concluída no Supabase. Ela não criará automações, calendário ou notificações."*
  * Transições entre `todo` e `in_progress` ocorrem instantaneamente, emitindo um toast de sucesso e aplicando rollback visual instantâneo em caso de erro na requisição remota.

## Registro de Logs Locais
* **Chave**: `kora.tasks.supabaseStatusTransitions.v1`
* **Campos**: `taskId`, `projectId`, `fromStatus`, `toStatus` e `changedAt`.
* Gravado no `localStorage` do navegador apenas após sucesso real confirmado na atualização remota.

## Limitações e Ações Bloqueadas
* Mudar títulos, descrições, prioridades ou prazos da tarefa permanece bloqueado.
* Não há drag-and-drop.
* Não há sincronização automática com agendas externas ou disparo de e-mails/WhatsApp ao concluir a tarefa.
* A base local do módulo principal (`orbyt.tasks.v1`) não sofre qualquer alteração.
