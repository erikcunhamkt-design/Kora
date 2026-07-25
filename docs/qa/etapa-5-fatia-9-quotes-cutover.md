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

## 9. Pré-condições da Fase C (leitura de código, nenhum código alterado)

### 9(a) Tabela de tradução PT↔EN literal, com o terceiro caso (status desconhecido)

Consolidação em forma final de código (implementação em `quoteMapper.ts`, Fase C):

```
const CLOUD_TO_LOCAL_STATUS: Record<string, QuoteStatus> = {
  draft: "rascunho",
  sent: "enviado",
  approved: "aprovado",
  rejected: "recusado",
  // Passthrough legado (achado §8.0): quotes já importadas antes desta fatia
  // gravaram o literal PT cru na coluna status (mapLocalQuoteToSupabaseQuote
  // nunca traduziu). Estes 5 literais já são QuoteStatus local válidos.
  rascunho: "rascunho",
  enviado: "enviado",
  aprovado: "aprovado",
  recusado: "recusado",
  arquivado: "arquivado",
};

const LOCAL_TO_CLOUD_STATUS: Record<Exclude<QuoteStatus, "vencido" | "arquivado">, string> = {
  rascunho: "draft",
  enviado: "sent",
  aprovado: "approved",
  recusado: "rejected",
};
```

**Terceiro caso — `status` que não bate com nenhuma chave do mapa (nunca visto até hoje, mas
não impossível — ex.: valor gravado por uma ferramenta externa, ou corrupção manual via SQL
Editor):** a instrução desta rodada é explícita — **nunca oculto silenciosamente**. Desenho:

1. **Mapper:** `mapSupabaseQuoteToLocalQuote` retorna `status: "rascunho"` (fallback seguro, o
   tipo `QuoteStatus` exige um dos 6 literais válidos — não dá pra devolver um 7º valor sem
   quebrar todo o resto do app que já assume o union fechado). **Mas** o objeto `Quote` ganha um
   campo novo, só preenchido no sentido nuvem→local: `cloudStatusRaw?: string` — carrega o
   literal exato que veio do banco sempre que ele não bateu com nenhuma chave do mapa (`undefined`
   nos demais casos, incluindo todo `Quote` criado localmente). Aditivo, opcional,
   *backward-compatible* — não muda nenhuma assinatura existente.
2. **Renderiza:** `QuotesSection.tsx` (modo Supabase) — quando `cloudStatusRaw` está presente,
   mostra a badge normal de "Rascunho" **mais** um ícone/texto de aviso ao lado (`⚠ status bruto:
   "{cloudStatusRaw}"`), mesmo padrão visual já usado pelo aviso de "cliente não vinculado" nos
   cards de import (`⚠ {N} oportunidade(s)... sem vínculo`, `Configuracoes.tsx:1809-1813`).
3. **Filtra:** cai no filtro "Rascunho" (é onde o fallback o colocou) — **não** some do filtro
   "Todos" nem fica preso num limbo sem filtro nenhum.
4. **Conta:** novo contador, mesmo espírito do `totalClientOrphan` já existente — "N com status
   não reconhecido" — visível, não bloqueia nada, só torna o caso descobrível em vez de invisível.

### 9(b) Simetria da regra `archived` — confirmada, modo local já esconde arquivadas por padrão

Confirmado por leitura de `QuotesSection.tsx:161`: `filtered` quando `filterStatus === "all"` já
faz `quotes.filter((q) => q.status !== "arquivado")` — **o modo local já esconde arquivadas da
lista padrão hoje**, mostrando-as só quando o usuário clica explicitamente na aba "Arquivado"
(`:216`, uma das opções do filtro). **A regra é simétrica por construção**: o design do §8.4 não
precisa de nenhum tratamento especial pro modo Supabase — a mesma lógica de `filtered`/
`effectiveStatus` já existente serve os dois modos sem alteração, desde que `q.status` chegue
normalizado (§9a) antes de tocar esse código. Nenhuma mudança de comportamento a implementar
aqui além da tradução em si.

### 9(c) Requisito: filtros/contadores operam sobre o vocabulário normalizado

