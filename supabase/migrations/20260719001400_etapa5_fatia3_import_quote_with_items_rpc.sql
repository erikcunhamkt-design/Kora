-- ============================================================================
-- Etapa 5 · Fatia 3 (quotes) — Q3: RPC import_quote_with_items (atomicidade pai-filho)
-- ============================================================================
-- PROBLEMA que este RPC resolve: o import hoje faz createQuote (INSERT) e DEPOIS
-- replaceQuoteItems (DELETE+INSERT) como DUAS chamadas PostgREST separadas — sem
-- transação entre elas. Se os itens falharem após a quote ser criada, a quote fica
-- "decapitada" (sem itens) na nuvem, e o import-map local NÃO é gravado (o erro é
-- pego antes disso) — no reimport, a dedupe por título+total marca "duplicate" e
-- a quote fica encalhada, sem forma de consertar via UI (docs/qa/etapa-5-fatia-3-
-- quotes.md, seção "Atomicidade pai-filho").
--
-- SOLUÇÃO: uma única chamada RPC = uma única transação PostgREST. Todo o corpo
-- (upsert do pai + reposição dos filhos) roda dentro dessa transação; QUALQUER
-- exceção (inclusive uma violação de RLS) aborta TUDO, inclusive o upsert do pai
-- que já tinha "sucedido" — nunca fica quote sem itens.
--
-- ----------------------------------------------------------------------------
-- DECISÃO DE SEGURANÇA: SECURITY INVOKER (não DEFINER) — justificativa
-- ----------------------------------------------------------------------------
-- O chamador (usuário autenticado) já possui, hoje, permissão de INSERT/UPDATE/
-- DELETE direta em quotes/quote_items para o seu próprio workspace (via as
-- policies quotes_insert/update/delete e quote_items_insert/delete já existentes
-- em 20260531030000_create_quotes_schema.sql). Este RPC não pede NENHUM privilégio
-- que o chamador não tenha — só precisa de ATOMICIDADE entre 3 statements, não de
-- elevação de privilégio. Logo:
--
--   • SECURITY INVOKER: a função roda com o papel e as RLS policies do CHAMADOR.
--     O INSERT ... ON CONFLICT DO UPDATE em quotes é checado contra
--     quotes_insert (WITH CHECK is_workspace_member) e, no caminho de UPDATE,
--     contra quotes_update (USING + WITH CHECK is_workspace_member) — ambos já
--     existentes, sem duplicar lógica. O DELETE/INSERT em quote_items é checado
--     contra quote_items_delete/insert (via subquery em quotes.workspace_id, que
--     enxerga a linha recém-upsertada na MESMA transação). Um chamador tentando
--     importar para um workspace alheio recebe "new row violates row-level
--     security policy" e a chamada inteira aborta — MESMA proteção que o caminho
--     não-atômico de hoje tem, sem superfície nova.
--
--   • Por que NÃO SECURITY DEFINER: rodar como o dono da função (tipicamente
--     postgres/service_role) BYPASSA a RLS de quotes/quote_items por padrão
--     (a menos que FORCE ROW LEVEL SECURITY seja setado nas tabelas, o que não é
--     o caso aqui). Isso exigiria REIMPLEMENTAR manualmente a checagem
--     `IF NOT public.is_workspace_member(p_workspace_id) THEN RAISE EXCEPTION`
--     no corpo — uma segunda fonte de verdade que pode divergir da RLS real das
--     tabelas se as policies mudarem no futuro (a policy already existente vira
--     "letra morta" para quem chama via RPC). DEFINER só se justifica quando o
--     chamador PRECISA de um privilégio que não tem por si — caso genuíno de
--     is_workspace_member() em si, que lê workspace_members (tabela com RLS
--     própria) para decidir se o USUÁRIO ATUAL pertence ao workspace; aqui não
--     há essa necessidade.
--
--   • SET search_path = public, pg_temp (sempre, INVOKER ou DEFINER): hardening
--     padrão do projeto — evita que um search_path malicioso na sessão do
--     chamador resolva nomes de tabela/função não-qualificados para objetos de
--     outro schema.
-- ----------------------------------------------------------------------------
--
-- ----------------------------------------------------------------------------
-- CORREÇÃO DE REVISÃO: guarda de NULL (workspace_id / source_local_id)
-- ----------------------------------------------------------------------------
-- NULLs são DISTINTOS no UNIQUE não-parcial ux_quotes_source_local (mesma
-- propriedade que permite linhas legadas conviverem com o índice — ver
-- 20260719001300). Isso significa que um source_local_id NULL NUNCA colide no
-- ON CONFLICT: cada chamada com o parâmetro ausente/vazio criaria uma quote
-- NOVA a cada retry, matando a idempotência em silêncio — o oposto do que
-- Q2/Q3 existem para garantir. O corpo da função agora falha explicitamente
-- (RAISE EXCEPTION) se p_workspace_id ou p_source_local_id vierem NULL/vazios,
-- ANTES de qualquer INSERT (passo 0, abaixo) — falha alta e visível bate
-- duplicata silenciosa.
--
-- Também alinhado nesta revisão (aprovado como reforço opcional):
-- SET search_path = public, pg_temp — pg_temp é implicitamente pesquisado
-- ANTES do search_path explícito a menos que seja listado nele; listar
-- pg_temp por último neutraliza esse comportamento implícito (defesa contra
-- shadowing de objetos não-qualificados por uma tabela temporária maliciosa
-- na sessão do chamador). Como todo objeto no corpo já é referenciado com
-- `public.` explícito, o risco prático aqui já era baixo — isto é defesa em
-- profundidade, não uma correção de uma falha explorável identificada.
-- ----------------------------------------------------------------------------
--
-- Transacional (CREATE FUNCTION é DDL simples) — não toca dado existente, seguro
-- aplicar mesmo com quotes populada.
-- >>> PRÉ-REQUISITO: as migrations 20260719001000 a 20260719001300 já aplicadas
--     (colunas client_id/opportunity_id/source_local_id + UNIQUE
--     ux_quotes_source_local, que é o arbiter do ON CONFLICT abaixo).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.import_quote_with_items(
  p_workspace_id uuid,
  p_source_local_id text,
  p_client_id uuid,
  p_opportunity_id uuid,
  p_client_name text,
  p_client_email text,
  p_title text,
  p_description text,
  p_subtotal numeric,
  p_discount numeric,
  p_total numeric,
  p_status text,
  p_archived boolean,
  -- Array de itens: [{ "name": "...", "quantity": 1, "unit_price": 10.5, "service_id": null }, ...]
  p_items jsonb
)
RETURNS public.quotes
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_quote public.quotes;
BEGIN
  -- 0) Guarda de NULL (revisão): sem source_local_id não-vazio, o upsert abaixo
  --    NUNCA colide contra ux_quotes_source_local (NULLs são DISTINTOS no
  --    Postgres — é exatamente essa propriedade que permite linhas legadas
  --    conviverem com o índice, mas ela também significa que um source_local_id
  --    NULL passa DIRETO pelo ON CONFLICT sempre como INSERT novo). Sem esta
  --    guarda, qualquer chamador que falhe em resolver o source_local_id (bug
  --    no cliente, chamada manual, etc.) criaria uma quote NOVA a cada retry —
  --    o oposto do que Q2/Q3 existem para garantir. Falha explícita > duplicata
  --    silenciosa.
  IF p_workspace_id IS NULL OR p_source_local_id IS NULL OR p_source_local_id = '' THEN
    RAISE EXCEPTION 'import_quote_with_items: workspace_id e source_local_id são obrigatórios (arbiter da idempotência)';
  END IF;

  -- 1) Upsert do PAI. Arbiter: UNIQUE (workspace_id, source_local_id)
  --    (ux_quotes_source_local, não-parcial — precedente P8b / Fatia 2).
  INSERT INTO public.quotes (
    workspace_id, source_local_id, client_id, opportunity_id,
    client_name, client_email, title, description,
    subtotal, discount, total, status, archived
  )
  VALUES (
    p_workspace_id, p_source_local_id, p_client_id, p_opportunity_id,
    p_client_name, p_client_email, p_title, p_description,
    p_subtotal, p_discount, p_total, p_status, COALESCE(p_archived, false)
  )
  ON CONFLICT (workspace_id, source_local_id) DO UPDATE SET
    client_id = EXCLUDED.client_id,
    opportunity_id = EXCLUDED.opportunity_id,
    client_name = EXCLUDED.client_name,
    client_email = EXCLUDED.client_email,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    subtotal = EXCLUDED.subtotal,
    discount = EXCLUDED.discount,
    total = EXCLUDED.total,
    status = EXCLUDED.status,
    archived = EXCLUDED.archived
  RETURNING * INTO v_quote;

  -- 2) Reposição atômica dos FILHOS — mesma técnica de replaceQuoteItems (delete
  --    all + insert), mas agora dentro da MESMA transação do upsert do pai. Se o
  --    INSERT abaixo lançar exceção, TUDO neste bloco reverte (inclusive o upsert
  --    acima) — nunca fica quote sem itens, e o reimport não fica "encalhado".
  DELETE FROM public.quote_items WHERE quote_id = v_quote.id;

  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    INSERT INTO public.quote_items (quote_id, service_id, name, quantity, unit_price)
    SELECT
      v_quote.id,
      NULLIF(item->>'service_id', '')::uuid,
      item->>'name',
      (item->>'quantity')::integer,
      (item->>'unit_price')::numeric
    FROM jsonb_array_elements(p_items) AS item;
  END IF;

  RETURN v_quote;
END;
$$;

-- Mesmo padrão de is_workspace_member: revoga PUBLIC, concede só a quem precisa.
REVOKE ALL ON FUNCTION public.import_quote_with_items(
  uuid, text, uuid, uuid, text, text, text, text, numeric, numeric, numeric, text, boolean, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_quote_with_items(
  uuid, text, uuid, uuid, text, text, text, text, numeric, numeric, numeric, text, boolean, jsonb
) TO authenticated, service_role;

COMMENT ON FUNCTION public.import_quote_with_items IS
  'Etapa 5 · Fatia 3 (Q3): import atômico de um orçamento + seus itens. SECURITY INVOKER de propósito — roda sob a RLS do chamador (ver justificativa no cabeçalho da migration 20260719001400).';
