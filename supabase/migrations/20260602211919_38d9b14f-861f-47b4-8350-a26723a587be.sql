CREATE TABLE public.whatsapp_favorite_stickers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  sticker_url TEXT NOT NULL,
  mime_type TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, sticker_url)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_favorite_stickers TO authenticated;
GRANT ALL ON public.whatsapp_favorite_stickers TO service_role;

ALTER TABLE public.whatsapp_favorite_stickers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_fav_select" ON public.whatsapp_favorite_stickers
  FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));
CREATE POLICY "wa_fav_insert" ON public.whatsapp_favorite_stickers
  FOR INSERT TO authenticated WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "wa_fav_delete" ON public.whatsapp_favorite_stickers
  FOR DELETE TO authenticated USING (is_workspace_member(workspace_id));

CREATE INDEX idx_wa_fav_workspace ON public.whatsapp_favorite_stickers(workspace_id);