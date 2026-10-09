// R6 — canvas visual do fluxo do bot (estilo n8n). Funções PURAS (sem DOM,
// sem React Flow em runtime) entre o modelo `WorkflowNode[]` (flow_data) e o
// que o canvas desenha/edita:
//   - posição: `position?` por nó; ausente → auto-layout simples (grade) no
//     load. Compat total com flow_data salvo antes do R6 (sem `position`).
//   - arestas → React Flow: `toRenderableEdges` (fonte única:
//     `computeCanvasEdges`, do G80).
//   - edição: `applyConnection` (arrastar handle → nó alvo grava
//     opcoes[i].nextNodeId / fallbackNodeId / trigger.nextNodeId /
//     message.nextNodeId) e
//     `applyEdgeDeletion` (apagar aresta limpa o campo) — as funções
//     INVERSAS de `computeCanvasEdges`.
// As arestas implícitas dos nós fixos (sequência trigger→ai→send→handover do
// runtime atual) são renderizadas tracejadas e NÃO editáveis — a semântica do
// runtime fixo não muda nesta rodada.
import type { WorkflowNode } from "@/components/whatsapp/WhatsAppBotConfig";
import { computeCanvasEdges, type CanvasEdge, type CanvasEdgeKind } from "@/components/whatsapp/flowCanvasEdges";

export interface FlowPosition {
  x: number;
  y: number;
}

/** Ids dos handles do React Flow — contrato entre o nó custom e estas funções. */
export const FLOW_HANDLE = {
  /** trigger → menu de entrada (editável). */
  entry: "entry",
  /** menu → nó alvo quando `fallback.acao === "node"` (editável). */
  fallback: "fallback",
  /** R7: mensagem → destino depois de enviar (editável). */
  next: "next",
  /** saída da sequência implícita dos nós fixos (NÃO editável). */
  sequenceOut: "seq-out",
  /** entrada de todo nó que não é o trigger. */
  in: "in",
  option: (index: number) => `option-${index}`,
} as const;

// ── Auto-layout ──────────────────────────────────────────────────────────

export const LAYOUT = { columns: 4, xStep: 300, yStep: 260, originX: 40, originY: 40 } as const;

/** Posição de grade pro `index`-ésimo nó (coluna/linha simples). */
export function gridPosition(index: number): FlowPosition {
  return {
    x: LAYOUT.originX + (index % LAYOUT.columns) * LAYOUT.xStep,
    y: LAYOUT.originY + Math.floor(index / LAYOUT.columns) * LAYOUT.yStep,
  };
}

function hasValidPosition(p: unknown): p is FlowPosition {
  return !!p && typeof (p as FlowPosition).x === "number" && typeof (p as FlowPosition).y === "number"
    && Number.isFinite((p as FlowPosition).x) && Number.isFinite((p as FlowPosition).y);
}

/**
 * Preenche `position` SÓ nos nós que não têm uma válida (nunca move um nó já
 * posicionado). O índice de grade é o índice do nó no array — estável entre
 * loads enquanto a ordem não mudar. Retorna o MESMO array quando nada falta
 * (evita re-render à toa).
 */
export function withAutoLayout(nodes: WorkflowNode[]): WorkflowNode[] {
  if (nodes.every((n) => hasValidPosition(n.position))) return nodes;
  return nodes.map((n, i) => (hasValidPosition(n.position) ? n : { ...n, position: gridPosition(i) }));
}

export function setNodePosition(nodes: WorkflowNode[], nodeId: string, position: FlowPosition): WorkflowNode[] {
  return nodes.map((n) => (n.id === nodeId ? { ...n, position: { x: position.x, y: position.y } } : n));
}

// ── Arestas → React Flow ─────────────────────────────────────────────────

export interface FlowEdgeSpec {
  id: string;
  kind: CanvasEdgeKind;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  /** `false` = tracejada, sem apagar/reconectar (sequência implícita dos fixos). */
  editable: boolean;
  /** Número da opção (aresta "option") — vira rótulo da linha. */
  label?: string;
}

