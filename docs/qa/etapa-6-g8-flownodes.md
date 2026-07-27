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