Confirmado por leitura: `openQuotes`, `approvedQuotes`, `approvedPendingFinance`, `expiringSoon`,
`filtered` (todos em `QuotesSection.tsx:150-163`) leem `q.status`/`effectiveStatus(q)`
**diretamente do objeto `Quote`** — nenhum deles reimplementa lógica de status própria. **Isso
significa que a normalização precisa acontecer só uma vez, na fronteira (`quoteMapper.ts`)** —
uma vez que `mapSupabaseQuoteToLocalQuote` devolve um `Quote` com `status` já traduzido (§9a),
todo o resto da tela (contadores, filtros, badges, exceto o aviso extra do terceiro caso) funciona
sem nenhuma mudança adicional, pelo mesmo motivo que já funciona hoje pro modo local. Requisito
formal pra Fase C: **nenhum novo código de contagem/filtro é escrito** — só a tradução no mapper e
o aviso do terceiro caso (§9a, item 2/4).

---

## 10. Fase C — Resultado (implementação + aplicação da DDL Q8)

### 10.1 Itens 1-4 + pré-condições — implementados, testados, commitados

| Etapa | Hash | O quê |
|---|---|---|
| Pré-condições §9 | `38abfc7` | Tabela PT↔EN literal + regra do 3º caso; simetria `archived`; requisito de normalização único no mapper |
| Item 1 (código) | `14788ba` | 2 migrations SQL + interfaces/RPC-call do repository + cast `QuoteUpdate` (G10) |
| Item 2 | `72536c4` | Tradução Q9 bidirecional + campos Q8 no mapper — 17 testes novos (33 no arquivo) |
| Item 3 | `ee12955` | Seletor `kora.quotes.dataSource.v1`, default LOCAL — 6 testes novos (28 no arquivo) |
| Item 4 | `46b690d` | `QuotesSection` lê do seletor; escrita 100% bloqueada via guarda por handler (não wrapper transparente — lição O2/O3/O4 da Fatia 8, aplicada por design, não corrigida depois) — 8 testes novos |

Gates confirmados pós-item-4: `tsc -p tsconfig.app.json --noEmit` → 0 erros · `vitest run` → 28
arquivos, 255/255 (247 + 8 novos) · `node scripts/lint-gate.mjs` → 37/37 erros (baseline), 34/34
`no-explicit-any` (baseline), sem supressão nova.

### 10.2 Migration Q8 — escrita, corrigida em campo, e **APLICADA** (2026-07-23, sob §8)

`20260723000200_etapa5_fatia9_quotes_add_q8_fields.sql` (6 `ADD COLUMN IF NOT EXISTS` +
`COMMENT`) aplicou limpo na primeira tentativa:

```
ALTER TABLE
COMMENT
COMMENT
COMMENT
COMMENT
COMMENT
COMMENT
```

`20260723000300_etapa5_fatia9_import_quote_with_items_add_q8_params.sql` (RPC
`import_quote_with_items` estendida com os 6 parâmetros novos) **falhou na primeira tentativa**
com um bug real de design, não um problema do operador:

```
psql:...20260723000300...sql:136: ERROR:  function name "public.import_quote_with_items" is not unique
DICA:  Specify the argument list to select the function unambiguously.
```

**Causa:** a migration assumia que `CREATE OR REPLACE FUNCTION` com parâmetros novos
acrescentados só no fim (todos `DEFAULT NULL`) preserva a identidade da função existente de 14
argumentos. Isso está errado — no Postgres a identidade de uma função é a lista de **tipos** dos
argumentos, e 14→20 tipos é uma assinatura diferente. Sem um `DROP` explícito da assinatura
antiga, o `CREATE OR REPLACE` cria uma **segunda função sobrecarregada** ao lado da original, e o
`COMMENT ON FUNCTION` final do arquivo (sem lista de argumentos) ficou ambíguo entre as duas.

**Correção** (no próprio arquivo `20260723000300...sql`, antes do `CREATE OR REPLACE FUNCTION`):

```sql
DROP FUNCTION IF EXISTS public.import_quote_with_items(
  uuid, text, uuid, uuid, text, text, text, text, numeric, numeric, numeric, text, boolean, jsonb
);
```

mais a qualificação do `COMMENT ON FUNCTION` final com a lista completa de 20 tipos. Reaplicada:

