// Etapa 5 · Fatia 4 (clients) — C8: prova de wiring da aba Contatos.
//
// Caso 4 do design (§4.4-c): client LOCAL continua 100% inalterado — nenhuma chamada ao
// Supabase, comportamento via onUpdateContacts como antes de C8. Complementado por um
// smoke test do caminho Supabase (garante que a UI de fato aciona o hook novo, não só
// que o hook funciona isolado — isso já é coberto em useSupabaseClientContacts.test.ts).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

import { ContactsTab } from "@/components/clients/ClientProfileDrawer";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { clientsRepository } from "@/repositories/clientsRepository";
import type { Client } from "@/types/domain";

vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/repositories/clientsRepository", () => ({
  clientsRepository: {
    listClientContacts: vi.fn(),
    createClientContact: vi.fn(),
    updateClientContact: vi.fn(),
    deleteClientContact: vi.fn(),
  },
}));

function renderWithQuery(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(createElement(QueryClientProvider, { client: queryClient }, ui));
}

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 123,
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
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: { id: "ws1" } } as never);
  vi.mocked(clientsRepository.listClientContacts).mockResolvedValue([]);
});

async function addContact(name: string) {
  fireEvent.click(screen.getByRole("button", { name: /novo contato/i }));
  const nameInput = await screen.findByPlaceholderText("Nome completo");
  fireEvent.change(nameInput, { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
}

describe("ContactsTab — caso 4: client local, fluxo 100% inalterado", () => {
  it("adiciona via onUpdateContacts e NUNCA chama o repository Supabase", async () => {
    const onUpdateContacts = vi.fn();
    const client = makeClient({ id: 999, contacts: [] });

    renderWithQuery(
      createElement(ContactsTab, { client, onUpdateContacts, source: "local" }),
    );

    await addContact("Novo Contato Local");

    await waitFor(() => expect(onUpdateContacts).toHaveBeenCalledTimes(1));
    const [calledClientId, calledContacts] = onUpdateContacts.mock.calls[0];
    expect(calledClientId).toBe(999);
    expect(calledContacts).toHaveLength(1);
    expect(calledContacts[0].name).toBe("Novo Contato Local");

    expect(clientsRepository.createClientContact).not.toHaveBeenCalled();
    expect(clientsRepository.listClientContacts).not.toHaveBeenCalled();
  });
});

describe("ContactsTab — caminho Supabase (smoke, complementa o teste do hook)", () => {
  it("adiciona chamando createClientContact com o clientId como string, sem tocar onUpdateContacts", async () => {
    const onUpdateContacts = vi.fn();
    vi.mocked(clientsRepository.createClientContact).mockResolvedValue({ id: "real-uuid" } as never);
    // client.id de um client Supabase é uma uuid string mascarada de number (mesmo padrão de
    // mapSupabaseClientToLocalClient) — usamos essa forma aqui de propósito.
    const client = makeClient({ id: "50f894e9-c81c-4420-b673-9335ad17a6bf" as unknown as number });

    renderWithQuery(
      createElement(ContactsTab, { client, onUpdateContacts, source: "supabase" }),
    );

    await addContact("Contato Nuvem");

    await waitFor(() => expect(clientsRepository.createClientContact).toHaveBeenCalledTimes(1));
    const [wsArg, clientIdArg] = vi.mocked(clientsRepository.createClientContact).mock.calls[0];
    expect(wsArg).toBe("ws1");
    expect(typeof clientIdArg).toBe("string");
    expect(clientIdArg).toBe("50f894e9-c81c-4420-b673-9335ad17a6bf");
    expect(onUpdateContacts).not.toHaveBeenCalled();
  });
});
