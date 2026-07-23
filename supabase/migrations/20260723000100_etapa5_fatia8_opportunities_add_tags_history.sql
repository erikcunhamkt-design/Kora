-- Etapa 5 · Fatia 8 (opportunities — cutover de escrita) — O1: paridade de schema
--
-- Achado O1 (docs/qa/etapa-5-fatia-2-opportunities.md §10): Lead.tags[] e
-- Lead.history[] (local) não têm coluna correspondente em public.crm_opportunities.
-- Diferente de Q8 (quotes, Fatia 3) e PT2 (tasks, Fatia 7) — pendências catalogadas
-- para uma fatia FUTURA — este achado vira requisito bloqueante desta própria fatia,
-- porque a Fatia 8 liga a escrita em Supabase por padrão e os dois campos são uso
-- ativo da UI (badge de tag no Kanban + automação que adiciona tag ao mover de
-- estágio; timeline de atividade no drawer de detalhe — ver
-- docs/qa/etapa-5-fatia-8-crm-cutover.md §6.2 para o grep que confirma o uso real).
--
-- Sem UNIQUE/índice novo aqui — nenhum dos dois campos entra em chave de
-- idempotência. Não precisa de autocommit (nenhum CREATE INDEX CONCURRENTLY
-- envolvido) — roda dentro de transação normal, junto de outras migrations se
-- necessário.

ALTER TABLE public.crm_opportunities
  ADD COLUMN IF NOT EXISTS tags text[],
  ADD COLUMN IF NOT EXISTS history jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.crm_opportunities.tags IS
  'Etapa 5 · Fatia 8 (O1): espelha Lead.tags[] local (src/hooks/useLeads.ts). NULL/ausente para linhas criadas antes desta migration.';

COMMENT ON COLUMN public.crm_opportunities.history IS
  'Etapa 5 · Fatia 8 (O1): espelha Lead.history[] local ({date, text}[], src/hooks/useLeads.ts). Default array vazio, nunca NULL, para o mapper (crmOpportunityMapper.ts) não precisar tratar NULL como caso especial.';
