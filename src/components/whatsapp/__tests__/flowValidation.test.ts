// R10 — validateFlow(nodes): função PURA. Cada regra de ERRO e de AVISO com o nodeId
// certo, mais os casos "limpos" (nada a reportar), nós desabilitados (não agem →
// não geram problemas de conteúdo) e a ordenação/contagem.
import { describe, it, expect } from "vitest";
import { summarizeFlowIssues, validateFlow, type FlowIssue } from "@/components/whatsapp/flowValidation";
import { MAX_MESSAGE_HOPS } from "../../../../supabase/functions/_shared/botFlowMenu";
import type { MenuWorkflowNode, MessageWorkflowNode, WorkflowNode } from "@/components/whatsapp/WhatsAppBotConfig";

function fixed(over: { handover?: boolean; ai?: boolean; palavraRetorno?: string; entry?: string } = {}): WorkflowNode[] {
  return [
    {
      id: "t", type: "trigger", title: "Gatilho", enabled: true,
      properties: { respondAll: true, ...(over.entry ? { nextNodeId: over.entry } : {}) },
    },
    {
      id: "ai", type: "ai", title: "IA", enabled: over.ai ?? true,
      properties: {
        instruction: "", model: "m", provider: "p", geminiApiKey: "", gcpProjectId: "", gcpRegion: "",
        gcpServiceAccount: "", customModelName: "",
        ...(over.palavraRetorno === undefined ? {} : { palavraRetorno: over.palavraRetorno }),
      },
    },
    { id: "send", type: "send", title: "Enviar", enabled: true, properties: { template: "{{reply}}" } },
    { id: "h", type: "handover", title: "Humano", enabled: over.handover ?? true, properties: { assignTo: "" } },
  ];
}

function menu(
  id: string,
  opcoes: MenuWorkflowNode["properties"]["opcoes"],
  over: Partial<MenuWorkflowNode> & { fallback?: MenuWorkflowNode["properties"]["fallback"] } = {},
): MenuWorkflowNode {
  const { fallback, ...rest } = over;
  return {
    id, type: "menu", title: `Menu ${id}`, enabled: true,
    properties: { mensagem: "Escolha", opcoes, fallback: fallback ?? { maxTentativas: 3, acao: "reprompt" } },
    ...rest,
  };
}
const opt = (numero: number, nextNodeId: string, rotulo = `Op ${numero}`) => ({ numero, rotulo, nextNodeId });

function msg(id: string, nextNodeId?: string, mensagem = `texto ${id}`, enabled = true): MessageWorkflowNode {
  return {
    id, type: "message", title: `Msg ${id}`, enabled,
    properties: nextNodeId ? { mensagem, nextNodeId } : { mensagem },
  };
}

const codes = (issues: FlowIssue[]) => issues.map((i) => i.code);
const find = (issues: FlowIssue[], code: string) => issues.filter((i) => i.code === code);

// Fluxo saudável de referência: entrada → menu (1 mensagem de volta, 2 IA, 3 humano).
const healthy = (): WorkflowNode[] => [
  ...fixed({ palavraRetorno: "menu", entry: "m1" }),
  menu("m1", [opt(1, "msg1"), opt(2, "ai"), opt(3, "h")]),
  msg("msg1", "m1"),
];

describe("validateFlow — fluxo limpo", () => {
  it("fluxo saudável: nenhum problema", () => {
    expect(validateFlow(healthy())).toEqual([]);
  });

  it("os 4 nós fixos sem menu (fluxo padrão): nenhum problema — não pune quem ainda não montou nada", () => {
    expect(validateFlow(fixed({ handover: false }))).toEqual([]);
  });

  it("lista vazia não lança", () => {
    expect(validateFlow([])).toEqual([]);
  });
});

