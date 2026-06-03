CREATE TABLE public.whatsapp_quick_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  created_by UUID,
  shortcut TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, shortcut)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_quick_replies TO authenticated;
GRANT ALL ON public.whatsapp_quick_replies TO service_role;

ALTER TABLE public.whatsapp_quick_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_qr_select" ON public.whatsapp_quick_replies
  FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));
CREATE POLICY "wa_qr_insert" ON public.whatsapp_quick_replies
  FOR INSERT TO authenticated WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "wa_qr_update" ON public.whatsapp_quick_replies
  FOR UPDATE TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "wa_qr_delete" ON public.whatsapp_quick_replies
  FOR DELETE TO authenticated USING (is_workspace_member(workspace_id));

CREATE INDEX idx_wa_qr_workspace ON public.whatsapp_quick_replies(workspace_id, shortcut);

CREATE TRIGGER update_wa_qr_updated_at
  BEFORE UPDATE ON public.whatsapp_quick_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();