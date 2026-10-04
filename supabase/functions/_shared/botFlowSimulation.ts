// Etapa 9 · Item 4 — cobertura do SIMULADOR ("Simular mensagem" em
// WhatsAppBotConfig → whatsapp-bot-reply com `isTest: true`)
// (docs/qa/etapa-9-bot-simulador-fluxo-cobertura.md). Pure logic — sem Deno.*,
// sem npm: imports — mesmo padrão de botFlowMenu.ts/botHandover.ts.
//
// ANTES: o ramo `isTest` só usava `flowData` pra aplicar o template do nó
// "send" — nunca rodava o motor do menu (R3) nem o handover (R4), e o handover
// "simulado" era um texto fixo montado no navegador. O simulador não provava
// nada sobre o fluxo scriptado.
//
// AGORA (opt-in — só quando o corpo traz `simState`, qualquer valor ≠
// undefined): o simulador roda a MESMA decisão de produção sobre os mesmos
// primitivos (extractMenuNodes/resolveMenuTurn/decideHandoverFromMenuTurn/
// matchesHandoverKeyword), com o estado carregado pelo CLIENTE (o simulador
// não tem conversa nem banco — `bot_flow_state`/`handover_at` viram `simState`
// de ida e volta). Sem `simState` o comportamento é byte a byte o de antes.
//
// A ORDEM espelha o handler de produção (whatsapp-bot-reply/index.ts, ramo
// não-teste). Se aquela ordem mudar, mudar aqui junto:
//   1. conversa entregue a humano → silêncio            (gate `isHandedOver`)
//   2. motor do menu (se há nó "menu" habilitado):      (bloco R3/R4/R6)
//        entrada: trigger.nextNodeId (R6, só com trigger habilitado)
//        present/reprompt → responde o menu, sem IA
//        handover (3 gatilhos do menu) → entrega
//        advanced-away/handover-fallback p/ nó não-handover → sai do menu
//   3. gate "AI node disabled": fluxo com nós mas sem "ai" habilitado → skip
//   4. handover por palavra-chave (nó handover habilitado) → entrega
//   5. segue pra IA                                     ("continue")

import {
  extractMenuNodes,
  parseBotFlowState,
  resolveMenuTurn,
  type BotFlowState,
  type RawFlowNode,
} from "./botFlowMenu.ts";
import {
  HANDOVER_COURTESY_TEXT,
  decideHandoverFromMenuTurn,
  matchesHandoverKeyword,
  type HandoverReason,
} from "./botHandover.ts";

export interface SimState {
  /** Espelha `whatsapp_conversations.bot_flow_state` (null = fora do menu). */
  botFlowState: BotFlowState | null;
  /** Espelha `handover_at IS NOT NULL` (true = entregue a humano, bot mudo). */
  handedOver: boolean;
}

export type SimulationEngine = "menu" | "handover" | "silent" | "skipped" | "ai";

export interface SimulationInfo {
  engine: SimulationEngine;
  /** Só quando `engine === "handover"`. */
  handoverReason?: HandoverReason;
  /** Estado a devolver ao servidor na PRÓXIMA mensagem do simulador. */
  botFlowState: BotFlowState | null;
  handedOver: boolean;
}

export type SimulationTurn =
  /** Curto-circuito: resposta decidida sem chamar IA (`reply: null` = bot mudo/skip). */
  | { kind: "respond"; reply: string | null; simulation: SimulationInfo }
  /** Segue pro caminho de IA; `simulation` (engine "ai") acompanha a resposta. */
  | { kind: "continue"; simulation: SimulationInfo };

// O corpo opta pela simulação do fluxo mandando `simState` — mesmo `null`
// conta (primeira mensagem: o cliente ainda não tem estado nenhum).
export function wantsFlowSimulation(simState: unknown): boolean {
  return simState !== undefined;
}

// Defensivo: qualquer coisa que não seja um objeto bem formado vira o estado
// inicial (fora do menu, não entregue) — nunca lança.
export function parseSimState(raw: unknown): SimState {
  if (!raw || typeof raw !== "object") return { botFlowState: null, handedOver: false };
  const obj = raw as Record<string, unknown>;
  return {
    botFlowState: parseBotFlowState(obj.botFlowState),
    handedOver: obj.handedOver === true,
  };
}

export function simulateFlowTurn(
  nodes: RawFlowNode[],
  rawState: unknown,
  messageText: string,
): SimulationTurn {
  const state = parseSimState(rawState);

  // 1. Conversa já entregue a humano: o bot fica em silêncio.
  if (state.handedOver) {
    return {
      kind: "respond",
      reply: null,
      simulation: { engine: "silent", botFlowState: null, handedOver: true },
    };
  }

  let botFlowState = state.botFlowState;

  // 2. Motor do menu (R3) + handover real (R4).
  const menuNodes = extractMenuNodes(nodes);
  if (menuNodes.length > 0) {
    // Aresta de ENTRADA (R6): `trigger.properties.nextNodeId` aponta o menu por
    // onde o fluxo começa. Paridade com produção (whatsapp-bot-reply/index.ts):
    // só vale com o trigger HABILITADO (`triggerNode` lá filtra por enabled);
    // ausente/inválido → resolveEntryMenu cai no primeiro menu habilitado.
    const triggerNode = nodes.find((n) => n.type === "trigger" && n.enabled);
    const entryNodeId = (triggerNode?.properties as { nextNodeId?: unknown } | undefined)?.nextNodeId;
    const turn = resolveMenuTurn(menuNodes, botFlowState, messageText, entryNodeId);

    if (turn.kind === "present" || turn.kind === "reprompt") {
      return {
        kind: "respond",
        reply: turn.message,
        simulation: { engine: "menu", botFlowState: turn.state, handedOver: false },
      };
    }

    const decision = decideHandoverFromMenuTurn(turn, nodes);
    if (decision.handover && decision.reason) {
      return {
        kind: "respond",
        reply: HANDOVER_COURTESY_TEXT,
        simulation: {
          engine: "handover",
          handoverReason: decision.reason,
          botFlowState: null,
          handedOver: true,
        },
      };
    }

    // advanced-away / handover-fallback pra um nó que NÃO é handover: sai do
    // acompanhamento do menu e o fluxo normal segue (mesmo que produção).
    if (turn.kind === "advanced-away" || turn.kind === "handover-fallback") {
      botFlowState = null;
    }
  }

  // 3. Mesmo gate de produção: fluxo com nós, mas sem nó "ai" habilitado → não responde.
  const hasFlowData = nodes.length > 0;
  const hasEnabledAi = nodes.some((n) => n.type === "ai" && n.enabled);
  if (hasFlowData && !hasEnabledAi) {
    return {
      kind: "respond",
      reply: null,
      simulation: { engine: "skipped", botFlowState, handedOver: false },
    };
  }

  // 4. Handover por palavra-chave (só com nó handover habilitado).
  const hasEnabledHandover = nodes.some((n) => n.type === "handover" && n.enabled);
  if (hasEnabledHandover && matchesHandoverKeyword(messageText)) {
    return {
      kind: "respond",
      reply: HANDOVER_COURTESY_TEXT,
      simulation: { engine: "handover", handoverReason: "keyword", botFlowState: null, handedOver: true },
    };
  }

  // 5. Segue pra IA.
  return { kind: "continue", simulation: { engine: "ai", botFlowState, handedOver: false } };
}
