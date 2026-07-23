// Etapa 5 · Fatia 7 (projects/tasks) — testes do hook: candidatos (demo ignorado,
// órfãs calculadas incl. o 4º map de projects), map gravado SÓ APÓS sucesso, e a
// garantia de ordem do §8.1: task nunca inventa project_id, só resolve via map ou
// vira órfã — em qualquer ordem, inclusive quando o projeto pai ainda não foi
// importado.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

import { useLocalTasksImport } from "@/hooks/useLocalTasksImport";
import type { ImportResult } from "@/hooks/useLocalTasksImport";
import { useTasks } from "@/hooks/useTasks";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { tasksRepository } from "@/repositories/tasksRepository";
import { getInstallId } from "@/lib/installId";

vi.mock("@/hooks/useTasks", () => ({ useTasks: vi.fn() }));
vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/repositories/tasksRepository", () => ({
  tasksRepository: { importTask: vi.fn() },
}));
vi.mock("@/lib/notify", () => ({ emitNotification: vi.fn() }));

const META_KEY = "kora.tasks.supabaseImport.v1";
const PROJECT_MAP_KEY = "kora.projects.supabaseImport.v1";

function makeLocalTasks() {
  return [
    {
      id: 1, title: "Tarefa solta", description: "", client: "", project: "",
      priority: "média", deadline: "18 Abr 2026", status: "a_fazer",
      createdAt: "2026-07-01T00:00:00Z", tags: [], subtasks: [], comments: [], isDemo: false,
      // sem projectId de propósito — tarefa solta, não deve virar órfã
    },
    {
      id: 2, title: "Demo", description: "", client: "", project: "",
      priority: "média", deadline: "18 Abr 2026", status: "a_fazer",
      createdAt: "2026-06-01T00:00:00Z", tags: [], subtasks: [], comments: [], isDemo: true, // ignorada
    },
    {
      id: 3, title: "Tarefa de projeto não importado", description: "", client: "", project: "",
      priority: "média", deadline: "18 Abr 2026", status: "a_fazer", projectId: "pj-nao-importado",
      createdAt: "2026-07-02T00:00:00Z", tags: [], subtasks: [], comments: [], isDemo: false,
    },
    {
      id: 4, title: "Já importada", description: "", client: "", project: "",
      priority: "média", deadline: "18 Abr 2026", status: "a_fazer",
      createdAt: "2026-06-15T00:00:00Z", tags: [], subtasks: [], comments: [], isDemo: false,
    },
  ];
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(useTasks).mockReturnValue({ tasks: makeLocalTasks() } as never);
  vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: { id: "ws1" } } as never);
  localStorage.setItem(META_KEY, JSON.stringify({
    lastImportedAt: "2026-07-01T00:00:00Z",
    importedLocalIds: ["4"],
    skippedLocalIds: [],
    importedMap: { "4": "cloud-uuid-tk-4" },
  }));
});

describe("useLocalTasksImport — candidatos e a garantia de ordem do §8.1", () => {
  it("ignora tarefas demo e classifica new/imported corretamente", async () => {
    const { result } = renderHook(() => useLocalTasksImport());
    await waitFor(() => expect(result.current.candidates.length).toBeGreaterThan(0));

    const ids = result.current.candidates.map((c) => String(c.localTask.id));
    expect(ids).not.toContain("2");
    expect(ids).toEqual(["1", "3", "4"]);

    const tk4 = result.current.candidates.find((c) => c.localTask.id === 4);
    expect(tk4?.status).toBe("imported");
  });

  it("tarefa SOLTA (sem projectId) NUNCA é órfã de projeto — é um caso de uso real, não uma falha", async () => {
    const { result } = renderHook(() => useLocalTasksImport());
    await waitFor(() => expect(result.current.candidates.length).toBeGreaterThan(0));

    const tk1 = result.current.candidates.find((c) => c.localTask.id === 1);
    expect(tk1?.projectOrphan).toBeFalsy();
  });

  it("tarefa com projectId presente mas AINDA não mapeado (projeto não importado) É órfã — nunca inventa project_id", async () => {
    // Sem nenhuma entrada em kora.projects.supabaseImport.v1 (projeto pai ainda não
    // foi importado nesta sessão) — mesmo cenário do §8.1: reexecução antes do
    // projeto pai existir no map.
    const { result } = renderHook(() => useLocalTasksImport());
    await waitFor(() => expect(result.current.candidates.length).toBeGreaterThan(0));

    const tk3 = result.current.candidates.find((c) => c.localTask.id === 3);
    expect(tk3?.projectOrphan).toBe(true);
  });

  it("depois que o projeto pai é mapeado, a mesma tarefa deixa de ser órfã (ordem sugerida, não travada)", async () => {
    localStorage.setItem(PROJECT_MAP_KEY, JSON.stringify({ importedMap: { "pj-nao-importado": "project-uuid-real" } }));

    const { result } = renderHook(() => useLocalTasksImport());
    await waitFor(() => expect(result.current.candidates.length).toBeGreaterThan(0));

    const tk3 = result.current.candidates.find((c) => c.localTask.id === 3);
    expect(tk3?.projectOrphan).toBe(false);
  });
});

