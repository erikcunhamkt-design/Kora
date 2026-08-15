# Etapa 5 · G1/Financeiro · Pacote do Flip — Runbook das Fases C/D (preparação)

> **Escopo desta rodada: doc-only, zero código.** Este doc NÃO executa nada —
> prepara o roteiro pra que a Fase C (flip dos defaults) e a Fase D
> (homologação B.3) não precisem improvisar formato, critério ou passo
> quando chegar a vez delas. Mesmo molde do runbook de `projects`
> ([`etapa-5-flip-projetos-runbook.md`](etapa-5-flip-projetos-runbook.md)),
> adaptado ao que a Fase A/pacote de `finance` já desenharam
> ([`etapa-5-flip-financeiro-fase-a.md`](../architecture/etapa-5-flip-financeiro-fase-a.md),
> [`etapa-5-flip-financeiro-pacote.md`](etapa-5-flip-financeiro-pacote.md)).
>
> **A Fase B da Lane A roda em paralelo** — o que depender do código dela
> entra como `[completar pós-B]`, mesmo precedente de `projects` (aquele
> runbook nasceu com placeholders e foi resolvido numa rodada seguinte
> contra o merge real). **Diferença desta rodada:** ao abrir esta branch,
> uma PRIMEIRA fatia da Fase B já tinha mesclado (`e7d21b7` — leitura
> Supabase opt-in + as 2 flags) — os trechos que ela já resolve estão
> escritos contra o código real, não mais como placeholder; o que ainda
> falta (escrita real, migrations do pacote §1.1/§2.1) continua marcado.
>
> **Atualização (rodada seguinte) — Fase B FECHADA:** `main` chegou em
> `dea8c75` (`936c762` — Fase B completa: CRUD real, `useBifurcatedFinance`,
> espelho de `QuoteToReceivableDialog` — + `dea8c75` — ajustes da revisão
> Lane E sobre `936c762`). **Todos os `[completar pós-B]` desta rodada foram
> resolvidos contra o código real mesclado**, mesmo movimento do runbook de
> `projects` — nomes de hook, arquivo:linha e comportamento exato, todos
> confirmados por leitura direta do código em `main`, não mais por citação
> do desenho do pacote. Nenhum caso mudou de forma; alguns tiveram a
> expectativa corrigida contra uma divergência real do código (marcado
> inline onde ocorreu). `dea8c75` é registrado como o fechamento da Fase B
> — baseline do rollback nível 2 (§2.4) —, não como o commit da Fase C
> (que ainda não existe).

## Abertura (§16/§17)

- Worktree: `orbit-designer-hub`.
- Branch: `etapa-5-flip-financeiro-runbook`, criada a partir de `origin/main`.
- Hash confirmado por `git log origin/main -1`: **`8227634`**
  (`docs: G41 - coordenacao explicita com o desenho da Fase B (etapa-5-flip-financeiro-pacote.md)`).
- **Paralelismo confirmado nesta abertura** (`git log origin/main -8 --oneline`):
  - `e7d21b7` — `feat(finance): Fatia N - flags + leitura Supabase opt-in (read-only)` — Lane A, Fase B item 2 (leitura) do pacote.
  - `c65559d`/`2b68817`/`8227634` — G41 (Lane A/revisor) — fix mecânico de `quoteId` em `CreateReceivableDialog.tsx` + catalogação + coordenação explícita com este pacote.
  - `76050aa` — pacote executivo de Financeiro (Lane C, rodada anterior).

## Referências (com o porquê de cada uma)

- [`etapa-5-flip-projetos-runbook.md`](etapa-5-flip-projetos-runbook.md) — molde direto de estrutura, formato de caso, critério de vermelho/ressalva, e as 5 lições (G29/G30/G32/G33/G37) que este doc precisa carregar adiante, agora aplicadas a um domínio diferente.
- [`etapa-5-flip-financeiro-pacote.md`](etapa-5-flip-financeiro-pacote.md) — fonte primária dos 7 casos (§6.2), das 2 flags (§Abertura), do desenho de mapper/CHECK (§1-2) e dos riscos/interações (§3-5) que este runbook expande passo-a-passo.
- [`docs/architecture/kora-hub-auditoria-e-plano.md`](../architecture/kora-hub-auditoria-e-plano.md) — G29 (banner desatualizado), G30 (cache de mutação), G32 (fetch paralelo é design da casa), G37 (payload de espelho incompleto + passthrough de UUID), G40 (vocabulário cloud incompleto), **G41** (os 2 diálogos de recebível, `quoteId` fechado, 4 achados de decisão de produto catalogados sem fix).
- [`docs/qa/protocolo-homologacao.md`](protocolo-homologacao.md) — §0/§6 (Code não acessa banco/localStorage do operador), §16/§17 (isolamento de worktree, prova de build por hash), §18 (merge condicionado a "vai"), §1/§2 (EXPORT MANUAL, PRINT PRÉ-CLIQUE).

---

## 1. PRÉ-FLIP — checklist do operador

### 1.1 Gate EXPORT MANUAL (protocolo §1) — antes de qualquer coisa

**Diferente de `projects`** (tabela nova, sem dado real na abertura daquele pacote): `financial_transactions` **já tem dado de produção real** — os recebíveis já homologados via `CreateReceivableDialog`/`QuoteToReceivableDialog` desde antes desta fatia (feature SUPABASE-QUOTE-RECEIVABLES). O export manual aqui não é preventivo genérico, é sobre dado que já existe e será lido de volta pela tela principal assim que a Fase C flipar. Operador exporta `financial_transactions` (e `workspaces`/`clients`/`quotes` se o procedimento padrão já incluir as tabelas relacionadas) antes de qualquer escrita nova desta fatia. Confirmação por escrito do operador ("exportei") é o gate — Code não executa isto, só verifica que a confirmação chegou antes de prosseguir pra §1.2.

