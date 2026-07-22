# Etapa 5 · Fatia 7 — `projects` + `tasks` (portfólio/produção)

> **Escopo desta entrega:** **Fase A apenas** — diagnóstico de leitura pura, pelos invariantes do
> molde [Espelho Reversível](../architecture/espelho-reversivel.md) e do
> [protocolo de homologação](protocolo-homologacao.md) (§8/§9). **Nenhuma rodada de
> homologação, migration ou escrita em banco/localStorage foi executada.** Proposta, não
> aprovada.
>
> **Enquadramento, verificado nesta leitura (lições das Fatias 4 e 6 aplicadas — ver §2):** o
> CRUD principal de projects/tasks (`useProjects()`/`useTasks()`, tela `Portfolio.tsx` →
> `ProjectsSection.tsx`/`ProjectDetailDrawer.tsx` e `Tarefas.tsx`) **é greenfield** — 100%
> `localStorage`, sem nenhum cutover silencioso tipo `useClientsDataSource`. Mas, assim como em
> finance, as tabelas `projects` e `tasks` **já não estão vazias nem intocadas**: existem, desde
> a Etapa 3, dois fluxos experimentais estreitos, gerados a partir de orçamentos aprovados no
> CRM. Um deles (`projects`) já tem contrato de idempotência real em produção
> (`ux_projects_from_quote`); o outro (`tasks`, geração de "tarefas base") está com o **código
> completo mas a única UI que o aciona foi deliberadamente desmontada** — e **não tem nenhum
> contrato de unicidade no banco**, uma assimetria que qualquer fatia de import geral precisa
> herdar como problema, não resolver de brinde. Há ainda um achado equivalente ao F5 da Fatia
> 6 ("escreve onde ninguém lê"), ainda **não corrigido**: o fluxo de "Gerar Projeto Experimental"
> grava de verdade em `public.projects`, mas nenhuma tela que o usuário realmente usa
> (`ProjectsSection.tsx`) lê da nuvem — ver §2.4.

---

## 0. Registros necessários — queries para o OPERADOR rodar (Code não acessa banco nem browser)

Workspace de teste (mesmo das Fatias 1-6): `2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9`.

### 0.1 Nuvem (SQL Editor do Supabase)

```sql
-- (1) Contagem total de projects vivos (deleted_at IS NULL)
select count(*) from public.projects
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and deleted_at is null;
```

```sql
-- (2) Quebra de projects por status/source — perfil do que já existe na nuvem
select status, source, count(*) as qtd, sum(budget) as soma_budget
from public.projects
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and deleted_at is null
group by status, source
order by status, source;
```

```sql
-- (3) Contagem total de tasks vivas (deleted_at IS NULL)
select count(*) from public.tasks
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and deleted_at is null;
```

```sql
-- (4) Quebra de tasks por status/source/priority
select status, source, priority, count(*) as qtd
from public.tasks
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and deleted_at is null
group by status, source, priority
order by status, source, priority;
```

```sql
-- (5) Colunas atuais de public.projects (checar drift schema-vs-código)
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'projects'
order by ordinal_position;
```

```sql
-- (6) Colunas atuais de public.tasks (checar drift schema-vs-código)
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'tasks'
order by ordinal_position;
```

```sql
-- (7) Estado do índice de fan-in de projects (Etapa 3 S5) — indisvalid/indisunique + definição
select indexrelid::regclass as index_name, indisvalid, indisunique,
       pg_get_indexdef(indexrelid) as definition
from pg_index
where indexrelid = 'public.ux_projects_from_quote'::regclass;
```

```sql
-- (8) Confirma os demais índices de performance (batch2) de projects e tasks existem
select tablename, indexname, indexdef from pg_indexes
where schemaname = 'public' and tablename in ('projects', 'tasks')
order by tablename, indexname;
```

```sql
-- (9) Projetos já ligados a quotes migradas — estado atual do fan-in quote->project
select p.id, p.title, p.budget, p.quote_id, p.client_id, p.opportunity_id,
       p.source, p.created_at, q.title as quote_title, q.source_local_id
from public.projects p
join public.quotes q on q.id = p.quote_id
where p.workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and p.deleted_at is null
order by p.created_at;
```

```sql
-- (10) Checagem de duplicidade de "tarefas base" por projeto — NÃO há índice único
--      protegendo isto (ver §1/§2). Se algum project_id aparecer com mais de 9 linhas
--      de source='project_template', a corrida TOCTOU do dialog já se materializou.
select project_id, count(*) as qtd_tarefas_base
from public.tasks
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9'
  and source = 'project_template' and deleted_at is null
group by project_id
order by qtd_tarefas_base desc;
```

