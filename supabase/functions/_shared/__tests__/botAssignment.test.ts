// Etapa 9 · Item 4 — origem da atribuição + gate `respond_all = false + assigned_to`
// (G48; docs/architecture/etapa-9-handover-assigned-to-proposta.md §3.2/§3.3).
// Lógica pura. Contrato central: coluna `assignment_origin` AUSENTE (migration
// pendente) => comportamento de ANTES, byte a byte.
import { describe, expect, it } from "vitest";
import {
  ASSIGNMENT_ORIGINS,
  buildManualAssignmentOriginUpdate,
  buildReturnUnassignUpdate,
  parseAssignmentOrigin,
  parseAssignmentSnapshot,
  shouldBotYieldToAssignee,
  shouldUnassignOnReturn,
} from "../botAssignment";

describe("parseAssignmentOrigin", () => {
  it("só 'auto' e 'manual' são origens válidas", () => {
    expect([...ASSIGNMENT_ORIGINS]).toEqual(["auto", "manual"]);
    expect(parseAssignmentOrigin("auto")).toBe("auto");
    expect(parseAssignmentOrigin("manual")).toBe("manual");
  });

  it("undefined (coluna inexistente), null e lixo => null (origem desconhecida), sem lançar", () => {
    for (const bad of [undefined, null, "", "AUTO", "bot", 1, true, {}, []]) {
      expect(parseAssignmentOrigin(bad)).toBeNull();
    }
  });
});

describe("shouldBotYieldToAssignee — o gate histórico, ajustado", () => {
  const base = { respondAll: false, assignedTo: "user-1", assignmentOrigin: "manual", handedOver: false };

  it("respond_all LIGADO: o robô nunca cede por atribuição", () => {
    expect(shouldBotYieldToAssignee({ ...base, respondAll: true })).toBe(false);
  });

  it("sem atribuição: o robô não cede", () => {
    expect(shouldBotYieldToAssignee({ ...base, assignedTo: null })).toBe(false);
    expect(shouldBotYieldToAssignee({ ...base, assignedTo: undefined })).toBe(false);
    expect(shouldBotYieldToAssignee({ ...base, assignedTo: "" })).toBe(false);
  });

  it("atribuição MANUAL + respond_all desligado: cede (como sempre foi — a devolução não desfaz decisão humana)", () => {
    expect(shouldBotYieldToAssignee(base)).toBe(true);
  });

  it("atribuição AUTOMÁTICA esquecida depois da devolução (não entregue): NÃO cala o robô — o 'mudo após Devolver'", () => {
    expect(shouldBotYieldToAssignee({ ...base, assignmentOrigin: "auto", handedOver: false })).toBe(false);
  });

  it("atribuição automática ENQUANTO entregue: cede (o handover em vigor é o dono; o robô já está mudo por handover_at)", () => {
    expect(shouldBotYieldToAssignee({ ...base, assignmentOrigin: "auto", handedOver: true })).toBe(true);
  });

  it("DEGRADAÇÃO — coluna ausente (origem undefined/null/lixo) == gate de ANTES, em TODAS as combinações", () => {
    const oldGate = (respondAll: boolean, assignedTo: string | null) => !respondAll && !!assignedTo;
    for (const origin of [undefined, null, "lixo"]) {
      for (const respondAll of [true, false]) {
        for (const assignedTo of [null, "user-1"]) {
          for (const handedOver of [true, false]) {
            expect(
              shouldBotYieldToAssignee({ respondAll, assignedTo, assignmentOrigin: origin, handedOver }),
              `origin=${String(origin)} respondAll=${respondAll} assignedTo=${assignedTo} handedOver=${handedOver}`,
            ).toBe(oldGate(respondAll, assignedTo));
          }
        }
      }
    }
  });
});

