// Etapa 9 · Item 4, R4 — handover REAL (docs/qa/etapa-9-bot-fluxo-scriptado-
// r4-handover-real.md; fecha o G48). Testes unitários com mocks puros (sem
// Deno.serve, sem banco): entrada em handover pelos gatilhos, bot silencioso
// enquanto entregue, devolução ao bot, degradação sem a coluna.
import { describe, it, expect } from "vitest";
import {
  HANDOVER_COURTESY_TEXT,
  HANDOVER_KEYWORDS,
  matchesHandoverKeyword,
  isHandedOver,
  isEnabledHandoverNode,
  decideHandoverFromMenuTurn,
  buildHandoverEntryUpdates,
  buildHandoverReturnUpdates,
} from "../botHandover";
import { resolveMenuTurn, type MenuNode } from "../botFlowMenu";

const NODES = [
  { id: "menu-1", type: "menu", enabled: true },
  { id: "node-handover", type: "handover", enabled: true },
  { id: "node-handover-off", type: "handover", enabled: false },
  { id: "node-ai", type: "ai", enabled: true },
];

function makeMenuNode(overrides: Partial<MenuNode> = {}): MenuNode {
  return {
    id: "menu-1",
    mensagem: "Escolha uma opção:",
    opcoes: [
      { numero: 1, rotulo: "Financeiro", nextNodeId: "node-ai" },
      { numero: 2, rotulo: "Falar com atendente", nextNodeId: "node-handover" },
    ],
    fallback: { maxTentativas: 2, acao: "reprompt" },
    ...overrides,
  };
}

describe("matchesHandoverKeyword (gatilho \"keyword\" — comportamento pré-R4 preservado)", () => {
  it("casa cada uma das 7 palavras-chave originais", () => {
    for (const keyword of HANDOVER_KEYWORDS) {
      expect(matchesHandoverKeyword(`quero ${keyword} agora`)).toBe(true);
    }
    expect(HANDOVER_KEYWORDS).toHaveLength(7);
  });

  it("é case-insensitive e por substring", () => {
    expect(matchesHandoverKeyword("PRECISO DE UM ATENDENTE")).toBe(true);
    expect(matchesHandoverKeyword("atendimentos")).toBe(true);
  });

  it("não casa texto sem palavra-chave, nem vazio/ausente", () => {
    expect(matchesHandoverKeyword("qual o preço do plano?")).toBe(false);
    expect(matchesHandoverKeyword("")).toBe(false);
  });
});

describe("isHandedOver (bot silencioso enquanto entregue + degradação sem coluna)", () => {
  it("timestamptz (string ISO) gravado -> entregue", () => {
    expect(isHandedOver("2026-10-02T12:00:00.000Z")).toBe(true);
  });

  it("undefined (coluna handover_at ainda não existe no schema real) -> NÃO entregue", () => {
    expect(isHandedOver(undefined)).toBe(false);
  });

  it("null (nunca entregue, ou já devolvida) -> NÃO entregue", () => {
    expect(isHandedOver(null)).toBe(false);
  });

  it("valor que não é string não-vazia (garbage) -> NÃO entregue, sem lançar", () => {
    expect(isHandedOver("")).toBe(false);
    expect(isHandedOver(true)).toBe(false);
    expect(isHandedOver(123)).toBe(false);
    expect(isHandedOver({})).toBe(false);
  });

  it("linha de conversa SEM a coluna se comporta como hoje: bot não fica mudo", () => {
    const rowSemColuna: Record<string, unknown> = { id: "c1", assigned_to: null };
    expect(isHandedOver(rowSemColuna.handover_at)).toBe(false);
  });
});

describe("isEnabledHandoverNode", () => {
  it("nó handover habilitado -> true", () => {
    expect(isEnabledHandoverNode(NODES, "node-handover")).toBe(true);
  });

  it("nó handover DESABILITADO -> false (nó desligado no construtor não age)", () => {
    expect(isEnabledHandoverNode(NODES, "node-handover-off")).toBe(false);
  });

  it("nó de outro tipo ou id inexistente -> false", () => {
    expect(isEnabledHandoverNode(NODES, "node-ai")).toBe(false);
    expect(isEnabledHandoverNode(NODES, "nao-existe")).toBe(false);
  });
});