### 1.2 Import assistido — reconferência, não estreia

**Diferente de `projects`** (R4 daquele pacote: import nunca homologado numa rodada B.3 de verdade). Para Financeiro, `useLocalFinanceImport.ts`/`LocalFinanceImportCard.tsx` **já rodaram uma homologação real, executada e aprovada** — `docs/qa/etapa-5-fatia-6-finance.md` §10-11, "Resultado da rodada — EXECUTADA (vai do revisor)", 5 casos (geral, quote-linked, órfão, pré-existente, idempotência), confirmado também no roadmap (`kora-roadmap.md:25`: "Import homologado (5/5)"). O que este pré-flip precisa não é provar que o import funciona — é **reconfirmar** que ele continua funcionando depois das mudanças que a Fase B introduziu/vai introduzir no mapper (payload de leitura novo, campos `category`/`payment_method` quando a migration do pacote §1.1 entrar).

**Passo a passo (operador, antes de flipar `dataSource`):**

1. Abrir Configurações → "Importar transações locais" (`LocalFinanceImportCard.tsx`).
2. Anotar a contagem de candidatos por status — **reconferência, não estimativa**:
   ```
   Local (orbyt.finance.v1, reais, não-demo): ____
   Já em kora.finance.supabaseImport.v1.importedMap: ____
   Candidatos "new" (não-demo): ____
   ```
3. Se houver algum candidato `new` que não seja demo: revisar órfãos de FK sinalizados (cliente/quote/oportunidade não vinculado) e importar.
4. Volume real do operador é **desconhecido — a confirmar com o operador** nesta etapa (Code não acessa `localStorage` do navegador do operador, protocolo §0/§6). Pergunta específica: *"quantas transações reais (não-demo) existem em `orbyt.finance.v1` hoje, e quantas já aparecem em `kora.finance.supabaseImport.v1.importedMap`?"*
5. **Prova de contagem (local vs. nuvem), antes de prosseguir** — mesma disciplina de `projects` §1.2 passo 5:
   ```sql
   -- Contagem na nuvem, workspace de QA já conhecido (§3.1)
   SELECT count(*) FROM public.financial_transactions
   WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND deleted_at IS NULL;
   ```
   Comparar contra a contagem local anotada no passo 2 — a diferença esperada é exatamente o número de candidatos `new` importados no passo 3, mais os recebíveis já criados nativamente na nuvem (via `CreateReceivableDialog`/`QuoteToReceivableDialog`, que não têm `source_local_id` de import).
6. **Decisão explícita de prosseguir** (gate, não formalidade): só depois de (a) export confirmado (§1.1), (b) nenhum candidato `new` restante ou decisão documentada de não importar algum, (c) prova de contagem batendo — a Fase C pode começar. Registrar essa decisão no relatório da sessão de flip, mesmo que a resposta seja "zero transações locais reais além das já homologadas na Fatia 6, nada a importar".

### 1.3 Gate NOVO — as 2 migrations são PRÉ-REQUISITO da Fase C (`projects` não tinha isso)

**Diferente de `projects`** (cuja Fase A/pacote não deixou nenhuma migration pendente de aplicação antes do flip dos defaults — `deliverables`/CHECK de status já tinham sido aplicados numa sessão §8-b anterior à Fase C daquele pacote): aqui a Fase B **já escreveu o código de escrita assumindo que as 2 migrations do pacote (§1.1/§2.1) existem** — `mapLocalTransactionToSupabase` (`financeMapper.ts:136-137`) já envia `category`/`payment_method` no payload de todo INSERT/UPSERT novo. **Sem as colunas, o INSERT falha** — não é uma melhoria opcional, é uma dependência dura entre código já mesclado e schema ainda não aplicado.

As 2 migrations, escritas na Fase B, **não aplicadas** (Code não roda DDL, protocolo §0/§6/§8-b):

1. `supabase/migrations/20260815000100_etapa5_flip_financeiro_add_category_payment_method.sql` — `category`/`payment_method` (colunas) + CHECK de `payment_method`.
2. `supabase/migrations/20260815000200_etapa5_flip_financeiro_type_status_known_chk.sql` — CHECK preventivo de `type`/`status` (§2.1 do pacote).

**Passo explícito do operador, ANTES do "vai" da Fase C** (a migration 2 já embute as verificações no próprio arquivo, linhas 13-16 — reproduzidas aqui para o operador não precisar abrir o SQL pra achá-las):

```sql
-- Rodar ANTES de aplicar a migration 2 (CHECK de type/status). Expectativa é
-- ZERO linha em qualquer uma das 2 — confirmar, não supor (mesma migration já
-- documenta isso, 20260815000200_...sql linhas 13-16).
SELECT DISTINCT type FROM public.financial_transactions WHERE type NOT IN ('receivable','payable');
SELECT DISTINCT status FROM public.financial_transactions WHERE status NOT IN ('pending','paid','overdue','canceled');
```

1. Aplicar a migration 1 (`..._add_category_payment_method.sql`).
2. Rodar as 2 SELECTs de verificação acima. Se qualquer uma devolver linha: **PARAR** — não aplicar a migration 2 sem decidir o que fazer com o dado fora do vocabulário primeiro (mesma trava que a própria migration já registra em comentário).
3. Se as 2 SELECTs devolverem zero linhas: aplicar a migration 2 (`..._type_status_known_chk.sql`).
4. **Confirmação por escrito do operador** ("apliquei as 2 migrations, as 2 SELECTs de verificação vieram vazias") é o gate — Code não aplica DDL, só verifica que a confirmação chegou antes de considerar a Fase C liberada para abrir.

