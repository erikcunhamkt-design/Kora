# Etapa 6 · G5 — Rate limit / quota nas Edge Functions de IA — Fase A (levantamento)

> **Escopo desta rodada:** só levantamento + este documento. Zero código, zero migration.
> Base: `main` @ `baf7b87`, branch de trabalho `etapa-6-g5-rate-limit`.

---

## 1. O que o G5 promete

Do catálogo mestre (`kora-hub-auditoria-e-plano.md`):

> **G5 — Ausência de rate limiting / throttling nas Edge Functions. [ALTO]** O próprio
> roadmap lista "ausência de throttling" como risco. Endpoints de IA (Gemini/Vertex) e
> e-mail (Resend) sem limitação permitem abuso e **explosão de custo**. Precisa de quota
> por workspace + rate limit por função.

E da Etapa 6: "Rate limit + quota por workspace nas funções de IA e e-mail; tabela de
contadores/janela (G5)."

**Correção de escopo confirmada por grep no repo inteiro:** não existe **nenhuma** integração
de e-mail hoje (nem Resend, nem SMTP, nem qualquer `sendEmail`) — busquei em
`supabase/functions/` e `src/` inteiros, zero ocorrência. A menção a "e-mail" no plano é
aspiracional/futura, não um vetor existente. **A única Edge Function que chama uma API de IA
paga hoje é `whatsapp-bot-reply`** (confirmado por grep em todas as functions por
`generativelanguage`/`aiplatform.googleapis`/`ai.gateway.lovable`/chaves de IA — só um
resultado). G5, na prática atual do repo, é sobre **uma função só**.

---

## 2. Estado atual — vetores de abuso, custo, proteção existente

### 2.1 Dois caminhos de invocação, riscos muito diferentes

**(a) Disparo pelo webhook (`whatsapp-webhook/index.ts:605-629`)** — toda mensagem inbound
que não é reação, se o bot do workspace estiver `is_active`, dispara um `fetch` server-to-server
pra `whatsapp-bot-reply` com `Authorization: Bearer ${SERVICE_ROLE}`. **Zero throttle**: não
existe cooldown por conversa nem por workspace — um número conectado que receba mensagens
repetidas (de um usuário real irritado, de um bot externo, ou de alguém explorando o número)
gera uma chamada de IA por mensagem, sem limite.

**(b) Modo `isTest` — achado crítico não catalogado antes:** `whatsapp-bot-reply` não tem
override de `verify_jwt` em `supabase/config.toml` (só `whatsapp-official-webhook` tem) →
usa o default `verify_jwt = true`. Mas **esse gate só exige um JWT válido do projeto — a
`anon key` (pública por design, commitada em `src/integrations/supabase/client.ts`, embutida
no bundle do frontend) satisfaz isso.** Em `isTest`, a function **não checa workspace, não
checa conversa, não checa membership nenhuma** — só lê o body. **Eu mesmo comprovei isso na
prática** durante a homologação do G8 (`etapa-6-g8-flownodes.md` §8): chamei a function
deployada via `curl` só com a anon key + `isTest: true`, sem login nenhum, sem `workspaceId`,
e recebi de volta uma resposta real gerada por IA.

- **Por que isso é grave:** `isTest` sem `body.provider` cai no default `"lovable"`
  (`index.ts:255`, `body.provider || "lovable"`), que usa a **`LOVABLE_API_KEY` do próprio
  Kora** (`Deno.env.get("LOVABLE_API_KEY")`, `index.ts:462`) — não é credencial do workspace,
  é credencial da plataforma. **Qualquer um com a anon key pública consegue gerar chamadas de
  IA ilimitadas, pagas pelo Kora, sem nenhuma atribuição a workspace/usuário/IP.** Não existe
  hoje nenhum dado no payload de `isTest` que amarre a chamada a uma identidade cobrável ou
  limitável.
- Pros providers `gemini_api_key`/`vertex_ai` em `isTest`, quem paga é o dono da credencial que
  o próprio chamador colou no body (`body.geminiApiKey`/`body.gcpServiceAccount`) — menos grave
  pro caixa do Kora diretamente, mas ainda é um proxy de IA gratuito e anônimo pra quem tiver
  uma chave de terceiro (roubada ou não) pra testar.

### 2.2 Quem paga a conta na configuração normal (não-`isTest`)

