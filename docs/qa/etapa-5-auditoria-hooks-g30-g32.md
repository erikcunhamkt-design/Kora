# Auditoria de hooks `useSupabase*` — classes G30 e G32 — SOMENTE LEITURA

> Inventário puro. Nenhum código tocado, nenhum arquivo da Lane A (Financeiro)
> editado — só lido. Decisão sobre o que/quando corrigir fica para uma rodada
> própria, coordenada por domínio para não colidir com lanes em voo.

Branch: `etapa-5-auditoria-hooks-g30-g32`, a partir do tip real de `origin/main`
em `a7b110d` (`fix(vendas): G55 - gate fossil de blockWrite() bloqueava "Gerar
conta a receber" pos-cutover de Financeiro`).

## Método

`grep -r "export function useSupabase" src/` → **15 hooks**, todos em
`src/hooks/`. Cada um lido por inteiro. Cruzado com 3 greps de confirmação
(`useMutation(`, `setQueryData`, padrão `invalidate`) — números batem
exatamente com a leitura manual (§4).

Critério G30: uma mutation está **conforme** quando seu `onSuccess`/callback
grava a resposta da própria escrita direto no cache (`queryClient.setQueryData`),
nunca dependendo só de `invalidateQueries()` + refetch. **Violação** quando só
invalida.

Critério G32: uma query está **conforme** quando `enabled` depende só de
`!!workspaceId` (ou `!!workspaceId` + um parâmetro de escopo adicional
genuinamente obrigatório, ex. `projectId`/`clientId` — mesmo padrão que
`useSupabaseProjectTasks`/`useSupabaseClientContacts` já usavam antes desta
auditoria). **Desvio** seria gatear por `dataSource === "supabase"` ou
equivalente — nenhum caso encontrado (ver §2).

---

## 1. G30 — resultado por hook

**22 violações / 5 conformes, em 7 hooks com mutation (dos 15 totais).**

| Hook | Mutation | Status | Arquivo:linha |
|---|---|---|---|
| `useSupabaseProjectTasks` | `updateStatus` | ✅ conforme | `useSupabaseProjectTasks.ts:30-40` (`setQueryData`, G53) |
| `useSupabaseFinanceTransactions` | `createMutation` | ✅ conforme | `useSupabaseFinanceTransactions.ts:59-79` (`setQueryData`) |
| `useSupabaseFinanceTransactions` | `updateMutation` | ✅ conforme | `useSupabaseFinanceTransactions.ts:84-93` (`setQueryData`) |
| `useSupabaseFinanceTransactions` | `deleteMutation` | ✅ conforme | `useSupabaseFinanceTransactions.ts:99-107` (`setQueryData`) |
| `useSupabaseProjects` | `updateMutation` | ✅ conforme | `useSupabaseProjects.ts:81-90` (`setQueryData`, comentário cita G30 explicitamente) |
| `useSupabaseProjects` | `createMutation` | 🔴 violação | `useSupabaseProjects.ts:56-72` (`onSuccess: invalidate`) — **mesmo hook que corrigiu `update`, `create` ficou pra trás** |
| `useSupabaseClients` | `addMutation` | 🔴 violação | `useSupabaseClients.ts:31-37` |
| `useSupabaseClients` | `updateMutation` | 🔴 violação | `useSupabaseClients.ts:39-45` |
| `useSupabaseClients` | `archiveMutation` | 🔴 violação | `useSupabaseClients.ts:47-53` |
| `useSupabaseClients` | `deleteMutation` | 🔴 violação | `useSupabaseClients.ts:55-61` |
| `useSupabaseClientContacts` | `createMutation` | 🔴 violação | `useSupabaseClientContacts.ts:69-75` |
| `useSupabaseClientContacts` | `updateMutation` | 🔴 violação | `useSupabaseClientContacts.ts:77-83` |
| `useSupabaseClientContacts` | `deleteMutation` | 🔴 violação | `useSupabaseClientContacts.ts:85-91` |
| `useSupabaseQuotes` | `createMutation` | 🔴 violação | `useSupabaseQuotes.ts:84-99` |
| `useSupabaseQuotes` | `updateStatusMutation` | 🔴 violação | `useSupabaseQuotes.ts:104-108` |
| `useSupabaseQuotes` | `updateMutation` | 🔴 violação | `useSupabaseQuotes.ts:110-119` |
| `useSupabaseQuotes` | `archiveMutation` | 🔴 violação | `useSupabaseQuotes.ts:121-125` |
| `useSupabaseQuotes` | `softDeleteMutation` | 🔴 violação | `useSupabaseQuotes.ts:127-131` |
| `useSupabaseQuotes` | `replaceItemsMutation` | 🔴 violação | `useSupabaseQuotes.ts:133-137` |
| `useSupabaseOpportunities` | `createOpportunity` | 🔴 violação | `useSupabaseOpportunities.ts:44-59` (nem usa `useMutation` — função async simples + `await invalidate()`) |
| `useSupabaseOpportunities` | `updateOpportunity` | 🔴 violação | `useSupabaseOpportunities.ts:61-76` (idem) |
| `useSupabaseOpportunities` | `moveOpportunityStage` | 🔴 violação | `useSupabaseOpportunities.ts:78-93` (idem) |
| `useSupabaseOpportunities` | `markWon` | 🔴 violação | `useSupabaseOpportunities.ts:95-110` (idem) |
| `useSupabaseOpportunities` | `markLost` | 🔴 violação | `useSupabaseOpportunities.ts:112-127` (idem) |
| `useSupabaseOpportunities` | `archiveOpportunity` | 🔴 violação | `useSupabaseOpportunities.ts:129-144` (idem) |
| `useSupabaseOpportunities` | `deleteOpportunity` | 🔴 violação | `useSupabaseOpportunities.ts:146-160` (idem) |
| `useSupabaseOpportunities` | `restoreDeletedOpportunity` | 🔴 violação | `useSupabaseOpportunities.ts:162-183` (idem) |

