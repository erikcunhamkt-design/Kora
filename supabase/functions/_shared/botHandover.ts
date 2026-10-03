// Etapa 9 · Item 4 (construtor de fluxo scriptado) — R4, handover REAL
// (docs/qa/etapa-9-bot-fluxo-scriptado-r4-handover-real.md; fecha o G48).
// Pure logic — sem Deno.*, sem npm: imports — mesmo padrão de
// botFlowMenu.ts/botFlowTemplate.ts, testável via vitest sem Deno.serve
// nem banco.
//
// Antes desta rodada o handover era só a metade cosmética: mandava um
// texto de cortesia e o robô continuava respondendo a próxima mensagem
// (G48). Agora a conversa passa a um estado PERSISTIDO de "entregue a
// humano" (`whatsapp_conversations.handover_at`, coluna PROPOSTA — ainda
// não aplicada, draft §2 do doc da rodada) e o bot fica em silêncio nela
// até alguém devolver (`end_human_handover` em whatsapp-instance).
//
// `assigned_to` NÃO é tocado: "pra quem atribuir" segue sendo decisão de
// produto em aberto (G48/Fase A §2.3) — o estado de handover é
// independente da atribuição e vale mesmo sem ninguém atribuído.

import type { MenuTurnResult } from "./botFlowMenu.ts";

// Texto de cortesia enviado ao cliente ao entregar a conversa — o mesmo
// que o branch de handover por palavra-chave já usava inline (movido pra
// cá sem mudar o texto, pra os 4 gatilhos dizerem exatamente a mesma coisa).
export const HANDOVER_COURTESY_TEXT =
  "Encaminhando o seu contato para o atendimento humano. Um de nossos colaboradores irá te atender em instantes! Obrigado por aguardar.";

// Mesma lista (e mesmo critério — substring, case-insensitive) que estava
// inline em whatsapp-bot-reply/index.ts antes desta rodada.
export const HANDOVER_KEYWORDS = [
  "atendente",
  "humano",
  "pessoa",
  "falar com",
  "suporte",
  "ajuda",
  "atendimento",
] as const;

export function matchesHandoverKeyword(text: string): boolean {
  const lower = (text ?? "").toLowerCase();
  return HANDOVER_KEYWORDS.some((keyword) => lower.includes(keyword));
}

// Lê `whatsapp_conversations.handover_at`. `raw` pode ser `undefined`
// (coluna ainda não existe no schema real, ou `select` não a devolveu —
// o estado de hoje), `null` (conversa nunca foi entregue, ou já foi
// devolvida) ou a string ISO do timestamptz. Qualquer coisa que não seja
// uma string não-vazia conta como "NÃO entregue" — degrada pro
// comportamento de antes desta rodada, nunca derruba o chamador.
export function isHandedOver(raw: unknown): boolean {
  return typeof raw === "string" && raw.length > 0;
}

export type HandoverReason =
  | "keyword"
  | "menu_option"
  | "menu_fallback_node"
  | "menu_exhausted";

export interface HandoverDecision {
  handover: boolean;
  reason?: HandoverReason;
}

interface FlowNodeRef {
  id: string;
  type: string;
  enabled: boolean;
}

// Um nó "handover" HABILITADO com esse id? Mesma regra de `enabled` do
// resto do arquivo whatsapp-bot-reply (`.find(n => n.type === ... &&
// n.enabled)`): nó desligado no construtor = nó que não age.
export function isEnabledHandoverNode(nodes: FlowNodeRef[], nodeId: string): boolean {
  return nodes.some((n) => n.id === nodeId && n.type === "handover" && n.enabled);
}

// Decide se o resultado de um turno do motor de menu (R3) vira handover:
// - "advanced-away": a opção escolhida aponta pra um nó "handover"
//   habilitado → entrega. Qualquer outro destino segue o comportamento da
//   R3 (sai do rastreamento, fluxo normal roda).
// - "handover-fallback": estourou `maxTentativas` com `acao: "node"` →
//   entrega SE o `fallbackNodeId` é um nó "handover" habilitado; se
//   aponta pra outro tipo de nó, comportamento da R3 (sai do rastreamento).
// - "exhausted": estourou `maxTentativas` sem destino de nó utilizável
//   (`acao: "reprompt"`, ou `"node"` sem `fallbackNodeId`) → entrega.
//   MUDANÇA DE SEMÂNTICA vs R3/R1 §0 item 2 ("reprompt indefinido") por
//   instrução explícita da R4 — registrada no doc da rodada.
export function decideHandoverFromMenuTurn(
  turn: MenuTurnResult,
  nodes: FlowNodeRef[],
): HandoverDecision {
  switch (turn.kind) {
    case "advanced-away":
      return isEnabledHandoverNode(nodes, turn.nextNodeId)
        ? { handover: true, reason: "menu_option" }
        : { handover: false };
    case "handover-fallback":
      return isEnabledHandoverNode(nodes, turn.fallbackNodeId)
        ? { handover: true, reason: "menu_fallback_node" }
        : { handover: false };
    case "exhausted":
      return { handover: true, reason: "menu_exhausted" };
    default:
      return { handover: false };
  }
}

// Contrato de ESCRITA do estado — cada coluna num UPDATE próprio, de
// propósito: se `handover_at` ainda não existir como coluna real (migration
// §8-b pendente), o Postgrest recusa aquele UPDATE inteiro; isolado, esse
// erro nunca arrasta junto os outros campos (mesma disciplina do R3 pra
// `bot_flow_state`).
export function buildHandoverEntryUpdates(nowIso: string): Array<Record<string, unknown>> {
  return [{ handover_at: nowIso }, { bot_flow_state: null }];
}

// "Encerrar atendimento humano" (devolver ao bot): limpa o estado de
// handover E o estado de navegação do menu — o bot volta do zero (próxima
// mensagem re-apresenta o menu), não do meio de um fluxo antigo.
export function buildHandoverReturnUpdates(nowIso: string): Array<Record<string, unknown>> {
  return [{ handover_at: null, updated_at: nowIso }, { bot_flow_state: null }];
}
