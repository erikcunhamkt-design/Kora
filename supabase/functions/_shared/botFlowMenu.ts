// Etapa 9 · Item 4 (construtor de fluxo scriptado) — R3, motor de runtime
// do nó "menu" (docs/qa/etapa-9-bot-fluxo-scriptado-r3-motor-runtime-menu.md).
// Pure logic — sem Deno.*, sem npm: imports — mesmo padrão de
// botFlowTemplate.ts/botCredentials.ts, testável via vitest sem precisar
// de Deno.serve nem de um banco real.
//
// Nó "menu" é uma ALTERNATIVA ao nó "ai" (decisão do operador, R1 §0 item
// 3 — docs/qa/etapa-9-bot-fluxo-scriptado-r1-fundacao.md), nunca uma
// dependência dele: uma árvore só com "menu" (sem "ai") precisa continuar
// sendo um fluxo válido. Este motor só entende nós "menu" — avançar pra
// qualquer outro tipo de nó (ai/send/handover/trigger) SAI do
// acompanhamento scriptado (retorna o id do próximo nó, `state` fica pro
// chamador zerar) em vez de executar esse nó: um dispatcher genérico por
// tipo de nó é fora de escopo desta rodada (só "menu" carrega `nextNodeId`
// hoje — R1 §0, "os 4 nós existentes não têm esse conceito"). Mesmo
// tratamento pro estouro de `maxTentativas` com `acao: "node"` — o
// `fallbackNodeId` é tipicamente mas não necessariamente um nó de
// handover (R1 §1), e o handover REAL (atribuir a um atendente, etc.) é a
// R4 da Lane E — aqui só marca/encerra o fluxo de forma limpa.

export interface MenuNodeOption {
  numero: number;
  rotulo: string;
  nextNodeId: string;
}

export interface MenuNodeFallback {
  maxTentativas: number;
  acao: "reprompt" | "node";
  fallbackNodeId?: string;
}

export interface MenuNode {
  id: string;
  mensagem: string;
  opcoes: MenuNodeOption[];
  fallback: MenuNodeFallback;
}

export interface BotFlowState {
  currentNodeId: string;
  attempts: number;
}

// Forma mínima de um nó de flow_data que interessa aqui — index.ts adapta
// o próprio BotFlowNode (bag plano de properties, mesmo molde dos outros 4
// tipos de nó no arquivo) pra este formato de entrada.
export interface RawFlowNode {
  id: string;
  type: string;
  enabled: boolean;
  properties?: {
    mensagem?: unknown;
    opcoes?: unknown;
    fallback?: unknown;
  };
}

function isValidOption(o: unknown): o is MenuNodeOption {
  if (!o || typeof o !== "object") return false;
  const opt = o as Record<string, unknown>;
  return (
    typeof opt.numero === "number" &&
    typeof opt.rotulo === "string" &&
    typeof opt.nextNodeId === "string"
  );
}

function isValidFallback(f: unknown): f is MenuNodeFallback {
  if (!f || typeof f !== "object") return false;
  const fb = f as Record<string, unknown>;
  if (typeof fb.maxTentativas !== "number" || (fb.acao !== "reprompt" && fb.acao !== "node")) return false;
  if (fb.fallbackNodeId !== undefined && typeof fb.fallbackNodeId !== "string") return false;
  return true;
}

// Extrai só os nós "menu" HABILITADOS e com forma válida — degrada em
// silêncio (pula o nó, não lança) quando `properties` vem incompleto ou
// malformado, mesma disciplina defensiva do resto desta rodada (nunca
// derrubar o fluxo por causa de um dado inesperado).
export function extractMenuNodes(nodes: RawFlowNode[]): MenuNode[] {
  const result: MenuNode[] = [];
  for (const n of nodes) {
    if (n.type !== "menu" || !n.enabled) continue;
    const p = n.properties;
    if (!p || typeof p.mensagem !== "string") continue;
    if (!Array.isArray(p.opcoes) || !p.opcoes.every(isValidOption)) continue;
    if (!isValidFallback(p.fallback)) continue;
    result.push({
      id: n.id,
      mensagem: p.mensagem,
      opcoes: p.opcoes as MenuNodeOption[],
      fallback: p.fallback as MenuNodeFallback,
    });
  }
  return result;
}

