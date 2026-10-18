// Etapa 9 · item 4, R9 — campo "Palavra para voltar ao menu" no inspector do nó de
// IA, e a dica (G29) no inspector da mensagem: só se oferece a avisar o cliente
// quando o nó ai de destino TEM palavra definida. Render/estado + persistência no
// flow_data; o motor tem testes próprios (botFlowRetorno.test.ts).
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { MessageWorkflowNode, WorkflowNode } from "@/components/whatsapp/WhatsAppBotConfig";

const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn((_payload: unknown) => ({ eq: updateEq }));
  const from = vi.fn(() => ({ select, update }));
  return { maybeSingle, eq, select, update, updateEq, from };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));
vi.mock("@/hooks/useWorkspaceRole", () => ({
  useWorkspaceRole: () => ({ role: "owner", isAdmin: true, loading: false }),
}));

import { WhatsAppBotConfig } from "@/components/whatsapp/WhatsAppBotConfig";
import "@/components/whatsapp/FlowCanvas";

beforeEach(() => {
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
});

function fixed(palavraRetorno?: string): WorkflowNode[] {
  return [
    { id: "node-trigger", type: "trigger", title: "Gatilho de Entrada", enabled: true, properties: { respondAll: true } },
    {
      id: "node-ai", type: "ai", title: "Agente IA (Gemini)", enabled: true,
      properties: {
        instruction: "x", model: "gemini-3.6-flash", provider: "gemini_api_key", geminiApiKey: "",
        gcpProjectId: "", gcpRegion: "us-central1", gcpServiceAccount: "", customModelName: "",
        ...(palavraRetorno === undefined ? {} : { palavraRetorno }),
      },
    },
    { id: "node-send", type: "send", title: "Enviar Mensagem", enabled: true, properties: { template: "{{reply}}" } },
    { id: "node-handover", type: "handover", title: "Transbordo Humano", enabled: false, properties: { assignTo: "" } },
  ];
}
const message = (mensagem = "Pode me contar o que precisa!"): MessageWorkflowNode => ({
  id: "msg-ia", type: "message", title: "Saudação IA", enabled: true,
  properties: { mensagem, nextNodeId: "node-ai" },
});

async function renderWithFlow(flow: WorkflowNode[]) {
  mocks.update.mockClear();
  mocks.maybeSingle.mockResolvedValue({
    data: { id: "bs-1", is_active: false, flow_data: flow, gemini_api_key: "", gcp_service_account: "" },
    error: null,
  });
  const { container } = render(<WhatsAppBotConfig workspaceId="ws-1" />);
  await screen.findByText("Gatilho de Entrada");
  return container;
}
const clickNode = (c: HTMLElement, id: string) =>
  fireEvent.click(c.querySelector(`[data-flow-node-id="${id}"]`) as HTMLElement);
const savedAi = () => {
  const payload = mocks.update.mock.calls[0][0] as { flow_data: Array<{ id: string; properties: Record<string, unknown> }> };
  return payload.flow_data.find((n) => n.id === "node-ai")!.properties;
};

