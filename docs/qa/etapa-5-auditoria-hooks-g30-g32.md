# Auditoria de hooks `useSupabase*` — classes G30 e G32

> Inventário original 100% leitura (branch/hash abaixo). **Atualização
> 16/ago/2026**: rodada de fix aplicada (G60, branch
> `etapa-5-g30-fix-projects-quotes`) para 2 dos 5 hooks violadores —
> `useSupabaseProjects.createMutation` e as 6 mutations de
> `useSupabaseQuotes`. Tabelas abaixo atualizadas in-place; texto original
> preservado com nota de o que mudou, não apagado. Nenhum arquivo da Lane A
> (Financeiro) foi tocado em nenhuma das duas rodadas.

Branch original: `etapa-5-auditoria-hooks-g30-g32`, a partir do tip real de
`origin/main` em `a7b110d` (`fix(vendas): G55 - gate fossil de blockWrite()
bloqueava "Gerar conta a receber" pos-cutover de Financeiro`).

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

**Estado original (15/ago): 22 violações / 5 conformes, em 7 hooks com mutation (27 mutations auditadas no total, §4).**
**Estado atual (pós G60, 16/ago): 15 violações / 12 conformes.** G60 corrigiu 7 mutations
(`useSupabaseProjects.createMutation` + as 6 de `useSupabaseQuotes`) — 22 − 7 = 15 violações
remanescentes, todas em `useSupabaseOpportunities` (8) e `useSupabaseClients`/`useSupabaseClientContacts`
(4 + 3 = 7); 5 + 7 = 12 conformes. 12 + 15 = 27, bate com o total auditado.

| Hook | Mutation | Status | Arquivo:linha |
|---|---|---|---|
| `useSupabaseProjectTasks` | `updateStatus` | ✅ conforme | `useSupabaseProjectTasks.ts:30-40` (`setQueryData`, G53) |
| `useSupabaseFinanceTransactions` | `createMutation` | ✅ conforme | `useSupabaseFinanceTransactions.ts:59-79` (`setQueryData`) |
| `useSupabaseFinanceTransactions` | `updateMutation` | ✅ conforme | `useSupabaseFinanceTransactions.ts:84-93` (`setQueryData`) |
| `useSupabaseFinanceTransactions` | `deleteMutation` | ✅ conforme | `useSupabaseFinanceTransactions.ts:99-107` (`setQueryData`) |
| `useSupabaseProjects` | `updateMutation` | ✅ conforme | `useSupabaseProjects.ts:81-90` (`setQueryData`, comentário cita G30 explicitamente) |
| `useSupabaseProjects` | `createMutation` | ✅ conforme **(G60, corrigido 16/ago)** | `useSupabaseProjects.ts:56-80` — era `onSuccess: invalidate`; agora `setQueryData` prefixando a linha criada, mesmo molde de `useSupabaseFinanceTransactions.createMutation` |
| `useSupabaseQuotes` | `createMutation` | ✅ conforme **(G60)** | `useSupabaseQuotes.ts:99-124` — `onSuccess(created, variables)` mapeia + usa `variables.items` (RPC devolve só a linha-pai) |
| `useSupabaseQuotes` | `updateStatusMutation` | ✅ conforme **(G60)** | `useSupabaseQuotes.ts:129-133` — via `mergeQuotePatch` (helper novo) |
| `useSupabaseQuotes` | `updateMutation` | ✅ conforme **(G60)** | `useSupabaseQuotes.ts:135-144` — via `mergeQuotePatch` |
| `useSupabaseQuotes` | `archiveMutation` | ✅ conforme **(G60)** | `useSupabaseQuotes.ts:146-150` — via `mergeQuotePatch` |
| `useSupabaseQuotes` | `softDeleteMutation` | ✅ conforme **(G60)** | `useSupabaseQuotes.ts:156-165` — `setQueryData` com `.filter()` (remove da lista, não atualiza — `listQuotes` já exclui `deleted_at`) |
| `useSupabaseQuotes` | `replaceItemsMutation` | ✅ conforme **(G60)** | `useSupabaseQuotes.ts:170-180` — substitui só `.items` da quote correspondente, preserva os demais campos |
| `useSupabaseClients` | `addMutation` | 🔴 violação | `useSupabaseClients.ts:31-37` — **transferido pro pacote Clientes (Lane C), não corrigido aqui** |
| `useSupabaseClients` | `updateMutation` | 🔴 violação | `useSupabaseClients.ts:39-45` — idem |
| `useSupabaseClients` | `archiveMutation` | 🔴 violação | `useSupabaseClients.ts:47-53` — idem |
| `useSupabaseClients` | `deleteMutation` | 🔴 violação | `useSupabaseClients.ts:55-61` — idem |
| `useSupabaseClientContacts` | `createMutation` | 🔴 violação | `useSupabaseClientContacts.ts:69-75` — idem |
| `useSupabaseClientContacts` | `updateMutation` | 🔴 violação | `useSupabaseClientContacts.ts:77-83` — idem |
| `useSupabaseClientContacts` | `deleteMutation` | 🔴 violação | `useSupabaseClientContacts.ts:85-91` — idem |
| `useSupabaseOpportunities` | `createOpportunity` | 🔴 violação | `useSupabaseOpportunities.ts:44-59` (nem usa `useMutation` — função async simples + `await invalidate()`) — **pendente de rodada própria (decisão de migração, ver nota)** |
| `useSupabaseOpportunities` | `updateOpportunity` | 🔴 violação | `useSupabaseOpportunities.ts:61-76` (idem) |
| `useSupabaseOpportunities` | `moveOpportunityStage` | 🔴 violação | `useSupabaseOpportunities.ts:78-93` (idem) |
| `useSupabaseOpportunities` | `markWon` | 🔴 violação | `useSupabaseOpportunities.ts:95-110` (idem) |
| `useSupabaseOpportunities` | `markLost` | 🔴 violação | `useSupabaseOpportunities.ts:112-127` (idem) |
| `useSupabaseOpportunities` | `archiveOpportunity` | 🔴 violação | `useSupabaseOpportunities.ts:129-144` (idem) |
| `useSupabaseOpportunities` | `deleteOpportunity` | 🔴 violação | `useSupabaseOpportunities.ts:146-160` (idem) |
| `useSupabaseOpportunities` | `restoreDeletedOpportunity` | 🔴 violação | `useSupabaseOpportunities.ts:162-183` (idem) |

