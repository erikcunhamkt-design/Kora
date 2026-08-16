// Etapa 5 · Preparação da migração de useSupabaseOpportunities pra useMutation
// (decisão de revisor, auditoria da Lane D — G30/G32: é o único hook do
// domínio Supabase com mutations sem useMutation). RODADA 1 — characterization
// tests, ZERO mudança de produção: congela o comportamento ATUAL das 8
// funções async (sucesso, erro, guarda de workspace, efeito no cache/estado)
// pra servir de rede de segurança na rodada 2 (a migração em si).
//
// Escopo deliberadamente restrito a este hook: CRM.tsx (Lane C),
// useSupabaseQuotes/useSupabaseProjects (Lane D) e
// useSupabaseClients/ClientContacts (ciclo Clientes) NÃO são tocados nem
// lidos aqui.
//
// Comportamento atual capturado (a congelar, não a corrigir nesta rodada):
// - Cada mutation faz try/catch manual + `await invalidate()`
//   (`queryClient.invalidateQueries`) só no caminho de sucesso — nunca
//   `setQueryData` com a resposta da própria mutation (diferente do padrão
//   G30 que `useSupabaseFinanceTransactions.ts`/`useSupabaseProjects.ts` já
//   adotaram). A rodada 2 é justamente migrar isso pra useMutation com G30.
// - Guarda de "sem workspace": 7 das 8 funções devolvem `null`;
//   `deleteOpportunity` devolve `undefined` (return bare) — assimetria real
//   do código atual, capturada como está.
// - Toda mutation RE-LANÇA o erro (`throw err`) depois do toast — quem
//   chama precisa lidar com a rejeição também, não só com o toast.
// - `restoreDeletedOpportunity` tem um efeito colateral extra: grava um log
//   em `localStorage["kora.crm.supabaseRestoreDeletes.v1"]`, com catch
//   silencioso próprio (erro de quota nunca propaga).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { toast } from "sonner";

import { useSupabaseOpportunities } from "@/hooks/useSupabaseOpportunities";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { crmOpportunitiesRepository } from "@/repositories/crmOpportunitiesRepository";
import type { SupabaseOpportunity } from "@/repositories/crmOpportunitiesRepository";

vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/repositories/crmOpportunitiesRepository", () => ({
  crmOpportunitiesRepository: {
    listOpportunities: vi.fn(),
    createOpportunity: vi.fn(),
    updateOpportunity: vi.fn(),
    moveOpportunityStage: vi.fn(),
    markOpportunityWon: vi.fn(),
    markOpportunityLost: vi.fn(),
    archiveOpportunity: vi.fn(),
    deleteOpportunity: vi.fn(),
    restoreSoftDeletedOpportunity: vi.fn(),
  },
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

function makeOpportunity(overrides: Partial<SupabaseOpportunity> = {}): SupabaseOpportunity {
  return {
    id: "opp-1", workspace_id: "ws1", client_id: null, title: "Rebranding Acme",
    company: "Acme", contact_name: "Fulano", email: null, phone: null, whatsapp: null,
    stage: "contato", status: "open", source: null, temperature: null, priority: null,
    potential_value: 5000, probability: null, next_action: null, next_action_date: null,
    expected_close_date: null, notes: null, quote_id: null, quote_title: null,
    converted_client_id: null, won_at: null, lost_at: null, lost_reason: null,
    is_demo: false, archived: false, source_local_id: null, tags: null, history: null,
    created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  try { localStorage.clear(); } catch { /* jsdom always has it, guard just in case */ }
  vi.mocked(useCurrentWorkspace).mockReturnValue({
    workspace: { id: "ws1", name: "W", slug: "w", owner_id: "o", created_at: "", updated_at: "", currency: "BRL", locale: "pt-BR", timezone: null },
    membership: null, loading: false, error: null,
  } as never);
  vi.mocked(crmOpportunitiesRepository.listOpportunities).mockResolvedValue([]);
});

