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

---

## 6. Decisão do revisor (medições) e reclassificação

| Medida | Valor |
|---|---|
| `projects` vivos na nuvem | **0** |
| `tasks` vivas na nuvem | **0** |
| Projects locais demo / reais | 5 demo / **0 reais** |
| Tasks locais demo / reais | 5 demo / **0 reais** |
| Fan-in (`quoteId` em reais, projects e tasks) | **SECO** — 0, por não haver reais |
| 3º nível (`subtasks`/`comments` em tasks reais) | sem dado — 0 reais, nada a inspecionar |
| Corrida TOCTOU de "tarefas base" (`project_id` com >9 linhas `project_template`) | **não materializada** — 0 linhas de `source='project_template'` na nuvem |
| Índice `ux_projects_from_quote` | `indisvalid = true`, `indisunique = true` |

**Não há dado real em nenhum lado, nas duas entidades.** Reclassificação: a fatia vira
**instalação de infraestrutura de import** — mesmo enquadramento da Fatia 6 (F6) — homologada
**100% por rodada semeada**, sem Rodada 2 real possível. Momento mais barato para as migrations:
as 4 tabelas-linha (projects/tasks × nuvem/local) estão vazias ou só com demo, sem risco de
tocar dado real durante o design ou a aplicação.

---

## 7. Design — Idempotência Variante B (dois níveis) + coexistência com `ux_projects_from_quote`

### 7.1 Variante B para `projects` e para `tasks`, independentemente

Mesmo padrão das Fatias 2/3/4/6: coluna `source_local_id text` (formato
`${installId}:${localId}`, `src/lib/installId.ts`) + índice **não-parcial**
`UNIQUE(workspace_id, source_local_id)` em cada tabela — dois pares de migration
independentes, um para `projects`, um para `tasks` (§8 lista os 4 arquivos). Não-parcial pelo
mesmo motivo de sempre (P8b): um índice parcial não serve de arbiter de `ON CONFLICT` porque o
inference do Postgres exige a definição do índice bater exatamente com as colunas do
`onConflict`, sem predicado adicional.

### 7.2 Coexistência em `projects` — precisa de árvore de decisão (igual à Fatia 6)

`ux_projects_from_quote` já existe: `UNIQUE (quote_id) WHERE source = 'quote' AND deleted_at IS
NULL`. Um projeto local real pode ter `source: "orçamento"` **e** um `quoteId` preenchido (ver
§0.2 query 18) — importar esse projeto precisa passar pelo **mesmo** contrato de negócio que
`CreateProjectFromQuoteDialog` já usa (`findProjectByQuote`/`createProjectFromQuote`, com catch de
23505), nunca um `upsert(onConflict: "workspace_id,source_local_id")` sozinho — que erraria por
não saber do segundo índice, exatamente como a Fatia 6 já resolveu para finance.

**Árvore de decisão (`projectsRepository.importProject(workspaceId, sourceLocalId, input)`,
espelhando `financeRepository.importTransaction`):**

```
input.quote_id resolvido (não null) E project.source local == "orçamento"
  -> caminho QUOTE-LINKED:
       1. findProjectByQuote(workspaceId, quote_id)
       2. se existir: UPDATE source_local_id na linha existente (backfill), devolver — NUNCA
          cria um segundo projeto pra mesma quote
       3. se não existir: createProjectFromQuote(...) COM source_local_id no payload;
          catch 23505 (corrida perdida) -> findProjectByQuote de novo, devolve o existente
  -> NUNCA passa pelo upsert(onConflict: "workspace_id,source_local_id") nesta linha

qualquer outro caso (source local == "manual", OU quoteId não resolvido/órfão)
  -> caminho GERAL:
       upsert({ ...payload, source_local_id }, { onConflict: "workspace_id,source_local_id" })
```

