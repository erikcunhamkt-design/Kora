# Auditoria Técnica & Plano de Escalabilidade — Kora Hub

> Documento de handoff para o **Claude Code**. Objetivo: preparar o Kora Hub para escala nacional sem quebrar funcionalidades existentes, corrigindo gargalos de escalabilidade, vulnerabilidades e "má programação", e reorganizando o repositório para leitura clara (banco / backend / frontend / design / funções).

**Regra de ouro deste plano:** cada etapa é isolada, reversível e só é dada como concluída quando `npx tsc --noEmit` passa, o lint **não regride** (teto atual ~35–37 erros legados) e o app sobe sem regressão. Nada de refatoração "big bang".

---

## 0. Veredito em uma frase

O Kora Hub é um SPA React/TypeScript bem organizado na superfície, mas **não está pronto para escala nacional pelo motivo estrutural nº 1: a fonte de verdade dos dados de negócio ainda é o `localStorage` do navegador**, com o Supabase entrando de forma híbrida e experimental atrás de dezenas de feature flags. Isso, somado à ausência de fila/worker, rate limiting e índices verificados, é o que trava a escala. A base de segurança (RLS multi-tenant, segredos no backend) está desenhada corretamente — precisa de verificação e endurecimento, não de reconstrução.

---

## 1. Mapa do repositório hoje

**Stack:** React + TypeScript + Vite + shadcn/ui + Tailwind (frontend) · Supabase Postgres + Edge Functions (Deno) + Storage + Auth (backend).

| Camada | Onde está | O que é |
| :-- | :-- | :-- |
| **Frontend (telas)** | `src/pages/` | Rotas/telas: `CRM.tsx`, `Financeiro.tsx`, `Configuracoes.tsx`, `WhatsApp.tsx`, `Clientes.tsx`… |
| **Frontend (componentes)** | `src/components/<módulo>/` | UI por módulo (`automacoes/`, `crm/`, `dashboard/`…) |
| **Design System** | `src/components/ui/` + `index.css` + `tailwind.config` | Componentes base shadcn, tokens, tema |
| **Funções/estado (frontend)** | `src/hooks/` | `useClients`, `useLeads`, `useQuotes`, `useSupabaseClients`, `useCurrentWorkspace`… |
| **Acesso a dados** | `src/repositories/` | `clientsRepository.ts`, `quotesRepository.ts`, `financeRepository.ts`, `tasksRepository.ts`… (CRUD Supabase) |
| **Client Supabase** | `src/integrations/supabase/client.ts` | SDK com `anon_key` |
| **BANCO DE DADOS** | `supabase/migrations/` | Schema, RLS, triggers, funções SQL (`is_workspace_member`) |
| **BACKEND (serverless)** | `supabase/functions/` | Edge Functions Deno: `whatsapp-webhook`, `whatsapp-bot-reply`, `whatsapp-campaign-v2-sender`, `whatsapp-instance`…, mais `_shared/` (`cors`, `vertex.ts`) |
| **Config backend** | `supabase/config.toml` | `verify_jwt`, roteamento de functions |
| **Documentação** | raiz do projeto | Vários `SUPABASE-*.md`, `INTEGRATIONS-ROADMAP.md` espalhados |

**Modelo de dados (Postgres):** `profiles`, `workspaces`, `workspace_members` (controle de acesso) → `clients`, `client_contacts`, `client_technical_sheets`, `client_assets`, `client_activity_logs`, `opportunities`, `quotes`, `quote_items`, `transactions`/`financial_transactions`, `projects`, `project_deliverables`, `tasks`, além do domínio WhatsApp (`whatsapp_*`).

**Multi-tenant:** tudo indexado por `workspace_id`, isolado por RLS via `public.is_workspace_member(workspace_id)` (`SECURITY DEFINER`, `search_path=public`). Frontend só usa `anon_key`; `service_role` só nas Edge Functions. **Esse desenho está correto.**

---

## 2. Gargalos de escalabilidade (o que trava a escala nacional)

**G1 — `localStorage` como fonte de verdade dos dados de negócio. [CRÍTICO]**
Clientes, leads, orçamentos, financeiro, projetos e tarefas ainda vivem em `localStorage` (chaves `kora.*` / `orbyt.*`). Isso é incompatível com escala: ~5–10 MB por navegador, sem multi-dispositivo, sem colaboração em equipe, sem backup, sem consultas/agregações no servidor, e perda total se o usuário limpar o navegador. **Enquanto isso for verdade, "escala nacional" é impossível por definição.** O Supabase existe mas só atrás de flags experimentais.

**G2 — Filtragem e agregação no cliente. [ALTO]**
Hooks como `useClients`/`useLeads` carregam **todos** os registros e filtram em JS (`.some()`, `.filter()`, `.useMemo` sobre arrays inteiros — ex.: `KoraOnboarding.tsx`). É O(n) no cliente: aceitável com dezenas de registros, lento e pesado com milhares. Precisa virar paginação/filtro/ordenação **no servidor** (Postgres + índices).

**G3 — Complexidade híbrida localStorage + Supabase + feature flags. [ALTO]**
A coexistência de dois backends por entidade, cada um com flag (`kora.*.enabled`) e lógica duplicada (repository vs. hook local), gera explosão combinatória de estados, bugs de sincronização e código difícil de manter. É um gargalo de **velocidade de evolução** — quanto mais cresce, mais caro fica cada mudança.

**G4 — Envio de campanhas WhatsApp sem worker/fila real. [ALTO]**
Envio é em lote manual, `MAX_BATCH_SIZE = 10`, **sem cron, sem retry automático, sem agendamento real** (`scheduled_at` é só metadata). Para disparar a milhares de contatos em escala nacional isso não sustenta. Solução já mapeada pelo próprio roadmap: `pg_cron` + `pg_net` acionando o sender em lotes, com retry e idempotência.

**G5 — Ausência de rate limiting / throttling nas Edge Functions. [ALTO]**
O próprio roadmap lista "ausência de throttling" como risco. Endpoints de IA (Gemini/Vertex) e e-mail (Resend) sem limitação permitem abuso e **explosão de custo**. Precisa de quota por workspace + rate limit por função.

**G6 — Índices e performance de RLS não verificados. [ALTO]**
`is_workspace_member` é chamada na cláusula `USING` de cada linha em cada tabela. Sem (a) índice em `workspace_members(user_id, workspace_id)`, (b) a função marcada `STABLE`, e (c) índices em `workspace_id` + colunas de filtro comuns (`status`, `client_id`, `due_date`) e índices parciais `WHERE deleted_at IS NULL`, as queries degradam muito com volume. **Pitfall clássico de Supabase.** Verificar e corrigir.

**G7 — Sem CI/CD e sem testes automatizados. [MÉDIO-ALTO]**
QA é manual ("revisão estática", "leitura de código"). Em escala e com mais gente no time, regressões passam. Sem pipeline (`tsc` + lint + testes + deploy) você não escala o **processo**, só o produto.

**G8 — `whatsapp-bot-reply`: template do Send Node nunca aplica (falha silenciosa). [ALTO — confirmado]**
Achado durante a rodada `qualidade-lint` (tipagem de `supabase/functions/whatsapp-bot-reply/index.ts`), não corrigido nela por estar fora do escopo de lint/tipos — registrado aqui para a Etapa 6 (mesma lane do rate limit G5).

- **Linha exata:** `supabase/functions/whatsapp-bot-reply/index.ts:592` — `const sendNode = flowNodes.find((n) => n.type === "send" && n.enabled);`, dentro do bloco `try { ... } catch (e) { console.warn("[bot-reply] failed to format reply template:", e); }` que formata `finalReply` a partir do template do nó "send" do flow visual.
- **Prova do escopo:** `flowNodes` é declarado com `let flowNodes: BotFlowNode[] = []` dentro do branch `else` de `if (isTest) { ... } else { ... }` (declaração ~linha 316; branch fecha ~linha 455). A referência da linha 592 está em um bloco **irmão**, não descendente daquele `else` — contagem de chaves confirma: profundidade 3 na declaração (dentro do `else`), cai para 2 ao fechar o `else` (linha 455), volta a 3 no bloco da linha 592, mas é uma abertura de chave diferente, sem relação de escopo com a primeira. Resultado: `flowNodes` não existe nesse ponto.
- **Comportamento observável:** todo disparo de `whatsapp-bot-reply` (modo normal, não-teste) que chega a essa seção dispara `ReferenceError: flowNodes is not defined`. O `try/catch` ao redor engole o erro e só loga um `console.warn`; `finalReply` permanece igual a `reply` (a resposta crua da IA), então o template configurado no nó "Enviar Mensagem" do construtor de fluxo (`WhatsAppBotConfig.tsx`) **nunca é aplicado** — cai sempre no fallback da resposta direta da IA, sem o usuário ou o operador saberem.
- **Lacuna de cobertura:** a suíte (152/152 verde na rodada `qualidade-lint`) **não cobre esse caminho** — `whatsapp-bot-reply` é uma Edge Function Deno (`Deno.serve`, `npm:` imports), fora do alcance do harness Node/Vitest (mesma limitação já documentada em `docs/qa/etapa-2-seguranca.md` para os handlers de webhook). Corrigir o bug sem adicionar ao menos um teste de regressão (ainda que de integração/homologação, dado o harness) deixaria a falha silenciosa livre para se repetir.
- **Fix não incluído nesta rodada:** hoisting de `flowNodes` para um escopo comum aos dois branches (`isTest`/normal) resolve a referência; decisão em aberto se o modo `isTest` também deve suportar template de Send Node ou se a formatação deve ser pulada quando `flowNodes` estiver vazio.

**G9 — `npx tsc --noEmit` na raiz é um gate vazio (37 erros reais escondidos). [CRÍTICO — confirmado, corrigido nesta rodada]**
`tsconfig.json` na raiz tem `"files": []` e só `references` para `tsconfig.app.json`/`tsconfig.node.json`; `tsc --noEmit` sem `--build` nunca resolve as referências, então sempre reporta 0 erros independente do estado real do código. O CI (`.github/workflows/ci.yml`) rodava exatamente esse comando vazio desde a Etapa 0 — nenhuma rodada anterior teve type-check de verdade. Achado originalmente pela LANE A durante a Fase C da Etapa 5 · Fatia 7 (projects/tasks), catalogado primeiro na branch `fatia-7-projects` como pendência roteada a uma rodada futura ("LANE B"); corrigido nesta rodada (`qualidade-lint`). `npx tsc -p tsconfig.app.json --noEmit` (o gate real) revelou 37 erros em 9 arquivos, todos resolvidos na rodada `qualidade-lint`: 31 (7 arquivos) via correção de tipo pura, 6 (2 arquivos) via remap de `emitNotification` — decisão de produto, ver abaixo. Gate trocado para `tsc -p tsconfig.app.json --noEmit` nesta mesma rodada, só depois de zerar os erros reais (ordem: corrigir → trocar, para não quebrar o CI no dia da troca). Não reabre veredito nenhum: os resultados técnicos já registrados nos docs de cada fatia já assinada e fechada continuam válidos — o problema era o **gate nunca ter rodado de verdade**, não a homologação de nenhuma fatia.

- **Efeito colateral descoberto:** dois hooks (`useLocalFinanceImport.ts`, `useLocalQuotesImport.ts`) chamavam `emitNotification` com `category: "import"` / `type: "error"`, valores fora das uniões `NotificationCategory`/`NotificationType`. Como `NotificationInbox.tsx` indexa `CATEGORY_META[category]`/`TYPE_DOT[type]` (`Record` completo, sem fallback), essas notificações renderizavam com lookup `undefined` em produção desde que os hooks foram escritos — só apareceu porque G9 ligou o type-check de verdade. Remapeado para `category: "finance"`/`"commercial"` + `type: "danger"` (decisão do revisor, sem introduzir categoria/tipo novos).

**G10 — `src/integrations/supabase/types.ts` (gerado) está defasado das migrations. [ALTO — confirmado]**
O arquivo tem o cabeçalho `// This file is automatically generated. Do not edit it directly.` mas não foi regenerado desde antes de pelo menos 3 migrations já aplicadas: `source_local_id` em `crm_opportunities` (20260719000000, Fatia 2), a RPC `import_quote_with_items` (20260719001400, Fatia 3), e — a confirmar — as colunas `source_local_id` de `financial_transactions`/`projects`/`tasks` que a Fatia 6/7 vêm adicionando. Sintoma: `postgrest-js` rejeita essas colunas/RPCs como "excesso de propriedade" (`RejectExcessProperties`) mesmo quando a coluna existe de verdade no banco.

- **Causa de 2 dos 9 fixes da rodada G9** (`crmOpportunitiesRepository.ts`, `useSupabaseOpportunities.ts` — cast via `unknown` como contorno, documentado inline).
- **Causa de parte do backlog do passo 3** (medição com o gate real, `@ts-nocheck` intacto): `quotesRepository.ts` (5 erros, inclui a RPC ausente do types.ts), e provavelmente parte dos erros de `financeRepository.ts`/`projectsRepository.ts`/`tasksRepository.ts` uma vez que a Fatia 7 adicionar `source_local_id` a `projects`/`tasks`.
- **Proposta:** regenerar `types.ts` (`supabase gen types typescript --project-id <ref> > src/integrations/supabase/types.ts` ou equivalente da CLI) como passo padrão de runbook **pós-migration**, não como correção pontual — a execução exige credencial/acesso ao projeto Supabase, então fica para o operador rodar; o Code só consome o arquivo resultante. Até lá, os contornos via `unknown`/cast local (padrão já estabelecido nesta rodada) seguem sendo a forma segura de destravar tipos sem esperar a regeneração.
- **Atualização (rodada `qualidade-lint`, pós-regeneração):** operador regenerou `types.ts`; os 5 repositories do backlog (`clientTechnicalSheetsRepository`, `financeRepository`, `projectsRepository`, `quotesRepository`, `tasksRepository`) tiveram `@ts-nocheck` removido. Mesmo com `types.ts` em dia, o typegen do Supabase **não expressa nullability de parâmetros de RPC** — `import_quote_with_items` gera `p_client_id`/`p_opportunity_id`/`p_client_name`/`p_client_email`/`p_description` como `string` plano (sem `| null`), mesmo a migration (`20260719001400_etapa5_fatia3_import_quote_with_items_rpc.sql`) declarando parâmetros SQL sem `NOT NULL` — que nem é um modificador válido para parâmetro de função no Postgres, só de coluna. É limitação permanente do gerador (não algo que uma futura regeneração resolve): cast via `unknown` no arg completo do `.rpc(...)` continua sendo o contorno correto para qualquer RPC nessa situação.
- **Marco (rodada `qualidade-lint`, 2026-07-25): ZERO `@ts-nocheck` no projeto.** Os últimos 3 (`CreateCrmSupabaseQuoteDialog.test.tsx`, `LinkedQuotesSection.test.tsx`, `SupabaseQuotesViewerCard.test.tsx`) foram removidos nesta rodada — fixtures completadas, dois casts pré-existentes claramente errados corrigidos (`as unknown as Parameters<typeof Component>[0]` num componente sem props, que resolvia pra `undefined`), zero mudança de asserção. Teto do lint gate acompanhou: 89/68 (baseline original) → 34/34. Ver M1.

---

**G11 — `CREATE OR REPLACE FUNCTION` com novos parâmetros IN não substitui a função existente; cria overload ambíguo. [MÉDIO — confirmado, lição para toda RPC futura]**
Achado durante a aplicação real da DDL da Etapa 5 · Fatia 9 (`quotes`, migration Q8 da RPC
`import_quote_with_items`). Detalhamento completo em
[`etapa-5-fatia-9-quotes-cutover.md` §10.2](../qa/etapa-5-fatia-9-quotes-cutover.md#102-migration-q8--escrita-corrigida-em-campo-e-aplicada-2026-07-23-sob-8)
(bug real, corrigido antes do fechamento da fase).

- **A causa:** a identidade de uma função no Postgres é a lista de **tipos** dos parâmetros de
  entrada, não o nome sozinho. `CREATE OR REPLACE FUNCTION` só substitui em vigor quando essa
  lista de tipos é **idêntica** à da função existente — acrescentar novos parâmetros `IN` no fim,
  mesmo todos com `DEFAULT NULL`, muda a lista de tipos e portanto a identidade, criando uma
  **segunda função sobrecarregada** ao lado da antiga em vez de substituí-la.
- **Sintoma:** qualquer referência subsequente à função **sem** lista de argumentos (ex.:
  `COMMENT ON FUNCTION nome IS ...`, ou uma chamada RPC ambígua) falha com `function name "..." is
  not unique` — `DICA: Specify the argument list to select the function unambiguously.`
- **Correção aplicada:** `DROP FUNCTION IF EXISTS nome(<tipos exatos da assinatura antiga>);`
  **antes** do `CREATE OR REPLACE FUNCTION` com a assinatura nova — garante que só existe uma
  função com aquele nome depois da migration. `REVOKE`/`GRANT`/`COMMENT` que seguem devem sempre
  qualificar a lista de tipos completa (nunca depender do nome sozinho ser único).
- **Regra para toda migration futura que estende uma RPC existente:** se a lista de parâmetros
  muda (inclusive só acrescentando novos `DEFAULT NULL` no fim), incluir sempre um `DROP FUNCTION
  IF EXISTS` da assinatura antiga antes do `CREATE OR REPLACE`. Não confiar em "parâmetros novos
  com default preservam a identidade" — no Postgres isso é falso para `IN` (é verdade só para
  parâmetros `OUT`, caso não relevante aqui).

---

**G12 — Comparar campo traduzido contra o literal cru da fonte, em vez do vocabulário do mapper. [MÉDIO — confirmado, lição para toda fatia que introduzir tradução de vocabulário]**
Achado durante a Etapa 5 · Fatia 10 (cutover de escrita de `quotes`). Detalhamento completo em
[`etapa-5-fatia-10-quotes-write.md`](../qa/etapa-5-fatia-10-quotes-write.md) (itens 6/7 da Fase C).

- **A causa:** a Fatia 9 introduziu tradução de vocabulário (`status` cru da nuvem → português,
  via `mapSupabaseQuoteToLocalQuote`), mas dois componentes que já liam quotes traduzidas
  (`SupabaseQuotesViewerCard.tsx`, `LinkedQuotesSection.tsx`) continuaram comparando
  `quote.status` contra os literais em inglês antigos ("draft"/"approved"/"rejected") em vez do
  vocabulário novo ("rascunho"/"aprovado"/"recusado") que o mapper já entrega.
- **Sintoma:** nenhuma comparação batia — os botões Aprovar/Rejeitar e Gerar recebível/projeto
  **nunca renderizavam**, silenciosamente, sem erro, desde o merge da Fatia 9 até a correção na
  Fatia 10. Um teste existente de um dos dois componentes mascarava o bug: fixava o literal
  errado ("draft") como premissa da fixture, em vez de importar o tipo real traduzido.
- **Checklist para toda fatia futura que introduzir tradução de vocabulário** (status, categoria,
  ou qualquer enum que muda de representação entre camadas): antes de considerar a tradução
  completa, `grep` exaustivo por TODOS os literais do vocabulário ANTIGO no restante do código —
  não só nos arquivos que o design/plano nomeou como "consumidores conhecidos". Preferir o TYPE
  do vocabulário traduzido (união fechada de literais) em vez de `string` solto nas comparações —
  o compilador pega a maioria desses casos de graça, um teste com fixture errada não pega.

---

**G13 — Mutation de criação nativa resolvia FKs (`client_id`/`opportunity_id`) sempre como `null` — import-map nunca passado. [MÉDIO — confirmado, corrigido antes do primeiro chamador real]**
Achado durante a Etapa 5 · Fatia 10 (item 8). Detalhamento em
[`etapa-5-fatia-10-quotes-write.md`](../qa/etapa-5-fatia-10-quotes-write.md).

- **A causa:** `useSupabaseQuotes.ts`'s `createMutation` (escrita no item 1) chamava
  `mapLocalQuoteToSupabaseQuote(quote)` sem o 2º argumento (`maps`) — que tem default
  `EMPTY_QUOTE_IMPORT_MAPS`. Toda criação nativa gravaria `client_id`/`opportunity_id` como
  `null`, mesmo quando o usuário criava o orçamento a partir de um cliente/oportunidade já
  migrado.
- **Não chegou a produção:** a mutation só ganhou seu primeiro chamador de UI real no mesmo item
  (8) que corrigiu o problema — nunca esteve reachable com o bug ativo.
- **Lembrete permanente:** o default vazio de `mapLocalQuoteToSupabaseQuote`/funções de mapper
  equivalentes é seguro (nunca grava um id local cru numa coluna `uuid`), mas silenciosamente
  incorreto quando o import-map deveria existir e não foi passado. Qualquer chamada nova a esse
  tipo de função precisa passar os mapas explicitamente, não confiar no default.

---