```
DROP FUNCTION
CREATE FUNCTION
REVOKE
GRANT
COMMENT
```

**Verificação pós-aplicação** (pré-check → pós-check, output bruto conferido pelo Code):

```
-- overloads de import_quote_with_items: 1 (não mais ambíguo)
-- colunas: client_whatsapp, company, delivery_deadline, notes, payment_condition (text) +
--          validity_days (integer) — todas nullable
-- import_quote_with_items: assinatura completa de 20 parâmetros, os 6 novos com DEFAULT NULL
-- quotes_count: 1 antes, 1 depois — zero linhas alteradas (só schema)
```

Bate exatamente com o esperado. Item 1 da Fase C encerrado.

### 10.3 Incidente §15 — credencial exposta em chat (2×), já rotacionada

**Incidente de sessão (registrado, não catalogado como novo achado):** durante o troubleshooting
da aplicação (múltiplas falhas de conexão do terminal do operador — `winpty`, diretório errado,
variável de ambiente não propagada entre janelas), o operador colou o histórico completo do
terminal no chat para diagnóstico. A connection string com a senha em texto puro apareceu **2
vezes** dentro desse texto colado: uma tentativa de colar a string solta no prompt (ecoada de
volta pelo PowerShell como comando não reconhecido) e a linha do `$env:DATABASE_URL = '...'` em
si. O Code identificou a exposição no ato, recusou usar/reproduzir o valor em qualquer resposta
subsequente, e instruiu rotação imediata. **O operador confirmou a rotação da senha do banco**
antes do fechamento desta rodada — mesmo critério já em vigor (protocolo §15, motivada
originalmente por um incidente equivalente na Fatia 8).

**Vetor específico deste incidente, distinto do da Fatia 8:** lá foram prints/mensagens avulsas
com a connection string colada isoladamente; aqui foi um **histórico completo de terminal**
colado para diagnóstico de uma falha de conexão — a credencial estava "no meio" de dezenas de
linhas de output legítimo (pré-checks, migrations, pós-checks), não isolada. O protocolo §15
cobre "print/mensagem colada/comando ecoado" em geral, mas não nomeia esse vetor específico
(diagnóstico via histórico completo).

**Proposta de emenda §15-b (revisor, pendente de aprovação formal no sign-off):**
> Ao colar terminal para diagnóstico de falha, colar **apenas do comando que falhou em diante**,
> nunca o histórico completo da sessão. Blocos de comando que contêm `export`/`$env:` de
> atribuição de credencial nunca são colados no chat, mesmo como parte de um histórico maior —
> nem o comando em si, nem sua confirmação de sucesso/eco.

### 10.4 Confirmação — arquivo commitado idêntico ao aplicado no banco

O `DROP FUNCTION IF EXISTS` e o `COMMENT ON FUNCTION` qualificado foram adicionados ao arquivo
`20260723000300_etapa5_fatia9_import_quote_with_items_add_q8_params.sql` **antes** de instruir o
operador a rodar o retry (§10.2) — não houve edição posterior à aplicação. A sequência de saída
do retry (`DROP FUNCTION` → `CREATE FUNCTION` → `REVOKE` → `GRANT` → `COMMENT`, todas sem erro,
`exit code: 0`) corresponde exatamente às 5 instruções presentes no arquivo committado, na mesma
ordem. **Arquivo em disco = DDL de fato aplicada no banco.**

### 10.5 Item 4b — gap do 3º caso (§9a), achado pela pergunta pré-runbook

Ao converter o desenho do §9a num caso de runbook executável (item 2 do prompt de Fase D — seed
com status inventado, provando "nunca oculta silenciosamente"), o Code parou **antes de escrever
o caso** e checou por grep se a implementação de fato sustentava o que o caso ia testar. Achado:
`Quote.cloudStatusRaw` (existente desde o item 2, mapper) **nunca era lido em
`QuotesSection.tsx`** — o item 4 original cobriu dataSource + bloqueio de escrita, mas não a parte
visual do 3º caso. Sem a correção, o caso de runbook teria sido escrito pra testar um
comportamento que não existia — e só teria sido descoberto na execução pelo operador, tarde
demais pra ser barato de corrigir.