function sourceHandleFor(edge: CanvasEdge): string {
  switch (edge.kind) {
    case "option": return FLOW_HANDLE.option(edge.optionIndex ?? 0);
    case "fallback": return FLOW_HANDLE.fallback;
    case "entry": return FLOW_HANDLE.entry;
    case "next": return FLOW_HANDLE.next;
    case "sequence": return FLOW_HANDLE.sequenceOut;
  }
}

/**
 * Arestas que o canvas DESENHA. Destino vazio (`null`) ou que não existe mais
 * na árvore → a aresta NÃO é renderizada (o inspector é quem mostra o aviso,
 * ver `findDanglingEdges`). Nada é "consertado" em silêncio.
 */
export function toRenderableEdges(nodes: WorkflowNode[]): FlowEdgeSpec[] {
  const ids = new Set(nodes.map((n) => n.id));
  const specs: FlowEdgeSpec[] = [];
  for (const edge of computeCanvasEdges(nodes)) {
    if (edge.toNodeId === null || !ids.has(edge.toNodeId)) continue;
    specs.push({
      id: edge.id,
      kind: edge.kind,
      source: edge.fromNodeId,
      target: edge.toNodeId,
      sourceHandle: sourceHandleFor(edge),
      targetHandle: FLOW_HANDLE.in,
      editable: edge.kind !== "sequence",
      label: edge.kind === "option" && edge.optionNumero !== undefined ? String(edge.optionNumero) : undefined,
    });
  }
  return specs;
}

/** Arestas EDITÁVEIS com destino vazio/removido — o inspector mostra o aviso. */
export function findDanglingEdges(nodes: WorkflowNode[]): Array<CanvasEdge & { problem: "sem-destino" | "removido" }> {
  const ids = new Set(nodes.map((n) => n.id));
  const out: Array<CanvasEdge & { problem: "sem-destino" | "removido" }> = [];
  for (const edge of computeCanvasEdges(nodes)) {
    if (edge.kind === "sequence") continue;
    if (edge.toNodeId === null) out.push({ ...edge, problem: "sem-destino" });
    else if (!ids.has(edge.toNodeId)) out.push({ ...edge, problem: "removido" });
  }
  return out;
}

// ── Conexão (aresta → mutação do modelo) ─────────────────────────────────

export interface FlowConnection {
  source: string;
  sourceHandle: string | null | undefined;
  target: string;
  targetHandle: string | null | undefined;
}

export type ConnectionCheck = { ok: true } | { ok: false; reason: string };

/**
 * Valida uma conexão arrastada. Regras:
 *   - só os handles EDITÁVEIS conectam (`entry` do trigger; `option-i` do
 *     menu, `i` existente; `fallback` do menu, só com acao="node");
 *   - alvo = handle `in` de um nó existente que NÃO é o trigger;
 *   - `entry` só aponta pra um nó "menu" ou "message" (é o que o motor entende);
 *   - `next` (nó "message") só aponta pra "menu" ou "message", nunca pra si
 *     mesmo (o motor também corta ciclos mais longos, mas o próprio nó é
 *     erro óbvio de montagem);
 *   - `fallback` não pode apontar pro próprio menu ("outro nó"); `option` PODE
 *     (padrão real "9 - voltar ao menu").
 */
