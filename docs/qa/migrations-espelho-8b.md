# Migrations já aplicadas pelo operador (§8-b) — espelho pra `supabase/migrations/`

> **STATUS (2026-08-30): as 5 categorias pedidas estão espelhadas — 9 arquivos.**
> A rodada anterior (abaixo, §1/§2 originais) tinha espelhado só 1 categoria
> (`completed_at`) e reportado as outras 4 como "não confirmadas como
> aplicadas" — divergência correta de se reportar na hora, não uma suposição.
> O revisor agora dá confirmação explícita e fora do repo (sessão §8-b
> executada ao vivo com o operador em 2026-08-30, resultados no SQL Editor
> via `information_schema`/`pg_constraint`/`pg_policies`) de que as 4
> categorias restantes TAMBÉM foram aplicadas nessa mesma sessão — e autoriza
> expressamente o espelho das 5 migrations de Tasks (branch obsoleto da Lane
> D, `98644bf`, **não usado**; este espelho é novo, feito aqui). O texto
> original de §2 (abaixo) é o registro correto do estado até esta rodada —
> preservado, não reescrito; só marcado como superado pela tabela de §1 nesta
> revisão.

---

## 1. Tabela completa — arquivo ↔ draft ↔ prova (9 migrations, série `20260830`)

Ordem = ordem real de aplicação em produção (sessão §8-b, 2026-08-30), não
ordem de redação dos drafts.

| # | Arquivo | Draft de origem | Objeto(s) | Nome(s) confirmado(s)? |
|---|---|---|---|---|
| 1 | `20260830000100_etapa5_flip_tarefas_scope.sql` | `etapa-5-flip-tarefas-migrations-drafts.md` §1 | coluna `tasks.scope` + `tasks_scope_known_chk` | coluna: sim (comportamento); constraint: **a confirmar com SELECT** |
| 2 | `20260830000200_etapa5_flip_tarefas_tags.sql` | idem §2 | coluna `tasks.tags` (sem CHECK) | sim (comportamento; não há nome de constraint aqui) |
| 3 | `20260830000300_etapa5_flip_tarefas_recurrence.sql` | idem §3 | coluna `tasks.recurrence` + `tasks_recurrence_known_chk` | coluna: sim; constraint: **a confirmar com SELECT** |
| 4 | `20260830000400_etapa5_flip_tarefas_reminders.sql` | idem §4 | colunas `tasks.reminder_at`/`reminder_enabled`/`reminder_sent_at` (sem CHECK) | sim (comportamento; sem constraint) |
| 5 | `20260830000500_etapa5_flip_tarefas_status_priority_chk.sql` | idem §5 | `DEFAULT` de `tasks.status`/`tasks.priority` + `tasks_status_known_chk` + `tasks_priority_known_chk` | `tasks_status_known_chk`: **sim, nome literal confirmado** (erro 23514 observado em produção citando esse nome, `etapa-5-flip-tarefas-homologacao-fase-d.md` Caso 2.3); `tasks_priority_known_chk`: **a confirmar com SELECT** |
| 6 | `20260830000600_etapa5_flip_clientes_crm_known_chk.sql` | `etapa-5-flip-clientes-rodada3-check-drafts.md` §2 + `etapa-5-flip-crm-rodada3-check-drafts.md` §5 | `clients_status_known_chk`, `clients_temperature_known_chk`, `crm_opportunities_status_known_chk`, `crm_opportunities_temperature_known_chk`, `crm_opportunities_priority_known_chk` | todas 5: **a confirmar com SELECT** (comportamento/vocabulário confirmados; nomes literais não re-verificados um a um) |
| 7 | `20260830000700_etapa5_flip_projetos_completed_at.sql` | `etapa-5-flip-projetos-pacote.md` §7 | coluna `projects.completed_at` (sem CHECK) | sim (coluna já confirmada em `types.ts` + mapper/hook, rodada anterior) |
| 8 | `20260830000800_g71_workspace_ai_credentials_admin_rls.sql` | `g71-credenciais-terceiros-pacote-operador.md` §3.1 | 3 policies RLS (`INSERT`/`UPDATE`/`DELETE`) em `workspace_ai_credentials`, admin-gated | **a confirmar com SELECT** (comportamento confirmado; nomes literais não re-verificados) |
| 9 | `20260830000900_g71_whatsapp_bot_settings_admin_rls.sql` | idem §3.2 | 3 policies RLS (`INSERT`/`UPDATE`/`DELETE`) em `whatsapp_bot_settings`, admin-gated | **a confirmar com SELECT** (comportamento confirmado; nomes literais não re-verificados) |

