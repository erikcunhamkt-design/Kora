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

**G21 — `BotRulesPanel.tsx` é um componente inteiro, nunca importado nem montado em lugar nenhum do app. [BAIXO — catalogado, NÃO corrigido nesta rodada]**
Achado durante a reconciliação de UX2 ([`kora-ux-produto.md`](kora-ux-produto.md)), ao investigar a premissa de que o simulador do bot não teria porta de entrada — a busca pelo componente certo levou a este, um achado diferente e não relacionado ao `isTest` de `WhatsAppBotConfig.tsx`.

- **A causa:** `src/components/whatsapp/bot/BotRulesPanel.tsx` exporta `function BotRulesPanel()` — uma tela inteira alternativa de "Robô IA de Atendimento" (modos de atendimento, guardrails, accordion de regras avançadas, preview de inbox, botão "Testar robô"). Nenhum arquivo em `src/` importa `BotRulesPanel` (grep sem nenhum resultado além da própria definição) — mesma classe de achado do G16 (componente nunca montado na árvore real, sem lint que pegue porque `no-unused-vars` está desligado no projeto).
- **Diferença do G16:** ali era um *import* órfão (linha de import sobrando após remoção da JSX que o usava). Aqui não há sequer um import em nenhum lugar — o componente parece ter sido escrito e nunca conectado à navegação em momento algum, provavelmente uma versão anterior/alternativa da tela de configuração do robô, superada por `WhatsAppBotConfig.tsx` (a que está de fato montada hoje na aba "Robô IA" de `WhatsApp.tsx`).
- **Simulador interno é mockado:** `runSimulator()` (linha 201) devolve uma resposta fixa hardcoded (`setSimResult({ reply: "Olá! Sim, atendemos restaurantes...", ... })`) — não chama nenhuma edge function real, diferente do simulador de `WhatsAppBotConfig.tsx` (que chama `whatsapp-bot-reply` com `isTest: true`, ver UX2). Mesmo remontado como está hoje, o "teste" que ele oferece não reflete o comportamento real da IA configurada.
- **Não corrigido nesta rodada** — só catalogado. Decisão de remontar/absorver/aposentar fica para uma rodada dedicada (mesmo tipo de decisão a/b/c do dashboard órfão, G16/G20).

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

**G23 — Avisos "Aviso Híbrido"/"Aviso de Backup Híbrido" na aba Dados afirmam que Clientes/CRM/Ficha Técnica "ainda usam dados locais", mas o default de leitura das 3 telas é Supabase desde jul/2026. [MÉDIO — confirmado, catalogado nesta rodada]**
Achado durante a reconciliação de `docs/architecture/kora-roadmap.md`, a partir de um relato do operador com prints da aba Dados (Configurações) datados de hoje, contradizendo a classificação "completo" que o roadmap tinha acabado de dar a esses 3 domínios.

- **Localização dos avisos** (`src/pages/Configuracoes.tsx`): linha 1271 (Clientes — "a tela Clientes ainda usa dados locais até a próxima etapa... ative a fonte Supabase experimental"), linha 1441 ("A tela principal de Clientes ainda usa localStorage nesta fase"), linha 1586 (Ficha Técnica — "A página Ficha Técnica principal continua usando localStorage nesta fase"), linhas 1835/1975 (CRM — "a tela principal de CRM ainda usa dados locais").
- **Prova de obsolescência — `git blame`, não suposição:** os 4 blocos de aviso vêm todos do mesmo commit `4b1a8f20` (2026-06-01). A lógica real que define o default de leitura das 3 telas foi escrita **depois**, em commits separados: `useClientsDataSource.ts:47` (`workspaceLoading || workspace ? "supabase" : "local"`) no commit `7ab23675` (2026-06-15); `getCrmDataSource()`/`getTechnicalSheetDataSource()` em `src/config/flags.ts` (commit `49ec0bf6`, 2026-07-04), com comentário explícito no próprio código confirmando "só 'local' explícito seleciona local" / "default 'supabase'". Nenhum desses defaults foi revertido depois — confirmado como estado atual de `main` no momento deste achado.
- **Detalhe que confirma a defasagem:** o aviso de Clientes cita "ative a fonte Supabase experimental" — um mecanismo de flag manual que **não existe mais** no código atual; a lógica de hoje não depende de nenhuma flag desse tipo, é automática pela presença de workspace.
- **Efeito:** quem lê a aba Dados hoje recebe uma informação que deixou de ser verdade há quase um mês (CRM/fichas) a quase dois meses (clients) — risco de decisão errada (ex.: achar que uma tela ainda depende de import manual quando já lê Supabase por padrão).
- **Não corrigido nesta rodada** — só catalogado. Correção é trivial (atualizar/remover os 4 blocos), mas fora do escopo da tarefa que encontrou isso (reconciliação de roadmap, não correção de UI).
- **Lição:** texto de aviso hardcoded em tela de configurações tem o mesmo risco de obsolescência que import órfão (G16) ou dashboard nunca lido (G20/G22) — não existe teste que falhe quando o comportamento real diverge do texto, porque texto estático nunca "quebra" sozinho. Candidato a padrão: todo aviso que descreve o estado de uma flag/default deveria derivar do valor real da flag em vez de ser uma string fixa — ou, no mínimo, ter um teste que compare o texto contra o default real da flag.

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
