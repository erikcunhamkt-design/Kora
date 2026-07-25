# Etapa 5 · Fatia 9 — Fase A: levantamento do cutover de escrita de `quotes`

> **Escopo desta rodada: SOMENTE LEITURA.** Nenhum código alterado, nenhuma migration escrita,
> nenhum dado acessado por Code (Code não tem credencial de banco nem acesso a browser — medições
> de volume ficam como queries para o operador rodar, §6).

Referências: [`etapa-5-fatia-3-quotes.md`](etapa-5-fatia-3-quotes.md) (Q8, achado central desta
rodada) · [`etapa-5-fatia-8-crm-cutover.md`](etapa-5-fatia-8-crm-cutover.md) (molde do cutover de
opportunities, usado como comparação em todo este documento) · protocolo:
[`protocolo-homologacao.md`](protocolo-homologacao.md).

---

## 1. Estado atual do domínio

### 1.1 Sem seletor de dataSource, sem flag mestre — diferença estrutural do CRM

Ao contrário de `opportunities` (que já tinha `kora.crm.dataSource.v1` + estava a um flip de
`kora.crm.supabaseWrite.enabled` de completar o cutover na Fatia 8), **`quotes` não tem nenhum
seletor de dataSource nem flag mestre de escrita.** Confirmado por grep exaustivo em
`src/config/flags.ts`: existem só `CRM_DATA_SOURCE_KEY` e `TECHNICAL_SHEETS_DATA_SOURCE_KEY` —
nenhuma constante `QUOTES_DATA_SOURCE_KEY` ou equivalente existe em lugar nenhum do código.

Em vez disso, existem **4 flags booleanas opt-in independentes**, cada uma default OFF, cada
uma ligando só um comportamento pontual — nenhuma delas controla onde a leitura/escrita
"principal" acontece:

| Flag | Chave | Onde é lida | O que gateia |
|---|---|---|---|
| `quotesSupabaseExperimental` | `kora.quotes.supabaseExperimental.enabled` | `SupabaseQuotesViewerCard.tsx:76-82,149` | **Gate mestre do card inteiro** — sem ela, o card de Configurações inteiro não renderiza nada |
| `quotesSupabaseApproval` | `kora.quotes.supabaseApproval.enabled` | `SupabaseQuotesViewerCard.tsx:84-89`, `LinkedQuotesSection.tsx:67-73` | Botões de aprovar/recusar nas 2 superfícies |
| `quotesSupabaseCreateReceivable` | `kora.quotes.supabaseCreateReceivable.enabled` | idem, `:32-40` / `:37-45` | Abrir o diálogo "Gerar recebível" |
| `quotesSupabaseCreateProject` | `kora.quotes.supabaseCreateProject.enabled` | idem, `:45-53` / `:50-58` | Abrir o diálogo "Gerar projeto" |
| `crmSupabaseCreateQuote` (lado CRM) | `kora.crm.supabaseCreateQuote.enabled` | `CRM.tsx:1287-1303` | Criar orçamento a partir de uma oportunidade, **quando o CRM já está em modo Supabase** |

**Nenhuma dessas 4 flags de quotes é lida dentro de `QuotesSection.tsx`** (grep confirma zero
referências a `flags.ts`/`getBooleanFlag` nesse arquivo) — elas só existem em 2 superfícies
secundárias, nunca na tela principal.

### 1.2 A tela principal (`QuotesSection.tsx`, Vendas → Orçamentos) é 100% local

Confirmado por leitura completa do arquivo: importa só `useQuotes` (hook local), nunca
`useSupabaseQuotes`/`quotesRepository`/`flags.ts`. **Não existe nenhum branch de dataSource, nem
quebrado, nem funcionando** — ao contrário do CRM (onde havia um branch real, só com 3 bugs
dentro dele), aqui simplesmente não há branch nenhum. O próprio código já admite isso: comentário
em `SupabaseQuotesViewerCard.tsx:173` — *"A tela principal de Vendas/Orçamentos ainda usa
localStorage."*

O Supabase só é alcançável hoje por 2 superfícies secundárias, cada uma **read-mostly**:
1. `SupabaseQuotesViewerCard.tsx` (card de Configurações, atrás de `quotesSupabaseExperimental`).
2. `LinkedQuotesSection.tsx` (painel "Orçamentos vinculados" na gaveta de oportunidade do CRM,
   atrás do próprio `activeDataSource` do CRM — não uma flag de quotes).

### 1.3 Inventário do `quotesRepository`