Existe `workspace_ai_credentials` (migration `20260603032010`, RLS habilitada) — workspaces
podem configurar credencial própria (`gemini_api_key`/`vertex_ai` via `whatsapp_bot_settings`).
Mas o **default** do construtor visual (`WhatsAppBotConfig.tsx:83`, nó AI recém-criado) já
nasce com `provider: "lovable"` — ou seja, **todo bot novo, até o operador trocar
manualmente, roda no crédito do Kora.** A exposição de custo do G5 não é hipotética nem
marginal — é o caminho padrão.

### 2.3 Proteção existente hoje

**Nenhuma.** Confirmado por leitura integral de `whatsapp-bot-reply/index.ts`: zero contador,
zero janela, zero checagem de limite em qualquer lugar do arquivo. `whatsapp-webhook` também
não tem cooldown antes de disparar o bot. O único "limite" indireto é o rate limit da própria
uazapi para *envio* (não se aplica aqui — este é o lado de *geração* da resposta por IA, antes
do envio).

---

## 3. Opções de implementação sem infra nova

**`pg_cron`/`pg_net` (já confirmados ativos, Etapa 6 §6 do levantamento anterior) não servem
pra isso.** Cron é pra jobs agendados/batch (é o que resolve G4 — pacing de campanha). G5
precisa de uma checagem **síncrona, dentro do request**, no exato momento em que a function
decide se chama a IA ou não — cron não participa desse caminho.

**Descartado: contador em memória do processo.** Edge Functions no Deno Deploy/Supabase são
isoladas por invocação (podem ser cold-started a qualquer momento, não há memória
compartilhada confiável entre invocações nem entre regiões). Um contador em variável de módulo
funcionaria só "às vezes", dando falsa sensação de proteção — pior que não ter nada, porque
esconde o problema.

**Recomendado: tabela de contador + RPC `SECURITY DEFINER` com claim atômico.** Mesmo padrão
já validado no repo pelo G4 (`claim_campaign_messages`/`reap_stuck_campaign_messages`,
migration `20260701220000_batch3_campaign_robustness.sql`): um `UPDATE ... WHERE ...
RETURNING` atômico decide quem "ganha" a chamada, sem race condition, sem lock explícito. Não
é "infra nova" no sentido de extensão/serviço novo — é só schema (uma tabela pequena + uma
função SQL), a mesma categoria de mudança que toda fatia da Etapa 5 já faz rotineiramente.

**Alternativa considerada: rate limit de plataforma do próprio Supabase.** Existe, mas é por
**projeto inteiro**, não por workspace/função — não substitui uma quota de negócio, só é uma
rede de segurança adicional (não fazer nada com base nisso; não pesquisei o número exato do
teto porque não muda a proposta abaixo).

---

## 4. Proposta de escopo mínimo viável

### 4.1 Fechar o buraco de atribuição do `isTest` primeiro (pré-requisito, quase de graça)

Antes de rate-limitar `isTest`, ele precisa de **algo** pra usar como chave. Hoje não tem
nada. Proposta mínima: exigir `workspaceId` também em `isTest` (o simulador já recebe
`workspaceId` como prop em `WhatsAppBotConfig.tsx:58` — é só incluir no payload do invoke,
mudança trivial, mesma classe da que já fizemos pro `flowData` no G8). **Isso não é uma
autenticação de verdade** — nada impede um chamador de inventar um `workspaceId` qualquer pra
burlar o contador por-workspace (efeito Sybil). Registro essa fraqueza explicitamente: é
melhor que nada (limita o dano por workspace-alegado), mas não fecha o buraco de fundo, que é
`isTest` aceitar `provider: "lovable"` sem checar se quem está chamando tem qualquer relação
real com aquele workspace. Fechar isso de verdade exigiria validar membership real mesmo em
`isTest` — decisão de produto pra Fase B/C, não decido aqui.

### 4.2 Tabela + RPC

`ai_rate_limit_counters(workspace_id uuid, bucket text, window_start timestamptz, count int)`
— `bucket` distingue o caminho (`"webhook"` vs `"isTest"`) porque os riscos e limites são
diferentes. RPC `check_and_increment_ai_rate_limit(p_workspace_id, p_bucket, p_max, p_window_s)
RETURNS boolean`, `SECURITY DEFINER`, `search_path=public`, grant só pra `service_role` — upsert
atômico na janela corrente, incrementa e retorna se ainda está dentro do limite (mesmo desenho
de `claim_campaign_messages`).

