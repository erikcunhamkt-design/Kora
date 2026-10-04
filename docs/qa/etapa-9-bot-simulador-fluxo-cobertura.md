# Etapa 9 · Item 4 — cobertura do simulador do fluxo ("Simular mensagem")

> **Pergunta da rodada:** o simulador (`WhatsAppBotConfig` → `whatsapp-bot-reply`
> com `isTest: true`) exercita o nó **menu** (R3) e o **handover** (R4)?
>
> **Resposta: NÃO — nem um, nem outro, e o gap é dos DOIS lados.** O lado
> **server** foi corrigido nesta rodada (opt-in, zero regressão pro simulador
> atual). O lado **UI** (`WhatsAppBotConfig.tsx`, Lane C — R6 canvas) **não foi
> tocado**: o contrato pra Lane C incorporar está no §4.

## 1. O que encontrei

### 1.1 Server (`supabase/functions/whatsapp-bot-reply/index.ts`) — CORRIGIDO aqui

No ramo `isTest`, `flowData` era parseado pra `flowNodes` e **só alimentava
`applySendTemplate`** (a aplicação do template do nó "send" na resposta da IA).
O motor do menu (R3) e o handover (R4) vivem inteiramente no ramo de PRODUÇÃO
(`else` do `if (isTest)`) — o simulador nunca passava por eles. Resultado: um
operador que montasse um menu e testasse no simulador via **a IA respondendo,
ignorando o menu**, sem nenhum sinal de que o fluxo scriptado não estava sendo
exercitado.

### 1.2 UI (`src/components/whatsapp/WhatsAppBotConfig.tsx`) — NÃO TOCADO, contrato no §4

| # | Onde | O que acontece | Efeito |
|---|---|---|---|
| U1 | `handleSimulateMessage`, `const aiNode = nodes.find(isAiNode); if (!aiNode) return;` (~:539) | sem nó "ai" a função **retorna em silêncio** — a mensagem do usuário já foi adicionada ao chat, mas nenhuma resposta, nenhum erro | um fluxo **só com menu** (válido pela decisão do operador, R1 §0 item 3) **não pode ser simulado de jeito nenhum** |
| U2 | mesmo handler, `userText.toLowerCase().includes("atendente")` (~:570) | o **handover é fabricado no navegador**: depois da resposta da IA, acrescenta um texto fixo "🔀 [Simulação de Transbordo]…" | diverge do robô real em 4 pontos: (i) só 1 das 7 palavras-chave; (ii) produção **substitui** a resposta da IA pela cortesia, o simulador mostra IA **+** linha extra; (iii) ignora os gatilhos do menu; (iv) "Robô pausado" é só texto — a próxima mensagem volta a chamar a IA |
| U3 | corpo do `invoke` | não manda nem recebe nenhum estado de conversa | mesmo com o server pronto, a UI não consegue "andar" num menu (cada mensagem seria a primeira) |
| U4 | `if (data && data.reply) {...} else { throw new Error("Resposta da IA vazia") }` | `reply` vazio/`null` vira erro vermelho "❌ Falha no fluxo: Resposta da IA vazia" | quando o simulador novo devolver `reply: null` (robô mudo/skip — §3), a UI atual mostraria isso como **falha**; é só um cuidado pro contrato, não é problema hoje (o campo novo é opt-in) |

## 2. O que mudou no server (opt-in — simulador atual intocado)

- **`_shared/botFlowSimulation.ts`** (novo, módulo puro): `simulateFlowTurn(nodes, simState, messageText)`
  roda a **mesma decisão de produção sobre os mesmos primitivos**
  (`extractMenuNodes`/`resolveMenuTurn`/`decideHandoverFromMenuTurn`/
  `matchesHandoverKeyword`), com o estado carregado pelo **cliente** (o
  simulador não tem conversa nem banco — `bot_flow_state`/`handover_at` viram um
  `simState` de ida e volta). Nunca lê/escreve `whatsapp_conversations`.
- **`whatsapp-bot-reply/index.ts`** (+36/−1, produção intocada além de um
  comentário): no ramo `isTest`, **só se o corpo traz `simState`** (qualquer valor
  ≠ `undefined`; `null` na primeira mensagem), chama `simulateFlowTurn`:
  curto-circuita **sem chamar IA** quando o menu/handover/silêncio decide, ou segue
  pro caminho de IA anexando `simulation` à resposta. **Sem `simState`: comportamento
  byte a byte o de antes** — é por isso que a UI atual continua funcionando igual.
