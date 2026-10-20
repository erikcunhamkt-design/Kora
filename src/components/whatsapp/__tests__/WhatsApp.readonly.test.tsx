// Etapa 9 · Item 4 (G103, fatia 2) — papel `viewer` = SOMENTE LEITURA na UI: composer, ações da mensagem e
// estrela de figurinha somem (o servidor nega toda escrita a esse papel com 403 — G29: a tela não promete
// o que dá 403). Default (sem `readOnly`) = comportamento de sempre.
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() }, from: vi.fn(), auth: { getUser: vi.fn() } },
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/components/whatsapp/WhatsAppStickerPicker", () => ({ WhatsAppStickerPicker: () => <div>STUB: StickerPicker</div> }));
vi.mock("@/components/whatsapp/WhatsAppQuickReplies", () => ({
  // o <Textarea> do composer é passado como `anchor`: o stub o renderiza
  QuickRepliesInlinePopover: ({ anchor }: { anchor: React.ReactNode }) => <>{anchor}</>,
  QuickRepliesManagerButton: () => <button type="button">STUB: respostas rápidas</button>,
}));

import { WhatsAppChatInput } from "@/components/whatsapp/WhatsAppChatInput";
import { WhatsAppMessageBubble } from "@/components/whatsapp/WhatsAppMessageBubble";
import { READ_ONLY_COMPOSER_MESSAGE } from "@/lib/whatsapp/permissions";

describe("WhatsAppChatInput — readOnly (viewer)", () => {
  const props = { onSend: vi.fn(), workspaceId: "ws-1", contactName: "Maria", contactPhone: "5511999990000" };

  it("readOnly: no lugar do composer, o aviso 'Somente leitura' — sem campo de texto nem botões de envio", () => {
    render(<WhatsAppChatInput {...props} readOnly />);

    expect(screen.getByRole("status")).toHaveTextContent(READ_ONLY_COMPOSER_MESSAGE);
    expect(screen.getByRole("status")).toHaveTextContent("Somente leitura");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("sem readOnly (default / papel que atende): o composer de sempre, sem o aviso", () => {
    render(<WhatsAppChatInput {...props} />);

    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.queryByText(READ_ONLY_COMPOSER_MESSAGE)).not.toBeInTheDocument();
  });
});

describe("WhatsAppMessageBubble — readOnly (viewer)", () => {
  const base = {
    id: "m-1",
    direction: "outbound",
    type: "text",
    content: "Olá!",
    createdAt: "2026-10-02T12:00:00.000Z",
    workspaceId: "ws-1",
    onReply: vi.fn(),
    onDelete: vi.fn(),
    onForward: vi.fn(),
  };
  const ACTIONS = ["Reagir", "Responder", "Encaminhar", "Fixar", "Excluir"];

  it("sem readOnly: a barra de ações (reagir, responder, encaminhar, fixar, excluir) existe", () => {
    render(<WhatsAppMessageBubble {...base} />);

    for (const title of ACTIONS) expect(screen.getByTitle(title), title).toBeInTheDocument();
  });

  it("readOnly: nenhuma das 5 ações aparece — mas a mensagem continua legível", () => {
    render(<WhatsAppMessageBubble {...base} readOnly />);

    expect(screen.getByText("Olá!")).toBeInTheDocument();
    for (const title of ACTIONS) expect(screen.queryByTitle(title), title).not.toBeInTheDocument();
  });

  it("figurinha: a estrela 'Favoritar figurinha' existe para quem escreve e some no readOnly", () => {
    const sticker = { ...base, id: "m-2", type: "sticker", content: null, mediaUrl: "https://cdn.exemplo.com/figurinha.webp" };

    const { unmount } = render(
      <MemoryRouter>
        <WhatsAppMessageBubble {...sticker} />
      </MemoryRouter>,
    );
    expect(screen.getByTitle("Favoritar figurinha")).toBeInTheDocument();
    unmount();

    render(
      <MemoryRouter>
        <WhatsAppMessageBubble {...sticker} readOnly />
      </MemoryRouter>,
    );
    expect(screen.queryByTitle("Favoritar figurinha")).not.toBeInTheDocument();
    for (const title of ACTIONS) expect(screen.queryByTitle(title), title).not.toBeInTheDocument();
  });
});