**Prova de aplicação, comum aos 9**: confirmação do revisor nesta rodada —
sessão §8-b executada ao vivo com o operador em 2026-08-30, resultados
verificados no SQL Editor via `information_schema` (colunas), `pg_constraint`
(CHECKs) e `pg_policies` (RLS). Prova fora do repo — nenhum SELECT dessa
sessão foi colado nos docs; os SELECTs listados abaixo são os passos que o
operador roda pra re-confirmar os NOMES literais que ainda não foram
individualmente verificados (ver coluna "Nome(s) confirmado(s)?" acima).

**SELECTs de confirmação de nome, por tabela** (rodar e comparar com os
nomes usados nos arquivos acima — se algum nome devolvido divergir, ajustar
o arquivo antes de considerá-lo redundante num novo `db push`):

```sql
-- tasks (arquivos 1, 3, 5)
SELECT conname FROM pg_constraint WHERE conrelid = 'public.tasks'::regclass AND contype = 'c';

-- clients + crm_opportunities (arquivo 6)
SELECT conname FROM pg_constraint WHERE conrelid = 'public.clients'::regclass AND contype = 'c';
SELECT conname FROM pg_constraint WHERE conrelid = 'public.crm_opportunities'::regclass AND contype = 'c';

-- workspace_ai_credentials (arquivo 8)
SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_ai_credentials';

-- whatsapp_bot_settings (arquivo 9)
SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'whatsapp_bot_settings';
```

**Fora do escopo desta série, por design — nunca migration**:
- `crm_opportunities.stage` — deliberadamente SEM CHECK (dinâmico, pipelines
  customizados via "Gerenciar funis"). Não incluído no arquivo 6 nem em
  nenhum outro.
- `workspace_ai_credentials`/`whatsapp_bot_settings` §2 (UPDATE de
  remediação do pacote do operador G71 — strip de credencial duplicada já
  gravada em `flow_data`) — é DML pontual, roda uma vez, não é schema. Rodou
  na mesma sessão §8-b com resultado `count 0` (nenhuma linha afetada —
  nada pra remediar no dado já gravado). Nunca vira arquivo em
  `supabase/migrations/`.
- `bot_flow_state` (draft do R1 do fluxo scriptado, Etapa 9) — fora de
  escopo por instrução explícita desde a rodada anterior; sem evidência de
  aplicação, não investigado além disso.

---

## 2. Passo do operador — registrar as 9 versões

Um único comando, listando as 9 versões em sequência (a flag `--status
applied` registra cada versão no histórico do CLI **sem rodar o SQL de
novo** — os objetos já existem em produção):

```bash
supabase migration repair --status applied \
  20260830000100 20260830000200 20260830000300 20260830000400 20260830000500 \
  20260830000600 20260830000700 20260830000800 20260830000900
```

Se o CLI não aceitar múltiplas versões em uma chamada só nesta versão
instalada, rodar uma chamada por versão, na mesma ordem.

**Antes de registrar**: rodar os 4 SELECTs de §1 acima e comparar os nomes
devolvidos com os nomes usados nos arquivos. Qualquer divergência de nome
precisa ser corrigida no arquivo `.sql` correspondente ANTES do `repair` —
registrar a versão como aplicada não valida o conteúdo do arquivo, só marca
a versão como "não rodar de novo".

---

## §2 original (rodada anterior) — preservado, superado pela tabela de §1

> **Escopo desta rodada: 1 de 5 categorias pedidas.** Investigação (zero DDL
> rodado — protocolo §0/§6) encontrou **divergência entre a premissa da
> tarefa ("já aplicadas em produção") e o que os próprios docs do repo
> registram** pra 4 das 5 categorias. Reportando em vez de adivinhar, como
> pedido — só a categoria com prova de aplicação CONFIRMADA e sem trabalho
> de outra lane em voo foi espelhada.

### O que FOI espelhado (rodada anterior)

#### `20260830000700_etapa5_flip_projetos_completed_at.sql` (arquivo 7 da tabela de §1)

| | |
|---|---|
| **Draft de origem** | `docs/qa/etapa-5-flip-projetos-pacote.md` §7 |
| **Prova de aplicação** | `projects.completed_at` presente em `src/integrations/supabase/types.ts` (Row/Insert/Update, regenerado por introspecção real do schema) **e** já consumido por `src/services/projects/projectsMapper.ts`/`src/hooks/useSupabaseProjects.ts` (ver `docs/qa/etapa-5-projects-completed-at.md`: "coluna já existe no banco; aplicada pelo operador; nenhuma DDL nesta rodada") |
| **Data exata da aplicação** | **2026-08-30, sessão §8-b** — confirmação do revisor (prova fora do repo: sessão executada ao vivo com o operador, resultados no SQL Editor). Arquivo renomeado de `20260816000100` (placeholder da rodada anterior, data não confirmada) pra `20260830000700`, série real de aplicação. |

