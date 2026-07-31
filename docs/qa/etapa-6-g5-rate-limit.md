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