**Achado estrutural (ainda válido)**: `useSupabaseOpportunities.ts` continua sendo o único hook do repo com mutations que **nem usa `useMutation` do React Query** — são 8 funções `async` simples, cada uma com seu próprio try/catch + toast + `await invalidate()` manual. Corrigir G30 aqui não é só trocar `invalidate` por `setQueryData` (como nos hooks já corrigidos) — é também decidir se vale migrar pra `useMutation` primeiro (consistência com o resto da casa) ou aplicar o fix no molde atual. **Decisão de escopo explicitamente adiada** — não corrigido nesta rodada de G60 (item 4 do pedido que gerou esta atualização), fica pra rodada própria com essa decisão de migração resolvida antes de codar.

**Achado de hook "parcialmente confiável" — RESOLVIDO nesta rodada**: `useSupabaseProjects.ts` era citado nesta própria auditoria (e no G53 da Lane D) como referência de G30, mas só `updateMutation` tinha sido corrigido (Fase D, Caso 2); `createMutation`, no mesmo arquivo, nunca recebeu o mesmo tratamento — catalogado como **G60** no plano mestre (classe: "fix de lição aplicado só à mutation citada no incidente, irmãs do mesmo arquivo ficam pra trás"). Ambas as mutations do arquivo agora são conformes.

**Clients/ClientContacts — transferido, não esquecido**: as 7 violações de `useSupabaseClients.ts`/`useSupabaseClientContacts.ts` não entraram no escopo desta rodada de fix por decisão explícita de coordenação — a Lane C está em ciclo ativo no domínio Clientes (`docs/qa/etapa-5-flip-clientes-pacote.md`, Fase A já mesclada) e uma correção de G30 nesses 2 arquivos, feita fora desse ciclo, arriscaria colidir com o desenho de bifurcação que ela está construindo. Fica registrado como trabalho pendente a ser assumido dentro do pacote de Clientes dela, não uma rodada solta.

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
| Financeiro | `useSupabaseFinanceTransactions`, `useSupabaseFinanceWriteFlag`, `useSupabaseFinancialSummary` | **Lane A** — não tocado em nenhuma das 2 rodadas (auditoria nem fix); já 100% conforme G30/G32, sem pendência |
| Projetos/Tarefas | `useSupabaseProjects`, `useSupabaseProjectsSummary`, `useSupabaseProjectsWriteFlag`, `useSupabaseProjectTasks` | Lane D — G53 corrigiu `useSupabaseProjectTasks`; G60 corrigiu `useSupabaseProjects.createMutation`. **Domínio 100% conforme G30/G32 agora.** |
| Orçamentos (Quotes) | `useSupabaseQuotes`, `useSupabaseQuotesWriteFlag`, `useSupabaseOpportunityQuotes` | Lane D — G60 corrigiu as 6 mutations de `useSupabaseQuotes`. **Domínio 100% conforme G30/G32 agora.** |
| CRM/Oportunidades | `useSupabaseOpportunities`, `useSupabaseCrmWriteFlag` | Sem lane ativa identificada — 8 violações remanescentes, único hook sem `useMutation`, pendente de rodada própria (decisão de migração) |
| Clientes | `useSupabaseClients`, `useSupabaseClientContacts`, `useSupabaseTechnicalSheet` | **Lane C** (ciclo Clientes em andamento) — 7 violações remanescentes, transferidas pro pacote dela, não corrigidas por esta lane pra evitar colisão |

