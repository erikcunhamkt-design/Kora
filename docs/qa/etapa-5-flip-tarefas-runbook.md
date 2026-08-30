# Etapa 5 · G1/Tarefas · Pacote do Flip — Runbook das Fases C/D (EXECUTADO — HOMOLOGADO)

> **Atualização — execução ao vivo concluída.** Ver
> [`etapa-5-flip-tarefas-homologacao-fase-d.md`](etapa-5-flip-tarefas-homologacao-fase-d.md)
> pro placar completo (12/12 casos sem vermelho, 2 ressalvas) e o veredito
> de sign-off. 2 correções deste doc (Caso 5 — gatilho real; Caso 9.1 —
> comportamento agravado pra tarefa da nuvem) foram aplicadas contra o que
> a execução real encontrou. **G79** (novo, vínculo cliente↔tarefa/projeto
> inexistente em modo Supabase) catalogado a partir do achado do Caso 7.4.

> **Escopo desta rodada: doc-only, zero código.** Este doc resolve TODOS os
> `[completar pós-B4]`/`[completar pós-B4-Parte2]`/`[completar pós-B5]` do
> esqueleto original contra o código REAL mesclado — mesmo movimento que o
> runbook de Financeiro passou ("Atualização — Fase B FECHADA"). B1-B5 e a
> Fase C inteira já estão em `main`; o gate de migrations do §1 foi
> confirmado SATISFEITO pelo operador nesta mesma sessão (§8-b, 5/5
> aplicadas e provadas). **A partir daqui o runbook está pronto pra
> execução real da Fase D** — o revisor guia o operador caso a caso em
> cima dos 10 casos abaixo.
>
> **2 achados de honestidade, registrados aqui pra não serem descobertos só
> na hora de executar:**
> 1. **Migrations aplicadas ≠ mapper atualizado.** As 5 migrations do §1
>    (scope/tags/recurrence/reminders + CHECK de status/priority) já
>    existem como colunas reais em `public.tasks` — mas `tasksMapper.ts`
>    (`mapSupabaseTaskToLocal`/`mapLocalTaskToSupabase`/`splitTaskUpdatePatch`)
>    **ainda não foi atualizado pra ler/escrever essas 4 colunas** — o
>    código continua hardcodando `scope: "work"`, `tags: []`,
>    `recurrence: "none"`, `reminderAt: undefined` na leitura, e nunca
>    inclui esses campos no payload de escrita. Ver Caso 9 abaixo — isso
>    NÃO bloqueia nem quebra nada (as colunas simplesmente ficam sempre
>    `NULL`/default), mas significa que usar esses 4 campos em modo
>    Supabase continua 100% local-only na prática, apesar da infra de
>    banco já existir. Recomendação: rodada de acompanhamento pra ligar o
>    mapper às 4 colunas novas — sem isso, aplicar as migrations não muda
>    o comportamento observável pro usuário.
> 2. **G78 (novo, catalogado nesta rodada)**: `ProjectDetailDrawer.tsx:88-101`
>    tem um comentário desatualizado (G29-classe) afirmando que a escrita
>    nativa de Tarefas "ainda não existe" — falso desde B5. Não corrigido
>    aqui (doc-only); ver Caso 8.

## Abertura (§16/§17)

- Worktree: `orbit-designer-hub-qualidade-lint` (confirmado isolado via
  `git worktree list` nesta abertura — `Kora-laneA` em
  `etapa-5-materiais-g75-mitigacao`, `Kora-laneC` em
  `etapa-5-flip-fichas-f3-consumidores`, `Kora-laneD` em
  `etapa-5-tarefas-migrations-drafts-arquivos`, `Kora-laneE` em
  `g71-ui-role-gate` — nenhuma colisão de path/branch com esta rodada).
- Branch: `etapa-5-flip-tarefas-runbook-homologacao`, criada a partir de
  `origin/main`.
- Hash confirmado por `git log origin/main -1`: **`f1fe83f`**
  (`docs(tarefas): G77 fechado por fb4d508 (Lane B - completeTask nativo em 3 caminhos)`).
