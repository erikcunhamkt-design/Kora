# Etapa 9 · Item 4 — R7: nó de "mensagem" montável pelo usuário

Branch: `etapa-9-bot-fluxo-r7-no-mensagem` (a partir de `origin/main` = `9dd855c`).
Lane C. Sem DDL/DML (§0/§6): o nó vive em `flow_data` (jsonb já existente) e o
estado de conversa (`bot_flow_state`) **não muda de forma**.

## 1. Por quê

Até a R6 só o nó `menu` era adicionável. Uma árvore real precisa de texto
informativo entre menus — ex.: "Horário: seg–sex 9h–18h" → voltar ao menu. O nó
`menu` obriga a ter opções numeradas e a esperar resposta; o `send` é o template
da resposta da IA (fixo, não montável). Faltava o nó "fala e segue".

## 2. Modelo

```ts
interface MessageWorkflowNode extends WorkflowNodeBase {
  type: "message";
  properties: {
    mensagem: string;        // texto enviado (mesmo nome do campo do menu)
    nextNodeId?: string;     // destino depois de enviar; AUSENTE = encerra o fluxo scriptado
  };
}
```

* Entra na união `WorkflowNode`. Compat total: `flow_data` salvo antes da R7
  não tem nenhum nó `message`; abrir/salvar é idêntico (teste de regressão).
* `nextNodeId` ausente é **estado válido** ("encerra"), não aresta pendente —
  igual à entrada do trigger. Por isso `computeCanvasEdges` só emite a aresta
  quando o campo está preenchido, e apagar a aresta **remove a chave** (não grava
  `""`).
* Decisão de nome: `mensagem` (não `texto`) para ficar igual ao `menu.properties.mensagem`
  e reaproveitar o `RawFlowNode` do motor sem campo novo além de `nextNodeId`.

## 3. Motor (`supabase/functions/_shared/botFlowMenu.ts`)

Mesmo módulo e mesma primitiva da produção e do simulador.

| Peça | O que faz |
|---|---|
| `extractMessageNodes(nodes)` | só `type: "message"` **habilitado** com `mensagem` não vazia; `nextNodeId` vazio/não-string → `undefined` |
| `resolveEntryNode(menus, messages, entryNodeId)` | entrada pode ser menu **ou** mensagem. Mensagem só por aresta explícita; automático continua "primeiro menu habilitado" |
| `resolveMenuTurn(menus, state, text, entryNodeId?, messageNodes = [])` | 5º parâmetro opcional — omitido = comportamento da R6 byte a byte |
| resultado `{ kind: "message", message, state, messageNodeIds, truncated?, unresolvedNextNodeId? }` | resposta única já montada |

Quando a virada alcança um nó `message` (por entrada, opção de menu ou fallback
`acao: "node"` apontando pra ele), `runMessageChain`:

1. acrescenta `mensagem` à resposta;
2. segue `nextNodeId` **na mesma virada**:
   * **menu** → anexa o prompt do menu (separado por linha em branco) e devolve
     `state = { currentNodeId: <menu>, attempts: 0 }`;
   * **outra mensagem** → encadeia;
   * **ausente** → `state = null` (encerra o acompanhamento scriptado);
   * **desconhecido** (outro tipo, removido, desabilitado, texto vazio) → encerra
     com `state = null` e `unresolvedNextNodeId` (o chamador loga).

### Invariantes

* `BotFlowState.currentNodeId` **nunca** aponta pra um nó `message` — a cadeia é
  atômica dentro de uma virada; a coluna `bot_flow_state` continua com o mesmo
  formato.
* **Proteção contra ciclo/rajada:** `visited` (voltou a um nó já enviado →
  `truncated: "cycle"`) e teto `MAX_MESSAGE_HOPS = 5` (`truncated: "hop-limit"`).
  O que foi acumulado é enviado; `state = null`; produção loga `console.warn`.
* Menu → mensagem → **o mesmo menu** é legítimo (aguarda resposta entre as
  voltas); só `message → … → message` sem menu no meio é cíclico dentro da virada.

## 4. Produção (`whatsapp-bot-reply/index.ts`)

* O bloco do menu roda quando há `menu` **ou** `message` habilitado (sem
  nenhum dos dois o bloco continua inteiro sem rodar).
* `kind: "message"` reaproveita o caminho de `present`/`reprompt`:
  `sendBotText(turn.message)` + update **separado** de `bot_flow_state` com
  `turn.state` (menu de destino ou `null`). Sem IA na mesma virada.
* Log de diagnóstico: cadeia truncada e destino desconhecido; aresta de entrada
  inválida agora diz "não é um menu nem uma mensagem habilitada".

## 5. Simulador (`botFlowSimulation.ts`) — paridade