**Achado de vocabulário — o motivo pelo qual isto NÃO é automático:** ao contrário de finance
(onde `Transaction.source` local já usa o literal `"quote"`, o mesmo valor do predicado do
índice parcial), `Project.source` local só usa `"manual" | "orçamento"` — **o literal `"quote"`
nunca existe no dado local** (confirmado em `src/hooks/useProjects.ts` e no único produtor real,
`QuoteToProjectDialog.tsx` linha 103: `source: "orçamento"`). Se o mapper copiasse
`project.source` direto pra nuvem, um projeto quote-linked chegaria com `source: "orçamento"` —
que **não bate** com o predicado `WHERE source = 'quote'` do índice parcial. Resultado: o projeto
passaria pelo caminho GERAL mesmo sendo quote-linked, e **dois projetos vivos para a mesma
quote** (um do fluxo antigo do CRM com `source='quote'`, outro do import geral com
`source='orçamento'`) coexistiriam sem o banco reclamar — porque o predicado do índice não cobre
o segundo. **O mapper precisa traduzir**: `local "orçamento" + quoteId resolvido -> cloud
"quote"`; `local "manual" -> cloud "manual"` (passagem direta). Esta tradução de vocabulário do
campo `source` é o análogo, para `projects`, da tradução `income/expense -> receivable/payable`
que a Fatia 6 fez para `type` — mesma classe de problema, campo diferente.

### 7.3 `tasks` — sem árvore de decisão necessária (vocabulário já disjunto)

`Task.source` local só usa `"manual" | "projeto" | "orçamento"` — o literal `"project_template"`
(usado pelo gerador de tarefas base, source do único fluxo estreito de `tasks`) **nunca aparece
no dado local**, por construção. Logo, todo import geral de tasks passa sempre pelo caminho
GERAL (`upsert(onConflict: "workspace_id,source_local_id")`), sem nenhum risco de colidir com o
namespace do gerador de tarefas base — os dois nunca escrevem a mesma combinação de valores. Não
existe (e não precisa existir) um `tasksRepository.importTask` com árvore de decisão — só o
upsert direto. Esta é uma diferença estrutural real em relação a `projects`, não uma
simplificação de conveniência.

### 7.4 Mapper — fan-out (4º import-map novo) e precisão monetária

- **Fan-out de `projects`**: `client_id`/`quote_id`/`opportunity_id` via os 3 import-maps já
  provados (`kora.clients.supabaseImport.v1`, `kora.quotes.supabaseImport.v1`,
  `kora.crm.supabaseImport.v1`), padrão Q4 (mapeado → uuid; ausente → `null`, nunca id local cru).
- **Fan-out de `tasks`**: os mesmos 3 (`client_id`/`quote_id`) **mais um 4º, novo**:
  `project_id`, via um import-map que ainda não existe — `kora.projects.supabaseImport.v1` —
  preenchido pela própria importação de `projects` desta fatia. `opportunity_id` de `tasks` é
  **sempre `null`** no import, porque `Task` local não tem nenhum campo `opportunityId` (só
  `Project` tem) — não é uma órfã a reportar, é ausência estrutural do campo, diferença que a UI
  de candidatos deveria distinguir de um "vínculo não encontrado".
- **Precisão monetária**: `Project.budget` é quantizado com `roundMoney` (mesma função de
  `src/services/quotes/quoteMoney.ts`, já reusada por finance) só para evitar artefato de float —
  **sem** checagem de divergência tipo `inspectFinanceMoney` (decidido N/A na Fase A, §1: budget é
  estimativa editável pelo usuário, não uma cópia fixa do total do orçamento). `Task` não tem
  campo monetário.
- **Nota de dívida, não bloqueante:** `roundMoney` já tem 2 consumidores fora de `quotes`
  (`quoteMapper.ts` de origem + `financeMapper.ts`, Fatia 6). `projects` seria o **3º** — pela
  própria regra do projeto ("regra dos três": só extrair pra um lugar mais compartilhado quando
  uma terceira entidade precisar), este é o gatilho para mover `roundMoney` de
  `src/services/quotes/quoteMoney.ts` para um lar neutro (ex. `src/lib/money.ts`), já que ter um
  serviço de "projects" importando de dentro de "quotes" é um cheiro de organização, não um
  problema funcional. Recomendado para a fase de implementação (é um `mv` + re-export, baixo
  risco), não para esta fase de design.