Sem este passo, a Fase C não pode abrir — o flip do default de `dataSource` pra `supabase` exporia imediatamente o caminho de escrita nativa (Caso 2, §3.3) a um INSERT que falha em produção.

---

## 2. FASE C — flip dos defaults

### 2.1 Pré-requisito de ordem — não flipar antes do CRUD estar pronto

Mesma lição de `projects` (`etapa-5-flip-projetos-runbook.md` §2.1) e do próprio pacote de Financeiro (§Fase B/C/D, item 1): se `dataSource` flipar antes da escrita real estar pronta, todo usuário cai no `blockWrite()` que `Financeiro.tsx` tem hoje — regressão temporária desnecessária. **Confirmado contra o código real**: `blockWrite()` (`Financeiro.tsx:193-198`) **não é mais incondicional** — a Fase B (`936c762`) mudou o gate de "sempre bloqueia em modo Supabase" pra "bloqueia só se `writeEnabled` (`useSupabaseFinanceWriteFlag`) estiver OFF" (linha 195: `if (writeEnabled) return false;`). Com a flag ligada (opt-in, nasce OFF — Flag 2, §2.2), a escrita nativa já funciona hoje, mesmo antes da Fase C flipar os defaults. Ordem obrigatória:

1. **Fase B (código) — FECHADA**: `936c762` (CRUD real, `useBifurcatedFinance`, espelho de `QuoteToReceivableDialog`) + `dea8c75` (ajustes da revisão Lane E — ver notas inline nesta rodada). Nenhum item pendente de código — o que resta antes da Fase C é o gate de schema do §1.3 (migrations), que é do operador, não de código.
2. Fase C (este runbook, §2.2-§2.5) — só depois do §1.3 (migrations aplicadas e confirmadas) fechar.
3. Fase D (homologação, §3).

### 2.2 As duas flags — antes (hoje, confirmado) / depois (proposto)

**Flag 1 — `kora.finance.dataSource.v1`** (`src/config/flags.ts:124,218-219`, código real — linhas reconfirmadas nesta rodada; deslocaram de `117,211-213` porque `flags.ts` ganhou a flag `aiBrainEnabled` — Etapa 9 item 2 — entre as duas rodadas, sem relação com Financeiro):

```ts
// ANTES (Fase B item 2, hoje em produção) — só "supabase" explícito seleciona nuvem.
export function getFinanceDataSource(): DataSource {
  return safeGet(FINANCE_DATA_SOURCE_KEY) === "supabase" ? "supabase" : "local";
}
```

```ts
// DEPOIS (Fase C, proposto — mesmo padrão literal de getProjectsDataSource()/
// getQuotesDataSource() pós-flip) — só "local" explícito seleciona local.
export function getFinanceDataSource(): DataSource {
  return safeGet(FINANCE_DATA_SOURCE_KEY) === "local" ? "local" : "supabase";
}
```

**Flag 2 — `kora.finance.supabaseWrite.enabled`** (`src/hooks/useSupabaseFinanceWriteFlag.ts:27-34`, código real). **Divergência corrigida nesta rodada**: a versão anterior deste runbook citava o comentário do hook como "nasceu reservada, não usada por nenhum componente ainda" — isso descrevia só a Fatia N (leitura). A Fase B (`936c762`) mudou isso, e a própria revisão Lane E (NOTA-f, `dea8c75`) já corrigiu o comentário do hook por estar desatualizado (`useSupabaseFinanceWriteFlag.ts:11-16`): a flag hoje **tem consumidor real** — `Financeiro.tsx:193-198` (`blockWrite()`) e, por extensão, todo o CRUD de `useSupabaseFinanceTransactions.ts`:

```ts
// ANTES (Fase B item 2, hoje em produção) — opt-in, só "true" liga.
function readFlag(): boolean {
  try {
    return localStorage.getItem(FINANCE_SUPABASE_WRITE_FLAG_KEY) === "true";
  } catch {
    return false;
  }
}
```

```ts
// DEPOIS (Fase C, proposto — mesmo padrão de useSupabaseProjectsWriteFlag.ts
// pós-flip) — opt-out, só "false" desliga.
function readFlag(): boolean {
  try {
    return localStorage.getItem(FINANCE_SUPABASE_WRITE_FLAG_KEY) !== "false";
  } catch {
    return false;
  }
}
```

**As duas flipam no mesmo pacote, não em rodadas separadas** — mesmo precedente de `quotes`/`projects` ("o cutover completo decide os dois juntos"). **Correção desta rodada**: a versão anterior deste runbook dizia que a Flag 2 nasceu "sem nenhum consumidor" e que o "depois" proposto só teria efeito quando `QuoteToReceivableDialog.tsx` ganhasse o espelho — isso já não é verdade. Dois esclarecimentos, confirmados contra o código real:

1. **A Flag 2 já tem consumidor desde a Fase B** (`Financeiro.tsx:193-198`, `blockWrite()`) — não desde a Fase C. Ligar a Flag 2 manualmente hoje (antes da Fase C) já libera CRUD nativo real na tela principal — é o próprio Caso 2 (§3.3), executável agora.
2. **O espelho de `QuoteToReceivableDialog.tsx` NÃO é gateado pela Flag 2** — nem antes, nem depois do flip. Confirmado por comentário explícito no próprio código (NOTA-e, revisão Lane E, `QuoteToReceivableDialog.tsx:138-143`): o mirror é "sempre-ligado por desenho" (mesma classe de decisão do mirror de `CreateReceivableDialog.tsx`, que também nunca teve gate de flag) — completamente ortogonal à Flag 2, que gateia só a criação NATIVA sem origem local. Flipar a Flag 2 pra opt-out na Fase C não muda o comportamento do espelho em nada — ele já roda incondicionalmente desde a Fase B.

