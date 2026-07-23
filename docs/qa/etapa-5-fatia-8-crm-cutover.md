# Etapa 5 · Fatia 8 — Fase A: levantamento do escopo restante rumo ao G1

> **Escopo desta rodada: SOMENTE LEITURA.** Nenhum código alterado, nenhuma migration escrita,
> nenhum dado acessado (Code não tem credencial de banco nem acesso a browser — medições de
> volume ficam como queries para o operador rodar, seção 3).
>
> Diagnóstico de origem: [`etapa-5-diagnostico.md`](etapa-5-diagnostico.md) · Gargalo
> [G1](../architecture/kora-hub-auditoria-e-plano.md#2-gargalos-de-escalabilidade) · Fatias já
> fechadas: [Fatia 1 — ficha técnica](etapa-5-ficha-tecnica.md),
> [Fatia 2 — opportunities](etapa-5-fatia-2-opportunities.md),
> [Fatia 3 — quotes](etapa-5-fatia-3-quotes.md),
> [Fatia 4 — clients](etapa-5-fatia-4-clients.md),
> [Fatia 6 — finance](etapa-5-fatia-6-finance.md),
> [Fatia 7 — projects/tasks](etapa-5-fatia-7-projects.md).

---

## 1. O que resta do G1?

**Resposta curta: nada, no nível de "caminho de import homologado".** Os dois candidatos que a
instrução apontou como possivelmente descobertos — **leads/CRM opportunities** e **technical
sheets** — já estão **ambos** cobertos, e cobertos há mais tempo que quotes/finance/projects/tasks:

| Domínio nomeado em G1 | Import homologado? | Fatia | Evidência |
|---|---|---|---|
| `client_technical_sheets` | ✅ | **Fatia 1** (teste de fogo) | [`etapa-5-ficha-tecnica.md`](etapa-5-ficha-tecnica.md); hook `useLocalTechnicalSheetsImport.ts`, chave `kora.technicalSheets.supabaseImport.v1` |
| `clients` + `client_contacts` | ✅ | **Fatia 4** | [`etapa-5-fatia-4-clients.md`](etapa-5-fatia-4-clients.md) §4.5 — C8 implementado, testado (127 testes verdes pós-merge), homologado manualmente (caso 7) |
| `opportunities` (leads) | ✅ | **Fatia 2** | [`etapa-5-fatia-2-opportunities.md`](etapa-5-fatia-2-opportunities.md) §9 — **VERDE 7/7**, 2026-07-18 |
| `quotes` + `quote_items` | ✅ | **Fatia 3** | [`etapa-5-fatia-3-quotes.md`](etapa-5-fatia-3-quotes.md) |
| `financial_transactions` | ✅ | **Fatia 6** | [`etapa-5-fatia-6-finance.md`](etapa-5-fatia-6-finance.md) |
| `projects` + `tasks` | ✅ | **Fatia 7** | [`etapa-5-fatia-7-projects.md`](etapa-5-fatia-7-projects.md) §13.7 — 10/11 (+ bug g corrigido) |

Confirmado por grep exaustivo de `kora\.` / `orbyt\.` em `src/` (196 ocorrências, ver
metodologia no rodapé¹): todo domínio de negócio nomeado explicitamente no texto do G1
("Clientes, leads, orçamentos, financeiro, projetos e tarefas") tem hoje: repository com CRUD
ao menos parcial, chave de idempotência (`source_local_id` + `UNIQUE`), e um
`useLocal<E>Import.ts` homologado.

**Não há "fatia 5"** — não é um número pulado por engano; não há nenhum commit, doc ou
menção a uma "Fatia 5" em todo o histórico do repositório. A sequência real é 1‑2‑3‑4‑6‑7 desde
o início; o "5" nunca existiu como fatia de G1.

### O que "resta" de fato: G1 mede *fonte de verdade*, não *existência de import*

O texto do G1 no plano mestre diz: *"Enquanto isso [localStorage como fonte de verdade] for
verdade, 'escala nacional' é impossível por definição."* O import homologado é **pré-requisito**
para fechar G1, não o fechamento em si — ele prova que dá para subir o dado com segurança, mas
**nenhuma fatia até aqui tornou o Supabase a fonte de leitura+escrita por padrão**, exceto duas:

| Entidade | Leitura hoje | Escrita hoje | Seletor reversível existe? |
|---|---|---|---|
| `client_technical_sheets` | 🟢 Supabase (default) | 🟢 Supabase (write-through) | ✅ `kora.technicalSheets.dataSource.v1` (por-cliente) |
| `clients` (+ `client_contacts`) | 🟢 Supabase (`useClientsDataSource`, quando há workspace) | 🟢 Supabase | 🟡 implícito (não é flag explícita — decisão C6 da Fatia 4, regularizada como dívida assumida, [protocolo §10](protocolo-homologacao.md#10-emenda-2026-07-20--regularização-de-p5-para-clients-dívida-assumida-sem-homologação-retroativa)) |
| `opportunities` | 🟡 **parcial** — `getCrmDataSource()` default `"supabase"`, mas só em telas específicas (`CRM.tsx` quando o seletor resolve supa); `useLeads` (100% local) continua existindo em paralelo | 🔴 **bloqueada por flag** — `kora.crm.supabaseWrite.enabled`, default **OFF** ([`useSupabaseCrmWriteFlag.ts:10`](../../src/hooks/useSupabaseCrmWriteFlag.ts#L10)) | ✅ `kora.crm.dataSource.v1` já existe |
| `quotes` | 🔴 sempre local (`useQuotes.ts` — **zero** menção a Supabase no arquivo) | 🔴 sempre local | ❌ nenhum seletor — Supabase só aparece em telas específicas (`SupabaseQuotesViewerCard`, diálogos de aprovação/recebível) |
| `financial_transactions` | 🔴 sempre local (`useFinance.ts` — **zero** menção a Supabase) | 🔴 sempre local | ❌ nenhum |
| `projects` | 🔴 sempre local (`useProjects.ts` — **zero** menção a Supabase) | 🔴 sempre local | ❌ nenhum |
| `tasks` | 🔴 sempre local (`useTasks.ts` — **zero** menção a Supabase) | 🔴 sempre local | ❌ nenhum |

Confirmado por grep direto nos 5 hooks (`useQuotes.ts`, `useFinance.ts`, `useProjects.ts`,
`useTasks.ts` → 0 ocorrências de `supabase`; `useLeads.ts` → 1 ocorrência, é só o campo
`supabaseId?: string` da ponte de re-link, não um branch de leitura).

**Isso é esperado, não um desvio** — nenhuma fatia até aqui teve esse objetivo. A própria Fatia 1
(a referência) registra explicitamente: *"NÃO aposentar a flag experimental (fica em carência
reversível)"*. O molde "Espelho Reversível" tem 7 peças (§4 do diagnóstico); todas as fatias 1‑7
entregaram as peças **1 (repository), 2 (idempotência) e 3 (assistente de import)** — a peça
**e a prova dos invariantes (a)/(e)**. As peças **4 (seletor reversível), 5 (leitura
server-side) e 6 (escrita write-through)** só foram entregues, até hoje, para `clients` e
`client_technical_sheets`.

**Conclusão da pergunta 1:** o que resta do G1 não é um domínio sem cobertura — é o **cutover**
(peças 4‑6 do molde) para `opportunities`/`quotes`/`financial_transactions`/`projects`/`tasks`.
`opportunities` é a que está mais perto de pronta (ver §4).

¹ Metodologia: `grep -rn '["'`'`'"](kora\.|orbyt\.)[a-zA-Z0-9_.]+["'`'`'"]' src/` — 196 ocorrências,
cruzadas manualmente contra os hooks/flags/mappers que as leem.

---

## 2. Por domínio restante — produtores, consumidores, flags, banco

Detalhando os 5 domínios sem cutover (opportunities já com peça 4; os outros 4, nenhuma):

### `opportunities`
- **Produtor local:** `useLeads.ts` (`orbyt.leads.v1`, array plano) — CRUD local completo.
- **Produtor/consumidor Supabase:** `useSupabaseOpportunities.ts` (199 linhas) — **CRUD completo
  já implementado**: `createOpportunity`, `updateOpportunity`, `archiveOpportunity`,
  `deleteOpportunity`, `restoreDeletedOpportunity` (linhas 44‑168), todas via
  `crmOpportunitiesRepository`.
- **Repository:** `crmOpportunitiesRepository.ts` — `listOpportunities(workspaceId, {includeArchived, onlyDeleted})` (sem paginação, mas geral — não filtrado a um subcaso).
- **Flags na frente:** `kora.crm.dataSource.v1` (seletor, default `"supabase"` para leitura em
  telas específicas) + `kora.crm.supabaseWrite.enabled` (master flag de escrita, **default OFF**,
  gerencia create/edit/move/won/lost/archive/restore via `useSupabaseCrmWriteFlag.ts`).
- **Tabela:** `crm_opportunities` — RLS ✅, `source_local_id` ✅, `ux_crm_opp_source_local`
  (`UNIQUE`, `indisvalid=true`) ✅.
- **RPC:** nenhuma — todas as operações são CRUD direto, sem transação pai-filho (sem filhos).

### `quotes` (+ `quote_items`)
- **Produtor local:** `useQuotes.ts` (`orbyt.quotes.v1`, array com `items[]` aninhado) — zero
  referência a Supabase, CRUD 100% local.
- **Consumidor Supabase pontual:** só em telas específicas (`SupabaseQuotesViewerCard.tsx`,
  `CreateCrmSupabaseQuoteDialog.tsx`, `CreateReceivableDialog.tsx`, `CreateProjectFromQuoteDialog.tsx`,
  `LinkedQuotesSection.tsx`) — nenhuma leitura "geral" de lista de orçamentos via Supabase.
- **Repository:** `quotesRepository.ts` — `listQuotes(workspaceId)` (geral, sem paginação),
  `getQuote`, `createQuote`, `listQuoteItems`, `listQuoteItemsForQuotes`,
  `listQuotesByOpportunity` — **o mais completo dos 4 restantes**.
- **Flags na frente:** 4 flags booleanas opt-in, todas default OFF
  (`quotesSupabaseExperimental`, `quotesSupabaseCreateProject`,
  `quotesSupabaseCreateReceivable`, `quotesSupabaseApproval`) — nenhuma é um seletor de
  dataSource geral, cada uma liga um comportamento pontual dentro de um diálogo específico.
- **Tabela:** `quotes`/`quote_items` — RLS ✅, `source_local_id` ✅ (Fatia 3), RPC
  `import_quote_with_items` ✅ (transação pai-filho no import).
- **Gap conhecido:** **Q8** ([`etapa-5-fatia-3-quotes.md`](etapa-5-fatia-3-quotes.md)) — gap de
  paridade de schema, já catalogado, cross-referenciado com PT2.

### `financial_transactions`
- **Produtor local:** `useFinance.ts` (`orbyt.finance.v1` + 5 chaves auxiliares) — zero
  referência a Supabase.
- **Consumidor Supabase pontual:** só `CreateReceivableDialog.tsx` (criação de recebível
  derivado de quote).
- **Repository:** `financeRepository.ts` — **o mais parcial dos 4**: `listReceivables` é
  filtrado (`source='quote' AND type='receivable'` implícito pelo caminho de criação, não um
  `list` geral de todas as transações); sem `updateTransaction`/`deleteTransaction`/`archiveTransaction`
  gerais. **`@ts-nocheck`** no topo do arquivo (cross-ref com **B8**, tasklist #23).
- **Flags na frente:** nenhuma flag de dataSource — só o fluxo pontual do recebível-de-quote.
- **Tabela:** `financial_transactions` — RLS ✅, `source_local_id` ✅ (Fatia 6), `UNIQUE` parcial
  recebível-de-quote ✅ (Etapa 3 S5) + `source_local_id` geral (Fatia 6, coexistência de 2
  arbiters, mesmo padrão que projects/Fatia 7).
- **Maior risco:** é dinheiro — qualquer cutover aqui precisa do nível de cuidado da Fatia 6.

### `projects`
- **Produtor local:** `useProjects.ts` (`orbyt.projects.v1`) — zero referência a Supabase.
- **Consumidor Supabase pontual:** `CreateProjectFromQuoteDialog.tsx` (após o fix F5-equivalente
  da Fatia 7, já grava local também — item4), `CreateProjectBaseTasksDialog.tsx`.
- **Repository:** `projectsRepository.ts` — `listProjects(workspaceId)` (geral, sem paginação),
  `importProject` com a árvore de coexistência de 2 arbiters (Fatia 7).
- **Flags na frente:** `projectsSupabaseCreateBaseTasks` (opt-in, default OFF) — não é seletor
  de dataSource geral.
- **Tabela:** `projects` — RLS ✅, `source_local_id` ✅ (Fatia 7), 2 arbiters coexistindo
  (`ux_projects_from_quote` + `ux_projects_source_local`) ✅.
- **Gap conhecido:** **PT1** (TOCTOU do gerador de tarefas-base, catalogado, não bloqueante hoje
  porque o card que o aciona está desmontado).

### `tasks`
- **Produtor local:** `useTasks.ts` (`orbyt.tasks.v1`, com `subtasks[]`/`comments[]` aninhados)
  — zero referência a Supabase.
- **Consumidor Supabase pontual:** `CreateProjectBaseTasksDialog.tsx` (source='project_template'),
  `SupabaseOperationalDashboardCard.tsx` (**desmontado da UI publicada**, per Fase A da Fatia 7).
- **Repository:** `tasksRepository.ts` — **o mais estreito**: `listTasksByProject(workspaceId,
  projectId)` — só lista por projeto, **não existe** `listTasks(workspaceId)` geral (não dá pra
  fazer uma tela "todas as tarefas" via Supabase sem escrever esse método primeiro).
  `@ts-nocheck` no topo (mesmo cross-ref com B8).
- **Flags na frente:** `tasksSupabaseStatusTransition` (opt-in, default OFF).
- **Tabela:** `tasks` — RLS ✅, `source_local_id` ✅ (Fatia 7), sem `UNIQUE` geral fora do
  `source_local_id` (4 FKs de saída, maior fan-out de todos).
- **Gap conhecido:** **PT2** (3º nível `subtasks`/`comments` sem representação em nuvem,
  catalogado, cross-referenciado com Q8).

---

## 3. Medições — queries para o OPERADOR rodar (Code não acessa banco nem browser)

**Contagem local (demo vs. real):** exige devtools/console do navegador, ação do operador
(mesma restrição de todas as fatias anteriores). Se for útil calibrar o volume antes da Fase B,
rodar no console de produção:

```js
JSON.parse(localStorage.getItem('orbyt.leads.v1')  || '[]').length   // total oportunidades
JSON.parse(localStorage.getItem('orbyt.leads.v1')  || '[]').filter(l => !l.isDemo).length // reais
JSON.parse(localStorage.getItem('orbyt.quotes.v1') || '[]').length
JSON.parse(localStorage.getItem('orbyt.finance.v1')|| '[]').length
JSON.parse(localStorage.getItem('orbyt.projects.v1')|| '[]').length
JSON.parse(localStorage.getItem('orbyt.tasks.v1')  || '[]').length
```

**Contagem na nuvem (SQL Editor do Supabase):**

```sql
select 'crm_opportunities' as tabela, count(*) filter (where is_demo) as demo,
       count(*) filter (where not is_demo) as real, count(*) as total
from public.crm_opportunities
union all
select 'quotes', count(*) filter (where is_demo), count(*) filter (where not is_demo), count(*)
from public.quotes
union all
select 'financial_transactions', count(*) filter (where is_demo), count(*) filter (where not is_demo), count(*)
from public.financial_transactions
union all
select 'projects', count(*) filter (where is_demo), count(*) filter (where not is_demo), count(*)
from public.projects
union all
select 'tasks', count(*) filter (where is_demo), count(*) filter (where not is_demo), count(*)
from public.tasks;
```

Relevância específica para `opportunities` (candidata a Fatia 8, §4): a Fatia 2 homologou com
baseline **0 linhas** em `crm_opportunities` (2026-07-18). Se o assistente de import já foi usado
em produção real desde então, a query acima traz o volume atual — importante para calibrar o
runbook da Fase B (gate 1, export manual) antes de qualquer teste de escrita geral.

---

## 4. Proposta de recorte — Fatia 8

### Classificação provável: **regularização/completude de cutover** (não migração de dado nova)

Nenhum dos 5 domínios remanescentes precisa de *nova* migration de schema para o cutover básico
— `source_local_id` + `UNIQUE` já existem nos 5. O trabalho é: (a) construir/expandir o seletor
reversível de dataSource onde não existe; (b) decidir e homologar o comportamento de
escrita-through; (c) só então considerar retirar a flag.

### Recomendação: **Fatia 8 = cutover de `opportunities` (CRM Operacional)**

| Critério | Por quê ela ganha (mesmo raciocínio do §3 do diagnóstico original) |
|---|---|
| **Menor distância até pronto** | Único domínio (fora clients/technical_sheets) que já tem seletor de dataSource (`kora.crm.dataSource.v1`) **e** CRUD completo já implementado (`useSupabaseOpportunities.ts`, 5 operações). Falta homologar o flip da flag de escrita, não construir do zero. |
| **Sem filhos diretos no banco** | `crm_opportunities` não tem tabela-filha (ao contrário de quotes/quote_items) — nenhuma prova de atomicidade pai-filho necessária. |
| **Import já homologado 7/7** | Backstop de idempotência já provado em produção (Fatia 2, 2026-07-18) — reduz risco do cutover em cima dele. |
| **Menor risco monetário** | Não é dinheiro (ao contrário de `financial_transactions`) nem tem cascata de tarefas (ao contrário de `projects`/`tasks`). |
| **Fan-in existe mas é tolerante** | `finance`/`projects`/`tasks` referenciam `opportunity_id` com `SET NULL` — um cutover mal-feito não quebra FK de ninguém, só perde o vínculo (mesmo padrão de tolerância já usado em todas as fatias). |

**Runner-up, não recomendado agora:** `quotes` — repository quase tão maduro
(`listQuotes` geral já existe), mas tem `quote_items` (pai-filho) + é a entidade de maior fan-out
(financeiro, projetos, tarefas, opportunities todos penduram de quotes) — cutover errado aqui tem
blast radius maior. Fica como **Fatia 9** natural depois do molde de cutover provado em
`opportunities`.

**Não recomendado para esta rodada:** `financial_transactions` (dinheiro; repository ainda
parcial, precisa de CRUD geral antes de cogitar cutover) e `tasks` (repository mais estreito —
`listTasksByProject` só, sem `listTasks` geral; maior fan-out de FKs).

### Escopo sugerido para a Fase B de Fatia 8 (não iniciar sem "vai")

1. Auditar os 5 invariantes do molde especificamente para o **caminho de escrita** de
   `opportunities` (leitura já audita há 1 fatia; write-through nunca foi homologado).
   `kora.crm.supabaseWrite.enabled` hoje só gera/bloqueia UI — confirmar se `useLeads` (local)
   e `useSupabaseOpportunities` (nuvem) alguma vez escrevem **os dois** para a mesma ação
   (write-through real) ou se são dois caminhos paralelos que nunca se tocam (mais provável,
   a confirmar).
2. Decisão de design pendente: cutover **por-workspace** (estilo `clients`, tudo-ou-nada) ou
   **por-registro** (estilo ficha técnica, reversível por item)? `crm_opportunities` não tem
   granularidade natural por registro como a ficha técnica (1:1 com client_id) — provável que
   seja por-workspace, a confirmar em design.
3. Runbook de homologação da escrita: create/edit/move-de-stage/won/lost/archive/restore — 7
   operações a provar (mesmas do comentário de `useSupabaseCrmWriteFlag.ts:7`), cada uma com
   prova de zero-perda + reversibilidade.
4. Achado novo a catalogar (não bloqueante para o import já homologado, mas relevante para o
   cutover — ver §5): `Lead.history[]`/`Lead.tags[]` sem representação em `crm_opportunities`.

---

## 5. Riscos e paridades

### Achado novo — **O1**: `Lead.history[]` e `Lead.tags[]` sem representação em `crm_opportunities`

Mesma classe de achado que **Q8** (Fatia 3) e **PT2** (Fatia 7) — schema local tem campo(s) sem
contrapartida na nuvem. Confirmado por leitura direta:

- `Lead.history: {date, text}[]` ([`useLeads.ts:29`](../../src/hooks/useLeads.ts#L29)) e
  `Lead.tags?: string[]` ([`useLeads.ts:24`](../../src/hooks/useLeads.ts#L24)) existem no tipo
  local.
- A tabela `crm_opportunities` ([`20260530050000_create_crm_opportunities.sql`](../../supabase/migrations/20260530050000_create_crm_opportunities.sql))
  **não tem coluna para nenhum dos dois**.
- `crmOpportunityMapper.ts:94` confirma: no mapeamento nuvem→local, `history: []` é **hardcoded
  vazio** — não há tentativa de reconstrução, é reconhecido como perdido.
- **Classificação:** não bloqueante para o import já homologado (Fatia 2 não prometia
  histórico/tags na nuvem). **Bloqueante** para qualquer cutover de escrita completo de
  `opportunities` — se o usuário só passar a escrever na nuvem, `history`/`tags` implicitamente
  param de ser gravados em algum lugar visível, mesmo sem erro. Precisa de decisão explícita na
  Fase B: (a) adicionar colunas (JSONB para `history`, `text[]` para `tags`); ou (b) descontinuar
  os dois campos conscientemente, com aviso ao usuário.

### TOCTOUs conhecidos

Nenhum TOCTOU novo identificado nesta rodada de leitura para `opportunities`. Os dois já
catalogados (**PT1**, gerador de tarefas-base; e o cenário de corrida já coberto pelo
`ON CONFLICT` do `source_local_id` em todos os 7 domínios) continuam válidos e não têm
equivalente em `crm_opportunities` (sem geração em lote server-side).

### Vocabulário a traduzir

**Nenhum** para `opportunities` — `Lead.stage` (`StageKey`) já é gravado **literal** em
`crm_opportunities.stage` ([`crmOpportunityMapper.ts:48`](../../src/services/crm/crmOpportunityMapper.ts#L48):
`stage: lead.stage || "lead"`), ao contrário do par `orçamento`→`quote` (Fatia 7) ou
`income/expense`→`receivable/payable` (Fatia 6). Isso remove uma classe inteira de risco que as
duas fatias anteriores tiveram que endereçar.

---

**Fase A entregue e aprovada.** Segue abaixo o design de Fase B (§6), autorizado pelo "vai" do
revisor. Achado **O1** ([registrado em main](etapa-5-fatia-2-opportunities.md#10-o1--pendência-pós-fechamento-paridade-de-schema-localnuvem-bloqueia-cutover-de-escrita),
commit `7acd0fe`) passa de pendência catalogada a **requisito bloqueante desta fatia** (§6.2).

---

## 6. Fase B — Design do cutover de escrita de `opportunities`

### 6.0 Contexto arquitetural (achado que reformula as 7 perguntas)

Antes de responder item a item, um fato descoberto na leitura de `CRM.tsx` muda o formato do
problema: **o cutover de leitura já está, silenciosamente, ligado por padrão desde antes desta
fatia.**

- `CRM.tsx` chama **os dois hooks incondicionalmente** — `useLeads()` (local) e
  `useSupabaseOpportunities()` (nuvem) — todo render ([`CRM.tsx:137-175`](../../src/pages/CRM.tsx#L137)).
  Não é um branch condicional de qual hook rodar; é um **switch de qual resultado renderizar**
  (`activeDataSource`, [`CRM.tsx:167`](../../src/pages/CRM.tsx#L167)).
- `activeDataSource = workspace ? dataSource : "local"` — e `dataSource` vem de
  `getCrmDataSource()`, cujo default já é `"supabase"` (só `"local"` explícito escolhe local).
  **Ou seja:** todo usuário com workspace que nunca tocou no seletor **já está olhando para
  `crm_opportunities` hoje**, não para `orbyt.leads.v1`.
- O que **não** está ligado por padrão é a **escrita**: `blockWriteAction()` bloqueia toda ação
  (criar/editar/mover/arquivar/excluir) no modo Supabase a menos que
  `kora.crm.supabaseWrite.enabled` esteja `true` — e essa flag é opt-in, default `false`
  ([`useSupabaseCrmWriteFlag.ts:10`](../../src/hooks/useSupabaseCrmWriteFlag.ts#L10)).

**Consequência prática, já existente e não introduzida por esta fatia:** um usuário com
workspace e leads locais reais, que nunca tocou no seletor, já vê hoje um Kanban vazio (ou
parcial) vindo de `crm_opportunities` — e não consegue criar/editar nada ali até ligar a flag
manualmente em Configurações ou voltar para "Local". Isso reformula a "mecânica do cutover"
(§6.1): não é preciso inventar um mecanismo novo de troca de fonte — ele já existe e já roda em
produção. O que falta é **completar o lado de escrita** do mesmo mecanismo, e resolver o
**risco de dado pré-existente** que esse fato já estava criando silenciosamente (§6.3).

### 6.1 Mecânica do cutover — recomendação: **nenhuma das três opções literais**

Nem "flip do default do dataSource" (já é o default, não muda nada novo), nem "dual-write
transitório" (não existe — nunca existiu — um caminho que escreva nos dois lados ao mesmo tempo;
inventar um agora seria um retrocesso arquitetural, não um cutover), nem "troca seca no hook
`useLeads`" (removeria a única rede de segurança/reversibilidade que este design depende — ver
§6.6). A recomendação é a mesma mecânica que `client_technical_sheets`/`clients` já usam:

**Flipar o default de `kora.crm.supabaseWrite.enabled` de `false` para `true`**, mantendo:
- o seletor `kora.crm.dataSource.v1` intacto, com "Local" continuando disponível como opção
  explícita (carência, não removida);
- `useLeads()` e todo o caminho `orbyt.leads.v1` **intactos no código**, sem nenhuma linha
  removida — só deixam de ser o caminho **padrão** de escrita para quem nunca escolheu nada.

**Tensão a registrar:** o cabeçalho de `flags.ts` declara um "CONTRATO DE PRESERVAÇÃO DE
COMPORTAMENTO" (Etapa 4a) — "MESMO default de antes". Essa regra foi escrita para a
centralização de leitura de flags **já existentes**, não para proibir uma decisão de produto
deliberada de mudar um default. Registrar aqui, explicitamente, que **esta é a primeira exceção
consciente a esse contrato**, aprovada nominalmente pelo revisor nesta fatia — não um
descumprimento silencioso. Sessões que **já têm** o valor gravado (`true` ou `false`,
explicitamente) não são afetadas — só usuários que nunca tocaram na flag herdam o novo default.

**Rollback:** trivial e barato — reverter o default no código (uma constante), sem nenhuma
migração de dado em nenhuma direção (ver §6.6 para o detalhe completo).

### 6.2 Paridade de schema (O1) — decisão: **(a) migration nova, bloqueante desta fatia**

Diferente de Q8/PT2 (pendências para uma fatia *futura*), O1 vira **requisito de implementação
da própria Fatia 8** — porque esta fatia liga a escrita por padrão, e os dois campos são uso
real, não incidental:

- `tags` — grep em `CRM.tsx` confirma uso ativo: badge no card do Kanban
  ([`CRM.tsx:1082`](../../src/pages/CRM.tsx#L1082), [`:2116`](../../src/pages/CRM.tsx#L2116)),
  editor dedicado de tags (`setLeadTags`, [`CRM.tsx:1338`](../../src/pages/CRM.tsx#L1338)), e
  automações de pipeline que **adicionam tag automaticamente** ao mover de estágio
  ([`CRM.tsx:521`](../../src/pages/CRM.tsx#L521), `r.actions.addTag`). Perder isso silenciosamente
  no modo Supabase quebra uma automação configurada pelo usuário sem aviso.
- `history` — timeline de atividade renderizada no drawer de detalhe
  ([`CRM.tsx:2198`](../../src/pages/CRM.tsx#L2198), `lead.history.map(...)`) — visível, não um
  campo de debug.

**Recomendação:** migration aditiva, mesmo padrão de Q1 (Fatia 3)/F1 (Fatia 6)/F1 (Fatia 7):
`ALTER TABLE public.crm_opportunities ADD COLUMN tags text[]`,
`ADD COLUMN history jsonb DEFAULT '[]'::jsonb` — escrita nesta rodada, **não aplicada** (ver
arquivo em §6.8). Estender `crmOpportunityMapper.ts` nos dois sentidos (hoje: local→nuvem não
manda nenhum dos dois; nuvem→local zera `history` e nunca atribui `tags`) — implementação
entra no escopo obrigatório da Fase C, não é opcional.

**Fora de escopo desta migration:** backfill de `history`/`tags` de registros que eventualmente
já tenham sido criados em `crm_opportunities` antes desta fatia (baseline era 0 linhas em
2026-07-18, por Fatia 2 §9 — improvável mas não confirmado; medir com a query do §3 antes da
Fase C).

### 6.3 Dados pré-existentes — import vira **gate obrigatório antes do flip**, órfãs continuam aviso

O fato do §6.0 (leitura já default-Supabase) faz este item ser o mais crítico do design: **não é
o cutover que arrisca dado pré-existente — é a combinação do cutover de escrita com um import
nunca rodado.** Um usuário com leads locais reais, nunca importadas, que ganha escrita-padrão em
Supabase, passa a **criar dado novo do lado errado** enquanto o dado antigo fica invisível (não
perdido — ver §6.6 — mas invisível).

**Recomendação:** o assistente de import (`useLocalOpportunitiesImport.ts`, já homologado 7/7 na
Fatia 2) vira **pré-condição de runbook, não pré-condição de código** — ou seja, não bloquear
teecnicamente a escrita, mas o runbook de Fase C exige, para cada workspace de teste: (1) medir
`orbyt.leads.v1` local (reais, não-demo); (2) se > 0 e nenhuma delas está em
`kora.crm.supabaseImport.v1.importedMap`, **rodar o import antes** de considerar o flip seguro
para aquele cenário. Órfãs de cliente (FK não resolvida) continuam **aviso, nunca bloqueio** —
mesmo invariante de todas as fatias anteriores.

**Nota de escopo — fora desta fatia:** decidir uma migração **em massa**, automática, para todos
os workspaces de produção existentes (rodar o import para todo mundo, de uma vez, no dia do
flip) é uma decisão operacional maior que uma Fase C de fatia deveria tomar sozinha — fica
registrado como pergunta em aberto para o "vai" de Fase C, não respondida aqui.

### 6.4 Convivência com o campo-ponte (`Lead.supabaseId`) — **mantido, não removido**

`Lead.supabaseId?: string` ([`useLeads.ts:50`](../../src/hooks/useLeads.ts#L50)) é a ponte de
re-link que a Fatia 2 já prova funcionar (§9, prova 7: `tx-homolog-1.opportunityId` resolve via
`importedMap`). Enquanto `useLeads()`/`orbyt.leads.v1` continuarem existindo no código (§6.1 —
não são removidos, só deixam de ser o padrão), esse campo continua sendo o único jeito de um
lead local pré-cutover se religar ao registro Supabase equivalente. Removê-lo **quebraria** o
fan-in de finance/projects/tasks para qualquer lead criado antes do flip. Fica mantido
indefinidamente, sem prazo de remoção associado ao desta fatia — sua remoção só faria sentido no
dia em que `useLeads()` for de fato apagado (fora de escopo, ver §6.5).

### 6.5 Flags — `kora.crm.supabaseWrite.enabled` continua sendo a única, com plano de morte explícito

Nenhuma flag nova — usar a que já existe. **Default novo: `true`** (§6.1). Aprendizado da Etapa 4
(flag sem plano de morte vira dívida assumida, ver decisão C6 de `clients` no
[protocolo §10](protocolo-homologacao.md#10-emenda-2026-07-20--regularização-de-p5-para-clients-dívida-assumida-sem-homologação-retroativa)):
esta fatia define o **critério de retirada**, não a data.

**Critério de retirada (registrado, não executado nesta fatia):** a flag e o seletor
`kora.crm.dataSource.v1` só saem de "carência" quando, cumulativamente: (1) zero incidente de
escrita reportado por ≥ 1 ciclo de homologação real (não sintética) após o flip; (2) query
`select count(*) from crm_opportunities` confirma volume condizente com o uso esperado (não
zero, não estagnado); (3) uma fatia futura explicitamente proponha a remoção de `useLeads()` do
CRM (equivalente ao que nunca foi feito para `clients`/`client_technical_sheets` até hoje — ou
seja, pode nunca acontecer, e isso é aceitável, desde que seja uma decisão consciente e não uma
omissão).

### 6.6 Reversibilidade — runbook de rollback explícito

**O que desligar:** reverter o default de `kora.crm.supabaseWrite.enabled` para `false` no
código (1 constante) — **OU**, por workspace individual, o próprio usuário troca
`kora.crm.dataSource.v1` de volta para `"local"` via UI, sem precisar de deploy.

**O que acontece com o dado, em cada direção:**
- **Voltando para "Local":** `orbyt.leads.v1` nunca foi tocado enquanto o workspace esteve em
  modo Supabase (§6.0 — os dois hooks rodam em paralelo, mas só um é lido; o outro nunca
  escreve) — **100% intacto**, leitura volta a mostrar exatamente o que havia antes,
  incluindo leads criadas antes do cutover. Mesmo invariante (d) do molde, já provado por
  clients/ficha técnica.
- **Dado criado em Supabase durante a janela com escrita ligada:** **não é apagado** ao reverter
  a flag — só some da tela se o usuário também trocar para "Local" (fica em
  `crm_opportunities`, resgatável religando o seletor para "Supabase" a qualquer momento,
  agora em modo leitura se a flag de escrita voltou a `false`). Nenhuma direção do rollback
  perde dado — o pior caso é perda de **visibilidade** temporária, sempre reversível.

### 6.7 Runbook de homologação (tabela de casos) — desenho, seed sintético (emenda §11)

Todo caso usa **cliente e oportunidade sintéticos próprios** (`HOMOLOG-F8-cliente`,
`HOMOLOG-F8-opp`) — nenhum dado real é alvo de escrita ou vínculo (emenda §11). Cenário base:
1 cliente sintético + 1 oportunidade sintética pré-existente (criada via seed SQL direto,
simulando "já estava na nuvem antes do flip") + 1 lead local sintético não-importado (simulando
o risco do §6.3).

| Caso | Cenário | Resultado esperado |
|---|---|---|
| (a) leitura pós-flip, default | Workspace de teste nunca tocou o seletor nem a flag | Kanban mostra `HOMOLOG-F8-opp` (Supabase), **não** o array local — confirma §6.0 |
| (b) criar | Escrita ligada por padrão; criar oportunidade nova pela UI | Linha nova em `crm_opportunities`, `orbyt.leads.v1` **não** ganha entrada nova |
| (c) editar campo básico | Editar `company`/`email` de `HOMOLOG-F8-opp` | `UPDATE` na linha Supabase; local intacto |
| (d) mover de estágio | Drag-and-drop ou ação de mover estágio | `stage` atualizado; se houver automação de tag (§6.2), `tags` grava e persiste (prova O1) |
| (e) arquivar/restaurar | Arquivar `HOMOLOG-F8-opp`, depois restaurar | Arquivar: OK (`persistArchiveSupabase`). **Restaurar: ESPERADO VERMELHO** — `handleUnarchiveClick` chama `archiveLead` local, não `persistArchiveSupabase` (**O3**, §6.9) |
| (f) excluir (soft) + restore | Soft-delete + `restoreDeletedOpportunity` **via a UI real (ícone de lixeira do card/lista)** | **ESPERADO VERMELHO** — o `onDelete` do card/lista chama `deleteLead` local incondicionalmente, nunca `persistSoftDeleteSupabase` (**O2**, §6.9); `handleDeleteClick`, que faria isso certo, existe mas está morto (nunca chamado) |
| (g) tags/history (O1) | Criar com 2 tags + 1 entrada de histórico, reler | Migration+mapper: OK (prova a coluna/tradução). **Editar tags pela UI real (`EditTagsDialog`): ESPERADO VERMELHO** — `setLeadTags` é sempre local, nunca grava em `crm_opportunities` (**O4**, §6.9) |
| (h) import pré-flip, gate §6.3 | Lead local sintético não-importado, workspace ainda sem `crm_opportunities` — rodar o assistente de import antes do teste de escrita | Import homologa 1/1 (mesmo runbook da Fatia 2); só depois disso a escrita é considerada "segura" para este cenário |
| (i) offline/falha do Supabase | Simular erro de rede numa chamada de escrita (mock de erro no repository) | Erro é propagado à UI (toast de falha) — **nunca** um fallback silencioso que grave em `orbyt.leads.v1` como substituto |
| (j) idempotência do reimport | Reimportar o mesmo lead do caso (h) uma 2ª vez | "Já Importada", 0 duplicata — mesma prova 3 da Fatia 2 |
| (k) rollback | Reverter a flag de escrita para OFF, ou trocar dataSource para "Local" | Dado criado nos casos (b)-(g) continua em `crm_opportunities` (não some); `orbyt.leads.v1` continua intacto o tempo todo — prova §6.6 |

**Critério de aceite revisado (pós-§6.9): 8/11 verde + 3 vermelho catalogado (O2/O3/O4), não
9/11 nem 11/11 maquiado.** Os 3 vermelhos são bugs pré-existentes confirmados por leitura de
código antes mesmo da Fase C rodar (§6.9), não falhas de implementação desta fatia — mesmo
critério da Fatia 7 caso (g): reportar vermelho real, não disfarçar com SQL manual. Sem caso de
atomicidade pai-filho — `crm_opportunities` não tem tabela-filha (mesma lógica de
finance/Fatia 6). Gates 1 (export manual) e 2 (print pré-clique) aplicam normalmente a cada caso
de escrita.

### 6.8 Migration escrita, não aplicada

`supabase/migrations/20260723000100_etapa5_fatia8_opportunities_add_tags_history.sql` — 2
`ADD COLUMN` (`tags text[]`, `history jsonb DEFAULT '[]'::jsonb`), sem `UNIQUE`/índice novo (não
faz parte de nenhuma chave de idempotência), **não precisa de autocommit** (nenhum
`CREATE INDEX CONCURRENTLY` envolvido, roda dentro de transação normal).

### 6.9 Pré-condições verificadas antes da Fase C (leitura de código, nenhum código alterado)

#### (a) Comportamento ATUAL de escrita com a flag OFF — nem "bloqueia" nem "escreve local" de forma uniforme

A pergunta pressupunha uma resposta binária; a leitura de código (`CRM.tsx`) mostra as duas coisas
coexistindo, **por ação**:

| Ação | Com flag OFF hoje | Com flag ON (o que a Fase C liga por padrão) |
|---|---|---|
| Criar | ✅ Bloqueia (`isCreateOpportunityEnabled=false` → dialog não chama nada) | ✅ Correto — `crmOpportunitiesRepository.createOpportunity` (`CRM.tsx:1170`) |
| Editar campo básico | ✅ Bloqueia (`blockWriteAction(false,true)`, `CRM.tsx:1211`) | ✅ Correto — `crmOpportunitiesRepository.updateOpportunity` (`CRM.tsx:1237`) — **mas não inclui `tags`/`history` no `allowedPatch`** (esperado, são O1, tratados à parte) |
| Mover de estágio | ✅ Bloqueia (`blockWriteAction(true)`, `CRM.tsx:536`) | ✅ Correto (via `persistArchiveSupabase`-equivalente de stage, não auditado linha-a-linha aqui — fora do escopo desta fatia) |
| Arquivar | ✅ Bloqueia (`handleArchiveClick`, `CRM.tsx:250-253`) | ✅ Correto — `persistArchiveSupabase(id, true)` (`CRM.tsx:1380`) |
| **Restaurar (unarchive)** | ✅ Bloqueia com toast de erro (`CRM.tsx:281-284`) | 🔴 **BUG confirmado — O3:** `handleUnarchiveClick` (`CRM.tsx:285`) chama `archiveLead(leadId, false)` — a função **local** — mesmo dentro do branch `activeDataSource === "supabase"` com a flag ligada. `persistArchiveSupabase(id, false)` existe e seria a chamada certa, mas nunca é usada para restaurar. **Achado direto da flag flip desta fatia: hoje é um bug raro (só quem já ligou a flag manualmente hoje encontra); a partir do item 2 desta Fase C, vira o comportamento padrão de TODO usuário.** |
| **Excluir** | 🔴 **BUG confirmado — O2:** o ícone de lixeira do card (`CRM.tsx:1010-1015`) e da linha de tabela (`CRM.tsx:1101-1104`) chama `deleteLead(lead.id)` **sem NENHUM gate de `activeDataSource`/flag** — não importa o estado da flag. `handleDeleteClick` (`CRM.tsx:261`), que faz a coisa certa (`persistSoftDeleteSupabase` via diálogo de confirmação), está **morto** — grep confirma zero chamadas a ele em todo o arquivo. | 🔴 Mesmo bug, flag não muda nada — o gate nunca é alcançado |
| **Editar tags** | 🔴 **BUG confirmado — O4:** `EditTagsDialog.onSave` (`CRM.tsx:1338`) chama `setLeadTags` (local) **incondicionalmente**, sem checar `activeDataSource`. Mesmo depois da migration O1 (§6.2) + mapper (item 4 da Fase C) existirem, este caminho de UI específico continua não gravando tag nenhuma em `crm_opportunities` até ser corrigido à parte. | 🔴 Mesmo bug |

**Por que os 3 são silenciosos e não óbvios ao usuário:** `lead.id` para um registro de origem
Supabase é `stableNumericIdFromUuid(opportunity.id)` — um hash determinístico, não um id do
array local. `deleteLead`/`archiveLead`/`setLeadTags` chamados com esse hash contra
`orbyt.leads.v1` **não encontram nada para alterar** (no-op), mas os três `toast.success(...)`
dessas chamadas disparam incondicionalmente, então a UI **informa sucesso** onde nada aconteceu
de fato no lado certo do dado.

**Classificação, mesmo critério do F5-equivalente/PT1 já usado nesta etapa:** os 3 são
**reachable em produção, sem flag que os esconda** (excluir e editar-tags já são bugs vivos
HOJE, com a flag OFF; restaurar se torna um bug vivo padrão assim que o item 2 desta Fase C
rodar). Registrados como **O2, O3, O4** — catalogados, **não corrigidos nesta rodada** (fora do
escopo explícito do prompt: "NADA além… import intocado"). Reflexo no runbook: §6.7, casos
(e)/(f)/(g) foram marcados com o resultado esperado real (vermelho parcial), não maquiados para
"verde" — mesmo padrão do caso (g) da Fatia 7.

**Nota para o revisor:** O3 é uma consequência direta do item 2 desta própria Fase C (o flip do
default transforma O3 de "bug raro, opt-in" em "bug padrão, todo usuário") — sinalizado aqui
antes do código para que a decisão de prosseguir seja informada, não descoberta depois do fato.
Sigo para os itens 1-5 exatamente como escopados (catalogar, não corrigir), aguardando
instrução em contrário.

#### (b) Migration — colunas nullable, sem rewrite, tipos justificados

- `tags text[]` — sem `NOT NULL`, sem `DEFAULT` → coluna nova sempre `NULL` para linhas
  existentes, **metadata-only** (Postgres não reescreve a tabela para uma coluna nullable sem
  default). Tipo `text[]` — espelha `Lead.tags?: string[]` 1:1, array nativo evita
  round-trip de JSON para uma lista simples de strings.
- `history jsonb DEFAULT '[]'::jsonb` — tem `DEFAULT`, mas é uma **constante não-volátil**
  (`'[]'::jsonb`) — desde o Postgres 11, `ADD COLUMN ... DEFAULT <constante>` também é
  metadata-only (não reescreve linhas existentes; o Supabase roda em versões muito mais novas
  que isso). Tipo `jsonb` (não uma tabela dedicada) — mesma razão de PT2 (Fatia 7): é um array
  pequeno, append-only, sem necessidade de modelagem relacional própria.

---

**PARADO aqui.** Design de Fase B entregue (§6.0-§6.8) + pré-condições da Fase C verificadas
(§6.9) — as 7 decisões pedidas, o achado arquitetural do §6.0 (leitura já default-Supabase, não
previsto na Fase A), 3 bugs pré-existentes catalogados (O2/O3/O4, um deles — O3 — diretamente
agravado pelo item 2 desta própria fatia), a migration escrita (não aplicada) e o runbook de 11
casos revisado para refletir os 3 vermelhos esperados. **NADA EXECUTA sem o "vai" literal do
revisor, colado neste chat pelo operador** — inclusive a implementação de Fase C.