- **Estado do ciclo de código de Tarefas, confirmado por leitura direta do
  código em `main` (não por citação de doc)**:
  - B1 (5 migrations, drafts): `696a589`.
  - B2/B3 (`tasksRepository.listTasks`, `useSupabaseTasksAll`,
    `useBifurcatedTasks`, flag `kora.tasks.dataSource.v1`): `44f0ff9`.
  - B4 (8 consumidores): `ProjectDetailDrawer.tsx`+`ClientActivitiesTab.tsx`
    → `7c1ae42`; `Tarefas.tsx` + G73 (deep link) → `16ca588`;
    `DayCenter.tsx`/`useDayCenterActions.ts`/`useTaskReminders.ts` + G76
    (guarda contra `Number(uuid)=NaN`) → `54a5ce5`.
  - B5 (escrita nativa em `Tarefas.tsx`): `5e1829d` (caminho nativo) +
    `1dea136` (patch misto, `splitTaskUpdatePatch`).
  - Fase C (flip dos 2 defaults — `dataSource`→`supabase`,
    `supabaseWrite`→opt-out): `25f46ac`.
  - G77 (fix pré-flip do gate fóssil de `completeTask`): `fb4d508`
    (código) + `f1fe83f` (fechamento do catálogo, cita o hash da B).
  - **Migrations do §1 — SATISFEITO**: aplicadas pelo operador na sessão
    §8-b de hoje, 5/5 confirmadas (colunas + CHECKs existem em
    `public.tasks`). Nota: os arquivos `.sql` correspondentes ainda não
    foram promovidos de `docs/qa/etapa-5-flip-tarefas-migrations-drafts.md`
    pra `supabase/migrations/*.sql` no `main` (Lane D trabalha nisso
    separadamente, `etapa-5-tarefas-migrations-drafts-arquivos`,
    `98644bf`, não mesclado) — irrelevante pro gate deste runbook, que é
    sobre o estado do BANCO (protocolo §0/§6/§8-b: Code nunca verifica
    isso sozinho, só registra a confirmação do operador).
  - `QuoteToProjectDialog.tsx` (STARTER_TASKS) — **gap conhecido, não
    fechado em nenhuma rodada**: `addTask` (linha 128) continua vindo só
    de `useTasks()` local, sem espelho G22 nenhum pra nuvem. Ver Caso 7.

## Referências (com o porquê de cada uma)

- [`etapa-5-flip-financeiro-runbook.md`](etapa-5-flip-financeiro-runbook.md) — molde de estrutura, formato de caso, critério de vermelho/ressalva/achado, e o movimento "placeholder → resolvido contra código real" que este runbook repete.
- [`etapa-5-flip-tarefas-pacote.md`](etapa-5-flip-tarefas-pacote.md) — fonte primária: §1.1 (4 campos bloqueantes + SQL), §1.2 (subtasks/comments, aviso recomendado nunca implementado), §5 (decisão (a) Fundir), §6.2 (os 9 casos originais), §7.2 (tabela B1-B6).
- [`etapa-5-flip-tarefas-migrations-drafts.md`](etapa-5-flip-tarefas-migrations-drafts.md) — as 5 SQLs exatas aplicadas pelo operador (§1 abaixo reproduz as 2 mais sensíveis).
- [`docs/architecture/kora-hub-auditoria-e-plano.md`](../architecture/kora-hub-auditoria-e-plano.md) — G29 (banner desatualizado, inclusive o novo G78), G30 (cache de mutação via `setQueryData`), G32 (fetch paralelo, design da casa), G37 (payload de espelho + passthrough de UUID), G40 (vocabulário cloud incompleto), G49 (vocabulário de `createProjectBaseTasks`), G56 (colisão de idempotência entre 2 produtores), G67/G73 (`Number(uuid)=NaN`), G75 (mesma classe de perda silenciosa de dado, `Client.assets`), G76 (guarda de `completeTask`), G77 (guarda vira gate fóssil no flip, fechado antes do flip valer), G78 (comentário desatualizado em `ProjectDetailDrawer.tsx`), G79 (vínculo cliente↔tarefa/projeto inexistente em modo Supabase, achado da execução ao vivo).
- [`etapa-5-flip-tarefas-homologacao-fase-d.md`](etapa-5-flip-tarefas-homologacao-fase-d.md) — ata da execução ao vivo, placar 12/12, detalhe por caso, veredito de sign-off.
- [`docs/qa/protocolo-homologacao.md`](protocolo-homologacao.md) — §0/§6 (Code não acessa banco/localStorage do operador), §16/§17 (isolamento de worktree, prova de build por hash), §18 (merge condicionado a "vai"), §1/§2 (EXPORT MANUAL, PRINT PRÉ-CLIQUE), §8-b (sessão de DDL do operador).

---

## 1. PRÉ-FLIP — checklist do operador

### 1.1 Gate EXPORT MANUAL (protocolo §1) — antes de qualquer coisa

