// Etapa 9 · item 4 (R4) — acabamento de Atendimento: o painel de contato mostra o
// estado "entregue a humano desde…" (hoje só o cabeçalho da conversa e a lista
// mostravam). Leitura por `unknown` na página (getHandoverAt) -> aqui o painel só
// recebe `handoverAt: string | null`; ausente/null = nada aparece.
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Qualquer cadeia do query builder do supabase resolve vazio — o painel faz vários
// SELECTs ao montar (membros, notas, cliente...) e nenhum é o alvo destes testes.
vi.mock("@/integrations/supabase/client", () => {
  const makeChain = () => {
    let last = "";
    const proxy: unknown = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") {
            return (resolve: (v: unknown) => void) =>
              resolve({ data: last === "maybeSingle" || last === "single" ? null : [], error: null });
          }
          return () => {
            last = prop;
            return proxy;
          };
        },
      },
    );
    return proxy;
  };
  return { supabase: { from: () => makeChain(), functions: { invoke: vi.fn() }, auth: { getUser: vi.fn() } } };
});
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { WhatsAppContactPanel, type WhatsAppContactPanelProps } from "@/components/whatsapp/WhatsAppContactPanel";

beforeEach(() => {
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
});

function renderPanel(overrides: Partial<WhatsAppContactPanelProps> = {}) {
  return render(
    <MemoryRouter>
      <WhatsAppContactPanel
        conversationId="conv-1"
        workspaceId="ws-1"
        contactName="Maria Cliente"
        contactPhone="5511999990000"
        status="open"
        {...overrides}
      />
    </MemoryRouter>,
  );
}

const state = () => screen.queryByRole("status", { name: "Estado do atendimento" });

describe("WhatsAppContactPanel — estado 'entregue a humano'", () => {
  it("handoverAt preenchido: mostra 'Entregue a atendimento humano desde…' e que o robô está em silêncio", () => {
    renderPanel({ handoverAt: "2026-10-02T12:00:00.000Z" });

    const box = state();
    expect(box).toBeInTheDocument();
    expect(box).toHaveTextContent("Entregue a atendimento humano");
    expect(box).toHaveTextContent(/desde \d{2}\/\d{2}/);
    expect(box).toHaveTextContent("o robô está em silêncio nesta conversa");
  });

  it("DEGRADAÇÃO — handoverAt null ou ausente (coluna handover_at inexistente): nada aparece e o painel segue normal", () => {
    for (const handoverAt of [null, undefined]) {
      const { unmount } = renderPanel({ handoverAt });
      expect(state()).not.toBeInTheDocument();
      expect(screen.getByText("Maria Cliente")).toBeInTheDocument();
      unmount();
    }
  });

  it("independe da atribuição (G48): atribuída mas NÃO entregue = sem estado; entregue sem atribuição = com estado", () => {
    const { unmount } = renderPanel({ assignedTo: "user-1", handoverAt: null });
    expect(state()).not.toBeInTheDocument();
    unmount();

    renderPanel({ assignedTo: null, handoverAt: "2026-10-02T12:00:00.000Z" });
    expect(state()).toBeInTheDocument();
  });

  it("não remove nada do painel: contato, telefone e status continuam visíveis junto do estado", () => {
    renderPanel({ handoverAt: "2026-10-02T12:00:00.000Z" });

    expect(screen.getByText("Maria Cliente")).toBeInTheDocument();
    expect(screen.getByText("5511999990000")).toBeInTheDocument();
    expect(state()).toBeInTheDocument();
  });
});
