-- G71 — espelho de migration JÁ APLICADA (docs/qa/migrations-espelho-8b.md).
--
-- APLICADA MANUALMENTE PELO OPERADOR EM 2026-08-30 (SESSÃO §8-b) —
-- confirmação do revisor (sessão executada ao vivo com o operador,
-- resultados no SQL Editor). Draft de origem:
-- docs/qa/g71-credenciais-terceiros-pacote-operador.md §3.1. Este arquivo
-- é SÓ ESPELHO — não roda nada novo contra produção. Restringe escrita de
-- workspace_ai_credentials (credencial jsonb da Vertex AI, inclui
-- private_key de service account) a admins do workspace — precedente já
-- em uso no repo: whatsapp_official_credentials (migration
-- 20260615173900_aa74fe4c-...sql), mesma função is_workspace_admin
-- (role IN ('owner','admin')). SELECT permanece member — intocado, não
-- faz parte deste arquivo.
--
-- Nomes das 3 policies "Admins can ..." abaixo: do draft, **A CONFIRMAR
-- COM SELECT** (comportamento confirmado pelo operador, mas os nomes
-- literais não foram re-verificados individualmente nesta rodada). Passo
-- do operador:
--   SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_ai_credentials';
-- Se algum nome retornado divergir do usado abaixo, NÃO rodar este
-- arquivo sem ajustar o nome primeiro.
--
-- Idempotente: DROP POLICY IF EXISTS (nas antigas, "Members can...") +
-- CREATE POLICY guardado por DO $$ IF NOT EXISTS em pg_policies (nas
-- novas, "Admins can...") — CREATE POLICY não suporta IF NOT EXISTS
-- nativamente no Postgres.

DROP POLICY IF EXISTS "Members can insert AI credentials in their workspace" ON public.workspace_ai_credentials;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workspace_ai_credentials'
      AND policyname = 'Admins can insert AI credentials in their workspace'
  ) THEN
    CREATE POLICY "Admins can insert AI credentials in their workspace"
      ON public.workspace_ai_credentials FOR INSERT
      TO authenticated
      WITH CHECK (public.is_workspace_admin(workspace_id));
  END IF;
END $$;

DROP POLICY IF EXISTS "Members can update AI credentials in their workspace" ON public.workspace_ai_credentials;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workspace_ai_credentials'
      AND policyname = 'Admins can update AI credentials in their workspace'
  ) THEN
    CREATE POLICY "Admins can update AI credentials in their workspace"
      ON public.workspace_ai_credentials FOR UPDATE
      TO authenticated
      USING (public.is_workspace_admin(workspace_id))
      WITH CHECK (public.is_workspace_admin(workspace_id));
  END IF;
END $$;

DROP POLICY IF EXISTS "Members can delete AI credentials in their workspace" ON public.workspace_ai_credentials;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workspace_ai_credentials'
      AND policyname = 'Admins can delete AI credentials in their workspace'
  ) THEN
    CREATE POLICY "Admins can delete AI credentials in their workspace"
      ON public.workspace_ai_credentials FOR DELETE
      TO authenticated
      USING (public.is_workspace_admin(workspace_id));
  END IF;
END $$;
