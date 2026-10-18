# Etapa 5 · G94 — rodada CT2 + CT3 (produtos + planos comerciais + import assistido)

Branch `etapa-5-g94-ct2-ct3`, a partir de `c764a01`. **Sem flip, sem DDL.** A única UI nova é o card do importador em Configurações → Dados. Plano: [`etapa-5-flip-catalogo-materiais-fase-a.md`](../architecture/etapa-5-flip-catalogo-materiais-fase-a.md) §6/§7/§9. Rodada anterior: [`etapa-5-g94-m0-ct1.md`](etapa-5-g94-m0-ct1.md).

> **Congelamento de Fichas respeitado:** nenhum `ClientTechnicalSheet*`, `useSupabaseTechnicalSheet`, `useBifurcatedTechnicalSheet`, `resolveSheetClientId`, `accessesLocalStore` nem a aba "Ficha Técnica" foi tocado. **Também não tocados:** `QuotesSection`/`quoteMapper`, WhatsApp*, Projetos, Tarefas, `CRM.tsx`. Único arquivo existente editado: `Configuracoes.tsx` (+2 linhas: import e montagem do card).

## 1. CT2 — produtos e planos comerciais: mapper, repositórios, hooks

**Nada consome ainda**, exceto o importador do CT3.

| Arquivo | Conteúdo |
|---|---|
| `src/services/catalog/catalogProductPlanMapper.ts` | **Vocabulário literal (G40/G49):** `type` (`PRODUCT_TYPES`), `status`, `billing_cycle`, status do plano; valor fora do vocabulário cai no default (`digital`/`active`/`monthly`/`active`) na escrita e na leitura. **G37 (payload completo):** todos os campos de cada tipo; `cost`/`stock` ausentes → `NULL`; `price` por `roundMoney`. **G67:** `category_id` por `resolveCatalogFk` (uuid → passthrough; senão mapa; senão `null`). Plano: `mapLocalPlanToSupabase(plan, {services, products})` devolve `{ input, discarded }` |
| `productsRepository.ts`, `commercialPlansRepository.ts` | `list*` (workspace, `deleted_at is null`, mais novos primeiro), `import*` (**G56:** upsert por `(workspace_id, source_local_id)`; chave vazia recusada), `update*` (filtra id **e** workspace), `softDelete*`; tabela ausente → `CatalogUnavailableError` |
| `useSupabaseProducts.ts`, `useSupabaseCommercialPlans.ts` | leitura React Query com **G32** (`enabled: !!workspaceId`) e **G30** (a resposta da escrita vai pro cache, sem refetch); criação usa `buildNativeSourceLocalId()`; degradação = lista vazia + `unavailable` + erro legível, sem retry em loop. Mutations de plano devolvem `{ plan, discarded }` |

### Regra dos itens de plano (decisão da Fase A, adendo 5)
Um item referencia serviço/produto por **uuid da nuvem**. O mapper só faz *passthrough + mapa* (o mapa certo pelo `kind`: id de serviço **não** resolve no mapa de produtos). Item **sem tradução é DESCARTADO**, devolvido em `discarded` (contagem) e **nunca gravado com id local cru**. A tradução local→uuid é do import (CT3).

## 2. CT3 — import assistido local → nuvem

**Decisão: UM card com 4 etapas ordenadas, não 4 cards encadeados.**
1. O catálogo é **um domínio só** com referências cruzadas por id (serviço→categoria, produto→categoria, plano→serviço/produto).
2. Num único diálogo a **ordem é garantida por construção**: cada etapa usa os mapas que a anterior acabou de gravar *na mesma corrida*, e a dependência é visível ("depende de N item(ns) ainda não importado(s)").
3. Com 4 cards o operador teria de coordenar a ordem sozinho — e **um plano importado antes dos serviços perderia os itens para sempre** (a 2ª rodada não reimporta o que já está marcado como importado).

