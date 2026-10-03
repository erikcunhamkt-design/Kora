-- Etapa 5 · Clientes (Rodada 3) + CRM — espelho de migrations JÁ
-- APLICADAS (docs/qa/migrations-espelho-8b.md). 1 arquivo pras 2 tabelas
-- (mesma sessão §8-b, slot reservado único — ver doc) — cada tabela com
-- seu próprio bloco idempotente, sem compartilhar nenhuma constraint.
--
-- APLICADAS MANUALMENTE PELO OPERADOR EM 2026-08-30 (SESSÃO §8-b) —
-- confirmação do revisor (sessão executada ao vivo com o operador,
-- resultados via information_schema/pg_constraint no SQL Editor). Drafts
-- de origem: docs/qa/etapa-5-flip-clientes-rodada3-check-drafts.md §2 e
-- docs/qa/etapa-5-flip-crm-rodada3-check-drafts.md §5. Este arquivo é SÓ
-- ESPELHO — não roda nada novo contra produção. SQL adaptado pra
-- idempotência (constraints via DO $$ IF NOT EXISTS), já que os objetos
-- JÁ EXISTEM em produção.
--
-- Todos os 5 nomes de constraint abaixo vêm dos drafts, **A CONFIRMAR COM
-- SELECT** (comportamento/vocabulário confirmados pelo operador, mas os
-- nomes literais não foram re-verificados individualmente nesta rodada).
-- Passo do operador:
--   SELECT conname FROM pg_constraint WHERE conrelid = 'public.clients'::regclass AND contype = 'c';
--   SELECT conname FROM pg_constraint WHERE conrelid = 'public.crm_opportunities'::regclass AND contype = 'c';
-- Se algum nome retornado divergir do usado abaixo, NÃO rodar este
-- arquivo sem ajustar o nome primeiro.
--
-- `crm_opportunities.stage` foi INVESTIGADO e DELIBERADAMENTE EXCLUÍDO
-- (etapa-5-flip-crm-rodada3-check-drafts.md §1) — é genuinamente dinâmico
-- (ids de estágio customizados via "Gerenciar funis"), um CHECK de lista
-- fixa quebraria pipelines customizados. Nunca incluir `stage` aqui.
--
-- ATENÇÃO — vocabulário de `temperature` é DIFERENTE entre as 2 tabelas
-- (clients: maiúsculo, 3 valores, sem "não definida"; crm_opportunities:
-- minúsculo, 4 valores, com "não definida") — os 2 CHECKs abaixo NÃO
-- compartilham lista de valores, por design (achado cross-table do draft
-- de CRM §3, não um erro a unificar).

-- 1) public.clients (status + temperature) — NULL permitido nos 2
-- (colunas nullable, sem NOT NULL).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_status_known_chk'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_status_known_chk
        CHECK (status IS NULL OR status IN ('Ativo', 'Em negociação', 'Inativo', 'Potencial', 'Arquivado'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_temperature_known_chk'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_temperature_known_chk
        CHECK (temperature IS NULL OR temperature IN ('Frio', 'Morno', 'Quente'));
  END IF;
END $$;

-- 2) public.crm_opportunities (status + temperature + priority, NUNCA
-- stage) — NULL permitido nas 3 (colunas nullable, sem NOT NULL).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crm_opportunities_status_known_chk'
  ) THEN
    ALTER TABLE public.crm_opportunities
      ADD CONSTRAINT crm_opportunities_status_known_chk
        CHECK (status IS NULL OR status IN ('open', 'won', 'lost'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crm_opportunities_temperature_known_chk'
  ) THEN
    ALTER TABLE public.crm_opportunities
      ADD CONSTRAINT crm_opportunities_temperature_known_chk
        CHECK (temperature IS NULL OR temperature IN ('frio', 'morno', 'quente', 'não definida'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crm_opportunities_priority_known_chk'
  ) THEN
    ALTER TABLE public.crm_opportunities
      ADD CONSTRAINT crm_opportunities_priority_known_chk
        CHECK (priority IS NULL OR priority IN ('alta', 'média', 'baixa'));
  END IF;
END $$;
