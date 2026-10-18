// Etapa 9 · Item 4 (G101) — camada pura do controle de atribuição do painel de contato.
// O `invoke` é injetado (mesmo padrão de handover.test.ts).
import { describe, expect, it, vi } from "vitest";
import {
  ASSIGN_ORIGIN_NOT_RECORDED_DESCRIPTION,
  ASSIGN_ORIGIN_NOT_RECORDED_TITLE,
  NO_ASSIGNEE_LABEL,
  UNKNOWN_ASSIGNEE,
  assignConversation,
  assignableAttendants,
  assigneeName,
  assignmentLabel,
  attendantName,
  getAssignmentOrigin,
  isAssignableRole,
  listAttendants,
  parseAttendants,
  returnHint,
  type WorkspaceAttendant,
} from "@/lib/whatsapp/assignment";
import type { InvokeFn } from "@/lib/whatsapp/handover";
import { ASSIGNABLE_ROLES, isAssignableRole as serverIsAssignableRole } from "../../../../supabase/functions/_shared/botAssignment";

const team: WorkspaceAttendant[] = [
  { id: "u-ana", name: "Ana Lima", role: "member" },
  { id: "u-bia", name: "Bia Souza", role: "admin" },
  { id: "u-caio", name: "Caio Reis", role: "viewer" },
  { id: "u-dono", name: "Dora Dona", role: "owner" },
];

describe("elegibilidade — a MESMA do servidor (§3.5)", () => {
  it("é a função do servidor reexportada, não uma cópia: owner/admin/member sim, viewer não", () => {
    expect(isAssignableRole).toBe(serverIsAssignableRole);
    for (const role of ASSIGNABLE_ROLES) expect(isAssignableRole(role)).toBe(true);
    expect(isAssignableRole("viewer")).toBe(false);
  });

  it("assignableAttendants tira o viewer do Select mas o nome dele continua resolvendo", () => {
    expect(assignableAttendants(team).map((a) => a.id)).toEqual(["u-ana", "u-bia", "u-dono"]);
    expect(attendantName(team, "u-caio")).toBe("Caio Reis");
  });
});

describe("getAssignmentOrigin — leitura por unknown (coluna é DRAFT de migration)", () => {
  it("'auto' e 'manual' passam; ausente (coluna inexistente), null e lixo => null, sem lançar", () => {
    expect(getAssignmentOrigin({ assignment_origin: "auto" })).toBe("auto");
    expect(getAssignmentOrigin({ assignment_origin: "manual" })).toBe("manual");
    for (const bad of [{}, { assignment_origin: null }, { assignment_origin: "bot" }, { assignment_origin: 1 }, null, undefined, "x"]) {
      expect(getAssignmentOrigin(bad)).toBeNull();
    }
  });
});

describe("rótulos (G29) — o NOME real, nunca um genérico quando o nome é conhecido", () => {
  it("atribuída a quem está na lista: 'Atribuída a <nome>' + origem quando conhecida", () => {
    expect(assignmentLabel("u-ana", team, null)).toBe("Atribuída a Ana Lima");
    expect(assignmentLabel("u-ana", team, "auto")).toBe("Atribuída a Ana Lima (automática)");
    expect(assignmentLabel("u-ana", team, "manual")).toBe("Atribuída a Ana Lima (manual)");
  });

  it("dono que saiu do workspace (fora da lista): 'um atendente', sem inventar nome", () => {
    expect(assigneeName(team, "u-fantasma")).toBe(UNKNOWN_ASSIGNEE);
    expect(assignmentLabel("u-fantasma", team)).toBe("Atribuída a um atendente");
    expect(assignmentLabel("u-ana", [])).toBe("Atribuída a um atendente"); // lista não carregou
  });

  it("sem dono: 'Sem atendente atribuído' (null, undefined, vazio)", () => {
    for (const none of [null, undefined, ""]) expect(assignmentLabel(none, team, "auto")).toBe(NO_ASSIGNEE_LABEL);
  });

  it("returnHint: só com conversa entregue + dono + origem CONHECIDA (D2: devolver desfaz só a automática)", () => {
    expect(returnHint(true, "u-ana", "auto")).toMatch(/remove esta atribuição automática/);
    expect(returnHint(true, "u-ana", "manual")).toMatch(/não desfaz uma atribuição manual/);
    expect(returnHint(true, "u-ana", null)).toBeNull(); // coluna ausente: não afirma o que não sabe
    expect(returnHint(false, "u-ana", "manual")).toBeNull(); // não entregue: não há "Devolver"
    expect(returnHint(true, null, "auto")).toBeNull();
  });
});

