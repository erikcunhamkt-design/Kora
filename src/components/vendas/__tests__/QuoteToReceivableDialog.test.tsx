// Etapa 5 · Financeiro Fase B (Pacote do Flip, §5.1 do desenho) — resolve o
// gap real que sobrou do G41 (kora-hub-auditoria-e-plano.md): este diálogo
// só gravava local, sem mirror nenhum. Prova o mesmo padrão G22 já usado em
// CreateReceivableDialog.tsx (CRM): local sempre autoritativo e grava
// primeiro, espelho best-effort depois, nunca bloqueia nem desfaz o local.
// "Payload completo desde o dia 1" (G37): category/paymentMethod (só este
// diálogo tem, escolhidos pelo usuário) viajam no mirror.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { toast } from "sonner";

import { QuoteToReceivableDialog } from "@/components/vendas/QuoteToReceivableDialog";
import { useFinance } from "@/hooks/useFinance";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { financeRepository } from "@/repositories/financeRepository";
import type { Quote } from "@/hooks/useQuotes";

vi.mock("@/hooks/useFinance", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useFinance")>("@/hooks/useFinance");
  return { ...actual, useFinance: vi.fn() };
});
vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/repositories/financeRepository", () => ({
  financeRepository: { createReceivableFromQuote: vi.fn() },
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}));

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: "quote-1", clientName: "Acme Corp", clientEmail: "", clientWhatsapp: "",
    title: "Rebranding", description: "", items: [],
    subtotal: 1000, discount: 0, total: 1000, paymentCondition: "",
    deliveryDeadline: "", validityDays: 15, status: "aprovado",
    createdAt: "2026-08-01",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: { id: "ws1" } } as never);
  vi.mocked(useFinance).mockReturnValue({
    addTransaction: vi.fn().mockReturnValue({ id: "tx-local-1" }),
    categories: [{ id: "c1", name: "Serviços", type: "income" }],
  } as never);
});

function renderDialog(quote: Quote) {
  return render(
    <QuoteToReceivableDialog quote={quote} open onOpenChange={() => {}} onGenerated={() => {}} />,
  );
}

