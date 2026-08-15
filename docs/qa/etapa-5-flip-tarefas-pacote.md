# Etapa 5 — G1/Tarefas — Pacote do Flip — Fase A executiva (desenho)

> Zero mudança de código nesta fase — molde de `docs/qa/etapa-5-flip-financeiro-pacote.md` (Lane C; o "pacote" é a camada de desenho executável que a Fase B código vai implementar). Inventário puro já foi feito em `docs/architecture/etapa-5-flip-tarefas-fase-a.md`; a auditoria de divergência de dado em `docs/qa/tarefas-r2-auditoria.md` — as duas são a base direta deste doc.

## Abertura

- Branch: `etapa-5-flip-tarefas-pacote`, a partir do tip real de `origin/main`.
- Hash confirmado por `git log -1` na worktree: **`8227634`** (`docs: G41 - coordenacao explicita com o desenho da Fase B (etapa-5-flip-financeiro-pacote.md)`).
- **Estado herdado, incorporado sem rediscussão:**
  - **G40 (FECHADO)**: `tasksRepository.updateTaskStatus` já aceita os 4 valores locais (`a_fazer`/`em_andamento`/`revisao`/`concluido`); `tasksMapper.ts` já expõe `CloudTaskStatus`/`normalizeCloudTaskStatus`. O equivalente-O12 de Tarefas está fechado — mas §3 abaixo mostra que isso **não fecha o vocabulário do domínio inteiro**, só o de um dos dois caminhos de escrita.
  - **R2 (`tarefas-r2-auditoria.md`)**: contenção **(a) ADOTADA** pelo revisor em 14/ago/2026 — `supabaseOperationalDashboard`/`projectsSupabaseCreateBaseTasks`/`tasksSupabaseStatusTransition` seguem OFF por política até a decisão de flip. **Atualização 15/ago/2026 — R2 FECHADO POR QUANTIFICAÇÃO**: as 8 SQLs do §1 daquele doc foram rodadas pelo operador; resultado íntegro de **0 linhas em `public.tasks`** (`tarefas-r2-auditoria.md` §4). O texto original deste bloco ("ainda não rodadas", "pré-requisito de fase") descrevia corretamente o estado em 14/ago — preservado abaixo (§2) com nota de data, não apagado. Consequência prática: §2 deixa de ser uma fase bloqueante do plano (mesa vazia, nada a reconciliar) e §5 (convivência) fecha como **(a) Fundir**.
  - **G41 (Financeiro, Lane C)**: sem dependência técnica direta com Tarefas, mas mesmo arquivo-alvo (`ClientActivitiesTab.tsx`) e mesmo `docs/architecture/kora-hub-auditoria-e-plano.md` como catálogo compartilhado — coordenação de numeração G42+ com as lanes em voo fica fora deste doc (não atribuo número G novo aqui, só descrevo achados).

---

## 1. Triagem dos 7 gaps de campo — bloqueantes vs. pós-flip

`etapa-5-flip-tarefas-fase-a.md` §6 item 3 já nomeia os 7 juntos: **subtasks, comments, recorrência, lembretes, scope, tags, milestone** (`taskProjectId` é um 8º gap de campo, real mas não contado nesse "7" — tratado à parte no fim desta seção). Mesmo critério do pacote de Financeiro §1: um gap **bloqueia** quando (a) é tecnicamente barato de fechar (coluna simples, sem tabela nova) e (b) sua ausência degrada `Tarefas.tsx` de forma visível no dia 1; fica **pós-flip** quando fechar exige um domínio relacional novo.

### 1.1 Bloqueantes (4 de 7) — incluindo 2 reavaliações que **divergem** da hipótese inicial do operador

| Campo local | Por que bloqueia | Achado que sustenta a classificação |
|---|---|---|
| `scope` (`work`\|`personal`) | `Tarefas.tsx:202,335,492` — `filterScope` filtra a lista principal inteira; sem a coluna, todo task migrado pra nuvem perde a faceta que particiona a tela em "Trabalho"/"Pessoal". | Mesmo padrão de `category` em Financeiro — vocabulário fechado, definido pelo produto, nunca pelo usuário. |
| `tags[]` | `Tarefas.tsx:334,828,977,1387` — `filterTag` também filtra a lista principal; tags aparecem como badges no card. | Mesmo padrão de `category`: campo livre, sem CHECK necessário, `text[]` nativo do Postgres resolve sem tabela nova. |
| `recurrence` | **Diverge da hipótese do brief** ("provável pós-flip como recurrence de Financeiro"). Achado: ao contrário de Financeiro (`RecurringEntry[]`, store separado em `kora.finance.recurring.v1`, com geração de transações futuras), `Task.recurrence` (`useTasks.ts:7`) é **só um enum de 5 valores gravado no próprio registro** (`none\|daily\|weekly\|monthly\|weekdays`) — grep exaustivo em `src/` não encontra NENHUM mecanismo de geração de próxima ocorrência (nem client-side, nem server-side); o campo é só exibido/editado (`Tarefas.tsx:1156,1324`), inerte além disso. Fechar é 1 coluna `text` + CHECK, não um domínio novo. | Ausência de qualquer `kora.tasks.recurring.v1` ou função de geração — confirmado por grep, não suposto. |
| `reminderAt`/`reminderEnabled`/`reminderSentAt` | **Também diverge da hipótese inicial.** São 3 colunas simples (`timestamptz`, `boolean`, `timestamptz`), sem tabela nova. `useTaskReminders.ts` já dispara notificação 100% client-side (`setInterval` 30s + `Notification` API) lendo `tasks` — uma vez que `useBifurcatedTasks` exista (§4), basta esse hook passar a consumir o mesmo array bifurcado (mesma troca de 1 linha que todo consumidor de classe (a) recebe) para o lembrete continuar funcionando sem nenhuma arquitetura nova (não depende de scheduler server-side). | `useTaskReminders.ts:22-23` já usa o padrão latest-ref (pré-G31, achado positivo da Fase A) — hook já está pronto pra receber uma fonte de dados trocada por baixo. |

**Nota de honestidade metodológica**: as duas últimas linhas contrariam a sugestão do brief ("recorrência/lembretes = sub-features, provável pós-flip"). Marco como recomendação, não fato encerrado — se o revisor preferir manter os 4 fora do escopo bloqueante por prudência (menos superfície na Fase B), a única mudança é mover essas 2 linhas pra §1.2 com o mesmo tratamento "não bloqueia, aviso explícito" do §1.2 abaixo; nenhuma outra parte deste pacote depende de qual dos dois lados isso cai.

