# Etapa 5 · G1/Tarefas · Pacote do Flip — Runbook das Fases C/D (esqueleto)

> **Escopo desta rodada: doc-only, zero código.** Este doc NÃO executa nada —
> é um **esqueleto**, não o runbook fechado (diferente do estado em que
> [`etapa-5-flip-financeiro-runbook.md`](etapa-5-flip-financeiro-runbook.md)
> está hoje, já com Fase B fechada e casos resolvidos contra código real).
> Mesmo molde daquele doc (estrutura, formato de caso, critério de
> vermelho/ressalva), adaptado ao que
> [`etapa-5-flip-tarefas-pacote.md`](etapa-5-flip-tarefas-pacote.md) já
> desenhou — **nasce ANTES de B4/B5 mesclarem**, por instrução explícita
> desta rodada (o próprio pacote, §7.2, linha B6, já antecipa e pede pra
> checar se este arquivo existe antes de criar; ele não existia).
>
> **Convenção de placeholder, mesmo precedente do runbook de Financeiro**:
> todo trecho que depender de código que só B4 (bifurcação dos 8
> consumidores) ou B5 (escrita nativa em `Tarefas.tsx`) vão escrever está
> marcado `[completar pós-B]` — a ser resolvido numa rodada seguinte,
> contra o merge real, exatamente como aquele runbook nasceu com
> placeholders e teve todos resolvidos numa "Atualização (rodada
> seguinte) — Fase B FECHADA".
>
> **Estado da Fase B no momento desta rodada** (`git log origin/main`,
> ver Abertura): B1 (as 5 migrations, §1 abaixo) já mesclou
> (`696a589`). B2/B3 (`tasksRepository.listTasks`,
> `useBifurcatedTasks`/`useSupabaseTasksAll`) aparecem em voo no disco
> local de outras lanes (confirmado por leitura direta de
> `tasksRepository.ts`, que já tem `listTasks(workspaceId)` — comentário
> cita "G53, fundações de Fase B" — e de `ProjectsSection.test.tsx`, que
> já importa `useBifurcatedTasks`), mas **nenhum dos dois hashes foi
> confirmado em `origin/main` nesta rodada** — não citar hash de B2/B3
> aqui sem reconfirmar por `git log origin/main` na hora de fechar os
> placeholders. B4 (8 consumidores) e B5 (escrita nativa) **não
> mesclados** — é o que justifica a maioria dos `[completar pós-B]`
> abaixo.

## Abertura (§16/§17)

- Worktree: `orbit-designer-hub-qualidade-lint` (confirmado isolado via
  `git worktree list` — 5 worktrees ativos, nenhuma colisão de path/branch
  nesta abertura: `Kora-laneA` em `etapa-5-vendas-quotetoproject-bifurca`,
  `Kora-laneC` em `etapa-5-flip-tarefas-fase-b-plano`, `Kora-laneD` em
  `etapa-5-varredura-g72-minas-calendario`, `Kora-laneE` em
  `tarefas-b4-projectdetail-clientactivities`).
- Branch: `etapa-5-flip-tarefas-runbook`, criada a partir de `origin/main`.
- Hash confirmado por `git log origin/main -1`: **`6cb30de`**
  (`docs(qa): G72 - fixture de data fixa + new Date() real = teste apodrece com o calendario`).
- **Paralelismo confirmado nesta abertura**: Lane C planejando a Fase B de
  Tarefas (`etapa-5-flip-tarefas-fase-b-plano`), Lane D varrendo G72
  (calendário), Lane E em B4 (`ProjectDetailDrawer`/`ClientActivitiesTab`),
  Lane A em Vendas/`QuoteToProjectDialog`. Este runbook não toca nenhum
  arquivo de código — só `docs/qa/etapa-5-flip-tarefas-runbook.md` (novo).

## Referências (com o porquê de cada uma)

