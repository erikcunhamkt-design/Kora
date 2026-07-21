// Etapa 5 · Fatia 4 (clients) — C8: prova que client_contacts passa a PERSISTIR de
// verdade para clients Supabase-first (antes de C8, a aba "Contatos" mostrava sucesso
// mas nada era gravado — ver docs/qa/etapa-5-fatia-4-clients.md §4.2).
//
// Casos do design (§4.4-c): 1 (criar->refetch persiste), 2 (editar->refetch persiste),
// 3 (remover->refetch some), 5 (erro isolado por operação), 6 (clientId chega como
// string, sem coerção). Caso 4 (client local inalterado) e 7 (homologação manual) estão
// em ContactsTab.test.tsx / fora do escopo automatizado, respectivamente.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

import { useSupabaseClientContacts } from "@/hooks/useSupabaseClientContacts";
import { clientsRepository } from "@/repositories/clientsRepository";
import type { ClientContact } from "@/types/domain";

vi.mock("@/repositories/clientsRepository", () => ({
  clientsRepository: {
    listClientContacts: vi.fn(),
    createClientContact: vi.fn(),
    updateClientContact: vi.fn(),
    deleteClientContact: vi.fn(),
  },
}));

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

const WORKSPACE_ID = "ws1";
const CLIENT_ID = "e307969a-619b-4891-bfbf-9da596203be4"; // UUID real, não number

function makeContact(overrides: Partial<ClientContact> = {}): ClientContact {
  return {
    id: `ct-${Date.now()}-abc`,
    name: "Deni",
    role: "Financeiro",
    email: "",
    phone: "",
    whatsapp: "",
    isPrimary: false,
    isFinancial: true,
    isDecisionMaker: false,
    notes: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useSupabaseClientContacts — caso 1: criar -> refetch -> persiste", () => {
  it("cria o contato e o refetch mostra a linha real da nuvem (uuid real, não o id temporário)", async () => {
    vi.mocked(clientsRepository.listClientContacts)
      .mockResolvedValueOnce([]) // antes de salvar
      .mockResolvedValueOnce([
        {
          id: "real-uuid-1",
          name: "Deni",
          role: "Financeiro",
          email: null,
          phone: null,
          whatsapp: null,
          is_primary: false,
          is_financial: true,
          is_decision_maker: false,
          notes: null,
          created_at: "2026-07-20T00:00:00Z",
          updated_at: "2026-07-20T00:00:00Z",
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any); // após salvar (refetch pós-invalidação)
    vi.mocked(clientsRepository.createClientContact).mockResolvedValue({ id: "real-uuid-1" } as never);

    const { result } = renderHook(() => useSupabaseClientContacts(WORKSPACE_ID, CLIENT_ID), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.contacts).toEqual([]));

    const draft = makeContact({ id: "ct-1784521404974-temp" }); // id local, nunca existiu na nuvem
    await result.current.createContact(draft);

    await waitFor(() => expect(result.current.contacts).toHaveLength(1));
    // A linha que sobrevive é a da nuvem (uuid real) — o id temporário do form nunca é gravado.
    expect(result.current.contacts[0].id).toBe("real-uuid-1");
    expect(result.current.contacts[0].id).not.toBe(draft.id);
    expect(clientsRepository.createClientContact).toHaveBeenCalledWith(
      WORKSPACE_ID,
      CLIENT_ID,
      expect.objectContaining({ name: "Deni", is_financial: true }),
    );
  });
});

describe("useSupabaseClientContacts — caso 2: editar -> refetch -> persiste", () => {
  it("chama updateClientContact com o id real e reflete a mudança após refetch", async () => {
    const existing = {
      id: "real-uuid-2",
      name: "Deni Antigo",
      role: "Financeiro",
      email: null,
      phone: null,
      whatsapp: null,
      is_primary: false,
      is_financial: true,
      is_decision_maker: false,
      notes: null,
      created_at: "2026-07-20T00:00:00Z",
      updated_at: "2026-07-20T00:00:00Z",
    };
    vi.mocked(clientsRepository.listClientContacts)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([existing] as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([{ ...existing, name: "Deni Editado" }] as any);
    vi.mocked(clientsRepository.updateClientContact).mockResolvedValue(existing as never);

    const { result } = renderHook(() => useSupabaseClientContacts(WORKSPACE_ID, CLIENT_ID), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.contacts).toHaveLength(1));

    await result.current.updateContact(makeContact({ id: "real-uuid-2", name: "Deni Editado" }));

    expect(clientsRepository.updateClientContact).toHaveBeenCalledWith(
      WORKSPACE_ID,
      "real-uuid-2",
      expect.objectContaining({ name: "Deni Editado" }),
    );
    await waitFor(() => expect(result.current.contacts[0].name).toBe("Deni Editado"));
  });
});

describe("useSupabaseClientContacts — caso 3: remover -> refetch -> não reaparece", () => {
  it("chama deleteClientContact e o refetch já não traz a linha", async () => {
    const existing = {
      id: "real-uuid-3",
      name: "Deni",
      role: null,
      email: null,
      phone: null,
      whatsapp: null,
      is_primary: false,
      is_financial: false,
      is_decision_maker: false,
      notes: null,
      created_at: "2026-07-20T00:00:00Z",
      updated_at: "2026-07-20T00:00:00Z",
    };
    vi.mocked(clientsRepository.listClientContacts)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([existing] as any)
      .mockResolvedValueOnce([]);
    vi.mocked(clientsRepository.deleteClientContact).mockResolvedValue(true);

    const { result } = renderHook(() => useSupabaseClientContacts(WORKSPACE_ID, CLIENT_ID), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.contacts).toHaveLength(1));

    await result.current.deleteContact("real-uuid-3");

    expect(clientsRepository.deleteClientContact).toHaveBeenCalledWith(WORKSPACE_ID, "real-uuid-3");
    await waitFor(() => expect(result.current.contacts).toHaveLength(0));
  });
});

