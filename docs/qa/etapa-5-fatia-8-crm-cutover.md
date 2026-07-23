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
| (e) arquivar/restaurar | Arquivar `HOMOLOG-F8-opp`, depois restaurar | Arquivar: OK (`persistArchiveSupabase`). Restaurar: OK — `handleUnarchiveClick` agora chama `persistArchiveSupabase(id, false)` sob a flag (**O3, corrigido**, ver §6.9) |
| (f) excluir (soft) + restore | Soft-delete + `restoreDeletedOpportunity` **via a UI real (ícone de lixeira do card/lista)** | OK — `onDelete` do card/lista agora chama `handleDeleteClick`, que gateia por `activeDataSource`/flag e usa `persistSoftDeleteSupabase` em modo Supabase (**O2, corrigido**, ver §6.9) |
| (g) tags/history (O1) | Criar com 2 tags + 1 entrada de histórico, reler | OK — migration+mapper provam a coluna/tradução; `EditTagsDialog.onSave` agora gateia e chama `persistTagsSupabase` (`updateOpportunity` com `tags`) em modo Supabase (**O4, corrigido**, ver §6.9) |
| (h) import pré-flip, gate §6.3 | Lead local sintético não-importado, workspace ainda sem `crm_opportunities` — rodar o assistente de import antes do teste de escrita | Import homologa 1/1 (mesmo runbook da Fatia 2); só depois disso a escrita é considerada "segura" para este cenário |
| (i) offline/falha do Supabase | Simular erro de rede numa chamada de escrita (mock de erro no repository) | Erro é propagado à UI (toast de falha) — **nunca** um fallback silencioso que grave em `orbyt.leads.v1` como substituto |
| (j) idempotência do reimport | Reimportar o mesmo lead do caso (h) uma 2ª vez | "Já Importada", 0 duplicata — mesma prova 3 da Fatia 2 |
| (k) rollback | Reverter a flag de escrita para OFF, ou trocar dataSource para "Local" | Dado criado nos casos (b)-(g) continua em `crm_opportunities` (não some); `orbyt.leads.v1` continua intacto o tempo todo — prova §6.6 |

**Critério de aceite: 11/11 casos verdes.** Os 3 achados O2/O3/O4 (§6.9), confirmados por
leitura de código antes da Fase C rodar, foram corrigidos em código antes de qualquer aplicação
de migration — commits `9c1e893` (O3), `1ff7abf` (O2), `42125be` (O4), cada um com teste
dedicado provando as 3 condições (flag ON grava na nuvem, modo Local preserva o comportamento de
sempre, flag OFF bloqueia sem nenhum toast de sucesso falso). Sem caso de atomicidade pai-filho —
`crm_opportunities` não tem tabela-filha (mesma lógica de finance/Fatia 6). Gates 1 (export
manual) e 2 (print pré-clique) aplicam normalmente a cada caso de escrita.

### 6.8 Migration — escrita e **APLICADA** (2026-07-23, sob §8/emenda §13)

`supabase/migrations/20260723000100_etapa5_fatia8_opportunities_add_tags_history.sql` — 2
`ADD COLUMN` (`tags text[]`, `history jsonb DEFAULT '[]'::jsonb`), sem `UNIQUE`/índice novo (não
faz parte de nenhuma chave de idempotência), **não precisou de autocommit** (nenhum
`CREATE INDEX CONCURRENTLY` envolvido, rodou dentro de transação normal).

**Aplicada pelo operador via `psql`** (credencial referenciada só via `$DATABASE_URL`/`PGPASSWORD`
na sessão do operador, nunca lida/impressa pelo Code — emenda §13, sem arquivo intermediário).
Output bruto:

```
ALTER TABLE
COMMENT
COMMENT
```

**Verificação pós-aplicação** (item (b) do §6.9, confirmado na prática):

```
 column_name | data_type | column_default
-------------+-----------+----------------
 history     | jsonb     | '[]'::jsonb
 tags        | ARRAY     |
(2 linhas)
```

Bate exatamente com o esperado — `history` com o default constante, `tags` sem default, nenhum
erro em nenhuma das duas etapas. Item 1 da Fase C encerrado.

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

### 6.10 Correção de O2/O3/O4 — feita ANTES de qualquer migration (revisor, 2026-07-23)

