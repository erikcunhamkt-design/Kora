-- Etapa 5 · Tarefas Fase B (docs/qa/etapa-5-flip-tarefas-pacote.md §1.1) —
-- campo bloqueante 4 de 4: 3 colunas simples, sem tabela nova. useTaskReminders.ts
-- já dispara notificação 100% client-side (setInterval 30s + Notification
-- API) — uma vez que useBifurcatedTasks exista (Fase B, fora deste arquivo), o
-- hook só precisa trocar a fonte de dados (já usa o padrão latest-ref,
-- pré-G31) pro lembrete continuar funcionando sem arquitetura nova.
-- reminder_enabled tem DEFAULT seguro (false) — não precisa de CHECK
-- (boolean já é vocabulário fechado por tipo; timestamptz idem).
--
-- PROPOSTA — NÃO aplicada pelo Code. Code não roda DDL contra produção
-- (protocolo §0/§6/§8-b). Aplicação é sempre do operador, via Supabase
-- CLI/dashboard, numa sessão §8-b.
--
-- Verificação prévia — rodar de novo na hora de aplicar, não confiar em
-- nenhum resultado registrado em docs/qa/etapa-5-flip-tarefas-migrations-drafts.md:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'tasks'
--     AND column_name IN ('reminder_at', 'reminder_enabled', 'reminder_sent_at');
-- Esperado: 0 linhas.

ALTER TABLE public.tasks
  ADD COLUMN reminder_at timestamptz NULL,
  ADD COLUMN reminder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN reminder_sent_at timestamptz NULL;
