# Tarefas — Auditoria R2 (dado cloud já divergente) — SOMENTE LEITURA

> Aprofunda o risco **R2** catalogado em
> [`etapa-5-flip-tarefas-fase-a.md` §4](../architecture/etapa-5-flip-tarefas-fase-a.md#4-riscos-nomeados-r1rn):
> *"`public.tasks` e `useTasks()` local já divergem hoje, silenciosamente."* Este doc não decide
> nada — quantifica o tamanho do buraco (via SQL pronta pro operador rodar; o Code não acessa o
> banco) e mapeia exatamente quais escritas de hoje podem **ampliar** a divergência enquanto o
> flip real não vem. Zero código tocado. Nenhuma escrita proposta ou aplicada nesta rodada.

Branch: `tarefas-r2-auditoria`, a partir do tip real de `origin/main` em `ba8f748`
(`docs(projects): renumera G34 do espelho para G37 (colisao com Lane B)`).

---

## 1. Quantificação — SQL pronta pro operador rodar

Todas as queries abaixo são **`SELECT` puro, somente leitura** — nenhuma grava, atualiza ou
apaga nada. Rodar no SQL Editor do Supabase ou via `psql` (só leitura, sem gate de credencial
do protocolo — não é uma sessão de DDL).

**O que este bloco NÃO consegue responder:** se uma linha importada (`source_local_id IS NOT
NULL`) ainda bate campo-a-campo com o registro local correspondente hoje — isso exigiria
comparar contra o `orbyt.tasks.v1` do `localStorage` do navegador de cada usuário, que não é
consultável do banco. A query 8 (abaixo) usa `updated_at > created_at` como **proxy indireto**
("esta linha foi tocada depois de criada — vale checar se foi via `updateTaskStatus`"), não uma
prova de divergência de campo.

### 1.1 Total geral, por `source`, ativas vs. soft-deletadas

```sql
select
  source,
  count(*) as total,
  count(*) filter (where deleted_at is null) as ativas,
  count(*) filter (where deleted_at is not null) as soft_deletadas
from public.tasks
group by source
order by total desc;
```

### 1.2 O que NÃO tem correspondente local possível — `source_local_id IS NULL`

Toda linha `source_local_id IS NULL` **não pode vir do import geral** (que sempre grava essa
coluna — ver `tasksRepository.importTask`, obrigatório e validado no código). Ou é
`project_template` (gerador de tarefas-base, nativo da nuvem) ou uma linha legada anterior à
coluna existir. Esse subconjunto é, por definição, o "buraco" que um merge automático com o
array local não resolve sozinho.

```sql
select
  (source_local_id is null) as sem_source_local_id,
  source,
  count(*) as total
from public.tasks
where deleted_at is null
group by 1, 2
order by 1, 3 desc;
```

### 1.3 Por workspace (app é multi-tenant — o tamanho do buraco pode ser muito desigual)

```sql
select workspace_id, source, count(*) as total
from public.tasks
where deleted_at is null
group by workspace_id, source
order by workspace_id, total desc;
```

### 1.4 Vocabulário de `status` realmente em uso (checagem direta do risco R1)

Sem CHECK constraint na coluna (confirmado em `20260601040000_create_tasks_schema.sql`), então
qualquer string pode estar lá. Essa query mostra se algum valor fora de `todo/in_progress/done`
já vazou pra nuvem (ex.: um `"revisao"` gravado por engano, ou uma tentativa passada de escrita
com o vocabulário local em português).

```sql
select status, count(*) as total
from public.tasks
where deleted_at is null
group by status
order by total desc;
```

### 1.5 Idade do dado divergente — recência por `source`

Ajuda a calibrar urgência: se `project_template` já tem linhas de meses atrás, o buraco cresceu
faz tempo, silenciosamente; se é tudo recente, a janela de exposição é menor.

```sql
select
  source,
  min(created_at) as mais_antiga,
  max(created_at) as mais_recente,
  max(updated_at) as ultima_atualizacao
from public.tasks
where deleted_at is null
group by source;
```

### 1.6 Tarefas-base (`project_template`) por projeto

```sql
select project_id, count(*) as total_tarefas_base, min(created_at) as gerado_em
from public.tasks
where source = 'project_template' and deleted_at is null
group by project_id
order by gerado_em desc;
```

### 1.7 Linhas importadas do local (`source_local_id IS NOT NULL`) — volume de referência

Não é risco novo (é o caminho de reconciliação, não de ampliação — ver §2) — serve só de
contraponto de escala contra os totais acima.

```sql
select count(*) as importadas_com_source_local_id
from public.tasks
where source_local_id is not null and deleted_at is null;
```

### 1.8 Proxy indireto de possível drift de status pós-criação

`updated_at > created_at` (com margem de 1 minuto pra não pegar o próprio insert) sinaliza
linhas tocadas depois de criadas — candidatas a checar manualmente se o toque foi via
`updateTaskStatus` (§2.3) e, se a linha também tiver `source_local_id`, se o valor local
correspondente ainda bate.

```sql
select id, workspace_id, project_id, source, source_local_id, status, created_at, updated_at
from public.tasks
where deleted_at is null
  and updated_at > created_at + interval '1 minute'
order by updated_at desc
limit 50;
```

---

## 2. Caminhos de escrita ativos hoje em `public.tasks`

Todo acesso à tabela passa por **exatamente 5 métodos** em `src/repositories/tasksRepository.ts`
(confirmado por `grep '\.from("tasks")'` em todo `src/` — nenhum outro arquivo, nenhuma edge
function, nenhuma migration com `INSERT`/seed toca a tabela fora daqui).

| Método (`tasksRepository.ts`) | Operação | Chamador real (UI) | Gate (flag, default) |
|---|---|---|---|
| `listTasksByProject` (`:34`) | `SELECT` | `useSupabaseProjectTasks` → `SupabaseOperationalDashboardCard.tsx` | `supabaseOperationalDashboard` (OFF) |
| `createProjectBaseTasks` (`:48`) | `INSERT`, `source='project_template'`, sem `source_local_id` | `CreateProjectBaseTasksDialog.tsx:132` | `supabaseOperationalDashboard` **E** `projectsSupabaseCreateBaseTasks` (ambas OFF por padrão) |
| `softDeleteTask` (`:65`) | `UPDATE deleted_at` | **Nenhum** — zero chamadores em todo `src/` (confirmado por grep) | N/A — código morto, não é caminho ativo |
| `updateTaskStatus` (`:78`) | `UPDATE status` (só `todo\|in_progress\|done`) | `useSupabaseProjectTasks.updateStatus` → `SupabaseOperationalDashboardCard.tsx:62` | `supabaseOperationalDashboard` **E** `tasksSupabaseStatusTransition` (ambas OFF por padrão) |
| `importTask` (`:100`) | `UPSERT` por `(workspace_id, source_local_id)`, `source_local_id` obrigatório (guarda no código, `:108-110`) | `useLocalTasksImport.ts:206` → `LocalTasksImportCard.tsx` (aba Dados de Configurações) | **Nenhuma flag** — sempre acessível com workspace ativo, mesmo padrão dos outros importadores assistidos (clients/quotes/projects) |

Todos os 3 caminhos gated por flag exigem **duas** flags `true` simultaneamente (o painel em si
`supabaseOperationalDashboard` + a ação específica) — ambas default `false`
(`getBooleanFlag` só retorna `true` com o valor literal `"true"` gravado, confirmado em
`src/config/flags.ts:131-132`). `importTask` é o único caminho sem flag nenhuma.

### 2.1 `createProjectBaseTasks` — AMPLIA a divergência

Cada chamada cria linhas `source='project_template'` **sem `source_local_id`** — por desenho,
essas linhas nunca vão bater com nenhum registro do `import` geral (que só reconcilia por
`source_local_id`). Não existe hoje nenhum mecanismo que traga essas linhas de volta pro
`orbyt.tasks.v1` local. Cada clique em "gerar tarefas base" é dado novo que só existe na nuvem,
para sempre, até um flip decidir explicitamente o que fazer com ele (R2, já catalogado assim na
Fase A).

- **Guarda existente contra duplicação óbvia:** `CreateProjectBaseTasksDialog.tsx:107-113` — antes de inserir, faz `SELECT` e bloqueia (`toast.error`) se o projeto já tiver tarefas-base ativas. **Não elimina corrida TOCTOU** entre o `SELECT` de checagem e o `INSERT` (a própria migration `20260721000500_..._unique_source_local_id.sql` documenta isso como problema conhecido, não resolvido por índice — motivo: `sort_order` varia pela seleção do usuário no diálogo, não é uma chave fixa por tarefa-padrão) — mas reduz o caso comum (2 cliques manuais sequenciais), não o caso raro (2 abas simultâneas).

### 2.2 `updateTaskStatus` — AMPLIA a divergência (nível campo, não linha nova)

Não cria linha nova, mas muda o `status` de uma linha **já existente** na nuvem sem tocar o
`localStorage` — se essa linha tiver uma contraparte local (via `source_local_id`, ou
"seria a mesma tarefa" na cabeça do usuário), os dois lados agora discordam sobre o estado da
tarefa, e nada avisa. Também é onde o risco R1 (vocabulário de status) fica mais concreto: o
método só aceita `todo|in_progress|done` — uma tarefa que veio de um `status: "revisao"` local
(via import) não tem pra onde ir dentro dessa UI se alguém tentar "corrigir" o status por lá.

### 2.3 `importTask` — NÃO amplia; é o mecanismo de reconciliação

Upsert idempotente por `(workspace_id, source_local_id)` — rodar de novo não duplica, e o
próprio propósito é *encolher* o gap (trazer local → nuvem). Não é um risco a conter; é a
ferramenta que já existe pra isso, só depende de alguém rodar.

### 2.4 `softDeleteTask` — sem risco ativo (código morto)

Registrado aqui só para não ser confundido como caminho vivo numa auditoria futura — zero
chamadores, não amplia nem encolhe nada hoje.

---

## 3. Contenção mínima — proposta, NÃO implementada

Decisão de qual (se alguma) aplicar é do operador/revisor. Nenhuma das opções abaixo foi
codificada nesta rodada.

**(a) Congelar por política, não por código — confirmar que as 2 flags de ampliação ficam OFF
até a decisão de flip.** `supabaseOperationalDashboard` + `projectsSupabaseCreateBaseTasks` +
`tasksSupabaseStatusTransition` já são `false` por padrão (nenhuma mudança de código necessária)
— a "contenção" aqui é uma decisão registrada de **não ligar** essas 3 flags em nenhum workspace
até o flip real decidir o que fazer com `project_template`/status divergente, não uma mudança de
comportamento. Custo zero, reversível a qualquer momento, não deixa de ser possível religar se o
operador quiser testar o painel experimental deliberadamente.

**(b) Aviso explícito na UI do painel experimental (`SupabaseOperationalDashboardCard.tsx`),
perto dos controles de "gerar tarefas-base" e do dropdown de status** — texto avisando que essas
escritas não são reconciliadas com o local e podem não voltar. Mitiga o caso de alguém ligar as
flags sem saber da R2. Custo: mudança de código real (mesmo que pequena), não feita aqui —
proposta pra rodada dedicada, dependendo do que a quantificação (§1) mostrar. Se o volume
encontrado for zero ou muito baixo, o custo/benefício pode não justificar; se for alto, sim.

**(c) Não fazer nada agora.** Opção válida se a quantificação (§1) mostrar volume desprezível —
as 3 flags já são opt-in/default-OFF, então o alcance de quem pode estar ativamente ampliando o
buraco hoje já é naturalmente pequeno (quem entrou em Configurações → Dados e ligou uma flag
experimental deliberadamente). Trade-off: o buraco continua crescendo silenciosamente pra quem
já ligou, sem nenhum sinal.

**Recomendação desta auditoria (não é decisão):** (a) custa zero e não impede nada — razoável
adotar já como prática registrada, independente do resultado da quantificação. (b) só vale a
pena depois de rodar §1 e ver se o volume justifica o esforço de código. Não recomendo (c) puro
sem pelo menos (a), porque (a) não tem custo nem trade-off negativo.

**Decisão registrada (revisor, 14/ago/2026):** contenção **(a) ADOTADA** —
`kora.projects.supabaseCreateBaseTasks.enabled` e a flag de transição de status permanecem OFF
por política até a decisão do flip de Tarefas. Contenção **(b) condicionada ao volume da
quantificação §1**, a rodar na abertura daquele ciclo.

---

## Referências

- [`etapa-5-flip-tarefas-fase-a.md`](../architecture/etapa-5-flip-tarefas-fase-a.md) — inventário completo do domínio, R2 catalogado em §4
- [`etapa-5-fatia-7-projects.md`](etapa-5-fatia-7-projects.md) — origem do schema de `tasks`, medição "nuvem = 0 tasks vivas" na época da Fase A daquela fatia (pré-`project_template`)
- `supabase/migrations/20260601040000_create_tasks_schema.sql` — schema, sem CHECK em `status`/`priority`
- `supabase/migrations/20260721000500_etapa5_fatia7_tasks_unique_source_local_id.sql` — arbiter de idempotência do import geral; documenta a corrida TOCTOU do gerador de tarefas-base como problema conhecido não resolvido
- `src/repositories/tasksRepository.ts` — único ponto de acesso a `public.tasks` em todo o app
