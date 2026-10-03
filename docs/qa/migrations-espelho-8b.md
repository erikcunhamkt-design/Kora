# Migrations já aplicadas pelo operador (§8-b) — espelho pra `supabase/migrations/`

> **Escopo desta rodada: 1 de 5 categorias pedidas.** Investigação (zero DDL
> rodado — protocolo §0/§6) encontrou **divergência entre a premissa da
> tarefa ("já aplicadas em produção") e o que os próprios docs do repo
> registram** pra 4 das 5 categorias. Reportando em vez de adivinhar, como
> pedido — só a categoria com prova de aplicação CONFIRMADA e sem trabalho
> de outra lane em voo foi espelhada.

---

## 1. O que FOI espelhado

### `20260830000700_etapa5_flip_projetos_completed_at.sql`

| | |
|---|---|
| **Draft de origem** | `docs/qa/etapa-5-flip-projetos-pacote.md` §7 |
| **Prova de aplicação** | `projects.completed_at` presente em `src/integrations/supabase/types.ts` (Row/Insert/Update, regenerado por introspecção real do schema) **e** já consumido por `src/services/projects/projectsMapper.ts`/`src/hooks/useSupabaseProjects.ts` (ver `docs/qa/etapa-5-projects-completed-at.md`: "coluna já existe no banco; aplicada pelo operador; nenhuma DDL nesta rodada") |
| **Data exata da aplicação** | **2026-08-30, sessão §8-b** — confirmação do revisor nesta rodada (prova fora do repo: sessão executada ao vivo com o operador, resultados no SQL Editor). Arquivo renomeado de `20260816000100` (placeholder da rodada anterior, data não confirmada) pra `20260830000700`, série real de aplicação. |
| **Passo do operador** | `supabase migration repair --status applied 20260830000700` (registra esta versão como já aplicada no histórico do CLI, sem rodar o SQL de novo) |

Sem CHECK (coluna é timestamp livre, não vocabulário fechado) — SQL idempotente (`ADD COLUMN IF NOT EXISTS`).

---

## 2. O que NÃO foi espelhado, e por quê (reportado, não adivinhado)

### 2.1 Tasks (5 migrations — `scope`/`tags`/`recurrence`/`reminder_*`/CHECK status-priority)

**Aplicação CONFIRMADA** — `docs/qa/etapa-5-flip-tarefas-runbook.md` §1.3: *"aplicadas pelo operador na sessão §8-b de hoje, 5/5 confirmadas (colunas + CHECKs existem em `public.tasks`)"*, com as 2 SELECTs de verificação de vocabulário reproduzidas (vieram vazias antes do CHECK). Prova sólida, sem ambiguidade.

**Não espelhada mesmo assim**: o MESMO runbook (linha seguinte, §Abertura) registra que **outra lane já está fazendo exatamente este trabalho**: *"os arquivos `.sql` correspondentes ainda não foram promovidos... (Lane D trabalha nisso separadamente, `etapa-5-tarefas-migrations-drafts-arquivos`, `98644bf`, não mesclado)"*. Confirmei por `git fetch` que esse branch ainda não chegou em `main` (nenhum arquivo `*scope*chk*`/`*tasks_status_known_chk*` existe em `supabase/migrations/` hoje) — mas segue em voo. Espelhar aqui TAMBÉM duplicaria o trabalho e quase certamente colidiria (2 lanes criando arquivo pra constraint com o mesmo nome, timestamps diferentes) quando os dois branches tentarem mesclar.

**Recomendação**: coordenar com a Lane D (`etapa-5-tarefas-migrations-drafts-arquivos`) em vez de eu duplicar — ou, se o revisor preferir que eu assuma, avisar a Lane D pra abandonar o branch dela primeiro.

### 2.2 CHECK de Clientes (`clients_status_known_chk`/`clients_temperature_known_chk`)

**Aplicação NÃO confirmada** — pelo contrário: `docs/qa/etapa-5-flip-clientes-pacote.md` linha 415-416 registra, no estado atual do próprio pacote, *"**Rodada 3 (candidata, backlog do operador — pós-Fase D)**... **ainda não iniciada**"*. O draft (`etapa-5-flip-clientes-rodada3-check-drafts.md`) abre com "**Nada aplicado**" e fecha com "**PARADO aqui — só drafts, nada em `supabase/migrations/` ainda**" — e não encontrei nenhum doc mais recente contradizendo isso (busquei por `clients_status_known_chk` em todo `docs/`, só aparece nos 2 docs de draft, nenhuma confirmação).

**Não espelhada**: espelhar uma migration que não foi confirmada como aplicada criaria um arquivo FALSO no repo — o inverso exato do que esta rodada quer evitar (repo divergindo do banco real, só que na direção contrária).

