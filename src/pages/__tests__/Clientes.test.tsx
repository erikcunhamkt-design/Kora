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
import { useBifurcatedTechnicalSheet } from "@/hooks/useBifurcatedTechnicalSheet";
import type { Client } from "@/types/domain";

vi.mock("@/hooks/useClientsDataSource", () => ({ useClientsDataSource: vi.fn() }));
// MaterialsTab (dentro de ClientProfileDrawer, aba "Materiais") passou a ler
// useBifurcatedTechnicalSheet(clientId) — G74/F2/F3, Lane E. Internamente
// chama useSupabaseTechnicalSheet() -> useQuery(), que quebra sem
// QueryClientProvider real na árvore de teste. Mock direto (achado G75 não
// mexe na Ficha Técnica, só na Biblioteca do cliente — irrelevante aqui).
vi.mock("@/hooks/useBifurcatedTechnicalSheet", () => ({ useBifurcatedTechnicalSheet: vi.fn() }));
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
  vi.mocked(useBifurcatedTechnicalSheet).mockReturnValue({} as never);
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

// G86 (padrão G73) — o deep link `?client=<id>` fazia `Number(id)`; o id de um
// cliente da nuvem é um uuid "contrabandeado" como number (useClientsDataSource.ts:9)
// e Number(uuid) = NaN, então o drawer nunca abria (sem erro nenhum). Os testes
// acima usam `?client=1` (id numérico) e por isso nunca pegariam a classe.
// Fixtures com uuid REAL; a aba "Histórico de Relacionamento" só existe no drawer.
describe("Clientes · G86 — deep link ?client= com id uuid abre o cliente certo", () => {
  const UUID_A = "87ebd1d2-b17a-46f4-b0eb-70beac445221";
  const UUID_B = "11111111-2222-4333-8444-555555555555";

  function setupTwoCloudClients() {
    const a = makeClient({ id: UUID_A as unknown as number, name: "Cliente A Nuvem", company: "Alfa Ltda" });
    const b = makeClient({ id: UUID_B as unknown as number, name: "Cliente B Nuvem", company: "Beta Ltda" });
    setupCommonMocks("supabase", a);
    vi.mocked(useClientsDataSource).mockReturnValue({
      source: "supabase",
      clients: [a, b],
      loading: false,
      addClient: vi.fn(),
      updateClient: vi.fn().mockResolvedValue(a),
      archiveClient: vi.fn(),
      deleteClient: vi.fn(),
    } as never);
  }

  it("?client=<uuid> abre o drawer do cliente cujo id é esse uuid (antes: NaN, drawer nunca abria)", async () => {
    setupTwoCloudClients();
    renderClientesAt(`/clientes?client=${UUID_B}`);

    expect(await screen.findByText("Histórico de Relacionamento")).toBeInTheDocument();
    // o drawer é do cliente B (e não do A, o primeiro da lista)
    const tabs = screen.getByText("Histórico de Relacionamento").closest('[role="dialog"]') as HTMLElement;
    expect(within(tabs).getByText("Cliente B Nuvem")).toBeInTheDocument();
    expect(within(tabs).queryByText("Cliente A Nuvem")).not.toBeInTheDocument();
  });

  it("uuid que não corresponde a nenhum cliente: nenhum drawer abre (sem lançar)", async () => {
    setupTwoCloudClients();
    renderClientesAt("/clientes?client=99999999-9999-4999-8999-999999999999");

    await screen.findByText("Cliente A Nuvem");
    expect(screen.queryByText("Histórico de Relacionamento")).not.toBeInTheDocument();
  });

  it("regressão: id numérico (modo local) continua abrindo o cliente", async () => {
    setupCommonMocks("local", makeClient());
    renderClientesAt("/clientes?client=1");

    expect(await screen.findByText("Histórico de Relacionamento")).toBeInTheDocument();
  });
});

