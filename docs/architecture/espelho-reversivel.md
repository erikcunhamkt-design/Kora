# Padrão "Espelho Reversível" — migração `localStorage → Supabase` por entidade

> **O que é.** O molde reutilizável da **Etapa 5** (desmonte do gargalo **G1**: `localStorage`
> como fonte de verdade). Cada entidade de negócio migra numa fatia isolada, reversível e
> homologada, seguindo **as mesmas 7 peças** e respeitando **5 invariantes de segurança**.
>
> **Implementação de referência:** `client_technical_sheets` (ficha técnica) — o "teste de
> fogo" da Etapa 5. Toda entidade seguinte (`opportunities` é a próxima) **copia estas
> peças**, trocando só o nome da entidade e a chave de dedupe.
>
> Contexto e ordem de migração: [`../qa/etapa-5-diagnostico.md`](../qa/etapa-5-diagnostico.md).
> Plano macro: [`kora-hub-auditoria-e-plano.md`](kora-hub-auditoria-e-plano.md) (Etapa 5).

---

## 1. Os 5 invariantes de segurança (valem para TODA fatia)

| # | Invariante | Regra |
|---|---|---|
| **(a)** | **Local nunca é apagado antes do commit remoto** | O assistente de import **jamais** limpa/sobrescreve o `localStorage` da entidade. O local só vira "cache" **depois** de confirmada a persistência no Supabase. Enquanto houver dúvida, o dado local permanece intacto. |
| **(b)** | **Idempotente** | Rodar o import 2× **não duplica**. Preferir constraint **UNIQUE no banco** (estilo Etapa 3) + `upsert(onConflict)`. Onde não há UNIQUE, definir chave natural de dedupe + import-map. |
| **(c)** | **Leitura server-side** | Quando a fonte é Supabase, ler **paginando/filtrando no Postgres** por coluna indexada. Nunca "carregar tudo e filtrar no cliente". |
| **(d)** | **Reversível** | Um seletor de `dataSource` (+ kill-switch experimental) volta a ler do local **sem perda**, porque o local nunca foi destruído. |
| **(e)** | **Disparo consciente pelo usuário** | O import é acionado por um **painel** (nunca automático no load), com **feedback de contagem** e status por registro. |

---

## 2. As 7 peças (com o arquivo de referência da ficha técnica)

Para uma entidade `E`:

### Peça 1 — Repository = contrato único
CRUD server-side com paginação/filtro/ordenação **no Postgres**. Assinatura-alvo para
entidades de lista: `list({ workspaceId, filters, page, pageSize, orderBy }) → { rows, total }`.
Sempre `workspace_id`-scoped, `deleted_at IS NULL`, ordenado por coluna indexada. O hook
depende **só** desta interface.
- 📌 Ref.: [`src/repositories/clientTechnicalSheetsRepository.ts`](../../src/repositories/clientTechnicalSheetsRepository.ts) — `getTechnicalSheet` (point read), `upsertTechnicalSheet`, `deleteTechnicalSheet`.

### Peça 2 — Chave de idempotência
Preferir **UNIQUE no banco** + `upsert(onConflict)`. Sem UNIQUE, definir a **chave natural**
de dedupe e persistir um **import-map** `localId → uuid` em `kora.<E>.supabaseImport.v1`;
o re-import consulta o map + a chave natural **antes** de inserir.
- 📌 Ref.: `UNIQUE(client_id)` em [`supabase/migrations/20260530020000_create_client_technical_sheets.sql`](../../supabase/migrations/20260530020000_create_client_technical_sheets.sql) + `upsert(..., { onConflict: "client_id" })` no repository.
- 📌 Teste do contrato: [`src/repositories/__tests__/clientTechnicalSheetsRepository.test.ts`](../../src/repositories/__tests__/clientTechnicalSheetsRepository.test.ts).

### Peça 3 — Assistente de migração disparado pelo usuário
Painel em Configurações (**nunca** no load): lista candidatos com **status por registro**
(`pronto` / `já-migrado` / `bloqueado-por-dependência` / `sem-dado`); sobe **em lotes** com
progresso + contagem; grava o import-map no sucesso; **jamais apaga o local**; confirma
"N de M migrados". ⟶ invariante **(e)** e reforço de **(a)**.
- 📌 Ref. lógica: [`src/hooks/useLocalTechnicalSheetsImport.ts`](../../src/hooks/useLocalTechnicalSheetsImport.ts) (`candidates`, `importSelected`).
- 📌 Ref. UI: `LocalTechnicalSheetsImportCard` em [`src/pages/Configuracoes.tsx`](../../src/pages/Configuracoes.tsx).

