// Etapa 9 · Item 4 — simulador do fluxo, lado UI (fecha U1–U4 de
// docs/qa/etapa-9-bot-simulador-fluxo-cobertura.md §1.2/§4). Lógica PURA do
// painel "Simulador do Fluxo" de WhatsAppBotConfig: monta o corpo da chamada,
// interpreta a resposta do server e descreve o estado em linguagem legível.
// O MOTOR (menu/handover) é do server — `whatsapp-bot-reply` com `isTest: true`
// + `simState` (contrato em §3 daquele doc); aqui só se carrega o estado de
// ida e volta, sem decidir nada sobre o fluxo.

import type { WorkflowNode } from "./WhatsAppBotConfig";

export interface SimBotFlowState {
  currentNodeId: string;
  attempts: number;
}

/** Espelha `simState` do contrato: `botFlowState` (fora do menu = null) + `handedOver`. */
export interface SimFlowState {
  botFlowState: SimBotFlowState | null;
  handedOver: boolean;
}

export const INITIAL_SIM_STATE: SimFlowState = { botFlowState: null, handedOver: false };

export type SimEngine = "menu" | "handover" | "silent" | "skipped" | "ai";
export type SimHandoverReason = "keyword" | "menu_option" | "menu_fallback_node" | "menu_exhausted";

export interface SimulationInfo extends SimFlowState {
  engine: SimEngine;
  handoverReason?: SimHandoverReason;
}

/** "system" = aviso do próprio simulador (não é fala do robô nem do cliente — nunca entra no histórico enviado). */
export type SimMessageRole = "user" | "model" | "system";

export interface SimMessage {
  role: SimMessageRole;
  text: string;
  /** Selo curto abaixo da bolha do robô (ex.: "Entregue a atendimento humano · tentativas esgotadas"). */
  tag?: string;
}

export const SIM_GREETING =
  "Olá! Eu sou o simulador do seu fluxo visual. Salve seu fluxo e envie uma mensagem para testar as respostas e transbordos em tempo real!";
export const SIM_RESET_GREETING = "Simulador reiniciado! Digite algo para rodar o fluxo.";

const HANDOVER_REASON_LABEL: Record<SimHandoverReason, string> = {
  keyword: "palavra-chave",
  menu_option: "opção do menu",
  menu_fallback_node: "fallback do menu",
  menu_exhausted: "tentativas esgotadas",
};

export const SIM_SILENT_TEXT =
  "🔇 Robô em silêncio — esta conversa foi entregue a um atendente humano. Use “Reiniciar simulação” para devolver ao robô.";
export const SIM_SKIPPED_TEXT =
  "Fluxo sem nó de IA habilitado — nada a responder. (Em produção o robô também não responderia.)";

// ---------------------------------------------------------------------------
// Pedido
// ---------------------------------------------------------------------------

/**
 * Corpo do `functions.invoke("whatsapp-bot-reply")` em modo teste.
 * U1: o nó "ai" é OPCIONAL — um fluxo só-menu (válido, R1 §0 item 3) é simulável;
 * os campos de provider/credencial só vão quando existe um nó "ai" (o server só os
 * usa quando o turno cai no caminho de IA, e responde `skipped` sozinho se não há IA).
 * `messages` já inclui a mensagem nova do usuário; o 1º item (saudação) e os
 * avisos "system" nunca entram no histórico.
 */
export function buildSimulatorRequest(params: {
  workspaceId: string;
  nodes: WorkflowNode[];
  userText: string;
  messages: SimMessage[];
  simState: SimFlowState;
}): Record<string, unknown> {
  const { workspaceId, nodes, userText, messages, simState } = params;
  const aiNode = nodes.find((n) => n.type === "ai");

  const aiFields: Record<string, unknown> =
    aiNode && aiNode.type === "ai"
      ? (() => {
          const p = aiNode.properties;
          return {
            systemInstruction: p.instruction,
            provider: p.provider,
            modelName: p.model === "custom" ? p.customModelName : p.model,
            geminiApiKey: p.provider === "gemini_api_key" ? p.geminiApiKey : null,
            gcpProjectId: p.provider === "vertex_ai" ? p.gcpProjectId : null,
            gcpRegion: p.provider === "vertex_ai" ? p.gcpRegion : "us-central1",
            gcpServiceAccount: p.provider === "vertex_ai" ? p.gcpServiceAccount : null,
          };
        })()
      : {};

  return {
    isTest: true,
    workspaceId,
    ...aiFields,
    messageText: userText,
    history: messages
      .slice(1)
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, text: m.text })),
    flowData: nodes,
    simState,
  };
}

