# Etapa 4 — Centralizar feature flags (4a)

**Objetivo:** primeira etapa que refatora `src/` de verdade — **refatoração de
comportamento PRESERVADO**. Reunir num único módulo tipado (`src/config/flags.ts`)
as leituras/escritas de feature flags que estavam soltas via
`localStorage.getItem(...) === "true"` espalhadas por páginas, cards de configuração e
componentes. **Nada que o usuário vê muda:** mesma chave de localStorage, mesmo default,
mesmo formato gravado. É adaptação de **acesso**, não de **storage**.

**Data:** 2026-07-04 · **Branch:** `main`

## Decisão de escopo — 4a agora, 4b para a Etapa 5

Após o diagnóstico (Fase A), o escopo foi **dividido** (recomendação aceita pelo dono
do repo):

- **4a (flags)** — feita nesta etapa. Contida, baixo risco, testável.
- **4b (interface única dos repositories)** — **movida para a Etapa 5**, feita
  entidade por entidade com o consumidor real na mão. Motivo: os 7 repositories
  divergem profundamente (nomes de `list*`, semântica de delete — hard vs soft vs
  soft+restore, semântica de create — genérico vs `*FromQuote` vs lote, tipos de
  retorno, e 5 deles com `@ts-nocheck`). Unificar o contrato rippla em todos os
  consumidores = alto risco de regressão, e o valor da 4b é sobretudo **preparar a
  migração da Etapa 5**. Fazer junto seria arriscar; preferimos dividir.

## Commits

| Commit | Escopo |
|--------|--------|
| `49ec0bf` | commit 1 — `src/config/flags.ts` (módulo tipado, sem `@ts-nocheck`) + teste |
| `b277b28` | correção — flags da ficha técnica **não** são opt-in (ver §4) |
| `7fc41ee` | grupo ficha técnica — centraliza `experimental` (opt-out) + `dataSource` |
| `ae8857d` | grupo projects/tasks/operacional — 3 flags opt-in |
| `2e89a0f` | grupo CRM — `createQuote` (opt-in) + `dataSource` |
| _(este doc)_ | relatório da Etapa 4a |
| _pendente_ | grupo **quotes** — bloqueado pelo sweep (ver §5) |

---

## 1. Tabela de flags (diagnóstico consolidado)

Padrão anterior: **sem helper** — cada site fazia `localStorage.getItem(...)` com a
comparação inline; cada card reimplementava leitura+escrita (duplicação/inconsistência).

### 1.1 Flags booleanas VIVAS opt-in (default DESLIGADO, `=== "true"`)

| Flag (`kora.*.enabled`) | Consumidor | Toggle | Estado 4a |
|---|---|---|---|
| `quotes.supabaseExperimental` | SupabaseQuotesViewerCard:77 | QuotesSupabaseExperimentalToggleCard | ⏳ pendente (sweep) |
| `quotes.supabaseCreateProject` | LinkedQuotesSection:50 · Viewer:45 | QuotesSupabaseProjectToggleCard | ⏳ pendente (sweep) |
| `quotes.supabaseCreateReceivable` | LinkedQuotesSection:37 · Viewer:32 | QuotesSupabaseReceivableToggleCard | ⏳ pendente (sweep) |
| `quotes.supabaseApproval` | LinkedQuotesSection:68 · Viewer:84 | QuotesSupabaseApprovalToggleCard | ⏳ pendente (sweep) |
| `crm.supabaseCreateQuote` | CRM.tsx:1286 | CrmSupabaseCreateQuoteToggleCard | ✅ `2e89a0f` |
| `projects.supabaseCreateBaseTasks` | OperationalDashboardCard:272 | QuotesSupabaseBaseTasksToggleCard | ✅ `ae8857d` |
| `tasks.supabaseStatusTransition` | OperationalDashboardCard:42,92 | QuotesSupabaseStatusTransitionToggleCard | ✅ `ae8857d` |
| `supabase.operationalDashboard` | OperationalDashboardCard:243 | SupabaseOperationalDashboardToggleCard | ✅ `ae8857d` |

### 1.2 Flags booleanas com semântica ESPECIAL