**Correção — commit `7654351`:** contador aditivo "N com status vindo da nuvem" (mesmo padrão de
`totalClientOrphan`) + badge de aviso por linha com o valor bruto, sempre ao lado da badge normal
de status (nunca substituindo) — 2 testes novos, gates verdes (257/257, 37/37, 34/34).

**Crédito ao processo:** o gap não foi pego em código-review nem em homologação — foi pego pela
disciplina de "não escrever um caso de teste pra um comportamento sem antes confirmar que ele
existe", a mesma que já tinha evitado o bug O2/O3/O4 no design do item 4 original (§ do commit
`46b690d`). Registrado aqui a pedido explícito do revisor.

---

Fase C encerrada — implementação (itens 1-4 + 4b) e aplicação da DDL (item 1) concluídas e
verificadas, gates verdes, 1 incidente de credencial registrado e já mitigado (rotação confirmada
pelo operador), proposta de emenda §15-b registrada para aprovação no sign-off, gap do 3º caso
achado e corrigido antes da homologação.

---

## 11. Fase D — Runbook executável da homologação (8 casos) — PRONTO PARA EXECUÇÃO

> **Nada foi executado ainda** — os artefatos abaixo (seed, SQL, passos, limpeza) estão prontos
> para colar, aguardando o "vai" literal do revisor. A execução é do operador, com revisão passo
> a passo. Esta rodada testa **só a leitura** (é o recorte desta fatia — §7) — não há caso de
> escrita bem-sucedida a provar, só o bloqueio uniforme dela.

**`quotes` tem dados reais** (Fatia 3 já homologou o import; uso real desde então). Emenda §11 do
protocolo (dado real é só-leitura em homologação) aplica com força total — nenhum caso lê o volume
real pra calibrar nada, nenhum caso cria linha com FK apontando pra cliente/oportunidade real.
Prefixo `HOMOLOG-F9-` em todo título/nome sintético — nenhum reaproveita nome/id de dado real.
Workspace de teste (mesmo das Fatias 1-8): `2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9`.

### 11.1 Pré-requisito — baseline + checagem do seletor (operador roda, SÓ LEITURA)

```sql
-- (1) Baseline — contagem de quotes ATIVAS antes de semear qualquer coisa. Guardar o número: é
-- o alvo de "volta ao normal" da limpeza do §11.5 (NÃO é 0 — há quotes reais no workspace; só
-- não pode sobrar nenhum HOMOLOG-F9-* depois da limpeza).
select count(*) as quotes_baseline
from public.quotes
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and deleted_at is null;
```

```js
// (2) Checagem do seletor desta sessão de navegador — esperado ausente (nunca tocado; default
// LOCAL, §8.3). Anote o valor atual antes de mexer, pra restaurar exatamente esse estado depois.
console.log("quotes dataSource atual:", localStorage.getItem("kora.quotes.dataSource.v1"));
```

### 11.2 Seed — quotes SINTÉTICAS (SQL) + 1 quote local sintética (JS)

#### 11.2.1 SQL — 3 quotes sintéticas na nuvem (pt / en / status desconhecido)

```sql
-- HOMOLOG-F9-pt — status em português CRU, simula o achado do §8.0 (passthrough legado: o
-- import nunca traduziu status antes desta fatia — dado real pode estar assim hoje).
insert into public.quotes
  (workspace_id, client_name, title, subtotal, discount, total, status, archived)
values
  ('2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9', 'HOMOLOG-F9-cliente', 'HOMOLOG-F9-pt', 800, 0, 800, 'aprovado', false)
returning id;
-- guarde o id -> <HOMOLOG_PT_UUID>
```

```sql
-- HOMOLOG-F9-en — status em inglês, o vocabulário "nativo" da nuvem pós-fatia. Também carrega
-- os 6 campos Q8, pra provar que aparecem certos na leitura.
insert into public.quotes
  (workspace_id, client_name, title, subtotal, discount, total, status, archived,
   client_whatsapp, company, payment_condition, delivery_deadline, validity_days, notes)
values
  ('2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9', 'HOMOLOG-F9-cliente', 'HOMOLOG-F9-en', 1200, 0, 1200, 'approved', false,
   '(11) 90000-0000', 'HOMOLOG-F9 Empresa', '50% entrada', '20 dias', 30, 'Semente Fatia 9 — Q8/Q9')
returning id;
-- guarde o id -> <HOMOLOG_EN_UUID>; vira quote_id da query seguinte
```