describe("R9 · inspector do nó de IA — palavra para voltar ao menu", () => {
  it("flow_data antigo (sem o campo): campo vazio, placeholder sugerido 'menu' e ajuda honesta (sem saída)", async () => {
    const container = await renderWithFlow(fixed());
    clickNode(container, "node-ai");

    const input = screen.getByPlaceholderText("menu") as HTMLInputElement;
    expect(input.value).toBe("");
    expect(screen.getByText(/o cliente não tem como voltar ao menu por conta própria/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Usar “menu”/ })).toBeInTheDocument();
  });

  it("'Usar “menu”' preenche o sugerido; a ajuda passa a descrever a palavra e o botão some", async () => {
    const container = await renderWithFlow(fixed());
    clickNode(container, "node-ai");

    fireEvent.click(screen.getByRole("button", { name: /Usar “menu”/ }));
    expect((screen.getByPlaceholderText("menu") as HTMLInputElement).value).toBe("menu");
    expect(screen.getByText(/se o cliente enviar só “menu” a conversa volta ao início do fluxo/)).toBeInTheDocument();
    expect(screen.getByText(/uma frase que apenas contenha a palavra não conta/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Usar “menu”/ })).not.toBeInTheDocument();
  });

  it("palavra só com espaços conta como VAZIA (ajuda de 'sem saída' e botão sugerido de volta)", async () => {
    const container = await renderWithFlow(fixed("   "));
    clickNode(container, "node-ai");
    expect(screen.getByText(/o cliente não tem como voltar ao menu/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Usar “menu”/ })).toBeInTheDocument();
  });

  it("digitar a palavra e salvar grava `palavraRetorno` no nó ai do flow_data", async () => {
    const container = await renderWithFlow(fixed());
    clickNode(container, "node-ai");
    fireEvent.change(screen.getByPlaceholderText("menu"), { target: { value: "Voltar ao início" } });

    fireEvent.click(screen.getByRole("button", { name: /Salvar Fluxo/i }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(savedAi().palavraRetorno).toBe("Voltar ao início");
  });

  it("palavra já salva é recarregada no campo (round-trip) e preservada ao salvar sem mexer", async () => {
    const container = await renderWithFlow(fixed("sair"));
    clickNode(container, "node-ai");
    expect((screen.getByPlaceholderText("menu") as HTMLInputElement).value).toBe("sair");

    fireEvent.click(screen.getByRole("button", { name: /Salvar Fluxo/i }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(savedAi().palavraRetorno).toBe("sair");
  });

  it("sem tocar no campo, o flow_data salvo NÃO ganha a chave (forma idêntica à de antes)", async () => {
    await renderWithFlow(fixed());
    fireEvent.click(screen.getByRole("button", { name: /Salvar Fluxo/i }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect("palavraRetorno" in savedAi()).toBe(false);
  });
});

describe("R9 · dica de aviso no inspector da mensagem (G29 — nunca prometer palavra que não existe)", () => {
  it("nó ai de destino SEM palavra: nenhuma dica de aviso", async () => {
    const container = await renderWithFlow([...fixed(), message()]);
    clickNode(container, "msg-ia");
    expect(screen.queryByText(/palavra de retorno/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Acrescentar ao texto/ })).not.toBeInTheDocument();
  });

  it("nó ai de destino COM palavra: oferece acrescentar; o botão acrescenta a frase UMA vez e some", async () => {
    const container = await renderWithFlow([...fixed("menu"), message()]);
    clickNode(container, "msg-ia");

    expect(screen.getByText(/tem a palavra de retorno “menu”/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Acrescentar ao texto/ }));

    const textarea = screen.getByPlaceholderText(/Atendemos de segunda a sexta/) as HTMLTextAreaElement;
    expect(textarea.value).toBe("Pode me contar o que precisa!\n\nPara voltar ao menu, envie “menu”.");
    expect(screen.queryByRole("button", { name: /Acrescentar ao texto/ })).not.toBeInTheDocument();
  });

  it("o texto NUNCA é alterado sozinho: sem clicar, a mensagem fica como o usuário escreveu", async () => {
    const container = await renderWithFlow([...fixed("menu"), message()]);
    clickNode(container, "msg-ia");
    const textarea = screen.getByPlaceholderText(/Atendemos de segunda a sexta/) as HTMLTextAreaElement;
    expect(textarea.value).toBe("Pode me contar o que precisa!");
  });

  it("mensagem que aponta pra um menu (não ai): nenhuma dica", async () => {
    const msgToMenu: MessageWorkflowNode = { ...message(), properties: { mensagem: "x", nextNodeId: "node-handover" } };
    const container = await renderWithFlow([...fixed("menu"), msgToMenu]);
    clickNode(container, "msg-ia");
    expect(screen.queryByText(/palavra de retorno/)).not.toBeInTheDocument();
  });
});
