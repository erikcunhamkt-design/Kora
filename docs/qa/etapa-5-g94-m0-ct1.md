# Etapa 5 · G94 — rodada M0 (G97) + CT1 (catálogo, fatia 1)

Branch `etapa-5-g94-m0-ct1`, a partir de `46d4b62`. **Sem UI nova, sem flip, sem DDL.** Plano: [`etapa-5-flip-catalogo-materiais-fase-a.md`](../architecture/etapa-5-flip-catalogo-materiais-fase-a.md) §6/§7/§9. Decisões Q1–Q10 adotadas conforme recomendação (revisor).

> **Congelamento de Fichas respeitado:** nenhum arquivo `ClientTechnicalSheet*`, `useSupabaseTechnicalSheet`, `useBifurcatedTechnicalSheet`, `resolveSheetClientId`, `accessesLocalStore` nem a aba "Ficha Técnica" do drawer foi tocado (o M0 **não** exigiu nenhum — `ClientProfileDrawer.tsx` ficou intacto). **Também não tocados:** `QuotesSection`/`quoteMapper` (lane B), WhatsApp*, Projetos, Tarefas.

## 1. M0 — G97: a Biblioteca do cliente em fonte nuvem persiste neste dispositivo

**Escolha:** a 1ª opção (persistir localmente por uuid) — sem impedimento. O aviso passa a descrever o comportamento real (G29).

| Peça | O que faz |
|---|---|
| `src/services/clients/clientLibraryLocalStore.ts` (novo) | store `kora.clientLibrary.local.v1` chaveado pelo **uuid do cliente** (padrão `accessesLocalStore`); `undefined` (nunca houve entrada) ≠ `[]` (usuário esvaziou); evento `kora:clientLibrary:changed` a cada escrita; `withLocalLibrary` compõe a Biblioteca de um cliente da nuvem: **store (uuid) → cópia local legada (mapa local→uuid) → nada** (referência intacta quando não há o que mesclar) |
| `Clientes.tsx` `updateClient` (ramo nuvem) | `data.assets` → `writeClientLibrary(uuid, assets)` + o **mesmo** `toast.warning("Material salvo só neste dispositivo…")` — agora **verdadeiro**; comentário do G75 atualizado |
| `useClientsDataSource.ts` | a lista de clientes da nuvem é composta com `withLocalLibrary` e **recompõe ao evento do store** — sem isso, fechar e reabrir o cliente na mesma sessão mostraria a Biblioteca vazia |

Causa raiz (G97): em fonte nuvem `updateClient` não chamava `localUpdate` — o item vivia só em `setSelectedClient`. **Limitações assumidas (interinas):** o item fica **só neste navegador** (não sincroniza entre dispositivos/membros — o aviso diz isso); a correção definitiva é a coluna `clients.library_assets` (M1–M3), e este store é a fonte do import (M3). A cópia legada (cliente local importado) só é lida, nunca apagada.

### Testes (uuid real; hook REAL — o `Clientes.test.tsx` do G75 mocka o hook e nunca provaria persistência)
- `clientLibraryLocalStore.test.ts` (9): `undefined` vs `[]`, por uuid, evento, JSON corrompido, composição (store > legado, `[]` não ressuscita o legado, legado só se o mapa aponta pra ESTE uuid, referência intacta).
- `Clientes.library-reload.test.tsx` (5): **adicionar → desmontar ("reload") → remontar: item presente**; grava por uuid e **não** chama o UPDATE vazio nem o `toast.success` falso; fechar e **reabrir** na mesma sessão; cliente legado com Biblioteca antiga; estado vazio de sempre.
- `Clientes.test.tsx` (G75, existente): continua verde sem alteração.

**Prova fail→fix→pass por patch (sem stash, G65):** com a fiação revertida (`Clientes.tsx` + `useClientsDataSource.ts`, store mantido), **4 dos 5 testes de reload falham** (item some) e o de regressão passa; com o patch, **5/5**. Revertendo também o store (módulo inexistente) os arquivos novos falham na importação.

## 2. CT1 — catálogo, fatia 1 (categorias + serviços): mapper, repositórios, hooks

**Nada consome ainda** (grep: só os próprios arquivos e testes; `quoteMapper.ts` cita `servicesRepository` apenas num comentário antigo). Telas intactas.