**Nenhuma violação encontrada está em arquivo de Financeiro (Lane A)**, e as duas maiores concentrações de violação (Quotes 6, Projects 1) já foram corrigidas (G60) sem tocar nenhum arquivo de Lane A ou Lane C. Restam só Opportunities (8, decisão de migração pendente) e Clients/ClientContacts (7, transferido pro pacote da Lane C).

---

## 4. Confirmação cruzada (greps de validação, não achado novo)

```
[Estado original, 15/ago]
grep -c "useMutation(" src/hooks/*.ts     → 18 ocorrências em 5 arquivos
  (Quotes:6, FinanceTransactions:3, Projects:2, Clients:4, ClientContacts:3)
grep -l "setQueryData" src/hooks/*.ts     → 3 arquivos (ProjectTasks, FinanceTransactions, Projects)
grep -l "invalidate" (padrão onSuccess)   → 5 arquivos useSupabase* (+ useSignupRequests.ts, fora
                                             do escopo "useSupabase*" desta auditoria, não contado)
```
18 `useMutation` + 8 funções async simples de `useSupabaseOpportunities` (que não usam `useMutation`)
+ 1 mutation via `useCallback` de `useSupabaseProjectTasks` (idem) = **27 operações de escrita
auditadas**, batendo com a contagem manual do §1 (22 violações + 5 conformes, estado original).

```
[Confirmação pós-G60, 16/ago]
grep -l "setQueryData" src/hooks/*.ts     → 4 arquivos (ProjectTasks, FinanceTransactions, Projects,
                                             Quotes)
grep -l "invalidate" (padrão onSuccess)   → 3 arquivos useSupabase* (Clients, ClientContacts,
                                             Opportunities — os 3 que ficaram de fora do fix)
```
`useSupabaseProjects.ts`/`useSupabaseQuotes.ts` saíram da lista de `invalidate` e entraram na de
`setQueryData` — confirma os 7 mutations corrigidas (§1) sem varredura manual adicional.

---

## Fechamento

**Rodada original (15/ago)**: nenhuma linha de código alterada, só inventário — ordem de
prioridade sugerida (não decidida): Quotes (6) → Opportunities (8) → Clients+ClientContacts (7) →
`useSupabaseProjects.createMutation` (1).

**Rodada de fix G60 (16/ago, branch `etapa-5-g30-fix-projects-quotes`)**: executou os 2 itens mais
baratos/sem risco de colisão da lista acima, em ordem invertida de custo (não de prioridade da
lista original) — `useSupabaseProjects.createMutation` (1 mutation, molde já existia ao lado) e
`useSupabaseQuotes` (6 mutations, hook mais concentrado, mas sem dependência de decisão de
arquitetura pendente). Testes fail→fix→pass via `git stash` das 2 implementações — 9 testes novos
falhando contra o código antigo, 11/11 verdes após restaurar (2 testes pré-existentes de
`updateProject`, intocados, continuaram passando nos dois lados). Catalogado como **G60** no plano
mestre — classe "fix de lição aplicado só à mutation citada no incidente, irmãs do mesmo arquivo
ficam pra trás".

**Pendente, não desta rodada**: `useSupabaseOpportunities` (8 violações — decisão de migração pra
`useMutation` antes de aplicar o fix, rodada própria) e `useSupabaseClients`/`useSupabaseClientContacts`
(7 violações — transferido pro pacote Clientes da Lane C, para não colidir com o ciclo dela em
andamento).

## Referências

- `docs/architecture/kora-hub-auditoria-e-plano.md` — G30 (cache de mutação), G32 (fetch paralelo é design da casa)
- `src/hooks/useSupabaseProjects.ts:81-90`, `src/hooks/useSupabaseFinanceTransactions.ts:84-93`, `src/hooks/useSupabaseProjectTasks.ts:30-40` — moldes de G30 conforme, já em produção
