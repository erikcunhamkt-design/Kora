# Roadmap — Kora Hub

> Documento de controle **vivo**, permanente. Atualiza a cada fechamento de fatia/etapa
> (idealmente no mesmo commit do sign-off). Complementa, não substitui:
> [`kora-hub-auditoria-e-plano.md`](kora-hub-auditoria-e-plano.md) (catálogo técnico G/O,
> plano de etapas original) e [`kora-ux-produto.md`](kora-ux-produto.md) (catálogo UX).
> "Quantas faltam" deve ser respondível só pela tabela-resumo abaixo, sem precisar ler
> nenhum outro doc. Regra de manutenção completa no rodapé (§7).

---

## 1. Tabela-resumo

| Etapa/Fatia | Estado | Critério de pronto | Última atualização (hash) |
| :-- | :-- | :-- | :-- |
| Etapa 0 — Rede de segurança | ✅ feito | Pipeline verde; nenhum segredo no histórico; testes rodando | *(hash não coletado nesta rodada — ver `docs/qa/etapa-0-rede-de-seguranca.md`)* |
| Etapa 1 — Organização do repositório | ✅ feito | App inalterado; raiz limpa (só `README.md`); repo navegável | *(idem — ver `etapa-1-organizacao.md`)* |
| Etapa 2 — Endurecer segurança | ✅ feito (1 item adiado por decisão) | Relatório de cada item (OK/corrigido); testes de webhook rejeitando assinatura inválida | S3/CORS adiado por decisão do dono do repo (§6) — ver `etapa-2-seguranca.md` |
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
| G1 · clients | ✅ completo (confirmado no código) | Leitura+escrita default Supabase, reversível | Ver §3.1 |
| G1 · fichas técnicas | ✅ completo (confirmado no código) | Leitura+escrita default Supabase, flip por cliente | Ver §3.2 |
| G1 · CRM/oportunidades | ✅ completo (confirmado no código) | Leitura+escrita default Supabase, flip reversível | Ver §3.3 |
| G1 · financeiro | 🟡 dual-write parcial, leitura local por padrão | Ver §3.4 — critério de pronto detalhado | Fila |
| G1 · projetos | 🟡 dual-write parcial, leitura local por padrão | Ver §3.5 | Fila |
| G1 · tarefas | 🔴 não migrado na prática | Ver §3.6 | Backlog |
| Etapa 6 — Fila, rate limit e worker | 🟡 parcial | Ver §4 — 4 sub-itens, 1 com deploy pendente | Ver §4 |
| Etapa 7 — Qualidade contínua | 🟡 em curso | Teto de lint menor; cobertura dos fluxos críticos; alertas ativos | Teto de lint 0/0 alcançado; cobertura/alertas não confirmados 100% |
| Etapa 8 — WhatsApp Oficial (Tech Provider) | ⬜ backlog | PLANEJADA, não iniciada — depende de G1 avançar | — |
| Transversal — UX/Produto | 🟡 catalogado, sem prazo | Ver §6.1 | `kora-ux-produto.md` |
| Transversal — RBAC | ⬜ backlog, não planejado ainda | Ver §6.2 | — |
| Transversal — Supabase Pro | ⬜ backlog, não decidido | Ver §6.3 | — |
| Transversal — S3/CORS hardening | ⬜ adiado por decisão (aguarda domínios) | Ver §6.4 | `etapa-2-seguranca.md` |

**Legenda:** ✅ feito · 🟡 em curso/parcial · ⬜ fila/backlog · 🔴 não iniciado na prática

---

## 2. Feito (síntese)

**Etapas 1–4 (fundação):** rede de segurança (CI com type-check real pós-G9, testes de fumaça), repo organizado (`docs/` centralizado), segurança endurecida (webhooks validando assinatura, `service_role` isolado), performance de banco (índices, `is_workspace_member STABLE`), feature flags centralizadas em `src/config/flags.ts`.

**Etapa 5 — G1/quotes completo, ponta a ponta:** das 10 fatias/marcos (1, 2, 3, 4, 6, 7, 8, 9, 10 + Pacote do Flip — não existe "Fatia 5", confirmado por grep), quotes chegou a **100% Supabase por default** (`dae6de8`) — primeiro domínio do Kora Hub a completar o ciclo inteiro. Achados ao longo do caminho: Q8/Q9/Q10 (quotes), 5 incidentes de homologação da Fatia 10 (worktree errada, loop de refetch — G14, symlink quebrado — motivou §17, import órfão — G16, gate de status), G11 (RPC overload), G12/G13 (lições de tradução/import-map).

**Etapa 6 (parcial) — ver §4 para detalhe:** `pg_cron`/`pg_net` confirmados ativos e em uso real (`whatsapp-campaign-processor`, legado, a cada minuto); G8 (template do Send Node) resolvido e deployado; G18 (dependência Lovable) resolvido e validado em produção (Gemini direto); G5 Parte 1 (auth real do `isTest` + migração de provider) e Parte 2 (rate limit + retry/backoff) com código e DDL prontos — **deploy da function ainda pendente**, ver §4.

**Resgates de UI/dados órfãos (fora da sequência linear de fatias):** G16 (card Supabase de quotes nunca renderizado — corrigido), G20 (filtro de tipo faltando no dashboard operacional — corrigido), G22 (dual-write de "Gerar recebível"/"Gerar projeto" — corrigido). G21 (`BotRulesPanel.tsx` órfão) catalogado, não corrigido — ver §3.6/§6.1.

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

