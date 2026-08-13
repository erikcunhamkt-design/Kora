# Roadmap — Kora Hub

> Documento de controle **vivo**, permanente. Atualiza a cada fechamento de fatia/etapa
> (idealmente no mesmo commit do sign-off). Complementa, não substitui:
> [`kora-hub-auditoria-e-plano.md`](kora-hub-auditoria-e-plano.md) (catálogo técnico G/O,
> plano de etapas original) e [`kora-ux-produto.md`](kora-ux-produto.md) (catálogo UX).
> "Quantas faltam" deve ser respondível só pela tabela-resumo abaixo, sem precisar ler
> nenhum outro doc. Regra de manutenção completa no rodapé (§8).

---

## 1. Tabela-resumo

| Etapa/Fatia | Estado | Critério de pronto | Última atualização (hash) |
| :-- | :-- | :-- | :-- |
| Etapa 0 — Rede de segurança | ✅ feito | Pipeline verde; nenhum segredo no histórico; testes rodando | *(hash não coletado nesta rodada — ver `docs/qa/etapa-0-rede-de-seguranca.md`)* |
| Etapa 1 — Organização do repositório | ✅ feito | App inalterado; raiz limpa (só `README.md`); repo navegável | *(idem — ver `etapa-1-organizacao.md`)* |
| Etapa 2 — Endurecer segurança | ✅ feito (1 item adiado por decisão) | Relatório de cada item (OK/corrigido); testes de webhook rejeitando assinatura inválida | S3/CORS adiado por decisão do dono do repo (§7) — ver `etapa-2-seguranca.md` |
| Etapa 3 — Performance de banco | ✅ feito | `EXPLAIN ANALYZE` das queries quentes usando índice; migrações sem quebrar RLS | *(idem — ver `etapa-3-performance-db.md`)* |
| Etapa 4 — Feature flags centralizadas | ✅ feito | UI intacta; toda flag lida de um lugar só (`src/config/flags.ts`); repositories com contrato único | *(idem — ver `etapa-4-flags.md`)* |
| Etapa 5 · Fatia 1 — fichas técnicas (teste de fogo) | ✅ feito | 6/6 provas, homologado | Homologado 2026-07-18 (sem hash único de merge citado no doc) |
| Etapa 5 · Fatia 2 — opportunities (import) | ✅ feito | 7/7 provas | Sem hash único citado; achado pós-fechamento O1 registrado, não reabre |
| Etapa 5 · Fatia 3 — quotes (import) | ✅ feito | 5/5 + 1/1, zero perda, sign-off fechado | Achados pós-fechamento Q8/Q9/Q10 registrados, não reabrem |
| Etapa 5 · Fatia 4 — clients (regularização) | ✅ feito no código; **doc termina sem hash de merge registrado** | C8 homologado; ver §3 — hoje completo em produção (leitura+escrita default Supabase) | Não rastreável no doc; confirmado indiretamente (código atual) |
| Etapa 5 · Fatia 6 — finance (import) | 🟡 import feito; **cutover NÃO ocorreu** | Import homologado (5/5); cutover de leitura/escrita default ainda pendente — ver §3 | Sem hash de merge registrado no doc |
| Etapa 5 · Fatia 7 — projects/tasks (import) | 🟡 import feito; **1 caso vermelho (bug "g", fan-out retroativo) com correção incerta**; cutover NÃO ocorreu | 10/11 verde na Fase D; bug (g) proposto mas sem hash rastreável de fix; cutover ainda pendente — ver §3 | Sem hash de merge registrado; fix do bug (g) citado depois (Fatia 8) sem hash rastreável — **verificar na próxima atualização** |
| Etapa 5 · Fatia 8 — CRM (cutover de escrita) | ✅ feito | 11/11 provas | Sem hash único citado no doc; confirmado no código atual (CRM completo) |
| Etapa 5 · Fatia 9 — quotes (fundação + cutover de leitura) | ✅ feito | 8/8 provas | Precursor do Pacote do Flip |
| Etapa 5 · Fatia 10 — quotes (infra de cutover de escrita) | ✅ feito | 9/9, 5 incidentes de homologação corrigidos ao longo | `ac367ad` |
| Etapa 5 · **Pacote do Flip** — quotes (defaults flipados) | ✅ feito — **marco: G1/quotes 100% completo** | 6/6; leitura E escrita default Supabase | `dae6de8` |
| Etapa 5 · Fatia N — projetos (escrita real: flags, leitura bifurcada, dual-write) | ✅ feito — **fundação, não o flip** (defaults continuam local/OFF); **DDL aplicada** (§8-b, 12/ago) | `tsc` 0 · lint 0 erros/29 warnings · vitest 392/392; migration do CHECK/`deliverables` **aplicada em produção**, pré-check 0 linhas, zero incidentes — pré-requisito de schema da Fatia N+1 caiu | `208ff9c` (código) / DDL aplicada 12/ago/2026 |
| G1 · clients | ✅ completo (confirmado no código) | Leitura+escrita default Supabase, reversível | Ver §3.1 |
| G1 · fichas técnicas | ✅ completo (confirmado no código) | Leitura+escrita default Supabase, flip por cliente | Ver §3.2 |
| G1 · CRM/oportunidades | ✅ completo (confirmado no código) | Leitura+escrita default Supabase, flip reversível | Ver §3.3 |
| G1 · financeiro | 🟡 dual-write parcial, leitura local por padrão | Ver §3.4 — critério de pronto detalhado | Fila |
| G1 · projetos | 🟡 na reta final — Fase C (flip dos defaults) em execução, falta homologação | Ver §3.5 — fundação + DDL já prontas (Fatia N), só falta o flip fechar + Fase D pra virar ✅ | `208ff9c` (fundação) / DDL 12/ago/2026; Fase C em execução (13/ago/2026) |
| G1 · tarefas | 🔴 não migrado na prática | Ver §3.6 | Backlog |
| Etapa 6 — Fila, rate limit e worker | ✅ **concluído no repo e no banco** (G5 100% fechado; item 4 decidido, corrigido E aplicado) | Ver §4 — item 4: (c)+reaper (G24, **FECHADO**, reaper ativo em produção — `jobid 3`, `*/15`); unificação v1→v2 (opção b) fica registrada como fatia futura, não bloqueia o fechamento desta etapa | `6022d0f` (código) / DDL aplicada 12/ago/2026 |
| Etapa 7 — Qualidade contínua | 🟡 em curso | Teto de lint menor; cobertura dos fluxos críticos; alertas ativos | Teto de lint 0/0 alcançado; cobertura/alertas não confirmados 100% |
| Etapa 8 — WhatsApp Oficial (Tech Provider) | ⬜ backlog | PLANEJADA, não iniciada — depende de G1 avançar | — |
| Etapa 9 — Robô IA (4 itens: provider Claude, cérebro, base de conhecimento, construtor sem IA) | ⬜ backlog — decisão do operador, ainda não iniciada | Ver §6 — inicia **depois** do flip de Projetos fechar (não muda a prioridade atual, que continua sendo o flip) | Decisão registrada 13/ago/2026 |
| Transversal — UX/Produto | 🟡 catalogado, sem prazo | Ver §7.1 | `kora-ux-produto.md` |
| Transversal — RBAC | ⬜ backlog, não planejado ainda | Ver §7.2 | — |
| Transversal — Supabase Pro | ⬜ backlog, não decidido | Ver §7.3 | — |
| Transversal — S3/CORS hardening | ⬜ adiado por decisão (aguarda domínios) | Ver §7.4 | `etapa-2-seguranca.md` |

