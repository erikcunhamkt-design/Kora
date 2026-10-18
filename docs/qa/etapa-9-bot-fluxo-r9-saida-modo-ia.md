# Etapa 9 · Item 4 — R9: saída do modo IA (palavra de retorno)

Branch: `etapa-9-bot-fluxo-r9-saida-modo-ia` (a partir de `origin/main` = `3f2aaab`,
que já contém R6/R7/R8). Lane C. Sem DDL/DML (§0/§6): a palavra mora em `flow_data`
(jsonb existente) e o marcador de modo IA continua sendo o mesmo `bot_flow_state`
da R8 (`{ currentNodeId: <nó ai>, attempts: 0 }`).

## 1. Por quê

Fecha o ponto em aberto da R8 §6: depois de entrar em modo IA o cliente não tinha
saída — só um atendente devolvendo ao robô, ou desabilitar o nó ai.

## 2. Onde mora a palavra: no **nó ai** (não no gatilho)

Decisão: `AiWorkflowNode.properties.palavraRetorno?: string`.

* O modo IA **começa no nó ai** (é o `currentNodeId` do marcador); o motor já sabe
  exatamente em qual nó ai a conversa está, então a palavra é lida **desse** nó.
  Fluxos com mais de uma IA podem ter palavras diferentes por IA (testado).
* No gatilho seria uma configuração global, longe de onde o usuário decide "mandar
  pra IA", e não distinguiria IAs. O gatilho trata de *como o fluxo começa*, não de
  *como uma etapa termina*.
* Compat: campo opcional — `flow_data` salvo antes não o tem; abrir/salvar sem tocar
  **não grava a chave** (teste).

## 3. Normalização e regra de disparo

`normalizeReturnWord(text)` (aplicada à palavra e à mensagem do cliente):
`trim` → `NFD` sem diacríticos → minúsculas → espaços internos colapsados.

* Dispara **só com a mensagem inteira igual** à palavra. Não é substring, não remove
  pontuação: `"quero voltar ao menu"`, `"menu por favor"`, `"menus"`, `"menu!"`,
  `"o menu"` **não** disparam (testado). `"MENU"`, `" menu "`, `"Menu"` disparam;
  `"Início"` ≡ `"INICIO"`; `"voltar  ao   MENU"` ≡ `"voltar ao menu"`.
* Palavra ausente / vazia / só espaços / não-string = **sem saída** (comportamento da R8).

## 4. Motor (`botFlowMenu.ts`)

* `extractTerminalNodes` agora devolve `aiReturnWords` (por id de nó ai **habilitado**,
  já normalizada; a chave só existe se algum nó definiu palavra — forma idêntica à da
  R8 quando nenhum define).
* Em `resolveMenuTurn`, no ramo de modo IA (`state.currentNodeId` é nó ai habilitado):
  se a mensagem normalizada === palavra desse nó **e** há nó de entrada utilizável
  (`resolveEntryNode`), o motor **reentra pelo nó de entrada na mesma virada**:
  * entrada = menu → `{ kind: "present", message: <menu>, state: <menu>, returnedFromAi }`;
  * entrada = mensagem → cadeia de mensagens normal (`kind: "message"`, pode terminar
    em menu, sem destino → `state: null` = marcador zerado, etc.) + `returnedFromAi`.
  * Sem IA nessa virada. O marcador é **substituído** pelo estado do menu (ou zerado).
* Sem nó de entrada utilizável (nenhum menu e nenhuma mensagem de entrada) a palavra
  não tem pra onde voltar → segue em `ai-mode` (a conversa não fica sem resposta).
* Nó ai desabilitado/removido depois: marcador órfão → reentrada pelo caminho de
  sempre (sem `returnedFromAi`).
* **Precedência:** o motor do menu roda antes do gate de handover por palavra-chave,
  então uma palavra de retorno que coincida com uma palavra-chave de handover
  (`atendente`, `ajuda`…) **vence** — é configuração explícita do usuário (testado).
  O inspector não avisa dessa colisão (não importa a lista do servidor no cliente).

