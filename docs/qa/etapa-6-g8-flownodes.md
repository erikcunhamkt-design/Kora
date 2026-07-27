# Etapa 6 · G8 — `flowNodes`/Send Node em `whatsapp-bot-reply` — Fase A (diagnóstico + harness)

> **Escopo desta rodada:** só leitura + este documento. Nenhum fix, nenhum teste,
> nenhuma alteração de código. Base: `main` @ `39fa5c2`, branch de trabalho
> `etapa-6-g8-flownodes`.

---

## 1. Confirmação do diagnóstico no código atual

O bug **continua presente, exatamente como catalogado**, sem nenhum desvio de linha:

- `let flowNodes: BotFlowNode[] = [];` — declarado em
  [`supabase/functions/whatsapp-bot-reply/index.ts:316`](../../supabase/functions/whatsapp-bot-reply/index.ts#L316),
  dentro do branch `else` (execução normal, disparada pelo webhook) de
  `if (isTest) { ... } else { ... }`.
- Esse `else` **fecha em `index.ts:455`**.
- A referência problemática está em
  [`index.ts:592`](../../supabase/functions/whatsapp-bot-reply/index.ts#L592):
  `const sendNode = flowNodes.find((n: any) => n.type === "send" && n.enabled);`,
  dentro do `try { ... } catch (e) { console.warn(...) }` que monta `finalReply`
  (linhas 590-603). Esse bloco é um **irmão** do `else` — não descendente —, e
  roda **incondicionalmente** para os dois modos (`isTest` e normal), pois o
  código dos dois branches se reencontra na linha 456 antes de chegar lá.
- Resultado: em `let`/`const` (escopo de bloco), `flowNodes` **não existe** nesse
  ponto em nenhum dos dois caminhos → `ReferenceError: flowNodes is not defined`,
  sempre. O `catch` engole o erro e só loga um `console.warn`; `finalReply`
  permanece igual a `reply` (resposta crua da IA).

**Por que nenhum gate hoje pega isso** (confirmado, não suposição):

| Gate no CI | Cobre `supabase/functions/`? | Pegaria este bug? |
| :-- | :-- | :-- |
| `tsc -p tsconfig.app.json --noEmit` | Não — `include: ["src"]` (`tsconfig.app.json:36-38`) | — |
| `npm run test` (Vitest) | Não — `vitest.config.ts` só inclui `src/**/*.{test,spec}.{ts,tsx}` | — |
| `node scripts/lint-gate.mjs` (ESLint) | **Sim** — `eslint.config.js` usa `files: ["**/*.{ts,tsx}"]`, sem `ignore` para `supabase/` | **Não**, e isso é verificável: rodei `npx eslint supabase/functions/whatsapp-bot-reply/index.ts` agora e ele **acusa exatamente a linha 592**, mas só por `@typescript-eslint/no-explicit-any` (o cast `(n: any)`) — regra puramente sintática, sem resolução de escopo/tipo. `no-undef` fica desligado para arquivos TS no preset do `typescript-eslint` (delega para o `tsc`, que não cobre esta pasta). Esse erro de `any` já está contado dentro do teto legado (`ci/lint-baseline.json`: `maxErrors: 34`, `maxAny: 34`, medido em 2026-07-23) — não bloqueia o CI, é debt "normal".

Ou seja: **três gates, três motivos diferentes e independentes** para não pegar o
bug — nenhum é a causa isolada; a correção real depende do harness (§3), não de
ajustar um gate existente.

---

## 2. Blast radius

**O que o usuário vê hoje, em produção:**

O nó "Enviar Mensagem" (Send Node) do construtor visual
(`src/components/whatsapp/WhatsAppBotConfig.tsx:91-97`) é criado com
`properties.template = "{{reply}}"` por padrão, e é um **nó núcleo que não pode
ser desabilitado** (`toggleNodeEnabled`, `index.ts:204-213`: bloqueia
`node-trigger` e `node-send` explicitamente). Isso muda o raio do impacto:

- Se o operador **nunca customizou** o template (deixou `"{{reply}}"`), o
  resultado do fallback buggy (`finalReply = reply`) é **idêntico bit-a-bit** ao
  resultado correto (`template.replace("{{reply}}", reply)` sobre um template
  que É só `"{{reply}}"` também dá `reply`). **Nenhuma diferença observável.**
- O impacto real só aparece para workspaces que **customizaram** o template —
  ex.: prefixo/assinatura fixa, saudação, texto estático fora do `{{reply}}`.
  Esses casos recebem a resposta crua da IA, sem o wrapper configurado, **sem
  aviso** (é exatamente o cenário descrito no G8 original).
- **Quantos workspaces têm template customizado hoje:** não dá para saber sem
  consultar o banco (fora do escopo desta rodada, só leitura de código). Query
  pronta para o operador rodar, se quiser dimensionar antes da Fase B:
  ```sql
  select workspace_id, is_active,
         flow_data -> (select ordinality-1 from jsonb_array_elements(flow_data) with ordinality e(v, ordinality) where v->>'type'='send' limit 1) as send_node
  from public.whatsapp_bot_settings
  where flow_data is not null;
  -- ou, mais simples: filtrar client-side workspaces onde o nó "send" tem
  -- properties.template <> '{{reply}}'.
  ```

**Modo `isTest` (simulador/playground) também é afetado — mas de forma inócua hoje:**

O simulador em `WhatsAppBotConfig.tsx:300-313` (`handleSimulateMessage`) chama
a function com `isTest: true`, mas o payload **nunca inclui `flow_data`/`nodes`**
— só `systemInstruction`, `provider`, `modelName`, credenciais e histórico. Ou
seja: mesmo sem o bug do G8, o simulador **hoje não tem como** exercitar/pré-
visualizar o template do Send Node. O `ReferenceError` na linha 592 também
dispara no modo `isTest` (o nome `flowNodes` não existe em nenhum escopo
alcançável ali, independente do branch), mas como o simulador não manda dados
de fluxo mesmo, o efeito prático é nulo — **gap pré-existente e separado**, vale
registrar para a Fase B decidir se entra no mesmo fix ou fica para depois.

**Outros bugs da mesma classe (escopo) na função inteira:**

Rastreei manualmente cada `let`/`const` declarado dentro do `else` (282-455)
contra seus usos:

| Variável | Declarada em | Usada até | Fora do bloco? |
| :-- | :-- | :-- | :-- |
| `flowNodes` | 316 | 449 (dentro) **e 592 (fora, bug)** | **Sim — único caso** |
| `triggerNode`, `aiNode`, `handoverNode` | 327-330 | dentro do próprio `else` | Não |
| `sendNode` (1ª declaração, 329) | 329 | **nunca usada** depois — dead code, mascarado pela 2ª declaração homônima na 592 | Não (mas é lixo) |
| `respondAll`, `isUnrestricted`, `hasFlowData` | 332/335/341 | dentro | Não |
| `instData`/`instErr`, `history`, `ordered` | 347/363/370 | dentro | Não |

`conv` e `instance` (usados depois da linha 455, ex. 610/614) **não têm esse
problema** porque foram deliberadamente declarados no escopo externo (linhas
246-247), fora do `if/else` — o padrão certo que `flowNodes` deveria ter
seguido. **Não achei nenhuma outra ocorrência da mesma classe de bug** nesta
função — é um caso isolado.

---

## 3. Decisão de harness (estrutural)

**Estado atual confirmado:** zero tooling Deno no repo — sem `deno.json`, sem
step de Deno no `.github/workflows/ci.yml` (só `actions/setup-node` +
`npm ci` + `tsc` + `lint-gate` + `npm run test`), sem nenhum arquivo
`*.test.ts`/`*_test.ts` sob `supabase/`. O CI só sabe rodar Node/Vitest hoje.

**Opções:**

**(a) Deno test nativo.** Escrever `*_test.ts` com o runner/asserts do Deno,
rodando a function (ou helpers exportados dela) direto. Prós: testa o runtime
real, sem extrair nada. Contras: precisa introduzir um **segundo toolchain**
no CI do zero (novo step `denoland/setup-deno`, novo lockfile/config) —
exatamente o tipo de gate novo que, se não for mantido, apodrece em silêncio
(a própria lição do G9 é sobre isso).

**(b) Extrair a lógica pura para um módulo TS testável via Vitest.** A parte
que importa (achar o nó habilitado por `type`, aplicar o template do Send
Node) não toca `Deno.*`, não toca rede, não toca banco — é substituição de
string e busca em array. Extrair para um módulo sem `npm:`/`Deno.*`
(ex.: `supabase/functions/_shared/botFlowTemplate.ts`), a Edge Function vira
casca fina que importa essa função, e o teste roda via `npm run test`
(já gatilhado no CI). Custo único: adicionar um glob ao
`test.include` de `vitest.config.ts` (hoje só `src/**/*.{test,spec}.{ts,tsx}`)
para pegar `supabase/functions/**/*.{test,spec}.ts` — mudança de 1 linha,
visível no PR, não um gate que nasce quieto.

**(c) Harness de integração (subir a function via subprocesso/`Deno.serve`
real e bater com `fetch` no CI).** Desproporcional para um bug que é, no
fundo, substituição de string — exigiria mockar `createClient`/Postgres/env
vars de credencial de IA só para chegar na linha que importa.

**Recomendação: (b).** Reaproveita 100% do CI já existente (nenhum toolchain
novo), segue o padrão que o repo já usa em outros lugares (`quoteMapper.ts`,
hooks com `__tests__/*.test.ts` colocados) e é o único caminho que satisfaz
sem gambiarra o critério "fix vem com teste de regressão executável no CI".
Ponto em aberto para a Fase B decidir explicitamente (não decido aqui): se o
gate de `tsc` (`tsconfig.app.json`, hoje `include: ["src"]`) deve ou não ser
ampliado para também cobrir `supabase/functions/_shared/` — Vitest usa
`esbuild` para strip de tipos (não faz type-check completo), então sem essa
ampliação o módulo extraído fica com checagem de tipo só parcial em CI.

---

## 4. Fronteira com o G5 (rate limit)

`whatsapp-bot-reply/index.ts` **não tem nenhum código de rate limit hoje**
(confirmado por leitura integral do arquivo) — G5 ainda não foi tocado nesta
function. O harness recomendado em §3 (extrair lógica pura para
`supabase/functions/_shared/`, testar via Vitest, 1 linha de glob) **serve
para os dois**: a lógica de quota/janela do G5 (decidir se uma chamada está
dentro do limite dado um contador e uma janela de tempo) é igualmente pura e
caberia no mesmo padrão (ex. `_shared/rateLimit.ts`), reaproveitando o glob já
ampliado — sem precisar decidir harness de novo.

**Recomendação de recorte: G8 + harness nesta rodada, G5 na seguinte**
(confirma o default sugerido no pedido). Motivos:

- G8 é um bug isolado, com repro concreto e fix de escopo mínimo (hoisting).
  G5 é feature nova — exige desenho de schema (tabela de contadores/janela),
  decisão de política (quota por workspace? por função? por minuto/hora?) —
  trabalho de escopo maior que não deveria compartilhar commit/PR com uma
  correção de bug.
- O custo caro do harness (decidir a estratégia, ajustar o `vitest.config.ts`)
  é pago **uma vez** nesta rodada; a rodada do G5 só reaproveita o padrão já
  validado, sem re-discussão estrutural.

---

## 5. Riscos de deploy

- **Deploy é 100% manual, sem CI/CD.** `.github/workflows/` só tem `ci.yml`
  (type-check + lint-gate + testes) — **nenhum step de deploy**. O padrão
  documentado no repo (`docs/integrations/SUPABASE-WHATSAPP-INBOX-V1.md:74-75`)
  é `npx supabase functions deploy <nome-da-função>`, rodado manualmente.
- **Credencial:** esse comando exige o Supabase CLI autenticado
  (`supabase login` / `SUPABASE_ACCESS_TOKEN`) contra o projeto
  `ewamvzncsloagtcvkbxv` (`supabase/config.toml:1`). É credencial do
  **operador**, não algo que a Lane C tem ou deveria ter — deploy do fix,
  quando vier, é ação do operador, não do Code.
- **`verify_jwt`:** `whatsapp-bot-reply` não tem override em
  `supabase/config.toml` (só `whatsapp-official-webhook` tem, `verify_jwt =
  false`) — fica no default da plataforma (`true`). Não é um risco novo
  trazido por este fix, só registro de contexto.
- **Homologar sem afetar o bot em produção:** a function já tem um modo
  `isTest` desenhado pra isso — não envia via uazapi, não grava em
  `whatsapp_messages`/`whatsapp_conversations`, só retorna `{ ok: true, reply
  }` (`index.ts:605-607`). **Mas hoje esse modo é cego pro bug exato do G8**,
  porque o simulador (`WhatsAppBotConfig.tsx:300-313`) nunca manda `flow_data`
  no payload (§2). Duas opções para homologar o fix de verdade, a decidir na
  Fase B:
  1. Estender o payload do `isTest` para incluir os `nodes`/`flow_data` do
     simulador — mudança pequena, mantém tudo em modo seguro (sem side
     effect), e de quebra fecha o gap "simulador não prevê o Send Node"
     apontado no §2.
  2. Sem isso, homologar via instância/conversa **descartável** (dado
     sintético, nunca real), seguindo o padrão já estabelecido em
     `docs/qa/protocolo-homologacao.md` (§11, registros `HOMOLOG-*`
     sintéticos, nunca vínculo com dado real) — envolve disparo real via
     uazapi para um número de teste.
  - Recomendo (1) por ser mais barato, mais seguro (zero side effect) e
    resolver dois problemas com uma mudança — mas é decisão de Fase B, não
    desta rodada.

---

## 6. Fase B — fix aplicado (rodada "vai" do revisor)

**Branch:** `etapa-6-g8-flownodes`. Um commit por item, na ordem do design:

| Commit | O que |
| :-- | :-- |
| `ad1ee7f` | Extração: `supabase/functions/_shared/botFlowTemplate.ts` — `findEnabledNode`/`applySendTemplate`, sem `Deno.*`/`npm:`. |
| `f6496a9` | Fix do G8: `flowNodes` movido para o escopo externo (junto de `conv`/`instance`); `finalReply` passa a usar `applySendTemplate`; removido o `(n: any)` da linha 592 original e a `const sendNode` morta da linha 329. |
| `2db6a38` | Harness: `vitest.config.ts` ganha um segundo glob (`supabase/functions/**/*.{test,spec}.ts`) sem tocar o gate de `tsc` (segue só `src/`, decisão registrada no §3); 8 testes novos em `_shared/__tests__/botFlowTemplate.test.ts` cobrindo template customizado (regressão G8), template default (documenta por que era invisível), template estático, ausência de flow_data, nó desabilitado, e `findEnabledNode` isolado. |
| `032c31d` | Simulador: `isTest` aceita `flowData` opcional (mesmo parse best-effort do modo normal); `WhatsAppBotConfig.tsx` manda os `nodes` atuais no payload do playground. |

**Gates:**

- `npx tsc -p tsconfig.app.json --noEmit` → **0 erros**.
- `npx vitest run` → **265/265** (257 preexistentes + 8 novos), 29 arquivos de teste.
- `npm run build` (Vite) → build limpo (só o warning pré-existente de chunk size, não relacionado).
- Lint (`node scripts/lint-gate.mjs`): o `any` da linha 592 saiu junto com o fix (não era coincidência — era o próprio bug, mal-tipado). Contagem real caiu de **34→33** em ambos os contadores. Por convenção do próprio `ci/lint-baseline.json` ("quando corrigir dívida legada, baixe o teto na mesma PR"), **o teto foi apertado para 33/33 nesta rodada** (`measuredOn` atualizado para 2026-07-27). Gate roda verde exatamente no novo teto — zero folga, então qualquer PR futura que reintroduza `any`/erro já falha.

**Nenhum deploy foi feito.** A Edge Function publicada continua rodando o código antigo (com o bug) até o operador rodar o deploy — ver §7.

---

## 7. Plano de deploy (fase separada — não executar sem "vai" próprio)

**O que muda no deploy:** só `supabase/functions/whatsapp-bot-reply/index.ts` e o novo
`supabase/functions/_shared/botFlowTemplate.ts` precisam ir ao ar — nenhuma migration,
nenhuma mudança de schema. O frontend (`WhatsAppBotConfig.tsx`) já vai no próximo build
normal do app (Vercel/host do SPA), não passa pelo `supabase functions deploy`.

**Passo a passo (operador, credencial própria):**

1. `supabase login` (se a sessão não estiver autenticada) — token do operador, nunca da Lane C.
2. `npx supabase functions deploy whatsapp-bot-reply --project-ref ewamvzncsloagtcvkbxv`
   — o CLI empacota `index.ts` **e** `_shared/` junto (import relativo resolvido em build).
3. Merge/deploy do frontend (`WhatsAppBotConfig.tsx`) pelo pipeline normal do SPA.

**Homologação antes de liberar (sem afetar o bot de produção):**

1. Abrir o construtor de fluxo visual (`WhatsAppBotConfig.tsx`) em um workspace de teste.
2. No nó "Enviar Mensagem", trocar o template default por algo customizado
   (ex.: `"Oi! {{reply}} — Att, equipe"`), **sem salvar/publicar** (o simulador roda sobre
   o estado local dos `nodes`, ainda não persistido).
3. Rodar uma mensagem no simulador (agora manda `flowData`, item 4). **Esperado pós-deploy:**
   a resposta do simulador vem com o template aplicado, não a resposta crua da IA.
   **Pré-deploy** (função antiga ainda no ar): o simulador roda a mesma função de sempre —
   sem o fix, se o `isTest` antigo não tinha o parse de `flowData`, o teste simplesmente
   não muda nada visível (comportamento idêntico ao de hoje) até o deploy acontecer.
4. Esse fluxo usa exclusivamente o modo `isTest` — não dispara `uazapi`, não grava em
   `whatsapp_messages`/`whatsapp_conversations` (`index.ts:605-607`). **Zero side effect**,
   nenhum dado sintético precisa ser criado/limpo, diferente do runbook padrão de
   `protocolo-homologacao.md` (§11) — este caso é mais simples que a média.
5. Só depois da confirmação visual no simulador, o operador decide se quer também validar
   com uma conversa real (`isTest: false`) — recomendo pular esse passo dado que o simulador
   já cobre o caminho exato do bug; só faria sentido se o operador quiser ver o disparo real
   via uazapi por outros motivos.

**Reversão se der errado:**

- **Sem downtime a reverter de banco** — não há migration nesta rodada.
- Reverter a function: `git revert` dos commits `f6496a9`/`ad1ee7f`/`032c31d` (ou checkout
  do commit anterior do arquivo) + `supabase functions deploy whatsapp-bot-reply` de novo
  com o código revertido. Como o fix é puramente de escopo/lógica (sem mudança de shape de
  dado gravado), reverter é seguro a qualquer momento, inclusive depois de mensagens reais
  terem sido enviadas com o fix ativo — não há estado a des-migrar.
- Se o problema for só no `_shared/botFlowTemplate.ts` (ex. edge case não coberto pelos 8
  testes), dá pra reverter só a lógica interna do módulo sem tocar no resto do fix de escopo
  — os dois ficaram em commits separados (`ad1ee7f` vs `f6496a9`) exatamente para permitir
  isso, mas nesse caso o `import` de `f6496a9` ficaria quebrado — na prática, reverter os
  três juntos é o caminho limpo.

**Autorização:** este deploy só roda com um "vai" literal e explícito do revisor, e é o
operador quem executa (credencial própria, fora desta sessão) — nenhuma ação de deploy foi
tomada nesta rodada.