### 2.3 Rollback nível 1 — override de flag, sem deploy

Mesma garantia dos overrides de flag (precedência sobre o default — P5 do protocolo). Sem código, sem deploy, por workspace individual, via console do navegador:

```js
localStorage.setItem("kora.finance.dataSource.v1", "local");
localStorage.setItem("kora.finance.supabaseWrite.enabled", "false");
```
seguido de F5.

**O que acontece com o dado, em cada direção (mesma garantia de `projects`/`quotes`):**
- Voltando pra "Local": `orbyt.finance.v1` nunca foi tocado enquanto o workspace estava em modo Supabase (hooks correm em paralelo, só um é exibido — G32) — 100% intacto.
- Dado criado/editado em Supabase: não é apagado no revert — só para de aparecer na tela se o usuário também trocar pra "Local"; continua em `public.financial_transactions`, reaparece assim que o seletor volta pra "supabase".
- **Nenhuma direção do rollback nível 1 perde dado** — pior caso é perda de visibilidade temporária, sempre reversível.

**Nota (G29, aplicada por desenho aqui — não descoberta depois):** **Atualizado contra o código real.** A versão anterior deste runbook citava o texto de `blockWrite()` da Fatia N ("Escrita em modo Supabase ainda não existe pra Financeiro"), quando o bloqueio ainda era incondicional. A Fase B (`936c762`) já reescreveu o texto junto com a mudança de gate (`Financeiro.tsx:196`): *"Escrita em modo Supabase ainda não existe pra Financeiro — volte para \"Local\" para lançar/editar, ou ative a escrita experimental."* — honesto com o estado real de HOJE (aparece só quando `writeEnabled` é `false`, e já menciona a saída real). **Não é um fóssil G29** — não promete nada que o código não faz. Ponto de atenção que sobrevive pra Fase C: quando a Flag 2 flipar pra opt-out (default ON), a mensagem passa a aparecer só pra quem desligou a escrita explicitamente — o texto continua correto nesse cenário (ainda existe uma saída real, "ative a escrita experimental" → já vai estar ativa por padrão, mas o override existe). Nada a corrigir no texto na Fase C; só confirmar visualmente que a mensagem não aparece mais pro caminho feliz (usuário novo, sem override).

### 2.4 Rollback nível 2 — revert de código

Só se o nível 1 não for suficiente. **Baseline: `dea8c75`** — fechamento da Fase B (`936c762` — CRUD real, `useBifurcatedFinance`, espelho; `dea8c75` — ajustes da revisão Lane E por cima), confirmado por `git log origin/main -1` como o tip real no momento desta rodada. Mesmo padrão de `projects` (`d90ba47`/`b90f86a`): este é o estado "tudo pronto, defaults ainda não flipados" — o(s) commit(s) da Fase C nascem em cima dele. **O hash a reverter no nível 2 é o(s) commit(s) que a Fase C adicionar DEPOIS de `dea8c75`, nunca `dea8c75` em si** — confirmar o hash exato do commit de flip por `git log` no relatório daquela rodada, quando ela acontecer (mesma disciplina de `projects` §2.4: nunca citar de memória).

```bash
git revert <hash-do(s)-commit(s)-de-flip-da-Fase-C> --no-edit
git push origin main
```

### 2.5 Critério de acionamento do rollback

Qualquer caso do runbook de Fase D (§3) fechar **vermelho sem correção rápida** (ver critério em §4), ou relato do operador em uso real de transação sumida/duplicada — aciona nível 1 imediatamente; nível 2 só se o nível 1 não resolver.

---

## 3. FASE D — Runbook de homologação (preparação — alguns casos já executáveis hoje)

### 3.0 Prova de servidor — protocolo §17, passo 0 obrigatório

Antes de qualquer caso abaixo: declarar worktree + branch + URL do dev server, e confirmar que o app carregado exibe `[Kora] BUILD <hash> (<branch>)` no console (modo dev) batendo com o hash esperado da rodada — nunca inferir correspondência código↔servidor pelo comportamento observado (mesmo incidente de referência da Fatia 10 de `quotes`, reafirmado no runbook de `projects` §3.0: um comportamento "parecendo certo" pode ser o código ERRADO se comportando certo pelo motivo errado). Sem symlink de conveniência pro `cwd` do dev server — subir `npm run dev` direto na worktree real.

### 3.1 Papéis das entidades sintéticas e workspace já conhecido

**Diferente de `projects`** (runbook daquele pacote precisou deixar o workspace de QA como "a confirmar com o operador" — primeiro domínio a rodar esse tipo de homologação B.3 sem precedente direto): aqui o workspace **já é conhecido**, reaproveitado da própria homologação real da Fatia 6 (`etapa-5-fatia-6-finance.md` §10, executada e aprovada) — `2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9`. Não é presunção — é o mesmo workspace onde `financial_transactions` já tem dado real de produção (recebíveis homologados) e onde o código de leitura (`e7d21b7`) já foi implicitamente validado contra dado real. Ainda assim, confirmar no início da Fase D que nenhum outro workspace de QA substituiu este como padrão vigente desde a Fatia 6 (protocolo §0/§6 — Code não tem acesso a sessão autenticada pra verificar sozinho).

Entidades sintéticas (novas, prefixo `HOMOLOG-FIN-` — não reaproveitar o cliente/quote reais "fabio"/"xxx" da Fatia 6, pra não misturar dado sintético com dado real já em produção):

