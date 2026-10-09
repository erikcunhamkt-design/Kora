// R6 — canvas visual do fluxo do bot (estilo n8n), substituindo a grade CSS
// do WhatsAppBotConfig: nós soltos, arrastar, ligar com linha (React Flow v12,
// `@xyflow/react`, MIT).
//
// Fonte de verdade = o modelo `WorkflowNode[]` (flow_data). Este componente é
// uma VIEW controlada: deriva nós/arestas do modelo a cada render e devolve
// toda edição como mutação do modelo via `onNodesModelChange(updater)` —
// usando as funções puras de `flowCanvasModel.ts` (testáveis sem DOM). A
// edição de campos continua 100% no inspector existente (clicar num nó o
// seleciona; o handle/aresta é só mais um jeito de editar o MESMO campo).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, Panel, Handle, Position,
  MarkerType, applyNodeChanges, useReactFlow,
  type Edge, type Node, type NodeChange, type NodeProps, type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  BrainCircuit, MessageSquare, MessageSquareCode, Send, Sparkles, UserCog, type LucideIcon,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { WorkflowNode } from "@/components/whatsapp/WhatsAppBotConfig";
import {
  FLOW_HANDLE, applyConnection, applyEdgeDeletion, canConnect, gridPosition,
  resolveDeleteKey, setNodePosition, toRenderableEdges, type FlowPosition,
} from "@/components/whatsapp/flowCanvasModel";

const NODE_WIDTH = 224;

interface FlowNodeData extends Record<string, unknown> {
  node: WorkflowNode;
  onToggleEnabled: (nodeId: string) => void;
}
type FlowRfNode = Node<FlowNodeData, "flow">;

const TYPE_STYLE: Record<WorkflowNode["type"], { icon: LucideIcon; border: string; iconBg: string; iconCol: string }> = {
  trigger: { icon: Sparkles, border: "emerald", iconBg: "bg-emerald-500/10", iconCol: "text-emerald-400" },
  ai: { icon: BrainCircuit, border: "violet", iconBg: "bg-violet-500/10", iconCol: "text-violet-400" },
  send: { icon: Send, border: "blue", iconBg: "bg-blue-500/10", iconCol: "text-blue-400" },
  handover: { icon: UserCog, border: "orange", iconBg: "bg-orange-500/10", iconCol: "text-orange-400" },
  menu: { icon: MessageSquareCode, border: "pink", iconBg: "bg-pink-500/10", iconCol: "text-pink-400" },
  message: { icon: MessageSquare, border: "cyan", iconBg: "bg-cyan-500/10", iconCol: "text-cyan-400" },
};

const BORDER_CLASS: Record<string, { idle: string; selected: string }> = {
  emerald: { idle: "border-emerald-500/30", selected: "border-emerald-500 ring-1 ring-emerald-500" },
  violet: { idle: "border-violet-500/30", selected: "border-violet-500 ring-1 ring-violet-500" },
  blue: { idle: "border-blue-500/30", selected: "border-blue-500 ring-1 ring-blue-500" },
  orange: { idle: "border-orange-500/30", selected: "border-orange-500 ring-1 ring-orange-500" },
  pink: { idle: "border-pink-500/30", selected: "border-pink-500 ring-1 ring-pink-500" },
  cyan: { idle: "border-cyan-500/30", selected: "border-cyan-500 ring-1 ring-cyan-500" },
};

function summaryOf(node: WorkflowNode): string {
  switch (node.type) {
    case "trigger": return node.properties.respondAll ? "Irrestrito" : "Apenas Novos";
    case "ai": return `Provedor: ${node.properties.provider}`;
    case "send": return node.properties.template;
    case "handover": return node.enabled ? "Fila Humana Ativa" : "Desativado";
    case "menu":
      return node.properties.opcoes.length === 0
        ? "Sem opções"
        : `${node.properties.opcoes.length} opç${node.properties.opcoes.length === 1 ? "ão" : "ões"}`;
    case "message": return node.properties.mensagem.trim() === "" ? "Sem texto" : node.properties.mensagem;
  }
}

/** Altura estimada (só pro tamanho inicial, antes de o React Flow medir). */
function estimatedHeight(node: WorkflowNode): number {
  if (node.type === "menu") {
    const rows = node.properties.opcoes.length + (node.properties.fallback.acao === "node" ? 1 : 0);
    return 96 + rows * 26;
  }
  return node.type === "trigger" ? 124 : 96;
}

const HANDLE_BASE = "!h-3 !w-3 !border-2 !border-background";

