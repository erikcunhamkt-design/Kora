
# CRM Supabase Operacional V1 — Plano

Escopo grande (CRM.tsx tem ~2.2k linhas, repository e hook precisam expandir, novo card de settings, novo modal). Vou implementar em camadas, sem tocar em WhatsApp/Campanhas/Financeiro e mantendo o modo local intacto.

## 1. Feature flag
- Nova flag local: `kora.crm.supabaseWrite.enabled` (default `false`).
- Hook utilitário `useSupabaseCrmWriteFlag()` (get/set + sync entre abas via `storage` event).
- Controle visual em **Configurações → Empresa/Supabase**, dentro do `SupabaseOperationalDashboardCard` (ou card próprio "CRM Supabase Operacional" logo abaixo), com switch, título e descrição conforme spec.

## 2. Repository (`crmOpportunitiesRepository.ts`)
Auditar e completar:
- `listOpportunities(workspaceId)` — `deleted_at IS NULL`, `archived = false`.
- `listArchivedOpportunities(workspaceId)` — arquivadas ou soft-deleted.
- `createOpportunity(workspaceId, input)`.
- `updateOpportunity(workspaceId, id, patch)`.
- `moveOpportunityStage(workspaceId, id, stage)` — atualiza `stage`/`status` + `stage_changed_at`.
- `markOpportunityWon(workspaceId, id)` — seta `stage='ganho'`, `won_at=now()`, limpa `lost_reason`.
- `markOpportunityLost(workspaceId, id, reason?)` — seta `stage='perdido'`, `lost_reason`, limpa `won_at`.
- `archiveOpportunity` / `restoreOpportunity` — soft delete via `archived`/`deleted_at` (conforme colunas reais).
- Todas filtram por `workspace_id`. Sem hard delete. Sem service role.

Antes de escrever vou inspecionar as colunas reais de `crm_opportunities` com `supabase--read_query` para alinhar payload.

## 3. Hook (`useSupabaseOpportunities`)
Expor: `opportunities, archived, loading, error, refresh, createOpportunity, updateOpportunity, moveOpportunity, markWon, markLost, archive, restore`. Refresh após cada mutation. Toasts de sucesso/erro fora do hook (na UI).

## 4. UI — `CRM.tsx`
Quando `mode === 'supabase'` **e** flag ativa:
- Badge muda para "Operacional" (verde), microcopy "CRM Supabase operacional".
- Botão "Nova oportunidade" abre `SupabaseOpportunityFormModal` (novo componente) com os campos da spec; salva via `createOpportunity`.
- Drawer existente ganha modo de edição Supabase: campos principais editáveis + botões "Marcar como ganha", "Marcar como perdida" (com modal de motivo), "Arquivar", e seletor "Mover para etapa".
- Kanban: habilitar drag-and-drop chamando `moveOpportunity` com atualização otimista e rollback em erro. Se DnD já existe no modo local, reusar; senão começar pelos botões de "Mover para…" no drawer.
- KPIs no topo recalculados a partir das oportunidades Supabase quando modo Supabase ativo (abertas, valor no funil, follow-ups pendentes, conversão, ganhas no mês).
- Empty state novo conforme spec, com botões "Criar oportunidade" / "Importar oportunidades locais" (e "Ativar CRM Supabase Operacional" quando flag off).
- Aba/área "Arquivados" lista `listArchivedOpportunities` com ação restaurar.

Quando flag off: tudo permanece somente leitura como hoje (badge "Supabase em modo leitura"), sem alertas vermelhos.

## 5. Modo local
- Nenhum caminho Supabase escreve em localStorage de leads.
- Nenhum caminho local escreve no Supabase.
- Importador continua manual/assistido.

## 6. Log local de auditoria
- Chave `kora.crm.supabaseActions.v1` (array bounded a ~200 entradas).
- Eventos `create | update | move | won | lost | archive | restore` registrados só após sucesso.

## 7. Documentação
- Criar `SUPABASE-CRM-OPERATIONAL-V1.md` com objetivo, flag, repository, hook, fluxos, separação local vs Supabase, KPIs, limitações, próximos passos.
- Atualizar `SUPABASE-CRM-STATUS.md` se existir.

## 8. Validação
- `tsc --noEmit` e lint apenas no escopo CRM/Supabase, sem `any` novo.

## Detalhes técnicos
- Sem migration de schema nesta etapa — uso as colunas já existentes em `crm_opportunities` (vou validá-las com `read_query` antes de codar).
- Sem alteração de RLS. Todas as queries usam o cliente autenticado (`supabase` do frontend) com filtro explícito por `workspace_id` (defesa em profundidade além do RLS existente).
- Drag-and-drop: se o Kanban atual usa `@dnd-kit` no modo local, reaproveito a mesma estrutura; se não, entrego primeiro os botões "Mover para…" no drawer e abro follow-up para DnD pleno.
- Atualizações otimistas com rollback (`setOpportunities(prev) → on error revert`) para mover/ganhar/perder.

## Arquivos previstos
- Editar: `src/repositories/crmOpportunitiesRepository.ts`, `src/hooks/useSupabaseOpportunities.ts`, `src/pages/CRM.tsx`, `src/components/settings/SupabaseOperationalDashboardCard.tsx`.
- Criar: `src/hooks/useSupabaseCrmWriteFlag.ts`, `src/components/crm/SupabaseOpportunityFormModal.tsx`, `src/components/crm/SupabaseOpportunityLostReasonDialog.tsx`, `src/services/crm/supabaseCrmAuditLog.ts`, `SUPABASE-CRM-OPERATIONAL-V1.md`.

## Fora do escopo
- WhatsApp, Campanhas, Financeiro, automações.
- Hard delete, alteração de RLS, mudanças de schema.
- Criação automática de cliente/orçamento (continua exigindo confirmação).