- [`etapa-5-flip-financeiro-runbook.md`](etapa-5-flip-financeiro-runbook.md) — molde direto de estrutura, formato de caso, critério de vermelho/ressalva/achado, e a convenção `[completar pós-B]`.
- [`etapa-5-flip-tarefas-pacote.md`](etapa-5-flip-tarefas-pacote.md) — fonte primária: §6.2 (os 9 casos), §5 (decisão (a) Fundir), §7.2 (tabela B1-B6, dependências e classes de risco por rodada), §4.1 (os 8 consumidores a bifurcar, achado do deep link).
- [`etapa-5-flip-tarefas-migrations-drafts.md`](etapa-5-flip-tarefas-migrations-drafts.md) — os 5 drafts de migration (§1 abaixo), já mesclados como drafts (`696a589`), nenhum aplicado.
- [`docs/architecture/kora-hub-auditoria-e-plano.md`](../architecture/kora-hub-auditoria-e-plano.md) — G29 (banner desatualizado), G30 (cache de mutação via `setQueryData`), G32 (fetch paralelo, design da casa), G37 (payload de espelho + passthrough de UUID), G40 (vocabulário cloud incompleto), G49 (vocabulário de `createProjectBaseTasks`, pré-requisito do CHECK), G56 (colisão de idempotência entre 2 produtores), G67/G67-ext/G67-ext-2 (`Number(uuid)` = `NaN`, inclusive a variante de deep-link).
- [`docs/qa/protocolo-homologacao.md`](protocolo-homologacao.md) — §0/§6 (Code não acessa banco/localStorage do operador), §16/§17 (isolamento de worktree, prova de build por hash), §18 (merge condicionado a "vai"), §1/§2 (EXPORT MANUAL, PRINT PRÉ-CLIQUE).

---

## 1. PRÉ-FLIP — checklist do operador

### 1.1 Gate EXPORT MANUAL (protocolo §1) — antes de qualquer coisa

**Diferente de Financeiro** (que já tinha dado de produção real em `financial_transactions` na abertura daquele runbook): `public.tasks` está **vazia hoje** (mesa vazia confirmada pelo pacote §6.4/§7.1, decisão (a) Fundir sem backfill). O export manual aqui é preventivo — protege o `orbyt.tasks.v1` local de cada usuário (que continua com dado real, ativamente usado) antes de qualquer flip de leitura. Operador exporta `tasks` (mesmo que vazia hoje, é o procedimento padrão) antes de qualquer escrita nova desta fatia. Confirmação por escrito do operador ("exportei") é o gate — Code não executa isto, só verifica que a confirmação chegou antes de prosseguir.

### 1.2 Import assistido — reconferência, não estreia

`useLocalTasksImport.ts` já foi lido diretamente nesta revalidação (pacote §6.4): "a migração suave e o `pendingLinks` persistido já estão no código", bug (g) do fan-out retroativo confirmado corrigido. **[completar pós-B]** — reconfirmar contra `main` real quando B4/B5 fecharem se o mapper mudou algo no payload que o import consome (mesmo cuidado que Financeiro teve no §1.2 daquele runbook: "reconfirmar", não reabrir do zero).

### 1.3 Gate — as 5 migrations do §1.1 do pacote (drafts já em `main`, nenhuma aplicada)

As 5 migrations, escritas na Fase B (Lane E, `696a589`), **ainda só drafts — nenhuma aplicada** (Code não roda DDL, protocolo §0/§6/§8-b):

1. `tasks.scope` (`work`/`personal`) + CHECK.
2. `tasks.tags` (`text[]`, sem CHECK, campo livre).
3. `tasks.recurrence` (`none`/`daily`/`weekly`/`monthly`/`weekdays`) + CHECK.
4. Lembretes: `reminder_at`/`reminder_enabled`/`reminder_sent_at`.
5. CHECK preventivo de `status`/`priority` (vocabulário local: `a_fazer`/`em_andamento`/`revisao`/`concluido` e `alta`/`média`/`baixa`) — condicionado ao G49 já mesclado (`54f7fea`, confirmado) e à mesa vazia como-de-15/ago (**não é garantia permanente** — o próprio draft manda re-rodar as 2 SELECTs de verificação na hora de aplicar, não só na hora de escrever).

Cada draft já embute sua própria SELECT de pré-checagem (`information_schema.columns`) no arquivo — reproduzir aqui as 2 mais sensíveis (draft 5, vocabulário), mesma disciplina do runbook de Financeiro (§1.3 daquele doc):

```sql
-- Rodar ANTES de aplicar o draft 5 (CHECK de status/priority). Expectativa é
-- ZERO linha fora do vocabulário — confirmar, não supor.
SELECT DISTINCT status FROM public.tasks WHERE status NOT IN ('a_fazer','em_andamento','revisao','concluido');
SELECT DISTINCT priority FROM public.tasks WHERE priority NOT IN ('alta','média','baixa');
```

