# Etapa 5 · G94 — rodada CT7-prep + G95 no catálogo (+ "mais usado" pendente da lane B)

> **[Status 2026-10-18 — varredura G29 do mapa do estado real]** A seção (c) "PENDENTE da lane B (G98)" está **feita**: `22f3400` (mapper de `service_id`) + `cdd8de7` (CT5 e "Mais usado" por `serviceId`); "CT5/CT6/CT7 e M1–M4 em aberto" → resta só o **CT7** (flip) e a homologação da Biblioteca; M1–M3 estão em `939afa3`.

Branch `etapa-5-g94-ct7prep-g95-maisusado`, a partir de `21349fe` (pacote §8-b + CT4 em `main`). **Sem DDL, sem flip.**

> **Congelamento de Fichas respeitado.** **Não tocados:** `QuotesSection`/`quoteMapper`, Clientes/Biblioteca (lane E em M1–M3), WhatsApp*. Arquivos existentes editados: só do domínio do catálogo (hooks nativos e bifurcados, import, card do import, `catalogRepositoryShared`) + docs.

## (a) Runbook do catálogo — [`etapa-5-flip-catalogo-materiais-runbook.md`](etapa-5-flip-catalogo-materiais-runbook.md)

Reescrito de rascunho para **executável até onde o código existe** (Casos 0–15), com os **caminhos reais** do CT3/CT4 lidos no código desta rodada: rotas `/vendas` e `/configuracoes` → seção **"Dados"**; card **"Importar catálogo comercial"** → **"Abrir importador"** (etapas 1–4, selos "nova/já importada", botões, relatório, alerta **"Schema pendente (pacote §8-b) — importação desabilitada."**); cards **"Catálogo comercial · fonte de dados"** (**"Usar Supabase"/"Voltar para Local"**) e **"Catálogo comercial · escrita na nuvem"** (**"Ativar"/"Desativar"**); banners de modo; toast de bloqueio; toast de erro **"Erro ao <ação> no catálogo (Supabase): <causa>"**.

- **Pré-voo (Caso 0):** hash mínimo (build contém o CT4 `5fdda90` e o commit desta rodada — conferido por `git merge-base --is-ancestor`), **pacote §8-b aplicado como pré-condição** (resumo em uma consulta: 4 tabelas, 16 policies, 4 índices válidos e não-parciais, CHECK com o acento de "único"; prova completa = pacote §3), export manual, estado das flags, contagens 0/0/0/0. **Parar se vermelho.**
- **SELECT depois de cada ação:** contagens por tabela, `source_local_id` (formato `<installId>:<id>` no import, `native:` na escrita nativa) **único**, `category_id` uuid, **`refId` de plano nunca local** (regex de uuid + existência em `services`/`products`), `deleted_at` dos soft deletes.
- **Limpeza** `HOMOLOG-CAT-%`/`HOMOLOG-MAT-%` com `count = 0` (query final única) + lista de chaves de `localStorage` (inclui as 3 chaves do catálogo).
- **O que só se prova depois do DDL × antes:** tabela no topo do doc. **Só antes do DDL:** o Caso 1 (schema pendente) — depois de aplicado não dá mais para ver. **Só depois:** import, escrita, CHECK/UNIQUE/RLS, round-trip. **Parcial:** erro real do G95 com 42P10 (só se o índice do §2.3 ainda faltar).
- **Fora do alcance de hoje (explícito, sem implementar):** ponte com orçamentos/`service_id` (CT5/G98), "Mais usado", seletor do wizard e toggle "Disponível em orçamentos" (Q10/G96), Checkout (CT6), robô (lane D), flip do default (CT7), Biblioteca M1–M4 (lane E).

## (b) G95 no domínio do catálogo — mensagens reais, não genéricas

**Varredura da classe** (`getFriendlyMessage`/`catch {}`/`toast` genérico) em: `ServicesSection`, `useBifurcatedCatalog`, os 4 hooks `useSupabase*`, `useLocalCatalogImport`, `LocalCatalogImportCard`, `catalogImport`, `catalogRepositoryShared`, cards de toggle, `CatalogDataProvider`. Achados e correções:

| Onde | Antes | Agora |
|---|---|---|
| `useBifurcatedCatalog.cloudWrite` (toda escrita da tela: 15 operações) | `toast.error(getFriendlyMessage(e))` — genérico | **"Erro ao <ação> no catálogo (Supabase): <causa real>"** (padrão G91/G95) |
| `error` de leitura dos 4 hooks nativos (vira o banner "Não foi possível carregar o catálogo da nuvem: …") | `getFriendlyMessage` | `catalogErrorMessage` |
| `useLocalCatalogImport` — erro da sonda | `getFriendlyMessage` puro | **"Erro ao consultar o catálogo na nuvem: <causa>"** |
| `executeCatalogImport` — falha de item | `catch {}` **engolia a causa**; o card dizia só "N falharam" | `report.failures[]` com **tipo, nome do item e causa**; o card lista cada falha e o toast leva o primeiro erro |
| `ServicesSection` | só validações de formulário (texto próprio) — sem catch genérico | nada a trocar (os handlers agora dependem do resultado dos mutators, que já avisam) |

**Por que `getRealErrorMessage` sozinho não bastava no catálogo:** os repositórios do catálogo lançam `AppError` (via `toCatalogError` → `normalizeSupabaseError`), cuja `.message` já é a **normalizada**: código desconhecido vira "Ocorreu um erro inesperado" (inclui o **42P10** de índice único do import ausente) e, para os conhecidos (23514/42501), perde o **nome da constraint/policy**. A causa fica em `technicalMessage`. Novo `catalogErrorMessage` (`catalogRepositoryShared.ts`) = `getRealErrorMessage` + `(technicalMessage)` quando existe e ainda não está na mensagem; `CatalogUnavailableError` (já específico) **não** leva apêndice. Não alterei `lib/supabase/errors.ts` (compartilhado com CRM/Vendas/Clientes).

**Texto que mentia (achado na varredura, corrigido):** o toast de escrita bloqueada citava o card como "Catálogo · escrita na nuvem", mas o título real é **"Catálogo comercial · escrita na nuvem"** (e o pacote §8-b §4.1 citava nomes de card inexistentes). Corrigidos + teste-guarda que amarra o texto do toast ao título real do card.

### Testes (uuid real; erros de Postgres reais via `toCatalogError`)
- `catalogErrorMessage.test.ts` (7, novo): 23514 com o nome da constraint, 42501 com a policy, **42P10** (não fica no genérico), tabela ausente sem apêndice, `Error`/`{message}` crus, nunca vazio, sem duplicar.
- `useBifurcatedCatalog.test.tsx`: CHECK ⇒ toast com ação + constraint; RLS e 42P10 ⇒ causa no toast; **as 15 operações nomeiam a sua ação** e levam a causa.
- `ServicesSection.catalog-source.test.tsx`: toast com a causa do CHECK; erro de **leitura** (RLS) no banner.
- `useLocalCatalogImport.test.ts`: sonda com RLS ⇒ causa; falha de um item ⇒ `report.failures` com nome e causa. `catalogImport.test.ts`: idem no núcleo (dependentes pulados não viram "falha").
- `LocalCatalogImportCard.test.tsx`: relatório lista cada falha; toast com o primeiro erro. `useSupabaseProductsPlans.test.ts`: `error` de leitura com a causa. `CatalogSupabaseToggleCards.test.tsx`: texto do toast ↔ título real do card.

**Prova fail→fix→pass por patch (sem stash, G65):** patch dos **9** fontes (`catalogRepositoryShared`, 4 hooks `useSupabase*`, `useBifurcatedCatalog`, `catalogImport`, `useLocalCatalogImport`, `LocalCatalogImportCard`), `git apply -R` ⇒ **18 testes falham** (7 arquivos); `git apply` ⇒ **72/72** nos mesmos 7 arquivos.

## (c) "Mais usado em orçamentos" — **PENDENTE da lane B (G98)**

Verificado em `main` (`21349fe`, depois de `git fetch`): `quoteMapper.ts` ainda tem `service_id: undefined` hardcoded na escrita e **não** devolve `serviceId` na leitura (`grep service_id|serviceId` → só o comentário e a linha 266); nenhum commit do G98 em `git log -- src/services/quotes/quoteMapper.ts`. Conforme a instrução, **não foi implementado contra fixture**: a métrica continua lendo os orçamentos **locais** (`useQuotes`) e o banner de modo da nuvem **diz isso** ("A métrica “Mais usado em orçamentos” ainda não lê a nuvem"). Quando o G98 estiver na `main`: trocar `useQuotes()` por `useBifurcatedQuotes()` em `ServicesTab` quando `mode.source === "supabase"`, contar `item.serviceId` (uuid) e **tirar a frase do banner** (texto fóssil — runbook Caso 13).

## Pendências
- (c) acima; DDL do operador (pacote §8-b) antes de qualquer teste ao vivo; CT5/CT6/CT7 e M1–M4 em aberto.
