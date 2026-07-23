# Etapa 5 · Fatia 2 — `opportunities` (CRM) · Diagnóstico (Fase A)

> **Status:** Fase A concluída (leitura pura). **Veredito: NÃO homologa como está** — 2
> defeitos bloqueantes. Ajustes A1–A5 aprovados; A6 (paginação) adiado/catalogado.
>
> Molde: [`../architecture/espelho-reversivel.md`](../architecture/espelho-reversivel.md) ·
> Diagnóstico da etapa: [`etapa-5-diagnostico.md`](etapa-5-diagnostico.md) ·
> Fatia 1 (referência): [`etapa-5-ficha-tecnica.md`](etapa-5-ficha-tecnica.md).

Diferente da ficha técnica, `opportunities` tem **fan-in** (finance/projects dependem dela),
**fan-out** (referencia client/quote/converted_client) e **não tem UNIQUE natural** de banco.

---

## 1. Checklist dos 6 pontos do molde

### 🟢 (a) NÃO apaga o local antes de confirmar remoto — OK
Import escreve só o mapa de metadados; nunca toca `orbyt.leads.v1`.
- `useLocalOpportunitiesImport.ts:168` grava só `kora.crm.supabaseImport.v1`.
- `useLeads.ts:65` `STORAGE_KEY = "orbyt.leads.v1"`; grep app-wide: nenhum `removeItem`/`clear`/overwrite.

### 🔴 (b) Idempotência — FRACA (só app, sem backstop de banco) + UI importa "Duplicado"
1. **Banco:** `createOpportunity` é `.insert()` puro (`crmOpportunitiesRepository.ts:105-117`) — sem `onConflict`, **sem UNIQUE** na migração.
2. **Import-map (exato):** `importedLocalIds.includes(id) || importedMap[String(id)]` (`useLocalOpportunitiesImport.ts:73-75`) — só bloqueia re-import do mesmo id local, mesmo navegador, mapa intacto.
3. **Fuzzy (email/telefone/título+empresa):** marca "Duplicado" (`:78-87`) — **só visual**.

Furo: o painel torna "Duplicado" **elegível e pré-selecionado** (`Configuracoes.tsx:1732,1737,1862`), e `importSelected` **não filtra matchStatus** (`:119`). **Rodar 2×:** mesmo navegador+mapa → idempotente; "Duplicado"/mapa-limpo/outro-navegador → **duplicata real no banco**.

### 🟡 (c) Leitura server-side — filtrada no Postgres, NÃO paginada
`listOpportunities` filtra no servidor (`workspace_id`, `deleted_at`, `archived`) + order (`repo:67-91`); carrega o conjunto inteiro do workspace (sem `.range`/`.limit`). `CRM.tsx:165-175` escolhe local/supabase por `getCrmDataSource()`. Não é "carrega tudo e filtra no cliente", mas falta paginação (G2).

### 🟢 (d) Reversibilidade — OK, com camada extra
Seletor `kora.crm.dataSource.v1` (default supabase) + `activeDataSource = workspace ? dataSource : "local"` (`CRM.tsx:165-167`); local intacto → flip sem perda. **Extra:** `kora.crm.supabaseWrite.enabled` default **OFF** (`useSupabaseCrmWriteFlag.ts:22-28`) → CRM Supabase é **read-only** por padrão.

### 🟢 (e) Disparo consciente — OK
Painel `LocalOpportunitiesImportCard` (`Configuracoes.tsx:1726`), manual, com tiles + timestamp. Nada em `useEffect`.

---

## 2. Pontos específicos da Fatia 2

### 🟡 (6) Órfã de cliente — migra com `client_id` NULL, silenciosamente
`useLocalOpportunitiesImport.ts:134-141`: cliente não mapeado → `client_id = null`, **migra assim mesmo**, sem reportar. Não viola FK (`SET NULL`), mas perde o vínculo sem avisar. Correto: migrar + **reportar** (contador "sem cliente vinculado"). → **A4**.

### 🔴 (7) FAN-IN e FAN-OUT

**Fan-in (finance/projects → opportunity):** sem orfanização nesta fatia. `useFinance.ts:35` e `useProjects.ts:42` guardam `opportunityId?: number` (id local). Import não re-vincula, mas `orbyt.leads.v1` fica intacto → local→local resolve. Risco **forward**: futuras fatias de finance/projects devem traduzir `opportunityId` local → UUID via `kora.crm.supabaseImport.v1` (contrato não garantido hoje). → **A5**.

