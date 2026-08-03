# Etapa 5 — Domínio Projetos — Fase A (diagnóstico)

> Zero mudança de código nesta fase. Levantamento puro, base para a Fase B
> (design) e C (implementação) do flip de `projects`, no mesmo padrão já
> fechado para CRM (`etapa-5-fatia-8-crm-cutover.md`) e quotes
> (`etapa-5-flip-quotes.md`).

## Abertura (§16/§17)

- Worktree: `Kora-laneA`.
- Branch nova: `etapa-5-flip-projetos`, criada a partir de `origin/main`.
- Hash confirmado por `git log origin/main -1 --oneline`: **`71c4a75`**
  (`docs: roadmap - G5 100% fechado...`) — bate com o esperado pelo revisor.

## Nota de terminologia — possível colisão de numeração

O fechamento do Pacote do Flip de quotes registrou o marco **"G1/`quotes`
COMPLETO — primeiro domínio 100% Supabase por default"** (`etapa-5-flip-quotes.md`
§7). Este pacote chega rotulado **"G1 — Domínio Projetos"**. Se "G1" for o
mesmo contador sequencial de domínios flipados, isso é uma reutilização do
mesmo número para dois domínios diferentes (quotes já é G1). Não bloqueia o
diagnóstico — só sinalizando para o revisor confirmar se o rótulo pretendido
aqui é "G2" (ou outra numeração), antes que o catálogo registre os dois como
"G1" em lugares diferentes.

---

## 1. Inventário de escrita

Achado central: **`useProjects()` (`src/hooks/useProjects.ts`), a fonte que
`ProjectsSection.tsx` e `ProjectDetailDrawer.tsx` realmente leem, é 100%
localStorage incondicional — sem nenhum branch Supabase dentro do hook.**
Diferente de CRM/quotes (onde o flip trocou o *default* de um seletor que já
existia), aqui não existe seletor algum ainda: o hook nunca foi bifurcado.

| # | Ponto de escrita | Arquivo:linha | Gatilho | Grava em | Flag |
|---|---|---|---|---|---|
| 1 | `addProject` (form) | `components/projetos/ProjectsSection.tsx:104` (`handleCreate`) | "+ Novo projeto", tela principal | localStorage | nenhuma |
| 2 | `updateProject` (checklist de entregável) | `components/projects/ProjectDetailDrawer.tsx:107` (`setDeliverableStatus`) | Drawer, checkbox de entregável | localStorage | nenhuma |
| 3 | `updateProject` (transições de status) | `components/projects/ProjectDetailDrawer.tsx:113` (`handleStatus`) | Drawer, menu Iniciar/Concluir/Pausar/Arquivar/Restaurar/Cancelar | localStorage | nenhuma |
| 4 | `deleteProject` (hook existe) | `hooks/useProjects.ts:124-126` | **nenhum caller na UI** (grep confirma) | localStorage | n/a |
| 5 | `addProject` + `addTask`s | `components/vendas/QuoteToProjectDialog.tsx:95` (`handleGenerate`) | Vendas → "Gerar projeto" (card/dropdown, quote aprovada) | localStorage | nenhuma (só `blockWrite()` do dataSource da própria quote) |
| 6 | `addProject` (local) + `projectsRepository.createProjectFromQuote` (espelho) | `components/crm/CreateProjectFromQuoteDialog.tsx:100` / `:121` | CRM → `LinkedQuotesSection.tsx` "Gerar projeto" (L259) | **AMBOS** — local autoritativo + espelho Supabase best-effort | `quotesSupabaseCreateProject` (default OFF) |
| 7 | `projectsRepository.importProject` | `hooks/useLocalProjectsImport.ts:158` | Configurações → "Importar projetos locais" | Supabase (one-way, não toca o registro local) | nenhuma (ferramenta assistida, sempre disponível) |
| 8 | `projectsRepository.softDeleteProject` | `repositories/projectsRepository.ts:71-84` | **nenhum caller — código morto** | Supabase (não usado) | n/a |
| 9 | (adjacente, tabela `tasks` não `projects`) `tasksRepository.createProjectBaseTasks` | `components/projects/CreateProjectBaseTasksDialog.tsx:132` | Configurações → painel de ops (órfão, ver §2) → "Gerar tarefas base" | Supabase | `projectsSupabaseCreateBaseTasks` (default OFF) |