- Auth e rate-limit do `isTest` (JWT + membership; bucket `isTest`, 10/min) **não
  mudaram** — as respostas do menu/handover não custam IA, mas ainda contam no bucket.

### 2.1 Ordem espelhada de produção

`simulateFlowTurn` reproduz a sequência do handler de produção:

1. conversa entregue (`handedOver`) → **silêncio**;
2. nó menu habilitado → `present`/`reprompt` respondem o menu (sem IA); os 3 gatilhos
   de handover do menu **entregam**; destino não-handover **sai do menu**. A
   **entrada** segue a aresta do R6: `trigger.properties.nextNodeId` (só com o trigger
   HABILITADO, como em produção) é passado como 4º argumento de `resolveMenuTurn`;
   ausente/inválido/menu desabilitado → primeiro menu habilitado;
3. gate "AI node disabled": fluxo com nós mas sem "ai" habilitado → **skipped**;
4. handover por palavra-chave (nó handover habilitado) → **entrega**;
5. segue pra IA.

**Paridade por construção + comentário, não por orquestração compartilhada:** os
*primitivos* são os mesmos (uma regra mudada em `botFlowMenu.ts`/`botHandover.ts`
vale pros dois lados), mas a *sequência* existe duas vezes (produção tem I/O
intercalado). Há um comentário de aviso no bloco do menu em `index.ts` ("ORDEM
ESPELHADA NO SIMULADOR") e um teste de paridade de ordem (menu responde ANTES da
palavra-chave). **Alternativa considerada e adiada:** fazer produção também chamar
`simulateFlowTurn` (uma só orquestração). Rejeitada nesta rodada pelo risco de
regressão no caminho vivo (a palavra-chave em produção lê o texto de um SELECT
posterior; unificar exigiria reordenar I/O) — candidata a rodada própria se a
divergência de sequência virar problema.

## 3. Contrato do corpo (request/response) — `isTest: true` + `simState`

**Request** (campos novos em **negrito**; os demais são os de hoje):

```jsonc
{
  "isTest": true,
  "workspaceId": "<uuid>",
  "messageText": "2",
  "history": [ /* como hoje */ ],
  "flowData": [ /* nodes do construtor, como hoje (inclui nós "menu") */ ],
  "systemInstruction": "...", "provider": "...", "modelName": "...",   // só usados quando engine === "ai"
  "simState": { "botFlowState": null, "handedOver": false }             // **NOVO, opt-in** (null também opta)
}
```

**Response** (quando `simState` veio): `{ ok: true, reply: string | null, simulation: {...} }`

```jsonc
"simulation": {
  "engine": "menu" | "handover" | "silent" | "skipped" | "ai",
  "handoverReason": "keyword" | "menu_option" | "menu_fallback_node" | "menu_exhausted", // só se engine === "handover"
  "botFlowState": { "currentNodeId": "<id>", "attempts": 0 } | null,  // → vira simState.botFlowState da PRÓXIMA mensagem
  "handedOver": false | true                                           // → vira simState.handedOver da PRÓXIMA mensagem
}
```

| `engine` | `reply` | Significa |
|---|---|---|
| `menu` | texto do menu / reprompt | motor do menu respondeu, **sem IA** |
| `handover` | texto de cortesia (o mesmo de produção) | entregue a humano; `handedOver: true` daqui em diante |
| `silent` | `null` | já estava entregue — robô mudo (nada a mostrar além de um aviso) |
| `skipped` | `null` | fluxo com nós mas sem nó "ai" habilitado — produção também não responderia |
| `ai` | resposta da IA | seguiu o caminho de IA; `simulation` acompanha só pra devolver o estado |

## 4. Contrato pra Lane C incorporar na UI (`WhatsAppBotConfig.tsx`, R6 canvas) — NÃO implementado aqui

1. **Manter `simState` no componente** (`useState`), começando em
   `{ botFlowState: null, handedOver: false }`; **enviar em toda mensagem** do
   simulador; **depois de cada resposta, substituir** por
   `{ botFlowState: data.simulation.botFlowState, handedOver: data.simulation.handedOver }`.