**Passo explícito do operador, ANTES do "vai" da Fase C:**

1. Aplicar os drafts 1-4 (schema aditivo, sem dependência de dado).
2. Rodar as 2 SELECTs acima. Se qualquer uma devolver linha: **PARAR** — decidir o que fazer com o dado fora do vocabulário antes do draft 5.
3. Se zero linhas: aplicar o draft 5.
4. **Confirmação por escrito do operador** ("apliquei os 5 drafts, as 2 SELECTs vieram vazias") é o gate — Code não aplica DDL, só verifica que a confirmação chegou antes de considerar a Fase C liberada.

Sem este passo, a Fase C não pode abrir — mesma lógica de Financeiro §1.3: o código de escrita novo (B5) provavelmente já assume que essas colunas existem.

---

## 2. FASE C — flip dos defaults

### 2.1 Pré-requisito de ordem

Mesma lição de Financeiro/Projetos: não flipar `kora.tasks.dataSource.v1` antes do CRUD nativo (B5) estar pronto — regressão temporária desnecessária. **[completar pós-B]** — confirmar contra o código real de B5 se existe um `blockWrite()`-equivalente em `Tarefas.tsx` e qual o gate exato (nome da flag de escrita, se vier a existir separada do `dataSource`, ou se B5 nasce direto opt-in via `dataSource`).

### 2.2 A flag — hoje (não existe) / depois (proposto)

`kora.tasks.dataSource.v1` **nasce nesta mesma fatia** — não existe hoje (Fase A §1.3 do pacote, confirmado). **[completar pós-B]** — citar arquivo:linha real de `src/config/flags.ts` e o texto exato de `getTasksDataSource()` assim que B3 mesclar (mesmo padrão de `getFinanceDataSource()`/`getProjectsDataSource()` pós-flip: só `"local"` explícito seleciona local).

### 2.3 Rollback nível 1 — override de flag, sem deploy

Mesma garantia dos outros domínios (precedência de override — P5 do protocolo):

```js
localStorage.setItem("kora.tasks.dataSource.v1", "local");
```
seguido de F5. Tarefas criadas em modo Supabase não são apagadas — só somem da view local até o seletor voltar pra "supabase" (mesma semântica de Projetos/Financeiro).

### 2.4 Rollback nível 2 — revert de código

**[completar pós-B]** — baseline a citar é o hash de fechamento de B5 (escrita nativa), confirmado por `git log origin/main -1` na hora em que a Fase C realmente abrir — nunca citar de memória (mesma disciplina de Financeiro §2.4). **Nota específica de Tarefas** (pacote §6.3): se a opção (c) do §5 tivesse rodado backfill de dado real, o nível 2 reverteria só o código, não o backfill — **moot aqui**, porque a decisão fechada foi (a) Fundir, sem backfill (mesa vazia).

### 2.5 Critério de acionamento do rollback

Qualquer caso do runbook de Fase D (§3) fechar **vermelho sem correção rápida** (critério em §4), ou relato do operador em uso real de tarefa sumida/duplicada — aciona nível 1 imediatamente; nível 2 só se o nível 1 não resolver.

---

## 3. FASE D — Runbook de homologação (esqueleto — maioria dos casos `[completar pós-B]`)

### 3.0 Prova de servidor — protocolo §17, passo 0 obrigatório

Antes de qualquer caso: declarar worktree + branch + URL do dev server, confirmar `[Kora] BUILD <hash> (<branch>)` no console batendo com o hash esperado da rodada — nunca inferir correspondência código↔servidor pelo comportamento observado (mesmo incidente de referência de Quotes Fatia 10, reafirmado em Projetos/Financeiro).

### 3.1 Entidades sintéticas e workspace já conhecido

Workspace reaproveitado, mesmo já usado em todas as homologações desta Etapa 5: `2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9`. Confirmar no início da Fase D que nenhum outro workspace de QA substituiu este como padrão vigente (protocolo §0/§6 — Code não tem acesso a sessão autenticada).

Prefixo de entidades sintéticas: **`HOMOLOG-TAR-`** (não reaproveitar tarefas reais de nenhum projeto existente).

