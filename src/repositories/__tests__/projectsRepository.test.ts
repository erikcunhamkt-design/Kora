// Etapa 5 · Fatia 7 (projects/tasks) — prova a GUARDA de source_local_id e a ÁRVORE DE
// DECISÃO de importProject (docs/qa/etapa-5-fatia-7-projects.md §7.2): projeto
// quote-linked usa o contrato de negócio já existente (findProjectByQuote/
// createProjectFromQuote, Etapa 3); qualquer outro usa o upsert geral, novo,
// não-parcial. Os dois nunca competem pela mesma operação.
import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const upsertSingle = vi.fn();
  const upsertSelect = vi.fn(() => ({ single: upsertSingle }));
  const upsert = vi.fn(() => ({ select: upsertSelect }));

  const updateSingle = vi.fn();
  const updateSelect = vi.fn(() => ({ single: updateSingle }));
  const updateEqWorkspace = vi.fn(() => ({ select: updateSelect }));
  const updateEqId = vi.fn(() => ({ eq: updateEqWorkspace }));
  const update = vi.fn(() => ({ eq: updateEqId }));

  const insertSingle = vi.fn();
  const insertSelect = vi.fn(() => ({ single: insertSingle }));
  const insert = vi.fn(() => ({ select: insertSelect }));

  const from = vi.fn(() => ({ upsert, update, insert }));
  return {
    upsertSingle, upsert, upsertSelect,
    updateSingle, update, updateSelect, updateEqId, updateEqWorkspace,
    insertSingle, insert,
    from,
  };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));

import { projectsRepository } from "@/repositories/projectsRepository";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("projectsRepository.importProject — guarda de source_local_id (código, não só o índice)", () => {
  it("rejeita source_local_id vazio ANTES de qualquer chamada ao banco", async () => {
    await expect(
      projectsRepository.importProject("ws1", "", { title: "x", source: "manual" }),
    ).rejects.toThrow(/source_local_id/);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejeita source_local_id só com espaços em branco", async () => {
    await expect(
      projectsRepository.importProject("ws1", "   ", { title: "x", source: "manual" }),
    ).rejects.toThrow(/source_local_id/);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});

describe("projectsRepository.updateProject — edição direta por id (Pacote do Flip, Fase B)", () => {
  it("chama update().eq(id).eq(workspace_id).select().single() com o patch dado", async () => {
    mocks.updateSingle.mockResolvedValue({ data: { id: "pj-1", status: "planning", archived: true }, error: null });

    const result = await projectsRepository.updateProject("ws1", "pj-1", { status: "planning", archived: true });

    expect(mocks.from).toHaveBeenCalledWith("projects");
    expect(mocks.update).toHaveBeenCalledWith({ status: "planning", archived: true });
    expect(mocks.updateEqId).toHaveBeenCalledWith("id", "pj-1");
    expect(mocks.updateEqWorkspace).toHaveBeenCalledWith("workspace_id", "ws1");
    expect(result).toEqual({ id: "pj-1", status: "planning", archived: true });
  });

  it("propaga erro do Supabase (nunca engole em silêncio)", async () => {
    mocks.updateSingle.mockResolvedValue({ data: null, error: { message: "boom", code: "500" } });

    await expect(
      projectsRepository.updateProject("ws1", "pj-1", { status: "planning" }),
    ).rejects.toThrow();
  });
});

describe("projectsRepository.importProject — árvore de decisão: caminho GERAL", () => {
  it('projeto source="manual" usa upsert(onConflict: workspace_id,source_local_id)', async () => {
    mocks.upsertSingle.mockResolvedValue({ data: { id: "pj-1" }, error: null });

    await projectsRepository.importProject("ws1", "install-x:pj-local-1", {
      title: "Projeto manual",
      source: "manual",
      budget: 100,
    });

    expect(mocks.from).toHaveBeenCalledWith("projects");
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace_id: "ws1",
        source_local_id: "install-x:pj-local-1",
        source: "manual",
      }),
      { onConflict: "workspace_id,source_local_id" },
    );
  });

  it('source="quote" SEM quote_id resolvido (mapper já traduziu para "manual" nesse caso, mas defensivo aqui também) usa o caminho geral', async () => {
    mocks.upsertSingle.mockResolvedValue({ data: { id: "pj-2" }, error: null });

    await projectsRepository.importProject("ws1", "install-x:pj-local-2", {
      title: "Sem quote de verdade",
      source: "quote",
      quote_id: null,
    });

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ source_local_id: "install-x:pj-local-2" }),
      { onConflict: "workspace_id,source_local_id" },
    );
  });
});

