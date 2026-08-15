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

---

## 2. FASE C — flip dos defaults

### 2.1 Pré-requisito de ordem — não flipar antes do CRUD estar pronto

Mesma lição de `projects` (`etapa-5-flip-projetos-runbook.md` §2.1) e do próprio pacote de Financeiro (§Fase B/C/D, item 1): se `dataSource` flipar antes da escrita real estar pronta, todo usuário cai no `blockWrite()` incondicional que `Financeiro.tsx` já tem hoje (linha 168-172, bloqueia qualquer criação em modo Supabase, independente de flag) — regressão temporária desnecessária. **A fatia da Fase B já mesclada (`e7d21b7`) é só leitura** — não muda esse cálculo: `blockWrite()` continua incondicional até a escrita real chegar. Ordem obrigatória:

1. Fase B (código) — **item 2 (leitura) confirmado mesclado**: `e7d21b7`. **Itens restantes `[completar pós-B]`**: migrations do pacote §1.1 (`category`/`payment_method` + CHECK) e §2.1 (CHECK de `type`/`status`), `updateTransaction`/`createTransaction` no repository (pacote §2.5), `QuoteToReceivableDialog.tsx` ganhando o espelho G22 (pacote §5.1 — G41 confirmou que isso **ainda não existe**, só o fix mecânico de `quoteId` local foi feito).
2. Fase C (este runbook, §2.2-§2.5) — só depois do item 1 fechar por completo, não só a fatia de leitura.
3. Fase D (homologação, §3).

### 2.2 As duas flags — antes (hoje, confirmado) / depois (proposto)

**Flag 1 — `kora.finance.dataSource.v1`** (`src/config/flags.ts:117,211-213`, código real, já mesclado em `e7d21b7`):

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

**Flag 2 — `kora.finance.supabaseWrite.enabled`** (`src/hooks/useSupabaseFinanceWriteFlag.ts:25-32`, código real, já mesclado — nasceu reservada, "não usada por nenhum componente ainda", comentário do próprio hook, linhas 10-14):

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

**As duas flipam no mesmo pacote, não em rodadas separadas** — mesmo precedente de `quotes`/`projects` ("o cutover completo decide os dois juntos"). Diferente de `projects`, aqui a Flag 2 nasceu **sem nenhum consumidor** (nenhum espelho/mirror usa `isSupabaseFinanceWriteEnabled()` ainda) — o "depois" proposto acima só passa a ter efeito observável quando `QuoteToReceivableDialog.tsx` ganhar o espelho G22 (`[completar pós-B]`, pacote §5.1). Até lá, flipar a Flag 2 sozinha não muda nenhum comportamento visível — confirmar isso explicitamente no relatório da Fase C, pra não ser lido como "a flag não fez nada, bug" quando na verdade é "a flag ainda não tem consumidor".

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

**Nota (G29, aplicada por desenho aqui — não descoberta depois):** `Financeiro.tsx` já nasceu (`e7d21b7`) com o texto do `blockWrite()` (linha 170) honesto desde o dia 1 — "Escrita em modo Supabase ainda não existe pra Financeiro" — nunca prometendo uma escrita que não existe. Quando a Fase C ligar a escrita real, este texto **precisa mudar** ou desaparecer (o botão para de bloquear) — se sobreviver depois da escrita real funcionar, é o mesmo vermelho que `projects` teve no G29 (banner fóssil). Marcar isso explicitamente na checklist da Fase C, não deixar implícito.

### 2.4 Rollback nível 2 — revert de código

Só se o nível 1 não for suficiente. **Baseline `[completar pós-B]`**: ao contrário de `projects` (onde `d90ba47` já era um merge único fechando toda a Fase B), Financeiro está mesclando em fatias — `e7d21b7` é só a fatia de leitura, não a baseline completa "tudo pronto, defaults ainda não flipados". O hash de referência correto só existe quando o ÚLTIMO commit da Fase B (migrations + escrita real + espelho de `QuoteToReceivableDialog`) mesclar — esse hash substitui este placeholder na próxima rodada, confirmado por `git log` como ancestral de `main` no momento em que a Fase C for de fato aberta (mesma disciplina de `projects` §2.4: nunca citar de memória).

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

Esqueleto herdado de `etapa-5-flip-financeiro-pacote.md` §6.2, expandido aqui passo-a-passo. Print pré-clique obrigatório (protocolo §2) em todo passo que grava na nuvem. Cada caso indica se já é executável com o código mesclado hoje (`e7d21b7`) ou depende do restante da Fase B (`[completar pós-B]`).

---