| Entidade sintética | Papel no runbook |
|---|---|
| `HOMOLOG-TAR-tarefa-A` | Tarefa criada nativa, direto na tela principal em modo Supabase — Casos 2, 3, 4, 9 |
| `HOMOLOG-TAR-tarefa-base` | Tarefa gerada por `createProjectBaseTasks` (`source='project_template'`) — Caso 5 (coexistência) |
| `HOMOLOG-TAR-tarefa-quote` | Tarefa criada via `QuoteToProjectDialog` (STARTER_TASKS) — Caso 7 (consumidores cruzados, Vendas) |
| `HOMOLOG-TAR-tarefa-deeplink` | Tarefa usada para exercitar `?task=<id>` — watch-item G67-classe, ver Caso 4-bis abaixo |

### 3.2 Lições de Financeiro/Projetos incorporadas explicitamente (não re-derivar)

- **SELECT depois da ação, nunca antes** — mesma disciplina que já pegou G30/G37/G56 em outros domínios.
- **Toast de espelho best-effort não é vermelho por si só** — se `QuoteToProjectDialog.tsx` (Caso 7) usa mirror G22 (padrão `addTask` write local + espelho best-effort, pacote §4.1), esperar propagação antes de marcar vermelho.
- **Drawer/cache — lição G30.** Qualquer caso que edite uma tarefa já aberta (kanban, drawer) precisa confirmar que o PRÓPRIO ponto de origem reflete a mudança sem F5 — se a mutation nova seguir invalidate-only, reproduz o G30.
- **`workspace_id` já conhecido** — `2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9`, sem placeholder.
- **[G67-classe] Deep link `?task=id` — achado novo desta revalidação, não herdado.** `Tarefas.tsx:228-241` faz `Number(raw)` contra `t.id`; hoje nunca falha (todo `Task.id` é local), mas quando `mapSupabaseTaskToLocal` alimentar a tela com uuid contrabandeado (`id: st.id as unknown as number`), `Number(uuid)` vira `NaN` e o deep link para de achar a tarefa em silêncio. Fix atribuído a B4/Lane C, na MESMA rodada que bifurca `Tarefas.tsx` — comparação por `String(id)`, não `Number()`. **Sem G-número ainda** (não corrigido/catalogado até este esqueleto fechar) — ver Caso 4-bis.
- **[G56-classe] watch-item, não achado confirmado (pacote §7.2, linha B6).** Se um dia existir mais de 1 produtor nativo escrevendo em `public.tasks` sob a mesma constraint (`source_local_id`), replicar a checagem de colisão que Financeiro precisou (G56). Hoje só `createProjectBaseTasks` e o import geral escrevem, sem overlap de escopo conhecido — mas vale o runbook exercitar o cenário se for barato (ver Caso 5-bis).

### 3.3 Os 9 casos

Esqueleto herdado de `etapa-5-flip-tarefas-pacote.md` §6.2 (9 casos — herda os 8 já esboçados na Fase A §5, mais 1 novo). Print pré-clique obrigatório (protocolo §2) em todo passo que grava na nuvem.

---

**Caso 1 — Leitura em modo Supabase** — `[completar pós-B2/B3]`

Tarefas antes só locais aparecem oriundas de `public.tasks`, tratamento de `project_template` conforme a opção (a) Fundir (§5 do pacote — sem tratamento especial, funde direto).

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 1.1 | `[completar pós-B3]` Console: `localStorage.setItem("kora.tasks.dataSource.v1", "supabase");` → F5, abrir tela de Tarefas | `[completar pós-B4]` Seletor mostra "Supabase"; consumidor bifurcado (`useBifurcatedTasks`) alimenta a tela — citar arquivo:linha real | Visual |
| 1.2 | — | Tela mostra as tarefas já reais do workspace, sem duplicar as locais equivalentes | `SELECT count(*) FROM public.tasks WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND deleted_at IS NULL;` comparado com a contagem visual |
| 1.3 | Conferir campos sem coluna cloud, se algum sobrar após os 5 drafts aplicados (§1.3) | `[completar pós-B]` — depende de quais campos locais NÃO tiverem equivalente cloud mesmo após os 5 drafts (a confirmar contra `mapSupabaseTaskToLocal` real) | Visual |

---

**Caso 2 — Escrita nativa (criar tarefa manual em modo Supabase)** — `[completar pós-B5]`