describe("validateFlow — ERROS", () => {
  it("opção de menu sem destino", () => {
    const issues = validateFlow([...fixed(), menu("m1", [opt(1, "h"), opt(2, "")])]);
    const e = find(issues, "opcao-sem-destino");
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ severity: "error", nodeId: "m1" });
    expect(e[0].message).toMatch(/Opção 2/);
  });

  it("fallback 'Pular para outro nó' sem destino", () => {
    const issues = validateFlow([
      ...fixed(),
      menu("m1", [opt(1, "h")], { fallback: { maxTentativas: 2, acao: "node" } }),
    ]);
    expect(find(issues, "fallback-sem-destino")).toEqual([
      expect.objectContaining({ severity: "error", nodeId: "m1" }),
    ]);
  });

  it("destino removido: opção, fallback, mensagem e entrada apontando pra id que não existe", () => {
    const issues = validateFlow([
      ...fixed({ entry: "sumiu-entrada" }),
      menu("m1", [opt(1, "sumiu-opcao")], { fallback: { maxTentativas: 2, acao: "node", fallbackNodeId: "sumiu-fb" } }),
      msg("msg1", "sumiu-msg"),
    ]);
    const removed = find(issues, "destino-removido");
    expect(removed.map((r) => r.nodeId).sort()).toEqual(["m1", "m1", "msg1", "t"]);
    expect(removed.every((r) => r.severity === "error")).toBe(true);
  });

  it("menu habilitado sem opções", () => {
    const issues = validateFlow([...fixed(), menu("m1", [])]);
    expect(find(issues, "menu-sem-opcoes")).toEqual([expect.objectContaining({ severity: "error", nodeId: "m1" })]);
  });

  it("mensagem habilitada com texto vazio (ou só espaços)", () => {
    for (const text of ["", "   \n "]) {
      const issues = validateFlow([...fixed(), menu("m1", [opt(1, "msg1")]), msg("msg1", undefined, text)]);
      expect(find(issues, "mensagem-vazia"), JSON.stringify(text)).toEqual([
        expect.objectContaining({ severity: "error", nodeId: "msg1" }),
      ]);
    }
  });

  it("ciclo mensagem→mensagem: reporta UMA vez por ciclo, no primeiro nó do ciclo (auto-laço incluso)", () => {
    const loop = validateFlow([...fixed(), menu("m1", [opt(1, "a")]), msg("a", "b"), msg("b", "a")]);
    expect(find(loop, "ciclo-mensagens")).toHaveLength(1);
    expect(find(loop, "ciclo-mensagens")[0]).toMatchObject({ severity: "error", nodeId: "a" });

    const self = validateFlow([...fixed(), menu("m1", [opt(1, "a")]), msg("a", "a")]);
    expect(find(self, "ciclo-mensagens")).toEqual([expect.objectContaining({ nodeId: "a" })]);
  });

  it("dois ciclos independentes = dois erros", () => {
    const issues = validateFlow([
      ...fixed(), menu("m1", [opt(1, "a"), opt(2, "c")]),
      msg("a", "b"), msg("b", "a"), msg("c", "d"), msg("d", "c"),
    ]);
    expect(find(issues, "ciclo-mensagens").map((i) => i.nodeId)).toEqual(["a", "c"]);
  });

  it(`cadeia de mais de ${MAX_MESSAGE_HOPS} mensagens seguidas: erro no início da cadeia`, () => {
    const total = MAX_MESSAGE_HOPS + 1;
    const chain = Array.from({ length: total }, (_, i) =>
      msg(`c${i}`, i === total - 1 ? "m1" : `c${i + 1}`),
    );
    const issues = validateFlow([...fixed(), menu("m1", [opt(1, "c0")]), ...chain]);
    const long = find(issues, "cadeia-longa");
    expect(long).toHaveLength(1);
    expect(long[0]).toMatchObject({ severity: "error", nodeId: "c0" });
    expect(long[0].message).toContain(String(total));
  });

  it(`cadeia de exatamente ${MAX_MESSAGE_HOPS} mensagens NÃO é erro`, () => {
    const chain = Array.from({ length: MAX_MESSAGE_HOPS }, (_, i) =>
      msg(`c${i}`, i === MAX_MESSAGE_HOPS - 1 ? "m1" : `c${i + 1}`),
    );
    const issues = validateFlow([...fixed(), menu("m1", [opt(1, "c0")]), ...chain]);
    expect(find(issues, "cadeia-longa")).toEqual([]);
  });

  it("a cadeia é medida a partir de onde o motor a começa (opção aponta pro meio → mais curta → sem erro)", () => {
    const total = MAX_MESSAGE_HOPS + 1;
    const chain = Array.from({ length: total }, (_, i) => msg(`c${i}`, i === total - 1 ? "m1" : `c${i + 1}`));
    // opção pula direto pra c2: o motor só envia c2..c5 (4 textos)
    const issues = validateFlow([...fixed(), menu("m1", [opt(1, "c2")]), ...chain]);
    // c0 continua sendo "cabeça" solta (inalcançável) e longa, mas o caminho real do cliente não estoura:
    expect(find(issues, "cadeia-longa").map((i) => i.nodeId)).not.toContain("c2");
  });

  it("ciclo não vira também 'cadeia longa'", () => {
    const issues = validateFlow([...fixed(), menu("m1", [opt(1, "a")]), msg("a", "b"), msg("b", "a")]);
    expect(find(issues, "cadeia-longa")).toEqual([]);
  });

  it("nós DESABILITADOS não geram erros de conteúdo (não agem)", () => {
    const issues = validateFlow([
      ...fixed(),
      menu("m1", [opt(1, "h")]),
      menu("off", [], { enabled: false }),
      msg("moff", undefined, "", false),
    ]);
    expect(find(issues, "menu-sem-opcoes")).toEqual([]);
    expect(find(issues, "mensagem-vazia")).toEqual([]);
  });
});

