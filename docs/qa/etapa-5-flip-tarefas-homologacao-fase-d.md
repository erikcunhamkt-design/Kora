# Etapa 5 · G1/Tarefas · Homologação Fase D — execução ao vivo, placar final

> **Execução real, ao vivo, com o operador** — contra `docs/qa/etapa-5-flip-tarefas-runbook.md`
> (`7143da5`, "fechado — pronto pra execução"). Servidor confirmado
> `[Kora] BUILD f1fe83f`, workspace de QA
> `2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9`. Este doc registra o RESULTADO da
> execução — 2 correções ao próprio runbook (Caso 5, caminho real de
> gatilho; Caso 9.1, texto do comportamento esperado) foram encontradas
> durante a execução e ficam registradas aqui E replicadas no runbook
> (protocolo: o runbook é o roteiro reutilizável, este doc é a ata da
> rodada que o executou).

## Placar — 12/12 casos sem vermelho (2 com ressalva registrada)

| Caso | Resultado | Nota |
|---|---|---|
| 1 — Leitura em modo Supabase | ✅ | — |
| 2 — Escrita nativa + CHECK de status | ✅ | Prova obrigatória do CHECK capturada (ver §2 abaixo) |
| 3 — Transição de status | ✅ | — |
| 4 — Status "revisão" sobrevive à escrita cloud | ✅ | — |
| 4-bis — Deep link `?task=uuid` | ✅ | — |
| 5 — Tarefas-base coexistindo | ✅ | **Correção de runbook** — gatilho real diferente do documentado (ver §5) |
| 5-bis — Watch-item G56-classe | ✅ | Watch-item fechado — sem colisão observada |
| 6 — Exclusão soft-delete | ✅ | — |
| 7.1 — Central do Dia, caminho nativo G77 | ✅ | — |
| 7.2 — `QuoteToProjectDialog` (gap conhecido) | ✅ (achado confirmado) | Não é vermelho — comportamento já documentado como gap |
| 7.3 — `ProjectDetailDrawer` (leitura+escrita) | ✅ | — |
| 7.4 — `ClientActivitiesTab` (Histórico de Relacionamento) | ⚠️ **parcial** | Nome da aba corrigido no runbook; captura completa inalcançável por UI hoje — ver G79 |
| 8 — Banner/texto desatualizado (G78) | ✅ (achado confirmado) | Doc-only, correção pendente |
| 9 — Campos pós-flip sem sincronização | ✅ (achado AGRAVADO) | Pior do que o runbook original previa — ver §9 |
| 10 — Limpeza | ✅ | Query de resíduo ajustada; ressalva de `localStorage` do operador (ver §10) |

**Zero vermelho.** 2 achados confirmados ao vivo (7.2, 9) já eram esperados como gap documentado; 1 achado NOVO catalogado nesta rodada (G79, item independente, não previsto no runbook); 1 caso fechou parcial por limitação de UI, não por bug (7.4).

---

## Detalhe por caso

### Caso 1 — Leitura em modo Supabase ✅

Criação nativa confirmada: `SELECT source, status` da tarefa criada → `source='manual'`, `status='a_fazer'` — vocabulário local, sem tradução, confirmando G40/R1 ao vivo.

### Caso 2 — Escrita nativa + CHECK de status ✅ (prova obrigatória capturada)

`UPDATE public.tasks SET status = 'valor-invalido' ...` **FALHOU como esperado** — erro `23514` (violação de CHECK constraint) em `tasks_status_known_chk`. Prova de que a migration 5 (aplicada pelo operador na sessão §8-b) está realmente ativa em produção, não só documentada como draft. Sem esta prova, o Caso 2.3 fecharia como "assumido correto" — não é o caso aqui.

### Caso 3 — Transição de status pela tela → banco ✅

Confirmado: mover a tarefa entre colunas do kanban grava o novo status na nuvem sem F5 (G30, `setQueryData`).

### Caso 4 — `splitTaskUpdatePatch` preserva status "revisão" ✅

Editar prioridade (`priority→alta`, campo cloud) na mesma tarefa que estava em "revisão" NÃO reverteu o status — confirma que `splitTaskUpdatePatch` (`tasksMapper.ts`) manda só o `cloudPatch` pro `updateSupabaseTask`, nunca sobrescrevendo `status` de propósito.