| Entidade sintética | Papel no runbook |
|---|---|
| `HOMOLOG-FIN-cliente` | Cliente sintético — usado no caso 6 (`ClientActivitiesTab`) |
| `HOMOLOG-FIN-quote` | Quote sintética aprovada — origem dos casos 4 (os 2 diálogos de recebível) |
| `HOMOLOG-FIN-transacao-A` | Transação criada nativa, direto na tela principal em modo Supabase — casos 1, 2, 3, 5 |
| `HOMOLOG-FIN-transacao-B` | Recebível gerado via `CreateReceivableDialog` (CRM) a partir de `HOMOLOG-FIN-quote` — caso 4 |
| `HOMOLOG-FIN-transacao-C` | Recebível gerado via `QuoteToReceivableDialog` (Vendas) a partir de `HOMOLOG-FIN-quote` — caso 4 |
| `HOMOLOG-FIN-transacao-import` | Transação criada **local**, antes do flip, pra provar o caso 7 (import pré-existente/regressão) |

### 3.2 Lições de `projects` incorporadas explicitamente (não re-derivar)

- **SELECT depois da ação, nunca antes.** Toda prova SQL deste runbook roda DEPOIS do clique/ação na UI ter sido confirmado (toast, mudança visual) — nunca antes, e nunca como suposição do que "deveria" ter acontecido. Mesma disciplina que já pegou o G30/G37 em `projects`: nos dois casos, o vermelho só apareceu porque a prova SQL rodou depois da ação e discordou da UI, que já mostrava sucesso.
- **Toast de espelho best-effort não é vermelho por si só.** Igual ao caso 5.2 de `projects` (espelho de `QuoteToProjectDialog`): quando um passo depende de `financeRepository.createReceivableFromQuote` (mirror best-effort, não escrita direta), esperar a propagação e checar o toast de falha explícito ANTES de marcar vermelho — não é o mesmo tipo de "imediato" de uma escrita direta via `updateTransaction`/`createTransaction`.
- **Drawer/cache — lição G30.** Qualquer caso que edite uma transação já aberta na tela (não só a lista) precisa confirmar que o PRÓPRIO ponto de origem da edição reflete a mudança sem fechar/reabrir ou F5 — não só o card da lista. Se a mutation usada seguir o padrão invalidate-only, reproduz o G30 (drawer/linha presos no valor antigo).
- **`workspace_id` do operador já conhecido — não perguntar de novo.** Ver §3.1: `2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9`, já usado e confirmado por `projects`... não, por Financeiro na própria Fatia 6. Toda prova SQL abaixo já cita esse id diretamente, sem placeholder `<workspace_id>`.

### 3.3 Os 7 casos

Esqueleto herdado de `etapa-5-flip-financeiro-pacote.md` §6.2, expandido aqui passo-a-passo. Print pré-clique obrigatório (protocolo §2) em todo passo que grava na nuvem. **Fase B fechada (`dea8c75`) — todos os 8 casos abaixo já são executáveis no código de hoje**, com uma ressalva única: os Casos 2/2.3/7 (que gravam `category`/`payment_method` ou dependem do CHECK) só rodam depois do gate do §1.3 (as 2 migrations aplicadas pelo operador) — sem isso, o passo de escrita falha por coluna inexistente, não por bug de código.

---

**Caso 1 — Leitura em modo Supabase** — código pronto desde a fatia de leitura (`e7d21b7`), reconfirmado com Fase B fechada (`936c762`/`dea8c75`)

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 1.1 | Console: `localStorage.setItem("kora.finance.dataSource.v1", "supabase");` → F5, abrir Financeiro.tsx | Seletor mostra "Supabase"; painel de leitura separado aparece (`SupabaseTransactionsPanel`, `Financeiro.tsx:313-320`, alimentado por `useSupabaseFinanceTransactions()` desestruturado em `:173-178`) — linha reconfirmada nesta rodada, deslocou de `344` (citação antiga) por causa do CRUD que a Fase B acrescentou ao arquivo | Visual |
| 1.2 | — | Painel mostra as transações já reais do workspace (recebíveis homologados na Fatia 6), sem duplicar as locais equivalentes | Visual — comparar contagem do painel com `SELECT count(*) FROM public.financial_transactions WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND deleted_at IS NULL;` |
| 1.3 | Conferir os campos sem coluna cloud (§Caso 5) | `category` aparece como `"Sem categoria (nuvem)"`, `paymentMethod` como `"other"`, nunca um valor inventado — mesmo comportamento documentado em `mapSupabaseTransactionToLocal` (`financeMapper.ts:200,209-210`) | Visual — nenhuma categoria real "adivinhada" |

---

**Caso 2 — Escrita nativa + prova obrigatória do equivalente-O12** — código pronto (`936c762`); execução real depende do gate do §1.3 (migrations aplicadas)

