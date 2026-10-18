// R10 — fluxo de exemplo (funções puras): quando pode carregar, o que monta, que NUNCA
// sobrescreve fluxo do usuário e que o resultado passa na validação sem nenhum problema.
import { describe, it, expect } from "vitest";
import { EXAMPLE_IDS, EXAMPLE_RETURN_WORD, buildFlowExample, canLoadFlowExample } from "@/components/whatsapp/flowExample";
import { validateFlow } from "@/components/whatsapp/flowValidation";
import { computeCanvasEdges } from "@/components/whatsapp/flowCanvasEdges";
import { withAutoLayout } from "@/components/whatsapp/flowCanvasModel";
import type { AiWorkflowNode, MenuWorkflowNode, MessageWorkflowNode, WorkflowNode } from "@/components/whatsapp/WhatsAppBotConfig";

// Os 4 nós fixos exatamente como o componente nasce (handover desligado).
function pristine(): WorkflowNode[] {
  return withAutoLayout([
    { id: "node-trigger", type: "trigger", title: "Gatilho de Entrada", enabled: true, properties: { respondAll: true } },
    {
      id: "node-ai", type: "ai", title: "Agente IA (Gemini)", enabled: true,
      properties: {
        instruction: "x", model: "m", provider: "p", geminiApiKey: "", gcpProjectId: "",
        gcpRegion: "", gcpServiceAccount: "", customModelName: "",
      },
    },
    { id: "node-send", type: "send", title: "Enviar Mensagem", enabled: true, properties: { template: "{{reply}}" } },
    { id: "node-handover", type: "handover", title: "Transbordo Humano", enabled: false, properties: { assignTo: "" } },
  ]);
}
const get = (ns: WorkflowNode[], id: string) => ns.find((n) => n.id === id)!;

describe("canLoadFlowExample", () => {
  it("só com os fixos (sem menu e sem mensagem)", () => {
    expect(canLoadFlowExample(pristine())).toBe(true);
  });

  it("qualquer menu ou mensagem do usuário bloqueia", () => {
    const menu: MenuWorkflowNode = {
      id: "m", type: "menu", title: "M", enabled: true,
      properties: { mensagem: "", opcoes: [], fallback: { maxTentativas: 3, acao: "reprompt" } },
    };
    const message: MessageWorkflowNode = { id: "x", type: "message", title: "X", enabled: false, properties: { mensagem: "" } };
    expect(canLoadFlowExample([...pristine(), menu])).toBe(false);
    expect(canLoadFlowExample([...pristine(), message])).toBe(false); // mesmo desabilitada: é do usuário
  });

  it("lista vazia não carrega", () => {
    expect(canLoadFlowExample([])).toBe(false);
  });
});

describe("buildFlowExample", () => {
  it("monta 1 menu (3 opções) + 2 mensagens, mantém os 4 fixos e liga a entrada do gatilho ao menu", () => {
    const out = buildFlowExample(pristine());
    expect(out.map((n) => n.id)).toEqual([
      "node-trigger", "node-ai", "node-send", "node-handover",
      EXAMPLE_IDS.menu, EXAMPLE_IDS.horario, EXAMPLE_IDS.ia,
    ]);
    expect(get(out, "node-trigger").properties).toMatchObject({ respondAll: true, nextNodeId: EXAMPLE_IDS.menu });
    const menu = get(out, EXAMPLE_IDS.menu) as MenuWorkflowNode;
    expect(menu.properties.opcoes.map((o) => [o.numero, o.nextNodeId])).toEqual([
      [1, EXAMPLE_IDS.horario], [2, EXAMPLE_IDS.ia], [3, "node-handover"],
    ]);
  });

  it("mensagem informativa volta ao menu; saudação da IA leva ao nó ai", () => {
    const out = buildFlowExample(pristine());
    expect((get(out, EXAMPLE_IDS.horario) as MessageWorkflowNode).properties.nextNodeId).toBe(EXAMPLE_IDS.menu);
    expect((get(out, EXAMPLE_IDS.ia) as MessageWorkflowNode).properties.nextNodeId).toBe("node-ai");
  });

  it("habilita o Transbordo Humano e define a palavra de retorno 'menu' no nó ai", () => {
    const out = buildFlowExample(pristine());
    expect(get(out, "node-handover").enabled).toBe(true);
    expect((get(out, "node-ai") as AiWorkflowNode).properties.palavraRetorno).toBe(EXAMPLE_RETURN_WORD);
  });

  it("G29: a saudação da IA só cita a palavra que de fato existe — a definida pelo exemplo…", () => {
    const out = buildFlowExample(pristine());
    expect((get(out, EXAMPLE_IDS.ia) as MessageWorkflowNode).properties.mensagem).toContain("envie “menu”");
  });

  it("…ou a que o usuário JÁ tinha no nó ai (não é sobrescrita)", () => {
    const base = pristine().map((n) =>
      n.type === "ai" ? { ...n, properties: { ...n.properties, palavraRetorno: "voltar" } } : n,
    );
    const out = buildFlowExample(base);
    expect((get(out, "node-ai") as AiWorkflowNode).properties.palavraRetorno).toBe("voltar");
    expect((get(out, EXAMPLE_IDS.ia) as MessageWorkflowNode).properties.mensagem).toContain("envie “voltar”");
    expect((get(out, EXAMPLE_IDS.ia) as MessageWorkflowNode).properties.mensagem).not.toContain("“menu”");
  });

  it("posições pré-calculadas (válidas, distintas entre si e das dos fixos)", () => {
    const out = buildFlowExample(pristine());
    const positions = out.map((n) => JSON.stringify(n.position));
    expect(out.every((n) => typeof n.position?.x === "number" && typeof n.position?.y === "number")).toBe(true);
    expect(new Set(positions).size).toBe(out.length);
  });

  it("o resultado PASSA na validação sem NENHUM problema (nem erro, nem aviso)", () => {
    expect(validateFlow(buildFlowExample(pristine()))).toEqual([]);
  });

  it("as arestas desenhadas são as do exemplo: entrada, 3 opções, volta ao menu e saudação → IA", () => {
    const edges = computeCanvasEdges(buildFlowExample(pristine())).filter((e) => e.kind !== "sequence");
    expect(edges.map((e) => [e.kind, e.fromNodeId, e.toNodeId])).toEqual([
      ["entry", "node-trigger", EXAMPLE_IDS.menu],
      ["option", EXAMPLE_IDS.menu, EXAMPLE_IDS.horario],
      ["option", EXAMPLE_IDS.menu, EXAMPLE_IDS.ia],
      ["option", EXAMPLE_IDS.menu, "node-handover"],
      ["next", EXAMPLE_IDS.horario, EXAMPLE_IDS.menu],
      ["next", EXAMPLE_IDS.ia, "node-ai"],
    ]);
  });

  it("NUNCA sobrescreve: fluxo com nó do usuário → devolve o MESMO array; segunda chamada sobre o resultado também", () => {
    const once = buildFlowExample(pristine());
    expect(buildFlowExample(once)).toBe(once);
  });

  it("não muta o array de entrada", () => {
    const base = pristine();
    const snapshot = JSON.stringify(base);
    buildFlowExample(base);
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  it("sem os fixos necessários (gatilho/IA/transbordo) não monta exemplo pela metade", () => {
    const noHandover = pristine().filter((n) => n.type !== "handover");
    expect(buildFlowExample(noHandover)).toBe(noHandover);
  });
});
