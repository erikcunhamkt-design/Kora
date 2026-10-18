// G97 / M0 — a Biblioteca do cliente em fonte nuvem: adicionar item → "reload" →
// item presente; e o aviso descreve o que de fato acontece. HOOK REAL
// (useClientsDataSource → store local por uuid), uuid REAL; só a camada de
// dados da nuvem (useSupabaseClients/useClients) e a infra de UI são mockadas.
// Os testes de Clientes.test.tsx (G75) mockam o hook inteiro e por isso nunca
// provariam persistência.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";

import Clientes from "@/pages/Clientes";
import { useClients } from "@/hooks/useClients";
import { useSupabaseClients } from "@/hooks/useSupabaseClients";
import { useClientTypes } from "@/hooks/useClientTypes";
import { usePlan } from "@/contexts/plan-context-value";
import { useTranslation } from "@/contexts/language-context-value";
import { useSignupRequests } from "@/hooks/useSignupRequests";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useBifurcatedTechnicalSheet } from "@/hooks/useBifurcatedTechnicalSheet";
import { CLIENT_LIBRARY_LOCAL_STORE_KEY } from "@/services/clients/clientLibraryLocalStore";

// só useClients é mockado — as constantes/labels reais (CLIENT_ASSET_TYPE_LABELS…) ficam.
vi.mock("@/hooks/useClients", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useClients")>("@/hooks/useClients");
  return { ...actual, useClients: vi.fn() };
});
vi.mock("@/hooks/useSupabaseClients", () => ({ useSupabaseClients: vi.fn() }));
vi.mock("@/hooks/useBifurcatedTechnicalSheet", () => ({ useBifurcatedTechnicalSheet: vi.fn() }));
vi.mock("@/hooks/useClientTypes", () => ({ useClientTypes: vi.fn() }));
vi.mock("@/contexts/plan-context-value", () => ({ usePlan: vi.fn() }));
vi.mock("@/contexts/language-context-value", () => ({ useTranslation: vi.fn() }));
vi.mock("@/hooks/useSignupRequests", () => ({ useSignupRequests: vi.fn() }));
vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/components/clientes/SignupLinkDrawer", () => ({ SignupLinkDrawer: () => null }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

// Radix Dialog/Select/DropdownMenu abrem no pointerdown; jsdom não tem PointerEvent.
if (typeof window !== "undefined" && !("PointerEvent" in window)) {
  class PointerEventPolyfill extends MouseEvent {
    public pointerId: number;
    public pointerType: string;
    public isPrimary: boolean;
    constructor(type: string, params: MouseEventInit & { pointerId?: number; pointerType?: string; isPrimary?: boolean } = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
      this.pointerType = params.pointerType ?? "mouse";
      this.isPrimary = params.isPrimary ?? true;
    }
  }
  // @ts-expect-error — polyfill de teste
  window.PointerEvent = PointerEventPolyfill;
}
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});

const UUID = "87ebd1d2-b17a-46f4-b0eb-70beac445221";

// Linha crua como o repository devolve (mapSupabaseClientToLocalClient a transforma).
const cloudRow = {
  id: UUID, name: "Cliente Nuvem M0", company: "Empresa", email: "c@x.com", phone: "", whatsapp: "",
  status: "Ativo", archived: false, is_demo: false, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};

const supabaseUpdate = vi.fn().mockResolvedValue(cloudRow);

function setupMocks(localClients: unknown[] = []) {
  vi.mocked(useClients).mockReturnValue({
    clients: localClients, addClient: vi.fn(), updateClient: vi.fn(), archiveClient: vi.fn(),
    restoreClient: vi.fn(), deleteClient: vi.fn(),
  } as never);
  vi.mocked(useSupabaseClients).mockReturnValue({
    workspace: { id: "ws1" }, workspaceLoading: false, clients: [cloudRow], loading: false, error: null,
    addClient: vi.fn(), updateClient: supabaseUpdate, archiveClient: vi.fn(), deleteClient: vi.fn(),
    refreshClients: vi.fn(),
  } as never);
  vi.mocked(useClientTypes).mockReturnValue({ activeTypes: [] } as never);
  vi.mocked(usePlan).mockReturnValue({
    isPro: true, plan: "pro", limits: {}, usage: { clients: 0, projects: 0, tasks: 0, leads: 0 },
    wouldExceed: () => false, showPaywall: vi.fn(), setUsage: vi.fn(),
    paywallOpen: false, paywallResource: null, closePaywall: vi.fn(),
  } as never);
  vi.mocked(useTranslation).mockReturnValue({ t: (k: string) => k } as never);
  vi.mocked(useSignupRequests).mockReturnValue({ pendingCount: 0 } as never);
  vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: { id: "ws1" } } as never);
  vi.mocked(useBifurcatedTechnicalSheet).mockReturnValue({} as never);
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Clientes />
    </MemoryRouter>,
  );
}

