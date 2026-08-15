// Repository for the "Cérebro" (AI brain) profile — Etapa 9, item 2.
//
// public.ai_brain_profiles ainda NÃO existe no schema aplicado — a migration
// (supabase/migrations/20260815000000_etapa9_item2_ai_brain_profiles.sql)
// foi ESCRITA nesta rodada, não aplicada (gate do operador, protocolo §8-b).
// Por isso a tabela não está no tipo `Database` gerado ainda
// (`src/integrations/supabase/types.ts`, regenerado só depois da migration
// aplicada) — `supabase.from(...)` é tipado contra `Database`
// (`createClient<Database>`, `integrations/supabase/client.ts`), então o
// nome da tabela precisa de um cast explícito aqui. Mesmo espírito do lado
// da LEITURA em `financeRepository.ts` (resultado sempre casteado pra uma
// interface própria, nunca confiado ao tipo gerado sozinho) — trocar por
// `.from("ai_brain_profiles")` sem cast assim que os tipos forem
// regenerados pós-migration.
import { supabase } from "@/integrations/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ver comentário do topo do arquivo
const TABLE = "ai_brain_profiles" as any;

export interface AiBrainProfile {
  id: string;
  workspace_id: string;
  tone: string | null;
  talk_about: string | null;
  dont_talk_about: string | null;
  products_services: string | null;
  limits: string | null;
  created_at: string;
  updated_at: string;
}

export type AiBrainProfileFields = Pick<
  AiBrainProfile,
  "tone" | "talk_about" | "dont_talk_about" | "products_services" | "limits"
>;

export const aiBrainRepository = {
  async getByWorkspace(workspaceId: string): Promise<AiBrainProfile | null> {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (error) throw normalizeSupabaseError(error);
    return (data as unknown as AiBrainProfile | null) ?? null;
  },

  async upsert(workspaceId: string, fields: AiBrainProfileFields): Promise<AiBrainProfile> {
    const { data, error } = await supabase
      .from(TABLE)
      .upsert({ workspace_id: workspaceId, ...fields }, { onConflict: "workspace_id" })
      .select()
      .single();

    if (error) throw normalizeSupabaseError(error);
    return data as unknown as AiBrainProfile;
  },
};
