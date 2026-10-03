-- Etapa 5 · Tarefas Fase B §1.1 — espelho de migration JÁ APLICADA
-- (docs/qa/migrations-espelho-8b.md).
--
-- APLICADA MANUALMENTE PELO OPERADOR EM 2026-08-30 (SESSÃO §8-b) —
-- confirmação do revisor (sessão executada ao vivo com o operador,
-- resultados via information_schema no SQL Editor). Draft de origem:
-- docs/qa/etapa-5-flip-tarefas-migrations-drafts.md §4. Este arquivo é SÓ
-- ESPELHO — não roda nada novo contra produção. SQL idempotente (ADD
-- COLUMN IF NOT EXISTS), já que as 3 colunas JÁ EXISTEM em produção.
--
-- Sem CHECK (reminder_enabled tem DEFAULT seguro; timestamptz/boolean já
-- são vocabulário fechado por tipo — ver draft).
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS reminder_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz NULL;