describe("useSupabaseOpportunities · leitura (comportamento atual, não escopo da migração)", () => {
  it("sem workspace ativo, não dispara fetch nenhum (enabled: !!workspaceId)", () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      workspace: null, membership: null, loading: false, error: null,
    } as never);

    renderHook(() => useSupabaseOpportunities(), { wrapper });

    expect(crmOpportunitiesRepository.listOpportunities).not.toHaveBeenCalled();
  });

  it("carrega as oportunidades do workspace, loading reflete o fetch em andamento", async () => {
    vi.mocked(crmOpportunitiesRepository.listOpportunities).mockResolvedValue([makeOpportunity()] as never);

    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(crmOpportunitiesRepository.listOpportunities).toHaveBeenCalledWith("ws1", { includeArchived: undefined, onlyDeleted: undefined });
    expect(result.current.opportunities).toHaveLength(1);
  });

  it("includeArchived/onlyDeleted viajam pro repository e pra query key (variantes não se misturam)", async () => {
    renderHook(() => useSupabaseOpportunities({ includeArchived: true }), { wrapper });
    renderHook(() => useSupabaseOpportunities({ onlyDeleted: true }), { wrapper });

    await waitFor(() => expect(crmOpportunitiesRepository.listOpportunities).toHaveBeenCalledWith(
      "ws1", { includeArchived: true, onlyDeleted: undefined },
    ));
    expect(crmOpportunitiesRepository.listOpportunities).toHaveBeenCalledWith(
      "ws1", { includeArchived: undefined, onlyDeleted: true },
    );
  });

  it("erro do repository vira Error no estado, opportunities cai pra array vazio, nunca quebra o hook", async () => {
    vi.mocked(crmOpportunitiesRepository.listOpportunities).mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.opportunities).toEqual([]);
  });

  it("refresh() chama refetch — dispara uma nova chamada ao repository", async () => {
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(crmOpportunitiesRepository.listOpportunities).mockClear();

    await act(async () => { await result.current.refresh(); });

    expect(crmOpportunitiesRepository.listOpportunities).toHaveBeenCalledTimes(1);
  });
});

// Molde repetido pras 8 mutations: sucesso (repository chamado com os args
// certos, toast.success com a mensagem exata, retorno = o que o repository
// devolveu, invalidate dispara um refetch de listOpportunities), erro
// (toast.error com a mensagem exata, console.error chamado, a promise
// REJEITA — throw err —, e invalidate NUNCA dispara porque o catch está
// depois do await que falhou), guarda de workspace (toast de erro genérico,
// repository NUNCA chamado, retorno null/undefined conforme o código atual).
describe("useSupabaseOpportunities · createOpportunity (comportamento atual)", () => {
  it("sucesso: chama o repository, toast de sucesso, invalida a leitura (refetch), devolve a oportunidade criada", async () => {
    const created = makeOpportunity({ id: "opp-new", title: "Novo" });
    vi.mocked(crmOpportunitiesRepository.createOpportunity).mockResolvedValue(created as never);
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(crmOpportunitiesRepository.listOpportunities).mockClear();

    let returned: unknown;
    await act(async () => { returned = await result.current.createOpportunity({ title: "Novo" }); });

    expect(crmOpportunitiesRepository.createOpportunity).toHaveBeenCalledWith("ws1", { title: "Novo" });
    expect(toast.success).toHaveBeenCalledWith("Oportunidade criada no Supabase com sucesso!");
    expect(returned).toEqual(created);
    await waitFor(() => expect(crmOpportunitiesRepository.listOpportunities).toHaveBeenCalledTimes(1));
  });

  it("erro: toast de erro, console.error, a promise REJEITA (throw), invalidate nunca dispara", async () => {
    const err = new Error("insert failed");
    vi.mocked(crmOpportunitiesRepository.createOpportunity).mockRejectedValue(err);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(crmOpportunitiesRepository.listOpportunities).mockClear();

    await expect(result.current.createOpportunity({ title: "Novo" })).rejects.toThrow("insert failed");

    expect(toast.error).toHaveBeenCalledWith("Erro ao criar oportunidade no Supabase.");
    expect(consoleSpy).toHaveBeenCalledWith("Erro ao criar oportunidade:", err);
    expect(crmOpportunitiesRepository.listOpportunities).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("sem workspace: toast genérico, repository nunca chamado, devolve null", async () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: null, membership: null, loading: false, error: null } as never);
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });

    const returned = await result.current.createOpportunity({ title: "Novo" });

    expect(returned).toBeNull();
    expect(toast.error).toHaveBeenCalledWith("Nenhum workspace ativo encontrado.");
    expect(crmOpportunitiesRepository.createOpportunity).not.toHaveBeenCalled();
  });
});