**Legenda:** ✅ feito · 🟡 em curso/parcial · ⬜ fila/backlog · 🔴 não iniciado na prática

---

## 2. Feito (síntese)

**Etapas 1–4 (fundação):** rede de segurança (CI com type-check real pós-G9, testes de fumaça), repo organizado (`docs/` centralizado), segurança endurecida (webhooks validando assinatura, `service_role` isolado), performance de banco (índices, `is_workspace_member STABLE`), feature flags centralizadas em `src/config/flags.ts`.

**Etapa 5 — G1/quotes completo, ponta a ponta:** das 10 fatias/marcos (1, 2, 3, 4, 6, 7, 8, 9, 10 + Pacote do Flip — não existe "Fatia 5", confirmado por grep), quotes chegou a **100% Supabase por default** (`dae6de8`) — primeiro domínio do Kora Hub a completar o ciclo inteiro. Achados ao longo do caminho: Q8/Q9/Q10 (quotes), 5 incidentes de homologação da Fatia 10 (worktree errada, loop de refetch — G14, symlink quebrado — motivou §17, import órfão — G16, gate de status), G11 (RPC overload), G12/G13 (lições de tradução/import-map).

**Etapa 6 — ✅ concluída no repo e no banco — ver §4 para detalhe:** `pg_cron`/`pg_net` confirmados ativos e em uso real (`whatsapp-campaign-processor`, legado, a cada minuto); G8 (template do Send Node) resolvido e deployado; G18 (dependência Lovable) resolvido e validado em produção (Gemini direto); G5 Parte 1 (auth real do `isTest` + migração de provider) e Parte 2 (rate limit + retry/backoff) com código, DDL, deploy da function **e job de limpeza da tabela de contadores** todos confirmados em produção (02–03/ago/2026) — **G5 100% fechado**. Item 4 (fila v2 de campanhas) **investigado, decidido e aplicado**: decisão (c) — v2 continua manual-only, sem cron novo — **+ reaper** (G24, **FECHADO**, migration `20260811000200` aplicada em produção via sessão §8-b de 12/ago — `jobid 3`, `*/15 * * * *`, grants confirmados só `service_role`+dono, teste funcional 0, zero incidentes) pro bug de recipients presos em `sending`. Unificação v1→v2 (opção b) registrada como fatia futura, não como bloqueio. Acompanhamento não bloqueante: confirmar 1ª execução automática do `jobid 3` em `cron.job_run_details`.