**Achado estrutural, não só contagem**: `useSupabaseOpportunities.ts` é o único hook do repo com mutations que **nem usa `useMutation` do React Query** — são 8 funções `async` simples, cada uma com seu próprio try/catch + toast + `await invalidate()` manual. Corrigir G30 aqui não é só trocar `invalidate` por `setQueryData` (como nos outros 4 hooks violadores) — é também decidir se vale migrar pra `useMutation` primeiro (consistência com o resto da casa) ou aplicar o fix no molde atual (grava a resposta já retornada por cada função direto no cache via `queryClient.setQueryData`, sem precisar de `useMutation`). Decisão de escopo pra quando isso for corrigido, não resolvida aqui.

**Achado de hook "parcialmente confiável"**: `useSupabaseProjects.ts` é o molde citado nesta própria auditoria (e no G53 da Lane D) como referência de G30 — mas só `updateMutation` foi corrigido (Fase D, Caso 2); `createMutation`, no mesmo arquivo, nunca recebeu o mesmo tratamento. Quem usar este hook como "exemplo de hook 100% G30" sem checar os dois métodos separadamente herda esse gap sem perceber.

### 1.1 Hooks sem mutation (G30 não se aplica)

| Hook | Motivo |
|---|---|
| `useSupabaseFinancialSummary` | só leitura (`query` + `refresh`) |
| `useSupabaseOpportunityQuotes` | só leitura |
| `useSupabaseProjectsSummary` | só leitura |
| `useSupabaseTechnicalSheet` | só leitura |
| `useSupabaseFinanceWriteFlag` | flag localStorage, sem query/mutation React Query |
| `useSupabaseCrmWriteFlag` | idem |
| `useSupabaseQuotesWriteFlag` | idem |
| `useSupabaseProjectsWriteFlag` | idem |

---

## 2. G32 — resultado por hook

**11 de 11 hooks com `useQuery` estão conformes — zero desvios encontrados.**
Os outros 4 (flags) não têm `useQuery`, N/A.

| Hook | `enabled` | Status | Arquivo:linha |
|---|---|---|---|
| `useSupabaseProjectTasks` | `!!workspaceId && !!projectId` | ✅ conforme | `useSupabaseProjectTasks.ts:18` |
| `useSupabaseFinanceTransactions` | `!!workspaceId` | ✅ conforme | `useSupabaseFinanceTransactions.ts:55` (comentário de topo cita G32 explicitamente) |
| `useSupabaseClientContacts` | `!!workspaceId && !!clientId` | ✅ conforme | `useSupabaseClientContacts.ts:54,60` |
| `useSupabaseClients` | `!!workspace && !workspaceLoading` | ✅ conforme (idioma equivalente — ver nota) | `useSupabaseClients.ts:22` |
| `useSupabaseFinancialSummary` | `!!workspaceId` | ✅ conforme | `useSupabaseFinancialSummary.ts:14` |
| `useSupabaseOpportunities` | `!!workspaceId` | ✅ conforme | `useSupabaseOpportunities.ts:34` |
| `useSupabaseOpportunityQuotes` | `!!workspaceId && !!opportunityId` | ✅ conforme | `useSupabaseOpportunityQuotes.ts:23` |
| `useSupabaseProjectsSummary` | `!!workspaceId` | ✅ conforme | `useSupabaseProjectsSummary.ts:14` |
| `useSupabaseQuotes` | `!!workspaceId` | ✅ conforme | `useSupabaseQuotes.ts:71` |
| `useSupabaseTechnicalSheet` | `!!workspaceId && !!supabaseClientId` | ✅ conforme | `useSupabaseTechnicalSheet.ts:51` |
| `useSupabaseProjects` | `!!workspaceId` | ✅ conforme | `useSupabaseProjects.ts:42` |

