-- Etapa 5 · Flip Projetos — Fase B.1, item 3 (achados de schema)
--
-- ESCRITA NESTA RODADA, NÃO APLICADA. Aplicação é sessão §8-b dedicada com o
-- operador, ANTES da fatia N+1 (flip de defaults) — não desta rodada de
-- código. Ver docs/qa/etapa-5-flip-projetos.md item 3 para o desenho
-- completo (prós/contras das duas opções por gap) e a decisão do revisor.
--
-- (a) deliverables — Project.deliverables[] (local, uso ativo em
--     ProjectDetailDrawer.tsx: checklist de entregáveis + `computedProgress`
--     é calculado a partir da lista quando ela não está vazia) não tem
--     representação na nuvem. Mesmo molde já aplicado nesta Etapa para o
--     mesmo tipo de gap: 20260723000100_etapa5_fatia8_opportunities_add_
--     tags_history.sql (Lead.tags/history → crm_opportunities). Coluna
--     jsonb aditiva, default array vazio, sem índice novo, fora de
--     qualquer chave de idempotência.
--
-- (b) status — public.projects.status é texto livre, SEM constraint hoje
--     (achado central da Fase A, etapa-5-flip-projetos.md §3). Dois
--     caminhos de escrita já divergem:
--       1. DEFAULT da própria coluna ('active', desde
--          20260601030000_create_projects_schema.sql:12) +
--          projectsRepository.createProjectFromQuote (grava 'active'
--          explicitamente, linha 51).
--       2. Import geral (projectsMapper.ts) grava os 7 valores locais
--          verbatim — INCLUSIVE 'archived' como texto: o mapper de escrita
--          atual NUNCA seta o boolean `archived` para true (sempre grava
--          `archived: false`, projectsMapper.ts:99), então hoje o único
--          jeito de "arquivado" chegar na nuvem é como string no `status`.
--     O CHECK abaixo admite as DUAS famílias — os 7 valores locais
--     (ProjectStatus, useProjects.ts) + o alias legado 'active'. Não
--     normaliza dado já existente, só passa a exigir que todo valor NOVO
--     pertença a um vocabulário conhecido.
--
--     'active' é candidato a eliminação numa fatia futura (trocar o
--     DEFAULT da coluna + o write de createProjectFromQuote + o OR
--     defensivo de SupabaseOperationalDashboardCard.tsx:315-316 por um
--     vocabulário único) — registrado como dívida na O-série do plano
--     mestre, não resolvido aqui (decisão do revisor, Opção A).

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS deliverables jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.projects.deliverables IS
  'Etapa 5 · Flip Projetos: espelha Project.deliverables[] local (ProjectDeliverable[], src/hooks/useProjects.ts). Default array vazio, nunca NULL, para o mapper (projectsMapper.ts) não precisar tratar NULL como caso especial (mesmo padrão de public.crm_opportunities.history, Fatia 8/O1).';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_status_known_chk'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_status_known_chk CHECK (
        status IN (
          -- vocabulário local (ProjectStatus, src/hooks/useProjects.ts)
          'planning', 'in_progress', 'review', 'delivered', 'paused', 'cancelled', 'archived',
          -- alias legado: DEFAULT da coluna + createProjectFromQuote (ver comentário acima)
          'active'
        )
      );
  END IF;
END $$;

COMMENT ON CONSTRAINT projects_status_known_chk ON public.projects IS
  'Etapa 5 · Flip Projetos: fecha o vocabulário de status a valores conhecidos (7 locais + alias legado active). Não normaliza dado existente — só bloqueia valores novos fora da lista.';