| Flag | Semântica | Onde | Estado 4a |
|---|---|---|---|
| `technicalSheets.supabaseExperimental` | **opt-OUT** (default LIGADO) — card e consumidor consistentes (`!== "false"`) | ClientTechnicalSheet:326 · Configuracoes:1696 | ✅ `7fc41ee` (acessor opt-out dedicado) |
| `technicalSheets.supabaseAutoSave` | **INCONSISTENTE** — card lê `=== "true"` (default OFF), consumidor lê `!== "false"` (default ON) | ClientTechnicalSheet:251 · AutoSaveToggleCard:9 | ⚠️ catalogado, **sem acessor** (ver §4) |
| `crm.supabaseWrite` | opt-in + **sync cross-tab** via `CustomEvent` | hook `useSupabaseCrmWriteFlag` | ⛔ helper próprio — **não** centralizado (semântica especial) |
| `whatsapp.campaignSender` | **opt-OUT** (default LIGADO) | helper `lib/whatsapp/featureFlags.ts` | ⛔ helper próprio — **não** centralizado |

### 1.3 Seletores de fonte de dados (default **`"supabase"`**, não `"local"`)

| Seletor | Forma | Onde | Estado 4a |
|---|---|---|---|
| `crm.dataSource.v1` | string plana (`"local"` seleciona local; resto ⇒ supabase) | CRM.tsx:166,196 | ✅ `2e89a0f` |
| `technicalSheets.dataSource.v1` | **mapa JSON por cliente** `{ [clientId]: "local"\|"supabase" }` | ClientTechnicalSheet:334… | ✅ `7fc41ee` |

### 1.4 Flags MORTAS (escritas por toggles, sem leitura de comportamento)

Ver §6.

---

## 2. O que foi centralizado, por commit (chave/default/comportamento preservados)

- **`49ec0bf` — `flags.ts` + teste.** Módulo 100% tipado (sem `@ts-nocheck`). Acessores:
  - `getBooleanFlag`/`setBooleanFlag` (opt-in, `=== "true"` / `String(v)`).
  - `getCrmDataSource`/`setCrmDataSource` (string plana, default `"supabase"`).
  - `getTechnicalSheetDataSource`/`setTechnicalSheetDataSource` (mapa por cliente,
    default `"supabase"`, preserva as entradas dos demais clientes).
  - `DEAD_FLAG_KEYS` (catálogo, sem acesso exposto).
- **`b277b28` — correção.** As duas flags da ficha técnica saíram de `BOOLEAN_FLAG_KEYS`;
  `experimental` ganhou acessor **opt-out** (`getTechnicalSheetExperimentalEnabled`);
  `autoSave` ficou só catalogada (`TECHNICAL_SHEETS_AUTOSAVE_KEY`, sem acessor).
- **`7fc41ee` — ficha técnica.** `ClientTechnicalSheet.tsx` (experimental + dataSource:
  useState, auto-promote, handleSourceChange) e `Configuracoes.tsx`
  (SupabaseExperimentalToggleCard). **`autoSave` intocado.**
- **`ae8857d` — projects/tasks/operacional.** `SupabaseOperationalDashboardCard.tsx`
  (4 sites) + 3 toggle cards. Os `dispatchEvent("storage")` dos cards foram **mantidos**
  (o card de dashboard escuta `storage` para sincronizar o estado das flags).
- **`2e89a0f` — CRM.** `CRM.tsx` (createQuote + dataSource) + CrmSupabaseCreateQuoteToggleCard.

Padrão dos edits: troca cirúrgica da expressão de leitura/escrita pelo acessor
equivalente; onde havia `try/catch` redundante (o acessor já é seguro), o bloco foi
removido — daí o saldo negativo de linhas em todos os commits.

---

## 3. Achado da Fase A que corrigiu o diagnóstico

Dois flags vivos não estavam no diagnóstico inicial e foram encontrados por grep
exaustivo antes de tocar código:

- `crm.supabaseWrite.enabled` — gate real de escrita do CRM (o `supabaseWriteEnabled`),
  com helper próprio e sync cross-tab. As **6 flags CRM da tela Configurações** (§6)
  foram **superadas** por ele + `crm.dataSource.v1` → por isso estão mortas.
- `whatsapp.campaignSender.enabled` — helper próprio, semântica **opt-out**.

Ambos ficam fora do `flags.ts` (semântica especial); apenas documentados.

---

## 4. Blocker 1 — `technicalSheets.supabaseAutoSave` é inconsistente (decisão: deixar fora)

Bug **pré-existente**: o **card** (`QuotesSupabaseTechnicalSheetsAutoSaveToggleCard:9`)
lê `=== "true"` → default **DESLIGADO** (mostra "Inativo" quando não setado), mas o
**consumidor** (`ClientTechnicalSheet.tsx:251`) lê `!== "false"` → default **LIGADO**
(o autosave funciona quando não setado). Num usuário novo, o card diz "Inativo" mas o
autosave **está ativo**.

