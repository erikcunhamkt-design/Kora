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

## 8. Runbook da janela de deploy (escrito, NÃO executado nesta rodada)

> Só roda com "vai" específico do revisor, na janela exclusiva §16, conduzida pelo revisor
> junto com o operador. Este runbook cobre G18 (migração de provedor) + G5 (fix de
> autenticação real do `isTest`) — o mesmo deploy resolve os dois, é a mesma function.

### 8.a Abertura da janela + prova de que o deploy sobe o código certo

1. Declaração §16: `pwd` + `git worktree list` — confirmar que **nenhuma outra lane** está
   ativa (exclusividade total, mesma exigência de qualquer sessão de deploy/DDL).
2. `git fetch origin && git log origin/main -1 --oneline` — anotar o hash. Sync do worktree
   de trabalho pra esse hash exato (`git checkout main && git pull`).
3. **Prova pré-deploy (espírito do §17 — hash, não comportamento):** rodar
   `git log --oneline -1` **na pasta de onde o `supabase functions deploy` vai ser
   executado**, imediatamente antes do comando — confirmar que é o mesmo hash do passo 2.
   O CLI empacota o diretório de trabalho local tal como está no disco naquele instante, não
   um ref remoto — se o worktree estiver num commit diferente (checkout errado, mudança não
   commitada), o deploy sobe **isso**, não o que o `git log origin/main` mostra. É exatamente
   o incidente #1 do §17 (worktree errada), na versão "deploy" em vez de "dev server".
4. `npx supabase functions deploy whatsapp-bot-reply --project-ref ewamvzncsloagtcvkbxv`
   (usar `npx.cmd` se PowerShell bloquear `.ps1` — já resolvido no G8). Confirmar no output
   que os dois arquivos esperados aparecem: `index.ts` **e** `_shared/isTestAuth.ts` (esse é
   novo desde o deploy do G8 — se não aparecer no output, o fix de autenticação não foi
   junto).

### 8.b Verificação ao vivo pós-deploy, nesta ordem exata

1. **`curl` anônimo — repetir EXATAMENTE o atalho do G8** (só a anon key pública, `isTest:
   true`, sem `Authorization` de usuário real): **esperado `401`** (`missing_auth` ou
   `unauthorized`, dependendo se manda header ou não). Se ainda devolver resposta de IA, **o
   fix não está no ar** — não prosseguir, ver 8.c.
2. **Simulador logado como membro** (operador na UI, sessão real): **esperado `200`** +
   resposta gerada via Gemini direto (conferir no log da function do Dashboard:
   `Using Gemini AI Studio mode`, não `Using Lovable AI Gateway`) — prova G5 (auth) e G18
   (provedor) juntos, um teste só.
3. **Webhook real:** mandar 1 mensagem de teste pro número conectado de um workspace com bot
   ativo — **esperado:** fluxo responde normal, prova de não-regressão do caminho
   `isTest=false` (a garantia "por construção" documentada em §5.1-b, confirmada agora
   empiricamente).