`source='manual'`, aparece sem reload.

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 2.1 | `[completar pós-B5]` Criar `HOMOLOG-TAR-tarefa-A` pela tela principal, em modo Supabase | `[completar pós-B5]` Toast de sucesso, aparece sem reload — citar hook/mutation real (padrão G30, `setQueryData` desde o primeiro commit, pacote §7.2 linha B5) | Visual |
| 2.2 | — (SELECT depois da ação, §3.2) | Linha existe na nuvem com `source='manual'` | `SELECT title, source FROM public.tasks WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND title = 'HOMOLOG-TAR-tarefa-A';` → 1 linha |

---

**Caso 3 — Transição de status refletida na própria mutação (G30)** — `[completar pós-B5]`

Mover entre colunas do kanban — mesmo cuidado do achado §3.5 do pacote (a mutation nova não pode repetir o padrão invalidate-only que `useSupabaseProjectTasks.updateStatus` tem hoje).

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 3.1 | `[completar pós-B5]` Mover `HOMOLOG-TAR-tarefa-A` entre colunas do kanban, em modo Supabase | `[completar pós-B5]` O próprio card reflete a nova coluna sem F5 — citar se a mutation nova usa `setQueryData` (esperado) ou reproduz o invalidate-only já catalogado como achado do §3.5 | Visual |
| 3.2 | — | Update gravado de verdade | `SELECT status FROM public.tasks WHERE title = 'HOMOLOG-TAR-tarefa-A';` → coluna alvo |

---

**Caso 4 — Status "revisão" sobrevive à escrita cloud** — parcialmente executável hoje (via `updateTaskStatus`)

Já resolvido pelo G40 pro caminho `updateTaskStatus` (`tasksRepository.ts:87-106`, vocabulário local de 4 valores, confirmado por leitura de código nesta rodada). `[completar pós-B5]` — confirmar que o caminho de escrita novo da tela principal (se distinto de `updateTaskStatus`) também preserva os 4 valores, não regride pra vocabulário em inglês.

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 4.1 | Definir `HOMOLOG-TAR-tarefa-A` como "revisão" pelo caminho que já existe hoje (`updateTaskStatus`) | Grava `status='revisao'`, vocabulário local, sem tradução | `SELECT status FROM public.tasks WHERE title = 'HOMOLOG-TAR-tarefa-A';` → `'revisao'` |
| 4.2 | `[completar pós-B5]` Repetir pelo caminho de escrita novo da tela principal, se for distinto de 4.1 | Mesmo resultado — vocabulário preservado | Mesma SELECT |

---

**Caso 4-bis — Deep link `?task=id` não quebra em silêncio (G67-classe)** — `[completar pós-B4]`, sem G-número ainda

Watch-item registrado no §3.2 acima — fix atribuído a B4/Lane C na mesma rodada que bifurca `Tarefas.tsx`.

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 4-bis.1 | `[completar pós-B4]` Em modo Supabase, abrir a URL `?task=<uuid-de-HOMOLOG-TAR-tarefa-A>` | A tarefa correspondente abre/destaca — comparação deve ser por `String(id)`, não `Number(id)` (se o fix não tiver entrado, `Number(uuid)` vira `NaN`, deep link falha em silêncio) | Visual |
| 4-bis.2 | — | **Vermelho automático** se a tarefa não abrir e nenhum erro visível aparecer (falha silenciosa, mesma classe G67/G67-ext/G67-ext-2) | Visual — comparar com o comportamento de uma tarefa local (`Number`-safe, deve sempre ter funcionado) |

---

**Caso 5 — Tarefas-base coexistindo com tarefas locais migradas** — `[completar pós-B5]`, decisão (a) já fechada

Caso central do §5 do pacote — comportamento esperado é o da opção (a) Fundir (sem tratamento especial). Como a mesa está vazia hoje, este caso só terá dado real pra exercitar depois que alguém gerar tarefas-base em produção — vale rodar mesmo assim como prova do comportamento, não só assumir pelo desenho (texto do próprio pacote §6.2 item 5).

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 5.1 | Gerar `HOMOLOG-TAR-tarefa-base` via `createProjectBaseTasks` (fluxo real de criação de projeto com tarefas-base), em modo Supabase | Aparece fundida com as demais, sem seção/tratamento separado (opção (a), sem backfill a testar — mesa já nasce vazia) | Visual |
| 5.2 | — | `source='project_template'` gravado corretamente | `SELECT source FROM public.tasks WHERE title = 'HOMOLOG-TAR-tarefa-base';` → `'project_template'` |

---

**Caso 5-bis — Watch-item de colisão G56-classe** — exercitável hoje (só 1 produtor real, resultado esperado: sem colisão)

