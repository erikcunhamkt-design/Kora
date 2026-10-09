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
// handover (R1 §1). Este módulo só DECIDE (devolve `handover-fallback`/
// `exhausted`); o handover REAL (estado persistido "entregue a humano",
// bot em silêncio) é da R4 — botHandover.ts, que interpreta esses
// resultados.

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

// R7 — nó "message": texto informativo montável pelo usuário entre menus
// (ex.: "Horário: seg–sex 9h–18h" → voltar ao menu). Diferente do menu, NÃO
// espera resposta: ao ser alcançado, o motor envia o texto e segue
// IMEDIATAMENTE `nextNodeId` no MESMO turno (se for um menu, o menu é
// apresentado na mesma resposta; se for outra mensagem, encadeia; ausente
// encerra o acompanhamento scriptado). Por isso o estado persistido
// (`BotFlowState.currentNodeId`) NUNCA aponta pra um nó "message" — a cadeia é
// atômica dentro de uma virada, o shape de `bot_flow_state` não muda.
export interface MessageNode {
  id: string;
  mensagem: string;
  /** Destino depois de enviar (tipicamente um menu). Ausente = encerra o fluxo scriptado. */
  nextNodeId?: string;
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
    /** R7 — só o nó "message" usa (destino depois de enviar). */
    nextNodeId?: unknown;
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

// R7 — só nós "message" HABILITADOS, com `mensagem` string NÃO vazia (texto em
// branco não tem o que enviar: um nó assim se comporta como desabilitado — o
// destino que apontava pra ele cai no mesmo "nó que o motor não conhece" de
// sempre). `nextNodeId` ausente/vazio/não-string → undefined (encerra).
export function extractMessageNodes(nodes: RawFlowNode[]): MessageNode[] {
  const result: MessageNode[] = [];
  for (const n of nodes) {
    if (n.type !== "message" || !n.enabled) continue;
    const p = n.properties;
    if (!p || typeof p.mensagem !== "string" || p.mensagem.trim() === "") continue;
    const next = typeof p.nextNodeId === "string" && p.nextNodeId !== "" ? p.nextNodeId : undefined;
    result.push({ id: n.id, mensagem: p.mensagem, nextNodeId: next });
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
  | { kind: "handover-fallback"; fallbackNodeId: string }
  // R4: estourou `maxTentativas` sem destino de nó utilizável. Quem decide
  // o que fazer é o chamador (botHandover.ts → entrega a humano).
  | { kind: "exhausted" }
  // R7: a virada passou por 1+ nós "message". `message` já vem MONTADO (textos
  // das mensagens da cadeia + o menu de destino, se houver, separados por uma
  // linha em branco) — uma única resposta, o chamador só envia e persiste
  // `state` (null = cadeia terminou sem menu: encerra o acompanhamento, e a
  // PRÓXIMA mensagem reentra pelo menu de entrada; sem IA nesta virada).
  | MessageTurnResult;

export interface MessageTurnResult {
  kind: "message";
  message: string;
  /** Menu em que a cadeia terminou (aguardando resposta) ou null. */
  state: BotFlowState | null;
  /** Ids dos nós "message" percorridos, em ordem (log/diagnóstico). */
  messageNodeIds: string[];
  /** Cadeia cortada: "cycle" (voltou a um nó já enviado) ou "hop-limit" (passou de MAX_MESSAGE_HOPS). O chamador LOGA. */
  truncated?: "cycle" | "hop-limit";
  /** `nextNodeId` que não é menu nem mensagem conhecida (outro tipo/removido/desabilitado): a cadeia encerra ali. O chamador LOGA. */
  unresolvedNextNodeId?: string;
}

// Teto de nós "message" enviados numa única virada. Árvore finita ⇒ qualquer
// cadeia sem ciclo já acaba sozinha; o teto existe pra uma cadeia LONGA
// legítima não virar uma rajada de textos no WhatsApp (e como 2ª trava).
export const MAX_MESSAGE_HOPS = 5;

// Aresta de ENTRADA (Etapa 9 · item 4, fecha a dívida de design da R3 +
// o "entry" reservado no G80): `trigger.properties.nextNodeId` aponta o menu
// por onde o fluxo começa. Ausente → comportamento anterior (primeiro menu
// habilitado), 100% compatível com flow_data já salvo. Presente mas inválido
// (id inexistente, nó não é "menu", ou menu desabilitado/malformado — ou
// seja, fora de `menuNodes`) → MESMO fallback automático, com
// reason "invalid-edge" pro chamador logar. Nunca lança, nunca trava o fluxo.
export type EntryMenuReason = "automatic" | "trigger-edge" | "invalid-edge";

export function resolveEntryMenu(
  menuNodes: MenuNode[],
  entryNodeId?: unknown,
): { node: MenuNode; reason: EntryMenuReason } | null {
  if (menuNodes.length === 0) return null;
  if (typeof entryNodeId !== "string" || entryNodeId === "") {
    return { node: menuNodes[0], reason: "automatic" };
  }
  const chosen = menuNodes.find((n) => n.id === entryNodeId);
  if (chosen) return { node: chosen, reason: "trigger-edge" };
  return { node: menuNodes[0], reason: "invalid-edge" };
}

// R7 — entrada ESTENDIDA: `trigger.nextNodeId` também pode apontar um nó
// "message" HABILITADO (o fluxo começa por um texto e segue pra um menu).
// Mensagem só é escolhida por aresta EXPLÍCITA — o modo automático continua
// sendo "primeiro menu habilitado" (flow_data sem aresta se comporta como
// antes). Aresta inválida (nem menu nem mensagem habilitada) → mesmo fallback
// automático de resolveEntryMenu, com reason "invalid-edge" pro log.
export type EntryNodeResolution =
  | { kind: "menu"; node: MenuNode; reason: EntryMenuReason }
  | { kind: "message"; node: MessageNode; reason: "trigger-edge" };

export function resolveEntryNode(
  menuNodes: MenuNode[],
  messageNodes: MessageNode[],
  entryNodeId?: unknown,
): EntryNodeResolution | null {
  if (typeof entryNodeId === "string" && entryNodeId !== "") {
    const message = messageNodes.find((n) => n.id === entryNodeId);
    if (message) return { kind: "message", node: message, reason: "trigger-edge" };
  }
  const menu = resolveEntryMenu(menuNodes, entryNodeId);
  return menu ? { kind: "menu", node: menu.node, reason: menu.reason } : null;
}

// Percorre a cadeia de nós "message" a partir de `start`, MESMA virada:
// envia (acumula) o texto e segue `nextNodeId` até: um menu (apresenta-o junto
// e devolve o estado dele), ausência de destino (encerra), destino que o motor
// não conhece (encerra + `unresolvedNextNodeId` pro log), ciclo (volta a um nó
// já enviado) ou o teto MAX_MESSAGE_HOPS. Nunca lança, sempre termina.
function runMessageChain(
  start: MessageNode,
  menuById: Map<string, MenuNode>,
  messageById: Map<string, MessageNode>,
): MessageTurnResult {
  const visited = new Set<string>();
  const parts: string[] = [];
  const messageNodeIds: string[] = [];
  let state: BotFlowState | null = null;
  let truncated: MessageTurnResult["truncated"];
  let unresolvedNextNodeId: string | undefined;

  let current: MessageNode | undefined = start;
  while (current) {
    if (visited.has(current.id)) {
      truncated = "cycle";
      break;
    }
    if (messageNodeIds.length >= MAX_MESSAGE_HOPS) {
      truncated = "hop-limit";
      break;
    }
    visited.add(current.id);
    messageNodeIds.push(current.id);
    parts.push(current.mensagem);

    const nextId = current.nextNodeId;
    if (!nextId) break;

    const nextMenu = menuById.get(nextId);
    if (nextMenu) {
      parts.push(renderMenuPrompt(nextMenu));
      state = { currentNodeId: nextMenu.id, attempts: 0 };
      break;
    }
    current = messageById.get(nextId);
    if (!current) unresolvedNextNodeId = nextId;
  }

  return {
    kind: "message",
    message: parts.join("\n\n"),
    state,
    messageNodeIds,
    ...(truncated ? { truncated } : {}),
    ...(unresolvedNextNodeId ? { unresolvedNextNodeId } : {}),
  };
}

// Motor de 1 turno: dado o conjunto de nós "menu" habilitados, o estado
// atual da conversa (ou null) e a mensagem recebida, decide o que fazer.
// `messageNodes` (R7, opcional — omitido = comportamento da R3/R6 idêntico):
// os nós "message" habilitados, alcançáveis por entrada, por opção de menu ou
// por fallback; ver `runMessageChain`.
export function resolveMenuTurn(
  menuNodes: MenuNode[],
  state: BotFlowState | null,
  messageText: string,
  entryNodeId?: unknown,
  messageNodes: MessageNode[] = [],
): MenuTurnResult {
  const byId = new Map(menuNodes.map((n) => [n.id, n]));
  const messageById = new Map(messageNodes.map((n) => [n.id, n]));
  const activeNode = state ? byId.get(state.currentNodeId) : undefined;

  // `!state ||` é redundante em runtime (state nulo ⇒ activeNode já é undefined)
  // — existe só pra o TS estreitar `state` abaixo (`state.attempts`).
  if (!state || !activeNode) {
    // Sem estado (primeira mensagem), ou estado aponta pra um nó que não é
    // mais um "menu" habilitado (desabilitado/removido entre uma virada e
    // outra) — (re)apresenta o nó de ENTRADA: o apontado por
    // trigger.nextNodeId quando válido (menu, ou mensagem — R7), senão o
    // primeiro "menu" habilitado. Sem nenhum dos dois → "none".
    const entry = resolveEntryNode(menuNodes, messageNodes, entryNodeId);
    if (!entry) return { kind: "none" };
    if (entry.kind === "message") return runMessageChain(entry.node, byId, messageById);
    return {
      kind: "present",
      message: renderMenuPrompt(entry.node),
      state: { currentNodeId: entry.node.id, attempts: 0 },
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
    const nextMessage = messageById.get(matched.nextNodeId);
    if (nextMessage) return runMessageChain(nextMessage, byId, messageById);
    // nextNodeId aponta pra um nó que não é um "menu" nem uma "message"
    // conhecidos (outro tipo, ou id sem correspondência) — sai do
    // acompanhamento scriptado, ponto de encaixe pra quem processar esse nó
    // (fora de escopo aqui).
    return { kind: "advanced-away", nextNodeId: matched.nextNodeId };
  }

  const attempts = state.attempts + 1;
  const { maxTentativas, acao, fallbackNodeId } = activeNode.fallback;

  if (attempts >= maxTentativas) {
    if (acao === "node" && fallbackNodeId) {
      // R7: fallback pra um nó "message" → envia o texto (+ segue a cadeia).
      const fallbackMessage = messageById.get(fallbackNodeId);
      if (fallbackMessage) return runMessageChain(fallbackMessage, byId, messageById);
      return { kind: "handover-fallback", fallbackNodeId };
    }
    // R4: sem destino de nó utilizável (`acao: "reprompt"`, ou `"node"` sem
    // `fallbackNodeId` — não validado em tipo, R1 §1) esgotar as tentativas
    // vira "exhausted" (o chamador entrega a humano) em vez do "reprompt
    // indefinido" da R3/R1 §0 item 2 — instrução explícita da R4, ver
    // docs/qa/etapa-9-bot-fluxo-scriptado-r4-handover-real.md §3.
    return { kind: "exhausted" };
  }

  // Abaixo do limite: reprompt — reapresenta o mesmo menu com um aviso
  // (R1 §0 item 2, "nunca pula direto pra transbordo no primeiro erro").
  return {
    kind: "reprompt",
    message: `Resposta inválida. Responda com uma opção válida.\n\n${renderMenuPrompt(activeNode)}`,
    state: { currentNodeId: activeNode.id, attempts },
  };
}
