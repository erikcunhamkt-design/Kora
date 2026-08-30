// Item 4 (construtor de fluxo scriptado), fatia R5 — UI do construtor
// (etapa-9-bot-fluxo-scriptado-r1-fundacao.md, R1 = fundação de dados;
// esta rodada é a UI que consome aquele tipo). Testes de UI/ESTADO — zero
// mudança de server nesta rodada (persistência continua em `flow_data`,
// já existente, client-side only), então nenhum teste aqui exercita
// `supabase.from(...).update/insert`, só o estado local (`nodes`) via
// interação de usuário.
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { maybeSingle, eq, select, from };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));
vi.mock("@/hooks/useWorkspaceRole", () => ({
  useWorkspaceRole: () => ({ role: "owner", isAdmin: true, loading: false }),
}));

import { WhatsAppBotConfig } from "@/components/whatsapp/WhatsAppBotConfig";

// Radix Select (cmdk/popper por baixo) chama scrollIntoView ao abrir o
// listbox — ausente no jsdom padrão. Mesma classe de gap já documentada em
// CRM.test.tsx/Financeiro.test.tsx (lá pra DropdownMenu/hasPointerCapture,
// aqui pra Select).
beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
});

async function renderAndAddMenuNode() {
  render(<WhatsAppBotConfig workspaceId="ws-1" />);
  // Aguarda o loading terminar (loadSettings resolvido, sem settings salvas
  // — nasce só com os 4 nós fixos).
  await screen.findByText("Gatilho de Entrada");
  fireEvent.click(screen.getByRole("button", { name: /Adicionar nó de menu/i }));
}

describe("WhatsAppBotConfig · nó 'menu' (Item 4, R5) — criação e seleção", () => {
  it("clicar em '+ Adicionar nó de menu' cria e seleciona um nó menu, abrindo o inspector correspondente", async () => {
    await renderAndAddMenuNode();

    // Novo card aparece no canvas com o título default.
    expect(screen.getByText("Menu 1")).toBeInTheDocument();
    // Inspector do nó recém-criado (seleção automática) mostra os campos do
    // tipo "menu", não os de outro tipo.
    expect(screen.getByText("Configuração do Nó: Menu 1")).toBeInTheDocument();
    expect(screen.getByText("Título do nó")).toBeInTheDocument();
    expect(screen.getByText("Mensagem")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma opção ainda.")).toBeInTheDocument();
  });

  it("adicionar um segundo nó menu numera o título default sequencialmente", async () => {
    await renderAndAddMenuNode();
    fireEvent.click(screen.getByRole("button", { name: /Adicionar nó de menu/i }));

    expect(screen.getByText("Menu 1")).toBeInTheDocument();
    expect(screen.getByText("Menu 2")).toBeInTheDocument();
  });
});

describe("WhatsAppBotConfig · nó 'menu' (Item 4, R5) — edição de título e mensagem", () => {
  it("editar o título do nó reflete no card do canvas", async () => {
    await renderAndAddMenuNode();

    const titleInput = screen.getByPlaceholderText("Ex: Menu principal");
    fireEvent.change(titleInput, { target: { value: "Menu de Suporte" } });

    expect(screen.getByText("Menu de Suporte")).toBeInTheDocument();
    expect(screen.getByText("Configuração do Nó: Menu de Suporte")).toBeInTheDocument();
  });

  it("editar a mensagem atualiza o valor do textarea", async () => {
    await renderAndAddMenuNode();

    const mensagemInput = screen.getByPlaceholderText(/Escolha uma opção/) as HTMLTextAreaElement;
    fireEvent.change(mensagemInput, { target: { value: "Digite 1 para Suporte" } });

    expect(mensagemInput.value).toBe("Digite 1 para Suporte");
  });
});

describe("WhatsAppBotConfig · nó 'menu' (Item 4, R5) — opções numeradas", () => {
  it("adicionar opção mostra uma linha nova numerada, e editar o rótulo funciona", async () => {
    await renderAndAddMenuNode();

    fireEvent.click(screen.getByRole("button", { name: /Adicionar opção/i }));
    expect(screen.queryByText("Nenhuma opção ainda.")).not.toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument(); // numero auto-atribuído

    const rotuloInput = screen.getByPlaceholderText("Rótulo (ex: Suporte)");
    fireEvent.change(rotuloInput, { target: { value: "Suporte técnico" } });
    expect((rotuloInput as HTMLInputElement).value).toBe("Suporte técnico");
  });

  it("nextNodeId é selecionável entre os nós já existentes na árvore (sem árvore pré-fabricada)", async () => {
    await renderAndAddMenuNode();
    fireEvent.click(screen.getByRole("button", { name: /Adicionar opção/i }));

    // Pode haver mais de 1 combobox visível (opção + fallback) — localiza
    // pelo container da linha de opção especificamente.
    const optionRow = screen.getByPlaceholderText("Rótulo (ex: Suporte)").closest("div") as HTMLElement;
    const nextNodeTrigger = within(optionRow).getByRole("combobox");
    fireEvent.click(nextNodeTrigger);

    const listbox = await screen.findByRole("listbox");
    fireEvent.click(within(listbox).getByText("Transbordo Humano"));

    // SelectValue passa a exibir o título do nó escolhido.
    expect(within(optionRow).getByText("Transbordo Humano")).toBeInTheDocument();
  });

  it("remover opção some com a linha", async () => {
    await renderAndAddMenuNode();
    fireEvent.click(screen.getByRole("button", { name: /Adicionar opção/i }));
    expect(screen.getByPlaceholderText("Rótulo (ex: Suporte)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remover opção" }));

    expect(screen.queryByPlaceholderText("Rótulo (ex: Suporte)")).not.toBeInTheDocument();
    expect(screen.getByText("Nenhuma opção ainda.")).toBeInTheDocument();
  });
});