Sem CHECK (coluna é timestamp livre, não vocabulário fechado) — SQL idempotente (`ADD COLUMN IF NOT EXISTS`).

### O que NÃO foi espelhado na rodada anterior, e por quê (agora TODAS resolvidas em §1)

#### 2.1 Tasks (5 migrations — `scope`/`tags`/`recurrence`/`reminder_*`/CHECK status-priority)

**Aplicação CONFIRMADA** — `docs/qa/etapa-5-flip-tarefas-runbook.md` §1.3: *"aplicadas pelo operador na sessão §8-b de hoje, 5/5 confirmadas (colunas + CHECKs existem em `public.tasks`)"*.

**Não espelhada naquela rodada**: o mesmo runbook registrava que a Lane D trabalhava nisso separadamente (`etapa-5-tarefas-migrations-drafts-arquivos`, `98644bf`, não mesclado) — espelhar ali teria duplicado o trabalho.

**RESOLVIDO nesta rodada**: o revisor confirma que o branch da Lane D (`98644bf`) está **obsoleto** e autoriza explicitamente que o espelho das 5 migrations de Tasks seja feito aqui — arquivos 1-5 da tabela de §1.

#### 2.2 CHECK de Clientes (`clients_status_known_chk`/`clients_temperature_known_chk`)

**Aplicação NÃO confirmada** naquela rodada — os drafts abriam com "Nada aplicado" e fechavam com "PARADO aqui — só drafts".

**RESOLVIDO nesta rodada**: confirmação explícita do revisor (sessão §8-b, 2026-08-30) — arquivo 6 da tabela de §1 (combinado com CRM).

#### 2.3 CHECK de CRM (`crm_opportunities_status/temperature/priority_known_chk`)

**Mesmo achado que 2.2** — **RESOLVIDO nesta rodada**, mesmo arquivo 6. `stage` permanece deliberadamente excluído (ver §1, "Fora do escopo"). Vocabulário de `temperature` desta tabela é DIFERENTE do de `clients.temperature` (minúsculo + 4 valores vs. maiúsculo + 3 valores) — os 2 CHECKs nunca compartilham lista de valores.

#### 2.4 RLS do G71 (`workspace_ai_credentials`/`whatsapp_bot_settings`, escrita → admin)

**Aplicação NÃO confirmada** naquela rodada — a entrada G71 do catálogo mestre dizia "seguem em pacote do operador".

**RESOLVIDO nesta rodada**: confirmação explícita do revisor (sessão §8-b, 2026-08-30) — arquivos 8 e 9 da tabela de §1. Catálogo G71 atualizado (`docs/architecture/kora-hub-auditoria-e-plano.md`) pra "FECHADO". A remediação de dado (§2 do pacote, UPDATE, DML) também rodou nessa sessão, resultado `count 0` — nunca vira migration, ver "Fora do escopo" em §1.

---

## Referências

- `docs/qa/etapa-5-flip-tarefas-migrations-drafts.md` §1-§5 — drafts de origem dos arquivos 1-5.
- `docs/qa/etapa-5-flip-tarefas-homologacao-fase-d.md` Caso 2.3 — confirmação literal do nome `tasks_status_known_chk` via erro 23514 observado.
- `docs/qa/etapa-5-flip-clientes-rodada3-check-drafts.md` §2 — draft de origem de `clients_status_known_chk`/`clients_temperature_known_chk` (arquivo 6).
- `docs/qa/etapa-5-flip-crm-rodada3-check-drafts.md` §5 — draft de origem dos 3 CHECKs de `crm_opportunities` (arquivo 6); §1 — exclusão deliberada de `stage`; §3 — divergência de vocabulário de `temperature` entre as 2 tabelas.
- `docs/qa/etapa-5-flip-projetos-pacote.md` §7 — draft de origem do arquivo 7.
- `docs/qa/etapa-5-projects-completed-at.md` — confirmação de aplicação + wiring do mapper (Lane A).
- `docs/qa/g71-credenciais-terceiros-pacote-operador.md` §3.1/§3.2 — drafts de origem dos arquivos 8/9; §2 — UPDATE de remediação (DML, nunca migration).
- `docs/architecture/kora-hub-auditoria-e-plano.md` (entrada G71) — catálogo atualizado pra "FECHADO" nesta rodada.

**PARADO aqui — commit local, sem push/merge. §18.**
