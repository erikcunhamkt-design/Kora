// Etapa 9 · item 3 — regras de consentimento por categoria (docs/architecture/
// etapa-9-item3-base-conhecimento-fase-a.md §1.2/§2.3; docs/qa/etapa-9-item3-
// r1-base-conhecimento-fundacao.md). Lógica pura: o gate do atesto de base legal
// vale no SERVIDOR, não só na UI (defesa em profundidade, Fase A R1).
import { describe, expect, it } from "vitest";
import {
  KNOWLEDGE_CATEGORIES,
  activeCategories,
  canEnableCategory,
  isKnowledgeCategory,
  parseKnowledgeConsents,
  requiresLegalBasisAck,
  type KnowledgeConsent,
} from "../knowledgeConsent";

const row = (category: string, extra: Record<string, unknown> = {}) => ({
  category,
  enabled: true,
  legal_basis_ack: false,
  revoked_at: null,
  ...extra,
});

describe("categorias e atesto de base legal", () => {
  it("são as 5 da Fase A §1.2, nesta ordem", () => {
    expect([...KNOWLEDGE_CATEGORIES]).toEqual(["catalog", "internal_ops", "crm", "conversations", "financial"]);
  });

  it("só C/D/E (dado de terceiro / financeiro) exigem atesto; A/B não", () => {
    expect(requiresLegalBasisAck("catalog")).toBe(false);
    expect(requiresLegalBasisAck("internal_ops")).toBe(false);
    expect(requiresLegalBasisAck("crm")).toBe(true);
    expect(requiresLegalBasisAck("conversations")).toBe(true);
    expect(requiresLegalBasisAck("financial")).toBe(true);
  });

  it("isKnowledgeCategory rejeita o que não é uma das 5", () => {
    expect(isKnowledgeCategory("crm")).toBe(true);
    expect(isKnowledgeCategory("CRM")).toBe(false);
    expect(isKnowledgeCategory("quotes")).toBe(false);
    expect(isKnowledgeCategory(undefined)).toBe(false);
    expect(isKnowledgeCategory(3)).toBe(false);
  });
});

describe("canEnableCategory (Caso de homologação 3: ligar C sem ack é bloqueado)", () => {
  it("A/B ligam sem atesto", () => {
    expect(canEnableCategory("catalog", false)).toEqual({ ok: true });
    expect(canEnableCategory("internal_ops", false)).toEqual({ ok: true });
  });

  it("C/D/E sem atesto: bloqueado, com o motivo", () => {
    for (const c of ["crm", "conversations", "financial"] as const) {
      expect(canEnableCategory(c, false)).toEqual({ ok: false, reason: "legal_basis_ack_required" });
    }
  });

  it("C/D/E com atesto: liga", () => {
    for (const c of ["crm", "conversations", "financial"] as const) {
      expect(canEnableCategory(c, true)).toEqual({ ok: true });
    }
  });
});

describe("parseKnowledgeConsents (defensivo — tabela ausente/linhas ruins nunca lançam)", () => {
  it("null/undefined/não-array (SELECT falhou: tabela ainda não existe) -> sem consentimentos", () => {
    expect(parseKnowledgeConsents(null)).toEqual([]);
    expect(parseKnowledgeConsents(undefined)).toEqual([]);
    expect(parseKnowledgeConsents({ category: "catalog" })).toEqual([]);
    expect(parseKnowledgeConsents("lixo")).toEqual([]);
  });

  it("lê as colunas snake_case do banco", () => {
    expect(parseKnowledgeConsents([row("crm", { legal_basis_ack: true, revoked_at: "2026-10-01T00:00:00Z", enabled: false })])).toEqual([
      { category: "crm", enabled: false, legalBasisAck: true, revokedAt: "2026-10-01T00:00:00Z" },
    ]);
  });

  it("ignora linhas malformadas e de categoria desconhecida, mantém as boas", () => {
    const parsed = parseKnowledgeConsents([null, 42, { category: "quotes", enabled: true }, row("catalog")]);
    expect(parsed).toEqual([{ category: "catalog", enabled: true, legalBasisAck: false, revokedAt: null }]);
  });

  it("enabled/legal_basis_ack só valem se forem EXATAMENTE true (\"true\", 1 etc. = false)", () => {
    const [r] = parseKnowledgeConsents([row("catalog", { enabled: "true", legal_basis_ack: 1 })]);
    expect(r.enabled).toBe(false);
    expect(r.legalBasisAck).toBe(false);
  });
});

describe("activeCategories (o que o robô PODE usar agora)", () => {
  const c = (category: KnowledgeConsent["category"], extra: Partial<KnowledgeConsent> = {}): KnowledgeConsent => ({
    category, enabled: true, legalBasisAck: false, revokedAt: null, ...extra,
  });

  it("DEFAULT OFF: sem linhas nenhuma categoria está ativa (Caso 1 — comportamento idêntico a hoje)", () => {
    expect(activeCategories([])).toEqual([]);
  });

  it("só A ligada: só A ativa (Caso 2 — nenhum dado de CRM/conversa entra)", () => {
    expect(activeCategories([c("catalog")])).toEqual(["catalog"]);
  });

  it("enabled=false: inativa", () => {
    expect(activeCategories([c("catalog", { enabled: false })])).toEqual([]);
  });

  it("DEFESA EM PROFUNDIDADE: C/D/E com enabled=true mas SEM atesto NÃO ficam ativas (mesmo que a UI/um UPDATE tenha deixado assim)", () => {
    expect(activeCategories([c("crm"), c("conversations"), c("financial")])).toEqual([]);
  });

  it("C/D/E com atesto: ativas", () => {
    expect(activeCategories([c("crm", { legalBasisAck: true })])).toEqual(["crm"]);
  });

  it("revogada (revokedAt preenchido) nunca conta, mesmo com enabled residual (Caso 4)", () => {
    expect(activeCategories([c("catalog", { revokedAt: "2026-10-01T00:00:00Z" })])).toEqual([]);
  });

  it("linhas DUPLICADAS da mesma categoria: basta uma inativa pra não contar (nunca confia só no UNIQUE do banco)", () => {
    expect(activeCategories([c("catalog"), c("catalog", { enabled: false })])).toEqual([]);
    expect(activeCategories([c("catalog"), c("catalog")])).toEqual(["catalog"]);
  });

  it("devolve na ordem canônica das categorias, não na ordem das linhas", () => {
    expect(activeCategories([c("internal_ops"), c("catalog")])).toEqual(["catalog", "internal_ops"]);
  });

  it("ciclo fim a fim: linhas cruas do banco -> categorias ativas", () => {
    const raw = [
      row("catalog"),
      row("crm", { legal_basis_ack: false }), // ligada sem atesto: não vale
      row("financial", { legal_basis_ack: true, revoked_at: "2026-09-30T00:00:00Z" }), // revogada
      row("internal_ops", { enabled: false }),
    ];
    expect(activeCategories(parseKnowledgeConsents(raw))).toEqual(["catalog"]);
  });
});