```sql
-- PROPOSTA — não aplicada nesta rodada. Confirmar com o operador antes de aplicar
-- (Code não roda SQL contra produção, protocolo §0/§6). CHECK de scope/recurrence
-- só depois de confirmar (query 1.4 de tarefas-r2-auditoria.md, reexecutada pós-
-- migration) que nenhum valor fora do vocabulário já foi gravado.
ALTER TABLE public.tasks
  ADD COLUMN scope text NULL,
  ADD COLUMN tags text[] NULL DEFAULT '{}',
  ADD COLUMN recurrence text NULL,
  ADD COLUMN reminder_at timestamptz NULL,
  ADD COLUMN reminder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN reminder_sent_at timestamptz NULL,
  ADD CONSTRAINT tasks_scope_known_chk
    CHECK (scope IS NULL OR scope IN ('work','personal')),
  ADD CONSTRAINT tasks_recurrence_known_chk
    CHECK (recurrence IS NULL OR recurrence IN ('none','daily','weekly','monthly','weekdays'));
```

### 1.2 Pós-flip — reavaliação de `subtasks`/`comments` contra o estado atual (2 de 7)

`etapa-5-fatia-7-projects.md` §10 (linhas 808-825) já catalogou isso como **"bloqueante de cutover futuro"** — explicitamente, o cutover que esta própria rodada está desenhando. Reavaliando contra o critério que este pacote (e o de Financeiro) usa:

- **Por que fecha exige domínio novo, não coluna**: `SubTask`/`TaskComment` não têm `id` próprio (mutação por índice de array, `toggleSubtask(taskId, idx)`) — qualquer tabela `task_subtasks`/`task_comments` (ou mesmo uma coluna `jsonb`) precisa resolver isso primeiro (R5 da Fase A). Não é "coluna `text` simples" — é desenho de schema relacional novo com geração de id retroativa pros dados locais existentes.
- **Recomendação desta rodada**: aplicar o **mesmo tratamento que Financeiro deu a `recurrence`/`supplierId`/`cashAccountId`** — não bloqueia a tarefa em si (a tarefa salva normalmente em modo Supabase), a UI mostra aviso explícito pontual ("Subtarefas/Comentários ainda não sincronizam com a nuvem — disponível só em modo Local") quando o usuário abre o checklist/comentários de uma tarefa com `dataSource=supabase`. Isso **downgrade** a classificação de "bloqueante formal" (fatia-7) pra "pós-flip com degradação avisada" — mesma classe, critério idêntico ao que já vale pra Financeiro.
- **Por que a reavaliação é segura**: o catálogo da fatia-7 foi escrito ANTES do precedente de Financeiro (§1.2 daquele pacote) existir — na época, "bloqueante" era a única categoria disponível pro tipo de gap. Agora há um precedente testado de como tratar "campo real, sem lugar na nuvem, sem travar a ação principal".
- **Risco que sobrevive à reavaliação**: diferente dos 3 campos pós-flip de Financeiro (nenhum tinha id próprio ausente como problema — eram só FKs/enum ausentes), aqui o **desenho da tabela futura em si não está pronto** — antes de subtasks/comments saírem de "pós-flip" pra "migrado", alguém precisa decidir o esquema de id (gerado na migração, client-side na criação, ou ambos) — não é uma migration de 1 linha como as de Financeiro, é a mesma dívida que a fatia-7 já registrou, só reclassificada de "trava o flip" pra "não trava, mas continua pendente".

### 1.3 `milestoneId` — não é gap, é campo morto

`Task.milestoneId?: string` existe no tipo (`useTasks.ts:46`) mas **nenhum tipo/hook `Milestone` existe em lugar nenhum do código** (confirmado na fatia-7, linhas 339-340, e não contradito por nenhum achado desta rodada). Não é um gap a fechar — é um campo sem feature por trás, no mesmo padrão do `Task` duplicado e morto em `src/types/domain.ts`. Proposta: **omitir do payload de import** (nem `null` forçado, nem aviso — não há comportamento de produto que dependa dele hoje). Fora do escopo de qualquer migration.

### 1.4 `taskProjectId` — 8º gap, tratado com `public.tasks` no §5

Não está nos "7" nomeados no plano mestre, mas é um gap de campo real (`TaskProject`/`kora.taskProjects.v1` sem nenhuma representação cloud). Mesma classe de `supplierId`/`cashAccountId` em Financeiro — exigiria uma tabela `task_projects` própria, não uma coluna solta. Fica pós-flip pela mesma lógica do §1.2, mas o desenho de "o que aparece onde" se cruza com a decisão do §5 (convivência com `public.tasks`), por isso não entra na tabela acima — evita duplicar a discussão.

---

## 2. Reconciliação R2 — RESOLVIDA POR QUANTIFICAÇÃO (15/ago/2026), não é mais fase própria do plano

> **Fechamento (15/ago/2026):** as 8 SQLs abaixo foram rodadas pelo operador — resultado
> íntegro de 0 linhas em `public.tasks` (`tarefas-r2-auditoria.md` §4). Mesa vazia, nada a
> reconciliar. O texto original desta seção (abaixo, preservado com nota de data — não apagado)
> é o registro correto do que se sabia em 14/ago, quando escrever "pré-requisito formal de fase"
> era a postura certa (o risco era real E não verificado, não havia como saber se a mesa estava
> vazia sem rodar as queries). Com o resultado em mãos, esta seção deixa de bloquear o plano de
> Fase B (§6.1) — os itens que dependiam do volume (backfill, filtro, decisão do §5) resolvem
> pra o caso trivial.

**Diferença estrutural em relação a Financeiro (texto original, 14/ago/2026)**: lá, nenhuma linha de `financial_transactions` foi gravada por um caminho fora do vocabulário local — o risco era hipotético. Aqui, `docs/qa/tarefas-r2-auditoria.md` já mapeou **dois caminhos de escrita cloud-nativos ativos hoje** (`createProjectBaseTasks`, `updateTaskStatus`), alcançáveis via o painel experimental mesmo com as flags em OFF por padrão — ou seja, **é possível que dado divergente já exista em produção**, não é uma hipótese de desenho futuro. É por isso que o brief classifica isso como "o problema singular deste domínio": nenhum dos outros dois flips do G1 (Projetos, Financeiro) teve essa característica. **Nota (15/ago/2026): essa possibilidade era real e a cautela era correta — a quantificação confirmou que não se concretizou. Os 2 caminhos continuam existindo e continuam capazes de gerar essa divergência a partir de agora (mecanismo intocado, ver §2.2) — a mesa vazia é o estado observado até 15/ago, não uma garantia permanente.**

