// Repository do CONSENTIMENTO da base de conhecimento do robô — Etapa 9, item 3
// (docs/qa/etapa-9-item3-r1-base-conhecimento-liga.md).
//
// `public.ai_knowledge_consents` ainda é só um DRAFT de migration (§8-b do
// operador — NÃO aplicada) e portanto NÃO está em `types.ts`. Por isso o acesso
// passa por um tipo estrutural mínimo em vez do cliente tipado — e TODA função
// aqui trata "tabela ausente" como estado normal, não como erro: `list` devolve
// `available: false` e a UI mostra o aviso honesto. Depois que o operador aplicar
// a migration e regenerar `types.ts`, trocar `untyped` pelo cliente tipado (como
// `aiBrainRepository.ts`).
import { supabase } from "@/integrations/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import {
  canEnableCategory,
  parseKnowledgeConsents,
  type KnowledgeCategory,
  type KnowledgeConsent,
} from "../../supabase/functions/_shared/knowledgeConsent";

interface ErrorLike {
  message?: string;
  code?: string;
}

interface UntypedBuilder {
  select(columns: string): { eq(column: string, value: string): PromiseLike<{ data: unknown; error: ErrorLike | null }> };
  upsert(values: Record<string, unknown>, options: { onConflict: string }): PromiseLike<{ error: ErrorLike | null }>;
}

const untyped = supabase as unknown as { from(table: string): UntypedBuilder };

const TABLE = "ai_knowledge_consents";

// 42P01 = undefined_table (Postgres); PGRST205 = tabela fora do schema cache
// (PostgREST). A mensagem cobre variações de versão do gateway.
export function isMissingTableError(error: ErrorLike | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return /does not exist|schema cache|could not find the table/i.test(error.message ?? "");
}

export interface KnowledgeConsentsState {
  /** false = a tabela ainda não existe neste ambiente (migration pendente). */
  available: boolean;
  consents: KnowledgeConsent[];
}

export class KnowledgeConsentGateError extends Error {
  constructor(public readonly reason: "legal_basis_ack_required") {
    super("Esta categoria exige o atesto de base legal antes de ser ligada.");
    this.name = "KnowledgeConsentGateError";
  }
}

export const aiKnowledgeConsentsRepository = {
  async list(workspaceId: string): Promise<KnowledgeConsentsState> {
    const { data, error } = await untyped
      .from(TABLE)
      .select("category, enabled, legal_basis_ack, revoked_at")
      .eq("workspace_id", workspaceId);

    if (error) {
      if (isMissingTableError(error)) return { available: false, consents: [] };
      throw normalizeSupabaseError(error);
    }
    return { available: true, consents: parseKnowledgeConsents(data) };
  },

  /**
   * Liga/desliga UMA categoria. O gate do atesto roda ANTES de qualquer escrita
   * (mesmo predicado do servidor e do CHECK do draft). Nesta rodada a UI não
   * coleta atesto — categorias C/D/E ficam desabilitadas —, então `legalBasisAck`
   * é sempre `false` aqui e C/D/E nunca passam pelo gate.
   * Desligar nunca apaga a linha: grava `enabled=false` + `revoked_at` (auditoria).
   */
  async setEnabled(
    workspaceId: string,
    category: KnowledgeCategory,
    enabled: boolean,
    userId: string | null,
  ): Promise<void> {
    const now = new Date().toISOString();
    let values: Record<string, unknown>;

    if (enabled) {
      const gate = canEnableCategory(category, false);
      if (!gate.ok) throw new KnowledgeConsentGateError(gate.reason);
      values = {
        workspace_id: workspaceId,
        category,
        enabled: true,
        legal_basis_ack: false,
        enabled_by: userId,
        enabled_at: now,
        revoked_at: null,
      };
    } else {
      values = { workspace_id: workspaceId, category, enabled: false, revoked_at: now };
    }

    const { error } = await untyped.from(TABLE).upsert(values, { onConflict: "workspace_id,category" });
    if (error) throw normalizeSupabaseError(error);
  },
};