2. **Não dar `return` silencioso sem nó "ai"** (U1): quando o fluxo tem nó menu (ou
   qualquer nó), chamar o server mesmo assim. Os campos de provider/credencial só
   importam quando `engine === "ai"` — sem nó "ai", mandar `null`/omitir; o server
   responde `skipped` sozinho se de fato não há IA habilitada.
3. **Renderizar por `engine`**: `menu`/`ai` → bolha do robô com `reply`; `handover` →
   bolha com `reply` **+** marca "Entregue a humano" (rótulo por `handoverReason`:
   `keyword` "palavra-chave", `menu_option` "opção do menu", `menu_fallback_node`
   "fallback do menu", `menu_exhausted` "tentativas esgotadas"); `silent` → linha de
   sistema "Robô em silêncio — conversa entregue a humano"; `skipped` → linha de
   sistema "Fluxo sem nó de IA habilitado — nada a responder".
4. **Tratar `reply: null` como estado, não como erro** (U4): hoje `data.reply` falsy
   vira "Resposta da IA vazia"; com `simState` isso é `silent`/`skipped` válidos.
5. **Remover o handover fabricado no navegador** (U2): a UI não deve mais montar
   "[Simulação de Transbordo]" por conta própria — `simulation.engine === "handover"` é a
   fonte de verdade (7 palavras-chave reais + gatilhos do menu + entrega persistente).
6. **Botão "limpar" do simulador** (o `RefreshCw`) **e** um "Devolver ao robô"
   simulado = **resetar `simState`** pro inicial (o simulador não tem banco; devolver é
   só zerar o estado local — espelha a ação `end_human_handover` de produção).
7. Se algum dia a UI **não** quiser o simulador do fluxo (modo legado), basta **não**
   mandar `simState` — comportamento antigo preservado.

> **Pós-R6 (paridade de entrada):** `simulateFlowTurn` passou a repassar
> `trigger.properties.nextNodeId` como 4º argumento de `resolveMenuTurn`, igual a
> `whatsapp-bot-reply/index.ts` (que lê `triggerNode?.properties?.nextNodeId`). Antes
> disso o simulador ignorava a aresta de entrada e sempre entrava pelo primeiro menu —
> divergindo de produção num fluxo com a aresta apontando outro menu. Cobertura: 8
> testes novos (entrada válida, ausente, inválida ×5 formas, menu desabilitado, trigger
> desabilitado, re-entrada de estado órfão, estado válido não reaplica a entrada, fluxo
> completo); fail→fix→pass por patch: 3 falham sem o 4º argumento (os que dependem da
> entrada), os 5 de fallback valem nos dois estados por desenho.

## 5. Testes

`supabase/functions/_shared/__tests__/botFlowSimulation.test.ts` — **30 testes**, mocks
puros: contrato de opt-in (`undefined` não opta; `null` opta), `parseSimState`
defensivo, motor do menu (1ª mensagem, encadeamento, reprompt com contador, saída
pra nó não-handover), handover (3 gatilhos do menu, nó handover desabilitado, silêncio
enquanto entregue, devolução = estado zerado, palavra-chave com/sem nó habilitado,
**paridade de ordem**: menu responde antes da palavra-chave), fluxo só-menu sem IA,
gate "AI node disabled", fluxo sem menu/sem nós (zero regressão pro bot IA).

**Prova fail→fix→pass por patch (G65, sem `git stash`):** `git add -N` → `git diff` →
`git checkout --` (esvazia o módulo) → `vitest run`: **22/22 falharam**
(`simulateFlowTurn/parseSimState/wantsFlowSimulation is not a function`) → `rm` do
esvaziado + `git apply` do mesmo patch → **22/22 passaram**.

O wiring em `index.ts` não tem teste direto — mesma disciplina do resto dessa function
(`Deno.serve` sem harness; toda a decisão está no módulo testado, o `index.ts` só
faz I/O). Cuidado de segurança do wiring: o bloco só executa com `simState` no corpo
e **depois** de auth + rate-limit, que não foram alterados.

## 6. Fora de escopo

- **UI do simulador** (`WhatsAppBotConfig.tsx`) — Lane C, contrato no §4.
- Refatorar produção pra usar a mesma orquestração (§2.1, adiado).
- Persistir qualquer coisa do simulador no banco (decisão: o simulador **nunca**
  toca em `whatsapp_conversations`).

**PARADO aqui — simulador do fluxo coberto no server (opt-in), contrato da UI
reportado, zero DDL/deploy, zero push/merge. §18.**