**Mecanismo real, confirmado contra `main`**: "Venda rápida"/"Lançar despesa" (`Financeiro.tsx:246-249`, atrás de `blockWrite()`) chamam `createSupabaseTransaction` → `useSupabaseFinanceTransactions.ts:59-79` (`createMutation`) — reaproveita `financeRepository.importTransaction` com `buildNativeSourceLocalId()`, mesmo precedente de criação nativa de `projects`/`quotes` (nenhuma função nova no repository).

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 2.0 | **Pré-condição**: confirmar que o §1.3 já fechou (as 2 migrations aplicadas, SELECTs de verificação vazias) | Colunas `category`/`payment_method` existem, CHECK de `type`/`status` ativo | `SELECT column_name FROM information_schema.columns WHERE table_name='financial_transactions' AND column_name IN ('category','payment_method');` → 2 linhas |
| 2.1 | Ligar `kora.finance.supabaseWrite.enabled` (Flag 2, §2.2) → criar transação manual `HOMOLOG-FIN-transacao-A` pela tela, em modo Supabase (`source='manual'`) | Toast de sucesso, aparece no painel sem reload (`createMutation.onSuccess`, `useSupabaseFinanceTransactions.ts:73-78`, escreve direto no cache) | Visual |
| 2.2 | — (SELECT depois da ação, §3.2) | Linha existe na nuvem com `category`/`payment_method` preenchidos | `SELECT title, category, payment_method, type, status FROM public.financial_transactions WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND title = 'HOMOLOG-FIN-transacao-A';` → 1 linha |
| **2.3** | **Prova obrigatória do equivalente-O12 — não pode fechar como "assumido correto"** (lição G40, pacote §2.1) | Tentar gravar um valor FORA do vocabulário direto por SQL, contornando a UI | `UPDATE public.financial_transactions SET status = 'valor-invalido' WHERE title = 'HOMOLOG-FIN-transacao-A';` → **DEVE FALHAR** com violação de `financial_transactions_status_known_chk` (migration `20260815000200_etapa5_flip_financeiro_type_status_known_chk.sql`) |

**O passo 2.3 é vermelho automático se o UPDATE inválido NÃO falhar** — mesma classe do Caso 4.6 (O12) de `projects`: é literalmente a prova de que o CHECK preventivo desenhado no pacote foi de fato aplicado, não só desenhado. Diferente de `projects` (onde o CHECK era reativo a um problema já observado), aqui o risco é o oposto — não confirmar que uma migration proposta em doc realmente virou constraint em produção antes de assumir que o "equivalente-O12 resolvido por desenho" (pacote §2.1) é verdade.

---

**Caso 3 — Edição real refletida na própria mutação (G30)** — código pronto (`936c762`)

**Mecanismo real, confirmado contra `main` — o G30 foi aplicado por desenho, não precisou de fix reativo aqui**: `SupabaseTransactionsPanel` (`Financeiro.tsx:391-401`) → `setStatus` (`:402-409`) → `onUpdate` → `updateSupabaseTransaction` → `useSupabaseFinanceTransactions.ts:84-93` (`updateMutation`), cujo `onSuccess` chama `queryClient.setQueryData` com a linha devolvida pelo próprio `UPDATE` (`:87-92`) — nunca só `invalidateQueries()`. UI: dropdown "Marcar como recebido"/"Marcar como pago" na linha da transação (`Financeiro.tsx:478`).

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 3.1 | Ligar Flag 2 → em modo Supabase, no painel `SupabaseTransactionsPanel`, marcar `HOMOLOG-FIN-transacao-A` como "paga" (dropdown da própria linha, `Financeiro.tsx:478`) | **O próprio card da linha** reflete "paga" sem F5 — o `setQueryData` (`useSupabaseFinanceTransactions.ts:88-92`) atualiza a linha certa no array do cache, sem esperar refetch (lição G30, §3.2) | Visual — badge de status muda na mesma linha, sem reload |
| 3.2 | — | Update gravado de verdade | `SELECT status, paid_at FROM public.financial_transactions WHERE title = 'HOMOLOG-FIN-transacao-A';` → `status = 'paid'`. **`paid_at` fica `NULL`** — confirmado por leitura de código, não é vermelho: `setStatus` (`Financeiro.tsx:402-403`) monta o patch só com `{ status }`, nenhuma linha do código grava `paid_at`, e não há trigger de banco pra isso (`financial_transactions.paid_at`, coluna simples desde `20260601020000_create_financial_transactions_schema.sql:16`, sem default/trigger). Não é escopo do Caso 3 (G30 — prova de cache, não de completude de campo) corrigir isso; registrado aqui pra não ser mal-lido como falha do UPDATE quando a Fase D rodar de verdade. Candidato a achado catalogável (`paid_at` nunca preenchido pelo caminho nativo de marcar-pago) se confirmado ao vivo — mesmo ID reservado do §4 (G43), a confirmar se ainda livre na hora. |

Este caso já teve a prova empírica de que o padrão `setQueryData` (não invalidate-only) foi aplicado desde o desenho — não há fix a reproduzir aqui, só confirmar visualmente que o comportamento bate com o código lido acima.

---

**Caso 4 — Consistência cruzada, os 2 diálogos de recebível** — código pronto (`936c762`), os 2 diálogos têm espelho agora

**Mecanismo real, confirmado contra `main`**: `QuoteToReceivableDialog.tsx` ganhou o espelho G22 na Fase B — `mirrorReceivableToSupabase` (`QuoteToReceivableDialog.tsx:144-166`), chamada logo após o `addTransaction` local (linha 114). **Divergência importante entre os 2 mirrors, confirmada por leitura de código — os SELECTs de prova abaixo refletem isso, não esperam o que não viaja**:

| Campo | Mirror de `CreateReceivableDialog.tsx` (`:112-120`) | Mirror de `QuoteToReceivableDialog.tsx` (`:146-159`) |
|---|---|---|
| `category`/`payment_method` | **NÃO envia** — `category`/`paymentMethod` são hardcoded só no lançamento LOCAL (`:95,100`), nunca chegam no payload do mirror (achado de decisão de produto do G41, não corrigido) | **Envia** — usuário escolhe na tela, `category`/`payment_method` fazem parte do payload (`:158-159`) |
| `quote_id` | Envia (`:113`) | Envia (`:147`) |
| `client_id`/`opportunity_id` | Envia direto (`:114-115`, já uuid de nuvem — não passa por `resolveFinanceFk`) | Envia via `resolveFinanceFk` (`:148-149`, passthrough de UUID G37 por desenho) |
| `notes`/`recurrence`/`supplierId`/`cashAccountId` | Nenhum dos 2 mirrors envia — 4 campos sem coluna cloud (pacote §1.2, AJUSTE-a da revisão Lane E) |

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 4.1 | Setup | Criar `HOMOLOG-FIN-quote` (aprovada), vinculada a um cliente sintético | Quote existe (local ou nuvem, conforme o modo do domínio `quotes` no momento) | Visual |
| 4.2 | **`CreateReceivableDialog.tsx`** (CRM, atrás de `kora.quotes.supabaseCreateReceivable.enabled`) — gerar `HOMOLOG-FIN-transacao-B` a partir de `HOMOLOG-FIN-quote` | Grava local (`fin.addTransaction`, `:90-103`, **já com `quoteId` desde o fix G41**, linha 97) **e** dispara o espelho best-effort (`createReceivableFromQuote`, `:112-120`) — **toast de espelho best-effort não é vermelho** (§3.2): esperar propagação antes de marcar vermelho | Visual (local imediato) + `SELECT quote_id, source, category, payment_method FROM public.financial_transactions WHERE title = 'HOMOLOG-FIN-transacao-B';` → `quote_id` preenchido (confirma G41), `source = 'quote'`, **`category`/`payment_method` NULL** (não viajam neste mirror — não é vermelho, ver tabela acima) |
| 4.3 | **`QuoteToReceivableDialog.tsx`** (Vendas) — gerar `HOMOLOG-FIN-transacao-C` a partir da MESMA `HOMOLOG-FIN-quote`, escolhendo categoria/forma de pagamento na tela | Grava local (`:92-109`) **e** dispara o espelho (`mirrorReceivableToSupabase`, `:144-166`) — mesmo aviso de best-effort do 4.2 | Visual (local imediato) + `SELECT quote_id, source, category, payment_method FROM public.financial_transactions WHERE title = 'HOMOLOG-FIN-transacao-C';` → `quote_id` preenchido, `source = 'quote'`, **`category`/`payment_method` preenchidos com o que foi escolhido na tela** (diferente do 4.2 — ver tabela acima) |

**Nota — achados de decisão de produto do G41 não são escopo deste caso**: `clientId`/`opportunityId`/`clientName` (formato) e agora explicitamente `category`/`payment_method` (presença) divergem entre os 2 diálogos por decisão de produto documentada (G41), não por bug — não vira vermelho aqui, ver `kora-hub-auditoria-e-plano.md` G41 pra detalhe completo.

---

**Caso 5 — Campos pós-flip (§1.2 do pacote, agora 4 — não 3) não bloqueiam nem perdem silenciosamente**

**Divergência corrigida nesta rodada**: a versão anterior deste runbook citava 3 campos (fornecedor/conta-caixa/recorrência). A revisão Lane E (AJUSTE-a, `dea8c75`) adicionou um 4º: `notes` nunca teve coluna cloud nem foi fundido em `description` (um comentário do mapper afirmava essa fusão por engano — corrigido). `mapLocalTransactionToSupabase`/`mapSupabaseTransactionToLocal` (`financeMapper.ts:112-119,199-205`) documentam os 4 juntos: `recurrence`/`supplierId`/`cashAccountId`/`notes`, todos "reportar, não inventar" — `recurrence` vira o membro neutro (`"none"`), os 3 restantes ficam `undefined`.

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 5.1 | Em modo Supabase, tentar usar fornecedor/conta-caixa/recorrência/observações (`notes`) em `HOMOLOG-FIN-transacao-A` | Aviso explícito aparece (UX final decidida na Fase B), transação salva mesmo assim — nunca bloqueia, nunca perde silenciosamente | Visual — aviso + transação continua editável |
| 5.2 | — | Nenhuma coluna cloud recebe esses 4 campos (não existem, decisão pós-flip do pacote §1.2) | `SELECT * FROM public.financial_transactions WHERE title = 'HOMOLOG-FIN-transacao-A';` → sem colunas `supplier_id`/`cash_account_id`/`recurrence`/`notes` |

---

**Caso 6 — `ClientActivitiesTab.tsx` com os 2 domínios bifurcados** — código pronto (`936c762`)

**Mecanismo real, confirmado contra `main`**: `useBifurcatedFinance()` (`src/hooks/useBifurcatedFinance.ts` — molde simplificado de `useBifurcatedProjects.ts`, só escolhe entre as 2 fontes já prontas, sem mapear nada — `useSupabaseFinanceTransactions` já devolve `Transaction[]` pronto) consumido em `ClientActivitiesTab.tsx:19,445` e também em `ClientProfileDrawer.tsx:46,965` e `useDayCenterData.ts:6,33` (os 3 consumidores classe (a) do inventário — Central do Dia incluída, não só a ficha do cliente). Achado adicional confirmado no commit da Fase B (`936c762`, mensagem): a leitura bifurcada em `ClientActivitiesTab.tsx` resolve *de graça* o gap do G41 ("recebível do CRM invisível na ficha do cliente" — antes só lia local, agora lê a fonte certa conforme o seletor).

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 6.1 | Abrir ficha de `HOMOLOG-FIN-cliente` → aba Atividades, com projetos E finanças desse cliente em modo Supabase | Timeline mostra eventos de projeto (já bifurcado, herdado de `projects`) E de finanças (bifurcado nesta fatia) corretamente — tasks (ainda cru) sem regressão visível | Visual |
| 6.2 | — | Confirma que o arquivo acumula 2 domínios bifurcados + 1 cru (tasks), não mais 1+2 (achado do pacote §3.2) | Leitura de código — `useBifurcatedFinance()` presente em `ClientActivitiesTab.tsx:19,445` |
| 6.3 | Recebível gerado via `CreateReceivableDialog` (CRM, Caso 4.2) por um cliente com `client_id` real (diferente do cenário do G41, onde a quote de teste não tinha cliente vinculado) | Aparece na timeline de atividades desse cliente em modo Supabase — prova viva de que a leitura bifurcada fecha o gap do G41 sem precisar de fix dedicado | Visual — evento na aba Atividades |