**Histórico do item 6 (importante para não reabrir uma decisão já tomada):**
a Fatia 7 (`etapa-5-fatia-7-projects.md` §2.4/§11) catalogou este mesmo ponto
como um bug classe F5 ("escreve onde ninguém lê" — o espelho na nuvem
existia, mas nenhuma tela mostrava de volta). A correção (Fatia 7, item 4)
redirecionou `CreateProjectFromQuoteDialog` para gravar só local. Depois,
**G22** (branch `dashboard-g22-fix`, já mesclado em `main` antes de `71c4a75`)
reintroduziu o espelho Supabase como dual-write best-effort, com o local
seguindo autoritativo — o comentário no próprio arquivo (`:32-37`) documenta
essa decisão. Estado atual = dual-write, não local-only.

Todas as escritas Supabase em `projects` passam por um único arquivo —
`projectsRepository.ts` (grep repo-wide por `from('projects')`/`from("projects")`
confirma zero inserts/updates fora dele; a única outra ocorrência é um
`.select()` somente-leitura em `WhatsAppContactPanel.tsx:247`).

---

## 2. Inventário de leitura

- **Tela principal:** `AppSidebar.tsx:47` → `/portfolio?tab=projetos` →
  `Portfolio.tsx:237` monta `<ProjectsSection />`. `ProjectsSection.tsx:39` e
  `ProjectDetailDrawer.tsx:22-23,75` importam só `useProjects()` — zero
  import de Supabase em qualquer um dos dois arquivos.
- **Nenhum seletor de dataSource existe** — grep repo-wide por
  `getProjectsDataSource|projectsDataSource|PROJECTS_DATA_SOURCE` retorna
  zero. `flags.ts` só tem as 2 flags booleanas opt-in já listadas no
  inventário de escrita (`quotesSupabaseCreateProject`,
  `projectsSupabaseCreateBaseTasks`) — nenhuma delas é um seletor de leitura.
- **Infraestrutura Supabase de leitura já existe, mas está isolada num
  painel órfão:**
  - `projectsRepository.listProjects` (`:86-96`) — select real, filtro
    `deleted_at IS NULL`.
  - `useSupabaseProjectsSummary` (`hooks/useSupabaseProjectsSummary.ts`) —
    wrapper React Query do acima.
  - `useSupabaseProjectTasks` + `ProjectTasksList` — dentro de
    `SupabaseOperationalDashboardCard.tsx` (`:28`, montado em `:526`).
  - Esse card é importado em `Configuracoes.tsx:84` e montado em `:892`,
    mas atrás da flag `supabaseOperationalDashboard` (default OFF) — é um
    painel interno de QA/debug, rotulado "Experimental"/"Somente Leitura",
    **não** a tela real. É o único lugar do app que lê `projects`/`tasks` da
    nuvem hoje.

---

## 3. Schema — local vs Supabase

### Campos

| Local (`Project`, `useProjects.ts:21-49`) | Supabase (`projects`, `types.ts:623-641`) | Observação |
|---|---|---|
| `name` | `title` | Mesma classe do "orçamento"→"quote": nome diferente, precisa tradução nos dois sentidos (hoje só existe no sentido escrita, `projectsMapper.ts:91`). |
| `clientName` (string livre) | `client_id` (uuid FK) | Não é só rótulo — nuvem não tem nome desnormalizado; precisa join ou o import-map de clients. |
| `startDate`/`dueDate` | `start_date`/`due_date` | Trivial (case). |
| `budget` | `budget` | Igual, mas nuvem passa por `roundMoney()` no import. |
| `source: "manual"\|"orçamento"` | `source: "manual"\|"quote"` (texto livre) | Já resolvido uma vez: `projectsMapper.ts:60-63` (`resolveCloudProjectSource`). |
| `status` (enum 7 valores) | `status: string`, **sem enum/CHECK no banco** | Ver risco dedicado abaixo — é o achado mais importante desta fase. |
| `priority`, `progress`, `tags`, `serviceType`, `notes`, `completedAt` | *(sem coluna)* | Só existem localmente. |
| `quoteTitle`/`opportunityTitle` (denormalizado) | *(só a FK uuid)* | Nuvem não guarda o texto, só o vínculo. |
| `deliverables: ProjectDeliverable[]` | *(sem tabela/coluna)* | Ausência total na nuvem. |
| *(sem equivalente)* | `archived: boolean` | Campo só-nuvem, e efetivamente morto: local codifica "arquivado" como valor de `status`, o mapper sempre grava `archived: false` (`projectsMapper.ts:99`), nunca traduz `status === "archived"` pra esse booleano. |
| *(sem equivalente)* | `workspace_id`, `deleted_at`, `source_local_id` | Multi-tenant/soft-delete/idempotência — conceitos que só existem no lado nuvem. |

