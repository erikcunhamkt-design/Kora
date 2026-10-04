# Etapa 9 · Item 4 — R6: canvas visual do fluxo do bot (estilo n8n, `@xyflow/react`)

> Decisão do operador: nós soltos, arrastar, ligar com linha. Substitui a grade
> CSS de `WhatsAppBotConfig.tsx`. Mesma rodada fecha a **aresta de entrada**
> (dívida de design da R3 da lane D + o `"entry"` reservado no G80).
> Zero DDL/DML. IDs novos: nenhum reservado por esta lane (ver §8).

## 1. Dependência nova (única)

`@xyflow/react` **12.12.0** (React Flow v12, licença MIT; `package.json`
`^12.12.0`). Transitivas (lockfile, 100% aditivo): `@xyflow/system`,
`d3-drag/d3-selection/d3-transition/d3-zoom/d3-dispatch` (+ `@types/d3-*`),
`classcat`, `zustand`. Build de produção (`vite build`) confere. Atribuição
do React Flow (rodapé do canvas) mantida no default.

## 2. Modelo (compat total com `flow_data` já salvo)

- `WorkflowNodeBase.position?: {x, y}` — ausente → **auto-layout em grade**
  no load (`withAutoLayout`: 4 colunas, passo 300×260, índice = posição no
  array; NUNCA move um nó que já tem `position` válida; devolve o mesmo
  array se nada falta). Salvar grava a posição de todos os nós.
- `TriggerWorkflowNode.properties.nextNodeId?: string` — aresta de **entrada**
  (trigger → menu). Ausente → comportamento atual (motor entra no primeiro
  menu habilitado). *(Fica em `properties`, como todo dado de nó e como o
  `opcoes[].nextNodeId` do menu — não no topo do nó.)* "Automático" no
  inspector **remove a chave** (não grava string vazia): `flow_data` sem a
  chave é idêntico ao de antes do R6.

## 3. Funções puras (`flowCanvasModel.ts`) — testáveis sem DOM

| Função | O que faz |
|---|---|
| `withAutoLayout` / `gridPosition` / `setNodePosition` | auto-layout + arrastar nó grava `position` |
| `toRenderableEdges` | `computeCanvasEdges` (G80, fonte única) → arestas do React Flow, com handles; destino vazio/inexistente → **não renderiza** |
| `findDanglingEdges` | o que NÃO foi renderizado (editáveis), com o motivo — alimenta os avisos do inspector |
| `canConnect` | valida a conexão arrastada (regras abaixo) |
| `applyConnection` | **inversa**: arrastar handle → nó alvo grava `opcoes[i].nextNodeId` / `fallback.fallbackNodeId` / `trigger.nextNodeId`; inválida → no-op (mesmo array) |
| `applyEdgeDeletion` | **inversa**: apagar aresta limpa o campo (`nextNodeId → ""`; `fallbackNodeId`/`trigger.nextNodeId` removidos); `sequence` → no-op |

