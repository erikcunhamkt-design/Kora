// G93 — o painel chamava `onConvertLead(req)` sem aguardar e confirmava "convertido em lead no CRM"
// e o status "lead" mesmo quando a criação da oportunidade falhava (ou ia só pro armazenamento
// local). Contrato novo: `onConvertLead` devolve `false` quando NÃO criou — o painel não muda
// o status nem confirma sucesso.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { toast } from "sonner";

import { SignupRequestsPanel } from "@/components/clientes/SignupRequestsPanel";
import { useSignupRequests } from "@/hooks/useSignupRequests";

vi.mock("@/hooks/useSignupRequests", () => ({ useSignupRequests: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

const REQ = {
  id: "11111111-2222-4333-8444-555555555555",
  name: "Solicitante Real",
  company: "Empresa S",
  email: "solicitante@teste.com",
  phone: "11977776666",
  project_interest: "Branding",
  message: "Quero um orçamento",
  status: "pending",
  created_at: "2026-10-01T00:00:00Z",
};

const updateStatus = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  updateStatus.mockResolvedValue(true);
  vi.mocked(useSignupRequests).mockReturnValue({
    requests: [REQ], loading: false, updateStatus, deleteRequest: vi.fn(), refresh: vi.fn(),
  } as never);
});

async function clickConvertLead() {
  const button = await screen.findByRole("button", { name: /lead|oportunidade/i });
  fireEvent.click(button);
}

describe("SignupRequestsPanel · G93 — não confirma conversão quando a oportunidade não foi criada", () => {
  it("onConvertLead devolve false: status NÃO muda e nenhum toast de sucesso", async () => {
    const onConvertLead = vi.fn().mockResolvedValue(false);
    render(<SignupRequestsPanel onConvertLead={onConvertLead} />);

    await clickConvertLead();

    await waitFor(() => expect(onConvertLead).toHaveBeenCalledTimes(1));
    expect(updateStatus).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("onConvertLead devolve true: aguarda, muda o status pra \"lead\" e confirma", async () => {
    const onConvertLead = vi.fn().mockResolvedValue(true);
    render(<SignupRequestsPanel onConvertLead={onConvertLead} />);

    await clickConvertLead();

    await waitFor(() => expect(updateStatus).toHaveBeenCalledWith(REQ.id, "lead"));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("convertido em lead no CRM"));
  });
});

// G99 — "Aprovar como cliente" chamava `onApproveAsClient(req)` sem aguardar e confirmava
// "aprovado como cliente" + status "approved" mesmo com o paywall barrando ou a criação falhando.
// Contrato: `false` ⇒ não muda o status nem confirma; duplo clique guardado; falha de status
// DEPOIS de criar diz a verdade (o cliente existe).
describe("SignupRequestsPanel · G99 — aprovar como cliente só confirma se o cliente foi criado", () => {
  async function clickApprove() {
    fireEvent.click(await screen.findByRole("button", { name: /aprovar|cliente/i }));
  }

  it("onApproveAsClient devolve false (paywall/erro): status NÃO muda e nenhum toast de sucesso", async () => {
    const onApproveAsClient = vi.fn().mockResolvedValue(false);
    render(<SignupRequestsPanel onApproveAsClient={onApproveAsClient} />);

    await clickApprove();

    await waitFor(() => expect(onApproveAsClient).toHaveBeenCalledTimes(1));
    expect(updateStatus).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("onApproveAsClient devolve true: aguarda, muda o status pra \"approved\" e confirma", async () => {
    const onApproveAsClient = vi.fn().mockResolvedValue(true);
    render(<SignupRequestsPanel onApproveAsClient={onApproveAsClient} />);

    await clickApprove();

    await waitFor(() => expect(updateStatus).toHaveBeenCalledWith(REQ.id, "approved"));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("aprovado como cliente"));
  });

  it("duplo clique durante a criação: um único cliente (o 2º clique é ignorado)", async () => {
    let release: (v: boolean) => void = () => {};
    const pending = new Promise<boolean>((resolve) => { release = resolve; });
    const onApproveAsClient = vi.fn().mockReturnValue(pending);
    render(<SignupRequestsPanel onApproveAsClient={onApproveAsClient} />);

    const button = await screen.findByRole("button", { name: /aprovar|cliente/i });
    fireEvent.click(button);
    fireEvent.click(button);
    release(true);

    await waitFor(() => expect(updateStatus).toHaveBeenCalledTimes(1));
    expect(onApproveAsClient).toHaveBeenCalledTimes(1);
  });

  it("cliente criado mas o status falhou: o erro diz a verdade (o cliente existe), nunca \"Falha ao aprovar\" seco", async () => {
    updateStatus.mockResolvedValue(false);
    render(<SignupRequestsPanel onApproveAsClient={vi.fn().mockResolvedValue(true)} />);

    await clickApprove();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("O cliente foi criado")));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("arquivar com falha: erro (antes: silêncio)", async () => {
    updateStatus.mockResolvedValue(false);
    render(<SignupRequestsPanel />);

    fireEvent.click(await screen.findByRole("button", { name: /arquivar/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Falha ao arquivar a solicitação."));
    expect(toast.success).not.toHaveBeenCalled();
  });
});
