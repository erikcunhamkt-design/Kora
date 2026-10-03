-- Etapa 5 · Tarefas Fase B §1.1 — espelho de migration JÁ APLICADA
-- (docs/qa/migrations-espelho-8b.md).
--
-- APLICADA MANUALMENTE PELO OPERADOR EM 2026-08-30 (SESSÃO §8-b) —
-- confirmação do revisor (sessão executada ao vivo com o operador,
-- resultados via information_schema no SQL Editor). Draft de origem:
-- docs/qa/etapa-5-flip-tarefas-migrations-drafts.md §2. Este arquivo é SÓ
-- ESPELHO — não roda nada novo contra produção. SQL idempotente (ADD
-- COLUMN IF NOT EXISTS), já que a coluna JÁ EXISTE em produção.
--
-- Sem CHECK (campo livre, sem vocabulário fechado — ver draft).
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS tags text[] NULL DEFAULT '{}';
