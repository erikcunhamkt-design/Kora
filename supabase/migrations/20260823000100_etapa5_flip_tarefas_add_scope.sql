-- Etapa 5 · Tarefas Fase B (docs/qa/etapa-5-flip-tarefas-pacote.md §1.1) —
-- campo bloqueante 1 de 4: `scope` particiona Tarefas.tsx em "Trabalho"/
-- "Pessoal" (filterScope, Tarefas.tsx:202,335,492). Vocabulário fechado,
-- definido pelo produto — CHECK preventivo (coluna nova, sem dado
-- existente pode violar: toda linha atual recebe NULL, e NULL passa no
-- CHECK abaixo).
--
-- PROPOSTA — NÃO aplicada pelo Code. Code não roda DDL contra produção
-- (protocolo §0/§6/§8-b). Aplicação é sempre do operador, via Supabase
-- CLI/dashboard, numa sessão §8-b.
--
-- Verificação prévia — rodar de novo na hora de aplicar, não confiar em
-- nenhum resultado registrado em docs/qa/etapa-5-flip-tarefas-migrations-drafts.md:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'scope';
-- Esperado: 0 linhas.

ALTER TABLE public.tasks
  ADD COLUMN scope text NULL,
  ADD CONSTRAINT tasks_scope_known_chk
    CHECK (scope IS NULL OR scope IN ('work', 'personal'));