**Caso 1 — Leitura em modo Supabase** — **já executável hoje** (código de leitura mesclado, `e7d21b7`)

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 1.1 | Console: `localStorage.setItem("kora.finance.dataSource.v1", "supabase");` → F5, abrir Financeiro.tsx | Seletor mostra "Supabase (leitura)"; painel de leitura separado aparece (`useSupabaseFinanceTransactions`, `Financeiro.tsx:344`) | Visual |
| 1.2 | — | Painel mostra as transações já reais do workspace (recebíveis homologados na Fatia 6), sem duplicar as locais equivalentes | Visual — comparar contagem do painel com `SELECT count(*) FROM public.financial_transactions WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND deleted_at IS NULL;` |
| 1.3 | Conferir os campos sem coluna cloud (§Caso 5) | `category` aparece como `"Sem categoria (nuvem)"`, `paymentMethod` como `"other"`, nunca um valor inventado — mesmo comportamento documentado em `mapSupabaseTransactionToLocal` (`financeMapper.ts:200,209-210`) | Visual — nenhuma categoria real "adivinhada" |

---

**Caso 2 — Escrita nativa + prova obrigatória do equivalente-O12** `[completar pós-B — updateTransaction/createTransaction + migrations §1.1/§2.1 do pacote]`

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 2.1 | Criar transação manual `HOMOLOG-FIN-transacao-A` pela tela, em modo Supabase (`source='manual'`) | Toast de sucesso, aparece no painel sem reload | Visual |
| 2.2 | — (SELECT depois da ação, §3.2) | Linha existe na nuvem com `category`/`payment_method` preenchidos (pós-migration §1.1 do pacote) | `SELECT title, category, payment_method, type, status FROM public.financial_transactions WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND title = 'HOMOLOG-FIN-transacao-A';` → 1 linha |
| **2.3** | **Prova obrigatória do equivalente-O12 — não pode fechar como "assumido correto"** (lição G40, pacote §2.1) | Tentar gravar um valor FORA do vocabulário direto por SQL, contornando a UI | `UPDATE public.financial_transactions SET status = 'valor-invalido' WHERE title = 'HOMOLOG-FIN-transacao-A';` → **DEVE FALHAR** com violação de `financial_transactions_status_known_chk` (ou constraint equivalente aplicada na migration do pacote §2.1) |

**O passo 2.3 é vermelho automático se o UPDATE inválido NÃO falhar** — mesma classe do Caso 4.6 (O12) de `projects`: é literalmente a prova de que o CHECK preventivo desenhado no pacote foi de fato aplicado, não só desenhado. Diferente de `projects` (onde o CHECK era reativo a um problema já observado), aqui o risco é o oposto — não confirmar que uma migration proposta em doc realmente virou constraint em produção antes de assumir que o "equivalente-O12 resolvido por desenho" (pacote §2.1) é verdade.

---

**Caso 3 — Edição real refletida na própria mutação (G30)** `[completar pós-B — updateTransaction]`

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 3.1 | Com `HOMOLOG-FIN-transacao-A` aberta (drawer/detalhe, se a UI tiver um; senão, direto na linha da lista), marcar como "paga" | **O próprio ponto de origem da edição** reflete "paga" sem fechar/reabrir ou F5 (lição G30, §3.2) — não basta o card da lista atualizar | Visual — mudança aparece no MESMO lugar que disparou a ação |
| 3.2 | — | Update gravado de verdade | `SELECT status, paid_at FROM public.financial_transactions WHERE title = 'HOMOLOG-FIN-transacao-A';` → `status = 'paid'`, `paid_at` preenchido |

Se a mutation usada seguir o padrão invalidate-only (só `invalidateQueries()`, sem escrever a resposta do próprio `UPDATE` no cache), este caso reproduz o G30 e deve usar o mesmo fix (`setQueryData` com a linha devolvida pelo `.select().single()`).

---

**Caso 4 — Consistência cruzada, os 2 diálogos de recebível** `[parcialmente executável — quoteId já fechado por G41; espelho de QuoteToReceivableDialog completar pós-B]`

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 4.1 | Setup | Criar `HOMOLOG-FIN-quote` (aprovada), vinculada a um cliente sintético | Quote existe (local ou nuvem, conforme o modo do domínio `quotes` no momento) | Visual |
| 4.2 | **`CreateReceivableDialog.tsx`** (CRM, atrás de `kora.quotes.supabaseCreateReceivable.enabled`) — gerar `HOMOLOG-FIN-transacao-B` a partir de `HOMOLOG-FIN-quote` | Grava local (`fin.addTransaction`, `CreateReceivableDialog.tsx:90-104`, **já com `quoteId` desde o fix G41**, linha 97) **e** dispara o espelho best-effort (`createReceivableFromQuote`, linha 112-113) — **toast de espelho best-effort não é vermelho** (§3.2): esperar propagação antes de marcar vermelho | Visual (local imediato) + `SELECT quote_id, source FROM public.financial_transactions WHERE title = 'HOMOLOG-FIN-transacao-B';` → `quote_id` preenchido (confirma G41), `source = 'quote'` |
| 4.3 | **`QuoteToReceivableDialog.tsx`** (Vendas) — gerar `HOMOLOG-FIN-transacao-C` a partir da MESMA `HOMOLOG-FIN-quote` | Grava local (`fin.addTransaction`, `QuoteToReceivableDialog.tsx:87-104`, já inclui `quoteId`/`category`/`paymentMethod` selecionados pelo usuário, linhas 92-100) — **espelho nuvem ainda NÃO existe** (`[completar pós-B]`, pacote §5.1) | Aparece local; **NÃO aparece na nuvem ainda** — comportamento esperado até o espelho ser implementado, não é vermelho | Visual (local) + `SELECT count(*) FROM public.financial_transactions WHERE title = 'HOMOLOG-FIN-transacao-C';` → **0**, esperado nesta rodada |
| 4.4 | Reexecutar 4.3 **depois** do espelho de `QuoteToReceivableDialog` mesclar (`[completar pós-B]`) | Mesmo resultado de 4.2 — `HOMOLOG-FIN-transacao-C` aparece na nuvem, mesmo padrão G22 | `SELECT quote_id, source FROM public.financial_transactions WHERE title = 'HOMOLOG-FIN-transacao-C';` → 1 linha |