**Fan-out (opportunity → quote/converted_client):** 🔴 **BUG ATIVO.** O mapper passa ids locais crus pra colunas `uuid` sem re-mapear:
```ts
// crmOpportunityMapper.ts:32,34
quote_id: lead.quoteId || null,
converted_client_id: lead.convertedClientId ? String(lead.convertedClientId) : null,
```
`quote_id`/`converted_client_id` são `UUID` → um lead convertido/ligado a orçamento → `invalid input syntax for type uuid` → **INSERT explode**. Pior: loop não-atômico (`:127-150`) + `setItem` do mapa **depois** do loop (`:168`) → sucessos anteriores ficam no banco **sem tracking** → re-import duplica. → **A1**.

---

## 3. Avaliação de risco vs. ficha técnica

| Dimensão | Ficha (Fatia 1) | Opportunities (Fatia 2) |
|---|---|---|
| Idempotência | 🟢 UNIQUE + upsert | 🔴 insert puro, sem UNIQUE; UI importa "Duplicado" |
| Fan-in | 🟢 zero | 🟡 finance/projects (re-link forward não garantido) |
| Fan-out | 🟢 só client_id (tratado) | 🔴 quote_id/converted_client_id NÃO remapeados → insert error |
| Órfã | 🟢 pulada+reportada | 🟡 migra null sem reportar |
| Reversibilidade | 🟢 seletor+kill-switch | 🟢 seletor + write-flag OFF |
| Leitura | 🟢 point-read | 🟡 filtrada, sem paginação |
| Blast radius | 🟢 baixo | 🟡 maior (comercial, com fan-in) |

Mais arriscada em 3 eixos; equivalente/melhor em reversibilidade.

---

## 4. Ajustes aprovados

- **A1 (código):** re-mapear `quote_id`/`converted_client_id` via import-maps → UUID ou null; corrigir atomicidade (map incremental/relatório de falha parcial). **Bloqueante.**
- **A2 (código):** guarda anti-duplicado 2 camadas — UI não pré-seleciona/desabilita "Duplicado"; `importSelected` só aceita `matchStatus === "new"`. **Bloqueante.**
- **A3 (migration + código):** backstop de idempotência — coluna `source_local_id` + UNIQUE parcial `(workspace_id, source_local_id)`; import grava `source_local_id` (namespacado) + `upsert(onConflict)`. Migration revisada/aplicada pelo operador (com export), estilo Etapa 3.
- **A4 (código):** reportar órfã de cliente no painel.
- **A5 (doc):** documentar o contrato de re-link forward no `espelho-reversivel.md`.
- **A6 (adiado):** paginação server-side em `listOpportunities`.

---

## 5. Plano de homologação (7 provas)

5 da ficha (import · zero perda · idempotência · reversibilidade · EXPLAIN) **+**
6 · órfã de cliente (migra null + reportada) **+**
7 · fan-in não-órfão (finance/projects local seguem resolvendo; `importedMap` tem a ponte localOppId→UUID).
Gates: export manual + print pré-clique. Operador roda; Code verifica.

---

## 6. Recomendação

**Não homologar com o que existe.** Aplicar A1+A2 (código) e A3 (migration estilo Etapa 3,
revisada/aplicada pelo operador com export antes). A4/A5 por baixo custo. Resultado: fatia no
nível de segurança da ficha + variante do molde "entidade com fan-in, sem UNIQUE natural"
(reutilizável em quotes/finance/projects/tasks).

---

## 7. Estado B.1/B.2 (aplicado)

- **B.1 (código):** `aa39267` (A1+A2+A4 dados) · `5db6679` (A2+A4 painel).
- **B.2 (migration + código):** `27ce1a5` (migration A3) · `d15761c` (código A3) · `28b3c55` (A5 molde).
- **Migration A3 APLICADA e válida** pelo operador (2026-07-18): `crm_opportunities.source_local_id`
  criada; índice `ux_crm_opp_source_local` (`indisvalid=true`, `indisunique=true`); baseline `opps_antes=0`.
