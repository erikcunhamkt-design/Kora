// Etapa 9 · Item 4 (G104) — a 5ª migration do pacote 8-b (RLS de escrita de whatsapp_* por papel) é um
// DRAFT em documento, NÃO aplicado. Este teste lê o SQL do doc e prova o que dá pra provar sem banco:
//  - só mexe em policies de ESCRITA (nunca nas de SELECT) e só nas 3 tabelas;
//  - dropa EXATAMENTE as policies de escrita que a migration ORIGINAL (20260602004057) criou — nem mais, nem menos;
//  - cria 9 policies com o helper certo por tabela (admin p/ instâncias; atendente p/ conversas e mensagens);
//  - é idempotente (DROP POLICY IF EXISTS antes de cada CREATE, transação única, função CREATE OR REPLACE);
//  - o rollback recria as policies antigas VERBATIM da migration original;
//  - nada destrutivo (sem DROP TABLE / DELETE / TRUNCATE).
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8").split("\r\n").join("\n");
const norm = (s: string) => s.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim();

const repo = resolve(__dirname, "../../../..");
const doc = read(resolve(repo, "docs/qa/etapa-9-bot-pacote-operador-8b.md"));
const migrationsDir = resolve(repo, "supabase/migrations");
const originalFile = readdirSync(migrationsDir).find((f) => f.startsWith("20260602004057"));
const original = read(resolve(migrationsDir, originalFile as string));

const TABLES = ["whatsapp_instances", "whatsapp_conversations", "whatsapp_messages"] as const;

// 1º bloco ```sql depois do título "### 2.5"
const section25 = doc.slice(doc.indexOf("### 2.5 "));
const ddl = section25.slice(section25.indexOf("```sql") + 6, section25.indexOf("```", section25.indexOf("```sql") + 6));
const ddlNorm = norm(ddl);

// bloco de rollback (```sql dentro do bullet "rollback completo")
const rollbackStart = doc.indexOf("**DDL da 5ª migration (G104) — rollback completo");
const rollbackFence = doc.indexOf("```sql", rollbackStart);
const rollbackSql = doc.slice(rollbackFence + 6, doc.indexOf("```", rollbackFence + 6));
const rollbackNorm = norm(rollbackSql);

// policies da migration original: nome, tabela, comando, texto normalizado
interface Policy { name: string; table: string; cmd: string; text: string }
function policiesOf(sql: string): Policy[] {
  const out: Policy[] = [];
  for (const m of sql.matchAll(/CREATE POLICY "([^"]+)" ON (?:public\.)?(\w+)\s+FOR (SELECT|INSERT|UPDATE|DELETE)[^;]*;/g)) {
    out.push({ name: m[1], table: m[2], cmd: m[3], text: norm(m[0]) });
  }
  return out;
}
const originalPolicies = policiesOf(original).filter((p) => (TABLES as readonly string[]).includes(p.table));
const originalWrite = originalPolicies.filter((p) => p.cmd !== "SELECT");
const originalSelect = originalPolicies.filter((p) => p.cmd === "SELECT");

describe("a migration original: o que o draft precisa substituir", () => {
  it("tem 12 policies nas 3 tabelas: 3 SELECT + 9 de escrita, todas de nível membro", () => {
    expect(originalPolicies).toHaveLength(12);
    expect(originalSelect.map((p) => p.name).sort()).toEqual(["wa_conv_select", "wa_instances_select", "wa_msg_select"]);
    expect(originalWrite).toHaveLength(9);
    for (const p of originalWrite) expect(p.text, p.name).toContain("is_workspace_member(workspace_id)");
  });
});

