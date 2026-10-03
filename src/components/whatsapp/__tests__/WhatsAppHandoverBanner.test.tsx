// Etapa 9 · Item 4, R4 (UI de Atendimento) — indicador "entregue a humano" +
// ação "Devolver ao robô" (banner do cabeçalho) e badge na lista de conversas.
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { WhatsAppHandoverBanner } from "@/components/whatsapp/WhatsAppHandoverBanner";
import { WhatsAppConversationItem, type WAConvLike } from "@/components/whatsapp/WhatsAppConversationItem";

describe("WhatsAppHandoverBanner", () => {
  it("handedOverAt preenchido -> mostra o indicador e o botão 'Devolver ao robô'", () => {
    render(<WhatsAppHandoverBanner handedOverAt="2026-10-02T12:00:00.000Z" returning={false} onReturn={vi.fn()} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/Entregue a atendimento humano/)).toBeInTheDocument();
    expect(screen.getByText(/o robô está em silêncio nesta conversa/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Devolver ao robô/ })).toBeEnabled();
  });

  it("handedOverAt null (não entregue OU coluna ausente) -> não renderiza nada", () => {
    const { container } = render(<WhatsAppHandoverBanner handedOverAt={null} returning={false} onReturn={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Devolver ao robô/ })).not.toBeInTheDocument();
  });

  it("clicar em 'Devolver ao robô' dispara onReturn", () => {
    const onReturn = vi.fn();
    render(<WhatsAppHandoverBanner handedOverAt="2026-10-02T12:00:00.000Z" returning={false} onReturn={onReturn} />);

    fireEvent.click(screen.getByRole("button", { name: /Devolver ao robô/ }));

    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it("returning=true -> botão desabilitado (sem duplo clique enquanto a ação roda)", () => {
    const onReturn = vi.fn();
    render(<WhatsAppHandoverBanner handedOverAt="2026-10-02T12:00:00.000Z" returning={true} onReturn={onReturn} />);

    const btn = screen.getByRole("button", { name: /Devolver ao robô/ });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onReturn).not.toHaveBeenCalled();
  });
});

describe("WhatsAppConversationItem — badge 'Humano'", () => {
  const base: WAConvLike = {
    id: "c1", contact_name: "Maria", contact_phone: "5511999990000", avatar_url: null,
    last_message: "oi", last_message_at: "2026-10-02T12:00:00.000Z", unread_count: 0,
  };

  it("conversa com handover_at -> mostra o badge 'Humano'", () => {
    render(<WhatsAppConversationItem conversation={{ ...base, handover_at: "2026-10-02T12:00:00.000Z" }} active={false} onClick={vi.fn()} />);

    expect(screen.getByText("Humano")).toBeInTheDocument();
  });

  it("conversa SEM handover_at (null ou coluna ausente) -> sem badge, item renderiza normal", () => {
    const { rerender } = render(<WhatsAppConversationItem conversation={{ ...base, handover_at: null }} active={false} onClick={vi.fn()} />);
    expect(screen.queryByText("Humano")).not.toBeInTheDocument();
    expect(screen.getByText("Maria")).toBeInTheDocument();

    // Coluna ausente: a linha real não traz o campo nenhum.
    rerender(<WhatsAppConversationItem conversation={base} active={false} onClick={vi.fn()} />);
    expect(screen.queryByText("Humano")).not.toBeInTheDocument();
    expect(screen.getByText("Maria")).toBeInTheDocument();
  });
});
