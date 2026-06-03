CREATE TABLE public.whatsapp_internal_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  author_id UUID,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_internal_notes TO authenticated;
GRANT ALL ON public.whatsapp_internal_notes TO service_role;

ALTER TABLE public.whatsapp_internal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_notes_select" ON public.whatsapp_internal_notes
  FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));
CREATE POLICY "wa_notes_insert" ON public.whatsapp_internal_notes
  FOR INSERT TO authenticated WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "wa_notes_update" ON public.whatsapp_internal_notes
  FOR UPDATE TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "wa_notes_delete" ON public.whatsapp_internal_notes
  FOR DELETE TO authenticated USING (is_workspace_member(workspace_id));

CREATE INDEX idx_wa_notes_conversation ON public.whatsapp_internal_notes(conversation_id, created_at DESC);

CREATE TRIGGER update_wa_notes_updated_at
  BEFORE UPDATE ON public.whatsapp_internal_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();