describe("projectsRepository.importProject — árvore de decisão: caminho QUOTE-LINKED", () => {
  it('source="quote" + quote_id resolvido: usa findProjectByQuote, NUNCA upsert(onConflict)', async () => {
    const findSpy = vi.spyOn(projectsRepository, "findProjectByQuote").mockResolvedValue([]);
    const createSpy = vi.spyOn(projectsRepository, "createProjectFromQuote")
      .mockResolvedValue({ id: "pj-novo" } as never);

    await projectsRepository.importProject("ws1", "install-x:pj-local-3", {
      title: "Projeto ligado a quote",
      source: "quote",
      quote_id: "quote-uuid-1",
      budget: 500,
    });

    expect(findSpy).toHaveBeenCalledWith("ws1", "quote-uuid-1");
    expect(createSpy).toHaveBeenCalledWith(
      "ws1",
      expect.objectContaining({ quote_id: "quote-uuid-1", source_local_id: "install-x:pj-local-3" }),
    );
    // O índice geral NUNCA é usado nesta linha — é o contrato de negócio da Etapa 3 que decide.
    expect(mocks.upsert).not.toHaveBeenCalled();

    findSpy.mockRestore();
    createSpy.mockRestore();
  });

  it("projeto JÁ existente para a mesma quote: reconhece via findProjectByQuote, faz backfill do source_local_id, NUNCA duplica", async () => {
    const findSpy = vi.spyOn(projectsRepository, "findProjectByQuote").mockResolvedValue([
      { id: "pj-existente", quote_id: "quote-uuid-1", source_local_id: null } as never,
    ]);
    const createSpy = vi.spyOn(projectsRepository, "createProjectFromQuote");
    mocks.updateSingle.mockResolvedValue({
      data: { id: "pj-existente", source_local_id: "install-x:pj-local-4" },
      error: null,
    });

    const result = await projectsRepository.importProject("ws1", "install-x:pj-local-4", {
      title: "Projeto duplicado (tentativa)",
      source: "quote",
      quote_id: "quote-uuid-1",
    });

    expect(createSpy).not.toHaveBeenCalled(); // nunca cria um segundo projeto pra mesma quote
    expect(mocks.update).toHaveBeenCalledWith({ source_local_id: "install-x:pj-local-4" });
    expect(mocks.updateEqId).toHaveBeenCalledWith("id", "pj-existente");
    expect(result).toEqual({ id: "pj-existente", source_local_id: "install-x:pj-local-4" });

    findSpy.mockRestore();
  });

  it("projeto já existente E já com source_local_id: devolve sem tocar o banco de novo (idempotente)", async () => {
    const findSpy = vi.spyOn(projectsRepository, "findProjectByQuote").mockResolvedValue([
      { id: "pj-existente", quote_id: "quote-uuid-1", source_local_id: "install-x:outro-local-id" } as never,
    ]);

    const result = await projectsRepository.importProject("ws1", "install-x:pj-local-5", {
      title: "Reimport idempotente",
      source: "quote",
      quote_id: "quote-uuid-1",
    });

    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(result).toEqual({ id: "pj-existente", quote_id: "quote-uuid-1", source_local_id: "install-x:outro-local-id" });

    findSpy.mockRestore();
  });
});

// G85 — createProjectFromQuote carregava `status: "active"` como default
// (alias legado, CLOUD_TO_LOCAL_PROJECT_STATUS). Depois do G85 nenhum caller
// omite `status` (importProject sempre manda o do mapper), mas o default
// continuava sendo um escritor latente do alias — agora é o vocabulário
// canônico ("planning"). A coluna do banco ainda tem DEFAULT 'active'
// (migration 20260601030000) — fora de escopo (DDL), não é alcançada por este
// caminho porque o repository sempre envia status.
describe("projectsRepository.createProjectFromQuote — vocabulário canônico (G85)", () => {
  it('sem status no input: grava "planning", NUNCA o alias legado "active"', async () => {
    mocks.insertSingle.mockResolvedValue({ data: { id: "pj-1" }, error: null });

    await projectsRepository.createProjectFromQuote("ws1", { quote_id: "q1", title: "T" });

    const written = (mocks.insert.mock.calls as unknown[][])[0][0] as Record<string, unknown>;
    expect(written.status).toBe("planning");
    expect(written.status).not.toBe("active");
    expect(written).toMatchObject({ workspace_id: "ws1", source: "quote", quote_id: "q1" });
  });

  it("status explícito no input (payload do mapper) continua prevalecendo sobre o default", async () => {
    mocks.insertSingle.mockResolvedValue({ data: { id: "pj-2" }, error: null });

    await projectsRepository.createProjectFromQuote("ws1", { quote_id: "q2", title: "T", status: "in_progress" });

    expect(((mocks.insert.mock.calls as unknown[][])[0][0] as Record<string, unknown>).status).toBe("in_progress");
  });
});
