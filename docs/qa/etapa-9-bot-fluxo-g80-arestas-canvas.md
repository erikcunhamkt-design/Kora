# Etapa 9 · Item 4 — G80: arestas REAIS no canvas do construtor de fluxo

> Fix de **render** (zero mudança de runtime). Achado original: R5
> (`etapa-9-bot-fluxo-scriptado-r1-fundacao.md` + commit `f8358a3`) — o
> conector do canvas ligava `node[index] → node[index+1]` por POSIÇÃO NO
> ARRAY; com o nó "menu" montável (`opcoes[].nextNodeId`) a seta passou a
> mentir (ex.: `handover → primeiro menu`, `menu → menu` sem nenhuma aresta
> real entre eles). ID **G80** reservado pelo revisor.

## O que mudou

1. **`src/components/whatsapp/flowCanvasEdges.ts` (novo, função pura
   `computeCanvasEdges`)** — fonte única do que o canvas desenha como aresta:
   - nó **menu** → 1 aresta `"option"` por opção (`opcoes[].nextNodeId`;
     `toNodeId: null` quando a opção ainda não tem "Ir para...") + 1 aresta
     `"fallback"` quando `fallback.acao === "node"` (`fallbackNodeId`, `null`
     se não escolhido); fallback `"reprompt"` não gera aresta (reapresenta o
     próprio menu, não sai dele);
   - nós **fixos** (trigger/ai/send/handover) → `"sequence"` entre vizinhos
     fixos, exatamente como antes — nenhum modelo novo de aresta pros fixos;
   - nó menu **nunca** recebe nem emite `"sequence"`.
2. **`WhatsAppBotConfig.tsx`** — a seta `→` entre caixas só renderiza quando
   há aresta `"sequence"` saindo daquele nó (visual dos fixos idêntico, agora
   com `data-edge-kind/from/to`); o nó menu ganha uma lista `Arestas de
   <título>` (`MenuNodeEdges`) dentro da própria caixa: `N → <título do
   destino>` por opção e `⚠ inválida → <destino>` pro fallback. Destino vazio
   e destino que não existe mais na árvore são sinalizados (`(sem destino)` /
   `(nó removido)`, em vermelho) — nunca escondidos nem "consertados" em
   silêncio. O comentário de achado do R5 (que pedia ID) foi substituído.

**Por que lista dentro do nó e não linhas desenhadas entre caixas:** o canvas
é uma grade CSS de caixas (sem coordenadas), e desenhar linhas reais entre
posições arbitrárias exigiria um motor de layout/SVG de grafo — fora do
escopo "arestas reais, sem inventar modelo novo". A lista dentro do nó é uma
renderização fiel das arestas reais (origem, tipo, destino), testável por
DOM; o desenho de linhas fica como evolução futura em cima do MESMO
`computeCanvasEdges`.

## Dívida de design (R3 da lane D) — NÃO resolvida, canvas preparado

Hoje o motor de runtime entra no **primeiro menu habilitado** porque o
`trigger` não tem aresta própria pro menu de entrada. Esta rodada não mexe
nisso (nem em `supabase/functions`, território da lane D). O que ficou
preparado: `CanvasEdgeKind` já reserva `"entry"` (trigger → menu de entrada)
e o renderer é um `Record<CanvasEdgeKind, ...>` **exaustivo** — quando essa
aresta existir, basta `computeCanvasEdges` passar a emiti-la (e o modelo de
dados ganhar o campo), sem redesenhar o canvas. **Nenhuma aresta `"entry"` é
emitida hoje** (não há campo que a represente; inventar um seria decisão de
modelo, não de render).

## Testes

`WhatsAppBotConfig.canvas-edges.test.tsx` (8): função pura (só fixos = 3
sequências como antes; menu nunca recebe/emite sequência — o bug exato;
menu com 2 opções + fallback `node` = 3 arestas com destinos reais; reprompt
não gera aresta / opção sem destino = `toNodeId null`) e render (menu com 2
opções + fallback `node` lista as 3 arestas com título do destino; menu sem
opções não renderiza lista e as 3 setas dos fixos continuam sem nenhuma
levando ao menu; destino vazio/removido sinalizados; fixos inalterados com
2 menus no fim do array). Prova fail→fix→pass por patch (G65/§14-A, sem
`git stash`): com a implementação revertida o arquivo nem carrega (módulo
`flowCanvasEdges` inexistente); com só o componente revertido (helper
mantido) os testes de render falhavam (3/8, e o 4º — "menu sem opções" — foi
reforçado pra não passar vacuamente no código antigo); pós-fix 8/8.
Regressão: os 27 testes pré-existentes de `components/whatsapp` seguem verdes.

## Não tocado (por instrução)

`supabase/functions` (lane D), `Tarefas.tsx`/`ProjectsSection.tsx` (lane B),
`QuoteToProjectDialog.tsx` (lane E), `projectsMapper.ts` (lane A).