describe("useSupabaseOpportunities · updateOpportunity (comportamento atual)", () => {
  it("sucesso: chama o repository com o patch, toast de sucesso, invalida a leitura", async () => {
    const updated = makeOpportunity({ id: "opp-1", title: "Editado" });
    vi.mocked(crmOpportunitiesRepository.updateOpportunity).mockResolvedValue(updated as never);
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(crmOpportunitiesRepository.listOpportunities).mockClear();

    let returned: unknown;
    await act(async () => { returned = await result.current.updateOpportunity("opp-1", { title: "Editado" }); });

    expect(crmOpportunitiesRepository.updateOpportunity).toHaveBeenCalledWith("ws1", "opp-1", { title: "Editado" });
    expect(toast.success).toHaveBeenCalledWith("Oportunidade atualizada no Supabase!");
    expect(returned).toEqual(updated);
    await waitFor(() => expect(crmOpportunitiesRepository.listOpportunities).toHaveBeenCalledTimes(1));
  });

  it("erro: toast de erro, console.error, a promise rejeita", async () => {
    const err = new Error("update failed");
    vi.mocked(crmOpportunitiesRepository.updateOpportunity).mockRejectedValue(err);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(result.current.updateOpportunity("opp-1", { title: "x" })).rejects.toThrow("update failed");

    expect(toast.error).toHaveBeenCalledWith("Erro ao atualizar oportunidade no Supabase.");
    expect(consoleSpy).toHaveBeenCalledWith("Erro ao atualizar oportunidade:", err);
    consoleSpy.mockRestore();
  });

  it("sem workspace: devolve null, repository nunca chamado", async () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: null, membership: null, loading: false, error: null } as never);
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });

    const returned = await result.current.updateOpportunity("opp-1", { title: "x" });

    expect(returned).toBeNull();
    expect(crmOpportunitiesRepository.updateOpportunity).not.toHaveBeenCalled();
  });
});

describe("useSupabaseOpportunities · moveOpportunityStage (comportamento atual)", () => {
  it("sucesso: chama o repository com o stage, toast com o stage interpolado, invalida a leitura", async () => {
    const moved = makeOpportunity({ id: "opp-1", stage: "proposta" });
    vi.mocked(crmOpportunitiesRepository.moveOpportunityStage).mockResolvedValue(moved as never);
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(crmOpportunitiesRepository.listOpportunities).mockClear();

    let returned: unknown;
    await act(async () => { returned = await result.current.moveOpportunityStage("opp-1", "proposta"); });

    expect(crmOpportunitiesRepository.moveOpportunityStage).toHaveBeenCalledWith("ws1", "opp-1", "proposta");
    expect(toast.success).toHaveBeenCalledWith('Estágio alterado para "proposta"!');
    expect(returned).toEqual(moved);
    await waitFor(() => expect(crmOpportunitiesRepository.listOpportunities).toHaveBeenCalledTimes(1));
  });

  it("erro: toast de erro, console.error, a promise rejeita", async () => {
    const err = new Error("move failed");
    vi.mocked(crmOpportunitiesRepository.moveOpportunityStage).mockRejectedValue(err);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(result.current.moveOpportunityStage("opp-1", "proposta")).rejects.toThrow("move failed");

    expect(toast.error).toHaveBeenCalledWith("Erro ao mover oportunidade no Supabase.");
    expect(consoleSpy).toHaveBeenCalledWith("Erro ao mover oportunidade:", err);
    consoleSpy.mockRestore();
  });

  it("sem workspace: devolve null, repository nunca chamado", async () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: null, membership: null, loading: false, error: null } as never);
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });

    const returned = await result.current.moveOpportunityStage("opp-1", "proposta");

    expect(returned).toBeNull();
    expect(crmOpportunitiesRepository.moveOpportunityStage).not.toHaveBeenCalled();
  });
});