`public.tasks` estava vazia na quantificação de 15/ago (8 SELECTs, `tarefas-r2-auditoria.md` §4) — mas **2 caminhos de escrita cloud-nativos já existiam desde antes desta fatia** (`createProjectBaseTasks`, `updateTaskStatus`) e continuam existindo (pacote §2.2, "congelados por contenção, não corrigidos"). Com o flip ligado, o volume real pode não ser mais zero. Operador exporta `tasks` (e `projects`/`clients` se o procedimento padrão já incluir tabelas relacionadas) antes de qualquer caso que grave na nuvem. Confirmação por escrito do operador ("exportei") é o gate — Code não executa isto, só verifica que a confirmação chegou.

### 1.2 Import assistido — reconferência, não estreia

`useLocalTasksImport.ts` já foi confirmado corrigido (bug do fan-out retroativo, pacote §6.4) e não foi tocado por B1-B5/Fase C. Reconfirmar no início da execução real que nenhuma mudança recente no mapper (payload de leitura/escrita) quebrou a reconciliação — mesma disciplina de "reconferência" que Financeiro usou.

### 1.3 Gate de migrations — **SATISFEITO**

As 5 migrations do pacote §1.1 (drafts em `etapa-5-flip-tarefas-migrations-drafts.md`, mesclado como `696a589`) foram **aplicadas pelo operador na sessão §8-b de hoje** — confirmação recebida: 5/5, com as 2 SELECTs de verificação do vocabulário (abaixo, reproduzidas do próprio draft) vindo vazias antes de aplicar o CHECK:

```sql
-- Rodadas pelo operador, ANTES do CHECK de status/priority (migration 5).
-- Confirmado: ZERO linha em qualquer uma das 2.
SELECT DISTINCT status FROM public.tasks WHERE status NOT IN ('a_fazer','em_andamento','revisao','concluido');
SELECT DISTINCT priority FROM public.tasks WHERE priority NOT IN ('alta','média','baixa');
```

Colunas confirmadas em `public.tasks`: `scope` (+ CHECK `work`/`personal`), `tags` (`text[]`, sem CHECK), `recurrence` (+ CHECK dos 5 valores), `reminder_at`/`reminder_enabled`/`reminder_sent_at`, e o CHECK preventivo de `status`/`priority`. **Nenhuma dessas colunas é lida/escrita pelo `tasksMapper.ts` ainda** — ver nota de honestidade #1 na abertura deste doc e Caso 9 abaixo. Este gate cobre só o schema (protocolo §0/§6/§8-b: Code não aplica DDL, só registra a confirmação) — não cobre o código consumir as colunas, que é um gap separado.

Sem este passo, a Fase C não poderia ter aberto — como já abriu (`25f46ac`) e o gate está confirmado retroativamente, não há bloqueio pendente aqui.

---

## 2. FASE C — flip dos defaults (JÁ EXECUTADA — `25f46ac`)

### 2.1 As duas flags — antes / depois, confirmado contra o código real

**Flag 1 — `kora.tasks.dataSource.v1`** (`src/config/flags.ts:154-259`):

```ts
// ANTES (B3, pré-flip) — só "supabase" explícito selecionava nuvem.
export function getTasksDataSource(): DataSource {
  return safeGet(TASKS_DATA_SOURCE_KEY) === "supabase" ? "supabase" : "local";
}
```

```ts
// DEPOIS (Fase C, `25f46ac`, em produção) — só "local" explícito seleciona local.
export function getTasksDataSource(): DataSource {
  return safeGet(TASKS_DATA_SOURCE_KEY) === "local" ? "local" : "supabase";
}
```

**Flag 2 — `kora.tasks.supabaseWrite.v1`** (`src/hooks/useSupabaseTasksWriteFlag.ts:33-40`):

```ts
// ANTES (B5, pré-flip) — opt-in, só "true" ligava.
function readFlag(): boolean {
  return localStorage.getItem(TASKS_SUPABASE_WRITE_FLAG_KEY) === "true";
}
```

```ts
// DEPOIS (Fase C, `25f46ac`, em produção) — opt-out, só "false" desliga.
function readFlag(): boolean {
  return localStorage.getItem(TASKS_SUPABASE_WRITE_FLAG_KEY) !== "false";
}
```

**As duas flipam juntas, mesmo pacote (`25f46ac`)** — mesmo precedente dos 4 domínios irmãos. Sessões que já tinham valor explícito gravado (qualquer um dos dois) não são afetadas — só quem nunca tocou nos 2 seletores herda os novos defaults.

### 2.2 G77 — o gate fóssil que o flip criaria, fechado ANTES de valer

