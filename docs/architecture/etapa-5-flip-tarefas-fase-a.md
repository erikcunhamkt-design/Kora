# Etapa 5 — G1/Tarefas — Fase A (inventário, somente leitura)

> Molde: réplica de `docs/architecture/etapa-5-flip-financeiro-fase-a.md`. Último domínio do G1 sem inventário — com este doc, o mapa fica completo (Projetos em Fase D, Financeiro inventariado, Tarefas inventariado). Não decide a ordem Financeiro × Tarefas × Etapa 9 (decisão do operador). Zero código tocado nesta rodada.

Branch: `etapa-5-flip-tarefas-fase-a`, a partir do tip real de `origin/main` em `b679635` (`docs(projects): G32 - fetch de projects em modo local e design da casa, nao vazamento`).

---

## 1. Estado atual do domínio

### 1.1 Cloud — `public.tasks` já existe, mas é feature PARALELA, não a mesma coisa que `orbyt.tasks.v1`

Achado central desta rodada: **`public.tasks` e `useTasks()` local são domínios paralelos, mal reconciliados hoje** — não é "a mesma tarefa vista de dois lugares", são dois sistemas que coexistem sem se falar.

Tabela criada em `supabase/migrations/20260601040000_create_tasks_schema.sql:4-23` — 18 colunas: `id, workspace_id, project_id, client_id, quote_id, opportunity_id, title, description, status (default 'todo'), priority (default 'medium'), due_date, source (default 'project_template'), sort_order, is_demo, archived, deleted_at, created_at, updated_at`, mais `source_local_id` (adicionada depois, `20260721000400_...sql:20-21`). RLS completo (4 policies, `is_workspace_member`, linhas 26-55). **Sem CHECK em `status`/`priority`** — mesma situação de `financial_transactions` (§3 do doc de Financeiro).

**`deliverables` NÃO é `public.tasks`** — é coluna `jsonb` em `public.projects` (`20260811000100_..._deliverables_status_check.sql:40-44`), espelhando `Project.deliverables[]` local. São conceitos disjuntos; não confundir ao ler o pacote de Projetos.

Código que já existe para `public.tasks`: `src/repositories/tasksRepository.ts` (`listTasksByProject`, `createProjectBaseTasks`, `softDeleteTask`, `updateTaskStatus` tipado só para `"todo"|"in_progress"|"done"`, `importTask`), `src/hooks/useSupabaseProjectTasks.ts` (React Query, `enabled: !!workspaceId && !!projectId`), `src/services/tasks/tasksMapper.ts`.

**O que é reaproveitável do que já existe vs. o que é feature paralela:**
- **Reaproveitável**: schema já criado com FK completa (client/quote/opportunity/project), RLS pronto, `source_local_id` + índice único já resolvem idempotência de import, repository/mapper já escrevem no formato certo.
- **Paralelo, não reconciliado**: hoje `public.tasks` só é alimentado por (1) `CreateProjectBaseTasksDialog.tsx` (feature nativa cloud-only, "gerar tarefas-base", `source='project_template'`) e (2) o importador assistido (§6). Ambos só são alcançáveis via `SupabaseOperationalDashboardCard.tsx` (painel experimental de Configurações, explicitamente rotulado "Somente Leitura"/"Experimental"). **`Tarefas.tsx` (a tela real) e `ProjectDetailDrawer.tsx` (tarefas vinculadas ao projeto) não leem nem escrevem `public.tasks` — usam `useTasks()` local filtrado por `projectId`.** Ou seja: um usuário pode ter tarefas locais de um projeto e linhas cloud desse mesmo projeto completamente divergentes, sem nenhuma reconciliação.

### 1.2 Local — `useTasks()` / `orbyt.tasks.v1`

`src/hooks/useTasks.ts:113-199`, chave `orbyt.tasks.v1` (linha 51). Tipo `Task` (linhas 15-48) — cópia morta idêntica em `src/types/domain.ts:251-289` sem nenhum import real (mesmo padrão de código morto já achado em Financeiro/`domain.ts`).

Campos: `id (number), title, description, client, project, projectId?, taskProjectId?, scope? (work/personal), priority, deadline, dueDate?, status, createdAt, updatedAt?, tags[], subtasks (SubTask[]), comments (TaskComment[]), recurrence?, archived?, isDemo?, reminderAt?, reminderEnabled?, reminderSentAt?, clientId?, quoteId?, milestoneId?, source?`.