Mesmo gate (`menu` ou `message` habilitado), mesma chamada
`resolveMenuTurn(..., entryNodeId, messageNodes)`. `kind: "message"` responde
como `present`/`reprompt`: `reply = turn.message`, `engine: "menu"`,
`botFlowState = turn.state`. **Nenhuma** mudança em `FlowSimulatorPanel` /
`flowSimulatorModel` (lane D): o rótulo `engine: "menu"` já é consumido por eles.

## 6. UI

* **"+ Adicionar nó de mensagem"** ao lado de "+ Adicionar nó de menu"
  (cria no centro do viewport; título `Mensagem N`; texto vazio).
* **Card** (ciano): ícone, resumo = o texto, 1 handle de saída "Depois de enviar"
  (id `next`), 1 handle de entrada. Não participa da sequência posicional dos
  fixos (não emite nem recebe seta `sequence`).
* **Inspector:** título, texto (aviso quando vazio — o motor ignora o nó),
  "Depois de enviar, ir para" (Select: "Encerrar o fluxo — padrão" + menus e
  outras mensagens; nunca ele mesmo), avisos de destino removido / não-utilizável,
  "Excluir nó" em 2 passos (controle compartilhado com o menu).
* **Trigger → "Começar por"** lista menus **e** mensagens; entrada pra nó que
  não é menu/mensagem habilitado continua avisando.
* **Funções puras (`flowCanvasModel.ts` / `flowCanvasEdges.ts`):**
  `CanvasEdgeKind` ganha `"next"`; `FLOW_HANDLE.next`; `canConnect` (entry →
  menu|mensagem; mensagem → menu|mensagem, nunca a si mesma/trigger/fixo);
  `applyConnection` / `applyEdgeDeletion` (remove a chave); `isNodeDeletable`
  (menu **e** mensagem); `applyNodeDeletion` (limpa `opcoes[].nextNodeId`,
  `fallbackNodeId`, `trigger.nextNodeId` **e** `message.nextNodeId`);
  `resolveDeleteKey` (Delete/Backspace apaga aresta `next` selecionada ou a
  mensagem selecionada). Destino removido → aresta não desenhada + aviso.

## 7. Interpretações a confirmar (revisor)

1. **"Ausente = encerra o fluxo e cai no comportamento atual"** foi implementado
   como: o texto é enviado, o estado é zerado e **não há IA na mesma virada**
   (a próxima mensagem do cliente reentra pelo nó de entrada). Alternativa seria
   enviar o texto *e* deixar a IA responder à mesma mensagem — descartada por
   produzir 2 respostas ("2" respondido pela IA depois do aviso de horário).
2. **Destinos aceitos** pela mensagem: `menu` ou `message`. `handover`/`ai`/`send`
   como destino **não** é suportado nesta rodada (o motor trata como "desconhecido":
   encerra + log). Caso queira "texto de despedida → entregar a humano", é uma
   extensão pequena em `decideHandoverFromMenuTurn` — fora do pedido.
3. Fallback `acao: "node"` apontando pra mensagem passa a **enviar o texto**
   (antes do R7 esse id seria sempre `handover-fallback`, pois o tipo não existia).

## 8. Testes

| Arquivo | Cobre |
|---|---|
| `src/components/whatsapp/__tests__/flowCanvasModel.test.ts` (+bloco R7) | arestas `next`, não-sequência, canConnect/applyConnection/applyEdgeDeletion, isNodeDeletable/applyNodeDeletion/countNodeConnections/resolveDeleteKey |
| `supabase/functions/_shared/__tests__/botFlowMessage.test.ts` (novo) | `extractMessageNodes`, `resolveEntryNode`, cadeia mensagem→menu / sem destino / mensagem→mensagem→menu, entrada, fallback, destino desconhecido, ciclo A→A e A→B→A, teto de saltos (limite exato e estouro) |
| `supabase/functions/_shared/__tests__/botFlowSimulationMessage.test.ts` (novo) | paridade do simulador (mesma decisão, engine `menu`, estado), entrada, ciclo, compat sem mensagens |
| `src/components/whatsapp/__tests__/WhatsAppBotConfig.message-node-ui.test.tsx` (novo) | criação/numeração, inspector, lista "Conexões do fluxo", "Começar por", exclusão, persistência, compat |

Prova fail→fix→pass por patch (sem `git stash`): implementação revertida via
`git checkout -- <7 arquivos>` com os testes novos presentes → **4 arquivos
falhando, 50 testes falhando | 48 passando (98)**; `git apply` do patch → **4/4
arquivos, 98/98**.

## 9. Fora de escopo / não tocado

`FlowSimulatorPanel`, `flowSimulatorModel` (lane D, só consumidos),
`WhatsApp.tsx`, fichas/CRM/Projetos. Nenhuma migration; nenhuma coluna nova.
Homologação visual do canvas (arrastar a saída "Depois de enviar" até um menu no
navegador real) continua sendo do operador — o jsdom não mede nós, então os
testes cobrem o modelo e a lista textual de conexões.
