# Etapa 5 — Clientes — Pacote do Flip — Fase A (inventário de prontidão)

> Zero mudança de código nesta fase. Escopo combinado com o revisor: inventariar
> hooks/mappers/flags/produtores de escrita/tabelas cloud do domínio Clientes,
> mapear assimetrias local↔nuvem (classe G37 — payload completo; classe
> G40/G49 — vocabulário nuvem = local literal), entregar este doc. Só leitura
> de código — nenhum arquivo de produto tocado.

## Abertura (§16/§17)

- Branch: `etapa-5-flip-clientes-pacote`, criada a partir de `origin/main`.
- Hash confirmado por `git log origin/main -1 --oneline`: **`a7b110d`**
  (`fix(vendas): G55 - gate fossil de blockWrite() bloqueava "Gerar conta a
  receber" pos-cutover de Financeiro`).
- **Achado que muda o enquadramento inteiro do pacote, direto na abertura:**
  Clientes **não é greenfield** como Financeiro/Projetos/Tarefas eram no
  início dos respectivos pacotes. Já existe um doc de Fase A dedicado —
  [`etapa-5-fatia-4-clients.md`](etapa-5-fatia-4-clients.md) — que descobriu,
  em 2026-07-20, que o CRUD de `clients` **já é Supabase-first em produção
  desde 2026-06-15** (commit `7ab2367`), construído **antes** da Etapa 5 e
  **fora** do molde Espelho Reversível, sem nenhuma rodada de homologação.
  Esse achado foi formalizado como dívida assumida em
  [`protocolo-homologacao.md` §10](protocolo-homologacao.md#10-emenda-2026-07-20--regularização-de-p5-para-clients-dívida-assumida-sem-homologação-retroativa)
  ("Regularização de P5 para `clients`") — **não revertido**, porque reverter
  quebraria uso corrente já em produção. A Fatia 4 também fechou um bug ativo
  de perda de dado silenciosa em `client_contacts` (C8, implementado e
  homologado, `9fe41f5`+`eeff133`, confirmado presente na árvore atual desta
  leitura: `useSupabaseClientContacts.ts` existe e está fiado em
  `ClientProfileDrawer.tsx`).
- **Consequência prática pra este pacote:** não existe um par de flags
  `kora.clients.dataSource.v1`/`kora.clients.supabaseWrite.enabled` pra
  "flipar" — confirmado por grep, zero ocorrência no código (contraste direto
  com `kora.crm.*`, `kora.quotes.*`, `kora.projects.*`, `kora.finance.*`, que
  existem e têm hook próprio cada). A fonte já é Supabase incondicionalmente
  para qualquer usuário com workspace ativo
  (`useClientsDataSource.ts:48`: `workspaceLoading || workspace ? "supabase" : "local"`).
  Este pacote, portanto, **não é sobre decidir quando flipar um default** —
  é sobre inventariar o que ainda não acompanhou esse cutover já consumado.
  Ver §3.

---

## 1. Inventário

### 1.1 Hook local

`src/hooks/useClients.ts` — re-exporta `Client` e tipos irmãos de
`src/types/domain.ts` (não redefine). CRUD exposto: `addClient`,
`updateClient`, `archiveClient`, `restoreClient`, `deleteClient`. Persistência:
`localStorage["orbyt.clients.v1"]`, 8 registros demo (`isDemo: true`)
embutidos como seed.

`Client` (`types/domain.ts:129-164`) — 29 campos, incluindo `projects: {name,
status}[]`/`tasks: {name, done}[]` (formato achatado antigo, sem equivalente
na nuvem — ver §2.1) e os sub-objetos `contacts?`/`technicalSheet?`/`assets?`
(vivem em tabelas próprias na nuvem, não em colunas de `clients`).

Vocabulário: `ClientStatus = "Ativo" | "Em negociação" | "Inativo" |
"Potencial" | "Arquivado"`; `ClientTemperature = "Frio" | "Morno" | "Quente"`
(`domain.ts:1-2`).

### 1.2 Hooks/repository Supabase

Ao contrário do padrão "hook Supabase ainda não existe" de outros domínios
pré-flip, aqui já existe **CRUD completo dos dois lados**:

- `src/repositories/clientsRepository.ts` — `listClients`, `createClient`,
  `updateClient`, `archiveClient` (soft), `deleteClient` (hard), mais
  `listClientContacts`/`createClientContact`/`updateClientContact`/
  `deleteClientContact` pra `client_contacts`.
- `src/hooks/useSupabaseClients.ts` — wrapper React Query
  (`queryKey: ["supabase-clients", workspaceId]`), expõe `clients`, `loading`,
  `error`, `addClient`, `updateClient`, `archiveClient`, `deleteClient`,
  `refreshClients`.
- `src/hooks/useSupabaseClientContacts.ts` — hook React Query dedicado por
  contato (entregue na Fatia 4, C8) — `listClientContacts` +
  `create/update/deleteClientContact`, cada mutação invalidando a query
  própria.
- `src/hooks/useClientsDataSource.ts` — o hook bifurcado que decide a fonte
  e expõe `mapSupabaseClientToLocalClient` (ver §1.3).

### 1.3 Mapper(s)

**Sem arquivo dedicado `clientMapper.ts`** — a tradução é uma função de
leitura + escrita inline espalhada em 3 lugares.

- **Leitura (nuvem→local):** `mapSupabaseClientToLocalClient`
  (`useClientsDataSource.ts:7-42`), único ponto, usado por todo mundo que lê
  via `useClientsDataSource()`.
- **Escrita (local→nuvem):** inline, 3 pontos com completude diferente entre
  si — `Clientes.tsx:159-194` (`addClient`, criação), `Clientes.tsx:196-232`
  (`updateClient`, edição), `useLocalClientsImport.ts:116-140` (import legado
  em lote). Ver comparação campo a campo em §2.1.

### 1.4 Flags

**Nenhuma.** Confirmado por grep em `src/config/` e nos hooks
`useSupabase*WriteFlag.ts` — o padrão `kora.<domínio>.dataSource.v1` +
`kora.<domínio>.supabaseWrite.enabled` que CRM/Quotes/Projects/Finance têm
não existe pra `clients`. A única chave `localStorage` correlata é
`kora.clients.supabaseImport.v1` (`useLocalClientsImport.ts:22`) — metadado
de reconciliação de import (`{lastImportedAt, importedLocalIds,
skippedLocalIds, importedMap: {localId→supabaseUuid}}`), **não** um toggle
de fonte/escrita. Esse mapa é contrato cross-domínio — `quotes`
(`useLocalQuotesImport.ts`) e `crm_opportunities`
(`crmOpportunityMapper.ts:15`) já leem o mesmo formato pra resolver
`clientId` local → uuid nuvem; mudar a chave/formato quebraria as duas
fatias já homologadas (restrição de design dura, herdada de
`etapa-5-fatia-4-clients.md` §1 "FK / dependentes").

### 1.5 Produtores de escrita

| Caminho | Arquivo | Fonte usada | Comportamento |
|---|---|---|---|
| "Novo Cliente" (criar) | `Clientes.tsx:159-194` | `useClientsDataSource()` (bifurca) | Supabase-first se houver workspace, senão local — não é dual-write |
| Editar cliente | `Clientes.tsx:196-232` | idem | idem; só envia os campos explicitamente listados no patch (ver §2.1) |
| Arquivar/restaurar/excluir | `Clientes.tsx:234-274` | idem | idem |
| Aprovar signup-request como cliente | `Clientes.tsx:401-419` (`approveAsClient`) | chama o mesmo `addClient` acima | idem |
| **Conversão de lead→cliente (CRM)** | `CRM.tsx:639-662` (`handleConvertToClient`) | `useClients()` **direto**, não `useClientsDataSource()` (import em `CRM.tsx:52`, destructure em `CRM.tsx:147`) | **Local-only incondicional** — mesmo pra usuário cujo Clientes já é Supabase-first. Ver §2.4. |
| Import legado local→nuvem | `useLocalClientsImport.ts` (`importSelected`) | Supabase, unidirecional | `createClient` + loop `createClientContact` sem transação (achado já catalogado em `etapa-5-fatia-4-clients.md` §4.2 Fluxo A — "cliente com contatos decapitados", não bloqueante hoje porque 0 clientes reais locais, medido nessa fatia) |
| Aba "Contatos" (`ClientProfileDrawer`) | `Clientes.tsx:834-837` → `useSupabaseClientContacts` | bifurca | Corrigido na Fatia 4 (C8) — antes disso, silenciosamente não persistia em modo Supabase |

Não existe função `mirrorClientToSupabase`/dual-write best-effort (contraste
com `projectsCloudMirror.ts` em Projetos) — o padrão aqui é "escreve local OU
nuvem, escolhido uma vez por `source`", não espelho. Também não existe
`source_local_id` em `public.clients` (catalogado, não bloqueante, ver
`etapa-5-fatia-4-clients.md` §1 "Legado sem `source_local_id`" e §4.1) — sem
arbiter de idempotência no banco pra reenvio duplicado.

### 1.6 Tabelas cloud

`public.clients` (`supabase/migrations/20260530010000_create_clients_schema.sql`,
alterada por `20260616101051_...sql` — `+avatar_url` — e `20260615220240_...sql`
— só `GRANT`). Colunas (conferido também contra
`src/integrations/supabase/types.ts:298-397`, sem drift):

```
id, workspace_id, name, company, email, phone, whatsapp, instagram, website,
city, state, address, document, type, status, source, temperature,
potential_value, total_revenue, next_action, next_action_date, notes,
tags[], archived, is_demo, avatar_url, created_at, updated_at
```

`public.client_contacts` (mesma migration) — `id, workspace_id, client_id
(FK CASCADE), name, role, email, phone, whatsapp, is_primary, is_financial,
is_decision_maker, notes, created_at, updated_at`. RLS habilitada nas duas,
4 policies cada, gate por `is_workspace_member(workspace_id)`.

FKs de outras tabelas apontando pra `clients.id` (todas `SET NULL` exceto as
2 tabelas-filha diretas):

| Tabela | Coluna | ON DELETE |
|---|---|---|
| `client_contacts` | `client_id` (NOT NULL) | CASCADE |
| `client_technical_sheets` | `client_id` (NOT NULL) | CASCADE |
| `quotes` | `client_id` (nullable) | SET NULL |
| `crm_opportunities` | `client_id` (nullable) | SET NULL |
| `projects` | `client_id` (nullable) | SET NULL |
| `financial_transactions` | `client_id` (nullable) | SET NULL |
| `tasks` | `client_id` (nullable) | SET NULL |
| `whatsapp_audience_contacts` | `matched_client_id` (nullable) | SET NULL |

---

## 2. Assimetrias local↔nuvem

### 2.1 Classe G37 — payload de escrita incompleto (achado novo desta leitura)

G37 (Financeiro) e o precedente equivalente em Projetos/Quotes são sobre
"todo campo que existe na coluna, existe no payload". Fazendo a mesma
comparação campo a campo pra `clients`:

| Campo local | Coluna cloud | No `addClient` (`Clientes.tsx:162-183`) | No `updateClient` (`Clientes.tsx:200-220`) | No import (`useLocalClientsImport.ts:116-140`) |
|---|---|---|---|---|
| **`totalRevenue`** | `total_revenue` | ❌ **ausente** | ❌ **ausente** | ✅ (`local.totalRevenue \|\| 0`) |
| `avatarUrl` | `avatar_url` | ❌ ausente na criação | ✅ presente | n/a |
| `isDemo` | `is_demo` | ❌ ausente (default `false` da coluna cobre por acidente) | n/a | ✅ (`is_demo: false`) |
| todos os outros 15 campos mapeáveis | — | ✅ | ✅ | ✅ |
| `lastProject`, `lastInteraction`, `projects`, `tasks` | *(nenhuma)* | — | — | — |

**Achado principal:** `totalRevenue` existe na coluna (`total_revenue
NUMERIC DEFAULT 0`), é lido de volta pelo mapper (`useClientsDataSource.ts:21`)
e é exibido em `ClientProfileDrawer.tsx:388-389` — mas **nunca é escrito**
pelos dois caminhos de escrita ativos em produção (criar e editar cliente na
tela principal). Só o caminho de import legado o envia. Efeito prático: um
cliente criado ou editado hoje via Supabase-first (o caso normal) nunca tem
`total_revenue` atualizado por esses caminhos — fica congelado em `0` (ou no
valor que o import trouxe, se veio de lá) até um caminho diferente (nenhum
identificado nesta leitura) o atualizar. `etapa-5-fatia-4-clients.md` §"Precisão
de campos monetários" (C4) já registrou uma lacuna adjacente
(`potentialValue`/`totalRevenue` sem arredondamento **no import**), mas não
cobriu esta ausência total nos 2 caminhos vivos — achado novo, candidato a
numeração G própria na próxima rodada de catalogação.

`lastProject`/`lastInteraction`/`projects`/`tasks` são artefato do formato
achatado antigo (pré-FK), sem coluna equivalente — substituídos
estruturalmente por `projects`/`quotes`/`crm_opportunities`/`tasks` com
`client_id` FK. Não é um gap a fechar, é o modelo antigo ficando obsoleto por
design — mapper de leitura já devolve `[]`/`"—"` fixo pra esses campos
(`useClientsDataSource.ts:22-26`), consistente.

### 2.2 Classe G40/G49 — vocabulário nuvem = local literal

Diferente de G40 (Tarefas)/G49, onde o achado era "a coluna tem CHECK e o
valor local violaria", aqui o achado é de outra natureza: **`clients.status`
e `clients.temperature` são `TEXT` livre, sem CHECK nenhum.** Confirmado por
grep exaustivo em `supabase/migrations/*.sql` por `CHECK` + `clients` — os
únicos hits são cláusulas de RLS (`WITH CHECK (public.is_workspace_member(...))`,
`20260530010000_...sql:76,85,104,113`) e um CHECK de uma tabela não
relacionada (`client_signup_requests.status`, valores
`'pending','approved','archived','converted','lead'` — vocabulário próprio,
tabela diferente). `types.ts:319,321` confirma: `status: string | null`,
`temperature: string | null`.

Os 3 caminhos de escrita (criar/editar/import) gravam o literal local
verbatim (`"Em negociação"`, `"Quente"` etc., com acento e maiúscula exatos)
— **isso não viola nada hoje**, porque não há nada a violar. O risco não é
"escrita falha" (classe G40/G49 clássica), é "bucket de texto livre sem
proteção de schema": nada impede um script, uma integração futura, ou uma
edição manual de gravar um valor fora do vocabulário conhecido, e
`mapSupabaseClientToLocalClient` (`useClientsDataSource.ts:19,33`) já tem
fallback silencioso pra esse caso (`s.status || "Ativo"`,
`s.temperature || "Morno"`) — um valor inesperado não quebra a UI, mas
também não é sinalizado, mesma classe de "esconder o caso, não avisar" que
outros domínios trataram com um campo `cloudStatusRaw` (`quotes`, Q9). Não
implementado aqui — registrado como gap, não como incidente (nenhuma
evidência de dado fora do vocabulário; não medido por query nesta leitura de
código).

### 2.3 Consumidores não bifurcados — mesma classe do "(a) precisa migrar" de Financeiro/Projetos

`useClientsDataSource()` é usado por `Clientes.tsx`, `ClientProfileDrawer.tsx`,
`ProjectsSection.tsx`, `QuotesSection.tsx` (parcial, ver nota abaixo), mais
indiretamente por `useBifurcatedProjects.ts`/`useSupabaseFinanceTransactions.ts`/
`projectsMapper.ts` (só resolução de nome, não registro completo). Confirmado
por grep (`grep -rl "useClientsDataSource" src/`, 18 arquivos totais contando
testes).

**3 telas ainda chamam `useClients()` puro (sempre local), apesar do Clientes
principal já ser Supabase-first para o mesmo usuário:**

| Arquivo | Uso | Efeito prático hoje |
|---|---|---|
| `Financeiro.tsx:141` (`ClientsTab`) | Lista completa de clientes na aba "Clientes" do Financeiro | Usuário com clientes reais só na nuvem vê essa aba **vazia ou só com os 8 demo locais** — diverge do que a tela principal de Clientes mostra pro mesmo usuário |
| `CRM.tsx:147` | Lista de clientes pro CRM (além da escrita, ver §2.4) | Mesmo efeito — CRM "não vê" clientes reais criados via Supabase-first |
| `ClientTechnicalSheet.tsx:234` | Busca cliente por id pra editar ficha técnica | Cliente supabase-only não é encontrado nesta tela — ficha técnica fica inacessível por esse caminho pra esse cliente |

**Nota sobre `kora-hub-auditoria-e-plano.md:688`:** o catálogo existente
afirma, ao descrever um fix em `QuotesSection.tsx`, que `useClientsDataSource()`
já é "o mesmo hook bifurcado já usado em `Financeiro.tsx`/`CRM.tsx`/
`Clientes.tsx`/`ProjectsSection.tsx`". Essa frase **não bate com o código
atual** — confirmado por grep direto (`Financeiro.tsx`/`CRM.tsx` importam só
`useClients`, não `useClientsDataSource`, nenhuma ocorrência do segundo em
nenhum dos dois arquivos). Provavelmente a frase generalizou incorretamente a
partir do padrão real (`Clientes.tsx`/`ProjectsSection.tsx`, que de fato usam)
pra ilustrar "o hook já existe, é só reusar" — mas como texto factual sobre
quem já bifurcou, está desatualizado ou errado. Registrado aqui por precisão,
já que é exatamente o tipo de citação que uma rodada futura poderia reusar
sem verificar.

### 2.4 Escrita divergente ativa — conversão de lead (CRM)

`CRM.tsx:639-662` (`handleConvertToClient`) chama `addClient` de `useClients()`
puro (import direto, `CRM.tsx:52`/`147`) — **local-only, incondicional**,
sem checar `source`. Pra um usuário com workspace ativo (a maioria, já que
Clientes é Supabase-first por padrão desde a Fatia 4), converter um lead em
cliente pelo CRM cria um registro que **não aparece na tela principal de
Clientes** (Supabase-first) nem em nenhum outro lugar que leia via
`useClientsDataSource()` — mesma classe de risco que R5 catalogou em
`etapa-5-flip-projetos-pacote.md` (`QuoteToProjectDialog` criando projeto
que "sumia" da visão do usuário), mas aqui é **local-only** em vez de
**invisível por outro motivo** — o efeito final (usuário não vê o que acabou
de criar) é o mesmo. Sem espelho (`mirror*`) pra esse caminho, ao contrário
de outros domínios com G22-style best-effort.

### 2.5 Assimetrias já conhecidas, catalogadas em rodadas anteriores (citadas por completude, não redescobertas aqui)

- **Cast uuid→number:** `mapSupabaseClientToLocalClient` faz `id: s.id as
  unknown as number` — `client.id` de um cliente Supabase é, em runtime, uma
  `string` UUID mascarada de `number` pelo TS. Qualquer código novo que chame
  `clientsRepository.*ClientContact(workspaceId, clientId, ...)` precisa
  `String(client.id)` — gotcha já documentado em
  `etapa-5-fatia-4-clients.md` §4.4(a).
- **G38 (já fechado):** `mapSupabaseClientToLocalClient` não lia `archived`
  — filtro "Ativos" mostrava arquivado em modo Supabase. Confirmado corrigido
  na árvore atual (`useClientsDataSource.ts:40`, `archived: !!s.archived`).
- **Sem `source_local_id`/idempotência de import:** catalogado, não
  bloqueante hoje (0 clientes reais locais medidos na Fatia 4) —
  `etapa-5-fatia-4-clients.md` §4.1.
- **Sem paginação em `listClients`:** mesma lacuna adiada (estilo Q7) que
  outros domínios têm — não bloqueante no volume atual.

---

## 3. Por que este pacote não é um "flip" no sentido clássico

Financeiro/Projetos/Tarefas seguiram o mesmo molde: schema pronto → mapper
completo por desenho → bifurcar consumidores → **flipar os defaults**
(`dataSource`/`supabaseWrite`, Fase C) → homologar (Fase D). Clientes não tem
Fase C nesse sentido — **não existe flag pra flipar**, e o cutover de fonte já
aconteceu, sem governança, em 2026-06-15 (§Abertura). O trabalho real que
resta não é "decidir quando trocar o default" — é fechar o descompasso entre
o cutover já consumado e o resto do app que ainda não o acompanhou:

1. 3 telas ainda leem só local (§2.3) — mesma classe de trabalho que "(a)
   precisa migrar" nos outros pacotes, só que sem uma Fase C esperando por
   elas no fim.
2. 1 caminho de escrita ativo (conversão de lead) ainda grava só local (§2.4).
3. 1 campo (`totalRevenue`) nunca é escrito pelos caminhos vivos (§2.1) —
   bug de payload incompleto, não decisão de escopo.
4. Vocabulário sem proteção de schema (§2.2) — decisão de produto em aberto
   (adicionar CHECK vs. aceitar texto livre por design), não um bug.

---

## 4. Candidatos a próxima rodada (listados, não desenhados nem priorizados)

- Bifurcar os 3 consumidores de §2.3 pra `useClientsDataSource()` — padrão
  já provado, sem desenho novo necessário.
- Corrigir `handleConvertToClient` (§2.4) — bifurcar ou adicionar espelho
  best-effort, decisão de design pra rodada própria.
- Completar o payload de `totalRevenue` (e revisar `avatarUrl`/`isDemo`) nos
  2 caminhos de escrita vivos (§2.1).
- Decidir sobre CHECK de vocabulário em `status`/`temperature` (§2.2) —
  requer decisão do revisor, não é óbvio que valha o custo de migration pra
  um caso sem incidente conhecido.
- Instalar `source_local_id` + RPC atômica de import (já catalogado,
  `etapa-5-fatia-4-clients.md` §4.1/C1-C3) — só relevante se voltar a existir
  cliente real só no local.

Nenhum destes foi dimensionado em fases/estimativa nesta rodada — fica pra
quando o revisor decidir qual (se algum) puxar primeiro.

---

## Referências

- [`etapa-5-fatia-4-clients.md`](etapa-5-fatia-4-clients.md) — Fase A original
  do domínio, achado do cutover ungoverned, decisão C6 (regularização sem
  migração de dado), design e implementação de C8 (contatos).
- [`protocolo-homologacao.md` §10](protocolo-homologacao.md#10-emenda-2026-07-20--regularização-de-p5-para-clients-dívida-assumida-sem-homologação-retroativa)
  — emenda formal que regulariza P5 pra `clients`.
- `docs/architecture/kora-hub-auditoria-e-plano.md` — G38 (archived não lido,
  fechado), G23 (avisos "Aviso Híbrido" desatualizados, fechado), achado do
  `NewQuoteWizard`/`useClientsDataSource` (linha ~688, citação imprecisa
  sobre quais telas já bifurcaram — ver §2.3 desta nota).
- [`etapa-5-flip-projetos-pacote.md`](etapa-5-flip-projetos-pacote.md) —
  precedente de classificação de consumidores "(a) precisa migrar" e de
  risco de escrita invisível (R5), reaplicados por analogia em §2.3/§2.4.

**PARADO aqui — §18. Inventário de leitura pura, zero código tocado. Aguardando
"vai" do revisor pra decidir se e qual item de §4 vira rodada de código.**
