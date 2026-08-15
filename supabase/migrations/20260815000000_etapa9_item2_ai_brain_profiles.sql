-- Etapa 9 · item 2 — "Cérebro" do robô, Fase B (schema)
--
-- ESCRITA NESTA RODADA, NÃO APLICADA. Aplicação é sessão §8-b dedicada com o
-- operador. Ver docs/architecture/etapa-9-item2-cerebro-fase-a.md §2 para o
-- desenho completo (campos, alternativas descartadas, justificativa de
-- tabela própria vs. coluna em whatsapp_bot_settings).
--
-- R3 (Fase A, §2.2) corrigido por desenho, não por reatividade:
-- whatsapp_bot_settings.workspace_id nunca ganhou FK declarada (dívida
-- técnica antiga, não decisão deliberada) — esta tabela nasce com
-- REFERENCES, não repete a lacuna.
--
-- Uma linha por workspace (1:1) — UNIQUE(workspace_id) via PRIMARY KEY
-- implícito na FK, não uma tabela de histórico/múltiplas versões. Todos os
-- 5 campos são TEXT livre, preenchidos manualmente pelo operador — nenhum
-- pipeline os popula a partir de clients/crm_opportunities/whatsapp_messages
-- (fronteira com o item 3, base de conhecimento — ver
-- etapa-9-item3-base-conhecimento-fase-a.md §4: "o cérebro NUNCA deve conter
-- dado pessoal de terceiro", garantido por construção, não por disciplina).

CREATE TABLE IF NOT EXISTS public.ai_brain_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tone TEXT,
  talk_about TEXT,
  dont_talk_about TEXT,
  products_services TEXT,
  limits TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_brain_profiles IS
  'Etapa 9 · item 2 — perfil de instruções da empresa por workspace (tom, o que falar/não falar, produtos/serviços, limites), consumido pela composição de prompt do robô de WhatsApp (supabase/functions/_shared/brainComposer.ts). Campos livres preenchidos manualmente pelo operador — nunca automatizados a partir de dado de cliente/CRM.';

ALTER TABLE public.ai_brain_profiles ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão da casa (is_workspace_member) — precedente citado na Fase A:
-- whatsapp_bot_settings (20260602153027_...sql) e crm_opportunities
-- (20260530050000_create_crm_opportunities.sql).
CREATE POLICY "Workspace members can view brain profile"
  ON public.ai_brain_profiles FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Workspace members can modify brain profile"
  ON public.ai_brain_profiles FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE TRIGGER update_ai_brain_profiles_updated_at
BEFORE UPDATE ON public.ai_brain_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
