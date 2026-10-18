# Etapa 9 · Item 4 — R8: destinos "handover" e "ai" a partir de menu/mensagem

Branch: `etapa-9-bot-fluxo-r8-destinos-handover-ai` (a partir de `origin/main` =
`cd5daa5`, que já contém a R7). Lane C. Sem DDL/DML (§0/§6): o modo IA reaproveita
o jsonb `bot_flow_state` (mesmo formato `{ currentNodeId, attempts }`).

## 1. Matriz origem × destino (o que o código faz)

| Origem ↓ / Destino → | **handover** habilitado | **ai** habilitado | desabilitado (qualquer um) |
|---|---|---|---|
| **opção de menu** | entrega a humano — **R4, inalterado** (`advanced-away` → `decideHandoverFromMenuTurn` → `menu_option`; cortesia padrão) | **modo IA (ajuste):** a IA responde **já**, à mesma mensagem, e a conversa **fica** em modo IA (marcador em `bot_flow_state`) | destino inválido: `advanced-away` + log; **nunca** entrega/passa à IA |
| **fallback `acao:"node"`** | entrega a humano — R4 inalterado (`menu_fallback_node`) | modo IA (idem opção) | idem |
| **nó `message`** | **novo:** o texto da mensagem **é** a cortesia e a conversa fica "entregue a humano" (`message_next`) | **novo:** envia o texto (saudação), grava o **modo IA** (mesmo marcador) e a IA responde a partir da **próxima** mensagem | o texto sai; cadeia encerra; `unresolvedNextNodeId` → log |
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

### 2.2 Semântica do destino "ai" (uma por origem na MESMA virada; a mesma persistência nas três)
* **Direto de opção/fallback → (a):** a IA responde imediatamente à mensagem do
  cliente, como se o menu não existisse (a IA vê o histórico, inclusive o menu que o
  bot enviou e o "3" do cliente).
* **De nó `message` → (b):** o texto da mensagem vai como saudação, **sem** IA
  naquela virada; a IA responde a partir da próxima. A mensagem é o lugar do texto de
  transição ("Certo! Me conte o que você precisa."); a opção direta não tem campo de texto.
* **Nas três origens a conversa FICA em modo IA** (§2.3) até devolução ou estado órfão.

### 2.3 Modo IA persistido (marcador) — consistente entre as 3 origens
Com estado `null` o motor da R3 **reapresenta o menu de entrada** na mensagem
seguinte (contrato da R3/R4). Para "a IA responde dali em diante" a conversa grava um
**marcador de modo IA** em `bot_flow_state`:
`{ currentNodeId: <id do nó ai>, attempts: 0 }` — mesmo jsonb/forma, sem DDL.
Origens que o gravam: opção de menu → ai (`to-ai`), fallback `acao:"node"` → ai
(`to-ai`) e nó `message` → ai (`destination: ai`). O motor reconhece o estado
(`kind: "ai-mode"`): não age, não reapresenta o menu, e o fluxo segue pelos gates de
sempre (nó ai habilitado → palavra-chave de handover → IA).

* Nó ai desabilitado/removido depois → o marcador vira estado órfão e a conversa
  reentra pelo menu (mesmo tratamento de qualquer estado que aponta pro nada).
* "Devolver ao robô" (`end_human_handover`) já zera `bot_flow_state`.
* Nó ai **desabilitado** como destino = destino inválido: nenhum marcador é gravado.
* Sem saída para o cliente: só volta ao menu por devolução do operador ou nó ai desabilitado.

#### Divergência deliberada vs. testes da lane D (contrato mudou por decisão do revisor)
A primeira versão do R8 manteve "opção/fallback → ai = estado zerado" (R3) porque o
pedido dizia "estado zerado" e testes da lane D o afirmam. Por decisão do revisor o
marcador foi **estendido** às 3 origens. Testes que afirmavam "estado volta a 'fora do
menu'" foram atualizados — a propriedade que protegem (**paridade simulador↔produção:
o simulador devolve a mesma decisão do motor**) permanece, agora provada também por
um teste de paridade nas 3 origens:

| Teste | Antes | Agora |
|---|---|---|
| `botFlowSimulation.test.ts` · opção → ai | `botFlowState: null` | marcador `{node-ai,0}` + `enteredAi` |
| `botFlowSimulation.test.ts` · fallback `node` → ai | `botFlowState: null` | marcador + `enteredAi` |
| `botFlowSimulation.test.ts` · entrada → opção → ai | `botFlowState: null` | marcador + `enteredAi` |
| `WhatsAppBotConfig.simulator.test.tsx` · opção → ai | estado "Fora do menu" | "Conversa com a IA — robô scriptado encerrado" + selo |
| `flowSimulatorModel.test.ts` · estado órfão | `node-ai` habilitado = "não existe mais" | `node-ai` **desabilitado** = "não existe mais" (habilitado = modo IA) |

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
| `{ kind: "to-ai", nodeId, state }` | opção/fallback → nó ai habilitado: `state` é o marcador de modo IA; a IA responde já |
| `{ kind: "ai-mode" }` | `state.currentNodeId` é um nó ai habilitado: o motor do menu não age |
| `describeDestination(nodes, id)` | só para log: inexistente / DESABILITADO / tipo sem suporte |