| Peça | O que faz |
|---|---|
| `src/services/catalog/catalogImport.ts` (núcleo puro) | `buildCatalogCandidates` (demo excluído; `status` new/imported; `needs` = dependências locais não-demo ainda não importadas; `warning`/`willDiscard`); `isSelectable`/`selectAllPending`; `executeCatalogImport` em ordem `category → service → product → plan`, com **re-checagem de dependência em runtime** (categoria que falhou ⇒ o serviço **não é gravado**, vai pra `skippedDependency`); `onMapped` só dispara **após** sucesso (a meta nunca avança sobre falha) |
| `src/hooks/useLocalCatalogImport.ts` | `analyze()` sonda as 4 tabelas (`Promise.allSettled`); **só** `CatalogUnavailableError` gera `schemaPending {tables}` (outro erro vira mensagem de erro); `importSelected` **recusa** com `schemaPending` (G29); candidatos locais se atualizam sem rede; meta em `kora.catalog.supabaseImport.v1` |
| `src/components/settings/LocalCatalogImportCard.tsx` | molde `LocalTasksImportCard`: abre o diálogo → analisa; seções "Etapa N · …"; checkbox só habilita com a dependência marcada (desmarcar a dependência desmarca o dependente); "Selecionar todas as novas" / "Limpar seleção" / "Importar selecionados"; **alerta âmbar "Schema pendente (pacote §8-b) — importação desabilitada"** com as tabelas ausentes (checkboxes e botões desabilitados); relatório `role="status"` com contagens por etapa e **itens de plano descartados, por plano** |

Regras que o import garante: **demo nunca importa** (nem se vier na seleção); **idempotente** por `source_local_id = installId:localId` (mapa perdido ⇒ o upsert reencontra as mesmas linhas); categoria demo/inexistente **não bloqueia** — serviço/produto sobe com `category_id = null` e o rótulo legado preservado (aviso na linha); falha de um item não derruba os outros.

## 3. Testes (uuid real; 72 novos em 6 arquivos)

| Arquivo | # | Cobre |
|---|---|---|
| `catalogProductPlanMapper.test.ts` | 29 | payload completo por campo, `it.each` do vocabulário, ida-e-volta, leitura defensiva, patch, itens traduzidos/descartados, mapa por `kind` |
| `catalogProductPlanRepositories.test.ts` | 11 | forma das queries, upsert `onConflict`, chave vazia, update id+workspace, degradação (PGRST205 / 42P01) sem vazar erro cru, CHECK 23514 **não** vira "indisponível" |
| `useSupabaseProductsPlans.test.ts` | 8 | leitura mapeada, **G32**, degradação, **G30**, `source_local_id` nativo, plano com id local → descartado + contagem |
| `catalogImport.test.ts` | 12 | demo fora, `needs`/selecionável, avisos, **ordem**, FKs traduzidas (nenhum id local no payload), `source_local_id`, **idempotência (2ª rodada = 0 chamadas)**, mapa perdido, **descarte contado**, falha de dependência não grava, `onMapped` só após sucesso, mapa não mutado |
| `useLocalCatalogImport.test.ts` | 4 | candidatos sem rede, **schema pendente recusa importar** (nada gravado, meta intacta), erro ≠ tabela ausente, import em ordem + meta persistida + **2ª rodada = 0 novos** |
| `LocalCatalogImportCard.test.tsx` | 8 | 4 etapas em ordem, dependência travada/destravada, aviso de descarte, seleção → import, relatório honesto, **schema pendente** (alerta + tudo desabilitado + import não chamado) |

### Prova fail→fix→pass por patch (sem stash, G65)
- Patch dos 9 fontes (8 novos via `git add -N` + `Configuracoes.tsx`), `git apply -R` ⇒ os **6 arquivos de teste falham na importação** (módulos inexistentes; "Tests: no tests"); `git apply` ⇒ **72/72**.
- **Mutação de comportamento** (gravar o `refId` local cru quando não há tradução, em vez de descartar): **7 testes falham** (mapper ×3, import ×2, hook de planos ×1, hook do import ×1); restaurado ⇒ 80/80 nos 5 arquivos de catálogo/hook.

## 4. Limitações e observações

- **O import perde `createdAt`/`updatedAt` originais** de produtos e planos: a nuvem grava os timestamps do servidor (o upsert não os envia). Serviços/categorias locais não os têm. Documentado; corrigir só se o operador pedir (exigiria colunas graváveis ou um campo `imported_*`).
- **Schema ainda não aplicado:** com as tabelas ausentes o card só mostra o alerta e bloqueia — o fluxo feliz só roda ao vivo depois do DDL (pacote §8-b, do operador). Os testes cobrem o fluxo feliz com repositórios falsos.
- Seleção em dois passos (um plano que depende de um serviço ainda não importado só habilita junto dele) — comportamento intencional, não bug.

## 5. Pendências / fora do escopo
CT4 (escrita nativa na UI), CT5 (`quote_items.service_id` — lane de Orçamentos), CT6 (planos/aba), CT7 (flip + Fase D), M1–M4 (Biblioteca). DDL aplicado pelo operador antes de qualquer teste ao vivo.
