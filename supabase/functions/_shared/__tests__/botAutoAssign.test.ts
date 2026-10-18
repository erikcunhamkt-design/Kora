// Etapa 9 · Item 4 — ATRIBUIÇÃO AUTOMÁTICA no handover (G48; decisão D1 do revisor,
// docs/architecture/etapa-9-handover-assigned-to-proposta.md §10) + resultado da
// devolução (D2). Lógica pura com acesso a dados INJETADO: tudo aqui roda sem banco.
// Contrato central: coluna `assignment_origin` AUSENTE => NADA é atribuído (só entrega).
import { describe, expect, it, vi } from "vitest";
import {
  autoAssignOnHandover,
  buildAutoAssignmentUpdate,
  computeReturnOutcome,
  effectiveRespondAll,
  isAssignableRole,
  parseAssignmentSnapshot,
  pickLastHumanResponder,
  resolveRespondAllFromSettings,
  type AutoAssignDeps,
} from "../botAssignment";

const out = (sender_id: string | null | undefined, created_at: string, extra: Record<string, unknown> = {}) => ({
  direction: "outbound",
  sender_id,
  created_at,
  ...extra,
});

describe("pickLastHumanResponder — a regra do 'último que respondeu'", () => {
  it("COM sender_id: devolve o autor da mensagem de saída mais recente", () => {
    expect(
      pickLastHumanResponder([out("ana", "2026-10-01T10:00:00Z"), out("bia", "2026-10-01T11:00:00Z"), out("ana", "2026-10-01T09:00:00Z")]),
    ).toBe("bia");
  });

  it("independe da ordem em que as linhas chegam", () => {
    const rows = [out("ana", "2026-10-01T10:00:00Z"), out("bia", "2026-10-01T11:00:00Z"), out("caio", "2026-10-01T10:30:00Z")];
    expect(pickLastHumanResponder(rows)).toBe("bia");
    expect(pickLastHumanResponder([...rows].reverse())).toBe("bia");
  });

  it("SEM nenhum sender_id (mensagens de antes da correção): ninguém => null", () => {
    expect(pickLastHumanResponder([out(null, "2026-10-01T10:00:00Z"), out(undefined, "2026-10-01T11:00:00Z")])).toBeNull();
  });

  it("ROBÔ ignorado: a cortesia do handover (saída sem autor) NUNCA vira o 'último atendente'", () => {
    // o humano falou antes; o robô mandou a cortesia DEPOIS (a mais recente) — ela não conta
    expect(pickLastHumanResponder([out("ana", "2026-10-01T10:00:00Z"), out(null, "2026-10-01T10:05:00Z")])).toBe("ana");
    // só o robô falou => ninguém
    expect(pickLastHumanResponder([out(null, "2026-10-01T10:05:00Z")])).toBeNull();
  });

  it("fromMe do celular (saída gravada pelo webhook, sem autor) é ignorado", () => {
    expect(
      pickLastHumanResponder([
        out("ana", "2026-10-01T10:00:00Z"),
        out(null, "2026-10-01T12:00:00Z", { type: "text", status: "sent", raw_payload: { fromMe: true } }),
      ]),
    ).toBe("ana");
  });

  it("entrada (cliente) nunca conta, mesmo que a linha traga sender_id", () => {
    expect(pickLastHumanResponder([{ direction: "inbound", sender_id: "cliente", created_at: "2026-10-01T12:00:00Z" }])).toBeNull();
  });

  it("sender_id vazio ou não-string é ignorado; entrada que não é lista => null (sem lançar)", () => {
    expect(pickLastHumanResponder([out("", "2026-10-01T10:00:00Z"), { direction: "outbound", sender_id: 7, created_at: "2026-10-01T10:00:00Z" }])).toBeNull();
    for (const bad of [undefined, null, "x", 1, {}, [null, "x", 3]]) expect(pickLastHumanResponder(bad)).toBeNull();
  });

  it("data ausente/inválida vale como a mais antiga: uma data boa sempre ganha", () => {
    expect(pickLastHumanResponder([out("ana", "lixo"), out("bia", "2026-10-01T10:00:00Z"), out("caio", undefined as unknown as string)])).toBe("bia");
  });

  it("mensagem com status de erro (envio falhou) ainda é do atendente que tentou responder", () => {
    expect(pickLastHumanResponder([out("ana", "2026-10-01T10:00:00Z", { status: "error" })])).toBe("ana");
  });
});

