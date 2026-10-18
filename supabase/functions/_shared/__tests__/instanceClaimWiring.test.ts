// Etapa 9 · Item 4 (G101 + G102) — FIAÇÃO em whatsapp-instance: "assumir ao responder" nos 4
// pontos de saída humanos, validação do alvo em assign_conversation e a ação list_attendants.
// As functions usam `Deno.serve` (sem harness), então — mesmo precedente de
// instanceAssignmentWiring.test.ts — a fiação é provada lendo o fonte; toda a DECISÃO está em
// claimOnReply.test.ts / workspaceAttendants.test.ts.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const instanceSrc = readFileSync(resolve(__dirname, "../../whatsapp-instance/index.ts"), "utf8")
  .split("\r\n")
  .join("\n");

function actionBlock(action: string, nextMarker: string): string {
  const start = instanceSrc.indexOf(`if (action === "${action}")`);
  expect(start, `ação ${action} existe`).toBeGreaterThan(-1);
  const end = instanceSrc.indexOf(nextMarker, start + 1);
  return instanceSrc.slice(start, end === -1 ? undefined : end);
}

describe("whatsapp-instance — o claim (G102): helper único, UM update atômico e condicional", () => {
  const defStart = instanceSrc.indexOf("const claimOnReply = async (");
  const helper = instanceSrc.slice(defStart, instanceSrc.indexOf('if (action === "create" || action === "connect")', defStart));

  it("existe UM helper, definido antes das ações, com o papel do remetente vindo da checagem de membro", () => {
    expect(defStart).toBeGreaterThan(-1);
    expect(defStart).toBeLessThan(instanceSrc.indexOf('if (action === "create" || action === "connect")'));
    expect(instanceSrc).toContain('.select("id, role")');
    expect(instanceSrc).toContain("const memberRole = (member as { role?: unknown }).role;");
    expect(helper).toContain("senderId: userId");
    expect(helper).toContain("senderRole: memberRole");
  });

  it("a escrita é UM update (assigned_to + origem juntos), condicional a `assigned_to IS NULL` e a conversa entregue", () => {
    expect(helper.match(/\.update\(/g)).toHaveLength(1);
    expect(helper).toContain("buildClaimUpdate(claimantId, new Date().toISOString())");
    expect(helper).toContain('.is("assigned_to", null)');
    expect(helper).toContain('.not("handover_at", "is", null)');
    expect(helper).toContain('.eq("workspace_id", workspaceId)');
    expect(helper).toContain('.select("id")');
    expect(helper).toContain("applied: !error && Array.isArray(data) && data.length > 0,");
    // nenhum update separado de assignment_origin (é o que permitiria 'atribuída sem origem')
    expect(helper).not.toMatch(/update\(\{\s*assignment_origin/);
  });

  it("melhor esforço: try/catch, `unavailable` e exceção viram warn, e o retorno diz só se assumiu", () => {
    expect(helper).toContain('outcome.kind === "unavailable"');
    expect(helper).toMatch(/console\.warn\(\s*"\[whatsapp-instance\] claim-on-reply skipped/);
    expect(helper).toMatch(/\} catch \(err\) \{\s*console\.warn\(/);
    expect(helper).toContain('return outcome.kind === "claimed";');
  });

  it("são exatamente 4 chamadas, uma por insert de saída humano (send, send_media e 2× forward_message)", () => {
    expect(instanceSrc.match(/claimOnReply\(/g)).toHaveLength(4);
  });
});

describe("whatsapp-instance — o claim vem DEPOIS do insert, em cada um dos 4 pontos, e só reporta o envio", () => {
  it("send: depois do insert e do last_message; passa a conversa lida e o resultado do envio", () => {
    const block = actionBlock("send", 'if (action === "react_message")');
    const insertAt = block.indexOf('from("whatsapp_messages").insert(');
    const claimAt = block.indexOf("await claimOnReply(conversationId, conv, send.ok);");
    expect(insertAt).toBeGreaterThan(-1);
    expect(claimAt).toBeGreaterThan(insertAt);
    // a resposta do envio não depende do claim
    expect(block).toContain("return json({ ok: send.ok, message: inserted });");
    expect(block.indexOf("return json({ ok: send.ok")).toBeGreaterThan(claimAt);
  });

  it("send_media: depois do insert, ANTES do 502 de falha de envio (o claim já se recusa se send.ok é falso)", () => {
    const block = actionBlock("send_media", 'if (action === "list_favorite_stickers")');
    const insertAt = block.indexOf('from("whatsapp_messages").insert(');
    const claimAt = block.indexOf("await claimOnReply(conversationId, conv, send.ok);");
    expect(claimAt).toBeGreaterThan(insertAt);
    expect(claimAt).toBeLessThan(block.indexOf('return json({ error: "uazapi send failed"'));
  });

  it("forward_message: a conversa de DESTINO é lida com select('*') e os 2 inserts chamam o claim", () => {
    const block = actionBlock("forward_message", 'if (action === "assign_conversation")');
    expect(block).toContain('.select("*")\n        .eq("id", targetConversationId)');
    expect(block).not.toContain('.select("contact_phone")');
    const inserts = [...block.matchAll(/from\("whatsapp_messages"\)\.insert\(/g)].map((m) => m.index as number);
    const claims = [
      ...block.matchAll(/claimOnReply\(targetConversationId, targetRow, send\.ok\)/g),
    ].map((m) => m.index as number);
    expect(inserts).toHaveLength(2);
    expect(claims).toHaveLength(2);
    expect(claims[0]).toBeGreaterThan(inserts[0]);
    expect(claims[0]).toBeLessThan(inserts[1]);
    expect(claims[1]).toBeGreaterThan(inserts[1]);
  });

  it("forward_message: depois de assumir no 1º envio, a linha em memória ganha o dono (o 2º não repete a tentativa)", () => {
    const block = actionBlock("forward_message", 'if (action === "assign_conversation")');
    expect(block).toContain("let targetRow: unknown = targetConv;");
    expect(block).toContain("targetRow = { ...(targetConv as Record<string, unknown>), assigned_to: userId };");
  });

});

describe("whatsapp-instance — assign_conversation (G101): o servidor confere o que a UI promete", () => {
  const block = actionBlock("assign_conversation", 'if (action === "list_attendants")');

  it("só vira dono membro DESTE workspace com papel que atende (a mesma elegibilidade do claim e do §3.5)", () => {
    expect(block).toContain('.from("workspace_members")');
    expect(block).toContain('.eq("user_id", assignUserId)');
    expect(block).toContain("isAssignableRole((target as { role?: unknown }).role)");
    expect(block).toContain('"user is not an eligible attendant of this workspace"');
    expect(block).toContain("}, 400)");
  });

  it("a checagem vem ANTES de gravar, e só quando há alvo (desatribuir não precisa)", () => {
    expect(block).toContain("if (assignUserId) {");
    expect(block.indexOf("isAssignableRole(")).toBeLessThan(block.indexOf("assigned_to: assignUserId ?? null"));
  });

  it("o erro do UPDATE deixa de ser engolido: 500 com a causa, 404 se nenhuma conversa casou", () => {
    expect(block).toContain("if (assignErr) return json({ error: assignErr.message }, 500);");
    expect(block).toContain('return json({ error: "Conversation not found" }, 404);');
  });
});

describe("whatsapp-instance — list_attendants (G101): servidor monta a lista que o navegador não consegue", () => {
  const block = actionBlock("list_attendants", 'if (action === "end_human_handover")');

  it("lê SÓ os membros do workspace do chamador (a checagem de membro já passou) e os perfis desses membros", () => {
    expect(block).toContain('.from("workspace_members")');
    expect(block).toContain('.eq("workspace_id", workspaceId)');
    expect(block).toContain('.from("profiles")');
    expect(block).toContain('.in("user_id", memberIds)');
  });

  it("lê do perfil só nome e e-mail (o e-mail serve só pro nome padrão e NÃO sai: buildAttendants devolve id/nome/papel)", () => {
    expect(block).toContain('.select("user_id, display_name, email")');
    expect(block).toContain("buildAttendants(memberRows, profileRows)");
    expect(block).toContain("return json({ ok: true, attendants: buildAttendants(memberRows, profileRows) });");
  });

  it("falha ao ler perfis degrada pra nomes padrão (warn); falha ao ler membros é 500", () => {
    expect(block).toContain("failed to read profiles (nomes padrão)");
    expect(block).toContain('return json({ error: "failed to list members" }, 500);');
  });
});
