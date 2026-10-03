-- G71 — espelho de migration JÁ APLICADA (docs/qa/migrations-espelho-8b.md).
--
-- APLICADA MANUALMENTE PELO OPERADOR EM 2026-08-30 (SESSÃO §8-b) —
-- confirmação do revisor (sessão executada ao vivo com o operador,
-- resultados no SQL Editor). Draft de origem:
-- docs/qa/g71-credenciais-terceiros-pacote-operador.md §3.2. Este arquivo
-- é SÓ ESPELHO — não roda nada novo contra produção. Restringe escrita de
-- whatsapp_bot_settings (guarda gemini_api_key/gcp_service_account em
-- colunas dedicadas) a admins do workspace. A policy antiga ("Workspace
-- members can modify bot settings") era FOR ALL (cobria INSERT/UPDATE/
-- DELETE num único USING/WITH CHECK member-level) — virou 3 policies
-- separadas pra restringir só a escrita. SELECT permanece com a policy
-- própria ("Workspace members can view bot settings") — intocada, não faz
-- parte deste arquivo.
--
-- Nomes das 3 policies "Workspace admins can ..." abaixo: do draft, **A
-- CONFIRMAR COM SELECT** (comportamento confirmado pelo operador, mas os
-- nomes literais não foram re-verificados individualmente nesta rodada).
-- Passo do operador:
--   SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'whatsapp_bot_settings';
-- Se algum nome retornado divergir do usado abaixo, NÃO rodar este
-- arquivo sem ajustar o nome primeiro.
--
-- Idempotente: DROP POLICY IF EXISTS (na antiga FOR ALL) + CREATE POLICY
-- guardado por DO $$ IF NOT EXISTS em pg_policies (nas 3 novas) — CREATE
-- POLICY não suporta IF NOT EXISTS nativamente no Postgres.

DROP POLICY IF EXISTS "Workspace members can modify bot settings" ON public.whatsapp_bot_settings;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'whatsapp_bot_settings'
      AND policyname = 'Workspace admins can insert bot settings'
  ) THEN
    CREATE POLICY "Workspace admins can insert bot settings"
      ON public.whatsapp_bot_settings FOR INSERT
      TO authenticated
      WITH CHECK (public.is_workspace_admin(workspace_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'whatsapp_bot_settings'
      AND policyname = 'Workspace admins can update bot settings'
  ) THEN
    CREATE POLICY "Workspace admins can update bot settings"
      ON public.whatsapp_bot_settings FOR UPDATE
      TO authenticated
      USING (public.is_workspace_admin(workspace_id))
      WITH CHECK (public.is_workspace_admin(workspace_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'whatsapp_bot_settings'
      AND policyname = 'Workspace admins can delete bot settings'
  ) THEN
    CREATE POLICY "Workspace admins can delete bot settings"
      ON public.whatsapp_bot_settings FOR DELETE
      TO authenticated
      USING (public.is_workspace_admin(workspace_id));
  END IF;
END $$;