// Nó custom: card (ícone do tipo, título, resumo curto, badge desabilitado) +
// handles de saída — trigger: 1 (entrada do fluxo); menu: 1 por opção
// (rotulado com o número) + 1 de fallback só com acao="node"; mensagem: 1
// ("Depois de enviar"); demais nós sem handle editável. Todo nó que não é o trigger tem 1 handle de entrada.
function FlowNodeCard({ data, selected }: NodeProps<FlowRfNode>) {
  const { node, onToggleEnabled } = data;
  const style = TYPE_STYLE[node.type];
  const Icon = style.icon;
  const border = BORDER_CLASS[style.border];
  // `selected` do React Flow: o pai deriva de selectedNodeId.
  return (
    <FlowNodeBody
      node={node} onToggleEnabled={onToggleEnabled} icon={Icon} iconBg={style.iconBg} iconCol={style.iconCol}
      borderClass={selected ? border.selected : border.idle}
    />
  );
}

function FlowNodeBody({
  node, onToggleEnabled, icon: Icon, iconBg, iconCol, borderClass,
}: {
  node: WorkflowNode;
  onToggleEnabled: (id: string) => void;
  icon: LucideIcon;
  iconBg: string;
  iconCol: string;
  borderClass: string;
}) {
  return (
    <div
      data-flow-node-id={node.id}
      data-flow-node-type={node.type}
      className={`relative rounded-xl border bg-background/90 p-3 shadow-sm backdrop-blur-sm ${
        node.enabled ? borderClass : "border-dashed border-border/40 opacity-60"
      }`}
      style={{ width: NODE_WIDTH }}
    >
      {node.type !== "trigger" && (
        <Handle type="target" id={FLOW_HANDLE.in} position={Position.Left} className={`${HANDLE_BASE} !bg-muted-foreground`} />
      )}

      <div className="flex items-start justify-between gap-2">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg} ${iconCol}`}>
          <Icon className="h-4 w-4" />
        </div>
        {node.type !== "trigger" && node.type !== "send" && (
          <div className="nodrag nopan" onClick={(e) => e.stopPropagation()}>
            <Switch
              checked={node.enabled}
              onCheckedChange={() => onToggleEnabled(node.id)}
              className="scale-75"
              aria-label={`Habilitar ${node.title}`}
            />
          </div>
        )}
      </div>

      <div className="mt-2">
        <h4 className="text-xs font-bold text-foreground">{node.title}</h4>
        <p className="text-[9px] text-muted-foreground truncate mt-0.5">{summaryOf(node)}</p>
        {!node.enabled && (
          <span className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
            Desabilitado
          </span>
        )}
      </div>

      {node.type === "trigger" && (
        <div className="relative -mx-3 mt-2 flex items-center justify-between px-3 text-[10px] text-muted-foreground">
          <span>Início do fluxo</span>
          <Handle
            type="source" id={FLOW_HANDLE.entry} position={Position.Right}
            className={`${HANDLE_BASE} !bg-emerald-500`}
          />
        </div>
      )}

      {node.type === "menu" && (
        <ul className="mt-2 space-y-1">
          {node.properties.opcoes.map((opcao, index) => (
            <li
              key={index}
              className="relative -mx-3 flex items-center gap-1.5 px-3 text-[10px] text-foreground/80"
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-pink-500/10 text-[9px] font-bold text-pink-400">
                {opcao.numero}
              </span>
              <span className="truncate">{opcao.rotulo || "(sem rótulo)"}</span>
              <Handle
                type="source" id={FLOW_HANDLE.option(index)} position={Position.Right}
                className={`${HANDLE_BASE} !bg-pink-500`}
              />
            </li>
          ))}
          {node.properties.fallback.acao === "node" && (
            <li className="relative -mx-3 flex items-center gap-1.5 px-3 text-[10px] text-amber-500">
              <span>⚠ resposta inválida</span>
              <Handle
                type="source" id={FLOW_HANDLE.fallback} position={Position.Right}
                className={`${HANDLE_BASE} !bg-amber-500`}
              />
            </li>
          )}
        </ul>
      )}

      {node.type === "message" && (
        <div className="relative -mx-3 mt-2 flex items-center justify-between px-3 text-[10px] text-muted-foreground">
          <span>Depois de enviar</span>
          <Handle
            type="source" id={FLOW_HANDLE.next} position={Position.Right}
            className={`${HANDLE_BASE} !bg-cyan-500`}
          />
        </div>
      )}

      {/* Saída da sequência IMPLÍCITA dos nós fixos — só visual, não conecta
          (a semântica do runtime fixo não muda nesta rodada). */}
      {node.type !== "menu" && node.type !== "message" && (
        <Handle
          type="source" id={FLOW_HANDLE.sequenceOut} position={Position.Right} isConnectable={false}
          className="!h-2 !w-2 !border-0 !bg-border"
          style={{ top: 18 }}
        />
      )}
    </div>
  );
}

// Fora do componente: `nodeTypes` precisa ter identidade estável (senão o React
// Flow remonta todos os nós a cada render).
const nodeTypes = { flow: FlowNodeCard };

export interface FlowCanvasProps {
  nodes: WorkflowNode[];
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
  /** Toda edição do canvas vira uma mutação funcional do modelo. */
  onNodesModelChange: (updater: (prev: WorkflowNode[]) => WorkflowNode[]) => void;
  onToggleEnabled: (nodeId: string) => void;
  /** "+ Nó de menu": cria no centro do viewport. */
  onAddMenuNode: (position: FlowPosition) => void;
  /** "+ Nó de mensagem" (R7): cria no centro do viewport. */
  onAddMessageNode: (position: FlowPosition) => void;
  /** Delete/Backspace com um nó "menu"/"message" selecionado (o pai aplica applyNodeDeletion + reseleciona). */
  onDeleteNode: (nodeId: string) => void;
}

function FlowCanvasInner({
  nodes, selectedNodeId, onSelectNode, onNodesModelChange, onToggleEnabled, onAddMenuNode, onAddMessageNode, onDeleteNode,
}: FlowCanvasProps) {
  const rf = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const derivedNodes = useMemo<FlowRfNode[]>(
    () => nodes.map((n, i) => ({
      id: n.id,
      type: "flow" as const,
      position: n.position ?? gridPosition(i),
      data: { node: n, onToggleEnabled },
      selected: n.id === selectedNodeId,
      deletable: false, // exclusão é do nosso handler (applyNodeDeletion), não do deleteKeyCode do RF
      // Tamanho inicial (antes da medição do React Flow) — também faz o nó
      // aparecer em ambientes sem layout real (jsdom).
      initialWidth: NODE_WIDTH,
      initialHeight: estimatedHeight(n),
    })),
    [nodes, selectedNodeId, onToggleEnabled],
  );

  // Estado local do React Flow (medidas/arraste em andamento) — o modelo
  // continua sendo a fonte de verdade: a cada mudança dele, re-deriva
  // preservando só o que o React Flow mediu.
  const [rfNodes, setRfNodes] = useState<FlowRfNode[]>(derivedNodes);
  useEffect(() => {
    setRfNodes((prev) => {
      const prevById = new Map(prev.map((p) => [p.id, p]));
      return derivedNodes.map((d) => {
        const p = prevById.get(d.id);
        return p ? { ...d, measured: p.measured, width: p.width, height: p.height } : d;
      });
    });
  }, [derivedNodes]);

  const edgeSpecs = useMemo(() => toRenderableEdges(nodes), [nodes]);
  const rfEdges = useMemo<Edge[]>(
    () => edgeSpecs.map((s) => ({
      id: s.id,
      source: s.source,
      target: s.target,
      sourceHandle: s.sourceHandle,
      targetHandle: s.targetHandle,
      label: s.label,
      deletable: s.editable,
      selectable: s.editable,
      focusable: s.editable,
      reconnectable: false,
      markerEnd: { type: MarkerType.ArrowClosed },
      // Sequência implícita dos fixos: tracejada, não editável.
      style: s.editable ? undefined : { strokeDasharray: "5 5", opacity: 0.5 },
      className: `flow-edge-${s.kind}`,
    })),
    [edgeSpecs],
  );

  const onNodesChange = useCallback((changes: NodeChange<FlowRfNode>[]) => {
    setRfNodes((prev) => applyNodeChanges(changes, prev));
    const moves = changes.filter((c): c is Extract<NodeChange<FlowRfNode>, { type: "position" }> => c.type === "position" && !!c.position);
    if (moves.length > 0) {
      onNodesModelChange((prev) => moves.reduce((acc, c) => setNodePosition(acc, c.id, c.position!), prev));
    }
  }, [onNodesModelChange]);

  const onConnect = useCallback((c: Connection) => {
    onNodesModelChange((prev) => applyConnection(prev, c));
  }, [onNodesModelChange]);

  const isValidConnection = useCallback(
    (c: Connection | Edge) => canConnect(nodes, {
      source: c.source, sourceHandle: c.sourceHandle, target: c.target, targetHandle: c.targetHandle,
    }).ok,
    [nodes],
  );

  // Arestas selecionadas no React Flow (clicar na linha). Só mantém o id — a
  // decisão do que apagar é de `resolveDeleteKey` (pura, testada).
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const onSelectionChange = useCallback(({ edges: selected }: { edges: Edge[] }) => {
    const ids = selected.map((e) => e.id);
    setSelectedEdgeIds((prev) => (prev.join("|") === ids.join("|") ? prev : ids));
  }, []);

  // Delete/Backspace — tratado AQUI (escopo = foco dentro do canvas), não pelo
  // `deleteKeyCode` global do React Flow (null abaixo): com nós "menu"
  // excluíveis, a tecla global apagaria o nó selecionado mesmo com o foco num
  // controle do inspector (ex.: o gatilho do Select). Ignora campos de texto,
  // selects e botões (inclui o switch do card e o "+ Adicionar nó de menu").
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Delete" && e.key !== "Backspace") return;
    const target = e.target as HTMLElement | null;
    if (target?.closest?.('input, textarea, select, button, [contenteditable="true"]')) return;
    const action = resolveDeleteKey({ nodes, selectedNodeId, selectedEdgeIds });
    if (action.type === "none") return;
    e.preventDefault();
    if (action.type === "edges") {
      onNodesModelChange((prev) => action.edgeIds.reduce((acc, id) => applyEdgeDeletion(acc, id), prev));
    } else {
      onDeleteNode(action.nodeId);
    }
  }, [nodes, selectedNodeId, selectedEdgeIds, onNodesModelChange, onDeleteNode]);

  // Centro do viewport (ou posição de grade, em ambientes sem layout real).
  const centerPosition = (): FlowPosition => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    const pos = rf.screenToFlowPosition({
      x: (rect?.left ?? 0) + (rect?.width ?? 0) / 2,
      y: (rect?.top ?? 0) + (rect?.height ?? 0) / 2,
    });
    const safe = Number.isFinite(pos.x) && Number.isFinite(pos.y) ? pos : gridPosition(nodes.length);
    return { x: Math.round(safe.x), y: Math.round(safe.y) };
  };
  const handleAddMenu = () => onAddMenuNode(centerPosition());
  const handleAddMessage = () => onAddMessageNode(centerPosition());

  return (
    <div
      ref={wrapperRef}
      tabIndex={-1}
      data-testid="flow-canvas"
      onKeyDown={onKeyDown}
      className="relative h-[520px] w-full overflow-hidden rounded-xl border border-border/40 bg-card/60 outline-none"
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onSelectionChange={onSelectionChange}
        deleteKeyCode={null}
        onNodeClick={(_, n) => onSelectNode(n.id)}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        colorMode="system"
        nodesConnectable
        elementsSelectable
      >
        <Background gap={20} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable />
        <Panel position="top-left" className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleAddMenu}
            className="rounded-lg border border-dashed border-pink-500/50 bg-background/90 px-3 py-1.5 text-[11px] font-bold text-pink-400 hover:border-pink-500 hover:bg-pink-500/5"
          >
            + Adicionar nó de menu
          </button>
          <button
            type="button"
            onClick={handleAddMessage}
            className="rounded-lg border border-dashed border-cyan-500/50 bg-background/90 px-3 py-1.5 text-[11px] font-bold text-cyan-400 hover:border-cyan-500 hover:bg-cyan-500/5"
          >
            + Adicionar nó de mensagem
          </button>
          <span className="text-[10px] text-muted-foreground">
            Arraste o ponto de uma opção até outro nó para ligar · selecione a linha ou o nó (menu/mensagem) e Delete/Backspace para apagar
          </span>
        </Panel>
      </ReactFlow>

      {/* Alternativa acessível/textual do diagrama: as MESMAS arestas
          desenhadas, como lista (leitores de tela + testes sem layout). */}
      <ul aria-label="Conexões do fluxo" className="sr-only">
        {edgeSpecs.map((s) => {
          const from = nodes.find((n) => n.id === s.source);
          const to = nodes.find((n) => n.id === s.target);
          return (
            <li
              key={s.id}
              data-edge-kind={s.kind}
              data-edge-from={s.source}
              data-edge-to={s.target}
              data-edge-editable={s.editable ? "true" : "false"}
            >
              {s.label ? `Opção ${s.label}: ` : ""}{from?.title} → {to?.title}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