```sql
-- (11) Tasks órfãs de projeto — project_id aponta para um projeto que não existe mais
--      (ou foi soft-deleted). ON DELETE CASCADE do FK cobre o hard-delete; isto aqui
--      cobre o caso "projeto soft-deleted, tarefa ainda viva" (não há trigger para isso).
select t.id, t.title, t.project_id
from public.tasks t
left join public.projects p on p.id = t.project_id and p.deleted_at is null
where t.workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9'
  and t.deleted_at is null and t.project_id is not null and p.id is null;
```

### 0.2 Local (console do navegador, origem de produção)

```js
// (12) Total local de projects (inclui demo)
JSON.parse(localStorage.getItem("orbyt.projects.v1")).length
```

```js
// (13) Projects reais — mesmo critério isDemo das Fatias 3/4/6
JSON.parse(localStorage.getItem("orbyt.projects.v1")).filter(p => !p.isDemo).length
```

```js
// (14) Lista dos projects reais, com os 3 campos de fan-out (clientId/quoteId/opportunityId)
console.table(
  JSON.parse(localStorage.getItem("orbyt.projects.v1"))
    .filter(p => !p.isDemo)
    .map(p => ({
      id: p.id, name: p.name, status: p.status, source: p.source, budget: p.budget,
      clientId: p.clientId, quoteId: p.quoteId, opportunityId: p.opportunityId,
      deliverables: (p.deliverables || []).length,
    }))
)
```

```js
// (15) Total local de tasks (inclui demo)
JSON.parse(localStorage.getItem("orbyt.tasks.v1")).length
```

```js
// (16) Tasks reais
JSON.parse(localStorage.getItem("orbyt.tasks.v1")).filter(t => !t.isDemo).length
```

```js
// (17) Lista das tasks reais, com fan-out (clientId/quoteId/milestoneId), os dois FKs de
//      "projeto" (projectId real vs taskProjectId de useTaskProjects — não confundir) e a
//      profundidade real (subtasks/comments contados, não expandidos)
console.table(
  JSON.parse(localStorage.getItem("orbyt.tasks.v1"))
    .filter(t => !t.isDemo)
    .map(t => ({
      id: t.id, title: t.title, status: t.status, source: t.source,
      projectId: t.projectId, taskProjectId: t.taskProjectId,
      clientId: t.clientId, quoteId: t.quoteId, milestoneId: t.milestoneId,
      subtasks: (t.subtasks || []).length, comments: (t.comments || []).length,
    }))
)
```

```js
// (18) Fan-in "molhado ou seco"? Quantos projects/tasks reais têm quoteId setado
//      (referência a LOCAL quote id — precisa tradução via kora.quotes.supabaseImport.v1
//      antes de virar quote_id na nuvem). Mesmo espírito da query 10/11 da Fatia 6.
const quoteMap = JSON.parse(localStorage.getItem("kora.quotes.supabaseImport.v1") || '{"importedMap":{}}');
const projs = JSON.parse(localStorage.getItem("orbyt.projects.v1")).filter(p => !p.isDemo && p.quoteId);
const tks = JSON.parse(localStorage.getItem("orbyt.tasks.v1")).filter(t => !t.isDemo && t.quoteId);
console.table([
  ...projs.map(p => ({ tipo: "project", id: p.id, quoteId: p.quoteId, quoteUuidNaNuvem: quoteMap.importedMap[p.quoteId] || null })),
  ...tks.map(t => ({ tipo: "task", id: t.id, quoteId: t.quoteId, quoteUuidNaNuvem: quoteMap.importedMap[t.quoteId] || null })),
])
```

```js
// (19) Orfandade projectId (local): quantas tasks reais apontam para um Project.id que
//      não existe (mais) em orbyt.projects.v1 — checagem de integridade solta-vs-solta,
//      já que Task.projectId nunca foi um FK de banco, só um casamento por id em memória.
const projectIds = new Set(JSON.parse(localStorage.getItem("orbyt.projects.v1")).map(p => p.id));
JSON.parse(localStorage.getItem("orbyt.tasks.v1"))
  .filter(t => !t.isDemo && t.projectId && !projectIds.has(t.projectId))
  .map(t => ({ id: t.id, title: t.title, projectId: t.projectId }))
```

```js
// (20) Logs locais dos dois fluxos experimentais já existentes (Etapa 3, CRM) — contexto,
//      NÃO é fonte de verdade (a fonte é a nuvem, queries 1/3/9/10). Se algum dos dois já
//      tiver entradas, é sinal de que a rodada semeada de Fatia 7 não vai começar "a zero".
console.log("projetos gerados via CRM:", JSON.parse(localStorage.getItem("kora.quotes.supabaseProjects.v1") || "[]"));
console.log("tarefas base geradas via card operacional:", JSON.parse(localStorage.getItem("kora.projects.supabaseBaseTasks.v1") || "[]"));
```

