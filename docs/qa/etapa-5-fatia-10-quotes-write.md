# Etapa 5 · Fatia 10 — Fase A: levantamento do cutover de escrita de `quotes`

> **Escopo desta rodada: SOMENTE LEITURA.** Nenhum código alterado, nenhuma migration escrita.
> Continuação direta da Fatia 9 (fundação + cutover de leitura), que deixou o domínio pronto pra
> este passo: seletor `kora.quotes.dataSource.v1`, tradução Q9 bidirecional, 6 campos Q8, e um
> achado (Q10 — atomicidade de `CreateCrmSupabaseQuoteDialog.tsx`) explicitamente roteado pra cá.

Referências: [`etapa-5-fatia-9-quotes-cutover.md`](etapa-5-fatia-9-quotes-cutover.md) (fundação de
leitura — seletor, mapper, migrations Q8) · [`etapa-5-fatia-3-quotes.md`](etapa-5-fatia-3-quotes.md)
(Q10 catalogado originalmente, §14) · [`etapa-5-fatia-6-finance.md`](etapa-5-fatia-6-finance.md) /
[`etapa-5-fatia-7-projects.md`](etapa-5-fatia-7-projects.md) (as duas famílias quote→recebível /
quote→projeto, decisão F5-b) · [`etapa-5-fatia-8-crm-cutover.md`](etapa-5-fatia-8-crm-cutover.md)
(molde do cutover de escrita — flag mestre, lição O2/O3/O4) · protocolo:
[`protocolo-homologacao.md`](protocolo-homologacao.md).

---

## 1. Inventário de escrita — todas as ações, local hoje vs. o que falta pro Supabase

Levantado por leitura completa de `src/components/vendas/QuotesSection.tsx` (1240 linhas),
`src/hooks/useQuotes.ts`, `src/repositories/quotesRepository.ts` e `src/hooks/useSupabaseQuotes.ts`.

### 1.1 Ações da tela principal (menu ⋮ por linha + preview)

| Ação | Local hoje (`useQuotes()`) | Repository/RPC Supabase já existe? | Falta pro cutover |
|---|---|---|---|
| Criar orçamento (`NewQuoteWizard` → `handleSave`) | `addQuote(data)` — 1 chamada, client+items+dinheiro juntos | `quotesRepository.createQuote` (insert simples) + `replaceQuoteItems` (2 chamadas) — **não-atômico**; RPC atômica `importQuoteWithItems` existe mas exige `source_local_id` | Decisão de atomicidade (§2) antes de ligar |
| Marcar como enviado | `updateStatus(id, "enviado")` | **Não existe.** `quotesRepository` só tem `approveQuote`/`rejectQuote` (status hardcoded em inglês, sem passar pelo mapper) | Criar método genérico de transição de status (§3) |
| Marcar como aprovado | `updateStatus(id, "aprovado")` | `approveQuote` — já grava `status:"approved"` + `approved_at` | Decidir se substitui por método genérico ou mantém como atalho |
| Marcar como recusado | `updateStatus(id, "recusado")` | `rejectQuote` — já grava `status:"rejected"` + `rejected_at` | Idem acima |
| Arquivar | `updateStatus(id, "arquivado")` | **Não existe método dedicado**, mas `updateQuote`/`archiveQuote` cobrem (`archived: true`) | Precisa decidir se usa `archiveQuote` (boolean puro) ou o método genérico com tradução |
| Restaurar (volta pra rascunho) | `updateStatus(id, "rascunho")` | `archiveQuote(id, false)` desarquiva, mas **não redefine `status`** — local sempre volta literal pra "rascunho" (Fatia 9 §9b confirmou a simetria da regra `archived`, não da transição pós-restore) | Decidir o `status` resultante do restore no lado nuvem (§3) |
| Duplicar | `duplicateQuote(id)` — cria cópia local com novo id, status "rascunho" | **Não existe.** Precisaria: ler a quote+items originais, montar novo payload, chamar create (atômico ou não, mesma decisão do §2) | Método novo no repository |
| Excluir | `deleteQuote(id)` — remoção física (`filter`) | `softDeleteQuote` (`deleted_at`) — **soft-delete**, não remoção física (mesmo padrão já usado no CRM, O2 da Fatia 8) | Tradução de semântica: local "hard remove" → nuvem "soft delete", documentar como decisão deliberada, não gap |
| Gerar conta a receber | Abre `QuoteToReceivableDialog` → `useFinance().addTransaction()` (100% local) | `financeRepository.createReceivableFromQuote` + `findReceivableByQuote` — **já existem, já testados, zero chamador em produção** (ver §4) | Decisão de família (§4) — provavelmente fora de escopo desta fatia |
| Gerar projeto | Abre `QuoteToProjectDialog` → `useProjects().addProject()` + `useTasks().addTask()` (100% local) | `projectsRepository.createProjectFromQuote` + `findProjectByQuote` — mesma situação | Idem — §4 |