describe("WhatsAppBotConfig · nó 'menu' (Item 4, R5) — fallback (resposta inválida)", () => {
  it("default é 'reprompt' (reapresentar o menu) — sem seletor de nó de destino visível", async () => {
    await renderAndAddMenuNode();

    expect(screen.getByText("Reapresentar o menu (padrão)")).toBeInTheDocument();
    expect(screen.queryByText("Nó de destino")).not.toBeInTheDocument();
  });

  it("trocar pra 'Pular para outro nó' revela o seletor de nó de destino, excluindo o próprio nó menu", async () => {
    await renderAndAddMenuNode();

    const fallbackTrigger = screen.getByText("Reapresentar o menu (padrão)").closest('button[role="combobox"]') as HTMLElement;
    fireEvent.click(fallbackTrigger);
    const listbox = await screen.findByRole("listbox");
    fireEvent.click(within(listbox).getByText("Pular para outro nó"));

    expect(screen.getByText("Nó de destino")).toBeInTheDocument();

    // O próprio nó "Menu 1" não pode ser destino do seu próprio fallback.
    const destinoTrigger = screen.getByText("Selecione um nó").closest('button[role="combobox"]') as HTMLElement;
    fireEvent.click(destinoTrigger);
    const destinoListbox = await screen.findByRole("listbox");
    expect(within(destinoListbox).queryByText("Menu 1")).not.toBeInTheDocument();
    expect(within(destinoListbox).getByText("Transbordo Humano")).toBeInTheDocument();
  });

  it("mudar o limite de tentativas reflete no texto explicativo", async () => {
    await renderAndAddMenuNode();

    const tentativasInput = screen.getByDisplayValue("3");
    fireEvent.change(tentativasInput, { target: { value: "5" } });

    expect(screen.getByText(/depois de 5 tentativas inválidas seguidas/)).toBeInTheDocument();
  });
});

describe("WhatsAppBotConfig · nó 'menu' (Item 4, R5) — regressão dos 4 nós existentes", () => {
  it("criar um nó menu não altera o comportamento dos nós trigger/ai/send/handover já existentes", async () => {
    await renderAndAddMenuNode();

    // Os 4 nós originais continuam presentes e clicáveis, comportamento
    // do G31 (useRef latest-ref) preservado — nenhum fetch extra.
    expect(screen.getByText("Gatilho de Entrada")).toBeInTheDocument();
    expect(screen.getByText("Agente IA (Gemini)")).toBeInTheDocument();
    expect(screen.getByText("Enviar Mensagem")).toBeInTheDocument();
    expect(screen.getByText("Transbordo Humano")).toBeInTheDocument();
    expect(mocks.from).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Gatilho de Entrada"));
    expect(screen.getByText("Configuração do Nó: Gatilho de Entrada")).toBeInTheDocument();
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });
});