### Risco de schema #1 — vocabulário de `status` sem normalização (o mais importante)

`projects.status` na nuvem é texto livre, **sem** constraint. Dois
caminhos de escrita já povoam valores **não sobrepostos**:
1. `projectsRepository.createProjectFromQuote` grava `status: "active"`
   (`:51`) — valor que **não existe** no enum local (7 valores, nenhum é
   "active").
2. O import geral (`projectsMapper.ts:93`) passa o `status` local
   **verbatim** — então linhas importadas carregam `"planning"`,
   `"in_progress"`, `"review"`, `"delivered"`, `"paused"`, `"cancelled"` ou
   `"archived"`.

O único consumidor Supabase hoje já precisa contornar isso na marra:
`SupabaseOperationalDashboardCard.tsx:315-316` calcula "projetos ativos"
como `status === "active" || status === "in_progress"` — um OR defensivo
porque já sabe que a coluna é inconsistente. Sem uma camada de tradução
(equivalente ao `resolveCloudProjectSource` que já existe para `source`),
um projeto com `status: "active"` renderiza sem rótulo em
`PROJECT_STATUS_LABEL[p.status]` (`ProjectsSection.tsx:243`) assim que a
tela principal passar a ler nuvem.

### Risco de schema #2 — `tasks.status`, vocabulário disjunto (bônus, relevante pro acoplamento §4)

Local usa português (`a_fazer|em_andamento|revisao|concluido`), nuvem usa
inglês (`todo|in_progress|done`). Sem colisão hoje (vocabulários disjuntos,
confirmado em `etapa-5-fatia-7-projects.md:648`), mas `ProjectTasksList`
já precisa ramificar nos dois conjuntos ao renderizar — sinal de que linhas
nos dois vocabulários já existem/existiram.

---

## 4. Dependência Projetos↔Tarefas

- Projeto **não** tem lista de tarefas embutida — tem `deliverables[]`
  (marcos/entregáveis, conceito separado, sem representação na nuvem, ver
  §3). Tarefas de verdade são a entidade `Task` (`useTasks.ts`), ligada por
  `Task.projectId` — **casamento em memória, nunca FK real do lado local.**
- `tasks.project_id` na nuvem **já é uma FK real**, `REFERENCES
  projects(id) ON DELETE CASCADE` (confirmado, `etapa-5-fatia-7-projects.md:316`).
  Consequência prática pra esta fatia: qualquer rotina futura de
  hard-delete/limpeza de projeto arrasta as tasks filhas junto — precisa
  estar explícito em qualquer runbook de limpeza da Fase D.
- "Gerar tarefas base" na criação de projeto **não é automático** — é uma
  ação manual (`CreateProjectBaseTasksDialog`), e hoje só é alcançável a
  partir do painel órfão (`SupabaseOperationalDashboardCard`, nunca
  renderizado em produção real). Fluxo de tarefas iniciais que O USUÁRIO
  real usa é outro, 100% local: `QuoteToProjectDialog.tsx` (Vendas),
  `STARTER_TASKS` (4 itens fixos) via `addTask` local.