describe("buildAutoAssignmentUpdate — UM update só, origem junto", () => {
  it("grava assigned_to E assignment_origin='auto' no MESMO objeto (atômico: coluna ausente => nada é gravado)", () => {
    expect(buildAutoAssignmentUpdate("ana", "2026-10-02T12:00:00Z")).toEqual({
      assigned_to: "ana",
      assignment_origin: "auto",
      updated_at: "2026-10-02T12:00:00Z",
    });
  });
});

function makeDeps(overrides: Partial<AutoAssignDeps> = {}) {
  const deps = {
    fetchHumanOutbound: vi.fn(async () => ({ rows: [out("ana", "2026-10-01T10:00:00Z")], error: null })),
    isEligibleAssignee: vi.fn(async () => ({ eligible: true, error: null })),
    writeAutoAssignment: vi.fn(async () => ({ applied: true, error: null })),
    ...overrides,
  };
  return deps as typeof deps & AutoAssignDeps;
}

describe("isAssignableRole — quem pode virar dono (proposta §3.5)", () => {
  it("owner, admin e member atendem; viewer e o resto, não", () => {
    for (const ok of ["owner", "admin", "member"]) expect(isAssignableRole(ok)).toBe(true);
    for (const no of ["viewer", "", "OWNER", null, undefined, 1, {}]) expect(isAssignableRole(no)).toBe(false);
  });
});

