// Etapa 5 · Preparação da migração de useSupabaseOpportunities pra useMutation
// (decisão de revisor, auditoria da Lane D — G30/G32: é o único hook do
// domínio Supabase com mutations sem useMutation).
//
// RODADA 1 — characterization tests, ZERO mudança de produção: congelou o
// comportamento ANTIGO das 8 funções async (sucesso, erro, guarda de
// workspace, efeito no cache/estado) pra servir de rede de segurança.
//
// RODADA 2 — migração pra useMutation aplicada (molde
// useSupabaseFinanceTransactions.ts, G30). Duas divergências intencionais,
// cada uma marcada inline nos testes que mudaram:
// - #1: `invalidate()` (prefixo, refaz fetch de TODAS as variantes
//   includeArchived/onlyDeleted) virou `setQueryData` só na instância atual
//   (a resposta da própria mutation, sem refetch) — outras instâncias
//   deste hook montadas em paralelo só atualizam no próprio refetch delas.
// - #2: guarda de "sem workspace" de `deleteOpportunity` (a única
//   assimetria real que a R1 capturou — devolvia `undefined`, as outras 7
//   devolvem `null`) foi alinhada — agora devolve `null` também.
//
// Escopo deliberadamente restrito a este hook: CRM.tsx (Lane C),
// useSupabaseQuotes/useSupabaseProjects (Lane D) e
// useSupabaseClients/ClientContacts (ciclo Clientes) NÃO são tocados nem
// lidos aqui.
//
// Comportamento preservado sem mudança (não listado como divergência):
// - Toda mutation RE-LANÇA o erro (agora via rejeição do próprio
//   `mutateAsync`) depois do toast — quem chama precisa lidar com a
//   rejeição também, não só com o toast.
// - `restoreDeletedOpportunity` continua com o efeito colateral extra: log
//   em `localStorage["kora.crm.supabaseRestoreDeletes.v1"]`, com catch
//   silencioso próprio (erro de quota nunca propaga), nunca gravado no
//   caminho de erro.
// - `deleteOpportunity` continua devolvendo `undefined` no SUCESSO pro
//   chamador (só a guarda de workspace mudou, divergência #2) — o
//   repository por baixo passou a devolver a linha apagada (adaptado, não
//   inventado — precisa dela pra saber o que tirar do cache via G30), mas
//   isso é implementação interna, não muda o contrato público do wrapper.
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
// devolveu), erro (toast.error com a mensagem exata, console.error chamado,
// a promise REJEITA — throw err/rejeição do useMutation), guarda de
// workspace (toast de erro genérico, repository NUNCA chamado, retorno
// null/undefined conforme o código atual).
//
// RODADA 2 (migração pra useMutation, G30) — DIVERGÊNCIA INTENCIONAL #1:
// os asserts de "invalida a leitura (refetch de listOpportunities)" da R1
// viraram "listOpportunities NÃO é chamado de novo — a resposta da própria
// mutation já foi escrita no cache via setQueryData" (G30, molde
// useSupabaseFinanceTransactions.ts). Resto de cada teste (args do
// repository, toast, retorno, erro, guarda) não mudou.
describe("useSupabaseOpportunities · createOpportunity (comportamento atual)", () => {
  it("sucesso: chama o repository, toast de sucesso, atualiza o cache com a resposta da própria mutation (G30), devolve a oportunidade criada", async () => {
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
    // DIVERGÊNCIA #1 (R2, G30): a resposta da própria mutation já entra no
    // cache — nenhum refetch de listOpportunities é disparado.
    await waitFor(() => expect(result.current.opportunities.some((o) => o.id === "opp-new")).toBe(true));
    expect(crmOpportunitiesRepository.listOpportunities).not.toHaveBeenCalled();
  });

  it("erro: toast de erro, console.error, a promise REJEITA, nenhum refetch/escrita de cache dispara", async () => {
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
  it("sucesso: chama o repository com o patch, toast de sucesso, atualiza o cache com a resposta da própria mutation (G30)", async () => {
    vi.mocked(crmOpportunitiesRepository.listOpportunities).mockResolvedValue([makeOpportunity({ id: "opp-1", title: "Original" })] as never);
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
    // DIVERGÊNCIA #1 (R2, G30): sem refetch — o cache já reflete "Editado".
    await waitFor(() => expect(result.current.opportunities[0].title).toBe("Editado"));
    expect(crmOpportunitiesRepository.listOpportunities).not.toHaveBeenCalled();
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
  it("sucesso: chama o repository com o stage, toast com o stage interpolado, atualiza o cache com a resposta da própria mutation (G30)", async () => {
    vi.mocked(crmOpportunitiesRepository.listOpportunities).mockResolvedValue([makeOpportunity({ id: "opp-1", stage: "contato" })] as never);
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
    // DIVERGÊNCIA #1 (R2, G30): sem refetch — o cache já reflete "proposta".
    await waitFor(() => expect(result.current.opportunities[0].stage).toBe("proposta"));
    expect(crmOpportunitiesRepository.listOpportunities).not.toHaveBeenCalled();
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
  it("sucesso: chama markOpportunityWon, toast com emoji, atualiza o cache com a resposta da própria mutation (G30)", async () => {
    vi.mocked(crmOpportunitiesRepository.listOpportunities).mockResolvedValue([makeOpportunity({ id: "opp-1", stage: "contato", status: "open" })] as never);
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
    // DIVERGÊNCIA #1 (R2, G30): sem refetch — o cache já reflete "won".
    await waitFor(() => expect(result.current.opportunities[0].status).toBe("won"));
    expect(crmOpportunitiesRepository.listOpportunities).not.toHaveBeenCalled();
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
  it("sucesso: chama markOpportunityLost com o reason opcional, toast fixo, atualiza o cache com a resposta da própria mutation (G30)", async () => {
    vi.mocked(crmOpportunitiesRepository.listOpportunities).mockResolvedValue([makeOpportunity({ id: "opp-1", stage: "contato", status: "open" })] as never);
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
    // DIVERGÊNCIA #1 (R2, G30): sem refetch — o cache já reflete "lost".
    await waitFor(() => expect(result.current.opportunities[0].status).toBe("lost"));
    expect(crmOpportunitiesRepository.listOpportunities).not.toHaveBeenCalled();
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
  it("sucesso (archived=true, default): toast de arquivada, atualiza o cache com a resposta da própria mutation (G30)", async () => {
    vi.mocked(crmOpportunitiesRepository.listOpportunities).mockResolvedValue([makeOpportunity({ id: "opp-1", archived: false })] as never);
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
    // DIVERGÊNCIA #1 (R2, G30): sem refetch — o cache já reflete archived=true.
    await waitFor(() => expect(result.current.opportunities[0].archived).toBe(true));
    expect(crmOpportunitiesRepository.listOpportunities).not.toHaveBeenCalled();
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

describe("useSupabaseOpportunities · deleteOpportunity (R1: assimetria de retorno congelada; R2: alinhada — DIVERGÊNCIA #2)", () => {
  // RODADA 2 — o mock passa a resolver a linha apagada (não mais `undefined`):
  // crmOpportunitiesRepository.deleteOpportunity ganhou `.select().single()`
  // nesta rodada (repository adaptado pra devolver a linha, não um shape
  // inventado — instrução explícita da tarefa), porque o G30 precisa saber
  // QUAL id tirar do cache. O contrato PÚBLICO do wrapper não muda: o
  // sucesso continua devolvendo `undefined` pro chamador (ver abaixo).
  it("sucesso: chama o repository, toast de sucesso, atualiza o cache com a resposta da própria mutation (G30), devolve undefined (função void)", async () => {
    vi.mocked(crmOpportunitiesRepository.listOpportunities).mockResolvedValue([makeOpportunity({ id: "opp-1" }), makeOpportunity({ id: "opp-2" })] as never);
    vi.mocked(crmOpportunitiesRepository.deleteOpportunity).mockResolvedValue(makeOpportunity({ id: "opp-1" }) as never);
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(crmOpportunitiesRepository.listOpportunities).mockClear();

    let returned: unknown;
    await act(async () => { returned = await result.current.deleteOpportunity("opp-1"); });

    expect(crmOpportunitiesRepository.deleteOpportunity).toHaveBeenCalledWith("ws1", "opp-1");
    expect(toast.success).toHaveBeenCalledWith("Oportunidade removida do Supabase.");
    // Contrato público inalterado: o wrapper continua devolvendo undefined
    // no sucesso, mesmo a mutation resolvendo com a linha internamente.
    expect(returned).toBeUndefined();
    // DIVERGÊNCIA #1 (R2, G30): sem refetch — "opp-1" já sai do cache.
    await waitFor(() => expect(result.current.opportunities.map((o) => o.id)).toEqual(["opp-2"]));
    expect(crmOpportunitiesRepository.listOpportunities).not.toHaveBeenCalled();
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

  // DIVERGÊNCIA INTENCIONAL #2 (R2): a assimetria real que o R1 congelou
  // (guarda de workspace devolvia `undefined`, diferente das outras 7 que
  // devolvem `null`) foi alinhada de propósito nesta rodada — agora devolve
  // `null` como as outras 7. O sucesso continua devolvendo `undefined`
  // (função efetivamente void pro chamador) — só a guarda mudou.
  it("sem workspace: devolve null (alinhado com as outras 7 — R2), repository nunca chamado", async () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: null, membership: null, loading: false, error: null } as never);
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });

    const returned = await result.current.deleteOpportunity("opp-1");

    expect(returned).toBeNull();
    expect(crmOpportunitiesRepository.deleteOpportunity).not.toHaveBeenCalled();
  });
});

describe("useSupabaseOpportunities · restoreDeletedOpportunity (comportamento atual — efeito colateral extra)", () => {
  it("sucesso: chama restoreSoftDeletedOpportunity, toast de sucesso, atualiza o cache com a resposta da própria mutation (G30), devolve a oportunidade restaurada", async () => {
    vi.mocked(crmOpportunitiesRepository.listOpportunities).mockResolvedValue([makeOpportunity({ id: "opp-1", title: "Antes de restaurar" })] as never);
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
    // DIVERGÊNCIA #1 (R2, G30): sem refetch — o cache já reflete "Restaurada".
    await waitFor(() => expect(result.current.opportunities[0].title).toBe("Restaurada"));
    expect(crmOpportunitiesRepository.listOpportunities).not.toHaveBeenCalled();
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