### 1.2 Escrita já ligada, fora desta tela (achado importante)

Descoberto ao investigar as 4 flags booleanas pré-existentes em `flags.ts`
(`quotesSupabaseExperimental`, `quotesSupabaseCreateProject`, `quotesSupabaseCreateReceivable`,
`quotesSupabaseApproval`) — nenhuma delas é lida por `QuotesSection.tsx` (o bloqueio de escrita
atual é 100% via `blockWrite()`/`dataSource`, um mecanismo separado da Fatia 9). Elas gateiam DOIS
outros componentes:

- **`SupabaseQuotesViewerCard.tsx`** (card em Configurações, atrás de `quotesSupabaseExperimental`)
  e **`LinkedQuotesSection.tsx`** (dentro do CRM, quotes vinculadas a uma oportunidade) — ambos
  oferecem os mesmos botões Aprovar/Rejeitar/Gerar recebível/Gerar projeto.
- **`quotesSupabaseApproval` é a ÚNICA das 4 flags com escrita real na nuvem hoje**: quando
  ligada, os botões Aprovar/Rejeitar desses dois componentes chamam
  `quotesRepository.approveQuote`/`rejectQuote` de verdade — um `UPDATE` genuíno em
  `public.quotes`, em produção, agora, independente de qualquer coisa desta fatia. As outras 3
  flags gateiam diálogos cuja escrita real é 100% local (ver §4) — código nuvem existe mas
  nenhum caminho o alcança.
- **Risco imediato para o design (não bloqueante, mas deve moldar a decisão do §3):** o botão
  "Aprovar"/"Rejeitar" nesses 2 componentes é renderizado **sem checar a flag** — só o `onClick`
  checa. Ou seja, comportamento visual (botão aparece) já diverge do comportamento real (clique
  bloqueado por toast) dependendo da flag — o MESMO padrão de risco que a lição O2/O3/O4 da Fatia
  8 alertou (ação que parece disponível mas não é). Não é um bug desta fatia (já existe hoje,
  fora do seu escopo de código), mas informa o design: qualquer novo controle de escrita nesta
  fatia deve aplicar a lição corretamente (esconder/desabilitar visualmente, não só bloquear no
  clique) — e vale considerar se essas duas telas devem migrar pro mesmo mecanismo desta fatia
  em vez de manter 2 sistemas de flag paralelos para o mesmo domínio.

### 1.3 Gaps de guarda já existentes na tela principal (achado incidental)

Ao inventariar, achamos 3 pontos SEM `blockWrite()` (irrelevante hoje — nenhuma escrita real
alcança a nuvem de qualquer forma nesta tela — mas relevante pro código que a Fase C desta fatia
vai adicionar/alterar):
- `onGenerated` de `QuoteToReceivableDialog` (`QuotesSection.tsx:573`) — `updateQuote(id, {
  financeEntryId })` sem guarda própria.
- `onGenerated` de `QuoteToProjectDialog` (`:584`) — `updateQuote(id, { projectId, projectTitle
  })` sem guarda própria.
- `handleSave` → `updateLead(...)` (`:217`) — escrita cross-domain (leads/CRM) disparada como
  efeito colateral da criação de quote, protegida só transitivamente pelo guard de `handleSave`
  (mesma função), não por um guard próprio.

---

## 2. Q10 — Atomicidade da criação de quote

**Achado confirmado (não é suposição, é leitura de código):** `CreateCrmSupabaseQuoteDialog.tsx`
(criação nativa de quote a partir do CRM) chama `quotesRepository.createQuote` e depois
`replaceQuoteItems` — **duas chamadas sequenciais, sem transação**. Se a 2ª falhar, um
"rollback" best-effort chama `softDeleteQuote`, mas essa própria chamada de compensação pode
falhar silenciosamente (só loga, não propaga erro) — deixando uma quote sem itens, viva na nuvem.
Confirmado por 2 docs anteriores (`etapa-5-fatia-3-quotes.md` §14, `etapa-5-fatia-9-quotes-cutover.md`
§3.2) que já classificaram isso como **bloqueante para o cutover de escrita — ou seja, para esta
fatia especificamente.**

A RPC atômica `import_quote_with_items` já existe, já tem 20 parâmetros (Q8 incluída), e já é
usada com sucesso pelo import local→nuvem (`useLocalQuotesImport.ts`) — **não roteá-la aqui seria
um retrocesso deliberado, não uma limitação de infraestrutura** (mesma conclusão do doc da Fatia
9). O obstáculo real: a RPC exige `p_source_local_id` não-nulo/não-vazio (é o arbiter do `ON
CONFLICT`) — e uma quote criada nativamente pelo CRM não tem um registro local de origem, logo
não tem um `source_local_id` natural.

