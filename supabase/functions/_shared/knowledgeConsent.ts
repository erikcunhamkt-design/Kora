// Etapa 9 · Item 3 (base de conhecimento do robô) — regras de CONSENTIMENTO por
// categoria (docs/architecture/etapa-9-item3-base-conhecimento-fase-a.md §1.2/§2;
// docs/qa/etapa-9-item3-r1-base-conhecimento-fundacao.md). Pure logic — sem
// Deno.*, sem npm: imports — mesmo padrão de brainComposer.ts/botHandover.ts:
// importável pelo server (Edge Function) e testável via vitest sem banco.
//
// O QUE ESTE MÓDULO É: a única fonte das 5 categorias e da regra "quem exige
// atesto de base legal" — pra o gate NÃO morar só na UI. O servidor reaplica
// `activeCategories()` sobre as linhas lidas do banco (defesa em profundidade,
// Fase A §2.3/R1): uma linha `enabled = true` de categoria C/D/E SEM
// `legal_basis_ack` nunca conta como ativa, mesmo que a UI (ou um UPDATE direto)
// a tenha deixado assim.
//
// O QUE NÃO É (ainda): nada aqui lê dado do workspace nem monta contexto — só
// decide QUAIS categorias o operador autorizou. A tabela que guarda isso
// (`ai_knowledge_consents`) é só um DRAFT de migration no doc da rodada.

export const KNOWLEDGE_CATEGORIES = [
  "catalog", // A — catálogo comercial (dado do próprio negócio do operador)
  "internal_ops", // B — operacional interno (tasks/projects)
  "crm", // C — cadastro/CRM (dado pessoal de CLIENTE do operador — terceiro)
  "conversations", // D — conversas WhatsApp (dado pessoal de terceiro, o mais sensível)
  "financial", // E — financeiro
] as const;

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

// Categorias que envolvem dado pessoal de terceiro (C/D) ou financeiro
// individual (E): ligar exige que o OPERADOR ateste ter base legal própria
// perante o cliente dele (Fase A §1.1 — o "sim" do operador é uma declaração,
// não um consentimento que a Kora coleta em nome do titular).
const LEGAL_BASIS_REQUIRED: ReadonlySet<KnowledgeCategory> = new Set<KnowledgeCategory>([
  "crm",
  "conversations",
  "financial",
]);

export function isKnowledgeCategory(value: unknown): value is KnowledgeCategory {
  return typeof value === "string" && (KNOWLEDGE_CATEGORIES as readonly string[]).includes(value);
}

export function requiresLegalBasisAck(category: KnowledgeCategory): boolean {
  return LEGAL_BASIS_REQUIRED.has(category);
}

export type CanEnableResult =
  | { ok: true }
  | { ok: false; reason: "legal_basis_ack_required" };

// Gate de LIGAR uma categoria (UI e qualquer escrita futura chamam o mesmo
// predicado): C/D/E sem o atesto marcado não liga.
export function canEnableCategory(category: KnowledgeCategory, legalBasisAck: boolean): CanEnableResult {
  if (requiresLegalBasisAck(category) && !legalBasisAck) {
    return { ok: false, reason: "legal_basis_ack_required" };
  }
  return { ok: true };
}

export interface KnowledgeConsent {
  category: KnowledgeCategory;
  enabled: boolean;
  legalBasisAck: boolean;
  /** Preenchido ao desligar (Fase A §2.3: nunca hard-delete, só flip + carimbo). */
  revokedAt: string | null;
}

// Lê as linhas cruas de `ai_knowledge_consents` (snake_case do banco).
// Defensivo: `raw` pode ser `null`/`undefined` (tabela ainda não existe — erro
// de SELECT vira "sem linhas" no chamador), não-array ou ter linhas
// malformadas/de categoria desconhecida — tudo isso vira "sem consentimento",
// nunca lança. `enabled`/`legal_basis_ack` só valem se forem EXATAMENTE `true`.
export function parseKnowledgeConsents(raw: unknown): KnowledgeConsent[] {
  if (!Array.isArray(raw)) return [];
  const result: KnowledgeConsent[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (!isKnowledgeCategory(r.category)) continue;
    result.push({
      category: r.category,
      enabled: r.enabled === true,
      legalBasisAck: r.legal_basis_ack === true,
      revokedAt: typeof r.revoked_at === "string" && r.revoked_at.length > 0 ? r.revoked_at : null,
    });
  }
  return result;
}

function isActive(consent: KnowledgeConsent): boolean {
  if (!consent.enabled) return false;
  if (consent.revokedAt !== null) return false; // revogado: nunca conta, mesmo com enabled residual
  return canEnableCategory(consent.category, consent.legalBasisAck).ok;
}

// Categorias que o robô PODE usar agora. Conservador por desenho:
// - default OFF (categoria sem linha = inativa);
// - revogada, ou C/D/E sem atesto = inativa (reaplica o gate do servidor);
// - linhas duplicadas da mesma categoria (o UNIQUE do banco impede, mas aqui
//   nunca se confia só nele): basta UMA inativa pra categoria não contar.
export function activeCategories(consents: KnowledgeConsent[]): KnowledgeCategory[] {
  return KNOWLEDGE_CATEGORIES.filter((category) => {
    const rows = consents.filter((c) => c.category === category);
    return rows.length > 0 && rows.every(isActive);
  });
}