// ---------------------------------------------------------------------------
// Resposta
// ---------------------------------------------------------------------------

const ENGINES: readonly SimEngine[] = ["menu", "handover", "silent", "skipped", "ai"];

function parseBotFlowState(raw: unknown): SimBotFlowState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return typeof o.currentNodeId === "string" && typeof o.attempts === "number"
    ? { currentNodeId: o.currentNodeId, attempts: o.attempts }
    : null;
}

// Lê `data.simulation` do server; qualquer forma inesperada → null (trata como
// resposta legada, sem estado novo).
function parseSimulation(raw: unknown): SimulationInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!ENGINES.includes(o.engine as SimEngine) || typeof o.handedOver !== "boolean") return null;
  const reason = o.handoverReason;
  return {
    engine: o.engine as SimEngine,
    handoverReason: typeof reason === "string" && reason in HANDOVER_REASON_LABEL ? (reason as SimHandoverReason) : undefined,
    botFlowState: parseBotFlowState(o.botFlowState),
    handedOver: o.handedOver,
  };
}

/**
 * Interpreta a resposta do server e devolve o que acrescentar ao chat + o estado
 * pra PRÓXIMA mensagem.
 * - U2: o handover vem do server (`engine: "handover"`), SUBSTITUI a resposta da IA
 *   (a bolha É a cortesia, com o selo do motivo) — nada é fabricado aqui.
 * - U4: `reply: null` é estado, não erro: `silent` (já entregue) e `skipped` (sem IA)
 *   viram avisos do simulador, não "Resposta da IA vazia".
 * - Compat: server ANTIGO (ainda sem o simulador do fluxo) ignora `simState` e devolve só
 *   `{ reply }` — mostra a resposta, mantém o estado, e só um `reply` vazio vira erro.
 */
export function applySimulationResponse(
  data: unknown,
  prevState: SimFlowState,
): { messages: SimMessage[]; nextState: SimFlowState } {
  const payload = (data && typeof data === "object" ? data : {}) as { reply?: unknown; simulation?: unknown };
  const reply = typeof payload.reply === "string" && payload.reply.length > 0 ? payload.reply : null;
  const sim = parseSimulation(payload.simulation);

  if (!sim) {
    if (!reply) throw new Error("Resposta da IA vazia");
    return { messages: [{ role: "model", text: reply }], nextState: prevState };
  }

  const nextState: SimFlowState = { botFlowState: sim.botFlowState, handedOver: sim.handedOver };

  if (sim.engine === "silent") return { messages: [{ role: "system", text: SIM_SILENT_TEXT }], nextState };
  if (sim.engine === "skipped") return { messages: [{ role: "system", text: SIM_SKIPPED_TEXT }], nextState };

  if (!reply) throw new Error("Resposta vazia do simulador");

  if (sim.engine === "handover") {
    const motivo = sim.handoverReason ? ` · ${HANDOVER_REASON_LABEL[sim.handoverReason]}` : "";
    return { messages: [{ role: "model", text: reply, tag: `Entregue a atendimento humano${motivo}` }], nextState };
  }

  return { messages: [{ role: "model", text: reply }], nextState };
}

// ---------------------------------------------------------------------------
// Estado legível
// ---------------------------------------------------------------------------

export type SimStateTone = "idle" | "menu" | "handover";

export interface SimStateSummary {
  tone: SimStateTone;
  label: string;
}

/** Descreve o estado atual da simulação em linguagem de operador (nó/tentativas). */
export function describeSimState(state: SimFlowState, nodes: WorkflowNode[]): SimStateSummary {
  if (state.handedOver) {
    return { tone: "handover", label: "Entregue a atendimento humano — o robô está em silêncio" };
  }
  if (state.botFlowState) {
    const node = nodes.find((n) => n.id === state.botFlowState!.currentNodeId);
    if (!node || node.type !== "menu") {
      return { tone: "menu", label: "Em um menu que não existe mais no fluxo — a próxima mensagem recomeça pela entrada" };
    }
    const max = node.properties.fallback.maxTentativas;
    return {
      tone: "menu",
      label: `No menu “${node.title}” — respostas inválidas: ${state.botFlowState.attempts} de ${max}`,
    };
  }
  return { tone: "idle", label: "Fora do menu — a próxima mensagem inicia o fluxo" };
}