| Método | O que faz |
|---|---|
| `listQuotes` | todas as quotes do workspace, sem filtro de `archived`/`deleted_at` |
| `getQuote` | uma quote por id |
| `createQuote` | insert simples |
| `updateQuote` | patch genérico |
| `archiveQuote(ws, id, bool)` | serve pra **arquivar E restaurar** (mesmo método, toggle) |
| `softDeleteQuote` | seta `deleted_at`/`deleted_reason` — **não existe método de restaurar de soft-delete** |
| `listQuoteItems` / `listQuoteItemsForQuotes` | leitura de itens, unitária ou em lote |
| `replaceQuoteItems` | **não-atômico**: `delete` + `insert` separados, 2 round-trips |
| `importQuoteWithItems` | RPC atômica (upsert pai + replace filho numa transação) — **único chamador: o assistente de import** (`useLocalQuotesImport.ts:241`) |
| `listQuotesByOpportunity` | quotes ligadas a uma oportunidade, usado por `LinkedQuotesSection` |
| `approveQuote` / `rejectQuote` | seta `status`/`approved_at`/`rejected_at` — valores em **inglês** (`"approved"`/`"rejected"`) |

`useSupabaseQuotes.ts` envolve só um subconjunto via React Query (`createQuote`, `updateQuote`
— **só repassa `title`/`description`/`status`, descarta qualquer outro campo do patch
silenciosamente** —, `archiveQuote`, `softDeleteQuote`, `replaceQuoteItems`, `approveQuote`,
`rejectQuote`). `createQuote`/`replaceQuoteItems` desse hook **não têm nenhum consumidor hoje**
(dead code na API pública do hook) — risco latente se alguém conectar isso no futuro sem notar
que passa por fora da RPC atômica.

---

## 2. Q8 — decisão por campo (o "O1" desta fatia, já mapeado, falta decidir)