### Peça 4 — Seletor de dataSource reversível
Flag tipada `kora.<E>.dataSource.v1` (default de rollout seguro) que alterna a **leitura**
entre cache local e Supabase — por-workspace ou por-registro — com um **kill-switch**
(flag experimental) que força local. Dado local **intacto** ⟶ voltar atrás é sem perda.
⟶ invariante **(d)**.
- 📌 Ref.: [`src/config/flags.ts`](../../src/config/flags.ts) — `getTechnicalSheetDataSource`/`setTechnicalSheetDataSource` (mapa por-cliente) + `getTechnicalSheetExperimentalEnabled` (kill-switch, opt-out).

### Peça 5 — Leitura = server-side
Com `dataSource=supabase`, o hook lê pelo repository (point read ou paginado). localStorage
vira **cache write-through**, não a fonte. ⟶ invariante **(c)**.
- 📌 Ref.: [`src/hooks/useSupabaseTechnicalSheet.ts`](../../src/hooks/useSupabaseTechnicalSheet.ts) — React Query, `enabled` só com `workspaceId` + `clientId`, point read por `client_id`.

### Peça 6 — Escrita = write-through
Grava **primeiro no Supabase** (fonte de verdade quando a fonte ativa é supabase); no
sucesso, atualiza o espelho local. Em falha, propaga o erro — nunca diverge em silêncio.
⟶ reforço de **(a)**.
- 📌 Ref.: caminho de autosave→Supabase da Ficha Técnica (flag `getTechnicalSheetAutoSaveEnabled`, opt-out) em [`src/pages/ClientTechnicalSheet.tsx`](../../src/pages/ClientTechnicalSheet.tsx).

### Peça 7 — Checklist de cutover por entidade
Homologar (o **operador** roda, não o Code): ida-e-volta local→nuvem→local · **zero perda**
(contagem + amostra campo-a-campo) · idempotência (import 2× → mesmas contagens) ·
reversibilidade (flipar dataSource → local intacto) · `EXPLAIN` da leitura usando índice ·
caminho de dependência ausente reportado, não perdido. **Só então** aposentar a flag
experimental (mantendo o seletor num período de **carência**).
- 📌 Ref.: runbook em [`../qa/etapa-5-ficha-tecnica.md`](../qa/etapa-5-ficha-tecnica.md).

---

## 3. Mapa invariante → peça

| Invariante | Peça(s) que o garante |
|---|---|
| (a) não apaga o local antes do remoto | 3 (assistente) + 6 (write-through) |
| (b) idempotente | 2 (chave de idempotência) |
| (c) leitura server-side | 1 (repository) + 5 (hook de leitura) |
| (d) reversível | 4 (seletor + kill-switch) |
| (e) disparo consciente | 3 (painel) |

---

## 4. Como aplicar na PRÓXIMA entidade (ex.: `opportunities`)

1. **Confirmar o banco** (tabela + RLS + índices + coluna de ordenação para paginação).
   Se faltar índice/constraint, escrever **migration aditiva** revisada à parte (como na
   Etapa 3) — o Code **não** aplica em produção; o **operador** aplica após backup/PITR.
2. **Definir a chave de dedupe** (Peça 2): há UNIQUE natural? Se não, escolher a chave
   natural e o import-map `kora.opportunities.supabaseImport.v1`.
3. **Repository** (Peça 1) com `list` paginado/filtrado server-side + `upsert`/CRUD.
   > `opportunities` já tem `crmOpportunitiesRepository` (CRUD completo) — reaproveitar.
4. **Assistente** (Peça 3): painel em Configurações + hook de import com status por
   registro, **sem** limpar o local.
   > Já existe `useLocalOpportunitiesImport` — auditar contra os invariantes antes de usar.
5. **Seletor + kill-switch** (Peça 4): `kora.opportunities.dataSource.v1` + flag experimental.
   > `opportunities` hoje usa `getCrmDataSource()` (`kora.crm.dataSource.v1`) — decidir se
   > reusa ou cria um seletor próprio da entidade.