`SubTask{text,done}` e `TaskComment{author,text,date}` **não têm `id` próprio** — mutados por índice de array (`toggleSubtask(taskId, idx)`, linha 164-171).

### 1.3 Flags — Tarefas também não tem flag de fonte de dados

Grep exaustivo em `src/config/flags.ts`: **não existe `kora.tasks.dataSource.v1` nem `getTasksDataSource()`/`useBifurcatedTasks`** — mesma situação de Financeiro. O que existe são 3 booleans estreitos (`BOOLEAN_FLAG_KEYS`, linhas 36-45) que só gateiam o CRUD experimental de `public.tasks` dentro do painel de Configurações: `projectsSupabaseCreateBaseTasks`, `tasksSupabaseStatusTransition`, `supabaseOperationalDashboard`. Nenhum deles seleciona a fonte de dados de `Tarefas.tsx`.

---

## 2. Consumidores de `useTasks()` — classificação

| Arquivo:linha | Uso | Classe |
|---|---|---|
| `src/pages/Tarefas.tsx:34-36,189` | Tela kanban/lista/views inteira, `useTasks()` | **(a) precisa migrar** — tela real |
| `src/components/projects/ProjectDetailDrawer.tsx:24,87,99-102` | `useTasks()` → `tasks.filter(t => t.projectId === project.id && !t.archived)` | **(a) precisa migrar** — **é local filtrado por `projectId`, NÃO a tabela cloud `public.tasks`** (ver §1.1) |
| `src/components/clients/ClientActivitiesTab.tsx:21,435,443` | `useTasks()` → `tasks`, alimenta `buildInferredEvents` | **(a) precisa migrar** — mesmo arquivo que já mistura `useBifurcatedProjects` com `useFinance()` cru (achado repetido do doc de Financeiro); agora soma um terceiro domínio cru |
| `src/components/day/DayCenter.tsx:37,118` | `useTasks()` → `updateTask`, `completeTask` | **(a) precisa migrar** |
| `src/hooks/useDayCenterActions.ts:3,15,21-36` | `updateTask(Number(item.relatedId), { status: "concluido" })` | **(a) precisa migrar** |
| `src/hooks/useDayCenterData.ts:2,23` | `useTasks()` → `tasks`, alimenta `computeDayCenter`. Comentário explícito nas linhas 15-20: "os outros domínios (tasks/leads/finance/quotes) seguem 100% locais, fora de escopo desta fatia" | **(a) precisa migrar** — mesmo arquivo, mesmo comentário já citado no doc de Financeiro, agora confirmando `tasks` nomeado explicitamente |
| `src/components/vendas/QuoteToProjectDialog.tsx:20,60` | `addTask` para semear `STARTER_TASKS` (linha 49-54) ao gerar projeto de orçamento | **(a) precisa migrar** |
| `src/hooks/useTaskReminders.ts:2` | Import de tipo `Task` (type-only) | **(a) precisa migrar** (consome shape local) — ver nota de lembretes abaixo |
| `src/lib/dayCenter.ts:5` | Import de tipo `Task` (type-only), função pura `computeDayCenter` | **(a) indireto** — mesmo padrão do `dayCenter.ts` já visto em Financeiro |
| `src/hooks/useLocalTasksImport.ts` + `src/services/tasks/tasksMapper.ts` | Importador assistido local→cloud | **(b) já bifurcado em espírito** — unidirecional, não vira fonte de leitura da tela |
| `src/components/dashboard/RecentTasks.tsx`, `TodayTasks.tsx` | Nenhum import de `useTasks`/`Task` (confirmado por grep) | **(c) não se aplica** |

**Achado estrutural**: `ClientActivitiesTab.tsx` agora acumula **três** domínios num mesmo arquivo — `useBifurcatedProjects` (já migrado), `useFinance()` cru (Financeiro, classe a), `useTasks()` cru (Tarefas, classe a). É o consumidor cruzado mais carregado dos três inventários — qualquer ordem de flip escolhida vai passar por este arquivo mais de uma vez.