export function canConnect(nodes: WorkflowNode[], c: FlowConnection): ConnectionCheck {
  const source = nodes.find((n) => n.id === c.source);
  const target = nodes.find((n) => n.id === c.target);
  if (!source || !target) return { ok: false, reason: "nó inexistente" };
  if (c.targetHandle !== FLOW_HANDLE.in) return { ok: false, reason: "handle de destino inválido" };
  if (target.type === "trigger") return { ok: false, reason: "o gatilho não recebe conexões" };

  if (source.type === "trigger") {
    if (c.sourceHandle !== FLOW_HANDLE.entry) return { ok: false, reason: "só a entrada do fluxo é editável" };
    if (target.type !== "menu" && target.type !== "message") {
      return { ok: false, reason: "a entrada só aponta pra um nó de menu ou de mensagem" };
    }
    return { ok: true };
  }
  if (source.type === "message") {
    if (c.sourceHandle !== FLOW_HANDLE.next) return { ok: false, reason: "saída inexistente" };
    if (target.id === source.id) return { ok: false, reason: "a mensagem não pode apontar pra si mesma" };
    if (target.type !== "menu" && target.type !== "message") {
      return { ok: false, reason: "a mensagem só segue pra um menu ou outra mensagem" };
    }
    return { ok: true };
  }
  if (source.type === "menu") {
    if (c.sourceHandle === FLOW_HANDLE.fallback) {
      if (source.properties.fallback.acao !== "node") return { ok: false, reason: "fallback só liga com acao=\"node\"" };
      if (target.id === source.id) return { ok: false, reason: "o fallback precisa apontar pra OUTRO nó" };
      return { ok: true };
    }
    const m = /^option-(\d+)$/.exec(c.sourceHandle ?? "");
    if (m && Number(m[1]) < source.properties.opcoes.length) return { ok: true };
    return { ok: false, reason: "opção inexistente" };
  }
  return { ok: false, reason: "este nó não tem saída editável" };
}

/** Grava a conexão no modelo. Inválida → devolve o MESMO array (no-op). */
export function applyConnection(nodes: WorkflowNode[], c: FlowConnection): WorkflowNode[] {
  if (!canConnect(nodes, c).ok) return nodes;
  return nodes.map((n) => {
    if (n.id !== c.source) return n;
    if (n.type === "trigger" || n.type === "message") {
      return { ...n, properties: { ...n.properties, nextNodeId: c.target } } as WorkflowNode;
    }
    if (n.type === "menu") {
      if (c.sourceHandle === FLOW_HANDLE.fallback) {
        return { ...n, properties: { ...n.properties, fallback: { ...n.properties.fallback, fallbackNodeId: c.target } } };
      }
      const index = Number(/^option-(\d+)$/.exec(c.sourceHandle ?? "")![1]);
      return {
        ...n,
        properties: {
          ...n.properties,
          opcoes: n.properties.opcoes.map((o, i) => (i === index ? { ...o, nextNodeId: c.target } : o)),
        },
      };
    }
    return n;
  });
}

/**
 * Apagar uma aresta limpa o campo que a originou: `opcoes[i].nextNodeId` → "",
 * `fallbackNodeId` → removido, `trigger.nextNodeId` → removido (volta ao
 * automático), `message.nextNodeId` → removido (a mensagem passa a encerrar o fluxo). Aresta "sequence" (implícita) ou id desconhecido → no-op.
 */
export function applyEdgeDeletion(nodes: WorkflowNode[], edgeId: string): WorkflowNode[] {
  const edge = computeCanvasEdges(nodes).find((e) => e.id === edgeId);
  if (!edge || edge.kind === "sequence") return nodes;
  return nodes.map((n) => {
    if (n.id !== edge.fromNodeId) return n;
    if (edge.kind === "entry" && n.type === "trigger") {
      const { nextNodeId: _removed, ...rest } = n.properties;
      return { ...n, properties: rest };
    }
    if (edge.kind === "next" && n.type === "message") {
      const { nextNodeId: _removed, ...rest } = n.properties;
      return { ...n, properties: rest };
    }
    if (n.type === "menu") {
      if (edge.kind === "fallback") {
        const { fallbackNodeId: _removed, ...fb } = n.properties.fallback;
        return { ...n, properties: { ...n.properties, fallback: fb } };
      }
      if (edge.kind === "option") {
        return {
          ...n,
          properties: {
            ...n.properties,
            opcoes: n.properties.opcoes.map((o, i) => (i === edge.optionIndex ? { ...o, nextNodeId: "" } : o)),
          },
        };
      }
    }
    return n;
  });
}

// ── Exclusão de nó ───────────────────────────────────────────────────────

