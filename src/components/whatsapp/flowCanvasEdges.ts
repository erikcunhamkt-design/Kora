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
// ARESTA DE ENTRADA (fecha a dívida de design da R3 da lane D + o "entry"
// reservado no G80): `trigger.properties.nextNodeId` aponta o menu por onde o
// fluxo começa; esta função emite a aresta `"entry"` trigger → destino quando
// o campo está preenchido. Ausente = sem aresta (o motor cai no primeiro menu
// habilitado — compat total com flow_data já salvo; ver
// `resolveEntryMenu` em supabase/functions/_shared/botFlowMenu.ts). A aresta
// é emitida mesmo com destino inválido (id removido / nó que não é menu
// habilitado) — o renderer sinaliza, nunca esconde.
import type { WorkflowNode } from "@/components/whatsapp/WhatsAppBotConfig";

export type CanvasEdgeKind = "sequence" | "option" | "fallback" | "entry";

export interface CanvasEdge {
  /** Estável por (origem, tipo, índice) — serve de key de render. */
  id: string;
  kind: CanvasEdgeKind;
  fromNodeId: string;
  /** `null` = aresta sem destino definido (opção recém-criada, ainda sem "Ir para..."). */
  toNodeId: string | null;
  /** Só pra "option": índice em `opcoes[]` (identifica a opção ao editar/apagar a aresta). */
  optionIndex?: number;
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
          optionIndex,
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

    // Aresta de entrada: só o trigger a emite, e só quando preenchida.
    if (node.type === "trigger" && node.properties.nextNodeId) {
      edges.push({
        id: `${node.id}:entry`,
        kind: "entry",
        fromNodeId: node.id,
        toNodeId: node.properties.nextNodeId,
      });
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
