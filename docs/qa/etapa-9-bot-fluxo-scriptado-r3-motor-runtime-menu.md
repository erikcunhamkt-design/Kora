# Etapa 9 · Item 4 — Construtor de fluxo scriptado — R3 (motor de runtime do nó "menu")

> **Nada aplicado em banco.** Esta rodada implementa o MOTOR de execução do
> nó `menu` no server (`supabase/functions/whatsapp-bot-reply`) — a
> fundação de dados (tipo `MenuWorkflowNode`, draft de
> `bot_flow_state`) é da R1 (`etapa-9-bot-fluxo-scriptado-r1-fundacao.md`),
> mesclada em main antes desta rodada começar. `bot_flow_state` continua
> só um DRAFT de migration (§2 daquele doc) — nada de DDL/DML rodado por
> Code aqui (protocolo §0/§6/§8-b).

## Escopo desta rodada (R3)

1. Módulo puro `supabase/functions/_shared/botFlowMenu.ts` — casar a
   resposta do usuário com as opções numeradas, reprompt em resposta
   inválida, contador de tentativas, ação ao estourar `maxTentativas`.
2. Leitura/escrita defensiva de `whatsapp_conversations.bot_flow_state` —
   degrada sem quebrar o fluxo de IA existente quando a coluna ainda não
   existir (ela não existe hoje — draft R1 §2 segue não aplicado).
3. Integração em `whatsapp-bot-reply/index.ts`: nó "menu" ausente/
   desabilitado no `flow_data` = zero mudança de comportamento.
4. Testes unitários com mocks — matching, reprompt, estouro de
   tentativas (2 variantes de `acao`), degradação sem a coluna.

