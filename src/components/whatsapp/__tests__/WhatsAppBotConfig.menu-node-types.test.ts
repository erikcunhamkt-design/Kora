// Etapa 9 · Item 4 (construtor de fluxo scriptado), fatia R1 — fundação de
// dados (docs/qa/etapa-9-bot-fluxo-scriptado-r1-fundacao.md). Testes de
// TIPO/ESTRUTURA — zero runtime/UI mudou nesta rodada, então não há
// comportamento de componente a exercitar ainda; o que este arquivo prova
// é que o novo `MenuWorkflowNode` (a) compila como membro legítimo da
// união discriminada `WorkflowNode` (se a forma estivesse errada, o
// import/type-check abaixo falharia, não um assert em runtime) e (b) tem
// exatamente a estrutura decidida pelo operador ("Opção B-Kora").
import { describe, it, expect } from "vitest";
import type {
  WorkflowNode,
  MenuWorkflowNode,
  MenuWorkflowNodeOption,
  MenuWorkflowNodeFallback,
  HandoverWorkflowNode,
} from "@/components/whatsapp/WhatsAppBotConfig";

function makeMenuNode(overrides: Partial<MenuWorkflowNode["properties"]> = {}): MenuWorkflowNode {
  return {
    id: "node-menu-1",
    title: "Menu principal",
    enabled: true,
    type: "menu",
    properties: {
      mensagem: "Escolha uma opção:\n1 - Suporte\n2 - Vendas",
      opcoes: [
        { numero: 1, rotulo: "Suporte", nextNodeId: "node-handover" },
        { numero: 2, rotulo: "Vendas", nextNodeId: "node-ai" },
      ],
      fallback: { maxTentativas: 3, acao: "reprompt" },
      ...overrides,
    },
  };
}

describe("WorkflowNode · tipo 'menu' (Item 4, R1 — fundação de dados)", () => {
  it("MenuWorkflowNode compila como membro da união discriminada WorkflowNode", () => {
    const node: WorkflowNode = makeMenuNode();
    expect(node.type).toBe("menu");
  });

  it("uma árvore (WorkflowNode[]) aceita nós 'menu' misturados com os 4 tipos existentes", () => {
    const handover: HandoverWorkflowNode = {
      id: "node-handover", title: "Transbordo", enabled: true,
      type: "handover", properties: { assignTo: "" },
    };
    const tree: WorkflowNode[] = [makeMenuNode(), handover];
    expect(tree).toHaveLength(2);
    expect(tree.map((n) => n.type)).toEqual(["menu", "handover"]);
  });

  it("opções numeradas carregam número, rótulo e o id do próximo nó (árvore 100% montável pelo usuário)", () => {
    const node = makeMenuNode();
    const opts: MenuWorkflowNodeOption[] = node.properties.opcoes;
    expect(opts).toEqual([
      { numero: 1, rotulo: "Suporte", nextNodeId: "node-handover" },
      { numero: 2, rotulo: "Vendas", nextNodeId: "node-ai" },
    ]);
    // nextNodeId é string livre — não um enum fixo de tipos de nó — porque
    // quem monta a árvore é o usuário, mesmo padrão de PipelineStage.id do CRM.
    expect(typeof opts[0].nextNodeId).toBe("string");
  });

  it("fallback default do produto é 'reprompt' (reapresenta o menu) — não um transbordo automático", () => {
    const node = makeMenuNode();
    const fallback: MenuWorkflowNodeFallback = node.properties.fallback;
    expect(fallback.acao).toBe("reprompt");
    expect(fallback.maxTentativas).toBe(3);
    expect(fallback.fallbackNodeId).toBeUndefined();
  });

  it("fallback 'node' aceita fallbackNodeId apontando pra qualquer nó da árvore (não só handover)", () => {
    const node = makeMenuNode({
      fallback: { maxTentativas: 2, acao: "node", fallbackNodeId: "node-ai" },
    });
    expect(node.properties.fallback).toEqual({
      maxTentativas: 2, acao: "node", fallbackNodeId: "node-ai",
    });
  });
});
