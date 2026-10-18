// R10 — fluxo de EXEMPLO do construtor. Funções PURAS (sem DOM):
//   canLoadFlowExample(nodes)  só quando o usuário ainda NÃO montou nada (nenhum nó
//                              "menu"/"message"); nunca sobrescreve fluxo do usuário;
//   buildFlowExample(nodes)    devolve os nós COM o exemplo montado (os 4 fixos
//                              mantidos; ids/posições do exemplo pré-calculados).
//
// O que o exemplo monta (tudo editável/excluível depois; nada persiste até "Salvar Fluxo"):
//   Gatilho ──entrada──▶ Menu principal ─1─▶ Horário (mensagem) ──▶ Menu principal
//                                        ─2─▶ Saudação da IA (mensagem) ──▶ Agente IA
//                                        ─3─▶ Transbordo Humano
// Efeitos nos nós fixos (a UI diz isso na confirmação): habilita o Transbordo Humano
// (nasce desligado) e define a palavra de retorno do Agente IA como “menu” quando
// ela ainda está vazia. A saudação da IA SÓ menciona a palavra que de fato existe
// (G29): usa a palavra que o nó ai já tem, ou a que o exemplo acaba de definir.
import type { MenuWorkflowNode, MessageWorkflowNode, WorkflowNode } from "@/components/whatsapp/WhatsAppBotConfig";
import { gridPosition } from "@/components/whatsapp/flowCanvasModel";

export const EXAMPLE_RETURN_WORD = "menu";

export const EXAMPLE_IDS = {
  menu: "node-menu-exemplo",
  horario: "node-msg-horario-exemplo",
  ia: "node-msg-ia-exemplo",
} as const;

/** Só quando não há nenhum nó criado pelo usuário (menu/mensagem). Os 4 fixos podem ter sido editados. */
export function canLoadFlowExample(nodes: WorkflowNode[]): boolean {
  return nodes.length > 0 && !nodes.some((n) => n.type === "menu" || n.type === "message");
}

/** Devolve os nós com o exemplo montado; se o fluxo já tem nós do usuário, devolve o MESMO array (no-op). */
export function buildFlowExample(nodes: WorkflowNode[]): WorkflowNode[] {
  if (!canLoadFlowExample(nodes)) return nodes;
  const trigger = nodes.find((n) => n.type === "trigger");
  const ai = nodes.find((n) => n.type === "ai");
  const handover = nodes.find((n) => n.type === "handover");
  // Sem o gatilho/IA/transbordo fixos não há o que ligar: não monta um exemplo pela metade.
  if (!trigger || !ai || !handover) return nodes;

  const existingWord = ai.type === "ai" ? (ai.properties.palavraRetorno ?? "").trim() : "";
  const returnWord = existingWord || EXAMPLE_RETURN_WORD;
  const base = nodes.length;

  const menu: MenuWorkflowNode = {
    id: EXAMPLE_IDS.menu,
    type: "menu",
    title: "Menu principal",
    enabled: true,
    position: gridPosition(base),
    properties: {
      mensagem: "Olá! Como posso ajudar?",
      opcoes: [
        { numero: 1, rotulo: "Horário de atendimento", nextNodeId: EXAMPLE_IDS.horario },
        { numero: 2, rotulo: "Falar com a IA", nextNodeId: EXAMPLE_IDS.ia },
        { numero: 3, rotulo: "Falar com um atendente", nextNodeId: handover.id },
      ],
      fallback: { maxTentativas: 3, acao: "reprompt" },
    },
  };
  const horario: MessageWorkflowNode = {
    id: EXAMPLE_IDS.horario,
    type: "message",
    title: "Horário de atendimento",
    enabled: true,
    position: gridPosition(base + 1),
    properties: {
      mensagem: "Atendemos de segunda a sexta, das 9h às 18h.",
      nextNodeId: EXAMPLE_IDS.menu,
    },
  };
  const saudacaoIa: MessageWorkflowNode = {
    id: EXAMPLE_IDS.ia,
    type: "message",
    title: "Saudação da IA",
    enabled: true,
    position: gridPosition(base + 2),
    properties: {
      mensagem: `Certo! Me conte o que você precisa. Para voltar ao menu, envie “${returnWord}”.`,
      nextNodeId: ai.id,
    },
  };

  const fixed = nodes.map((n): WorkflowNode => {
    if (n.id === trigger.id && n.type === "trigger") {
      return { ...n, properties: { ...n.properties, nextNodeId: EXAMPLE_IDS.menu } };
    }
    if (n.id === ai.id && n.type === "ai" && !existingWord) {
      return { ...n, properties: { ...n.properties, palavraRetorno: EXAMPLE_RETURN_WORD } };
    }
    if (n.id === handover.id && n.type === "handover") {
      return { ...n, enabled: true };
    }
    return n;
  });
  return [...fixed, menu, horario, saudacaoIa];
}