- `Tarefas.tsx` (a tela) é **100% local hoje**, zero import de Supabase —
  roadmap já classifica como "🔴 não migrado na prática"
  (`kora-roadmap.md` §3.6). Não há hook geral de tasks Supabase (só o
  escopado por projeto, usado apenas pelo painel órfão).
- **O que esta fatia precisa deixar estável para uma fatia futura de
  Tarefas herdar** (já garantido hoje, não é trabalho novo desta fase):
  1. FK `tasks.project_id → projects.id` já existe.
  2. `source_local_id` + índice único já aplicados em `projects` E `tasks`
     (Fatia 7, itens 1-3 — migrations `20260721000200..000500` aplicadas).
  3. O import-map `kora.projects.supabaseImport.v1`
     (`localProjectId → supabaseProjectId`) já é escrito pelo import
     assistido — é o mapa que uma futura importação de tasks vai precisar
     ler para resolver `project_id`. Não renomear/remover essa chave.
- **Gap que NÃO bloqueia esta fatia mas bloqueia uma futura fatia de
  Tarefas (catalogado como `PT2` na Fatia 7):** `subtasks`/`comments` (3º
  nível local) não têm nenhuma representação na nuvem — nem tabela nem
  coluna. Fora de escopo aqui: o flip de Projetos só cobre a entidade
  `Project`, não desce a árvore até subtask/comment.
- **Gap catalogado como `PT1` (Fatia 7):** o gerador de "tarefas base" tem
  uma corrida TOCTOU (select-depois-insert sem índice único) — não
  bloqueante porque a única UI que aciona isso está desmontada. Só vira
  relevante se algo remontar aquele painel.

---

## 5. Riscos

1. **Dados reais de projeto no localStorage do operador** — `ProjectsSection.tsx`
   e `QuoteToProjectDialog.tsx` (Vendas) são caminhos de produção sem
   nenhuma flag experimental na frente. Não há como Code confirmar isso sem
   acesso a banco/browser (mesma restrição de protocolo já registrada na
   Fatia 7, §0). A única medição existente (`etapa-5-fatia-7-projects.md`
   §6) foi de UM workspace de QA, com 0 projetos reais — não é uma prova
   geral. Tratar como risco real, não teórico, até o operador confirmar.
2. **Vocabulário de `status` sem tradução** (detalhado em §3) — é o maior
   risco de schema puro: sem camada de normalização, projetos vindos da
   nuvem renderizam com rótulo ausente/errado na tela principal.
3. **`clientName` (string) vs `client_id` (FK)** — a tela principal exibe
   nome do cliente direto; ler da nuvem exige resolver o FK (join ou
   import-map de clients) antes de renderizar, senão a UI perde o nome.
4. **Dois caminhos independentes de "quote vira projeto"** —
   `QuoteToProjectDialog.tsx` (Vendas, sempre local, sem flag) e
   `CreateProjectFromQuoteDialog.tsx` (CRM, dual-write, atrás de flag OFF).
   Só o segundo já produz uma linha espelhada na nuvem. Se o flip virar o
   default de leitura antes de unificar os dois, projetos criados só pelo
   caminho de Vendas desaparecem da tela principal pós-flip, a menos que
   sejam importados manualmente primeiro.
5. **Consumidores fora da tela principal, todos 100% locais hoje** — Central
   do Dia (`useDayCenterData.ts`/`dayCenter.ts`, gera itens de atenção
   "Projeto atrasado") e `ClientProfileDrawer.tsx` (aba "Projetos" da
   ficha do cliente) leem só `useProjects()`. Se o flip mudar a fonte só em
   `ProjectsSection.tsx` sem atualizar os dois, eles divergem da tela
   principal (mostram atraso de projeto que o usuário não vê mais, ou
   ignoram projeto que só existe na nuvem).
6. **`deliverables` sem representação na nuvem** — campo usado ativamente
   no drawer (`setDeliverableStatus`) não tem onde pousar num projeto lido
   da nuvem; precisa de decisão de design antes da Fase B (nova
   coluna/tabela, ou manter como espelho local mesmo pós-flip).
