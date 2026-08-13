# Etapa 9 · Item 1 — Levantamento do parser Gemini (somente leitura)

> **Zero código alterado nesta rodada.** Preparação da migração de provider do Robô IA
> (Gemini → Claude/API Anthropic), registrada como
> [Etapa 9 §6](kora-roadmap.md#6-etapa-9--robô-ia-decisão-do-operador-13ago2026) do roadmap.
> A própria ressalva registrada lá — "o formato de resposta da Anthropic diverge de
> Gemini/Vertex, então esta migração precisa de parser novo, não só trocar a variável de
> provider" — é o que esta rodada existe pra dimensionar com precisão de arquivo:linha, não
> por suposição.

## Abertura (§16/§17)

- Worktree: `orbit-designer-hub`, branch `etapa-9-item1-parser-map`, criada a partir de
  `origin/main` @ `c039948` (confirmado por `git log origin/main -1` — bate com o esperado; a
  LANE A ainda não mesclou a Fase C do flip de Projetos nesta rodada).

---

## 1. Onde o código chama o Gemini hoje

**Um único ponto de chamada real em todo o repositório** — confirmado por grep exaustivo
(`generativelanguage|generateContent|aiplatform.googleapis`, zero resultados fora do arquivo
abaixo): `supabase/functions/whatsapp-bot-reply/index.ts`. Nenhuma outra edge function
(`whatsapp-campaign-processor`, `whatsapp-campaign-v2-sender`, `whatsapp-instance`,
`whatsapp-official-*`, `whatsapp-webhook`) chama IA — `whatsapp-webhook/index.ts:605` só tem
um comentário indicando que ele *dispara* `whatsapp-bot-reply` (fire-and-forget), não chama
Gemini diretamente.

### 1.1 Três branches de provider, uma função (linhas 546-665)

| Provider | Linha | URL/mecanismo | Onde lê a key/credencial |
|---|---|---|---|
| `vertex_ai` | 546-594 | `getGCPToken()` (:193-226, JWT RS256 assinado + troca por access token) → `https://{region}-aiplatform.googleapis.com/v1/projects/{project}/locations/{region}/publishers/google/models/{model}:generateContent` (:550). Fallback automático pra Generative Language API (:572-587) se Vertex falhar. | `GCP_SERVICE_ACCOUNT`/`GCP_PROJECT_ID` (:537-538) — resolvidos de `geminiApiKey`/`gcpServiceAccount` (payload de teste, :323-326) OU `aiNode.properties` (nó visual, :495-497) OU `bot.gcp_service_account`/`gcp_project_id` (coluna da tabela, :504-522) OU env var `Deno.env.get("GCP_SERVICE_ACCOUNT")`/`GCP_PROJECT_ID` como último fallback (:537-538). |
| `gemini_api_key` | 595-622 | `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}` (:598) | `GEMINI_API_KEY` (:536) — mesma cadeia de resolução (payload teste → nó visual → coluna `bot.gemini_api_key` → env `GEMINI_API_KEY`/`VERTEX_API_KEY`). |
| `lovable` | 623-661 | `https://ai.gateway.lovable.dev/v1/chat/completions` (:640) — **já é um gateway de formato OpenAI-chat-completions**, não Gemini nativo (ver §3). | `LOVABLE_API_KEY` (:540, só env var — não tem campo de UI/coluna dedicada, resíduo do G18). |

**Modelo:** `DEFAULT_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-3.6-flash"` (:120) — já
parametrizado por secret, sem deploy pra trocar (lição registrada no próprio comentário do
código, `docs/qa/etapa-6-g5-rate-limit.md`). `normalizeGoogleModel()` (:124-141) remapeia
aliases antigos (`gemini-1.5-*`, `gemini-2.0-*`) pro modelo atual — específico do vocabulário
de nomes de modelo do Google, não reutilizável pro vocabulário Anthropic (`claude-*`).

### 1.2 Frontend — onde o provider é escolhido e o payload de teste é montado

`src/components/whatsapp/WhatsAppBotConfig.tsx`:
- Dropdown de provider (:610-621) — 3 opções hardcoded: `lovable` ("Créditos KORA"),
  `gemini_api_key` ("Gemini API Key Studio"), `vertex_ai` ("Vertex AI GCP"). **Uma 4ª opção
  Anthropic entra aqui.**
- Campos condicionais de credencial por provider (:641-661+) — bloco próprio pra cada
  provider, mesmo padrão que uma opção `anthropic_api_key` precisaria replicar.
- Payload do modo `isTest` (:304-311) — monta `provider`/`modelName`/`geminiApiKey`/
  `gcpProjectId`/`gcpRegion`/`gcpServiceAccount` e envia pro mesmo endpoint
  `whatsapp-bot-reply` com `isTest: true`. Confirma que o simulador da UI exercita o MESMO
  código de parsing da produção — não há um caminho de teste separado que ficaria
  desatualizado.
- Persistência em `whatsapp_bot_settings` (:242-246) quando salva o nó AI.

### 1.3 Schema (banco)

`whatsapp_bot_settings` (`supabase/migrations/20260603000000_add_bot_api_keys.sql`):
`provider TEXT DEFAULT 'lovable'` (comentário na coluna já lista os 3 valores válidos —
precisa de atualização de comentário, não de migration estrutural, pra incluir `anthropic`),
`gemini_api_key TEXT`, `gcp_service_account TEXT`. **Achado tangencial, não-bloqueante:** o
`DEFAULT` da coluna no banco continua `'lovable'` — o G18 só trocou o fallback em código
(`provider || "gemini_api_key"`, aplicado sempre que a coluna estiver `NULL`), nunca o
`DEFAULT` da coluna em si. Não é um bug (toda linha existente já tem um `provider` explícito
gravado), só uma inconsistência cosmética entre o texto do comentário da coluna e o
comportamento real — mencionar se algum dia mexer nesse `ALTER`.
- **`workspace_ai_credentials` NÃO é usada aqui** — achado de escopo importante:
  `useVertexCredentials.ts`/`VertexAIConnectionCard.tsx` gerenciam uma tabela separada com
  esse nome, mas `whatsapp-bot-reply/index.ts` nunca a lê — é o backend de uma feature
  diferente (`AISection.tsx`, "Automações"/agentes de IA), não do bot do WhatsApp. Não tocar
  essa tabela por engano ao migrar o provider do bot.

---

## 2. Onde a resposta é parseada — o que o molde G18 NÃO cobre

G18 (Lovable→Gemini) trocou só a **variável de provider default**; endpoint, parser e
tratamento de erro do caminho Gemini já existiam e não precisaram mudar (mesmo formato de
resposta entre `gemini_api_key` e `vertex_ai`). Para Anthropic, os 3 pontos abaixo mudam de
verdade:

### 2.1 Shape da resposta esperada hoje

- **Vertex/Gemini (:590, :593, :622):** `aiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ""`
  — sempre pega o primeiro candidate, primeira part, campo `text`. Sem verificação de
  `finishReason` (ex.: `MAX_TOKENS`, `SAFETY`) — se a resposta vier vazia ou cortada, o código
  não distingue de uma resposta vazia legítima.
- **Lovable (:660-661):** `aiData.choices?.[0]?.message?.content?.trim() || ""` — shape
  OpenAI-chat-completions, **estruturalmente mais parecido com o que a API da Anthropic
  devolve** do que o shape nativo do Gemini é (ver §3).
- **Anthropic (Messages API, não implementado — pra dimensionar o parser novo):** a resposta
  real é `{ content: [{ type: "text", text: "..." }], stop_reason: "end_turn" | "max_tokens" | ... }`
  — array de blocos de conteúdo (não `candidates[].parts[]`), texto em
  `content[0].text` só quando `content[0].type === "text"` (a Anthropic pode devolver outros
  tipos de bloco, ex. `tool_use`, se function-calling for habilitado — não é o caso aqui, mas o
  parser novo precisa checar `type` antes de ler `text`, o Gemini nunca precisou disso).
  **Nenhum dos 3 parsers hoje tem essa checagem de tipo de bloco** — é código genuinamente
  novo, não adaptação.

### 2.2 Function calls / streaming

**Nenhum dos 3 providers usa tool-calling nem streaming hoje** — confirmado por leitura
completa da função (nenhuma menção a `tools`, `function_call`, `stream: true`, ou
`ReadableStream` em `whatsapp-bot-reply/index.ts`). Todas as 3 chamadas são
request-response síncrono único (`await res.json()`). Migrar pra Anthropic **não precisa**
resolver esses dois problemas — mas se o item 3 (base de conhecimento) algum dia justificar
tool-use, essa é a primeira function que ganharia esse desenho, não uma reescrita de uma
feature existente.

### 2.3 Erro, retry, timeout

`supabase/functions/_shared/retry.ts` (44 linhas, provider-agnostico) —
`fetchWithRetry()` usada pelos 3 branches (:559, :607, :640): até 3 tentativas totais,
retry só em `503`/`429` (`shouldRetry()`, :7-10), backoff exponencial com jitter (:12-19).
**Reutilizável como está pro Anthropic** — a Anthropic também usa `429` (rate limit) e `529`
(overloaded, não `503`) pros mesmos cenários; `shouldRetry()` precisaria adicionar `529` à
lista pra ter paridade de comportamento (mudança de 1 linha, não estrutural).

Erro final: cada branch monta uma `Error` com mensagem específica do provider (:586, :618,
:655-657 — inclusive tratamento dedicado pra `429`/`402` no Lovable) — capturada pelo
`catch` do handler (:717-745), que grava `whatsapp_messages` com `status: "error"` e o
`.message`/`.stack`. Um branch Anthropic precisa da mesma forma de erro (mensagem legível +
status HTTP), sem mudança no `catch` externo.

**Timeout explícito: não existe em nenhum dos 3 branches** — só o timeout implícito do
`fetch()` do runtime Deno (sem `AbortController`/`signal` em lugar nenhum). Não é uma lacuna
introduzida por este levantamento — é o comportamento atual dos 3 providers, herdado
igualmente por um 4º.

---

## 3. Contrato interno — o encaixe natural do provider Anthropic

**Não existe uma camada de abstração de provider formal** (tipo `interface AIProvider { call(): Promise<string> }`)
— os 3 branches são `if/else if` sequenciais dentro do mesmo `Deno.serve`, cada um
resolvendo suas próprias credenciais, montando seu próprio payload e parseando sua própria
resposta. O que TODOS os 3 branches convergem pra um único ponto depois (:670,
`applySendTemplate(flowNodes, reply)`) é uma **string** (`reply: string`) — esse é o contrato
real e único: qualquer provider novo só precisa terminar preenchendo a variável `reply` com o
texto da resposta, nada mais é compartilhado (nem tipo de erro, nem metadados, nem streaming).

**O branch `lovable` é o molde mais próximo, não o `gemini_api_key`/`vertex_ai`:** ele já
converte `contents: GeminiContent[]` (shape nativo Gemini, usado internamente pra montar o
histórico independente do provider final, :527-532) pro shape `messages: [{role, content}]`
(:632-638) — **exatamente a mesma transformação estrutural que um branch Anthropic precisa**
(a Messages API da Anthropic também usa `messages: [{role: "user"|"assistant", content}]` +
um campo `system` separado, em vez de `role: "system"` dentro do array como o Lovable/OpenAI
fazem — mais uma divergência pequena, não zero). Recomendação de design pra Fase B (fora do
escopo desta rodada, só registrando o achado): copiar o padrão de conversão do branch
`lovable`, não tentar reaproveitar o payload nativo `GeminiRequestBody`/`contents`.

---

## 4. Interseções de risco

- **Rate limit (G5):** `check_and_increment_ai_rate_limit` (RPC, `_shared/rateLimit.ts`) roda
  **antes** de qualquer branch de provider (:292-302) — chave é `(workspace_id, bucket)`, sem
  nenhuma referência a `provider` no contador. **Provider-agnóstico, zero mudança necessária**
  pra suportar Anthropic — o limite (10/min em teste, 20/min em produção) se aplica igual,
  não importa qual provider está por trás. Escopo hoje é só `whatsapp-bot-reply`
  (confirmado no G5 Fase A, citado no roadmap §4 item 3) — segue valendo, a troca de provider
  não muda esse escopo.
- **Custo/limite de contexto:** `MAX_HISTORY = 12` (:122) — só limita quantas mensagens
  recentes entram no histórico, não faz contagem de tokens nem trunca por tamanho de
  contexto. Nenhum dos 3 providers hoje tem lógica de custo/token além disso. Modelos Claude
  têm janelas de contexto e preço por token diferentes de Gemini — dimensionar isso é
  trabalho do item 3 (base de conhecimento, que explicitamente já pede uma Fase A própria
  cobrindo "custo de contexto") mais do que do item 1 — mas o item 1 herda o mesmo
  `MAX_HISTORY` sem alteração, então o comportamento de custo por mensagem simples não piora
  nem melhora só com a troca de provider.
- **Onde o prompt é montado (insumo direto do item 2, "cérebro"):** `systemInstruction` tem
  exatamente uma origem de autoria humana — `WhatsAppBotConfig.tsx:568-569`, o `<Textarea>`
  ligado a `activeNode.properties.instruction`. Não existe prompt "de sistema" hardcoded além
  do fallback genérico (`"Você é um atendente cordial e prestativo..."`, :306). Isso significa
  que o item 2 (cérebro) e o item 1 (troca de provider) tocam o MESMO campo de dado
  (`aiNode.properties.instruction`/`bot.system_instruction`) — o item 1 só precisa continuar
  passando esse texto pro provider novo (via `system` da Anthropic, não `systemInstruction`
  aninhado como o Gemini usa), não precisa esperar o item 2 pra funcionar.

---

## 5. Fechamento

### 5.a Arquivos que a migração (item 1) vai tocar

| Arquivo | Tipo de mudança |
|---|---|
| `supabase/functions/whatsapp-bot-reply/index.ts` | Novo branch `provider === "anthropic"` (ou nome equivalente) — maior mudança, ver §5.b |
| `supabase/functions/_shared/retry.ts` | 1 linha — adicionar `529` a `shouldRetry()` (opcional, mas recomendado pra paridade) |
| `src/components/whatsapp/WhatsAppBotConfig.tsx` | Nova opção no dropdown (:610-621) + bloco de credencial condicional (padrão dos existentes, :641-661+) + campos no payload de `isTest` (:304-311) + persistência (:242-246) |
| `supabase/migrations/*.sql` (nova) | Comentário da coluna `provider` (cosmético) — **provavelmente não precisa de coluna nova**: `gemini_api_key TEXT` pode ser reaproveitada como "campo de texto genérico pra key do provider ativo" (já é assim que `vertex_ai` reaproveita `gcp_service_account` em vez de ganhar uma coluna própria) — decisão de design pra Fase B, não deste levantamento. |
| `docs/architecture/kora-hub-auditoria-e-plano.md` | Novo achado/lição, mesmo padrão do G18 |

Nenhum outro arquivo do repo referencia Gemini/Vertex fora dos listados acima (confirmado por
grep exaustivo, §1).

### 5.b Troca mecânica vs. parser novo

**Mecânico (copiar o padrão já existente, baixo risco):**
- Resolução de credencial (payload teste → nó visual → coluna → env var) — mesma cadeia de 4
  níveis dos outros 2 providers Google.
- Uso de `fetchWithRetry` — já genérico.
- Novo item no dropdown + bloco de credencial na UI — mesmo padrão dos 3 existentes.
- Propagação de `reply: string` pro resto do pipeline (`applySendTemplate`, envio via uazapi,
  persistência) — zero mudança, é depois do ponto de convergência (§3).

**Exige parser/desenho novo (o que o molde G18 não cobre, confirmado nesta rodada):**
- Conversão `contents`→`messages` no formato Anthropic (`system` como campo top-level, não
  dentro do array — diferente até do formato OpenAI-like que o Lovable já usa).
- Parse da resposta: iterar `content[]` verificando `type === "text"` antes de ler `.text`
  (nenhum parser existente faz checagem de tipo de bloco).
- Mapeamento de status de erro (`529 overloaded` da Anthropic não existe no vocabulário atual
  de `shouldRetry`/mensagens de erro dos 3 branches).
- Nome/vocabulário de modelo (`claude-*`) — `normalizeGoogleModel()` é específico do Google,
  não serve; precisa de uma função equivalente (ou nenhuma, se não houver aliases legados pra
  mapear, já que é a primeira vez que Claude entra no sistema).

### 5.c Estimativa honesta

**A hipótese "fatia curta" do operador se sustenta, com uma ressalva.** O escopo é
genuinamente pequeno em NÚMERO de arquivos (5, tabela acima) e o sistema já tem 3 exemplos
do mesmo padrão pra copiar (incluindo um, o `lovable`, estruturalmente parecido o bastante
pra servir de molde de verdade, não só de inspiração distante). Não é um redesenho de
arquitetura — é um 4º branch num `if/else if` que já existe, seguindo uma forma já
provada 3 vezes.

A ressalva: **"curta" só se sustenta se o escopo ficar estritamente no item 1** (trocar
provider, manter tudo mais igual — sem histórico truncado por token, sem streaming, sem
tool-use, sem tratar `finishReason`/`stop_reason` de forma mais rica do que os 3 branches
atuais já tratam, que é "nenhuma"). Qualquer uma dessas extensões empurraria a fatia pra mais
perto do item 3 (base de conhecimento) em escopo, não do item 1. Recomendação pra Fase B:
escopar o item 1 explicitamente como "paridade de comportamento com os 3 providers
existentes, nada a mais" — os 4 pontos do §5.b (mecânico) + os 4 do §5.b (parser novo) cabem
numa fatia técnica curta nesse recorte; viram fatia média/longa se ganharem qualquer feature
que os 3 providers atuais não têm hoje.

---

**PARADO aqui — levantamento encerrado, zero código alterado. Fase B (implementação) do item
1 só com novo "vai" do revisor.**