4. **`403` de não-membro:** só testar ao vivo se houver uma segunda conta de teste disponível
   na hora. **Se não houver, não bloquear a janela por isso** — esse caso já está coberto por
   teste unitário determinístico (`_shared/__tests__/isTestAuth.test.ts`, caso "autenticado
   mas não membro → 403 forbidden"), que testa a mesma função de decisão (`authorizeIsTestCaller`)
   que o código de produção usa. Registrar no doc da janela qual dos dois caminhos foi seguido
   (teste ao vivo ou cobertura unitária).

### 8.c Regra de parada — rollback pronto ANTES de subir

**Parar em qualquer vermelho** dos passos 8.b — não tentar corrigir ao vivo na janela.
Rollback é simplesmente re-deployar a versão anterior, já que não há migration nesta rodada
(sem estado de banco pra desfazer, mesmo raciocínio do G8 §7):

```bash
git checkout ede580c -- supabase/functions/whatsapp-bot-reply supabase/functions/_shared
npx supabase functions deploy whatsapp-bot-reply --project-ref ewamvzncsloagtcvkbxv
git checkout main -- supabase/functions/whatsapp-bot-reply supabase/functions/_shared
```

`ede580c` é o último hash confirmado como deployado e homologado com sucesso (G8, ver
`etapa-6-g8-flownodes.md` §8) — a versão que está ao vivo agora, antes deste deploy. Preparar
(copiar, ter pronto) esse comando **antes** de iniciar 8.a, não no meio de um incidente.

### 8.d Pós-validação (só se todos os passos de 8.b passarem)

1. Marcar `LOVABLE_API_KEY` para remoção do painel (Supabase → Edge Functions → Secrets) —
   remoção em si é ação do operador (mesmo padrão §8-b), fora desta janela se quiser dar um
   intervalo de observação antes. Comando exato (verificado via `supabase secrets unset
   --help` nesta rodada, não citado de memória):
   ```bash
   npx supabase secrets unset LOVABLE_API_KEY --project-ref ewamvzncsloagtcvkbxv
   ```
   **Verificação pós-remoção, nesta ordem:**
   1. `npx supabase secrets list --project-ref ewamvzncsloagtcvkbxv` — confirmar que
      `LOVABLE_API_KEY` não aparece mais na lista.
   2. Smoke test: repetir o snippet de console do item 2 do 8.b (ou 8.f) — **esperado `200`**
      de novo, provando que nenhum caminho ativo dependia da key que acabou de sair.
2. **No mesmo commit** em que `LOVABLE_API_KEY` for de fato removida: corrigir
   `docs/integrations/SUPABASE-WHATSAPP-INBOX-V1.md:91` (§7 item 2) — não antes, decisão já
   registrada pra doc e código nunca ficarem dessincronizados de novo.

---

### 8.e Resultado real da janela executada (janela ENCERRADA)

**8.a — dois deploys, não um.** O 1º deploy subiu `ede580c` — não o hash certo da janela — por
um incidente de colagem: o comando de **rollback** (§8.c) foi executado no lugar do comando de
deploy do passo 4. `ede580c` é o código **anterior ao G5/G18** (sem o fix de auth do `isTest`,
sem a migração de provedor) — na prática, **o G18 voltou a ficar exposto em produção por
alguns segundos**, até o erro ser percebido e o deploy correto (com `_shared/isTestAuth.ts` no
bundle) rodar em seguida. Registrado como **Incidente #1 da janela**: comando de rollback e
comando de deploy ficarem um do lado do outro no runbook (§8.a passo 4 e §8.c) é um risco de
colagem — candidato a lição de formatação de runbook (separar visualmente/mais distante os
dois, ou exigir confirmação explícita de qual dos dois está sendo colado antes de rodar).

**8.b item 1 — G18 VALIDADO EM PRODUÇÃO.** Três variações do `curl` anônimo do G8, todas
`401`: anon key legada → `unauthorized`; publishable key → `unauthorized`; sem credencial
nenhuma → `missing_auth`. Nenhuma delas retornou resposta de IA — o buraco original do G18
(anon key pública + `isTest` sem atribuição = proxy de IA grátis) está fechado de verdade no
ambiente real, não só em teste unitário.

**8.b item 2 — VERMELHO.** Membro autenticado atravessa o gate normalmente (JWT + membership
OK — provado pelo próprio `500` pós-gate, que só é alcançável depois da autorização passar),
mas a chamada ao Gemini retornou `404` (`models/gemini-2.5-flash is no longer available to new
users`). **Achado durante o diagnóstico:** o secret `GEMINI_API_KEY` **não existia** no painel
até este ponto da janela — ou seja, a migração de provedor do G18 (`lovable` →
`gemini_api_key`) estava **inoperante em produção** desde que foi deployada, mascarada porque
nunca tinha sido de fato invocada com um usuário autenticado real até agora (o `curl` anônimo
do G8/item 1 nunca chega tão longe no código — para antes, no gate de auth). Secret criado
durante a janela. Fix de fundo (model ID hardcoded quebrando) tratado em branch própria
(`etapa-6-g5-gemini-model-config`, `GEMINI_MODEL` configurável + `gemini-3.6-flash` como novo
default, verificado contra a doc oficial) — pendente de merge e de uma mini-janela de
revalidação.

**8.b item 3 (webhook) — ADIADO.** Depende do provedor estar respondendo (item 2 antes precisa
fechar) — roda na mini-janela de revalidação pós-fix do model ID, junto com o reteste do
item 2.

**8.d — NÃO executado.** `LOVABLE_API_KEY` permanece no painel — decisão explícita: só remove
(e só corrige o doc `INBOX-V1`) depois que os itens 2 e 3 do 8.b fecharem verdes na
revalidação, não antes.

**Incidente #2 da janela — key do Gemini exposta em chat do revisor** (fora desta sessão/lane).
Tratamento: rotação agendada pra mesma mini-janela de revalidação — gerar key nova, `supabase
secrets set GEMINI_API_KEY=<nova>`, apagar a key antiga no Google AI Studio, testar, **como um
movimento só** (não deixar uma janela intermediária com a key antiga ainda válida depois de já
ter sido exposta, nem com o secret desatualizado depois da key antiga ser apagada).

**Notas de ambiente (registro, sem ação executada nesta rodada — commit é doc-only):**
- Cópia scratch do repo encontrada em `.gemini\antigravity` — candidata a remoção numa limpeza
  futura, não removida agora.
- Processo "fantasma" ocupando a porta 8080 (relacionado ao mesmo achado que motivou o fix de
  `vite.config.ts`/`autoPort` no G8) — candidato a encerrar, não encerrado nesta rodada.
- A worktree principal (`orbit-designer-hub`) começou a janela com `etapa-6-g5-runbook-deploy`
  checked out em vez de `main` — resolvido com `git checkout main` antes de abrir a janela.
  **Lição de processo:** toda lane que termina uma sessão devolve a worktree principal pra
  `main` antes de encerrar, pra próxima sessão (sua ou de outra lane) não herdar uma branch de
  trabalho como se fosse o estado neutro.

---

### 8.f Placar final — mini-janela de revalidação (ENCERRADA)

Mini-janela aberta pra fechar os dois pendentes do 8.b (item 2 vermelho, item 3 adiado) depois
do fix do model ID (§9) e da rotação da key exposta (Incidente #2, §8.e).

**Item 2 — VERDE.** `200` + resposta real de IA via `gemini-3.6-flash`, key do Gemini já
rotacionada antes deste teste (Incidente #2 fechado primeiro, como planejado — nunca testar
com a key que já se sabe exposta). **Achado operacional registrado:** ao montar o snippet de
console pra pegar a sessão, usar a **chave literal do projeto**
(`sb-ewamvzncsloagtcvkbxv-auth-token`) — nunca um `find()` genérico varrendo `localStorage` por
prefixo `sb-`. Num navegador com sessão de mais de um projeto Supabase (comum numa máquina de
desenvolvimento com vários projetos), um `find()` genérico pode pegar o token do projeto
errado silenciosamente, sem erro nenhum — o request sai autenticado, só que pra identidade
errada. Vale como prática permanente pra qualquer snippet de console futuro neste repo, não só
pra este teste.

**Item 3 — fechado por prova estrutural + testes, não por teste ao vivo.** Validação empírica
do caminho do webhook (mensagem real chegando num WhatsApp conectado) segue **condicionada** a
existir uma instância conectada neste ambiente — que não existe (mesmo bloqueio de sempre, já
registrado desde o G8). Isso **não é uma pendência em aberto**: a garantia "por construção"
(§5.1-b, bloco de auth inteiro dentro de `if (isTest)`, `index.ts:248-273`, o webhook nunca
passa `isTest` no payload) já é uma prova de código, não uma suposição — reforçada pelos testes
determinísticos de `_shared/__tests__/isTestAuth.test.ts`. Item considerado fechado; validação
ao vivo fica disponível pra quando/se uma instância real existir neste ambiente, sem bloquear o
encerramento da fatia até lá.

**Incidente #2 — rotação executada.** Key antiga do Gemini apagada no Google AI Studio, secret
`GEMINI_API_KEY` atualizado com a key nova, teste (item 2 acima) confirmou funcionamento — os
três passos como um movimento só, na ordem planejada. **Prova registrada por dígest, nunca por
valor:** a prática correta aqui (e pra qualquer rotação futura de credencial neste repo) é o
operador confirmar a troca via um hash/fingerprint da key antiga vs. nova (ex.: `sha256sum` do
valor, comparando só os dígests) — nunca colar a key em si em nenhum doc, commit, ou chat,
mesmo já revogada. Este documento não registra dígest nenhum porque a rotação em si aconteceu
fora desta sessão (o operador com o revisor) — fica documentado o **método** como padrão pra
próximas rotações, não o dado desta rotação específica.

**G18 — RESOLVIDO E VALIDADO** de ponta a ponta: auth real (§5.1-b) + provider migrado e
funcionando em produção (item 2 acima) + model ID configurável (§9) + webhook sem regressão
(item 3 acima). Ver também a entrada G18 atualizada no catálogo mestre.

---

## 9. Incidente descoberto na janela de deploy — "model ID é configuração, não código"

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

---

## 10. G5 Parte 2 — Fase A: desenho (diagnóstico + design, zero código)

> Escopo desta rodada: só desenho, reportado antes de codar (§18). Nada implementado.

### 10.1 Escopo confirmado

G18 fechado muda um pressuposto do desenho original (§4.1): a atribuição do `isTest` **não é
mais fraca** — desde o fix de autenticação real (JWT + membership, `index.ts:254-279`), o
`workspaceId` usado pra rate limit **é** a identidade verificada do chamador, não mais um
valor de input forjável. O contador por-workspace agora é uma garantia de verdade nos dois
buckets (`webhook` e `isTest`), não só "melhor que nada" como o desenho original registrava.

Achado novo do smoke de hoje, adicionado ao escopo: Gemini respondeu `503 UNAVAILABLE`
transitório em pico de carga — nada a ver com o fix do G18/model ID (esse já está confirmado
funcionando), é o tipo de instabilidade transitória normal de qualquer API de terceiro sob
carga. Hoje o código não distingue "erro transitório, tentar de novo" de "erro permanente,
desistir" — qualquer `!aiRes.ok` vira `throw` direto (`index.ts:594-598` no caminho
`gemini_api_key`, `547-566` no `vertex_ai`, `631-637` no `lovable`).

### 10.2 Tabela + RPC (refinado de §3/§4.2)

**Tabela**, janela fixa (não sliding window — simplicidade suficiente pra prevenção de abuso,
não é billing de precisão):

```sql
CREATE TABLE public.ai_rate_limit_counters (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  bucket text NOT NULL,            -- 'webhook' | 'isTest'
  window_start timestamptz NOT NULL,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (workspace_id, bucket, window_start)
);
```

**RPC**, upsert atômico (`INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING` é uma operação
atômica única no Postgres — mesma garantia de ausência de race condition do padrão
`claim_campaign_messages` do G4, só que via upsert em vez de claim-de-linha, porque aqui o que
importa é *contar*, não *reivindicar*):

```sql
CREATE OR REPLACE FUNCTION public.check_and_increment_ai_rate_limit(
  p_workspace_id uuid,
  p_bucket text,
  p_max int,
  p_window_s int DEFAULT 60
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_s) * p_window_s);
  v_count int;
BEGIN
  INSERT INTO public.ai_rate_limit_counters (workspace_id, bucket, window_start, count)
  VALUES (p_workspace_id, p_bucket, v_window_start, 1)
  ON CONFLICT (workspace_id, bucket, window_start)
  DO UPDATE SET count = ai_rate_limit_counters.count + 1
  RETURNING count INTO v_count;

  RETURN v_count <= p_max;
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_increment_ai_rate_limit(uuid, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_increment_ai_rate_limit(uuid, text, int, int) TO service_role;
```

**Limpeza (recomendada, não bloqueante):** sem limpeza, a tabela cresce indefinidamente (uma
linha por workspace/bucket/janela). `pg_cron` já confirmado ativo (Etapa 6 §6 do levantamento
original) — um job diário `DELETE FROM ai_rate_limit_counters WHERE window_start < now() -
interval '1 day'` é trivial de acrescentar, mesma categoria do que já existe pro
`whatsapp-campaign-processor`. Pode entrar na mesma janela de DDL ou ficar pra depois — não
bloqueia o mínimo viável.

**Onde chamar:** uma vez, logo após `adminClient = createClient(...)` (`index.ts:281` hoje —
precisa do client `service_role` porque a RPC só tem grant pra ele), com `bucket = isTest ?
"isTest" : "webhook"`. Cedo o bastante pra economizar todo o trabalho pesado por-caminho
(busca de `bot_settings`, conversa, histórico) numa request que vai ser barrada mesmo.

### 10.3 Política de limite (números iniciais, ajustáveis com o operador)

| Bucket | Limite | Janela | Por quê |
| :-- | :-- | :-- | :-- |
| `webhook` | 20 | 1 min | Mesmo número do desenho original (§4.3) — generoso pra uso humano real, baixo o bastante pra capar spam de mensagens |
| `isTest` | 10 | 1 min | Simulador é só preview — nenhum uso legítimo precisa de volume alto |

**Removido do desenho original:** o teto diário extra específico pro provedor `lovable`
(§4.3 antiga) não se aplica mais — G18 aposentou esse provider como default; o provedor ativo
hoje (`gemini_api_key`) já usa credencial própria do workspace na maioria dos casos, e quando
cai no fallback da plataforma (`GEMINI_API_KEY` do secret), os buckets acima já cobrem.

**Comportamento ao estourar** (sem mudança do desenho original, §4.4): `webhook` → `200 { ok:
true, skipped: "rate_limited" }` (mesmo padrão dos outros `skipped` do arquivo); `isTest` →
`429` explícito, pro simulador mostrar o erro de verdade.

### 10.4 Retry/backoff pra erro transitório do provider (novo, do smoke de hoje)

**Escopo do retry:** só `503` e `429` — os dois sinais padrão de "tenta de novo depois" de
qualquer API HTTP. Nunca retry em `4xx` que não seja `429` (erro de configuração/autenticação
— vai falhar igual na próxima tentativa, só atrasa o erro real chegando pro usuário).

**Orçamento:** 2 retries (3 tentativas no total), backoff exponencial com jitter (~300ms,
~600ms + até 100ms aleatório) — latência adicional máxima de ~1-2s no pior caso. Deliberadamente
pequeno: Edge Functions têm limite de wall-clock, e tanto o `isTest` (chamador espera na hora,
no simulador) quanto o `webhook` (chamador é `whatsapp-webhook`, que faz `await fetch(...)`
síncrono esperando a resposta, `index.ts:615` daquele arquivo) têm expectativa de resposta
rápida — nada de retry longo/tipo circuit-breaker aqui, seria sobre-engenharia pro problema
real (blip transitório, não instabilidade sustentada).

**Onde aplicar:** um helper `fetchWithRetry` envolvendo as 4 chamadas de provider que já
existem (`vertex_ai` primário `index.ts:538`, fallback `553`, `gemini_api_key` `586`, `lovable`
`619`) — reduz duplicação em vez de reimplementar retry em cada uma.

**Nunca engolir silenciosamente:** esgotadas as tentativas, o comportamento already existente
(`throw new Error(...)` → cai no `catch` de fora → `500` com `{error: message}`, e no caminho
não-`isTest` grava uma mensagem de erro visível em `whatsapp_messages`, `index.ts:696-723`) já
cobre "não esconder o erro" — só preciso deixar a mensagem final citar que as tentativas se
esgotaram (ex.: `"Gemini Developer API falhou após 3 tentativas (503): ..."`), não estava no
requisito original mas é o tipo de detalhe que ajuda a distinguir "esgotou retry" de "erro na
primeira tentativa" no log/na mensagem de erro pro operador.

### 10.5 Pacote de DDL (janela §8-b única, junto com o fix do DEFAULT)

1. `CREATE TABLE ai_rate_limit_counters` (§10.2)
2. `CREATE FUNCTION check_and_increment_ai_rate_limit` (§10.2)
3. `ALTER TABLE public.whatsapp_bot_settings ALTER COLUMN provider SET DEFAULT
   'gemini_api_key';` — já registrado como backlog (§7 item 1), reforçado: o default do schema
   hoje aponta pra um provider morto (sem secret desde a remoção do `LOVABLE_API_KEY`), não só
   "não-recomendado" como antes do encerramento do G18.
4. *(Recomendado, pode ficar pra depois sem bloquear)* job `pg_cron` de limpeza (§10.2).

**Fora do pacote de DDL:** retry/backoff (§10.4) é código puro, zero migration — pode ir na
mesma rodada de implementação ou até deployar antes/depois do DDL, sem dependência entre os
dois.

### 10.6 Fase B (próxima, só com novo "vai")

Implementar: migration com os itens 1-3 (±4) do §10.5; RPC chamada no `index.ts` logo após
`adminClient` (§10.2); `fetchWithRetry` envolvendo as 4 chamadas de provider (§10.4); testes
unitários pra qualquer lógica pura extraída (mesmo padrão G8/G5 Parte 1 — `_shared/` +
Vitest); homologação seguindo o mesmo formato de curl/simulador já validado nas rodadas
anteriores.

---

## 11. Fase B (implementada) — esclarecimentos pedidos + decisões

**Migration:** `supabase/migrations/20260802010000_g5_ai_rate_limit.sql` — escrita, **não
aplicada**. Contém os 3 itens do §10.5 (tabela, RPC, fix do `DEFAULT`); o job `pg_cron` de
limpeza ficou de fora (recomendado, não bloqueante, como já registrado — pode entrar numa
DDL futura sem dependência com este pacote).

### 11.1 (a) Chave do contador: `(workspace_id, bucket)` — explicitado e justificado

**Por que `workspace_id`, não `conversation_id`/`user_id`/instância:** é a unidade real de
custo/credencial. `gemini_api_key`/`gcp_service_account` são configurados por workspace
(`whatsapp_bot_settings`), e quando caem no fallback da plataforma (`GEMINI_API_KEY` do
secret), quem "paga" ainda é uma decisão no nível do workspace, não da conversa. Limitar por
conversa permitiria que um workspace com muitas conversas moderadas somasse um custo agregado
sem nenhuma delas individualmente "parecer" abusiva — o risco de custo se acumula no
workspace inteiro, é aí que o teto precisa estar.

**Por que `bucket` (não um contador único):** `webhook` (tráfego real, disparado por mensagem
inbound de verdade) e `isTest` (simulador, chamado pelo operador testando o construtor de
fluxo) têm padrões de uso legítimo muito diferentes — um operador testando o bot intensamente
no construtor não deveria conseguir esgotar o teto que protege as respostas reais aos
clientes, e vice-versa. Buckets separados isolam os dois; um contador único misturaria as
duas atividades.

**Por que não por usuário individual dentro do `isTest`:** desde o fix de autenticação real
(G5 Parte 1), o `isTest` já sabe quem é o usuário (JWT validado) — daria pra também chavear
por `user_id`. Não fiz isso porque o risco de custo continua sendo por-workspace (a credencial
é do workspace, não do usuário), e adicionar uma dimensão a mais (usuário) sem mudar o que
realmente se protege (o teto de gasto do workspace) seria complexidade sem benefício
correspondente — dois membros testando ao mesmo tempo dividem o mesmo teto de 10/min, o que é
uma limitação aceitável (testar o bot não deveria precisar de volume alto de qualquer forma).

### 11.2 Fail-open no erro da própria RPC (decisão adicional, não pedida explicitamente mas necessária)

Achado ao desenhar a integração: o código pode ser deployado **antes** da migration ser
aplicada (são passos separados por design, §10.5/item 2 desta rodada) — se isso acontecer, a
chamada `adminClient.rpc("check_and_increment_ai_rate_limit", ...)` falha porque a função não
existe ainda. Decisão: **fail-open** — se a própria checagem de rate limit falhar por qualquer
motivo (função ausente, erro transitório de banco), a chamada de IA **prossegue normalmente**,
só loga o erro. Justificativa: rate limit aqui é rede de segurança de custo, não fronteira de
segurança — uma indisponibilidade total do bot por causa de um bug/hiccup no *rate limiter*
seria pior do que deixar de aplicar o teto por um instante. Contraste deliberado com
`isTestAuth.ts` (G5 Parte 1), que falha **fechado** — lá a falha aberta significaria voltar ao
buraco do G18 (proxy de IA anônimo e ilimitado), um risco muito pior que "o teto não aplicou
por um momento". Implementado em `_shared/rateLimit.ts` (`decideRateLimitOutcome`), testado
explicitamente (`rpcError=true` → sempre permite, matriz completa em
`_shared/__tests__/rateLimit.test.ts`).

### 11.3 (b) Contrato de estouro por chamador — revisão do `webhook`

**Reexaminei a justificativa original do §4.4/§10.3** ("nunca 4xx/5xx pro webhook — evita
retry storm do lado de quem chama") e ela **não se sustenta**: confirmei lendo
`whatsapp-webhook/index.ts:631` que a resposta que esse arquivo devolve pro Meta/uazapi é um
`{ ok: true }` **incondicional**, hardcoded, que não depende em nada do status que
`whatsapp-bot-reply` devolve — o disparo do bot (linhas 605-629) é fire-and-forget de verdade,
só logado (`console.log(...response.status...)`). Não existe risco de retry storm porque
ninguém upstream do `whatsapp-webhook` nunca vê o status de `bot-reply`. Registro isso
explicitamente porque a justificativa original estava errada, não só incompleta.

**Duas opções reais, com a justificativa correta:**

| Opção | Prós | Contras |
| :-- | :-- | :-- |
| **(A) `200 { ok: true, skipped: "rate_limited" }`** (mantida) | Consistente com os outros 4 `skipped` já existentes no arquivo (`no bot settings`, `bot inactive`, `AI node disabled`, `instance not connected`) — do ponto de vista do fluxo do webhook, "rate limitado" é a mesma categoria de coisa: uma decisão de política que resulta em não responder, não uma falha de sistema. Introduzir um status diferente só pra este skip seria uma exceção sem motivo funcional hoje. | Nada consome o status de forma diferenciada hoje — a visibilidade de "isso foi rate-limited" só existe no log da Edge Function de qualquer forma, com ou sem `429`. |
| **(B) `429`, igual ao `isTest`** | Contrato único, mesmo significado HTTP nos dois caminhos. Deixa a porta aberta pra `whatsapp-webhook` reagir a isso especificamente no futuro (log distinto, eventualmente algum tipo de repique) sem precisar mudar o formato de novo. | Exigiria também tocar `whatsapp-webhook/index.ts` pra fazer algo útil com a distinção — fora do escopo autorizado desta rodada (o "vai" cobriu `whatsapp-bot-reply`, não o webhook). Sem essa mudança complementar, a opção B não entrega nenhum benefício prático a mais que a A hoje. |

**Recomendação: mantive (A)**, mas pela razão certa (consistência de padrão dentro do mesmo
arquivo), não pela razão errada que eu tinha registrado antes (retry storm, que não existe).
Se no futuro `whatsapp-webhook` ganhar alguma reação específica a rate limit (alerta,
repique), a opção B volta a fazer sentido — registrado aqui como gatilho pra reabrir essa
decisão, não decidido preventivamente agora.

### 11.4 Testes (`_shared/__tests__/`)

- `rateLimit.test.ts` (9 casos): `isWithinLimit` — matriz sob/no/sobre o limite (fronteira
  inclusiva, mesma regra do RPC `v_count <= p_max`), buckets separados (mesma contagem,
  resultado diferente conforme o teto do bucket); `decideRateLimitOutcome` — fail-open no
  erro da RPC, permitido dentro do limite, `429` pro `isTest` estourado, `200+skipped` pro
  `webhook` estourado.
- `retry.test.ts` (10 casos): `shouldRetry` — retry em `503`/`429`, para depois de esgotar,
  nunca retry em erro não-transitório (`400`/`401`/`403`); `backoffDelayMs` — crescimento
  exponencial determinístico via `rng` injetado; `fetchWithRetry` — **503 → sucesso** (tenta
  de novo até um `200`, reporta quantas tentativas precisou), **503 → esgotado** (devolve a
  última resposta com falha após o máximo, não trava nem engole), sucesso de primeira (não
  tenta de novo), erro não-transitório (não tenta de novo).

**O que os testes não cobrem (não tem como, é I/O real):** a RPC em si rodando contra Postgres
de verdade (as regras de fronteira estão espelhadas em `isWithinLimit` como especificação
testada, mas a execução real fica pra homologação pós-DDL); e o comportamento do Gemini/Vertex
real sob `503` de verdade (o teste mocka `fetch`). Mesma limitação já registrada em cada
rodada anterior desta function — verificação empírica é sempre fase de homologação, com a
function e a migration de verdade no ar.

---

## 12. Emenda pré-DDL (revisão em texto) — REVOKE explícito de `anon`/`authenticated`

**Achado na revisão:** `REVOKE ALL ... FROM PUBLIC` sozinho não bastava. Funções novas no
Postgres/Supabase recebem `EXECUTE` por *default privilege* pra `anon`/`authenticated` — é um
grant direto a esses roles, não herdado de `PUBLIC`, então revogar só de `PUBLIC` deixava a
RPC chamável via PostgREST por qualquer anônimo com a anon key. Impacto: incrementar/estourar
contadores de workspace alheio à vontade — DoS dos contadores, mesma classe de risco que o G18
já fechou pro `isTest` (não reabrir aqui por um detalhe de `GRANT`).

**Fix:** `REVOKE ALL ON FUNCTION public.check_and_increment_ai_rate_limit(uuid, text, int, int)
FROM PUBLIC, anon, authenticated;` — `GRANT ... TO service_role` mantido igual.

**Kit de verificação pós-aplicação** (movido do relatório em chat pra cá, expectativa da query
(d) já corrigida por esta emenda — copy-paste, valores preenchidos):

```sql
-- (a) Tabela existe com a estrutura certa
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'ai_rate_limit_counters'
ORDER BY ordinal_position;

-- (b) RLS ligada
SELECT relrowsecurity FROM pg_class WHERE oid = 'public.ai_rate_limit_counters'::regclass;
-- esperado: t

-- (c) Function existe, SECURITY DEFINER
SELECT p.proname, p.prosecdef AS security_definer, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'check_and_increment_ai_rate_limit';
-- esperado: 1 linha, security_definer = true

-- (d) Grant SÓ pra service_role — nenhuma linha de anon/authenticated/PUBLIC
--     (expectativa corrigida por esta emenda; antes da emenda isso teria vazado
--     anon/authenticated por default privilege, é exatamente o que essa query
--     detecta)
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public' AND routine_name = 'check_and_increment_ai_rate_limit';
-- esperado: service_role/EXECUTE + postgres/EXECUTE (owner da função — mantém EXECUTE
-- por ser dono, é role administrativo do projeto, nunca exposto via PostgREST/anon
-- key; benigno, não é a mesma classe de vazamento que anon/authenticated seriam).
-- Se aparecer anon/authenticated/PUBLIC, PARAR — confirmado ao vivo na sessão §8-b
-- (2026-08-02): só service_role + postgres apareceram, nenhum vazamento.

-- (e) DEFAULT da coluna provider mudou
SELECT column_default FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'whatsapp_bot_settings' AND column_name = 'provider';
-- esperado: 'gemini_api_key'::text

-- (f) Smoke funcional da RPC, bucket descartável pra não sujar contadores reais
SELECT public.check_and_increment_ai_rate_limit(
  '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9'::uuid, 'smoke_test', 5, 60
);
-- esperado: true (1a chamada, count=1 <= 5)

SELECT * FROM public.ai_rate_limit_counters WHERE bucket = 'smoke_test';
-- esperado: 1 linha, count=1

-- limpeza do smoke test (não deixar dado de teste na tabela real)
DELETE FROM public.ai_rate_limit_counters WHERE bucket = 'smoke_test';
```

**Resultado da sessão §8-b (2026-08-02): DDL aplicada 6/6, sem incidentes.** Todas as
verificações (a-f) bateram com o esperado, com uma nota benigna na (d) já incorporada acima
(role `postgres`, dono da função, também retém `EXECUTE` — administrativo, nunca exposto via
PostgREST/anon key, não é a mesma classe de vazamento que `anon`/`authenticated` seriam).
Tabela, RPC e `DEFAULT` da coluna confirmados no lugar. Deploy da function fica pra sessão
separada, com o operador, guiada pelo revisor.
