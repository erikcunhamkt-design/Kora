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

**PARADO aqui.** Levantamento de Fase A entregue — nenhum código alterado, nenhuma migration
escrita, nenhum dado acessado. Proposta de recorte: **Fatia 8 = cutover de escrita de
`opportunities`** (§4), com o achado **O1** catalogado como parte do escopo de design. **NADA
EXECUTA sem o "vai" literal do revisor, colado neste chat pelo operador** — inclusive a própria
Fase B (design) desta fatia.