### Caso 4-bis — Deep link com uuid real ✅

`?task=87ebd1d2-b17a-46f4-b0eb-70beac445221` abriu a Sheet de detalhe corretamente — G73 reconfirmado ao vivo, não só por teste automatizado.

### Caso 5 — Tarefas-base coexistindo ✅, com **correção de runbook**

9 tarefas geradas, todas `source='project_template'`, `status='a_fazer'`, prioridades herdadas do template — comportamento esperado (opção (a) Fundir) confirmado.

**Correção necessária no runbook**: o Caso 5 original descrevia o gatilho como "fluxo real de criação de projeto com tarefas-base" — **isso está errado**. O caminho real, confirmado ao vivo, é:

> Configurações → Dados → ligar os 2 toggles ("Visão Operacional Supabase (Experimental)" + "Gerar Tarefas Base") → abrir o painel "Visão Operacional" → botão "Gerar tarefas base" (`SupabaseOperationalDashboardCard` → `CreateProjectBaseTasksDialog`).

Não existe, hoje, nenhum caminho de "criar projeto novo" que dispare `createProjectBaseTasks` diretamente — é uma ação isolada, atrás de 2 flags experimentais, não parte do fluxo principal de projetos. **Aplicado no runbook** (`docs/qa/etapa-5-flip-tarefas-runbook.md`, Caso 5).

### Caso 5-bis — Watch-item G56-classe ✅ FECHADO

Importar 1 tarefa local (via import geral) + `SELECT` de duplicatas por `source_local_id` → 0 linhas duplicadas; `count(*)` do título importado → exatamente 1. Confirma que os 2 vocabulários de `source` (`project_template` do Caso 5 vs. import geral) não colidem sob a mesma constraint. Watch-item deixa de ser hipotético — fechado com prova ao vivo.

### Caso 6 — Exclusão soft-delete ✅

Tarefa some da tela sem reload; `deleted_at = 2026-08-30 21:30:22.631+00`; linha continua existindo (soft-delete, não hard delete) — confirmado por SELECT direto.

### Caso 7.1 — Central do Dia, caminho nativo (G77) ✅

"Concluir" na Central do Dia, em modo Supabase (default pós-flip), gravou `status='concluido'` diretamente na nuvem via `moveTask` nativo (`useSupabaseTasksAll`) — G77 confirmado funcionando em produção, não só em teste.

### Caso 7.2 — `QuoteToProjectDialog` (gap conhecido) ✅ achado confirmado ao vivo

"Gerar projeto" a partir de um orçamento aprovado criou as 4 `STARTER_TASKS` — **só localmente**. Em modo Supabase, essas 4 tarefas ficam **invisíveis na tela** (a leitura bifurcada não as encontra, porque elas nunca chegam na nuvem); `SELECT count(*)` na nuvem para os títulos das STARTER_TASKS → **0**. Isto é exatamente o gap já documentado no runbook (§Abertura, "gap conhecido, não fechado em nenhuma rodada") — confirmado ao vivo, não é vermelho. **Decisão de fechamento pendente pós-sign-off**: construir o espelho G22 (mesmo padrão de `QuoteToReceivableDialog`) ou tratar como cutover local-only permanente — fica pro operador/produto decidir, não travando este sign-off.

### Caso 7.3 — `ProjectDetailDrawer` (leitura + escrita) ✅

Leitura bifurcada confirmada: as 9 tarefas-base do Caso 5 aparecem no drawer com datas escalonadas herdadas do template. Escrita local confirmada ao vivo: uma tarefa criada pelo próprio drawer NÃO apareceu em modo Supabase (mesmo comportamento documentado no G78 — `addTask`/`moveTask` aqui seguem `useTasks()` local) — depois importada com sucesso no Caso 5-bis, fechando o ciclo de prova.

### Caso 7.4 — `ClientActivitiesTab` ⚠️ parcial

