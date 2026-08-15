// Repository for the "Cérebro" (AI brain) profile — Etapa 9, item 2.
//
// public.ai_brain_profiles existe no schema aplicado (migration
// supabase/migrations/20260815000000_etapa9_item2_ai_brain_profiles.sql,
// aplicada pelo operador) e o tipo `Database` já foi regenerado
// (`src/integrations/supabase/types.ts`) — sem cast na chamada `.from()`.
// Resultado ainda casteado pra `AiBrainProfile` (mesmo espírito da LEITURA
// em `financeRepository.ts`: nunca confiar só no tipo gerado sozinho).
import { supabase } from "@/integrations/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";

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
      .from("ai_brain_profiles")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (error) throw normalizeSupabaseError(error);
    return (data as unknown as AiBrainProfile | null) ?? null;
  },

  async upsert(workspaceId: string, fields: AiBrainProfileFields): Promise<AiBrainProfile> {
    const { data, error } = await supabase
      .from("ai_brain_profiles")
      .upsert({ workspace_id: workspaceId, ...fields }, { onConflict: "workspace_id" })
      .select()
      .single();

    if (error) throw normalizeSupabaseError(error);
    return data as unknown as AiBrainProfile;
  },
};