```js
// (21) Estado ATUAL das 4 flags relevantes desta fatia (raw, direto da chave — mesmo
//      formato "true"/"false" de config/flags.ts). Precisa saber se algum já foi ligado
//      em produção antes de desenhar a Fase B.
console.table({
  "quotesSupabaseCreateProject (Gerar Projeto Experimental)": localStorage.getItem("kora.quotes.supabaseCreateProject.enabled"),
  "projectsSupabaseCreateBaseTasks (Gerar Tarefas Base Experimental)": localStorage.getItem("kora.projects.supabaseCreateBaseTasks.enabled"),
  "tasksSupabaseStatusTransition": localStorage.getItem("kora.tasks.supabaseStatusTransition.enabled"),
  "supabaseOperationalDashboard (card órfão)": localStorage.getItem("kora.supabase.operationalDashboard.enabled"),
})
```

**Preencher após rodar:** todos os resultados colados brutos. As queries (9)+(18) juntas decidem
se o fan-in de `projects`/`tasks` está "molhado" (existe projeto/tarefa real com `quoteId` já
mapeado — risco de disputa contra `ux_projects_from_quote` se o import não tratar 23505, igual à
Fatia 6) ou "seco". A query (10) decide se a corrida TOCTOU das tarefas base já se materializou
de verdade ou é só um risco teórico ainda. A query (20)+(21) decidem se os dois fluxos
experimentais já foram acionados em produção antes desta fatia começar.

---

## 1. Auditoria por invariante (Fase A)

| Inv. | Ponto | Veredito |
|---|---|---|
| (a) | Não apaga local antes do remoto | ✅ OK — nenhum código de `useProjects()`/`useTasks()` escreve na nuvem a partir de `orbyt.projects.v1`/`orbyt.tasks.v1` hoje (ver §2) |
| (b) | Idempotência | ⛔ **ASSIMÉTRICA** — `projects` tem Variante-A-like real (índice parcial + catch 23505); `tasks` **não tem nenhum contrato de unicidade no banco** para a única escrita em massa que já existe (base tasks) |
| (c) | Leitura server-side | 🟡 parcial — só existe pro card operacional órfão (§2.2/§2.3), não pro CRUD principal, e nem o card órfão está no ar hoje |
| (d) | Reversibilidade | N/A ainda — sem cutover do CRUD principal, sem flag de dataSource, nada a reverter |
| (e) | Disparo consciente | 🟡 **parcial, já uma preocupação real** — os dois fluxos existentes SÃO painéis com clique explícito (não automáticos no load), mas um deles (projeto-de-quote) grava dado que hoje **não aparece em nenhuma tela real** (ver §2.4) — o "disparo" é consciente, o resultado não é visível |
| + | FK / dependentes | ✅ sem drift nas FKs (`client_id`/`quote_id`/`opportunity_id` em ambas; `project_id` em tasks); **`tasks` é dependente de `projects`** via `ON DELETE CASCADE` — único caso de fan-in real entre as duas tabelas desta fatia (ver §1 "profundidade") |
| + | Profundidade real (pai→filho→neto) | 🟡 **assimetria schema-vs-local** — ver detalhamento abaixo |
| + | Precisão monetária | N/A com nuance — ver detalhamento abaixo |
| + | Drift schema-vs-código | ✅ **sem drift** — mesmo padrão positivo da Fatia 6 |

### (a) Não apaga o local — ✅ OK

`useProjects()` (`src/hooks/useProjects.ts`) e `useTasks()` (`src/hooks/useTasks.ts`) só
leem/escrevem `localStorage` (`orbyt.projects.v1` e `orbyt.tasks.v1`, respectivamente — mais
`kora.taskProjects.v1` para o conceito auxiliar `TaskProject`, ver "profundidade" abaixo). Nenhum
import de `projectsRepository`/`tasksRepository` nem de `supabase` existe em nenhum dos dois
arquivos. Confirmado por grep direto, não presumido.

### (b) Idempotência — ⛔ ASSIMÉTRICA, o achado central da fatia (mais grave que a Fatia 6)

**`projects` tem o contrato completo, já em produção:**

```sql
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ux_projects_from_quote
  ON public.projects (quote_id)
  WHERE source = 'quote' AND deleted_at IS NULL;
```
(`supabase/migrations/20260704120100_etapa3_unique_project_from_quote.sql`, mesmo padrão e mesmo
dia do `ux_ft_receivable_from_quote` da Fatia 6.) E, diferente de quando a migration foi escrita
("NÃO incluído aqui" sobre o tratamento de 23505), o código **já trata a corrida**:
`src/repositories/projectsRepository.ts` linhas 52-60, `createProjectFromQuote` — no catch de
`23505` chama `findProjectByQuote` e devolve o existente em vez de propagar o erro. Commit
`2ad03ea` fez isso para finance **e** projects ao mesmo tempo.