### 2.1 As 8 SQLs — rodadas em 15/ago/2026, resultado: 0 linhas em todas

**Texto original (14/ago/2026), preservado:** *"`tarefas-r2-auditoria.md` §1 já tem as 8 queries prontas (somente `SELECT`, sem gate de credencial do protocolo — não é sessão de DDL). Este pacote formaliza que a Fase B não desenha a migração de dado de reconciliação sem os números dessas 8 queries em mãos primeiro."*

**Resultado (15/ago/2026):** rodadas — `public.tasks` vazia, 0 linhas nas 8 (`tarefas-r2-auditoria.md` §4). A coluna "O que decide" abaixo continua correta como registro do raciocínio; a coluna extra à direita registra o desfecho real de cada uma:

| # | Query | O que decide | Resultado (15/ago/2026) |
|---|---|---|---|
| 1.1 | Total por `source`, ativas vs. soft-deletadas | Tamanho absoluto do problema — se zero, boa parte do §5 (convivência) vira não-evento | **Zero — sem grupos, confirmado** |
| 1.2 | `source_local_id IS NULL` por `source` | Quantifica exatamente o "buraco" que nenhum merge automático resolve sozinho | **0** |
| 1.3 | Por `workspace_id` | App é multi-tenant — decide se a estratégia do §5 pode ser uniforme ou precisa ser por-workspace | **Vazio — nenhum workspace tem linha** |
| 1.4 | Vocabulário de `status` em uso | Confirma (ou refuta) a suposição de "zero linhas fora do vocabulário" antes de qualquer CHECK (§1.1/G40) — **crítico**, porque diferente de Financeiro, já sabemos que existe pelo menos 1 produtor (`createProjectBaseTasks`) gravando `status='todo'` em inglês (ver §3.1) | **Sem vocabulário em uso — tabela vazia, nada vazou** (o produtor de §3.1 existe no código mas nunca foi exercitado em produção) |
| 1.5 | Idade do dado por `source` | Calibra urgência — buraco antigo vs. recente | **Nulls — não há linha nenhuma** |
| 1.6 | Tarefas-base por projeto | Volume de `project_template` especificamente — insumo direto do §5 | **Vazio — zero tarefas-base geradas** |
| 1.7 | Volume já importado (`source_local_id IS NOT NULL`) | Contraponto de escala — não é risco, é o que já reconcilia | **0** |
| 1.8 | Proxy de drift pós-criação (`updated_at > created_at`) | Sinaliza candidatas a checar manualmente se `updateTaskStatus` já foi exercitado contra alguma linha com par local | **0** |

**Ordem obrigatória (texto original, 14/ago/2026):** *"rodar 1.1→1.8 (operador, fora do Code) antes de qualquer desenho de migração de dado ganhar detalhe além do que já está no §5 deste pacote. Se os números vierem zero ou desprezíveis (cenário mais provável, dado que as 2 flags nativas são default OFF e o painel é rotulado 'Experimental'), o §5 colapsa pra decisão (a) trivialmente — se vierem altos, o §5 precisa da decisão (c) com backfill."*

**Confirmado (15/ago/2026):** a previsão do texto original se realizou — os números vieram zero, o cenário "mais provável" foi o que aconteceu de fato. §5 colapsa pra decisão (a), sem backfill. Ver fechamento formal em §5 abaixo.

### 2.2 Caminhos que AMPLIAM a divergência — congelados por contenção (a), não corrigidos

Reafirmando `tarefas-r2-auditoria.md` §2: `createProjectBaseTasks` (linhas novas sem `source_local_id`, nunca reconciliáveis pelo import geral) e `updateTaskStatus` (muda linha existente sem tocar o local correspondente) seguem sendo os 2 caminhos que ampliam o buraco — nenhum dos dois foi alterado nesta rodada nem é proposto pra alteração aqui (fora de escopo doc-only). A contenção (a) — as 3 flags seguirem OFF por política — é a única mitigação ativa até a Fase B liberar esses caminhos de propósito (§5 já fechou como decisão de convivência, mas isso não religa as flags sozinho — permanecem OFF até a Fase B decidir explicitamente).

### 2.3 O que a quantificação NÃO resolve sozinha

Mesma ressalva já registrada em `tarefas-r2-auditoria.md`: nenhuma das 8 queries confirma se uma linha `source_local_id IS NOT NULL` ainda bate campo-a-campo com o registro local correspondente — isso exigiria comparar contra `orbyt.tasks.v1` do `localStorage` de cada usuário, que o Code não acessa (protocolo §0/§6). A query 1.8 é proxy indireto, não prova. Isso não é um gap deste pacote — é um limite estrutural de qualquer auditoria feita só pelo lado do banco, herdado sem tentativa de contornar.

---

## 3. Mapper — estado real pós-G40 + o que falta (mesmo movimento que achou o gap do financeMapper)

### 3.1 Vocabulário — G40 fechou `updateTaskStatus`, mas NÃO fechou o domínio inteiro

Achado desta rodada, direto do código (não do inventário): `tasksMapper.ts` (comentário de topo, linhas 14-18, e §R1 linhas 90-132) já documenta a decisão — o vocabulário OFICIAL de `public.tasks.status`/`priority` é o local (português, `a_fazer`/`em_andamento`/`revisao`/`concluido` e `alta`/`média`/`baixa`), sem tradução. `updateTaskStatus` (G40) e `importTask` já seguem esse contrato. **Mas `createProjectBaseTasks` não segue — e não foi tocado pelo G40**:

```ts
// CreateProjectBaseTasksDialog.tsx:123-124 — hoje, sem alteração desta rodada
status: "todo",       // inglês — vocabulário LEGADO segundo o próprio comentário de tasksMapper.ts
priority: t.priority, // vem de DEFAULT_TASKS (linhas 38-46): "medium"/"high"/"low" — também inglês
```

**Consequência prática**: uma CHECK constraint preventiva (o padrão que Financeiro conseguiu aplicar "de graça" no §2.1 do pacote dela, porque todo escritor já usava o vocabulário certo) **não é segura aqui hoje**. Aplicar o CHECK do §1.1 acima quebraria o próximo INSERT de `createProjectBaseTasks` imediatamente (`status NOT IN (...)`). Diferente de Financeiro — que nunca teve um 2º dialeto ativo — e mais parecido com o Tarefas/Projetos originais (O12/G40 pré-fix): **aqui o CHECK depende de um fix prévio**, não é preventivo puro.