**Resgates de UI/dados órfãos (fora da sequência linear de fatias):** G16 (card Supabase de quotes nunca renderizado — corrigido), G20 (filtro de tipo faltando no dashboard operacional — corrigido), G22 (dual-write de "Gerar recebível"/"Gerar projeto" — corrigido). G21 (`BotRulesPanel.tsx` órfão), G23 (avisos "híbrido" desatualizados na aba Dados — ver §3) e G25 (`WhatsAppCampaigns.tsx` órfão, único escritor da fila legada — worker vivo, fila morta) catalogados, não corrigidos.

**Qualidade:** teto de lint chegou a **0 erros / 0 `any`** (histórico: ~89 → 68 → 49 → 34 → 33 → 2 → 0, ao longo de várias rodadas `qualidade-lint-*`).

**Processo:** §16 (isolamento de worktree por lane), §17 (prova de build por hash de commit), §18 (merge para `main` condicionado a revisão — branch + relatório + "vai" literal) — todos em `docs/qa/protocolo-homologacao.md`.

---

## 3. G1 — domínios restantes (ordem de dependência do roadmap de migração)

> **Correção à premissa de trabalho:** a hipótese de entrada desta rodada era "só quotes está
> completo, os demais domínios estão em dual-write como o G22 mostrou". **Verificado
> diretamente no código** (não de memória): isso só é verdade para **financeiro, projetos e
> tarefas**. **Clients, fichas técnicas e CRM já estão no mesmo estágio "completo" que
> quotes** — leitura e escrita default Supabase, com flip reversível (exceto clients, cujo
> "flip" é automático via presença de workspace, não um toggle de usuário). Isso muda o que
> de fato falta pro G1 fechar: só 3 domínios, não 6.

> **Reconciliação (2ª rodada, mesmo dia):** o operador reportou prints de hoje da aba Dados
> (Configurações) com avisos afirmando "a tela Clientes/CRM/Ficha Técnica ainda usa dados
> locais" — contradizendo a classificação acima. Verificado a fundo antes de aceitar qualquer
> um dos dois lados: **os avisos são texto morto**, confirmado por `git blame`, não por
> suposição. Os 4 blocos de aviso (`Configuracoes.tsx:1271,1441,1586,1835/1975`) vêm todos do
> mesmo commit `4b1a8f20` (2026-06-01). A lógica real de default das 3 telas foi escrita
> **depois** — `useClientsDataSource.ts:47` no commit `7ab23675` (2026-06-15);
> `getCrmDataSource()`/`getTechnicalSheetDataSource()` em `flags.ts` no commit `49ec0bf6`
> (2026-07-04), com comentário explícito no próprio código confirmando o default "supabase".
> O aviso de Clientes ainda cita "ative a fonte Supabase experimental" — mecanismo que **não
> existe mais** no código atual, prova adicional de que o texto descreve uma versão anterior
> do mecanismo, não o comportamento de hoje. **Classificação dos 3 domínios como "completo"
> mantida** — os avisos desatualizados foram catalogados como achado próprio,
> [`G23`](kora-hub-auditoria-e-plano.md), não corrigidos nesta rodada (fora de escopo:
> reconciliação de roadmap, não correção de UI).

### 3.1 Clients — ✅ completo
`useClientsDataSource.ts:47` decide a fonte automaticamente pela presença de `workspace`
(sempre supabase pra qualquer usuário autenticado — não há toggle manual, mas também não há
como cair em local por engano). Tela (`Clientes.tsx`) e escrita (CRUD completo, branch real
por fonte) confirmados. Sub-feature Contatos também completa (`useSupabaseClientContacts.ts`).

