# Etapa 5 · Homologação leve — Vendas/Quotes, CRM/Oportunidades, Clientes

> **Escopo desta rodada: doc-only, zero código.** Runbook de homologação **leve**
> pros 3 domínios que já operam 100% na nuvem por padrão mas nunca tiveram uma
> rodada formal de homologação "N/N casos verdes" própria — Vendas/Quotes e
> CRM/Oportunidades (opt-out desde a Fase C dos respectivos pacotes do flip,
> nunca homologados depois de fechar), e Clientes (dívida assumida em
> [`protocolo-homologacao.md` §10](protocolo-homologacao.md#10-emenda-2026-07-20--regularização-de-p5-para-clients-dívida-assumida-sem-homologação-retroativa)
> — cutover de 2026-06-15, `7ab2367`, **antes** da Etapa 5 existir, sem Fase
> C/D nenhuma).
>
> **Por que "leve", não o molde completo de
> [`etapa-5-flip-financeiro-runbook.md`](etapa-5-flip-financeiro-runbook.md):**
> os 3 domínios já flipados não precisam de §1 (PRÉ-FLIP) nem §2 (FASE C) —
> não há nada pra flipar, o default já é nuvem há semanas. Este doc pula
> direto pro equivalente da FASE D: casos de homologação, critério de
> vermelho, placar de fechamento. A diferença central de propósito: em vez
> de provar que um flip recém-feito não regrediu nada, aqui a homologação
> é a **prova viva de que as lições da sessão (G58, G64, G67-G70) seguram
> de pé juntas** — não uma auditoria de código nova (isso já foi feito,
> arquivo a arquivo, em cada entrada do catálogo), mas a confirmação
> ponta-a-ponta, contra dado real de produção, de que o comportamento
> corrigido continua corrigido quando os domínios são operados em conjunto.

## Abertura (§16/§17)

- Worktree: `orbit-designer-hub-qualidade-lint`.
- Branch: `homologacao-leve-vendas-crm-clientes`, criada a partir de `origin/main`.
- Hash confirmado por `git log origin/main -1 --oneline`: **`5b56ea2`**
  (`docs(seguranca): varredura classe G63 no repo inteiro - 3 achados novos`).

## Referências

- [`etapa-5-flip-financeiro-runbook.md`](etapa-5-flip-financeiro-runbook.md) — molde de estrutura, formato de caso, critério de vermelho/ressalva/achado, placar de fechamento — reaproveitado aqui, enxuto (sem §1/§2, ver nota de abertura).
- [`docs/architecture/kora-hub-auditoria-e-plano.md`](../architecture/kora-hub-auditoria-e-plano.md) — G58 (conversão de lead grava só local), G64 (funis customizados, 3 itens), G67 (+ G67-ext, G67-ext-2 — deep link e leitura de FK uuid), G68 (mappers irmãos ficaram pra trás), G69 (detecção de recebível em Quotes), G70 (mesmo gap em CRM), fonte de cada caso "prova de lição" abaixo.
- [`etapa-5-flip-clientes-pacote.md`](etapa-5-flip-clientes-pacote.md) §Abertura — achado original da dívida §10 de Clientes (cutover ungoverned, `7ab2367`).
- [`protocolo-homologacao.md`](protocolo-homologacao.md) §10 (dívida assumida de Clientes), §16/§17 (isolamento de worktree, prova de build), §18 (merge condicionado a "vai"), §14-A (método de fail→fix→pass por patch, usado nos fixes que este runbook homologa — citado por precisão, não reexecutado aqui).

---

## 0. Convenções desta rodada

- **Prefixo de entidade sintética: `HOMOLOG-V2-%`** — não reutilizar `HOMOLOG-FIN-%`/`HOMOLOG-F10-%`/`HOMOLOG-CRM-%` de rodadas anteriores (resíduo de outras homologações, mesmo workspace).
- **Workspace de teste**: `2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9` — mesmo workspace de QA usado em todas as rodadas anteriores (`etapa-5-fatia-10-quotes-write.md`, `etapa-5-flip-financeiro-runbook.md`).
- **Code não roda SQL contra produção nem acessa `localStorage` do operador** (protocolo §0/§6) — todo `SELECT`/`INSERT` abaixo é pro operador rodar; Code só prepara e interpreta o resultado reportado.
- Todos os 3 domínios já são Supabase-first por padrão numa sessão nova — nenhum passo de "trocar seletor pra nuvem" é necessário antes dos casos abaixo (contraste direto com o runbook de Financeiro, que tinha isso no §2).

---

## 1. Domínio: Vendas / Quotes

**Estado de flip**: opt-out (`getQuotesDataSource()`, default `"supabase"`) desde a Fase C do Pacote do Flip de Quotes; master write flag (`useSupabaseQuotesWriteFlag`) também opt-out. Escrita nativa madura (`createQuoteWithItems`, `updateStatus`, `duplicateQuote`, `softDeleteQuote`) — nunca homologada como rodada própria, só exercitada incidentalmente pelas homologações de Financeiro/CRM que citam quotes de passagem.

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 1.1 | Setup — criar `HOMOLOG-V2-cliente` (Clientes, nativo na nuvem, ver Caso 3.1 abaixo — fazer esse caso primeiro se rodar os 3 domínios em sequência) | Cliente existe na nuvem com um uuid real | Visual |
| 1.2 | **CRUD básico — criar**: "Novo orçamento" → preencher cliente **selecionando `HOMOLOG-V2-cliente` no `<Select>` de cliente existente** (G44, não digitar nome livre) → 1 item, "Salvar orçamento" | Orçamento nasce direto na nuvem (`createSupabaseQuoteWithItems`), aparece na lista sem reload | `SELECT id, title, client_id, status FROM public.quotes WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND title = 'HOMOLOG-V2-orcamento-1';` → 1 linha, `client_id` = uuid de `HOMOLOG-V2-cliente` (não `NULL`) |
| 1.3 | **Prova de lição G67** (deep link `?newQuote=1&clientId=X` preenche via fonte bifurcada) — a partir do perfil de `HOMOLOG-V2-cliente` (Clientes), clicar em "Criar orçamento" (ou navegar direto pra `/vendas?newQuote=1&clientId=<uuid-do-cliente>`) | Wizard abre **já preenchido** (nome do cliente, empresa, e-mail) — não em branco. Antes do fix G67, `Number(uuid)` virava `NaN` e o wizard abria cego | Visual — campos do passo 1 do wizard já populados ao abrir |
| 1.4 | **CRUD básico — status**: aprovar `HOMOLOG-V2-orcamento-1` (menu ⋯ → "Marcar como aprovado") | Status muda pra "Aprovado" sem reload; `approved_at` é gravado (prova do fix G68 no mapper de escrita nativa — antes, esse campo nunca era enviado no payload de criação/import, mas a transição de STATUS via `updateStatus` é o caminho testado aqui) | `SELECT status, approved_at FROM public.quotes WHERE title = 'HOMOLOG-V2-orcamento-1';` → `status = 'aprovado'`, `approved_at` **preenchido**, não `NULL` |
| 1.5 | **Prova de lição G69** (detecção de recebível derivada, não campo local morto) — a partir de `HOMOLOG-V2-orcamento-1` aprovado, gerar um recebível (`QuoteToReceivableDialog`, "Gerar conta a receber") | Depois de gerado: reabrir o menu ⋯ do mesmo orçamento — opção muda de "Gerar conta a receber" pra **"Ver recebível"**; card "Aprovados" do topo da tela reflete "Todos lançados no financeiro" (não "N sem recebível") | Visual — texto do menu ⋯ mudou; card "Aprovados" sem pendência |
| 1.6 | **Limpeza** | Soft-delete/arquivar `HOMOLOG-V2-orcamento-1`, remover o recebível gerado no 1.5 | `SELECT count(*) FROM public.quotes WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND title LIKE 'HOMOLOG-V2-%' AND deleted_at IS NULL;` → 0 |

---

## 2. Domínio: CRM / Oportunidades

**Estado de flip**: opt-out (`getCrmDataSource()`) desde a Fase C do Pacote do Flip de CRM; master write flag (`useSupabaseCrmWriteFlag`) também opt-out — todas as ações de escrita liberadas por padrão. Nunca homologado como rodada própria — os achados G58/G64/G70 vieram de auditoria de código/relato de operador, não de uma homologação formal.

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 2.1 | **CRUD básico — criar**: "Nova oportunidade" → preencher `HOMOLOG-V2-lead` (nome/e-mail), pipeline padrão | Oportunidade nasce na nuvem (`createOpportunity`), aparece no board sem reload | `SELECT id, title, stage, status FROM public.crm_opportunities WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND title = 'HOMOLOG-V2-lead';` → 1 linha |
| 2.2 | **Prova de lição G64, item 1 (funil customizado)** — "Gerenciar funis" → criar `HOMOLOG-V2-funil` com 2 estágios customizados (ex.: `"Prospecção"` id livre, tipo `open`; `"Ganhamos"` id livre, tipo `won`) → criar uma 2ª oportunidade `HOMOLOG-V2-lead-funil-b` já nesse funil | `stage` gravado é o id REAL do estágio customizado (não coagido pro vocabulário do pipeline padrão) | `SELECT stage, status FROM public.crm_opportunities WHERE title = 'HOMOLOG-V2-lead-funil-b';` → `stage` = id real do estágio customizado (não `"lead"`/um dos 6 valores fixos) |
| 2.3 | **Prova de lição G64, item 1 (mover estágio deriva status certo)** — mover `HOMOLOG-V2-lead-funil-b` pro estágio `"Ganhamos"` (tipo `won`) do funil customizado | `status` vira `"won"` (derivado do `.type` do estágio, não de comparar string `"fechado"`) — antes do fix, um funil customizado nunca disparava `won`/`lost` por este caminho | `SELECT status, won_at FROM public.crm_opportunities WHERE title = 'HOMOLOG-V2-lead-funil-b';` → `status = 'won'`, `won_at` preenchido |
| 2.4 | **Prova de lição G64, itens 2/3 (deep link CRM preenche via fonte bifurcada)** — a partir do perfil de `HOMOLOG-V2-cliente` (Clientes, Caso 3.1), clicar em "Criar oportunidade" (ou navegar pra `/crm?newOpportunity=1&clientId=<uuid-do-cliente>`) | Form de nova oportunidade abre **já vinculado** ao cliente (mesmo defeito do G67, mesmo fix — `useClientsDataSource()` + comparação por string, sem `Number()`) | Visual — badge "Vinculada a um cliente existente" aparece, nome do cliente preenchido |
| 2.5 | **Prova de lição G58 (conversão de lead grava na nuvem)** — no menu do lead `HOMOLOG-V2-lead`, "Converter em cliente" | Cliente novo aparece na tela principal de **Clientes** (não só localmente) — antes do fix, `handleConvertToClient` gravava só local e o cliente convertido "sumia" da tela Supabase-first | `SELECT id, name FROM public.clients WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND name = 'HOMOLOG-V2-lead';` → 1 linha |
| 2.6 | **Prova de lição G70 (CRM também detecta colisão de recebível)** — a partir de um orçamento vinculado a uma oportunidade do CRM (`LinkedQuotesSection`, "Gerar recebível" via `CreateReceivableDialog`), clicar 2x seguidas pro MESMO orçamento | 1º clique gera o recebível normalmente; **2º clique dispara `toast.warning`** de colisão explícita ("Este orçamento já tem uma conta a receber na nuvem...") — antes do fix, o 2º clique devolvia a linha existente em silêncio, sem aviso (mesma classe do G56, mas o produtor do CRM nunca tinha ganho a mesma proteção) | Visual — toast de aviso aparece no 2º clique + `SELECT count(*) FROM public.financial_transactions WHERE quote_id = (SELECT id FROM quotes WHERE title = '<título do orçamento usado>') AND source = 'quote' AND deleted_at IS NULL;` → **1** (nenhuma linha duplicada) |
| 2.7 | **Limpeza** | Soft-delete `HOMOLOG-V2-lead`/`HOMOLOG-V2-lead-funil-b`, remover `HOMOLOG-V2-funil`, remover o recebível gerado no 2.6 | `SELECT count(*) FROM public.crm_opportunities WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND title LIKE 'HOMOLOG-V2-%' AND deleted_at IS NULL;` → 0 |

---

## 3. Domínio: Clientes (dívida §10)

**Estado de flip**: **não é um flip governado** — Supabase-first incondicional desde 2026-06-15 (`7ab2367`), sem par de flags `dataSource`/`supabaseWrite` (confirmado por grep, zero ocorrência de `kora.clients.*` no padrão dos outros domínios). Esta é a dívida registrada no protocolo §10 — nunca teve Fase D nenhuma, nem "leve" nem completa, até agora.

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 3.1 | **CRUD básico — criar**: "Novo cliente" → preencher `HOMOLOG-V2-cliente` (nome/e-mail/telefone), "Salvar cliente" | Cliente nasce direto na nuvem (`addClient` de `useClientsDataSource()`), aparece na lista sem reload | `SELECT id, name FROM public.clients WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND name = 'HOMOLOG-V2-cliente';` → 1 linha, uuid real |
| 3.2 | **CRUD básico — editar**: mudar telefone/empresa de `HOMOLOG-V2-cliente` | Alteração persiste, reflete na lista sem reload | `SELECT company, phone FROM public.clients WHERE name = 'HOMOLOG-V2-cliente';` → valores novos |
| 3.3 | **CRUD básico — arquivar/restaurar**: arquivar `HOMOLOG-V2-cliente`, depois restaurar | Some da lista padrão ao arquivar, some do filtro "Arquivados" e volta à lista padrão ao restaurar | `SELECT status, archived FROM public.clients WHERE name = 'HOMOLOG-V2-cliente';` → `archived = false` ao final |
| 3.4 | **Contatos (C8, já homologado na Fatia 4 — reconfirmação leve, não 1ª homologação)** — aba "Contatos" do perfil de `HOMOLOG-V2-cliente`, adicionar 1 contato | Contato persiste na nuvem (`useSupabaseClientContacts`) — regressão contra o fix já homologado (`9fe41f5`+`eeff133`), não um caso novo | `SELECT count(*) FROM public.client_contacts WHERE client_id = (SELECT id FROM clients WHERE name = 'HOMOLOG-V2-cliente');` → 1 |
| 3.5 | **Limpeza** | Excluir `HOMOLOG-V2-cliente` (hard delete, mesmo comportamento de `deleteClient` — remove o contato do 3.4 em cascata, confirmar) | `SELECT count(*) FROM public.clients WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND name LIKE 'HOMOLOG-V2-%';` → 0 e `SELECT count(*) FROM public.client_contacts WHERE client_id = '<uuid removido>';` → 0 |

---

## 4. Lições que não têm caso próprio acima — cobertas indiretamente

- **G67-ext / G67-ext-2** (leitura nuvem→local de `client_id`/`opportunity_id` sem `Number()`, em `crmOpportunityMapper`/`quoteMapper`) — provado implicitamente pelos Casos 1.2/1.3 (quote com `client_id` real sobrevivendo ao round-trip) e 2.4 (lead com `client_id` vindo do deep link) — se esses casos passarem com o `client_id` correto aparecendo de volta na UI depois de um reload, os 2 mappers de leitura estão funcionando. Não repetido como caso isolado pra não duplicar prova.
- **G68 — passthrough de UUID em `resolveQuoteFk`/`resolveUuid`** — provado implicitamente sempre que um Caso acima usa uma entidade **nativa da nuvem** (criada direto em modo Supabase, nunca importada) vinculada a outra por FK — é exatamente esse cenário (import-map vazio, uuid já é o destino) que o fix cobre. Casos 1.2, 2.1, 2.5 já exercitam isso.
- **G68 — `approved_at`/`rejected_at`** — caso dedicado, 1.4 acima.

---

## 5. Critérios de vermelho vs. ressalva vs. achado

Mesmo critério operacional do precedente de `projects`/`financeiro` (fixado em texto explícito pra não precisar re-derivar):

- **Vermelho (para a homologação):** o comportamento **observado ao vivo diverge do comportamento desenhado/documentado** — nesta rodada, especificamente, qualquer caso marcado "Prova de lição G-X" que reproduza o comportamento QUEBRADO que o fix deveria ter fechado é vermelho automático, sem exceção (não é uma prova de regressão qualquer, é a prova de que uma lição já catalogada como FECHADA continua fechada). Aciona o ciclo: diagnóstico → correção → novo commit → **PARADO** → aguardar novo "vai".
- **Ressalva (não bloqueia):** o mecanismo já está provado correto por outra via (teste automatizado citado na entrada do catálogo) e só a recaptura ao vivo específica não foi refeita. Decisão de não reabrir deve ser **registrada explicitamente**.
- **Achado catalogado, não é bug:** algo encontrado durante a homologação que não afeta o caminho testado — registra no catálogo mestre, próximo ID livre confirmado no momento da rodada (não assumir de memória).
- **Placar de fechamento:** `N/N casos verdes` por domínio (5 em Quotes, 7 em CRM, 5 em Clientes — 17 no total), com os 7 casos de "Prova de lição" (1.3, 1.5, 2.2, 2.3, 2.4, 2.5, 2.6) marcados individualmente como reprodução-do-bug-fechada, não genéricos.

---

## O que este doc NÃO faz

- Não executa nenhum caso — é preparação/roteiro, mesmo os 3 domínios já estando 100% operacionais na nuvem hoje.
- Não propõe flags novas nem Fase C nenhuma — os 3 domínios já flipados (Quotes/CRM oficialmente, Clientes por dívida assumida) não precisam de um flip formal; a dívida do §10 continua sendo "sem homologação retroativa formal", que é exatamente o que este doc começa a saldar.
- Não cobre Tarefas nem Fichas Técnicas — fora do escopo desta rodada (Tarefas ainda em Fase B, Lane D; Fichas Técnicas tem achado de segurança próprio em rota separada, G63 + varredura).
- Não reabre nenhum achado de decisão de produto já catalogado sem fix (G41, por exemplo) — fora de escopo.
- Não substitui os gates permanentes do protocolo (EXPORT MANUAL antes de qualquer escrita nova em dado de produção real, PRINT PRÉ-CLIQUE, prova de servidor §17).

**PARADO aqui — este runbook é preparação, zero caso executado. Execução real (quem roda os 17 casos, contra qual workspace, com qual operador) só com um novo "vai" que autorize especificamente abrir a homologação.**