## 5. Produção (`whatsapp-bot-reply/index.ts`)

Nenhum ramo novo: `present`/`message` já enviam e persistem `turn.state` (o menu, ou
`null`) — isso **é** a saída (o marcador é sobrescrito). Só ganhou um `console.log`
quando `turn.returnedFromAi` está presente.

## 6. Simulador — paridade

Mesma chamada. `SimulationInfo.leftAi?: true` (só nessa virada), `engine: "menu"`,
`botFlowState` = menu. UI (edição mínima em `flowSimulatorModel.ts`, lane D):
`SIM_LEFT_AI_TAG = "Voltou ao menu — conversa com a IA encerrada"` com `tagKind: "ai"`
(reaproveita a cor/ícone do selo de IA que a R8 adicionou ao painel). Precedência:
se a mesma virada também passou à IA (`enteredAi`), vale esse selo. O estado volta
a "No menu …" (o `describeSimState` já cobre).

Nota de honestidade do selo: quando o nó de entrada é uma **mensagem** que não leva a
um menu, o texto "Voltou ao menu" é impreciso — caso raro; o selo diz "ao menu" porque é
o desenho esperado (entrada → menu).

## 7. UI

* **Inspector do nó ai:** campo "Palavra para voltar ao menu (opcional)", placeholder
  `menu`, botão **"Usar “menu”"** (só aparece com o campo vazio; **não** vira default
  silencioso — o fluxo novo continua sem saída até o usuário pedir).
* **Texto de ajuda honesto** (muda conforme o estado):
  * vazio → diz que o cliente **não** tem como voltar por conta própria (só um atendente
    devolvendo ao robô) e que só vale avisar o cliente de uma palavra depois de defini-la;
  * preenchido → diz o que acontece, que vale a mensagem inteira (caixa/acento não
    importam) e que uma frase que apenas contenha a palavra **não** conta.
* **Cortesia ao entrar em modo IA (G29):** não há texto automático de entrada em
  modo IA (opção direta não tem texto; o texto da mensagem é 100% do usuário). Logo
  **nada é prometido sozinho**. No inspector da **mensagem** que aponta para um nó ai
  *com* palavra definida aparece uma dica com o botão **"Acrescentar ao texto"**
  (acrescenta, uma única vez, `Para voltar ao menu, envie “<palavra>”.`). Sem palavra no
  nó ai de destino, nenhuma dica. O texto nunca é alterado sem clique.

## 8. Testes e prova

| Arquivo | Cobre |
|---|---|
| `supabase/functions/_shared/__tests__/botFlowRetorno.test.ts` (novo, 24) | `normalizeReturnWord`; `aiReturnWords`; motor: palavra, caixa/acento/espaços, substring NÃO dispara, sem palavra (4 formas), vale só pro nó ai em que a conversa está, entrada pelo gatilho/mensagem/sem destino/sem entrada, ai desabilitado, fora do modo IA; simulador: selo `leftAi`, outro texto → IA, sem palavra, ciclo repetido, paridade, colisão com handover |
| `src/components/whatsapp/__tests__/flowSimulatorModel.retorno.test.ts` (novo) | selo `SIM_LEFT_AI_TAG`, precedência do `enteredAi`, estado volta a "No menu" |
| `src/components/whatsapp/__tests__/WhatsAppBotConfig.palavra-retorno.test.tsx` (novo) | campo/ajuda/botão sugerido, round-trip e persistência, chave ausente quando não tocado, dica G29 na mensagem |

Prova fail→fix→pass por patch (sem `git stash`): no relatório da rodada.

## 9. Não tocado / limites
`knowledge*`/`brainComposer`, `WhatsApp.tsx`, fichas/CRM/Projetos. `FlowSimulatorPanel`
sem mudança (reaproveita o `tagKind: "ai"` da R8). Sem migration. Limite conhecido:
sem aviso na UI de colisão com palavra-chave de handover (a saída vence).
