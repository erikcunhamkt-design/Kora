// Etapa 9 · Item 4 (G48) — FIAÇÃO nas Edge Functions: `sender_id` nos 4 inserts de
// saída humanos de whatsapp-instance (pré-requisito do "último atendente que
// respondeu"), origem 'manual' em assign_conversation, devolução que desatribui só
// o automático, e o gate novo do robô. As functions usam `Deno.serve` (sem
// harness), então — mesmo precedente do botTrigger.test.ts da Lane B — a fiação é
// provada lendo o fonte; toda a DECISÃO está em botAssignment.test.ts.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) =>
  readFileSync(resolve(__dirname, rel), "utf8").split("\r\n").join("\n");

const instanceSrc = read("../../whatsapp-instance/index.ts");
const botReplySrc = read("../../whatsapp-bot-reply/index.ts");

// Fatia o corpo `{ ... }` de cada `from("whatsapp_messages").insert({` (casa chaves)
// e descobre a ação (`if (action === "x")`) em que ele mora.
interface InsertBlock {
  action: string;
  body: string;
}

function messageInserts(src: string): InsertBlock[] {
  const blocks: InsertBlock[] = [];
  const marker = 'from("whatsapp_messages").insert({';
  let from = 0;
  for (;;) {
    const at = src.indexOf(marker, from);
    if (at === -1) break;
    const open = at + marker.length - 1; // posição do "{"
    let depth = 0;
    let end = open;
    for (let i = open; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const before = src.slice(0, at);
    const actions = [...before.matchAll(/if \(action === "([a-z_]+)"\)/g)];
    blocks.push({ action: actions.length ? actions[actions.length - 1][1] : "?", body: src.slice(open, end + 1) });
    from = end;
  }
  return blocks;
}

describe("whatsapp-instance — sender_id nos inserts de saída humanos (pré-requisito do assigned_to)", () => {
  const inserts = messageInserts(instanceSrc).filter((b) => b.body.includes('direction: "outbound"'));

  it("são exatamente 4 inserts de saída: send, send_media e 2× forward_message", () => {
    expect(inserts.map((i) => i.action).sort()).toEqual(["forward_message", "forward_message", "send", "send_media"]);
  });

  it.each([
    ["send", 0],
    ["forward_message", 0],
    ["forward_message", 1],
    ["send_media", 0],
  ])("insert de %s (#%i) grava sender_id = userId", (action, nth) => {
    const ofAction = inserts.filter((i) => i.action === action);
    expect(ofAction[nth], `insert ${action} #${nth} existe`).toBeDefined();
    expect(ofAction[nth].body).toMatch(/sender_id: userId,/);
  });

  it("`userId` é o do chamador autenticado (claims.sub), definido antes dos handlers", () => {
    const def = instanceSrc.indexOf("const userId = claims.claims.sub as string;");
    const firstUse = instanceSrc.indexOf("sender_id: userId");
    expect(def).toBeGreaterThan(-1);
    expect(def).toBeLessThan(firstUse);
  });

  it("nenhum insert de saída humano ficou sem autor", () => {
    for (const i of inserts) expect(i.body).toContain("sender_id: userId");
  });
});

describe("whatsapp-instance — assign_conversation registra a origem 'manual' (UPDATE separado)", () => {
  const start = instanceSrc.indexOf('if (action === "assign_conversation")');
  const block = instanceSrc.slice(start, instanceSrc.indexOf('if (action === "list_attendants")'));

  it("usa buildManualAssignmentOriginUpdate num update PRÓPRIO, depois do que grava assigned_to", () => {
    expect(block).toContain("buildManualAssignmentOriginUpdate(assignUserId)");
    const assignedAt = block.indexOf("assigned_to: assignUserId ?? null");
    const originAt = block.indexOf("buildManualAssignmentOriginUpdate");
    expect(assignedAt).toBeGreaterThan(-1);
    expect(originAt).toBeGreaterThan(assignedAt);
    // o update que grava assigned_to NÃO carrega a coluna nova (coluna ausente não pode quebrá-lo)
    const firstUpdate = block.slice(assignedAt - 40, block.indexOf('.select("id");', assignedAt));
    expect(firstUpdate).not.toContain("assignment_origin");
  });

  it("falha ao gravar a origem vira warn (degrada) e é REPORTADA à UI (`originRecorded`), sem mudar o ok", () => {
    expect(block).toMatch(/if \(originErr\) \{\s*console\.warn/);
    expect(block).toContain("return json({ ok: true, originRecorded: !originErr });");
  });
});

describe("whatsapp-instance — end_human_handover desatribui SÓ o automático", () => {
  const start = instanceSrc.indexOf('if (action === "end_human_handover")');
  const block = instanceSrc.slice(start, instanceSrc.indexOf('if (action === "update_conversation_tags")'));

  it("só depois de confirmar que handover_at foi zerado (o 409 vem antes)", () => {
    const returns409 = block.indexOf("}, 409)");
    expect(returns409).toBeGreaterThan(-1);
    expect(block.indexOf("shouldUnassignOnReturn(snapshot)")).toBeGreaterThan(returns409);
  });

  it("decide por shouldUnassignOnReturn sobre a origem lida; `select(\"*\")` => coluna ausente vem undefined (origem desconhecida), assigned_to segue legível", () => {
    expect(block).toContain('.select("*")');
    expect(block).not.toContain('.select("assigned_to, assignment_origin")');
    expect(block).toContain("parseAssignmentSnapshot(assignReadErr ? null : assignRow)");
    expect(block).toContain("if (shouldUnassignOnReturn(snapshot))");
  });

  it("`unassigned` só é true se o UPDATE condicional pegou MESMO uma linha (não basta ausência de erro)", () => {
    expect(block).toContain('.eq("assigned_to", snapshot.assignedTo as string)\n          .select("id");');
    expect(block).toMatch(/unassigned = !unassignErr && Array\.isArray\(unassignedRows\) && unassignedRows\.length > 0;/);
  });

  it("o UPDATE é CONDICIONAL à mesma atribuição automática (não pisa em atribuição humana feita no meio)", () => {
    expect(block).toContain('.eq("assignment_origin", "auto")');
    expect(block).toContain('.eq("assigned_to", snapshot.assignedTo as string)');
    expect(block).toContain("buildReturnUnassignUpdate(");
  });

  it("devolve `unassigned` E `botStillMuted` na resposta (contrato pra UI)", () => {
    expect(block).toContain("return json({ ok: true, cleared, unassigned, botStillMuted });");
  });

  it("botStillMuted vem do gate REAL do robô (computeReturnOutcome) com o respond_all efetivo de whatsapp_bot_settings", () => {
    expect(block).toContain("computeReturnOutcome({ snapshot, unassigned, respondAll })");
    expect(block).toContain('.from("whatsapp_bot_settings")');
    expect(block).toContain('.select("flow_data, respond_all")');
    expect(block).toContain("respondAll = resolveRespondAllFromSettings(botSettings);");
  });

  it("só lê as configurações do robô se ainda sobrou alguém atribuído; erro de leitura => irrestrito (sem aviso)", () => {
    expect(block).toContain("if (!unassigned && snapshot.assignedTo !== null) {");
    expect(block).toContain("let respondAll = true;");
    // a leitura vem DEPOIS da tentativa de desatribuir
    expect(block.indexOf('.from("whatsapp_bot_settings")')).toBeGreaterThan(block.indexOf("buildReturnUnassignUpdate("));
  });
});

describe("whatsapp-bot-reply — gate novo no lugar do inline", () => {
  it("usa shouldBotYieldToAssignee com a origem da conversa; a condição inline antiga saiu", () => {
    expect(botReplySrc).toContain("shouldBotYieldToAssignee({");
    expect(botReplySrc).toContain("assignmentOrigin: conv.assignment_origin,");
    expect(botReplySrc).not.toMatch(/if \(!isUnrestricted && conv\.assigned_to\)/);
  });

  it("a mensagem de skip e o gate de silêncio por handover continuam, e o de handover vem ANTES", () => {
    expect(botReplySrc).toContain('skipped: "assigned and respond_all is false"');
    expect(botReplySrc.indexOf("isHandedOver(conv.handover_at)")).toBeLessThan(botReplySrc.indexOf("shouldBotYieldToAssignee({"));
  });

  it("ConversationRow declara assignment_origin como optional/unknown (coluna proposta)", () => {
    expect(botReplySrc).toMatch(/assignment_origin\?: unknown;/);
  });

  it("respond_all efetivo vem da regra ÚNICA (a expressão inline antiga saiu)", () => {
    expect(botReplySrc).toContain("const isUnrestricted = effectiveRespondAll(triggerNode, bot.respond_all);");
    expect(botReplySrc).not.toContain("triggerNode.properties?.respondAll : bot.respond_all");
    expect(botReplySrc).not.toContain("respondAll ?? true");
  });
});

// Atribuição AUTOMÁTICA no handover (D1): a decisão está em botAssignment.test.ts /
// botAutoAssign.test.ts; aqui a prova de que o acesso a dados e o ponto de chamada
// estão certos.
describe("whatsapp-bot-reply — atribuição automática no handover", () => {
  const defStart = botReplySrc.indexOf("async function enterHumanHandover(");
  const enterBlock = botReplySrc.slice(defStart, botReplySrc.indexOf("async function tryAutoAssignOnHandover("));
  const tryStart = botReplySrc.indexOf("async function tryAutoAssignOnHandover(");
  const tryBlock = botReplySrc.slice(tryStart, botReplySrc.indexOf("function json(", tryStart));

  it("os 4 gatilhos da R4 + o destino handover da R8 passam TODOS por enterHumanHandover (único escritor de handover_at)", () => {
    // 1 definição + 3 chamadas (nó "message" -> handover da R8, menu da R4, palavra-chave)
    expect(botReplySrc.match(/enterHumanHandover\(/g)).toHaveLength(4);
    // e é o ÚNICO lugar que persiste o estado de entrega
    expect(botReplySrc.match(/buildHandoverEntryUpdates\(/g)).toHaveLength(1);
    expect(enterBlock).toContain("buildHandoverEntryUpdates(");
  });

  it("só atribui DEPOIS de handover_at gravado com sucesso (sem entrega persistida não há dono)", () => {
    expect(enterBlock).toContain("let handoverPersisted = false;");
    expect(enterBlock).toContain('} else if ("handover_at" in update) {\n      handoverPersisted = true;');
    const persistedAt = enterBlock.indexOf("handoverPersisted = true;");
    const callAt = enterBlock.indexOf("await tryAutoAssignOnHandover(admin, ctx);");
    expect(persistedAt).toBeGreaterThan(-1);
    expect(callAt).toBeGreaterThan(persistedAt);
    expect(enterBlock).toMatch(/if \(handoverPersisted\) \{\s*await tryAutoAssignOnHandover\(admin, ctx\);/);
  });

  it("lê SÓ saídas COM autor, da conversa, mais recentes primeiro (o robô e o fromMe do celular não têm sender_id)", () => {
    expect(tryBlock).toContain('.from("whatsapp_messages")');
    expect(tryBlock).toContain('.eq("conversation_id", conversationId)');
    expect(tryBlock).toContain('.eq("direction", "outbound")');
    expect(tryBlock).toContain('.not("sender_id", "is", null)');
    expect(tryBlock).toContain('.order("created_at", { ascending: false })');
    expect(tryBlock).toMatch(/\.limit\(\d+\)/);
  });

  it("confere que o último atendente ainda é MEMBRO do workspace e com papel que atende (não viewer)", () => {
    expect(tryBlock).toContain('.from("workspace_members")');
    expect(tryBlock).toContain('.select("user_id, role")');
    expect(tryBlock).toContain('.eq("workspace_id", workspaceId)');
    expect(tryBlock).toContain('.eq("user_id", userId)');
    expect(tryBlock).toContain("isAssignableRole((data as { role?: unknown }).role)");
  });

  it("a escrita é UM update só (assigned_to + assignment_origin juntos), condicional a `assigned_to IS NULL`", () => {
    expect(tryBlock.match(/\.update\(/g)).toHaveLength(1);
    expect(tryBlock).toContain("buildAutoAssignmentUpdate(userId, new Date().toISOString())");
    expect(tryBlock).toContain('.is("assigned_to", null)');
    expect(tryBlock).toContain('.select("id")');
    expect(tryBlock).toContain("applied: !error && Array.isArray(data) && data.length > 0,");
    // nenhum update separado de assignment_origin (isso é o que permitiria 'atribuída sem origem')
    expect(tryBlock).not.toMatch(/update\(\{\s*assignment_origin/);
  });

  it("melhor esforço: try/catch, `unavailable` vira warn, e a conversa atual vai como `currentAssignedTo`", () => {
    expect(tryBlock).toContain("autoAssignOnHandover({ currentAssignedTo: conv.assigned_to }, deps)");
    expect(tryBlock).toContain('outcome.kind === "unavailable"');
    expect(tryBlock).toMatch(/console\.warn\(\s*`\[bot-reply\] auto-assignment skipped/);
    expect(tryBlock).toMatch(/\} catch \(err\) \{\s*console\.warn\(/);
  });
});