// Copy G29-classe — arquivar/restaurar/excluir cliente: o toast tem que refletir o modo
// REAL (nuvem por default) e a escrita; antes, os handlers não esperavam a mutation e
// disparavam um 2º toast.success incondicional ("<nome> arquivado/restaurado/excluído"),
// que dobrava a mensagem e mentia sucesso mesmo quando a escrita na nuvem falhava. O
// diálogo de exclusão dizia "dados locais" também na nuvem.
describe("Clientes · copy G29 — arquivar/restaurar/excluir refletem o modo real e a escrita", () => {
  async function openRowMenu() {
    await screen.findByText("Cliente Teste");
    const trigger = document.querySelector("tbody button[aria-haspopup=\"menu\"]") as HTMLElement;
    fireEvent.pointerDown(trigger, { button: 0, pointerId: 1, isPrimary: true });
    fireEvent.pointerUp(trigger, { button: 0, pointerId: 1, isPrimary: true });
    fireEvent.click(trigger);
  }

  function setupWith(source: "local" | "supabase", overrides: Record<string, unknown> = {}) {
    const client = makeClient();
    setupCommonMocks(source, client);
    const archiveClient = vi.fn().mockResolvedValue(undefined);
    const deleteClient = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useClientsDataSource).mockReturnValue({
      source, clients: [client], loading: false, addClient: vi.fn(),
      updateClient: vi.fn().mockResolvedValue(client), archiveClient, deleteClient, ...overrides,
    } as never);
    return { archiveClient, deleteClient };
  }

  it("arquivar na nuvem: UM toast de sucesso (o do modo real), sem o 2º incondicional", async () => {
    const { archiveClient } = setupWith("supabase");
    renderClientesAt("/clientes");

    await openRowMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: /Arquivar/ }));

    await waitFor(() => expect(archiveClient).toHaveBeenCalledWith("1", true));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Cliente arquivado no Supabase."));
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).not.toHaveBeenCalledWith("Cliente Teste arquivado");
  });

  it("arquivar na nuvem com FALHA: só o toast de erro — nunca um sucesso falso", async () => {
    setupWith("supabase", { archiveClient: vi.fn().mockRejectedValue(new Error("rls")) });
    renderClientesAt("/clientes");

    await openRowMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: /Arquivar/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Erro ao arquivar cliente no Supabase."));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("excluir na nuvem: o diálogo não diz \"dados locais\" e o toast de sucesso é um só", async () => {
    const { deleteClient } = setupWith("supabase");
    renderClientesAt("/clientes");

    await openRowMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: /Excluir/ }));
    const dialog = (await screen.findByText("Excluir cliente?")).closest("[role=\"alertdialog\"]") as HTMLElement;
    expect(within(dialog).queryByText(/dados locais/)).not.toBeInTheDocument();
    expect(within(dialog).getByText(/removidos da nuvem/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(deleteClient).toHaveBeenCalledWith("1"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Cliente excluído do Supabase."));
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).not.toHaveBeenCalledWith("Cliente Teste excluído");
  });

  it("excluir na nuvem com FALHA: só o toast de erro — nunca um sucesso falso", async () => {
    setupWith("supabase", { deleteClient: vi.fn().mockRejectedValue(new Error("fk")) });
    renderClientesAt("/clientes");

    await openRowMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: /Excluir/ }));
    const dialog = (await screen.findByText("Excluir cliente?")).closest("[role=\"alertdialog\"]") as HTMLElement;
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Erro ao excluir cliente do Supabase."));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("modo local: o diálogo de exclusão segue dizendo \"dados locais\" (texto correto pro modo)", async () => {
    setupWith("local");
    renderClientesAt("/clientes");

    await openRowMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: /Excluir/ }));
    const dialog = (await screen.findByText("Excluir cliente?")).closest("[role=\"alertdialog\"]") as HTMLElement;
    expect(within(dialog).getByText(/seus dados locais serão removidos/)).toBeInTheDocument();
  });
});