**Status (15/ago/2026):** este achado está catalogado como **G49** (`kora-hub-auditoria-e-plano.md`) — *"`createProjectBaseTasks` grava `status`/`priority` em inglês... bloqueia o CHECK preventivo de Tarefas até ser corrigido"*, risco ARMADO (não disparando, 2 flags default OFF — coerente com o resultado vazio do §2/§4 de `tarefas-r2-auditoria.md`: o produtor nunca rodou em produção, mas o código em si ainda grava o vocabulário errado). **Fix em voo pela Lane B, ainda não mesclado** — confirmado por leitura direta: `CreateProjectBaseTasksDialog.tsx:123` continua com `status: "todo"` no tip de `origin/main` desta rodada. **O CHECK de `status`/`priority` descrito no item (2) da sequência abaixo fica liberado assim que o fix do G49 mesclar** — a mesa vazia (§2/§4) já eliminou a necessidade de backfill de dado legado, mas não substitui o fix do produtor: sem ele, o PRÓXIMO clique em "gerar tarefas base" (se as flags forem religadas) voltaria a gravar `"todo"`/`"medium"` e quebraria o CHECK na hora.

- **Proposta de sequência na Fase B** (não implementada aqui): (1) `CreateProjectBaseTasksDialog.tsx` passa a gravar `status: "a_fazer"` e traduz `t.priority` (`"medium"→"média"`, `"high"→"alta"`, `"low"→"baixa"`) antes do payload — mesmo espírito do fix do G40, aplicado ao 2º produtor que ficou de fora; (2) só depois disso o CHECK de `status`/`priority` (que faltou no §1.1 acima — propositalmente omitido dali, porque §1.1 é só sobre os 4 campos genuinamente preventivos) entra como migration separada, condicionada à query 1.4 do §2 confirmando zero linhas legadas remanescentes.
- **Nota**: `DEFAULT_TASKS` (linha 38) já usa `priority: "medium"` como valor mais comum — se a tradução granular parecer desproporcional pra uma rodada pequena, a alternativa mínima é só trocar os 3 literais do array + o `"todo"` hardcoded — mesmo tamanho de diff que o fix G40 teve no dropdown.

### 3.2 Passthrough de UUID nas FKs — G37 ainda NÃO aplicado aqui (achado novo)

`resolveTaskFk` (`tasksMapper.ts:42-48`) tem exatamente a mesma forma que `resolveFinanceFk` tinha ANTES do fix de desenho do pacote de Financeiro — todo `localId` é tratado como id local a procurar no import-map, sem checar se já é um uuid real:

```ts
// tasksMapper.ts:42-48 — estado atual, sem passthrough
export function resolveTaskFk(
  localId: string | number | null | undefined,
  map: Record<string, string>,
): string | null {
  if (localId === null || localId === undefined || localId === "") return null;
  return map[String(localId)] ?? null; // <- se localId já for um uuid real, nunca casa, vira null
}
```

Se um `quoteId`/`clientId`/`projectId` chegar como uuid real (ex.: uma quote já lida da nuvem, não de import — mesmo cenário G37 de Financeiro), a FK vira `null` silenciosamente. **Diferente de Financeiro** (onde o G37 foi aplicado por desenho, preventivamente, porque a Lane C achou o padrão antes de codar), aqui é um achado NOVO desta rodada — `resolveTaskFk` nunca foi corrigido porque G40 mexeu só em `status`, não em `resolveTaskFk`. Fix proposto pra Fase B, mesmo padrão:

```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolveTaskFk(
  localId: string | number | null | undefined,
  map: Record<string, string>,
): string | null {
  if (localId === null || localId === undefined || localId === "") return null;
  const key = String(localId);
  if (UUID_RE.test(key)) return key; // já é uuid real — nunca procura no import-map (G37)
  return map[key] ?? null;
}
```

### 3.3 Payload de escrita — completo, ao contrário do achado de Financeiro

Checklist campo-a-campo (mesma disciplina que achou o `deliverables` esquecido em Financeiro/G37): `mapLocalTaskToSupabase` (`tasksMapper.ts:68-87`) já cobre TODAS as colunas de `SupabaseTask` que têm campo local correspondente — `project_id`/`client_id`/`quote_id` (via `resolveTaskFk`), `opportunity_id` (sempre `null`, documentado como ausência estrutural, não bug), `title`/`description`/`status`/`priority`/`due_date`/`source`/`sort_order`/`is_demo`/`archived`. **Não há achado de payload incompleto aqui** — diferente de Financeiro, o gap desta rodada está no passthrough de FK (§3.2) e no vocabulário do 2º produtor (§3.1), não em campo esquecido.

### 3.4 Direção de leitura — `mapSupabaseTaskToLocal` não existe (mesmo gap que Financeiro tem)

Confirmado por grep exaustivo (`mapSupabaseTaskToLocal`, zero resultados em `src/`): `tasksMapper.ts` só tem a direção de escrita, igual ao achado de Financeiro sobre `financeMapper.ts`. É trabalho de Fase B: converter `SupabaseTask` → `Task` local, campo a campo (tabela do §3.3 invertida), incluindo:
- `status`/`priority`: usar `normalizeCloudTaskStatus` (já existe, `tasksMapper.ts:130-132`) na leitura, pra tratar os 3 valores legados em inglês (se algum sobreviver na nuvem, seja de `createProjectBaseTasks` pré-fix do §3.1, seja de dado histórico) como alias, nunca mascarando um valor desconhecido.
- `client`/`project` (strings de exibição): resolver por join/lookup local, mesmo padrão de `mapSupabaseProjectToLocal` recebendo um `clientNameById`.
- `scope`/`tags`/`recurrence`/`reminderAt`/`reminderEnabled`/`reminderSentAt` (se o §1.1 for aprovado como bloqueante): passagem direta das novas colunas.
- `subtasks`/`comments`/`taskProjectId`/`milestoneId`: ausentes (§1.2/§1.3/§1.4) — não entram na leitura, mesma disciplina de "omitir, não forçar vazio por engano".

Também falta **`tasksRepository.listTasks(workspaceId)`** — só existe `listTasksByProject` (`tasksRepository.ts:34-46`), escopado a um projeto. Insuficiente pra alimentar `Tarefas.tsx` (tela principal, todas as tarefas do workspace, com ou sem projeto). Mesmo gap estrutural que Financeiro tinha com `listReceivables` vs. `listTransactions`.

