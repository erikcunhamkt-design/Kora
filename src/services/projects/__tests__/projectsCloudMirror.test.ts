// Etapa 5 · Flip Projetos (item 4/5) — espelho best-effort local -> nuvem da
// tela principal. Prova: idempotência (mesmo source_local_id em chamadas
// repetidas), import-map gravado só após sucesso (mesmo padrão de
// useLocalProjectsImport.ts), e falha propagada (nunca engolida) pro
// chamador decidir o toast.
import { describe, it, expect, beforeEach, vi } from "vitest";

import { mirrorProjectToSupabase } from "@/services/projects/projectsCloudMirror";
import { projectsRepository } from "@/repositories/projectsRepository";
import { getInstallId } from "@/lib/installId";
import type { Project } from "@/hooks/useProjects";

vi.mock("@/repositories/projectsRepository", () => ({
  projectsRepository: { importProject: vi.fn() },
}));

const META_KEY = "kora.projects.supabaseImport.v1";

function baseProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "pj-local-1",
    name: "Rebranding",
    clientName: "Acme",
    status: "in_progress",
    priority: "medium",
    progress: 50,
    tags: [],
    createdAt: "2026-07-01T00:00:00Z",
    isDemo: false,
    source: "manual",
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("mirrorProjectToSupabase — idempotência", () => {
  it("usa source_local_id = installId:localId — estável entre chamadas repetidas", async () => {
    vi.mocked(projectsRepository.importProject).mockResolvedValue({ id: "cloud-uuid-1" } as never);
    const project = baseProject();
    const installId = getInstallId();

    await mirrorProjectToSupabase("ws1", project);
    await mirrorProjectToSupabase("ws1", project);

    expect(projectsRepository.importProject).toHaveBeenCalledTimes(2);
    const [call1SourceLocalId] = vi.mocked(projectsRepository.importProject).mock.calls[0].slice(1);
    const [call2SourceLocalId] = vi.mocked(projectsRepository.importProject).mock.calls[1].slice(1);
    expect(call1SourceLocalId).toBe(`${installId}:pj-local-1`);
    expect(call2SourceLocalId).toBe(call1SourceLocalId);
  });

  it("chama projectsRepository.importProject com o payload traduzido (mapLocalProjectToSupabase)", async () => {
    vi.mocked(projectsRepository.importProject).mockResolvedValue({ id: "cloud-uuid-1" } as never);
    const project = baseProject({ name: "Website", budget: 1000, status: "planning" });

    await mirrorProjectToSupabase("ws1", project);

    const [workspaceId, , payload] = vi.mocked(projectsRepository.importProject).mock.calls[0];
    expect(workspaceId).toBe("ws1");
    expect(payload).toMatchObject({ title: "Website", budget: 1000, status: "planning" });
  });
});

describe("mirrorProjectToSupabase — import-map (kora.projects.supabaseImport.v1)", () => {
  it("grava o import-map SÓ APÓS sucesso — localId -> cloudId", async () => {
    vi.mocked(projectsRepository.importProject).mockResolvedValue({ id: "cloud-uuid-1" } as never);
    const project = baseProject({ id: "pj-99" });

    await mirrorProjectToSupabase("ws1", project);

    const meta = JSON.parse(localStorage.getItem(META_KEY) as string);
    expect(meta.importedMap["pj-99"]).toBe("cloud-uuid-1");
    expect(meta.importedLocalIds).toContain("pj-99");
  });

  it("preserva entradas de OUTROS projetos já no import-map (nunca sobrescreve o mapa inteiro)", async () => {
    localStorage.setItem(META_KEY, JSON.stringify({
      lastImportedAt: "2026-07-01T00:00:00Z",
      importedLocalIds: ["pj-existente"],
      skippedLocalIds: [],
      importedMap: { "pj-existente": "cloud-uuid-existente" },
    }));
    vi.mocked(projectsRepository.importProject).mockResolvedValue({ id: "cloud-uuid-novo" } as never);

    await mirrorProjectToSupabase("ws1", baseProject({ id: "pj-novo" }));

    const meta = JSON.parse(localStorage.getItem(META_KEY) as string);
    expect(meta.importedMap["pj-existente"]).toBe("cloud-uuid-existente");
    expect(meta.importedMap["pj-novo"]).toBe("cloud-uuid-novo");
  });

  it("upsert de atualização: reimportar o MESMO projeto atualiza a mesma entrada, não duplica", async () => {
    vi.mocked(projectsRepository.importProject).mockResolvedValueOnce({ id: "cloud-uuid-1" } as never);
    await mirrorProjectToSupabase("ws1", baseProject({ id: "pj-1" }));

    vi.mocked(projectsRepository.importProject).mockResolvedValueOnce({ id: "cloud-uuid-1" } as never);
    await mirrorProjectToSupabase("ws1", baseProject({ id: "pj-1", status: "delivered" }));

    const meta = JSON.parse(localStorage.getItem(META_KEY) as string);
    expect(meta.importedMap["pj-1"]).toBe("cloud-uuid-1");
    expect(meta.importedLocalIds.filter((id: string) => id === "pj-1")).toHaveLength(1);
  });
});

describe("mirrorProjectToSupabase — falha de nuvem", () => {
  it("propaga o erro pro chamador (nunca engole em silêncio)", async () => {
    vi.mocked(projectsRepository.importProject).mockRejectedValue(new Error("network down"));

    await expect(mirrorProjectToSupabase("ws1", baseProject())).rejects.toThrow("network down");
  });

  it("NÃO grava import-map quando a chamada falha", async () => {
    vi.mocked(projectsRepository.importProject).mockRejectedValue(new Error("network down"));

    await expect(mirrorProjectToSupabase("ws1", baseProject({ id: "pj-fail" }))).rejects.toThrow();

    expect(localStorage.getItem(META_KEY)).toBeNull();
  });
});