### 4.3 Limites propostos (números iniciais, não vinculantes — ajustar com o operador)

| Bucket | Limite proposto | Por quê |
| :-- | :-- | :-- |
| `webhook` (mensagem real) | 20 respostas de IA / workspace / minuto | Generoso pra uso humano legítimo (ninguém manda 20 mensagens/min pra um bot de atendimento na prática), baixo o suficiente pra capar um spam de mensagens |
| `isTest` | 10 chamadas / workspace-alegado / minuto | É só preview no construtor de fluxo — nenhum uso legítimo precisa de volume alto; mais apertado porque a atribuição é fraca (§4.1) |
| `isTest` + `provider=lovable` especificamente | considerar teto diário adicional por workspace (ex.: 100/dia) | É o único sub-caso que sai do bolso do Kora diretamente — merece um teto agregado, não só por minuto |

### 4.4 Comportamento ao estourar

- **`webhook`:** responder `200 { ok: true, skipped: "rate_limited" }` — mesmo padrão já
  usado pros outros `skipped` do arquivo (`"no bot settings found"`, `"bot inactive"`, etc.).
  Nunca `4xx`/`5xx` pro caminho disparado pelo webhook — evita retry storm do lado de quem
  chama (a Meta/uazapi podem reenviar em erro).
- **`isTest`:** responder `429` explícito — aqui quem chama é o simulador (humano no
  construtor), faz sentido mostrar o erro de verdade em vez de esconder.

### 4.5 Fora de escopo desta fatia

- E-mail — não existe integração nenhuma ainda (§1); nada a limitar.
- Outras Edge Functions de IA — não existem (só `whatsapp-bot-reply` chama IA hoje).
- Quota diária/mensal agregada — começar só com janela curta (minuto), quota diária fica pra
  quando/se o teto por minuto sozinho se mostrar insuficiente.