Não é achado confirmado — é o watch-item do pacote §7.2 (linha B6): hoje só `createProjectBaseTasks` e o import geral escrevem em `public.tasks`, sem overlap de escopo conhecido sob a constraint `source_local_id`. Rodar mesmo assim, barato, pra deixar registrado que o cenário foi ao menos verificado uma vez.

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 5-bis.1 | Gerar `HOMOLOG-TAR-tarefa-base` (Caso 5) e, separadamente, importar uma tarefa local homônima via import geral | Sem colisão de `source_local_id` — os 2 vocabulários de `source` (`project_template` vs. import geral) não competem pelo mesmo `source_local_id` (mesma garantia já documentada em `tasksRepository.ts:26-30`) | `SELECT count(*) FROM public.tasks WHERE title = 'HOMOLOG-TAR-tarefa-base';` → exatamente 1 (nenhuma linha duplicada/mesclada por engano) |

---

**Caso 6 — Exclusão, soft vs. hard delete** — `[completar pós-B5]`

`deleted_at` preenchido, leitura filtra `deleted_at IS NULL`.

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 6.1 | `[completar pós-B5]` Excluir `HOMOLOG-TAR-tarefa-A` pela tela, em modo Supabase | Some da lista sem reload | Visual |
| 6.2 | — | `deleted_at` preenchido, não é hard delete | `SELECT deleted_at FROM public.tasks WHERE title = 'HOMOLOG-TAR-tarefa-A';` → timestamp não-nulo, linha ainda existe |

---

**Caso 7 — Consumidores cruzados** — `[completar pós-B4]`

Central do Dia, `ClientActivitiesTab.tsx` (3 domínios, atenção redobrada — pacote §4.2, coordenação com Financeiro/Lane C em voo no mesmo arquivo), `ProjectDetailDrawer.tsx` (2 leituras de `public.tasks` coexistindo — a nova bifurcada e a `useSupabaseProjectTasks` já existente, decisão de convergência ainda em aberto no pacote §4.1).

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 7.1 | `[completar pós-B4]` Abrir Central do Dia com `HOMOLOG-TAR-tarefa-A` pendente, em modo Supabase | Aparece corretamente; escrita (`completeTask`) — confirmar se ficou local-only por decisão (recomendação do pacote §4.1) ou se ganhou caminho cloud | Visual |
| 7.2 | `[completar pós-B4]` Gerar `HOMOLOG-TAR-tarefa-quote` via `QuoteToProjectDialog` (STARTER_TASKS), em modo Supabase | Grava local + espelho best-effort (G22) — toast de espelho não é vermelho por si só (§3.2) | Visual + `SELECT source FROM public.tasks WHERE title = 'HOMOLOG-TAR-tarefa-quote';` |
| 7.3 | `[completar pós-B4]` Abrir `ProjectDetailDrawer.tsx` de um projeto com tarefas em modo Supabase | Confirmar se as 2 leituras (`useBifurcatedTasks` nova e `useSupabaseProjectTasks` existente) convergem ou continuam paralelas — decisão do pacote §4.1 ainda em aberto na abertura desta rodada | Visual |
| 7.4 | `[completar pós-B4]` Abrir ficha de um cliente sintético vinculado a `HOMOLOG-TAR-tarefa-A` → aba Atividades (`ClientActivitiesTab.tsx`) | Timeline mostra o evento de tarefa corretamente, coexistindo com os domínios já bifurcados (projetos) e o que estiver em voo (finanças, Lane C) | Visual |

---

**Caso 8 — Banner/texto desatualizado (G29)** — `[completar pós-B4]`

Auditar `Tarefas.tsx` + o comentário de `useDayCenterData.ts` (linhas 15-20, pacote §4.1: hoje lista `tasks` explicitamente como "100% local, fora de escopo") por copy que sobreviva ao ponto em que a escrita real já funciona.

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 8.1 | `[completar pós-B4]` Ler `Tarefas.tsx` e `useDayCenterData.ts:15-20` contra `main` pós-B4 | Nenhum texto/comentário afirma "só local"/"fora de escopo" se a escrita cloud já estiver ativa — mesma lição G29 que Financeiro/Projetos já pegaram | Leitura de código |

---

**Caso 9 — Campos pós-flip não bloqueiam nem perdem silenciosamente** — `[completar pós-B5]`