**G14 — `refresh`/`refetch` com identidade instável numa dependência de `useEffect` causa loop infinito de refetch. [ALTO — confirmado, VIVO EM PRODUÇÃO nesta branch main]**
Achado durante a Etapa 5 · Fatia 10 (Fase D, homologação, incidente #2 — caso 5b vermelho).
Detalhamento completo em [`etapa-5-fatia-10-quotes-write.md`](../qa/etapa-5-fatia-10-quotes-write.md) (§13).

- **A causa:** a migração A2 pra React Query (`fb5828f`, anterior a esta fatia) trocou o
  `refresh` estável (`useCallback` com deps `[workspaceId, opportunityId]`) de
  `useSupabaseQuotes.ts`/`useSupabaseOpportunityQuotes.ts` por `refresh: () => query.refetch()`
  inline — uma função NOVA a cada render. `LinkedQuotesSection.tsx` já tinha (desde `4b1a8f2`,
  também anterior) um `useEffect` com `refresh` na lista de dependências.
- **Sintoma:** ao abrir o detalhe de uma oportunidade com orçamentos vinculados, a seção nunca
  sai do estado de carregamento — loop contínuo de requisições idênticas
  (`GET /rest/v1/quotes?...`), dezenas por segundo, sem parar sozinho.
- **Está VIVO em produção nesta branch `main` hoje**, alcançável por qualquer workspace com a
  flag legada `quotesSupabaseApproval` ligada (única flag pré-Fatia-10 com escrita real neste
  domínio) que abra uma oportunidade com orçamentos vinculados no CRM — custo contínuo de
  rede/banco, não um problema só de UX. **O merge de `fatia-10-quotes-write` é o veículo do
  fix** (commit `5fd1fab`, worktree `Kora-laneA`): `refresh` passou a ter identidade
  permanentemente estável via `useRef`, nos dois hooks.
- **Checklist — por que os testes existentes não pegaram, lição pra qualquer hook novo que
  devolva uma função "de ação" (`refresh`/`refetch`/`reload`/etc.) consumida por outro
  componente:** testes que mockam o hook de dados por inteiro (`vi.mock("@/hooks/useX")`)
  substituem a função real por um `vi.fn()` de identidade estável — isso ESCONDE qualquer bug de
  identidade/estabilidade do hook real, porque o mock nunca reproduz a instabilidade. Sempre que
  um componente tiver um `useEffect`/`useMemo`/etc. com uma função de um hook de dados na lista de
  dependências, cobrir com PELO MENOS um teste que exercite o hook REAL (só a camada de
  repository/rede mockada) e conte quantas vezes a chamada de rede/repository ocorre — não deixar
  só testes com o hook inteiro mockado (mesmo espírito de G11/G12: um teste que assume a premissa
  errada, ou que não exercita o mecanismo real, mascara o bug em vez de pegá-lo).

---

**G15 — Flag lida uma única vez via `useMemo(() => ..., [])` nunca reflete mudança na mesma aba. [MÉDIO — confirmado]**
Achado durante a Etapa 5 · Fatia 10 (Fase D, homologação, incidente #2 — caso 5a vermelho).
Detalhamento completo em [`etapa-5-fatia-10-quotes-write.md`](../qa/etapa-5-fatia-10-quotes-write.md) (§13).

- **A causa:** `SupabaseQuotesViewerCard.tsx`'s `experimentalEnabled` (gate de renderização do
  card inteiro) era `useMemo(() => getBooleanFlag("quotesSupabaseExperimental"), [])` — lê a
  flag uma única vez no mount e nunca recalcula. O card irmão que liga essa mesma flag
  (`QuotesSupabaseExperimentalToggleCard.tsx`) já tentava avisar a mudança via
  `window.dispatchEvent(new Event("storage"))` (comentário no próprio código: "Force a custom
  event ... to update viewer visibility in same tab") — mas nada escutava esse evento no viewer.
- **Sintoma:** ligar a flag pela UI de Configurações (sem recarregar a página) nunca fazia o
  card da lista aparecer, em NENHUM ponto da tela — indistinguível de "o card não existe".
- **Correção** (commit `5fd1fab`, `Kora-laneA`): `experimentalEnabled` virou `useState` +
  `window.addEventListener("storage", ...)`, o mesmo padrão já usado em
  `useSupabaseQuotesWriteFlag.ts` — capta tanto eventos reais de outra aba quanto o dispatch
  sintético same-tab que o toggle já fazia.
- **Regra pra qualquer flag lida via `useMemo`/`useState` com dependência vazia que controle
  renderização condicional de um componente inteiro:** se existe (ou pode existir) uma UI que
  liga/desliga essa flag SEM forçar reload, o componente que a lê precisa de um listener ativo
  (`storage` + custom event, mesmo par já usado em `useSupabaseQuotesWriteFlag.ts`) — não basta
  ler uma vez no mount.

---

**G16 — Componente importado numa página nunca chega a ser renderizado (import órfão, sem lint que pegue). [ALTO — confirmado]**
Achado durante a Etapa 5 · Fatia 10 (Fase D, homologação, incidente #4 — caso 5a vermelho
definitivo, mesmo após o fix de G15). Detalhamento completo em
[`etapa-5-fatia-10-quotes-write.md`](../qa/etapa-5-fatia-10-quotes-write.md) (§15).

- **A causa:** `SupabaseQuotesViewerCard` era importado em `Configuracoes.tsx`, mas nunca
  aparecia no JSX — removido (junto de ~20 outros cards) no commit `79bb252` ("Remove
  experimental toggle cards and simplify Settings UI"), uma reorganização deliberada da página
  que aparentemente esqueceu de também remover o import morto. `@typescript-eslint/no-unused-vars`
  está **desligado** em `eslint.config.js` — nada detecta um import nunca usado.
- **Sintoma:** nenhuma combinação de flags fazia o card aparecer — G15 (flag congelada) era um
  bug real e teve de ser corrigido, mas não era a causa raiz completa: o componente nunca estava
  na árvore, independente do estado de qualquer flag.
- **Correção** (commit `093df68`, `Kora-laneA`): `<SupabaseQuotesViewerCard />` adicionado de
  volta à seção "Sincronização Cloud & CRM" de `Configuracoes.tsx`, ao lado do toggle que já
  gateia a mesma flag.
- **Achado correlato, MESMA classe, domínio diferente, NÃO corrigido (fora do escopo de
  `quotes`):** `SupabaseOperationalDashboardCard` também está importado em `Configuracoes.tsx` e
  também nunca é renderizado em lugar nenhum do app — confirmado por grep, não hipótese. Fica
  registrado aqui para a fatia/rodada que homologar o domínio operacional/dashboard.
- **Checklist pra qualquer fatia que remover/reorganizar cards de uma página de configurações:**
  ao apagar uma linha de JSX, sempre conferir (grep) se o import correspondente também deve sair
  — e não confiar no lint pra pegar isso, porque a regra que pegaria está desligada neste
  projeto. Se um card tem uma flag de toggle própria em Configurações, um teste de integração
  (renderizar a página/seção com a flag ligada e afirmar que o CONTEÚDO do card aparece, não só
  que o toggle existe) pega esse tipo de regressão — teste que checa só a existência do toggle
  não prova que o card real está na árvore.

---

**G17 — `refetch()`/funções de ação de hooks de dados IGNORAM `enabled` — efeito de mount que chama uma delas sem esperar a dependência resolver dispara requisição inválida. [MÉDIO — confirmado]**
Achado durante a Etapa 5 · Fatia 10 (Fase D, homologação, incidente #4 — achado do 400 na
Network). Detalhamento completo em
[`etapa-5-fatia-10-quotes-write.md`](../qa/etapa-5-fatia-10-quotes-write.md) (§15).

- **A causa:** `LinkedQuotesSection.tsx` tem um `useEffect` pré-existente (desde `4b1a8f2`,
  anterior a esta fatia) que chama `refresh()` (== `query.refetch()` de
  `useSupabaseOpportunityQuotes.ts`) sempre que `opportunityId` está presente — o que é verdade
  desde o primeiro mount (`CRM.tsx` só renderiza a seção quando `lead.supabaseId` já existe).
  `refetch()` do React Query **ignora `enabled`** por design — dispara mesmo que a query esteja
  desabilitada. Se `useCurrentWorkspace()` (chamado em paralelo, no mesmo componente) ainda não
  resolveu, a chamada manual roda com `workspace_id` vazio.
- **Sintoma:** `GET /rest/v1/quotes?...&workspace_id=eq.&opportunity_id=eq....` → `400`, em TODA
  montagem da seção, engolido silenciosamente — a busca automática seguinte (queryKey diferente,
  workspaceId já correto) mascara o erro completamente na UI.
- **Correção** (commit `093df68`, `Kora-laneA`): o efeito passou a checar também `workspaceId`
  antes de chamar `refresh()`.
- **Regra permanente:** `enabled: false` numa query do React Query bloqueia o fetch automático,
  **não** bloqueia uma chamada manual a `refetch()`/à função de ação exposta pelo hook. Qualquer
  `useEffect` que chame essa função de ação precisa incluir, na própria condição do efeito
  (não só na dependência), todo valor do qual a query depende pra ser válida (workspace, ids
  externos) — nunca assumir que "a query não vai rodar porque `enabled` está falso" cobre
  chamadas manuais.

---

**G18 — `whatsapp-bot-reply` roda IA via Lovable AI Gateway por padrão (herança do scaffolding Lovable, não do stack oficial). [RESOLVIDO E VALIDADO]**
Achado durante o levantamento do G5 (Etapa 6, rate limit), confirmado pelo operador: o projeto nasceu no Lovable e a `LOVABLE_API_KEY`/gateway (`https://ai.gateway.lovable.dev`) são resíduo do scaffolding — nunca foram uma decisão de stack. Detalhamento completo em [`etapa-6-g5-rate-limit.md`](../qa/etapa-6-g5-rate-limit.md).

- **Risco 1 — custo via intermediário:** toda chamada no provedor `lovable` passa (e é cobrada) pelo gateway da Lovable, não direto na Google — camada extra de custo/latência sem motivo, herdada, não escolhida.
- **Risco 2 — desativação silenciosa:** a `LOVABLE_API_KEY` não é uma credencial do Kora — é uma chave de uma plataforma terceira à qual o projeto não está mais necessariamente vinculado. Se a Lovable revogar/expirar a chave (fora do controle do Kora, sem aviso), o bot para de responder silenciosamente (mesmo padrão de falha silenciosa do G8: erro cai em `catch`, log apenas).
- **Migração (Parte 1, esta rodada):** provedor default trocado de `"lovable"` para `"gemini_api_key"` (Google AI Studio direto) nas 4 ocorrências de fallback em `index.ts` (variável inicial, `isTest`, `aiNode.properties.provider`, `bot.provider`) e no default do construtor visual (`WhatsAppBotConfig.tsx`, nó AI novo). **Não precisou trocar endpoint nem parser** — o caminho `gemini_api_key` já existe, já está correto (mesmo formato de resposta `candidates[].content.parts[].text` usado por `vertex_ai`), só não era o default. Operador cria o secret `GEMINI_API_KEY` no painel (nome que o código já espera, `index.ts` já tinha o fallback `Deno.env.get("GEMINI_API_KEY")` morto por falta desse secret).
- **Não migrado nesta rodada:** bots que já têm `provider: "lovable"` **salvo explicitamente** em `flow_data`/`bot.provider` (não é fallback, é valor persistido) continuam usando Lovable até serem reconfigurados manualmente ou até uma migração de dado futura — mudar só o default do código não afeta configuração já gravada. O branch de código do provedor `lovable` (chamada ao gateway) **não foi removido**, só deixou de ser o default — continua funcional pra quem já está configurado nele.
- **Plano:** remover a `LOVABLE_API_KEY` do painel **somente após** a migração validada (homologação pós-deploy confirmando resposta vinda do Gemini direto) — ver §8 do doc do G5 pra sequência.
- **Mini-auditoria de resíduos Lovable** (grep repo inteiro por "lovable", case-insensitive, só listagem, não corrigida nesta fatia) registrada em [`etapa-6-g5-rate-limit.md`](../qa/etapa-6-g5-rate-limit.md) §6.
- **Fechamento (mini-janela de revalidação):** provider Gemini direto confirmado funcionando em
  produção (`200` real, `gemini-3.6-flash`), `LOVABLE_API_KEY` removida do painel, doc
  `SUPABASE-WHATSAPP-INBOX-V1.md` corrigido no mesmo commit em que isso se tornou verdade de
  fato. Detalhamento completo do placar final em
  [`etapa-6-g5-rate-limit.md` §8.f](../qa/etapa-6-g5-rate-limit.md).

---

**G19 — `SupabaseQuotesViewerCard` lia `quote.validUntil`, campo que nunca existiu em `Quote` — "Validade" nunca renderizava, silenciosamente. [BAIXO — RESOLVIDO na rodada `qualidade-lint-tighten` (re-sync pós-flip)]**
Achado durante a rodada de aperto do teto de lint (`qualidade-lint-tighten`), ao desvetar `SupabaseQuotesViewerCard.tsx` (arquivo liberado após o Pacote do Flip de quotes, Lane A, mergear em `main`). Os 2 `any` remanescentes do lint escondiam este bug — mesmo padrão de achado do G8 (o `any` não era só frouxidão de tipo, era um sintoma).

- **A causa:** `{(quote as any).validUntil && <p>Validade: {intlDate((quote as any).validUntil)}</p>}` — `Quote` (`src/hooks/useQuotes.ts`) nunca teve um campo `validUntil`; o campo real é `validityDays: number` (dias a partir de `createdAt`). Como `validUntil` nunca existiu em nenhum ponto de escrita (criação local, mapper cloud→local, RPC), `(quote as any).validUntil` era **sempre `undefined`** — o bloco de UI nunca montava, para nenhum orçamento, desde que o card foi escrito. O `as any` mascarava isso: sem o cast, o TypeScript teria pego o campo inexistente na hora.
- **Detalhe curioso:** o próprio `useQuotes.ts` já exporta `getQuoteExpiryDate(q)`/`getQuoteDaysToExpire(q)` — helpers corretos (`createdAt + validityDays`), com o comentário `/** Helpers exported for UI ---------------------------------- */` — mas nunca foram importados em lugar nenhum da UI. O código certo já existia, só não estava conectado.
- **Fix aplicado:** troca de `(quote as any).validUntil` por `getQuoteExpiryDate(quote)` (calculado uma vez por item da lista, fora do JSX). Commit `8a3535b`.
- **Teste de regressão:** 2 casos novos em `SupabaseQuotesViewerCard.test.tsx` — orçamento com `validityDays` mostra "Validade:", orçamento sem `validityDays` (0) não mostra. Verificado que o teste pega a regressão (condição revertida temporariamente pro `as any` original antes de restaurar — o caso "mostra a data de validade" falhou exatamente no `getByText(/Validade:/)`).
- **Por que só apareceu agora:** o card foi escrito, revisado e homologado (Etapa 5 · Fatia 9/10) sem que ninguém notasse a ausência da data de validade na UI — nenhum caso de teste/homologação daquelas fatias cobria especificamente esse campo. Só apareceu ao investigar os 2 últimos `any` do teto de lint, não por um bug report.

---

**G20 — `financeRepository.listReceivables()` não filtra `type`, devolve recebíveis E pagáveis misturados; `SupabaseOperationalDashboardCard` soma os dois como se fossem só recebíveis. [BAIXO — RESOLVIDO na rodada `dashboard-orfao-fase-c` (revalidação de schema pré-reconexão)]**
Achado durante a Fase C do resgate do dashboard órfão (irmão do G16), no passo de revalidação de schema exigido antes de reconectar o card na UI — exatamente o tipo de achado que essa revalidação existia para pegar antes, e não depois, da reativação.

- **A causa:** `financial_transactions.type` guarda tanto `"receivable"` quanto `"payable"` — tradução real e ativa de `Transaction.type` local (`"income"`/`"expense"`, `CLOUD_TYPE` em `src/services/finance/financeMapper.ts`), usada pelo fluxo de import `src/hooks/useLocalFinanceImport.ts` (card `LocalTasksImportCard`-irmão para finanças, já em produção). `financeRepository.listReceivables()` (`src/repositories/financeRepository.ts`) fazia `select("*")` na tabela inteira, sem `.eq("type", "receivable")` — ao contrário de `findReceivableByQuote`, no mesmo arquivo, que já filtra `type`/`source` corretamente. `useSupabaseFinancialSummary` expõe o resultado cru como `receivables`, e é consumido por um único lugar em todo o `src/`: `SupabaseOperationalDashboardCard.tsx`. O card usa a lista sem filtro para `finTotal`/`finPending`/`finPaid`/`finPendingVal` — mas filtra corretamente `r.type === "receivable"` no painel "Relações do Fluxo Comercial" mais abaixo no mesmo arquivo, provando que é um esquecimento pontual (o autor sabia do vocabulário de dois tipos), não uma decisão consciente.
- **Efeito:** assim que qualquer workspace importar ao menos uma despesa (`expense`) para o Supabase, o card passaria a contar e somar essa despesa como se fosse dinheiro a receber — inflando "Recebíveis" e "Recebíveis pendentes (R$)" com dinheiro que na verdade é devido PELA empresa, não A ela. Nunca disparou em produção porque o card nunca foi montado (é o próprio órfão desta investigação) — mas teria disparado no instante da reconexão, para qualquer workspace com pelo menos uma despesa já importada.
- **Fix aplicado:** `.eq("type", "receivable")` adicionado a `listReceivables()`, alinhando a query ao nome/contrato da função.
- **Teste de regressão:** `financeRepository.test.ts` — novo caso prova que `listReceivables` passa `type=receivable` ao `.eq()` da query. Verificado que o teste pega a regressão (filtro removido temporariamente antes de restaurar — o caso falhou exatamente na asserção do `.eq("type", ...)`).
- **Por que só apareceu agora:** os 3 hooks que este card consome com exclusividade (`useSupabaseFinancialSummary`, `useSupabaseProjectsSummary`, `useSupabaseProjectTasks`) nunca tiveram teste próprio nem uso real — ninguém jamais viu este painel renderizado com dados reais desde que foi escrito (01/06), então ninguém teve chance de notar o número errado.

---

**G21 — `BotRulesPanel.tsx` é um componente inteiro, nunca importado nem montado em lugar nenhum do app. [BAIXO — RESOLVIDO na rodada `ux2-g21-g23-g25-fase-a` (opção a)]**
Achado durante a reconciliação de UX2 ([`kora-ux-produto.md`](kora-ux-produto.md)), ao investigar a premissa de que o simulador do bot não teria porta de entrada — a busca pelo componente certo levou a este, um achado diferente e não relacionado ao `isTest` de `WhatsAppBotConfig.tsx`.

- **A causa:** `src/components/whatsapp/bot/BotRulesPanel.tsx` exporta `function BotRulesPanel()` — uma tela inteira alternativa de "Robô IA de Atendimento" (modos de atendimento, guardrails, accordion de regras avançadas, preview de inbox, botão "Testar robô"). Nenhum arquivo em `src/` importa `BotRulesPanel` (grep sem nenhum resultado além da própria definição) — mesma classe de achado do G16 (componente nunca montado na árvore real, sem lint que pegue porque `no-unused-vars` está desligado no projeto).
- **Diferença do G16:** ali era um *import* órfão (linha de import sobrando após remoção da JSX que o usava). Aqui não há sequer um import em nenhum lugar — o componente parece ter sido escrito e nunca conectado à navegação em momento algum, provavelmente uma versão anterior/alternativa da tela de configuração do robô, superada por `WhatsAppBotConfig.tsx` (a que está de fato montada hoje na aba "Robô IA" de `WhatsApp.tsx`).
- **Simulador interno é mockado:** `runSimulator()` (linha 201) devolve uma resposta fixa hardcoded (`setSimResult({ reply: "Olá! Sim, atendemos restaurantes...", ... })`) — não chama nenhuma edge function real, diferente do simulador de `WhatsAppBotConfig.tsx` (que chama `whatsapp-bot-reply` com `isTest: true`, ver UX2). Mesmo remontado como está hoje, o "teste" que ele oferece não reflete o comportamento real da IA configurada.
- **Resolvido (opção a — aposentar):** arquivo deletado (`src/components/whatsapp/bot/BotRulesPanel.tsx`, 644 linhas). Zero importadores confirmado antes da remoção; suíte de testes verde depois (nada dependia dele). O conceito de "modos de atendimento" foi registrado como ideia de produto antes da remoção — ver [UX3](kora-ux-produto.md).

---

**G22 — "Gerar recebível"/"Gerar projeto" (orçamento aprovado) gravavam só local; a reconciliação do dashboard Supabase nunca via essas linhas. [MÉDIO — RESOLVIDO na rodada `dashboard-g22-fix`, classe "lacuna de cutover exposta por leitura"]**
Achado durante a homologação ao vivo da Fase C do resgate do dashboard órfão (G20) — caso 4 vermelho: operador clicou "Gerar recebível" e "Gerar projeto" num orçamento Supabase aprovado, os dois toasts de sucesso confirmaram, mas o dashboard seguiu com Recebíveis 0 / Projetos 0 / reconciliação pendente 1/1, mesmo após F5 (não era cache).

- **A causa:** `CreateReceivableDialog.tsx` e `CreateProjectFromQuoteDialog.tsx` — os 2 diálogos por trás desses botões (compartilhados por `SupabaseQuotesViewerCard.tsx` e `LinkedQuotesSection.tsx`) recebiam `workspaceId`/`quoteId` (UUIDs de nuvem) como props mas nunca os desestruturavam, e nunca chamavam `financeRepository`/`projectsRepository` — gravavam exclusivamente local (`useFinance().addTransaction`/`useProjects().addProject`). O próprio código já documentava isso como decisão deliberada da Fatia 6/7 ("F5-b"/"F5-equivalente": grava local porque as telas Financeiro/Projetos só liam local **na época**, com o caminho nuvem "DESATIVADO ATÉ O CUTOVER, não abandonado"). Ficou invisível o tempo todo porque nada lia o lado Supabase — só apareceu quando o dashboard (G20/Fase C) passou a ser a primeira coisa a realmente consultar `financial_transactions`/`projects` pra este fluxo.
- **Não é o filtro do G20:** `useSupabaseFinancialSummary`/`useSupabaseProjectsSummary` filtram certo — não há linha nenhuma pra filtrar, porque nada nunca chegou à tabela por este caminho. O único caminho real que hoje grava essas entidades no Supabase é o import geral local→nuvem (`useLocalFinanceImport`/`useLocalProjectsImport`), não a geração a partir de um orçamento aprovado.
- **Decisão de fix (revisor): DUAL-WRITE, não só-nuvem nem só-aviso.**
  - ❌ **Só-nuvem** (trocar a escrita local pela de nuvem): rejeitada — quebraria a tela local pré-cutover (Financeiro/Projetos ainda leem só local hoje; um recebível/projeto que existisse só na nuvem ficaria invisível pro usuário nas telas que ele realmente usa).
  - ❌ **Só-aviso** (avisar que "isso não vai pro Supabase ainda", sem gravar lá): rejeitada — perpetua o gap em vez de fechá-lo; o dashboard continuaria mostrando 0 pra sempre.
  - ✅ **Dual-write** (local intacto + espelho nuvem best-effort): local continua sendo gravado exatamente como antes (nunca refém da nuvem — falha do espelho NUNCA desfaz nem bloqueia o local); o espelho reusa `financeRepository.createReceivableFromQuote`/`projectsRepository.createProjectFromQuote` — que já são idempotentes contra os UNIQUE PARCIAIS (`ux_ft_receivable_from_quote`/`ux_projects_from_quote`) via catch(23505)+re-consulta, precedente **P8b** ([`espelho-reversivel.md` §5](espelho-reversivel.md)) — não upsert contra índice parcial. Falha do espelho: log + `toast.warning` avisando que o espelho ficou pendente de import manual (Configurações → Dados).
- **Fix aplicado:** `handleConfirm` dos 2 diálogos passa a destructurar `workspaceId`/`quoteId`/`clientId`/`opportunityId` e chama o repository correspondente logo após o write local, num `try/catch` isolado do catch principal (que só cobre o local).
- **Teste de regressão:** casos novos em `CreateReceivableDialog.test.tsx`/`CreateProjectFromQuoteDialog.test.tsx` — dual-write feliz (local + chamada de nuvem com os campos certos), nuvem falha (local persiste, toast de sucesso ainda dispara, `toast.warning` extra aparece), e idempotência (2ª chamada com o mesmo `quote_id` não quebra o fluxo — o repository já garante isso, o teste prova que o diálogo sempre passa pelo mesmo caminho idempotente).
- **Por que só apareceu agora:** nenhuma homologação anterior desta cadeia de fatias tinha um consumidor de leitura do lado Supabase pra `financial_transactions`/`projects` gerados por quote — só o dashboard (G20) expôs.

---

**G23 — Avisos "Aviso Híbrido"/"Aviso de Backup Híbrido" na aba Dados afirmam que Clientes/CRM/Ficha Técnica "ainda usam dados locais", mas o default de leitura das 3 telas é Supabase desde jul/2026. [MÉDIO — RESOLVIDO na rodada `ux2-g21-g23-g25-fase-a`]**
Achado durante a reconciliação de `docs/architecture/kora-roadmap.md`, a partir de um relato do operador com prints da aba Dados (Configurações) datados de hoje, contradizendo a classificação "completo" que o roadmap tinha acabado de dar a esses 3 domínios.

- **Localização dos avisos** (`src/pages/Configuracoes.tsx`): linha 1271 (Clientes — "a tela Clientes ainda usa dados locais até a próxima etapa... ative a fonte Supabase experimental"), linha 1441 ("A tela principal de Clientes ainda usa localStorage nesta fase"), linha 1586 (Ficha Técnica — "A página Ficha Técnica principal continua usando localStorage nesta fase"), linhas 1835/1975 (CRM — "a tela principal de CRM ainda usa dados locais").
- **Prova de obsolescência — `git blame`, não suposição:** os 4 blocos de aviso vêm todos do mesmo commit `4b1a8f20` (2026-06-01). A lógica real que define o default de leitura das 3 telas foi escrita **depois**, em commits separados: `useClientsDataSource.ts:47` (`workspaceLoading || workspace ? "supabase" : "local"`) no commit `7ab23675` (2026-06-15); `getCrmDataSource()`/`getTechnicalSheetDataSource()` em `src/config/flags.ts` (commit `49ec0bf6`, 2026-07-04), com comentário explícito no próprio código confirmando "só 'local' explícito seleciona local" / "default 'supabase'". Nenhum desses defaults foi revertido depois — confirmado como estado atual de `main` no momento deste achado.
- **Detalhe que confirma a defasagem:** o aviso de Clientes cita "ative a fonte Supabase experimental" — um mecanismo de flag manual que **não existe mais** no código atual; a lógica de hoje não depende de nenhuma flag desse tipo, é automática pela presença de workspace.
- **Efeito:** quem lê a aba Dados hoje recebe uma informação que deixou de ser verdade há quase um mês (CRM/fichas) a quase dois meses (clients) — risco de decisão errada (ex.: achar que uma tela ainda depende de import manual quando já lê Supabase por padrão).
- **Lição:** texto de aviso hardcoded em tela de configurações tem o mesmo risco de obsolescência que import órfão (G16) ou dashboard nunca lido (G20/G22) — não existe teste que falhe quando o comportamento real diverge do texto, porque texto estático nunca "quebra" sozinho. Candidato a padrão: todo aviso que descreve o estado de uma flag/default deveria derivar do valor real da flag em vez de ser uma string fixa — ou, no mínimo, ter um teste que compare o texto contra o default real da flag.
- **Resolvido — caminho por bloco (opção (c) onde a função já era exportada e chamável sem prop-drilling, fallback (a) onde não era):**
  - **Linha 1271 (Clientes, `LocalClientsImportCard`) — (c):** reaproveita `workspace` já desestruturado no componente (`useCurrentWorkspace()`), sem import novo. Nota: o componente já tem um early-return próprio pra `!workspace` antes deste bloco, então o ramo "local" do texto é hoje inatingível em produção — mantido mesmo assim por defesa (se o early-return sumir um dia, o texto não volta a mentir sozinho).
  - **Linha 1441 (Clientes, `SupabaseClientsViewerCard`) — (c):** mesma base (`workspace`, já em escopo); como este componente **retorna `null` inteiro** se `!workspace` (linha própria), o texto aqui é escrito direto (sem ternário) — o ramo negativo é estruturalmente inatingível pela própria guarda do componente, não só "raro".
  - **Linha 1586 (Ficha Técnica, `LocalTechnicalSheetsImportCard`) — (a), fallback:** `getTechnicalSheetDataSource(clientId)` é por-cliente (mapa), não uma flag global — este componente lista candidatos agregados de vários clientes ao mesmo tempo, sem um único `clientId` de referência em escopo. Derivar do valor real exigiria iterar a lista inteira (resumo tipo "N de M clientes em local"), o que já não é mais "função já exportada, one-liner" — texto reescrito como fato fixo, mas correto hoje: lê do Supabase por padrão por cliente, "a menos que você tenha escolhido local explicitamente pra aquele cliente".
  - **Linhas 1835 (CRM, `LocalOpportunitiesImportCard`) e 1975 (CRM, `SupabaseCrmViewerCard`) — (c):** `getCrmDataSource()` é global, sem parâmetro, já exportada de `src/config/flags.ts` — import de uma função a mais na linha de import já existente do arquivo, ternário inline em cada componente. **Único caso onde os 2 estados são de fato alcançáveis em produção** (a flag pode legitimamente estar em `"local"`) — coberto por teste nos 2 estados (`Configuracoes.import-cards.test.tsx`, novo describe "G23").
- **Testes:** 4 casos novos em `src/pages/__tests__/Configuracoes.import-cards.test.tsx` — os 2 estados da flag CRM (default "supabase" vs `setCrmDataSource("local")`) provando que o texto acompanha a flag, mais 2 casos de sanidade (Clientes/Ficha Técnica) confirmando que a string obsoleta não aparece mais. `SupabaseClientsViewerCard`/`SupabaseCrmViewerCard` não têm teste direto (não são exportados do módulo hoje) — decisão de escopo: a lógica é idêntica à já testada em `LocalOpportunitiesImportCard`/`LocalClientsImportCard`, exportar só pra testar não pareceu valer o aumento de superfície pública do arquivo nesta rodada.

---

**O5 — cards de import locais divergiam em padrão de abertura do diálogo. [BAIXO — RESOLVIDO na rodada `qualidade-lint`]**
Achado durante a homologação (Fase D) da Etapa 5 · Fatia 8 (cutover de escrita de `opportunities`) — não corrigido nela por ser um achado de consistência entre cards, pré-existente da Fatia 2, não uma regressão da fatia que o encontrou. Detalhamento completo em
[`etapa-5-fatia-8-crm-cutover.md` §8](../qa/etapa-5-fatia-8-crm-cutover.md#8-fase-d--resultado-da-rodada-executada-vai-do-revisor) (observação registrada do caso (j) do runbook).

- **Correção ao escopo original:** o achado listado acima dizia "4 sempre abrem, 1 (opportunities) trava" e citava `LocalClientsImportCard` como já no padrão bom. A auditoria da rodada O5 (`qualidade-lint`) encontrou que **`LocalClientsImportCard` tinha o mesmo bug** (`disabled={eligibleCandidates.length === 0 || importing}` idêntico) — eram 2 cards travados (clients + opportunities), não 1. `LocalQuotesImportCard.tsx`/`LocalProjectsImportCard.tsx`/`LocalTasksImportCard.tsx` de fato já seguiam o padrão bom (`Card` inteiro como `DialogTrigger`, sempre clicável).
- **Fix aplicado:** removida a condição `eligibleCandidates.length === 0` do `disabled` do botão-gatilho nos 2 cards (`src/pages/Configuracoes.tsx`), mantendo só `disabled={importing}` — mesma mudança mínima nos dois, zero alteração em `analyze`/`importSelected`. Commits `1b1e385` (clients) e `177af53` (opportunities, + testes).
- **Teste de regressão:** `src/pages/__tests__/Configuracoes.import-cards.test.tsx` (2 casos — um por card) renderiza cada card com todos os candidatos já `"imported"`, confirma que o botão-gatilho não está desabilitado, clica e confirma que o diálogo abre mostrando o badge "Já Importado(a)". Verificado que os testes realmente pegam a regressão (revertida a condição temporariamente antes de commitar — os 2 casos falharam exatamente no `not.toBeDisabled()`).
- **Não bloqueante para nenhuma fatia já fechada** — a garantia de idempotência real (linha no banco, `count=1` contra `source_local_id`) sempre foi independente deste gap de UX.

---

**O6 — `LocalTechnicalSheetsImportCard` tinha o mesmo bug de trigger do O5. [BAIXO — RESOLVIDO na rodada `qualidade-lint-o6`]**
Achado durante a auditoria da rodada O5 (`qualidade-lint`), fora do escopo dos 5 cards nomeados (clients/opportunities/quotes/projects/tasks) naquela rodada — corrigido em rodada dedicada subsequente.

- **A causa:** mesmo padrão do O5 — `src/pages/Configuracoes.tsx` (card de fichas técnicas), `<DialogTrigger asChild><Button disabled={eligibleCandidates.length === 0 || importing}>`. Uma vez que todos os candidatos locais já estejam importados, o diálogo não abria mais.
- **Fix aplicado:** removida a condição `eligibleCandidates.length === 0` do `disabled` do botão-gatilho (`LocalTechnicalSheetsImportCard`), mantendo só `disabled={importing}` — mesma mudança mínima do O5, zero alteração em `analyze`/`importSelected`. `export` adicionado à função para permitir teste direto. Commit `b7b4100`.
- **Teste de regressão:** caso adicionado em `src/pages/__tests__/Configuracoes.import-cards.test.tsx` (mesmo molde dos 2 casos do O5) — renderiza o card com o único candidato já `"existe"`, confirma que o botão-gatilho não está desabilitado, clica e confirma que o diálogo abre mostrando o badge "Já Importada". Verificado que o teste pega a regressão (condição revertida temporariamente antes de restaurar o fix — o caso falhou exatamente no `not.toBeDisabled()`).
- **Interseção com Fatia 10 (Lane A, Fase D em andamento):** nenhum caminho de `quotes` foi tocado — só `Configuracoes.tsx` (card de fichas técnicas) e o arquivo de teste dos import cards.

---

**O7 — Duas lanes mergeando/publicando na mesma worktree de `main` ao mesmo tempo. [MITIGADO pela seção 16 do protocolo de homologação]**
Achado durante o fechamento da Etapa 6 · G8 (`flowNodes`/Send Node, `whatsapp-bot-reply`) — a Lane C mergeou `etapa-6-g8-flownodes` em `main` (fast-forward) na worktree principal do repo, a única onde `main` pode estar checked out (restrição do próprio git). Enquanto a Lane C rodava os gates pós-merge nessa mesma worktree, a Lane B (rodada O5, `qualidade-lint`) mergeou e publicou sua branch no mesmo `main` compartilhado, sem coordenação prévia — commits `aec949b`/`52715e5`. Detalhamento completo em [`etapa-6-g8-flownodes.md`](../qa/etapa-6-g8-flownodes.md).

- **Nenhum dado ou commit foi perdido**, e o merge da Lane B foi limpo (`ort`, sem conflito). O risco observado foi **verificação invalidada silenciosamente**, não corrupção: os gates da Lane C passaram a checar um tree que mudou por baixo dela a meio da checagem, e o `git push origin main` da Lane C encontrou o remoto já sincronizado pelo push da Lane B — a trilha de auditoria (quem publicou o quê, sob qual verificação) ficou ambígua a partir do log isolado de cada lane.
- **Padrão recorrente, não um caso isolado:** já observado antes desta rodada, com arquivos de WhatsApp em progresso de outra lane aparecendo/desaparecendo de um `git status` de sessão — nunca catalogado como gate até o G8.
- **Mitigação:** [`docs/qa/protocolo-homologacao.md` §16](../qa/protocolo-homologacao.md#16-emenda-2026-07-27--isolamento-de-worktree-por-lane) — checagem de abertura de sessão (`pwd` + `git worktree list`, declarada no relatório), push só da própria lane exceto sincronização explicitamente reportada, e reconhecimento explícito de que o merge-para-`main` é um ponto de contenção estrutural entre lanes (não isolável por worktree, por restrição do git), não um caso a resolver por isolamento total.

---

**O8 — CRM: "Mover para etapa" (menu do lead) não move nada, sem feedback nenhum. [MÉDIO — achado do revisor, causa PROVÁVEL identificada por leitura, não confirmada ao vivo]**
Achado durante o smoke pós-merge do Pacote do Flip de `quotes` (Etapa 5) — fora do domínio `quotes`, catalogado aqui sem correção nesta rodada. Detalhamento em
[`etapa-5-flip-quotes.md`](../qa/etapa-5-flip-quotes.md).

- **Sintoma reportado:** no menu de ações do lead (`CRM.tsx`, `LeadActionsMenu`), o submenu "Mover para etapa" → escolher uma etapa não produz efeito nenhum observável.
- **Causa provável, por leitura de código (não reproduzida ao vivo — sessão sem acesso autenticado ao app):** `handleMoveToStage` (`CRM.tsx:560`), no ramo `activeDataSource === "supabase"`, tem um retorno silencioso —
  `if (!lead || !lead.supabaseId) return;` (`:566`) — sem toast, sem log visível, sem nenhum sinal de que a ação foi ignorada. Um lead sem `supabaseId` (ainda não importado/sincronizado, ou qualquer outro motivo que zere o campo) faz o clique parecer não fazer nada, indistinguível de um bug de UI. O restante do fluxo (`crmOpportunitiesRepository.moveOpportunityStage`, toasts de sucesso/erro) está corretamente implementado — o gap é especificamente esse guard silencioso.
- **Mesma classe de lição já catalogada (O2/O3/O4, Fatia 8):** nenhuma ação deve retornar silenciosamente sem feedback quando bloqueada — aqui o guard nem é sobre uma flag (que já teria um toast dedicado em `blockWriteAction`), é sobre um pré-requisito de dado (`supabaseId` ausente) que hoje não avisa ninguém.
- **Não corrigido nesta rodada** — fora do escopo do Pacote do Flip de `quotes` (domínio `opportunities`/CRM). Fica registrado para uma fatia/sessão dedicada ao CRM confirmar a causa ao vivo (reproduzir com um lead sem `supabaseId` em modo Supabase) e decidir o feedback correto (toast de erro explicando o motivo, ou impedir a etapa de aparecer no submenu pra leads nesse estado).

---

**O9 — `projectsRepository.softDeleteProject` aguardando UI (repository pronto, sem caller de propósito). [BAIXO — exclusão fora do escopo do flip, decisão explícita]**
Achado original durante a Fase A do flip de `projects` (Etapa 5). Grep repo-wide confirma zero chamadas a `projectsRepository.softDeleteProject` fora do próprio arquivo (`src/repositories/projectsRepository.ts`) — nenhuma UI aciona soft-delete de projeto na nuvem hoje. Detalhamento: [`etapa-5-flip-projetos.md`](../qa/etapa-5-flip-projetos.md) §1 (item 8 do inventário de escrita) e [`etapa-5-flip-projetos-pacote.md`](../qa/etapa-5-flip-projetos-pacote.md) §3.3.

- **Reclassificado (Pacote do Flip, Fase B, 2026-08-11):** decisão explícita do revisor — exclusão fica **fora do escopo** do flip. `deleteProject` (hook local) também não tem nenhum caller na UI hoje — nem local tem botão "excluir projeto" — então adicionar exclusão agora seria feature nova, não paridade. `softDeleteProject` (nuvem) fica pronta e esperando; UI de exclusão (local + nuvem juntos) é decisão de backlog de produto, não deste flip.
- Nenhuma ação de código nesta rodada além do registro/reclassificação.

---

**O10 — `projects.status` tem um alias legado permanente ('active'), em vez de vocabulário único. [BAIXO — dívida assumida, Opção A escolhida sobre Opção B]**
Achado durante o desenho do CHECK constraint de `projects.status` (Etapa 5, flip de `projects`, item 3-a). `'active'` é o `DEFAULT` da própria coluna (`20260601030000_create_projects_schema.sql:12`) e o valor gravado por `projectsRepository.createProjectFromQuote` (`:51`) — nenhum dos dois é um valor do vocabulário local (`ProjectStatus`, 7 valores). Detalhamento completo, com as duas opções e prós/contras: [`etapa-5-flip-projetos.md`](../qa/etapa-5-flip-projetos.md) item 3.

- **Decisão do revisor (retomada da Fase B.1, 2026-08-11):** Opção A — manter `'active'` como alias legado permanente no CHECK e no mapper (`CLOUD_TO_LOCAL_PROJECT_STATUS`, `projectsMapper.ts`), em vez da Opção B (eliminar na origem: trocar o `DEFAULT` da coluna + o write de `createProjectFromQuote` + o OR defensivo de `SupabaseOperationalDashboardCard.tsx:315-316` por um vocabulário único). Motivo: Opção A é aditiva, zero risco a código já em produção (G22); Opção B tocaria um caminho de escrita já funcionando por um ganho só estético.
- **Pacote futuro, se algum dia for feito:** trocar o `DEFAULT` da coluna `projects.status` de `'active'` para um valor do vocabulário local (ex. `'planning'`), trocar `createProjectFromQuote` para gravar `'in_progress'` em vez de `'active'`, remover `'active'` do CHECK e do mapper, e remover o OR defensivo do dashboard.
- Nenhuma ação nesta rodada além do registro — o CHECK constraint (migration `20260811000100`, escrita e não aplicada) já admite `'active'` deliberadamente.

---

**O11 — Fixture de teste com data absoluta é bomba-relógio quando a lógica testada calcula prazo contra `new Date()` real. [BAIXO — 1 instância corrigida; auditoria preventiva rodada, 0 instâncias novas]**
Achado na reabertura pós-formatação da máquina (item 0.5, retomada da Fase B.1 do flip de `projects`, 2026-08-11). `QuotesSection.test.tsx` tinha `createdAt: "2026-07-20"` + `validityDays: 20` num fixture de status `"rascunho"` — a data de validade computada (`isQuoteExpired`, `useQuotes.ts:163-166`, compara contra `new Date()` real, não congelada em teste) tinha vencido dias antes desta sessão, fazendo o teste falhar por "Vencido" aparecer em vez de "Rascunho". **Não era regressão de ambiente nem de `main`** — `main` rodava 354/354 nas rodadas documentadas antes da formatação; o vermelho apareceu só porque o calendário avançou.

- **Corrigido nesta rodada:** os 2 fixtures afetados (`makeLocalQuote`, `makeSupabaseMappedQuote`) trocaram `createdAt` fixo por `todayIso()` (helper local ao arquivo de teste) — sempre válido, não importa que dia a suíte rode. Suíte voltou a 354/354 antes de qualquer trabalho em `projects`.
- **Classe do achado, não só a instância:** qualquer fixture de teste com data absoluta próxima da validade, testado contra lógica que usa `new Date()` real (prazo, expiração, vencimento), é uma bomba-relógio — funciona hoje, quebra sozinho quando o calendário passar da data.
- **Auditoria preventiva (rodada `qualidade-lint-o11`, 2026-08-11):** varredura sistemática de todo fixture de teste com data absoluta cruzado com lógica de produção que compara contra `new Date()` real, nos domínios quotes/projetos/tarefas/financeiro/CRM/Central do Dia. Método: mapeadas as funções de produção que fazem esse tipo de comparação —
  `isQuoteExpired`/`getQuoteDaysToExpire` (`useQuotes.ts`), `isOverdue`/`dueBucket` (`Tarefas.tsx`), `in7` sobre `dueDate` de projeto (`ProjectsSection.tsx`), `followupsPending` sobre `nextActionDate` (`CRM.tsx`), `isOverdue` sobre recebível (`ClientActivitiesTab.tsx`) e o agregador `computeDayCenter` (`dayCenter.ts`, cobre tarefa/lead/orçamento/financeiro/projeto/atividade manual) — depois cruzadas contra os ~40 arquivos de teste com literais de data absoluta (`grep -rlE "['\"]20[0-9]{2}-[0-9]{2}-[0-9]{2}"`).
  **Resultado: nenhuma instância nova.** Nenhum desses arquivos de teste exercita as funções de comparação acima com um fixture de data absoluta cujo resultado dependa do dia real: os literais de data restantes servem só para (a) mapeadores que fazem passthrough do campo sem comparação (`financeMapper`, `quoteMapper`, `tasksMapper`, `crmOpportunityMapper`, `projectsMapper` — confirmado lendo cada implementação), (b) exibição de data computada mas fixa (`SupabaseQuotesViewerCard` mostra `createdAt + validityDays` como texto, nunca decide visibilidade por `isQuoteExpired`), ou (c) formatação pura (`format.test.ts`). Achado notável sem ser bomba: `financeMapper.test.ts`/`useLocalFinanceImport.test.ts` têm `dueDate: "2026-08-01"` (já no passado nesta data) com `status: "pending"` — inofensivo porque nenhuma lógica testada ali deriva "vencido" da data, mas é o tipo de fixture que quebraria na hora que uma tela de Financeiro ganhar teste de página inteira (`Financeiro.tsx`/`dayCenter.ts` já leem esse campo em produção). `dayCenter.ts` (o agregador da Central do Dia) não tem nenhum teste dedicado hoje — logo não há fixture para auditar ali, mas também não há cobertura de regressão para essa lógica.
- **Sem repetição 3+** para justificar um helper `todayIso()` compartilhado em `test-utils` — a única instância real segue isolada em `QuotesSection.test.tsx`; não implementado.
- Escopo desta rodada: só os arquivos de teste já existentes na árvore (39 arquivos `*.test.ts(x)`, 398 casos). Não cobre trabalho futuro (novo teste de página com fixture de data precisa nascer já usando `todayIso()`/`addDaysIso()`).

---

**O12 — `mapLocalProjectToSupabase` nunca traduz `status === "archived"` pro boolean `archived` da nuvem. [RESOLVIDO — Pacote do Flip, Fase B, 2026-08-11]**
Achado durante o desenho do CHECK de `status` (Etapa 5, flip de `projects`, item 3-a/migration `20260811000100`). `mapLocalProjectToSupabase` (`projectsMapper.ts:99`) grava `archived: false` **hardcoded**, sempre — nunca verifica `project.status === "archived"` pra setar `true`. Consequência prática: um projeto local arquivado, ao passar pelo import geral (`useLocalProjectsImport.ts`, já em `main` desde a Fatia 7), produz uma linha na nuvem com `status: "archived"` (texto) + `archived: false` (boolean) — os dois sinais divergem na mesma linha. É por isso que o CHECK constraint da migration `20260811000100` precisa admitir `'archived'` como valor de texto além do boolean (ver [`etapa-5-flip-projetos.md`](../qa/etapa-5-flip-projetos.md) item 3, justificativa do 8º valor).

- **Não é um bug isolado** — é a mesma classe de dívida do O10 (alias legado `'active'`): os dois nascem do mesmo desenho provisório de `mapLocalProjectToSupabase`, escrito na Fatia 7 antes de existir qualquer normalização de vocabulário de `status`.
- **Correção correta, se um dia for feita:** `mapLocalProjectToSupabase` passa a gravar `archived: project.status === "archived"` e, nesse caso, `status` sai como um valor neutro (mesmo padrão que `quoteMapper.ts` já usa pra `quotes`: `status === "arquivado"` → `{ status: "draft", archived: true }`) — aí sim o texto `'archived'` deixaria de ser necessário no CHECK, e o vocabulário de `status` ficaria mais enxuto.
- **Resolvido no Pacote do Flip (Fase B):** `translateLocalProjectStatusToCloud` (novo, `projectsMapper.ts`) — exatamente o mecanismo descrito acima. `mapLocalProjectToSupabase` agora usa essa tradução; escrita nova nunca mais grava `status='archived'` (texto) com `archived=false`. Dado legado (já gravado pelo comportamento antigo) continua lido certo, sem regressão — `translateCloudProjectStatusToLocal` já cobria os dois formatos desde a fatia N. Detalhamento: [`etapa-5-flip-projetos-pacote.md`](../qa/etapa-5-flip-projetos-pacote.md) §6.1.
- **O10 permanece separado, não resolvido** — decisão explícita do revisor foi resolver só O12 nesta fatia; o alias `'active'` continua admitido (Opção A).

---

**O13 — `CRM.test.tsx` (`describe("CRM · O2 (excluir)...")`) flaky na suíte completa. [RESOLVIDO — causa confirmada: `testTimeout` global curto demais sob contenção real, não é bug de teste nem de produção]**
Investigação dedicada (LANE C, 2026-08-12), conforme recomendado no achado original.

- **Leitura do describe (O2):** sem `fake timers`, sem estado mutável compartilhado entre casos (`beforeEach` global limpa `localStorage`/mocks — `CRM.test.tsx:197-201`), sem `afterEach` explícito mas RTL registra cleanup automático via `globals: true` (padrão da lib, não uma lacuna). Único ponto sensível a tempo: um `waitFor` (`:236`) com o timeout default. Nada estruturalmente errado no teste em si.
- **Reprodução — tentativa 1 (isolamento):** suíte completa 3x seguidas, sem carga concorrente própria — **3/3 rodadas 100% verdes** (47/47 arquivos, 416/416 testes cada). Flake NÃO reproduziu em isolamento.
- **Reprodução — tentativa 2 (contenção real, deliberada):** 3 processos `npx vitest run` disparados em paralelo na mesma máquina (simulando as 3 worktrees ativas do repo) — **reproduzido de forma determinística nas 3 rodadas**: 5 a 8 arquivos falhando por rodada, conjunto variando a cada rodada (igual ao sintoma original), `CRM.test.tsx`/caso O2 entre os que falharam nas 3. **Toda falha, nas 3 rodadas, foi `Error: Test timed out in 5000ms`** — nunca um erro de asserção. Arquivos afetados sem relação nenhuma entre si: `QuotesSection.test.tsx`, `ProjectsSection.test.tsx`, `ProjectDetailDrawer.test.tsx`, `ContactsTab.test.tsx`, `CreateReceivableDialog.test.tsx`, `LinkedQuotesSection.test.tsx`, `SupabaseQuotesViewerCard.test.tsx` — confirma que **não é específico de CRM/`opportunities`**, é qualquer teste que dependa de um `waitFor`/efeito assíncrono ficando sem CPU sob carga.
- **Causa raiz:** `testTimeout` do vitest (default 5000ms, nunca configurado explicitamente) é curto demais pro modo de operação real deste repo — múltiplas lanes rodando suítes completas ao mesmo tempo em worktrees separadas é prática normal e documentada (§16 do protocolo), não uma condição rara.
- **Fix aplicado (disciplina fail→restore):** `testTimeout: 20000` em `vitest.config.ts`. Validado repetindo a MESMA reprodução de contenção (3 processos paralelos) com o fix: **3/3 rodadas 100% verdes** (47/47, 416/416 cada), sob a mesma carga que antes derrubava 5-9 arquivos por rodada de forma consistente. Fail confirmado → fix aplicado → restore confirmado, sob condição idêntica.
- **Gates:** `tsc -p tsconfig.app.json --noEmit` inalterado por este fix (config de teste, não código de app — mas ver **G27**, achado não-relacionado nesta mesma rodada, corrigido em rodada seguinte). `npm run lint`: 0 erros/29 warnings, inalterado.

---

**G24 — `whatsapp-campaign-v2-sender`: recipients presos em `status='sending'` sem reaper (classe P4 do Batch 3, reintroduzida no v2). [ALTO — FECHADO, reaper em produção]**
Achado durante a investigação da Etapa 6, item 4 (fila de campanhas v2), Fase A (LANE C, ref. `71c4a75`) e re-verificado contra o tip real (`208ff9c`) na Fase B. O lock de idempotência do sender v2 (`whatsapp-campaign-v2-sender/index.ts:197-205`) é um `UPDATE ... WHERE status='queued'` por linha, sem contrapartida de liberação: se a invocação morre no meio do lote (timeout da edge function, queda de rede), os recipients já travados em `sending` nunca voltam pra `queued` — a próxima chamada de `send_batch` só seleciona `status='queued'` (`:180-187`), então ficam presos pra sempre, sem nenhum mecanismo de self-heal.

- **Mesma classe de bug já resolvida uma vez, no legado:** `20260701220000_batch3_campaign_robustness.sql` (comentário P4, linhas 3-8) documenta ter corrigido exatamente isto no sistema legado ("ran up to ~6min per invocation and blew the wall-clock limit, stranding rows in status='sending' forever"). O v2 nasceu com o desenho pré-fix (sleep in-process, sem gate no banco, sem reaper) e nunca recebeu o mesmo tratamento.
- **Janela de exposição calculada, não estimada:** `MAX_BATCH_SIZE=10` + delay `30-90s` entre envios (`index.ts:23-26`, aplicado entre cada um dos 9 gaps de um lote cheio, `:286-289`) soma até **~13,5 min de wall-clock por invocação**, fora rede/typing/DB — bem acima do timeout típico de Edge Function, tornando o timeout um risco real de uso normal, não só de falha de rede.
- **Fix:** RPC dedicada `reap_stuck_campaign_v2_recipients` + cron a cada 15 min, migration `20260811000200_etapa6_campaign_v2_reaper.sql` (escrita, não aplicada — sessão §8-b). Decisão registrada (opção (c) + reaper, não (a) automação completa): ver `kora-roadmap.md` §4, item 4.
- **Limitação conhecida do fix:** o reaper re-enfileira o recipient sem saber se o envio já tinha ocorrido antes do crash de status — semântica *at-least-once*, reenvio duplicado possível e aceito nesta rodada; resolução definitiva (idempotência forte por `provider_message_id` antes de reaptar) fica pra fatia futura de unificação/opção (b).
- **Sessão §8-b APLICADA — 12/ago/2026.** Pacote 2 de 2 desta janela (o outro é a migration de Projetos, ver `etapa-5-flip-projetos.md`). `cron.job` confirma job **`jobid 3`**, schedule `*/15 * * * *`, ativo. Grants confirmados só `service_role` + dono da function (nenhum `anon`/`authenticated`/`PUBLIC`). Teste funcional manual (`SELECT reap_stuck_campaign_v2_recipients()`) retornou **0** (nenhum recipient preso no momento da aplicação — esperado, sem incidente em curso). **Zero incidentes.** Acompanhamento pendente, **não bloqueante** (mesmo espírito do kit (c) do `ai-rate-limit-cleanup`): confirmar em `cron.job_run_details` (jobid 3) que a 1ª execução automática rodou sozinha.

---

**G25 — `WhatsAppCampaigns.tsx` (UI do sistema legado de campanhas) é código órfão — zero importadores. [MÉDIO — RESOLVIDO na rodada `ux2-g21-g23-g25-fase-a` (opção a, só o componente)]**
Achado na mesma investigação. `git grep` (`71c4a75` e re-confirmado em `208ff9c`) só encontra `WhatsAppCampaigns.tsx:16` (a própria definição do componente) — nenhuma página/rota importa. `WhatsApp.tsx:986` monta `CampaignsBackendPage` (v2), não este componente. Como é o único ponto de escrita em `whatsapp_queue`/`whatsapp_campaigns` do app hoje (nenhum outro caller de `.from("whatsapp_queue").insert(...)` existe em `src/`), o worker legado (`whatsapp-campaign-processor`, cron a cada minuto, claim/reap atômico — G4 original) está ativo e bem construído, mas sem nenhum caminho de produção pra alimentar a fila com campanhas novas.

- **Cuidado ao decidir remover:** o cron do processor legado é hoje o heartbeat que mitiga a pausa por inatividade do projeto Supabase Free (`kora-roadmap.md` §6.3) — desagendá-lo por causa da UI órfã, sem decidir separadamente sobre esse heartbeat, reintroduz esse risco.
- **Resolvido (opção a — só o componente):** `src/components/whatsapp/WhatsAppCampaigns.tsx` deletado (345 linhas). **Nada além do arquivo foi tocado** — `whatsapp-campaign-processor` (worker legado, cron a cada minuto) e o cron em si seguem exatamente como estavam, intactos, preservando o heartbeat que mitiga a pausa do Supabase Free. O componente já era o único caminho de produção capaz de alimentar `whatsapp_queue`/`whatsapp_campaigns`, e nenhuma rota o importava — removê-lo não muda o comportamento observável do app (a fila legada já não recebia campanhas novas por essa via antes da remoção). Decisão de unificação v1→v2 (ou o que fazer do worker/heartbeat) continua em aberto, fora do escopo desta fatia (fatia futura, `kora-roadmap.md` §4).

---

**G26 — Teste de interação que só confere o texto resultante pode passar sem a ação real ter ocorrido — mesma classe de risco do §17 (prova por hash de commit, não por comportamento observado), agora em nível de asserção de teste. [BAIXO — achado de metodologia, corrigido no teste que o descobriu]**
Achado durante os testes de mount do UX2 (`ux2-g21-g23-g25-fase-a`, `WhatsApp.tab-gate.test.tsx`). Uma primeira versão do teste clicava numa aba com `fireEvent.click(trigger)` e verificava só se o texto esperado ("WhatsApp não conectado") aparecia na tela — passava, mas por motivo errado.

- **A causa:** o `TabsTrigger` do Radix (`@radix-ui/react-tabs`, versão instalada neste projeto) só ativa com a sequência completa de eventos de ponteiro — `pointerdown`/`mousedown`/`pointerup`/`mouseup`/`click` — um `fireEvent.click` isolado não muda o `value` do `Tabs`. Como a aba default ("chat") já mostra o mesmo empty state que as outras 4 abas gateadas (todas usam o mesmo `WhatsAppEmptyState`), um clique que **não fazia nada** ainda deixava a tela exatamente igual ao resultado esperado — o teste não conseguia distinguir "a ação aconteceu e produziu o resultado certo" de "a ação não aconteceu e o resultado já era esse por padrão".
- **Como foi pego:** não pela leitura do teste (ele parecia correto) — só ao depurar por que os testes com **conteúdo distinto por aba** (`STUB: WhatsAppBotConfig montado`, `STUB: CampaignsBackendPage montado`) falhavam mesmo com a asserção "parecida" nos testes de empty state passando. A investigação (via `screen.getAllByRole("tab").map(t => t.getAttribute("data-state"))`, antes/depois do clique) mostrou que a aba ativa nunca mudava, mesmo o clique "passando" silenciosamente nos outros casos.
- **Fix aplicado no teste (não em código de produção):** helper `clickTab()` centraliza a sequência completa de eventos **e** confere explicitamente `expect(trigger).toHaveAttribute("aria-selected", "true")` logo após o clique — o teste agora prova que a ação ocorreu, antes de conferir o efeito dela. Todos os 10 casos de `WhatsApp.tab-gate.test.tsx` usam o helper.
- **Classe do achado, não só a instância:** qualquer teste de interação (clique, submit, drag) numa UI onde dois estados diferentes podem produzir o mesmo texto/resultado visível corre esse risco — a asserção "o texto certo apareceu" não é suficiente sozinha quando um "nada aconteceu" também produziria esse texto. Padrão a adotar: quando a ação testada tem um sinal de estado próprio e barato de conferir (um atributo ARIA, uma classe `data-state`, uma chamada de mock), confirmar esse sinal **além** do efeito observável — mesmo espírito do §17 (`docs/qa/protocolo-homologacao.md`): não inferir que a ação certa aconteceu só pelo comportamento que ela deveria produzir, quando esse comportamento pode coincidir por motivo errado.
- **Não é um bug de produção** — nenhum código de `src/` fora de testes foi alterado por este achado; é uma lição de como escrever o teste, registrada para não se repetir noutras suítes de interação.

---

**G27 — Gate real (`npx tsc -p tsconfig.app.json --noEmit`) quebrado em `main` desde o merge da Fase B do Pacote do Flip de Projetos (`d90ba47`/`395a432`). [ALTO — confirmado e FECHADO]**
Achado ao rodar os gates da investigação O13 (LANE C) — fora do escopo pedido naquela rodada, reportado sem correção imediata por não ser arquivo/lane daquela sessão. Corrigido em rodada dedicada seguinte. **Renumerado de G26 pra G27** no merge desta entrada — a numeração G26 colidiu entre duas lanes trabalhando em paralelo sem ver o catálogo uma da outra (esta e a Lane B, achado do falso-positivo de teste acima); G26 fica com o achado da Lane B (mesclado primeiro em `main`), este vira G27.

`tsc -p tsconfig.app.json --noEmit` na tip de `main` antes da correção (`395a432`/`e86d7a6`) retornava 4 erros, todos em `src/components/clients/ClientActivitiesTab.tsx`:

```
src/components/clients/ClientActivitiesTab.tsx(167,31): error TS2304: Cannot find name 'useProjects'.
src/components/clients/ClientActivitiesTab.tsx(303,43): error TS7006: Parameter 'p' implicitly has an 'any' type.
src/components/clients/ClientActivitiesTab.tsx(304,56): error TS7006: Parameter 'p' implicitly has an 'any' type.
src/components/clients/ClientActivitiesTab.tsx(305,27): error TS7006: Parameter 'p' implicitly has an 'any' type.
```

- **Causa raiz — resíduo de tipo, não bug de runtime:** `buildInferredEvents` (linha 162-169) declarava `projects: ReturnType<typeof useProjects>["projects"]` no tipo dos argumentos — mas o import de `useProjects` foi removido na Fase B, que migrou o consumidor pra `useBifurcatedProjects()` (linha 431 — ver G24/G25 e `etapa-5-flip-projetos-pacote.md`). O call-site (linha 440) já passava `useBifurcatedProjects()` pro parâmetro `projects` antes da correção — o **comportamento em runtime nunca mudou** (por isso `vitest` sempre passou 416/416, sem acusar nada — checagem de tipo e teste de comportamento são gates independentes). O problema era só a anotação de tipo, que não resolvia mais porque o import sumiu. Os outros 3 erros (implicit `any`) eram cascata direta do primeiro.
- **Fix aplicado, alinhado ao hook real (não um silenciador):** `useBifurcatedProjects()` retorna `Project[]` **direto**, não `{projects: Project[]}` como o `useProjects()` antigo — shape diferente do que a sugestão inicial de fix presumia (`["projects"]` indexado teria sido o fix errado). Correção real: `projects: ReturnType<typeof useBifurcatedProjects>;` (sem indexação), já que o hook em uso retorna o array diretamente. Commit `c73a175`, mesclado em `main` por fast-forward (`e86d7a6..c73a175`) — 1 arquivo, 4 linhas (3 de comentário + 1 de código), zero mudança de comportamento observável.
- **Por que isso não bloqueou o merge da Fase B:** não determinado — `[completar por quem investigar, se algum dia importar]`: possível que os gates daquela rodada tenham rodado `tsc --noEmit` na raiz (o gate vazio do G9 original, `"files": []`) em vez de `-p tsconfig.app.json` (o gate real desde a correção do G9), ou que o erro tenha entrado depois do último gate local e antes do push. Não investigado — não bloqueia nada agora que o fix está em produção.
- **Gates da correção:** `tsc -p tsconfig.app.json --noEmit` → 0 erros (saída literal vazia, confirmada no tip pós-merge). `npm run lint` → 0 erros/29 warnings (baseline inalterado). `npx vitest run` → 48/48 arquivos, 430/430 testes.

---

**G28 — Confirmação empírica, do lado de quem mergeou por cima do G27: o comando de gate usado (`npx tsc --noEmit`, sem `-p`) checava 0 arquivos, sempre "verde" independente do código real. [ALTO — confirmado, corrigido estruturalmente por `npm run gates`]**
Achado durante a investigação do incidente do merge do UX2/G21/G23/G25 (`e86d7a6`, LANE B) — a mesma rodada que mergeou por cima do tip já quebrado pelo G27, reportando "tsc=0" no relatório de merge. Responde, para este caso concreto, a pergunta deixada em aberto no G27 ("por que isso não bloqueou o merge da Fase B") — não pro merge original da Fase B (não investigado, autor diferente), mas confirma que o **mesmo padrão de comando vazio** estava em uso pela Lane B nesta rodada seguinte, e teria mascarado o G27 (ou qualquer outro erro de tipo) indefinidamente se a Lane C não tivesse rodado o comando certo por fora.

- **Comandos literais usados pela Lane B no merge de `e86d7a6`:** `npx tsc --noEmit` (tsc), `npm run lint` (lint), `npx vitest run` (testes) — os 3 rodados a cada commit da fatia e no tip final antes do push. `lint` e `vitest` bateram certo (0 erros / 430 testes verdes) porque cobrem o projeto inteiro por padrão, independente de flag `-p`; só o `tsc` divergiu.
- **Reprodução (checkout detached de `e86d7a6`, sem tocar `main`):**
  ```
  $ npx tsc --noEmit; echo "EXIT: $?"
  EXIT: 0
  $ npx tsc --noEmit --listFiles | wc -l
  0
  ```
  Zero arquivos processados — não "passou com cobertura parcial", literalmente não checou nada. Comparado ao comando certo no mesmo commit:
  ```
  $ npx tsc -p tsconfig.app.json --noEmit
  src/components/clients/ClientActivitiesTab.tsx(167,31): error TS2304: Cannot find name 'useProjects'.
  src/components/clients/ClientActivitiesTab.tsx(303,43): error TS7006: Parameter 'p' implicitly has an 'any' type.
  src/components/clients/ClientActivitiesTab.tsx(304,56): error TS7006: Parameter 'p' implicitly has an 'any' type.
  src/components/clients/ClientActivitiesTab.tsx(305,27): error TS7006: Parameter 'p' implicitly has an 'any' type.
  EXIT: 2
  $ npx tsc -p tsconfig.app.json --noEmit --listFiles | wc -l
  1112
  ```
- **Causa raiz — mesma do G27, agora com o mecanismo exato provado:** `tsconfig.json` (raiz) tem `"compilerOptions"` + `"files": []` + `"references"` pros dois sub-projetos (`tsconfig.app.json`/`tsconfig.node.json`) — padrão de *project references* do TypeScript. Sem a flag `--build`/`-b`, `tsc` **não segue `references` automaticamente**; com `files: []` e nenhum `include`, o conjunto de entrada fica vazio — `tsc --noEmit` sempre sai `0`, para qualquer estado do código-fonte. Este já era o "gate vazio" descrito no achado G9 original (fora deste documento no momento da escrita, ver histórico) — não é uma regressão nova, é um comando errado que sobrevive porque "sai verde" nunca chama atenção pra si mesmo.
- **Por que não é erro de julgamento pontual, é risco estrutural:** o comando errado não falha nunca, nem em CI nem localmente — não há sinal de alerta que diferencie "tsc rodou e passou" de "tsc não rodou de verdade". Qualquer lane, incluindo as que já sabem da distinção `-p tsconfig.app.json`, pode digitar o comando errado de memória num momento de pressa e nunca descobrir, porque o resultado observável (saída vazia, exit 0) é idêntico ao de um gate real que passou.
- **Fix estrutural (não só desta instância):** script `"gates"` em `package.json` —
  `tsc -p tsconfig.app.json --noEmit && npm run lint && vitest run` — e emenda permanente no
  protocolo de homologação ([§19](../qa/protocolo-homologacao.md#19-emenda-2026-08-13--gate-de-tsc-padronizado-npm-run-gates-saída-literal-no-relatório)):
  todo merge usa `npm run gates`, relatório sempre com a saída literal do `tsc` colada (não um
  resumo tipo "tsc=0").
- **Validação (tip real de `main`, pós-fix, `c73a175`):** ver saída literal de `npm run gates` no
  commit desta correção (`gates-tsc-app-standardize`).

---

**G29 — Banner/badge de "modo leitura" em `ProjectsSection.tsx` sobreviveram intactos da Fatia N até depois do flip dos defaults (Fase C), anunciando bloqueio de escrita que não existe. [MÉDIO — confirmado e FECHADO, classe "flip incompleto — texto de UI nunca atualizado, não divergência de flag"]**
Achado na Fase D (homologação B.3), Caso 1, do Pacote do Flip de `projects` (Etapa 5). Com `dataSource=supabase` e nenhuma chave de flag setada (usuário novo, BUILD `b90f86a`), a tela de Projetos exibia badge **"Modo leitura"** + banner **"Projetos em modo leitura (Supabase) — Escrita ainda chega numa próxima fatia — volte para Local para editar"** — texto literal da Fatia N (leitura bifurcada, escrita ainda bloqueada por `blockWrite()`) — **enquanto a escrita real (Fase B/C) já funcionava** (SELECT confirmou `HOMOLOG-FLIP-projeto-A` criado em `public.projects`).

- **Hipótese original (revisada e corrigida durante a investigação):** o operador suspeitou de divergência de semântica entre pontos de leitura da flag `kora.projects.supabaseWrite.enabled` (algum ponto ainda checando `=== "true"`, opt-in, enquanto o caminho de escrita usa o hook novo, opt-out). **Grep exaustivo não encontrou nenhum ponto com semântica antiga** — os 3 call sites reais de `isSupabaseProjectsWriteEnabled()` (`ProjectsSection.tsx:186`, `ProjectDetailDrawer.tsx:122`, `QuoteToProjectDialog.tsx:167`) já usavam o hook opt-out corretamente, todos no caminho do ESPELHO (padrão G22, modo local).
- **Causa raiz real, mais simples que a hipótese:** o badge (`ProjectsSection.tsx:262-266`) e o banner (`:294-304`) eram gated **só** por `dataSource === "supabase"` — texto fixo, **nunca checavam a flag em lugar nenhum**. Não é "dois pontos de leitura discordando"; é um ponto de UI que nunca foi atualizado quando a Fase B trocou o CRUD de bloqueado pra real.
- **Achado arquitetural importante que corrige a expectativa do runbook:** diferente de `quotes` (onde `isSupabaseQuotesWriteEnabled()` gateia se editar um registro lido da nuvem é permitido), em `projects` o CRUD em modo Supabase (`createSupabaseProject`/`updateSupabaseProject`, `useSupabaseProjects.ts`) **nunca checou a write flag, nos dois sentidos** — só `!workspace` bloqueia. A flag sempre foi, por desenho documentado no próprio hook (`useSupabaseProjectsWriteFlag.ts`), o gate do ESPELHO em modo local, não do CRUD direto em modo nuvem. Por isso o fix **não** introduziu uma checagem de flag nova no banner (isso teria sido uma mudança de comportamento não pedida, capaz de quebrar a escrita que o Caso 1 acabou de confirmar) — corrigiu o texto pra refletir a realidade: badge/banner mostram "Modo operacional"/"Projetos operacionais (Supabase)" sempre que `dataSource === "supabase"`, sem depender de nenhuma flag.
- **Testes novos** (`ProjectsSection.test.tsx`, describe "G29"): usuário novo sem chaves → operacional, nunca "modo leitura"; e escrita real funciona mesmo com `kora.projects.supabaseWrite.enabled=false` explícito — prova de que a flag genuinamente não gateia esse caminho (não uma lacuna a fechar).
- Detalhamento: [`etapa-5-flip-projetos-runbook.md`](../qa/etapa-5-flip-projetos-runbook.md) §3 (Caso 1).

**G30 — `ProjectDetailDrawer.tsx` aberto em modo Supabase ficava preso mostrando o status antigo após a própria mutação (ex.: "Iniciar projeto"), mesmo com o banco já gravado — só corrigia fechando e reabrindo. [MÉDIO — confirmado e FECHADO, classe "stale state — cache de mutação confiava só no refetch, não na resposta da própria escrita"]**
Achado na Fase D (homologação), Caso 2, do Pacote do Flip de `projects` (Etapa 5), executado logo após o fix do G29 (BUILD `e4391eb`). Com o drawer aberto em modo Supabase, "Iniciar projeto" pelo menu do `ProjectDetailDrawer` atualizava o card na lista imediatamente e gravava `in_progress` no banco (SQL confirmado), mas o drawer aberto continuava exibindo "Planejado".

- **Mecanismo confirmado (não é prop-snapshot do momento da abertura):** `ProjectDetailDrawer` não guarda estado próprio do projeto — `ProjectsSection.tsx` deriva `detailProject` de `projects.find(p => p.id === detailId)` a cada render, a mesma fonte reativa que alimenta o card da lista. A staleza não vem de uma cópia congelada; vem de **quando** essa fonte reativa (`useSupabaseProjects()`, React Query) reflete a escrita.
- **Causa raiz:** `updateMutation` (`useSupabaseProjects.ts`) só fazia `invalidateQueries()` no `onSuccess` e esperava o refetch subsequente (`listProjects`) atualizar o cache. Qualquer lag entre o UPDATE confirmado e esse GET enxergar o resultado (latência de rede, cache do PostgREST, etc.) faz o refetch devolver a linha ainda antiga e **sobrescrever** o cache de volta pro valor velho — não há nenhuma garantia de que o primeiro refetch pós-invalidate já reflita a própria escrita. Reproduzido em teste real (React Query real, só o repository mockado): com `listProjects` sempre devolvendo a linha antiga, o drawer ficava preso em "Planejado" mesmo com `updateProject` resolvido com sucesso.
- **Fix:** `updateMutation.onSuccess` agora escreve a linha devolvida pelo próprio `UPDATE ... .select().single()` (`projectsRepository.updateProject`, já confirmada pelo banco) direto no cache via `queryClient.setQueryData`, em vez de só invalidar. Elimina a dependência de um refetch pra refletir a própria escrita — a leitura de outras linhas (ex. entrar na tela pela primeira vez) continua vindo do fluxo normal de `useQuery`. Escopo do fix ficou restrito ao `updateMutation` (o `createMutation` não foi tocado — nenhum sintoma reportado ali, e o padrão de invalidate+refetch no create já é coberto pelos testes do G29/Fase B).
- **Testes novos:**
  - `useSupabaseProjects.test.ts` (novo arquivo — o hook nunca tinha teste dedicado; os consumidores mockam ele por inteiro): prova que `projects` reflete o status novo mesmo com `listProjects` sempre devolvendo a linha antiga, e que a atualização não mexe nas outras linhas do cache.
  - `ProjectsSection.g30-drawer-live-update.test.tsx` (novo arquivo — integração real: `ProjectsSection` + `ProjectDetailDrawer` + `useSupabaseProjects` reais, só `projectsRepository` mockado): prova que o badge do drawer aberto vira "Em andamento" sem fechar/reabrir, no mesmo cenário de refetch defasado.
  - Ambos os testes falham contra o código anterior ao fix (confirmado por reprodução antes de aplicar a correção) e passam depois.
- Detalhamento: [`etapa-5-flip-projetos-runbook.md`](../qa/etapa-5-flip-projetos-runbook.md) §3 (Caso 2 / Caso 4, bloqueava progresso recalculado no próprio drawer).

---

**G31 — Baseline de lint: `npm run lint` passa de 0 erros/29 warnings pra 0 erros/2 warnings (era 0/3, item 1 resolvido em rodada dedicada). Os 2 remanescentes NÃO são "sobra a corrigir depois" — cada um tem motivo registrado pra não virar zero. [BAIXO — baseline novo, registrado pra nenhuma lane futura "queimar" o #2 por engano]**
Achado durante a rodada `qualidade-lint-warnings-zero` — G30 fica reservado à Lane A (fix em voo no momento desta rodada, não colidir). Dos 29 warnings originais (todos `react-refresh/only-export-components` ou `react-hooks/exhaustive-deps`), 26 eram mecânicos (arquivo misturando export de componente com export de valor não-componente → extraído pra arquivo irmão; dependência de hook genuinamente morta ou de referência estável → ajustada) e foram corrigidos sem `eslint-disable` e sem mudança de comportamento em runtime — ver commit `0211532`/`a01d56c` pro detalhamento arquivo-a-arquivo. Dos 3 que ficaram de pé por decisão registrada, **1 foi resolvido numa rodada dedicada** (`whatsapp-bot-config-noderef-fix`), os outros 2 continuam abertos por motivo:

- **`WhatsAppBotConfig.tsx:178` — RESOLVIDO (rodada `whatsapp-bot-config-noderef-fix`).** Aplicado o padrão "latest ref" já proposto aqui: `nodesRef = useRef(nodes)` + `useEffect(() => { nodesRef.current = nodes }, [nodes])` (mesmo molde de `useTaskReminders.ts:22-23`, precedente já existente no código — não inventado). `loadSettings` passou a ler `nodesRef.current` em vez de `nodes` diretamente no fallback legado; `nodes` saiu do dep array do `useCallback`, warning resolvido sem `eslint-disable`. **Teste novo** (`WhatsAppBotConfig.test.tsx`) prova a garantia por montagem real: clicar numa opção do node de gatilho (edição real do fluxo) muda o estado (`setNodes`) mas **não** dispara um segundo `supabase.from("whatsapp_bot_settings")` — só o fetch da montagem conta. Verificado que o teste pega a regressão: revertendo temporariamente pro fix ingênuo (`nodes` direto no dep array, o que o eslint sugeriria) o teste falha exatamente na asserção de contagem de fetch (`expected 1, got 2`) — restaurado antes do commit.
- **`Financeiro.tsx:706`** (`useMemo` de sync de formulário com `open` "desnecessário") — `SupplierDialog` fica sempre montado (o `Dialog` só controla visibilidade via prop, não desmonta/remonta); `open` é o gatilho real de "resetar o formulário ao reabrir o diálogo com o mesmo `editing`". O lint está certo que `open` não é *lido* dentro do callback — está errado sobre a intenção: é dependência-como-gatilho, não dependência-de-dado. Remover quebraria o reset silenciosamente (form ficaria com lixo da sessão anterior ao reabrir). **Mantido de propósito**, não é candidato a fix mecânico nem prioridade de rodada dedicada — funciona hoje.
- **`useSupabaseOpportunityQuotes.test.tsx:44`** (`useEffect` com `hook.refresh` no dep array, falta `hook` inteiro) — **baseline PERMANENTE, nunca "corrigir".** Este teste existe especificamente pra reproduzir o padrão real de `LinkedQuotesSection.tsx` (incidente #2, Fatia 10 — `refresh` recriado a cada render + `useEffect` com `refresh` no dep array = loop infinito de rede, resolvido estabilizando a identidade de `refresh`). O `useEffect` de teste (linha 42-44, `useConsumerWithRefreshInDeps`) **precisa** usar exatamente `[opportunityId, hook.refresh]` — é o padrão de consumo que o teste prova não quebrar mais. Trocar por `[opportunityId, hook]` (o objeto inteiro) mudaria o que está sendo exercitado: `hook` é recriado a cada render (é o retorno de `useSupabaseOpportunityQuotes()`), então o efeito passaria a re-disparar sempre, mascarando exatamente a classe de regressão que este teste foi escrito pra pegar. **Se este warning um dia sumir da lista, é sinal de alerta, não de progresso** — investigar o que mudou no teste antes de comemorar.
- **Por que registrar isso agora:** os 2 remanescentes sobrevivem por *decisão*, não por *lacuna* — sem este registro, o próximo "queima os warnings restantes" trataria os 2 como pendência de faxina e corrigiria pelo manual do eslint, reintroduzindo o problema original que cada um evita (formulário sujo, teste cego a regressão). O item do `WhatsAppBotConfig` já provou que "decisão registrada" não é permanente por padrão — quando a correção certa aparece (aqui, um precedente já existente no código), ela sai da lista de decisão pra lista de resolvidos.

---

**G32 — Em modo `dataSource=local`, a tela de Projetos dispara uma request `GET` real pra `projects` na nuvem (PostgREST) — investigado e confirmado como design da casa, não vazamento. [BAIXO — confirmado, expectativa de runbook corrigida, nenhum código mudou]**
Achado na Fase D (homologação), Caso 3.2, do Pacote do Flip de `projects` (Etapa 5), BUILD `4c6bf7d`. Com `kora.projects.dataSource.v1="local"`, o carregamento de Portfolio → Projetos disparava `projects?select=*&workspace_id=eq...&deleted_at=is.null` (rede real, confirmado no Network tab). A tela exibia corretamente só os dados locais/demo — o achado era exclusivamente sobre a chamada de rede em si, não sobre o que era mostrado.

- **Investigação (protocolo — não corrigir antes de confirmar design vs. vazamento):**
  1. `useSupabaseProjects.ts:42` e `useSupabaseProjectsSummary.ts:14` (este último por trás de `useBifurcatedProjects.ts`, usado nos 4 consumidores fora da tela principal) usam `enabled: !!workspaceId` — **nunca** `enabled: dataSource === "supabase"`. A query React Query roda incondicional sempre que há workspace; só o `dataSource` decide qual dos dois resultados (`localProjects` vs. `supabaseProjects`) é lido/exibido (`ProjectsSection.tsx:69`, `useBifurcatedProjects.ts:43`).
  2. Precedente conferido nos dois domínios já flipados: `useSupabaseQuotes.ts:71` e `useSupabaseOpportunities.ts:34` usam exatamente o mesmo `enabled: !!workspaceId`. `QuotesSection.tsx:103` documenta isso em comentário — "os dois hooks acima rodam sempre; só um alimenta a tela por vez" — e `CRM.tsx:176` chama `useSupabaseOpportunities(...)` incondicionalmente, mesmo com `activeDataSource` podendo ser `"local"` (`CRM.tsx:168`).
- **Veredito: (a) — design da casa, não vazamento.** Os 3 domínios (`projects`, `quotes`, `CRM`) rodam os dois hooks (local + Supabase) em paralelo sempre; o gate é só de **leitura/exibição**, nunca de **fetch**. O §2.3 do runbook já documentava essa garantia do lado dos dados ("hooks correm em paralelo, só um é lido") — só não deixava explícito que isso inclui uma request de leitura real, o que criou a expectativa errada no Caso 3.2 original ("zero chamada de rede").
- **Nenhum código mudou.** O critério real em modo local nunca foi "nenhuma rede" — é **nenhuma escrita** (`INSERT`/`UPDATE`/`DELETE`) na nuvem e exibição 100% local. Caso 3 (§3.2) do runbook emendado pra refletir isso.
- Detalhamento: [`etapa-5-flip-projetos-runbook.md`](../qa/etapa-5-flip-projetos-runbook.md) §3 (Caso 3).

**G33 — "Gerar projeto" (Vendas → orçamento aprovado) ficava bloqueado em modo Supabase por `blockWrite()`, um gate fóssil de `quotes` que apontava pra um cutover de `projects` já concluído. [MÉDIO — confirmado e FECHADO, classe "gate fóssil cobrindo ação errada" (irmão do G29)]**
Achado na Fase D (homologação), Caso 5.2, do Pacote do Flip de `projects` (Etapa 5), BUILD `4c6bf7d`. Com `HOMOLOG-FLIP-quote` aprovada em modo Supabase, clicar "Gerar projeto" (atalho do menu ⋯ ou dentro do "Ver") disparava o toast "Edição de orçamentos no modo Supabase chega numa próxima fatia — volte para Local para editar" e nada acontecia. Contraste diagnóstico: criar/aprovar orçamento na nuvem funcionavam — só "Gerar projeto" caía no gate.

- **Quem gateia (`QuotesSection.tsx:122-126`, `blockWrite()`):** bloqueia incondicionalmente sempre que `dataSource === "supabase"` (sem checar nenhuma flag de escrita), e cobre só 2 call sites: `openReceivableDialog` (`:129`) e `openProjectDialog` (`:134`) — nunca cobriu o ciclo de vida da própria quote (criar/status/duplicar/excluir), que já tem caminho real desde a Fatia 10 item 8.
- **Precedente (`etapa-5-flip-quotes.md:156-162,178-180`):** decisão original (Fase A §4 da Fatia 10) — "Gerar recebível"/"Gerar projeto" ficam de fora do flip de `quotes` porque escrevem em OUTRO domínio (`finance`/`projects`); "só saem de carência quando uma fatia futura de cutover de `finance`/`projects` explicitamente decidir religar [...] ao caminho nuvem". Essa decisão fala de `CreateProjectFromQuoteDialog.tsx` (o fluxo embutido no CRM, `LinkedQuotesSection.tsx`, atrás da flag legada `quotesSupabaseCreateProject`) — um componente **diferente** do que a tela de Vendas realmente usa (`QuoteToProjectDialog.tsx`, atrás de `blockWrite()`, sem flag legada).
- **A fatia de cutover previamente esperada já aconteceu — só não coordenou com este gate.** O Pacote do Flip de `projects` (Fase A, `etapa-5-flip-projetos-pacote.md:44,220,247`) identificou `QuoteToProjectDialog.tsx` como **R5 — risco #1**: "grava só local, sem flag; se ficar 100% local depois que a tela principal virar Supabase-default, o projeto criado desaparece da visão do usuário imediatamente após criar". Fase B resolveu R5 (`QuoteToProjectDialog.tsx:158-174`, `mirrorCreateToSupabase`, padrão G22: local sempre autoritativo + espelho best-effort gated só pela flag de **projects**) e foi homologado nesse sentido (`etapa-5-flip-projetos-pacote.md:220`). Só que esse trabalho nunca tocou `QuotesSection.tsx` — o `blockWrite()` upstream continuou de pé, bloqueando o acesso ao fluxo que já tinha sido corrigido. Ao contrário de "Gerar conta a receber": `QuoteToReceivableDialog.tsx` (`:82-111`) só faz `fin.addTransaction` local, sem espelho nenhum — `finance` genuinamente não migrou ainda (Lane C só está na Fase A/inventário) — **esse continua bloqueado, corretamente**.
- **Fix (diff mínimo):** `openProjectDialog` não chama mais `blockWrite()` — `openReceivableDialog` inalterado. Banner de modo Supabase (`:394-416`) corrigido pra não anunciar mais "Gerar projeto ainda chega numa próxima fatia" (mesma classe de texto obsoleto do G29).
- **Testes novos** (`QuotesSection.test.tsx`, describe "G33"): atalho do menu ⋯ abre o diálogo de verdade sem toast de bloqueio; o mesmo pelo botão dentro do "Ver" (preview); "Gerar conta a receber" continua bloqueado (guarda de regressão — prova que o fix não alargou o gate além do pretendido). 2 dos 3 falham contra o código anterior ao fix (confirmado por reprodução antes de aplicar a correção).
- **Por que `QuoteToProjectDialog.test.tsx` não pegou isso:** renderiza o diálogo direto (`open` sempre `true`), nunca passando pelo `openProjectDialog`/`blockWrite()` de `QuotesSection.tsx` — prova que o diálogo em si está correto, mas nunca testou se dava pra alcançá-lo.
- Detalhamento: [`etapa-5-flip-projetos-runbook.md`](../qa/etapa-5-flip-projetos-runbook.md) §3 (Caso 5).

---

**G34 — `npm run dev` imprimia 2x "Warning: Invalid input options — For the 'jsx'" durante o scan de dependências (cache fria). [BAIXO — confirmado e FECHADO, causa: dependência desalinhada da versão do Vite]**
Achado de ambiente reportado pela Fase D (homologação), rodada `dev-hygiene-jsx-font-ports`. Reproduzido de forma determinística: limpar `node_modules/.vite` (força um scan frio) e subir `npm run dev` — o warning aparecia 2x, imediatamente antes de "[optimizer] bundling dependencies...".

- **Causa raiz:** `package.json` tinha `"vite": "^8.0.16"` mas `"@vitejs/plugin-react-swc": "^3.11.0"` — essa versão do plugin declara `peerDependencies: { vite: "^4 || ^5 || ^6 || ^7" }` (confirmado via `npm view`), **não cobre Vite 8**. O plugin passa uma opção de `esbuild`/transform (`jsx`) que a versão instalada do Vite 8 não reconhece mais nesse ponto da API — dependência desalinhada, não um bug de configuração do projeto.
- **Fix:** `@vitejs/plugin-react-swc` atualizado pra `^4.3.3` (`peerDependencies: { vite: "^4 || ^5 || ^6 || ^7 || ^8" }` — cobre Vite 8 explicitamente). Nenhuma mudança de API usada pelo projeto (`plugins: [react()]` em `vite.config.ts`, uso trivial, não afetado por breaking changes entre major versions do plugin).
- **Verificado 2x, cache fria (`rm -rf node_modules/.vite` + restart) em ambos os testes:** warning não reaparece; o optimizer roda normalmente (cache de deps populada) sem a mensagem de opção inválida.

---

**G35 — Fonte Google (`Inter`) 404 intermitente — carregada via `@import url()` dentro de `src/index.css`, um anti-padrão de performance/confiabilidade documentado pelo próprio Google Fonts. [BAIXO — mitigado, causa exata do 404 pontual não reproduzida, mas a classe de risco (waterfall serial, sem preconnect) eliminada]**
Achado de ambiente reportado pela Fase D, mesma rodada do G34. Não foi possível reproduzir o 404 específico via ferramenta de automação desta sessão (o monitor de rede usado não captura sub-requests disparados por `@font-face` dentro de CSS, só requests JS/navegação) — tratado como achado real da Fase D (observado ao vivo pelo operador), não descartado por falta de reprodução própria.

- **O que existia:** `src/index.css:1-2` — 2 linhas `@import url('https://fonts.googleapis.com/css2?family=...')` (Inter; Andika+Comic Neue) no topo do arquivo CSS. `@import` em CSS é **render-blocking e serial**: o browser precisa buscar+parsear `index.css`, só então descobre o `@import`, só então busca o CSS do Google Fonts, só então descobre as URLs de `fonts.gstatic.com` pra buscar os arquivos `.woff2` — 3 round-trips em cadeia antes da fonte estar disponível, sem nenhum `preconnect` paralelizando DNS/TLS. É exatamente o padrão que a própria documentação do Google Fonts recomenda evitar (recomendação oficial: `<link>` no `<head>` do HTML, não `@import` em CSS).
- **Confirmado que a API/CDN do Google está saudável hoje** (`curl` direto em `fonts.googleapis.com`/`fonts.gstatic.com` devolveu `200` limpo) — não é uma fonte descontinuada nem uma URL hardcoded quebrada no repositório (busca exaustiva por `gstatic`/`googleapis` em `src/`/`index.html`/`public/` só encontrou as 2 linhas de `@import`, nenhuma URL fixa de arquivo `.woff2`).
- **Fix:** as 2 linhas `@import` removidas de `src/index.css`; substituídas por `<link rel="preconnect">` (`fonts.googleapis.com` e `fonts.gstatic.com`, este com `crossorigin`) + um único `<link rel="stylesheet">` combinando as 3 famílias (Inter + Andika + Comic Neue) num só request, no `<head>` de `index.html`. Reduz de 2 imports seriais em cadeia pra 1 request direto com DNS/TLS pré-aquecido.
- **Verificação visual (BUILD banner conferido antes, §17; porta conferida livre pra esta sessão — ver G36):** `document.fonts` inspecionado via console — `Inter` (pesos 400/500/600/700, os usados nesta página) com `status: "loaded"`; `getComputedStyle(document.body).fontFamily` → `"Inter, sans-serif"`. Tipografia não regrediu.
- **Sem precedente de fonte self-hospedada no projeto** (`find` por `*font*` fora de `node_modules` não achou nada) — não introduzida agora; seria mudança maior que "fix mínimo" pede, fica pra decisão de produto futura se o `<link>`+preconnect não for suficiente.

---

**G36 — Porta de dev server ocupada por outra lane mascarada como sucesso silencioso — Vite sobe na próxima porta livre sem aviso destacado; só o BUILD banner (§17) expôs a discrepância. [BAIXO — sem código a corrigir, formalizado como emenda de processo]**
Achado durante a verificação visual do UX2 (`ux2-g21-g23-g25-fase-a`) e reconfirmado nesta rodada (`dev-hygiene-jsx-font-ports`) — `localhost:8080` respondendo não provava nada sobre qual branch estava sendo servida; nas duas ocasiões era o dev server de **outra** worktree/lane, e o servidor desta sessão subiu silenciosamente em `8081` (mensagem "Port 8080 is in use, trying another one..." presente no log, mas fácil de não notar). Nenhum código do app está envolvido — é puramente uma lição de operação de sessões paralelas.

- **Registrado como emenda permanente** do protocolo de homologação: [`protocolo-homologacao.md` §20](../qa/protocolo-homologacao.md#20-emenda-2026-08-13--porta-de-dev-server-nunca-identifica-o-código-servido-só-o-build-banner-§17-identifica).
- **Núcleo da regra:** porta nunca prova qual código está sendo servido — só o `BUILD <hash> (<branch>)` do console prova (§17). Checar se a porta esperada já está ocupada antes de assumir; se o servidor subir noutra porta, apontar o navegador pra ela explicitamente.
- **Aviso explícito registrado (para não virar "correção" errada no futuro):** **não** fixar portas diferentes por lane/worktree como forma de "resolver" isso. Porta faz parte da origem do `localStorage` do navegador (mesma classe de fato já coberta no §17 item 4, "troca de servidor reseta flags/dados locais") — pinar portas por lane prenderia o histórico de homologação de cada lane à porta, não à branch/worktree, quebrando continuidade de estado local entre sessões. Porta variável é incômoda, mas portas fixas por lane seriam um problema pior.

---

**G37 — `mirrorProjectToSupabase` espelhava um projeto empobrecido: `source`/`quote_id`/`deliverables` perdidos sempre que o projeto vem de uma quote NATIVA DA NUVEM. [MÉDIO — confirmado e FECHADO, classe "espelho com payload incompleto — perda de fidelidade local→nuvem"]**
Achado na Fase D (homologação), Caso 5.2, do Pacote do Flip de `projects` (Etapa 5), BUILD `6aad157` — logo depois do G33 destravar "Gerar projeto". Diálogo abriu, toast de sucesso, card apareceu na lista Supabase — mas a linha real: `title=HOMOLOG-FLIP-projeto-B, status=planning, source="manual", quote_id=null, client_id=null, budget=250, deliverables=[]`. O projeto LOCAL tinha `source="orçamento"`, `quoteId` do `HOMOLOG-FLIP-quote`, 2 deliverables (toggle "criar marcos" ligado). `client_id=null` bateu com o esperado — a quote foi criada com nome livre, sem cliente real selecionado.

- **Causa raiz #1 (`quote_id`/`source`, `projectsMapper.ts`, `resolveProjectFk`):** `QuoteToProjectDialog.tsx` passa `quoteId: quote.id` direto pro `addProject` local. Em modo Supabase, `quote.id` **já é o uuid real** de `public.quotes` — `mapSupabaseQuoteToLocalQuote` (`quoteMapper.ts:157`) faz `id: sq.id`, sem cast/tradução nenhuma (diferente de `clientId`/`opportunityId` da própria `Quote`, que a leitura nem restaura — ver achado à parte abaixo). `resolveProjectFk` tratava TODO `quoteId` como id LOCAL a traduzir via import-map (`kora.quotes.supabaseImport.v1`) — um uuid que nunca passou por import nunca aparece nesse mapa, então o lookup sempre voltava `null`. `source` "manual" foi **consequência**, não uma causa separada: `resolveCloudProjectSource` já estava correto (`source==="orçamento" && resolvedQuoteId ? "quote" : "manual"`), só recebia `resolvedQuoteId=null` por causa do bug acima.
- **Causa raiz #2 (`deliverables`, `projectsMapper.ts`, `mapLocalProjectToSupabase`):** campo simplesmente nunca fez parte do payload retornado — nem na interface `SupabaseProjectImportPayload`, nem no objeto montado. A coluna existe desde a migration `20260811000100` (`deliverables jsonb NOT NULL DEFAULT '[]'::jsonb`) e a LEITURA (`mapSupabaseProjectToLocal`) sempre a consumiu — só a escrita esquecia, então todo espelho gravava `[]` por omissão (o DEFAULT da coluna cobrindo o silêncio).
- **Fix (`projectsMapper.ts`, diff mínimo):**
  1. `resolveProjectFk` ganhou uma exceção: se o `localId` recebido já é um uuid válido (regex de formato), passa direto — nunca procura no import-map. Aplicada uniformemente aos 3 FKs (`client_id`/`quote_id`/`opportunity_id`) porque a mesma ambiguidade existe estruturalmente pra `client_id`/`opportunity_id` (`useClientsDataSource.ts:9` faz o mesmo cast uuid→number pra clientes já 100% Supabase) — sem caminho de UI ativo exercitando isso hoje (ver achado #3 abaixo), mas a mesma regra corrige os 3 de uma vez, sem custo.
  2. `mapLocalProjectToSupabase` passou a incluir `deliverables: project.deliverables ?? []` no payload.
- **Achado #3 (documentado, NÃO corrigido — fora do escopo deste diff):** `client_id` ficou `null` corretamente nesta homologação porque a quote genuinamente não tem cliente vinculado — mas há um gap estrutural mais profundo: `mapSupabaseQuoteToLocalQuote` (`quoteMapper.ts:152-182`) **nunca restaura `clientId`/`opportunityId`** ao ler uma quote da nuvem (só `clientName`, desnormalizado) — mesmo quando a linha em `public.quotes` tem um `client_id` real. Significa que `QuoteToProjectDialog.tsx`, operando sobre uma quote lida da nuvem, **nunca consegue** produzir um `client_id` vinculado no projeto espelhado, mesmo pra quotes que têm cliente real — é uma lacuna do lado da LEITURA de `quotes` (domínio diferente, fatia diferente), não deste mapper. Registrado aqui como achado relacionado, sem fix — não inventar migration/mudança em `quoteMapper.ts` fora do pedido desta rodada.
- **Impacto na ficha do cliente (Casos 5.4-5.6):** `useDayCenterData.ts`/`ClientProfileDrawer.tsx`/`ClientActivitiesTab.tsx` casam projeto↔cliente por `p.clientId === client.id || p.clientName === client.name` (ou `matchesByName`). Pós-fix, `mapSupabaseProjectToLocal` ainda deriva `clientName` **só** de `client_id` (`clientNameById[sp.client_id]`) — sem coluna denormalizada de nome em `projects` (diferente de `quotes`). Como `client_id` de `HOMOLOG-FLIP-projeto-B` permanece `null` (achado #3, não é bug deste fix), **a ficha do cliente `HOMOLOG-FLIP-cliente` NÃO vai casar este projeto por nenhum dos dois critérios** — nem por id (ausente) nem por nome (`clientName` fica `""`). Não é regressão do G37; é consequência de a quote de origem nunca ter tido um cliente real selecionado. Pra homologar 5.4-5.6 de verdade, a quote/projeto de teste precisa de um cliente vinculado via seletor real (não nome livre).
- **Remediação da linha já gravada (`HOMOLOG-FLIP-projeto-B` empobrecida):** soft-delete (`UPDATE public.projects SET deleted_at = now() WHERE title = 'HOMOLOG-FLIP-projeto-B'` — mesma coluna que `listProjects()` já filtra, `softDeleteProject` já implementado embora sem UI, O9) **+ regenerar clicando "Gerar projeto" de novo na mesma quote**. Seguro e suficiente: (a) soft-delete é reversível, sem cascata — nenhuma task local referencia esse id (nunca foi importado localmente); (b) a linha antiga tem `quote_id=null`, então nunca colide com `findProjectByQuote` da nova tentativa (que busca pelo uuid real) — sem o soft-delete, ficaria como órfão duplicado, não sobrescrito; (c) regenerar cria um projeto LOCAL novo (`Date.now()`-based id) → novo `source_local_id` → `importProject` roteia pro branch quote-linked (`isQuoteLinkedProject` agora `true`, pós-fix) → insert novo com o payload completo. **Não resolve o achado #3** (client_id continua null com a mesma quote) — só corrige `source`/`quote_id`/`deliverables`.
- **Testes novos** (`projectsMapper.test.ts`): `resolveProjectFk` passa uuid direto sem consultar o map (e confirma que string-não-uuid continua tratada como id local, comportamento inalterado); `mapLocalProjectToSupabase` com quoteId=uuid e maps vazio resolve `quote_id`/`source`/`deliverables` corretos (reprodução exata do Caso 5.2); `deliverables` ausente vira `[]`, nunca `undefined`. 3 dos 4 falham contra o código anterior ao fix (confirmado por reprodução antes de aplicar a correção).
- Detalhamento: [`etapa-5-flip-projetos-runbook.md`](../qa/etapa-5-flip-projetos-runbook.md) §3 (Caso 5.2).

---

**G38 — Filtro "Ativos" de Clientes mostrava cliente arquivado em modo Supabase — `mapSupabaseClientToLocalClient` nunca lia a coluna `archived` do banco. [MÉDIO — confirmado e FECHADO, classe "campo opcional omitido no mapper — filtro correto, dado incompleto"]**
Achado ao vivo na Fase D (homologação de Tarefas/backlog de UI): arquivar um cliente em modo Supabase disparou o toast de sucesso e o contador "Ativos" caiu pra 0 — mas a lista sob o filtro "Ativos" continuou mostrando o cliente arquivado, discordando do próprio contador na mesma tela.

- **O filtro em si estava certo:** `Clientes.tsx:344-345` já checa `c.archived` corretamente (`if (!showArchived && c.archived) return false`). O bug não é de lógica de filtro — é de dado: `mapSupabaseClientToLocalClient` (`useClientsDataSource.ts:7-41`) mapeia todos os campos da linha do Supabase **exceto `archived`** — o campo simplesmente não aparecia no objeto literal retornado. Como `Client.archived` é opcional (`archived?: boolean`, `types/domain.ts:162`), isso nunca deu erro de `tsc` — o campo só ficava `undefined` silenciosamente, e `!showArchived && undefined` nunca é `true`, então o filtro nunca excluía ninguém, não importa o valor real gravado no banco.
- **Confirmado que o banco recebe o valor certo:** `clientsRepository.archiveClient` (`:83-86`) já fazia `.update({ archived })` corretamente — a escrita nunca foi o problema, só a leitura de volta pro estado local.
- **Fix (diff de 1 linha):** `mapSupabaseClientToLocalClient` passou a incluir `archived: !!s.archived`.
- **Testes novos** (`useClientsDataSource.test.ts`, novo arquivo): mapeia `archived: true`/`archived: false` de uma linha simulada do Supabase, confirma que nenhum dos dois vira `undefined`. Ambos falham contra o código anterior ao fix (confirmado por reprodução antes de aplicar a correção).

---

**G39 — Filtro "Todos status" de Projetos incluía projeto arquivado — mesmo padrão já resolvido em Quotes, nunca replicado em Projects. [MÉDIO — confirmado e FECHADO, classe "filtro 'todos' não exclui estado terminal — irmão do G29"]**
Achado por leitura no sign-off da Fase D de Projetos: `ProjectsSection.tsx:110` só excluía por status quando `filterStatus !== "all"` — sob "Todos status" (o filtro default), nada excluía `status === "archived"`. Contraste direto com `QuotesSection.tsx:236`, que já exclui `"arquivado"` explicitamente sob `filterStatus === "all"` e só mostra arquivados quando o filtro de status é `"arquivado"` de propósito — o padrão certo já existia no código, só nunca foi replicado pra Projetos.

- **Verificação (item 3 do pacote) — é o MESMO defeito, não um distinto:** o achado da homologação ("HOMOLOG-FLIP-projeto-A" apareceu na lista principal com badge "Arquivado" mesmo sob "Todos status") usa o único caminho de renderização de `ProjectsSection.tsx` — confirmado por grep que existe **um único** `filtered.map(...)` na tela (`:354`), sem view alternativa (kanban/lista) com lógica de filtro própria. A causa é a mesma `filtered` corrigida abaixo; não há um segundo defeito a catalogar separadamente.
- **Fix (diff de 1 linha, mesmo padrão de `QuotesSection.tsx:236`):** `filtered` (`ProjectsSection.tsx`) ganhou `if (filterStatus === "all" && p.status === "archived") return false;` antes da checagem de filtro específico — arquivado continua acessível selecionando "Arquivado" explicitamente no mesmo `<Select>` (já era uma opção válida via `PROJECT_STATUS_LABEL`, só a exclusão do "all" faltava).
- **Fora de escopo, sinalizado sem corrigir:** o KPI "Total" (`metrics.total = projects.length`, `ProjectsSection.tsx:126`) continua contando projetos arquivados — é uma métrica separada (card de resumo, não a lista/filtro), não mencionada no achado original da Fase D. Não alterado nesta rodada; candidato a checagem numa rodada futura se o mesmo padrão de "total deveria excluir arquivado" for confirmado como intencional em Quotes.
- **Addendum (rodada seguinte, backlog de UI Fase D — mesma leva do G44):** confirmado o padrão em `QuotesSection.tsx` — nenhuma KPI de lá conta "arquivado" (todas são filtros de status específico que o excluem estruturalmente, nenhuma soma `quotes.length` cru). Card "Total" de Projetos alinhado ao mesmo padrão: `metrics.total` passou de `projects.length` pra `projects.filter((p) => p.status !== "archived").length` — mesmo critério da lista sob "Todos status" logo acima, os dois lugares agora concordam. Diff de 1 linha (`ProjectsSection.tsx:126`). Teste novo (`ProjectsSection.test.tsx`, describe "G44 — KPI \"Total\""): card mostra `1` (não `2`) com 1 projeto ativo + 1 arquivado; falha contra o código anterior ao fix (confirmado por reprodução).
- **Testes novos** (`ProjectsSection.test.tsx`, describe "Fase D"): projeto arquivado fica de fora sob "Todos status"; projeto arquivado aparece ao selecionar "Arquivado" explicitamente no filtro (prova que a exclusão é só do "all", não um bloqueio geral). Ambos falham contra o código anterior ao fix (confirmado por reprodução antes de aplicar a correção).

---

**G40 — R1 (Tarefas): `updateTaskStatus` só aceitava `todo`/`in_progress`/`done` (3 valores, inglês) — sem "revisão", o 4º valor real do vocabulário local — e a UI de transição de status silenciosamente enviava string vazia ao tentar selecioná-la. [MÉDIO — confirmado e FECHADO, classe "equivalente-O12: vocabulário cloud incompleto perde um estado local" — risco ARMADO, não disparando (2 flags default OFF)]**
Achado durante a mitigação cirúrgica do R1 catalogado em `etapa-5-flip-tarefas-fase-a.md` §4, aprofundado por `docs/qa/tarefas-r2-auditoria.md` (Lane B) — **não** o flip de Tarefas (fora de escopo), só a contenção do risco enquanto o flip real não vem. Nota do revisor confirmada contra o código: `updateTaskStatus` está atrás de **2 flags default OFF** (`supabaseOperationalDashboard` + `tasksSupabaseStatusTransition`, ambas exigidas simultaneamente) — o risco é **armado, não disparando** hoje; o fix de vocabulário segue valendo, só a urgência muda (não é um vermelho de produção).

- **Caminho exato do R1:** `tasksRepository.updateTaskStatus` (`tasksRepository.ts:78`, antes do fix) — assinatura `status: "todo" | "in_progress" | "done"`. Chamador único: `useSupabaseProjectTasks.updateStatus` (`:20-29`) → `SupabaseOperationalDashboardCard.tsx` (`ProjectTasksList`, dropdown de status, gated pelas 2 flags acima). `public.tasks.status` é `TEXT` livre, **sem CHECK constraint** (`20260601040000_create_tasks_schema.sql`, confirmado no próprio `tarefas-r2-auditoria.md` §1.4/§2) — não precisa de migration pra caber o 4º valor.
- **Cenário concreto de perda (antes do fix):** o `<select>` só tinha 3 `<option>` (`todo`/`in_progress`/`done`). Uma tarefa já em `"revisao"` (vinda de `importTask`, o único caminho de escrita sem flag, ativo hoje) aparecia com o `value` do `<select>` **sem casar nenhuma opção** (fallback pro próprio `task.status`, string que não existe na lista) — e se alguém tentasse "corrigir" selecionando manualmente, `handleStatusChange` recebia o valor cru do evento; como não havia `<option value="revisao">`, o browser nunca oferecia essa seleção, e forçar via automação (`fireEvent.change`) prova que o handler aceita e propaga **string vazia** pro `updateStatus` — write silenciosamente errado, sem toast de erro nenhum.
- **Achado adicional, mesma raiz (badge read-only):** com `transitionEnabled=false` (o estado real hoje, flags OFF), o badge de status também tinha um bug simétrico: a cadeia de ternários `task.status === "todo" ? ... : task.status === "in_progress" ? ... : task.status === "revisao" ? ... : "Concluído"` fazia QUALQUER status que não fosse um desses 3 cair no fallback `"Concluído"` — incluindo `"a_fazer"`/`"em_andamento"` (os valores REAIS que `importTask` grava, confirmado por `mapLocalTaskToSupabase`/`tasksMapper.ts`, que já documenta "sem tradução de vocabulário"). Uma tarefa recém-importada como "a fazer" apareceria com o badge **verde "Concluído"** — o oposto do que era, mascarado silenciosamente.
- **Causa raiz de fundo:** o comentário no topo de `tasksMapper.ts` já documentava a decisão arquitetural — `status`/`priority` são "passagem direta, SEM tradução de vocabulário" (diferente de `source` em `projects`, que tem o par `resolveCloudProjectSource`/O12). Ou seja, o vocabulário OFICIAL de `public.tasks.status` sempre foi o local (português, 4 valores) — é o que `importTask` já grava verbatim. `updateTaskStatus`/o dropdown nunca seguiram esse contrato, falando um dialeto próprio (inglês, 3 valores) que diverge do que o resto do sistema já escreve.
- **Fix (mesmo molde do O12, adaptado — não é uma tradução NOVA, é alinhamento ao contrato já documentado):** `projectsMapper.ts` resolveu O12 com um PAR de funções de tradução (`translateLocalProjectStatusToCloud`/`translateCloudProjectStatusToLocal`) porque local e cloud genuinamente precisavam de vocabulários DIFERENTES (archived como boolean separado). Aqui não — o cloud já deveria falar o MESMO vocabulário que o local, então o fix é mais simples: `updateTaskStatus` (`tasksRepository.ts`) passou a aceitar os 4 valores locais (`a_fazer`/`em_andamento`/`revisao`/`concluido`), e o dropdown/badge de `SupabaseOperationalDashboardCard.tsx` passaram a usar esse mesmo vocabulário, com 2 novas funções em `tasksMapper.ts` (mesma camada onde o mapper de `projects` guarda sua lógica de tradução, `src/services/tasks/tasksMapper.ts`): `CloudTaskStatus` (tipo, exportado, usado por `tasksRepository.ts`/`useSupabaseProjectTasks.ts`/o componente, sem repetir a union 3x) e `normalizeCloudTaskStatus` (aceita os 3 valores legados em inglês como alias — proteção de leitura só, caso alguém já tenha ligado as flags antes deste fix; nunca inventa um valor, nunca mascara um desconhecido como "concluído", mesma disciplina de `cloudStatusRaw` em `quotes`/`projects`).
- **Zero migration necessária** — coluna já era `TEXT` livre, confirmado no início da investigação antes de tocar qualquer código (protocolo: banco é gate do operador, migration só seria proposta se fosse preciso).
- **Testes novos, fail→fix→pass:**
  - `tasksMapper.test.ts`: `normalizeCloudTaskStatus` — os 4 valores locais passam intocados; os 3 legados em inglês viram o equivalente local; desconhecido passa intocado.
  - `tasksRepository.test.ts`: `updateTaskStatus` grava cada um dos 4 valores verbatim no `UPDATE` (round-trip, `it.each`).
  - `SupabaseOperationalDashboardCard.test.tsx` (novo describe): dropdown oferece as 4 opções incluindo "Revisão"; tarefa já em `"revisao"` aparece selecionada (não em branco); selecionar "Revisão" chama `updateStatus(taskId, "revisao")`. **Os 3 falham contra o código anterior** — confirmado por reprodução: a asserção mais reveladora mostrou que selecionar "Revisão" no dropdown antigo enviava `updateStatus("tk-1", "")` (string vazia), não um erro visível — a perda era silenciosa.
- Detalhamento: `docs/qa/tarefas-r2-auditoria.md` (contexto da contenção das 2 flags, decisão do revisor de 14/ago/2026: contenção (a) adotada), `docs/architecture/etapa-5-flip-tarefas-fase-a.md` §4 (R1 original).

---

**G41 — Financeiro: os 2 diálogos de "gerar recebível" (`CreateReceivableDialog` no CRM, `QuoteToReceivableDialog` em Vendas). A divergência documentada em `etapa-5-fatia-6-finance.md` §9 (espelho vs. sem espelho) já está RESOLVIDA (G22); a divergência real hoje é de CAMPO, não de destino. [MÉDIO — 1 achado mecânico FECHADO (quoteId ausente); 3 achados de decisão de produto, catalogados sem corrigir]**
Achado ao confirmar contra o código o inventário de Financeiro (`etapa-5-flip-financeiro-fase-a.md` §item 3, "2 diálogos de escrita inconsistentes"), que aponta pro diagnóstico de `etapa-5-fatia-6-finance.md` §9 — escrito **antes** do G22 (dashboard-g22-fix) mudar o comportamento de `CreateReceivableDialog.tsx`.

- **O que §9 diagnosticou (histórico, já não é mais verdade):** na época, `CreateReceivableDialog` gravava **só** na nuvem (invisível em `Financeiro.tsx`, que só lê local) enquanto `QuoteToReceivableDialog` gravava só local (visível). Recomendação registrada: opção (b), fazer `CreateReceivableDialog` também gravar local. **G22 já implementou isso** (dual-write: local sempre + espelho nuvem best-effort) — confirmado lendo o código atual (`CreateReceivableDialog.tsx:90-125`), não só o comentário. A invisibilidade que §9 descrevia **não existe mais**; ambos os diálogos hoje gravam local, ambos aparecem em Financeiro. Esta rodada fecha esse ciclo: a recomendação de §9 foi cumprida por outro achado (G22), sem nenhum doc dizendo isso explicitamente até agora.
- **Divergência real hoje, achada nesta rodada (comparação campo-a-campo dos dois `fin.addTransaction(...)`):**

| Campo gravado localmente | `QuoteToReceivableDialog.tsx` (Vendas) | `CreateReceivableDialog.tsx` (CRM) | Classe |
|---|---|---|---|
| `quoteId` | `quote.id` (repassado) | **ausente** — recebido como prop (`quoteId: string`), usado só no espelho nuvem (`:112`), nunca no `addTransaction` local | **Mecânico — FECHADO nesta rodada** |
| `clientId` | `quote.clientId` (`number`, local) | **ausente** — prop `clientId` é uuid da nuvem (`string \| null`), espaço de id diferente de `Transaction.clientId: number` | Decisão de produto — ver abaixo |
| `opportunityId` | `quote.opportunityId` (`number`, local) | **ausente** — mesmo motivo de `clientId` (prop é uuid nuvem, campo local é `number`) | Decisão de produto — ver abaixo |
| `clientName` | `quote.clientName` (string, já disponível) | **ausente** — componente não recebe esse prop hoje, exigiria buscar o nome a partir do uuid | Decisão de produto — ver abaixo |
| `category` | seletor do usuário (`<Select>`, categorias de `fin.categories`) | hardcoded `"Serviços"` | Decisão de produto — ver abaixo |
| `paymentMethod` | seletor do usuário (`<Select>`, 6 opções) | hardcoded `"pix"` | Decisão de produto — ver abaixo |

- **Por que só `quoteId` é mecânico:** mesmo tipo (`Transaction.quoteId: string`, sem distinção de espaço de id — confirmado que `QuoteToReceivableDialog` já passa `quote.id` puro, seja local ou uuid de nuvem, sem tradução), e o valor já existe como prop do componente (`quoteId`, usado no espelho). É literalmente "esquecido de repassar pro outro lugar que já recebe o mesmo dado" — sem ambiguidade de design.
- **Por que `clientId`/`opportunityId` NÃO são mecânicos:** `Transaction.clientId`/`opportunityId` são tipados `number` (espaço de id LOCAL); as props do diálogo (`clientId`/`opportunityId`) são uuids de nuvem (`string`). Preencher um `number` com um uuid exigiria uma tradução reversa (uuid nuvem → id local), que dependeria de um mapa reverso do import-map (`kora.clients.supabaseImport.v1` só mapeia local→nuvem hoje) — não existe hoje, e criar um é decisão de arquitetura, não um alinhamento de 1 linha. **Consequência prática, não corrigida:** um recebível gerado via CRM não aparece na aba de atividades do cliente (`ClientActivitiesTab.tsx:270-271`, que casa por `t.clientId === client.id || matchesByName(t.clientName)`) — sem `clientId` NEM `clientName`, nenhum dos dois critérios casa. Gap real, mas fora do escopo "mecânico" desta rodada.
- **Por que `category`/`paymentMethod` hardcoded é decisão, não bug:** `CreateReceivableDialog` é acionado a partir de um contexto (CRM, orçamento aprovado) onde reduzir a fricção pode ser deliberado — diferente de "mesmo dado divergindo por descuido", é uma escolha de quanto controle dar ao usuário em cada fluxo. Não há evidência (comentário, doc, commit) de que os hardcodes foram um esquecimento; tratado como decisão de produto existente, não revertida sem pedido explícito.
- **Proposta, não implementada:** se um dia fizer sentido dar ao CRM o mesmo nível de controle que Vendas tem, os seletores de `QuoteToReceivableDialog` (`category`/`paymentMethod`) podem ser copiados diretamente — mesmo componente `<Select>`, mesma fonte de dados (`fin.categories`). Resolver `clientId`/`opportunityId` exigiria decidir se vale a pena construir um mapa reverso uuid→local só para isso, ou se o gap de `ClientActivitiesTab` é aceito como dívida (mesma classe dos gaps já catalogados em Tarefas/Financeiro na Fase A).
- **Fix aplicado (só `quoteId`):** `CreateReceivableDialog.tsx` — `addTransaction({ ..., quoteId, ... })`, 1 linha.
- **Teste novo** (`CreateReceivableDialog.test.tsx`, describe "G41"): `addTransaction` (local) é chamado com `quoteId` igual ao prop recebido. Falha contra o código anterior ao fix (confirmado por reprodução antes de corrigir).
- **Coordenação com `docs/qa/etapa-5-flip-financeiro-pacote.md` (Lane C, desenho da Fase B do flip de Financeiro):** o pacote da C (§5.1) desenha a unificação dos 2 diálogos como "`QuoteToReceivableDialog` ganha o espelho G22" — isso é exatamente o gap que esta rodada deixou intocado (ver tabela acima: `clientId`/`opportunityId`/`clientName`/`category`/`paymentMethod` seguem catalogados sem fix, e nenhuma edição foi feita em `QuoteToReceivableDialog.tsx`). O fix de `quoteId` aqui é ortogonal ao espelho: toca só o `addTransaction` LOCAL de `CreateReceivableDialog.tsx`, não o mirror `financeRepository.createReceivableFromQuote` (que já recebia `quoteId` mesmo antes deste fix, via prop direta — `:112-113`). A afirmação da C de que `CreateReceivableDialog` "já produz linhas no formato certo" (§5.1) é sobre o formato da linha do lado NUVEM (o que a leitura Supabase-default vai ler de volta) e continua válida — não é contradita por este achado, que é sobre um campo do lado LOCAL fora do escopo daquela frase. Sem conflito de escopo com a Fase B da C; esta entrada fica como pré-requisito de leitura pra quando a C avançar o §5.1.

---

**G44 — Vendas: `NewQuoteWizard` (`QuotesSection.tsx`) só aceitava nome livre de cliente, nunca oferecia seleção de um cliente cadastrado nem vinculava `clientId` — quote sem `clientId` gerava projeto sem `clientId` (ficha do cliente cega, gap vivido e contornado por SQL na homologação; catalogado no G37/G41). [MÉDIO — confirmado e FECHADO, classe "tela nunca alimentou um mecanismo de espelho que já existia pronto"]**
Achado da Fase D de Projetos, repassado pra esta rodada. Confirmado por leitura: `NewQuoteWizard` (`QuotesSection.tsx:761-762`) lia `clientId` só via match exato de string contra `useClients()` (sempre local, `orbyt.clients.v1`) — um `<input list="quote-clients">` com datalist, nunca um seletor de verdade, e nunca ciente de clientes da nuvem.

- **Precedente de seletor de cliente existente já no app:** `WhatsAppContactPanel.tsx:702-750` ("Vincular cliente" — busca + lista filtrada + clique pra selecionar + fallback "Criar novo"), mas esse busca direto no Supabase (`.limit(15)`, sem lista local pré-carregada) — padrão pesado demais pra esta tela, que já tem a lista inteira de clientes disponível client-side. Precedente mais direto e leve: `useClientsDataSource()` (`useClientsDataSource.ts`), o mesmo hook bifurcado já usado em `Financeiro.tsx`/`CRM.tsx`/`Clientes.tsx`/`ProjectsSection.tsx` — devolve `Client[]` local OU nuvem (conforme o seletor de fonte de Clientes), já no formato que o resto do app consome, incluindo o cast documentado `id: s.id as unknown as number` (`useClientsDataSource.ts:9`) que "contrabandeia" um uuid de nuvem como `number` — mesmo padrão que `resolveProjectFk`/G37 já sabe resolver (ver abaixo).
- **Fix:** `NewQuoteWizard` trocou `useClients()` por `useClientsDataSource()` (1 linha) + um `<Select>` aditivo ("Cliente existente (opcional)") acima do campo de texto livre já existente, listando `clients` com opção sentinela "— Cliente novo (digitar abaixo) —". Selecionar um cliente preenche `clientId`/`clientName`/`company`/`clientEmail`/`clientWhatsapp` (mesmos campos que o datalist já preenchia por match de nome) — o campo de texto livre e seu datalist **não foram tocados**, continuam funcionando exatamente como antes pra quem digita um cliente novo.
- **Por que a cadeia até o projeto já funcionava sem precisar de fix lá:** `QuoteToProjectDialog.tsx:102` já repassa `clientId: quote.clientId` cru pro `addProject`; o mapper do espelho (`projectsMapper.ts`, `resolveProjectFk`, G37) já sabe passar um uuid direto sem tradução quando `looksLikeUuid(localId)` bate (`projectsMapper.ts:56-73`, testado desde G37 — `projectsMapper.test.ts:70-73`). Essa ambiguidade "client_id pode já ser um uuid nuvem contrabandeado como number" foi resolvida genericamente pelo G37 **antes** de existir qualquer caminho de UI que a exercitasse pra client_id (comentário do próprio mapper já dizia isso, `projectsMapper.ts:52-54`) — esta rodada é a primeira a alimentar esse caminho de verdade.
- **Testes novos:**
  - `QuotesSection.test.tsx` (describe "G44"): (1) selecionar cliente existente no dropdown grava `clientId` real igual ao id do cliente escolhido — falha contra o código anterior (sem `<Select>`, `findAllByText` nunca resolve) e passa depois; (2) nome livre sem seleção continua salvando com `clientId: undefined` — regressão zero (passa nos dois lados, prova que nada quebrou).
  - `QuoteToProjectDialog.test.tsx` (describe "G44 — clientId da quote sobrevive até o projeto"): quote com `clientId` uuid → `addProject` recebe o MESMO `clientId`; quote sem `clientId` → `addProject` recebe `undefined`, nunca um id inventado. **Não precisou de fix neste arquivo** — tranca um contrato que já existia (G37), fecha o loop de ponta a ponta que só faltava uma tela alimentar.
- **Não implementado, fora de escopo:** a busca é uma lista simples (`<Select>` com todos os clientes) — sem campo de busca com filtro por texto dentro do dropdown. Aceitável hoje (workspaces pequenos); se a lista de clientes crescer muito, um combobox com filtro (mesmo padrão de busca do `WhatsAppContactPanel.tsx`) vira candidato a upgrade.

---

**G48 — nó "Transbordo Humano" do bot de WhatsApp envia mensagem de cortesia mas nunca atribui a conversa de verdade — a RPC real de atribuição existe e funciona, mas está desconectada do bot, só acionável manualmente. [MÉDIO — confirmado, classe "campo/nó de UI com efeito parcial: dispara metade do que promete" — ATIVO, nó acessível em produção de código hoje]**
Achado durante o desenho da Fase A do item 4 da Etapa 9 (`docs/architecture/etapa-9-item4-construtor-sem-ia-fase-a.md` §1.2), ao ler o runtime real (`whatsapp-bot-reply/index.ts`) que interpreta `flow_data` numa mensagem de WhatsApp de verdade, não só a UI do construtor visual.

- **Caminho exato do gap:** o branch de handover (`whatsapp-bot-reply/index.ts:456-494`) casa a última mensagem inbound contra 7 palavras-chave fixas (`"atendente"`, `"humano"`, `"pessoa"`, `"falar com"`, `"suporte"`, `"ajuda"`, `"atendimento"`, substring case-insensitive) e, se bater, manda um texto fixo hardcoded (`:461`) e retorna `{ handover: true }` — **sem nunca escrever `whatsapp_conversations.assigned_to`**. O mecanismo real de atribuição já existe e funciona (`whatsapp-instance/index.ts:853-862`, action `assign_conversation`), mas é chamado só por `WhatsApp.tsx:405-414` (`handleAssign`), 100% manual, disparado pelo operador na tela de Inbox — os dois caminhos nunca se tocam.
- **Consequência prática:** um cliente que pede "falar com atendente" recebe a mensagem de cortesia, mas o robô **continua respondendo normalmente à próxima mensagem** do mesmo contato (a menos que `respond_all` já esteja `false` E um humano atribua a conversa manualmente depois, por iniciativa própria, sem nenhum sinal de que havia um pedido de transbordo pendente). O nó "Transbordo Humano" parece funcional na UI (Switch liga/desliga, texto explicativo, `WhatsAppBotConfig.tsx:716-730`) mas entrega só a metade cosmética do que o nome promete.
- **Por que é ATIVO, não ARMADO:** ao contrário de G40/G49 (vocabulário atrás de flags default OFF), este nó já está acessível em produção — qualquer workspace com o bot ativo e o nó "Transbordo Humano" habilitado (default `enabled: false` na criação, mas ligável por qualquer operador a qualquer momento, sem flag de sistema) já exibe esse comportamento hoje.
- **Fix não aplicado nesta rodada — pertence à Fase B do item 4:** religar o branch de handover pra chamar a mesma RPC `assign_conversation` (reaproveitar, não recriar) é o fix natural, mas decidir PARA QUEM atribuir (dono do workspace? fila/rodízio, que não existe hoje — ver R4 do doc referenciado) é decisão de produto que a Fase A do item 4 registrou como pergunta em aberto, não uma escolha técnica de 1 linha — por isso não corrigido aqui, mesmo sendo um achado ATIVO.
- **Referência:** `docs/architecture/etapa-9-item4-construtor-sem-ia-fase-a.md` §1.2 (achado original, "achado adicional") e §1.3/§2.3 (classificação e proposta de fix como parte do desenho do transbordo humano da Fase B).

---

**G49 — `createProjectBaseTasks` gravava `status`/`priority` em inglês (`"todo"`/`"medium"`/`"high"`/`"low"`) — gerador de divergência de vocabulário ARMADO, irmão do G40; bloqueava o CHECK preventivo de Tarefas. [MÉDIO — confirmado e FECHADO, classe "2º dialeto ativo bloqueando hardening preventivo" — risco estava ARMADO, não disparando (2 flags default OFF)]**
Achado durante o desenho do Pacote do Flip de Tarefas (`docs/qa/etapa-5-flip-tarefas-pacote.md` §3.1), ao confirmar contra o código se o CHECK preventivo que Financeiro conseguiu aplicar "de graça" (todo escritor já usando o vocabulário certo, G40 fechado) também se aplicaria a Tarefas.

- **Caminho exato:** `CreateProjectBaseTasksDialog.tsx:123-124` gravava `status: "todo"` (hardcoded) e `priority: t.priority` vindo de `DEFAULT_TASKS` (linhas 38-46, valores `"medium"`/`"high"`/`"low"`, também usados como `value` dos `<SelectItem>` do dropdown editável de prioridade, `:201-203`) — ambos em inglês, o vocabulário LEGADO segundo o próprio comentário de topo de `tasksMapper.ts` (linhas 14-18), que já documenta o vocabulário OFICIAL de `public.tasks.status`/`priority` como o local em português (`a_fazer`/`em_andamento`/`revisao`/`concluido`, `alta`/`média`/`baixa`), sem tradução — contrato que `importTask` (confirmado lendo `mapLocalTaskToSupabase`, `tasksMapper.ts:68-87`: `status: task.status, priority: task.priority`, passagem direta do vocabulário local) e `updateTaskStatus` (pós-G40) já seguem, mas que `createProjectBaseTasks` nunca seguiu, porque o fix do G40 mexeu só no caminho do dropdown/`updateTaskStatus` do painel experimental, não neste produtor.
- **Achado adicional durante o fix, do lado da LEITURA (não catalogado na rodada de desenho):** `SupabaseOperationalDashboardCard.tsx` (badge de prioridade da lista de tarefas, `:196-201`) comparava `task.priority === "high"`/`"medium"` **cru, sem normalização** — como o vocabulário oficial sempre foi português, uma tarefa gravada pelo caminho CORRETO (`importTask`, `priority: "alta"`) nunca batia `"high"`, caindo sempre no `else` (badge "Baixa"), **mesmo sendo prioridade alta**. Reproduzido por teste antes do fix (`SupabaseOperationalDashboardCard.test.tsx`, tarefa com `priority: "alta"` renderizava badge "Baixa"). Achado irmão do R1 (status), mas do lado da leitura — só descoberto ao seguir a instrução de "normalização de leitura aceita os legados... sem mascarar desconhecido" até seu único consumidor real.
- **Por que estava ARMADO, não disparando:** o único chamador de escrita (`CreateProjectBaseTasksDialog.tsx`) está atrás de 2 flags default OFF simultâneas (`supabaseOperationalDashboard` + `projectsSupabaseCreateBaseTasks`) — mesma exigência dupla do G40 original, mesma contenção (a) registrada em `tarefas-r2-auditoria.md` §3. Nenhuma linha nova deveria ter sido gravada com esse valor em produção antes deste fix.
- **Fix aplicado (molde G40 — alinhamento ao vocabulário local, não tradução nova):**
  - `CreateProjectBaseTasksDialog.tsx`: `status: "todo"` → `status: "a_fazer"`; `DEFAULT_TASKS[].priority` e os `value` dos 3 `<SelectItem>` do dropdown de prioridade viraram `"alta"`/`"média"`/`"baixa"`.
  - `tasksMapper.ts`: nova `normalizeCloudTaskPriority` (mesmo molde de `normalizeCloudTaskStatus`/R1) — `LEGACY_CLOUD_TASK_PRIORITY = { high: "alta", medium: "média", low: "baixa" }`, valor desconhecido passa intocado, nunca mascara.
  - `SupabaseOperationalDashboardCard.tsx`: badge de prioridade passou a comparar `normalizeCloudTaskPriority(task.priority)`, fechando o achado adicional acima.
- **Dado legado em inglês já gravado — assunto da reconciliação R2, não deste fix:** se alguma linha real já tiver `status`/`priority` em inglês (as 2 flags foram ligadas antes deste fix em algum workspace), `normalizeCloudTaskStatus`/`normalizeCloudTaskPriority` já tratam ambos como alias na leitura — sem mascarar, sem quebrar. Quantificar o volume real (se existe) é read-only, fora do alcance do Code (sem acesso a banco) — `docs/qa/tarefas-r2-auditoria.md` §1.9 (nova) traz a query pronta pro operador rodar, espelhando §1.4 (status).
- **Testes novos:**
  - `tasksMapper.test.ts` (describe "G49"): `normalizeCloudTaskPriority` — 3 valores locais intocados, 3 legados viram o equivalente local, valor desconhecido intocado.
  - `CreateProjectBaseTasksDialog.test.tsx` (novo arquivo, describe "G49"): payload de `createProjectBaseTasks` tem `status: "a_fazer"` e `priority` em português nas 9 tarefas-base; editar a prioridade pelo `<Select>` grava o valor local escolhido. Falha contra o código anterior ao fix (`status: "todo"`, `priority: "high"`), confirmado por reprodução.
  - `SupabaseOperationalDashboardCard.test.tsx` (describe "G49"): tarefa com `priority: "alta"` mostra badge "Alta" (falhava antes — mostrava "Baixa", reprodução confirmada); `"high"`/`"medium"` legados continuam corretos (regressão zero — já funcionavam por coincidência, pois batiam a comparação crua em inglês).
- **CHECK preventivo de Tarefas desbloqueado**: com este fix, `createProjectBaseTasks` já grava no vocabulário certo — mesma condição que permitiu ao Financeiro aplicar o CHECK "de graça" (G40 fechado, `etapa-5-flip-financeiro-pacote.md` §2.1) agora vale pra Tarefas.
- Detalhamento: `docs/qa/etapa-5-flip-tarefas-pacote.md` §3.1 (achado original), §1.1 (CHECK que este achado bloqueava).

---

**G52 — marcar transação como paga em modo Supabase (Financeiro) gravava `status:"paid"` sem `paid_at` — dado de "quando pagou" perdido em silêncio. [MÉDIO — confirmado e FECHADO, classe "UPDATE parcial nativo esquece um campo que a semântica local sempre preenche"]**
Achado pela Lane C ao completar o runbook de homologação da Fase B do Pacote do Flip de Financeiro (`docs/qa/etapa-5-flip-financeiro-runbook.md`) — fix aplicado antes da Fase C, pra não abrir a homologação com um vermelho conhecido.

- **Caminho exato do gap:** `Financeiro.tsx`, `SupabaseTransactionsPanel`'s `setStatus()` (o único caminho de escrita de status em modo Supabase — grep exaustivo confirmou que `useDayCenterActions.ts`/`DayCenter.tsx` estão bloqueados em modo Supabase desde a própria Fase B, G-guard do §3.1 do desenho) chamava `onUpdate(id, { status })` — só a chave `status`, nunca `paid_at`. O modelo local (`useFinance.ts:247-268`, `updateTransactionStatus`) tem semântica diferente: toda transição PRA `"paid"` grava `paidDate = iso(new Date())` (hoje, sempre reescrito); toda transição PRA FORA de `"paid"` mantém `paidDate` como estava. O caminho nativo da nuvem não espelhava nem metade dessa semântica — `paid_at` (coluna `timestamp with time zone`) ficava sempre `NULL`, mesmo para transações marcadas como pagas.
- **Por que não achado antes:** os caminhos de CRIAÇÃO (QuickSaleDialog/ExpenseDialog em modo cloud, e os mirrors de CreateReceivableDialog/QuoteToReceivableDialog) já estavam corretos — os 2 diálogos passam `paidDate` no payload de criação via `mapLocalTransactionToSupabase` (lido normalmente quando `status="paid"` já nasce escolhido no formulário); os 2 mirrors sempre criam com `status:"pending"` hardcoded (nunca "paid" no nascimento, `paid_at` irrelevante ali). O gap era só no UPDATE de status de uma linha já existente — caminho que só a homologação da Fase B (marcar uma transação real como paga) exercitava de ponta a ponta.
- **Fix aplicado nesta rodada:** `setStatus()` agora monta o patch condicionalmente — `{status: "paid", paid_at: <hoje, yyyy-mm-dd, mesmo formato do `iso()` local>}` na transição pra pago; `{status}` sozinho (sem `paid_at`, nem `null`) em qualquer outra transição, preservando o valor que já estava na coluna via UPDATE parcial — mesmo efeito de `t.paidDate` no local. G30 preservado (a resposta da própria mutation continua indo pro cache).
- **Testes:** `Financeiro.test.tsx` — "marcar como pago... paid_at preenchido" (falha contra o código anterior, `updateTransaction` chamado só com `{status:"paid"}`; passa depois) e "cancelar... NUNCA envia paid_at" (prova a ausência real da chave via `not.toHaveProperty`, não um `objectContaining` que deixaria passar um `null` indevido).
- **Referência:** `docs/qa/etapa-5-flip-financeiro-runbook.md` (achado original da Lane C), `docs/qa/etapa-5-flip-financeiro-pacote.md` §2.5 (desenho original do `updateTransaction`).

---

**G55 — "Gerar conta a receber" (Vendas → orçamento aprovado) ficava bloqueado em modo Supabase por `blockWrite()`, o MESMO gate fóssil de `quotes` do G33, agora apontando pra um cutover de `finance` já concluído. [MÉDIO — confirmado e FECHADO, classe "gate fóssil cobrindo ação errada" (irmão do G33/G29 — 2ª ocorrência da classe em cutover)]**
Achado na Fase D (homologação) de Financeiro, Caso 4.3, BUILD `54f7fea`. Com um orçamento aprovado em modo Supabase, clicar "Gerar conta a receber" (atalho do menu ⋯ ou dentro do "Ver") disparava o mesmo toast fóssil de `blockWrite()` ("Edição de orçamentos no modo Supabase chega numa próxima fatia — volte para Local para editar") e nada acontecia. O banner da tela reforçava o mesmo estado obsoleto ("Gerar recebível ainda chega numa próxima fatia (cutover de Financeiro)").

- **Quem gateava (`QuotesSection.tsx`, `blockWrite()`):** exatamente o mesmo gate do G33 — bloqueava incondicionalmente sempre que `dataSource === "supabase"` (dataSource de QUOTES, não de finance), cobrindo `openReceivableDialog`. O G33 já tinha liberado `openProjectDialog` do mesmo gate, deliberadamente mantendo `openReceivableDialog` bloqueado porque `finance` "genuinamente não migrou ainda" (citação literal do G33, ver acima) — decisão correta NO MOMENTO em que foi tomada.
- **O cutover que faltava já aconteceu — de novo, sem coordenar com este gate.** O Pacote do Flip de Financeiro (Fase B, `936c762`; Fase C, `fc55c20`, main) religou `QuoteToReceivableDialog.tsx` com o mesmo contrato G22 que liberou `QuoteToProjectDialog.tsx` no G33: grava local sempre + espelho best-effort pra Supabase, sem gate de flag (NOTA-e, revisão Lane E — o mirror é "sempre-ligado por desenho"), independente do dataSource de quotes. O trabalho nunca tocou `QuotesSection.tsx` — `blockWrite()` continuou de pé, agora sem nenhum destino legítimo pra bloquear.
- **Fix:** `openReceivableDialog` não chama mais `blockWrite()`. Como esse era o ÚNICO chamador restante (`openProjectDialog` já tinha saído no G33; grep confirmou), `blockWrite()` inteiro foi removido — gate vazio, sem substituto. Banner de modo Supabase corrigido pra anunciar os dois fluxos ("Gerar projeto (G33) e gerar conta a receber (G55)... já funcionam"), mesma classe de texto obsoleto do G29/G33.
- **Testes novos** (`QuotesSection.test.tsx`, describe renomeado "G33/G55"): atalho do menu ⋯ abre o diálogo de verdade sem toast de bloqueio; o mesmo pelo botão dentro do "Ver" (preview) — molde idêntico aos 2 primeiros testes do G33, agora espelhados pra "Gerar conta a receber". 2 dos 2 falham contra o código anterior ao fix (confirmado por `git stash` antes de aplicar a correção).
- **Lição sistêmica proposta (2ª ocorrência da classe em menos de 1 etapa):** um gate cruzado que cita explicitamente "domínio X ainda não migrou" é uma dívida datada, não uma constante — G33 e G55 são o MESMO gate, achado 2 vezes em 2 cutovers diferentes (`projects`, depois `finance`) só porque cada fatia de cutover varreu o PRÓPRIO domínio, nunca os gates de domínios VIZINHOS que citam o domínio cortado como motivo de bloqueio. Proposta pro checklist de toda fatia de cutover futura (`quotes`↔`projects`↔`finance` já tem 2 casos confirmados; `tasks`/outros domínios cruzados a conferir quando chegar a vez deles): antes de fechar uma Fase C, `grep` pelo nome do domínio cortado em TODOS os outros domínios (não só nos arquivos do próprio domínio) — qualquer gate/comentário/toast que cite "ainda não migrou"/"chega numa próxima fatia" referenciando o domínio que acabou de migrar é candidato a fóssil.
- **Referência:** `docs/qa/etapa-5-flip-financeiro-runbook.md` §3 (Fase D, Caso 4.3), G33 acima (mesmo gate, mesma classe).

---

**G56 — Caso 4.3 (2º round, pós-G55): "Gerar conta a receber" na nuvem, quando o MESMO orçamento já tem um recebível vivo lá (ex.: gerado antes via CRM), devolve silenciosamente a linha do OUTRO recebível — category/payment_method escolhidos nesta tela nunca chegam na nuvem, sem nenhum aviso. [MÉDIO — confirmado e FECHADO, classe nova "colisão de idempotência entre 2 produtores compartilhando a mesma constraint — sucesso silencioso mascara perda de dado, não erro"]**
Achado ao vivo na Fase D (homologação) de Financeiro, Caso 4.3 (2º round, pós-fix do G55), BUILD `a7b110d`. **Divergência confirmada entre a hipótese original do achado e a causa raiz real — registrada explicitamente, não silenciada** (protocolo, "reportar, não inventar"): a hipótese de abertura ("caminho legado gera transação local direta, bypassando o diálogo") foi investigada e REFUTADA por leitura exaustiva de código — `grep` por `addTransaction`+`source:"quote"` em todo `src/` encontrou só 2 produtores reais (`CreateReceivableDialog.tsx` no CRM, `QuoteToReceivableDialog.tsx` em Vendas), nenhum deles um atalho paralelo; o handler do item do menu ⋯ e do botão dentro do "Ver" são a MESMA função (`openReceivableDialog`, `QuotesSection.tsx`), que abre o MESMO diálogo — não há 2 fluxos divergentes pra convergir.

- **Causa raiz real, confirmada:** `financial_transactions` tem `ux_ft_receivable_from_quote` — índice único parcial em `(quote_id) WHERE source='quote' AND type='receivable' AND deleted_at IS NULL` (`20260704120000_etapa3_unique_receivable_from_quote.sql:44-46`), reforçando "no máximo 1 recebível VIVO por orçamento", **independente de qual dos 2 diálogos o cria**. `createReceivableFromQuote` (`financeRepository.ts:52-76`) trata o 23505 (unique_violation) buscando e devolvendo a linha JÁ EXISTENTE em vez de propagar erro — mesma proteção usada pelos 2 diálogos. O runbook's próprio Caso 4 (`etapa-5-flip-financeiro-runbook.md` §"Caso 4", passos 4.2→4.3) roda os 2 diálogos em SEQUÊNCIA pro MESMO `HOMOLOG-FIN-quote` — 4.2 (CRM) cria `HOMOLOG-FIN-transacao-B` primeiro; 4.3 (Vendas) tenta criar `HOMOLOG-FIN-transacao-C` depois, mas a constraint faz `createReceivableFromQuote` devolver a linha de 4.2 (título "-B") em vez de inserir uma nova (título "-C") — o `SELECT ... WHERE title = 'HOMOLOG-FIN-transacao-C'` do próprio passo 4.3 do runbook literalmente não encontra nada, batendo exato com o sintoma reportado ("SQL confirma ZERO linha nova na nuvem, só a do 4.2"). `mirrored.title !== "HOMOLOG-FIN-transacao-C"` (é "-B") é a evidência de que a linha devolvida não é a que a tela 4.3 pediu — e como a linha de 4.2 nunca teve `category`/`payment_method` (mirror do CRM não os envia, achado G41), a leitura final também bate ("sem categoria/pagamento").
- **Não confirmado por leitura de código — pendência pro operador reconfirmar no retest:** o detalhe "NENHUM diálogo abre" do sintoma original não tem explicação encontrada nesta investigação. `openReceivableDialog`/`QuoteToReceivableDialog.tsx` seguem exatamente o contrato do G55 (dialog abre, formulário preenchido, botão de confirmar visível) — nenhum código encontrado faria a UI pular a abertura visual. Hipótese mais provável: descrição imprecisa do operador (o resultado "nada de novo aconteceu de verdade" foi lido como "nenhum diálogo", quando na prática o diálogo abriu e foi confirmado normalmente — só o resultado ficou enganoso). Marcado como aberto, não presumido resolvido pelo fix abaixo.
- **Fix aplicado:** `mirrorReceivableToSupabase` (`QuoteToReceivableDialog.tsx`) agora compara o `title` devolvido pelo mirror contra o `title` que a tela tentou enviar — se divergem (fingerprint de "devolveu a linha de outro recebível"), dispara `toast.warning` explícito ("Este orçamento já tem uma conta a receber na nuvem — categoria e forma de pagamento escolhidas aqui ficaram só no local") em vez do silêncio total de antes. Local continua autoritativo e intocado (a transação local "-C" É criada corretamente, com category/payment reais) — o fix é só a VISIBILIDADE do que acontece (ou não) na nuvem.
- **Sub-achado de qualidade de teste (confirmado, mas diferente da hipótese original — não "teste clicava o handler errado"):** os testes do G55 ("abre o diálogo de verdade") clicam o elemento REAL do menu (mesma função `openQuoteMenu` + `fireEvent.click` no texto real do `DropdownMenuItem`, não um handler direto) — isso já estava certo. A lacuna real: os testes provavam só REACHABILITY (o diálogo abre), nunca completavam o fluxo até CONFIRMAR e verificar que o espelho de fato dispara — por isso nunca exercitaram `createReceivableFromQuote` nem, portanto, o cenário de colisão. Teste novo em `QuotesSection.test.tsx` fecha esse gap: clica o menu real → confirma no diálogo → prova `financeRepository.createReceivableFromQuote` chamado com o `quote_id` certo (precisou mockar `financeRepository` nesse arquivo pela 1ª vez — não existia mock antes, porque nenhum teste anterior ia longe o suficiente pra precisar).
- **Testes novos:** `QuoteToReceivableDialog.test.tsx` — colisão dispara o aviso novo (falha contra o código anterior, confirmado via `git stash`); ausência de colisão (title ecoado) NÃO dispara o aviso (guarda de regressão, positivo/negativo). `QuotesSection.test.tsx` — fluxo de ponta a ponta via menu real até o espelho disparar.
- **Transação local órfã do teste ao vivo (registrar pra limpeza do Caso 8, não uma ação de código):** o clique do operador durante a reprodução criou uma transação LOCAL real (`HOMOLOG-FIN-transacao-C`, correta localmente) no ambiente onde o teste rodou — sem contraparte nova na nuvem (a nuvem só tem a de 4.2). Fica registrado aqui para o Caso 8 (limpeza pós-homologação) remover essa entrada local órfã junto com as demais sintéticas.
- **Referência:** `docs/qa/etapa-5-flip-financeiro-runbook.md` §"Caso 4" (4.2/4.3, mesmo `quote_id`), `supabase/migrations/20260704120000_etapa3_unique_receivable_from_quote.sql` (a constraint), G41 acima (por que a linha de 4.2 não tem category/payment).

---

**G57 — `crmOpportunityMapper.ts` (caminho de IMPORT de oportunidades) não limpava `won_at` ao sair do estágio "fechado" — preservava um valor stale indefinidamente. [BAIXO — confirmado e FECHADO, classe "caminho secundário (import) não replica a máquina de estados do caminho primário — bug latente até o campo ganhar produtor local"]**
Achado pela Lane E na auditoria classe G52 (`docs/qa/auditoria-g52-mutations-vocabulario.md` §2.4, 15/ago/2026) — generalização do padrão do G52 pra todo UPDATE/import com campo condicionado a transição de estado.

- **Caminho exato do gap:** `mapLocalLeadToSupabaseOpportunity` (`crmOpportunityMapper.ts:63`) — `won_at: lead.wonAt || (lead.stage === "fechado" ? new Date().toISOString() : null)`. O `||` preservava qualquer `lead.wonAt` truthy independente do `stage` atual — nunca limpava ao sair de "fechado". O caminho PRIMÁRIO de mudança de stage (`crmOpportunitiesRepository.ts:177-218`, `moveOpportunityStage`/`markOpportunityWon`/`markOpportunityLost`) já fazia isso certo há mais tempo: zera `won_at`/`lost_at`/`lost_reason` explicitamente nas 3 direções de transição (fechado/perdido/qualquer outro). O import nunca replicou essa máquina de estados — cresceu como um caminho de escrita paralelo, não como uma chamada ao caminho primário.
- **Por que não era ativo em produção:** confirmado por grep exaustivo em `useLeads.ts`/`CRM.tsx` que **nenhum código local escreve `Lead.wonAt`** — o campo só é populado ao LER da nuvem (`mapSupabaseOpportunityToLocalLead:109`, direção inversa). Sem um produtor local, a pré-condição do bug (`lead.wonAt` truthy + `stage` já não é mais "fechado") nunca ocorre na prática hoje — mas o código estava errado independente disso, e viraria ativo no dia em que qualquer fluxo (ex.: um round-trip nuvem→local→reimport) passasse a alimentar esse campo.
- **Lição sistêmica** (nomeada explicitamente porque não é a 1ª vez que aparece nesta forma — ver G52 acima, mesma classe em Financeiro): **um caminho de escrita secundário para o mesmo dado (import, mirror, upsert em lote) não herda automaticamente a lógica condicional do caminho primário (UPDATE ao vivo)** — cada um precisa da própria máquina de estados escrita explicitamente, ou herda o bug de "esquecer a condição inversa". Nenhum teste de tipo pega isso (os dois caminhos escrevem pro mesmo campo, tipo `string | null` válido dos dois jeitos) — só teste de comportamento, caso a caso.
- **Fix aplicado:** `won_at: lead.stage === "fechado" ? (lead.wonAt || new Date().toISOString()) : null`. Preserva a nuance de idempotência do import (não empurra o timestamp pra "agora" a cada reimportação de um lead já ganho — diferente de `moveOpportunityStage`, que sempre reescreve porque é uma ação ao vivo, não um replay) — mas agora limpa corretamente pra `null` em qualquer stage que não seja "fechado", igual ao caminho primário.
- **Testes:** `crmOpportunityMapper.test.ts`, describe "G57" — 4 casos novos: `stage="perdido"` com `wonAt` stale → `null` (falha contra o código anterior, confirmado por `git stash` nas duas direções); as 4 variações de stage não-fechado → sempre `null`; `stage="fechado"` sem `wonAt` prévio → seta novo (regressão, preservado); `stage="fechado"` com `wonAt` prévio → preserva o valor original (prova da idempotência mantida).
- **Referência:** `docs/qa/auditoria-g52-mutations-vocabulario.md` (achado original), G52 acima (mesma classe, domínio Financeiro).

---

## 3. Segurança / vulnerabilidades (verificar e endurecer)

> Vários itens abaixo são **"confirmar no código"** — a arquitetura está certa, mas a implementação precisa ser auditada arquivo a arquivo pelo Code.

**S1 — Validação de assinatura de webhooks. [CRÍTICO — confirmar]**
Webhooks públicos (`whatsapp-webhook` recebendo eventos da Meta; futuro `payment-webhook` do Asaas) **precisam validar a assinatura** (`X-Hub-Signature-256` na Meta; token/assinatura no Asaas). Se algum webhook aceita o payload sem validar, qualquer um pode forjar eventos (ex.: marcar pagamento como aprovado). Confirmar que cada webhook público valida assinatura antes de processar.

**S2 — `verify_jwt` por função no `config.toml`. [ALTO — confirmar]**
Webhooks precisam de `verify_jwt = false` (são públicos) **e**, por isso, precisam fazer a própria autenticação (assinatura). Funções autenticadas (ex.: `whatsapp-campaign-v2-sender`) já fazem `Authorization Bearer` + `auth.getUser()` + checagem de `workspace_members` — bom. Confirmar que a configuração de cada função bate com o que ela faz (nenhuma função sensível pública sem auth própria).

**S3 — CORS com wildcard. [MÉDIO]**
As functions importam `corsHeaders` do módulo cors do supabase-js, que por padrão libera `Access-Control-Allow-Origin: *`. Para funções autenticadas em produção, restringir a origem aos domínios do Kora. (Para webhooks server-to-server o CORS é irrelevante, mas padronizar ajuda.)

**S4 — `service_role` nunca no frontend. [ALTO — confirmar]**
Padrão documentado está correto (frontend só `anon_key`). Confirmar por varredura que `SERVICE_ROLE`/`service_role` não aparece em nenhum arquivo sob `src/` nem vaza no bundle, e que nenhuma `.env` com segredo está versionada.

**S5 — Race condition em checagens "verifica-depois-insere". [MÉDIO]**
Ex.: geração de recebível faz `SELECT` por duplicidade e depois `INSERT`. Sob concorrência dá para criar duplicado. Trocar por **constraint no banco** (ex.: índice único parcial em `transactions(quote_id) WHERE source='quote' AND type='receivable' AND deleted_at IS NULL`) e tratar violação. Idempotência de verdade fica no DB, não na aplicação.

**S6 — Segredos de credenciais de IA por workspace. [MÉDIO — confirmar]**
`workspace_ai_credentials` guarda `credentials_json` (Service Account do Google, com private key). Confirmar: RLS estrita, e o `credentials_json` **nunca** retornado ao frontend (o hook `useVertexCredentials` seleciona só metadados — bom padrão; garantir que nenhuma query traga o JSON completo ao cliente).

**S7 — Sanitização de entrada / limites de payload. [MÉDIO]**
Payloads de campanha, briefing de IA e imports CSV precisam de limites de tamanho e sanitização server-side. Confirmar limites (tamanho de lote, tamanho de arquivo no Storage, comprimento de campos) para evitar abuso e DoS barato.

---

## 4. Manutenibilidade / "má programação"

**M1 — `any` e ~35–37 erros de lint legados.** Reduzem segurança de tipos → bugs em runtime. Não zerar de uma vez; estabelecer teto decrescente e proibir novos `any`/erros via CI. **Atualização (rodada `qualidade-lint`, 2026-07-25):** teto decrescente aplicado em cada rodada (89/68 → ... → 34/34); `@ts-nocheck` zerado no projeto todo (ver G10). Erros/`any` legados remanescentes seguem sob o mesmo teto decrescente — não zerados, só congelados contra regressão.

**M2 — Lógica de dados duplicada** entre hooks localStorage e repositories Supabase (mesma entidade, dois caminhos). Alvo: uma única camada de acesso por entidade.

**M3 — Feature flags em `localStorage` sem governança central.** Dezenas de chaves `kora.*.enabled` espalhadas. Centralizar num único módulo de flags (com tipos) para saber o que está ligado e poder limpar flags mortas.

**M4 — Documentação espalhada na raiz.** ~20 arquivos `SUPABASE-*.md` no topo do repo poluem a leitura. Mover para `docs/`.

**M5 — Regras de negócio críticas no frontend.** Validações de campanha e financeiro precisam existir **também** no servidor (nunca confiar na flag/validação do cliente — já é o caso do sender, generalizar para os demais fluxos monetizáveis).

---

## 5. Reorganização proposta do repositório

Objetivo seu: abrir o repo e saber na hora **o que é banco, backend, frontend, design e cada função**. Estrutura-alvo (sem mover código de função sem necessidade — o grosso é organizar `docs/` e padronizar nomes):

```
kora-hub/
├── README.md                 ← visão geral + este mapa + "como rodar"
├── docs/                     ← 📚 TODA a documentação (mover os SUPABASE-*.md pra cá)
│   ├── architecture/         ← visão de arquitetura, decisões (ADRs)
│   ├── database/             ← schema, RLS, migrações explicadas
│   ├── integrations/         ← WhatsApp, Asaas, Resend, IA
│   └── qa/                   ← relatórios de teste/homologação
│
├── supabase/                 ← 🔧 BACKEND
│   ├── migrations/           ← 🗄️ BANCO DE DADOS (schema, RLS, índices, triggers)
│   ├── functions/            ← ⚙️ BACKEND serverless (Edge Functions Deno)
│   │   ├── _shared/          ← utilitários (cors, auth, vertex, rate-limit)
│   │   └── <nome-da-função>/ ← uma pasta por função
│   └── config.toml           ← verify_jwt e config por função
│
├── src/                      ← 🎨 FRONTEND
│   ├── pages/                ← telas (uma por rota)
│   ├── components/
│   │   ├── ui/               ← 🎨 DESIGN SYSTEM (shadcn, tokens)
│   │   └── <módulo>/         ← componentes por domínio
│   ├── hooks/                ← 🧩 FUNÇÕES/estado (lógica reativa)
│   ├── repositories/         ← 🔌 acesso a dados (Supabase)
│   ├── services/             ← integrações/clients externos
│   ├── lib/ e utils/         ← helpers puros (sem estado)
│   ├── types/                ← tipos TS compartilhados
│   ├── config/flags.ts       ← feature flags centralizadas (novo)
│   ├── integrations/supabase/← client (anon key)
│   └── index.css / styles    ← 🎨 DESIGN (tema, tokens)
│
├── public/                   ← assets estáticos
└── package.json · vite.config · tailwind.config · tsconfig · .env.example
```

Cada pasta ganha um `README.md` de uma linha dizendo o que ela é. Assim o repo "se explica" ao ser aberto.

---

## 6. Plano de melhorias em etapas (para o Claude Code)

> Execute **na ordem**. Depois de cada etapa: `npx tsc --noEmit` (0 erros), `npm run lint` (não regride), app sobe sem erro no console, commit isolado com mensagem clara. Se algo quebrar, reverta a etapa antes de seguir.

### Etapa 0 — Rede de segurança (pré-requisito, não pular)

- Configurar CI (GitHub Actions): rodar `tsc --noEmit` + `lint` em todo PR; falhar se houver **novos** erros ou `any`.
- Adicionar testes de fumaça (Vitest) para os repositories e helpers puros (normalização de telefone, mappers).
- `.env.example` documentado; garantir que nenhum segredo real está versionado.
- **Aceite:** pipeline verde; nenhum segredo no histórico; testes rodando.

### Etapa 1 — Organização do repositório (baixo risco, alto ganho de clareza)

- Mover todos os `SUPABASE-*.md` e `INTEGRATIONS-ROADMAP.md` para `docs/` (subpastas do item 5).
- Criar `README.md` raiz com o mapa da seção 5 + "como rodar".
- Adicionar `README.md` de uma linha em cada pasta principal.
- **Não mover código de função ainda.** Só documentação e READMEs.
- **Aceite:** app inalterado; raiz limpa; repo navegável.

### Etapa 2 — Endurecer segurança (verificar e corrigir)

- Confirmar validação de assinatura em **todos** os webhooks públicos (S1). Onde faltar, implementar antes de processar o payload.
- Auditar `config.toml`: `verify_jwt` correto por função (S2). Nenhuma função sensível pública sem auth própria.
- Varredura por `service_role`/segredos em `src/` e no bundle (S4); remover qualquer vazamento.
- Restringir CORS de funções autenticadas aos domínios do Kora (S3).
- Garantir que `credentials_json` de IA nunca vai ao frontend (S6).
- **Aceite:** relatório de cada item (OK/corrigido); testes de webhook rejeitando assinatura inválida.

### Etapa 3 — Performance de banco (destrava escala silenciosamente)

- Marcar `is_workspace_member` como `STABLE`; garantir índice em `workspace_members(user_id, workspace_id)` (G6).
- Migração adicionando índices em `workspace_id` + colunas de filtro por tabela (`status`, `client_id`, `due_date`) e índices **parciais** `WHERE deleted_at IS NULL`.
- Substituir checagens "SELECT-depois-INSERT" por **constraints únicas** no banco (S5).
- **Aceite:** `EXPLAIN ANALYZE` das queries quentes usando índice; migrações aplicadas sem quebrar RLS.

### Etapa 4 — Centralizar feature flags e camada de dados

- Criar `src/config/flags.ts` tipado; substituir leituras soltas de `localStorage` por esse módulo (M3). Listar e remover flags mortas.
- Definir **uma** interface de repository por entidade; hooks passam a depender dela (prepara para trocar localStorage → Supabase sem mexer na UI) (M2).
- **Aceite:** UI intacta; toda flag lida de um lugar só; repositories com contrato único.

### Etapa 5 — Migração localStorage → Supabase como fonte de verdade (o coração da escala)

Executar **por entidade**, na ordem de dependência já mapeada: workspaces → clients → contacts/fichas → oportunidades → orçamentos → transações → projetos → tarefas.

Para cada entidade:

1. Garantir tabela + RLS + índices (etapa 3) prontos.
2. Assistente de migração em background: detecta `kora.*`/`orbyt.*`, faz upload em batch, **só limpa o local após confirmar persistência remota** (evita o risco nº 1 do roadmap: perder dados locais antes do commit remoto).
3. Trocar o hook para ler/gravar no Supabase com **paginação e filtro server-side** (G2); localStorage vira só cache offline (write-through).
4. Aposentar a flag experimental daquela entidade.

- **Aceite por entidade:** ciclo local→nuvem→local homologado; zero perda de dado; UI sem regressão; leitura paginada.

### Etapa 6 — Fila, rate limit e worker (WhatsApp + IA + e-mail)

- `pg_cron` + `pg_net` acionando `whatsapp-campaign-v2-sender` em lotes automáticos, com **retry** e idempotência (G4).
- Rate limit + quota por workspace nas funções de IA e e-mail; tabela de contadores/janela (G5).
- Corrigir o bug de escopo do `flowNodes` em `whatsapp-bot-reply` que impede o template do Send Node de aplicar (G8); adicionar teste de regressão para o caminho.
- Webhook de delivery/read mapeando `provider_message_id` → recipient.
- **Aceite:** campanha de milhares processa em lotes sozinha; abuso é barrado; custo previsível; template do Send Node aplica corretamente (G8).

### Etapa 7 — Qualidade contínua

- Baixar o teto de lint gradualmente; proibir novos `any` (M1).
- Cobrir com testes os fluxos monetizáveis (orçamento→recebível, campanha→envio).
- Observabilidade: logs estruturados e alertas de erro nas Edge Functions.
- **Aceite:** teto de lint menor; cobertura dos fluxos críticos; alertas ativos.

### Etapa 8 — WhatsApp Oficial: Tech Provider + Embedded Signup

> **Status: PLANEJADA, não iniciada.** Depende de G1 (migração `localStorage → Supabase`,
> Etapa 5) avançar; sem data definida.

#### Modelo

Kora opera como **Tech Provider** da Meta (estilo SMClick): cada tenant conecta a **própria**
WABA via **Embedded Signup**; o Kora lista os templates aprovados da conta do tenant e opera
atendimento (janela 24h, texto livre) + disparo proativo (só template aprovado). Compliance de
mensagens fica com o tenant, não com a IndhecX — requisito para escala nacional.

#### Pré-requisitos IndhecX (uma vez)

1. Verificação de negócio da IndhecX no Meta Business Manager (CNPJ, 1-5 dias).
2. Meta App tipo Business com produto WhatsApp (`developers.facebook.com`).
3. App Review: permissões `whatsapp_business_messaging` + `whatsapp_business_management`
   (exige screencast de demonstração + política de privacidade publicada; dias a semanas —
   iniciar cedo).
4. Implementar Embedded Signup (OAuth) no Kora.

#### Por tenant (no onboarding)

- Embedded Signup dentro do Kora (minutos).
- Verificação do negócio do tenant (guiada pelo fluxo).
- Número dedicado próprio (não pode estar em app WhatsApp/Business).
- Templates criados e aprovados na WABA do tenant; Kora consome via
  `GET /{waba-id}/message_templates?status=APPROVED`.

#### Impacto técnico no Kora

- Multi-tenant: `waba_id`, `phone_number_id`, `token` por workspace (tokens criptografados,
  nunca no frontend — mesmo padrão `service_role`, ver S4).
- Cache/sync dos templates aprovados por tenant.
- Webhooks: `HMAC-SHA256` já endurecido na Etapa 2 (S1) é a validação que a Meta exige.
- Módulo WhatsApp atual (tipado na rodada `qualidade-lint`) é a base a evoluir.

#### Dependências

Depois de G1 (`localStorage → Supabase`) avançar; sem data. Registrada como etapa
**PLANEJADA, não iniciada**.

---

## 7. Prompt pronto para colar no Claude Code

```
Você vai trabalhar no repositório do Kora Hub (React/TS/Vite + Supabase).
Leia o documento docs/architecture/kora-hub-auditoria-e-plano.md.
Execute SOMENTE a Etapa <N> dele.
Regras invioláveis:
- Não quebre nenhuma funcionalidade existente.
- Ao terminar, rode `npx tsc --noEmit` (0 erros) e `npm run lint` (não pode
  regredir do teto atual). Se regredir ou quebrar, reverta e me explique.
- Faça commits pequenos e isolados, um por sub-tarefa, com mensagem clara.
- Não migre dados nem toque em RLS sem antes garantir índices e backup.
- Ao final, me entregue: o que mudou, arquivos tocados, resultado de tsc/lint,
  e os critérios de aceite da etapa que foram atendidos.
Comece confirmando o plano da Etapa <N> comigo antes de escrever código.
```

---

### Sequência recomendada

**0 → 1 → 2 → 3** primeiro (rede de segurança, clareza, segurança, performance — tudo baixo risco). Só então **4 → 5** (a migração, que é o que realmente destrava a escala nacional) e **6 → 7**. Não pule para a Etapa 5 sem 0–3 prontas: migrar dados sem CI, sem índices e sem constraints é o caminho mais rápido para perder dados de cliente em produção.