**`tasks` não tem nada disso.** A única escrita em massa que já existe para `tasks`
(`tasksRepository.createProjectBaseTasks`, `src/repositories/tasksRepository.ts` linhas 41-56) é
um `insert` puro, sem `onConflict`, sem `select().single()` — e **não há nenhum índice único**
sobre `(project_id, source)` nem sobre nada equivalente em `supabase/migrations/`. A dedução de
duplicidade é **só no app**, em `CreateProjectBaseTasksDialog.tsx` linhas 106-113:
```ts
const existing = await tasksRepository.listTasksByProject(workspaceId, projectId);
const hasBaseTasks = existing.some((t) => t.source === "project_template" && !t.deleted_at);
if (hasBaseTasks) { toast.error("Este projeto já possui tarefas base geradas."); ... return; }
```
Isto é exatamente o padrão SELECT-depois-INSERT que as migrations de Etapa 3 (tanto a de
`projects` quanto a de `financial_transactions`) apontaram como a causa da corrida que motivou
os índices parciais — só que aqui **o índice nunca foi criado**. Um duplo-clique ou duas abas
concorrentes geram dois lotes de 9 tarefas base para o mesmo projeto, sem nenhum backstop no
banco. Não é uma regressão desta fatia — é uma dívida pré-existente da Etapa 3 que a Fatia 7
herda e precisa decidir se resolve (índice novo) antes ou durante o desenho da Fase B.

