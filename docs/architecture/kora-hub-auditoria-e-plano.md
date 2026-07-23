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

**M1 — `any` e ~35–37 erros de lint legados.** Reduzem segurança de tipos → bugs em runtime. Não zerar de uma vez; estabelecer teto decrescente e proibir novos `any`/erros via CI.

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
