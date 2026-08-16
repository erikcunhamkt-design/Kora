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
  `create/update/deleteClientContact`.
- **G30 (docs/architecture/kora-hub-auditoria-e-plano.md, `docs/qa/etapa-5-auditoria-hooks-g30-g32.md`) — FECHADO nos 2 hooks acima, 16/ago/2026, Lane D**: as 7 mutations (4 de `useSupabaseClients` + 3 de `useSupabaseClientContacts`) foram devolvidas pro escopo da Lane D pelo revisor (este pacote seguiu doc-only e nunca tocou esses arquivos) — já não invalidam mais a query própria, gravam a resposta da mutation direto no cache via `setQueryData`. Nada pendente de G30 aqui; não retrabalhar.
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

### 2.1 Classe G37 — payload de escrita incompleto (correção pós-investigação — ver G61)

> **Correção registrada por precisão** (protocolo, "corrigir o próprio
> registro quando a evidência muda, não silenciar"): a primeira versão desta
> seção classificou `totalRevenue` como "bug de payload incompleto" — o mesmo
> tratamento de `avatarUrl`/`isDemo` abaixo. Investigação posterior
> (rodada 2a, ver `kora-hub-auditoria-e-plano.md` §G61) achou o comentário de
> origem do campo, perdido num refactor, que muda a leitura por completo —
> texto corrigido abaixo, tabela mantida como estava (o gap factual —
> "nunca escrito pelos 2 caminhos vivos" — continua verdadeiro, só a
> INTERPRETAÇÃO mudou).

G37 (Financeiro) e o precedente equivalente em Projetos/Quotes são sobre
"todo campo que existe na coluna, existe no payload". Fazendo a mesma
comparação campo a campo pra `clients`:

| Campo local | Coluna cloud | No `addClient` (`Clientes.tsx:162-183`) | No `updateClient` (`Clientes.tsx:200-220`) | No import (`useLocalClientsImport.ts:116-140`) |
|---|---|---|---|---|
| **`totalRevenue`** | `total_revenue` | ❌ ausente (por design — ver abaixo) | ❌ ausente (por design — ver abaixo) | ✅ (`local.totalRevenue \|\| 0`, passthrough do legado) |
| `avatarUrl` | `avatar_url` | ❌ ausente na criação | ✅ presente | n/a |
| `isDemo` | `is_demo` | ❌ ausente (default `false` da coluna cobre por acidente) | n/a | ✅ (`is_demo: false`) |
| todos os outros 15 campos mapeáveis | — | ✅ | ✅ | ✅ |
| `lastProject`, `lastInteraction`, `projects`, `tasks` | *(nenhuma)* | — | — | — |

**`totalRevenue` NÃO é um G37 clássico — é um campo com intenção DERIVADA,
nunca implementada, cujo comentário de origem se perdeu num refactor.**
`git log -S"integra com Financeiro"` (confirmado por `git show` direto)
encontra o commit de nascimento do campo, `16fd22e`
(`src/hooks/useClients.ts`, antes de este repo ter Supabase):

```ts
/** Receita total já gerada (futuro: integra com Financeiro) */
totalRevenue?: number;
```

Ou seja: o campo nunca foi desenhado como algo que o usuário digita (não tem,
nunca teve, um `FormField` em `ClientFormPayload`/`ClientFormDialog`,
confirmado por leitura direta de `Clientes.tsx:89-110` — contraste com
`potentialValue`, que tem `FormField label="Valor potencial (R$)"` dedicado,
linha ~1095) — era pra ser **calculado a partir do Financeiro**. Esse
comentário foi perdido quando `Client` foi içado de `useClients.ts` pra
`src/types/domain.ts` (commit `4b1a8f2`, o mesmo que criou a coluna
`total_revenue` no Supabase) — o campo sobreviveu ao refactor, a explicação
do porquê ele existe não.

**A lógica de cálculo já existe no código — só nunca foi conectada a este
campo.** `ClientProfileDrawer.tsx` (aba "Financeiro" do drawer, `FinanceTab`,
linhas ~960-965) já soma `useBifurcatedFinance()` filtrado por
`clientId`/`clientName` e `status === "paid"` — exatamente o cálculo que o
comentário de 2026-05 previa. Mas esse número é só exibido ali ("Recebido"),
**nunca escrito** em `client.totalRevenue`/`total_revenue` — os dois números
(o "Receita gerada" da aba Resumo, `ClientProfileDrawer.tsx:387-389`, e o
"Recebido" da aba Financeiro) já divergem hoje, silenciosamente, porque um é
o valor congelado do import/seed e o outro é calculado ao vivo.

**Decisão do revisor (esta rodada):** dois caminhos, não um.
1. **Agora — vestigial/read-only, aceito como está.** Não escrever
   `totalRevenue` em nenhum caminho de escrita novo (a ausência atual em
   `addClient`/`updateClient` deixa de ser "bug a fechar" e vira
   comportamento aceito). Segue lido e exibido como está (congelado no que o
   import trouxe ou `0`) até a feature futura existir — não pior que hoje,
   só documentado corretamente.
2. **Futuro — feature própria, pós-homologação do Financeiro.** Conectar de
   verdade o cálculo que já existe em `FinanceTab` (`ClientProfileDrawer.tsx:960-965`)
   como a fonte de `total_revenue` — decisão de arquitetura própria (grava
   em toda leitura? RPC agregada? trigger no banco quando uma transação muda
   de status?), fora do escopo deste pacote, depende do Financeiro já estar
   homologado e estável (não faz sentido construir uma agregação em cima de
   um domínio que ainda está fechando os próprios achados, G52-G56 e o
   runbook de Caso 4.3).

**Caminho descartado, registrado por transparência:** completar o payload
como campo simples (mesmo tratamento de `avatarUrl`/`isDemo`) foi cogitado
na primeira versão deste doc e **rejeitado** pelo revisor — isso tornaria o
campo "editável por acidente" (grava o que estava lá na hora da
criação/edição, nunca mais sincroniza com Financeiro), formalizando uma
semântica que ninguém decidiu conscientemente que era essa.

`lastProject`/`lastInteraction`/`projects`/`tasks` são artefato do formato
achatado antigo (pré-FK), sem coluna equivalente — substituídos
estruturalmente por `projects`/`quotes`/`crm_opportunities`/`tasks` com
`client_id` FK. Não é um gap a fechar, é o modelo antigo ficando obsoleto por
design — mapper de leitura já devolve `[]`/`"—"` fixo pra esses campos
(`useClientsDataSource.ts:22-26`), consistente. (Esse achado, ao contrário
de `totalRevenue`, não teve reclassificação — segue igual à 1ª versão.)

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

## 4. Candidatos a próxima rodada — status pós-rodada 1

**Rodada 1 (concluída, este pacote):** `handleConvertToClient` (§2.4)
bifurcado pra `useClientsDataSource()`, mesmo caminho de escrita que
`Clientes.tsx` — cliente convertido pelo CRM agora aparece na tela principal
de Clientes em modo Supabase. Catalogado como **G58** (mais **G59**, o gate
fóssil `blockWriteAction()` que bloqueava a conversão incondicionalmente em
modo Supabase — removido junto, sem ele o fix de G58 continuaria bloqueado
na prática). Ver `docs/architecture/kora-hub-auditoria-e-plano.md` §G58/G59
pro achado completo, causa raiz e testes (fail→fix→pass provado via
`git stash`).

**Rodada 2a (concluída, decisão registrada — sem código):**
`totalRevenue` (§2.1) investigado antes de codar, achado genuinamente
ambíguo entre 2 fontes de intenção — reportado ao revisor sem escrever
código (protocolo, "se ambíguo, não presumir"). **Decisão do revisor:**
vestigial/read-only agora (não escrever em nenhum caminho novo); integração
real com Financeiro vira feature própria, só depois do Financeiro estar
homologado — a lógica de cálculo já existe, solta, em `FinanceTab`
(`ClientProfileDrawer.tsx:960-965`), só nunca foi conectada ao campo.
Caminho de "só completar o payload como campo simples" **rejeitado**
explicitamente. Catalogado como **G61**
(`kora-hub-auditoria-e-plano.md` §G61) — a lição é sobre içar uma interface
sem carregar o comentário de origem, não sobre o campo em si.

**Backlog restante — rodada 2b e rodada 3, ainda não iniciadas:**

- **Rodada 2b (bloqueada até G59 da Lane B aterrissar em `main` — confirmar
  no fetch antes de começar):** bifurcar os 3 consumidores restantes de §2.3
  (`Financeiro.tsx` `ClientsTab`, `CRM.tsx` leitura de lista,
  `ClientTechnicalSheet.tsx`) pra `useClientsDataSource()` — padrão já
  provado, sem desenho novo necessário. Bloqueada porque toca `CRM.tsx`, o
  mesmo arquivo que a Lane B está corrigindo (`handleSavePipeline`, o outro
  fóssil do par G59) — evita colisão de merge entre lanes no mesmo arquivo.
- **Rodada 3 (candidata, backlog do operador — pós-Fase D):** decisão sobre
  CHECK de vocabulário em `status`/`temperature` (§2.2) — **migration**,
  então gate reforçado do protocolo; correta pra propor só depois que uma
  Fase D de homologação real tiver rodado sobre o restante do domínio (não
  faz sentido travar `status`/`temperature` por CHECK antes de saber se
  algum caminho ainda escreve fora do vocabulário conhecido). Requer decisão
  do revisor — não é óbvio que valha o custo de migration pra um caso sem
  incidente conhecido hoje. **Draft da migration já preparado** (enquanto a
  Rodada 2b espera o G59 da Lane B) em
  [`etapa-5-flip-clientes-rodada3-check-drafts.md`](etapa-5-flip-clientes-rodada3-check-drafts.md)
  — vocabulário confirmado por grep (5 valores de `status`, 3 de
  `temperature`, sem drift entre tipo/form/write paths), CHECK preventivo
  nos moldes do precedente de Financeiro (`20260815000200_...sql`), com os
  2 SELECTs de verificação prévia que o operador roda antes de aplicar. Nada
  em `supabase/migrations/` ainda — só o draft, gate de aplicação continua
  sendo pós-Fase D.
- **Futura, sem rodada atribuída (§2.1):** integração real de `totalRevenue`
  com Financeiro (caminho 1 da decisão do revisor) — depende do Financeiro
  estar homologado primeiro.
- Instalar `source_local_id` + RPC atômica de import (já catalogado,
  `etapa-5-fatia-4-clients.md` §4.1/C1-C3) — só relevante se voltar a existir
  cliente real só no local. Sem rodada atribuída.

Nenhum item restante foi dimensionado em fases/estimativa — fica pra quando
o revisor decidir qual puxar depois.

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