**Correção de runbook**: o nome real da aba é **"Histórico de Relacionamento"**, não "Atividades" (o runbook original citava o nome errado). Aba carrega sem erro. **Captura completa do evento de tarefa (uma tarefa vinculada a um cliente aparecendo na timeline) é INALCANÇÁVEL por UI hoje** — não existe caminho de UI em modo Supabase que vincule uma tarefa a um cliente com sucesso (ver G79 abaixo: nenhuma tela grava `client_id` real pra tarefa/projeto em modo nuvem). O mecanismo de leitura (`buildTaskEvents.ts`) está coberto por testes unitários, e o feed em si já foi provado funcionando no Caso 7.3 (para tarefas SEM vínculo de cliente) — a lacuna é especificamente "tarefa COM cliente vinculado", que hoje não tem caminho de criação em modo nuvem. **Ressalva registrada, não bloqueia o sign-off** — decorre diretamente do G79, não é um defeito próprio deste caso.

### Caso 8 — Banner/texto desatualizado (G78) ✅ achado confirmado

Comentário defasado em `ProjectDetailDrawer.tsx:88-101` reconfirmado presente. Doc-only nesta rodada, correção de código pendente (já catalogado como G78).

### Caso 9 — Campos pós-flip sem sincronização ✅ achado AGRAVADO

O runbook original (Caso 9.1) previa: *"salva normalmente na tela (via `updateTaskLocal`) — sem nenhum aviso visual"*. **Isso está errado pra uma tarefa da NUVEM** — confirmado ao vivo:

- Numa tarefa cujo `id` é um uuid (veio da nuvem via `useBifurcatedTasks`), tentar mudar `scope`/`recurrence`/lembrete pelo detail sheet faz o **próprio SELECT da UI voltar pro valor anterior** — não só "não sincroniza silenciosamente", a edição nem se mantém NA TELA. Mecanismo: o mapper hardcoda esses campos como neutros na LEITURA (então o valor exibido nunca reflete uma edição anterior), e o patch de escrita (`updateTaskLocal`, ramo local de `splitTaskUpdatePatch`) tenta achar a tarefa no store local por `id` — como a tarefa nunca existiu localmente (id uuid, só existe na nuvem), o `.map` do `useTasks()` não bate em nada, e o próximo re-render (via `useBifurcatedTasks`) volta a mostrar o valor neutro de sempre. Mesma classe geral de "patch que não acha o alvo" já vista em G76/G77, agora nos campos pós-flip.
- `SELECT scope, tags, recurrence, reminder_at, reminder_enabled FROM public.tasks WHERE title = '<tarefa da nuvem>';` → `scope IS NULL`, `tags = '{}'`, `recurrence IS NULL`, `reminder_at IS NULL`, `reminder_enabled = false` — confirma que a coluna nunca recebe nada, reforçando o achado original.
- **Consequência prática, mais severa que o previsto**: os 4 campos não ficam só "sem sincronizar" — ficam **efetivamente mortos** pra qualquer tarefa da nuvem, até a rodada do mapper acontecer. Não há sequer a experiência degradada "edito, funciona só nesta sessão" que o texto original do runbook sugeria — a edição não se sustenta nem localmente para uma tarefa que não tem registro local.
- **Correção aplicada no runbook** (Caso 9.1): texto trocado pra descrever o comportamento real (edição não se sustenta na UI pra tarefa da nuvem, não "salva normalmente").
- **Prioridade do follow-up (mapper 4 colunas) elevada pra ALTA** — este achado confirma que o gap é mais visível ao usuário do que a análise original (doc-only) previa.

### Caso 10 — Limpeza ✅, com ressalva

Query de resíduo ajustada pra cobrir os 3 caminhos de criação usados nesta rodada: `LIKE 'HOMOLOG-TAR-%' OR source='project_template' OR título = '<tarefa importada no 5-bis>'` → **0** linhas residuais na nuvem.

**Ressalva registrada, não bloqueia o sign-off**: 5 tarefas sintéticas permanecem no `localStorage` do navegador do operador (as criadas/testadas em modo local durante a rodada — Caso 4-bis regressão, Caso 5-bis fonte do import, Caso 7.3 tarefa do drawer, e 2 auxiliares). Ficam invisíveis em modo Supabase (default), mas continuam no dispositivo do operador. **Não devem ser marcadas como candidatas num import geral futuro** — o operador foi orientado a não confundi-las com dado real na próxima sessão de import assistido.

---

## G79 — Perda silenciosa de vínculo de cliente em modo Supabase (novo, catalogado nesta rodada)

Achado ao vivo durante o Caso 7.4 (tentativa de vincular tarefa/projeto a um cliente sintético pra testar `ClientActivitiesTab`) — ID reservado pelo revisor antes da execução.