describe("autoAssignOnHandover", () => {
  it("há atendente humano que respondeu: atribui a ele (UMA escrita, com o id certo)", async () => {
    const deps = makeDeps({ fetchHumanOutbound: vi.fn(async () => ({ rows: [out("ana", "2026-10-01T10:00:00Z"), out("bia", "2026-10-01T11:00:00Z")], error: null })) });
    const r = await autoAssignOnHandover({ currentAssignedTo: null }, deps);

    expect(r).toEqual({ kind: "assigned", userId: "bia" });
    expect(deps.isEligibleAssignee).toHaveBeenCalledWith("bia");
    expect(deps.writeAutoAssignment).toHaveBeenCalledTimes(1);
    expect(deps.writeAutoAssignment).toHaveBeenCalledWith("bia");
  });

  it("ninguém respondeu (sem sender_id / só robô): fica NÃO atribuída — nenhuma checagem, nenhuma escrita", async () => {
    const deps = makeDeps({ fetchHumanOutbound: vi.fn(async () => ({ rows: [out(null, "2026-10-01T10:00:00Z")], error: null })) });
    const r = await autoAssignOnHandover({ currentAssignedTo: undefined }, deps);

    expect(r).toEqual({ kind: "no-responder" });
    expect(deps.isEligibleAssignee).not.toHaveBeenCalled();
    expect(deps.writeAutoAssignment).not.toHaveBeenCalled();
  });

  it("a conversa JÁ tem dono: não pisa (nem lê mensagens)", async () => {
    const deps = makeDeps();
    const r = await autoAssignOnHandover({ currentAssignedTo: "dono-manual" }, deps);

    expect(r).toEqual({ kind: "already-assigned" });
    expect(deps.fetchHumanOutbound).not.toHaveBeenCalled();
    expect(deps.writeAutoAssignment).not.toHaveBeenCalled();
  });

  it("o último a responder saiu do workspace OU virou viewer: não atribui a um fantasma", async () => {
    const deps = makeDeps({ isEligibleAssignee: vi.fn(async () => ({ eligible: false, error: null })) });
    const r = await autoAssignOnHandover({ currentAssignedTo: null }, deps);

    expect(r).toEqual({ kind: "responder-not-eligible", userId: "ana" });
    expect(deps.writeAutoAssignment).not.toHaveBeenCalled();
  });

  it("DEGRADAÇÃO — coluna assignment_origin ausente: a escrita ÚNICA falha => 'unavailable', e NÃO há segunda escrita (nunca fica atribuída sem origem)", async () => {
    const deps = makeDeps({
      writeAutoAssignment: vi.fn(async () => ({ applied: false, error: "Could not find the 'assignment_origin' column of 'whatsapp_conversations' in the schema cache" })),
    });
    const r = await autoAssignOnHandover({ currentAssignedTo: null }, deps);

    expect(r).toMatchObject({ kind: "unavailable", step: "write" });
    expect((r as { detail: string }).detail).toMatch(/assignment_origin/);
    expect(deps.writeAutoAssignment).toHaveBeenCalledTimes(1); // sem retry, sem escrita parcial
  });

  it("o UPDATE condicional não pegou linha (alguém atribuiu no meio): 'lost-race', sem erro", async () => {
    const deps = makeDeps({ writeAutoAssignment: vi.fn(async () => ({ applied: false, error: null })) });
    expect(await autoAssignOnHandover({ currentAssignedTo: null }, deps)).toEqual({ kind: "lost-race" });
  });

  it.each([
    ["leitura das mensagens retorna erro", { fetchHumanOutbound: vi.fn(async () => ({ rows: null, error: "boom" })) }, "read-messages"],
    ["leitura das mensagens lança", { fetchHumanOutbound: vi.fn(async () => { throw new Error("rede"); }) }, "read-messages"],
    ["checagem de elegibilidade retorna erro", { isEligibleAssignee: vi.fn(async () => ({ eligible: false, error: "boom" })) }, "check-eligibility"],
    ["checagem de elegibilidade lança", { isEligibleAssignee: vi.fn(async () => { throw new Error("rede"); }) }, "check-eligibility"],
    ["escrita lança", { writeAutoAssignment: vi.fn(async () => { throw new Error("rede"); }) }, "write"],
  ] as const)("%s => 'unavailable' (nunca lança; o handover segue)", async (_label, override, step) => {
    const deps = makeDeps(override as Partial<AutoAssignDeps>);
    const r = await autoAssignOnHandover({ currentAssignedTo: null }, deps);
    expect(r).toMatchObject({ kind: "unavailable", step });
  });

  it("falha na checagem de elegibilidade NÃO escreve (não atribui na dúvida)", async () => {
    const deps = makeDeps({ isEligibleAssignee: vi.fn(async () => ({ eligible: false, error: "boom" })) });
    await autoAssignOnHandover({ currentAssignedTo: null }, deps);
    expect(deps.writeAutoAssignment).not.toHaveBeenCalled();
  });
});