describe("useSupabaseOpportunities · markWon (comportamento atual)", () => {
  it("sucesso: chama markOpportunityWon, toast com emoji, invalida a leitura", async () => {
    const won = makeOpportunity({ id: "opp-1", stage: "fechado", status: "won" });
    vi.mocked(crmOpportunitiesRepository.markOpportunityWon).mockResolvedValue(won as never);
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(crmOpportunitiesRepository.listOpportunities).mockClear();

    let returned: unknown;
    await act(async () => { returned = await result.current.markWon("opp-1"); });

    expect(crmOpportunitiesRepository.markOpportunityWon).toHaveBeenCalledWith("ws1", "opp-1");
    expect(toast.success).toHaveBeenCalledWith("Oportunidade marcada como ganha 🎉");
    expect(returned).toEqual(won);
    await waitFor(() => expect(crmOpportunitiesRepository.listOpportunities).toHaveBeenCalledTimes(1));
  });

  it("erro: toast de erro, console.error, a promise rejeita", async () => {
    const err = new Error("won failed");
    vi.mocked(crmOpportunitiesRepository.markOpportunityWon).mockRejectedValue(err);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(result.current.markWon("opp-1")).rejects.toThrow("won failed");

    expect(toast.error).toHaveBeenCalledWith("Erro ao marcar oportunidade como ganha.");
    expect(consoleSpy).toHaveBeenCalledWith("Erro ao marcar como ganha:", err);
    consoleSpy.mockRestore();
  });

  it("sem workspace: devolve null, repository nunca chamado", async () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: null, membership: null, loading: false, error: null } as never);
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });

    const returned = await result.current.markWon("opp-1");

    expect(returned).toBeNull();
    expect(crmOpportunitiesRepository.markOpportunityWon).not.toHaveBeenCalled();
  });
});

describe("useSupabaseOpportunities · markLost (comportamento atual)", () => {
  it("sucesso: chama markOpportunityLost com o reason opcional, toast fixo, invalida a leitura", async () => {
    const lost = makeOpportunity({ id: "opp-1", stage: "perdido", status: "lost", lost_reason: "Preço" });
    vi.mocked(crmOpportunitiesRepository.markOpportunityLost).mockResolvedValue(lost as never);
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(crmOpportunitiesRepository.listOpportunities).mockClear();

    let returned: unknown;
    await act(async () => { returned = await result.current.markLost("opp-1", "Preço"); });

    expect(crmOpportunitiesRepository.markOpportunityLost).toHaveBeenCalledWith("ws1", "opp-1", "Preço");
    expect(toast.success).toHaveBeenCalledWith("Oportunidade marcada como perdida.");
    expect(returned).toEqual(lost);
    await waitFor(() => expect(crmOpportunitiesRepository.listOpportunities).toHaveBeenCalledTimes(1));
  });

  it("reason omitido: repository recebe undefined (não força string vazia)", async () => {
    vi.mocked(crmOpportunitiesRepository.markOpportunityLost).mockResolvedValue(makeOpportunity() as never);
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.markLost("opp-1"); });

    expect(crmOpportunitiesRepository.markOpportunityLost).toHaveBeenCalledWith("ws1", "opp-1", undefined);
  });

  it("erro: toast de erro, console.error, a promise rejeita", async () => {
    const err = new Error("lost failed");
    vi.mocked(crmOpportunitiesRepository.markOpportunityLost).mockRejectedValue(err);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(result.current.markLost("opp-1")).rejects.toThrow("lost failed");

    expect(toast.error).toHaveBeenCalledWith("Erro ao marcar oportunidade como perdida.");
    expect(consoleSpy).toHaveBeenCalledWith("Erro ao marcar como perdida:", err);
    consoleSpy.mockRestore();
  });

  it("sem workspace: devolve null, repository nunca chamado", async () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: null, membership: null, loading: false, error: null } as never);
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });

    const returned = await result.current.markLost("opp-1", "Preço");

    expect(returned).toBeNull();
    expect(crmOpportunitiesRepository.markOpportunityLost).not.toHaveBeenCalled();
  });
});