```sql
-- Itens da HOMOLOG-F9-en — prova que quote_items renderiza certo na leitura (troque o
-- <HOMOLOG_EN_UUID> pelo id retornado acima).
insert into public.quote_items (quote_id, name, quantity, unit_price)
values
  ('<HOMOLOG_EN_UUID>', 'Item A homologação', 2, 300),
  ('<HOMOLOG_EN_UUID>', 'Item B homologação', 1, 600);
```

```sql
-- HOMOLOG-F9-unknown — status inventado, nunca visto, prova o 3º caso (§9a/item4b): nunca
-- oculto silenciosamente.
insert into public.quotes
  (workspace_id, client_name, title, subtotal, discount, total, status, archived)
values
  ('2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9', 'HOMOLOG-F9-cliente', 'HOMOLOG-F9-unknown', 400, 0, 400, 'xyz', false)
returning id;
-- guarde o id -> <HOMOLOG_UNKNOWN_UUID>
```

#### 11.2.2 JS (console do navegador, produção) — quote local para o caso de import (§11.3, passo 17)

```js
// Etapa 5 · Fatia 9 (quotes) — SEED do quote local não-importado. Preserva o que já existe em
// orbyt.quotes.v1. Prefixo "HOMOLOG-F9-". Inclui 2 campos Q8 (company/notes) — prova, depois do
// import, que a RPC estendida (item 1) de fato persiste os 6 campos novos, não só as colunas.
const existingQuotes = JSON.parse(localStorage["orbyt.quotes.v1"] || "[]");
const seedQuote = {
  id: "homolog-f9-import-quote-1",
  clientName: "HOMOLOG-F9-cliente-import",
  clientEmail: "",
  clientWhatsapp: "",
  title: "HOMOLOG-F9-import",
  description: "",
  items: [{ id: "homolog-f9-item-1", name: "Item de teste import", quantity: 1, unitPrice: 500 }],
  subtotal: 500,
  discount: 0,
  total: 500,
  paymentCondition: "50% entrada",
  deliveryDeadline: "15 dias",
  validityDays: 10,
  status: "rascunho",
  createdAt: new Date().toISOString(),
  company: "HOMOLOG-F9 Empresa Import",
  notes: "Semente Fatia 9 — prova de import + propagação dos 6 campos Q8",
};
localStorage.setItem("orbyt.quotes.v1", JSON.stringify([...existingQuotes, seedQuote]));
console.log("✅ Seed F9 (local, import) gravado:", seedQuote.id, seedQuote.title);
```

### 11.3 Passos do operador, em ordem

