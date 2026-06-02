
-- 1. whatsapp_audiences
CREATE TABLE IF NOT EXISTS public.whatsapp_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  source text,
  tags text[] DEFAULT '{}',
  status text DEFAULT 'draft',
  total_contacts integer DEFAULT 0,
  valid_contacts integer DEFAULT 0,
  invalid_contacts integer DEFAULT 0,
  duplicate_contacts integer DEFAULT 0,
  archived boolean DEFAULT false,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_audiences TO authenticated;
GRANT ALL ON public.whatsapp_audiences TO service_role;
ALTER TABLE public.whatsapp_audiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_aud_select" ON public.whatsapp_audiences FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "wa_aud_insert" ON public.whatsapp_audiences FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "wa_aud_update" ON public.whatsapp_audiences FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "wa_aud_delete" ON public.whatsapp_audiences FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE TRIGGER trg_wa_aud_updated_at BEFORE UPDATE ON public.whatsapp_audiences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_wa_aud_workspace ON public.whatsapp_audiences(workspace_id);

-- 2. whatsapp_audience_contacts
CREATE TABLE IF NOT EXISTS public.whatsapp_audience_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  audience_id uuid NOT NULL REFERENCES public.whatsapp_audiences(id) ON DELETE CASCADE,
  name text,
  phone text NOT NULL,
  normalized_phone text NOT NULL,
  email text,
  company text,
  tag text,
  origin text,
  notes text,
  has_opt_in boolean DEFAULT false,
  opt_in_source text,
  opt_in_at timestamptz,
  is_valid boolean DEFAULT true,
  validation_reason text,
  is_duplicate boolean DEFAULT false,
  matched_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  matched_conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
  blocked boolean DEFAULT false,
  opt_out boolean DEFAULT false,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_audience_contacts TO authenticated;
GRANT ALL ON public.whatsapp_audience_contacts TO service_role;
ALTER TABLE public.whatsapp_audience_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_audc_select" ON public.whatsapp_audience_contacts FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "wa_audc_insert" ON public.whatsapp_audience_contacts FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "wa_audc_update" ON public.whatsapp_audience_contacts FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "wa_audc_delete" ON public.whatsapp_audience_contacts FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE TRIGGER trg_wa_audc_updated_at BEFORE UPDATE ON public.whatsapp_audience_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_wa_audc_workspace ON public.whatsapp_audience_contacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_wa_audc_audience ON public.whatsapp_audience_contacts(audience_id);
CREATE INDEX IF NOT EXISTS idx_wa_audc_phone ON public.whatsapp_audience_contacts(normalized_phone);

-- 3. whatsapp_templates
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  internal_name text,
  category text NOT NULL,
  language text DEFAULT 'pt_BR',
  status text DEFAULT 'draft',
  body text NOT NULL,
  variables jsonb DEFAULT '[]'::jsonb,
  sample_values jsonb DEFAULT '{}'::jsonb,
  provider_template_id text,
  rejection_reason text,
  last_used_at timestamptz,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_templates TO authenticated;
GRANT ALL ON public.whatsapp_templates TO service_role;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_tpl_select" ON public.whatsapp_templates FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "wa_tpl_insert" ON public.whatsapp_templates FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "wa_tpl_update" ON public.whatsapp_templates FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "wa_tpl_delete" ON public.whatsapp_templates FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE TRIGGER trg_wa_tpl_updated_at BEFORE UPDATE ON public.whatsapp_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_wa_tpl_workspace ON public.whatsapp_templates(workspace_id);

-- 4. whatsapp_campaigns_v2 (novo schema; antigo whatsapp_campaigns preservado)
CREATE TABLE IF NOT EXISTS public.whatsapp_campaigns_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  objective text,
  audience_id uuid REFERENCES public.whatsapp_audiences(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  mode text DEFAULT 'template_campaign',
  status text DEFAULT 'draft',
  scheduled_at timestamptz,
  total_recipients integer DEFAULT 0,
  valid_recipients integer DEFAULT 0,
  sent_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  delivered_count integer DEFAULT 0,
  read_count integer DEFAULT 0,
  replied_count integer DEFAULT 0,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_campaigns_v2 TO authenticated;
GRANT ALL ON public.whatsapp_campaigns_v2 TO service_role;
ALTER TABLE public.whatsapp_campaigns_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_camp2_select" ON public.whatsapp_campaigns_v2 FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "wa_camp2_insert" ON public.whatsapp_campaigns_v2 FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "wa_camp2_update" ON public.whatsapp_campaigns_v2 FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "wa_camp2_delete" ON public.whatsapp_campaigns_v2 FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE TRIGGER trg_wa_camp2_updated_at BEFORE UPDATE ON public.whatsapp_campaigns_v2 FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_wa_camp2_workspace ON public.whatsapp_campaigns_v2(workspace_id);

-- 5. whatsapp_campaign_recipients
CREATE TABLE IF NOT EXISTS public.whatsapp_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.whatsapp_campaigns_v2(id) ON DELETE CASCADE,
  audience_contact_id uuid REFERENCES public.whatsapp_audience_contacts(id) ON DELETE SET NULL,
  phone text NOT NULL,
  normalized_phone text NOT NULL,
  name text,
  status text DEFAULT 'pending',
  skip_reason text,
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  replied_at timestamptz,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_campaign_recipients TO authenticated;
GRANT ALL ON public.whatsapp_campaign_recipients TO service_role;
ALTER TABLE public.whatsapp_campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_recip_select" ON public.whatsapp_campaign_recipients FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "wa_recip_insert" ON public.whatsapp_campaign_recipients FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "wa_recip_update" ON public.whatsapp_campaign_recipients FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "wa_recip_delete" ON public.whatsapp_campaign_recipients FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE TRIGGER trg_wa_recip_updated_at BEFORE UPDATE ON public.whatsapp_campaign_recipients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_wa_recip_campaign ON public.whatsapp_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_wa_recip_workspace ON public.whatsapp_campaign_recipients(workspace_id);

-- 6. whatsapp_opt_outs
CREATE TABLE IF NOT EXISTS public.whatsapp_opt_outs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  phone text NOT NULL,
  normalized_phone text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_opt_outs TO authenticated;
GRANT ALL ON public.whatsapp_opt_outs TO service_role;
ALTER TABLE public.whatsapp_opt_outs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_opt_select" ON public.whatsapp_opt_outs FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "wa_opt_insert" ON public.whatsapp_opt_outs FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "wa_opt_update" ON public.whatsapp_opt_outs FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "wa_opt_delete" ON public.whatsapp_opt_outs FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE INDEX IF NOT EXISTS idx_wa_opt_workspace_phone ON public.whatsapp_opt_outs(workspace_id, normalized_phone);