Decisão do revisor: os 3 achados do §6.9 não ficam catalogados-só — são corrigidos em código,
antes de aplicar a migration O1 (item 1 da Fase C), porque cada um vira o comportamento **padrão**
assim que a escrita em Supabase estiver ligada por padrão (esta própria fatia). Um commit por
bug, cada um com teste dedicado provando as 3 condições (flag ON grava na nuvem / modo Local
preserva o comportamento de sempre / flag OFF bloqueia sem nenhum toast de sucesso falso):

- **O3** (`9c1e893`) — `handleUnarchiveClick` passa a chamar `persistArchiveSupabase(id, false)`
  em vez de `archiveLead` local. Ajuste complementar: o toast de `persistArchiveSupabase` agora
  depende da direção ("arquivada" vs "restaurada"), já que a função passa a servir os dois
  caminhos.
- **O2** (`1ff7abf`) — os dois `onDelete` (card do Kanban e linha da tabela) passam a chamar
  `handleDeleteClick(lead.id)`, que já existia e já fazia certo (bloqueia com a flag off; abre o
  diálogo de soft-delete via `persistSoftDeleteSupabase` com a flag on) — estava só desconectado
  da UI (dead code).
- **O4** (`42125be`) — nova função `persistTagsSupabase` (par Supabase de `setLeadTags`, mesmo
  padrão de `persistArchiveSupabase`/`persistSoftDeleteSupabase`); `EditTagsDialog.onSave` agora
  gateia por `activeDataSource`/flag antes de decidir entre ela e o `setLeadTags` local.

Runbook (§6.7) e critério de aceite atualizados de volta para **11/11** — os 3 casos (e)/(f)/(g)
não são mais vermelho esperado.

**Correção de processo (item 5 do prompt desta rodada):** a entrega anterior deste chat pediu ao
operador um arquivo de credencial para a aplicação da migration (item 1) — a emenda §13 do
protocolo não proíbe o arquivo em si (ela existe justamente para o caso em que um arquivo *é*
usado), mas o revisor determinou que, nesta fatia, a aplicação da migration usa exclusivamente
`$env:DATABASE_URL`/`PGPASSWORD` setado pelo operador na sessão, sem arquivo intermediário.
Aplicada assim (§6.8) — sem arquivo, credencial nunca lida/impressa pelo Code.

**Incidente de sessão (registrado, não catalogado como novo achado):** durante a tentativa de
aplicação, a senha do banco apareceu em texto puro no chat por 3 vezes (print + 2 mensagens de
texto), sempre por ação do operador ao colar a connection string completa em vez de só os
valores nos placeholders. O Code recusou usá-la a cada vez e não a reproduziu em nenhuma
resposta. Recomendada rotação da senha após o fechamento desta rodada, independente do sucesso
da aplicação — mesmo critério do desvio de credencial nº 1 da Fatia 7 (emenda §13).

---

## 7. Fase D — Runbook executável da homologação (11 casos) — PRONTO PARA EXECUÇÃO

> **Nota de versão:** §6.7 era só a tabela de desenho (proposta). O texto executável abaixo
> (§7.1-§7.5) foi acrescentado depois da implementação (Fase C) e da aplicação da migration O1,
> sem alterar as letras/conteúdo dos casos já aprovados. **Nada foi executado ainda** — os
> artefatos abaixo (seed, SQL, passos, limpeza) estão prontos para colar, aguardando o "vai"
> literal do revisor. A execução é do operador, com revisão passo a passo.

**Diferença crítica em relação à Fatia 7:** `crm_opportunities` **tem dados reais** (Fatia 2 já
homologou em produção; uso real desde então). Emenda §11 do protocolo (dado real é só-leitura em
homologação) aplica com força total aqui — nenhum caso lê o volume real para calibrar nada, e
nenhum caso cria linha com FK apontando pra cliente/quote real. Prefixo `HOMOLOG-F8-` no título de
toda oportunidade sintética + `HOMOLOG-F8-lead-import` no lead local sintético — nenhum dos dois
reaproveita nome/id de dado real.

**Simplificação registrada:** o caso (d) do §6.7 previa testar a automação de tag-ao-mover-estágio
junto com o move de stage. Configurar uma automação de pipeline pelo UI adicionaria complexidade
de setup sem prova adicional — a prova de tags (O1/O4) já é coberta em profundidade pelo caso (g).
(d) aqui testa só o move de estágio isolado.