Confirmado por leitura de código (`25f46ac` é filho, no histórico, de `fb4d508`): `canCompleteTask` (`DayCenter.tsx:155`, duplicado em `useDayCenterActions.ts`) já é `getTasksDataSource() !== "supabase" || tasksWriteEnabled` — com os 2 defaults pós-flip (`dataSource="supabase"`, write flag ligada), a combinação DEFAULT cai no caminho nativo (`completeTask` → `moveTask` de `useSupabaseTasksAll()`), não no bloqueio. O botão "Concluir" da Central do Dia **continua aparecendo e funcionando por default** pra quem nunca tocou nenhum dos 2 seletores — o risco que o G77 documentou nunca chegou a se manifestar em produção.

### 2.3 Rollback nível 1 — override de flag, sem deploy

```js
localStorage.setItem("kora.tasks.dataSource.v1", "local");
localStorage.setItem("kora.tasks.supabaseWrite.v1", "false");
```
seguido de F5. Tarefas criadas/movidas em modo Supabase não são apagadas — só somem da view local até o seletor voltar (mesma semântica dos outros 4 domínios).

### 2.4 Rollback nível 2 — revert de código

Baseline: `25f46ac` é o commit de flip em si — `git revert 25f46ac --no-edit` reverte só o flip dos 2 defaults, preservando schema/mapper/B5 intactos (mesma disciplina de Financeiro/Projetos: nunca reverter o commit de FECHAMENTO da Fase B junto).

### 2.5 Critério de acionamento do rollback

Qualquer caso da Fase D (§3) fechar **vermelho sem correção rápida** (critério §4), ou relato do operador em uso real de tarefa sumida/duplicada/lembrete repetindo — aciona nível 1 imediatamente; nível 2 só se o nível 1 não resolver.

---

## 3. FASE D — Runbook de homologação (pronto pra execução)

### 3.0 Prova de servidor — protocolo §17, passo 0 obrigatório

Antes de qualquer caso: declarar worktree + branch + URL do dev server, confirmar `[Kora] BUILD <hash> (<branch>)` no console batendo com `f1fe83f` (ou o hash do momento da execução real, reconfirmado). Nunca inferir correspondência código↔servidor pelo comportamento observado.

### 3.1 Entidades sintéticas e workspace já conhecido

Workspace: `2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9` (mesmo de todas as homologações desta Etapa 5). Confirmar no início que nenhum outro workspace de QA substituiu este como padrão vigente.

Prefixo: **`HOMOLOG-TAR-`**.

| Entidade sintética | Papel no runbook |
|---|---|
| `HOMOLOG-TAR-tarefa-A` | Tarefa criada nativa pela tela principal, em modo Supabase (default pós-flip) — Casos 2, 3, 4, 4-bis |
| `HOMOLOG-TAR-tarefa-base` | Tarefa gerada por `createProjectBaseTasks` (`source='project_template'`) — Caso 5 |
| `HOMOLOG-TAR-tarefa-quote` | Tarefa criada via `QuoteToProjectDialog` (STARTER_TASKS) — Caso 7, prova do gap conhecido (100% local) |

### 3.2 Lições incorporadas explicitamente (não re-derivar)