### 3.2 Fichas técnicas — ✅ completo
`kora.technicalSheets.dataSource.v1` (flip por `clientId`, default supabase) +
`ClientTechnicalSheet.tsx:331`. Autosave default ON. Flip visível na UI com diálogo de
restauração. Padrão idêntico ao de quotes.

### 3.3 CRM/oportunidades — ✅ completo
`kora.crm.dataSource.v1` (default supabase) + `CRM.tsx:166-168`. Mestre de escrita
`kora.crm.supabaseWrite.enabled` default ON desde a Fatia 8. CRUD completo com branch real,
flip visível na UI (botões Local/Supabase). Sub-fluxo `crmSupabaseCreateQuote` (criar quote a
partir de oportunidade) é opt-in à parte, não afeta o CRUD principal.

### 3.4 Financeiro — 🟡 dual-write parcial, leitura local por padrão

- **Hoje:** `Financeiro.tsx` usa só `useFinance()` — zero referência a Supabase na tela
  inteira (confirmado por grep). Única escrita Supabase existe isolada em
  `CreateReceivableDialog.tsx` (acionado do CRM, não do Financeiro), atrás da flag
  `quotesSupabaseCreateReceivable` (**default OFF**), e é dual-write best-effort (local
  primeiro, espelho depois — fix do G22).
- **Critério de pronto (padrão do flip):**
  1. Flag/mecanismo de fonte pra `Financeiro.tsx` (`kora.financeiro.dataSource.v1` ou
     auto-detecção por workspace, como clients).
  2. CRUD completo via `financeRepository` **wireado na tela real** (hoje só existe pro
     fluxo isolado de quote→recebível).
  3. Flip do default pra supabase.
  4. Decisão sobre o dual-write existente: pós-flip, o caminho local vira o espelho (ou é
     aposentado) — mesma decisão que CRM/clients já tomaram.

### 3.5 Projetos — 🟡 na reta final: fundação + DDL prontas (Fatia N), Fase C (flip) em execução (Fatia N+1)

- **Antes desta fatia:** `ProjectsSection.tsx`/`ProjectDetailDrawer.tsx` liam só `useProjects()`
  (100% localStorage, sem seletor de fonte nenhum — diferente de CRM/quotes, aqui o hook nunca
  tinha sido bifurcado). Escrita Supabase isolada em `CreateProjectFromQuoteDialog.tsx` (do CRM),
  flag `quotesSupabaseCreateProject` (default OFF), dual-write best-effort (fix do G22).
- **Fatia N — "Projetos — escrita real" (`208ff9c`, equivalente à Fatia 10 de quotes):**
  `kora.projects.dataSource.v1` (novo, default **local** — nascimento igual ao de quotes na
  Fatia 9) + leitura bifurcada em `ProjectsSection.tsx`/`ProjectDetailDrawer.tsx` (9 outros
  consumidores — Central do Dia, `QuoteToProjectDialog`, ficha do cliente etc. — ficam
  local-only nesta fatia, catalogado, não bloqueante) + `kora.projects.supabaseWrite.enabled`
  (novo flag mestre, default OFF) + módulo `projectsCloudMirror.ts` (espelho best-effort,
  padrão G22, idempotente via `source_local_id`). Migration do CHECK de `status` (8 valores,
  alias legado `active` — O10) + coluna `deliverables`
  (`20260811000100_etapa5_flip_projetos_deliverables_status_check.sql`) — **APLICADA em
  produção na sessão §8-b de 12/ago/2026**: pré-check retornou 0 linhas (nenhum status fora
  do vocabulário), coluna e CHECK confirmados pós-aplicação, zero incidentes.
  Achados catalogados: O9 (código morto), O10/O12 (dívida de vocabulário `status`/`archived`,
  resolver juntos numa fatia futura), O11 (classe de bug — fixture de teste com data absoluta).
  Gates: `tsc` 0 · lint 0/29 (baseline) · vitest 392/392. Detalhe completo:
  [`etapa-5-flip-projetos.md`](../qa/etapa-5-flip-projetos.md).
- **Ainda não é "pronto" pelo critério do §8, regra 4 até o flip fechar** — critério é leitura
  E escrita default Supabase, reversível, não só o código pronto.
