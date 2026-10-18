# Etapa 9 · Item 4 — R10: validação do fluxo + fluxo de exemplo

Branch: `etapa-9-bot-fluxo-r10-validacao-exemplo` (a partir de `origin/main` = `8e06894`,
que já contém R6–R9). Lane C. Só UI/funções puras: sem DDL/DML, sem mudança de motor.

## 1. `validateFlow(nodes)` — `src/components/whatsapp/flowValidation.ts`

Função **pura** (sem DOM): `WorkflowNode[]` → `FlowIssue[]`
(`{ code, severity: "error" | "warning", nodeId, message }`), erros antes de avisos,
cada grupo na ordem dos nós do fluxo. Espelha o motor (`botFlowMenu.ts`): só nó
**habilitado** age; a entrada é `trigger.nextNodeId` (menu/mensagem habilitados) ou o
primeiro menu habilitado; mensagem encadeia até `MAX_MESSAGE_HOPS` (importado do motor,
não duplicado); esgotar tentativas entrega a humano (R4).

### Erros (o motor não consegue cumprir o desenho)
| Código | Regra | `nodeId` |
|---|---|---|
| `opcao-sem-destino` | opção de menu sem destino | o menu |
| `fallback-sem-destino` | fallback "Pular para outro nó" sem nó escolhido | o menu |
| `destino-removido` | opção/fallback/mensagem/entrada aponta pra id que não existe | origem |
| `menu-sem-opcoes` | menu habilitado sem nenhuma opção | o menu |
| `mensagem-vazia` | mensagem habilitada com texto vazio/só espaços | a mensagem |
| `ciclo-mensagens` | ciclo mensagem→mensagem (1 erro por ciclo, no 1º nó; auto-laço incluso) | 1º nó do ciclo |
| `cadeia-longa` | cadeia de **mais de** `MAX_MESSAGE_HOPS` (5) mensagens seguidas, medida **onde o motor a começa** (destino de opção/fallback/entrada ou cabeça solta) | início da cadeia |

### Avisos (funciona, mas provavelmente não como o usuário imagina)
| Código | Regra | `nodeId` |
|---|---|---|
| `inalcancavel` | menu/mensagem habilitado que nenhum caminho a partir da entrada alcança | o nó |
| `destino-desabilitado` | destino existe mas está desligado (handover/ai/menu/mensagem) | origem |
| `retorno-colide-handover` | palavra de retorno do nó ai que **contém** palavra-chave de handover (`matchesHandoverKeyword`), com handover habilitado — a saída vence (R9) e o cliente não é encaminhado | o nó ai |
| `sem-caminho-humano-ia` | há menu em uso e **nenhum** caminho alcançável leva a humano nem a IA | gatilho |
| `entrada-ambigua` | "Começar por" Automático com mais de 1 menu habilitado | gatilho |
| `entrada-invalida` *(extra)* | entrada aponta pra nó que não é menu/mensagem — o motor a ignora | gatilho |
| `destino-sem-efeito` *(extra)* | opção/mensagem leva ao gatilho ou ao nó de envio | origem |

Os dois "extras" não estavam na lista pedida; entraram porque são o mesmo tipo de
armadilha silenciosa (G29) e custam uma linha cada.

### Decisão de honestidade: o que conta como "caminho pra humano"
`sem-caminho-humano-ia` usa a verdade do motor (R4): **esgotar as tentativas entrega a
humano** quando o fallback do menu é "Reapresentar o menu" ou "Pular" sem destino.
Logo um menu com fallback padrão **já tem** caminho pra humano e o aviso não dispara
— só dispara quando todos os menus alcançados usam "Pular para outro nó" apontando
pra algo que não é humano/IA e nenhum handover/ai é alcançável. Isso torna o aviso raro,
de propósito: avisar "sem caminho pra humano" num fluxo que entrega a humano seria falso.

## 2. UI