describe("useSupabaseClientContacts — caso 5: erro isolado por operação", () => {
  it("uma criação que falha rejeita a chamada e NÃO altera os contatos já carregados", async () => {
    const existing = {
      id: "real-uuid-4",
      name: "Contato Intocado",
      role: null,
      email: null,
      phone: null,
      whatsapp: null,
      is_primary: false,
      is_financial: false,
      is_decision_maker: false,
      notes: null,
      created_at: "2026-07-20T00:00:00Z",
      updated_at: "2026-07-20T00:00:00Z",
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(clientsRepository.listClientContacts).mockResolvedValue([existing] as any);
    vi.mocked(clientsRepository.createClientContact).mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useSupabaseClientContacts(WORKSPACE_ID, CLIENT_ID), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.contacts).toHaveLength(1));

    await expect(result.current.createContact(makeContact())).rejects.toThrow("network down");

    // O contato que já existia continua intocado — o erro de UM não contamina os outros.
    expect(result.current.contacts).toHaveLength(1);
    expect(result.current.contacts[0].id).toBe("real-uuid-4");
  });
});

describe("useSupabaseClientContacts — caso 6: clientId chega como string, sem coerção", () => {
  it("repassa o clientId string (uuid) intacto pro repository, sem virar number", async () => {
    vi.mocked(clientsRepository.listClientContacts).mockResolvedValue([]);
    vi.mocked(clientsRepository.createClientContact).mockResolvedValue({ id: "x" } as never);

    const { result } = renderHook(() => useSupabaseClientContacts(WORKSPACE_ID, CLIENT_ID), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.contacts).toEqual([]));
    await result.current.createContact(makeContact());

    const [wsArg, clientIdArg] = vi.mocked(clientsRepository.createClientContact).mock.calls[0];
    expect(typeof clientIdArg).toBe("string");
    expect(clientIdArg).toBe(CLIENT_ID);
    expect(wsArg).toBe(WORKSPACE_ID);
  });
});