| # | ONDE | O que fazer | O que anotar | Verde quando |
|---|---|---|---|---|
| 1 | SQL Editor | Rodar baseline (§11.1.1) | `quotes_baseline` | número anotado |
| 2 | Console do navegador (produção) | Rodar checagem do seletor (§11.1.2) | valor atual (esperado `null`) | anotado |
| 3 | SQL Editor | Rodar as 3 queries de seed + itens (§11.2.1) | os 3 `id` retornados → `<HOMOLOG_PT_UUID>` / `<HOMOLOG_EN_UUID>` / `<HOMOLOG_UNKNOWN_UUID>` | 3 quotes + 2 itens criados |
| 4 | Console do navegador (produção) | Rodar o seed JS (§11.2.2) | log "✅ Seed F9 (local, import) gravado" | sem erro no console |
| 5 | Navegador | **F5** (recarregar a página inteira) | — | página recarrega |
| 6 | App → Orçamentos | Se o seletor do passo 2 tinha algum valor, limpar: console `localStorage.removeItem("kora.quotes.dataSource.v1")` + **F5** | — | seletor ausente |
| 7 | App → Orçamentos | Abrir a tela (sem tocar em nada) | Tela mostra só os orçamentos locais de sempre; **nenhum** `HOMOLOG-F9-*` aparece | ✅ **caso 3 (modo local intacto)** — leitura default é local, `orbyt.quotes.v1` não muda |
| 8 | App → Orçamentos | Clicar **Supabase experimental** | toast de troca de fonte | badge "Modo leitura" aparece |
| 9 | App → Orçamentos | Localizar `HOMOLOG-F9-pt` e `HOMOLOG-F9-en` na tabela | ambas com badge **Aprovado** (mesma cor/rótulo, apesar de status bruto `'aprovado'` vs `'approved'` diferentes no banco) | ✅ **caso 4, parte tradução+agrupamento** — filtro "Aprovado" mostra as duas juntas; contador "Aprovados" (KPI) conta 2 |
| 10 | App → Orçamentos | Abrir o preview de `HOMOLOG-F9-en` (clique na linha) | 2 itens visíveis: "Item A homologação" (qtd 2, R$300) e "Item B homologação" (qtd 1, R$600); campos Q8 (WhatsApp, empresa, condição, prazo, validade, notas) visíveis | ✅ **caso 4, parte itens+Q8** |
| 11 | App → Orçamentos | Localizar `HOMOLOG-F9-unknown` | badge **Rascunho** + badge de aviso ao lado `⚠ status bruto: "xyz"`; banner acima dos KPIs mostra "1 orçamento(s) com status vindo da nuvem..." | ✅ **caso 4, parte 3º caso** — nunca mascarado de rascunho puro (item4b) |
| 12 | App → Orçamentos | Clicar **Novo orçamento**, preencher título `HOMOLOG-F9-deveria-falhar`, salvar | toast de **erro** ("Edição de orçamentos no modo Supabase...") | ✅ **caso 5, criar** — nenhuma linha nova, diálogo continua aberto |
| 13 | App → Orçamentos | Menu ⋮ de `HOMOLOG-F9-pt` → tentar **Marcar como recusado** | toast de erro, mesma mensagem | ✅ **caso 5, mudar status** — sem toast de sucesso |
| 14 | App → Orçamentos | Menu ⋮ de `HOMOLOG-F9-pt` → tentar **Duplicar** | toast de erro | ✅ **caso 5, duplicar** — nenhuma linha nova |
| 15 | App → Orçamentos | Menu ⋮ de `HOMOLOG-F9-pt` → tentar **Arquivar** | toast de erro | ✅ **caso 5, arquivar** |
| 16 | App → Orçamentos | Menu ⋮ de `HOMOLOG-F9-pt` → **Excluir** → confirmar no diálogo | toast de erro (não some da tabela) | ✅ **caso 5, excluir** |
| 17 | SQL Editor | Rodar prova 11.4 **(5)** | — | as 3 quotes `HOMOLOG-F9-*` continuam com o `status`/`archived`/valores originais do seed, sem nenhuma linha nova |
| 18 | App → Orçamentos | Clicar **Local** (volta o seletor) | banner de modo leitura some | ✅ início do **caso 6 (rollback)** |
| 19 | App → Orçamentos | Reabrir a tela | mostra os orçamentos locais de sempre; nenhum `HOMOLOG-F9-*` visível | ✅ **caso 6** — local nunca foi tocado |
| 20 | SQL Editor | Rodar prova 11.4 **(6)** | — | as 3 quotes `HOMOLOG-F9-*` continuam intactas na nuvem (rollback não apaga nada) |
| 21 | App → Configurações | Abrir **Importar orçamentos locais** | candidato `HOMOLOG-F9-import` aparece como **Novo** | — |
| 22 | App → Configurações | Selecionar o candidato → **Importar selecionados** | toast de sucesso | ✅ início do **caso 7 (import continua funcionando)** |
| 23 | SQL Editor | Rodar prova 11.4 **(7)** | — | 1 linha nova em `quotes`, `source_local_id` preenchido (guarde o valor), `company`/`notes` batendo com o seed JS — prova que a RPC estendida (item 1) persiste os 6 campos Q8 de verdade |
| 24 | App → Configurações | Reabrir **Importar orçamentos locais** | candidato aparece como **Já Importada** | — |
| 25 | App → Configurações | Marcar de novo (se permitir) e **Importar selecionados** | toast — nenhuma duplicata | ✅ **caso 7, idempotência** |
| 26 | SQL Editor | Rodar prova 11.4 **(7b)** | — | `count = 1` pro `source_local_id` guardado no passo 23 (nunca 2) |
| 27 | SQL Editor + Console | Rodar a **limpeza §11.5** (nuvem + local) — só depois de todas as provas confirmadas | — | contagens finais batem com o baseline do passo 1; caso 8 (limpeza) fechado |