**Design recomendado — caminho de escrita único via RPC, com `source_local_id` sintético:**
1. **Um único caminho de escrita para criar quote+items em qualquer lugar da UI** (tela principal
   `NewQuoteWizard` E `CreateCrmSupabaseQuoteDialog`): sempre `importQuoteWithItems`, nunca
   `createQuote`+`replaceQuoteItems` separados.
2. **`source_local_id` sintético pra criação nativa:** gerar um valor não-reaproveitável no
   momento da criação (ex.: `native:${crypto.randomUUID()}`, com um prefixo `native:` que nunca
   colide com o formato real de import `${installId}:${localId}` — o namespace já é
   suficientemente distinto, sem precisar de migration nova). O arbiter `UNIQUE(workspace_id,
   source_local_id)` continua garantindo idempotência (mesmo que aqui a idempotência sirva só
   pra "nunca duas quotes com o mesmo `source_local_id`", não pra dedupe de reimport — papel
   secundário aqui, mas inofensivo).
3. **Não criar uma RPC irmã dedicada** (opção descartada) — duplicaria a lógica de
   upsert+reposição de itens já madura e testada na RPC existente, só pra evitar gerar uma string.
   O custo de manter duas RPCs quase-idênticas supera o benefício de "não ter um
   `source_local_id` decorativo".
4. **Escopo desta fatia:** SIM, corrige `CreateCrmSupabaseQuoteDialog.tsx` — não cataloga pra
   depois. É o próprio achado que rotulou isso como bloqueante especificamente para esta fatia;
   adiar de novo repetiria o padrão "descoberto, não corrigido" que a Fatia 9 já tinha evitado em
   outros pontos (lição O2/O3/O4 aplicada por design, não depois).

---

## 3. Q9 reverso — vocabulário na escrita

A UI opera 100% em português (`QuoteStatus = "rascunho" | "enviado" | "aprovado" | "recusado" |
"vencido" | "arquivado"`). A tradução PT→EN já existe e está testada desde a Fatia 9
(`translateLocalStatusToCloud`, `quoteMapper.ts:75-79`) — resolve `status` + `archived` juntos, a
partir de uma única fonte.

**Achado que precisa de decisão explícita:** os 2 métodos de escrita que JÁ EXISTEM
(`quotesRepository.approveQuote`/`rejectQuote`) **não passam pelo mapper** — gravam os literais
`"approved"`/`"rejected"` hardcoded diretamente. Coincidem hoje com o que `translateLocalStatusToCloud`
produziria para `"aprovado"`/`"recusado"` (mesmo resultado, caminho duplicado), mas:
- Não cobrem NENHUMA das outras transições (enviado, arquivar, restaurar, rascunho) — não existe
  hoje um método de escrita genérico de status.
- Se a tradução mudar no futuro (ex.: um 3º vocabulário), esses 2 métodos ficam desatualizados em
  silêncio, já que não usam a função central.

**Recomendação:** um único método genérico, ex. `quotesRepository.updateStatus(workspaceId,
quoteId, localStatus)`, que internamente chama `translateLocalStatusToCloud` e grava `status` +
`archived` juntos via `updateQuote` — cobre as 6 transições locais com uma função só. Os métodos
`approveQuote`/`rejectQuote` **retiram-se** (não ficam como atalho paralelo) — elimina a
duplicação de vocabulário, e os 2 consumidores existentes (`SupabaseQuotesViewerCard.tsx`,
`LinkedQuotesSection.tsx`) passam a chamar o método genérico com `"aprovado"`/`"recusado"`, sem
mudança de comportamento observável pra eles.

**Passthrough de linhas PT antigas — decisão:** NÃO reescrever ao editar. O achado §8.0 da Fatia
9 já estabeleceu que o mapper reconhece os dois vocabulários na LEITURA (nuvem→local). Na
ESCRITA, qualquer edição subsequente de uma linha legada grava o valor JÁ traduzido (EN) — a
linha "se cura" naturalmente na próxima vez que for tocada, sem precisar de um backfill dedicado
nem de lógica extra. Registrar essa decisão explicitamente (não é uma omissão) evita reabrir a
pergunta numa fatia futura.

---

## 4. As 2 famílias quote→projeto/recebível

**Achado central: já existe uma decisão explícita e recente (F5-b, Fatias 6/7) sobre isso, e ela
NÃO recomenda unificação agora.**

- `QuoteToReceivableDialog.tsx`/`QuoteToProjectDialog.tsx` (tela principal, `QuotesSection.tsx`) —
  100% local (`useFinance`/`useProjects`/`useTasks`), sem nenhum import de Supabase.