**Lembretes (`useTaskReminders.ts`) — já tem o padrão latest-ref do G31, não é gap**: `src/hooks/useTaskReminders.ts:22-23` já usa `tasksRef` (`useRef` espelhando `tasks`, atualizado em `useEffect`) e o `tick()` do polling (linhas 54-69, `setInterval` de 30s) lê `tasksRef.current`, não o parâmetro `tasks` direto. Ou seja, este hook **já é uma instância pré-existente do padrão que o G31 corrigiu em outro lugar** (whatsapp bot config) — não precisa do mesmo fix, é precedente positivo, não pendência.

---

## 3. Schema real — `Task` local vs. `public.tasks`

| Campo local (`useTasks.ts:5-48`) | Coluna cloud | Mapeia 1:1? |
|---|---|---|
| `id` (number) | `id` (uuid) | Não — reconciliação via `source_local_id`, mesmo padrão de Financeiro/Projetos |
| `title`, `description` | `title`, `description` | 1:1 |
| `clientId` | `client_id` | Via import-map (`tasksMapper.ts:74`) |
| `projectId` | `project_id` | Via import-map (`tasksMapper.ts:73`) |
| `quoteId` | `quote_id` | Via import-map (`tasksMapper.ts:75`) |
| `dueDate` | `due_date` | 1:1 (`tasksMapper.ts:81`) |
| `priority` | `priority` | Passagem direta, sem CHECK; vocabulário `alta/média/baixa` vs. valores usados em `CreateProjectBaseTasksDialog.tsx:123` (`high/medium/low`) — **não verificado a fundo nesta rodada, sinalizado como pendência de checagem futura**, não confirmado como bug |
| `status` | `status` | **Vocabulário divergente — ver abaixo (equivalente O12)** |
| `archived` | `archived` | 1:1 (`tasksMapper.ts:85`) |
| `isDemo` | `is_demo` | 1:1 (`tasksMapper.ts:84`) |
| `source` | `source` | Vocabulário disjunto por desenho (`manual/projeto/orçamento` vs. `project_template`), documentado em `tasksRepository.ts:95-99` |
| `client`, `project` (strings de exibição) | *(sem coluna)* | Não é gap — resolvido via join, mesmo padrão de projetos/quotes |
| **`taskProjectId`** (agrupamento local, `useTaskProjects.ts`) | *(sem coluna)* | **Gap** — `TaskProject`/`kora.taskProjects.v1` não tem nenhuma representação cloud |
| **`scope` (work/personal)** | *(sem coluna)* | **Gap** |
| **`tags[]`** | *(sem coluna)* | **Gap** |
| **`subtasks` (`SubTask[]`)** | *(sem coluna)* | **Gap catalogado formalmente** em `docs/qa/etapa-5-fatia-7-projects.md:326-337,808-824,1519-1529` como "gap de 3º nível, bloqueia cutover completo futuro" |
| **`comments` (`TaskComment[]`)** | *(sem coluna)* | **Gap**, mesma catalogação acima |
| **`recurrence`** | *(sem coluna)* | **Gap não catalogado ainda** — ver §7/§4 (Riscos) |
| **`reminderAt`/`reminderEnabled`/`reminderSentAt`** | *(sem coluna)* | **Gap não catalogado ainda** — ver §7/§4 |
| **`milestoneId`** | *(sem coluna)* | **Gap** — nenhum conceito de milestone no schema cloud |
| *(sem campo local)* | `opportunity_id` | Sempre gravado `null` no import geral (`tasksMapper.ts:9-12,60,76`) — `Task` local não tem `opportunityId` |
| *(sem campo local)* | `sort_order` | Sempre `0` no import geral (`tasksMapper.ts:83`); só tem sentido para linhas `project_template` |

### Equivalente do O12 — status divergente, e mais grave que em Financeiro

