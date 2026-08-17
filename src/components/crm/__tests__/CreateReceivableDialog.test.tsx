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
    // G70 — mock precisa devolver o MESMO title enviado (comportamento real de
    // um insert sem colisão); sem isso a checagem nova (mirrored.title !==
    // title) dispararia o aviso de colisão falsamente neste teste.
    vi.mocked(financeRepository.createReceivableFromQuote).mockResolvedValue({
      id: "ft-1",
      title: "Recebível - Identidade visual Acme",
    } as never);
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
    // com o mesmo quote_id, em toda geração. Título batendo com o enviado em ambas as
    // chamadas — cenário SEM colisão (a checagem de colisão em si é o describe "G70" abaixo).
    vi.mocked(financeRepository.createReceivableFromQuote).mockResolvedValue({
      id: "ft-existente",
      title: "Recebível - Identidade visual Acme",
    } as never);
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

// G41 — divergência de campo entre os 2 diálogos de "gerar recebível" (QuoteToReceivableDialog,
// Vendas, grava quoteId no lançamento LOCAL; CreateReceivableDialog, CRM, recebe quoteId como
// prop — usado só no espelho nuvem — e nunca grava no lançamento local). Mesmo tipo
// (Transaction.quoteId: string), mesmo padrão de pass-through já usado no outro diálogo — sem
// tradução de espaço de id envolvida (diferente de clientId/opportunityId, catalogados sem fix).
describe("CreateReceivableDialog — G41 (quoteId ausente no lançamento local)", () => {
  it("addTransaction (local) recebe quoteId, alinhado ao mesmo campo que QuoteToReceivableDialog já grava", async () => {
    const addTransaction = vi.fn(() => ({ id: "tx-local-1" }));
    vi.mocked(useFinance).mockReturnValue({ addTransaction } as never);
    vi.mocked(financeRepository.createReceivableFromQuote).mockResolvedValue({
      id: "ft-1",
      title: "Recebível - Identidade visual Acme",
    } as never);
    const onSuccess = vi.fn();

    render(<CreateReceivableDialog {...baseProps} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByText("Confirmar e Gerar"));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    expect(addTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ quoteId: "quote-uuid-1" }),
    );
  });
});

// G70 — gap de escopo do G56: o fix original (QuoteToReceivableDialog.tsx,
// Vendas) comparou o title devolvido pelo mirror contra o enviado pra
// detectar "devolveu a linha de outro recebível" (ux_ft_receivable_from_quote,
// no máximo 1 recebível vivo por quote_id) — mas o produtor gêmeo deste
// arquivo (CreateReceivableDialog.tsx, CRM, disparado por
// LinkedQuotesSection.tsx:248-255 "Gerar recebível") nunca ganhou a mesma
// checagem. Um 2º clique aqui pra um orçamento que já tem recebível (gerado
// antes via Vendas, ou até um 2º clique aqui mesmo) devolvia a linha
// existente em silêncio, sem aviso — mesmo sintoma do G56, produtor
// diferente.
describe("CreateReceivableDialog — G70 (colisão silenciosa, mesma proteção do G56)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    const addTransaction = vi.fn(() => ({ id: "tx-local-1" }));
    vi.mocked(useFinance).mockReturnValue({ addTransaction } as never);
  });

  it("colisão: título devolvido diverge do enviado → dispara toast.warning (mesmo texto do G56)", async () => {
    // Simula o cenário real do achado: o orçamento já tem um recebível vivo
    // na nuvem (gerado antes via QuoteToReceivableDialog, com um título de
    // formato diferente) — createReceivableFromQuote devolve essa linha
    // EXISTENTE em vez de criar uma nova (mesmo comportamento idempotente
    // que já protege contra duplicata no banco, ux_ft_receivable_from_quote).
    vi.mocked(financeRepository.createReceivableFromQuote).mockResolvedValue({
      id: "ft-existente-do-vendas",
      title: "Orçamento aprovado — Identidade visual Acme",
    } as never);
    const onSuccess = vi.fn();

    render(<CreateReceivableDialog {...baseProps} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByText("Confirmar e Gerar"));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    // Nenhuma linha nova: createReceivableFromQuote foi chamado 1 única vez
    // (o repository, não este teste, é quem garante idempotência no banco —
    // aqui só provamos que o diálogo não tenta nenhum caminho alternativo).
    expect(financeRepository.createReceivableFromQuote).toHaveBeenCalledTimes(1);
    expect(toast.warning).toHaveBeenCalledWith(
      "Este orçamento já tem uma conta a receber na nuvem — categoria e forma de pagamento escolhidas aqui ficaram só no local.",
      expect.objectContaining({ description: expect.stringContaining("Financeiro") }),
    );
    // Sucesso local continua dispensando o aviso de colisão — local é
    // sempre autoritativo, o aviso é só sobre a nuvem.
    expect(toast.success).toHaveBeenCalledWith("Recebível financeiro gerado. Veja em Financeiro.");
  });

  it("regressão: sem colisão (título devolvido bate com o enviado) → NÃO dispara o aviso novo", async () => {
    vi.mocked(financeRepository.createReceivableFromQuote).mockResolvedValue({
      id: "ft-novo",
      title: "Recebível - Identidade visual Acme",
    } as never);
    const onSuccess = vi.fn();

    render(<CreateReceivableDialog {...baseProps} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByText("Confirmar e Gerar"));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    expect(toast.warning).not.toHaveBeenCalled();
  });
});