describe("decideHandoverFromMenuTurn (entrada em handover pelos gatilhos do menu)", () => {
  it("gatilho 1 — opção do menu leva ao nó handover -> entrega (menu_option)", () => {
    expect(decideHandoverFromMenuTurn({ kind: "advanced-away", nextNodeId: "node-handover" }, NODES)).toEqual({
      handover: true,
      reason: "menu_option",
    });
  });

  it("gatilho 2 — estouro com acao \"node\" apontando pra um handover -> entrega (menu_fallback_node)", () => {
    expect(decideHandoverFromMenuTurn({ kind: "handover-fallback", fallbackNodeId: "node-handover" }, NODES)).toEqual({
      handover: true,
      reason: "menu_fallback_node",
    });
  });

  it("gatilho 3 — estouro com acao \"reprompt\" esgotada -> entrega (menu_exhausted)", () => {
    expect(decideHandoverFromMenuTurn({ kind: "exhausted" }, NODES)).toEqual({
      handover: true,
      reason: "menu_exhausted",
    });
  });

  it("opção do menu que leva a um nó que NÃO é handover -> sem handover (comportamento da R3)", () => {
    expect(decideHandoverFromMenuTurn({ kind: "advanced-away", nextNodeId: "node-ai" }, NODES)).toEqual({ handover: false });
  });

  it("opção do menu que leva a um handover DESABILITADO -> sem handover", () => {
    expect(decideHandoverFromMenuTurn({ kind: "advanced-away", nextNodeId: "node-handover-off" }, NODES)).toEqual({ handover: false });
  });

  it("estouro com acao \"node\" apontando pra um nó que NÃO é handover -> sem handover (comportamento da R3)", () => {
    expect(decideHandoverFromMenuTurn({ kind: "handover-fallback", fallbackNodeId: "node-ai" }, NODES)).toEqual({ handover: false });
  });

  it("present/reprompt/none nunca viram handover", () => {
    const state = { currentNodeId: "menu-1", attempts: 0 };
    expect(decideHandoverFromMenuTurn({ kind: "present", message: "m", state }, NODES)).toEqual({ handover: false });
    expect(decideHandoverFromMenuTurn({ kind: "reprompt", message: "m", state }, NODES)).toEqual({ handover: false });
    expect(decideHandoverFromMenuTurn({ kind: "none" }, NODES)).toEqual({ handover: false });
  });
});

describe("contrato de escrita do estado (entrada e devolução)", () => {
  const NOW = "2026-10-02T12:00:00.000Z";

  it("entrada: grava handover_at E limpa bot_flow_state, em UPDATEs SEPARADOS (coluna ausente não arrasta a outra)", () => {
    const updates = buildHandoverEntryUpdates(NOW);
    expect(updates).toEqual([{ handover_at: NOW }, { bot_flow_state: null }]);
    for (const u of updates) expect(Object.keys(u)).toHaveLength(1);
  });

  it("devolução: zera handover_at E bot_flow_state, em UPDATEs SEPARADOS", () => {
    const updates = buildHandoverReturnUpdates(NOW);
    expect(updates).toEqual([{ handover_at: null, updated_at: NOW }, { bot_flow_state: null }]);
    expect("bot_flow_state" in updates[0]).toBe(false);
    expect("handover_at" in updates[1]).toBe(false);
  });

  it("texto de cortesia é o mesmo do branch por palavra-chave original (não mudou)", () => {
    expect(HANDOVER_COURTESY_TEXT).toContain("Encaminhando o seu contato para o atendimento humano");
  });
});

describe("ciclo completo: entrega -> silêncio -> devolução -> bot volta do zero", () => {
  it("fecha a aresta registrada na R3: depois do handover a próxima mensagem NÃO reentra no menu; depois da devolução, sim, do zero", () => {
    const menu = makeMenuNode();
    // Linha da conversa como o banco a devolveria (colunas já existentes).
    const conv: { handover_at: string | null; bot_flow_state: unknown } = { handover_at: null, bot_flow_state: null };

    // 1) Cliente escolhe "2 - Falar com atendente" (menu -> nó handover).
    conv.bot_flow_state = { currentNodeId: "menu-1", attempts: 0 };
    const turn = resolveMenuTurn([menu], { currentNodeId: "menu-1", attempts: 0 }, "2");
    const decision = decideHandoverFromMenuTurn(turn, NODES);
    expect(decision).toEqual({ handover: true, reason: "menu_option" });

    // 2) Aplica as escritas de entrada (cada UPDATE isolado, como no handler).
    for (const u of buildHandoverEntryUpdates("2026-10-02T12:00:00.000Z")) Object.assign(conv, u);
    expect(isHandedOver(conv.handover_at)).toBe(true);
    expect(conv.bot_flow_state).toBeNull();

    // 3) Próximas mensagens do cliente: o handler para ANTES de qualquer
    //    lógica de menu/IA — o gate é só isHandedOver(handover_at).
    for (const msg of ["oi?", "alguém aí?", "1"]) {
      expect(isHandedOver(conv.handover_at), `mensagem "${msg}" deve encontrar o bot mudo`).toBe(true);
    }

    // 4) Atendente "encerra atendimento humano" (devolução).
    for (const u of buildHandoverReturnUpdates("2026-10-02T13:00:00.000Z")) Object.assign(conv, u);
    expect(isHandedOver(conv.handover_at)).toBe(false);
    expect(conv.bot_flow_state).toBeNull();

    // 5) Bot volta do zero: próxima mensagem re-apresenta o menu (estado limpo).
    const afterReturn = resolveMenuTurn([menu], null, "oi");
    expect(afterReturn.kind).toBe("present");
  });

  it("degradação sem a coluna: se o UPDATE de handover_at falhasse, a conversa continua não-entregue (comportamento de antes da R4)", () => {
    // Simula o erro do Postgrest: o UPDATE de handover_at é recusado, nada gravado.
    const conv: Record<string, unknown> = { id: "c1" };
    expect(isHandedOver(conv.handover_at)).toBe(false);
    // ...e como cada coluna tem seu UPDATE próprio, o outro (bot_flow_state)
    // ainda pode ser tentado de forma independente.
    const [first, second] = buildHandoverEntryUpdates("2026-10-02T12:00:00.000Z");
    expect(Object.keys(first)).toEqual(["handover_at"]);
    expect(Object.keys(second)).toEqual(["bot_flow_state"]);
  });
});
