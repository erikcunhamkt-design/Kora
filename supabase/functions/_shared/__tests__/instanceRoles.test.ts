// Etapa 9 · Item 4 (G103) — tabela de PAPEL MÍNIMO por ação de `whatsapp-instance` + a decisão do
// gate central. Lógica pura. A fiação no handler e a paridade com o documento da varredura estão em
// instanceRolesWiring.test.ts (leitura do fonte).
import { describe, expect, it } from "vitest";
import {
  INSTANCE_ACTIONS,
  INSTANCE_ACTION_POLICY,
  ROLE_GATE_MESSAGES,
  decideInstanceAction,
  minRoleOf,
} from "../instanceRoles";
import { PERMISSION_DENY_MESSAGES } from "../assignmentPermission";

const ADMIN_ACTIONS = ["create", "connect", "set_webhook", "disconnect", "delete", "import"];
const READ_ACTIONS = ["status", "load_messages", "download_media", "list_favorite_stickers", "list_attendants"];
const WRITE_ACTIONS = [
  "sync",
  "refresh_avatars",
  "send",
  "send_media",
  "forward_message",
  "react_message",
  "pin_message",
  "delete_message",
  "archive_conversation",
  "mark_unread",
  "update_conversation_tags",
  "toggle_favorite_sticker",
  "assign_conversation",
  "end_human_handover",
];

describe("INSTANCE_ACTION_POLICY — a tabela de papel mínimo", () => {
  it("tem as 25 ações de whatsapp-instance, sem repetir nem faltar", () => {
    expect(INSTANCE_ACTIONS).toHaveLength(25);
    expect(new Set(INSTANCE_ACTIONS).size).toBe(25);
    expect([...INSTANCE_ACTIONS].sort()).toEqual([...ADMIN_ACTIONS, ...READ_ACTIONS, ...WRITE_ACTIONS].sort());
  });

  it.each(ADMIN_ACTIONS)("%s => papel mínimo admin (administração da instância)", (action) => {
    expect(minRoleOf(action)).toBe("admin");
    expect(INSTANCE_ACTION_POLICY[action].kind).toBe("instance-admin");
  });

  it.each(WRITE_ACTIONS)("%s => papel mínimo member (escrita operacional / atribuição)", (action) => {
    expect(minRoleOf(action)).toBe("member");
    expect(["operational-write", "assignment"]).toContain(INSTANCE_ACTION_POLICY[action].kind);
  });

  it.each(READ_ACTIONS)("%s => papel mínimo viewer (leitura)", (action) => {
    expect(minRoleOf(action)).toBe("viewer");
    expect(INSTANCE_ACTION_POLICY[action].kind).toBe("read");
  });
});

describe("decideInstanceAction — a matriz papel × ação", () => {
  const ALLOWED_ROLES: Record<"admin" | "member" | "viewer", Array<unknown>> = {
    admin: ["owner", "admin"],
    member: ["owner", "admin", "member"],
    viewer: ["owner", "admin", "member", "viewer"],
  };
  const NEVER_ROLES = [null, undefined, "", "guest", "OWNER", 3, {}];

  it.each(INSTANCE_ACTIONS.flatMap((action) => ["owner", "admin", "member", "viewer"].map((role) => [action, role] as const)))(
    "%s com papel %s",
    (action, role) => {
      const min = minRoleOf(action) as "admin" | "member" | "viewer";
      const decision = decideInstanceAction(action, role);
      expect(decision.allow).toBe(ALLOWED_ROLES[min].includes(role));
    },
  );

  it("ações de leitura passam para QUALQUER membro, até com papel estranho (a checagem de membro já passou)", () => {
    for (const action of READ_ACTIONS) for (const role of NEVER_ROLES) expect(decideInstanceAction(action, role).allow).toBe(true);
  });

  it("papel desconhecido/ausente NUNCA passa em escrita nem em administração", () => {
    for (const action of [...ADMIN_ACTIONS, ...WRITE_ACTIONS]) {
      for (const role of NEVER_ROLES) expect(decideInstanceAction(action, role).allow, `${action} / ${String(role)}`).toBe(false);
    }
  });

  it("viewer: 403 'role-read-only' em toda escrita operacional (exceto atribuir/devolver, que levam o motivo específico)", () => {
    for (const action of WRITE_ACTIONS) {
      const d = decideInstanceAction(action, "viewer");
      const expectedReason =
        action === "assign_conversation" ? "role-cannot-assign" : action === "end_human_handover" ? "role-cannot-return" : "role-read-only";
      expect(d).toMatchObject({ allow: false, status: 403, reason: expectedReason });
    }
  });

  it("member em ação de instância: 403 'role-requires-admin' com mensagem que fala em administrador", () => {
    for (const action of ADMIN_ACTIONS) {
      const d = decideInstanceAction(action, "member");
      expect(d).toEqual({ allow: false, status: 403, reason: "role-requires-admin", message: ROLE_GATE_MESSAGES["role-requires-admin"] });
      expect(d.allow === false && d.message).toMatch(/administrador/);
    }
  });

  it("as mensagens de negação são honestas: falam do papel, em português, sem placeholder", () => {
    for (const text of [...Object.values(ROLE_GATE_MESSAGES), ...Object.values(PERMISSION_DENY_MESSAGES)]) {
      expect(text.length).toBeGreaterThan(20);
      expect(text).not.toMatch(/undefined|null|<|\{/);
    }
    expect(ROLE_GATE_MESSAGES["role-read-only"]).toMatch(/somente leitura/);
  });

  it("ação fora da tabela (ou nome perigoso) passa como 'desconhecida' — o handler responde 400, o gate não inventa 403", () => {
    for (const action of ["inexistente", "", undefined, null, 7, "__proto__", "constructor", "toString", "hasOwnProperty"]) {
      expect(decideInstanceAction(action, "viewer")).toEqual({ allow: true, known: false });
      expect(minRoleOf(action)).toBeNull();
    }
  });
});