async function addMaterial(title: string, url: string) {
  const triggers = await screen.findAllByRole("button", { name: /adicionar material/i });
  fireEvent.click(triggers[0]);
  const dialog = (await screen.findByText("Novo material")).closest('[role="dialog"]') as HTMLElement;
  fireEvent.change(within(dialog).getByLabelText("Nome do material *"), { target: { value: title } });

  const typeField = within(dialog).getByText("Tipo *").closest("div") as HTMLElement;
  fireEvent.click(typeField.querySelector('button[role="combobox"]') as HTMLElement);
  const listbox = await screen.findByRole("listbox");
  fireEvent.click(within(listbox).getByText("Google Drive"));

  fireEvent.change(within(dialog).getByLabelText("Link / URL *"), { target: { value: url } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Adicionar" }));
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  supabaseUpdate.mockResolvedValue(cloudRow);
});

describe("Clientes · G97/M0 — Biblioteca em fonte nuvem sobrevive ao reload (neste dispositivo)", () => {
  it("adicionar item → desmontar (reload) → remontar: o item está presente", async () => {
    setupMocks();
    const first = renderAt(`/clientes?client=${UUID}&tab=materials`);
    await addMaterial("HOMOLOG-MAT-item-1", "https://example.com/mat1");

    await waitFor(() => expect(localStorage.getItem(CLIENT_LIBRARY_LOCAL_STORE_KEY)).toContain("HOMOLOG-MAT-item-1"));
    expect(await screen.findByText("HOMOLOG-MAT-item-1")).toBeInTheDocument();

    first.unmount(); // "reload": nenhum estado React sobrevive, só o localStorage
    setupMocks();
    renderAt(`/clientes?client=${UUID}&tab=materials`);

    expect(await screen.findByText("HOMOLOG-MAT-item-1")).toBeInTheDocument();
  });

  it("grava por UUID do cliente da nuvem e NUNCA chama o UPDATE (patch vazio) — e o aviso descreve o comportamento real", async () => {
    setupMocks();
    renderAt(`/clientes?client=${UUID}&tab=materials`);

    await addMaterial("HOMOLOG-MAT-item-2", "https://example.com/mat2");

    await waitFor(() => expect(toast.warning).toHaveBeenCalledTimes(1));
    expect(vi.mocked(toast.warning).mock.calls[0][0]).toMatch(/salvo só neste dispositivo/);
    const stored = JSON.parse(localStorage.getItem(CLIENT_LIBRARY_LOCAL_STORE_KEY) as string);
    expect(Object.keys(stored)).toEqual([UUID]);
    expect(stored[UUID][0].title).toBe("HOMOLOG-MAT-item-2");
    expect(supabaseUpdate).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalledWith("Cliente atualizado no Supabase.");
  });

  it("fechar e REABRIR o cliente na mesma sessão mostra o item (a lista é recomposta após a escrita)", async () => {
    setupMocks();
    renderAt(`/clientes?client=${UUID}&tab=materials`);
    await addMaterial("HOMOLOG-MAT-item-3", "https://example.com/mat3");
    await screen.findByText("HOMOLOG-MAT-item-3");

    // fecha o drawer e reabre pelo link do deep link da própria lista
    const closeButtons = screen.getAllByRole("button", { name: /fechar|close/i });
    fireEvent.click(closeButtons[0]);
    fireEvent.click(await screen.findByText("Cliente Nuvem M0"));
    // Radix Tabs ativa no mousedown (jsdom: click não basta)
    fireEvent.mouseDown(await screen.findByRole("tab", { name: "Materiais" }));

    expect(await screen.findByText("HOMOLOG-MAT-item-3")).toBeInTheDocument();
  });

  it("cliente legado (local id 7 ↔ uuid no mapa) com Biblioteca antiga: ela aparece em fonte nuvem", async () => {
    localStorage.setItem("kora.clients.supabaseImport.v1", JSON.stringify({ importedMap: { "7": UUID } }));
    setupMocks([{
      id: 7, name: "Legado", company: "", email: "", phone: "", whatsapp: "", status: "Ativo",
      assets: [{ id: "old1", title: "HOMOLOG-MAT-antigo", type: "drive", url: "https://example.com/old", accessStatus: "liberado", createdAt: "", updatedAt: "" }],
    }]);

    renderAt(`/clientes?client=${UUID}&tab=materials`);

    expect(await screen.findByText("HOMOLOG-MAT-antigo")).toBeInTheDocument();
  });

  it("regressão: sem nenhum item, o estado vazio de sempre", async () => {
    setupMocks();
    renderAt(`/clientes?client=${UUID}&tab=materials`);

    expect(await screen.findByText("Nenhum material registrado para este cliente.")).toBeInTheDocument();
  });
});