describe("useSupabaseOpportunities · archiveOpportunity (comportamento atual)", () => {
  it("sucesso (archived=true, default): toast de arquivada, invalida a leitura", async () => {
    const archived = makeOpportunity({ id: "opp-1", archived: true });
    vi.mocked(crmOpportunitiesRepository.archiveOpportunity).mockResolvedValue(archived as never);
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(crmOpportunitiesRepository.listOpportunities).mockClear();

    let returned: unknown;
    await act(async () => { returned = await result.current.archiveOpportunity("opp-1"); });

    expect(crmOpportunitiesRepository.archiveOpportunity).toHaveBeenCalledWith("ws1", "opp-1", true);
    expect(toast.success).toHaveBeenCalledWith("Oportunidade arquivada!");
    expect(returned).toEqual(archived);
    await waitFor(() => expect(crmOpportunitiesRepository.listOpportunities).toHaveBeenCalledTimes(1));
  });

  it("sucesso (archived=false, explícito): toast de restaurada", async () => {
    vi.mocked(crmOpportunitiesRepository.archiveOpportunity).mockResolvedValue(makeOpportunity({ archived: false }) as never);
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.archiveOpportunity("opp-1", false); });

    expect(crmOpportunitiesRepository.archiveOpportunity).toHaveBeenCalledWith("ws1", "opp-1", false);
    expect(toast.success).toHaveBeenCalledWith("Oportunidade restaurada!");
  });

  it("erro: toast de erro, console.error, a promise rejeita", async () => {
    const err = new Error("archive failed");
    vi.mocked(crmOpportunitiesRepository.archiveOpportunity).mockRejectedValue(err);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(result.current.archiveOpportunity("opp-1")).rejects.toThrow("archive failed");

    expect(toast.error).toHaveBeenCalledWith("Erro ao alterar arquivamento no Supabase.");
    expect(consoleSpy).toHaveBeenCalledWith("Erro ao arquivar oportunidade:", err);
    consoleSpy.mockRestore();
  });

  it("sem workspace: devolve null, repository nunca chamado", async () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: null, membership: null, loading: false, error: null } as never);
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });

    const returned = await result.current.archiveOpportunity("opp-1");

    expect(returned).toBeNull();
    expect(crmOpportunitiesRepository.archiveOpportunity).not.toHaveBeenCalled();
  });
});

describe("useSupabaseOpportunities · deleteOpportunity (comportamento atual — assimetria de retorno)", () => {
  it("sucesso: chama o repository, toast de sucesso, invalida a leitura, devolve undefined (função void)", async () => {
    vi.mocked(crmOpportunitiesRepository.deleteOpportunity).mockResolvedValue(undefined as never);
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(crmOpportunitiesRepository.listOpportunities).mockClear();

    let returned: unknown;
    await act(async () => { returned = await result.current.deleteOpportunity("opp-1"); });

    expect(crmOpportunitiesRepository.deleteOpportunity).toHaveBeenCalledWith("ws1", "opp-1");
    expect(toast.success).toHaveBeenCalledWith("Oportunidade removida do Supabase.");
    expect(returned).toBeUndefined();
    await waitFor(() => expect(crmOpportunitiesRepository.listOpportunities).toHaveBeenCalledTimes(1));
  });

  it("erro: toast de erro, console.error, a promise rejeita", async () => {
    const err = new Error("delete failed");
    vi.mocked(crmOpportunitiesRepository.deleteOpportunity).mockRejectedValue(err);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(result.current.deleteOpportunity("opp-1")).rejects.toThrow("delete failed");

    expect(toast.error).toHaveBeenCalledWith("Erro ao excluir oportunidade no Supabase.");
    expect(consoleSpy).toHaveBeenCalledWith("Erro ao excluir oportunidade:", err);
    consoleSpy.mockRestore();
  });

  // Assimetria real do código atual: as outras 7 funções devolvem `null` na
  // guarda de workspace; esta devolve `undefined` (return bare) — congelado
  // como está, não corrigido nesta rodada (característica, não bug do R1).
  it("sem workspace: devolve undefined (não null, diferente das outras 7), repository nunca chamado", async () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: null, membership: null, loading: false, error: null } as never);
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });

    const returned = await result.current.deleteOpportunity("opp-1");

    expect(returned).toBeUndefined();
    expect(crmOpportunitiesRepository.deleteOpportunity).not.toHaveBeenCalled();
  });
});