**Achado registrado (não bloqueante, escopo fora desta fatia):** não existe caminho de UI que
escreva em `history` do lado Supabase (nem em criar, nem em mover de estágio) — ao contrário do
`useLeads` local, que grava automaticamente. Isso não foi pedido nem corrigido nesta fatia (O2/O3/O4
são sobre excluir/restaurar/tags, não sobre gravação automática de histórico). O caso (g) abaixo
prova a coluna via SQL direto (round-trip de leitura), não via UI — consistente com a realidade do
código, não maquiado.

### 7.1 Pré-requisito — baseline + checagem dos 2 seletores (operador roda, SÓ LEITURA)

Workspace de teste (mesmo das Fatias 1-7): `2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9`.

```sql
-- (1) Baseline — contagem de oportunidades ATIVAS antes de semear qualquer coisa. Guardar o
-- número: é o alvo de "volta ao normal" da limpeza do §7.5 (NÃO é 0 — há oportunidades reais no
-- workspace; só não pode sobrar nenhum HOMOLOG-F8-* depois da limpeza).
select count(*) as opps_baseline
from public.crm_opportunities
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and deleted_at is null;
```

```js
// (2) Checagem dos 2 seletores desta sessão de navegador — anote os dois valores atuais antes
// de mexer em qualquer um (pra restaurar exatamente esse estado depois, se precisar).
console.log("dataSource atual:", localStorage.getItem("kora.crm.dataSource.v1"));
console.log("supabaseWrite atual:", localStorage.getItem("kora.crm.supabaseWrite.enabled"));
```

### 7.2 Seed — oportunidades SINTÉTICAS (SQL) + lead local sintético (JS)

#### 7.2.1 SQL — cria as 2 oportunidades sintéticas de homologação

```sql
-- Oportunidade principal — usada nos casos (a) leitura, (c) editar, (d) mover estágio,
-- (e) arquivar/restaurar (O3), (g) tags+history (O4/O1). Sem source_local_id — simula "já
-- nativa na nuvem", não veio de import.
insert into public.crm_opportunities
  (workspace_id, title, stage, status, potential_value, is_demo, archived)
values
  ('2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9', 'HOMOLOG-F8-opp', 'lead', 'open', 1000, false, false)
returning id;
-- guarde o id -> vira <HOMOLOG_OPP_UUID> nas provas de 7.4 (a)/(c)/(d)/(e)/(g)
```

```sql
-- Oportunidade dedicada ao caso (f) — separada da principal pra não colidir com os outros
-- casos que rodam antes dela na sequência do §7.3.
insert into public.crm_opportunities
  (workspace_id, title, stage, status, potential_value, is_demo, archived)
values
  ('2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9', 'HOMOLOG-F8-opp-excluir', 'lead', 'open', 500, false, false)
returning id;
-- guarde o id -> vira <HOMOLOG_OPP_DELETE_UUID> na prova de 7.4 (f)
```

#### 7.2.2 JS (console do navegador, produção) — lead local para o gate de import (§6.3)

```js
// Etapa 5 · Fatia 8 (opportunities) — SEED do lead local não-importado. Preserva o que já
// existe em orbyt.leads.v1. Prefixo "HOMOLOG-F8-".
const existingLeads = JSON.parse(localStorage["orbyt.leads.v1"] || "[]");
const nowIso = new Date().toISOString();

const seedLead = {
  id: 880001,
  name: "HOMOLOG-F8-lead-import",
  company: "", email: "", phone: "",
  serviceType: "Geral",
  estimatedValue: 300,
  priority: "média",
  lastInteraction: nowIso,
  stage: "lead", pipelineId: "default", stageId: "lead",
  tags: [], archived: false, description: "",
  history: [{ date: nowIso.slice(0, 10), text: "Lead criado (seed homologação)" }],
  notes: "", isDemo: false,
};

localStorage.setItem("orbyt.leads.v1", JSON.stringify([...existingLeads, seedLead]));
console.log("✅ Seed F8 gravado:", seedLead.id, seedLead.name);
// esperado: 880001 "HOMOLOG-F8-lead-import"
```

### 7.3 Passos do operador, em ordem

