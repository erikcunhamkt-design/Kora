-- Etapa 5 · Tarefas Fase B (etapa-5-flip-tarefas-pacote.md §3.1, item 2 da
-- sequência proposta) — CHECK preventivo de status/priority, liberado pelo
-- fix do G49 (produtor CreateProjectBaseTasksDialog.tsx corrigido,
-- confirmado mesclado). Mesmo molde de
-- 20260815000200_etapa5_flip_financeiro_type_status_known_chk.sql (CHECK +
-- SELECTs de verificação no corpo da migration).
--
-- PROPOSTA — NÃO aplicada pelo Code. Code não roda DDL contra produção
-- (protocolo §0/§6/§8-b). Aplicação é sempre do operador, via Supabase
-- CLI/dashboard, numa sessão §8-b.
--
-- ATENÇÃO — desde que este draft foi escrito (Fase B, mesa vazia
-- confirmada em 15/ago/2026 por docs/qa/tarefas-r2-auditoria.md §4), a
-- Fase C do flip de Tarefas ENTROU EM MAIN (kora.tasks.dataSource.v1 e
-- kora.tasks.supabaseWrite.v1 agora nascem em "supabase"/ligado por
-- default) — ou seja, é ESPERADO que `public.tasks` já tenha linhas reais
-- escritas pelo caminho nativo (B5) na hora de aplicar esta migration. O
-- resultado de 15/ago NÃO pode ser reaproveitado como prova sob nenhuma
-- circunstância — rodar as 2 queries abaixo DE NOVO, sempre.
--
-- Passo do operador ANTES de aplicar:
--   SELECT status, count(*) AS total FROM public.tasks WHERE deleted_at IS NULL GROUP BY status ORDER BY total DESC;
--   SELECT priority, count(*) AS total FROM public.tasks WHERE deleted_at IS NULL GROUP BY priority ORDER BY total DESC;
-- Esperado: só valores dentro do vocabulário abaixo (ou 0 linhas). Se
-- qualquer uma devolver um valor fora do vocabulário, PARAR — não aplicar
-- este CHECK sem decidir o que fazer com o dado divergente primeiro (mesmo
-- caminho de decisão do G56/Caso 4.3: investigar causa raiz antes de travar
-- o schema por cima de um sintoma).
--
-- Os DEFAULTs da coluna (`status DEFAULT 'todo'`, `priority DEFAULT
-- 'medium'`, ambos legado em inglês, herdados de
-- 20260601040000_create_tasks_schema.sql) continuam ativos mesmo com os 2
-- produtores já corrigidos (G40/G49) — nenhum produtor confirmado grava
-- sem valor explícito, mas sem trocar o DEFAULT junto com o CHECK, o
-- PRÓXIMO produtor (ou um INSERT manual do operador) que omitir a coluna e
-- confiar no DEFAULT quebraria o CHECK na hora. Por isso esta migration
-- troca os 2 DEFAULTs pro vocabulário atual, na mesma transação do CHECK.
ALTER TABLE public.tasks
  ALTER COLUMN status SET DEFAULT 'a_fazer',
  ALTER COLUMN priority SET DEFAULT 'média',
  ADD CONSTRAINT tasks_status_known_chk
    CHECK (status IN ('a_fazer', 'em_andamento', 'revisao', 'concluido')),
  ADD CONSTRAINT tasks_priority_known_chk
    CHECK (priority IN ('alta', 'média', 'baixa'));