describe("useLocalTasksImport — importSelected: project_id resolvido ou null, nunca inventado", () => {
  it("projeto pai já mapeado: project_id vira o uuid real no payload gravado", async () => {
    localStorage.setItem(PROJECT_MAP_KEY, JSON.stringify({ importedMap: { "pj-nao-importado": "project-uuid-real" } }));
    vi.mocked(tasksRepository.importTask).mockResolvedValue({ id: "cloud-uuid-novo" } as never);

    const { result } = renderHook(() => useLocalTasksImport());
    await waitFor(() => expect(result.current.candidates.length).toBeGreaterThan(0));

    await act(async () => {
      await result.current.importSelected(["3"]);
    });

    const call = vi.mocked(tasksRepository.importTask).mock.calls[0];
    expect(call[2].project_id).toBe("project-uuid-real");
  });

  it("projeto pai AINDA não mapeado: project_id vira null — nunca o id local cru, nunca inventado", async () => {
    vi.mocked(tasksRepository.importTask).mockResolvedValue({ id: "cloud-uuid-novo" } as never);

    const { result } = renderHook(() => useLocalTasksImport());
    await waitFor(() => expect(result.current.candidates.length).toBeGreaterThan(0));

    await act(async () => {
      await result.current.importSelected(["3"]);
    });

    const call = vi.mocked(tasksRepository.importTask).mock.calls[0];
    expect(call[2].project_id).toBeNull();
    expect(call[2].project_id).not.toBe("pj-nao-importado");
  });

  it("sucesso: grava importedMap com o id retornado pela nuvem, só após sucesso", async () => {
    vi.mocked(tasksRepository.importTask).mockResolvedValue({ id: "cloud-uuid-novo" } as never);

    const { result } = renderHook(() => useLocalTasksImport());
    await waitFor(() => expect(result.current.candidates.length).toBeGreaterThan(0));

    await act(async () => {
      await result.current.importSelected(["1"]);
    });

    const meta = JSON.parse(localStorage.getItem(META_KEY) || "{}");
    expect(meta.importedMap["1"]).toBe("cloud-uuid-novo");
  });

  it("monta source_local_id namespacado por installId", async () => {
    vi.mocked(tasksRepository.importTask).mockResolvedValue({ id: "cloud-uuid-novo" } as never);

    const { result } = renderHook(() => useLocalTasksImport());
    await waitFor(() => expect(result.current.candidates.length).toBeGreaterThan(0));

    await act(async () => {
      await result.current.importSelected(["1"]);
    });

    const call = vi.mocked(tasksRepository.importTask).mock.calls[0];
    expect(call[0]).toBe("ws1");
    expect(call[1]).toBe(`${getInstallId()}:1`);
  });

  it("falha parcial: NÃO grava importedMap da tarefa que falhou, e a reexecução da outra é isolada", async () => {
    vi.mocked(tasksRepository.importTask).mockImplementation(async (_ws, _sourceLocalId, input) => {
      if (input.title === "Tarefa solta") throw new Error("network down");
      return { id: "cloud-uuid-ok" } as never;
    });

    const { result } = renderHook(() => useLocalTasksImport());
    await waitFor(() => expect(result.current.candidates.length).toBeGreaterThan(0));

    let importResult: ImportResult = { successIds: [], failedIds: [] };
    await act(async () => {
      importResult = await result.current.importSelected(["1", "3"]);
    });

    expect(importResult.successIds).toEqual(["3"]);
    expect(importResult.failedIds).toEqual(["1"]);

    const meta = JSON.parse(localStorage.getItem(META_KEY) || "{}");
    expect(meta.importedMap["1"]).toBeUndefined();
    expect(meta.importedMap["3"]).toBe("cloud-uuid-ok");
  });
});