| # | ONDE | O que fazer | O que anotar | Verde quando |
|---|---|---|---|---|
| 1 | SQL Editor | Rodar baseline (§7.1.1) | `opps_baseline` | número anotado |
| 2 | Console do navegador (produção) | Rodar checagem dos seletores (§7.1.2) | os 2 valores atuais | anotado |
| 3 | SQL Editor | Rodar as 2 queries de seed (§7.2.1) | os 2 `id` retornados → `<HOMOLOG_OPP_UUID>` / `<HOMOLOG_OPP_DELETE_UUID>` | 2 linhas criadas |
| 4 | Console do navegador (produção) | Rodar o seed JS (§7.2.2) | log "✅ Seed F8 gravado: 880001" | sem erro no console |
| 5 | Navegador | **F5** (recarregar a página inteira, não só reabrir o CRM) | — | página recarrega |
| 6 | App → CRM | Se os seletores do passo 2 tinham algum valor, limpar os dois: Configurações → CRM (ou console: `localStorage.removeItem("kora.crm.dataSource.v1")` e `localStorage.removeItem("kora.crm.supabaseWrite.enabled")`) + **F5** de novo | — | os dois ausentes |
| 7 | App → CRM | Abrir a tela do CRM | Kanban mostra `HOMOLOG-F8-opp`; **não** mostra nenhum lead do array local antigo | ✅ **caso (a)** — leitura default já é Supabase, sem tocar em nada (confirma §6.0) |
| 8 | App → CRM | Clicar **Nova oportunidade**, título `HOMOLOG-F8-criada`, valor 700, salvar | toast de sucesso | linha aparece no Kanban |
| 9 | SQL Editor | Rodar prova 7.4 **(b)** | — | 1 linha nova, `source_local_id IS NULL` |
| 10 | App → CRM | Abrir `HOMOLOG-F8-opp`, editar `company` para `"Empresa Teste F8"`, salvar | toast "salvas com sucesso" | — |
| 11 | SQL Editor | Rodar prova 7.4 **(c)** | — | ✅ `company` atualizada na nuvem |
| 12 | App → CRM | No card `HOMOLOG-F8-opp`, menu ⋮ → **Mover para etapa** → qualquer etapa diferente da atual | toast — | — |
| 13 | SQL Editor | Rodar prova 7.4 **(d)** | — | ✅ `stage` mudou na nuvem |
| 14 | App → CRM | Menu ⋮ do card `HOMOLOG-F8-opp` → **Arquivar** | toast "arquivada com sucesso" | card some da lista padrão |
| 15 | App → CRM | Clicar **Arquivados** (mostrar arquivados) → achar `HOMOLOG-F8-opp` → menu ⋮ → **Restaurar** | toast **"restaurada com sucesso"** (não "arquivada") | ✅ **caso (e), prova O3** — se o toast disser "arquivada" em vez de "restaurada", ou se não aparecer nada, é vermelho |
| 16 | SQL Editor | Rodar prova 7.4 **(e)** | — | ✅ `archived=false`, `deleted_at IS NULL` |
| 17 | App → CRM | Card `HOMOLOG-F8-opp-excluir` → menu ⋮ → **Excluir lead** | abre diálogo "Excluir oportunidade?" | diálogo aparece (não é um `window.confirm` cru) |
| 18 | App → CRM | Marcar a caixa "Entendo que esta oportunidade será removida..." → **Excluir oportunidade** | toast de sucesso | ✅ **caso (f), prova O2** — se o card sumir sem nenhum diálogo aparecer, ou se não sumir mas mostrar sucesso, é vermelho |
| 19 | SQL Editor | Rodar prova 7.4 **(f)** | — | ✅ `deleted_at` preenchido, linha não removida fisicamente |
| 20 | App → CRM | Card `HOMOLOG-F8-opp` → menu ⋮ → **Editar tags** → digitar `vip`, Enter → digitar `homolog`, Enter → **Salvar** | toast "Tags atualizadas" | — |
| 21 | SQL Editor | Rodar prova 7.4 **(g), parte tags** | — | ✅ `tags = {vip,homolog}` |
| 22 | SQL Editor | Rodar a escrita direta de `history` (7.4 (g), parte history) — via SQL, não via UI (ver achado registrado acima) | — | `UPDATE 1` |
| 23 | App → CRM | Reabrir o card `HOMOLOG-F8-opp` (clique no card, não no menu ⋮) | drawer de detalhe mostra a entrada de histórico gravada no passo 22 | ✅ **caso (g)** completo — tags via UI real, history via leitura real do que foi gravado |
| 24 | DevTools → Network | Marcar **Offline** (throttling) | — | — |
| 25 | App → CRM | Tentar editar `company` de `HOMOLOG-F8-opp` de novo → salvar | toast de **erro** ("Erro ao salvar alterações...") | ✅ **caso (i)** — se em vez de erro aparecer sucesso, é vermelho (fallback silencioso) |
| 26 | DevTools → Network | Desmarcar **Offline** | — | volta ao normal |
| 27 | App → Configurações | Abrir **Importar Oportunidades Locais** | candidato `HOMOLOG-F8-lead-import` aparece como **Novo** | — |
| 28 | App → Configurações | Selecionar o candidato → **Importar selecionados** | toast "1 oportunidade importada" | ✅ **caso (h)** |
| 29 | SQL Editor | Rodar prova 7.4 **(h)** | — | 1 linha, `source_local_id` preenchido (guardar valor) |
| 30 | App → Configurações | Reabrir **Importar Oportunidades Locais** de novo | candidato aparece como **Já Importada** | — |
| 31 | App → Configurações | Marcar de novo (se permitir) e **Importar selecionados** | toast — nenhuma duplicata | ✅ **caso (j)** |
| 32 | SQL Editor | Rodar prova 7.4 **(j)** | — | `count = 1` (nunca 2) |
| 33 | App → Configurações | Desligar `kora.crm.supabaseWrite.enabled` (toggle na tela, se existir) **ou** trocar o seletor de fonte do CRM para **Local** | — | — |
| 34 | App → CRM | Reabrir o CRM | se trocou pra Local: Kanban mostra o array local (não `HOMOLOG-F8-*`) | — |
| 35 | SQL Editor | Rodar prova 7.4 **(k)** | — | ✅ **caso (k)** — todas as linhas de (b)-(g)/(h) continuam em `crm_opportunities`; nada foi apagado pelo rollback |
| 36 | Console do navegador | Conferir `orbyt.leads.v1` | `HOMOLOG-F8-lead-import` (id 880001) continua lá, intacto | ✅ reforça (k) — local nunca foi tocado |
| 37 | SQL Editor + Console | Rodar a **limpeza §7.5** (nuvem + local) — só depois de todas as provas confirmadas | — | contagens finais batem com o baseline do passo 1 |