/** Só nós criados pelo usuário ("menu" e "message") podem ser excluídos. Os 4
 *  fixos (trigger/ai/send/handover) só são desabilitados, como sempre foi. */
export function isNodeDeletable(node: WorkflowNode | undefined): boolean {
  return node?.type === "menu" || node?.type === "message";
}

/**
 * Quantas conexões editáveis (opção/fallback/entrada) tocam o nó — as que
 * chegam nele E as que saem dele. Só pra dizer ao usuário o que a exclusão
 * leva junto; não inclui a sequência implícita dos fixos.
 */
export function countNodeConnections(nodes: WorkflowNode[], nodeId: string): number {
  return computeCanvasEdges(nodes).filter(
    (e) => e.kind !== "sequence" && e.toNodeId !== null && (e.toNodeId === nodeId || e.fromNodeId === nodeId),
  ).length;
}

/**
 * Exclui um nó "menu"/"message" e limpa TODA referência a ele no modelo:
 *   - `opcoes[i].nextNodeId === id` (de qualquer menu) → "";
 *   - `message.nextNodeId === id` (de qualquer mensagem) → chave removida (a
 *     mensagem passa a encerrar o fluxo scriptado);
 *   - `fallback.fallbackNodeId === id` → chave removida (a `acao` é preservada;
 *     sem destino o motor trata como esgotado e entrega a humano);
 *   - `trigger.properties.nextNodeId === id` → chave removida (volta ao automático).
 * Nó fixo, inexistente ou id desconhecido → no-op (devolve o MESMO array).
 */
export function applyNodeDeletion(nodes: WorkflowNode[], nodeId: string): WorkflowNode[] {
  if (!isNodeDeletable(nodes.find((n) => n.id === nodeId))) return nodes;
  return nodes
    .filter((n) => n.id !== nodeId)
    .map((n) => {
      if ((n.type === "trigger" || n.type === "message") && n.properties.nextNodeId === nodeId) {
        const { nextNodeId: _removed, ...rest } = n.properties;
        return { ...n, properties: rest } as WorkflowNode;
      }
      if (n.type === "menu") {
        const hasOption = n.properties.opcoes.some((o) => o.nextNodeId === nodeId);
        const hasFallback = n.properties.fallback.fallbackNodeId === nodeId;
        if (!hasOption && !hasFallback) return n;
        const { fallbackNodeId: _removed, ...fb } = n.properties.fallback;
        return {
          ...n,
          properties: {
            ...n.properties,
            opcoes: n.properties.opcoes.map((o) => (o.nextNodeId === nodeId ? { ...o, nextNodeId: "" } : o)),
            fallback: hasFallback ? fb : n.properties.fallback,
          },
        };
      }
      return n;
    });
}

// ── Tecla Delete/Backspace ───────────────────────────────────────────────

export type DeleteKeyAction =
  | { type: "edges"; edgeIds: string[] }
  | { type: "node"; nodeId: string }
  | { type: "none" };

/**
 * O que Delete/Backspace faz no canvas: aresta(s) EDITÁVEL(is) selecionada(s)
 * têm prioridade (clicar numa linha seleciona a linha; o nó segue "ativo" no
 * inspector mas a intenção é apagar a linha); senão, o nó selecionado SE for
 * excluível (menu/mensagem). Sequência implícita e nós fixos → "none".
 */
export function resolveDeleteKey(args: {
  nodes: WorkflowNode[];
  selectedNodeId: string;
  selectedEdgeIds: string[];
}): DeleteKeyAction {
  const editable = new Set(toRenderableEdges(args.nodes).filter((e) => e.editable).map((e) => e.id));
  const edgeIds = args.selectedEdgeIds.filter((id) => editable.has(id));
  if (edgeIds.length > 0) return { type: "edges", edgeIds };
  if (args.selectedEdgeIds.length > 0) return { type: "none" }; // só sequência implícita selecionada
  const node = args.nodes.find((n) => n.id === args.selectedNodeId);
  return isNodeDeletable(node) ? { type: "node", nodeId: args.selectedNodeId } : { type: "none" };
}