### 3.5 Achado extra, fora do escopo de G40: `useSupabaseProjectTasks.updateStatus` ainda não aplica G30

Lido diretamente no código (`useSupabaseProjectTasks.ts:21-30`): a mutation `updateStatus` só faz `queryClient.invalidateQueries(...)` depois do `UPDATE` — nunca escreve a resposta no cache via `setQueryData`. Mesma classe do bug que G30 corrigiu em Projetos (`ProjectDetailDrawer.tsx` preso mostrando status antigo). Está atrás das mesmas 2 flags OFF do G40 (não dispara hoje), mas é um achado real, independente do vocabulário — fica registrado aqui pra a Fase B tratar junto (não atribuo número G novo, pra não colidir com G42+ das lanes em voo).

---

## 4. Plano de bifurcação dos consumidores

**Hook novo**: `useBifurcatedTasks()`, mesmo molde de `useBifurcatedProjects.ts` (`src/hooks/useBifurcatedProjects.ts:27-44`) — read-only por design, leitura via uma flag nova `kora.tasks.dataSource.v1`/`getTasksDataSource()` (não existe hoje, confirmado na Fase A §1.3 — nasce no mesmo molde PRÉ-flip de `kora.finance.dataSource.v1`: default `"local"`, só `"supabase"` explícito seleciona nuvem):

```ts
export function useBifurcatedTasks(): Task[] {
  const { tasks: localTasks } = useTasks();
  const { tasks: supabaseTasksRaw } = useSupabaseTasksAll(); // §3.4, listTasks(workspaceId)
  const supabaseTasks = useMemo(
    () => supabaseTasksRaw.map((st) => mapSupabaseTaskToLocal(st, /* lookups denormalizados */)),
    [supabaseTasksRaw],
  );
  return getTasksDataSource() === "supabase" ? supabaseTasks : localTasks;
}
```

`useSupabaseTasksAll` é hook novo (React Query, `enabled: !!workspaceId` — G32, "design da casa", já confirmado aplicável a Tarefas na Fase A §5), construído sobre o `listTasks` novo do §3.4 — não reaproveita `useSupabaseProjectTasks` porque esse é escopado a um `projectId` por desenho (nome e assinatura já refletem isso).

### 4.1 Consumidores a bifurcar (8 de classe (a), Fase A §2 — mais que os 5 de Financeiro)

| Arquivo | Ação |
|---|---|
| `src/pages/Tarefas.tsx` | Trocar `useTasks()` por `useBifurcatedTasks()` — tela real |
| `src/components/projects/ProjectDetailDrawer.tsx` | Trocar `useTasks()` por `useBifurcatedTasks()` — **atenção**: hoje filtra local por `projectId` (não lê `public.tasks`, ver Fase A §1.1); pós-bifurcação passa a coexistir com o painel experimental que já lê `public.tasks` via `useSupabaseProjectTasks` no mesmo drawer — checar se os dois viram a mesma coisa ou continuam paralelos (depende da decisão do §5) |
| `src/components/clients/ClientActivitiesTab.tsx` | Ver §4.2 — rota crítica, 3º domínio a bifurcar neste arquivo |
| `src/components/day/DayCenter.tsx` / `src/hooks/useDayCenterActions.ts` | Leitura via `useBifurcatedTasks()`; escrita (`completeTask` → `updateTask`) segue **local-only por enquanto** — mesma decisão que Financeiro tomou pra `updateTransactionStatus` na Central do Dia (classe b, não é a rota crítica desta fatia). Ver nota abaixo — é uma recomendação, não a única opção defensável. |
| `src/hooks/useDayCenterData.ts` | Trocar `useTasks()` por `useBifurcatedTasks()`; o comentário do arquivo (linhas 15-20) hoje lista `tasks` explicitamente como "100% local, fora de escopo" — precisa de atualização de texto junto (mesma lição G29: comentário/banner que sobrevive ao flip real) |
| `src/components/vendas/QuoteToProjectDialog.tsx` | `addTask` (semeia `STARTER_TASKS`) passa a escrever local + espelho best-effort, mesmo padrão G22 que os outros diálogos de criação nativa já usam — hoje grava só local, sem gate nenhum (Fase A §5 já observa: nenhum gate fóssil aqui, ao contrário de `QuotesSection.tsx`/G33) |
| `src/hooks/useTaskReminders.ts` | Trocar a fonte de `tasks` (hoje vem de fora, via prop/hook) por `useBifurcatedTasks()` — já usa o padrão latest-ref (`tasksRef`), só troca a fonte, sem mudar o mecanismo de polling |
| `src/lib/dayCenter.ts` | Indireto — só import de tipo `Task`, `computeDayCenter` é função pura; nenhuma mudança de código, só continua recebendo o array já bifurcado de quem chama |

**Decisão em aberto, não fechada aqui**: a recomendação de manter `completeTask` (Central do Dia) local-only segue o precedente de Financeiro, mas há uma diferença real — `updateTaskStatus` (Supabase) já existe e já tem vocabulário correto pós-G40 (menos trabalho pra ligar de verdade do que Financeiro precisou). Trade-off: consistência de convenção entre os 3 domínios do G1 (todos ficam com Central do Dia local-only na Fase B, revisitando depois) vs. aproveitar que aqui o caminho de escrita já está pronto. Fica pro revisor decidir; nenhuma outra parte deste pacote depende de qual lado isso cai.

### 4.2 `ClientActivitiesTab.tsx` — estado real hoje: 1 bifurcado + 2 crus (não 2+1)

Confirmado lendo o código (linhas 431-436, não só o inventário): hoje o arquivo importa `useBifurcatedProjects()` (já migrado), **`useFinance()` cru** (linha 431 — o pacote de Financeiro, Lane C, ainda é só desenho; a Fase B dela não foi codada/mesclada até este commit) e **`useTasks()` cru** (linha 435, este pacote). Ou seja: **o estado descrito no §3.2 do pacote de Financeiro ("2 bifurcados + 1 cru, tasks") ainda não é o presente — é o futuro dela**, condicionado à Fase B de Financeiro mesclar primeiro.

