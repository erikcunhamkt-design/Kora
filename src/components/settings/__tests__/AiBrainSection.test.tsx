// Etapa 9 · item 2 — prova: (1) UI gated pela flag kora.ai.brain.enabled
// (default OFF, só o interruptor aparece); (2) ligar carrega o perfil via
// repository; (3) salvar chama upsert com os 5 campos; (4) copy de guarda
// R2 (duplicação cérebro/instrução) e R5 do item 3 (sem dado pessoal)
// presente na tela quando o formulário está visível; (5) soft-cap avisa
// sem bloquear salvar.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { toast } from "sonner";

import { AiBrainSection } from "@/components/settings/AiBrainSection";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { aiBrainRepository } from "@/repositories/aiBrainRepository";

vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/repositories/aiBrainRepository", () => ({
  aiBrainRepository: { getByWorkspace: vi.fn(), upsert: vi.fn() },
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  (useCurrentWorkspace as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    workspace: { id: "ws1" },
  });
  (aiBrainRepository.getByWorkspace as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
});

describe("AiBrainSection · gate da flag (kora.ai.brain.enabled, default OFF)", () => {
  it("flag OFF por padrão: só o interruptor aparece, sem formulário, sem chamada ao repository", () => {
    render(<AiBrainSection />);
    expect(screen.getByText("Ativar cérebro do robô")).toBeInTheDocument();
    expect(screen.queryByText("Tom de voz")).not.toBeInTheDocument();
    expect(aiBrainRepository.getByWorkspace).not.toHaveBeenCalled();
  });

  it("ligar o interruptor mostra o formulário e busca o perfil do workspace", async () => {
    render(<AiBrainSection />);
    fireEvent.click(screen.getByRole("switch", { name: "Ativar cérebro do robô" }));

    await waitFor(() => expect(aiBrainRepository.getByWorkspace).toHaveBeenCalledWith("ws1"));
    expect(await screen.findByText("Tom de voz")).toBeInTheDocument();
  });

  it("perfil já salvo popula os campos ao ligar", async () => {
    (aiBrainRepository.getByWorkspace as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "p1",
      workspace_id: "ws1",
      tone: "formal e direto",
      talk_about: null,
      dont_talk_about: null,
      products_services: null,
      limits: null,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    });
    render(<AiBrainSection />);
    fireEvent.click(screen.getByRole("switch", { name: "Ativar cérebro do robô" }));

    const toneInput = await screen.findByPlaceholderText("Ex.: formal e direto / descontraído, usa emoji");
    await waitFor(() => expect(toneInput).toHaveValue("formal e direto"));
  });
});

describe("AiBrainSection · salvar", () => {
  it("chama upsert com os 5 campos e mostra toast de sucesso", async () => {
    (aiBrainRepository.upsert as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    render(<AiBrainSection />);
    fireEvent.click(screen.getByRole("switch", { name: "Ativar cérebro do robô" }));

    const toneInput = await screen.findByPlaceholderText("Ex.: formal e direto / descontraído, usa emoji");
    fireEvent.change(toneInput, { target: { value: "descontraído" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));

    await waitFor(() =>
      expect(aiBrainRepository.upsert).toHaveBeenCalledWith("ws1", {
        tone: "descontraído",
        talk_about: "",
        dont_talk_about: "",
        products_services: "",
        limits: "",
      }),
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it("erro no upsert mostra toast de erro, não quebra a tela", async () => {
    (aiBrainRepository.upsert as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("boom"));
    render(<AiBrainSection />);
    fireEvent.click(screen.getByRole("switch", { name: "Ativar cérebro do robô" }));
    await screen.findByText("Tom de voz");
    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});

describe("AiBrainSection · guardas R2/R5", () => {
  it("mostra o aviso de não duplicar instrução nem incluir dado pessoal", async () => {
    render(<AiBrainSection />);
    fireEvent.click(screen.getByRole("switch", { name: "Ativar cérebro do robô" }));
    await screen.findByText("Tom de voz");

    expect(screen.getByText(/Instruções de Personalidade.*fluxo — evita duplicação/)).toBeInTheDocument();
    expect(screen.getByText(/nunca inclua dado de um cliente específico/)).toBeInTheDocument();
  });
});

describe("AiBrainSection · soft-cap (§3.3, aviso, nunca bloqueio)", () => {
  it("abaixo do soft-cap: sem aviso, botão de salvar habilitado", async () => {
    render(<AiBrainSection />);
    fireEvent.click(screen.getByRole("switch", { name: "Ativar cérebro do robô" }));
    await screen.findByText("Tom de voz");

    expect(screen.getByText("0 / 2000 caracteres")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar/ })).not.toBeDisabled();
  });

  it("acima do soft-cap: aviso aparece, botão de salvar continua habilitado (nunca bloqueia)", async () => {
    render(<AiBrainSection />);
    fireEvent.click(screen.getByRole("switch", { name: "Ativar cérebro do robô" }));
    const toneInput = await screen.findByPlaceholderText("Ex.: formal e direto / descontraído, usa emoji");

    fireEvent.change(toneInput, { target: { value: "x".repeat(2001) } });

    expect(screen.getByText(/2001 \/ 2000 caracteres/)).toBeInTheDocument();
    expect(screen.getByText(/acima do recomendado.*não bloqueia salvar/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar/ })).not.toBeDisabled();
  });
});