Regras de `canConnect`: só handles **editáveis** conectam (`entry` do trigger;
`option-i` do menu com `i` existente; `fallback` do menu só com
`acao="node"`); alvo = handle `in` de nó existente que **não** é o trigger;
`entry` só aponta pra nó `menu`; `fallback` não aponta pro próprio menu
("outro nó"); `option` **pode** apontar pra si mesmo (padrão real "9 - voltar
ao menu"). Cada handle tem 1 aresta: religar substitui o destino.

## 4. Canvas (`FlowCanvas.tsx`)

- Cada nó = nó custom do React Flow: card com ícone do tipo, título, resumo
  curto, badge "Desabilitado", e o `Switch` de habilitar (existente). Clicar
  abre o **inspector existente** (toda a edição de campos continua lá).
- **Handles de saída:** trigger → 1 (`entry`, "Início do fluxo"); menu → 1
  por opção (linha com o número + rótulo) + 1 de fallback **só com
  `acao="node"`**; demais nós sem handle editável. Todo nó ≠ trigger tem 1
  handle de entrada (`in`).
- **Arestas editáveis** (opção/fallback/entrada): arrastar handle → alvo
  grava o campo; selecionar a linha + Backspace limpa. Nós têm
  `deletable:false` (Backspace nunca apaga nó — não há exclusão de nó, como
  antes).
- **Sequência implícita dos fixos** (trigger→ai→send→handover): tracejada,
  `selectable/deletable:false`, handle de saída `isConnectable={false}` —
  **semântica do runtime fixo inalterada**.
- Destino vazio/removido: aresta não renderiza; o inspector mostra o aviso
  (`role="alert"`). Entrada apontando pra menu **desabilitado**: desenhada,
  mas o inspector avisa que o motor a ignora.
- Toolbar: "+ Adicionar nó de menu" (cria no centro do viewport via
  `screenToFlowPosition`), zoom/pan (`Controls`), `MiniMap`, `Background`.
  Arrastar nó atualiza `position` (modelo = fonte de verdade; o React Flow
  só guarda o que mediu).
- Alternativa textual/acessível do diagrama: lista `aria-label="Conexões do
  fluxo"` (sr-only) com as MESMAS arestas desenhadas (`data-edge-*`).
- Inspector do trigger ganhou o Select **"Começar por"** (Automático + menus
  existentes) — edita o MESMO campo que a linha do canvas.
- Simulador e Salvar intactos; leitores por tipo da R2 não dependem de
  posição (confirmado: suíte existente verde).

## 5. Motor (`supabase/functions/_shared/botFlowMenu.ts` + `whatsapp-bot-reply`)

`resolveEntryMenu(menuNodes, entryNodeId?)` + 4º parâmetro **opcional** de
`resolveMenuTurn`. Entrada usa `trigger.nextNodeId` quando aponta pra menu
**habilitado e válido** (está em `menuNodes`); ausente → primeiro menu
habilitado (compat); inválido (id inexistente / não é menu / desabilitado) →
mesmo fallback automático, `reason: "invalid-edge"` → `index.ts` loga
(`console.warn`, só quando a entrada seria de fato usada). Conversa em
andamento (estado aponta pra menu habilitado) **não** reaplica a entrada.
Zero mudança pro fluxo sem menu (`extractMenuNodes` → `[]` → nada roda).
`index.ts`: só o import, o campo `nextNodeId` no tipo de `properties` e o
trecho do call site.

## 6. Setup de teste (jsdom)

`src/test/setup.ts` ganhou stubs **só-quando-ausentes** de `ResizeObserver` e
`DOMMatrixReadOnly` (o React Flow pede os dois). Sem layout real o jsdom não
mede nós e o React Flow não desenha o `<path>` das arestas — por isso os
testes de render asserem a lista "Conexões do fluxo" + avisos do inspector, e
a geometria/edição é coberta pelas funções puras. Nós recebem
`initialWidth/initialHeight` pra aparecerem em jsdom.

## 7. Testes (todos novos/adaptados; cobertura da grade antiga preservada)

- `flowCanvasModel.test.ts` (novo, funções puras): auto-layout/compat sem
  `position`, modelo→arestas, `canConnect`, `applyConnection`,
  `applyEdgeDeletion` (+ round-trip conectar→apagar = modelo original).
- `WhatsAppBotConfig.canvas-edges.test.tsx` (G80 reescrito pro R6, 15):
  `computeCanvasEdges` (+ `entry`) e render (cards, arestas por opção +
  fallback, sequência tracejada não editável, destino vazio/removido,
  "Começar por" ↔ aresta de entrada, entrada → menu desabilitado, "+ nó" +
  salvar grava `position`, `position` salva preservada).
- `botFlowMenu.test.ts` (+11): `resolveEntryMenu` e `resolveMenuTurn` com/sem
  `nextNodeId`, destino inválido, estado em andamento.
- `menu-node-ui` (1 seletor adaptado à grade nova) e `menu-node-types` (+1:
  `position`/`nextNodeId` opcionais).
- **Prova fail→fix→pass por patch** (G65/§14-A, sem `git stash`): com a
  implementação revertida (4 arquivos via patch + 2 arquivos novos movidos) →
  **21 testes falham + 1 suíte não carrega** (`flowCanvasModel`); reaplicado →
  suítes de `components/whatsapp` + engine **111/111**.

## 8. Limites, achados e itens que dependem de decisão

1. **NÃO verificado num browser real** (arrastar nó, ligar handle, minimap,
   zoom): o jsdom não faz layout. Coberto: lógica de conexão/exclusão/layout
   (funções puras) e render de nós/avisos/lista de arestas. Recomendo um
   passe visual do operador antes de homologar.
2. **Simulador da lane D (branch NÃO mergeada
   `etapa-9-item4-pacote-operador-8b-simulador`, `929cbdc`)**:
   `_shared/botFlowSimulation.ts` chama `resolveMenuTurn(menuNodes, state,
   text)` com 3 argumentos → **não honra `trigger.nextNodeId`**, e o próprio
   comentário dela diz que a ordem espelha produção. Compila (o 4º
   parâmetro é opcional) mas o simulador passaria a divergir da produção
   (entra no primeiro menu, não no escolhido). **Não toquei o arquivo dela**;
   ajuste de 1 linha na D: passar `trigger.properties.nextNodeId` como 4º
   argumento. O mesmo branch também edita `whatsapp-bot-reply/index.ts`
   (outras regiões — import e ramo `isTest`).
3. ~~Bundle~~ — resolvido no acabamento (§9): canvas em chunk lazy.
4. ~~Exclusão de nó~~ — resolvida no acabamento (§9).
5. A seta "sequência implícita" dos fixos continua não refletindo ordem do
   motor (o runtime fixo não segue esse desenho); só é a representação
   herdada — tracejada exatamente pra não parecer aresta editável.

## 9. Acabamento do canvas (rodada seguinte ao merge do R6, `423a0d2`)

**React.lazy + Suspense.** `FlowCanvas` é carregado por `lazy(() => import(...))` em
`WhatsAppBotConfig.tsx` (fallback: caixa "Carregando canvas do fluxo..."), então
`@xyflow/react` (+ d3-*, zustand e o CSS da lib) sai do bundle principal. Medido
com `vite build` (R6 mergeado → esta branch):

| | JS principal | gzip | CSS principal | chunk `FlowCanvas` (JS / gzip) | CSS do chunk |
|---|---|---|---|---|---|
| antes (`423a0d2`, canvas no principal) | 2.718,12 kB | 699,69 kB | 154,64 kB | — | — |
| depois (lazy) | 2.545,02 kB | 644,85 kB | 139,23 kB | 175,06 kB / 55,57 kB | 15,41 kB |

Principal: **−173,10 kB (−54,84 kB gzip)**; o custo (175 kB / 55,6 kB gzip) só é
pago ao abrir a aba do robô. Testes: o 1º `import()` a frio do chunk passava do teto do `findBy*` quando a
suíte inteira roda em paralelo (3-5 falhas intermitentes só na suíte cheia; em
isolamento verde) — mitigação em 2 camadas: (1) os 7 arquivos de teste que
renderizam `WhatsAppBotConfig` pré-importam `FlowCanvas` na coleta (o `import()` do
componente vira cache hit; a transformação a frio sai do tempo do teste) e (2)
`src/test/setup.ts` ganhou `configure({ asyncUtilTimeout: 5000 })`. Suíte cheia
rodada 2x seguidas: 108/108, 1135/1135. O teste G71 passou a esperar o card
(`findByText`) em vez de `getByText` síncrono; o teste R2 da lane A
(`node-lookup`) só ganhou o pré-import.

**Excluir nó de menu** (ficou fora da R5). `applyNodeDeletion` (puro, ao lado de
`applyEdgeDeletion`): remove o nó e limpa TODA referência — `opcoes[].nextNodeId`
de qualquer menu → `""`; `fallback.fallbackNodeId` → chave removida (`acao`
preservada; sem destino o motor trata como esgotado e entrega a humano);
`trigger.nextNodeId` → chave removida (volta ao automático). **Nós fixos
(trigger/ai/send/handover) não excluem** (`isNodeDeletable`: só `menu`; no-op) —
só desabilitam, como antes. UI: botão "Excluir nó" no inspector do menu, em 2
passos ("Confirmar exclusão"/"Cancelar") com a contagem de conexões que sai junto
(`countNodeConnections`); o nó ativo volta pro gatilho. Nós fixos mostram "Nó fixo
do fluxo — não pode ser excluído, só desabilitado". Nada persiste até Salvar.

**Delete/Backspace.** A tecla é tratada pelo próprio `FlowCanvas` (handler no
wrapper, `tabIndex=-1`), com `deleteKeyCode={null}` no React Flow. O default do
xyflow (já apagava aresta selecionada via `onEdgesDelete`) é **global** (escuta o
documento): com nós de menu excluíveis, ele apagaria o nó selecionado mesmo com o
foco num controle do inspector (ex.: o gatilho de um Select é um `button`, que o
filtro de inputs da lib não ignora). A decisão é de `resolveDeleteKey` (pura):
aresta **editável** selecionada → apaga a(s) aresta(s) via `applyEdgeDeletion`
(prioridade); só sequência implícita selecionada → nada; senão nó de menu
selecionado → exclui; nó fixo → nada. O handler ignora alvos `input/textarea/
select/button/[contenteditable]` (campos do inspector, switch do card, "+ Adicionar
nó de menu"). A seleção de aresta vem de `onSelectionChange`.

**Testes:** `flowCanvasModel.test.ts` (+13: exclusão limpa todas as referências e
não deixa id fantasma, fixos protegidos, auto-referência, contagem, imutabilidade,
`resolveDeleteKey` incl. aresta apagada pela tecla via `applyEdgeDeletion`) e
`WhatsAppBotConfig.node-deletion.test.tsx` (novo, 10: botão + confirmação/cancelar,
referências limpas e avisos "sem destino" (não "removido"), salvar sem o nó, fixos
sem botão/tecla, Delete e Backspace, tecla ignorada em input/botão/switch).
**Limite:** a exclusão de ARESTA pela tecla é coberta pelas funções puras
(`resolveDeleteKey` + `applyEdgeDeletion`); no jsdom o React Flow não desenha nem
seleciona linhas, então não há teste de render dessa parte — fica pro passe visual.
