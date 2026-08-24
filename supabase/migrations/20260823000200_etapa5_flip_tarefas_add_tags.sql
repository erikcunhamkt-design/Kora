-- Etapa 5 · Tarefas Fase B (docs/qa/etapa-5-flip-tarefas-pacote.md §1.1) —
-- campo bloqueante 2 de 4: `tags[]` filtra a lista principal (filterTag,
-- Tarefas.tsx:334,828,977,1387) e aparece como badge no card. Campo LIVRE
-- (definido pelo usuário, sem lista fechada) — sem CHECK, mesmo
-- tratamento que `category` livre em outros domínios.
--
-- PROPOSTA — NÃO aplicada pelo Code. Code não roda DDL contra produção
-- (protocolo §0/§6/§8-b). Aplicação é sempre do operador, via Supabase
-- CLI/dashboard, numa sessão §8-b.
--
-- Verificação prévia — rodar de novo na hora de aplicar, não confiar em
-- nenhum resultado registrado em docs/qa/etapa-5-flip-tarefas-migrations-drafts.md:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'tags';
-- Esperado: 0 linhas.

ALTER TABLE public.tasks
  ADD COLUMN tags text[] NULL DEFAULT '{}';