- Fechar o buraco de atribuição do `isTest` de verdade (validar membership real) — registrado
  como fraqueza conhecida em §4.1, decisão de produto em aberto, não bloqueia o mínimo viável
  (contador por-workspace-alegado já reduz o dano de "ilimitado" pra "limitado por identidade
  forjável", que é uma melhoria real mesmo não sendo perfeita).
- Tabela/RPC de contador (§3, `ai_rate_limit_counters` + `check_and_increment_ai_rate_limit`)
  não entrou nesta rodada (Parte 1) — só o fix de atribuição (`workspaceId` obrigatório) e a
  migração de provedor. A rodada seguinte (Parte 2) implementa o contador de verdade.

---

## 5. Parte 1 (implementada) — fix de atribuição + migração de provedor

**Confirmado pelo operador (hipótese 1):** o projeto nasceu no Lovable; a `LOVABLE_API_KEY` é
herança do scaffolding, não uma decisão de stack. Catalogado como
[`G18`](../architecture/kora-hub-auditoria-e-plano.md) no plano mestre.

### 5.1 Fix de atribuição do `isTest` (fecha o gap do §4.1 crítico)

`index.ts`: `workspaceId` agora é obrigatório nos dois modos (antes só era exigido fora de
`isTest`). `conversationId` continua exigido só fora de `isTest`. `WhatsAppBotConfig.tsx`: o
simulador passa a mandar `workspaceId` no payload do invoke (já disponível como prop do
componente, não precisou buscar de lugar nenhum).

**5.1-b (correção, mesma rodada) — só exigir `workspaceId` não autentica.** Revisão apontou
corretamente que `workspaceId` continuava sendo parâmetro de input, adivinhável/vazável, não
credencial — o G18 seguia explorável por anônimo com a anon key pública + um `workspaceId`
qualquer. Fix completo aplicado:

- **Autenticação real:** `isTest` agora exige `Authorization: Bearer <JWT>`. O JWT é validado
  criando um client Supabase com a `anon key` **mas com o header `Authorization` do chamador**
  (`global: { headers: { Authorization: auth } }`) e chamando `.auth.getUser()` — mesmo padrão
  já usado e em produção em `whatsapp-campaign-v2-sender/index.ts` (precedente direto no repo,
  não inventado agora).
- **Membership real:** com o `user.id` do JWT, query em `workspace_members` **através desse
  client autenticado** (não do admin) — filtrando por `workspace_id` **e** `user_id` (o
  precedente do v2-sender filtra só por `workspace_id`, o que pode estourar `.maybeSingle()`
  se o workspace tiver mais de um membro; adicionei o filtro por `user_id` pra ficar
  inequivocamente "é este usuário membro deste workspace", sempre no máximo 1 linha dado o
  `UNIQUE (workspace_id, user_id)` da tabela). RLS de `workspace_members` (`"Users can view
  members of their workspaces"`) garante que a query só pode "ver" linhas de workspaces onde
  o usuário já é membro — a ausência de linha vira `403` de forma confiável.
- **Decisão extraída pra módulo puro e testado:** `supabase/functions/_shared/isTestAuth.ts`
  (`authorizeIsTestCaller`) recebe os 3 resultados já resolvidos (header, user, isMember) e
  decide `401 missing_auth` / `401 unauthorized` / `403 forbidden` / ok — mesmo padrão do G8
  (extrair só a lógica pura, sem `Deno.*`/`npm:`, testável via Vitest). As chamadas de rede em
  si (`getUser()`, a query de membership) continuam inline, inevitavelmente não cobertas por
  unit test — ver §5.3 pra como isso é verificado de verdade (homologação pós-deploy).
- **Webhook não regride — por construção, com citação exata:** o bloco de auth inteiro é
  `index.ts:248-273` (`if (isTest) { ... }`, abre em 248, fecha em 273 — contagem de chaves
  confirmada por leitura direta, não estimada). O caminho do webhook nunca entra ali, por
  **duas** razões independentes, não uma só: (1) `whatsapp-webhook/index.ts:614-622` monta o
  `fetch` pra `whatsapp-bot-reply` com `body: JSON.stringify({ conversationId, workspaceId })`
  — **sem** o campo `isTest` — então `Boolean(body.isTest)` resolve pra `false` já na origem,
  antes de qualquer coisa; (2) mesmo hipoteticamente, esse `fetch` usa
  `Authorization: Bearer ${SERVICE_ROLE}` (`whatsapp-webhook/index.ts:619`), nunca a sessão de
  um usuário — o bloco `if (isTest)` simplesmente não seria alcançado de qualquer forma dado
  (1). Mesmo raciocínio "por construção" já usado no G8 pro `isTest`/zero-side-effect (early
  return + aninhamento de bloco, não um `if` que dependa de nada externo pra segurar). Confirmação
  **empírica** (não só estrutural) fica pra homologação pós-deploy — ver §5.3, item novo.

**Teste de regressão** (`_shared/__tests__/isTestAuth.test.ts`, 5 casos): sem header → 401;
header não-Bearer → 401; Bearer mas sem user (JWT inválido/anon key) → 401; autenticado mas
não-membro → 403; autenticado e membro → ok. Cobre a matriz de decisão completa — não cobre
(não tem como, sem function deployada) as chamadas de rede reais.

### 5.2 Migração de provedor default: `lovable` → `gemini_api_key`

4 ocorrências de fallback trocadas em `index.ts` (variável inicial `let provider =`, default do
`isTest`, default de `aiNode.properties?.provider`, default de `bot.provider`) + o default do
nó "Agente IA" novo em `WhatsAppBotConfig.tsx`. **Nenhuma troca de endpoint nem de parser foi
necessária** — o caminho `gemini_api_key` (Google AI Studio direto,
`generativelanguage.googleapis.com`) já existe no código desde antes, já usa o parser correto
(mesmo formato `candidates[].content.parts[].text` do `vertex_ai`), só nunca tinha sido o
default. O branch de código do provedor `lovable` **não foi removido** — continua funcional
pra quem já estiver explicitamente configurado nele (ver §5.4).

**Secret necessário:** `GEMINI_API_KEY` — nome que o código **já esperava**
(`Deno.env.get("GEMINI_API_KEY")`, fallback morto até agora por falta do secret). Operador cria
no painel (Supabase → Edge Functions → Secrets), único touchpoint de credencial desta rodada.

### 5.3 Sequência de homologação do deploy (nota para a janela de deploy)

Este deploy cobre **dois** fixes ao mesmo tempo (atribuição + provedor) — o caso positivo do
simulador pós-deploy precisa validar **os dois**, não só um:
1. Simulador autenticado (não o `curl` anônimo usado no G8 — esse exato buraco é o que a Parte 1
   fecha) roda uma mensagem de teste.
2. **Confirma que a resposta veio do Gemini direto**, não do gateway Lovable — checar o log da
   function no Dashboard (deve aparecer `[bot-reply] Using Gemini AI Studio mode`, não `Using
   Lovable AI Gateway`) ou, mais simples, confirmar que a resposta chega normalmente **sem**
   `LOVABLE_API_KEY` estar sequer configurada (se o operador ainda não criou `GEMINI_API_KEY`
   também, o teste vai falhar com erro de "provedor inválido" — sinal claro de que a migração
   de secret ainda não aconteceu, não um bug de código).
3. Chamar sem `workspaceId` deve devolver `400 missing params` (confirma o fix de atribuição
   de input).
4. **Novo, pós-correção 5.1-b — os 3 casos de autenticação, com a function real:**
   - `curl` com **só a anon key** (repetindo exatamente o teste do G8) → agora deve devolver
     `401 missing_auth` ou `401 unauthorized` (a anon key sozinha não é sessão de usuário —
     `auth.getUser()` não resolve `user` pra ela). **Este é o teste que prova que o buraco do
     G18 fechou de verdade** — se esse `curl` ainda devolver uma resposta de IA, o fix não
     está no ar.
   - JWT de um usuário real autenticado, mas com um `workspaceId` de um workspace do qual ele
     **não** é membro → `403 forbidden`.
   - JWT de um usuário real + `workspaceId` do próprio workspace dele (o fluxo normal do
     simulador logado) → `200`, resposta normal.
5. **Confirma que o webhook não regrediu:** manda uma mensagem real pro WhatsApp de um
   workspace com bot ativo, confirma que a resposta chega normal (o caminho `isTest=false`
   nunca deveria ter sido afetado — item 5 desta rodada, verificação empírica do que já é
   garantido por construção em 5.1-b).

### 5.4 O que não mudou (fora do escopo desta Parte 1)

- Bots com `provider: "lovable"` **já salvo explicitamente** em `flow_data`/`bot.provider`
  continuam usando Lovable — mudar o default do código não retroage sobre configuração já
  gravada. Nenhuma migração de dado foi feita.
- A coluna `whatsapp_bot_settings.provider` no banco ainda tem `DEFAULT 'lovable'` a nível de
  schema (ver §6, achado da mini-auditoria) — não afeta a aplicação hoje porque o frontend
  sempre manda o valor explícito, mas é uma inconsistência latente entre código e schema.
- `LOVABLE_API_KEY` **não foi removida** do painel — só depois da homologação confirmar que
  tudo funciona no Gemini direto (§5.3), por segurança (rollback fácil enquanto os dois
  secrets coexistem).

---

## 6. Mini-auditoria de resíduos Lovable (só listagem, nada corrigido nesta fatia)

Grep case-insensitive por "lovable" no repo inteiro (excluindo `node_modules`/`.git`/`dist`):

| Arquivo | O que tem | Avaliação |
| :-- | :-- | :-- |
| `supabase/functions/whatsapp-bot-reply/index.ts` | Branch de código do provedor `lovable` (chamada ao gateway) | Mantido, não é mais o default (§5.2) — funcional pra config explícita |
| `src/components/whatsapp/WhatsAppBotConfig.tsx` | Opção "Créditos KORA" no seletor de provedor (rótulo do `lovable`) | Mantido — usuário ainda pode escolher explicitamente |
| `supabase/migrations/20260603000000_add_bot_api_keys.sql:2` | `ALTER TABLE ... ADD COLUMN provider TEXT DEFAULT 'lovable'` | **Achado real, não é só texto morto** — o default a nível de banco continua `'lovable'`, latente (app nunca deixa a coluna cair no default hoje, mas é uma inconsistência schema↔código) |
| `.env.example` | `LOVABLE_API_KEY SEGREDO` na lista de secrets de backend + menção "client.ts gerado pelo Lovable" | Documentação factualmente correta enquanto o secret ainda existir — atualizar quando `LOVABLE_API_KEY` for removida (§5.4) |
| `bun.lock` / `bun.lockb` | Lockfile inteiro resolve pacotes via registry privado `*.pkg.dev/lovable-core-prod/...` | **Confirmado morto/não usado** — `package-lock.json` existe e `.github/workflows/ci.yml` roda `npm ci`, não `bun install`. Resíduo do scaffold original, sem risco vivo, candidato a deleção numa limpeza futura (fora desta fatia) |
| `docs/qa/etapa-0-rede-de-seguranca.md`, `docs/architecture/etapa-6-levantamento.md`, `docs/architecture/kora-hub-auditoria-e-plano.md` | Menções informativas (nome de secret, snapshot de arquitetura) | Registro histórico correto, sem ação necessária |
| `docs/integrations/SUPABASE-WHATSAPP-INBOX-V1.md:91` | **"A Edge Function `whatsapp-bot-reply` foi atualizada... desativando completamente o gateway da Lovable."** | **Discrepância encontrada:** essa afirmação não batia com o código antes desta Parte 1 — `lovable` continuava sendo o *default* em 4 lugares + na coluna do banco. O doc provavelmente descreve a *adição* das opções Vertex/Gemini como se fosse a *desativação* do Lovable — não corrigido aqui (fora do escopo, doc de integração de outra fatia), só registrado como discrepância pro dono daquele doc avaliar |

---

## 7. Backlog registrado para a próxima janela de DDL (Parte 2) — não executar ainda

Dois itens que aproveitam a mesma sessão de DDL do contador de rate limit (§3), registrados
aqui pra não se perder, **nenhum dos dois executado nesta rodada**:

1. **Migration de 1 linha:** `ALTER TABLE public.whatsapp_bot_settings ALTER COLUMN provider
   SET DEFAULT 'gemini_api_key';` — corrige o achado da §6 (schema ainda default `'lovable'`).
   Trivial, aditiva, mesma categoria de risco de qualquer migration de coluna já feita nesta
   Etapa — entra na mesma janela §8-b da Parte 2 (rate limit), não precisa de janela própria.
2. **Corrigir `docs/integrations/SUPABASE-WHATSAPP-INBOX-V1.md:91`** (a afirmação "gateway
   desativado") — **no mesmo commit em que isso se tornar verdade de fato**, ou seja, quando
   `LOVABLE_API_KEY` for efetivamente removida do painel (§5.4) — não antes, pra doc e código
   nunca ficarem dessincronizados de novo (a causa raiz da discrepância original era exatamente
   essa: doc anunciando algo que o código ainda não fazia).

---

## 9. Incidente descoberto na janela de deploy — "model ID é configuração, não código"

> **Nota de numeração:** esta seção foi escrita numa branch própria a partir de `main` sem o
> §8 (runbook), que está pendente de merge em `etapa-6-g5-runbook-deploy`/resultado da janela
> em outra branch — o número final desta seção pode mudar quando as duas forem reconciliadas.
> Conteúdo não depende da numeração.

**Achado ao vivo, durante a homologação pós-deploy (item 2 do runbook):** com o gate de
autenticação (G5/G18) já validado — JWT + membership passando, chegando até a chamada de
IA — a chamada real ao Gemini retornou **404**: `models/gemini-2.5-flash is no longer
available to new users`. `gemini-2.5-flash` era o `DEFAULT_MODEL` hardcoded desde sempre
(`index.ts`), e é exatamente o modelo que `normalizeGoogleModel` já usava como alvo de
remapeamento de **três** gerações anteriores (`gemini-1.5-flash`, `gemini-1.5-flash-00x`,
`gemini-2.0-flash` → todos mapeados pra `DEFAULT_MODEL`) — o padrão já tinha se repetido
antes desta rodada, só nunca tinha sido tratado como o que é: uma dívida estrutural.

**Verificação independente (não confiei no diagnóstico recebido — fui checar):**

- [Models | Gemini API | Google AI for Developers](https://ai.google.dev/gemini-api/docs/models)
  confirma `gemini-2.5-flash` ainda listado "Stable", shutdown oficial documentado só em
  out/2026 — a rejeição hoje é **antecipada em relação à própria doc oficial**, um
  comportamento já reportado por outros desenvolvedores: [Gemini 2.5 Flash deprecated without
  warning earlier than shutdown date](https://discuss.ai.google.dev/t/gemini-2-5-flash-deprecated-without-warning-earlier-than-shutdown-date/174217)
  e [Gemini-2.5-pro returns "no longer available to new users" — contradicts official
  deprecation date](https://discuss.ai.google.dev/t/gemini-2-5-pro-returns-no-longer-available-to-new-users-contradicts-official-deprecation-date-oct-16-2026/176380).
  Achado à parte: `gemini-2.5-pro` (usado quando o operador escolhe "Avançado" no dropdown)
  tem o mesmo relato de rejeição antecipada — não é só o flash. Fica registrado, não corrigido
  nesta rodada (não é o que quebrou aqui).
- **O sucessor não é `gemini-3.5-flash`** (o que veio no diagnóstico recebido) — é
  **`gemini-3.6-flash`**, lançado 21/jul/2026, confirmado em duas fontes independentes: a
  própria doc de modelos do Gemini API
  ([`ai.google.dev/.../models/gemini-3.6-flash`](https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash))
  e o model card do Google DeepMind
  ([`deepmind.google/models/model-cards/gemini-3-6-flash`](https://deepmind.google/models/model-cards/gemini-3-6-flash/)).
  `gemini-3.5-flash` existe e é estável, mas já é uma geração anterior ao que a própria Google
  recomenda agora — usar 3.6 evita resolver o incidente já nascendo um passo atrás.

**Fix aplicado:**

1. `DEFAULT_MODEL` (`index.ts`) deixa de ser um literal hardcoded — agora
   `Deno.env.get("GEMINI_MODEL") || "gemini-3.6-flash"`. Secret `GEMINI_MODEL` é **opcional**
   (não precisa existir pra função funcionar, só existe pra sobrescrever o default sem
   deploy). Isso é o item **obrigatório** do pedido original: Google já provou 2 cutovers em
   ~5 meses (1.5/2.0 → 2.5 → 3.6) — hardcode de model ID é incidente recorrente, não pontual.
2. `normalizeGoogleModel`: adicionado `"gemini-2.5-flash": DEFAULT_MODEL` na tabela de alias
   — sem isso, qualquer bot com `model_name` já salvo como `"gemini-2.5-flash"` (o default até
   agora, quase todo bot existente) continuaria batendo no 404 mesmo com o `DEFAULT_MODEL`
   novo, porque um valor explícito salvo não cai no fallback. Mesmo padrão já usado nas 3
   remoções anteriores da tabela.
3. Frontend (`WhatsAppBotConfig.tsx`): default do nó AI novo trocado pra `gemini-3.6-flash`;
   dropdown do provedor `gemini_api_key`/padrão — `gemini-3.6-flash` vira "(Recomendado)",
   `gemini-2.5-flash` vira "(legado)" sem o rótulo enganoso, e `gemini-2.0-flash` **removido**
   da lista (já está `Shut down`, não só "vai desligar" — mantê-lo como opção seria oferecer
   algo que já não funciona).
4. **Não migrado:** bots com `model_name` já salvo explicitamente continuam lendo esse valor
   — o alias do item 2 cobre especificamente `"gemini-2.5-flash"` (o caso real desta
   incidente), mas não é uma correção retroativa geral. Mesma lógica de "default novo não
   retroage sobre config já salva" já registrada pro G18 (§5.4).

**Lição registrada — candidata a padrão pra qualquer provider futuro:** "model ID é
configuração, não código". Toda vez que um ID de modelo de IA de terceiro (Gemini, Vertex, ou
qualquer futuro provider) é hardcoded como *default* — não como opção explícita escolhida pelo
operador — ele deveria nascer já lendo de uma env var/secret opcional com fallback, não como
literal puro. O histórico deste arquivo mesmo prova o padrão: 3 gerações de modelo
substituídas via tabela de alias antes desta rodada, sempre reativamente, sempre depois de um
incidente em produção. A tabela de alias continua útil como rede de segurança pra valores já
salvos, mas não deveria ser a **única** linha de defesa pro valor *default* — esse é o papel do
`GEMINI_MODEL`/equivalente daqui pra frente.

Sources:
- [Models | Gemini API | Google AI for Developers](https://ai.google.dev/gemini-api/docs/models)
- [Gemini 3.6 Flash | Gemini API | Google AI for Developers](https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash)
- [Gemini 3.6 Flash - Model Card — Google DeepMind](https://deepmind.google/models/model-cards/gemini-3-6-flash/)
- [Gemini 2.5 Flash deprecated without warning earlier than shutdown date](https://discuss.ai.google.dev/t/gemini-2-5-flash-deprecated-without-warning-earlier-than-shutdown-date/174217)
- [Gemini-2.5-pro returns "no longer available to new users" — contradicts official deprecation date](https://discuss.ai.google.dev/t/gemini-2-5-pro-returns-no-longer-available-to-new-users-contradicts-official-deprecation-date-oct-16-2026/176380)