Reler [Q8](etapa-5-fatia-3-quotes.md#12-q8--pendência-pós-fechamento-paridade-de-schema-localnuvem-bloqueia-cutover-de-leitura):
6 campos do `Quote` local sem coluna correspondente em `public.quotes` nem em `SupabaseQuote`.
Auditoria de uso real (grep + leitura de `QuotesSection.tsx`) para cada um:

| Campo | Editável? | Renderizado onde? | Veredito |
|---|---|---|---|
| `clientWhatsapp` | sim (`QuotesSection.tsx:648`) | wizard passo 4 (`:768`) + "Preview do orçamento" (`:903`) | **uso ativo** |
| `company` | sim (`:641`) | **tabela da lista** (`:265`) + wizard (`:766`) + preview (`:901`) | **uso ativo** |
| `paymentCondition` | sim (`:745`) | wizard (`:799`) + preview (`:941`) | **uso ativo** |
| `deliveryDeadline` | sim (`:748`) | wizard (`:800`) + preview (`:942`); também consumido por `QuoteToProjectDialog.tsx:73` | **uso ativo** |
| `validityDays` | sim (`:751`) | **tabela da lista** (`:305`) + wizard (`:801`) + preview (`:893`); alimenta os badges de vencimento (`useQuotes.ts`, `dayCenter.ts:273`) e `QuoteToReceivableDialog.tsx:71` | **uso ativo — o mais usado dos 6** |
| `notes` | sim (`:754`, textarea) | wizard (`:802`) + preview (`:943`) | **uso ativo** |

**Nenhum dos 6 é morto ou "escrito e nunca lido".** Todos os 6 são editáveis no wizard de criação
**e** renderizados de volta pro usuário em pelo menos o preview final ("Preview do orçamento" —
o documento que o cliente vê) — exatamente o comportamento que o Q8 original já havia flagrado
com o registro real (`fd9053a2-...`). `company` e `validityDays` aparecem até na tabela principal
da lista de orçamentos.

**Decisão recomendada: (a) migration para os 6 campos, sem exceção.** A opção (b) degradação
aceita causaria regressão visível de dado real para todo orçamento (perderia forma de pagamento,
prazo, observações, WhatsApp do cliente, razão social e dias de validade — literalmente o
conteúdo do documento comercial). A opção (c) não é sustentável para nenhum campo — todos têm uso
comprovado. Migration: `ALTER TABLE public.quotes ADD COLUMN` para os 6 (mesmo padrão do Q1),
sem `NOT NULL`/sem default — mesma recomendação que o Q8 original já registrava, agora confirmada
por evidência de uso, não só por leitura de tipo.

---

## 3. Tabela-filha (`quote_items`) — atomicidade

### 3.1 A RPC atômica só é usada pelo import

`importQuoteWithItems` (a RPC transacional) tem **um único chamador em todo o código**:
`useLocalQuotesImport.ts:241` (o assistente de import). Nenhuma ação de UI "criar/editar orçamento
ao vivo" a usa.

### 3.2 O único caminho de UI que cria quote+items no Supabase é NÃO-atômico

`CreateCrmSupabaseQuoteDialog.tsx` (acionado de `CRM.tsx` quando a oportunidade está em modo
Supabase + flag `crmSupabaseCreateQuote` ligada) faz **3 chamadas sequenciais, não-transacionais**:
`createQuote` → `replaceQuoteItems` (que por si já é `delete`+`insert`, 2 chamadas). Existe um
rollback de compensação (`softDeleteQuote` na quote recém-criada se o passo de itens falhar,
`CreateCrmSupabaseQuoteDialog.tsx:176-188`), mas é *best-effort* — não cobre falha parcial dentro
do próprio `replaceQuoteItems` (delete ok, insert falha) nem cobre o próprio rollback falhando
(só loga, não repropaga).

**Não existe hoje nenhum caminho de UI alcançável para editar os itens de uma quote Supabase já
existente** — `useSupabaseQuotes().replaceQuoteItems` existe mas não tem consumidor.

**Implicação para o design (Fase B):** um cutover que assuma "criação de quote é atômica" precisa
ou (i) rotear `CreateCrmSupabaseQuoteDialog.tsx` pela RPC (ou equivalente), ou (ii) aceitar
explicitamente a janela de falha parcial já existente, documentando-a como o §8.1 fez para
projects/tasks na Fatia 7 (lá era aceitável porque não havia RPC nem se propôs uma; aqui a RPC
**já existe e já é usada com sucesso pelo import** — não rotear por ela seria um retrocesso
deliberado, não uma limitação de infraestrutura).

---

## 4. Escrita hoje com flag off — mesmo exame que revelou O2/O3/O4 na Fatia 8

**Resultado: nenhum bug do tipo O2/O3/O4 encontrado na tela principal.** `QuotesSection.tsx` é
internamente consistente — **toda** ação de escrita (criar, marcar enviado, aprovar, recusar,
duplicar, arquivar, restaurar, excluir, gerar recebível, gerar projeto) chama uma função local
(`useQuotes()`), sem nenhum flag/dataSource check em lugar nenhum do arquivo, e todo toast usa
linguagem local ("Orçamento salvo", nunca "salvo no Supabase"). Isso é estruturalmente diferente
do CRM: lá havia um branch real com bugs dentro; aqui não há branch nenhum pra ter bug.

Achados adjacentes, de natureza diferente de O2/O3/O4 (não são bugs acidentais — são gaps
documentados no próprio código, ou lacunas de arquitetura descobertas agora):

### 4.1 "Gerar recebível"/"Gerar projeto" — nome da flag sugere Supabase, escrita é local por design

`quotesSupabaseCreateReceivable`/`quotesSupabaseCreateProject` gateiam **abrir o diálogo**, com
texto de toast que sugere "ativa escrita no Supabase". Mas o diálogo, mesmo com a flag ligada,
escreve **local** (`useFinance().addTransaction`/`useProjects().addProject`) — e isso é
**intencional e documentado**: `CreateReceivableDialog.tsx:29-37` e
`CreateProjectFromQuoteDialog.tsx:30-38` têm comentário explícito *"...DESATIVADO ATÉ O CUTOVER de
leitura de finance/projects, não abandonado..."*. Não é um bug — é um stopgap conhecido que só
faz sentido reativar quando projects/finance também tiverem seu próprio cutover. Registrado aqui,
não catalogado como "O" (não é acidental).

### 4.2 Achado novo — Q9: vocabulário de `status` é completamente disjunto, sem tradução

`QuoteStatus` local é português (`"rascunho"|"enviado"|"aprovado"|"recusado"|"vencido"|
"arquivado"`, `useQuotes.ts:5-11`). `quotesRepository.approveQuote`/`rejectQuote` gravam **inglês**
(`"approved"`/`"rejected"`) direto na coluna `status`, e `mapSupabaseQuoteToLocalQuote` faz um
cast cru sem tradução (`quoteMapper.ts:97`: `status: sq.status as unknown as Quote["status"]`).
`SupabaseQuotesViewerCard.tsx`/`LinkedQuotesSection.tsx` conferem contra os valores em inglês
(`"draft"`/`"approved"`/`"rejected"`) — nunca os em português que `QuotesSection.tsx` usa. **Hoje
os dois lados nunca se encontram** (telas diferentes, nunca leem o `status` um do outro), então
é inofensivo — mas qualquer unificação futura (um `QuotesSection.tsx` com branch de dataSource,
como o CRM tem) precisa resolver essa tradução **antes**, do contrário o mesmo campo `status`
significaria coisas diferentes dependendo de qual lado gravou por último. Mesma classe de achado
que a tradução `orçamento→quote` (Fatia 7, `Project.source`) e `income/expense→receivable/payable`
(Fatia 6) — aqui é `quotes.status`, campo próprio da própria entidade quotes.

**Catalogado como Q9** (continuando a numeração de achados da Fatia 3): bloqueante para qualquer
cutover que unifique a tela principal (não bloqueante para o que já existe hoje, que nunca cruza
os dois vocabulários).

### 4.3 Semântica de exclusão divergente (nota, não bloqueante)

`useQuotes().deleteQuote` é **hard delete** local (remove do array). `quotesRepository` só expõe
`softDeleteQuote` — não existe `deleteQuote` (hard) no lado Supabase, nem um "restaurar de
soft-delete" no repository. Reconciliar isso é decisão de Fase B, não achado bloqueante agora.

### 4.4 "Restaurar" local sempre volta pra `"rascunho"` (nota, local-only, pré-existente)

`QuotesSection.tsx:380-383`: restaurar um orçamento arquivado seta o status pra `"rascunho"`
incondicionalmente, não pro status anterior ao arquivamento — perde a informação de "estava
aprovado antes de arquivar". Pré-existente, local-only, fora do escopo do cutover em si — citado
só por completude.

---

## 5. Vínculos — projects/finance e criação reversa

### 5.1 `projectsRepository`/`financeRepository` já são Supabase-side e agnósticos ao modo de quotes

`findProjectByQuote`/`createProjectFromQuote` (`ux_projects_from_quote`) e
`findReceivableByQuote`/`createReceivableFromQuote` (`ux_ft_receivable_from_quote`) não importam
`quotesRepository`, não leem `orbyt.quotes.v1`, não checam flag nenhuma de quotes — **flipar o
default de escrita de quotes não muda nada dentro desses 2 repositories.** Hoje eles só são
exercitados pelos assistentes de import (`useLocalProjectsImport.ts`/`useLocalFinanceImport.ts`),
que já resolvem o UUID da quote via `kora.quotes.supabaseImport.v1` — ou seja, já tratam o
Supabase como referência, independente de onde a UI de quotes lê/escreve hoje.

### 5.2 Duas famílias paralelas, não interoperáveis, de "quote → projeto/recebível"

- **Vendas-local:** `QuoteToProjectDialog`/`QuoteToReceivableDialog` — fonte = quote local (prop
  `quote: Quote` vindo de `QuotesSection.tsx`), escrita = local (`useProjects`/`useFinance`).
- **CRM/Supabase-experimental:** `CreateProjectFromQuoteDialog`/`CreateReceivableDialog` — fonte
  = quote Supabase (props vindos de `SupabaseQuotesViewerCard`/`LinkedQuotesSection`), escrita =
  **local também** (o caminho nuvem `createProjectFromQuote`/`createReceivableFromQuote`
  está "DESATIVADO ATÉ O CUTOVER", por comentário explícito no código).

Nenhuma das duas escreve hoje um projeto/recebível **cloud** a partir de uma quote **cloud**, de
forma alcançável por UI — isso só acontece via os assistentes de import. Um cutover de escrita de
quotes seria o gatilho natural para religar o caminho cloud dessas 2 dialogs — mas essa religação
**não existe ainda**, é dependência a desenhar na Fase B, não algo que o flip por si resolve.

### 5.3 Criação reversa — existe 1 caminho: "Criar orçamento" a partir de uma oportunidade

`CRM.tsx:1287-1303` (`onCreateQuote`): se a oportunidade está em modo Supabase (`activeDataSource`
**do CRM**, não de quotes) + flag `crmSupabaseCreateQuote` ligada → abre
`CreateCrmSupabaseQuoteDialog` (escreve quote+items direto no Supabase, não-atômico, ver §3.2). Se
local → só navega pra `/vendas?...&newQuote=1` (cria pela tela local normal). Nenhum outro domínio
(client/project/task) cria uma quote como efeito colateral.

---

## 6. Medições — queries para o operador rodar

**Achado prévio às queries:** a tabela `public.quotes` **não tem coluna `is_demo`** (confirmado:
zero ocorrências em todas as migrations e no `SupabaseQuote`/mapper). Diferente de todos os
outros domínios já migrados (clients, opportunities, finance, projects, tasks) — não dá pra
separar demo de real na contagem cloud por essa coluna. A contagem cloud abaixo é só total; a
local separa por `isDemo` (que existe no tipo local).

**Local (console do navegador):**
```js
JSON.parse(localStorage.getItem('orbyt.quotes.v1') || '[]').length
JSON.parse(localStorage.getItem('orbyt.quotes.v1') || '[]').filter(q => !q.isDemo).length
```

**Nuvem (SQL Editor):**
```sql
select
  count(*) as quotes_total,
  count(*) filter (where deleted_at is null) as quotes_ativas,
  count(*) filter (where archived) as quotes_arquivadas
from public.quotes
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9';

select count(*) as quote_items_total
from public.quote_items qi
join public.quotes q on q.id = qi.quote_id
where q.workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9';
```

Relevante pro dimensionamento da Fase B: quantas linhas já existem hoje em `public.quotes` (via
import da Fatia 3/homologações passadas) que já sofreram o zeramento dos 6 campos do Q8 — cada
uma precisaria do backfill mencionado na recomendação original do Q8 antes de qualquer cutover de
leitura.

---

## 7. Proposta de recorte

### Classificação: **parcial — cutover completo numa fatia só não é recomendado**

Diferença de escopo em relação à Fatia 8 (opportunities), que justifica o corte diferente:

| | Opportunities (Fatia 8) | Quotes (Fatia 9) |
|---|---|---|
| Seletor de dataSource | já existia (`kora.crm.dataSource.v1`) | **não existe — precisa ser construído do zero** |
| Flag mestre de escrita | já existia (`kora.crm.supabaseWrite.enabled`), só faltava flipar | **não existe — nenhuma flag equivalente** |
| CRUD Supabase | completo, já testado (`useSupabaseOpportunities`) | completo no repository, mas com métodos-chave (`createQuote`/`replaceQuoteItems` do hook) sem consumidor nenhum hoje |
| Tabela-filha | não tem (`crm_opportunities` é folha) | tem (`quote_items`), com único caminho de criação via UI **não-atômico** |
| Tradução de vocabulário | nenhuma necessária (stage já literal) | **Q9** — status inteiro em vocabulário disjunto, sem tradução |
| Paridade de schema | O1, 2 campos (tags/history) | Q8, **6 campos**, todos com uso ativo comprovado |
| Consumidores fan-in | nenhum a reconciliar | 2 famílias paralelas de quote→projeto/recebível a unificar |

Cada linha da tabela acima é trabalho que a Fatia 8 não precisou fazer porque já vinha pronto de
fatias anteriores. Aqui, cada um precisa ser construído ou decidido pela primeira vez.

### Recomendação: dividir em 2 fatias

**Fatia 9 (esta) — fundação + leitura:**
1. Migration do Q8 (6 colunas) + backfill dos registros reais já migrados na Fatia 3.
2. Decisão de tradução do Q9 (provavelmente: manter os literais em inglês na coluna, adicionar
   uma função de tradução pura nos dois sentidos no mapper — mesmo padrão de
   `resolveCloudProjectSource` da Fatia 7 — decisão final cabe à Fase B).
3. Construir o seletor de dataSource pra quotes (`kora.quotes.dataSource.v1`, mesmo molde do
   CRM) e ligar `QuotesSection.tsx` a ele **só para leitura** — a tela passa a poder mostrar dados
   Supabase, escrita continua toda local (equivalente ao que o CRM já tinha ANTES da Fatia 8).
4. Sem escrita nova, sem RPC nova, sem religar as dialogs de projeto/recebível.

**Fatia 10 (futura) — escrita:**
5. Flag mestre de escrita (mesmo padrão do CRM).
6. Rotear `CreateCrmSupabaseQuoteDialog.tsx` pela RPC atômica (fechar o gap do §3.2).
7. Religar o caminho cloud de `CreateProjectFromQuoteDialog`/`CreateReceivableDialog`.
8. Reconciliar hard-delete vs. soft-delete e a semântica de "restaurar" (§4.3/§4.4).
9. Homologação completa dos dois lados (leitura já provada na Fatia 9, escrita nova aqui).

**Justificativa central:** o CRM já tinha 90% da infraestrutura pronta quando a Fatia 8 começou —
o próprio texto desta Fase A para opportunities dizia isso. Quotes está mais perto de onde
`opportunities` estava **antes** de qualquer fatia tocá-la: zero seletor, zero flag mestre, uma
RPC pronta mas nunca usada pela UI viva, um gap de vocabulário nunca antes descoberto. Tentar
fazer leitura+escrita+atomicidade+vocabulário+consumidores numa fatia só replicaria o padrão que
o project já evita (fatias pequenas, uma peça de cada vez) e aumentaria muito o raio de um
possível incidente, sem necessidade — a leitura sozinha já entrega valor (Configurações deixa de
precisar da tela separada `SupabaseQuotesViewerCard`) e prova o seletor antes de arriscar escrita.

---

## 8. Fase B — Design (fundação + cutover de leitura)

### 8.0 Achado que refina o Q9 (descoberto escrevendo este design, não na Fase A)

A Fase A registrou Q9 como "inofensivo hoje — os dois vocabulários nunca se encontram". Isso
estava certo para **leitura de UI**, mas incompleto para **dado já gravado**: `quoteMapper.ts:71`
— `mapLocalQuoteToSupabaseQuote` (usado pela RPC `import_quote_with_items`, ou seja, por **todo**
orçamento já importado desde a Fatia 3) grava `status: quote.status` **sem nenhuma tradução** —
o literal em português (`"rascunho"`, `"aprovado"` etc.) vai direto pra coluna `status` do banco.
Ou seja, **hoje já existem linhas reais em `public.quotes` com `status` em português**,
convivendo na mesma coluna com linhas criadas nativamente (`CreateCrmSupabaseQuoteDialog.tsx:129`,
`status: "draft"`) ou aprovadas/recusadas (`approveQuote`/`rejectQuote`, inglês). Isso não muda a
classificação de Q9 (ainda não bloqueia nenhuma fatia fechada), mas muda o design da tradução:
**não dá pra assumir que a coluna `status` só tem valores em inglês** — a função de tradução
precisa reconhecer os dois vocabulários simultaneamente, não só EN→PT.

### 8.1 Migration Q8 — 6 colunas, todas nullable, sem rewrite

| Coluna | Tipo | Justificativa (1 linha) |
|---|---|---|
| `client_whatsapp` | `text` | espelha `Quote.clientWhatsapp` — telefone formatado livre, mesmo padrão de `client_name`/`client_email` já existentes na tabela |
| `company` | `text` | espelha `Quote.company` — razão social opcional, texto livre |
| `payment_condition` | `text` | espelha `Quote.paymentCondition` — **é um rótulo livre** ("À vista no Pix"), não um enum; `text` evita modelar um enum que a UI local também não tem |
| `delivery_deadline` | `text` | espelha `Quote.deliveryDeadline` — **também é rótulo livre** ("15 dias"), não uma data; `QuoteToProjectDialog.tsx:73` já faz o parse próprio (`parseDeliveryDeadlineToISO`) a partir do texto — a coluna não deve antecipar esse parse |
| `validity_days` | `integer` | espelha `Quote.validityDays` — número inteiro de dias, usado em aritmética de data (`getQuoteExpiryDate`) |
| `notes` | `text` | espelha `Quote.notes` — observações livres, textarea de 600 caracteres no form local |

Nenhuma tem `NOT NULL` nem `DEFAULT` — todas `ADD COLUMN` **metadata-only** (Postgres 11+, mesmo
raciocínio já usado no O1 da Fatia 8). Nenhum índice novo — nenhuma das 6 participa de chave de
idempotência ou de busca — **não precisa de `CONCURRENTLY`/autocommit**, roda em transação normal.

**Backfill:** necessário só para linhas já importadas antes desta migration (as colunas não
existiam, então os 6 campos estão fisicamente ausentes, não só `NULL` por opção) — mas como o
import é idempotente (`ON CONFLICT` por `source_local_id`), rodar o assistente de import de novo
para os workspaces já migrados **naturalmente faz o backfill**, sem precisar de UPDATE manual —
desde que o mapper (§8.2) já esteja estendido para mandar os 6 campos no próximo import/reimport.
Não incluído como statement de migration (é operação de aplicação, não de schema) — registrado
como passo do runbook de homologação (§8.6).

Arquivo: `supabase/migrations/20260723000200_etapa5_fatia9_quotes_add_q8_fields.sql` (escrito
nesta rodada, não aplicado).

### 8.2 Tradução Q9 — tabela bidirecional no mapper, com reconhecimento dos dois vocabulários

**Cloud → Local (leitura, usada por `mapSupabaseQuoteToLocalQuote` — o caminho que a Fatia 9
liga na tela principal):**

| `status` na coluna | `archived` na coluna | `Quote.status` local resultante |
|---|---|---|
| qualquer valor | `true` | `"arquivado"` — `archived` manda, sempre (mesmo espírito do que o mapper já faz na direção local→nuvem hoje, linha 73, só que agora explícito nos dois sentidos) |
| `"draft"` | `false` | `"rascunho"` |
| `"sent"` | `false` | `"enviado"` |
| `"approved"` | `false` | `"aprovado"` |
| `"rejected"` | `false` | `"recusado"` |
| `"rascunho"`/`"enviado"`/`"aprovado"`/`"recusado"`/`"arquivado"` (literal PT, ver §8.0) | `false` | mesmo literal, passthrough — já é um `QuoteStatus` local válido |
| qualquer outro valor / `null` | `false` | `"rascunho"` (fallback seguro, nunca undefined/crash) |

**Consequência prática do fallback de passthrough:** as linhas já gravadas com `status` em
português (achado do §8.0) **não precisam de backfill separado** — a função de tradução já as
reconhece corretamente como estão, sem exigir nenhum UPDATE de dado antes do cutover de leitura.

**Local → Cloud (escrita — só relevante pro import nesta fatia, já que a tela principal continua
sem escrita própria; ver §8.4):**

| `Quote.status` local | `status` gravado | `archived` gravado |
|---|---|---|
| `"rascunho"` | `"draft"` | `false` |
| `"enviado"` | `"sent"` | `false` |
| `"aprovado"` | `"approved"` | `false` |
| `"recusado"` | `"rejected"` | `false` |
| `"arquivado"` | `"draft"` (neutro — local não preserva o status anterior ao arquivar, ver achado §4.4 da Fase A) | `true` |
| `"vencido"` | **nunca ocorre** — `"vencido"` é sempre computado (`QuotesSection.tsx:70`, `effectiveStatus`), nunca gravado em `Quote.status`; não é um caso a tratar na tradução |

**Requisito de teste dedicado por direção** (Fase C): um teste que prove cada linha das duas
tabelas acima, mais o caso de fallback de passthrough (§8.0) e o caso `archived=true` sobrepondo
qualquer `status` (incluindo um `status` "impossível"/desconhecido junto de `archived=true`, pra
confirmar que `archived` sempre vence).

### 8.3 Seletor de dataSource — `kora.quotes.dataSource.v1`, default LOCAL nesta fatia

Espelha `CRM_DATA_SOURCE_KEY` (`flags.ts:77`): `getQuotesDataSource(): "local" | "supabase"`,
`setQuotesDataSource(source)`, mesmo formato de leitura (`localStorage.getItem(...) === "local" ?
"local" : ...` — **mas invertido do CRM**: aqui **só `"supabase"` explícito seleciona nuvem**;
qualquer outro valor (ausente, `"local"`, malformado) resolve pra `"local"`. Justificativa da
inversão: o CRM já tinha decidido, antes da Fatia 8, que o default seria Supabase — decisão de
uma rodada anterior não documentada nesta cadeia de fatias, não algo a replicar às cegas aqui.
Quotes está começando do zero; o "molde" original (Fatia 1, ficha técnica) também começou com
default local e só considerou trocar depois de homologar.

**Recomendação sobre quando flipar o default:** **não nesta fatia.** O deliverable da Fatia 9 é
o seletor construído, testado, e disponível como opção (mesmo card de Configurações que já existe
hoje, `SupabaseQuotesViewerCard.tsx`, ganha um toggle de dataSource igual ao do CRM — em vez de
depender só da flag `quotesSupabaseExperimental` pra existir). Decidir o flip do default é
decisão **pós-homologação**, com "vai" próprio — mesmo padrão da Fatia 1 (nunca decidiu
sozinha aposentar a flag) e da própria Fatia 8 (o flip de escrita do CRM só aconteceu numa fatia
inteira depois do seletor de leitura já existir).

`QuotesSection.tsx` passa a ler `getQuotesDataSource()` no mount (mesmo padrão do CRM,
`useState(() => getQuotesDataSource())`) e a render decide entre `useQuotes()` (local) e
`useSupabaseQuotes()` (nuvem) — sem os dois rodarem escrita simultânea, só um dos dois alimenta
a tela por vez, exatamente como `CRM.tsx` já faz pra `leads`/`supabaseOpportunities`.

### 8.4 Leitura Supabase na tela principal — `useSupabaseQuotes()` já serve, sem mudança de hook

Achado ao investigar o hook para este design: **`useSupabaseQuotes()` já retorna exatamente a
forma que a tela precisa** — `fetchQuotesWithItems` (`useSupabaseQuotes.ts:20-31`) já busca
quotes **e** os items de cada uma, já mapeia tudo pra `Quote[]` local via
`mapSupabaseQuoteToLocalQuote` + anexa `.items`. **Nenhum hook novo precisa ser escrito** — o
trabalho da Fase C nisso é só (a) estender o mapper (§8.1/§8.2) e (b) trocar a fonte de dado que
`QuotesSection.tsx` lê, condicionada ao seletor do §8.3.

**O que a tela mostra/esconde em modo Supabase — lição direta de O2/O3/O4: nenhuma ação que
finge funcionar.** Diferente do CRM (que tinha uma flag de escrita pra ligar depois), esta fatia
**não tem nenhuma flag de escrita** — logo, em modo Supabase, **100% das ações de escrita ficam
bloqueadas, sem exceção, sem flag**: criar, editar, marcar enviado, aprovar, recusar, duplicar,
arquivar, restaurar, excluir, gerar recebível, gerar projeto. Toda ação passa a checar
`dataSource === "supabase"` **antes** de qualquer chamada local, e mostra
`toast.error("Edição de orçamentos no modo Supabase chega numa próxima fatia — volte para Local
para editar.")` — mesmo texto/padrão já usado pelo `blockWriteAction` do CRM. Nenhum botão
desaparece (evita "onde foi parar a ação" — mesma reclamação implícita que o CRM já resolveu
mantendo os botões visíveis, só bloqueados com aviso) — todos ficam visíveis e clicáveis, só
bloqueados no primeiro passo do handler, igual ao padrão já estabelecido.

### 8.5 Fora de escopo explícito desta fatia

- Escrita de quotes em qualquer superfície (fica pra Fatia 10).
- Atomicidade do `CreateCrmSupabaseQuoteDialog.tsx` (Q10, roteado pra Fatia 10).
- As 4 flags estreitas existentes (`quotesSupabaseExperimental`/`Approval`/
  `CreateReceivable`/`CreateProject`) e a `crmSupabaseCreateQuote` — intocadas, continuam
  gateando exatamente o que já gateiam hoje nas 2 superfícies secundárias.
- Reconciliação das 2 famílias paralelas de quote→projeto/recebível (§5.2 da Fase A).
- Hard-delete vs. soft-delete (§4.3 da Fase A).

### 8.6 Runbook de homologação — desenho de casos (proposta, não executável ainda)

| Caso | O que prova | Setup necessário |
|---|---|---|
| (a) leitura default local intacta | seletor nunca tocado → `QuotesSection.tsx` continua mostrando `orbyt.quotes.v1`, comportamento idêntico a hoje | nenhum |
| (b) flip manual pro seletor Supabase | toggle no card de Configurações muda a leitura pra nuvem, sem F5 quebrar nada | 1 quote sintética na nuvem |
| (c) tradução de status visível | quote sintética com `status="approved"`/`archived=false` aparece como "Aprovado" na UI local; outra com `archived=true` aparece como "Arquivado" independente do `status` por baixo | 2-3 quotes sintéticas cobrindo os casos da tabela do §8.2 |
| (d) passthrough de status legado (achado §8.0) | quote sintética criada via SQL direto com `status='aprovado'` (literal PT, simulando o dado real já existente) aparece corretamente como "Aprovado", sem erro | 1 quote sintética com status PT cru |
| (e) items renderizados | quote sintética com 2+ itens mostra os itens certos (nome, quantidade, preço) | reusa (b) |
| (f) campos do Q8 visíveis | quote sintética com os 6 campos preenchidos mostra todos certos no preview/tabela | reusa (b), campos preenchidos no insert |
| (g) escrita bloqueada, em TODAS as ações | tentar cada uma das ações de escrita (§8.4) em modo Supabase → toast de erro claro, nenhuma delas "funciona sozinha", nenhum toast de sucesso falso | reusa (b) |
| (h) rollback | voltar o seletor pra Local → `orbyt.quotes.v1` 100% intacto, nenhuma escrita aconteceu nele durante o tempo em modo Supabase | reusa (b) |
| (i) import continua funcionando | rodar o assistente de import (Fatia 3) depois do cutover de leitura ligado → sem regressão, mesmo comportamento de sempre | seed local não-importado |

**Critério de aceite proposto:** 9/9. Seed sintético dedicado (emenda §11 — `quotes` tem dado
real, mesma cautela da Fatia 8) fica pra desenhar na Fase D, depois da implementação.

---

**PARADO aqui.** Design de Fase B entregue (§8.0-§8.6) — migration Q8 escrita (não aplicada),
tradução Q9 completa nos dois sentidos com o achado do passthrough legado (§8.0), seletor de
dataSource desenhado (default local, flip de default explicitamente adiado pra depois da
homologação), leitura via hook já existente (`useSupabaseQuotes`, sem hook novo), bloqueio
uniforme de escrita (lição O2/O3/O4 aplicada desde o design, não descoberta depois), e o runbook
de 9 casos. **NADA EXECUTA sem o "vai" literal do revisor, colado neste chat pelo operador** —
inclusive a implementação de Fase C.