describe("QuoteToReceivableDialog · espelho G22 (Fase B, §5.1) — gap real do G41 fechado", () => {
  it("grava local sempre (addTransaction), independente do espelho", async () => {
    const addTransaction = vi.fn().mockReturnValue({ id: "tx-local-1" });
    vi.mocked(useFinance).mockReturnValue({
      addTransaction, categories: [{ id: "c1", name: "Serviços", type: "income" }],
    } as never);
    // Eco do que foi enviado (mesmo comportamento de um INSERT + .select().single()
    // real, sem colisão) — evita falso positivo do aviso de colisão do G56
    // (que compara o title devolvido contra o enviado) nos testes que não são
    // sobre colisão.
    vi.mocked(financeRepository.createReceivableFromQuote).mockImplementation(
      async (_ws, input) => ({ id: "ft-1", ...input }) as never,
    );

    renderDialog(makeQuote());
    fireEvent.click(screen.getByRole("button", { name: "Gerar conta a receber" }));

    expect(addTransaction).toHaveBeenCalledWith(expect.objectContaining({ quoteId: "quote-1", source: "quote" }));
  });

  it("espelha na nuvem com payload completo — quote_id, client/opportunity resolvidos, category e payment_method (só este diálogo tem)", async () => {
    // Eco do que foi enviado (mesmo comportamento de um INSERT + .select().single()
    // real, sem colisão) — evita falso positivo do aviso de colisão do G56
    // (que compara o title devolvido contra o enviado) nos testes que não são
    // sobre colisão.
    vi.mocked(financeRepository.createReceivableFromQuote).mockImplementation(
      async (_ws, input) => ({ id: "ft-1", ...input }) as never,
    );

    renderDialog(makeQuote({ clientId: 42, opportunityId: 7 }));
    fireEvent.click(screen.getByRole("button", { name: "Gerar conta a receber" }));

    await waitFor(() => expect(financeRepository.createReceivableFromQuote).toHaveBeenCalledWith(
      "ws1",
      expect.objectContaining({
        quote_id: "quote-1",
        title: expect.stringContaining("Orçamento aprovado"),
        amount: 1000,
        category: "Serviços",
        payment_method: "pix",
      }),
    ));

    // Revisão Lane E (AJUSTE-a) — objectContaining sozinho não prova
    // ausência (uma chave presente com valor undefined ainda passa nele).
    // `notes` é preenchido no formulário deste diálogo mas NUNCA viaja no
    // espelho (sem coluna cloud, §1.2 do desenho) — checa a ausência real
    // no argumento que realmente chegou na chamada, não um subconjunto.
    const mirrorPayload = vi.mocked(financeRepository.createReceivableFromQuote).mock.calls[0][1];
    expect(mirrorPayload).not.toHaveProperty("notes");
    expect(mirrorPayload).not.toHaveProperty("recurrence");
    expect(mirrorPayload).not.toHaveProperty("supplierId");
    expect(mirrorPayload).not.toHaveProperty("cashAccountId");
  });

  it("client_id/opportunity_id já sendo uuid real (quote lida da nuvem) passam direto — G37 por desenho, §2.2", async () => {
    // Eco do que foi enviado (mesmo comportamento de um INSERT + .select().single()
    // real, sem colisão) — evita falso positivo do aviso de colisão do G56
    // (que compara o title devolvido contra o enviado) nos testes que não são
    // sobre colisão.
    vi.mocked(financeRepository.createReceivableFromQuote).mockImplementation(
      async (_ws, input) => ({ id: "ft-1", ...input }) as never,
    );
    const clientUuid = "a1b2c3d4-e5f6-4789-a012-b3c4d5e6f789";

    renderDialog(makeQuote({ clientId: clientUuid as unknown as number }));
    fireEvent.click(screen.getByRole("button", { name: "Gerar conta a receber" }));

    await waitFor(() => expect(financeRepository.createReceivableFromQuote).toHaveBeenCalledWith(
      "ws1", expect.objectContaining({ client_id: clientUuid }),
    ));
  });

  it("client_id local sem import-map disponível resolve null — nunca id local cru numa coluna uuid (padrão Q4)", async () => {
    // Eco do que foi enviado (mesmo comportamento de um INSERT + .select().single()
    // real, sem colisão) — evita falso positivo do aviso de colisão do G56
    // (que compara o title devolvido contra o enviado) nos testes que não são
    // sobre colisão.
    vi.mocked(financeRepository.createReceivableFromQuote).mockImplementation(
      async (_ws, input) => ({ id: "ft-1", ...input }) as never,
    );

    renderDialog(makeQuote({ clientId: 999 }));
    fireEvent.click(screen.getByRole("button", { name: "Gerar conta a receber" }));

    await waitFor(() => expect(financeRepository.createReceivableFromQuote).toHaveBeenCalledWith(
      "ws1", expect.objectContaining({ client_id: null }),
    ));
  });

  it("falha do espelho NUNCA desfaz o local — toast de aviso, não de erro bloqueante", async () => {
    vi.mocked(financeRepository.createReceivableFromQuote).mockRejectedValue(new Error("network down"));

    renderDialog(makeQuote());
    fireEvent.click(screen.getByRole("button", { name: "Gerar conta a receber" }));

    expect(toast.success).toHaveBeenCalledWith("Conta a receber gerada", expect.anything());
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(
      expect.stringContaining("espelho no Supabase falhou"), expect.anything(),
    ));
  });

  // G56 — achado ao vivo (Fase D, Caso 4.3, 2º round): quando o MESMO orçamento
  // já tem um recebível vivo na nuvem (ex.: gerado antes por
  // CreateReceivableDialog.tsx no CRM, Caso 4.2), `createReceivableFromQuote`
  // recupera do 23505 (`ux_ft_receivable_from_quote`) devolvendo a linha JÁ
  // EXISTENTE — sem lançar erro, sem indicar nada de diferente pro chamador.
  // Sem essa detecção, o toast de sucesso é IDÊNTICO a um espelho genuíno —
  // category/payment_method escolhidos nesta tela somem silenciosamente.
  it("espelho colide com um recebível já existente pra este orçamento — avisa que category/payment_method NÃO chegaram na nuvem (G56)", async () => {
    // Simula createReceivableFromQuote recuperando do 23505 e devolvendo a
    // linha existente (title diferente do que esta tela tentou enviar —
    // fingerprint da colisão, já que um INSERT genuíno sempre ecoa o title
    // enviado).
    vi.mocked(financeRepository.createReceivableFromQuote).mockResolvedValue({
      id: "ft-existing", title: "HOMOLOG-FIN-transacao-B",
    } as never);

    renderDialog(makeQuote());
    fireEvent.click(screen.getByRole("button", { name: "Gerar conta a receber" }));

    expect(toast.success).toHaveBeenCalledWith("Conta a receber gerada", expect.anything());
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(
      expect.stringContaining("já tem uma conta a receber na nuvem"), expect.anything(),
    ));
  });

  it("espelho SEM colisão (title devolvido bate com o enviado) NÃO dispara o aviso de colisão", async () => {
    vi.mocked(financeRepository.createReceivableFromQuote).mockImplementation(
      async (_ws, input) => ({ id: "ft-1", ...input }) as never,
    );

    renderDialog(makeQuote());
    fireEvent.click(screen.getByRole("button", { name: "Gerar conta a receber" }));

    await waitFor(() => expect(financeRepository.createReceivableFromQuote).toHaveBeenCalled());
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("sem workspace ativo, não tenta espelhar (mas o local grava normalmente)", async () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: null } as never);
    const addTransaction = vi.fn().mockReturnValue({ id: "tx-local-1" });
    vi.mocked(useFinance).mockReturnValue({
      addTransaction, categories: [{ id: "c1", name: "Serviços", type: "income" }],
    } as never);

    renderDialog(makeQuote());
    fireEvent.click(screen.getByRole("button", { name: "Gerar conta a receber" }));

    expect(addTransaction).toHaveBeenCalled();
    expect(financeRepository.createReceivableFromQuote).not.toHaveBeenCalled();
  });
});