---

**Caso 7 — Regressão do import (Fatia 6 já homologada)** — código pronto; execução real depende do gate do §1.3 (migrations)

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 7.0 | **Pré-condição**: §1.3 fechado (migrations aplicadas) — sem a coluna `category`/`payment_method`, o import geral (`importTransaction`, mesmo caminho de escrita do Caso 2) falha do mesmo jeito | — | — |
| 7.1 | **Antes** deste caso, garantir que `HOMOLOG-FIN-transacao-import` foi criada em modo **local** (dataSource=local) numa sessão anterior ao flip | Transação existe só em `orbyt.finance.v1` | `SELECT count(*) FROM public.financial_transactions WHERE title = 'HOMOLOG-FIN-transacao-import';` → 0 |
| 7.2 | Configurações → "Importar transações locais" → localizar como candidato `new` → importar | Import bem-sucedido, incluindo `category`/`payment_method` no payload (`mapLocalTransactionToSupabase`, `financeMapper.ts:136-137`) | Visual — toast |
| 7.3 | Voltar pra modo Supabase | Transação aparece, **sem duplicar** | `SELECT count(*) FROM public.financial_transactions WHERE title = 'HOMOLOG-FIN-transacao-import';` → 1 |

Este caso é a **reconfirmação** formal de `useLocalFinanceImport.ts` pós-mudanças (§1.2 acima) — não a primeira homologação (essa já aconteceu na Fatia 6).

---

**Caso 8 — Limpeza**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 8.1 | Soft-delete/arquivar todas as transações sintéticas (`HOMOLOG-FIN-transacao-A/B/C/import`), remover quote/cliente sintéticos, limpar chaves de `localStorage` setadas manualmente | Estado volta a "usuário novo" | — |
| 8.2 | — | Resíduo zero | `SELECT count(*) FROM public.financial_transactions WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND title LIKE 'HOMOLOG-FIN-%' AND deleted_at IS NULL;` → 0 |

---

## 4. Critérios de vermelho vs. ressalva vs. achado

Mesmo critério operacional do precedente de `projects`/`quotes` (fixado em texto explícito pra não precisar re-derivar):

- **Vermelho (para a homologação):** o comportamento **observado ao vivo diverge do comportamento desenhado/documentado**. Aciona o ciclo: diagnóstico → correção → novo commit → **PARADO** → aguardar novo "vai" antes de retomar o runbook do ponto onde parou. **O Caso 2.3 (prova do equivalente-O12) é vermelho automático se o UPDATE inválido não falhar** — é a prova de que o CHECK preventivo desenhado no pacote (§2.1) foi de fato aplicado em produção, não uma formalidade a assumir correta.
- **Ressalva (não bloqueia):** o mecanismo já está provado correto por outra via (teste automatizado + homologação ao vivo anterior — ex.: a mecânica de import geral, já coberta pela Fatia 6) e só uma recaptura específica não foi refeita nesta rodada. Decisão de não reabrir deve ser **registrada explicitamente**: *"Decisão: não reabrir/reexecutar esse sub-passo agora — [motivo]; registrado explicitamente pra não ficar implícito."*
- **Achado catalogado, não é bug:** algo encontrado durante a homologação que não afeta o caminho testado — registra no catálogo mestre (`kora-hub-auditoria-e-plano.md`, próximo ID livre no momento da rodada — G43 reservado nesta preparação, **confirmado ainda livre nesta rodada** (catálogo hoje vai até G49, mas G43/G45/G50 nunca foram usados — reconfirmar de novo quando a Fase D executar de verdade, não assumir que continua livre só por esta checagem).
- **Placar de fechamento:** formato herdado — `N/N casos verdes, com o Caso 2.3 obrigatoriamente incluindo prova SQL do equivalente-O12 — não pode fechar como "assumido correto"`.

---

## 5. O que este doc NÃO faz

- Não executa nenhum caso — é preparação, mesmo com a Fase B fechada (`dea8c75`). Todos os 8 casos são executáveis no código de hoje, alguns condicionados ao gate de schema do §1.3 (migrations aplicadas pelo operador).
- Não aplica as migrations do §1.3 nem confirma que foram aplicadas — isso é ação do operador, registrada em texto explícito nesta rodada por ser um gate NOVO que `projects` não teve.
- Não cita o hash do commit de flip da Fase C — não existe ainda; §2.4 registra a baseline como `dea8c75` (fechamento da Fase B, confirmado), não como o commit a reverter.
- Não substitui os gates permanentes do protocolo (EXPORT MANUAL, PRINT PRÉ-CLIQUE, prova de servidor §17) — só aponta onde cada um entra nesta fatia especificamente.
- Não reabre nenhuma das 4 divergências de produto catalogadas em G41 (`clientId`/`opportunityId`/`clientName`/`category`/`paymentMethod` hardcoded em `CreateReceivableDialog`) — ficam como estão, fora de escopo deste runbook.

**PARADO aqui — este runbook segue sendo preparação, mesmo com a Fase B fechada. Execução real da Fase C (flip) e Fase D (homologação) só com um novo "vai" que autorize especificamente abrir a Fase C — e só depois do gate do §1.3 (as 2 migrations aplicadas pelo operador, com confirmação por escrito) fechar.**
