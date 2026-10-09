# Etapa 9 · Item 4 — R8: destinos "handover" e "ai" a partir de menu/mensagem

Branch: `etapa-9-bot-fluxo-r8-destinos-handover-ai` (a partir de `origin/main` =
`cd5daa5`, que já contém a R7). Lane C. Sem DDL/DML (§0/§6): o modo IA reaproveita
o jsonb `bot_flow_state` (mesmo formato `{ currentNodeId, attempts }`).

## 1. Matriz origem × destino (o que o código faz)

| Origem ↓ / Destino → | **handover** habilitado | **ai** habilitado | desabilitado (qualquer um) |
|---|---|---|---|
| **opção de menu** | entrega a humano — **R4, inalterado** (`advanced-away` → `decideHandoverFromMenuTurn` → `menu_option`; cortesia padrão) | **R3 mantido:** sai do menu (estado zerado) e a IA responde **já**, à mesma mensagem | destino inválido: `advanced-away` + log; **nunca** entrega/passa à IA |
| **fallback `acao:"node"`** | entrega a humano — R4 inalterado (`menu_fallback_node`) | R3 mantido (idem opção) | idem |
| **nó `message`** | **novo:** o texto da mensagem **é** a cortesia e a conversa fica "entregue a humano" (`message_next`) | **novo:** envia o texto (saudação), grava o **modo IA** e a IA responde a partir da **próxima** mensagem | o texto sai; cadeia encerra; `unresolvedNextNodeId` → log |
| **entrada do gatilho** | **recusada** (UI e motor) | **recusada** | — |

"Desabilitado" = `enabled: false` no nó (o fluxo padrão nasce com o handover
desligado). Vale para menu, mensagem, handover e ai: nó desligado nunca age.

## 2. Decisões

### 2.1 Cortesia de `message → handover`
O texto da mensagem **substitui** a cortesia padrão (uma mensagem só, não texto +
cortesia). Para cadeia de várias mensagens, a cortesia é a cadeia inteira
(`"A\n\nB"`). `enterHumanHandover` ganhou o parâmetro opcional `courtesyText`;
omitido = `HANDOVER_COURTESY_TEXT`, igual aos demais gatilhos. O estado persistido
é o do primitivo da R4 (`handover_at` + `bot_flow_state: null`, updates separados).

Mensagem com texto **vazio** continua sendo ignorada (regra da R7: `extractMessageNodes`
só aceita texto não vazio; o inspector avisa). Logo "cortesia padrão se vazio" não
existe como caminho separado: quem quer a cortesia padrão liga a opção/fallback
**direto** ao handover. Decisão: um nó sem texto não é um "passa-adiante invisível";
evita fluxo mudo por engano.

### 2.2 Semântica do destino "ai" (uma só, por origem — como pedido)
* **Direto de opção/fallback → (a):** a IA responde imediatamente à mensagem do
  cliente, como se o menu não existisse. É o comportamento **já existente** da R3
  (e coberto pelos testes da lane D); o R8 só o torna explícito e logado. A IA vê o
  histórico inteiro, inclusive o menu que o bot enviou e o "3" do cliente.
