// Etapa 9 · Item 4 — gate de papel no servidor para atribuir e devolver (lógica pura).
// A fiação em whatsapp-instance é provada em instanceRoleGateWiring.test.ts (leitura do fonte).
import { describe, expect, it } from "vitest";
import { ASSIGNABLE_ROLES, isAssignableRole } from "../botAssignment";
import {
  ADMIN_ROLES,
  PERMISSION_DENY_MESSAGES,
  decideAssignPermission,
  decideReturnPermission,
  isAdminRole,
} from "../assignmentPermission";

const ME = "u-me";
const OTHER = "u-other";

describe("isAdminRole — espelha is_workspace_admin (owner/admin)", () => {
  it("owner e admin sim; member, viewer e o resto não", () => {
    expect([...ADMIN_ROLES]).toEqual(["owner", "admin"]);
    for (const r of ["owner", "admin"]) expect(isAdminRole(r)).toBe(true);
    for (const r of ["member", "viewer", "", "ADMIN", null, undefined, 1, {}]) expect(isAdminRole(r)).toBe(false);
  });

  it("todo admin é elegível (a régua de admin está contida na de quem atende)", () => {
    for (const r of ADMIN_ROLES) expect(isAssignableRole(r)).toBe(true);
    expect(ASSIGNABLE_ROLES).toContain("member");
  });
});

describe("decideAssignPermission — a régua do assign_conversation", () => {
  it("owner/admin: atribuem a QUALQUER pessoa e removem qualquer atribuição (scope any)", () => {
    for (const role of ["owner", "admin"]) {
      expect(decideAssignPermission({ role, callerId: ME, targetUserId: OTHER })).toEqual({ allow: true, scope: "any" });
      expect(decideAssignPermission({ role, callerId: ME, targetUserId: ME })).toEqual({ allow: true, scope: "any" });
      expect(decideAssignPermission({ role, callerId: ME, targetUserId: null, currentAssignedTo: OTHER })).toEqual({
        allow: true,
        scope: "any",
      });
    }
  });

  it("member: atribui A SI MESMO só se a conversa está SEM dono (decisão 1 do revisor; scope self)", () => {
    expect(decideAssignPermission({ role: "member", callerId: ME, targetUserId: ME, currentAssignedTo: null })).toEqual({
      allow: true,
      scope: "self",
    });
  });

  it("member: conversa que JÁ tem dono => 403 'member-cannot-take-assigned' — de outro E até a própria (não toma, não reafirma)", () => {
    for (const currentAssignedTo of [OTHER, ME]) {
      const d = decideAssignPermission({ role: "member", callerId: ME, targetUserId: ME, currentAssignedTo });
      expect(d).toEqual({
        allow: false,
        status: 403,
        reason: "member-cannot-take-assigned",
        message: PERMISSION_DENY_MESSAGES["member-cannot-take-assigned"],
      });
      expect(d.allow === false && d.message).toMatch(/administrador/);
    }
  });

  it("member: dono NÃO lido (undefined) => nega — na dúvida, não atribui", () => {
    expect(decideAssignPermission({ role: "member", callerId: ME, targetUserId: ME })).toMatchObject({
      allow: false,
      reason: "member-cannot-take-assigned",
    });
  });

  it("admin/owner NÃO são afetados pela decisão 1: reatribuem mesmo conversa com dono", () => {
    for (const role of ["owner", "admin"]) {
      expect(decideAssignPermission({ role, callerId: ME, targetUserId: ME, currentAssignedTo: OTHER })).toEqual({
        allow: true,
        scope: "any",
      });
    }
  });

  it("member tentando atribuir a OUTRA pessoa => 403 com a causa", () => {
    const d = decideAssignPermission({ role: "member", callerId: ME, targetUserId: OTHER });
    expect(d).toEqual({
      allow: false,
      status: 403,
      reason: "member-can-only-assign-self",
      message: PERMISSION_DENY_MESSAGES["member-can-only-assign-self"],
    });
    expect(d.allow === false && d.message).toMatch(/administrador/);
  });

  it("member removendo a PRÓPRIA atribuição => permitido, mas só se a conversa É dele (scope own-only)", () => {
    expect(decideAssignPermission({ role: "member", callerId: ME, targetUserId: null, currentAssignedTo: ME })).toEqual({
      allow: true,
      scope: "own-only",
    });
    expect(decideAssignPermission({ role: "member", callerId: ME, targetUserId: undefined, currentAssignedTo: ME })).toEqual({
      allow: true,
      scope: "own-only",
    });
  });

  it("member removendo a atribuição de OUTRA pessoa, de ninguém, ou sem ler o dono => 403 (na dúvida, nega)", () => {
    for (const currentAssignedTo of [OTHER, null, undefined]) {
      const d = decideAssignPermission({ role: "member", callerId: ME, targetUserId: null, currentAssignedTo });
      expect(d).toMatchObject({ allow: false, status: 403, reason: "member-can-only-remove-own" });
    }
  });

  it("viewer (e papel desconhecido/ausente) => 403 em QUALQUER operação, inclusive atribuir a si mesmo", () => {
    for (const role of ["viewer", "", "guest", null, undefined, 3]) {
      for (const targetUserId of [ME, OTHER, null]) {
        const d = decideAssignPermission({ role, callerId: ME, targetUserId, currentAssignedTo: ME });
        expect(d).toMatchObject({ allow: false, status: 403, reason: "role-cannot-assign" });
      }
    }
  });

  it("toda negação é 403 com mensagem em português, sem placeholder esquecido", () => {
    for (const [reason, message] of Object.entries(PERMISSION_DENY_MESSAGES)) {
      expect(message.length).toBeGreaterThan(20);
      expect(message, reason).not.toMatch(/undefined|null|<|\{/);
    }
  });
});

describe("decideReturnPermission — end_human_handover: qualquer papel que ATENDE", () => {
  it("owner, admin e member podem devolver (devolver não atribui a ninguém)", () => {
    for (const role of ["owner", "admin", "member"]) {
      expect(decideReturnPermission(role)).toEqual({ allow: true, scope: "any" });
    }
  });

  it("viewer e papel desconhecido => 403", () => {
    for (const role of ["viewer", "", "guest", null, undefined]) {
      expect(decideReturnPermission(role)).toEqual({
        allow: false,
        status: 403,
        reason: "role-cannot-return",
        message: PERMISSION_DENY_MESSAGES["role-cannot-return"],
      });
    }
  });

  it("a régua da devolução é a de `isAssignableRole` (uma regra só)", () => {
    for (const role of ["owner", "admin", "member", "viewer", "x", null]) {
      expect(decideReturnPermission(role).allow).toBe(isAssignableRole(role));
    }
  });
});