### 2.3 CHECK de CRM (`crm_opportunities_status/temperature/priority_known_chk`)

**Mesmo achado que 2.2** — `etapa-5-flip-crm-rodada3-check-drafts.md` abre com "**Nada aplicado**" e fecha com "**PARADO aqui — só drafts, nada em `supabase/migrations/`**". Também confirma que `stage` foi **deliberadamente excluído** do CHECK (coluna genuinamente dinâmica — pipelines customizados via "Gerenciar funis"), então mesmo numa rodada futura de aplicação real, só as 3 colunas (`status`/`temperature`/`priority`) entram, nunca `stage` — registrado aqui pra não se perder.

**Achado extra do próprio draft, vale registrar pra quem decidir aplicar depois**: o vocabulário de `temperature` desta tabela é DIFERENTE do de `clients.temperature` (minúsculo + 4 valores vs. maiúsculo + 3 valores, sem `'não definida'` equivalente) — os 2 CHECKs (2.2 e 2.3) nunca devem compartilhar a mesma lista de valores.

### 2.4 RLS do G71 (`workspace_ai_credentials`/`whatsapp_bot_settings`, escrita → admin)

**Aplicação NÃO confirmada** — a entrada G71 do catálogo mestre (`docs/architecture/kora-hub-auditoria-e-plano.md`), no estado ATUAL (que eu mesmo escrevi e ninguém emendou desde), diz explicitamente: *"itens #4/#5 (RLS) e remediação de dado já gravado **seguem em pacote do operador**"* — ou seja, ainda pendentes. O pacote do operador (`docs/qa/g71-credenciais-terceiros-pacote-operador.md`) tem uma confirmação do revisor dizendo que aplicar **seria seguro** (workspace atual com 1 só owner) — mas "seguro aplicar" não é "foi aplicado". Não encontrei nenhuma confirmação de que o operador de fato rodou os 2 `DROP POLICY`/`CREATE POLICY`.

**Não espelhada** — mesmo raciocínio de 2.2/2.3: sem prova de aplicação, espelhar seria inventar um arquivo falso.

**Nota**: o UPDATE de remediação (§2 do mesmo pacote, strip de credencial já duplicada em `flow_data`) é DML pontual, não uma migration de schema — citado aqui só pra registrar que não entra em `supabase/migrations/` de qualquer forma, aplicado ou não.

---

## 3. Excluído de propósito (instrução explícita)

- **`bot_flow_state`** (draft do R1 do fluxo scriptado) — **NÃO aplicado ainda**, confirmado por ausência de qualquer menção de aplicação nos docs de Etapa 9/item 4 (R1/R2/R3 encontrados são todos sobre código de runtime do construtor visual, nenhum sobre uma migration de `bot_flow_state` rodada). Fora do escopo por instrução explícita da tarefa — não investigado a fundo além de confirmar que não achei evidência de aplicação (consistente com a instrução de excluir).

---

## 4. Resumo — o que o operador precisa fazer

Só 1 comando, pro único arquivo realmente espelhado:

```bash
supabase migration repair --status applied 20260830000700
```

Isso registra a versão no histórico do CLI **sem rodar o SQL de novo** (a coluna já existe). As outras 4 categorias não têm arquivo nenhum pra registrar nesta rodada — ver §2 acima pra cada uma precisar de confirmação (Clientes/CRM/G71 RLS) ou coordenação com a Lane D (Tasks) antes de qualquer arquivo novo.

---

## Referências

- `docs/qa/etapa-5-flip-projetos-pacote.md` §7 — draft de origem do único arquivo espelhado.
- `docs/qa/etapa-5-projects-completed-at.md` — confirmação de aplicação + wiring do mapper (Lane A).
- `docs/qa/etapa-5-tarefas-mapper-4colunas.md` §1 — achado incidental de `completed_at` na regeneração de `types.ts`.
- `docs/qa/etapa-5-flip-tarefas-runbook.md` §1.3/Abertura — confirmação de aplicação das 5 migrations de Tasks + referência ao branch em voo da Lane D (`98644bf`).
- `docs/qa/etapa-5-flip-clientes-pacote.md` (linha 415-416), `etapa-5-flip-clientes-rodada3-check-drafts.md` — Clientes, não aplicado.
- `docs/qa/etapa-5-flip-crm-rodada3-check-drafts.md` — CRM, não aplicado.
- `docs/architecture/kora-hub-auditoria-e-plano.md` (entrada G71) — RLS, não aplicado.
- `docs/qa/g71-credenciais-terceiros-pacote-operador.md` §3.1/§3.2 — drafts de RLS (não aplicados) e §2 (UPDATE de remediação, DML, nunca migration).

**PARADO aqui — commit local, sem push/merge. §18.**