**A complicação real (igual à Fatia 6, mas em dose dupla):** um projeto local real pode ter
`source: "orçamento"` **e** um `quoteId` preenchido (ver §0.2, query 18) — nesse caso, importar
esse projeto exercita **os dois contratos ao mesmo tempo**: o novo `source_local_id` (idempotência
geral do import, Variante B) **e** o `ux_projects_from_quote` já existente ("no máximo 1 projeto
vivo por orçamento"). Qualquer import geral de `projects` **precisa** cair no mesmo padrão de
`projectsRepository.createProjectFromQuote` — nunca um `upsert(onConflict: "workspace_id,
source_local_id")` sozinho. Ver design análogo em Fatia 6 §6.

### (c) Leitura server-side — 🟡 parcial, e o "parcial" está desligado

Só existe leitura server-side de `projects`/`tasks` dentro de `SupabaseOperationalDashboardCard.tsx`
— e esse componente **não é renderizado em lugar nenhum** hoje (import órfão em
`Configuracoes.tsx:84`, removido do JSX pelo commit `77f479c` — "Hide technical sync panels...
for end-client safety", 2026-06-01). Ou seja: mesmo o "parcial" que existia foi desligado antes
desta fatia começar.

### (d) Reversibilidade — N/A ainda

Sem seletor de `dataSource` para projects/tasks, sem kill-switch de cutover do CRUD principal
(as 3 flags existentes são de geração pontual, não de fonte de leitura) — nada a reverter porque
nada foi cortado.

### (e) Disparo consciente — 🟡 parcial, risco real (não teórico)

Os dois fluxos que já escrevem na nuvem são acionados por clique explícito num painel (nunca
automático), o que cumpre a letra do invariante. Mas o invariante existe para proteger o
**usuário**, e aqui o resultado do clique — um projeto real gravado em `public.projects` — não
aparece em nenhuma tela que esse mesmo usuário usa no dia a dia (ver §2.4). "Consciente" no
sentido de "eu cliquei" não é o mesmo que "consciente" no sentido de "eu vejo o que aconteceu".

### FK / dependentes — ✅ sem drift, um dependente real (`tasks` → `projects`)

`public.tasks.project_id REFERENCES public.projects(id) ON DELETE CASCADE` — ao contrário de
`financial_transactions` (Fatia 6, "leaf table", sem dependentes), `projects` **tem** um
dependente de verdade no banco. Isso significa: se a Fase B de `projects` algum dia incluir um
hard-delete ou uma rotina de limpeza de seeds, o `CASCADE` apaga as `tasks` filhas junto — bom
para consistência, mas precisa estar explícito em qualquer runbook futuro de limpeza (diferente
de finance, onde limpar `financial_transactions` nunca arrastava mais nada).

### Profundidade real (pai → filho → neto) — 🟡 assimetria schema-vs-local, achado novo desta fatia

- **Local:** `Project` (`useProjects.ts`) → `Task` (`useTasks.ts`, ligado por `Task.projectId`,
  casamento em memória, nunca um FK de banco local) → `SubTask`/`TaskComment` (embutidos dentro
  de `Task.subtasks[]`/`Task.comments[]`, sem tabela própria). Três níveis reais no local:
  projeto → tarefa → subtarefa/comentário.
- **Supabase:** só **dois** níveis existem — `projects` → `tasks` (FK real, `ON DELETE CASCADE`).
  **Não existe nenhuma tabela, coluna JSONB ou qualquer outra representação para
  subtasks/comments na nuvem.** Se uma fatia futura migrar `tasks` de verdade (não só a geração
  de "tarefas base"), o checklist embutido de cada tarefa **não tem para onde ir** até que esse
  gap de schema seja fechado — isto não é um problema de código a resolver na Fase B, é uma
  migration nova ainda não desenhada (schema gap, não code gap).
- Detalhe adicional: `SubTask`/`TaskComment` **não têm campo `id`** (`useTasks.ts` linhas 10-11) —
  mutados por índice de array (`toggleSubtask(taskId, idx)`). Qualquer futura tabela
  `task_subtasks` precisaria de um id novo gerado no momento da migração — os dados locais não
  trazem uma chave natural para isso.
- Ainda no local: `Task.milestoneId?: string` existe como campo mas **não há nenhum tipo/hook
  `Milestone`** em lugar nenhum do código — é uma FK apontando para uma entidade que nunca foi
  implementada. Não é escopo desta fatia resolver, só registrar que existe.
- Conceito paralelo, não confundir: `TaskProject` (`src/hooks/useTaskProjects.ts`,
  `kora.taskProjects.v1`) é uma etiqueta/agrupador leve (`id/name/color/type/clientId`) usada só
  dentro da tela de Tarefas para colorir/organizar cards — **não é** o `Project` desta fatia.
  `Task.taskProjectId` aponta para lá; `Task.projectId` aponta para o `Project` real. Dois FKs
  com nomes parecidos no mesmo objeto, fácil de confundir num design apressado.

### Fan-out (o que Project/Task apontam para fora)

- **`Project`** (`src/hooks/useProjects.ts` linhas 21-45): `clientId?: number` → Client,
  `quoteId?/quoteTitle?` → Quote, `opportunityId?/opportunityTitle?` → CRM Opportunity,
  `company?: string` (texto denormalizado, não é FK), `source?: "manual" | "orçamento"`.
- **`Task`** (`src/hooks/useTasks.ts` linhas 15-46), além dos dois FKs de "projeto" já descritos:
  `clientId?: number` → Client, `quoteId?: string` → Quote, `milestoneId?: string` → (FK solta,
  entidade inexistente), `client: string` (texto denormalizado, separado de `clientId`).
- Os 3 import-maps do padrão Q4 (`kora.clients.supabaseImport.v1`,
  `kora.quotes.supabaseImport.v1`, `kora.crm.supabaseImport.v1`) entram para os dois — igual à
  Fatia 6, `projects`/`tasks` seriam o segundo caso (depois de finance) precisando dos 3
  simultaneamente.
- Nota de duplicação de tipos (fora do escopo imediato, mas registrada): `src/types/domain.ts`
  linhas 261-289 (`Task`) e 310-334 (`Project`) declaram formas quase idênticas, usadas só pelos
  hooks de clients — `useProjects.ts`/`useTasks.ts` não importam de lá, têm suas próprias
  declarações. Duas fontes de verdade para o mesmo formato; risco latente, não desta fatia.

### Fan-in (o que aponta para Project/Task)

- **Local:** só a própria relação Project↔Task (`Task.projectId`). Nenhuma outra entidade local
  (`Transaction`, agenda/calendário, time-tracking) tem `projectId`/`taskId` — confirmado por
  grep em `src/types/domain.ts` (Transaction, linhas 226-249: só `clientId/quoteId/
  opportunityId`, sem `projectId`). Único ponteiro reverso interessante: `Quote.projectId?/
  projectTitle?` (`src/hooks/useQuotes.ts` linhas 58-59) — a Quote registra qual Project ela
  gerou, um ponteiro de volta gravado no momento da conversão quote→project (local, via
  `QuoteToProjectDialog.tsx`, ver §2.5).
- **Widgets do dashboard** (`TodayTasks.tsx`, `RecentTasks.tsx`) usam arrays mock hardcoded, não
  `useTasks()` — não são fan-in real, só placeholders visuais (confirmado, zero import de
  `useTasks|useProjects` nesses arquivos).
- **Supabase:** só `tasks.project_id` (`ON DELETE CASCADE`). Busca exaustiva por `project_id` em
  todas as migrations confirma que nenhuma outra tabela (`financial_transactions`, `quotes`,
  `crm_opportunities`) tem coluna `project_id` — os únicos outros hits de "project_id" no repo são
  `gcp_project_id`/`credentials_project_id` de credenciais do WhatsApp Business API, uma entidade
  "projeto" totalmente não relacionada (Google Cloud), descartados como falso-positivo.

### Precisão monetária — N/A com nuance, diferente de finance

`Project.budget: number` existe e é preenchido a partir de `quoteTotal` quando o projeto nasce de
um orçamento (`CreateProjectFromQuoteDialog.tsx` linha 51: `setBudget(quoteTotal)`), mas **o
campo é editável pelo usuário antes de confirmar** (é um orçamento estimado do projeto, não uma
cópia fixa do total do quote como o `amount` de um recebível). Divergência entre `budget` e
`quote.total` aqui é **esperada e válida**, não um bug a reportar — um `inspectProjectMoney`
nos moldes do `inspectFinanceMoney` da Fatia 6 **não se aplica** da mesma forma; se a Fase B
quiser alguma checagem, teria que ser "budget nunca deveria ser negativo" (já validado no dialog,
linha 65-68), não "budget deveria bater com quote.total". `Task` não tem nenhum campo monetário.

### Drift schema-vs-código — ✅ sem drift

Os 2 repositories (`projectsRepository.ts`, `tasksRepository.ts`) usam exatamente as colunas que
existem nas migrations de criação (`20260601030000`/`20260601040000`) mais as de índice
(`20260701210000`). Nenhuma coluna referenciada no código está ausente do schema, nenhuma coluna
do schema ficou sem uso conhecido. Confirmar com as queries (5)/(6) do §0 antes da Fase B, pelo
mesmo motivo que as fatias anteriores sempre confirmaram — o código pode ter avançado ou uma
migration pode não ter sido aplicada de fato.

---

## 2. Verificação de cutover silencioso + fluxos estreitos (lições das Fatias 4 e 6)

### 2.1 CRUD principal — verificado, NÃO há cutover silencioso

`useProjects()` e `useTasks()` são 100% `localStorage`, sempre — sem `DataSource`, sem import de
`supabase`, sem exceção. As telas que o usuário realmente usa hoje —
`Portfolio.tsx` → `ProjectsSection.tsx` (`src/components/projetos/ProjectsSection.tsx` linha 39:
`const { projects, addProject } = useProjects();`) e `ProjectDetailDrawer.tsx`
(`src/components/projects/ProjectDetailDrawer.tsx` linhas 22-24, só `useProjects`/`useTasks`), e
`Tarefas.tsx` (`src/pages/Tarefas.tsx` linhas 185-192, só `useTasks`/`useTaskProjects`) —
confirmam isso: nenhum import de Supabase em nenhum dos arquivos-tela. Greenfield de verdade,
como finance, e ao contrário de clients.

### 2.2 Fluxo estreito 1 — "Gerar Projeto Experimental" (`quotesSupabaseCreateProject`) — **VIVO**

Cadeia de acionamento confirmada ponta a ponta:
`CRM.tsx` (rota `/crm`) → `isSupabaseMode = activeDataSource === "supabase"` (linha 1289), e
`getCrmDataSource()` (`src/config/flags.ts` linha 137-139) **retorna `"supabase"` por padrão**
(só `"local"` explícito muda isso) → `LinkedQuotesSection.tsx` renderizado para qualquer
oportunidade com `supabaseId` → botão "Gerar projeto" (visível para quotes `status === "approved"`)
→ `handleCreateProjectClick` (linhas 50-58) checa a flag `quotesSupabaseCreateProject` via
`getBooleanFlag` → se ligada, abre `CreateProjectFromQuoteDialog.tsx` → `handleConfirm` (linhas
62-124): dedup via `findProjectByQuote`, depois **INSERT real** via
`projectsRepository.createProjectFromQuote` (grava `client_id/quote_id/opportunity_id/title/
budget/status:"active"/source:"quote"` em `public.projects`) → log de sucesso só em
`localStorage["kora.quotes.supabaseProjects.v1"]` (não a entidade, só o log).

Toggle em Configurações: `QuotesSupabaseProjectToggleCard.tsx`, título exato **"Orçamentos
Supabase - Gerar Projeto Experimental"** — bate com o que o revisor recordou.

### 2.3 Fluxo estreito 2 — "Gerar Tarefas Base Experimental" (`projectsSupabaseCreateBaseTasks`) — **código completo, UI órfã**

Toggle em Configurações: `QuotesSupabaseBaseTasksToggleCard.tsx`, título exato **"Projetos
Supabase - Gerar Tarefas Base Experimental"** — também bate com o que o revisor recordou. Mas o
único lugar do código inteiro que monta `<CreateProjectBaseTasksDialog>` é dentro de
`SupabaseOperationalDashboardCard.tsx` (linhas 271-283, 505-521, 537-548) — e esse card **nunca é
renderizado**: `Configuracoes.tsx` ainda importa o componente (linha 84) mas não tem mais
`<SupabaseOperationalDashboardCard />` em lugar nenhum do JSX. Confirmado via `git log`: commit
`77f479c` — *"feat: Hide technical sync panels and workspace warnings from Settings UI
completely for end-client safety"* (2026-06-01) — removeu 88 linhas incluindo essa tag, deixando
o import morto para trás. A própria flag `supabaseOperationalDashboard` (toggle
`SupabaseOperationalDashboardToggleCard.tsx`) ainda aparece em Configurações (linha 868) — liga
uma feature que não existe mais visivelmente.

**Efeito prático hoje:** ligar `projectsSupabaseCreateBaseTasks` em Configurações não tem nenhum
efeito observável no app — não há botão em lugar nenhum da UI publicada que leia essa flag para
mostrar a ação. `tasksRepository.createProjectBaseTasks()` está funcional e gravaria linhas reais
em `public.tasks` se fosse chamado — mas nada no app hoje chama. (Existe uma segunda cópia,
igualmente órfã, do fluxo "gerar projeto de quote" em `SupabaseQuotesViewerCard.tsx`, referenciada
só pelo próprio teste — também não montada em `Configuracoes.tsx`; `LinkedQuotesSection` é o
único ponto de entrada vivo do §2.2.)

### 2.3b Fluxo estreito 3 — "Transição de Status de Tarefas Supabase" — mesmo status de órfão

Toggle `QuotesSupabaseStatusTransitionToggleCard.tsx`; único consumidor é `ProjectTasksList`,
sub-componente dentro do mesmo `SupabaseOperationalDashboardCard.tsx` órfão (linhas 28-231),
chamando `tasksRepository.updateTaskStatus` (UPDATE real). Mesma situação: código pronto,
inalcançável pela UI atual.

### 2.4 Achado F5-equivalente — "escreve onde ninguém lê", ainda NÃO corrigido

Igual ao que a Fatia 6 encontrou e corrigiu (F5-b, `CreateReceivableDialog.tsx` redirecionado
para gravação local) — aqui o problema **existe e está sem correção**: o fluxo 2.2 grava um
projeto real em `public.projects`, mas a única tela que mostraria isso de volta ao usuário seria
o card operacional do §2.3, que está desmontado. Ou seja: hoje, em produção, se alguém ligar a
flag e clicar em "Gerar projeto" numa quote aprovada, **o projeto é criado de verdade na nuvem e
nenhuma tela do app o exibe** — nem `ProjectsSection.tsx` (só lê local), nem o card operacional
(não está montado). Diferente da Fatia 6, aqui não há sequer um caminho de leitura órfão
"tecnicamente vivo mas escondido" — o caminho de leitura foi desmontado por completo. Isto é
uma recomendação de correção (classe F5-b: redirecionar para gravação local até o cutover, ou
reativar/redesenhar a leitura), a decidir na Fase B, não uma ação desta Fase A.

### 2.5 Um terceiro fluxo, 100% local, não gated por nenhuma flag

`src/components/vendas/QuoteToProjectDialog.tsx` (usado por `QuotesSection.tsx` linha 453, na
página **Vendas**, `/vendas`) implementa a conversão quote→project **inteiramente local**:
```ts
const { addProject } = useProjects();
const { addTask } = useTasks();
...
const project = addProject({ name, clientName, clientId: quote.clientId, quoteId: quote.id, ... source: "orçamento", ... });
if (createTasks) { addTask({ ...projectId: project.id, quoteId: quote.id, source: "projeto", ... }); }
```
Grava só em `orbyt.projects.v1` + `orbyt.tasks.v1`, pelos mesmos hooks que as telas principais já
usam. **Este é o fluxo de conversão quote→project que o usuário real vê e usa hoje** — totalmente
separado e não protegido pelas flags experimentais do CRM. Duas implementações independentes de
"converter quote em projeto" coexistem: uma 100% local (Vendas, sempre ativa) e uma 100%
Supabase (CRM, atrás de flag, experimental, com o problema do §2.4).

---

## 3. Avaliação de risco — vs Fatias 2-6 (provisória, sem os números do §0)

| Fator | Fatia 6 (finance) | Fatia 7 (projects/tasks) |
|---|---|---|
| CRUD principal | greenfield confirmado | greenfield confirmado (mesmo grau de confiança) |
| Fluxo estreito pré-existente | 1 (recebível de quote), com índice + 23505 tratado | **2** (projeto de quote — índice + 23505 tratado; tarefas base — **sem índice**, dedup só no app) |
| Bug "escreve onde ninguém lê" | existia (F5), **corrigido nesta Etapa 5** (F5-b) | existe (§2.4), **ainda não corrigido** — decisão de Fase B pendente |
| Profundidade pai-filho | nenhuma (leaf table) | **2 no schema (project→task), 3 no local (→subtask/comment)** — gap de schema para o 3º nível |
| Dependente no banco | nenhum (leaf) | `tasks` depende de `projects` via `CASCADE` — limpeza de seed precisa considerar isso |
| Fluxo local paralelo não-gated | não existia | **existe** (`QuoteToProjectDialog.tsx`, Vendas) — mais uma via de entrada de dado a mapear |
| Risco líquido | médio (coexistência de 1 índice) | **médio-alto** — coexistência de 1 índice + 1 buraco de índice + 1 bug de visibilidade não corrigido + 1 gap de schema (subtasks) + 2 entidades em vez de 1 |

Esta é objetivamente a fatia mais complexa da Etapa 5 até aqui — não pela dificuldade de cada
peça isoladamente, mas pela quantidade de peças distintas que precisam ser decididas juntas antes
de qualquer código: (1) índice novo para tasks base, (2) correção ou não do bug de visibilidade
do §2.4, (3) desenho de import para 2 entidades com fan-out triplo cada, (4) decisão sobre o gap
de schema de subtasks (fora de escopo de import, mas relevante se uma fatia futura quiser migrar
o CRUD de tasks de verdade).

---

## 4. Classificação da fatia — **MISTO**, justificada pelas medições qualitativas acima

Não é migração clássica pura (há fluxos de escrita nuvem pré-existentes, como a Fatia 6), não é
regularização pura (o CRUD principal é genuinamente greenfield, diferente da Fatia 4), e não é
só coexistência pura (há também um bug de visibilidade sem correção e uma lacuna de índice que
nenhuma fatia anterior teve). A classificação depende dos números reais do §0 (contagem de
projects/tasks reais na nuvem e local, e se o fan-in está molhado ou seco) para se resolver em
uma das combinações abaixo — mas já dá para adiantar a estrutura:

- **Se nuvem = 0 e local = poucos/demo** (padrão da Fatia 6): **"instalação de infraestrutura de
  import"**, mesmo enquadramento do F6 — sem Rodada 2 real possível, homologação semeada.
- **Se nuvem > 0** (algum projeto real já foi gerado via §2.2 antes desta fatia começar — a
  query (20)/(21) do §0 decide isso): a fatia ganha um componente de **regularização** também,
  igual à Fatia 4 — precisaria decidir o que fazer com projetos já existentes na nuvem que hoje
  são invisíveis ao usuário (§2.4), antes ou junto do desenho do import geral.
- Em qualquer cenário, a fatia **sempre** tem um componente de **coexistência** (índice parcial
  de `projects` já em produção) — isso não depende dos números, já está provado pelo código e
  pela migration.

**Recomendação de sequenciamento, independente do resultado do §0:** resolver a decisão do §2.4
(bug de visibilidade) **antes ou junto** do desenho do import geral, não depois — do contrário
a Fase B teria que desenhar import para uma tabela cujo comportamento de leitura ainda está em
aberto, repetindo o padrão que a Fatia 6 só resolveu depois de já ter desenhado o import (F5-b
foi tratado meio a meio com a implementação, não antes).

---

## 5. Recomendação P1..Pn — PROPOSTA, aguardando aprovação (nenhuma fase liberada)

| # | Classe | Descrição | Fase sugerida |
|---|---|---|---|
| P1 | Correção de bug | Resolver o achado do §2.4 (projeto gerado por quote é invisível ao usuário) — provavelmente redirecionar `CreateProjectFromQuoteDialog` para gravação local (padrão F5-b da Fatia 6) até o cutover real, ou reativar uma leitura mínima | Fase B, decisão do revisor primeiro |
| P2 | Dívida técnica pré-existente | Criar o índice único que falta para "tarefas base" (`ux_tasks_base_from_project` ou equivalente, sobre `(project_id) WHERE source='project_template' AND deleted_at IS NULL` — mesma forma dos outros dois parciais) e tratar 23505 em `tasksRepository.createProjectBaseTasks` | Fase B (migration) — pode andar independente do import geral |
| P3 | Design de idempotência | Variante B (`source_local_id` + `UNIQUE(workspace_id, source_local_id)` não-parcial) para `projects` E para `tasks`, com a mesma árvore de decisão da Fatia 6 para conviver com `ux_projects_from_quote` (e com o índice novo do P2, se aprovado) | Fase B (design) |
| P4 | Mapper | Fan-out triplo (client/quote/opportunity) para as duas entidades — reuso do padrão Q4; sem checagem de precisão monetária tipo `inspectFinanceMoney` (ver §1, "Precisão monetária" — não se aplica a `budget`) | Fase B (design) |
| P5 | Atomicidade pai-filho | Avaliar se o import de um `Project` com `Task`s locais precisa de RPC transacional (2 níveis reais no schema, ao contrário de finance) — análogo à Fatia 3 (quotes/quote_items) | Fase B (design) |
| P6 | Gap de schema (fora do import) | Registrar formalmente que `subtasks`/`comments` (3º nível local) não têm representação na nuvem hoje — não bloqueia o import de projects/tasks em si, mas bloqueia qualquer cutover futuro do CRUD de tasks completo | Registro apenas — não é ação desta fatia |
| P7 | Runbook | Homologação semeada (mesmo padrão da Fatia 6) — só depois das decisões P1-P5 e dos números do §0 | Fase B tardia |

**PARADO aqui.** Diagnóstico de Fase A entregue — nenhuma rodada de homologação, migration ou
escrita em banco/localStorage foi executada. Qualquer avanço (Fase B, decisões P1-P7, ou
qualquer execução) depende do "vai" literal do revisor colado neste chat pelo operador.