// Lê `whatsapp_conversations.bot_flow_state` (coluna PROPOSTA, ainda não
// aplicada — draft §2 de docs/qa/etapa-9-bot-fluxo-scriptado-r1-fundacao.md).
// `raw` pode ser `undefined` (coluna não existe no schema real ainda, ou
// `select` não a devolveu), `null` (conversa nunca entrou num fluxo
// scriptado — o estado normal hoje) ou qualquer JSON já gravado — nenhum
// desses casos deve derrubar o chamador.
export function parseBotFlowState(raw: unknown): BotFlowState | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.currentNodeId !== "string" || typeof obj.attempts !== "number") return null;
  return { currentNodeId: obj.currentNodeId, attempts: obj.attempts };
}

export function renderMenuPrompt(node: MenuNode): string {
  const lines = node.opcoes.map((o) => `${o.numero} - ${o.rotulo}`);
  return [node.mensagem, ...lines].join("\n");
}

// Casar a resposta com as opções numeradas: número EXATO (tolera espaços
// em volta, não aceita nada além de dígitos — "2", " 2 " casam; "opção 2",
// "2.0", "1 2" não casam).
export function matchMenuOption(messageText: string, opcoes: MenuNodeOption[]): MenuNodeOption | undefined {
  const trimmed = (messageText ?? "").trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const numero = Number(trimmed);
  return opcoes.find((o) => o.numero === numero);
}

export type MenuTurnResult =
  | { kind: "none" }
  | { kind: "present"; message: string; state: BotFlowState }
  | { kind: "reprompt"; message: string; state: BotFlowState }
  | { kind: "advanced-away"; nextNodeId: string }
  | { kind: "handover-fallback"; fallbackNodeId: string };

// Motor de 1 turno: dado o conjunto de nós "menu" habilitados, o estado
// atual da conversa (ou null) e a mensagem recebida, decide o que fazer.
export function resolveMenuTurn(
  menuNodes: MenuNode[],
  state: BotFlowState | null,
  messageText: string,
): MenuTurnResult {
  if (menuNodes.length === 0) return { kind: "none" };

  const byId = new Map(menuNodes.map((n) => [n.id, n]));
  const activeNode = state ? byId.get(state.currentNodeId) : undefined;

  if (!activeNode) {
    // Sem estado (primeira mensagem), ou estado aponta pra um nó que não é
    // mais um "menu" habilitado (desabilitado/removido entre uma virada e
    // outra) — (re)apresenta o primeiro "menu" habilitado da árvore.
    const entryNode = menuNodes[0];
    return {
      kind: "present",
      message: renderMenuPrompt(entryNode),
      state: { currentNodeId: entryNode.id, attempts: 0 },
    };
  }

  const matched = matchMenuOption(messageText, activeNode.opcoes);
  if (matched) {
    const nextNode = byId.get(matched.nextNodeId);
    if (nextNode) {
      return {
        kind: "present",
        message: renderMenuPrompt(nextNode),
        state: { currentNodeId: nextNode.id, attempts: 0 },
      };
    }
    // nextNodeId aponta pra um nó que não é um "menu" conhecido (outro
    // tipo, ou id sem correspondência) — sai do acompanhamento scriptado,
    // ponto de encaixe pra quem processar esse nó (fora de escopo aqui).
    return { kind: "advanced-away", nextNodeId: matched.nextNodeId };
  }

  const attempts = state.attempts + 1;
  const { maxTentativas, acao, fallbackNodeId } = activeNode.fallback;

  if (attempts >= maxTentativas && acao === "node" && fallbackNodeId) {
    return { kind: "handover-fallback", fallbackNodeId };
  }

  // Default do produto (R1 §0 item 2): reprompt — reapresenta o mesmo
  // menu com um aviso. Também o destino seguro quando `acao === "node"`
  // mas sem `fallbackNodeId` configurado (não validado em tipo — R1 §1) e
  // quando `acao === "reprompt"` mesmo após esgotar `maxTentativas`
  // ("reprompt indefinido", a própria definição do produto pra esse caso).
  return {
    kind: "reprompt",
    message: `Resposta inválida. Responda com uma opção válida.\n\n${renderMenuPrompt(activeNode)}`,
    state: { currentNodeId: activeNode.id, attempts },
  };
}