- Local `Task.status` (`useTasks.ts:6`): **4 valores** — `a_fazer | em_andamento | revisao | concluido`.
- `tasksRepository.updateTaskStatus` (`tasksRepository.ts:78`) é tipado só para **3 valores em inglês** — `todo | in_progress | done` — vocabulário completamente diferente, sem estado equivalente a "revisão".
- A coluna não tem CHECK, então fisicamente as duas vocabulárias convivem no mesmo `text`.
- `docs/qa/etapa-5-fatia-7-projects.md:683-690` já registrou isso como "sem conflito real" porque o importador grava `status` verbatim (nunca chama `updateTaskStatus`) — mas isso já produziu um **gap de UI concreto e existente hoje**: o `<select>` editável em `SupabaseOperationalDashboardCard.tsx:185-194` só oferece `<option>` para `todo/in_progress/done` — uma tarefa importada com `status: "revisao"` não casa com nenhuma opção, deixando o estado do dropdown ambíguo (o branch somente-leitura, linhas 196-207, trata `"revisao"` corretamente; só o branch editável tem o gap).
- **Diferença chave para Financeiro**: em Financeiro o equivalente-O12 era latente (nunca exercitado). Em Tarefas, **já existe um caminho de escrita real (`updateTaskStatus`) tipado para um vocabulário que não cobre `"revisao"`** — se o flip vier a usar esse método como está, qualquer tarefa em revisão perde o estado ao ser escrita na nuvem. É um risco mais avançado que o de Financeiro, não só um "seria bom adicionar CHECK depois".

---

## 4. Riscos nomeados (R1..Rn)

**R1 — Vocabulário de status incompatível com risco de perda de estado na escrita.** `updateTaskStatus` não tem opção para `"revisao"` (ver §3). Se o flip reusar esse método sem tradução, tarefas em revisão viram estado indefinido na nuvem. Precisa de shim de tradução (`a_fazer→todo, em_andamento→in_progress, revisao→?, concluido→done`) — decisão de produto sobre o que "revisão" vira no vocabulário atual de 3 estados, ou expandir o vocabulário cloud para 4.

**R2 — `public.tasks` e `useTasks()` local já divergem hoje, silenciosamente.** Diferente de Financeiro (onde não havia nenhuma escrita cloud concorrente fora do fluxo de recebível), aqui já existem duas fontes de verdade rodando em paralelo sem reconciliação: tarefas-base geradas via `CreateProjectBaseTasksDialog` (cloud-only) e tarefas locais de projeto (`ProjectDetailDrawer`). Um flip real precisa decidir explicitamente o que acontece com as linhas `source='project_template'` já existentes na nuvem — elas não têm `source_local_id` (não vieram de import), então o merge com o array local não é automático.

**R3 — Import existe (`useLocalTasksImport.ts`), mas depende de 3 import-maps upstream** (clients/quotes/projects) para resolver FK — órfãos de `projectId` não resolvido têm mecanismo de backfill (`pendingLinks`, linhas 122-141) já implementado; não é risco novo, é reaproveitável, mas é uma dependência de ordem (projects/clients/quotes precisam estar com import-map populado antes do de tasks fazer sentido).

**R4 — Recorrência e lembretes sem contraparte cloud, e sem tabela de catálogo ainda.** Nenhuma coluna em `public.tasks` para `recurrence`/`reminderAt`/`reminderEnabled`/`reminderSentAt`; o mapper de import descarta esses campos silenciosamente (não avisa, não bloqueia). Diferente do gap de subtasks/comments (já catalogado formalmente em `etapa-5-fatia-7-projects.md`), **este gap não está registrado em nenhum doc hoje** — grep por `recurrence`/`reminderAt`/`reminderEnabled` nesse doc retorna zero. `useTaskReminders.ts` é 100% client-side (`setInterval` + `Notification` API) — não há nenhum conceito de agendamento server-side em nenhum domínio já checado (Financeiro incluído).

**R5 — Subtasks/comments sem `id` próprio (mutação por índice).** Mesmo que ganhassem coluna cloud, o desenho atual (`SubTask{text,done}`, `TaskComment{author,text,date}`, sem `id`) não sobrevive a um formato relacional/array-em-jsonb sem risco de reordenação quebrar referências — mutação hoje é por índice de array (`toggleSubtask(taskId, idx)`). Um flip que persista subtasks precisa resolver isso antes (dar `id` estável), não como parte do flip em si.

**Asaas/Pix/integrações de pagamento — não se aplica a Tarefas** (irrelevante para este domínio; verificação já feita no doc de Financeiro).

---

## 5. Esboço dos casos de homologação e critérios de rollback