describe("validateFlow — AVISOS", () => {
  it("nó menu/mensagem inalcançável a partir da entrada", () => {
    const issues = validateFlow([
      ...fixed({ entry: "m1" }),
      menu("m1", [opt(1, "h")]),
      menu("m2", [opt(1, "h")]),
      msg("solta"),
    ]);
    const un = find(issues, "inalcancavel");
    expect(un.map((i) => i.nodeId).sort()).toEqual(["m2", "solta"]);
    expect(un.every((i) => i.severity === "warning")).toBe(true);
  });

  it("alcance segue opção, fallback 'node' e mensagem→destino (nada disso é inalcançável)", () => {
    const issues = validateFlow([
      ...fixed({ entry: "m1" }),
      menu("m1", [opt(1, "msg1")], { fallback: { maxTentativas: 2, acao: "node", fallbackNodeId: "m2" } }),
      msg("msg1", "m3"),
      menu("m2", [opt(1, "h")]),
      menu("m3", [opt(1, "h")]),
    ]);
    expect(find(issues, "inalcancavel")).toEqual([]);
  });

  it("sem menu e sem entrada: a mensagem não tem como ser alcançada", () => {
    expect(find(validateFlow([...fixed(), msg("solta")]), "inalcancavel")).toHaveLength(1);
  });

  it("destino desabilitado (handover/ai/menu/mensagem) em opção, fallback, mensagem e entrada", () => {
    const issues = validateFlow([
      ...fixed({ handover: false, ai: false, entry: "m2" }),
      menu("m1", [opt(1, "h"), opt(2, "ai"), opt(3, "m2"), opt(4, "off")], {
        fallback: { maxTentativas: 2, acao: "node", fallbackNodeId: "h" },
      }),
      menu("m2", [opt(1, "m1")], { enabled: false }),
      msg("off", "ai", "x", false),
      msg("msg1", "h"),
    ]);
    const dis = find(issues, "destino-desabilitado");
    expect(dis.every((i) => i.severity === "warning")).toBe(true);
    // m1: h, ai, m2, off(msg desabilitada) + fallback h = 5; msg1 → h = 1; trigger → m2 (menu desabilitado) = 1
    expect(dis.filter((i) => i.nodeId === "m1")).toHaveLength(5);
    expect(dis.filter((i) => i.nodeId === "msg1")).toHaveLength(1);
    expect(dis.filter((i) => i.nodeId === "t")).toHaveLength(1);
  });

  it("palavra de retorno que contém palavra-chave de handover (com handover habilitado)", () => {
    const base = (word: string, handover: boolean) => [
      ...fixed({ palavraRetorno: word, handover, entry: "m1" }),
      menu("m1", [opt(1, "ai"), opt(2, "h")]),
    ];
    const hit = find(validateFlow(base("Atendente", true)), "retorno-colide-handover");
    expect(hit).toEqual([expect.objectContaining({ severity: "warning", nodeId: "ai" })]);
    expect(find(validateFlow(base("voltar pro suporte", true)), "retorno-colide-handover")).toHaveLength(1);
    // sem handover habilitado a palavra-chave não age → sem colisão; "menu" nunca colide
    expect(find(validateFlow(base("atendente", false)), "retorno-colide-handover")).toEqual([]);
    expect(find(validateFlow(base("menu", true)), "retorno-colide-handover")).toEqual([]);
  });

  it("menu sem nenhum caminho pra humano nem IA (handover/ai desligados e fallback aponta pra mensagem)", () => {
    const issues = validateFlow([
      ...fixed({ handover: false, ai: false, entry: "m1" }),
      menu("m1", [opt(1, "msg1")], { fallback: { maxTentativas: 2, acao: "node", fallbackNodeId: "msg1" } }),
      msg("msg1", "m1"),
    ]);
    expect(find(issues, "sem-caminho-humano-ia")).toEqual([
      expect.objectContaining({ severity: "warning", nodeId: "t" }),
    ]);
  });

  it("esgotar tentativas ENTREGA A HUMANO (R4): menu com fallback 'reprompt' já é caminho pra humano — sem aviso", () => {
    const issues = validateFlow([
      ...fixed({ handover: false, ai: false, entry: "m1" }),
      menu("m1", [opt(1, "msg1")]),
      msg("msg1", "m1"),
    ]);
    expect(find(issues, "sem-caminho-humano-ia")).toEqual([]);
  });

  it("caminho pra IA (alcançado) basta; handover/ai que NINGUÉM alcança não contam", () => {
    const viaAi = validateFlow([
      ...fixed({ handover: false, entry: "m1" }),
      menu("m1", [opt(1, "ai")], { fallback: { maxTentativas: 2, acao: "node", fallbackNodeId: "ai" } }),
    ]);
    expect(find(viaAi, "sem-caminho-humano-ia")).toEqual([]);

    const unreachableAi = validateFlow([
      ...fixed({ entry: "m1" }),
      menu("m1", [opt(1, "msg1")], { fallback: { maxTentativas: 2, acao: "node", fallbackNodeId: "msg1" } }),
      msg("msg1", "m1"),
    ]);
    expect(find(unreachableAi, "sem-caminho-humano-ia")).toHaveLength(1);
  });

  it("'Começar por' automático com mais de um menu habilitado é ambíguo; com a entrada escolhida, não", () => {
    const auto = validateFlow([...fixed(), menu("m1", [opt(1, "h")]), menu("m2", [opt(1, "h")])]);
    const amb = find(auto, "entrada-ambigua");
    expect(amb).toEqual([expect.objectContaining({ severity: "warning", nodeId: "t" })]);
    expect(amb[0].message).toContain("Menu m1");

    const chosen = validateFlow([...fixed({ entry: "m2" }), menu("m1", [opt(1, "h")]), menu("m2", [opt(1, "h")])]);
    expect(find(chosen, "entrada-ambigua")).toEqual([]);

    // 1 menu só = sem ambiguidade; menu desabilitado não conta
    expect(find(validateFlow([...fixed(), menu("m1", [opt(1, "h")])]), "entrada-ambigua")).toEqual([]);
    expect(find(validateFlow([...fixed(), menu("m1", [opt(1, "h")]), menu("m2", [opt(1, "h")], { enabled: false })]), "entrada-ambigua")).toEqual([]);
  });

  it("entrada apontando pra nó que não é menu/mensagem (ai, handover…) é ignorada pelo motor → aviso", () => {
    const issues = validateFlow([...fixed({ entry: "h" }), menu("m1", [opt(1, "h")])]);
    expect(find(issues, "entrada-invalida")).toEqual([expect.objectContaining({ severity: "warning", nodeId: "t" })]);
  });

  it("destino sem efeito: opção/mensagem apontando pro gatilho ou pro nó de envio", () => {
    const issues = validateFlow([...fixed(), menu("m1", [opt(1, "send")]), msg("msg1", "t")]);
    expect(find(issues, "destino-sem-efeito").map((i) => i.nodeId).sort()).toEqual(["m1", "msg1"]);
  });
});