| Arquivo | Conteúdo |
|---|---|
| `src/services/catalog/catalogMapper.ts` | `resolveCatalogFk` (**G67**: uuid → passthrough, senão mapa, senão `null`, nunca id local cru); `mapLocalServiceToSupabase` (**G37**: payload completo — `category` legado, `tags`, `notes`, `available_in_quotes`, `show_in_public_catalog`, `delivery_days`…; `price` por `roundMoney`); `mapServicePatchToSupabase` (só os campos recebidos); `mapSupabaseServiceToLocal` (id = uuid string, rótulo = nome da categoria da nuvem ou `category` legado, leitura defensiva de NULLs); mappers de categoria. **G40/G49:** `billing_type` guarda o **literal local com acento** ("único"…), valor fora do vocabulário vira "único" (escrita e leitura) |
| `src/repositories/catalogRepositoryShared.ts` | client **sem tipagem de tabela** (as tabelas não estão em `types.ts`); `isMissingTableError` (42P01/PGRST205/mensagem) → `CatalogUnavailableError` (mensagem legível, `code: "catalog_unavailable"`); demais erros seguem `normalizeSupabaseError` |
| `serviceCategoriesRepository.ts`, `servicesRepository.ts` | `list*` (workspace, sem `deleted_at`, mais novos primeiro), `import*` (**G56**: upsert idempotente por `(workspace_id, source_local_id)`, recusa chave vazia), `update*` (filtra id **e** workspace), `softDelete*` (Q6) |
| `useSupabaseServiceCategories.ts`, `useSupabaseServices.ts` | leitura React Query (**G32**: `enabled: !!workspaceId`, nunca condicionado à fonte; `retry` desligado pra tabela ausente) + create/update/remove (+ `duplicateService`, `toggleActive` no de serviços) com **G30** (a resposta da própria escrita vai pro cache, sem refetch); criação e duplicação usam `buildNativeSourceLocalId()` (**G56**: linha nova, nunca upsert sobre a original) |

**Degradação (código defensivo):** tabela ausente ⇒ hooks devolvem **lista vazia** + `unavailable: true` + `error` legível ("O catálogo na nuvem ainda não está disponível neste workspace…"), **nunca lançam no render**, a query não repete em loop, e se só as categorias faltarem o serviço mantém o rótulo legado. Mutations lançam o erro legível (a lista não muda).

### Testes
- `catalogMapper.test.ts` (27): ida-e-volta **por campo** (todos os campos do payload; id volta uuid string); `it.each` dos 5 `billing_type` + "único" **com acento** (≠ "unico"); fora do vocabulário; passthrough/mapa/null (G67); rótulo de categoria; leitura com NULLs; patch parcial; categorias.
- `catalogRepositories.test.ts` (14): forma das queries (tabela, workspace, `deleted_at is null`, ordem), upsert com `onConflict`, chave vazia recusada, update filtra id+workspace, soft delete, **degradação** (PGRST205, 42P01, só pela mensagem) com mensagem legível sem vazar erro cru, outro erro (CHECK 23514) **não** vira "indisponível".
- `useSupabaseServices.test.ts` (11): leitura mapeada (nome da categoria da nuvem), **G32** (sem workspace, nenhuma query), **degradação** (serviços, categorias, categorias ausentes ⇒ rótulo legado, mutation com erro legível), **G30** (create/update/toggle/remove sem refetch), **G56** (duplicar = linha nova), categorias.

**Prova fail→fix→pass por patch:** com as fontes removidas, os 5 arquivos de teste novos falham na **importação** (módulos inexistentes); com o patch, **78/78** nos 7 arquivos (os 5 novos + `Clientes.test.tsx` + `useClientsDataSource.test.ts`, existentes). (Para o CT1 — código novo sem comportamento prévio — a prova é a ausência do módulo; a asserção de comportamento está nos testes acima.)

## 3. Pendências / fora do escopo

- CT2 em diante (tabelas aplicadas pelo operador — CT1 do Fase A §9.1 — antes de qualquer teste ao vivo), flag de fonte, consumidores, escrita na UI, import, planos, flip.
- M1–M4 (coluna `library_assets`, whitelist/mapper, import, homologação): o M0 é só a correção interina.
- Observação: o M0 deixa a Biblioteca **só neste navegador** — se o operador usar dois dispositivos, a Biblioteca de um não aparece no outro até o M2 (o aviso já diz isso).