- **Estado em 13/ago/2026: Fase C (Pacote do Flip — projetos, Fatia N+1) em execução.** DDL
  aplicada (sem pré-requisito de schema pendente), CRUD completo em modo Supabase mesclado
  (Fase B, `d90ba47`/`fbdea18`, resolve O12), runbook das Fases C/D já preparado e mesclado
  (`etapa-5-flip-projetos-runbook.md`, `1e66607`) — falta o flip dos 2 defaults em si fechar e
  a Fase D (homologação B.3) rodar. Decidir o destino das flags experimentais que ficarem
  redundantes no flip (`projectsSupabaseCreateBaseTasks` provavelmente sobrevive — gate um
  domínio adjacente, tasks, ainda não migrado).

### 3.6 Tarefas — 🔴 não migrado na prática

- **Hoje:** `Tarefas.tsx` usa só `useTasks()` — zero referência a Supabase (confirmado por
  grep). A **única** escrita Supabase do domínio inteiro
  (`tasksRepository.createProjectBaseTasks`, via `CreateProjectBaseTasksDialog.tsx`) só é
  alcançável a partir do painel interno de QA em Configurações
  (`SupabaseOperationalDashboardCard`, flag `supabaseOperationalDashboard` default OFF) — **não
  existe nenhum caminho de produção** que grave tarefa no Supabase hoje. Mais atrasado que
  financeiro/projetos, que ao menos têm um dual-write real (ainda que opt-in) alimentado do CRM.
- **Critério de pronto:** precisa primeiro de um hook real de leitura/escrita de tarefas
  desvinculado de projeto específico (hoje só existe `useSupabaseProjectTasks`, escopado a um
  projeto) — trabalho de fundação equivalente ao que as Fatias 1-4 fizeram pros outros
  domínios, não um simples flip. Depois, os mesmos 4 passos das seções acima.
- **Achado correlato:** G21 (`BotRulesPanel.tsx`, órfão) fica registrado aqui por proximidade
  de área (WhatsApp/bot), não por dependência técnica com tarefas — ver §7.1.

---

## 4. Etapa 6 — restante

1. **Job `pg_cron` de limpeza de `ai_rate_limit_counters` — ✅ FEITO.** Aplicado na sessão
   §8-b de 2026-08-03: job `ai-rate-limit-cleanup` (`jobid 2`), `0 * * * *` (hora em hora),
   retenção de 24h, `DELETE` inline no `cron.schedule` (mesmo padrão do
   `whatsapp-campaign-processor` já existente) — sem incidentes, kit (a)/(b) verdes (linha
   sintética de 25h varrida pelo comando do job, contadores recentes intactos). Kit (c)
   (prova de execução automática real) fica como acompanhamento pós-1ª execução, não
   bloqueante. Desenho completo + migration em `etapa-6-g5-rate-limit.md` §13. Hash:
   `8e7c2f1` (commit desta janela de merge que registra o resultado da sessão §8-b).
2. **Deploy da function `whatsapp-bot-reply` com o código do G5 Parte 2 — ✅ FEITO.**
   **Correção a esta linha:** a versão anterior deste doc registrou isto como "pendente
   crítico" — errado. O deploy aconteceu em 02/ago/2026, pelo operador, com o bundle
   confirmado no output do CLI (`rateLimit.ts`/`retry.ts` presentes) e smoke `200`
   pós-deploy. RPC de rate limit e retry/backoff estão ativos em produção.
   **Lição registrada:** estado de deploy de Edge Function **não é inferível do repo** — não
   existe tag, arquivo ou commit que prove "isto está no ar"; é registro **operacional**, que
   só existe no relatório da sessão de deploy (ou na memória de quem rodou). Este doc errou
   exatamente por inferir "não fica claro no histórico do repo que isso foi deployado" como
   se fosse equivalente a "não foi deployado". Regra daqui pra frente: **na dúvida sobre
   estado de deploy, o doc registra "a confirmar com o operador"**, nunca afirma pendente ou
   feito por inferência do que está (ou não está) versionado.
3. **Rate limit e retry só cobrem `whatsapp-bot-reply`** (a única function que chama IA paga
   hoje — confirmado por grep no G5 Fase A). "e-mail" citado no G5/Etapa 6 originais é
   aspiracional, não existe integração nenhuma no repo.
