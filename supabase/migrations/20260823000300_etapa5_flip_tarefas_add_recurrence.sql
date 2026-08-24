-- Etapa 5 · Tarefas Fase B (docs/qa/etapa-5-flip-tarefas-pacote.md §1.1) —
-- campo bloqueante 3 de 4: `recurrence` é só um enum de 5 valores gravado no
-- próprio registro (Task.recurrence, useTasks.ts:7) — confirmado por grep
-- exaustivo que NÃO existe mecanismo de geração de próxima ocorrência (nem
-- client-side, nem server-side); é 1 coluna + CHECK, não um domínio novo
-- (diferente de RecurringEntry de Financeiro).
--
-- PROPOSTA — NÃO aplicada pelo Code. Code não roda DDL contra produção
-- (protocolo §0/§6/§8-b). Aplicação é sempre do operador, via Supabase
-- CLI/dashboard, numa sessão §8-b.
--
-- Verificação prévia — rodar de novo na hora de aplicar, não confiar em
-- nenhum resultado registrado em docs/qa/etapa-5-flip-tarefas-migrations-drafts.md:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'recurrence';
-- Esperado: 0 linhas.

ALTER TABLE public.tasks
  ADD COLUMN recurrence text NULL,
  ADD CONSTRAINT tasks_recurrence_known_chk
    CHECK (recurrence IS NULL OR recurrence IN ('none', 'daily', 'weekly', 'monthly', 'weekdays'));
