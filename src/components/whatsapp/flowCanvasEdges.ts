// G80 — arestas REAIS do canvas do construtor de fluxo (Item 4, Etapa 9).
//
// Antes: o conector visual ligava node[index] a node[index+1] por POSIÇÃO NO
// ARRAY. Com a árvore 100% montável (R1/R5, nó "menu" com
// `opcoes[].nextNodeId`), a seta passou a mentir — mostrava uma sequência
// array-adjacente (ex.: handover → primeiro menu, menu → menu) que não
// corresponde a nenhuma aresta do fluxo. Esta função é a fonte única do que
// o canvas desenha como aresta; o componente só RENDERIZA o resultado.
//
// Função pura, só de render — NÃO é lida pelo motor de runtime
// (`supabase/functions/_shared/botFlowMenu.ts`, lane D); zero mudança de
// comportamento em execução.
//
// Nós fixos (trigger/ai/send/handover): a sequência atual é preservada como
// está — "sequence" entre nós FIXOS vizinhos no array. Nenhum modelo novo de
// aresta pros fixos (não inventado nesta rodada).
//
// DÍVIDA DE DESENHO registrada (R3 da lane D, NÃO resolvida aqui): hoje o
// motor entra no PRIMEIRO menu habilitado porque o trigger não tem aresta
// própria pro menu. O tipo abaixo já reserva `"entry"` (trigger → menu de
// entrada) pra quando essa aresta existir — basta esta função passar a
// emiti-la; o renderer é genérico sobre `CanvasEdgeKind` (Record
// exaustivo), então um novo emissor não exige redesenhar o canvas. Nenhum
// `"entry"` é emitido hoje.
import type { WorkflowNode } from "@/components/whatsapp/WhatsAppBotConfig";

export type CanvasEdgeKind = "sequence" | "option" | "fallback" | "entry";

export interface CanvasEdge {
  /** Estável por (origem, tipo, índice) — serve de key de render. */
  id: string;
  kind: CanvasEdgeKind;
  fromNodeId: string;
  /** `null` = aresta sem destino definido (opção recém-criada, ainda sem "Ir para..."). */
  toNodeId: string | null;
  /** Só pra "option": o número da opção que leva a esta aresta. */
  optionNumero?: number;
  /** Só pra "option": rótulo da opção. */
  optionRotulo?: string;
}

export function computeCanvasEdges(nodes: WorkflowNode[]): CanvasEdge[] {
  const edges: CanvasEdge[] = [];

  nodes.forEach((node, index) => {
    if (node.type === "menu") {
      node.properties.opcoes.forEach((opcao, optionIndex) => {
        edges.push({
          id: `${node.id}:option:${optionIndex}`,
          kind: "option",
          fromNodeId: node.id,
          toNodeId: opcao.nextNodeId || null,
          optionNumero: opcao.numero,
          optionRotulo: opcao.rotulo,
        });
      });
      if (node.properties.fallback.acao === "node") {
        edges.push({
          id: `${node.id}:fallback`,
          kind: "fallback",
          fromNodeId: node.id,
          toNodeId: node.properties.fallback.fallbackNodeId || null,
        });
      }
      return;
    }

    // Nós fixos: sequência atual preservada — só entre vizinhos que SÃO
    // fixos. Um nó menu vizinho nunca recebe seta sequencial (não é aresta
    // real de ninguém).
    const next = nodes[index + 1];
    if (next && next.type !== "menu") {
      edges.push({
        id: `${node.id}:sequence`,
        kind: "sequence",
        fromNodeId: node.id,
        toNodeId: next.id,
      });
    }
  });

  return edges;
}
