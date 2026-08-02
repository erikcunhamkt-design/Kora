// G22 (Fase B, dashboard-g22-fix) — "Gerar recebível" gravava só local; a
// reconciliação do dashboard Supabase nunca via essas linhas (docs/architecture/
// kora-hub-auditoria-e-plano.md). Fix: dual-write — local intacto (invariante
// "nunca refém da nuvem") + espelho best-effort via
// financeRepository.createReceivableFromQuote (já idempotente contra o UNIQUE
// PARCIAL ux_ft_receivable_from_quote, precedente P8b).
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { CreateReceivableDialog } from "@/components/crm/CreateReceivableDialog";
import { useFinance } from "@/hooks/useFinance";
import { financeRepository } from "@/repositories/financeRepository";
import { toast } from "sonner";

vi.mock("@/hooks/useFinance");
vi.mock("@/repositories/financeRepository");
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), message: vi.fn() },
}));

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  quoteTitle: "Identidade visual Acme",
  quoteTotal: 3500,
  workspaceId: "ws-1",
  quoteId: "quote-uuid-1",
  clientId: "client-uuid-1",
  opportunityId: "opp-uuid-1",
  onSuccess: vi.fn(),
};

describe("CreateReceivableDialog — G22 dual-write", () => {
  let addTransaction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    addTransaction = vi.fn(() => ({ id: "tx-local-1" }));
    vi.mocked(useFinance).mockReturnValue({ addTransaction } as never);
  });

  it("feliz: grava local E espelha na nuvem com os campos certos", async () => {
    vi.mocked(financeRepository.createReceivableFromQuote).mockResolvedValue({ id: "ft-1" } as never);
    const onSuccess = vi.fn();

    render(<CreateReceivableDialog {...baseProps} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByText("Confirmar e Gerar"));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    expect(addTransaction).toHaveBeenCalledTimes(1);
    expect(financeRepository.createReceivableFromQuote).toHaveBeenCalledTimes(1);
    expect(financeRepository.createReceivableFromQuote).toHaveBeenCalledWith(
      "ws-1",
      expect.objectContaining({
        quote_id: "quote-uuid-1",
        client_id: "client-uuid-1",
        opportunity_id: "opp-uuid-1",
        title: "Recebível - Identidade visual Acme",
        amount: 3500,
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Recebível financeiro gerado. Veja em Financeiro.");
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("nuvem falha: local persiste, sucesso ainda dispara, aviso extra de espelho pendente", async () => {
    vi.mocked(financeRepository.createReceivableFromQuote).mockRejectedValue(new Error("network down"));
    const onSuccess = vi.fn();

    render(<CreateReceivableDialog {...baseProps} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByText("Confirmar e Gerar"));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    // Local nunca é refém da nuvem: o lançamento local aconteceu mesmo com a nuvem falhando.
    expect(addTransaction).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("Recebível financeiro gerado. Veja em Financeiro.");
    expect(toast.warning).toHaveBeenCalledWith(
      "Recebível salvo localmente, mas o espelho no Supabase falhou.",
      expect.objectContaining({ description: expect.stringContaining("Configurações") }),
    );
  });

  it("idempotência: 2ª geração para a mesma quote passa pelo mesmo caminho idempotente do repository", async () => {
    // O repository (financeRepository.createReceivableFromQuote) já garante, via
    // catch(23505)+re-consulta, que a 2ª chamada para o mesmo quote_id nunca duplica —
    // testado isoladamente em financeRepository.test.ts. Aqui só provamos que o diálogo
    // SEMPRE invoca esse mesmo caminho (nunca um upsert próprio nem um caminho alternativo),
    // com o mesmo quote_id, em toda geração.
    vi.mocked(financeRepository.createReceivableFromQuote).mockResolvedValue({ id: "ft-existente" } as never);
    const onSuccess = vi.fn();

    const { unmount } = render(<CreateReceivableDialog {...baseProps} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByText("Confirmar e Gerar"));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    unmount();

    render(<CreateReceivableDialog {...baseProps} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByText("Confirmar e Gerar"));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(2));

    expect(financeRepository.createReceivableFromQuote).toHaveBeenCalledTimes(2);
    const [firstCall, secondCall] = vi.mocked(financeRepository.createReceivableFromQuote).mock.calls;
    expect(firstCall[1]).toMatchObject({ quote_id: "quote-uuid-1" });
    expect(secondCall[1]).toMatchObject({ quote_id: "quote-uuid-1" });
  });
});
