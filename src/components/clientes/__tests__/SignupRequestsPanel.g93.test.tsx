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
