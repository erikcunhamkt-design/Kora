-- Etapa 5 · Tarefas Fase B §1.1 — espelho de migration JÁ APLICADA
-- (docs/qa/migrations-espelho-8b.md).
--
-- APLICADA MANUALMENTE PELO OPERADOR EM 2026-08-30 (SESSÃO §8-b) —
-- confirmação do revisor (sessão executada ao vivo com o operador,
-- resultados via information_schema/pg_constraint no SQL Editor). Draft de
-- origem: docs/qa/etapa-5-flip-tarefas-migrations-drafts.md §1. Este
-- arquivo é SÓ ESPELHO — não roda nada novo contra produção. SQL adaptado
-- pra idempotência (ADD COLUMN IF NOT EXISTS; constraint via DO $$ IF NOT
-- EXISTS), já que os objetos JÁ EXISTEM em produção.
--
-- Nome da constraint: do draft, **A CONFIRMAR COM SELECT** (não
-- re-verificado individualmente por nome nesta rodada — só o
-- comportamento/colunas foram confirmados, não o nome literal de cada
-- constraint uma a uma). Passo do operador pra confirmar:
--   SELECT conname FROM pg_constraint WHERE conrelid = 'public.tasks'::regclass AND contype = 'c';
-- Se o nome retornado pra esta constraint divergir de `tasks_scope_known_chk`,
-- NÃO rodar este arquivo sem ajustar o nome primeiro.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS scope text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_scope_known_chk'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_scope_known_chk
        CHECK (scope IS NULL OR scope IN ('work', 'personal'));
  END IF;
END $$;
