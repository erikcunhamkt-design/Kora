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

**PARADO aqui.** Levantamento de Fase A entregue — nenhum código alterado, nenhuma migration
escrita, nenhum dado acessado. Proposta de recorte: **Fatia 9 = fundação + cutover de leitura**
(migration Q8, decisão Q9, seletor de dataSource só-leitura); escrita fica para uma Fatia 10
futura. **NADA EXECUTA sem o "vai" literal do revisor, colado neste chat pelo operador** —
inclusive a própria Fase B (design) desta fatia.