- **Status/priority — passagem direta, sem tradução.** `projects.status`/`tasks.status`/
  `tasks.priority` são colunas `TEXT` livres, sem `CHECK` constraint (confirmado nas migrations
  de criação). Diferente de `type` (Fatia 6) e de `source` (§7.2 acima), aqui não há vocabulário
  divergente forçando tradução — os valores locais (`"planning"`, `"a_fazer"`, `"média"`, etc.)
  podem ser gravados como estão. Único consumidor que assume um vocabulário mais estreito
  (`tasksRepository.updateTaskStatus`, tipado só para `"todo"|"in_progress"|"done"`) não é
  chamado pelo import geral (que só faz INSERT/upsert, nunca UPDATE de status) — não há conflito
  de fato, só uma restrição de tipo TypeScript num método que este import não usa.

---

## 8. Design — Atomicidade pai-filho: DECISÃO EXPLÍCITA — SEM RPC transacional

**Decisão: `projects` e `tasks` importam como entidades independentes.** Não há RPC
transacional análoga a `import_quote_with_items` (Fatia 3). Justificativa:

1. **`Task` é entidade de primeira classe, não um array embutido.** `quote_items` (Fatia 3) não
   tem `localStorage` próprio, não tem tela própria, não tem CRUD independente — é puramente um
   array dentro do objeto `Quote` local. `Task`, ao contrário, tem seu próprio storage
   (`orbyt.tasks.v1`), seu próprio hook completo (`useTasks`), sua própria tela (`Tarefas.tsx`),
   e **existe e é usada rotineiramente sem nenhum `projectId`** (tarefas soltas/pessoais são um
   caso de uso real, não um estado transitório).
2. **A relação já é uma FK solta até no modelo local.** `Task.projectId` é opcional, casado em
   memória por igualdade de string (`t.projectId === project.id`, ver
   `ProjectDetailDrawer.tsx` linha 87-90), nunca um FK de banco local. Importar essa relação com
   a mesma força fraca que ela já tem hoje não introduz nenhuma regressão de integridade —
   herdar uma fraqueza pré-existente não é o mesmo que criar uma nova.
3. **O motivo da Fatia 3 precisar de RPC não se repete aqui.** Ali, uma falha parcial (quote sem
   itens, ou itens órfãos) quebraria algo que o usuário vê como **uma coisa só** — a tela de
   orçamento mostra quote+itens como um único documento. Aqui, `Project` e `Task` já são **duas
   coisas** para o usuário — duas telas, dois hooks, duas listas de candidatos de import
   separadas. Um projeto importado sem (ainda) sua tarefa filha é uma situação visível e
   compreensível, não uma corrupção de um objeto único.
4. **O padrão de resolução já existe e já é aceito.** `Task.projectId` resolve pelo mesmo
   mecanismo Q4 de fan-out/órfã que `clientId`/`quoteId`/`opportunityId` já usam em todas as
   fatias anteriores: mapeado → uuid real; não mapeado → `null` + aviso de "vínculo não
   encontrado" na UI. Não é um mecanismo novo, é o 4º uso do mesmo mecanismo (§7.4).
5. **Recomendação operacional, não uma trava de código:** o painel de import deveria sugerir
   (copy/ordem de exibição) importar `projects` antes de `tasks`, para maximizar quantos vínculos
   resolvem de primeira — mas, como nas Fatias 2-6, a ordem não é imposta pelo mecanismo. Uma
   task importada antes do seu projeto fica com `project_id: null` (órfã) até uma nova rodada de
   import ser rodada depois de o projeto já estar mapeado — não há backfill automático de órfãs
   quando o pai chega depois (mesma limitação já aceita para client/quote/opportunity em todas as
   fatias, não uma novidade desta).