- Gates: `npx tsc` = 0 · lint 89/68 · testes 100. Flag `supabaseWrite` permanece **OFF**.

## 8. Runbook de homologação (B.3) — o OPERADOR roda

Cenário: 2 oportunidades de teste + 1 cliente mapeado + 1 transação fan-in.
- `TESTE-OPP-PRONTA` (id local 950100) → clientId 950001 **mapeado** a um client real → `client_id` resolve a UUID.
- `TESTE-OPP-ORFA` (id local 950101) → clientId 950999 **não mapeado** → migra com `client_id` NULL + painel reporta.
- Transação `tx-homolog-1` (`orbyt.finance.v1`) com `opportunityId = 950100` (fan-in).

**Gates:** (0.2) EXPORT MANUAL de `crm_opportunities` antes do import · (0.3) PRINT PRÉ-CLIQUE do card **"Importar Oportunidades Locais"** (NÃO o de Clientes) com tiles Total 2 / Novos 2 / Duplicados 0 / Já Importados 0 + aviso "1 sem cliente vinculado".

**As 7 provas:**
1. Import → toast "2 oportunidades importadas".
2. Zero perda → 2 linhas remotas; `TESTE-OPP-PRONTA.client_id = <UUID real>`, `TESTE-OPP-ORFA.client_id = NULL`; valores/stage batem; `source_local_id` = `<installId>:950100/950101`.
3. Idempotência → 2ª análise: ambas "Já Importada"; `group by (workspace_id, source_local_id) having count>1` → 0.
4. Reversibilidade → console: `orbyt.leads.v1` mantém 950100/950101 intactas.
5. EXPLAIN → `where workspace_id and deleted_at is null and archived=false` (com `enable_seqscan=off`) → Index Scan (`idx_crm_opportunities_archived`).
6. Órfã de cliente → `TESTE-OPP-ORFA.client_id IS NULL` no banco + badge "sem cliente vinculado" no painel.
7. Fan-in não-órfão → console: Lead 950100 intacta · `tx-homolog-1.opportunityId = 950100` (link local resolve) · `kora.crm.supabaseImport.v1.importedMap["950100"]` = UUID (ponte de re-link).

Seed, queries e limpeza: ver a entrega em chat / repetir o padrão da Fatia 1.

## 9. Resultados da homologação — **VERDE (7/7)**

Homologado pelo operador em 2026-07-18. Cenário: `TESTE-OPP-PRONTA` (local 950100, cliente
mapeado a `50f894e9-…`/fabio) + `TESTE-OPP-ORFA` (local 950101, cliente 950999 não mapeado) +
transação fan-in `tx-homolog-1` (opportunityId 950100). installId `e307969a-…`.

| Prova | Resultado | Evidência |
|---|---|---|
| 1 · Import | ✅ | toast "2 oportunidades importadas com sucesso!" |
| 2 · Zero perda | ✅ | PRONTA `client_id=50f894e9-c81c-4420-b673-9335ad17a6bf`; ORFA `client_id=NULL` (não id local cru); 1234/lead; `source_local_id=<installId>:950100 / :950101` |
| 3 · Idempotência | ✅ | reanálise → **Novos 0 / Já Importados 2**; `group by (workspace_id, source_local_id) having count>1` → 0 linhas |
| 4 · Reversibilidade | ✅ | console: `orbyt.leads.v1` mantém 950100/950101 (`true true`) |
| 5 · Leitura indexada | ✅ | **Index Scan using ux_crm_opp_source_local** (Index Cond workspace_id; Filter deleted_at/archived; Exec 0.116 ms) |
| 6 · Órfã de cliente | ✅ | ORFA `client_id NULL` no banco + badge "sem cliente vinculado" no painel/diálogo |
| 7 · Fan-in não-órfão | ✅ | `tx-homolog-1.opportunityId=950100` resolve (local intacto) + `kora.crm.supabaseImport.v1.importedMap["950100"]=2096775a-…` (ponte de re-link) |

**Gate export manual (crm_opportunities):** ✅ tabela vazia no baseline (0 linhas) — nada a
perder. **Gate print pré-clique:** ✅ card "Importar Oportunidades Locais" (2/2/0/0) + aviso
"1 sem cliente vinculado". Flag `supabaseWrite` permaneceu **OFF**.