describe("useLocalTasksImport — rodada fix do bug (g): sinal persistido pendingLinks", () => {
  it("cenário exato da homologação: importada órfã -> projeto importado depois -> continua reselecionável -> reimport preenche o vínculo, mesmo id, nunca duplica", async () => {
    vi.mocked(tasksRepository.importTask).mockResolvedValue({ id: "cloud-uuid-tk3" } as never);

    const { result } = renderHook(() => useLocalTasksImport());
    await waitFor(() => expect(result.current.candidates.length).toBeGreaterThan(0));

    // 1. Importa a tarefa 3 com o projeto AINDA não mapeado (mesma ordem da homologação).
    await act(async () => {
      await result.current.importSelected(["3"]);
    });

    let tk3 = result.current.candidates.find((c) => c.localTask.id === 3);
    expect(tk3?.status).toBe("imported-orphan"); // NÃO "imported" travado

    // 2. Simula o projeto sendo importado DEPOIS (outra tela, mesmo localStorage).
    localStorage.setItem(PROJECT_MAP_KEY, JSON.stringify({ importedMap: { "pj-nao-importado": "project-uuid-real" } }));

    // 3. "Reabre o diálogo" (analyze de novo) — o sinal PERSISTIDO garante que o
    //    candidato continua reselecionável, ao contrário de um recálculo ao vivo
    //    (que já teria voltado a travar como "imported" simples aqui).
    act(() => {
      result.current.analyze();
    });
    await waitFor(() => {
      tk3 = result.current.candidates.find((c) => c.localTask.id === 3);
      expect(tk3?.status).toBe("imported-orphan");
    });

    // 4. Reimporta -> backfill via o mesmo upsert já homologado.
    await act(async () => {
      const reimportResult = await result.current.importSelected(["3"]);
      expect(reimportResult.successIds).toEqual(["3"]);
    });

    const calls = vi.mocked(tasksRepository.importTask).mock.calls;
    expect(calls.length).toBe(2); // 1ª tentativa (órfã) + reimport (backfill)
    expect(calls[1][2].project_id).toBe("project-uuid-real");

    const meta = JSON.parse(localStorage.getItem(META_KEY) || "{}");
    expect(meta.importedMap["3"]).toBe("cloud-uuid-tk3"); // MESMO id nas duas vezes
    expect(meta.importedLocalIds.filter((id: string) => id === "3")).toHaveLength(1); // sem duplicata no array
    expect(meta.pendingLinks || []).not.toContain("3"); // pendência resolvida, sai da lista

    tk3 = result.current.candidates.find((c) => c.localTask.id === 3);
    expect(tk3?.status).toBe("imported"); // agora sim resolvido de vez, sem pendência
  });

  it("caso negativo: tarefa importada SEM pendência nunca volta a ser elegível", async () => {
    // Tarefa 4 (beforeEach): já "imported", sem projectId — nunca teve pendência de vínculo.
    const { result } = renderHook(() => useLocalTasksImport());
    await waitFor(() => expect(result.current.candidates.length).toBeGreaterThan(0));

    const tk4 = result.current.candidates.find((c) => c.localTask.id === 4);
    expect(tk4?.status).toBe("imported"); // nunca "imported-orphan"

    const reimportResult = await result.current.importSelected(["4"]);
    expect(reimportResult.successIds).toEqual([]);
    expect(reimportResult.failedIds).toEqual([]);
    expect(tasksRepository.importTask).not.toHaveBeenCalled();
  });

  it("migração suave: tarefa já importada ANTES do fix (sem pendingLinks no meta), ainda órfã hoje, ganha o sinal na primeira análise", async () => {
    // Meta no formato ANTIGO (pré-fix) — sem a chave pendingLinks, tarefa 3 já
    // marcada "imported" mas o projeto nunca foi mapeado.
    localStorage.setItem(META_KEY, JSON.stringify({
      lastImportedAt: "2026-07-01T00:00:00Z",
      importedLocalIds: ["3", "4"],
      skippedLocalIds: [],
      importedMap: { "3": "cloud-uuid-tk3-legado", "4": "cloud-uuid-tk-4" },
      // pendingLinks ausente de propósito — simula dado gravado antes deste fix existir.
    }));

    const { result } = renderHook(() => useLocalTasksImport());
    await waitFor(() => expect(result.current.candidates.length).toBeGreaterThan(0));

    const tk3 = result.current.candidates.find((c) => c.localTask.id === 3);
    expect(tk3?.status).toBe("imported-orphan"); // migrado automaticamente, não fica preso

    const meta = JSON.parse(localStorage.getItem(META_KEY) || "{}");
    expect(meta.pendingLinks).toContain("3");
  });
});