describe("parseAttendants / listAttendants", () => {
  it("resposta do servidor -> lista tipada; item sem id é descartado, nome vazio vira 'Sem nome'", () => {
    expect(
      parseAttendants({
        ok: true,
        attendants: [{ id: "a", name: "Ana", role: "member" }, { id: "", name: "x", role: "member" }, { name: "sem id" }, null, { id: "b", name: "  ", role: 3 }],
      }),
    ).toEqual([
      { id: "a", name: "Ana", role: "member" },
      { id: "b", name: "Sem nome", role: "" },
    ]);
  });

  it("entrada ruim => lista vazia, nunca lança", () => {
    for (const bad of [null, undefined, "x", 1, {}, { attendants: "x" }, { attendants: {} }]) expect(parseAttendants(bad)).toEqual([]);
  });

  it("chama whatsapp-instance/list_attendants com o workspace e devolve a lista", async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { ok: true, attendants: [{ id: "a", name: "Ana", role: "admin" }] }, error: null });
    expect(await listAttendants(invoke as unknown as InvokeFn, "ws-1")).toEqual([{ id: "a", name: "Ana", role: "admin" }]);
    expect(invoke).toHaveBeenCalledWith("whatsapp-instance", { body: { action: "list_attendants", workspaceId: "ws-1" } });
  });

  it("DEGRADAÇÃO — erro de função ou invoke que lança => lista vazia (o Select só fica desabilitado)", async () => {
    expect(await listAttendants(vi.fn().mockResolvedValue({ data: null, error: new Error("403") }) as unknown as InvokeFn, "ws-1")).toEqual([]);
    expect(await listAttendants(vi.fn().mockRejectedValue(new Error("rede")) as unknown as InvokeFn, "ws-1")).toEqual([]);
  });
});

describe("assignConversation (ação assign_conversation)", () => {
  const call = (data: unknown, error: unknown = null) =>
    assignConversation(vi.fn().mockResolvedValue({ data, error }) as unknown as InvokeFn, "ws-1", "conv-1", "u-ana");

  it("envia workspace, conversa e o atendente (null remove a atribuição)", async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { ok: true, originRecorded: true }, error: null });
    await assignConversation(invoke as unknown as InvokeFn, "ws-1", "conv-1", "u-ana");
    await assignConversation(invoke as unknown as InvokeFn, "ws-1", "conv-1", null);
    expect(invoke).toHaveBeenNthCalledWith(1, "whatsapp-instance", {
      body: { action: "assign_conversation", workspaceId: "ws-1", conversationId: "conv-1", userId: "u-ana" },
    });
    expect(invoke).toHaveBeenNthCalledWith(2, "whatsapp-instance", {
      body: { action: "assign_conversation", workspaceId: "ws-1", conversationId: "conv-1", userId: null },
    });
  });

  it("origem registrada => originRecorded: true", async () => {
    expect(await call({ ok: true, originRecorded: true })).toEqual({ kind: "ok", originRecorded: true });
  });

  it("DEGRADAÇÃO — coluna assignment_origin ausente: atribuiu, mas originRecorded: false (a UI avisa)", async () => {
    expect(await call({ ok: true, originRecorded: false })).toEqual({ kind: "ok", originRecorded: false });
  });

  it("servidor sem o campo (ou corpo vazio) => originRecorded: true — não alarma sem saber", async () => {
    for (const data of [{ ok: true }, null, undefined, "ok"]) {
      expect(await call(data)).toEqual({ kind: "ok", originRecorded: true });
    }
  });

  it("erro 400/404/500: usa a mensagem REAL do corpo ({error}) em vez do genérico do supabase-js", async () => {
    const response = { json: async () => ({ error: "user is not an eligible attendant of this workspace" }) };
    const error = Object.assign(new Error("Edge Function returned a non-2xx status code"), { context: response });
    expect(await call(null, error)).toEqual({ kind: "error", message: "user is not an eligible attendant of this workspace" });
  });

  it("erro sem corpo legível => cai na mensagem do erro; sem nada => mensagem padrão; invoke que lança => error", async () => {
    expect(await call(null, new Error("Failed to fetch"))).toEqual({ kind: "error", message: "Failed to fetch" });
    const badBody = Object.assign(new Error("genérico"), { context: { json: async () => { throw new Error("não é json"); } } });
    expect(await call(null, badBody)).toEqual({ kind: "error", message: "genérico" });
    expect(await call(null, {})).toEqual({ kind: "error", message: "Falha ao atribuir a conversa." });
    const result = await assignConversation(vi.fn().mockRejectedValue(new Error("boom")) as unknown as InvokeFn, "ws-1", "conv-1", "u-ana");
    expect(result).toEqual({ kind: "error", message: "boom" });
  });
});

describe("aviso de degradação (origem não registrada)", () => {
  it("usa o vocabulário da tela e diz que 'Devolver ao robô' não vai desfazer", () => {
    expect(ASSIGN_ORIGIN_NOT_RECORDED_TITLE).toMatch(/origem não foi registrada/);
    expect(ASSIGN_ORIGIN_NOT_RECORDED_DESCRIPTION).toContain("Devolver ao robô");
    expect(ASSIGN_ORIGIN_NOT_RECORDED_DESCRIPTION).toMatch(/não vai desfazê-la/);
    expect(ASSIGN_ORIGIN_NOT_RECORDED_DESCRIPTION).toMatch(/migration/);
  });
});
