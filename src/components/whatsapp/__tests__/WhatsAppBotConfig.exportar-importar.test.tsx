// R11 — render: "Exportar fluxo" (baixa .json sem credenciais) e "Importar fluxo"
// (escolher arquivo → prévia com o que entra + problemas → confirmar). Nada é aplicado
// sem confirmar, arquivo inválido é recusado com o motivo, ids ficam únicos, e nada
// persiste até "Salvar Fluxo".
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import type { MenuWorkflowNode, WorkflowNode } from "@/components/whatsapp/WhatsAppBotConfig";
import { serializeFlow } from "@/components/whatsapp/flowTransfer";
import { buildFlowExample } from "@/components/whatsapp/flowExample";

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

function fixed(handover = true): WorkflowNode[] {
  return [
    { id: "node-trigger", type: "trigger", title: "Gatilho de Entrada", enabled: true, properties: { respondAll: true } },
    {
      id: "node-ai", type: "ai", title: "Agente IA (Gemini)", enabled: true,
      properties: {
        instruction: "x", model: "gemini-3.6-flash", provider: "gemini_api_key", geminiApiKey: "",
        gcpProjectId: "", gcpRegion: "us-central1", gcpServiceAccount: "", customModelName: "",
      },
    },
    { id: "node-send", type: "send", title: "Enviar Mensagem", enabled: true, properties: { template: "{{reply}}" } },
    { id: "node-handover", type: "handover", title: "Transbordo Humano", enabled: handover, properties: { assignTo: "" } },
  ];
}
const existingMenu = (): MenuWorkflowNode => ({
  id: "menu-existente", type: "menu", title: "Meu menu", enabled: true,
  properties: { mensagem: "Escolha", opcoes: [{ numero: 1, rotulo: "H", nextNodeId: "node-handover" }], fallback: { maxTentativas: 3, acao: "reprompt" } },
});

let created: Blob[] = [];
beforeEach(() => {
  created = [];
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
  // jsdom não implementa estas duas; o download real é só o navegador
  URL.createObjectURL = vi.fn((b: Blob | MediaSource) => { created.push(b as Blob); return "blob:fake"; });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

async function renderWithFlow(flow: WorkflowNode[], columns: { gemini_api_key?: string } = {}) {
  mocks.update.mockClear();
  mocks.maybeSingle.mockResolvedValue({
    data: { id: "bs-1", is_active: false, flow_data: flow, gemini_api_key: columns.gemini_api_key ?? "", gcp_service_account: "" },
    error: null,
  });
  const { container } = render(<WhatsAppBotConfig workspaceId="ws-1" />);
  await screen.findByText("Gatilho de Entrada");
  return container;
}
const readBlob = (b: Blob) =>
  new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsText(b);
  });
const chooseFile = (text: string, name = "fluxo.json") => {
  const input = screen.getByLabelText("Arquivo do fluxo (.json)") as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File([text], name, { type: "application/json" })] } });
};
const cardIds = (c: HTMLElement) => Array.from(c.querySelectorAll("[data-flow-node-id]")).map((e) => e.getAttribute("data-flow-node-id")!);
const preview = () => screen.findByRole("region", { name: "Importar fluxo" });

describe("R11 · Exportar fluxo", () => {
  it("baixa um .json com schema, versão e os nós atuais", async () => {
    await renderWithFlow(buildFlowExample(fixed(false)));
    fireEvent.click(screen.getByRole("button", { name: "Exportar fluxo" }));

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(created[0].type).toBe("application/json");
    const file = JSON.parse(await readBlob(created[0]));
    expect(file).toMatchObject({ schema: "kora.whatsapp-bot-flow", version: 1 });
    expect(file.nodes).toHaveLength(7);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake");
  });

  it("G71: a chave do workspace (coluna) reidratada no nó ai NÃO vai pro arquivo", async () => {
    await renderWithFlow(fixed(), { gemini_api_key: "AIza-SEGREDO-DO-WORKSPACE" });
    fireEvent.click(screen.getByRole("button", { name: "Exportar fluxo" }));
    expect(await readBlob(created[0])).not.toContain("AIza-SEGREDO-DO-WORKSPACE");
  });
});