**Nota — achados de decisão de produto do G41 não são escopo deste caso**: `clientId`/`opportunityId`/`clientName`/`category`/`paymentMethod` divergem entre os 2 diálogos por decisão de produto documentada (G41), não por bug — não vira vermelho aqui, ver `kora-hub-auditoria-e-plano.md` G41 pra detalhe completo.

---

**Caso 5 — Campos pós-flip (§1.2 do pacote) não bloqueiam nem perdem silenciosamente**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 5.1 | Em modo Supabase, tentar usar fornecedor/conta-caixa/recorrência em `HOMOLOG-FIN-transacao-A` | Aviso explícito aparece (UX final decidida na Fase B), transação salva mesmo assim — nunca bloqueia, nunca perde silenciosamente | Visual — aviso + transação continua editável |
| 5.2 | — | Nenhuma coluna cloud recebe esses 3 campos (não existem, decisão pós-flip do pacote §1.2) | `SELECT * FROM public.financial_transactions WHERE title = 'HOMOLOG-FIN-transacao-A';` → sem colunas `supplier_id`/`cash_account_id`/`recurrence` |

---

**Caso 6 — `ClientActivitiesTab.tsx` com os 2 domínios bifurcados** `[completar pós-B — useBifurcatedFinance ainda não existe]`

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 6.1 | Abrir ficha de `HOMOLOG-FIN-cliente` → aba Atividades, com projetos E finanças desse cliente em modo Supabase | Timeline mostra eventos de projeto (já bifurcado, herdado de `projects`) E de finanças (bifurcado nesta fatia) corretamente — tasks (ainda cru) sem regressão visível | Visual |
| 6.2 | — | Confirma que o arquivo acumula 2 domínios bifurcados + 1 cru (tasks), não mais 1+2 (achado do pacote §3.2) | Leitura de código — `useBifurcatedFinance()` presente em `ClientActivitiesTab.tsx` |

---

**Caso 7 — Regressão do import (Fatia 6 já homologada)**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 7.1 | **Antes** deste caso, garantir que `HOMOLOG-FIN-transacao-import` foi criada em modo **local** (dataSource=local) numa sessão anterior ao flip | Transação existe só em `orbyt.finance.v1` | `SELECT count(*) FROM public.financial_transactions WHERE title = 'HOMOLOG-FIN-transacao-import';` → 0 |
| 7.2 | Configurações → "Importar transações locais" → localizar como candidato `new` → importar | Import bem-sucedido, incluindo os campos novos (`category`/`payment_method`, pós-migration) no payload | Visual — toast |
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
- **Achado catalogado, não é bug:** algo encontrado durante a homologação que não afeta o caminho testado — registra no catálogo mestre (`kora-hub-auditoria-e-plano.md`, próximo ID livre no momento da rodada — G43 reservado nesta preparação, a confirmar se ainda está livre quando a Fase D executar de verdade).
- **Placar de fechamento:** formato herdado — `N/N casos verdes, com o Caso 2.3 obrigatoriamente incluindo prova SQL do equivalente-O12 — não pode fechar como "assumido correto"`.

---

## 5. O que este doc NÃO faz

- Não executa nenhum caso — é preparação. Caso 1 é o único genuinamente executável com o código de hoje (`e7d21b7`); os demais dependem do restante da Fase B.
- Não decide se/quando o restante da Fase B (migrations, escrita real, espelho de `QuoteToReceivableDialog`) mescla — isso é rodada própria da Lane A, com "vai" próprio.
- Não cita o hash do commit de flip da Fase C — não existe ainda; §2.4 registra a baseline como `[completar pós-B]` explicitamente, não como um hash a inventar.
- Não substitui os gates permanentes do protocolo (EXPORT MANUAL, PRINT PRÉ-CLIQUE, prova de servidor §17) — só aponta onde cada um entra nesta fatia especificamente.
- Não reabre nenhuma das 4 divergências de produto catalogadas em G41 (`clientId`/`opportunityId`/`clientName`/`category`/`paymentMethod` hardcoded em `CreateReceivableDialog`) — ficam como estão, fora de escopo deste runbook.

**PARADO aqui — este runbook segue sendo preparação. Execução real da Fase C (flip) e Fase D (homologação) só com um novo "vai" que autorize especificamente abrir a Fase C — e só depois do restante da Fase B (§2.1) mesclar.**
