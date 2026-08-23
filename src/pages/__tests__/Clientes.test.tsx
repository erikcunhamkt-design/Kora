// G75 (docs/qa/etapa-5-flip-materiais-pacote.md) — "Biblioteca do cliente"
// (Client.assets) nunca teve coluna cloud; Clientes.tsx:updateClient
// montava o patch pra Supabase copiando campo por campo de uma lista
// explícita que nunca incluía `assets` — em modo Supabase, adicionar um
// material virava um UPDATE vazio seguido de toast.success("Cliente
// atualizado no Supabase."), uma confirmação falsa (nada foi de fato
// gravado, o material some no próximo refetch). Fix: nunca bloqueia,
// mas troca o toast.success enganoso por um toast.warning explícito
// quando a mudança é só de `assets`.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";

import Clientes from "@/pages/Clientes";
import { useClientsDataSource } from "@/hooks/useClientsDataSource";
import { useClientTypes } from "@/hooks/useClientTypes";
import { usePlan } from "@/contexts/plan-context-value";
import { useTranslation } from "@/contexts/language-context-value";
import { useSignupRequests } from "@/hooks/useSignupRequests";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import type { Client } from "@/types/domain";

vi.mock("@/hooks/useClientsDataSource", () => ({ useClientsDataSource: vi.fn() }));
vi.mock("@/hooks/useClientTypes", () => ({ useClientTypes: vi.fn() }));
vi.mock("@/contexts/plan-context-value", () => ({ usePlan: vi.fn() }));
vi.mock("@/contexts/language-context-value", () => ({ useTranslation: vi.fn() }));
vi.mock("@/hooks/useSignupRequests", () => ({ useSignupRequests: vi.fn() }));
// ClientProfileDrawer (renderizado como filho ao abrir um cliente) chama
// useCurrentWorkspace() no corpo principal, independente de qual aba está
// ativa — sem mock, useAuth() (de dentro do hook) quebra por falta de
// AuthProvider na árvore de teste.
vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
// SignupLinkDrawer é montado sempre (não condicionado à aba ativa) e chama
// useAuth() internamente — sem AuthProvider real na árvore de teste, quebra
// o render inteiro. Sem relação com o achado G75, só ruído de infra.
vi.mock("@/components/clientes/SignupLinkDrawer", () => ({ SignupLinkDrawer: () => null }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

// Radix Dialog/Select/DropdownMenu (v2) abrem no `pointerdown`, não no
// `click` — jsdom não implementa `PointerEvent` nem `hasPointerCapture`/
// `scrollIntoView`. Mesmo polyfill já usado em Financeiro.test.tsx/
// QuotesSection.test.tsx.
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
  // @ts-expect-error — polyfill de teste, jsdom não implementa PointerEvent.
  window.PointerEvent = PointerEventPolyfill;
}
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 1,
    name: "Cliente Teste",
    company: "Empresa",
    email: "cliente@teste.com",
    phone: "",
    whatsapp: "",
    instagram: "",
    site: "",
    serviceType: "",
    status: "Ativo",
    potentialValue: 0,
    lastProject: "",
    lastInteraction: "",
    observations: "",
    projects: [],
    tasks: [],
    contacts: [],
    assets: [],
    ...overrides,
  };
}

function setupCommonMocks(source: "local" | "supabase", client: Client) {
  vi.mocked(useClientsDataSource).mockReturnValue({
    source,
    clients: [client],
    loading: false,
    addClient: vi.fn(),
    updateClient: vi.fn().mockResolvedValue(client),
    archiveClient: vi.fn(),
    deleteClient: vi.fn(),
  } as never);
  vi.mocked(useClientTypes).mockReturnValue({ activeTypes: [] } as never);
  vi.mocked(usePlan).mockReturnValue({
    isPro: true, // bypassa UsageBadge (early return)
    plan: "pro", limits: {}, usage: { clients: 0, projects: 0, tasks: 0, leads: 0 },
    wouldExceed: () => false, showPaywall: vi.fn(), setUsage: vi.fn(),
    paywallOpen: false, paywallResource: null, closePaywall: vi.fn(),
  } as never);
  vi.mocked(useTranslation).mockReturnValue({ t: (k: string) => k } as never);
  vi.mocked(useSignupRequests).mockReturnValue({ pendingCount: 0 } as never);
  vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: { id: "ws1" } } as never);
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

function renderClientesAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Clientes />
    </MemoryRouter>,
  );
}

async function addMaterialViaLibrary() {
  // 2 matches quando a biblioteca está vazia: botão do cabeçalho da seção +
  // botão dentro do estado vazio ("Nenhum material registrado...") — os 2
  // fazem a mesma coisa (openNew), qualquer um serve.
  const triggers = await screen.findAllByRole("button", { name: /adicionar material/i });
  fireEvent.click(triggers[0]);

  const dialog = (await screen.findByText("Novo material")).closest('[role="dialog"]') as HTMLElement;
  fireEvent.change(within(dialog).getByLabelText("Nome do material *"), {
    target: { value: "Pasta de referências" },
  });

  const typeField = within(dialog).getByText("Tipo *").closest("div") as HTMLElement;
  const typeTrigger = typeField.querySelector('button[role="combobox"]') as HTMLElement;
  fireEvent.click(typeTrigger);
  const listbox = await screen.findByRole("listbox");
  fireEvent.click(within(listbox).getByText("Google Drive"));

  fireEvent.change(within(dialog).getByLabelText("Link / URL *"), {
    target: { value: "https://drive.google.com/pasta" },
  });

  fireEvent.click(within(dialog).getByRole("button", { name: "Adicionar" }));
}

describe("Clientes · G75 — aviso honesto ao editar a Biblioteca do cliente em modo Supabase", () => {
  it("adicionar material em modo Supabase avisa que fica só local — nunca bloqueia, nunca finge sucesso na nuvem", async () => {
    setupCommonMocks("supabase", makeClient());
    renderClientesAt("/clientes?client=1&tab=materials");

    await addMaterialViaLibrary();

    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(
      expect.stringContaining("só neste dispositivo"),
    ));
    expect(toast.success).not.toHaveBeenCalledWith("Cliente atualizado no Supabase.");
  });

  it("regressão: em modo local, adicionar material continua com o toast.success normal (comportamento preservado)", async () => {
    setupCommonMocks("local", makeClient());
    renderClientesAt("/clientes?client=1&tab=materials");

    await addMaterialViaLibrary();

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Cliente atualizado localmente."));
    expect(toast.warning).not.toHaveBeenCalled();
  });
});
