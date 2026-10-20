// Etapa 9 · Item 4 — FIAÇÃO do gate de papel em whatsapp-instance: assign_conversation e
// end_human_handover. As functions usam `Deno.serve` (sem harness), então — mesmo precedente de
// instanceAssignmentWiring/instanceClaimWiring — a fiação é provada lendo o fonte; toda a
// DECISÃO está em assignmentPermission.test.ts.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(resolve(__dirname, "../../whatsapp-instance/index.ts"), "utf8").split("\r\n").join("\n");

function actionBlock(action: string, nextMarker: string): string {
  const start = src.indexOf(`if (action === "${action}")`);
  expect(start, `ação ${action} existe`).toBeGreaterThan(-1);
  const end = src.indexOf(nextMarker, start + 1);
  return src.slice(start, end === -1 ? undefined : end);
}

describe("whatsapp-instance — o papel do chamador vem da checagem de membro (uma leitura só)", () => {
  it("memberRole sai de workspace_members (user-scoped) e está definido antes das ações", () => {
    expect(src).toContain("const memberRole = (member as { role?: unknown }).role;");
    expect(src.indexOf("const memberRole =")).toBeLessThan(src.indexOf('if (action === "create" || action === "connect")'));
  });

  it("o gate importa a régua pura do módulo compartilhado (nenhuma cópia local do vocabulário de papéis)", () => {
    expect(src).toMatch(/from "\.\.\/_shared\/assignmentPermission\.ts"/);
    expect(src).toContain("decideAssignPermission");
    expect(src).toContain("decideReturnPermission");
    expect(src).not.toMatch(/role === "owner"|role === "admin"|role === "viewer"|memberRole === "/);
  });
});

describe("whatsapp-instance — assign_conversation: gate de papel ANTES de qualquer escrita", () => {
  const block = actionBlock("assign_conversation", 'if (action === "list_attendants")');

  it("decide com papel, quem chama, alvo e o dono atual, e nega com 403 + causa (`reason`)", () => {
    expect(block).toContain("decideAssignPermission({");
    expect(block).toContain("role: memberRole");
    expect(block).toContain("callerId: userId");
    expect(block).toContain("targetUserId: assignUserId ?? null");
    expect(block).toContain("currentAssignedTo");
    expect(block).toContain("if (!permission.allow) return json({ error: permission.message, reason: permission.reason }, permission.status);");
  });

  it("a decisão vem ANTES do check do alvo e do UPDATE que grava assigned_to", () => {
    const decideAt = block.indexOf("decideAssignPermission({");
    expect(decideAt).toBeGreaterThan(-1);
    expect(decideAt).toBeLessThan(block.indexOf("isAssignableRole("));
    expect(decideAt).toBeLessThan(block.indexOf("assigned_to: assignUserId ?? null"));
    expect(decideAt).toBeLessThan(block.indexOf("buildManualAssignmentOriginUpdate"));
  });

  it("member (atribuir OU remover): lê o dono atual da conversa (do workspace) pra decidir; conversa inexistente é 404, não 403", () => {
    expect(block).toContain("if (!isAdminRole(memberRole)) {");
    expect(block).not.toContain("!isAdminRole(memberRole) && !assignUserId");
    const readAt = block.indexOf('.select("assigned_to")');
    expect(readAt).toBeGreaterThan(-1);
    expect(readAt).toBeLessThan(block.indexOf("decideAssignPermission({"));
    expect(block.slice(readAt, readAt + 200)).toContain('.eq("workspace_id", workspaceId)');
    expect(block).toContain('return json({ error: "Conversation not found" }, 404);');
  });

  it("scope own-only: o UPDATE é CONDICIONAL à atribuição ser MESMO do chamador (não pisa se mudou no meio)", () => {
    expect(block).toContain('permission.scope === "own-only"');
    expect(block).toContain('.eq("assigned_to", userId)');
    // e a corrida perdida é 403 honesto (member-can-only-remove-own), não "não encontrada"
    expect(block).toContain('PERMISSION_DENY_MESSAGES["member-can-only-remove-own"]');
  });

  it("scope self (decisão 1): o UPDATE é condicional a `assigned_to IS NULL`; corrida perdida = 403 'member-cannot-take-assigned'", () => {
    expect(block).toContain('permission.scope === "self"');
    expect(block).toContain('.is("assigned_to", null)');
    expect(block).toContain('PERMISSION_DENY_MESSAGES["member-cannot-take-assigned"]');
    expect(block).toContain('reason: "member-cannot-take-assigned"');
  });

  it("só o admin passa pelo check de elegibilidade do alvo (member só atribui a si mesmo, que já atende)", () => {
    expect(block).toMatch(/permission\.scope === "any" && assignUserId/);
    expect(block).toContain("isAssignableRole((target as { role?: unknown }).role)");
  });
});

describe("whatsapp-instance — end_human_handover: qualquer papel que ATENDE devolve; viewer 403", () => {
  const block = actionBlock("end_human_handover", 'if (action === "update_conversation_tags")');

  it("decideReturnPermission(memberRole) vem logo depois do conversationId e ANTES de qualquer UPDATE", () => {
    const requiredAt = block.indexOf('conversationId is required');
    const decideAt = block.indexOf("decideReturnPermission(memberRole)");
    expect(decideAt).toBeGreaterThan(requiredAt);
    expect(decideAt).toBeLessThan(block.indexOf("buildHandoverReturnUpdates("));
    expect(decideAt).toBeLessThan(block.indexOf(".update("));
  });

  it("nega com 403 + causa, antes do 409 de migration pendente (o papel é checado primeiro)", () => {
    expect(block).toContain("if (!returnPermission.allow) return json({ error: returnPermission.message, reason: returnPermission.reason }, returnPermission.status);");
    expect(block.indexOf("decideReturnPermission(memberRole)")).toBeLessThan(block.indexOf("}, 409)"));
  });
});

describe("whatsapp-instance — o que este gate NÃO mexe", () => {
  it("list_attendants e as ações de envio continuam sem exigir admin (leitura/atendimento)", () => {
    const list = actionBlock("list_attendants", 'if (action === "end_human_handover")');
    expect(list).not.toContain("decideAssignPermission");
    expect(list).not.toContain("decideReturnPermission");
  });

  it("o claim do G102 segue com a SUA regra (envio ok + papel que atende), não com a do assign_conversation", () => {
    const claim = src.slice(src.indexOf("const claimOnReply = async ("), src.indexOf('if (action === "create" || action === "connect")'));
    expect(claim).toContain("senderRole: memberRole");
    expect(claim).not.toContain("decideAssignPermission");
  });
});