### 7.4 Provas SQL por caso

```sql
-- (a) leitura pós-flip, default — conferida visualmente no passo 7 (Kanban). Prova complementar:
-- confirma que a linha existe e está ativa, sem nenhuma escrita ainda.
select id, title, stage, archived, deleted_at from public.crm_opportunities
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and title = 'HOMOLOG-F8-opp';
-- esperado: 1 linha, archived=false, deleted_at IS NULL
```

```sql
-- (b) criar — nova linha, sem source_local_id (criada direto pela UI, não por import)
select id, title, potential_value, source_local_id from public.crm_opportunities
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and title = 'HOMOLOG-F8-criada';
-- esperado: 1 linha, potential_value=700, source_local_id IS NULL
```

```sql
-- (c) editar campo básico
select id, company from public.crm_opportunities
where id = '<HOMOLOG_OPP_UUID>';
-- esperado: company = 'Empresa Teste F8'
```

```sql
-- (d) mover de estágio
select id, stage, status from public.crm_opportunities
where id = '<HOMOLOG_OPP_UUID>';
-- esperado: stage != 'lead' (a etapa escolhida no passo 12)
```

```sql
-- (e) arquivar/restaurar — prova O3. archived deve estar false NO FINAL (arquivou e depois
-- restaurou); se estiver true, ou se a linha não existir mais, é vermelho.
select id, archived, deleted_at from public.crm_opportunities
where id = '<HOMOLOG_OPP_UUID>';
-- esperado: archived=false, deleted_at IS NULL
```

```sql
-- (f) excluir (soft) — prova O2. deleted_at deve estar preenchido; a linha NUNCA é removida
-- fisicamente (soft delete, não DELETE).
select id, deleted_at, deleted_reason from public.crm_opportunities
where id = '<HOMOLOG_OPP_DELETE_UUID>';
-- esperado: deleted_at preenchido (timestamp), linha ainda existe
```