describe("validateFlow — ordem e resumo", () => {
  it("erros antes de avisos; dentro do grupo, na ordem dos nós do fluxo", () => {
    const issues = validateFlow([
      ...fixed({ handover: false }),
      menu("m1", [opt(1, "h"), opt(2, "")]),
      msg("solta", undefined, ""),
    ]);
    const sev = issues.map((i) => i.severity);
    expect(sev).toEqual([...sev].sort((a, b) => (a === b ? 0 : a === "error" ? -1 : 1)));
    const errorIds = issues.filter((i) => i.severity === "error").map((i) => i.nodeId);
    expect(errorIds).toEqual(["m1", "solta"]);
  });

  it("não muta os nós de entrada", () => {
    const nodes = [...fixed(), menu("m1", [opt(1, "")])];
    const snapshot = JSON.stringify(nodes);
    validateFlow(nodes);
    expect(JSON.stringify(nodes)).toBe(snapshot);
  });

  it("summarizeFlowIssues: singular/plural e vazio", () => {
    const e = (code: FlowIssue["code"]): FlowIssue => ({ code, severity: "error", nodeId: "x", message: "" });
    const w = (code: FlowIssue["code"]): FlowIssue => ({ code, severity: "warning", nodeId: "x", message: "" });
    expect(summarizeFlowIssues([])).toEqual({ errors: 0, warnings: 0, label: "" });
    expect(summarizeFlowIssues([e("menu-sem-opcoes")])).toMatchObject({ errors: 1, warnings: 0, label: "1 erro" });
    expect(summarizeFlowIssues([e("menu-sem-opcoes"), e("mensagem-vazia"), w("inalcancavel")])).toMatchObject({
      errors: 2, warnings: 1, label: "2 erros e 1 aviso",
    });
    expect(summarizeFlowIssues([w("inalcancavel"), w("destino-desabilitado")]).label).toBe("2 avisos");
  });

  it("codes: o saudável de referência não dispara nada, e remover o destino de uma opção dispara exatamente o erro esperado", () => {
    const broken = healthy().map((n) =>
      n.id === "m1" && n.type === "menu" ? { ...n, properties: { ...n.properties, opcoes: [opt(1, ""), opt(2, "ai"), opt(3, "h")] } } : n,
    );
    expect(codes(validateFlow(broken))).toEqual(["opcao-sem-destino", "inalcancavel"]);
  });
});