Não há como centralizar num único default sem mudar o comportamento de um dos lados.
**Decisão (dono do repo): deixar fora da 4a e catalogar.** O comportamento atual foi
preservado 1:1 (nenhuma das duas leituras foi tocada). Fica registrado para decisão de
produto à parte: (a) unificar em default-ON alinhando o card ao consumidor — muda o
_display_ do card; ou (b) unificar em default-OFF alinhando o consumidor ao card — muda
o comportamento real do autosave. Enquanto não houver decisão, `flags.ts` expõe apenas
`TECHNICAL_SHEETS_AUTOSAVE_KEY` (constante), **sem** acessor.

---

## 5. Blocker 2 — grupo quotes colide com o sweep (grupo adiado)

Os dois consumidores que o grupo **quotes** precisa editar — `LinkedQuotesSection.tsx` e
`SupabaseQuotesViewerCard.tsx` — estão entre os **23 arquivos do sweep** (alterações
locais não commitadas que devem permanecer intocadas). Editá-los e dar `git add` por
caminho empacotaria as mudanças do sweep junto.

**Decisão (dono do repo): base limpa antes.** O grupo quotes fica **adiado** até o dono
do repo resolver o sweep (commit ou stash dos 23). Depois, os 4 flags de quotes (§1.1) e
seus 4 toggle cards serão centralizados num commit próprio, por caminho explícito, sem
misturar o sweep.

---

## 6. Flags MORTAS — catalogadas para remoção futura (CONFIRMAR ANTES)

Escritas por toggles inline em `Configuracoes.tsx`, mas **sem nenhuma leitura de
comportamento** (superadas por `crm.supabaseWrite.enabled` + `crm.dataSource.v1`).
Registradas em `DEAD_FLAG_KEYS`. **NÃO removidas nesta etapa** — remover o card é
mudança de UI visível.

| Flag morta | Toggle (Configuracoes.tsx) |
|---|---|
| `crm.supabaseExperimental.enabled` | CrmSupabaseExperimentalToggleCard:1744 |
| `crm.supabaseStageMove.enabled` | CrmSupabaseStageMoveToggleCard:1792 |
| `crm.supabaseBasicEdit.enabled` | :1840 |
| `crm.supabaseCreate.enabled` | :1888 |
| `crm.supabaseArchive.enabled` | :1936 |
| `crm.supabaseRestoreArchive.enabled` | :1984 |

> **Nota de remoção (etapa futura):** o **primeiro passo** antes de remover qualquer uma
> será reconfirmar por **grep exaustivo** de cada chave que ela continua sem leitura de
> comportamento — nunca remover com base em "suspeita".

---

## 7. Verificação (tsc / lint / testes / runtime)

Por commit, em todos os grupos:

- `npx tsc --noEmit` → **0 erros**.
- Lint gate (`scripts/lint-gate.mjs`) → **89 erros / 68 `no-explicit-any`**, **sem
  regressão** vs baseline (89/68). `flags.ts` é 100% tipado, sem `@ts-nocheck`.
- Suíte Vitest → **9 arquivos / 76 testes** (o `flags.test.ts` adicionou 19: default,
  leitura, formato de escrita, seletor CRM, mapa por cliente, JSON malformado, opt-out
  da ficha técnica).
- **Runtime (preview):** app carrega sem erro de build/console; `import('/src/config/flags.ts')`
  no bundle rodando confirmou os defaults reais — CRM dataSource `"supabase"`, experimental
  da ficha `true` (opt-out), flag opt-in `false`.

---

## 8. Critérios de aceite da 4a

- [x] `flags.ts` é a fonte única tipada das flags locais (opt-in, opt-out, seletores).
- [x] Comportamento preservado: mesma chave, mesmo default, mesmo formato gravado.
- [x] Um commit por grupo, cada um com `tsc 0` + lint sem regressão + testes verdes.
- [x] `git add` por caminho explícito; os 23 arquivos do sweep e o `.env` intocados.
- [x] Flags mortas **catalogadas, não removidas** (com nota "confirmar antes").
- [x] 4b registrada como movida para a Etapa 5, com justificativa.
- [ ] **Grupo quotes** — pendente da resolução do sweep pelo dono do repo.

**Status:** 4a concluída **exceto o grupo quotes** (adiado por dependência do sweep).