---

## 9. Design — TOCTOU de "tarefas base": a correção óbvia NÃO funciona — recomendação: CATALOGAR

A pergunta era se um índice único simples resolveria a corrida
`CreateProjectBaseTasksDialog.tsx` (SELECT-depois-INSERT em massa, §1(b) da Fase A). Investigação
mais funda: **não resolve**, e vale registrar o porquê, não só a conclusão.

**Por que um índice parcial simples (`UNIQUE(project_id) WHERE source='project_template' AND
deleted_at IS NULL`) NÃO serve:** uma "geração de tarefas base" bem-sucedida grava **várias**
linhas (até 9, `DEFAULT_TASKS`) com o **mesmo** `project_id` e o **mesmo** `source =
'project_template'` — um índice único só em `(project_id)` filtrado por esse `source` rejeitaria
a 2ª..9ª linha do PRIMEIRO lote legítimo, não só de um lote duplicado. Precisaria de uma terceira
coluna na chave para distinguir "linha 1 de 9" de "linha 2 de 9" dentro do mesmo lote.

**A coluna óbvia para isso seria `sort_order`** (`UNIQUE(project_id, sort_order) WHERE
source='project_template' AND deleted_at IS NULL`) — mas não funciona também, por um motivo mais
sutil: `CreateProjectBaseTasksDialog.tsx` linha 116 atribui `sort_order: idx` a partir do índice
dentro do **subconjunto filtrado pelo usuário** (`selectedTasks.map((t, idx) => ...)`), não a
partir de uma posição fixa das 9 tarefas-padrão. Se dois usuários (ou duas abas) selecionarem
subconjuntos diferentes — ex. um seleciona as tarefas 1/3/5/7/9 (ganhando `sort_order` 0,1,2,3,4)
e outro seleciona 2/4/6 (ganhando `sort_order` 0,1,2) — **nenhum dos dois colide** com o outro
nessa chave, mesmo gerando lotes para o mesmo projeto. O índice pareceria proteger mas deixaria
passar exatamente o tipo de corrida concorrente que motivou a pergunta.

**A correção correta é de outra natureza:** uma "trava de reivindicação" atômica fora da tabela
de tarefas — por exemplo, uma coluna nova em `projects` (`base_tasks_generated_at timestamptz`)
e um `UPDATE projects SET base_tasks_generated_at = now() WHERE id = ? AND
base_tasks_generated_at IS NULL RETURNING id` rodado **antes** do insert em massa; 0 linhas
devolvidas = alguém já reivindicou, aborta. Isso é uma mudança de esquema + de código na
feature de "tarefas base" (`CreateProjectBaseTasksDialog`/`tasksRepository`), não um índice em
`tasks` — fora do formato "adicionar um índice" que a pergunta original presumia.

**Recomendação: CATALOGAR, não corrigir agora.** Motivos: (a) o caminho está **hoje
inalcançável** na UI publicada (§2.3 da Fase A — `SupabaseOperationalDashboardCard` desmontado),
risco líquido zero em produção; (b) a correção certa é maior e de forma diferente do que esta
fatia está fazendo (schema+mapper de import geral) — merece seu próprio ciclo de design/aprovação
se e quando aquela feature for reativada, não deveria ser encaixada como efeito colateral do
import geral de `tasks`. Este achado (o índice óbvio não funciona, e por quê) fica registrado
aqui para quem decidir reativar aquele card no futuro.

---

## 10. Design — Gap do 3º nível (`subtasks`/`comments`): CATALOGADO como bloqueante de cutover futuro

Já levantado na Fase A (§1, "Profundidade real"): o schema de `tasks` não tem **nenhuma**
representação para o checklist embutido (`Task.subtasks[]`/`Task.comments[]`) — nem tabela
própria, nem coluna JSONB. Confirmado: nenhuma migration em `supabase/migrations/` cria algo
equivalente a `task_subtasks`/`task_comments`, nem uma coluna JSON em `tasks`.