6. **Hook de leitura server-side** (Peça 5) + **write-through** (Peça 6).
7. **Testes** do repository (idempotência) e do mapper (round-trip), como na ficha técnica.
8. **Homologar** (Peça 7) com o operador. Só então retirar a flag após carência.

**Atenção às dependências (FK de saída):** migrar `E` só depois que seus pais já estão no
Supabase. A ficha depende de `clients`; `opportunities` também. O assistente deve
**reportar** (status "bloqueado-por-dependência"), nunca forçar um FK inválido nem
descartar o registro.

---

## 5. Variantes do molde (por tipo de entidade)

A Peça 2 (idempotência) tem duas variantes conforme a entidade:

### Variante A — entidade COM chave única natural
Ex.: **ficha técnica** (`UNIQUE(client_id)` — 1 ficha por cliente). O import faz
`upsert(onConflict: "<chave>")` direto. Duplicata impossível, zero infra extra.

### Variante B — entidade SEM chave única natural (+ fan-in)
Ex.: **opportunities** (dois negócios legítimos podem ter mesmo título/cliente → não há
chave natural). Solução padrão, reutilizável em quotes/finance/projects/tasks:

1. **`source_local_id` namespacado.** Coluna `text` guardando `${installId}:${localId}`,
   onde `installId` é um id estável por **perfil de navegador** (`src/lib/installId.ts`,
   chave `kora.install.id.v1`, `crypto.randomUUID()`). O namespace é por navegador porque o
   espaço dos ids locais é o localStorage — **não** o usuário (mesmo usuário em 2
   navegadores tem sequências independentes; `userId:localId` colidiria e fundiria linhas).
2. **UNIQUE NÃO-parcial** `(workspace_id, source_local_id)`. Um índice parcial
   (`WHERE ... IS NOT NULL`) quebra a inferência do arbiter no `ON CONFLICT` (precedente
   **P8b**); NULLs distintos já cobrem as linhas legadas.
3. **`upsert(onConflict: "workspace_id,source_local_id")`** no import → reimport do mesmo
   registro (mesmo `installId:localId`) vira UPDATE, nunca duplicata.
4. **Fuzzy match + guarda `new`-only (A2) como 2ª camada** para "mesma oportunidade lógica
   vinda de 2 navegadores" (installIds diferentes → 2 linhas): o assistente marca
   "Duplicado" e **bloqueia** a importação (só `matchStatus === "new"` é importável).
5. **Limitação conhecida:** limpar o localStorage regenera o installId; mas o import-map
   some junto e o fuzzy+A2 barram o reimport — sem duplicata silenciosa.

Referência: [`../qa/etapa-5-fatia-2-opportunities.md`](../qa/etapa-5-fatia-2-opportunities.md) + migrations `…_source_local_id.sql`.

### Contrato de RE-LINK forward (fan-in)
Quando uma entidade FILHA referencia uma entidade já migrada por **id LOCAL** (ex.:
`transactions.opportunity_id`, `projects.opportunity_id` guardam o id local da
oportunidade), a migração da filha **deve traduzir** esse id local → UUID Supabase
consultando o **import-map do pai** (`kora.<pai>.supabaseImport.v1` →
`importedMap[String(localId)]`) — exatamente como o import de `opportunities` consome o
`kora.clients.supabaseImport.v1` para resolver `client_id`.

- **Enquanto pai e filha ficam em localStorage**, nada orfaniza (local→local resolve; o
  `orbyt.*` do pai permanece intacto — invariante *a*).
- **Ao migrar a filha**, se o import-map do pai não tiver a entrada → resolver para `null`
  **e reportar**; NUNCA gravar id local cru numa coluna `uuid` (o bug do A1).
- O import-map é **persistido** e é a ponte permanente; futuras fatias **têm de** honrá-lo,
  senão os vínculos migram órfãos.

---

## 6. Guardrails invioláveis

- ❌ **Nunca** limpar/sobrescrever o `localStorage` da entidade antes de confirmar a
  persistência remota. O local é a rede de segurança até a homologação.
- ❌ O Code **não dispara** import de dados nem aplica migração em produção. Import e SQL
  são **ação do operador**, após backup/PITR.
- ❌ **Não** aposentar a flag experimental na mesma fatia da migração — há **carência**
  reversível.
- ✅ `npx tsc --noEmit` = 0 · lint **não regride** do teto (89/68) · testes **verdes** (e
  subindo). `git add` por caminho explícito.