**Validação em produção:** A1 (órfã→NULL, mapeado→UUID real), A2 (0 novos na 2ª análise),
A3 (0 duplicatas, `source_local_id` namespacado), A4 (órfã reportada), A5 (contrato de
re-link documentado + ponte confirmada na prova 7).

---

## 10. O1 — pendência pós-fechamento: paridade de schema local↔nuvem (bloqueia cutover de escrita)

> Registrado em 2026-07-23, durante a Fase A de Etapa 5 · Fatia 8 (cutover de escrita de
> `opportunities`), na mesma auditoria de paridade de schema pré-cutover que originou **Q8**
> (Fatia 3) e **PT2** (Fatia 7). **Não reabre a Fatia 2** — não bloqueia nada do que já foi
> executado e homologado aqui (§9, VERDE 7/7); o import é write-only sobre o import-map, a
> leitura/escrita de negócio continua local. É pendência para a Fatia 8, que propõe o cutover de
> **escrita** de `opportunities`.

**Achado:** 2 campos do `Lead` local (`src/hooks/useLeads.ts`) não têm coluna correspondente em
`public.crm_opportunities` (`supabase/migrations/20260530050000_create_crm_opportunities.sql`):

| Campo local | Linha (`useLeads.ts`) | Coluna em `public.crm_opportunities`? |
|---|---|---|
| `tags?: string[]` | 24 | ausente |
| `history: {date, text}[]` | 29 | ausente |

**Confirmado no mapper (silencioso, não é bug de código — é ausência de schema):**
`crmOpportunityMapper.ts` não inclui `tags`/`history` no payload local→nuvem (não há coluna para
mandar); no caminho inverso, `mapSupabaseOpportunityToLocal` (linha 94) grava
`history: []` **hardcoded vazio** — qualquer leitura a partir da linha Supabase zera o
histórico, mesmo que o registro local de origem o tivesse preenchido. `tags` sofre o mesmo
apagamento (nunca atribuído no caminho de volta).

**Hoje é inofensivo** porque a leitura de negócio de `opportunities` nunca sai do local
(`useLeads`, `orbyt.leads.v1`) — o caminho Supabase (`useSupabaseOpportunities`) é usado só nas
telas específicas do modo "Operacional", opt-in via `kora.crm.dataSource.v1`/
`kora.crm.supabaseWrite.enabled`, ambos hoje sem cutover completo. Se o cutover de escrita da
Fatia 8 passar a tratar Supabase como fonte única antes de fechar este gap, `tags`/`history`
somem silenciosamente para todo lead que passar pelo cutover — regressão de dado real, não de
teste.

**Classificação:**
- **Não bloqueante para a Fatia 2** — encerrada em §9, sem alteração de veredito.
- **Bloqueante para o cutover de escrita (Fatia 8)** — decisão de design explícita necessária
  antes de flipar qualquer flag de escrita por padrão: adicionar coluna, aceitar degradação
  catalogada, ou recortar um cutover parcial que preserve os dois campos como só-local até
  resolver.

**Recomendação (registrada, não executada nesta fatia):** decisão a ser tomada na Fase B da
Fatia 8 (ver [`etapa-5-fatia-8-crm-cutover.md`](etapa-5-fatia-8-crm-cutover.md) §5, achado O1),
com base no uso real dos dois campos pelos consumidores da UI antes de escolher entre migration
aditiva (`tags text[]`, `history jsonb`) e degradação aceita.

**Referência cruzada:** mesma categoria de **Q8** ([`etapa-5-fatia-3-quotes.md` §12](etapa-5-fatia-3-quotes.md#12-q8--pendência-pós-fechamento-paridade-de-schema-localnuvem-bloqueia-cutover-de-leitura))
e **PT2** ([`etapa-5-fatia-7-projects.md` §15](etapa-5-fatia-7-projects.md#15-pt2--pendência-catalogada-gap-de-schema-do-3º-nível-bloqueia-cutover-futuro-de-tasks))
— achado de paridade de schema local↔nuvem que não bloqueia a fatia em que foi descoberto, mas
bloqueia uma fatia futura específica (aqui, cutover de **escrita** de `opportunities`; lá,
cutover de **leitura** de `quotes` e cutover de **CRUD completo** de `tasks`, respectivamente).