Herdando:
- **G29** — banner/texto de UI desatualizado sobrevivendo ao flip real da escrita;
- **G30** — mutation que só invalida e confia no refetch pra refletir a própria escrita (classe "cache de mutação"); qualquer hook novo de tasks bifurcadas precisa nascer já escrevendo a resposta do UPDATE no cache (`setQueryData`), não só invalidando;
- **G32** — rodar a query Supabase em paralelo sempre (`enabled: !!workspaceId`, não `enabled: dataSource === "supabase"`) é *design da casa*, confirmado em 3 domínios (projects/quotes/opportunities) — não é vazamento, é o padrão esperado; um `useSupabaseTasks` novo deveria seguir o mesmo gate só-de-exibição, não inventar um gate de fetch;
- **G33** — `blockWrite()` em `QuotesSection.tsx:122-126` bloqueava incondicionalmente "Gerar projeto" sempre que `dataSource` de **quotes** fosse `supabase`, mesmo depois do cutover de **projects** (Fase B) já ter resolvido R5 (`QuoteToProjectDialog.tsx` grava local sempre + espelho best-effort, independente da flag de quotes) — um gate que checava a migração errada, nunca atualizado quando o domínio que ele realmente protegia terminou de migrar. Classe: "gate fóssil cobrindo ação errada" (irmão do G29, mas bloqueio funcional, não só banner). **Nota direta sobre Financeiro/Tarefas**: o mesmo commit confirma que `openReceivableDialog` (gerar conta a receber) **continua bloqueado corretamente**, porque `QuoteToReceivableDialog.tsx` só grava local e finance genuinamente não migrou ainda — ou seja, o catálogo já está tratando a Fase A de Financeiro (Lane C) como referência viva para saber quais gates ainda são legítimos. **Aplicação a Tarefas**: nenhum gate fóssil equivalente foi identificado nesta rodada para `useTasks()` (`QuoteToProjectDialog.tsx` semeia `STARTER_TASKS` via `addTask` sem gate nenhum hoje) — mas a classe é uma recorrência (2ª ocorrência depois de G29), então qualquer gate futuro que bloqueie uma ação de tasks checando o dataSource de OUTRO domínio precisa ser auditado no dia em que esse outro domínio migrar, não só no dia em que tasks migrar;
- disciplina de "criar ANTES de consultar" (evitar SELECT prematuro).

1. **Caso 1 — Leitura em modo Supabase**: abrir `Tarefas.tsx` com fonte de dados em `supabase`; esperado: tarefas antes só locais aparecem oriundas de `public.tasks`, sem duplicar as `project_template` já existentes nem as importadas via `useLocalTasksImport`.
2. **Caso 2 — Escrita: criar tarefa manual em modo Supabase**: criar tarefa pela tela (`source='manual'`); esperado: grava em `public.tasks`, aparece sem reload.
3. **Caso 2b — Transição de status refletida na própria mutação (lição G30)**: mover tarefa entre colunas do kanban; esperado: card e qualquer drawer/detalhe aberto refletem o novo status sem fechar/reabrir — se a mutation usada seguir invalidate-only, reproduz G30.
4. **Caso 3 — Status "revisão" sobrevive à escrita cloud (risco R1)**: mover tarefa para "revisão" em modo Supabase; esperado a ser definido ANTES do teste (não descoberto durante) — qual string é gravada, e se o dropdown/badge de status em qualquer UI cloud-aware reconhece esse valor.
5. **Caso 4 — Tarefas-base de projeto (`project_template`) coexistindo com tarefas migradas do local (risco R2)**: workspace com tarefas-base já geradas via `CreateProjectBaseTasksDialog` E tarefas locais do mesmo projeto; esperado a ser definido — elas se combinam, uma sobrescreve a outra, ou ficam visualmente distintas?
6. **Caso 5 — Exclusão: soft vs. hard delete**: excluir tarefa em modo Supabase; esperado: `deleted_at` preenchido (soft), não removida fisicamente — checar se a leitura filtra `deleted_at IS NULL` (mesma ressalva do Caso 4 de Financeiro).
7. **Caso 6 — Consumidores cruzados (Central do Dia, ClientActivitiesTab, ProjectDetailDrawer)**: cada um deve refletir a mesma fonte de dados que `Tarefas.tsx` está usando — atenção especial a `ClientActivitiesTab.tsx`, que já acumula 3 domínios (projetos bifurcado, finance cru, tasks cru) no mesmo arquivo.
8. **Caso 7 — Banner/texto de UI desatualizado (lição G29)**: auditar `Tarefas.tsx` e os consumidores cruzados por qualquer copy fixo tipo "em breve"/"local"/"modo leitura" que sobreviva ao ponto em que a escrita real já funciona.
9. **Caso 8 — Rollback disparado**: reverter a flag de fonte de dados para `local` com o flip já ativo; esperado: tela volta a ler `orbyt.tasks.v1` sem perder tarefas criadas em modo Supabase (somem da view local, não são apagadas) — mesma semântica de rollback nível 1 de Projetos/Financeiro.