* **Painel "Problemas do fluxo"** (região acessível) logo abaixo do canvas, só quando há
  problemas: título com a contagem ("2 erros e 1 aviso"), lista com a severidade; **clicar
  num item seleciona o nó** (abre o inspector dele). Texto: pode salvar mesmo assim.
* **Botão Salvar:** sem problemas = "Salvar Fluxo"; só avisos = "Salvar Fluxo (N avisos)";
  com erros = **"Salvar mesmo assim (N erros e M avisos)"**. **Nunca bloqueia** — o clique
  salva o fluxo como está (testado: o `update` recebe o menu com erro, sem "consertar").
  O botão desabilitado de quem não é admin mantém o rótulo "Salvar Fluxo".
* **Simulador:** faixa no topo "Problemas do fluxo: 2 erros e 1 aviso — o robô pode não se
  comportar como desenhado…" **só quando há erros** (avisos não poluem). Edição mínima em
  `FlowSimulatorPanel.tsx` (lane D): 1 prop opcional `flowIssuesLabel` + a faixa.
  `flowSimulatorModel.ts` **não** foi tocado.

## 3. Fluxo de exemplo — `src/components/whatsapp/flowExample.ts`

Botão **"Carregar fluxo de exemplo"** no cabeçalho do canvas, visível **só** quando o
fluxo não tem nenhum nó `menu`/`message` (`canLoadFlowExample`). Confirmação em 2 passos
(texto diz tudo o que muda; "Cancelar" não altera nada). Monta:

```
Gatilho ─entrada─▶ Menu principal ─1─▶ Horário de atendimento (mensagem) ─▶ Menu principal
                                  ─2─▶ Saudação da IA (mensagem) ─▶ Agente IA
                                  ─3─▶ Transbordo Humano
```
* efeitos nos fixos (declarados na confirmação): **habilita o Transbordo Humano** (nasce
  desligado) e define **"menu"** como palavra de retorno do Agente IA **se ainda estiver
  vazia**; a saudação da IA cita a palavra que de fato existe (a do exemplo ou a que o
  usuário já tinha) — G29;
* posições pré-calculadas (`gridPosition`, 2ª linha do canvas), ids estáveis;
* **nunca sobrescreve:** com qualquer menu/mensagem do usuário o botão nem existe e
  `buildFlowExample` devolve o **mesmo array** (no-op, também numa 2ª chamada);
* o resultado **passa na validação sem nenhum problema** (nem aviso) — teste.
Nada persiste até "Salvar Fluxo".

## 4. Compat de testes
Quatro testes antigos clicavam `name: /Salvar Fluxo/i` em fluxos que agora têm erro
(menu vazio criado pelo teste) → o botão virou "Salvar mesmo assim". As queries passaram
a `/Salvar (Fluxo|mesmo assim)/i` (só localizam o botão; as asserções não mudaram).

## 5. Testes e prova

| Arquivo | Cobre |
|---|---|
| `__tests__/flowValidation.test.ts` (novo, 30) | cada regra (erro e aviso) com `nodeId`, limites exatos (5×6 mensagens), ciclo único/duplo/auto-laço, cadeia medida do início real, desabilitados não geram erro de conteúdo, R4 como caminho pra humano, ordenação, imutabilidade, `summarizeFlowIssues` |
| `__tests__/flowExample.test.ts` (novo) | quando carrega, estrutura/arestas, handover habilitado, palavra de retorno (G29), posições, **0 problemas**, não sobrescreve, imutável |
| `__tests__/WhatsAppBotConfig.validacao-exemplo.test.tsx` (novo, 14) | painel, clique seleciona o nó, contagem no botão, **salvar mesmo assim salva**, faixa do simulador (só erros), exemplo em 2 passos / some depois / não sobrescreve / salva |

Prova fail→fix→pass por patch (sem `git stash`): no relatório da rodada.

## 6. Não tocado
`knowledge*`/`brainComposer`, `WhatsApp.tsx`, fichas/CRM/Projetos/catálogo,
`flowSimulatorModel.ts`. Sem migration.
