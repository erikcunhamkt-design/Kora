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
  const block = instanceSrc.slice(start, instanceSrc.indexOf('if (action === "end_human_handover")'));

  it("usa buildManualAssignmentOriginUpdate num update PRÓPRIO, depois do que grava assigned_to", () => {
    expect(block).toContain("buildManualAssignmentOriginUpdate(assignUserId)");
    const assignedAt = block.indexOf("assigned_to: assignUserId ?? null");
    const originAt = block.indexOf("buildManualAssignmentOriginUpdate");
    expect(assignedAt).toBeGreaterThan(-1);
    expect(originAt).toBeGreaterThan(assignedAt);
    // o update que grava assigned_to NÃO carrega a coluna nova (coluna ausente não pode quebrá-lo)
    const firstUpdate = block.slice(assignedAt - 40, block.indexOf(".eq(\"workspace_id\", workspaceId);", assignedAt));
    expect(firstUpdate).not.toContain("assignment_origin");
  });

  it("falha ao gravar a origem vira warn (degrada), nunca muda a resposta", () => {
    expect(block).toMatch(/if \(originErr\) \{\s*console\.warn/);
    expect(block).toContain("return json({ ok: true });");
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

  it("decide por shouldUnassignOnReturn sobre a origem lida; erro de SELECT (coluna ausente) => snapshot vazio", () => {
    expect(block).toContain('.select("assigned_to, assignment_origin")');
    expect(block).toContain("parseAssignmentSnapshot(assignReadErr ? null : assignRow)");
    expect(block).toContain("if (shouldUnassignOnReturn(snapshot))");
  });

  it("o UPDATE é CONDICIONAL à mesma atribuição automática (não pisa em atribuição humana feita no meio)", () => {
    expect(block).toContain('.eq("assignment_origin", "auto")');
    expect(block).toContain('.eq("assigned_to", snapshot.assignedTo as string)');
    expect(block).toContain("buildReturnUnassignUpdate(");
  });

  it("devolve `unassigned` na resposta (contrato pra UI)", () => {
    expect(block).toContain("return json({ ok: true, cleared, unassigned });");
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
});