### 3.5 Projetos — 🟡 dual-write parcial, leitura local por padrão

- **Hoje:** `ProjectsSection.tsx` (dentro de `Portfolio.tsx` — não existe `Projetos.tsx`) usa
  só `useProjects()`. Mesma forma do financeiro: escrita Supabase isolada em
  `CreateProjectFromQuoteDialog.tsx` (do CRM), flag `quotesSupabaseCreateProject` (**default
  OFF**), dual-write best-effort (fix do G22). Painel interno de QA
  (`SupabaseOperationalDashboardCard`) tem CRUD Supabase-nativo próprio, desconectado da tela
  real.
- **Critério de pronto:** mesmos 4 passos do financeiro, adaptados — flag/auto-detecção,
  CRUD real wireado em `ProjectsSection.tsx`, flip do default, decisão sobre o dual-write.

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
  de área (WhatsApp/bot), não por dependência técnica com tarefas — ver §6.1.

---

## 4. Etapa 6 — restante

1. **Job `pg_cron` de limpeza de `ai_rate_limit_counters`** — recomendado desde o desenho do
   G5 Parte 2 (`etapa-6-g5-rate-limit.md` §10.2), **não bloqueante**, ainda não criado. Sem
   limpeza, a tabela cresce indefinidamente (uma linha por workspace/bucket/janela de 1 min).
2. **Deploy da function `whatsapp-bot-reply` com o código do G5 Parte 2 — PENDENTE.** A DDL
   (tabela + RPC + fix do `DEFAULT`) já foi aplicada em produção (6/6, sem incidentes,
   2026-08-02), e o código (rate limit + retry/backoff) já está mergeado em `main` — mas a
   **function ao vivo ainda não foi redeployada** com esse código. Ou seja: hoje, em
   produção, a RPC de rate limit existe no banco mas **não está sendo chamada** (a function
   deployada é a versão anterior, só com o fix de auth/provider do G5 Parte 1 + o fix do
   modelo Gemini) — zero rate limit e zero retry/backoff ativos até esse deploy acontecer.
   Fica pra sessão separada com o operador, guiada pelo revisor (mesmo padrão §8-b/§17 já
   usado nos deploys anteriores desta function).
3. **Rate limit e retry só cobrem `whatsapp-bot-reply`** (a única function que chama IA paga
   hoje — confirmado por grep no G5 Fase A). "e-mail" citado no G5/Etapa 6 originais é
   aspiracional, não existe integração nenhuma no repo.
4. **G4 (fila de campanhas) já resolvido pelo legado**, não pela v2: `pg_cron` aciona
   `whatsapp-campaign-processor` (sistema legado) a cada minuto, com claim atômico e reaper —
   funcional e em produção. `whatsapp-campaign-v2-sender` (sistema mais novo) segue
   manual-only, sem cron — se a v2 for o caminho definitivo, ainda falta esse cron; não
   investigado nesta rodada se há decisão de aposentar o legado ou manter os dois.

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

## 6. Transversais

### 6.1 UX/Produto

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

### 6.2 RBAC — pós-G1, pré-requisito de multi-usuário

**Não encontrado como feature planejada em nenhum doc do repo** (busca exaustiva). O único
"role" que existe hoje é `workspace_members.role` (`owner`/`admin`/`member`/`viewer`), usado
só para RLS multi-tenant ("é membro ou não") — não há RLS policy nem lógica de frontend que
diferencie os 4 valores entre si. Registrado aqui como item de backlog **não escopado ainda**,
por ser um pré-requisito natural de qualquer cenário multi-usuário dentro de um workspace —
não tem doc próprio, não tem estimativa, não tem fatia definida.

### 6.3 Supabase Pro — antes de tenant real

**Não encontrada nenhuma decisão registrada** de migrar do plano Free pro Pro. O que existe é
o risco já aceito formalmente pelo dono do repo (`protocolo-homologacao.md` §0): projeto no
Free, sem backup automático, risco de perda de dado assumido conscientemente. Risco adicional
documentado (`etapa-6-levantamento.md`): projeto Free pausa após 1 semana de inatividade,
mitigado por construção enquanto o cron de campanhas (a cada minuto) existir. Registrado como
item de backlog **não decidido ainda** — natural pré-requisito antes de operar com tenants
pagantes reais (backup automático, sem risco de pausa por inatividade), mas sem gatilho/data.

### 6.4 S3 — CORS hardening (adiado por decisão)

**Status: pendente, com adiamento explícito e documentado** (`etapa-2-seguranca.md`), não
esquecido. Motivo do adiamento: não há domínios de produção do Kora definidos ainda —
`Access-Control-Allow-Origin: *` aceitável por ora porque JWT + verificação de membership já
guardam as funções (defense-in-depth, não a única camada). Implementação já especificada em
detalhe, pronta pra quando os domínios existirem: módulo `_shared/cors.ts` com allowlist via
`ALLOWED_ORIGINS`, ecoando `Origin` só se permitido, preservando preflight `OPTIONS`; 4
functions a repontar (`whatsapp-official-send`, `-official-credentials`, `-instance`,
`-campaign-v2-sender`); os 2 webhooks não mexem (CORS irrelevante, server-to-server).

---

## 7. Regra de manutenção

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
