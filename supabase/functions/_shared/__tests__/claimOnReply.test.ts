// Etapa 9 · Item 4 (G102) — "assumir ao responder": a decisão e a degradação.
// Lógica pura com acesso a dados injetado. A fiação nos 4 inserts de whatsapp-instance é
// provada em instanceClaimWiring.test.ts (leitura do fonte).
import { describe, expect, it, vi } from "vitest";
import { buildAutoAssignmentUpdate } from "../botAssignment";
import { buildClaimUpdate, claimConversationOnReply, decideClaimOnReply, type ClaimDeps } from "../claimOnReply";

const HANDED = "2026-10-02T12:00:00.000Z";

describe("decideClaimOnReply — quando a resposta assume a conversa", () => {
  it("entregue (handover_at) + sem dono + remetente que atende + envio ok => assume", () => {
    for (const role of ["owner", "admin", "member"]) {
      expect(decideClaimOnReply({ conversation: { handover_at: HANDED, assigned_to: null }, senderRole: role, sendOk: true })).toEqual({
        claim: true,
      });
    }
  });

  it("linha SEM a chave assigned_to também conta como sem dono", () => {
    expect(decideClaimOnReply({ conversation: { handover_at: HANDED }, senderRole: "member", sendOk: true })).toEqual({ claim: true });
  });

  it("NÃO entregue => nunca assume (null, ausente — inclui coluna handover_at inexistente —, vazio, lixo)", () => {
    for (const handover_at of [null, undefined, "", 0, true, {}]) {
      expect(decideClaimOnReply({ conversation: { handover_at, assigned_to: null }, senderRole: "admin", sendOk: true })).toEqual({
        claim: false,
        reason: "not-handed-over",
      });
    }
  });

  it("NÃO pisa em atribuição existente, de qualquer origem", () => {
    expect(decideClaimOnReply({ conversation: { handover_at: HANDED, assigned_to: "outra-pessoa" }, senderRole: "admin", sendOk: true })).toEqual({
      claim: false,
      reason: "already-assigned",
    });
  });

  it("viewer (ou papel desconhecido/ausente) não vira dono", () => {
    for (const role of ["viewer", "", undefined, null, 7]) {
      expect(decideClaimOnReply({ conversation: { handover_at: HANDED, assigned_to: null }, senderRole: role, sendOk: true })).toEqual({
        claim: false,
        reason: "sender-not-assignable",
      });
    }
  });

  it("envio que FALHOU não responde nada ao cliente => não assume (o badge continua dizendo a verdade)", () => {
    expect(decideClaimOnReply({ conversation: { handover_at: HANDED, assigned_to: null }, senderRole: "admin", sendOk: false })).toEqual({
      claim: false,
      reason: "send-failed",
    });
  });

  it("conversa que não é objeto (null/undefined/string) => não entregue, sem lançar", () => {
    for (const bad of [null, undefined, "c", 3]) {
      expect(decideClaimOnReply({ conversation: bad, senderRole: "admin", sendOk: true })).toEqual({ claim: false, reason: "not-handed-over" });
    }
  });
});

function makeDeps(write?: ClaimDeps["writeClaim"]) {
  const writeClaim = vi.fn(write ?? (async () => ({ applied: true, error: null })));
  return { writeClaim } as { writeClaim: ReturnType<typeof vi.fn> } & ClaimDeps;
}
const eligible = { conversation: { handover_at: HANDED, assigned_to: null }, senderId: "ana", senderRole: "member", sendOk: true };

describe("claimConversationOnReply", () => {
  it("assume: UMA escrita, com o id do remetente", async () => {
    const deps = makeDeps();
    expect(await claimConversationOnReply(eligible, deps)).toEqual({ kind: "claimed", userId: "ana" });
    expect(deps.writeClaim).toHaveBeenCalledTimes(1);
    expect(deps.writeClaim).toHaveBeenCalledWith("ana");
  });

  it("não elegível => 'skipped' e NENHUMA escrita (nem consulta)", async () => {
    const cases = [
      { ...eligible, conversation: { handover_at: null, assigned_to: null } },
      { ...eligible, conversation: { handover_at: HANDED, assigned_to: "outra" } },
      { ...eligible, senderRole: "viewer" },
      { ...eligible, sendOk: false },
    ];
    for (const c of cases) {
      const deps = makeDeps();
      expect((await claimConversationOnReply(c, deps)).kind).toBe("skipped");
      expect(deps.writeClaim).not.toHaveBeenCalled();
    }
  });

  it("o UPDATE condicional não pegou linha (alguém atribuiu ou devolveu no meio): 'lost-race', sem erro", async () => {
    const deps = makeDeps(async () => ({ applied: false, error: null }));
    expect(await claimConversationOnReply(eligible, deps)).toEqual({ kind: "lost-race" });
  });

  it("DEGRADAÇÃO — coluna assignment_origin ausente: a escrita ÚNICA falha => 'unavailable', sem retry nem segunda escrita", async () => {
    const deps = makeDeps(async () => ({
      applied: false,
      error: "Could not find the 'assignment_origin' column of 'whatsapp_conversations' in the schema cache",
    }));
    const r = await claimConversationOnReply(eligible, deps);

    expect(r).toMatchObject({ kind: "unavailable" });
    expect((r as { detail: string }).detail).toMatch(/assignment_origin/);
    expect(deps.writeClaim).toHaveBeenCalledTimes(1);
  });

  it("escrita que LANÇA => 'unavailable' (nunca derruba a resposta do atendente)", async () => {
    const deps = makeDeps(async () => {
      throw new Error("rede");
    });
    expect(await claimConversationOnReply(eligible, deps)).toEqual({ kind: "unavailable", detail: "rede" });
  });
});

describe("buildClaimUpdate — mesma escrita atômica da atribuição do handover", () => {
  it("assigned_to + assignment_origin='auto' no MESMO objeto (coluna ausente => nada é gravado)", () => {
    expect(buildClaimUpdate("ana", "2026-10-02T12:00:00Z")).toEqual({
      assigned_to: "ana",
      assignment_origin: "auto",
      updated_at: "2026-10-02T12:00:00Z",
    });
    expect(buildClaimUpdate).toBe(buildAutoAssignmentUpdate);
  });
});
