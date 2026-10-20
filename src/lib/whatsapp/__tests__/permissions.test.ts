// Etapa 9 · Item 4 (G103) — o que a UI do WhatsApp mostra por papel, derivado da MESMA tabela de papel
// mínimo do servidor. Se a UI e o servidor divergirem, a tela promete um botão que dá 403 (G29).
import { describe, expect, it } from "vitest";
import { canDo, whatsappPermissions } from "@/lib/whatsapp/permissions";
import { INSTANCE_ACTIONS, decideInstanceAction, minRoleOf } from "../../../../supabase/functions/_shared/instanceRoles";

const ROLES = ["owner", "admin", "member", "viewer"] as const;

describe("canDo — paridade com o servidor (decideInstanceAction)", () => {
  it.each(INSTANCE_ACTIONS.flatMap((a) => ROLES.map((r) => [a, r] as const)))("%s com papel %s: UI == servidor", (action, role) => {
    expect(canDo(action, role)).toBe(decideInstanceAction(action, role).allow);
  });

  it("papel desconhecido (carregando): NUNCA presume admin, mas não esconde leitura nem escrita operacional", () => {
    for (const role of [null, undefined]) {
      for (const action of INSTANCE_ACTIONS) {
        expect(canDo(action, role), `${action} / ${String(role)}`).toBe(minRoleOf(action) !== "admin");
      }
    }
  });

  it("ação fora da tabela => true (a UI não inventa bloqueio que o servidor não faz)", () => {
    expect(canDo("acao_que_nao_existe", "viewer")).toBe(true);
  });
});

describe("whatsappPermissions — as 4 permissões que as telas consomem", () => {
  it.each([
    ["owner", { canManageInstance: true, canWrite: true, canReturn: true, canAssign: true }],
    ["admin", { canManageInstance: true, canWrite: true, canReturn: true, canAssign: true }],
    ["member", { canManageInstance: false, canWrite: true, canReturn: true, canAssign: false }],
    ["viewer", { canManageInstance: false, canWrite: false, canReturn: false, canAssign: false }],
  ] as const)("papel %s", (role, expected) => {
    expect(whatsappPermissions(role)).toEqual(expected);
  });

  it("papel ainda desconhecido: escreve/devolve (o servidor decide), mas não administra nem atribui", () => {
    for (const role of [null, undefined]) {
      expect(whatsappPermissions(role)).toEqual({ canManageInstance: false, canWrite: true, canReturn: true, canAssign: false });
    }
  });

  it("papel estranho (não é um dos 4): tratado como sem permissão nenhuma, não como desconhecido-carregando", () => {
    expect(whatsappPermissions("guest")).toEqual({ canManageInstance: false, canWrite: false, canReturn: false, canAssign: false });
  });
});