- **SELECT depois da ação, nunca antes.**
- **Toast de espelho best-effort não é vermelho por si só** — não se aplica a nenhum caso de escrita PRINCIPAL aqui (B5 é escrita DIRETA, `await moveSupabaseTask(...)`/`createSupabaseTask(...)`, não um mirror best-effort) — só relevante se algum dia `QuoteToProjectDialog.tsx` ganhar o espelho G22 que falta (Caso 7).
- **Drawer/cache — lição G30.** Toda mutation nativa de B5 (`createMutation`/`updateMutation`/`moveMutation`/`deleteMutation` em `useSupabaseTasksAll.ts`) já grava a resposta via `setQueryData` (`onSuccess`) — confirmado por leitura de código, não assumido.
- **`workspace_id` já conhecido** — `2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9`, sem placeholder.
- **G73 (deep link) e G76/G77 (Central do Dia) já fechados e testados** (`Tarefas.test.tsx`, `useDayCenterActions.test.ts`, `useTaskReminders.test.ts`) — os Casos 4-bis e a homologação da Central do Dia abaixo são RECONFIRMAÇÃO ao vivo, não a primeira prova.
- **[G56-classe] watch-item, ainda watch-item, não achado confirmado.** Só `createProjectBaseTasks` e o import geral escrevem em `public.tasks` sob `source_local_id` — sem overlap conhecido. Ver Caso 5-bis.
- **[Achado de honestidade #1, ver abertura] scope/tags/recurrence/reminders têm coluna, mapper não usa.** Ver Caso 9 — não é vermelho (nada quebra), é uma expectativa a alinhar com o operador antes de declarar "flip completo" pro produto inteiro.

### 3.3 Os 10 casos

Print pré-clique obrigatório (protocolo §2) em todo passo que grava na nuvem.

---

**Caso 1 — Leitura em modo Supabase (default pós-flip)** — pronto pra executar

Com o flip já em produção, QUALQUER sessão que nunca tocou o seletor já está em modo Supabase — este caso valida o caminho que a maioria dos usuários usa desde já, não um opt-in raro.

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 1.1 | Abrir a tela de Tarefas numa sessão limpa (sem override de `localStorage`) | Seletor de fonte (se existir na UI) mostra "Supabase", OU — não havendo seletor visível hoje — `tasks = useBifurcatedTasks()` (`Tarefas.tsx:194`) já devolve as tarefas da nuvem por default | Visual — comparar contagem exibida com a SELECT abaixo |
| 1.2 | — | Tela mostra as tarefas reais do workspace, sem duplicar locais equivalentes | `SELECT count(*) FROM public.tasks WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND deleted_at IS NULL;` |
| 1.3 | Conferir uma tarefa com `scope`/`tags`/`recurrence`/lembrete gravados só localmente antes do flip (se existir) | Aparece com `scope="work"` (neutro), `tags=[]`, `recurrence="none"` — mapper ainda não lê as colunas novas (achado de honestidade #1) | Visual — não é vermelho, é o comportamento documentado |

---

**Caso 2 — Escrita nativa (criar tarefa manual em modo Supabase, default pós-flip)** — pronto pra executar

`source='manual'`, aparece sem reload. Mecanismo real: `addTask` (`Tarefas.tsx:236-239`) → `cloudWriteMode` true por default → `createSupabaseTask(data)` → `useSupabaseTasksAll.createMutation` → `tasksRepository.importTask` com `buildNativeSourceLocalId()`.

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 2.1 | Criar `HOMOLOG-TAR-tarefa-A` pela tela principal, sessão limpa (default pós-flip, sem tocar em nenhum seletor) | Toast de sucesso, aparece sem reload (`createMutation.onSuccess`, `setQueryData`) | Visual |
| 2.2 | — (SELECT depois da ação) | Linha existe na nuvem com `source='manual'` | `SELECT title, source FROM public.tasks WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND title = 'HOMOLOG-TAR-tarefa-A';` → 1 linha |
| **2.3** | **Prova obrigatória do equivalente-O12 — não pode fechar como "assumido correto"** (mesma disciplina do Caso 2.3 de Financeiro) | Tentar gravar um valor FORA do vocabulário direto por SQL | `UPDATE public.tasks SET status = 'valor-invalido' WHERE title = 'HOMOLOG-TAR-tarefa-A';` → **DEVE FALHAR** com violação do CHECK de status (migration 5, aplicada §1.3) |

O passo 2.3 é vermelho automático se o UPDATE inválido NÃO falhar — prova de que o CHECK aplicado pelo operador hoje é real, não só uma linha em um doc de draft.

---

**Caso 3 — Transição de status refletida na própria mutação (G30)** — pronto pra executar

Mover `HOMOLOG-TAR-tarefa-A` entre colunas do kanban. Mecanismo real: `moveTask` (`Tarefas.tsx:241-244`) → `cloudWriteMode` → `moveSupabaseTask(String(id), status)` → `useSupabaseTasksAll.moveMutation` → `tasksRepository.updateTaskStatus` → `onSuccess` grava a resposta via `setQueryData` (`useSupabaseTasksAll.ts:104-109`), nunca invalidate-only.

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 3.1 | Mover `HOMOLOG-TAR-tarefa-A` entre colunas do kanban | O próprio card reflete a nova coluna sem F5 (`setQueryData`) | Visual |
| 3.2 | — | Update gravado de verdade, vocabulário local preservado (sem tradução, R1) | `SELECT status FROM public.tasks WHERE title = 'HOMOLOG-TAR-tarefa-A';` → coluna alvo, valor em português |

---

**Caso 4 — Status "revisão" sobrevive à escrita cloud** — pronto pra executar

Já fechado pelo G40 (`updateTaskStatus`) e reconfirmado pelo caminho de escrita novo de B5 (`updateTask`/`splitTaskUpdatePatch`, mesmo vocabulário, sem tradução — `tasksMapper.ts` topo do arquivo).

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 4.1 | Definir `HOMOLOG-TAR-tarefa-A` como "revisão" via drag-and-drop (kanban) | Grava `status='revisao'`, vocabulário local | `SELECT status FROM public.tasks WHERE title = 'HOMOLOG-TAR-tarefa-A';` → `'revisao'` |
| 4.2 | Editar prioridade/descrição da mesma tarefa pelo detail sheet (patch com campo cloud, `updateTask` → `splitTaskUpdatePatch`) | Patch vai só o `cloudPatch` (title/description/priority/dueDate) pro `updateSupabaseTask`; `status` "revisao" não é sobrescrito | Mesma SELECT, `status` continua `'revisao'` |

---

**Caso 4-bis — Deep link `?task=id` não quebra em silêncio (G73, já fechado — reconfirmação ao vivo)**

`Tarefas.tsx:328-339`, comparação por `String(t.id) === raw`, sem `Number()`. Teste automatizado já cobre (`Tarefas.test.tsx`).

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 4-bis.1 | Abrir a URL `?task=<uuid-de-HOMOLOG-TAR-tarefa-A>`, sessão em modo Supabase (default) | A tarefa correspondente abre/destaca | Visual |
| 4-bis.2 | Regressão — em modo local explícito (`kora.tasks.dataSource.v1=local`), repetir com um `id` numérico local | Continua funcionando | Visual |

---

**Caso 5 — Tarefas-base coexistindo com tarefas locais migradas** — pronto pra executar, decisão (a) Fundir já fechada

**Correção pós-execução (homologação ao vivo, `docs/qa/etapa-5-flip-tarefas-homologacao-fase-d.md`)**: o gatilho real NÃO é "criar um projeto novo" — não existe hoje nenhum caminho de criação de projeto que dispare `createProjectBaseTasks` diretamente. O caminho real, confirmado ao vivo, é: **Configurações → Dados → ligar os 2 toggles ("Visão Operacional Supabase (Experimental)" + "Gerar Tarefas Base") → abrir o painel "Visão Operacional" → botão "Gerar tarefas base"** (`SupabaseOperationalDashboardCard` → `CreateProjectBaseTasksDialog`).

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 5.1 | Ligar os 2 toggles experimentais em Configurações → Dados, abrir o painel "Visão Operacional", clicar "Gerar tarefas base" (`CreateProjectBaseTasksDialog`), sessão em modo Supabase | Aparece fundida com as demais, sem seção/tratamento separado (opção (a), sem backfill — mesa nasceu vazia) | Visual |
| 5.2 | — | `source='project_template'` gravado corretamente | `SELECT source, status, priority FROM public.tasks WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND source = 'project_template';` → todas as linhas geradas, `status='a_fazer'`, prioridades herdadas do template |

---

**Caso 5-bis — Watch-item de colisão G56-classe** — pronto pra executar, resultado esperado: sem colisão

Não é achado confirmado — só 1 produtor real (`createProjectBaseTasks`) e o import geral escrevem em `public.tasks`, sem overlap de escopo conhecido sob `source_local_id`.

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 5-bis.1 | Gerar `HOMOLOG-TAR-tarefa-base` (Caso 5) e, separadamente, importar uma tarefa local homônima via import geral | Sem colisão de `source_local_id` — os 2 vocabulários de `source` não competem pelo mesmo `source_local_id` (`tasksRepository.ts:26-30`) | `SELECT count(*) FROM public.tasks WHERE title = 'HOMOLOG-TAR-tarefa-base';` → exatamente 1 |

---

**Caso 6 — Exclusão, soft vs. hard delete** — pronto pra executar

Mecanismo real: `deleteTask` (`Tarefas.tsx:246-249`) → `cloudWriteMode` → `deleteSupabaseTask(String(id))` → `tasksRepository.softDeleteTask` (`deleted_at`, não hard delete).

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 6.1 | Excluir `HOMOLOG-TAR-tarefa-A` pela tela, em modo Supabase | Some da lista sem reload | Visual |
| 6.2 | — | `deleted_at` preenchido, linha continua existindo | `SELECT deleted_at FROM public.tasks WHERE title = 'HOMOLOG-TAR-tarefa-A';` → timestamp não-nulo |

---

**Caso 7 — Consumidores cruzados** — 3 de 4 prontos; `QuoteToProjectDialog.tsx` é gap conhecido, não fechado

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 7.1 | Abrir Central do Dia com `HOMOLOG-TAR-tarefa-A` pendente, em modo Supabase (default) | Aparece corretamente; "Concluir" funciona por default (G77 — caminho nativo, `moveTask` de `useSupabaseTasksAll`) | Visual + `SELECT status FROM public.tasks WHERE title = 'HOMOLOG-TAR-tarefa-A';` → `'concluido'` após clicar |
| 7.2 | **Gerar `HOMOLOG-TAR-tarefa-quote` via `QuoteToProjectDialog` (STARTER_TASKS), em modo Supabase** | **Grava SÓ local — `addTask` (linha 128) vem de `useTasks()` cru, sem `cloudWriteMode`, sem espelho G22 nenhum.** Isto é o comportamento REAL, não um bug desta rodada — gap conhecido, nunca fechado em nenhuma fatia | Visual (aparece na tela local) + `SELECT count(*) FROM public.tasks WHERE title = 'HOMOLOG-TAR-tarefa-quote';` → **0** (nunca chega na nuvem) — **não é vermelho, é o gap documentado na Abertura** |
| 7.3 | Abrir `ProjectDetailDrawer.tsx` de um projeto com tarefas em modo Supabase | Leitura bifurcada funciona (`tasks = useBifurcatedTasks()`, linha 103); criar/mover tarefa por aqui grava só local (comentário do arquivo, G78 — desatualizado sobre o PORQUÊ, mas o comportamento em si está correto) | Visual |
| 7.4 | Abrir ficha de um cliente sintético vinculado a `HOMOLOG-TAR-tarefa-A` → aba **"Histórico de Relacionamento"** (nome real da aba — correção pós-execução; o runbook chamava de "Atividades") (`ClientActivitiesTab.tsx:135`) | **Parcial, ver `docs/qa/etapa-5-flip-tarefas-homologacao-fase-d.md`**: aba carrega sem erro, mas captura completa (evento de tarefa vinculada a cliente) é INALCANÇÁVEL por UI hoje — G79 (nenhuma tela vincula `client_id` real pra tarefa/projeto em modo Supabase). Mecanismo (`buildTaskEvents.ts`) coberto por testes unitários; feed já provado funcionando pra tarefas SEM vínculo de cliente | Visual — ressalva registrada, não bloqueia |

---

**Caso 8 — Banner/texto desatualizado (G29/G78)** — achado confirmado nesta rodada, não corrigido (doc-only)

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 8.1 | Ler `ProjectDetailDrawer.tsx:88-101` contra o `main` atual | **Achado (G78, catalogado)**: comentário duplicado afirma "escrita nativa em modo Supabase pra Tarefas é a B5 do plano, ainda não existe" — FALSO desde `5e1829d`. Não corrigido nesta rodada (doc-only); recomendação registrada no catálogo | Leitura de código |
| 8.2 | Ler `Tarefas.tsx`/`useDayCenterData.ts`/`DayCenter.tsx` por copy remanescente de "100% local" | Nenhum encontrado — `useDayCenterData.ts` já corrigido (rodada B4), `Tarefas.tsx` nunca teve banner de fonte de dados | Leitura de código |

---

**Caso 9 — Campos pós-flip (scope/tags/recurrence/reminders) não bloqueiam, mas também NÃO sincronizam ainda (achado de honestidade #1 — AGRAVADO na execução ao vivo)**

**Diferente do texto original do pacote §6.2 item 9** ("aviso explícito aparece") — não existe nenhum aviso na UI hoje (`grep` por "aviso"/texto equivalente em `Tarefas.tsx` → zero resultados). **Correção pós-execução (homologação ao vivo, `docs/qa/etapa-5-flip-tarefas-homologacao-fase-d.md`)**: pra uma tarefa da NUVEM (id uuid), o comportamento é PIOR do que "salva local, sem aviso" — a própria edição não se sustenta na tela. Mecanismo: o mapper hardcoda esses campos como neutros na leitura (o valor exibido nunca reflete uma edição anterior), e o patch de escrita (`updateTaskLocal`, ramo local de `splitTaskUpdatePatch`) tenta achar a tarefa no store local por `id` — como a tarefa nunca existiu localmente, o `.map` de `useTasks()` não bate em nada, e o próximo re-render (via `useBifurcatedTasks`) reverte o campo pro valor neutro de sempre. Pra uma tarefa LOCAL (criada antes do flip ou em modo local), o comportamento original (persiste local, sem aviso) continua valendo.

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 9.1 | Em modo Supabase, numa tarefa da NUVEM (id uuid), tentar definir `scope`/`tags`/`recorrência`/lembrete pelo detail sheet | **A edição NÃO se sustenta na tela** — o select/campo volta pro valor anterior no próximo render (patch local não encontra a tarefa no store) | Visual — reabrir o detail sheet da mesma tarefa mostra o valor neutro de sempre, não o que foi digitado |
| 9.2 | — | Nenhuma das 4 colunas novas recebe o valor, apesar de existirem no schema (mapper não lê/escreve ainda) | `SELECT scope, tags, recurrence, reminder_at, reminder_enabled FROM public.tasks WHERE title = '<tarefa da nuvem testada>';` → `scope`/`recurrence`/`reminder_at` `NULL`, `tags = '{}'`, `reminder_enabled = false` |
| 9.3 | Repetir o passo 9.1 numa tarefa LOCAL (criada antes do flip ou em modo local) | Comportamento original — salva normalmente NA TELA (via `updateTaskLocal`, que encontra a tarefa no store local), sem nenhum aviso de que é local-only | Visual |

**Não é vermelho** — é o comportamento real dado o estado do código (mapper não lê as colunas). **Prioridade do follow-up elevada pra ALTA** nesta rodada: o gap é mais visível ao usuário (edição nem se sustenta) do que a análise doc-only original previa. Decisão de produto a alinhar com o operador antes de considerar o flip "completo" pro conjunto inteiro de campos.

---

**Caso 10 — Limpeza**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 10.1 | Soft-delete/arquivar todas as tarefas sintéticas (`HOMOLOG-TAR-tarefa-A/base/quote`), limpar chaves de `localStorage` setadas manualmente (incluindo os 2 overrides de flag do §2.3, se usados) | Estado volta a "usuário novo" | — |
| 10.2 | — | Resíduo zero | `SELECT count(*) FROM public.tasks WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND title LIKE 'HOMOLOG-TAR-%' AND deleted_at IS NULL;` → 0 |

---

## 4. Critérios de vermelho vs. ressalva vs. achado

- **Vermelho (para a homologação):** o comportamento observado ao vivo diverge do comportamento desenhado/documentado. Aciona: diagnóstico → correção → novo commit → **PARADO** → aguardar novo "vai". **O Caso 2.3 (CHECK de status) é vermelho automático** se o UPDATE inválido não falhar. **O Caso 4-bis é vermelho automático** se o deep link não abrir/destacar em modo Supabase.
- **Ressalva (não bloqueia):** mecanismo já provado correto por outra via e só uma recaptura específica não foi refeita. Decisão de não reabrir deve ser registrada explicitamente.
- **Achado catalogado, não é bug:** o Caso 7.2 (`QuoteToProjectDialog` 100% local) e o Caso 9 (campos pós-flip sem sincronização) são exatamente isso — comportamento real, documentado, não incidente. Não fecham a homologação como vermelho; fecham como decisão de produto pendente, registrada explicitamente no sign-off.
- **Placar de fechamento:** formato herdado — `N/10 casos verdes, com o Caso 2.3 obrigatoriamente incluindo prova SQL do CHECK e o Caso 4-bis obrigatoriamente incluindo prova do deep link uuid — nenhum dos dois pode fechar como "assumido correto"; Casos 7.2 e 9 fecham como achado/decisão pendente, não como vermelho nem como verde pleno`.

---

## 5. O que este doc NÃO faz

- Não executa nenhum caso — é o runbook PRONTO, a execução real é do operador guiado pelo revisor.
- Não corrige o mapper (`tasksMapper.ts`) pra ler/escrever `scope`/`tags`/`recurrence`/`reminder_*` — recomendação registrada (achado de honestidade #1), não implementada.
- Não corrige o comentário desatualizado de `ProjectDetailDrawer.tsx` (G78) — catalogado, não corrigido (doc-only).
- Não constrói o espelho G22 de `QuoteToProjectDialog.tsx` pra tasks — gap conhecido, registrado, fora de escopo desta rodada.
- Não promove os 5 drafts de migration a arquivos `.sql` versionados — isso é trabalho da Lane D (`etapa-5-tarefas-migrations-drafts-arquivos`), independente do gate de banco já satisfeito.
- Não substitui os gates permanentes do protocolo (EXPORT MANUAL, PRINT PRÉ-CLIQUE, prova de servidor §17).

---

**HOMOLOGADO — 2026-08-30.** Execução ao vivo concluída, 12/12 casos sem vermelho (2 ressalvas). Ver [`etapa-5-flip-tarefas-homologacao-fase-d.md`](etapa-5-flip-tarefas-homologacao-fase-d.md) pro placar completo, detalhe por caso e veredito de sign-off. Follow-ups liberados (não bloqueiam este sign-off): mapper de 4 colunas (prioridade ALTA), G78, G79, decisão de produto do Caso 7.2, promoção dos drafts de migration a arquivos `.sql`. §18: doc-only, aguardando "vai" pra push/merge deste fechamento.
