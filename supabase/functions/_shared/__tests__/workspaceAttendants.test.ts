// Etapa 9 · Item 4 (G101) — lista de atendentes do workspace (servidor). Lógica pura.
import { describe, expect, it } from "vitest";
import { isAssignableRole } from "../botAssignment";
import { buildAttendants, UNNAMED_ATTENDANT } from "../workspaceAttendants";

const members = [
  { user_id: "u-bia", role: "admin" },
  { user_id: "u-ana", role: "member" },
  { user_id: "u-caio", role: "viewer" },
];
const profiles = [
  { user_id: "u-bia", display_name: "Bia Souza", email: "bia@empresa.com" },
  { user_id: "u-ana", display_name: "Ana Lima", email: "ana@empresa.com" },
  { user_id: "u-caio", display_name: "Caio Reis", email: "caio@empresa.com" },
];

describe("buildAttendants", () => {
  it("junta membros e perfis; só id, nome e papel (nunca e-mail); ordenado por nome", () => {
    const list = buildAttendants(members, profiles);
    expect(list).toEqual([
      { id: "u-ana", name: "Ana Lima", role: "member" },
      { id: "u-bia", name: "Bia Souza", role: "admin" },
      { id: "u-caio", name: "Caio Reis", role: "viewer" },
    ]);
    expect(JSON.stringify(list)).not.toContain("@");
  });

  it("traz TAMBÉM o viewer (o nome de quem está atribuído precisa resolver); a elegibilidade é decidida por isAssignableRole", () => {
    const list = buildAttendants(members, profiles);
    expect(list.filter((a) => isAssignableRole(a.role)).map((a) => a.id)).toEqual(["u-ana", "u-bia"]);
    expect(list.some((a) => a.role === "viewer")).toBe(true);
  });

  it("sem display_name: usa a parte local do e-mail; sem nada: 'Sem nome'", () => {
    const list = buildAttendants(
      [{ user_id: "a", role: "member" }, { user_id: "b", role: "member" }, { user_id: "c", role: "member" }],
      [{ user_id: "a", display_name: "  ", email: "joana.silva@empresa.com" }, { user_id: "b", display_name: null, email: null }],
    );
    expect(list.find((x) => x.id === "a")?.name).toBe("joana.silva");
    expect(list.find((x) => x.id === "b")?.name).toBe(UNNAMED_ATTENDANT);
    expect(list.find((x) => x.id === "c")?.name).toBe(UNNAMED_ATTENDANT);
  });

  it("membro sem perfil legível continua na lista (com nome padrão)", () => {
    expect(buildAttendants([{ user_id: "u-x", role: "member" }], [])).toEqual([{ id: "u-x", name: UNNAMED_ATTENDANT, role: "member" }]);
  });

  it("entrada ruim vira lista vazia / é ignorada, nunca lança; duplicados e linhas sem user_id saem", () => {
    for (const bad of [null, undefined, "x", 1, {}]) expect(buildAttendants(bad, bad)).toEqual([]);
    const list = buildAttendants(
      [null, "x", { role: "member" }, { user_id: "", role: "member" }, { user_id: "u-1", role: "member" }, { user_id: "u-1", role: "admin" }],
      profiles,
    );
    expect(list.map((a) => a.id)).toEqual(["u-1"]);
    expect(list[0].role).toBe("member"); // vale a primeira ocorrência
  });

  it("ordena sem diferenciar caixa/acento (pt-BR), desempata por id", () => {
    const list = buildAttendants(
      [{ user_id: "2", role: "member" }, { user_id: "1", role: "member" }, { user_id: "3", role: "member" }],
      [
        { user_id: "1", display_name: "álvaro" },
        { user_id: "2", display_name: "Alvaro" },
        { user_id: "3", display_name: "Bruno" },
      ],
    );
    expect(list.map((a) => a.id)).toEqual(["1", "2", "3"]);
  });
});
