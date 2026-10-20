// Etapa 9 · Item 4 (G103) — FIAÇÃO do gate central em whatsapp-instance e PARIDADE código ↔ documento:
// cada ação do handler tem (1) uma linha na tabela de papel mínimo e (2) uma linha, com o MESMO papel
// mínimo, em docs/qa/etapa-9-bot-varredura-gate-papel-servidor.md. As functions usam `Deno.serve`
// (sem harness), então a fiação é provada lendo o fonte (precedente: instanceAssignmentWiring).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { INSTANCE_ACTIONS, minRoleOf } from "../instanceRoles";

const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8").split("\r\n").join("\n");

const src = read("../../whatsapp-instance/index.ts");
const officialSrc = read("../../whatsapp-official-credentials/index.ts");
const doc = read("../../../../docs/qa/etapa-9-bot-varredura-gate-papel-servidor.md");

// ações despachadas pelo handler: `if (action === "x")` e `|| action === "y"`
const sourceActions = [...new Set([...src.matchAll(/(?:if \(|\|\| )action === "([a-z_]+)"/g)].map((m) => m[1]))];

// linhas da tabela do doc: | `acao` | o que faz | UI chama de | UI p/ quem não tem o papel | `papel` | obs |
const docRows = new Map<string, string>();
for (const line of doc.split("\n")) {
  const m = line.match(/^\|\s*`([a-z_]+)`\s*\|[^|]*\|[^|]*\|[^|]*\|\s*`(admin|member|viewer)`\s*\|/);
  if (m) docRows.set(m[1], m[2]);
}

describe("whatsapp-instance — o conjunto de ações do handler é o da tabela de papel mínimo", () => {
  it("o handler despacha exatamente as 25 ações da tabela (nenhuma sem linha de papel, nenhuma linha sem ação)", () => {
    expect(sourceActions.sort()).toEqual([...INSTANCE_ACTIONS].sort());
    expect(sourceActions).toHaveLength(25);
  });

  it.each(INSTANCE_ACTIONS)("%s: despachada UMA vez no handler", (action) => {
    expect(src.match(new RegExp(`action === "${action}"`, "g"))).toHaveLength(1);
  });
});

describe("paridade com docs/qa/etapa-9-bot-varredura-gate-papel-servidor.md (coluna 'Papel mínimo')", () => {
  it("o documento tem uma linha por ação e nenhuma a mais", () => {
    expect([...docRows.keys()].sort()).toEqual([...INSTANCE_ACTIONS].sort());
  });

  it.each(INSTANCE_ACTIONS)("%s: o papel mínimo do documento é o do código", (action) => {
    expect(docRows.get(action), `linha de ${action} no doc`).toBe(minRoleOf(action));
  });
});

describe("whatsapp-instance — o gate central", () => {
  const gateAt = src.indexOf("const roleGate = decideInstanceAction(action, memberRole);");

  it("importa a decisão do módulo compartilhado e a usa com o papel da checagem de membro", () => {
    expect(src).toMatch(/from "\.\.\/_shared\/instanceRoles\.ts"/);
    expect(gateAt).toBeGreaterThan(-1);
    expect(src.indexOf("const memberRole =")).toBeLessThan(gateAt);
  });

  it("vem ANTES de carregar a instância e de despachar qualquer ação (nenhum efeito antes do 403)", () => {
    expect(gateAt).toBeLessThan(src.indexOf("// Load existing instance"));
    expect(gateAt).toBeLessThan(src.search(/if \(action === "create" \|\| action === "connect"\)/));
    // nenhuma chamada ao uazapi/banco entre a checagem de membro e o gate
    const between = src.slice(src.indexOf("const memberRole ="), gateAt);
    expect(between).not.toMatch(/\.from\(|uaz\(|uazForInstance\(/);
  });

  it("nega com o status e a causa da decisão (403 + reason + action), sem tocar em nada", () => {
    expect(src).toContain(
      "if (!roleGate.allow) return json({ error: roleGate.message, reason: roleGate.reason, action }, roleGate.status);",
    );
  });

  it("nenhum handler repete o vocabulário de papéis à mão (a regra é a da tabela)", () => {
    expect(src).not.toMatch(/role === "(owner|admin|viewer|member)"|memberRole === "/);
  });
});

describe("whatsapp-instance — status não entrega o QR a quem não administra a instância", () => {
  const start = src.indexOf('if (action === "status")');
  const block = src.slice(start, src.indexOf('if (action === "set_webhook")'));

  it("para não-admin o `qr_code` sai nulo na resposta", () => {
    expect(block).toContain("if (updated && !isAdminRole(memberRole)) return json({ instance: { ...updated, qr_code: null } });");
  });
});

describe("whatsapp-official-credentials — `get` também exige admin (decisão 2)", () => {
  it("o gate de admin vem ANTES de qualquer ação, inclusive `get`", () => {
    const gate = officialSrc.indexOf('if (!isAdmin) return json({ error: "Admin role required" }, 403);');
    expect(gate).toBeGreaterThan(-1);
    expect(officialSrc.match(/if \(!isAdmin\) return json\(\{ error: "Admin role required" \}, 403\);/g)).toHaveLength(1);
    for (const action of ["get", "upsert", "delete", "verify", "set_active"]) {
      const at = officialSrc.indexOf(`if (action === "${action}")`);
      expect(at, `ação ${action} existe`).toBeGreaterThan(-1);
      expect(gate, `gate antes de ${action}`).toBeLessThan(at);
    }
  });

  it("a checagem de papel usa o mesmo conjunto owner/admin do banco (is_workspace_admin)", () => {
    expect(officialSrc).toContain('const isAdmin = member.role === "owner" || member.role === "admin";');
  });
});