7. **Painel de ops órfão como falso sinal de segurança** — `Supabase
   OperationalDashboardCard`/`ProjectTasksList` dão a impressão de que já
   existe leitura Supabase testada em produção, mas o card nunca é
   renderizado de fato (import órfão) — zero uso real valida esse caminho
   hoje. Não contar com ele como cobertura de teste da Fase B.

---

## 6. Proposta de fases

Diferente de CRM e quotes — onde o "flip" trocou o *default* de um seletor
que **já existia** e cujo CRUD dual-mode **já estava construído** — aqui o
hook principal nunca foi bifurcado. Esta fatia é mais parecida com "Fatia
10 (quotes-write) + Pacote do Flip" combinados, não com o Pacote do Flip
sozinho. Por isso a estimativa é **2 fatias**, não 1:

### Fatia N — "Projetos — escrita real" (equivalente à Fatia 10 de quotes)
- **B.1 (código):**
  - Novo `PROJECTS_DATA_SOURCE_KEY`/`getProjectsDataSource()`/
    `setProjectsDataSource()` em `flags.ts`, seguindo o formato
    `CRM_DATA_SOURCE_KEY` (default **"local"**, conservador — mesma decisão
    que quotes tomou na Fatia 9 antes de qualquer homologação de escrita).
  - Novo flag mestre de escrita (`kora.projects.supabaseWrite.enabled`,
    default OFF), no padrão `useSupabaseCrmWriteFlag`/
    `useSupabaseQuotesWriteFlag`.
  - Bifurcar `useProjects()` (ou envolver com um hook irmão) para ler/
    escrever via `projectsRepository` quando `dataSource === "supabase"`.
  - Resolver os riscos #2 e #3 do §5 (tradução de `status`, resolução de
    `client_id`→nome) como parte do código, não depois.
  - Decidir o destino de `deliverables` (risco #6) e dos dois caminhos
    quote→projeto (risco #4) — provavelmente convergir `QuoteToProjectDialog`
    (Vendas) para o mesmo padrão dual-write que `CreateProjectFromQuoteDialog`
    já usa (G22), em vez de manter dois caminhos divergentes.
  - Atualizar Central do Dia e `ClientProfileDrawer` para a mesma fonte
    (risco #5).
- **B.2 (migrations/RPC):** **nenhuma migration nova prevista** para esta
  fatia — o schema de `projects`/`tasks` (colunas `source_local_id`,
  índices únicos) já foi aplicado pela Fatia 7. A normalização de `status`
  é resolvida em código (camada de tradução), não constraint nova. Se
  confirmado necessário, DDL segue §8-b como sempre.
- **B.3 (homologação):** runbook no padrão das Fatias 8/9/10 — casos de
  CRUD local, CRUD Supabase sob a flag, override, e os dois caminhos
  quote→projeto convergidos.

### Fatia N+1 — "Pacote do Flip — projetos" (equivalente ao pacote já fechado de quotes)
- Só depois de smoke pós-merge da fatia anterior: flipar os 2 defaults
  (dataSource→supabase, write→ON), aposentar as flags experimentais que
  se tornarem redundantes (`projectsSupabaseCreateBaseTasks` pode
  sobreviver — gate um domínio adjacente, tasks, ainda não migrado; decidir
  na hora, mesmo espírito da análise que CreateProject/CreateReceivable
  tiveram no flip de quotes).

Estimativa: **2 fatias**, mesma cadência das anteriores.

---

## Referências

- `docs/qa/etapa-5-fatia-7-projects.md` — auditoria e design já feitos para
  este domínio (idempotência, import-maps, migrations aplicadas, gaps
  catalogados `PT1`/`PT2`). Fase A desta fatia se apoia nela, não a repete.
- `docs/architecture/kora-roadmap.md` §3.5/§3.6 — classificação vigente de
  Projetos ("🟡 dual-write parcial") e Tarefas ("🔴 não migrado").
- `docs/qa/etapa-5-flip-quotes.md` — template do padrão de flip (risco,
  retirada de flags, runbook) replicado aqui.
- `docs/architecture/kora-hub-auditoria-e-plano.md` — G22 (dual-write de
  `CreateProjectFromQuoteDialog`).

**PARADO aqui — Fase B (design de código) só com novo "vai" do revisor.**
