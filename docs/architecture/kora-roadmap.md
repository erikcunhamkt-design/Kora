# Roadmap — Kora Hub

> Documento de controle **vivo**, permanente. Atualiza a cada fechamento de fatia/etapa
> (idealmente no mesmo commit do sign-off). Complementa, não substitui:
> [`kora-hub-auditoria-e-plano.md`](kora-hub-auditoria-e-plano.md) (catálogo técnico G/O,
> plano de etapas original) e [`kora-ux-produto.md`](kora-ux-produto.md) (catálogo UX).
> "Quantas faltam" deve ser respondível só pela tabela-resumo abaixo, sem precisar ler
> nenhum outro doc. Regra de manutenção completa no rodapé (§9).
>
> **Estado verificado em 2026-10-18 contra `origin/main` = `053f6c1`.** Esta versão **reescreve**
> a de agosto (que parava em 13/ago: "financeiro/projetos/tarefas não migrados", "Etapa 9 em
> backlog"). Todo hash citado foi conferido com `git log` neste mesmo commit; o que o repositório
> **não** consegue provar está marcado como **"a confirmar com o operador"** (ver o vocabulário abaixo).

---

## 0. Como ler o estado — 4 níveis, nunca misturados (classe G29)

| Nível | Significa | O que prova | Quem sabe |
| :-- | :-- | :-- | :-- |
| **MERGED** | o código está em `main` | `git log` / hash | o repo |
| **HOMOLOGADO** | o operador executou o runbook ao vivo e o revisor registrou o sign-off (placar + hash do commit que o registrou) | doc `docs/qa/…` + hash | o repo, **por registro** do que o operador atestou |
| **NO AR** | DDL aplicado / function deployada / app publicado | só um espelho em `supabase/migrations/` ou a confirmação do operador **fora do repo** | **só o operador** — o repo não prova deploy nem DDL |
| **CONFIRMADO AO VIVO** | um achado "corrigido em código" foi reproduzido/descartado numa execução real | linha de resultado no runbook | o operador |

**Consequência prática:** "mergeado" nunca significa "no ar" nem "homologado". Onde este doc diz
"homologação pendente com o operador", o código existe e tem testes (`tsc` 0 · lint 0 · vitest verde), mas
**nenhum caso do runbook foi executado ao vivo**. Estado de banco/deploy é **registro operacional** — na
dúvida, "a confirmar com o operador" (regra herdada do §4 item 2).

---

## 1. Tabela-resumo

| Etapa/Fatia | Estado | Critério de pronto | Última atualização (hash) |
| :-- | :-- | :-- | :-- |
| Etapas 0–4 — rede de segurança, organização, segurança, performance de banco, flags | ✅ feito | Ver `docs/qa/etapa-0…4-*.md` (pipeline verde, `docs/` centralizado, webhooks validando assinatura, índices, `src/config/flags.ts`) | *(hashes não coletados — ver cada doc)* |
| Etapa 5 — G1: domínios na nuvem | **7 de 7 domínios de negócio com a NUVEM como default (leitura e escrita)**; 5 **homologados** (CRM-escrita, Quotes, Financeiro, Projetos, Tarefas), 2 **com homologação pendente com o operador** (Clientes, Fichas pós-F4) | Tabela por domínio no §3 (hash do flip, hash do sign-off, pendências) | Fichas F4 `ccd6326` (2026-10-09) foi o último flip |
| Etapa 5 — Materiais / Biblioteca do cliente (G94 M0–M3) | 🟡 **código em `main`**; coluna `clients.library_assets` **a aplicar** (§8-b catálogo); homologação pendente | §3.8 | M1–M3 `939afa3` (2026-10-18) |
| Etapa 5 — Catálogo comercial (G94 CT1–CT5, CT7-prep) | 🟡 **código em `main`, default LOCAL de propósito**; flip = **CT7** (rodada própria, **não feita**); 4 tabelas **a aplicar** (§8-b catálogo) | §3.9 | CT5 `cdd8de7` (2026-10-18) |
| Etapa 6 — Fila, rate limit e worker | ✅ concluído no repo e no banco (G5 100% fechado; G24 reaper em produção) | Ver §4 | `6022d0f` (código) / DDL 12/ago/2026 |
| Etapa 7 — Qualidade contínua | 🟡 em curso | Lint 0/0; gates padronizados (`npm run gates`, `gates:quiet` — G88/G100, §8); cobertura/alertas não confirmados 100% | G100 `15b975e` (2026-10-18) |
| Etapa 8 — WhatsApp Oficial (Tech Provider) | ⬜ backlog — **nenhum código** | PLANEJADA, não iniciada (§5) | — |
| Etapa 9 · item 1 — provider Claude | ✅ **MERGED** (paridade estrita); deploy/secret **a confirmar com o operador** | §6 | `99822b9` (2026-08-15) |
| Etapa 9 · item 2 — cérebro do robô | ✅ **MERGED**; migration `ai_brain_profiles` indicada como aplicada **só pela mensagem do commit** `8e6260e` | §6 | `9fb3079` / `8e6260e` (2026-08-15) |
| Etapa 9 · item 3 — base de conhecimento | 🟡 **MERGED só a categoria A** ("itens já orçados"); tabela de consentimento **a aplicar**; B–E **nunca definidas** | §6 | `5aa4652` (2026-10-09) |
| Etapa 9 · item 4 — construtor de fluxo SEM IA | ✅ **MERGED R1–R11** (menu, canvas, mensagem, destinos, modo IA, validação, import/export) + handover real + atribuição automática; **nada homologado ao vivo**; **depende do §8-b do bot** | §6 | R11 `053f6c1` (2026-10-18) |
| Transversal — UX/Produto | 🟡 catalogado, sem prazo (UX2 ✅ resolvido; UX3 só ideia) | Ver §7.1 | `kora-ux-produto.md` |
| Transversal — RBAC | ⬜ backlog, não planejado | Ver §7.2 | — |
| Transversal — Supabase Pro | ⬜ backlog, não decidido | Ver §7.3 | — |
| Transversal — S3/CORS hardening | ⬜ adiado por decisão (aguarda domínios) | Ver §7.4 | `etapa-2-seguranca.md` |
| **Pendências do operador** | **11 itens, em ordem recomendada** | **§2** (tabela única, com link para cada pacote/runbook) | — |
| **O que nunca foi definido** | lista explícita | **§2.2** | — |

**Legenda:** ✅ feito · 🟡 em curso/parcial · ⬜ fila/backlog. Os níveis MERGED/HOMOLOGADO/NO AR estão no §0.

---

## 2. Pendências do operador e o que nunca foi definido

### 2.1 Tabela única — o que SÓ o operador pode destravar, na ordem recomendada

Ordem pedida pelo revisor: **§8-b do bot → Fichas Fase D → V2.1 → canvas/bot Bloco 1 → §8-b do catálogo → homologação do catálogo.**
Nenhum item foi executado segundo o repositório (não há placar/resultado nos docs); execução fora do repo é possível — por isso o estado é "a confirmar".

| # | Pendência | Documento (link) | O que é | Depende de | Destrava |
| :-- | :-- | :-- | :-- | :-- | :-- |
| 1 | **§8-b do bot** — 4 migrations + 3 deploys | [`etapa-9-bot-pacote-operador-8b.md`](../qa/etapa-9-bot-pacote-operador-8b.md) | `whatsapp_conversations.bot_flow_state`, `…handover_at`, `…assignment_origin` e `ai_knowledge_consents` (tabela+RLS), **depois** deploy de `whatsapp-instance`, `whatsapp-bot-reply`, `whatsapp-webhook`. **Migrations ANTES do deploy** (sem `bot_flow_state` + nó "menu" habilitado + bot ativo = loop de menu — SELECT §1.2 decide) | nada | itens 4 (1B/2), 7a; base de conhecimento ligável; atribuição automática com efeito |
| 2 | **Fichas — Fase D** (pós-F4) | [`etapa-5-flip-fichas-runbook.md`](../qa/etapa-5-flip-fichas-runbook.md) · [`etapa-5-flip-fichas-f4.md`](../qa/etapa-5-flip-fichas-f4.md) | Executar o runbook (Caso 0 fecha G82; Casos 4 e 6 fecham G83). EXPORT MANUAL de `client_technical_sheets`/`clients`; BUILD = hash do F4. **Código de Fichas congelado até o sign-off** | merge F4 (feito: `ccd6326`) | sign-off de Fichas; fecha G82/G83/G86 |
| 3 | **V2.1 — homologação leve** (Vendas/CRM/Clientes) | [`homologacao-leve-vendas-crm-clientes.md`](../qa/homologacao-leve-vendas-crm-clientes.md) | 28 casos (prefixo `HOMOLOG-V2-`); cobre a confirmação ao vivo de G79 (3.6), G89, G90, G91, G92, G93, G95, G96/G98, G99 (3.8). Mínimo: `22f3400` | nada de DDL | sign-off de Clientes; confirma ~10 G "corrigidos em código" |
| 4 | **Bot — Bloco 1A (canvas/validação, só UI)** → 1B (simulador) → Bloco 2 (WhatsApp real) | [`etapa-9-bot-homologacao-runbook.md`](../qa/etapa-9-bot-homologacao-runbook.md) | **1A pode rodar hoje** (sem servidor). **1B** exige só o deploy de `whatsapp-bot-reply` (item 1). **Bloco 2** exige o §8-b inteiro. Casos 2–4 (arrastar/ligar/Delete) são a **primeira prova real** desses gestos (jsdom não mede nós) | 1A: nada · 1B: deploy do item 1 · 2: item 1 | sign-off do robô (R6–R11); fecha G101/G102 (passos 22–28 do pacote) |
| 5 | **§8-b do catálogo** — 4 tabelas + índices + coluna | [`etapa-5-g94-pacote-operador-8b.md`](../qa/etapa-5-g94-pacote-operador-8b.md) | §2.1 4 tabelas+RLS → §2.2 variante admin (opcional) → §2.3 4 índices únicos `CONCURRENTLY` (1 por execução, **antes** do import — senão `42P10`) → §2.4 `clients.library_assets` → §2.5 FK `quote_items.service_id` (opcional) → import assistido §4. **Nenhuma flag muda** | nada | itens 6 e CT7; Biblioteca na nuvem (M1–M3) |
| 6 | **Catálogo/Materiais — homologação** | [`etapa-5-flip-catalogo-materiais-runbook.md`](../qa/etapa-5-flip-catalogo-materiais-runbook.md) | Casos 3–16 só **depois** do item 5; Casos 1–2 ("Schema pendente") só provam **antes** do DDL. Prefixos `HOMOLOG-MAT-`/catálogo | item 5 | CT7 (flip do default do catálogo) |
| 7 | **Confirmações ao vivo pendentes** (G "corrigidos em código") | catálogo mestre — [`kora-hub-auditoria-e-plano.md`](kora-hub-auditoria-e-plano.md) | **7a** G101/G102 (`df023a3`) → pacote do bot passos 22–28 (depende do item 1); **7b** G79 (`86bbc03`) → V2.1 caso 3.6 (item 3); **7c** G82/G83/G86 → item 2; G89–G93/G95/G99 → item 3; G96/G98 → itens 3 e 6 | itens 1–3, 6 | fechamento definitivo de cada G |
| 8 | **Decisões/vetos do operador** | [`etapa-9-handover-assigned-to-proposta.md`](etapa-9-handover-assigned-to-proposta.md) | D1/D2 da atribuição automática (vetar D1 = não aplicar a 4ª migration do item 1); rotação de credenciais depois de toda sessão de DDL (protocolo §8 item 2 / §13) | — | — |
| 9 | **Confirmar o que já foi aplicado "fora do repo"** | [`migrations-espelho-8b.md`](../qa/migrations-espelho-8b.md) | As 9 migrations de 2026-08-30 (Tarefas/Clientes/CRM CHECK/`completed_at`) constam só por confirmação do revisor; vários nomes de constraint "a confirmar com SELECT". `20260815000000_etapa9_item2_ai_brain_profiles.sql` está no repo mas nenhum doc confirma a aplicação | — | evitar re-aplicar/duplicar |
| 10 | **Draft opcional de 8-b** (Projetos) | [`kora-hub-auditoria-e-plano.md`](kora-hub-auditoria-e-plano.md) (G85) | `projects.status DEFAULT 'planning'` — opcional, **não aplicado** (`0a5d843`) | — | — |
| 11 | **Fichas — drafts opcionais** | [`etapa-5-flip-fichas-pacote.md`](../qa/etapa-5-flip-fichas-pacote.md) | coluna `competitors`, teto de `raw_payload`, gate de papel — decisão do operador, não aplicados | — | — |

### 2.2 O que NUNCA foi definido (não é "pendente de execução": falta decisão/escopo)

| Tema | Estado real | Onde está dito |
| :-- | :-- | :-- |
| **Checkout** do Catálogo Comercial | continua **local** e rotulado **"Em breve"**; usa o catálogo do navegador (ids em `kora.checkoutSettings.v1`); **CT6 não escopado** | [`etapa-5-g94-ct4-fase-b.md`](../qa/etapa-5-g94-ct4-fase-b.md) · [`etapa-5-g94-ct5-ponte.md`](../qa/etapa-5-g94-ct5-ponte.md) |
| **Catálogo público** | **não existe** página/consumidor; `showInPublicCatalog` virou o selo interno "Portfólio — não publica nada" (decisão **(a)** do G96, `cdd8de7`) | G96 no catálogo mestre; [`etapa-5-flip-catalogo-materiais-fase-a.md`](etapa-5-flip-catalogo-materiais-fase-a.md) |
| **Categorias B–E da base de conhecimento do robô** | **só a A ("itens já orçados") tem leitor**; B `internal_ops` desabilitada "com motivo"; C `crm` / D `conversations` / E `financial` exigem atesto + Fase B própria (escopo por cliente-alvo, FTS/recuperação); o servidor as ignora | [`etapa-9-item3-r1-base-conhecimento-liga.md`](../qa/etapa-9-item3-r1-base-conhecimento-liga.md) §2 e §10 |
| **O robô ler o catálogo de serviços** | hoje lê "itens já orçados", **não** o catálogo (Q8 decide `active` + `deleted_at IS NULL` quando existir); trilha da lane D, depende do §8-b do catálogo e do CT7 | G94 no catálogo mestre |
| **Aposentar o modo local** | **nenhum doc define quando/como**: o código mantém os dois caminhos (nuvem como default, local por opt-out de flag) em todos os domínios; o `diagnostico` só prevê "aposentar a flag experimental com período de carência" por entidade | [`etapa-5-diagnostico.md`](../qa/etapa-5-diagnostico.md) item 7; G3 no catálogo mestre |
| **"Bloco D"** | citado na instrução desta rodada, mas **não definido em nenhum doc do repositório** (busca em `docs/` e no histórico do git) — precisa de definição do revisor/operador antes de entrar no roadmap | — |
| **Transbordo por "lojas"/"atendentes" como fila** | sem definição de produto: hoje 1 conversa = 1 `assigned_to`; não há fila/rodízio nem entidade "loja" | Fase A do item 4 (`etapa-9-item4-construtor-sem-ia-fase-a.md`); R4 |
| **Saída do modo IA** além da palavra de retorno | achado catalogado, sem outra regra (só a palavra, o operador "devolvendo ao robô" ou desabilitar o nó ai) | [`etapa-9-bot-fluxo-r9-saida-modo-ia.md`](../qa/etapa-9-bot-fluxo-r9-saida-modo-ia.md) |
| **Etapa 8 — WhatsApp Oficial** | nenhum código; sem data | §5 |
| **Item 1 — streaming/tool-use/contagem de token do provider Claude** | escopo travado em **paridade estrita** | commit `99822b9` |

---

## 3. Etapa 5 — G1 por domínio (estado real)

> **Correção de contagem.** O briefing desta rodada falava em "8 domínios na nuvem". O código mostra **7
> domínios de negócio com a nuvem como default** (Clientes, CRM, Quotes, Fichas, Financeiro, Projetos,
> Tarefas — `src/config/flags.ts` + `useClientsDataSource.ts`); a **Biblioteca do cliente** (Materiais) herda a nuvem
> de Clientes **mas depende de uma coluna ainda não aplicada**, e o **Catálogo comercial** é **local por decisão**
> até o CT7. Os números abaixo contam isso separadamente em vez de arredondar para 8.
>
> **Como o default é lido** (opt-out: só o valor explícito `"local"`/`"false"` desliga a nuvem): CRM `flags.ts:248`,
> Quotes `:259`, Projects `:270`, Finance `:281`, Tasks `:292`, Fichas `:342` (por cliente) + `:226`/`:237`
> (experimental e autosave `!== "false"`); escrita em `useSupabase{Crm,Quotes,Projects,Finance,Tasks}WriteFlag`
> (`!== "false"`). **Catálogo é o inverso** (`flags.ts:303`: só `"supabase"` liga a nuvem; escrita `:312` `=== "true"`).

| Domínio | Nuvem como default hoje | Hash do flip | Homologação (sign-off) | Pendente / observação |
| :-- | :-- | :-- | :-- | :-- |
| **Clientes** | ✅ leitura e escrita, **sem flag** (`useClientsDataSource.ts:58`) | **sem flip**: cloud-first desde `7ab2367` (2026-06-15, dívida assumida — protocolo §10) | ⚠️ **não homologado formalmente**; só o C8 (contatos) — `6ddf702` (2026-07-21). **V2.1 casos 3.1–3.10 pendentes** | CHECKs de `status`/`temperature` aplicados em 2026-08-30 (confirmação do revisor fora do repo) |
| **CRM / oportunidades** | ✅ leitura `flags.ts:248` (nunca flipada; centralizada em `49ec0bf`) · escrita opt-out | escrita: `ef1af48` (2026-07-23, Fatia 8) | ✅ import 7/7 `ecdfd89` (2026-07-19) · ✅ Fatia 8 (escrita) **11/11** `bbf4c66` (2026-07-23). **V2.1 casos 2.1–2.10 pendentes** | G89/G91/G92/G93/G95 corrigidos em código (`12c2a61`, `e4b03e4`, `e7f6084`, `fc49d35`) — confirmação ao vivo pendente. O1 aplicada (`96a695e`) |
| **Quotes / Vendas** | ✅ leitura `:259` · escrita opt-out | `7adefad` (2026-07-30, Fase C) — merge `dae6de8` | ✅ **6/6**, ressalva no caso 2 (toast de bloqueio não recapturado) — `2ce5a22`, sign-off `b63114b` + `ed9cee1` (2026-07-30) | Wizard/projeto/recebível pós-flip: V2.1 casos 1.2–1.9 pendentes. G90/G96/G98/G99 corrigidos em código |
| **Fichas técnicas** | ✅ (por cliente; **só com workspace ativo e `supabaseClientId` resolvido**; `accesses`/senhas **nunca** vão à nuvem) | `ccd6326` (2026-10-09, **F4**); pré-requisitos `90142a4` | ⚠️ 6/6 `0e5bfaf` (2026-07-18) foi **antes** do flip (ficha ainda opt-in). **Fase D pós-F4 pendente com o operador** (runbook) | **Código congelado até o sign-off** (`a2e1134`). G82 `360b9f1`, G83/G86 `b65edb5`, G84/G87 `6b0616f` corrigidos em código — confirmação ao vivo pendente |
| **Financeiro** | ✅ leitura `:281` · escrita opt-out | `fc55c20` (2026-08-15, Fase C) | ✅ **8/8** — sign-off `4a76600` (2026-08-16); ressalvas (a) `7a5839e` e (b) `95e7f82` resolvidas; (c)=G69 resolvido no próprio `4a76600` | G41 parcial: 3 achados de decisão de produto abertos; FKs do `EditTransactionDialog` ficam para a v2 |
| **Projetos** | ✅ leitura `:270` · escrita opt-out | `b90f86a` (2026-08-13, Fase C) | ✅ **7/7** — sign-off `6abc7e9` (2026-08-15); O12 provado por SQL; 5 vermelhos fechados (G29/G30/G32/G33/G37) | G79 corrigido em código (`86bbc03`) — verificação ao vivo pendente; `projects.status DEFAULT 'planning'` opcional, não aplicado |
| **Tarefas** | ✅ leitura `:292` · escrita opt-out | `25f46ac` (2026-08-23, Fase C) | ✅ **12/12** sem vermelho, 2 ressalvas — encerramento `ea92a30` (2026-08-30) | Mapper das 4 colunas ligado (`3a5796b`, G81). Casos 7.2/7.3 viraram **cutover nativo** (`5be5c3d`, `e783912`; registrado em `49e0de5`) e **não foram re-homologados**. 5 migrations de 30/ago: só confirmação do revisor |

### 3.8 Materiais / Biblioteca do cliente
M0 `40769fd` (G97, 2026-10-17: aviso honesto + persistência local por uuid) e M1–M3 `939afa3` (2026-10-18: leitura/escrita da Biblioteca em `clients.library_assets`).
**Coluna ainda NÃO aplicada** (pacote §8-b do catálogo, §2.4): sem ela a escrita cai no armazenamento local com aviso (G97). Sem flip próprio. **Homologação pendente** (`etapa-5-flip-catalogo-materiais-runbook.md`, prefixo `HOMOLOG-MAT-`). G75/G97: mitigações interinas fechadas; definitiva = M1–M3 (em código, sem DDL aplicado). M4: não encontrado em nenhum commit.

### 3.9 Catálogo comercial (G94 CT1–CT5 + CT7-prep)
CT1 `40769fd` (mapper/repositórios/hooks de categorias e serviços) · CT2+CT3 `3c33022` (produtos, planos, import assistido local→nuvem) · CT4 `5fdda90` (leitura bifurcada + escrita nativa atrás de flags) · CT5 `cdd8de7` (ponte catálogo↔orçamento por `serviceId`, "Mais usado em orçamentos") · CT7-prep `f5d0187` (runbook executável).
**Default LOCAL de leitura e escrita OFF, de propósito**: o flip é o **CT7**, rodada própria, **não feita**. As 4 tabelas **não foram aplicadas** (nenhuma migration do catálogo em `supabase/migrations/`); o código degrada com "Schema pendente". **G94 continua ABERTO** no catálogo mestre. G96/G98 corrigidos em código (`22f3400`, `cdd8de7`) — confirmação ao vivo pendente. Checkout e catálogo público: ver §2.2.

---

## 4. Etapa 6 — Fila, rate limit e worker (✅ concluída — histórico preservado)

1. **Job `pg_cron` de limpeza de `ai_rate_limit_counters` — ✅ FEITO** (sessão §8-b de 2026-08-03: `jobid 2`, `0 * * * *`, retenção 24h; `etapa-6-g5-rate-limit.md` §13; hash `8e7c2f1`).
2. **Deploy da `whatsapp-bot-reply` com G5 Parte 2 — ✅ FEITO** (02/ago/2026, pelo operador; RPC de rate limit e retry/backoff ativos em produção). **Lição registrada:** estado de deploy de Edge Function **não é inferível do repo**; na dúvida, o doc registra "a confirmar com o operador", nunca pendente/feito por inferência. *(Esta mesma regra define o §0.)*
3. **Rate limit e retry só cobrem `whatsapp-bot-reply`** (a única function que chama IA paga hoje). "e-mail" citado no G5 original é aspiracional.
4. **G4 (fila de campanhas): investigado e decidido** (Fase A `71c4a75`, Fase B `208ff9c`): v2 continua manual-only + **reaper** (G24, `20260811000200`, aplicada em 12/ago: `jobid 3`, `*/15 * * * *`, grants só `service_role`+dono, zero incidentes). Unificação v1→v2 (opção b) é fatia futura. **Atenção:** o cron do legado é o heartbeat que mitiga a pausa do projeto Free (§7.3) — não desagendar sem decidir isso à parte. G25 (`WhatsAppCampaigns.tsx` órfão) **RESOLVIDO** (`ux2-g21-g23-g25-fase-a`, opção a, só o componente).

**Etapa 6 — ✅ concluída no repo e no banco.** Único acompanhamento não bloqueante: confirmar em `cron.job_run_details` que o `jobid 3` rodou sozinho pela 1ª vez.

---

## 5. Etapa 8 — WhatsApp Oficial: Tech Provider + Embedded Signup (resumo)

**Status: PLANEJADA, não iniciada, sem nenhum código.** O G1 deixou de ser a dependência (7 domínios na nuvem), mas não há data nem fatia aberta.

**Modelo:** Kora como Tech Provider da Meta — cada tenant conecta a própria WABA via Embedded Signup; Kora lista os templates aprovados do tenant e opera atendimento (janela 24h) + disparo proativo (só template aprovado). Compliance fica com o tenant.

**Pré-requisitos (lado IndhecX):** verificação de negócio no Meta Business Manager · Meta App Business com produto WhatsApp · App Review (`whatsapp_business_messaging` + `whatsapp_business_management`) · Embedded Signup (OAuth) no Kora. **Por tenant:** Embedded Signup, verificação de negócio, número dedicado, templates aprovados na WABA do tenant (`GET /{waba-id}/message_templates?status=APPROVED`).

**Impacto técnico:** multi-tenant `waba_id`/`phone_number_id`/`token` por workspace (tokens criptografados) · cache/sync de templates · webhooks (`HMAC-SHA256`, Etapa 2) · o módulo WhatsApp atual é a base. Detalhe: [`kora-hub-auditoria-e-plano.md` §Etapa 8](kora-hub-auditoria-e-plano.md).

---

## 6. Etapa 9 — Robô IA (estado real, 4 itens)

> **Reescrito.** A versão de agosto dizia "registrada, não iniciada". Os 4 itens têm código em `main`. O que **falta** é o §8-b
> (pendência 1 do §2.1) e a homologação ao vivo (pendência 4): **nada da Etapa 9 de fluxo/handover/conhecimento está registrado
> como homologado ou como "no ar"**.

| Item | Em `main` (MERGED) | NO AR / homologado |
| :-- | :-- | :-- |
| **1 — provider Claude** | `5885193` (mapa do parser, 13/ago) → `99822b9` (15/ago): ramo `anthropic` em `whatsapp-bot-reply`, `anthropicParser.ts`, retry em 529, dropdown Claude/Haiku 4.5. **Paridade estrita** (sem streaming, tool-use ou contagem de token) | deploy da function + secret `ANTHROPIC_API_KEY` + teste com chave real eram **gate do operador pós-merge** — **a confirmar com o operador** (sem doc de confirmação) |
| **2 — cérebro** | Fase A `341fad1`; Fase B `9fb3079` (tabela `ai_brain_profiles`, `brainComposer.ts`, `AiBrainSection`, flag `kora.ai.brain.enabled`; migration `20260815000000_…` no repo); types `8e6260e` | só a **mensagem do commit `8e6260e`** diz "migrations aplicadas pelo operador" — a confirmar |
| **3 — base de conhecimento** | Fase A `26fb2e5` (LGPD/escopo/custo); fundação `893ddc7` (consentimento + slot rotulado); **R1 "categoria A" `5aa4652`** (itens já orçados: `quote_items` agregado, k ≥ 2, teto 2.500 tokens, selo no simulador, `AiKnowledgeSection`) | tabela `ai_knowledge_consents` **não aplicada** + deploy de `whatsapp-bot-reply` pendentes (pacote §8-b). **B–E nunca definidas** (§2.2) |
| **4 — construtor de fluxo SEM IA** | Fase A `f615bb6`. R1 `399fc20` (tipo menu) · R2 `e091328` · R3 `f48c83d` (motor) · R4 `530423b` (**handover real, fecha G48**) + UI `a7e2e3e` + webhook `6ec103d` · R5 `f8358a3` (UI do menu) · **R6 canvas** `423a0d2` (+ acabamento; G80 `f513718`/`ba6518c`) · **R7** `cd5daa5` (nó de mensagem) · **R8** `0448442` + ajuste `3f2aaab` (destinos handover/ai, **modo IA persistido** em `bot_flow_state`) · **R9** `8e06894` (palavra de retorno) · **R10** `eea06d4` (`validateFlow`, painel de problemas, fluxo de exemplo) · **R11** `053f6c1` (exportar/importar JSON + runbook). Simulador: `2b2ab6f` (servidor opt-in `simState`), `b4d3cdb`, `818a2c3` (UI). **Atribuição automática (G48 D1):** `c393d02` (`sender_id` nas saídas humanas), `b40bb5a` (atribui no handover, `assignment_origin`, badge "Aguardando humano"); **G101/G102** `df023a3` (controle de atribuição + assumir ao responder) | **Nada homologado ao vivo.** Depende de 4 migrations + 3 deploys (pendência 1); G101/G102 "corrigidos em código — confirmação ao vivo pendente". O wiring `Deno.serve` de `whatsapp-bot-reply` não tem teste direto (só os módulos puros) |

**Sem a migration o robô degrada, não quebra** (pacote §6): sem `handover_at` volta ao comportamento pré-R4; sem `ai_knowledge_consents` não há bloco de conhecimento; sem `assignment_origin` toda atribuição é "origem desconhecida = humana". **O único cenário ruim** é nó "menu" habilitado + bot ativo **sem** `bot_flow_state` (loop de menu).

**Limites conhecidos do item 4 (achados, não bugs):** exportar/importar **adiciona** (não restaura os 4 nós fixos); sem saída do modo IA além da palavra de retorno/devolução/desabilitar o nó; palavra de retorno que colide com palavra-chave de handover **vence** (aviso na validação); `sem-caminho-humano-ia` quase nunca dispara (esgotar tentativas já entrega a humano — R4).

---

## 7. Transversais

### 7.1 UX/Produto

**Princípio central (UX1):** contexto pré-preenchido evita a classe de erro que formulário de campo livre não evita (`CreateCrmSupabaseQuoteDialog` vs. `NewQuoteWizard`). Catalogado, sem prazo.

**UX2 — ✅ RESOLVIDO** (`e5d34ac`, rodada `ux2-g21-g23-g25-fase-a`, opção (a)): o gate de conexão desce por aba e a aba "Robô IA" fica sempre acessível. **G21** (`BotRulesPanel.tsx` órfão) **RESOLVIDO** — componente removido; **UX3** guarda a ideia de "modos de atendimento" (sem protótipo). **G23** (avisos "híbrido" falsos na aba Dados) **RESOLVIDO** na mesma rodada.

**O8 (técnico):** "Mover para etapa" no menu do lead do CRM — **em aberto no catálogo** (causa provável por leitura: retorno silencioso em `handleMoveToStage` sem `supabaseId`; não confirmada ao vivo).

### 7.2 RBAC — pós-G1, pré-requisito de multi-usuário
**Não planejado em nenhum doc.** Só existe `workspace_members.role` (`owner`/`admin`/`member`/`viewer`), usado em RLS multi-tenant ("é membro ou não"). Existem **gates de admin pontuais** na UI (`isAdmin` em "Salvar Fluxo" do bot — G71, cards de conexão do WhatsApp/Vertex, base de conhecimento, painel de contato do WhatsApp), mas **nenhuma política de papéis** definida. Backlog sem fatia, sem estimativa.

### 7.3 Supabase Pro — antes de tenant real
**Nenhuma decisão registrada** de sair do Free. Risco aceito pelo dono do repo (`protocolo-homologacao.md` §0): sem backup automático. Risco adicional (`etapa-6-levantamento.md`): pausa após 1 semana de inatividade, mitigada enquanto o cron de campanhas (a cada minuto) existir. Backlog **não decidido**.

### 7.4 S3 — CORS hardening (adiado por decisão)
**Pendente com adiamento explícito** (`etapa-2-seguranca.md`): sem domínios de produção definidos, `Access-Control-Allow-Origin: *` é aceitável (JWT + membership guardam as functions). Implementação já especificada: `_shared/cors.ts` com allowlist `ALLOWED_ORIGINS`; 4 functions a repontar; os 2 webhooks não mudam.

---

## 8. Processo — as regras que governam como cada item acima é feito

| Regra | Em uma linha | Onde vive |
| :-- | :-- | :-- |
| **§14-A / G65** | `git stash` **proibido** em prova fail→fix→pass (`refs/stash` é compartilhado entre worktrees): `git diff > .patch` → `git checkout --` → teste (falha) → `git apply` → teste (passa) | `protocolo-homologacao.md` §14-A |
| **§14-B** | a raiz `orbit-designer-hub` é exclusiva de merges ff com árvore limpa; código nasce na worktree da lane | §14-B |
| **§16 / §17 / §20** | isolamento de worktree por lane; prova código↔servidor por `[Kora] BUILD <hash> (<branch>)`; a porta nunca identifica o código servido | §16, §17, §20 |
| **§18** | merge em `main` só com push da branch + relatório + "vai" literal e específico | §18 |
| **§19 / G9** | gate = `npm run gates` (`tsc -p tsconfig.app.json --noEmit && lint && vitest`), saída literal no relatório | §19 |
| **G88** | o gate decide o push: `npm install` após todo fetch/rebase; cadeia `&&` até o `push`; **ler o exit do `git push` direto**, nunca atrás de `\| tail`; se `main` andou, rebase + regates (dispensa só se doc-only); só dizer "entrou" depois de ver `origin/main` no tip | catálogo mestre (G88) |
| **G100 / O13** | flakiness da suíte sob carga: `maxWorkers` ≈ 40% dos núcleos; `npm run gates:quiet` (`--wait`/`--force`) recusa se há outro vitest; **gate vermelho por timeout com outro vitest ativo não vale** | catálogo mestre (G100), §19 item 4 |
| **§8 / §8-b / §0** | Code não aplica DDL/DML em produção; operador aplica no próprio terminal e o Code valida os outputs | §0, §8, §8-b |
| **§1 / §2 / §11** | EXPORT MANUAL antes de gravar; PRINT PRÉ-CLIQUE; dado real é só-leitura em homologação | §1, §2, §11 |
| **Classe G29 / G37 / G63 / G92** | copy falsa pós-flip · payload completo nos 2 sentidos · segredo duplicado sem sanitização · consumidor não bifurcado — padrões recorrentes de varredura | catálogo mestre |

---

## 9. Regra de manutenção

1. **Este doc atualiza no fechamento de cada fatia/etapa** — idealmente no mesmo commit do sign-off, nunca numa rodada separada "pra depois". Se não der no mesmo commit, o próximo commit que tocar a fatia inclui a atualização. **Esta versão existe porque essa regra não foi cumprida entre 13/ago e 18/out.**
2. **Estado sempre acompanhado de hash — e do NÍVEL (§0).** "Mergeado", "homologado", "no ar" e "confirmado ao vivo" são afirmações diferentes; um hash de merge nunca prova as outras três. Quando um fechamento não tiver hash rastreável, isso é lacuna a preencher, não motivo para omitir o resto.
3. **"Quantas faltam" deve ser respondível só pela tabela-resumo (§1)** + a tabela de pendências do operador (§2.1).
4. **Toda vez que uma fatia flipar um default**, a linha do domínio em §3 muda, com o hash do flip **e** o estado da homologação — "pronto" é leitura E escrita default Supabase, reversível, **homologado**.
5. **Achados de resgate/auditoria** entram no catálogo mestre (`kora-hub-auditoria-e-plano.md`); se mudarem o estado de um domínio, este doc também atualiza.
6. **Toda pendência do operador nova** (pacote §8-b, runbook, decisão) entra no §2.1 com link e dependência; **toda decisão que nunca foi tomada** entra no §2.2 em vez de ficar implícita.
7. **Estado de banco/deploy nunca é inferido do repo** — só espelho em `supabase/migrations/` ou confirmação registrada do operador.