describe("useSupabaseOpportunities · restoreDeletedOpportunity (comportamento atual — efeito colateral extra)", () => {
  it("sucesso: chama restoreSoftDeletedOpportunity, toast de sucesso, invalida a leitura, devolve a oportunidade restaurada", async () => {
    const restored = makeOpportunity({ id: "opp-1", title: "Restaurada", updated_at: "2026-08-15T00:00:00Z" });
    vi.mocked(crmOpportunitiesRepository.restoreSoftDeletedOpportunity).mockResolvedValue(restored as never);
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(crmOpportunitiesRepository.listOpportunities).mockClear();

    let returned: unknown;
    await act(async () => { returned = await result.current.restoreDeletedOpportunity("opp-1"); });

    expect(crmOpportunitiesRepository.restoreSoftDeletedOpportunity).toHaveBeenCalledWith("ws1", "opp-1");
    expect(toast.success).toHaveBeenCalledWith("Oportunidade restaurada com sucesso!");
    expect(returned).toEqual(restored);
    await waitFor(() => expect(crmOpportunitiesRepository.listOpportunities).toHaveBeenCalledTimes(1));
  });

  it("efeito colateral: grava um log em localStorage['kora.crm.supabaseRestoreDeletes.v1'] com opportunityId/title/restoredAt", async () => {
    const restored = makeOpportunity({ id: "opp-1", title: "Restaurada" });
    vi.mocked(crmOpportunitiesRepository.restoreSoftDeletedOpportunity).mockResolvedValue(restored as never);
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.restoreDeletedOpportunity("opp-1"); });

    const logged = JSON.parse(localStorage.getItem("kora.crm.supabaseRestoreDeletes.v1") ?? "null");
    expect(logged).toMatchObject({ opportunityId: "opp-1", title: "Restaurada" });
    expect(typeof logged.restoredAt).toBe("string");
  });

  it("erro: toast de erro, console.error, a promise rejeita, e o log de restore NUNCA é gravado (erro é antes do log)", async () => {
    const err = new Error("restore failed");
    vi.mocked(crmOpportunitiesRepository.restoreSoftDeletedOpportunity).mockRejectedValue(err);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(result.current.restoreDeletedOpportunity("opp-1")).rejects.toThrow("restore failed");

    expect(toast.error).toHaveBeenCalledWith("Erro ao restaurar oportunidade.");
    expect(consoleSpy).toHaveBeenCalledWith("Erro ao restaurar oportunidade deletada:", err);
    expect(localStorage.getItem("kora.crm.supabaseRestoreDeletes.v1")).toBeNull();
    consoleSpy.mockRestore();
  });

  it("sem workspace: devolve null, repository nunca chamado, log nunca gravado", async () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: null, membership: null, loading: false, error: null } as never);
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });

    const returned = await result.current.restoreDeletedOpportunity("opp-1");

    expect(returned).toBeNull();
    expect(crmOpportunitiesRepository.restoreSoftDeletedOpportunity).not.toHaveBeenCalled();
    expect(localStorage.getItem("kora.crm.supabaseRestoreDeletes.v1")).toBeNull();
  });
});