- **Mecanismo 1 (projetos)**: o formulário de criação de projeto captura o cliente como **texto livre** (`clientName`), mas o mapper de escrita (`mapLocalProjectToSupabase`/caminho equivalente) só persiste `client_id` (uuid, via resolução de FK) — esse campo **nunca é preenchido** a partir do texto livre digitado (não há resolução de nome→uuid no formulário). Resultado: o projeto é criado com sucesso (`toast` de sucesso, sem erro), mas ao reler da nuvem, `clientName` volta vazio — o vínculo nunca existiu de fato, apesar da UI nunca ter avisado.
- **Mecanismo 2 (tarefas), mesma classe**: `Tarefas.tsx:86` — `const clientsList = ["Acme Corp", "Studio Zen", "Nova Design", ...]` é uma lista **hardcoded, mock**, usada nos seletores de cliente das linhas 580/1212. Não oferece nenhum cliente real do workspace — mesmo em modo Supabase, com clientes reais cadastrados, o seletor de "cliente" de uma tarefa só mostra os 7 nomes fictícios do mock.
- **Consequência combinada**: **nenhum caminho de UI vincula cliente↔tarefa ou cliente↔projeto de forma real em modo Supabase hoje.** Qualquer feature que dependa desse vínculo (ex.: `ClientActivitiesTab`/"Histórico de Relacionamento" mostrando tarefas de um cliente, Caso 7.4 acima) fica estruturalmente inalcançável por UI, não por bug pontual de leitura.
- **Mesma família do G75** (perda silenciosa de dado com sucesso falso — lá era `Client.assets`/Biblioteca do cliente; aqui é o vínculo cliente↔projeto/tarefa) — o padrão comum é: UI aceita a entrada, mapper de escrita não tem onde persistir (ou não resolve o texto livre pra FK), e o app confirma sucesso sem indicar a perda.
- **NÃO corrigido nesta rodada** (doc-only, achado de execução). Recomendação: (a) `Tarefas.tsx` — trocar `clientsList` hardcoded por clientes reais do workspace (via `useClientsDataSource`, já usado em outros domínios); (b) formulário de criação de projeto — resolver `clientName` digitado pra um `client_id` real (autocomplete contra clientes existentes, ou seletor estruturado em vez de texto livre) antes de persistir.
- **Referência:** G75 (mesma classe, `docs/architecture/kora-hub-auditoria-e-plano.md`), `Tarefas.tsx:86,580,1212` (mock hardcoded), Caso 7.4 acima (consequência observada ao vivo), `docs/qa/etapa-5-flip-tarefas-runbook.md`.

---

## Veredito

**Domínio Tarefas — HOMOLOGADO.** Placar: 12/12 casos sem vermelho (2 com ressalva registrada — 7.4 parcial por limitação de UI, 10 com resíduo local não-crítico). Nenhum caso exigiu correção de código durante a execução; 2 correções de TEXTO no runbook (Caso 5 — gatilho real; Caso 9.1 — comportamento real, agravado) já aplicadas.

**Follow-ups liberados para rodadas futuras, nenhum bloqueando este sign-off:**

1. **Mapper de 4 colunas (scope/tags/recurrence/reminders)** — prioridade **ALTA**, elevada nesta rodada (achado agravado do Caso 9: os campos não são só "não sincronizados", ficam efetivamente mortos pra tarefa da nuvem).
2. **G78** — comentário defasado em `ProjectDetailDrawer.tsx:88-101`.
3. **G79** — vínculo cliente↔tarefa/projeto inexistente em modo Supabase (`clientsList` mock em Tarefas, `clientName`→`client_id` não resolvido em projetos).
4. **Caso 7.2 — decisão de produto pendente**: espelho G22 pra `QuoteToProjectDialog` ou cutover local-only permanente.
5. **Promoção dos 5 drafts de migration** a arquivos `.sql` versionados (Lane D, `etapa-5-tarefas-migrations-drafts-arquivos`, já em andamento, independente deste sign-off).

**Referência:** `docs/qa/etapa-5-flip-tarefas-runbook.md` (runbook executado, com as 2 correções desta rodada aplicadas), `docs/architecture/kora-hub-auditoria-e-plano.md` (G78, G79).

---

**PARADO aqui — doc-only, zero código. §18: aguardando "vai" do revisor pra push/merge.**
