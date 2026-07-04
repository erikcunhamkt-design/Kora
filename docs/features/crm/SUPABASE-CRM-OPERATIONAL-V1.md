# SUPABASE CRM OPERACIONAL — V1

## Objetivo
Transformar o CRM Supabase de "somente leitura" para um modo operacional, com
criação, edição, movimentação de etapa, ganhar/perder, arquivar/restaurar e
KPIs reais, **sem quebrar o modo local** e **sem alterar RLS**.

## Feature flag
- Chave localStorage: `kora.crm.supabaseWrite.enabled`
- Default: `false`
- Leitura/escrita centralizada em `src/hooks/useSupabaseCrmWriteFlag.ts`
  (`useSupabaseCrmWriteFlag()` + `isSupabaseCrmWriteEnabled()`).
- Sincroniza entre abas via `storage` event e entre componentes via evento
  custom `kora:crm-supabase-write-flag`.

## Onde controlar
**Configurações → Sincronização Cloud & CRM (Supabase) → "CRM Supabase Operacional"**
(`src/components/settings/CrmSupabaseOperationalToggleCard.tsx`). É a primeira
toggle da seção. Microcopy:
- Título: "CRM Supabase Operacional"
- Descrição: "Permite criar, editar e mover oportunidades diretamente no Supabase. O modo local permanece intacto."
- Badge: **Operacional** (verde) quando ativo, **Modo leitura** (cinza) quando off.

As toggles granulares legadas (`CrmSupabaseExperimentalToggleCard`,
`CrmSupabaseStageMoveToggleCard`, …) continuam visíveis para compatibilidade,
mas o **CRM lê apenas a flag master** desta etapa.

## Repository — `src/repositories/crmOpportunitiesRepository.ts`
Todas as queries filtram por `workspace_id` e `deleted_at IS NULL` quando
listando ativas. Nenhum hard delete em uso pelo CRM operacional.

| Função | O que faz |
| --- | --- |
| `listOpportunities(workspaceId, { includeArchived, onlyDeleted })` | Lista ativas; arquivadas e soft-deleted via opções. |
| `getOpportunity(workspaceId, id)` | Lê uma oportunidade. |
| `createOpportunity(workspaceId, input)` | Insere com `workspace_id`. |
| `updateOpportunity(workspaceId, id, patch)` | Patch básico. |
| `moveOpportunityStage(workspaceId, id, stage)` | Atualiza `stage`/`status` e limpa `won_at`/`lost_at` quando aplicável. |
| `markOpportunityWon(workspaceId, id)` | `stage=fechado`, `status=won`, `won_at=now()`, limpa `lost_reason`. |
| `markOpportunityLost(workspaceId, id, reason?)` | `stage=perdido`, `status=lost`, `lost_at=now()`, `lost_reason`. |
| `archiveOpportunity(workspaceId, id, archived?)` | Soft archive via coluna `archived`. |
| `softDeleteOpportunity(workspaceId, id, reason?)` | Soft delete via `deleted_at`/`deleted_reason`. |
| `restoreSoftDeletedOpportunity(workspaceId, id)` | Limpa `deleted_at` e `archived`. |
| `deleteOpportunity(workspaceId, id)` | Hard delete (reservado para fluxo administrativo, não usado no CRM operacional). |

## Hook — `src/hooks/useSupabaseOpportunities.ts`
Expõe `opportunities`, `loading`, `error`, `refresh`, `createOpportunity`,
`updateOpportunity`, `moveOpportunityStage`, **`markWon`**, **`markLost`**,
`archiveOpportunity`, `deleteOpportunity`, `restoreDeletedOpportunity`.
Cada mutation chama `refresh` ao final para evitar inconsistência.

## Ações liberadas quando flag = ON
- **Criar** oportunidade (`isCreateOpportunityEnabled`).
- **Editar** campos principais (`isBasicEditEnabled`).
- **Mover etapa** via Kanban DnD ou drawer (`isStageMoveEnabled`).
- **Marcar ganha / perdida** (via `moveOpportunityStage` + ações `markWon`/`markLost` no hook).
- **Arquivar / restaurar** (`isArchiveEnabled` / `isRestoreArchiveEnabled`).
- **Soft delete / restaurar deletada** (`isSoftDeleteEnabled`).

Quando flag = OFF, todas as ações acima caem para o estado original
(somente leitura) — `blockWriteAction()` continua bloqueando.

## Separação local vs Supabase
- Modo local segue 100% via `localStorage` (`useLeads` etc.).
- Modo Supabase grava só no Supabase via repository.
- Nenhuma ação Supabase escreve em `localStorage` de leads.
- Nenhuma ação local escreve no Supabase.
- O importador (`useLocalOpportunitiesImport`) continua manual/assistido.

## KPIs
Já calculados a partir de `pipelineLeads`, que vem de
`supabaseOpportunities.map(mapSupabaseOpportunityToLocalLead)` quando o
data source é Supabase. Métricas: oportunidades abertas, valor no funil,
follow-ups pendentes, conversão, ganhas no período.

## Empty state
O empty state existente do CRM continua reaproveitado. Quando flag = OFF e
não há oportunidades no Supabase, o usuário é orientado a ativar o modo
operacional em Configurações antes de tentar criar.

## Auditoria local
Helper `src/services/crm/supabaseCrmAuditLog.ts`:
- Chave: `kora.crm.supabaseActions.v1`
- Eventos: `create | update | move | won | lost | archive | restore`
- Bounded a 200 entradas. Só registra após sucesso real.

Logs históricos separados (`kora.crm.supabaseStageMoves.v1`,
`kora.crm.supabaseCreates.v1`, etc.) continuam sendo escritos pelo
CRM atual e não foram removidos para preservar histórico.

## Banner e badges no CRM
- Flag ON: badge **Operacional** (verde), banner verde "CRM Supabase operacional".
- Flag OFF: badge **Modo leitura**, banner azul "Supabase em modo leitura".
- Nada de alerta vermelho quando não há erro.

## Limitações / não cobertos nesta etapa
- Modal dedicado de "Nova oportunidade" Supabase: o CRM reutiliza o modal local
  existente; a separação visual e campos específicos do Supabase entram em V2.
- Aba dedicada "Arquivados Supabase" — atualmente o filtro `showArchived` é
  compartilhado com o modo local; lista filtra por `archived = true`.
- Não há alteração de schema nesta V1. Nenhuma migration foi gerada.
- RLS inalterada. Cliente frontend nunca usa `service_role`.

## Próximos passos
1. Modal "Nova oportunidade" 100% Supabase com seleção de pipeline/stage do banco.
2. Edição inline avançada (probabilidade, expected_close_date, etc.).
3. Aba "Arquivados Supabase" dedicada com restore inline.
4. UI para inspecionar `kora.crm.supabaseActions.v1` (auditoria).
5. Realtime via `supabase.channel` para refletir mudanças entre membros do workspace.
