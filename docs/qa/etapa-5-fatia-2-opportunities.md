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