**Isso é simétrico, não hierárquico**: qualquer que seja a ordem real de merge entre esta fatia e a Fase B de Financeiro, o arquivo passa pelo mesmo estado intermediário "2 bifurcados + 1 cru" — só muda QUAL dos dois (finance ou tasks) é o "cru" remanescente por um tempo. Coordenação necessária, mesmo aviso que o pacote de Financeiro já registrou (§3.2 dele): antes de editar, checar `git log -- src/components/clients/ClientActivitiesTab.tsx` pra ver se a Lane C (ou outra) tem trabalho em voo no mesmo arquivo.

**Proposta de fatia própria de refactor — trazida pra decisão, não decidida aqui**: este é o arquivo mais tocado do G1 (leads, quotes, finance, projects, tasks — 5 domínios num único componente, `buildInferredEvents` como ponto de fan-in) e vai ser editado por **pelo menos 3 rodadas de flip diferentes** (Projetos já editou, Financeiro vai editar, Tarefas — este pacote — vai editar). Cada edição futura de um domínio ainda não migrado (se algum dia existir um 4º ou 5º domínio) repete o mesmo padrão de colisão.

- **A favor de uma fatia de refactor antes** (ex.: extrair um `useClientActivityData(client)` que internamente chama os 5 hooks de domínio e devolve só o array já combinado): reduz a superfície de colisão pra 1 arquivo por trás de uma interface estável — as próximas 2 lanes (Financeiro, e qualquer coisa futura) editam só o hook novo, não o componente de 1400+ linhas.
- **Contra fazer agora**: é trabalho adicional que não desbloqueia nenhuma homologação — puramente preventivo, e o próprio ato de fazer esse refactor colide com o trabalho em voo da Lane C do mesmo jeito que qualquer outra edição colidiria.
- **Recomendação**: não bloquear esta fatia por causa disso — registrar a proposta pro operador decidir se vale uma fatia dedicada de refactor DEPOIS que Financeiro e Tarefas (as 2 lanes que sabidamente vão tocar o arquivo em breve) terminarem suas edições, não antes.

---

## 5. Convivência com `public.tasks` existente — DECISÃO FECHADA (a) Fundir, 15/ago/2026

