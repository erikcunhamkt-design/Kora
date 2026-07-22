// Etapa 5 · Fatia 7 (projects/tasks) — testes do hook: candidatos (demo ignorado,
// órfãs calculadas), map gravado SÓ APÓS sucesso, e isolamento de erro entre
// candidatos.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

import { useLocalProjectsImport } from "@/hooks/useLocalProjectsImport";
import type { ImportResult } from "@/hooks/useLocalProjectsImport";
import { useProjects } from "@/hooks/useProjects";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { projectsRepository } from "@/repositories/projectsRepository";
import { getInstallId } from "@/lib/installId";

vi.mock("@/hooks/useProjects", () => ({ useProjects: vi.fn() }));
vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/repositories/projectsRepository", () => ({
  projectsRepository: { importProject: vi.fn() },
}));
vi.mock("@/lib/notify", () => ({ emitNotification: vi.fn() }));

const META_KEY = "kora.projects.supabaseImport.v1";

function makeLocalProjects() {
  return [
    {
      id: "pj-1", name: "Rebranding", status: "in_progress", priority: "high", progress: 50,
      tags: [], createdAt: "2026-07-01T00:00:00Z", isDemo: false, source: "manual",
    },
    {
      id: "pj-2", name: "Demo", status: "planning", priority: "medium", progress: 0,
      tags: [], createdAt: "2026-06-01T00:00:00Z", isDemo: true, // deve ser ignorada
    },
    {
      id: "pj-3", name: "Projeto de orçamento", status: "planning", priority: "medium",
      progress: 0, clientId: 999, quoteId: "qt-desconhecida", opportunityId: 999, // órfãs de propósito
      tags: [], createdAt: "2026-07-02T00:00:00Z", isDemo: false, source: "orçamento",
    },
    {
      id: "pj-4", name: "Já importado", status: "planning", priority: "medium", progress: 0,
      tags: [], createdAt: "2026-06-15T00:00:00Z", isDemo: false, source: "manual",
    },
  ];
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(useProjects).mockReturnValue({ projects: makeLocalProjects() } as never);
  vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: { id: "ws1" } } as never);
  localStorage.setItem(META_KEY, JSON.stringify({
    lastImportedAt: "2026-07-01T00:00:00Z",
    importedLocalIds: ["pj-4"],
    skippedLocalIds: [],
    importedMap: { "pj-4": "cloud-uuid-pj-4" },
  }));
});

describe("useLocalProjectsImport — candidatos", () => {
  it("ignora projetos demo e classifica new/imported corretamente", async () => {
    const { result } = renderHook(() => useLocalProjectsImport());
    await waitFor(() => expect(result.current.candidates.length).toBeGreaterThan(0));

    const ids = result.current.candidates.map((c) => c.localProject.id);
    expect(ids).not.toContain("pj-2");
    expect(ids).toEqual(["pj-1", "pj-3", "pj-4"]);

    const pj4 = result.current.candidates.find((c) => c.localProject.id === "pj-4");
    expect(pj4?.status).toBe("imported");
    const pj1 = result.current.candidates.find((c) => c.localProject.id === "pj-1");
    expect(pj1?.status).toBe("new");
  });

  it("calcula clientOrphan/quoteOrphan/opportunityOrphan quando os ids locais não estão mapeados", async () => {
    const { result } = renderHook(() => useLocalProjectsImport());
    await waitFor(() => expect(result.current.candidates.length).toBeGreaterThan(0));

    const pj3 = result.current.candidates.find((c) => c.localProject.id === "pj-3");
    expect(pj3?.clientOrphan).toBe(true);
    expect(pj3?.quoteOrphan).toBe(true);
    expect(pj3?.opportunityOrphan).toBe(true);
  });
});

describe("useLocalProjectsImport — importSelected grava o map SÓ APÓS sucesso", () => {
  it("sucesso: grava importedMap com o id retornado pela nuvem", async () => {
    vi.mocked(projectsRepository.importProject).mockResolvedValue({ id: "cloud-uuid-novo" } as never);

    const { result } = renderHook(() => useLocalProjectsImport());
    await waitFor(() => expect(result.current.candidates.length).toBeGreaterThan(0));

    await act(async () => {
      await result.current.importSelected(["pj-1"]);
    });

    const meta = JSON.parse(localStorage.getItem(META_KEY) || "{}");
    expect(meta.importedMap["pj-1"]).toBe("cloud-uuid-novo");
  });

  it("monta source_local_id namespacado por installId ao chamar o repository", async () => {
    vi.mocked(projectsRepository.importProject).mockResolvedValue({ id: "cloud-uuid-novo" } as never);

    const { result } = renderHook(() => useLocalProjectsImport());
    await waitFor(() => expect(result.current.candidates.length).toBeGreaterThan(0));

    await act(async () => {
      await result.current.importSelected(["pj-1"]);
    });

    const call = vi.mocked(projectsRepository.importProject).mock.calls[0];
    expect(call[0]).toBe("ws1");
    expect(call[1]).toBe(`${getInstallId()}:pj-1`);
  });

  it("falha: NÃO grava importedMap, e o erro de um candidato não afeta o outro", async () => {
    vi.mocked(projectsRepository.importProject).mockImplementation(async (_ws, _sourceLocalId, input) => {
      if (input.title === "Rebranding") throw new Error("network down");
      return { id: "cloud-uuid-ok" } as never;
    });

    const { result } = renderHook(() => useLocalProjectsImport());
    await waitFor(() => expect(result.current.candidates.length).toBeGreaterThan(0));

    let importResult: ImportResult = { successIds: [], failedIds: [] };
    await act(async () => {
      importResult = await result.current.importSelected(["pj-1", "pj-3"]);
    });

    expect(importResult.successIds).toEqual(["pj-3"]);
    expect(importResult.failedIds).toEqual(["pj-1"]);

    const meta = JSON.parse(localStorage.getItem(META_KEY) || "{}");
    expect(meta.importedMap["pj-1"]).toBeUndefined();
    expect(meta.importedMap["pj-3"]).toBe("cloud-uuid-ok");
  });
});