Abrir checklist/comentários de uma tarefa em modo Supabase — aviso explícito aparece, tarefa em si não é bloqueada.

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 9.1 | `[completar pós-B5]` Em modo Supabase, tentar usar `scope`/`tags`/`recurrence`/lembretes em `HOMOLOG-TAR-tarefa-A`, ANTES dos 5 drafts (§1.3) aplicados | Aviso explícito aparece (UX final decidida na Fase B), tarefa salva mesmo assim — nunca bloqueia, nunca perde silenciosamente | Visual |
| 9.2 | Repetir DEPOIS dos 5 drafts aplicados | Os 4 campos agora persistem de verdade (colunas existem) | `SELECT scope, tags, recurrence, reminder_at FROM public.tasks WHERE title = 'HOMOLOG-TAR-tarefa-A';` → preenchidos conforme testado |

---

**Caso 10 — Limpeza**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 10.1 | Soft-delete/arquivar todas as tarefas sintéticas (`HOMOLOG-TAR-tarefa-A/base/quote/deeplink`), limpar chaves de `localStorage` setadas manualmente | Estado volta a "usuário novo" | — |
| 10.2 | — | Resíduo zero | `SELECT count(*) FROM public.tasks WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND title LIKE 'HOMOLOG-TAR-%' AND deleted_at IS NULL;` → 0 |

---

## 4. Critérios de vermelho vs. ressalva vs. achado

Mesmo critério operacional dos runbooks de Projetos/Financeiro:

- **Vermelho (para a homologação):** o comportamento observado ao vivo diverge do comportamento desenhado/documentado. Aciona: diagnóstico → correção → novo commit → **PARADO** → aguardar novo "vai". **O Caso 4-bis (deep link) é vermelho automático** se a tarefa não abrir/destacar em modo Supabase e nenhum erro visível aparecer — mesma classe de prova obrigatória que o Caso 2.3 (equivalente-O12) teve em Financeiro.
- **Ressalva (não bloqueia):** mecanismo já provado correto por outra via (ex.: import geral, já com fan-out retroativo confirmado corrigido por leitura de código nesta rodada) e só uma recaptura específica não foi refeita. Decisão de não reabrir deve ser registrada explicitamente.
- **Achado catalogado, não é bug:** algo encontrado durante a homologação que não afeta o caminho testado — registra no catálogo mestre (`kora-hub-auditoria-e-plano.md`, próximo ID livre a confirmar na hora — não assumir de memória, mesma disciplina do runbook de Financeiro §4).
- **Placar de fechamento:** formato herdado — `N/N casos verdes, com o Caso 4-bis obrigatoriamente incluindo prova de que o deep link sobrevive a um id uuid (não `Number(uuid)`=NaN) — não pode fechar como "assumido correto"`.

---

## 5. O que este doc NÃO faz

- Não executa nenhum caso — é esqueleto de preparação, a maioria dos casos ainda `[completar pós-B4]`/`[completar pós-B5]`.
- Não aplica os 5 drafts de migration do §1.3 nem confirma que foram aplicados — ação do operador.
- Não cita hash de B2/B3/B4/B5 nem do commit de flip da Fase C — nenhum confirmado em `origin/main` nesta rodada; `[completar pós-B]` marca exatamente onde cada um entra.
- Não resolve a decisão em aberto do pacote §4.1 sobre `completeTask` (Central do Dia) ficar local-only ou ganhar caminho cloud — fica pro revisor decidir, registrado aqui só como dependência do Caso 7.
- Não resolve a decisão em aberto do pacote §4.1 sobre `ProjectDetailDrawer.tsx` convergir as 2 leituras de `public.tasks` ou continuar paralelas — mesma situação, registrada como dependência do Caso 7.3.
- Não substitui os gates permanentes do protocolo (EXPORT MANUAL, PRINT PRÉ-CLIQUE, prova de servidor §17) — só aponta onde cada um entra nesta fatia.

---

**PARADO aqui — este é um esqueleto, não o runbook fechado. Fica pra uma rodada seguinte (pós-B4/B5) resolver todos os `[completar pós-B]` contra o código real mesclado, mesmo movimento que o runbook de Financeiro já passou. Execução real da Fase C/Fase D só com um novo "vai" que autorize especificamente abrir cada fase — e só depois do gate do §1.3 (os 5 drafts aplicados pelo operador, com confirmação por escrito) fechar. §18.**