> **Decisão do revisor (15/ago/2026), sujeita a veto do operador: opção (a) — Fundir.**
> `public.tasks` está vazia (§2/§4 de `tarefas-r2-auditoria.md`) — a condição que a Opção (c)
> (texto original abaixo) usava como gate ("se o volume vier zero ou desprezível, a opção (a) se
> aplica direto, sem custo extra") se confirmou literalmente. Não há backfill a desenhar, não há
> `project_template` legado pra reconciliar. As 3 opções abaixo (texto original, 14/ago/2026,
> preservado — é a análise que justifica a decisão, não substituída por ela) continuam valendo
> como registro de trade-off; a única mudança é que o "se" da opção (c) resolveu, e resolveu pra
> (a). **Ressalva que sobrevive à decisão**: a "Contras" da opção (a) sobre vocabulário legado
> (§3.1/G49) não se aplica a dado EXISTENTE (não há nenhum) — mas se aplica a qualquer
> `createProjectBaseTasks` que rodar DEPOIS de hoje e ANTES do fix do G49 mesclar (Lane B, em
> voo) — por isso a contenção (a) do R2 (flags OFF) segue ativa até lá, mesmo com a decisão de
> convivência já fechada (ver `tarefas-r2-auditoria.md` §4).

Diferente de Financeiro (onde a nuvem só tinha o que o próprio flip trouxe), aqui `public.tasks` já tem linhas nativas (`project_template`, via `createProjectBaseTasks`) que nunca passaram por import e nunca terão `source_local_id`. Quando `Tarefas.tsx` passar a ler `public.tasks` (Fase C), essas linhas — hoje visíveis SÓ dentro de `ProjectDetailDrawer` via `useSupabaseProjectTasks` (escopo de projeto, painel experimental) — se tornam candidatas a aparecer na tela principal pela primeira vez. 3 opções, com trade-offs — decisão do revisor/operador, não fechada aqui (texto original, 14/ago/2026):

### Opção (a) — Fundir: `public.tasks` é a fonte única, sem tratamento especial pra `project_template`

Pós-flip, toda linha de `public.tasks` (import geral + `project_template`) aparece igual em `Tarefas.tsx`. Mesmo tratamento que Financeiro dá aos 2 produtores de `financial_transactions` (Caso 4 de homologação dele — sem duplicata, sem tratamento especial).

- **Prós**: modelo mental mais simples — `public.tasks` = a tabela, ponto final. Nenhum filtro extra pra manter.
- **Contras**: linhas `project_template` de hoje foram gravadas com o vocabulário legado (status/priority em inglês, §3.1) — se aparecerem na tela principal ANTES do fix do §3.1, reproduzem o mesmo bug que o G40 já corrigiu pro dropdown do painel experimental, agora na tela principal. Também não têm `taskProjectId`/`scope`/`tags` (nunca gravados por esse fluxo) — apareceriam soltas/sem-escopo no meio do kanban, uma mudança de superfície que hoje é deliberadamente restrita a "dentro do projeto".

### Opção (b) — Coexistir: `Tarefas.tsx` filtra `source='project_template'` fora da leitura principal

`public.tasks` continua sendo a fonte, mas a tela principal só mostra linhas com `source_local_id IS NOT NULL` OU criadas nativamente pela própria tela (`source='manual'` em modo Supabase, análogo ao `createTransaction` de Financeiro) — tarefas-base seguem visíveis só onde já são hoje (`ProjectDetailDrawer`).

- **Prós**: zero surpresa — mantém o limite de UX que já existe (tarefa-base é uma feature de projeto, não do backlog geral). Evita o bug de vocabulário vazar pra tela principal sem precisar do fix do §3.1 primeiro.
- **Contras**: um filtro por `source` "pra sempre" é uma exceção permanente, não uma etapa de transição — se `dataSource=supabase` é pra ser a fonte de verdade, esconder uma fatia dela indefinidamente é inconsistente. Também cria uma divergência de estado: concluir uma tarefa-base dentro do drawer do projeto não reflete como "concluída" na tela principal (porque ela nunca aparece lá) — mesma classe de risco do G29 (2 superfícies, 1 dado, comportamento divergente).

### Opção (c) — Reconciliar uma vez, depois fundir (recomendação original desta rodada, 14/ago/2026 — SUPERADA pela quantificação, ver caixa de decisão acima)

Usa a quantificação do §2 como gate: se o volume de `project_template`/linhas sem `source_local_id` for zero ou desprezível (cenário mais provável — feature é opt-in, painel rotulado "Experimental", 2 flags OFF por padrão desde sempre), a opção (a) se aplica direto, sem custo extra. Se o volume for real, a Fase B ganha um passo de **backfill único**: atribuir `taskProjectId`/`scope` default (ex.: "Sem projeto"/`work`) e traduzir `status`/`priority` das linhas `project_template` existentes pro vocabulário local (mesmo mapeamento de `normalizeCloudTaskStatus`, mas escrito de volta, não só lido) — **antes** de flipar o default de leitura daquele workspace.

- **Por que era a recomendação**: não paga o custo de desenhar um backfill se a quantificação mostrar que não há nada pra reconciliar (mesma economia que a contenção (a) do R2 já aplica hoje). Se houver dado real, resolve na raiz em vez de esconder atrás de um filtro permanente (contras da opção b) ou vazar o bug de vocabulário (contras da opção a).
- **Custo**: é a opção que mais depende dos números do §2 pra ter um escopo fechado — não dá pra estimar o tamanho do backfill sem eles. Fica como item explícito de Fase B condicionado ao resultado da quantificação, não como trabalho já dimensionado aqui.
- **Desfecho (15/ago/2026)**: o "se" do primeiro parágrafo resolveu pra "zero" — a opção (c) colapsou na opção (a) exatamente como o próprio texto previa, sem precisar do passo de backfill. Não é uma opção descartada por estar errada; é uma opção condicional cuja condição resolveu pro ramo mais simples.

**Insumo direto pro `taskProjectId`** (§1.4): qualquer que seja a opção escolhida, uma linha `project_template` sem `taskProjectId` precisa de um valor — as 3 opções acima assumem um default tipo "Sem projeto" (`tp-noproject`, já existe como seed em `useTaskProjects.ts:28`), não a criação de um `TaskProject` novo por linha.

---

## 6. Fases B/C/D, homologação, rollback e estimativa

### 6.1 Sequência (mesma ordem de Financeiro/Projetos — o passo novo do texto original já foi cumprido)

**Texto original (14/ago/2026)**: *"1. Pré-requisito (novo, não existe nos outros 2 flips do G1): operador roda as 8 SQLs do §2.1, decisão do §5 fecha com números reais em mãos."* — **CUMPRIDO em 15/ago/2026**: as SQLs rodaram, a decisão do §5 fechou como (a) Fundir. Deixa de ser um passo da sequência de implementação (não há mais um "aguardar números" bloqueando o início da Fase B) e passa a ser um antecedente já resolvido, registrado aqui e em `tarefas-r2-auditoria.md` §4.

1. **Fase B (código)**: migration do §1.1 (4 campos genuinamente preventivos) + fix de vocabulário do `createProjectBaseTasks` (§3.1, **G49, fix em voo na Lane B — condição de entrada pro passo seguinte**) + migration de `status`/`priority` CHECK só depois do G49 mesclar + passthrough de UUID (§3.2) + `mapSupabaseTaskToLocal`/`listTasks` (§3.4) + `useBifurcatedTasks` e os 8 consumidores (§4.1) + tratamento de `ClientActivitiesTab.tsx` com atenção de coordenação (§4.2) + espelho G22 em `QuoteToProjectDialog.tsx` + G30 aplicado a qualquer escrita nova (§3.5) + opção (a) já fechada no §5 (sem backfill — mesa vazia). `tsc`/lint/testes verdes, PARA pra aprovação.
2. **Fase C (flip dos defaults)**: `kora.tasks.dataSource.v1` → `supabase` (flag nasce nesta mesma fatia — não existe hoje, Fase A §1.3).
3. **Fase D (homologação B.3)**: runbook próprio, cenário sintético (`HOMOLOG-FLIP-tarefas`).

### 6.2 Casos de homologação (9 — herda os 8 já esboçados na Fase A §5, mais 1 novo do §5 deste pacote)

1. **Leitura em modo Supabase**: tarefas antes só locais aparecem oriundas de `public.tasks`, tratamento de `project_template` conforme a opção escolhida no §5.
2. **Escrita nativa (criar tarefa manual em modo Supabase)**: `source='manual'`, aparece sem reload.
3. **Transição de status refletida na própria mutação (G30)**: mover entre colunas do kanban — mesmo cuidado do achado §3.5 (a mutation nova não pode repetir o padrão invalidate-only que `useSupabaseProjectTasks.updateStatus` tem hoje).
4. **Status "revisão" sobrevive à escrita cloud**: já resolvido pelo G40 pro caminho `updateTaskStatus` — confirmar que o novo caminho de escrita da tela principal (se distinto) também preserva os 4 valores.
5. **Tarefas-base coexistindo com tarefas locais migradas**: caso central do §5 — comportamento esperado é o da opção (a) já fechada (fundir, sem tratamento especial); como a mesa está vazia hoje (§4 de `tarefas-r2-auditoria.md`), este caso só terá dado real pra exercitar depois que alguém gerar tarefas-base em produção — vale rodar mesmo assim como prova do comportamento, não só assumir pelo desenho.
6. **Exclusão — soft vs. hard delete**: `deleted_at` preenchido, leitura filtra `deleted_at IS NULL`.
7. **Consumidores cruzados**: Central do Dia, `ClientActivitiesTab.tsx` (3 domínios, atenção redobrada), `ProjectDetailDrawer.tsx` (2 leituras de `public.tasks` coexistindo — a nova bifurcada e a `useSupabaseProjectTasks` já existente).
8. **Banner/texto desatualizado (G29)**: auditar `Tarefas.tsx` + o comentário de `useDayCenterData.ts` (§4.1) por copy que sobreviva ao ponto em que a escrita real já funciona.
9. **Campos pós-flip (§1.2) não bloqueiam nem perdem silenciosamente**: abrir checklist/comentários de uma tarefa em modo Supabase — aviso explícito aparece, tarefa em si não é bloqueada.

### 6.3 Rollback — 2 níveis, mesmo padrão da casa

- **Nível 1 (imediato, sem código)**: `kora.tasks.dataSource.v1=local` — reversível a qualquer momento; tarefas criadas em modo Supabase somem da view local, não são apagadas (mesma semântica de Projetos/Financeiro). A flag de escrita (se vier a existir separada) não bloqueia CRUD sozinha (lição G29) — só a combinação com `dataSource=local` garante leitura 100% local.
- **Nível 2 (revert de código)**: só se o Nível 1 não bastar — `git revert` do commit de flip, mantendo schema/mapper (Fase B) intactos. **Nota específica de Tarefas**: se a opção (c) do §5 rodou um backfill de dado real (não só reversão de flag), o Nível 2 reverte o CÓDIGO, mas o backfill em si (dado já escrito em `public.tasks`) não é desfeito automaticamente — mesma assimetria que qualquer migration de dado real tem, registrada aqui pra não ser descoberta só na hora do rollback.

### 6.4 Fechamento — estimativa comparativa final (RECALIBRADA em 15/ago/2026)

**Texto original (14/ago/2026)**: *"Confirma e detalha a conclusão qualitativa já registrada na Fase A (`etapa-5-flip-tarefas-fase-a.md` §6): Tarefas é o maior dos três flips do G1, agora com o desenho de Fase B completo em vez de comparação por risco."* Essa conclusão se apoiava em 5 itens que Financeiro não teve — a quantificação de 15/ago resolveu 2 deles (o fator singular do domínio, §5) e não mudou os outros 3. Recalibrando honestamente, item a item:

1. ~~**Pré-requisito de quantificação (§2)** — as 8 SQLs não são opcionais, são gate de fase.~~ **Resolvido, deixa de ser diferenciador de tamanho de Fase B.** Era custo de calendário (esperar o operador rodar 8 `SELECT`s), não custo de código — e já foi pago nesta própria rodada. Não infla mais a estimativa da Fase B em si.
2. ~~**Decisão de convivência com dado nativo já existente (§5)** — 3 opções com trade-offs reais, nenhuma trivial.~~ **Resolvida como (a) trivial, sem backfill.** Este era o fator que mais poderia inflar a Fase B (a opção (c), condicional, chegava a propor um passo de migração de dado real) — mesa vazia elimina justamente esse risco de tamanho. Este era, dos 5, o item que mais justificava "Tarefas é a maior" — e é o que mais evapora.
3. **Fix de vocabulário do 2º produtor antes do CHECK (§3.1, G49)** — continua real. Financeiro conseguiu o CHECK preventivo de graça; aqui precisa de 1 fix primeiro (Lane B, em voo — ver §3.1). É um fix pequeno (mesmo tamanho de diff do G40 original no dropdown, por texto do próprio §3.1) — soma alguma complexidade de sequenciamento (esperar o G49 mesclar antes do CHECK), não de volume de código.
4. **8 consumidores a bifurcar (§4.1)**, vs. 5 de Financeiro — continua real, 3 a mais (`useTaskReminders.ts`, `useDayCenterActions.ts`, `QuoteToProjectDialog.tsx` como produtor). Diferença genuína de superfície, não afetada pela quantificação.
5. **`ClientActivitiesTab.tsx` na 3ª rodada de edição** — continua real, é risco de coordenação (checar `git log` antes de editar), não necessariamente mais LINHAS de código do que a 2ª rodada teve.

**Veredito recalibrado**: com os itens 1-2 resolvidos/triviais e os itens 3-5 mantidos mas individualmente modestos, Tarefas **não é mais claramente "a maior dos três" por margem larga** — o fator que mais pesava (a incerteza de convivência com dado real desconhecido) não existia de fato. A estimativa honesta agora é **pequena-média, mesma ordem de grandeza que a Fase B de Financeiro** (`etapa-5-flip-financeiro-pacote.md`), modestamente maior por causa dos itens 3-5 (mais consumidores, 1 fix de vocabulário sequenciado, 1 arquivo com histórico de colisão) — não substancialmente maior como a redação original de 14/ago sugeria antes de ter os números em mãos.

Compensando parcialmente (herdado da Fase A, ainda válido): schema com FK completa desde a criação, `source_local_id` + índice único já resolvidos, importador assistido já homologado (10/11, bug (g) do fan-out retroativo confirmado corrigido nesta rodada por leitura direta de `useLocalTasksImport.ts:123-141` — a migração suave e o `pendingLinks` persistido já estão no código, apesar do roadmap ainda listar o hash como "não rastreável").

**Insumo para o operador (texto original, 14/ago/2026, preservado)**: *"diferente de Financeiro (que coube numa fatia do mesmo tamanho de Projetos), Tarefas tem 2 dependências sequenciais que os outros dois flips não tiveram — a quantificação do §2 (bloqueia o desenho fino do §5) e a decisão do §5 em si (que só fecha depois da quantificação). Isso sugere considerar quebrar em duas rodadas: uma rodada curta só pra rodar as 8 SQLs + fechar a decisão do §5 com número real em mãos (sem código), e a Fase B código como rodada separada, maior, já com o §5 resolvido em vez de carregado como incerteza dentro da mesma fatia."* **Cumprido (15/ago/2026)**: esta própria rodada (doc-only, Lane E) foi exatamente essa "rodada curta" — SQLs rodadas, §5 fechado. A recomendação de quebrar em 2 rodadas já foi seguida; não sobra trabalho de coordenação pendente nesse eixo. A Fase B código pode seguir como rodada única, com §5 resolvido em vez de carregado como incerteza (§6.1).

---

## Referências

- `docs/architecture/etapa-5-flip-tarefas-fase-a.md` — inventário-base desta rodada
- `docs/qa/tarefas-r2-auditoria.md` — quantificação SQL (§1), contenção (a) adotada 14/ago/2026, resultado da quantificação e fechamento do R2 em §4 (15/ago/2026, 0 linhas em `public.tasks`)
- `docs/architecture/kora-hub-auditoria-e-plano.md` — G49 (`createProjectBaseTasks` grava vocabulário legado, ARMADO, fix em voo na Lane B) — referenciado em §3.1
- `docs/qa/etapa-5-flip-financeiro-pacote.md` — molde de estrutura/profundidade (Lane C), precedente direto do tratamento "pós-flip com aviso" (§1.2/§1.3) e do padrão `useBifurcatedX`
- `docs/qa/etapa-5-fatia-7-projects.md` §10 (subtasks/comments, linhas 808-825) e §13.7/§13.8 (bug (g), fan-out retroativo — corrigido, confirmado por leitura de código)
- `docs/architecture/kora-hub-auditoria-e-plano.md` — G22 (dual-write existente), G29 (banner desatualizado), G30 (cache de mutação), G32 (fetch paralelo é design da casa), G37 (payload de espelho incompleto + passthrough de UUID), G40 (vocabulário `updateTaskStatus`, FECHADO), G41 (Financeiro, contexto de coordenação de arquivo)
- `docs/architecture/kora-roadmap.md` §3.6 — status de Tarefas pré-flip ("não migrado na prática")