**Rollback nível 1** (flag de dataSource → local): reversível sem perda, mesma lição G29 — a flag de escrita (se vier a existir) não bloqueia CRUD sozinha, só troca a fonte de leitura.

**Rollback nível 2** (parar de gravar em Supabase): manter só o importador assistido ativo (estado atual), sem nenhuma tela lendo/escrevendo `public.tasks` em tempo real.

---

## 6. Fechamento — estimativa comparativa

**Tarefas é o maior dos três flips do G1** — maior que Financeiro, que já era maior que Projetos. Razões concretas:

1. **Divergência de dado já em produção, não hipotética.** Financeiro tinha só um caminho de escrita cloud isolado (`CreateReceivableDialog`, atrás de flag OFF). Tarefas já tem **dois** caminhos cloud-nativos ativos e alcançáveis (ainda que via painel experimental) gerando linhas em `public.tasks` sem `source_local_id` — a reconciliação com o array local não é greenfield, precisa lidar com dado que já existe e diverge.
2. **Vocabulário de status quebrado em produção, não apenas latente.** Em Financeiro, o equivalente-O12 nunca foi exercitado (só `pending`/`paid` testados). Em Tarefas, `updateTaskStatus` já é chamável hoje com um vocabulário que **não tem opção para "revisão"** — é um risco ativo (R1), não uma lacuna de hardening futura.
3. **Mesmo número de gaps de schema "sem categoria própria" (subtasks/comments/recorrência/lembretes/scope/tags/milestone) que Financeiro (categoria/fornecedor/conta-caixa/forma-pagamento/recorrência) — mas dois deles (subtasks, comments) já são gap de 3º nível formalmente catalogado como bloqueante**, enquanto nenhum gap de Financeiro tinha esse status de "já documentado como bloqueio" antes desta rodada.
4. **Consumidor cruzado mais carregado**: `ClientActivitiesTab.tsx` acumula os três domínios (projetos/finance/tasks) — qualquer flip de Tarefas toca um arquivo que Financeiro já ia precisar tocar, então parte do custo de auditoria desse arquivo específico é compartilhável entre as duas ordens possíveis, não adicional se Financeiro for feito primeiro.

Compensando parcialmente: infraestrutura incidental mais madura que a de Financeiro no dia 1 — schema com FK completa desde a criação, `source_local_id` + índice único já resolvidos, importador assistido já homologado com mecanismo de backfill de órfãos (`pendingLinks`) que Financeiro não teve que construir.

**Insumo para a decisão do operador**: dos três domínios do G1, a ordem por esforço/risco crescente seria Financeiro < Tarefas, principalmente por causa do risco R1 (perda de estado ativa, não hardening futuro) e do R2 (dado cloud já divergente hoje, não greenfield). Se a ordem for decidida por risco em vez de esforço puro, Tarefas também fica atrás de Financeiro — não há achado aqui que sugira Tarefas antes de Financeiro por nenhum critério.

---

## Referências

- `docs/architecture/etapa-5-flip-financeiro-fase-a.md` — molde de estrutura/profundidade usado aqui
- `docs/qa/etapa-5-fatia-7-projects.md` — origem do gap catalogado de subtasks/comments (§10, linhas 326-337/808-824/1519-1529) e da nota "sem conflito real" de status (linhas 683-690)
- `docs/architecture/kora-hub-auditoria-e-plano.md` — G29 (banner de UI), G30 (cache de mutação), G32 (fetch paralelo é design da casa)
- `src/hooks/useTaskReminders.ts:22-23` — precedente positivo do padrão latest-ref (pré-G31, já correto)