4. **G4 (fila de campanhas): investigado e decidido (LANE C, Fase A `71c4a75` + Fase B
   `208ff9c`).** `pg_cron` aciona `whatsapp-campaign-processor` (sistema legado) a cada
   minuto, com claim atômico (`claim_campaign_messages`) e reaper (`reap_stuck_campaign_messages`)
   — funcional e bem construído, **mas sem caminho de produção que o alimente**: o único
   ponto de escrita em `whatsapp_queue`/`whatsapp_campaigns` é `WhatsAppCampaigns.tsx`, que é
   código órfão (zero importadores — **G25**). `whatsapp-campaign-v2-sender` (sistema atual,
   `CampaignsBackendPage`) segue manual-only, sem cron, e tem um bug próprio: recipients
   presos em `sending` sem self-heal se a invocação estourar o tempo (lote cheio chega a
   ~13,5min) ou cair no meio — mesma classe que o legado já teve e corrigiu (**G24**).
   - **Decisão registrada (opção c + reaper, não a):** v2 continua manual-only — automatizar
     agora (cron pra v2) industrializaria o bug G24 em vez de corrigi-lo primeiro. Fix
     aplicado ao bug isoladamente: RPC `reap_stuck_campaign_v2_recipients` (threshold 1200s,
     calculado pra não reaptar lotes legítimos em andamento) + `cron.schedule` a cada 15min,
     migration `20260811000200_etapa6_campaign_v2_reaper.sql` — **APLICADA em produção na
     sessão §8-b de 12/ago/2026** (junto com a migration de Projetos, mesma janela, pacotes
     distintos): `jobid 3`, schedule `*/15 * * * *` confirmado ativo, grants confirmados só
     `service_role` + dono da function (nenhum `anon`/`authenticated`/`PUBLIC`), teste
     funcional manual retornou `0` (nenhum recipient preso no momento), **zero incidentes**.
     **G24 fechado.** Acompanhamento não bloqueante: confirmar em `cron.job_run_details`
     (jobid 3) que a 1ª execução automática rodou sozinha.
   - **Unificação v1→v2 (opção b) — registrada como fatia futura, não decidida agora:** mover
     o worker robusto (claim/reap) do legado pra operar sobre o schema v2, aposentando as
     tabelas legadas depois — já era o "próximo passo" documentado em
     `SUPABASE-WHATSAPP-CAMPAIGNS-V1.md`. Não escopada nesta rodada.
   - **Atenção antes de mexer no cron do legado:** ele é hoje o heartbeat que mitiga a pausa
     por inatividade do projeto Supabase Free (§7.3) — desagendar por causa da UI órfã (G25)
     sem decidir esse heartbeat à parte reintroduz o risco de pausa.

**Etapa 6 — ✅ concluída no repo e no banco.** O escopo do G5 (rate limit/retry para chamadas de
IA, itens 1-3) está **100% fechado**: código, DDL, deploy da function e job de limpeza, todos
confirmados em produção. O item 4 (worker/fila de campanhas — escopo mais amplo que o G5,
cobre envio, não só chamadas de IA) está **investigado, decidido e aplicado**: v2 fica
manual-only + reaper (G24 fechado, `jobid 3` ativo em produção); unificação v1→v2 é fatia
futura, não bloqueio. Único item pendente é um acompanhamento **não bloqueante**: confirmar
em `cron.job_run_details` que o `jobid 3` já rodou sozinho pela 1ª vez.

---

## 5. Etapa 8 — WhatsApp Oficial: Tech Provider + Embedded Signup (resumo)

**Status: PLANEJADA, não iniciada**, dependente do G1 avançar (Etapa 5) — sem data definida.

**Modelo:** Kora opera como Tech Provider da Meta (estilo SMClick) — cada tenant conecta a
própria WABA via Embedded Signup; Kora lista os templates aprovados da conta do tenant e opera
atendimento (janela 24h) + disparo proativo (só template aprovado). Compliance de mensagens
fica com o tenant, não com a IndhecX.

**Pré-requisitos (uma vez, lado IndhecX):** verificação de negócio no Meta Business Manager
(1-5 dias) · Meta App tipo Business com produto WhatsApp · App Review
(`whatsapp_business_messaging`+`whatsapp_business_management`, dias a semanas) · implementar
Embedded Signup (OAuth) no Kora.

**Por tenant, no onboarding:** Embedded Signup dentro do Kora (minutos) · verificação de
negócio do tenant · número dedicado próprio · templates aprovados na WABA do tenant, consumidos
via `GET /{waba-id}/message_templates?status=APPROVED`.

**Impacto técnico:** multi-tenant `waba_id`/`phone_number_id`/`token` por workspace (tokens
criptografados, nunca no frontend) · cache/sync de templates aprovados · webhooks (`HMAC-SHA256`
já endurecido na Etapa 2, S1) · módulo WhatsApp atual (já tipado, já com G18 resolvido) é a
base a evoluir.

Detalhamento completo: [`kora-hub-auditoria-e-plano.md` §Etapa 8](kora-hub-auditoria-e-plano.md).

---

## 6. Etapa 9 — Robô IA (decisão do operador, 13/ago/2026)