**Explicitamente FORA de escopo** (mesma linha da R1 e do prompt desta
rodada): um dispatcher genérico que EXECUTE qualquer tipo de nó por id
(hoje só "menu" carrega `nextNodeId"); a integração real de handover
(atribuir a atendente, fila, etc.) — isso é a R4 da Lane E, aqui só um
ponto de encaixe; aplicar a migration de `bot_flow_state` — gate do
operador (§8-b).

---

## 1. Módulo puro — `_shared/botFlowMenu.ts`

Mesmo padrão de `botFlowTemplate.ts`/`botCredentials.ts`: zero `Deno.*`/
`npm:` imports, testável via vitest sem `Deno.serve` nem banco. Define seu
PRÓPRIO shape de nó (`MenuNode`/`MenuNodeOption`/`MenuNodeFallback`) em vez
de importar de `WhatsAppBotConfig.tsx` (componente React, fora do grafo de
módulos Deno-safe) ou do `BotFlowNode` do próprio `index.ts` (bag plano de
propriedades, formato diferente) — `extractMenuNodes()` faz a adaptação e
a validação de forma em runtime, degradando (pula o nó) em vez de lançar
quando `properties` vem incompleto.

Funções exportadas:

- `extractMenuNodes(nodes)` — filtra nós `type === "menu" && enabled` com
  forma válida (`mensagem: string`, `opcoes: MenuNodeOption[]`,
  `fallback` válido). Nó ausente ou malformado → não entra no resultado
  (nunca lança).
- `parseBotFlowState(raw)` — valida `{currentNodeId: string, attempts:
  number}`; qualquer outra coisa (`undefined`, `null`, objeto incompleto,
  tipo errado) → `null`. É esta função que absorve a coluna não existir
  ainda: `select("*")` sem a coluna real simplesmente não popula o campo,
  `conv.bot_flow_state` chega como `undefined`, `parseBotFlowState`
  devolve `null` — o resto do motor trata isso exatamente como "conversa
  nunca entrou num fluxo scriptado" (o estado normal hoje).
- `matchMenuOption(messageText, opcoes)` — número EXATO, tolera espaços em
  volta (`trim()`), não aceita nada que não seja só dígitos (não casa
  "opção 2", "2.0" nem "1 2").
- `renderMenuPrompt(node)` — mensagem do nó + opções numeradas, uma por
  linha.
- `resolveMenuTurn(menuNodes, state, messageText)` — a máquina de estados
  central. Ver §2.

## 2. Máquina de estados — decisões e por quê

`resolveMenuTurn` devolve um de 5 resultados: `none` | `present` |
`reprompt` | `advanced-away` | `handover-fallback`. As decisões abaixo não
estavam 100% especificadas no prompt desta rodada — registradas aqui pra
o revisor validar ou corrigir:

1. **Entrada nova (sem `bot_flow_state`, ou estado aponta pra um nó que
   não é mais um "menu" habilitado)** → apresenta o PRIMEIRO nó "menu"
   habilitado encontrado no `flow_data` (mesmo critério de `.find` já
   usado hoje pra `trigger`/`ai`/`handover` neste arquivo — o array
   continua uma lista de "capacidades", não uma árvore navegável por
   posição). Isso trata "menu" como uma alternativa direta ao "ai" (R1 §0
   item 3): sem nenhum "ai" habilitado, um "menu" habilitado assume o
   turno.
2. **Resposta válida cujo `nextNodeId` é OUTRO nó "menu" habilitado** →
   apresenta esse próximo menu IMEDIATAMENTE no mesmo turno (encadeamento
   tipo URA — escolheu, já vê o próximo menu), `attempts` zera.
3. **Resposta válida cujo `nextNodeId` NÃO é um "menu" conhecido** (outro
   tipo de nó, ou id sem correspondência) → `advanced-away`. O motor NÃO
   tenta executar esse nó (fora de escopo — só "menu" tem navegação hoje).
   O chamador (`index.ts`) limpa `bot_flow_state` e deixa o fluxo normal
   (IA / handover por palavra-chave / etc., já existentes) rodar pra essa
   mesma mensagem, sem retorno antecipado.
4. **Resposta inválida, tentativas < `maxTentativas`** → `reprompt` (aviso
   + reapresenta o mesmo menu), `attempts` incrementa.
5. **Resposta inválida, tentativas ≥ `maxTentativas`, `acao === "node"`
   com `fallbackNodeId`** → `handover-fallback`. Igual ao item 3: o
   chamador limpa o estado e loga o `fallbackNodeId` — NÃO implementa
   handover real (prompt desta rodada: "por ora marcar/encerrar o fluxo
   de forma limpa... não implementar handover"). Ponto de encaixe
   explícito pra R4 (Lane E).
6. **Resposta inválida, tentativas ≥ `maxTentativas`, `acao === "reprompt"`**
   → continua `reprompt` pra sempre ("reprompt indefinido", a própria
   definição do produto pra esse caso — R1 §0 item 2). Mesmo destino
   quando `acao === "node"` mas sem `fallbackNodeId` configurado (não
   validado em tipo — R1 §1): degrada pro reprompt em vez de travar o
   usuário sem resposta.

   > **SUPERADO pela R4** (`etapa-9-bot-fluxo-scriptado-r4-handover-real.md`
   > §3, decisão #1): esgotar `maxTentativas` sem destino de nó utilizável
   > agora devolve `exhausted` e entrega a conversa a humano em vez de
   > reprompt indefinido. Mantido acima como registro do que a R3 entregou.

> **Aresta FECHADA pela R4 (código)** — o parágrafo abaixo descreve o que a
> R3 deixou em aberto; a R4 persiste o estado "entregue a humano"
> (`handover_at`, draft de migration no doc da R4 §2) e o bot fica em
> silêncio até alguém devolver. Efeito depende do operador aplicar a
> migration (§8-b).

**Consequência aceita, não resolvida aqui:** depois de um `advanced-away`
ou `handover-fallback`, `bot_flow_state` é limpo — a PRÓXIMA mensagem do
mesmo contato, se nenhum humano assumiu a conversa (`conv.assigned_to`
ainda nulo), re-entra no menu do zero (item 1 acima). Isso é uma aresta
esperada desta rodada: sem a R4 (handover real, que presumivelmente marca
`assigned_to` ou algo equivalente), não há como o motor saber que "esta
conversa já foi entregue a um humano" e parar de reagir. Registrado, não
implementado — mesma disciplina de escopo do resto da casa.

## 3. Integração em `whatsapp-bot-reply/index.ts`

- `BotFlowNode.type` ganhou `"menu"`; `BotFlowNodeProperties` ganhou
  `mensagem?/opcoes?/fallback?` (bag plano, mesmo molde dos outros 4
  tipos de nó neste arquivo — `extractMenuNodes` valida a forma real).
- `ConversationRow.bot_flow_state?: unknown` — optional de propósito
  (coluna ainda não existe no schema real).
- O bloco do motor roda **depois** do gate `!isUnrestricted &&
  conv.assigned_to` (conversa já atribuída a humano com `respond_all`
  desligado continua sem nenhuma reação do bot, menu incluso) e **antes**
  do gate `hasFlowData && !aiNode` (que precisou ficar DEPOIS do bloco do
  menu — um fluxo só-menu, sem "ai", não pode ser barrado por esse gate,
  que existia só pra decidir "tem fluxo customizado mas o nó ai tá
  desligado, não faz nada").
- A busca de `instance` (token/subdomain pra mandar mensagem) foi movida
  pra ANTES do gate `hasFlowData && !aiNode` — zero mudança de
  comportamento pro caminho sem menu (mesma query, mesmo critério de
  skip), só reordenada porque o bloco do menu também precisa dela pra
  responder diretamente.
- A mensagem do usuário nesta virada é buscada por uma query PRÓPRIA,
  isolada (`select content, body ... direction='inbound' ... limit(1)`),
  em vez de reaproveitar o `history`/`ordered` maior carregado mais abaixo
  pra montar o contexto de IA — decisão deliberada pra não reordenar nem
  arriscar aquela lógica existente e já coberta (`contents`,
  handover-por-palavra-chave). Custo: 1 SELECT extra, indexado, de 1
  linha — irrelevante frente ao resto da function (chamadas de IA
  externas).
- **Degradação sem a coluna**: o `.update({bot_flow_state: ...})` é
  SEMPRE uma chamada SEPARADA do `.update({last_message, updated_at,
  ...})` que manda a mensagem — de propósito. Se `bot_flow_state` não
  existir como coluna real, o Postgrest recusa aquele UPDATE inteiro
  (erro, não exceção — supabase-js não lança em erro de query); como está
  isolado numa chamada própria, isso NUNCA impede o update de
  `last_message`/`updated_at` (comportamento já existente) de acontecer.
  O erro só vira um `console.warn`, nunca um `throw`.

## 4. Testes

`supabase/functions/_shared/__tests__/botFlowMenu.test.ts` — 27 testes,
zero mock de rede/banco (o módulo é puro):

- `extractMenuNodes` (5): vazio, filtra não-menu, filtra desabilitado,
  degrada 3 formas de `properties` malformado, extrai um nó válido.
- `parseBotFlowState` (6, "degradação sem coluna"): `undefined`, `null`,
  não-objeto, `currentNodeId` ausente/tipo errado, `attempts` ausente/tipo
  errado, objeto válido.
- `matchMenuOption` (6): número exato, tolera espaços, texto não-numérico,
  número fora do vocabulário, espaço interno não casa, mensagem vazia.
- `renderMenuPrompt` (1): monta mensagem + opções.
- `resolveMenuTurn` (9): sem nós → `none`; entrada nova; estado órfão
  reentra; encadeamento menu→menu; `advanced-away`; reprompt sob o
  limite; estouro com `acao: "node"` → `handover-fallback`; estouro com
  `acao: "reprompt"` → reprompt indefinido; `acao: "node"` sem
  `fallbackNodeId` → degrada pra reprompt.

**Prova fail→fix→pass por patch (método G65, sem `git stash`):** `git add
-N` (arquivo novo) → `git diff` → `git checkout --` (esvazia o arquivo) →
`npx vitest run` **27/27 falharam** (`TypeError: resolveMenuTurn is not a
function`, etc. — confirma a dependência real do módulo, não um teste
vazio) → `rm` do arquivo esvaziado + `git apply` do mesmo patch → `npx
vitest run` **27/27 passaram**.

`whatsapp-bot-reply/index.ts` (wiring): não tem teste direto, mesma
disciplina já aplicada ao resto deste arquivo (as chamadas de IA por
provider, o handover por palavra-chave e o `Deno.serve` também não têm
teste direto — só a lógica extraída pra `_shared/*.ts` é testada; aqui a
lógica nova TODA está em `_shared/botFlowMenu.ts`, o `index.ts` só faz
I/O em cima do resultado).

## 5. Gates (literal)

```
tsc -p tsconfig.app.json --noEmit → 0 erros
eslint . → 0 erros / 0 warnings
vitest run → Test Files 93 passed (93) | Tests 889 passed (889)
```

(`tsconfig.app.json` só inclui `src/` — `supabase/functions/**` nunca
passa por `tsc` nesta casa, mesma situação de TODOS os módulos
`_shared/*.ts` anteriores a esta rodada; a garantia de correção de tipo
aqui vem de leitura cuidadosa + os 27 testes de comportamento real, não de
`tsc`.)

## Referências

- `docs/qa/etapa-9-bot-fluxo-scriptado-r1-fundacao.md` — tipo
  `MenuWorkflowNode`, decisões do operador (§0), draft de
  `bot_flow_state` (§2).
- `supabase/functions/_shared/botFlowTemplate.ts`/`botCredentials.ts` —
  precedente de módulo puro extraído de `whatsapp-bot-reply` pra ficar
  testável.
- `supabase/functions/whatsapp-bot-reply/index.ts` — handler onde o motor
  foi integrado; ver comentários inline nos pontos de reordenação.

**PARADO aqui — motor de runtime do nó "menu" implementado e testado,
zero DDL aplicado, zero deploy, zero push/merge. §18.**
