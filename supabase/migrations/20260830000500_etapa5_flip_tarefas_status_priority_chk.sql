-- Etapa 5 · Tarefas Fase B §3.1 item 2 — espelho de migration JÁ APLICADA
-- (docs/qa/migrations-espelho-8b.md).
--
-- APLICADA MANUALMENTE PELO OPERADOR EM 2026-08-30 (SESSÃO §8-b) —
-- confirmação do revisor (sessão executada ao vivo com o operador,
-- resultados via information_schema/pg_constraint no SQL Editor). Draft de
-- origem: docs/qa/etapa-5-flip-tarefas-migrations-drafts.md §5. Este
-- arquivo é SÓ ESPELHO — não roda nada novo contra produção. Idempotente
-- (ALTER COLUMN ... SET DEFAULT já é no-op seguro se repetido; constraints
-- via DO $$ IF NOT EXISTS), já que os objetos JÁ EXISTEM em produção.
--
-- `tasks_status_known_chk` — nome CONFIRMADO: violação real e observada em
-- produção durante a homologação de Tarefas
-- (docs/qa/etapa-5-flip-tarefas-homologacao-fase-d.md, Caso 2.3 — um
-- UPDATE com valor inválido falhou com erro 23514 citando este nome
-- literal).
--
-- `tasks_priority_known_chk` — nome do draft, **A CONFIRMAR COM SELECT**
-- (comportamento confirmado, mas não o nome literal individualmente).
-- Passo do operador:
--   SELECT conname FROM pg_constraint WHERE conrelid = 'public.tasks'::regclass AND contype = 'c';
-- Se o nome retornado pra priority divergir de `tasks_priority_known_chk`,
-- NÃO rodar este arquivo sem ajustar o nome primeiro.
ALTER TABLE public.tasks
  ALTER COLUMN status SET DEFAULT 'a_fazer',
  ALTER COLUMN priority SET DEFAULT 'média';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_status_known_chk'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_status_known_chk
        CHECK (status IN ('a_fazer', 'em_andamento', 'revisao', 'concluido'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_priority_known_chk'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_priority_known_chk
        CHECK (priority IN ('alta', 'média', 'baixa'));
  END IF;
END $$;