describe("devolução ao robô — desatribui SOMENTE atribuição automática", () => {
  it("parseAssignmentSnapshot lê a linha crua e é defensivo", () => {
    expect(parseAssignmentSnapshot({ assigned_to: "u1", assignment_origin: "auto" })).toEqual({ assignedTo: "u1", assignmentOrigin: "auto" });
    expect(parseAssignmentSnapshot({ assigned_to: null, assignment_origin: null })).toEqual({ assignedTo: null, assignmentOrigin: null });
    expect(parseAssignmentSnapshot({ assigned_to: "u1" })).toEqual({ assignedTo: "u1", assignmentOrigin: null }); // coluna ausente
    for (const bad of [null, undefined, "x", 3, []]) {
      expect(parseAssignmentSnapshot(bad)).toEqual({ assignedTo: null, assignmentOrigin: null });
    }
  });

  it("origem 'auto' COM atribuição => desatribui", () => {
    expect(shouldUnassignOnReturn({ assignedTo: "u1", assignmentOrigin: "auto" })).toBe(true);
  });

  it("origem 'manual' => NÃO desatribui (decisão de uma pessoa)", () => {
    expect(shouldUnassignOnReturn({ assignedTo: "u1", assignmentOrigin: "manual" })).toBe(false);
  });

  it("origem desconhecida (atribuição anterior à coluna / coluna ausente) => NÃO desatribui (leitura conservadora)", () => {
    expect(shouldUnassignOnReturn({ assignedTo: "u1", assignmentOrigin: null })).toBe(false);
  });

  it("sem atribuição => nada a desatribuir, mesmo com origem 'auto' residual", () => {
    expect(shouldUnassignOnReturn({ assignedTo: null, assignmentOrigin: "auto" })).toBe(false);
  });

  it("o update de desatribuição zera atribuição E origem", () => {
    expect(buildReturnUnassignUpdate("2026-10-18T12:00:00.000Z")).toEqual({
      assigned_to: null,
      assignment_origin: null,
      updated_at: "2026-10-18T12:00:00.000Z",
    });
  });
});

describe("buildManualAssignmentOriginUpdate (assign_conversation)", () => {
  it("atribuir a alguém => origem 'manual'", () => {
    expect(buildManualAssignmentOriginUpdate("user-1")).toEqual({ assignment_origin: "manual" });
  });

  it("desatribuir (null/undefined/vazio) => zera a origem", () => {
    for (const none of [null, undefined, ""]) {
      expect(buildManualAssignmentOriginUpdate(none)).toEqual({ assignment_origin: null });
    }
  });

  it("toca SÓ a coluna de origem (UPDATE separado: coluna ausente não arrasta assigned_to)", () => {
    expect(Object.keys(buildManualAssignmentOriginUpdate("user-1"))).toEqual(["assignment_origin"]);
  });
});

describe("ciclo: atribuição automática -> devolução -> robô volta a responder (respond_all desligado)", () => {
  it("auto-atribuída durante o handover; a devolução desatribui; mesmo que o UPDATE falhasse, o gate não cala o robô", () => {
    // 1) entregue + auto-atribuída: o robô cede (e já está mudo por handover_at)
    expect(shouldBotYieldToAssignee({ respondAll: false, assignedTo: "u1", assignmentOrigin: "auto", handedOver: true })).toBe(true);
    // 2) devolução: a regra manda desatribuir
    expect(shouldUnassignOnReturn({ assignedTo: "u1", assignmentOrigin: "auto" })).toBe(true);
    // 3a) desatribuiu: sem atribuição, robô responde
    expect(shouldBotYieldToAssignee({ respondAll: false, assignedTo: null, assignmentOrigin: null, handedOver: false })).toBe(false);
    // 3b) desatribuição FALHOU (corrida/erro): sobra 'auto' sem handover — o gate ainda assim não cala
    expect(shouldBotYieldToAssignee({ respondAll: false, assignedTo: "u1", assignmentOrigin: "auto", handedOver: false })).toBe(false);
  });

  it("atribuída por humano durante o handover (origem vira 'manual'): a devolução preserva e o gate segue cedendo", () => {
    expect(shouldUnassignOnReturn({ assignedTo: "u2", assignmentOrigin: "manual" })).toBe(false);
    expect(shouldBotYieldToAssignee({ respondAll: false, assignedTo: "u2", assignmentOrigin: "manual", handedOver: false })).toBe(true);
  });
});