**Escopo desta fatia:** o import geral desenhado aqui move `Project` e `Task` como **linhas**
(um nível cada) — os campos `subtasks`/`comments` de cada `Task` **ficam de fora do import**, por
não terem para onde ir. Isto não é um esquecimento, é uma decisão de escopo explícita.

**Catalogado como bloqueante — não desta fatia, de qualquer fatia futura que queira migrar o
CRUD completo de `tasks`** (não só importar um snapshot, mas fazer `useTasks()` ler/escrever
Supabase de verdade): antes disso ser possível, alguém precisa desenhar e aplicar uma migration
nova (tabela `task_subtasks`/`task_comments`, ou uma coluna JSONB em `tasks`) — e decidir como
gerar `id`s estáveis para os itens de `SubTask`/`TaskComment`, que hoje **não têm `id`** (mutados
por índice de array, `toggleSubtask(taskId, idx)`) — os dados locais não trazem uma chave natural
para essa migração. Registrado aqui para não se perder; nenhuma ação necessária nesta fatia.

---

## 11. F5-equivalente (projeto CRM invisível, §2.4 da Fase A) — recomendação: CORRIGIR, padrão F5-b

**Recomendação: corrigir, análogo à F5-b da Fatia 6** — redirecionar
`CreateProjectFromQuoteDialog.tsx` para gravar **local** (`useProjects().addProject()` +
`useTasks().addTask()` quando aplicável) em vez de `projectsRepository.createProjectFromQuote`,
desativando o caminho nuvem **até o cutover real**, sem apagar o contrato de negócio
(`findProjectByQuote`/`createProjectFromQuote` continuam vivos, cobertos pelo design de
coexistência do §7.2 — só deixam de ser chamados por este diálogo específico).

**Por que corrigir, não só catalogar (ao contrário do TOCTOU do §9):**
1. **Já existe um substituto local prático e comprovado** — `QuoteToProjectDialog.tsx` (Vendas,
   §2.5 da Fase A) já faz exatamente essa conversão, 100% local, é o fluxo que o usuário real usa
   hoje. Redirecionar não é inventar um caminho novo, é reaproveitar um já provado — o mesmo
   raciocínio que sustentou F5-b em finance.
2. **Diferente do TOCTOU (§9), este caminho é hoje ALCANÇÁVEL em produção**
   (`getCrmDataSource()` retorna `"supabase"` por padrão — confirmado, Fase A §2.2) — deixar
   destrancado enquanto esta fatia constrói um import geral do lado de baixo aumenta a área de
   dado invisível em vez de reduzi-la.
3. **Custo baixo, forma já conhecida** — é a mesma classe de mudança que F5-b já fez (trocar o
   import de um repository por um hook local, ajustar o payload, manter o dedup) — não introduz
   desenho novo, só aplica um padrão já aprovado uma vez.

Esta correção é código (não uma migration), então cabe na fase de **implementação**, não nesta
fase de design — mas a decisão (corrigir, não catalogar) fica registrada e aprovada em desenho
aqui, para não ficar em aberto quando a implementação for autorizada.

---

## 12. Migrations escritas (não aplicadas)

4 arquivos, 2 pares independentes (`projects` e `tasks` não dependem um do outro — podem ser
aplicados em qualquer ordem entre si; dentro de cada par, coluna antes do índice):

- `supabase/migrations/20260721000200_etapa5_fatia7_projects_add_source_local_id.sql`
- `supabase/migrations/20260721000300_etapa5_fatia7_projects_unique_source_local_id.sql`
- `supabase/migrations/20260721000400_etapa5_fatia7_tasks_add_source_local_id.sql`
- `supabase/migrations/20260721000500_etapa5_fatia7_tasks_unique_source_local_id.sql`