* **De nó `message` → (b):** o texto da mensagem vai como saudação, **sem** IA
  naquela virada; a IA responde a partir da próxima. Concordo com a preferência do
  revisor: a mensagem é exatamente o lugar para o texto de transição ("Certo! Me
  conte o que você precisa.") e a opção direta não tem campo de texto.

### 2.3 ⚠️ "Estado zerado" não basta para "a IA responde dali em diante"
O pedido dizia "estado zerado e a IA passa a responder dali em diante". Com estado
`null` o motor da R3 **reapresenta o menu de entrada** na mensagem seguinte (é o
contrato documentado na R3/R4: "a próxima mensagem reentra no menu"). Então, com
estado zerado, "(b) a IA responde a partir da próxima" **seria falso**: a próxima
mensagem receberia o menu.

Por isso o caminho `message → ai` grava um **marcador de modo IA** em
`bot_flow_state`: `{ currentNodeId: <id do nó ai>, attempts: 0 }`. O motor reconhece
esse estado (`kind: "ai-mode"`): não age, não reapresenta o menu, e o fluxo segue
para o gate "AI node disabled" → palavra-chave de handover → IA, como antes.

* Nó ai desabilitado/removido depois → o marcador vira estado obsoleto e a
  conversa reentra pelo menu (mesmo tratamento de qualquer estado órfão).
* "Devolver ao robô" (`end_human_handover`) já zera `bot_flow_state` → volta ao menu.
* Sem DDL: é o mesmo jsonb, mesma forma.

**Deliberadamente NÃO** estendi o marcador a `opção/fallback → ai` (item "a"): o
pedido diz "estado zerado" nesse caso e há testes da lane D que o afirmam
(`botFlowSimulation.test.ts`, `WhatsAppBotConfig.simulator.test.tsx`: "estado volta a
'fora do menu'"). Consequência a decidir (ver §6): na opção direta a IA responde
**uma vez** e a mensagem seguinte reapresenta o menu; pela mensagem ela fica em
modo IA. Estender é uma mudança de ~10 linhas (devolver `state` no destino ai de
`resolveMenuTurn` + persistir no handler) mais ajuste dos testes/rótulo da lane D.

### 2.4 Entrada não aceita handover/ai
Concordo e reforço: `trigger.nextNodeId → handover` entregaria **toda** conversa
nova a humano; `→ ai` é só o gatilho `respondAll` com outro nome (e anularia o menu).
UI: o "Começar por" só lista menu/mensagem; `canConnect(entry → handover|ai)` é
recusado; motor: `resolveEntryNode` trata como `invalid-edge` (cai no primeiro menu +
log), igual a qualquer entrada inválida.

## 3. Motor

`supabase/functions/_shared/botFlowMenu.ts` (mesmo módulo, mesma primitiva):

| Peça | O que faz |
|---|---|
| `extractTerminalNodes(nodes)` | `{ handoverIds, aiIds }` só dos **habilitados** |
| `resolveMenuTurn(..., messageNodes, terminals)` | 6º parâmetro opcional — omitido = R7 idêntica |
| `MessageTurnResult.destination` | `{ kind: "handover" \| "ai", nodeId }` quando a cadeia fecha num terminal habilitado (`state` = marcador para ai; `null` para handover) |
| `{ kind: "ai-mode" }` | `state.currentNodeId` é um nó ai habilitado: o motor do menu não age |
| `describeDestination(nodes, id)` | só para log: inexistente / DESABILITADO / tipo sem suporte |

`botHandover.ts`: `HandoverReason` ganha `"message_next"`.

## 4. Produção (`whatsapp-bot-reply/index.ts`)

* `terminals = extractTerminalNodes(flowNodes)` passado ao motor.
* `message → handover`: `enterHumanHandover(..., "message_next", turn.message)` e
  retorna `{ ok, handover: true, reason: "message_next" }`.
* `message → ai`: caminho existente de envio + persistência de `turn.state` (o
  marcador). Sem IA na virada.
* `ai-mode`: nenhuma ação do bloco do menu; segue para IA com o estado intacto.
* Logs: destino inválido agora diz **por quê** (`DESABILITADO` / inexistente / tipo).

## 5. Simulador (`botFlowSimulation.ts`) — paridade

Mesma chamada (`resolveMenuTurn(..., terminals)`).
* `message → handover`: `reply = texto da mensagem`, `engine: "handover"`,
  `handoverReason: "message_next"`, `handedOver: true`; a virada seguinte é `silent`.
* `message → ai`: `reply = saudação`, `engine: "menu"`, `botFlowState` = marcador;
  a próxima mensagem devolve `continue` com `engine: "ai"` e o marcador mantido.
* `ai-mode`/desabilitados: como produção.

### Pendência cruzada (lane D — NÃO toquei `flowSimulatorModel`/`FlowSimulatorPanel`)
O contrato do servidor já carrega tudo (`engine`, `handoverReason`, `botFlowState`),
mas a UI da lane D precisa de 2 pequenos acréscimos para mostrar os selos:
1. `HANDOVER_REASON_LABEL` não conhece `message_next` → o selo sai
   "Entregue a atendimento humano" **sem** o motivo (degrada com graça: motivo
   desconhecido vira `undefined`). Sugestão: `message_next: "mensagem do fluxo"`.
2. `describeSimState` trata `botFlowState` que não aponta para um **menu** como
   "Em um menu que não existe mais no fluxo" → para o marcador de modo IA o rótulo
   fica enganoso. Sugestão: `node.type === "ai"` → `{ tone: "ai", label: "Modo IA — a
   IA responde daqui em diante" }`. O selo "passou pra IA" por mensagem pede, além
   disso, um `tag` quando `engine === "ai"` depois de `engine === "menu"` (hoje
   `applySimulationResponse` não etiqueta `ai`).

Sem isso o simulador mostra o texto/handover corretos, mas a linha de estado do
modo IA aparece com o rótulo genérico de menu obsoleto.

## 6. Pontos para o revisor decidir

1. **Estender o modo IA persistido a `opção/fallback → ai`?** (recomendo: sim —
   hoje a IA responde uma vez e o menu volta). Exige atualizar os 4 testes da lane
   D citados e o rótulo da §5.
2. **Saída do modo IA para o cliente:** não há; ele só volta ao menu se o operador
   "devolver ao robô" ou o nó ai for desabilitado. Se quiser uma palavra de saída
   ("menu"), é uma regra nova no motor.
3. Pendências da §5 (lane D).

## 7. UI

* Selects de destino (opção do menu, fallback "Nó de destino", mensagem "Depois de
  enviar, ir para") renderizam cada nó com o **efeito** ao lado do título:
  `apresenta o menu` · `envia o texto e segue` · `entrega a um atendente humano` ·
  `a IA responde daqui em diante` · `sem efeito no fluxo` (gatilho/envio) ·
  `desabilitado — destino inválido`. O título continua em `<span>` próprio.
* Mensagem: o Select agora lista handover e ai; texto de ajuda explica cada um.
* Avisos `role="alert"` para destino **desabilitado** na opção, no fallback e na
  mensagem (o fluxo padrão nasce com o handover desligado — o aviso evita a opção
  "silenciosamente morta").
* "Começar por": inalterado (menu/mensagem).
* Canvas: `canConnect(message.next → handover|ai)` permitido; entrada → terminal
  recusada; arestas `option`/`fallback`/`next` para terminais já são desenhadas.

## 8. Testes e prova

| Arquivo | Cobre |
|---|---|
| `supabase/functions/_shared/__tests__/botFlowDestinos.test.ts` (novo, 26) | matriz origem×destino no motor (4 origens × handover/ai × habilitado/desabilitado), `ai-mode`, marcador órfão, entrada recusada, `extractTerminalNodes`/`describeDestination`, simulador (handover, silêncio posterior, ai→IA na próxima, handover por palavra-chave em modo IA, desabilitados, regressão R3) |
| `src/components/whatsapp/__tests__/flowCanvasModel.destinos.test.ts` (novo) | `canConnect`/`applyConnection`/`applyEdgeDeletion`/arestas para terminais; entrada recusada; fixos não excluíveis |
| `src/components/whatsapp/__tests__/WhatsAppBotConfig.destinos-ui.test.tsx` (novo) | rótulos de efeito nos Selects, aresta `next`→handover, "Começar por" sem terminais, avisos de destino desabilitado (mensagem/opção/fallback) |
| R7 (ajustados) | `flowCanvasModel.test.ts` (message→handover/ai passa a ser válido; send recusado) e `WhatsAppBotConfig.message-node-ui.test.tsx` (lista de destinos e texto do aviso) |

Prova fail→fix→pass por patch (sem `git stash`): ver relatório da rodada.

## 9. Não tocado
`FlowSimulatorPanel`, `flowSimulatorModel`, `knowledgeConsent`/`brainComposer`,
`WhatsApp.tsx`, fichas/CRM/Projetos. Nenhuma migration.