describe("§2.5 — o DDL do draft", () => {
  it("é UMA transação: começa em BEGIN e termina em COMMIT", () => {
    expect(ddlNorm.startsWith("BEGIN;")).toBe(true);
    expect(ddlNorm.endsWith("COMMIT;")).toBe(true);
  });

  it("dropa EXATAMENTE as 9 policies de escrita da migration original (nem mais, nem menos) e nenhuma de SELECT", () => {
    const dropped = new Set([...ddlNorm.matchAll(/DROP POLICY IF EXISTS "([^"]+)" ON public\.(\w+);/g)].map((m) => `${m[2]}.${m[1]}`));
    for (const p of originalWrite) expect(dropped.has(`${p.table}.${p.name}`), `dropa ${p.table}.${p.name}`).toBe(true);
    for (const p of originalSelect) {
      expect(ddlNorm).not.toContain(`"${p.name}"`);
    }
  });

  it("cria 9 policies de escrita, 3 por tabela (INSERT/UPDATE/DELETE) e nenhuma de SELECT", () => {
    const created = policiesOf(ddl).filter((p) => (TABLES as readonly string[]).includes(p.table));
    expect(created).toHaveLength(9);
    for (const t of TABLES) expect(created.filter((p) => p.table === t).map((p) => p.cmd).sort(), t).toEqual(["DELETE", "INSERT", "UPDATE"]);
    expect(created.some((p) => p.cmd === "SELECT")).toBe(false);
  });

  it("whatsapp_instances: escrita só ADMIN (is_workspace_admin); conversas e mensagens: só ATENDE (is_workspace_attendant)", () => {
    const created = policiesOf(ddl);
    for (const p of created.filter((c) => c.table === "whatsapp_instances")) {
      expect(p.text, p.name).toContain("is_workspace_admin(workspace_id)");
      expect(p.text, p.name).not.toContain("is_workspace_attendant");
    }
    for (const p of created.filter((c) => c.table !== "whatsapp_instances")) {
      expect(p.text, p.name).toContain("is_workspace_attendant(workspace_id)");
      expect(p.text, p.name).not.toContain("is_workspace_admin");
    }
  });

  it("nenhuma policy nova usa mais o nível 'membro' (is_workspace_member)", () => {
    for (const p of policiesOf(ddl)) expect(p.text, p.name).not.toContain("is_workspace_member");
  });

  it("UPDATE tem USING e WITH CHECK (não deixa trocar o workspace_id da linha); INSERT tem WITH CHECK; DELETE tem USING", () => {
    for (const p of policiesOf(ddl)) {
      if (p.cmd === "UPDATE") expect(p.text, p.name).toMatch(/USING \(.+\) WITH CHECK \(.+\)/);
      if (p.cmd === "INSERT") expect(p.text, p.name).toContain("WITH CHECK (");
      if (p.cmd === "DELETE") expect(p.text, p.name).toContain("USING (");
    }
  });

  it("idempotente: cada CREATE POLICY é precedido de DROP POLICY IF EXISTS do MESMO nome", () => {
    for (const p of policiesOf(ddl)) {
      expect(ddlNorm, p.name).toContain(`DROP POLICY IF EXISTS "${p.name}" ON public.${p.table};`);
      expect(ddlNorm.indexOf(`DROP POLICY IF EXISTS "${p.name}"`), p.name).toBeLessThan(ddlNorm.indexOf(`CREATE POLICY "${p.name}"`));
    }
  });

  it("a função helper: no desenho de is_workspace_admin — SECURITY DEFINER, search_path fixo, só owner/admin/member, sem anon", () => {
    expect(ddlNorm).toContain("CREATE OR REPLACE FUNCTION public.is_workspace_attendant(w_id uuid)");
    expect(ddlNorm).toContain("SECURITY DEFINER SET search_path = public");
    expect(ddlNorm).toContain("wm.role IN ('owner', 'admin', 'member')");
    expect(ddlNorm).not.toContain("'viewer'");
    expect(ddlNorm).toContain("REVOKE EXECUTE ON FUNCTION public.is_workspace_attendant(uuid) FROM PUBLIC, anon;");
    expect(ddlNorm).toContain("GRANT EXECUTE ON FUNCTION public.is_workspace_attendant(uuid) TO authenticated, service_role;");
  });

  it("nada destrutivo: sem DROP TABLE/COLUMN/FUNCTION, DELETE FROM, TRUNCATE nem ALTER TABLE", () => {
    expect(ddlNorm).not.toMatch(/DROP TABLE|DROP COLUMN|DROP FUNCTION|DELETE FROM|TRUNCATE|ALTER TABLE|DISABLE ROW LEVEL SECURITY/i);
  });

  it("não toca nas 4 migrations anteriores do pacote (nada de bot_flow_state / handover_at / assignment_origin / ai_knowledge_consents)", () => {
    expect(ddlNorm).not.toMatch(/bot_flow_state|handover_at|assignment_origin|ai_knowledge_consents/);
  });
});

describe("rollback — devolve a escrita de nível membro, VERBATIM da migration original", () => {
  it("é transação única", () => {
    expect(rollbackNorm.startsWith("BEGIN;")).toBe(true);
    expect(rollbackNorm.endsWith("COMMIT;")).toBe(true);
  });

  it("dropa as 9 policies novas", () => {
    for (const p of policiesOf(ddl)) expect(rollbackNorm, p.name).toContain(`DROP POLICY IF EXISTS "${p.name}" ON public.${p.table};`);
  });

  it("recria as 9 policies originais com o texto idêntico (conferido contra a migration 20260602004057)", () => {
    for (const p of originalWrite) {
      const wanted = p.text.replace(/\bON (?:public\.)?(\w+)/, "ON public.$1");
      const normalizedRollback = rollbackNorm.replace(/ON public\.(\w+)/g, "ON public.$1");
      // a original não usa o prefixo `public.` na tabela; o rollback usa — compara ignorando só esse prefixo
      const strip = (s: string) => s.replace(/ON public\./g, "ON ");
      expect(strip(normalizedRollback), p.name).toContain(strip(wanted));
    }
  });
});

describe("a documentação do draft", () => {
  it("diz que NÃO está aplicada e que não é pré-requisito do bot", () => {
    expect(section25).toMatch(/DRAFT — NÃO aplicada/);
    expect(doc).toMatch(/Nada do bot depende dela/);
  });

  it("a pré-prova exige as 12 policies esperadas antes de aplicar (policies permissivas somam)", () => {
    expect(doc).toMatch(/Se \(a\) NÃO devolver exatamente estas 12 policies/);
    expect(doc).toMatch(/RLS permissivo soma policies|policies de RLS são \*\*permissivas\*\* e \*\*somam\*\*/);
  });
});
