// Etapa 5 · Pacote do Flip (projects) — Fase B, item 2. Prova o hook
// compartilhado pelos 4 consumidores fora da tela principal (Central do
// Dia, ficha do cliente, timeline, log manual) — mesma matriz dual-mode da
// tela principal, sem repetir o teste em cada um dos 4 arquivos.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import { useBifurcatedProjects } from "@/hooks/useBifurcatedProjects";
import { useProjects, type Project } from "@/hooks/useProjects";
import { useSupabaseProjectsSummary } from "@/hooks/useSupabaseProjectsSummary";
import { useClientsDataSource } from "@/hooks/useClientsDataSource";
import { PROJECTS_DATA_SOURCE_KEY } from "@/config/flags";

vi.mock("@/hooks/useProjects", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useProjects")>("@/hooks/useProjects");
  return { ...actual, useProjects: vi.fn() };
});
vi.mock("@/hooks/useSupabaseProjectsSummary", () => ({ useSupabaseProjectsSummary: vi.fn() }));
vi.mock("@/hooks/useClientsDataSource", () => ({ useClientsDataSource: vi.fn() }));

function makeLocalProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "pj-local-1", name: "Projeto Local", clientName: "Cliente Local",
    status: "in_progress", priority: "medium", progress: 40, tags: [],
    createdAt: "2026-07-01", isDemo: false, source: "manual",
    ...overrides,
  };
}

function makeSupabaseProjectRaw(overrides: Record<string, unknown> = {}) {
  return {
    id: "sp-cloud-1", workspace_id: "ws1", title: "Projeto Nuvem",
    status: "planning", client_id: "uuid-client-1", is_demo: false, archived: false,
    created_at: "2026-07-20T00:00:00Z", updated_at: "2026-07-20T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(useClientsDataSource).mockReturnValue({
    clients: [{ id: "uuid-client-1", name: "Acme Corp" }],
  } as never);
});

// Etapa 5 · Pacote do Flip (Fase C) — getProjectsDataSource() default virou
// "supabase" (só "local" explícito escolhe local, mesmo formato do CRM/
// quotes). Este describe passou de "default" pra "explícito": o teste
// agora grava "local" no seletor antes de renderizar, provando que a
// escolha explícita continua funcionando — não mais o cenário de "seletor
// nunca tocado", que agora mostra nuvem (primeiro teste do describe abaixo).
describe("useBifurcatedProjects — modo local (explícito)", () => {
  it("devolve os projetos locais quando o seletor está explicitamente em 'local'", () => {
    localStorage.setItem(PROJECTS_DATA_SOURCE_KEY, "local");
    vi.mocked(useProjects).mockReturnValue({ projects: [makeLocalProject()] } as never);
    vi.mocked(useSupabaseProjectsSummary).mockReturnValue({ projects: [] } as never);

    const { result } = renderHook(() => useBifurcatedProjects());

    expect(result.current).toHaveLength(1);
    expect(result.current[0].name).toBe("Projeto Local");
  });
});

describe("useBifurcatedProjects — modo Supabase", () => {
  it("devolve os projetos da nuvem quando o seletor nunca foi tocado (novo default, Pacote do Flip)", () => {
    vi.mocked(useProjects).mockReturnValue({ projects: [] } as never);
    vi.mocked(useSupabaseProjectsSummary).mockReturnValue({
      projects: [makeSupabaseProjectRaw()],
    } as never);

    const { result } = renderHook(() => useBifurcatedProjects());

    expect(result.current).toHaveLength(1);
    expect(result.current[0].name).toBe("Projeto Nuvem");
  });

  it("devolve os projetos da nuvem MAPEADOS quando o seletor está em 'supabase' (explícito)", () => {
    localStorage.setItem(PROJECTS_DATA_SOURCE_KEY, "supabase");
    vi.mocked(useProjects).mockReturnValue({ projects: [makeLocalProject()] } as never);
    vi.mocked(useSupabaseProjectsSummary).mockReturnValue({
      projects: [makeSupabaseProjectRaw()],
    } as never);

    const { result } = renderHook(() => useBifurcatedProjects());

    expect(result.current).toHaveLength(1);
    expect(result.current[0].name).toBe("Projeto Nuvem");
    // clientName resolvido via useClientsDataSource — não uuid cru, não vazio.
    expect(result.current[0].clientName).toBe("Acme Corp");
  });

  it("traduz status 'active' (alias legado) igual ao mapper isolado — mesmo caminho da tela principal", () => {
    localStorage.setItem(PROJECTS_DATA_SOURCE_KEY, "supabase");
    vi.mocked(useProjects).mockReturnValue({ projects: [] } as never);
    vi.mocked(useSupabaseProjectsSummary).mockReturnValue({
      projects: [makeSupabaseProjectRaw({ status: "active" })],
    } as never);

    const { result } = renderHook(() => useBifurcatedProjects());

    expect(result.current[0].status).toBe("in_progress");
  });
});
