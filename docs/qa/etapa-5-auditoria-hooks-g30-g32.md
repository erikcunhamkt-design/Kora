# Auditoria de hooks `useSupabase*` — classes G30 e G32

> Inventário original 100% leitura (branch/hash abaixo). **Atualização
> 16/ago/2026 (rodada 1, G60)**: fix aplicado em `useSupabaseProjects.createMutation`
> e as 6 mutations de `useSupabaseQuotes`. **Atualização 16/ago/2026 (rodada 2, G60
> continuação)**: `useSupabaseClients` (4 mutations) + `useSupabaseClientContacts`
> (3 mutations) — devolvidos pra Lane D pelo revisor porque o pacote Clientes da
> Lane C é doc-only e não toca esses arquivos; a transferência registrada na rodada
> 1 (§1) não se concretizou. Tabelas abaixo atualizadas in-place; texto original
> preservado com nota de o que mudou, não apagado. Nenhum arquivo da Lane A
> (Financeiro) foi tocado em nenhuma das rodadas.

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
**Estado pós rodada 1 de G60 (16/ago): 15 violações / 12 conformes.** Corrigiu 7 mutations
(`useSupabaseProjects.createMutation` + as 6 de `useSupabaseQuotes`).
**Entre as rodadas — achado ao atualizar este doc, não uma correção desta lane**:
`useSupabaseOpportunities` (8 mutations) já tinha sido migrado pra `useMutation` + `setQueryData`
por outra rodada (comentário de topo do arquivo: "Etapa 5 · Preparação G30/G32, rodada 2,
useMutation"), mesclado em `main` e incorporado por rebase durante a rodada 1 de G60 — a nota
"pendente de rodada própria" que a rodada 1 registrou ficou desatualizada assim que esse merge
aconteceu, sem que esta auditoria tivesse sido revisitada até agora.
**Estado pós rodada 2 de G60 (16/ago): 0 violações / 27 conformes.** Rodada 2 corrigiu as 7
mutations de `useSupabaseClients`+`useSupabaseClientContacts`; somado à migração independente de
`useSupabaseOpportunities` (8) já mesclada — **todos os 27 hooks/mutations auditados estão
conformes**. Nenhuma violação de G30 remanescente nos 15 hooks `useSupabase*` do repo.

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
| `useSupabaseClients` | `addMutation` | ✅ conforme **(G60, rodada 2)** | `useSupabaseClients.ts` — `setQueryData` prefixando a linha criada, mesmo molde de `useSupabaseFinanceTransactions.createMutation` |
| `useSupabaseClients` | `updateMutation` | ✅ conforme **(G60, rodada 2)** | `useSupabaseClients.ts` — `setQueryData` map-replace por id |
| `useSupabaseClients` | `archiveMutation` | ✅ conforme **(G60, rodada 2)** | `useSupabaseClients.ts` — update-in-place (`listClients` não filtra `archived`, linha continua na lista) |
| `useSupabaseClients` | `deleteMutation` | ✅ conforme **(G60, rodada 2)** | `useSupabaseClients.ts` — `deleteClient` é hard delete, devolve só `true`; o id pra remover do cache vem da variável de entrada da mutation (`onSuccess(_success, clientId)`), não da resposta |
| `useSupabaseClientContacts` | `createMutation` | ✅ conforme **(G60, rodada 2)** | `useSupabaseClientContacts.ts` — mesmo molde, cache guarda a linha crua (`SupabaseContactRow`), mapeamento pra `ClientContact` só no `return` |
| `useSupabaseClientContacts` | `updateMutation` | ✅ conforme **(G60, rodada 2)** | `useSupabaseClientContacts.ts` — `setQueryData` map-replace por id |
| `useSupabaseClientContacts` | `deleteMutation` | ✅ conforme **(G60, rodada 2)** | `useSupabaseClientContacts.ts` — mesmo caso de `deleteClient`: hard delete devolve só `true`, id vem da variável de entrada |
| `useSupabaseOpportunities` | `createMutation` | ✅ conforme **(migrado em rodada própria, fora desta lane — ver nota)** | `useSupabaseOpportunities.ts` — migrado pra `useMutation`, `setQueryData` na própria queryKey (variante includeArchived/onlyDeleted atual) |
| `useSupabaseOpportunities` | `updateMutation` | ✅ conforme (idem) | idem |
| `useSupabaseOpportunities` | `moveStageMutation` | ✅ conforme (idem) | idem |
| `useSupabaseOpportunities` | `markWonMutation` | ✅ conforme (idem) | idem |
| `useSupabaseOpportunities` | `markLostMutation` | ✅ conforme (idem) | idem |
| `useSupabaseOpportunities` | `archiveMutation` | ✅ conforme (idem) | idem |
| `useSupabaseOpportunities` | `deleteMutation` | ✅ conforme (idem) | idem |
| `useSupabaseOpportunities` | `restoreMutation` | ✅ conforme (idem) | idem |

**Achado estrutural — RESOLVIDO, não por esta lane**: `useSupabaseOpportunities.ts` era o único hook do repo com mutations que nem usava `useMutation` do React Query (8 funções `async` simples, cada uma com try/catch + toast + `await invalidate()` manual). Migrado pra `useMutation` + `setQueryData` numa rodada própria (comentário de topo do arquivo: "Preparação G30/G32, rodada 2, useMutation"; characterization tests prévios, `useSupabaseOpportunities.test.ts`, R1) — mesclada em `main` e incorporada nesta auditoria só por rebase durante a rodada 1 de G60, não como trabalho desta lane. **Trade-off intencional documentado no próprio arquivo** (linhas 48-61): antes, `invalidate()` invalidava TODAS as variantes de `includeArchived`/`onlyDeleted` de uma vez — agora `setQueryData` só escreve a queryKey exata da instância atual; outras instâncias do hook (ex.: uma tela "ativas" + outra "arquivadas" montadas em paralelo) só refletem no próximo refetch delas, não imediatamente. Mesmo trade-off que Financeiro/Projetos já aceitaram.

**Achado de hook "parcialmente confiável" — RESOLVIDO nesta rodada**: `useSupabaseProjects.ts` era citado nesta própria auditoria (e no G53 da Lane D) como referência de G30, mas só `updateMutation` tinha sido corrigido (Fase D, Caso 2); `createMutation`, no mesmo arquivo, nunca recebeu o mesmo tratamento — catalogado como **G60** no plano mestre (classe: "fix de lição aplicado só à mutation citada no incidente, irmãs do mesmo arquivo ficam pra trás"). Ambas as mutations do arquivo agora são conformes.

**Clients/ClientContacts — RESOLVIDO na rodada 2, não ficou "transferido" de verdade**: a rodada 1 registrou as 7 violações como transferidas pro pacote Clientes da Lane C, por precaução de coordenação. Na prática o pacote dela seguiu **doc-only** (Fase A/investigações, sem tocar `useSupabaseClients.ts`/`useSupabaseClientContacts.ts`) — decisão do revisor: devolver o item pra Lane D, dona do padrão G30 nesta etapa, em vez de deixar a pendência esperando um ciclo de código que não ia tocar esses arquivos tão cedo. Fix aplicado: mesmo molde simples de `useSupabaseFinanceTransactions` (cache guarda a linha crua do repository, sem shape mapeado — nenhum dos dois hooks precisou do `mergeQuotePatch` que `useSupabaseQuotes` exigiu). Achado à parte: `deleteClient`/`deleteClientContact` (`clientsRepository.ts`) fazem **hard delete de verdade** e devolvem só `true`, não a linha apagada — diferente de todo delete já corrigido até aqui (`softDeleteReceivable`/`softDeleteQuote`, que devolvem a linha) — o id a remover do cache precisou vir da variável de ENTRADA da mutation (2º argumento do `onSuccess`), não da resposta.

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
| CRM/Oportunidades | `useSupabaseOpportunities`, `useSupabaseCrmWriteFlag` | Migrado por rodada própria (fora desta lane), mesclado antes da rodada 2 de G60. **Domínio 100% conforme G30/G32.** |
| Clientes | `useSupabaseClients`, `useSupabaseClientContacts`, `useSupabaseTechnicalSheet` | Lane D — G60 rodada 2 corrigiu `useSupabaseClients`+`useSupabaseClientContacts` (devolvido pelo revisor; pacote Clientes da Lane C segue doc-only, não tocou esses arquivos). **Domínio 100% conforme G30/G32.** |

**Nenhuma violação encontrada está em arquivo de Financeiro (Lane A). Nenhuma violação de G30 remanescente em nenhum domínio** — os 15 hooks `useSupabase*` do repo estão 100% conformes nos dois eixos (G30 e G32) a partir da rodada 2 de G60.

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
[Confirmação pós-rodada 1 de G60, 16/ago]
grep -l "setQueryData" src/hooks/*.ts     → 4 arquivos (ProjectTasks, FinanceTransactions, Projects,
                                             Quotes)
grep -l "invalidate" (padrão onSuccess)   → 3 arquivos useSupabase* (Clients, ClientContacts,
                                             Opportunities — os 3 que pareciam de fora do fix; a
                                             migração independente de Opportunities só apareceu
                                             nesta auditoria depois, ver §1)
```

```
[Confirmação final, pós rodada 2 de G60 + migração independente de Opportunities, 16/ago]
grep -c "setQueryData" src/hooks/*.ts     → 7 arquivos com pelo menos 1 ocorrência (ProjectTasks,
                                             FinanceTransactions, Projects, Quotes, Opportunities,
                                             Clients, ClientContacts)
grep -n "onSuccess: invalidate\b" src/hooks/*.ts → ZERO ocorrências em qualquer arquivo useSupabase*
```
Nenhum hook `useSupabase*` do repo ainda depende de `invalidateQueries()` sozinho pra refletir a
própria mutation — os 27 pontos de escrita auditados em §1 (18 `useMutation` originais + 8 de
Opportunities migradas + 1 `useCallback` de ProjectTasks) estão todos conformes.

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

**Rodada de fix G60, continuação (16/ago, branch `etapa-5-g30-fix-clients`)**: o revisor devolveu
`useSupabaseClients`+`useSupabaseClientContacts` pra Lane D — o pacote Clientes da Lane C seguiu
doc-only (Fase A e investigações, nunca tocou esses 2 arquivos), então a transferência registrada
na rodada 1 não ia se concretizar tão cedo. Fix aplicado no mesmo molde simples de
`useSupabaseFinanceTransactions` (cache guarda a linha crua, sem shape mapeado). Achado à parte,
não coberto pelos moldes anteriores: `deleteClient`/`deleteClientContact` fazem hard delete de
verdade e devolvem só `true` — o id a remover do cache veio da variável de ENTRADA da mutation,
não da resposta (nenhum delete corrigido até então precisou disso; os 2 deletes de Financeiro/
Quotes são soft-delete e devolvem a linha). Testes fail→fix→pass via `git stash` — 9 testes novos
falhando contra o código antigo, 11/11 verdes após restaurar (2 testes pré-existentes, casos 5/6
de erro isolado e coerção de tipo, intocados nos dois lados).

**Achado ao atualizar este doc, não desta lane**: `useSupabaseOpportunities` já tinha sido migrado
pra `useMutation`+`setQueryData` numa rodada independente, mesclada em `main` antes desta
atualização — a nota "pendente de rodada própria" da rodada 1 ficou desatualizada sem que ninguém
tivesse revisitado esta auditoria até agora. Corrigido aqui só como atualização de documentação
(nenhum código tocado nesse arquivo por esta lane).

**Estado final: 27/27 mutations conformes, 11/11 queries conformes — G30 e G32 fechados nos 15
hooks `useSupabase*` do repo.** Nenhum arquivo de Lane A (Financeiro) ou do ciclo de código da
Lane C (Clientes) foi tocado em nenhuma das rodadas.

## Referências

- `docs/architecture/kora-hub-auditoria-e-plano.md` — G30 (cache de mutação), G32 (fetch paralelo é design da casa)
- `src/hooks/useSupabaseProjects.ts:81-90`, `src/hooks/useSupabaseFinanceTransactions.ts:84-93`, `src/hooks/useSupabaseProjectTasks.ts:30-40` — moldes de G30 conforme, já em produção