### 11.4 Provas SQL por caso

```sql
-- (4) tradução + agrupamento — confirma que o BANCO guarda os vocabulários originais intactos
-- (a tradução é só client-side, no mapper) — a UI que unifica na leitura.
select title, status, archived from public.quotes
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and title in ('HOMOLOG-F9-pt', 'HOMOLOG-F9-en');
-- esperado: 2 linhas, status = 'aprovado' e 'approved' respectivamente (nunca convertidos no banco)
```

```sql
-- (5) escrita bloqueada — nenhuma das 3 sintéticas mudou depois das tentativas dos passos 12-16.
select title, status, archived, total from public.quotes
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and title like 'HOMOLOG-F9-%'
order by title;
-- esperado: 3 linhas (pt/en/unknown), valores idênticos ao seed do §11.2.1 — nenhuma quarta linha
-- (prova que "Novo orçamento" do passo 12 não criou nada)
```

```sql
-- (6) rollback — nuvem intacta depois de voltar o seletor pra Local.
select count(*) as sobrando from public.quotes
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and title like 'HOMOLOG-F9-%' and title <> 'HOMOLOG-F9-import';
-- esperado: 3 (as 3 sintéticas da nuvem, rollback não apaga nada)
```

```sql
-- (7) import continua funcionando — a linha nova carrega os 6 campos Q8 do seed local.
select id, title, source_local_id, company, notes, client_whatsapp, payment_condition, delivery_deadline, validity_days
from public.quotes
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and title = 'HOMOLOG-F9-import';
-- esperado: 1 linha, source_local_id preenchido, company = 'HOMOLOG-F9 Empresa Import',
-- notes = 'Semente Fatia 9 — prova de import + propagação dos 6 campos Q8' — GUARDE source_local_id
```

```sql
-- (7b) idempotência do reimport (troque <SOURCE_LOCAL_ID> pelo valor guardado na prova (7))
select count(*) as total from public.quotes
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and source_local_id = '<SOURCE_LOCAL_ID>';
-- esperado: count = 1 (nunca 2)
```

### 11.5 Limpeza (só depois de TODAS as provas confirmadas)

```sql
-- Ordem por FK: quote_items antes de quotes.
delete from public.quote_items
where quote_id in (
  select id from public.quotes
  where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and title like 'HOMOLOG-F9-%'
);

delete from public.quotes
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and title like 'HOMOLOG-F9-%';

select count(*) as restantes from public.quotes
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and title like 'HOMOLOG-F9-%';
-- esperado: 0

select count(*) as quotes_final from public.quotes
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and deleted_at is null;
-- esperado: bate com quotes_baseline do passo 1
```

```js
// Limpeza do quote local sintético — remove só o HOMOLOG-F9-import, preserva o resto.
const quotes = JSON.parse(localStorage["orbyt.quotes.v1"] || "[]");
localStorage.setItem("orbyt.quotes.v1", JSON.stringify(quotes.filter((q) => q.id !== "homolog-f9-import-quote-1")));
console.log("✅ Limpeza F9 (local) feita — sobrando:", JSON.parse(localStorage["orbyt.quotes.v1"]).length);
```

Restaurar o seletor `kora.quotes.dataSource.v1` ao valor anotado no passo 2 (normalmente: remover
de novo, já que o esperado era ausente) + **F5** final.

**Critério de aceite: 8/8 casos verdes** (1 baseline, 2 seed, 3 modo local intacto, 4
flip+tradução+agrupamento+itens+Q8+3º caso, 5 escrita bloqueada em todas as ações tentadas, 6
rollback, 7 import continua funcionando + idempotente, 8 limpeza). Sem caso de escrita
bem-sucedida — é o recorte desta fatia (§7, leitura + fundação).

---

**PARADO aqui.** Runbook da Fase D pronto para execução — 8 casos, seed sintético, provas SQL e
limpeza, tudo em blocos prontos para colar. **NADA EXECUTA sem o "vai" literal do revisor** — a
execução é do operador, com revisão passo a passo.