- `CreateReceivableDialog.tsx`/`CreateProjectFromQuoteDialog.tsx` (CRM, atrás das flags
  `quotesSupabaseCreateReceivable`/`quotesSupabaseCreateProject`) — **também** escrevem 100%
  local hoje, por decisão deliberada (F5-b): os comentários no próprio código citam
  "DESATIVADO ATÉ O CUTOVER de leitura de finance/projects, não abandonado".
- Os métodos Supabase (`financeRepository.createReceivableFromQuote`/`findReceivableByQuote`,
  `projectsRepository.createProjectFromQuote`/`findProjectByQuote`) **já existem, já são
  testados, e já são usados de verdade** — só não por essas 2 telas: são o contrato reaproveitado
  pelos caminhos gerais de import (`importTransaction`/`importProject`), com o mesmo arbiter
  (`ux_ft_receivable_from_quote`/`ux_projects_from_quote`) garantindo idempotência via
  catch-and-recover de `23505`.

**Recomendação: catalogar, não reconciliar nesta fatia.** A decisão de quando religar
`CreateReceivableDialog.tsx`/`CreateProjectFromQuoteDialog.tsx` ao caminho nuvem pertence às
fatias de cutover de **finance** e **projects** (é lá que a condição "até o cutover de leitura
de X" se resolve), não à de `quotes`. Reabrir essa decisão aqui duplicaria trabalho já feito e
misturaria o escopo de 3 domínios numa fatia só. O que ESTA fatia deve fazer: manter
`QuoteToReceivableDialog.tsx`/`QuoteToProjectDialog.tsx` exatamente como estão (não são cutover
de escrita de quotes — são escrita de finance/projects a partir de uma quote, fora do domínio) —
só a criação/edição/status/duplicar/excluir DA PRÓPRIA quote entram no escopo de escrita desta
fatia (§7).

**Risco de paridade a registrar (não bloqueante, mas real):** `mapSupabaseQuoteToLocalQuote` não
popula `financeEntryId`/`projectId` — esses 2 campos só existem no `Quote` local, nunca vindos da
nuvem. Quando a leitura via nuvem estiver ativa (Fatia 9) e um botão "Gerar" for clicado duas
vezes em sessões diferentes, a UI não vai saber que já foi gerado (mostra sempre "Gerar", nunca
"Ver") — mas o **dado não duplica**, porque o arbiter (`ux_ft_receivable_from_quote`/
`ux_projects_from_quote` + catch de `23505`) already garante isso no nível do banco, IF essas
telas algum dia forem religadas ao caminho nuvem. Registrar como gap de UX conhecido, não de
integridade de dado.

---

## 5. Flag e flip

**Recomendação: nova flag mestre, seguindo o molde já estabelecido pelo CRM
(`useSupabaseCrmWriteFlag.ts`)** — `kora.quotes.supabaseWrite.enabled`, com hook dedicado
(`useSupabaseQuotesWriteFlag.ts`), leitura opt-out (`!== "false"` ⇒ true) OU opt-in
(`=== "true"` ⇒ true) a decidir na Fase B — ver a seguir por quê a escolha aqui é diferente da
do CRM.

**Default proposto: OFF (opt-in), não ON como o CRM ficou depois da Fatia 8.** Motivo: o CRM
flipou o default pra ON *depois* de uma rodada completa de homologação (Fatia 8) que provou
11/11 casos verdes numa escrita já testada estatisticamente contra dado real. `quotes` ainda não
tem NENHUMA homologação de escrita — esta é a primeira rodada. Começar em OFF (mesmo padrão que
o próprio seletor de leitura `kora.quotes.dataSource.v1` já escolheu — default LOCAL, Fatia 9
§8.3) é consistente com "quotes começa do zero, não herda decisão de fatia anterior às cegas".

**As 4 flags granulares existentes — consolidar, não empilhar:**
`quotesSupabaseExperimental`/`CreateProject`/`CreateReceivable`/`Approval` viram redundantes
com a flag mestre nova: 3 delas não gateiam nenhuma escrita real hoje (§1.2), e a 4ª
(`quotesSupabaseApproval`) faz sentido ser absorvida pela flag mestre (aprovar/rejeitar É uma
transição de status como qualquer outra, não precisa de granularidade própria). Proposta pra
Fase B: `SupabaseQuotesViewerCard.tsx`/`LinkedQuotesSection.tsx` passam a checar a flag mestre
nova em vez das 4 antigas — as 4 chaves antigas ficam órfãs no localStorage de quem já as tocou
(mesmo tratamento já dado às flags mortas do CRM, `flags.ts` linha ~49), sem migração de dado
necessária.

**Flip do seletor de LEITURA — SIM, o cutover completo decide os dois juntos.** Ligar escrita
mantendo o default de leitura em LOCAL geraria um estado estranho: o usuário escreveria na nuvem
mas continuaria lendo do array local por padrão, sem ver o que acabou de escrever. Recomendação:
a Fase B desta fatia inclui a decisão formal do flip de leitura (default `local`→`supabase` em
`getQuotesDataSource()`) como parte do MESMO pacote de decisão da flag de escrita — mesmo padrão
da Fatia 8, que flipou os dois (seletor do CRM + flag de escrita) juntos, não em fatias
separadas.

---

## 6. Riscos

- **Consumidores que já leem quotes da nuvem hoje** (`LinkedQuotesSection.tsx`,
  `SupabaseQuotesViewerCard.tsx`) precisam ser migrados pro método genérico de status (§3) e pra
  flag mestre nova (§5) — não é opcional, são os únicos 2 lugares com escrita real já em produção
  neste domínio; ignorá-los deixaria 2 sistemas de flag paralelos e inconsistentes coexistindo.
- **CRM (`CRM.tsx`) via `LinkedQuotesSection`:** já depende de `lead.supabaseId` +
  `isSupabaseMode` — nenhuma mudança de contrato esperada aqui, só troca de qual flag é checada.
- **TOCTOU:** o padrão já usado em `financeRepository`/`projectsRepository` (checar 23505 e
  recuperar via find) é a defesa correta contra corrida em criação — deve ser replicado se algum
  método novo desta fatia fizer create-then-check em vez de check-then-create.
- **Gap de paridade já conhecido, não desta fatia:** `financeEntryId`/`projectId` não vêm da
  nuvem (§4) — não bloqueia, mas gera UX de "Gerar" sempre disponível mesmo quando já existe.
- **Repetição da lição O2/O3/O4 (Fatia 8):** qualquer handler novo desta fatia deve ter o guard
  de escrita ANTES de qualquer `toast.success`/fechamento de diálogo — mesmo padrão já aplicado
  no read-cutover (Fatia 9, item 4), não é uma lição nova, é reafirmar a disciplina.
- **Botões Aprovar/Rejeitar sem checagem de flag na renderização** (§1.2) — achado pré-existente,
  fora do código desta fatia, mas informa que qualquer novo controle de escrita deve esconder ou
  desabilitar visualmente, não só bloquear no clique.

---

## 7. Proposta de recorte

**Recomendação: parcial, delimitado ao ciclo de vida da PRÓPRIA quote.**

**Dentro do escopo desta fatia:**
- Criar via RPC atômica (corrige Q10 — `CreateCrmSupabaseQuoteDialog.tsx` E `NewQuoteWizard`
  passam a usar o mesmo caminho).
- Transições de status (enviado/aprovado/recusado/arquivar/restaurar) via método genérico
  traduzido (§3), substituindo `approveQuote`/`rejectQuote`.
- Duplicar (novo método no repository).
- Excluir (soft-delete via `softDeleteQuote`, já existe).
- Flag mestre nova + decisão de flip do seletor de leitura, como um pacote só (§5).
- Migração de `SupabaseQuotesViewerCard.tsx`/`LinkedQuotesSection.tsx` pro método/flag novos.

**Fora do escopo, catalogado:**
- As 2 famílias quote→projeto/quote→recebível (§4) — pertence às fatias de cutover de
  finance/projects.
- Qualquer edição de campos (cliente/itens/dinheiro) de uma quote já existente — não existe hoje
  nem no caminho local (não há tela de "editar orçamento", só criar/duplicar/mudar status), logo
  não é uma regressão desta fatia deixar de fora; fica catalogado como possível fatia futura se
  o produto decidir que "editar" precisa existir.

Este recorte é menor que "escrita completa de quotes" mas maior que o recorte parcial da Fatia 9
(que foi só leitura) — é o equivalente, pra `quotes`, do que a Fatia 8 fez pra `opportunities`,
mas explicitamente sem arrastar junto as 2 famílias de geração cruzada (que já têm dono e decisão
própria noutras fatias).

---

Levantamento entregue (§1-§7). Nenhum código alterado, nenhuma migration escrita.

---

## 8. Fase B — Design (autorizada pelo "vai" do revisor)

> **Escopo desta rodada: DESIGN.** Nenhum código de implementação. Migrations, se necessárias,
> escritas mas **não aplicadas**. As 4 exigências abaixo vieram explicitamente do revisor, além
> do recorte já recomendado em §7.

### 8.1 Janela de regressão do `Approval` — coexistência temporária

**Situação:** `quotesSupabaseApproval` já faz escrita real em produção hoje (§1.2) — se o design
desta fatia simplesmente substituir o mecanismo de escrita sem prever transição, quem já tem essa
flag ligada perde a capacidade de aprovar/rejeitar até migrar pro novo master flag. Inaceitável.

**Decisão do revisor, formalizada aqui:** os 2 consumidores passam a checar
`masterFlagEnabled || legacyApprovalEnabled` — nenhuma flag some sozinha, as duas saem juntas
só no pacote do flip (mesmo padrão da Fatia 8, que aposentou as 6 flags mortas do CRM de uma vez,
não uma a uma). Isso só se aplica a **`quotesSupabaseApproval`** — as outras 3 flags
(`quotesSupabaseExperimental`/`CreateProject`/`CreateReceivable`) nunca alcançaram escrita real
na nuvem (§1.2 da Fase A), então não têm janela de regressão a proteger: migram direto pro
master flag novo, sem fallback OR.

**Mecanismo concreto:** uma função auxiliar exportada por `useSupabaseQuotesWriteFlag.ts` (novo
hook, molde de `useSupabaseCrmWriteFlag.ts`):
```ts
export function isQuotesApprovalReachable(): boolean {
  return isSupabaseQuotesWriteEnabled() || getBooleanFlag("quotesSupabaseApproval");
}
```
usada SÓ no ponto de decisão de aprovar/rejeitar dos 2 componentes legados — o resto da escrita
(criar, status enviado/arquivar/restaurar, duplicar, excluir) não existe hoje nesses 2
componentes, então não precisa de fallback nenhum: só o master flag novo já é suficiente ali.

**Consumidores nomeados, com o item de Fase C que migra cada um** (ver §8.5 pro plano completo
de itens):
| Componente | Uso hoje de `quotesSupabaseApproval` | Item de Fase C que migra |
|---|---|---|
| `src/components/settings/SupabaseQuotesViewerCard.tsx` | `handleActionClick`/`handleConfirmAction` (linhas citadas na Fase A, §1.2) chamam `useSupabaseQuotes().approveQuote/rejectQuote` | **Item 6** |
| `src/components/crm/LinkedQuotesSection.tsx` | `handleConfirmAction` chama `quotesRepository.approveQuote/rejectQuote` direto | **Item 7** |

**Critério de retirada das 2 flags (registrado, não executado nesta fatia):** quando o flip de
leitura+escrita for decidido (default ON), ambas as chaves (`kora.quotes.supabaseWrite.enabled`
passa a ON por padrão, `kora.quotes.supabaseApproval.enabled` fica órfã) saem do código nessa
mesma rodada de flip — nunca antes, nunca uma sem a outra.

### 8.2 Semântica de exclusão — soft delete, decisão formal

**Decisão: soft delete**, reaproveitando o mecanismo já existente
(`quotesRepository.softDeleteQuote`, coluna `deleted_at`/`deleted_reason` já no schema desde
2026-05-31). Justificativa: (a) mesmo padrão já usado no CRM (O2, Fatia 8) — nunca perder o
registro de negócio de verdade por uma ação de UI; (b) preserva a possibilidade de auditoria/
recuperação futura; (c) zero migration nova necessária, o campo já existe e já tem um método de
repository testado.

**Campo:** `deleted_at timestamptz` (+ `deleted_reason text`, opcional, já aceito pelo método).

**Comportamento no seletor de leitura — achado que exige um ajuste de código (não migration) em
Fase C:** `quotesRepository.listQuotes` (usado tanto por `useSupabaseQuotes` quanto por
`useLocalQuotesImport`'s analisador de duplicatas) **não filtra `deleted_at`** hoje — só
`listQuotesByOpportunity` já filtra (`.is("deleted_at", null)`, linha confirmada na Fase A). Sem
esse ajuste, uma quote excluída continuaria aparecendo na tela principal em modo nuvem. **Decisão:
`listQuotes` ganha o mesmo filtro `.is("deleted_at", null)`, uniformizando com
`listQuotesByOpportunity`** — vira item de Fase C (item 3, §8.5), não uma migration.

**Impacto na idempotência do import:** analisado e considerado **não-bloqueante, sem mudança
necessária**. A cláusula `ON CONFLICT (workspace_id, source_local_id) DO UPDATE SET` da RPC
`import_quote_with_items` não toca `deleted_at`/`deleted_reason`/`deleted_by` — em tese, se uma
quote fosse soft-deleted e depois reimportada com o MESMO `source_local_id`, o `UPDATE` atualizaria
os demais campos mas deixaria `deleted_at` intacto (quote "ressuscitada" ficaria invisível mesmo
com dado fresco). Na prática isso não pode acontecer no recorte desta fatia: quotes criadas
nativamente ou duplicadas usam `source_local_id` sintético (`native:${uuid}`, §8.3) — nunca gerado
de novo pro mesmo registro, então nunca colidem consigo mesmas via `ON CONFLICT`. Só reimports
reais (via `useLocalQuotesImport`, `source_local_id` determinístico `installId:localId`) passam
pelo `DO UPDATE` — e nada nesta fatia permite excluir (soft-delete) uma quote que se origina de
import sem que o usuário también possa reimportá-la propositalmente esperando uma "ressurreição".
Registrado como risco teórico residual, não como bloqueante — se algum dia um caso real de reimport
pós-delete aparecer, a correção é acrescentar `deleted_at = NULL, deleted_reason = NULL` ao `DO
UPDATE SET`, mas escrever essa mudança agora seria especular sobre um cenário que o recorte atual
não produz.

### 8.3 Duplicar via RPC compartilhada — confirmado

Duplicar **não ganha um método de repository novo** — reaproveita exatamente
`quotesRepository.importQuoteWithItems`, a mesma RPC usada por criação nativa (§2 da Fase A) e por
import real. Mecânica: ler a quote+itens de origem (já em memória via `useSupabaseQuotes`, sem
round-trip extra), montar um payload com `title` sufixado ("cópia"), `status` resetado pro
equivalente de "rascunho" (`translateLocalStatusToCloud("rascunho")` → `{status:"draft",
archived:false}`), e chamar a RPC com um **novo** `source_local_id` sintético `native:${uuid}`
(nunca o mesmo da origem — duplicar cria uma linha nova, não atualiza a original). Herda de graça:
atomicidade pai+filhos (mesma transação da RPC) e proteção contra duplo-clique (retry com o mesmo
`source_local_id` sintético cairia no `ON CONFLICT` e faria upsert idempotente em vez de criar
duas cópias).

### 8.4 G11 — assinatura da RPC: nenhuma mudança necessária

Avaliado explicitamente se a RPC precisa de um parâmetro novo pra distinguir "criação nativa/
duplicação" de "import real" (ex.: pra evitar um efeito colateral só-de-import, como um
hipotético `imported_at`). **Conclusão: não precisa, e por isso nenhuma migration nova é
escrita nesta Fase B.** Dois motivos:
1. **A RPC já é agnóstica de origem** — leitura completa do corpo de
   `import_quote_with_items` (migration `20260723000300_etapa5_fatia9_import_quote_with_items_add_q8_params.sql`)
   confirma que não existe hoje nenhum efeito colateral condicionado a "isso veio de um import"
   (não há coluna `imported_at`, não há branch de lógica por origem) — não há nada de
   import-específico que uma chamada nativa/duplicada precisasse evitar.
2. **O prefixo do `source_local_id` já carrega a distinção**, sem precisar de coluna ou parâmetro
   novo: `installId:localId` (formato real de import, determinístico) vs. `native:${uuid}`
   (criação nativa/duplicação, aleatório) são namespaces distintos por construção — suficiente
   pra qualquer análise futura (ex.: `WHERE source_local_id LIKE 'native:%'`) sem custo de schema.

**Regra permanente registrada de qualquer forma (satisfaz a exigência do revisor pro caso de uma
fatia futura precisar):** se algum dia a RPC precisar mesmo de um parâmetro novo pra distinguir
origem (ou qualquer outro motivo), a migration correspondente **DEVE** incluir `DROP FUNCTION
IF EXISTS` da assinatura antiga antes do `CREATE OR REPLACE FUNCTION` com a assinatura nova —
lição G11 (catálogo mestre, `docs/architecture/kora-hub-auditoria-e-plano.md`), motivada por um
bug real desta mesma cadeia de fatias. Não se aplica agora porque não há mudança de assinatura
nesta fatia, mas fica escrita aqui pra nunca precisar redescobrir.

**Consequência prática: esta Fase B não produz nenhuma migration SQL.** Todos os 4 pontos do
pedido do revisor (§8.1-§8.4) resolvem-se com métodos/hooks já existentes (`softDeleteQuote`,
`importQuoteWithItems`, o padrão de `useSupabaseCrmWriteFlag`) ou com ajustes de TypeScript
(filtro em `listQuotes`, novo hook de flag, novo método genérico de status) — nenhum requer DDL.

### 8.5 Plano de itens da Fase C (nomeado, pra rastrear qual commit resolve o quê)

| Item | O quê | Arquivo(s) principais |
|---|---|---|
| 1 | Criação atômica via RPC — `NewQuoteWizard`/`handleSave` e `CreateCrmSupabaseQuoteDialog.tsx` passam a usar `importQuoteWithItems` com `source_local_id` sintético (`native:${uuid}`) | `QuotesSection.tsx`, `CreateCrmSupabaseQuoteDialog.tsx`, `useSupabaseQuotes.ts` |
| 2 | Método genérico de transição de status (`quotesRepository.updateStatus` via `translateLocalStatusToCloud`); aposenta `approveQuote`/`rejectQuote` como métodos separados | `quotesRepository.ts`, `quoteMapper.ts` (reuso, sem mudança) |
| 3 | Soft-delete: correção do filtro em `listQuotes` (`.is("deleted_at", null)`) + wiring da ação "Excluir" | `quotesRepository.ts` |
| 4 | Duplicar via RPC compartilhada (§8.3) | `useSupabaseQuotes.ts`, `QuotesSection.tsx` |
| 5 | Flag mestre `kora.quotes.supabaseWrite.enabled` (novo hook) + decisão de flip do default de leitura, como um pacote só (§5 da Fase A) | novo `useSupabaseQuotesWriteFlag.ts`, `flags.ts` |
| 6 | Migra `SupabaseQuotesViewerCard.tsx` pro método novo + `isQuotesApprovalReachable()` (§8.1) | `SupabaseQuotesViewerCard.tsx` |
| 7 | Migra `LinkedQuotesSection.tsx` — mesmo tratamento | `LinkedQuotesSection.tsx` |
| 8 | `QuotesSection.tsx`: liga os handlers de escrita aos métodos novos (itens 1-4), sob o master flag (item 5), com a disciplina de guarda-antes-do-toast (lição O2/O3/O4, já aplicada no read-cutover) | `QuotesSection.tsx` |

Retirada das 4 flags granulares antigas (§5 da Fase A) fica para o pacote do flip (fora desta
lista — é pós-homologação, não item de Fase C).

---

## 9. Item 9 — semântica de re-import pós-soft-delete (decisão formal)

**Cenário:** import de uma quote local → soft delete no cloud (item 3, ação "Excluir" com o
master flag ligado) → re-import da MESMA quote local (mesmo `source_local_id` real,
`installId:localId`).

**Decisão: "atualiza oculta, nunca ressuscita automaticamente".** O reimport atualiza os campos
da linha (o `ON CONFLICT (workspace_id, source_local_id) DO UPDATE SET` da RPC roda
normalmente), mas **`deleted_at`/`deleted_reason`/`deleted_by` continuam intactos** — a cláusula
`SET` da RPC nunca os tocou, nem antes nem depois desta fatia (confirmado por leitura direta da
migration `20260723000300_etapa5_fatia9_import_quote_with_items_add_q8_params.sql`, sem
`DEALLOC`/mudança de assinatura — consistente com a conclusão do §8.4, zero DDL nesta fatia). A
quote **continua invisível** na tela principal (filtro `deleted_at IS NULL` do item 3).

**Justificativa — por que não "ressuscitar" automaticamente:** exclusão é uma ação **explícita**
do usuário na nuvem (item 3). Um reimport disparado por um evento totalmente não relacionado
(reabrir o assistente de import, rodando sobre o array LOCAL que nunca soube da exclusão) não
deveria desfazer silenciosamente essa decisão do usuário — seria uma "ressurreição" surpresa,
sem o usuário ter pedido. Não é uma limitação técnica forçada pelo "zero DDL" — é a semântica
correta mesmo que a RPC pudesse ser mudada livremente.

**Risco fechado (lição O2/O3/O4 aplicada a este caso específico):** sem tratamento, o import
reportaria "Orçamento importado" (sucesso pleno) mesmo a quote continuando invisível — uma ação
que parece ter dado certo por completo quando não deu. Corrigido em
`useLocalQuotesImport.ts`'s `importSelected`: quando a resposta da RPC vem com `deleted_at`
preenchido, a notificação muda para **"Orçamento reimportado, mas continua excluído"** (tipo
`warning`, não `success`) — a metadata de import (`importedMap`) ainda é gravada normalmente (o
RPC de fato rodou e devolveu um id; "avisar" não é o mesmo que "tratar como se tivesse
falhado").

**Coberto por teste:** `useLocalQuotesImport.test.ts` — mock da RPC devolvendo `deleted_at`
preenchido, confirma a notificação de aviso (não a de sucesso) e que `importedMap` é gravado de
qualquer forma.

**Registrado para a Fase D:** este caso (seed → soft-delete → reimport → confirmar o aviso, não
o toast de sucesso pleno) **entra no runbook de homologação** como um caso próprio, a ser
desenhado quando a Fase D for autorizada — não escrito agora (fora do escopo desta Fase C).

---

**PARADO aqui.** Fase C implementada — itens 1-9 completos, código + testes. Gates finais e
sincronização com `main` ficam para o fechamento desta rodada. **NADA EXECUTA sem o "vai"
literal do revisor** — Fase D (runbook + homologação) só começa com "vai" próprio.