**Status: registrada, não iniciada.** Prioridade explícita: **começa depois do flip de
Projetos fechar** (Fase C/D da Fatia N+1, ver §3.5) — essa decisão não muda a prioridade
corrente, que continua sendo fechar o flip. Contexto de G1 no momento desta decisão: **4
domínios completos** (clients, fichas técnicas, CRM, quotes — §3.1-3.3 + Pacote do Flip de
quotes) + **Projetos na reta final** (Fase C em execução, falta homologação — §3.5) + restam
**Financeiro e Tarefas** (§3.4, §3.6).

4 itens, nesta ordem:

1. **Migrar provider do robô: Gemini → Claude (API Anthropic).** Primeira da etapa — fatia
   técnica curta. Molde direto: a migração Lovable→Gemini já feita e validada (**G18**,
   `kora-hub-auditoria-e-plano.md`) — troca de provider default em `whatsapp-bot-reply/index.ts`
   (mesmas 4 ocorrências de fallback já mapeadas por aquela fatia) + endpoint/parser novos (o
   G18 não precisou trocar parser porque o formato de resposta já batia entre `gemini_api_key`
   e `vertex_ai`; a API da Anthropic tem formato de resposta diferente — `content[].text`, não
   `candidates[].content.parts[].text` — então esta migração precisa de um parser novo, não só
   trocar a variável de provider. Escopo a confirmar na Fase A desta fatia, não presumido aqui.
2. **"Cérebro" — instruções da empresa por workspace.** O que o robô pode/não pode falar, tom
   de voz, produtos/serviços oferecidos — configuração por tenant, não hardcoded.
3. **Base de conhecimento — robô estuda o workspace e aprende.** **Exige Fase A própria antes
   de qualquer código** — 3 perguntas explícitas que a Fase A precisa responder antes de
   escopar implementação: (a) LGPD — que dado de cliente/conversa pode alimentar o contexto do
   modelo, sob qual base legal, com qual retenção; (b) escopo de leitura — quais tabelas/campos
   do workspace o robô de fato lê pra "aprender" (todo o CRM? só produtos/serviços? histórico
   de conversas?); (c) custo de contexto — impacto em tokens/custo por chamada de incluir esse
   conhecimento, e se isso interage com o rate limit já existente (**G5**,
   `kora-hub-auditoria-e-plano.md`, hoje escopado só pra `whatsapp-bot-reply`).
4. **Construtor de fluxo SEM IA — menus fixos, transbordo (lojas/atendentes/humano).** Insumo
   de produto já registrado: **UX3** (`kora-ux-produto.md`), a ideia de "modos de atendimento"
   do `BotRulesPanel.tsx` removido no **G21** — não é um protótipo pronto (o componente era
   100% mockado, sem backend), é uma nota de UX preservada antes da remoção do código morto.
   UX3 fala em "modos" pré-definidos com guardrails e regras de elegibilidade/transferência em
   accordion — não descreve literalmente "menus fixos", mas é o insumo mais próximo já
   catalogado pra esse conceito; vale reler antes de desenhar este item.

Nenhum dos 4 itens tem fatia própria aberta ainda — esta seção é o registro da decisão de
prioridade e do que cada item precisa antes de virar código, não um plano de execução
detalhado (isso é trabalho de uma futura Fase A por item, especialmente o item 3).

---

## 7. Transversais

### 7.1 UX/Produto

> **Nota de precisão:** a tarefa que originou este documento referenciava um "princípio
> 'automático por default'" como tese central do catálogo de UX. **Busquei essa frase
> literalmente em `kora-ux-produto.md` e ela não existe.** O princípio que de fato emerge do
> conteúdo do documento é outro — registrado abaixo, correto em vez de forçar o encaixe da
> premissa recebida.

**Princípio central (UX1):** contexto pré-preenchido evita a classe de erro que formulário de
campo livre não evita. Comparação real: `CreateCrmSupabaseQuoteDialog` (aberto de dentro de
uma oportunidade, pré-preenche cliente/título) nunca gerou erro de campo trocado em
homologação; `NewQuoteWizard` (campos livres, sem âncora de contexto) gerou erro repetidamente
(ex.: título trocado, achado da Fatia 10). Catalogado como padrão bom a espalhar, sem prazo.

**UX2:** simulador do bot (`WhatsAppBotConfig`) só é alcançável com WhatsApp já conectado —
inacessível justamente no cenário onde seria mais útil (testar o robô antes de ligar de vez).
Causa: early-return em `WhatsApp.tsx:485-503` some com a página inteira, inclusive a aba "Robô
IA", sem checar se a aba pedida precisa mesmo de conexão real. Pergunta de produto em aberto:
liberar só essa aba sem conexão, já que `isTest` nunca toca um número real?

**O8 (não é UX, é técnico — catalogado em `kora-hub-auditoria-e-plano.md`):** "Mover para
etapa" no menu do lead do CRM não move nada, sem feedback — achado do revisor, causa provável
identificada por leitura, não confirmada ao vivo.

**G21 (técnico, insumo de UX2):** `BotRulesPanel.tsx` é uma tela alternativa de configuração
do robô, escrita e nunca conectada à navegação — nem import órfão como o G16, simplesmente
nunca ligada. Simulador interno dela é 100% mockado (resposta fixa, não chama function real).
Decisão de remontar/absorver/aposentar pendente.

### 7.2 RBAC — pós-G1, pré-requisito de multi-usuário

**Não encontrado como feature planejada em nenhum doc do repo** (busca exaustiva). O único
"role" que existe hoje é `workspace_members.role` (`owner`/`admin`/`member`/`viewer`), usado
só para RLS multi-tenant ("é membro ou não") — não há RLS policy nem lógica de frontend que
diferencie os 4 valores entre si. Registrado aqui como item de backlog **não escopado ainda**,
por ser um pré-requisito natural de qualquer cenário multi-usuário dentro de um workspace —
não tem doc próprio, não tem estimativa, não tem fatia definida.

### 7.3 Supabase Pro — antes de tenant real

**Não encontrada nenhuma decisão registrada** de migrar do plano Free pro Pro. O que existe é
o risco já aceito formalmente pelo dono do repo (`protocolo-homologacao.md` §0): projeto no
Free, sem backup automático, risco de perda de dado assumido conscientemente. Risco adicional
documentado (`etapa-6-levantamento.md`): projeto Free pausa após 1 semana de inatividade,
mitigado por construção enquanto o cron de campanhas (a cada minuto) existir. Registrado como
item de backlog **não decidido ainda** — natural pré-requisito antes de operar com tenants
pagantes reais (backup automático, sem risco de pausa por inatividade), mas sem gatilho/data.

### 7.4 S3 — CORS hardening (adiado por decisão)

**Status: pendente, com adiamento explícito e documentado** (`etapa-2-seguranca.md`), não
esquecido. Motivo do adiamento: não há domínios de produção do Kora definidos ainda —
`Access-Control-Allow-Origin: *` aceitável por ora porque JWT + verificação de membership já
guardam as funções (defense-in-depth, não a única camada). Implementação já especificada em
detalhe, pronta pra quando os domínios existirem: módulo `_shared/cors.ts` com allowlist via
`ALLOWED_ORIGINS`, ecoando `Origin` só se permitido, preservando preflight `OPTIONS`; 4
functions a repontar (`whatsapp-official-send`, `-official-credentials`, `-instance`,
`-campaign-v2-sender`); os 2 webhooks não mexem (CORS irrelevante, server-to-server).

---

## 8. Regra de manutenção

1. **Este doc atualiza no fechamento de cada fatia/etapa** — idealmente no mesmo commit do
   sign-off, nunca numa rodada separada "pra depois". Se não der no mesmo commit, o próximo
   commit que tocar a fatia em questão inclui a atualização deste doc.
2. **Estado sempre acompanhado de hash** — quando um fechamento não tiver hash único
   rastreável (aconteceu em várias fatias desta primeira versão do doc, registrado
   explicitamente na tabela em vez de omitido), isso é uma lacuna a preencher, não um motivo
   pra não registrar o resto do estado.
3. **"Quantas faltam" deve ser respondível só pela tabela-resumo (§1)** — sem precisar abrir
   nenhum outro documento. Se uma mudança de estado não está refletida lá, o doc está
   desatualizado, mesmo que o texto das seções abaixo esteja certo.
4. **Toda vez que uma fatia flipar um default** (like o Pacote do Flip fez pra quotes), a
   linha correspondente em G1 (§3) muda de 🟡/🔴 pra ✅, com o hash do flip — não basta o
   import/dual-write existir, "pronto" é leitura E escrita default Supabase, reversível.
5. **Achados de resgate/auditoria** (classe G16/G20/G21/G22 — componente órfão, filtro
   faltando, dual-write que nunca foi lido) entram no catálogo mestre
   (`kora-hub-auditoria-e-plano.md`) como sempre, mas se mudarem o estado de um domínio do G1,
   este doc também atualiza — foi exatamente o G22 que motivou a criação desta versão do
   roadmap (achado durante investigação de estado real, não de memória).