Pré-aplicação: `docs/database/etapa-5-fatia-7-preaplicacao.sql` (7 queries — baseline, coluna
ainda ausente, pós-ALTER de cada tabela, pós-índice de cada tabela, controle de
`ux_projects_from_quote` intocado).

Nenhuma migration acima foi aplicada. Nenhum índice novo para o TOCTOU do §9 foi incluído
(decisão: catalogar, não criar).

---

## 13. Runbook semeado — desenho de casos (proposta, aguardando aprovação — NÃO é texto executável ainda)

Mesmo formato da Fatia 6 (§10 antes de virar "pronto para execução"): tabela de casos, não script
pronto — os nomes/ids reais só existirão depois que mapper/repository/hook estiverem
implementados e aprovados. Prefixo de identificação sugerido: `seedF7-` no id local + `TESTE-` no
título (mesmo espírito redundante das Fatias 3-6).

| Caso | O que prova | Setup necessário |
|---|---|---|
| (a) projeto básico | upsert + arbiter geral novo de `projects` (`source: "manual"`) | nenhum |
| (b) projeto fan-out | `clientId` mapeado → `client_id` uuid real | mapeamento sintético de client, como na Fatia 6 |
| (c) projeto órfã | `clientId` sem mapeamento → `client_id` null, aviso na UI | nenhum extra |
| (d) projeto coexistência | projeto quote-linked reconhecido via `findProjectByQuote`, backfill de `source_local_id`, **sem duplicar** — prova a árvore do §7.2 e a tradução `"orçamento"→"quote"` | SQL setup pré-existente: um projeto `source='quote'` já criado pra mesma quote (simula o fluxo antigo do CRM já ter rodado) |
| (e) projeto idempotência | reimport do caso (a) — UPDATE via `ON CONFLICT`, nunca INSERT novo | reusa (a) |
| (f) tarefa básica | upsert + arbiter geral novo de `tasks`, sem `projectId` (tarefa solta) | nenhum |
| (g) tarefa fan-out para projeto | `projectId` mapeado (via o projeto do caso (a), já importado) → `project_id` uuid real — prova o 4º import-map (§7.4) e a decisão do §8 (sem RPC) | reusa (a) |
| (h) tarefa órfã de projeto | `projectId` presente mas **não** mapeado (projeto ainda não importado) → `project_id` null, aviso na UI — prova que a ordem projects-antes-de-tasks é sugestão, não trava (§8 item 5) | nenhum extra |
| (i) tarefa idempotência | reimport do caso (f) — UPDATE via `ON CONFLICT`, nunca INSERT novo | reusa (f) |

**Sem caso de atomicidade parcial/rollback** — decisão do §8 (sem RPC) torna esse tipo de prova
inaplicável, igual à Fatia 6 (`financial_transactions`, sem filhos). **Sem caso de TOCTOU de
tarefas-base** — decisão do §9 é catalogar, não corrigir; nada a provar nesta rodada. **Sem caso
de precisão monetária dedicado** — mesma lógica da Fatia 6: a quantização (`roundMoney`) já tem
cobertura de teste unitário própria; o que só a integração real prova é rede+banco+os dois
arbiters coexistindo, e isso já está coberto pelos casos (d)/(e)/(i) acima.

**Critério de aceite proposto:** 9/9 casos verdes.

---

**PARADO aqui.** Design de Fase B entregue (§7-§13) — decisões explícitas registradas para os 7
pontos pedidos: idempotência dos dois níveis + coexistência (§7), atomicidade pai-filho sem RPC
(§8), TOCTOU de tarefas-base catalogado com o porquê (§9), gap do 3º nível catalogado (§10),
F5-equivalente recomendado para correção (§11), migrations escritas e não aplicadas (§12),
runbook desenhado em tabela de casos (§13). **Nenhuma migration foi aplicada, nenhum código de
implementação foi escrito, nenhuma rodada foi executada.** Qualquer avanço (aprovação do design,
implementação, ou aplicação de migration) depende do "vai" literal do revisor colado neste chat
pelo operador.
