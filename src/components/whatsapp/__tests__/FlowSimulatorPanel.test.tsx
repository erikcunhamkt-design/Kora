// Etapa 9 · Item 4 — painel "Simulador do Fluxo" (apresentação). U4: avisos do
// simulador não são bolhas do robô; selo de handover; estado legível; reiniciar.
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { FlowSimulatorPanel } from "@/components/whatsapp/FlowSimulatorPanel";
import type { SimMessage, SimStateSummary } from "@/components/whatsapp/flowSimulatorModel";

beforeEach(() => {
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
});

function renderPanel(overrides: Partial<React.ComponentProps<typeof FlowSimulatorPanel>> = {}) {
  const props: React.ComponentProps<typeof FlowSimulatorPanel> = {
    messages: [{ role: "model", text: "Olá! Eu sou o simulador." }],
    simulating: false,
    input: "",
    onInputChange: vi.fn(),
    onSubmit: vi.fn((e: React.FormEvent) => e.preventDefault()),
    onReset: vi.fn(),
    stateSummary: { tone: "idle", label: "Fora do menu — a próxima mensagem inicia o fluxo" } as SimStateSummary,
    ...overrides,
  };
  render(<FlowSimulatorPanel {...props} />);
  return props;
}

describe("FlowSimulatorPanel", () => {
  it("mostra o estado atual da simulação de forma legível", () => {
    renderPanel({ stateSummary: { tone: "menu", label: "No menu “Menu principal” — respostas inválidas: 1 de 3" } });

    const status = screen.getByRole("status", { name: "Estado da simulação" });
    expect(status).toHaveTextContent("Estado:");
    expect(status).toHaveTextContent("No menu “Menu principal” — respostas inválidas: 1 de 3");
  });

  it("estado entregue a humano é destacado no painel", () => {
    renderPanel({ stateSummary: { tone: "handover", label: "Entregue a atendimento humano — o robô está em silêncio" } });

    expect(screen.getByRole("status", { name: "Estado da simulação" })).toHaveTextContent(/Entregue a atendimento humano/);
  });

  it("renderiza bolhas user/model, o selo de handover e os avisos 'system' (que não são bolha de ninguém)", () => {
    const messages: SimMessage[] = [
      { role: "user", text: "quero falar com atendente" },
      { role: "model", text: "Encaminhando o seu contato…", tag: "Entregue a atendimento humano · palavra-chave" },
      { role: "system", text: "🔇 Robô em silêncio" },
    ];
    renderPanel({ messages });

    const log = screen.getByRole("log", { name: "Conversa simulada" });
    expect(within(log).getByText("quero falar com atendente")).toBeInTheDocument();
    expect(within(log).getByText("Encaminhando o seu contato…")).toBeInTheDocument();
    expect(within(log).getByText("Entregue a atendimento humano · palavra-chave")).toBeInTheDocument();
    // aviso do simulador: texto presente, mas SEM avatar "U" nem ícone do robô ao redor
    const aviso = within(log).getByText("🔇 Robô em silêncio");
    expect(aviso.closest("[class*='border-dashed']")).not.toBeNull();
  });

  it("'Reiniciar simulação' dispara onReset", () => {
    const props = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /Reiniciar simulação/ }));

    expect(props.onReset).toHaveBeenCalledTimes(1);
  });

  it("enviar: botão desabilitado com input vazio e habilitado com texto; digitar chama onInputChange; submit chama onSubmit", () => {
    const props = renderPanel({ input: "oi" });

    const send = screen.getByRole("button", { name: "Enviar mensagem de teste" });
    expect(send).toBeEnabled();
    fireEvent.change(screen.getByPlaceholderText("Envie uma mensagem de teste..."), { target: { value: "1" } });
    expect(props.onInputChange).toHaveBeenCalledWith("1");
    fireEvent.click(send);
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it("input vazio mantém o botão de enviar desabilitado", () => {
    renderPanel({ input: "   " });
    expect(screen.getByRole("button", { name: "Enviar mensagem de teste" })).toBeDisabled();
  });

  it("simulating=true: mostra 'Processando fluxo de nós...' e trava o input", () => {
    renderPanel({ simulating: true, input: "oi" });

    expect(screen.getByText("Processando fluxo de nós...")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Envie uma mensagem de teste...")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enviar mensagem de teste" })).toBeDisabled();
  });
});