describe("effectiveRespondAll — a regra do robô, num lugar só", () => {
  it("trigger habilitado manda; sem trigger vale a coluna; ausente/nulo => true", () => {
    expect(effectiveRespondAll({ properties: { respondAll: false } }, true)).toBe(false);
    expect(effectiveRespondAll({ properties: { respondAll: true } }, false)).toBe(true);
    expect(effectiveRespondAll(undefined, false)).toBe(false);
    expect(effectiveRespondAll(null, true)).toBe(true);
    expect(effectiveRespondAll(undefined, undefined)).toBe(true);
    expect(effectiveRespondAll(undefined, null)).toBe(true);
    // trigger sem a propriedade => irrestrito (a coluna NÃO é consultada quando há trigger)
    expect(effectiveRespondAll({ properties: {} }, false)).toBe(true);
    expect(effectiveRespondAll({}, false)).toBe(true);
  });

  // Referência: a expressão EXATA que o whatsapp-bot-reply tinha inline antes desta rodada.
  const legacy = (flowNodes: Array<{ type: string; enabled: boolean; properties?: { respondAll?: boolean } }>, column: boolean | null | undefined) => {
    const triggerNode = flowNodes.find((n) => n.type === "trigger" && n.enabled);
    const respondAll = triggerNode ? triggerNode.properties?.respondAll : column;
    return respondAll ?? true;
  };

  const nodeSets = [
    [],
    [{ type: "trigger", enabled: true, properties: { respondAll: false } }],
    [{ type: "trigger", enabled: true, properties: { respondAll: true } }],
    [{ type: "trigger", enabled: true, properties: {} }],
    [{ type: "trigger", enabled: false, properties: { respondAll: false } }],
    [{ type: "ai", enabled: true }, { type: "trigger", enabled: true, properties: { respondAll: false } }],
  ];
  const columns: Array<boolean | null | undefined> = [true, false, null, undefined];

  it("EQUIVALÊNCIA exaustiva com a expressão antiga do robô (flow_data como array e como texto JSON)", () => {
    for (const nodes of nodeSets) {
      for (const column of columns) {
        const expected = legacy(nodes, column);
        expect(resolveRespondAllFromSettings({ flow_data: nodes, respond_all: column }), `array ${JSON.stringify(nodes)} / ${column}`).toBe(expected);
        expect(resolveRespondAllFromSettings({ flow_data: JSON.stringify(nodes), respond_all: column }), `texto ${JSON.stringify(nodes)} / ${column}`).toBe(expected);
      }
    }
  });

  it("flow_data ilegível / ausente => cai na coluna (como o robô); sem linha de configuração => irrestrito", () => {
    expect(resolveRespondAllFromSettings({ flow_data: "{{não é json", respond_all: false })).toBe(false);
    expect(resolveRespondAllFromSettings({ flow_data: null, respond_all: false })).toBe(false);
    expect(resolveRespondAllFromSettings({ flow_data: { not: "array" }, respond_all: false })).toBe(false);
    expect(resolveRespondAllFromSettings(null)).toBe(true);
    expect(resolveRespondAllFromSettings(undefined)).toBe(true);
  });
});

describe("computeReturnOutcome — os 3 casos da devolução (+ o gate real do robô)", () => {
  const snap = (row: Record<string, unknown>) => parseAssignmentSnapshot(row);

  it("AUTOMÁTICA e desatribuída: unassigned=true, robô livre — mesmo com respond_all desligado", () => {
    for (const respondAll of [true, false]) {
      expect(computeReturnOutcome({ snapshot: snap({ assigned_to: "ana", assignment_origin: "auto" }), unassigned: true, respondAll })).toEqual({
        unassigned: true,
        botStillMuted: false,
      });
    }
  });

  it("MANUAL: nada é desfeito; respond_all desligado => robô CONTINUA mudo (o aviso); ligado => livre", () => {
    const manual = snap({ assigned_to: "ana", assignment_origin: "manual" });
    expect(computeReturnOutcome({ snapshot: manual, unassigned: false, respondAll: false })).toEqual({ unassigned: false, botStillMuted: true });
    expect(computeReturnOutcome({ snapshot: manual, unassigned: false, respondAll: true })).toEqual({ unassigned: false, botStillMuted: false });
  });

  it("SEM atribuição: nada a desfazer, robô livre em qualquer modo", () => {
    for (const respondAll of [true, false]) {
      expect(computeReturnOutcome({ snapshot: snap({ assigned_to: null, assignment_origin: null }), unassigned: false, respondAll })).toEqual({
        unassigned: false,
        botStillMuted: false,
      });
    }
  });

  it("origem desconhecida (coluna ausente): atribuída + respond_all desligado => mudo, exatamente o gate antigo", () => {
    expect(computeReturnOutcome({ snapshot: snap({ assigned_to: "ana" }), unassigned: false, respondAll: false })).toEqual({
      unassigned: false,
      botStillMuted: true,
    });
  });

  it("automática mas o UPDATE de desatribuir falhou: o robô NÃO fica mudo (o gate ignora a sobra automática) e unassigned=false", () => {
    expect(computeReturnOutcome({ snapshot: snap({ assigned_to: "ana", assignment_origin: "auto" }), unassigned: false, respondAll: false })).toEqual({
      unassigned: false,
      botStillMuted: false,
    });
  });
});