`botHandover.ts`: `HandoverReason` ganha `"message_next"`.

## 4. Produção (`whatsapp-bot-reply/index.ts`)

* `terminals = extractTerminalNodes(flowNodes)` passado ao motor.
* `message → handover`: `enterHumanHandover(..., "message_next", turn.message)` e
  retorna `{ ok, handover: true, reason: "message_next" }`.
* `message → ai`: caminho existente de envio + persistência de `turn.state` (o
  marcador). Sem IA na virada.
* `to-ai` (opção/fallback → ai habilitado): persiste o marcador (update separado,
  degradando com warn se a coluna não existir) e **segue** pro fluxo normal — a IA
  responde já.
* `ai-mode`: nenhuma ação do bloco do menu; segue para IA com o estado intacto.
* Logs: destino inválido agora diz **por quê** (`DESABILITADO` / inexistente / tipo).

## 5. Simulador (`botFlowSimulation.ts`) — paridade

Mesma chamada (`resolveMenuTurn(..., terminals)`).
* `message → handover`: `reply = texto da mensagem`, `engine: "handover"`,
  `handoverReason: "message_next"`, `handedOver: true`; a virada seguinte é `silent`.
* `message → ai`: `reply = saudação`, `engine: "menu"`, `botFlowState` = marcador,
  `enteredAi: true`; a próxima mensagem devolve `continue` com `engine: "ai"` e o
  marcador mantido.
* `opção/fallback → ai`: `continue` com `engine: "ai"`, marcador e `enteredAi: true`.
* `ai-mode`/desabilitados: como produção.

### Rótulos do simulador (edição cruzada autorizada, mínima — `flowSimulatorModel.ts`)
`FlowSimulatorPanel` **não** foi editado (o tom novo `"ai"` cai no estilo neutro do
painel).
1. `HANDOVER_REASON_LABEL` ganhou `message_next: "mensagem do fluxo"` → selo
   "Entregue a atendimento humano · mensagem do fluxo".
2. `describeSimState` reconhece o marcador (nó ai **habilitado**): tom `"ai"`, rótulo
   "Conversa com a IA — robô scriptado encerrado". Nó ai desabilitado/removido continua
   no aviso de estado órfão.
3. Selo "Passou para a IA — robô scriptado encerrado" na virada que passou a conversa à
   IA. **Em vez de inferir "menu→ai" no cliente** (o id do estado não diz o tipo do
   nó, e a mensagem→ai chega com `engine: "menu"`), o servidor marca a virada com
   `simulation.enteredAi: true` (opcional; só presente nessa virada) e a UI etiqueta a
   bolha — vale para a resposta da IA (opção/fallback) e para a saudação (mensagem).
   As mensagens seguintes em modo IA saem sem selo.

## 6. Pontos em aberto

1. **Saída do modo IA para o cliente:** não há; se quiser uma palavra de saída ("menu"), é regra nova no motor.

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
| `supabase/functions/_shared/__tests__/botFlowDestinos.test.ts` (novo) | matriz origem×destino no motor (4 origens × handover/ai × habilitado/desabilitado), `ai-mode`, marcador órfão, entrada recusada, `extractTerminalNodes`/`describeDestination`, simulador (handover, silêncio posterior, ai→IA na próxima, handover por palavra-chave em modo IA, desabilitados, regressão R3) |
| `src/components/whatsapp/__tests__/flowCanvasModel.destinos.test.ts` (novo) | `canConnect`/`applyConnection`/`applyEdgeDeletion`/arestas para terminais; entrada recusada; fixos não excluíveis |
| `src/components/whatsapp/__tests__/WhatsAppBotConfig.destinos-ui.test.tsx` (novo) | rótulos de efeito nos Selects, aresta `next`→handover, "Começar por" sem terminais, avisos de destino desabilitado (mensagem/opção/fallback) |
| `src/components/whatsapp/__tests__/flowSimulatorModel.ai-mode.test.ts` (novo) | rótulo do modo IA, órfão, selos `message_next`/`enteredAi`, ausência de selo nas seguintes |
| lane D (atualizados, ver §2.3) | 5 testes que afirmavam "estado zerado/órfão" |
| R7 (ajustados) | `flowCanvasModel.test.ts` (message→handover/ai passa a ser válido; send recusado) e `WhatsAppBotConfig.message-node-ui.test.tsx` (lista de destinos e texto do aviso) |

Prova fail→fix→pass por patch (sem `git stash`): ver relatório da rodada.

## 9. Não tocado
`FlowSimulatorPanel`, `knowledgeConsent`/`brainComposer`, `WhatsApp.tsx`,
fichas/CRM/Projetos. `flowSimulatorModel.ts` (lane D) só nas 3 edições mínimas
autorizadas da §5. Nenhuma migration.
