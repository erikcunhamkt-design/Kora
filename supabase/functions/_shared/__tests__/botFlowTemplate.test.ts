import { describe, expect, it } from "vitest";
import { applySendTemplate, findEnabledNode } from "../botFlowTemplate";

describe("applySendTemplate (G8 regression)", () => {
  it("aplica o template customizado do Send Node em vez de cair no fallback cru", () => {
    const nodes = [
      { type: "ai", enabled: true },
      {
        type: "send",
        enabled: true,
        properties: { template: "Oi! {{reply}} Att, Equipe" },
      },
    ];
    expect(applySendTemplate(nodes, "Tudo certo por aqui.")).toBe(
      "Oi! Tudo certo por aqui. Att, Equipe",
    );
  });

  it("template default '{{reply}}' produz saida identica ao fallback (por isso o bug era invisivel)", () => {
    const nodes = [{ type: "send", enabled: true, properties: { template: "{{reply}}" } }];
    expect(applySendTemplate(nodes, "resposta da IA")).toBe("resposta da IA");
  });

  it("template estatico sem {{reply}} e retornado verbatim", () => {
    const nodes = [
      { type: "send", enabled: true, properties: { template: "Em manutenção, volte mais tarde." } },
    ];
    expect(applySendTemplate(nodes, "resposta da IA")).toBe("Em manutenção, volte mais tarde.");
  });

  it("sem flow_data (bots legados, array vazio) devolve a resposta crua", () => {
    expect(applySendTemplate([], "resposta da IA")).toBe("resposta da IA");
  });

  it("Send Node desabilitado e ignorado, mesmo com template configurado", () => {
    const nodes = [
      { type: "send", enabled: false, properties: { template: "Nunca deveria aplicar: {{reply}}" } },
    ];
    expect(applySendTemplate(nodes, "resposta da IA")).toBe("resposta da IA");
  });
});

describe("findEnabledNode", () => {
  it("acha o nó habilitado do tipo pedido", () => {
    const nodes = [
      { type: "trigger", enabled: true },
      { type: "ai", enabled: true },
    ];
    expect(findEnabledNode(nodes, "ai")?.type).toBe("ai");
  });

  it("ignora nós do tipo certo mas desabilitados", () => {
    const nodes = [{ type: "handover", enabled: false }];
    expect(findEnabledNode(nodes, "handover")).toBeUndefined();
  });

  it("retorna undefined quando não há nó do tipo pedido", () => {
    expect(findEnabledNode([], "send")).toBeUndefined();
  });
});