**Nota sobre `useSupabaseClients`**: é o único que usa `!!workspace && !workspaceLoading` em vez do idioma literal `!!workspaceId`. Mesmo efeito prático (busca assim que o workspace resolve, nunca gateado por `dataSource`) — não é um desvio do espírito do G32, só uma variação de escrita que outro hook poderia copiar por engano achando que é o padrão. Registrado, não corrigido.

**Nenhum hook gateia por `dataSource`/seletor de fonte** — o padrão "busca sempre em paralelo, só a leitura decide o que exibir" (G32, confirmado design da casa em Projetos/Financeiro/Tarefas) está uniformemente respeitado nos 15 hooks. Este é o resultado mais limpo dos dois eixos desta auditoria.

---

## 3. Domínio × dono de cada hook (contexto de coordenação, não decisão de fix)

| Domínio | Hooks | Dono aparente (por commits recentes) |
|---|---|---|
| Financeiro | `useSupabaseFinanceTransactions`, `useSupabaseFinanceWriteFlag`, `useSupabaseFinancialSummary` | **Lane A** — não tocado nesta rodada nem nas correções futuras devem tocar sem coordenar; já 100% conforme G30/G32, sem pendência |
| Projetos/Tarefas | `useSupabaseProjects`, `useSupabaseProjectsSummary`, `useSupabaseProjectsWriteFlag`, `useSupabaseProjectTasks` | Lane D (G53) tocou só `useSupabaseProjectTasks`; `useSupabaseProjects.createMutation` é violação preexistente, não desta lane |
| Orçamentos (Quotes) | `useSupabaseQuotes`, `useSupabaseQuotesWriteFlag`, `useSupabaseOpportunityQuotes` | Sem lane ativa identificada nesta auditoria — maior concentração de violações (6) |
| CRM/Oportunidades | `useSupabaseOpportunities`, `useSupabaseCrmWriteFlag` | Sem lane ativa identificada — 2º maior concentração (8), único hook sem `useMutation` |
| Clientes | `useSupabaseClients`, `useSupabaseClientContacts`, `useSupabaseTechnicalSheet` | Sem lane ativa identificada — 7 violações somadas |

**Nenhuma violação encontrada está em arquivo de Financeiro (Lane A)** — qualquer rodada futura de correção pode avançar em Quotes/CRM/Clientes/Projects sem risco de colisão com o trabalho dela.

---

## 4. Confirmação cruzada (greps de validação, não achado novo)

```
grep -c "useMutation(" src/hooks/*.ts     → 18 ocorrências em 5 arquivos
  (Quotes:6, FinanceTransactions:3, Projects:2, Clients:4, ClientContacts:3)
grep -l "setQueryData" src/hooks/*.ts     → 3 arquivos (ProjectTasks, FinanceTransactions, Projects)
grep -l "invalidate" (padrão onSuccess)   → 5 arquivos useSupabase* (+ useSignupRequests.ts, fora
                                             do escopo "useSupabase*" desta auditoria, não contado)
```
18 `useMutation` + 8 funções async simples de `useSupabaseOpportunities` (que não usam `useMutation`)
+ 1 mutation via `useCallback` de `useSupabaseProjectTasks` (idem) = **27 operações de escrita
auditadas**, batendo com a contagem manual do §1 (22 violações + 5 conformes).

---

## Fechamento — não corrigido, só inventariado

Nenhuma linha de código foi alterada nesta rodada (protocolo do pedido). Ordem
de prioridade sugerida para uma futura rodada de correção — não decidida
aqui, só observada pela concentração de violações e pela ausência de
colisão com Lane A: **Quotes (6) → Opportunities (8, mais trabalho por não
usar `useMutation`) → Clients+ClientContacts (7) → `useSupabaseProjects.createMutation`
(1, mais barato — mesmo arquivo já tem o molde certo ao lado)**.

## Referências

- `docs/architecture/kora-hub-auditoria-e-plano.md` — G30 (cache de mutação), G32 (fetch paralelo é design da casa)
- `src/hooks/useSupabaseProjects.ts:81-90`, `src/hooks/useSupabaseFinanceTransactions.ts:84-93`, `src/hooks/useSupabaseProjectTasks.ts:30-40` — moldes de G30 conforme, já em produção