describe("R11 · Importar fluxo — nunca silencioso", () => {
  const exampleFile = () => serializeFlow(buildFlowExample(fixed(true)));

  it("escolher o arquivo só mostra a PRÉVIA: nada é aplicado antes de confirmar", async () => {
    const container = await renderWithFlow(fixed(true));
    chooseFile(exampleFile());

    const region = await preview();
    expect(region).toHaveTextContent("Importar “fluxo.json”?");
    expect(region).toHaveTextContent("1 menu e 2 mensagens");
    expect(region).toHaveTextContent("Nada do que já existe é apagado");
    expect(region).toHaveTextContent("credenciais nunca vêm do arquivo");
    expect(cardIds(container)).toHaveLength(4); // só os fixos — nada importado ainda
    expect(within(region).getByText("A importação não traz nenhum problema novo.")).toBeInTheDocument();
  });

  it("Cancelar descarta a prévia sem mudar o fluxo", async () => {
    const container = await renderWithFlow(fixed(true));
    chooseFile(exampleFile());
    fireEvent.click(within(await preview()).getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("region", { name: "Importar fluxo" })).not.toBeInTheDocument();
    expect(cardIds(container)).toHaveLength(4);
  });

  it("Importar: adiciona menu + mensagens com ids NOVOS, seleciona o menu, e não persiste (Salvar é à parte)", async () => {
    const container = await renderWithFlow(fixed(true));
    chooseFile(exampleFile());
    fireEvent.click(within(await preview()).getByRole("button", { name: "Importar" }));

    const ids = cardIds(container);
    expect(ids).toHaveLength(7);
    expect(new Set(ids).size).toBe(7);
    expect(ids).not.toContain("node-menu-exemplo"); // id do arquivo reescrito
    expect(container.querySelectorAll('[data-flow-node-type="menu"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-flow-node-type="message"]')).toHaveLength(2);
    expect(screen.getByText("Configuração do Nó: Menu principal")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Importar fluxo" })).not.toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled(); // nada persiste até Salvar

    // as ligações foram refeitas com os ids novos (lista textual do canvas)
    const edges = within(screen.getByRole("list", { name: "Conexões do fluxo" })).getAllByRole("listitem");
    expect(edges.filter((li) => li.getAttribute("data-edge-kind") === "option")).toHaveLength(3);
    expect(edges.filter((li) => li.getAttribute("data-edge-kind") === "entry")).toHaveLength(1);
  });

  it("depois de importar, Salvar Fluxo grava o resultado (ids únicos) no flow_data", async () => {
    await renderWithFlow(fixed(true));
    chooseFile(exampleFile());
    fireEvent.click(within(await preview()).getByRole("button", { name: "Importar" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar Fluxo" }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    const payload = mocks.update.mock.calls[0][0] as { flow_data: Array<{ id: string }> };
    const ids = payload.flow_data.map((n) => n.id);
    expect(ids).toHaveLength(7);
    expect(new Set(ids).size).toBe(7);
  });

  it("importar num fluxo que JÁ tem menu: o menu existente fica intacto e nenhum id colide", async () => {
    const container = await renderWithFlow([...fixed(true), existingMenu()]);
    chooseFile(exampleFile());
    const region = await preview();
    expect(region).toHaveTextContent("posicionado abaixo");
    fireEvent.click(within(region).getByRole("button", { name: /^Importar/ }));

    const ids = cardIds(container);
    expect(ids).toContain("menu-existente");
    expect(ids).toHaveLength(8);
    expect(new Set(ids).size).toBe(8);
    expect(container.querySelectorAll('[data-flow-node-type="menu"]')).toHaveLength(2);
  });

  it("importar o MESMO arquivo duas vezes gera ids diferentes (sem colisão)", async () => {
    const container = await renderWithFlow(fixed(true));
    for (let i = 0; i < 2; i++) {
      chooseFile(exampleFile());
      fireEvent.click(within(await preview()).getByRole("button", { name: /^Importar/ }));
    }
    const ids = cardIds(container);
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(10);
  });
});

describe("R11 · Importar fluxo — arquivo inválido é recusado", () => {
  it("texto que não é JSON: alerta com o motivo, fluxo intacto, botão Fechar", async () => {
    const container = await renderWithFlow(fixed(true));
    chooseFile("isto não é json", "lixo.json");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Arquivo recusado (“lixo.json”): O arquivo não é um JSON válido. Nada foi alterado no fluxo.");
    expect(cardIds(container)).toHaveLength(4);
    expect(screen.queryByRole("region", { name: "Importar fluxo" })).not.toBeInTheDocument();

    fireEvent.click(within(alert).getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("JSON de outra coisa (schema errado) e versão futura: recusados com o motivo certo", async () => {
    await renderWithFlow(fixed(true));
    chooseFile(JSON.stringify({ nodes: [] }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/não é um fluxo exportado pelo Kora/);

    const future = JSON.parse(serializeFlow(buildFlowExample(fixed(true))));
    future.version = 99;
    chooseFile(JSON.stringify(future), "futuro.json");
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/versão 99/));
  });

  it("nó malformado dentro de um arquivo com o schema certo: recusado apontando o nó", async () => {
    const container = await renderWithFlow(fixed(true));
    const bad = JSON.parse(serializeFlow(buildFlowExample(fixed(true))));
    bad.nodes[4].properties.opcoes = "não é lista";
    chooseFile(JSON.stringify(bad));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Nó 5.*menu sem a lista “opcoes”/);
    expect(cardIds(container)).toHaveLength(7 - 3);
  });

  it("arquivo sem nenhum menu/mensagem: recusado ('não há o que importar')", async () => {
    await renderWithFlow(fixed(true));
    chooseFile(serializeFlow(fixed(true)));
    expect(await screen.findByRole("alert")).toHaveTextContent(/não há o que importar/);
  });
});

describe("R11 · Importar fluxo — problemas LISTADOS antes de aplicar", () => {
  it("arquivo válido na forma, mas com defeitos: prévia lista erros/avisos e o botão avisa; 'Importar mesmo assim' aplica", async () => {
    const container = await renderWithFlow(fixed(true));
    const flawed = JSON.parse(serializeFlow(buildFlowExample(fixed(true))));
    flawed.nodes[4].properties.opcoes[0].nextNodeId = ""; // opção sem destino
    flawed.nodes[5].properties.mensagem = "  "; // mensagem vazia
    chooseFile(JSON.stringify(flawed));

    const region = await preview();
    const group = within(region).getByRole("group", { name: "Problemas da importação" });
    const items = within(group).getAllByRole("listitem");
    const codes = items.map((li) => li.getAttribute("data-issue-code"));
    expect(codes).toContain("opcao-sem-destino");
    expect(codes).toContain("mensagem-vazia");
    expect(group).toHaveTextContent(/Problemas que esta importação traz — 2 erros/);
    expect(cardIds(container)).toHaveLength(4); // ainda nada aplicado

    fireEvent.click(within(region).getByRole("button", { name: /^Importar mesmo assim \(2 erros/ }));
    expect(cardIds(container)).toHaveLength(7); // aplicado só depois da confirmação
  });

  it("Transbordo habilitado no arquivo e desligado aqui: a nota e o aviso aparecem na prévia", async () => {
    await renderWithFlow(fixed(false));
    chooseFile(serializeFlow(buildFlowExample(fixed(true))));
    const region = await preview();
    expect(region).toHaveTextContent(/Transbordo Humano estava habilitado.*desabilitado/);
    expect(within(region).getByRole("group", { name: "Problemas da importação" })).toHaveTextContent(/desabilitado/);
  });
});
