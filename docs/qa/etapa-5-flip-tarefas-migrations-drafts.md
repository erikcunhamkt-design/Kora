# Etapa 5 — G1/Tarefas — Fase B, fatia B1 — drafts de migration

> **Nada aplicado.** Este doc guarda os 5 DRAFTS de migration da fatia B1 do
> pacote do Flip de Tarefas ([`etapa-5-flip-tarefas-pacote.md`](etapa-5-flip-tarefas-pacote.md)
> §1.1 — os 4 campos bloqueantes — e §3.1 item 2 — CHECK de vocabulário de
> `status`/`priority`, liberado pelo fix do G49, confirmado mesclado no
> adendo de revalidação de 16/ago daquele pacote). Molde de formato:
> `docs/qa/etapa-5-flip-clientes-rodada3-check-drafts.md` (draft de
> migration + gate de aplicação, nada rodado pelo Code).
>
> **Gate de aplicação — vale pros 5 drafts:**
> 1. Code não roda DDL contra produção (protocolo §0/§6/§8-b) — aplicação é
>    sempre do operador, via Supabase CLI/dashboard, na próxima sessão
>    §8-b (juntar à lista existente de migrations pendentes).
> 2. Cada draft tem sua própria verificação prévia embutida — rodar de
>    novo NA HORA de aplicar, não confiar em nenhum resultado registrado
>    neste doc ou em `tarefas-r2-auditoria.md` (mesa vazia em 15/ago não é
>    garantia permanente — o pacote já registra isso em §2, "os 2 caminhos
>    continuam existindo e continuam capazes de gerar divergência a partir
>    de agora").

---

## 0. Estado herdado, confirmado por leitura direta nesta rodada

- `public.tasks` (`20260601040000_create_tasks_schema.sql`): `status TEXT NOT NULL DEFAULT 'todo'`,
  `priority TEXT NOT NULL DEFAULT 'medium'` — **os 2 defaults de coluna continuam em
  inglês (legado)**, mesmo depois do G49 ter corrigido os 2 produtores que
  escrevem esses campos. Achado próprio desta rodada, não estava no desenho
  original do §3.1 do pacote — ver §5 abaixo (a migration do CHECK também
  troca o `DEFAULT`, senão o CHECK vira uma armadilha pro primeiro `INSERT`
  que confiar nele em vez de gravar o valor explicitamente).
- Vocabulário local confirmado em `src/hooks/useTasks.ts:5-8` (fonte única,
  não pelo tipo TS sozinho — mesma disciplina do G40/G49): `TaskStatus =
  "a_fazer" | "em_andamento" | "revisao" | "concluido"`; `TaskPriority =
  "alta" | "média" | "baixa"`; `TaskRecurrence = "none" | "daily" | "weekly"
  | "monthly" | "weekdays"`; `TaskScope = "work" | "personal"`.
- `mapLocalTaskToSupabase` (`tasksMapper.ts:92-93`) grava `status`/`priority`
  direto do `Task` local, sempre explícito — nunca omite a coluna, nunca
  depende do `DEFAULT` do banco. `CreateProjectBaseTasksDialog.tsx` (G49,
  FECHADO) e `updateTaskStatus` (G40, FECHADO) idem. **Nenhum produtor
  confirmado hoje depende do `DEFAULT` da coluna** — o risco do `DEFAULT`
  em inglês é só sobre o FUTURO (um produtor novo, ou um `INSERT` manual do
  operador, que omita a coluna sem saber do contrato).

---

## 1. Migration — `tasks.scope`

```sql
-- Etapa 5 · Tarefas Fase B (docs/qa/etapa-5-flip-tarefas-pacote.md §1.1) —
-- campo bloqueante 1 de 4: `scope` particiona Tarefas.tsx em "Trabalho"/
-- "Pessoal" (filterScope, Tarefas.tsx:202,335,492). Vocabulário fechado,
-- definido pelo produto — CHECK preventivo (coluna nova, sem dado
-- existente pode violar: toda linha atual recebe NULL, e NULL passa no
-- CHECK abaixo).
--
-- PROPOSTA — NÃO aplicada pelo Code (protocolo §0/§6/§8-b).
--
-- Verificação prévia: confirma que a coluna ainda não existe (evita erro
-- de "column already exists" se outra lane já tiver adiantado parte da
-- Fase B de Tarefas por engano — mesmo catálogo compartilhado, várias
-- lanes em voo).
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'scope';
-- Esperado: 0 linhas.

ALTER TABLE public.tasks
  ADD COLUMN scope text NULL,
  ADD CONSTRAINT tasks_scope_known_chk
    CHECK (scope IS NULL OR scope IN ('work', 'personal'));
```

---

## 2. Migration — `tasks.tags`

```sql
-- Etapa 5 · Tarefas Fase B (etapa-5-flip-tarefas-pacote.md §1.1) — campo
-- bloqueante 2 de 4: `tags[]` filtra a lista principal (filterTag,
-- Tarefas.tsx:334,828,977,1387) e aparece como badge no card. Campo LIVRE
-- (definido pelo usuário, sem lista fechada) — sem CHECK, mesmo
-- tratamento que `category` livre em outros domínios.
--
-- PROPOSTA — NÃO aplicada pelo Code (protocolo §0/§6/§8-b).
--
-- Verificação prévia: mesma checagem de existência de coluna do draft
-- acima.
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'tags';
-- Esperado: 0 linhas.

ALTER TABLE public.tasks
  ADD COLUMN tags text[] NULL DEFAULT '{}';
```

---

## 3. Migration — `tasks.recurrence`

```sql
-- Etapa 5 · Tarefas Fase B (etapa-5-flip-tarefas-pacote.md §1.1) — campo
-- bloqueante 3 de 4: `recurrence` é só um enum de 5 valores gravado no
-- próprio registro (Task.recurrence, useTasks.ts:7) — confirmado por grep
-- exaustivo que NÃO existe mecanismo de geração de próxima ocorrência (nem
-- client-side, nem server-side); é 1 coluna + CHECK, não um domínio novo
-- (diferente de RecurringEntry de Financeiro).
--
-- PROPOSTA — NÃO aplicada pelo Code (protocolo §0/§6/§8-b).
--
-- Verificação prévia: mesma checagem de existência de coluna dos drafts
-- acima.
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'recurrence';
-- Esperado: 0 linhas.

ALTER TABLE public.tasks
  ADD COLUMN recurrence text NULL,
  ADD CONSTRAINT tasks_recurrence_known_chk
    CHECK (recurrence IS NULL OR recurrence IN ('none', 'daily', 'weekly', 'monthly', 'weekdays'));
```

---

## 4. Migration — lembretes (`reminder_at`/`reminder_enabled`/`reminder_sent_at`)

```sql
-- Etapa 5 · Tarefas Fase B (etapa-5-flip-tarefas-pacote.md §1.1) — campo
-- bloqueante 4 de 4: 3 colunas simples, sem tabela nova. useTaskReminders.ts
-- já dispara notificação 100% client-side (setInterval 30s + Notification
-- API) — uma vez que useBifurcatedTasks exista (Fase B, fora deste doc), o
-- hook só precisa trocar a fonte de dados (já usa o padrão latest-ref,
-- pré-G31) pro lembrete continuar funcionando sem arquitetura nova.
-- reminder_enabled tem DEFAULT seguro (false) — não precisa de CHECK
-- (boolean já é vocabulário fechado por tipo; timestamptz idem).
--
-- PROPOSTA — NÃO aplicada pelo Code (protocolo §0/§6/§8-b).
--
-- Verificação prévia: confirma que nenhuma das 3 colunas já existe.
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'tasks'
--     AND column_name IN ('reminder_at', 'reminder_enabled', 'reminder_sent_at');
-- Esperado: 0 linhas.

ALTER TABLE public.tasks
  ADD COLUMN reminder_at timestamptz NULL,
  ADD COLUMN reminder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN reminder_sent_at timestamptz NULL;
```

---

## 5. Migration — CHECK de vocabulário `status`/`priority` (§3.1 item 2)

Diferente dos 4 drafts acima (colunas NOVAS, sem dado existente que possa
violar o CHECK): `status`/`priority` **já existem, já têm dado, já são
`NOT NULL`** desde a criação da tabela (`20260601040000_create_tasks_schema.sql`).
Esta migration só fica segura porque duas condições, as duas confirmadas
por leitura direta nesta rodada — **não supor, reconfirmar na hora de
aplicar**:

1. **G49 mesclado** — `CreateProjectBaseTasksDialog.tsx` grava `"a_fazer"`/
   `"alta"`\|`"média"`\|`"baixa"` desde o commit `54f7fea` (confirmado no
   adendo de revalidação de 16/ago de `etapa-5-flip-tarefas-pacote.md`,
   §Adendo, linha do item "§3.1"). Antes disso, o CHECK abaixo quebraria o
   próximo `INSERT` desse produtor na hora.
2. **Mesa vazia em `public.tasks`** — confirmado por 8 SQLs rodadas em
   15/ago/2026 (`tarefas-r2-auditoria.md` §4, 0 linhas em todas). **Não é
   garantia permanente** (o próprio pacote registra isso) — por isso as 2
   queries abaixo precisam ser rodadas DE NOVO no momento de aplicar esta
   migration, não reaproveitar o resultado de 15/ago.

```sql
-- Etapa 5 · Tarefas Fase B (etapa-5-flip-tarefas-pacote.md §3.1, item 2 da
-- sequência proposta) — CHECK preventivo de status/priority, liberado
-- pelo fix do G49 (produtor CreateProjectBaseTasksDialog.tsx corrigido,
-- confirmado mesclado). Mesmo molde de
-- 20260815000200_etapa5_flip_financeiro_type_status_known_chk.sql (CHECK +
-- SELECTs de verificação no corpo da migration).
--
-- PROPOSTA — NÃO aplicada pelo Code (protocolo §0/§6/§8-b).
--
-- Passo do operador ANTES de aplicar — RODAR DE NOVO, não reaproveitar o
-- resultado de tarefas-r2-auditoria.md (15/ago/2026, mesa vazia na época):
--   SELECT status, count(*) AS total FROM public.tasks WHERE deleted_at IS NULL GROUP BY status ORDER BY total DESC;
--   SELECT priority, count(*) AS total FROM public.tasks WHERE deleted_at IS NULL GROUP BY priority ORDER BY total DESC;
-- Esperado: só valores dentro do vocabulário abaixo (ou 0 linhas). Se
-- qualquer uma devolver um valor fora do vocabulário, PARAR — não aplicar
-- este CHECK sem decidir o que fazer com o dado divergente primeiro
-- (mesmo caminho de decisão do G56/Caso 4.3: investigar causa raiz antes
-- de travar o schema por cima de um sintoma).
--
-- Achado desta rodada, além do que §3.1 desenhou: os DEFAULTs da coluna
-- (`status DEFAULT 'todo'`, `priority DEFAULT 'medium'`, ambos legado em
-- inglês, herdados de 20260601040000_create_tasks_schema.sql) continuam
-- ativos mesmo com os 2 produtores já corrigidos (G40/G49) — nenhum
-- produtor confirmado hoje depende do DEFAULT (todos gravam o valor
-- explícito), mas sem trocar o DEFAULT junto com o CHECK, o PRÓXIMO
-- produtor (ou um INSERT manual do operador) que omitir a coluna e confiar
-- no DEFAULT quebraria o CHECK na hora — a mesma classe de armadilha que
-- este pacote já evitou nos 4 drafts acima (todos com DEFAULT seguro
-- desde o desenho). Por isso esta migration troca os 2 DEFAULTs pro
-- vocabulário atual, na mesma transação do CHECK.
ALTER TABLE public.tasks
  ALTER COLUMN status SET DEFAULT 'a_fazer',
  ALTER COLUMN priority SET DEFAULT 'média',
  ADD CONSTRAINT tasks_status_known_chk
    CHECK (status IN ('a_fazer', 'em_andamento', 'revisao', 'concluido')),
  ADD CONSTRAINT tasks_priority_known_chk
    CHECK (priority IN ('alta', 'média', 'baixa'));
```

---

## Referências

- [`etapa-5-flip-tarefas-pacote.md`](etapa-5-flip-tarefas-pacote.md) §1.1
  (4 campos bloqueantes, SQL original combinado — esta rodada separa em 4
  drafts independentes) e §3.1 (CHECK de status/priority, condicionado ao
  G49 — confirmado mesclado no Adendo de revalidação de 16/ago).
- [`tarefas-r2-auditoria.md`](tarefas-r2-auditoria.md) §1.4/§1.9 (queries de
  vocabulário em uso, molde reaproveitado no draft 5) e §4 (resultado de
  15/ago, mesa vazia — não reaproveitado como prova, só como contexto).
- `docs/architecture/kora-hub-auditoria-e-plano.md` — G40 (vocabulário de
  `status`, 1º produtor), G49 (vocabulário de `status`/`priority`, 2º
  produtor, FECHADO).
- `supabase/migrations/20260601040000_create_tasks_schema.sql` — schema
  atual de `public.tasks`, base de §0 (DEFAULTs legados) e dos 5 drafts.
- `supabase/migrations/20260815000200_etapa5_flip_financeiro_type_status_known_chk.sql`
  — precedente direto de formato pro draft 5 (CHECK + SELECTs de
  verificação no corpo da migration).
- `docs/qa/etapa-5-flip-clientes-rodada3-check-drafts.md` — precedente de
  formato geral (draft de migration + gate de aplicação, nada rodado pelo
  Code), molde desta doc inteira.

**PARADO aqui — só drafts, nada em `supabase/migrations/` ainda. §18.**