```sql
-- (g) tags — prova O1/O4 via UI real
select id, tags from public.crm_opportunities where id = '<HOMOLOG_OPP_UUID>';
-- esperado: tags = {vip,homolog}

-- (g) history — escrita direta (não existe caminho de UI, ver achado registrado acima),
-- prova o round-trip de LEITURA da coluna (o mapper já prova o round-trip de escrita via
-- teste unitário, crmOpportunityMapper.test.ts)
update public.crm_opportunities
set history = '[{"date":"2026-07-23","text":"Entrada de historico gravada via SQL (prova de leitura)"}]'::jsonb
where id = '<HOMOLOG_OPP_UUID>';

select id, history from public.crm_opportunities where id = '<HOMOLOG_OPP_UUID>';
-- esperado: history com a entrada acima — e o passo 23 confirma que o drawer da UI mostra
-- essa mesma entrada (prova de leitura ponta-a-ponta, mapper -> UI)
```

```sql
-- (h) import pré-flip, gate §6.3
select id, title, source_local_id from public.crm_opportunities
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and title = 'HOMOLOG-F8-lead-import';
-- esperado: 1 linha, source_local_id preenchido (contém "880001") — GUARDE esse valor
```

```sql
-- (i) offline/falha — não tem prova de banco (nada deveria ter sido escrito). Conferir que
-- company NÃO mudou de novo com o valor tentado no passo 25 (se tentou um valor diferente).
select id, company, updated_at from public.crm_opportunities where id = '<HOMOLOG_OPP_UUID>';
-- esperado: company continua 'Empresa Teste F8' (do passo 10) — a tentativa offline não gravou
```

```sql
-- (j) idempotência do reimport — 0 duplicata
select count(*) as linhas from public.crm_opportunities
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9'
  and source_local_id = '<SOURCE_LOCAL_ID_CASO_H>';
-- esperado: 1 (nunca 2)
```

```sql
-- (k) rollback — nada criado nos casos (b)-(h) foi apagado pelo flip de flag/dataSource
select title, archived, deleted_at from public.crm_opportunities
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9'
  and title like 'HOMOLOG-F8-%'
order by title;
-- esperado: todas as linhas semeadas/criadas ainda presentes (nenhuma sumiu)
```

### 7.5 Limpeza — escrita para APROVAÇÃO do revisor ANTES da rodada (nada executado ainda)

**Nuvem — DELETE físico (é homologação; não precisa manter soft-deleted de teste):**

```sql
delete from public.crm_opportunities
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9'
  and title like 'HOMOLOG-F8-%';

select count(*) as restantes from public.crm_opportunities
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and title like 'HOMOLOG-F8-%';
-- esperado: 0
```

**Local (console do navegador):**

```js
const leads = JSON.parse(localStorage["orbyt.leads.v1"] || "[]");
localStorage.setItem("orbyt.leads.v1", JSON.stringify(leads.filter(l => l.id !== 880001)));
console.log("restantes com id 880001:", JSON.parse(localStorage["orbyt.leads.v1"]).filter(l => l.id === 880001).length);
// esperado: 0
```

**Seletores — restaurar ao estado do passo 2** (se estavam ausentes antes, manter ausentes — já
é o novo default de produção; se tinham valor, regravar esse valor exato):

```js
// Só rodar se o passo 2 tinha anotado ALGUM valor — regravar o mesmo:
// localStorage.setItem("kora.crm.dataSource.v1", "<valor anotado>");
// localStorage.setItem("kora.crm.supabaseWrite.enabled", "<valor anotado>");
```

**Verificação final — volta à baseline do §7.1:**

```sql
select count(*) as opps_final
from public.crm_opportunities
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and deleted_at is null;
-- esperado: igual a opps_baseline (passo 1)
```

---

**PARADO aqui.** Fase C completa (§6.0-§6.10) e Fase D com runbook executável entregue (§7.1-§7.5)
— 11 casos, seed sintético próprio, provas SQL por caso, limpeza em ordem de FK. **A execução é
do operador, com revisão passo a passo — NADA EXECUTA sem o "vai" literal do revisor, colado neste
chat pelo operador.**
