# Etapa 5 · Homologação leve — Vendas/Quotes, CRM/Oportunidades, Clientes (V2)

> **Escopo desta rodada: doc-only, zero código, nada executado.** Runbook de
> homologação **leve** pros 3 domínios que operam 100% na nuvem por padrão e
> nunca tiveram uma rodada formal de homologação "N/N casos verdes" própria —
> Vendas/Quotes e CRM/Oportunidades (opt-out desde a Fase C dos respectivos
> pacotes do flip) e Clientes (dívida assumida em
> [`protocolo-homologacao.md` §10](protocolo-homologacao.md#10-emenda-2026-07-20--regularização-de-p5-para-clients-dívida-assumida-sem-homologação-retroativa)
> — cutover de 2026-06-15, `7ab2367`, sem Fase C/D).
>
> **Refresh V2 (este documento).** O V1 (hash `5b56ea2`, 17 casos) é anterior a:
> cutover de quotes, cutover dos 2 dialogs "Gerar projeto" (`5be5c3d` Vendas,
> `805977c` CRM), G79 (cliente real nos forms de Tarefas/Projetos), G85, G86
> (deep link `?client=`), G87 (**não mergeado**, ver §6) e da varredura de copy
> G29 (`c505dcb`, 43 correções). Cada caso foi **revisado contra o código de
> `0554210`**: caminho real do gatilho (nome real de aba/botão/card — lição da
> homologação de Tarefas), `SELECT` de prova **depois** da ação, resultado
> esperado no vocabulário real do banco, prefixo `HOMOLOG-V2-` e limpeza final
> com `count = 0`. O §1-bis lista o que ficou obsoleto, o que foi reescrito e o
> que entrou de novo.
>
> **Como os fatos foram levantados:** leitura de código em `0554210` (UI strings,
> mappers, repositórios, migrations). **Nenhum caso foi executado ao vivo** —
> toda linha marcada "(inferido do código)" é previsão, não observação.

## Abertura (§16/§17)

- Worktree: `orbit-designer-hub-qualidade-lint`.
- Branch deste refresh: `etapa-5-g29-remove-crmviewer-e-runbook-v2`, a partir de `origin/main` = **`0554210`** (`docs(catalogo): G88 - licao de processo ...`).
- Hash do V1 (superado): `5b56ea2`.

## Referências

- [`etapa-5-flip-financeiro-runbook.md`](etapa-5-flip-financeiro-runbook.md) — molde de estrutura/formato de caso/critério de vermelho.
- [`etapa-5-flip-tarefas-homologacao-fase-d.md`](etapa-5-flip-tarefas-homologacao-fase-d.md) — precedente da lição "nome real do gatilho + SELECT depois da ação".
- [`varredura-g29-copy-falsa-pos-flips.md`](varredura-g29-copy-falsa-pos-flips.md) — origem dos rótulos novos ("Supabase (nuvem)" etc.).
- [`docs/architecture/kora-hub-auditoria-e-plano.md`](../architecture/kora-hub-auditoria-e-plano.md) — G44, G56, G58, G64, G67, G68, G69, G70, G75, G79, G85, G86; fonte de cada caso "prova de lição".
- [`etapa-5-flip-clientes-pacote.md`](etapa-5-flip-clientes-pacote.md) §Abertura — dívida §10.
- [`protocolo-homologacao.md`](protocolo-homologacao.md) §10, §16/§17, §18.

---

## 0. Convenções desta rodada

- **Prefixo de entidade sintética: `HOMOLOG-V2-`** (não reutilizar `HOMOLOG-FIN-%`/`HOMOLOG-F10-%`/`HOMOLOG-CRM-%`).
  **Atenção — projeto, recebível e tarefas derivados NÃO começam com o prefixo.** O título default do projeto é `Projeto — HOMOLOG-V2-...` (Vendas) / `Projeto - HOMOLOG-V2-...` (CRM) e o do recebível é `Orçamento aprovado — HOMOLOG-V2-...` / `Recebível - HOMOLOG-V2-...`: os `SELECT` de limpeza usam **`LIKE '%HOMOLOG-V2-%'`** (com `%` na frente), senão a contagem dá 0 falso. As tarefas iniciais (`Revisar escopo aprovado` etc.) não têm prefixo nenhum — achar por `project_id`.
- **Workspace de teste**: `2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9`.
- **Code não roda SQL contra produção nem acessa `localStorage` do operador** (protocolo §0/§6) — todo `SELECT`/`UPDATE` abaixo é pro operador rodar; Code só prepara e interpreta o resultado reportado. **EXPORT MANUAL antes de qualquer escrita** nova em dado de produção real.
- **Defaults hoje (`flags.ts`):** fonte de Quotes, CRM, Projetos, Financeiro e Tarefas = `"supabase"` (só o literal `"local"` no `localStorage` seleciona local); flags mestras de escrita (`kora.{crm,quotes,projects,finance}.supabaseWrite.enabled`, `kora.tasks.supabaseWrite.v1`) = ligadas (opt-out: só o literal `"false"` desliga). **As 3 flags opt-in** usadas pelos casos de CRM (`getBooleanFlag`, `=== "true"`, default **desligado**) estão em §0.1.
- **Clientes não tem seletor de fonte**: é nuvem sempre que há workspace (`useClientsDataSource`).
- **Vocabulário real do banco** (os `SELECT` abaixo esperam estes valores; o V1 esperava `'aprovado'` e estava errado):

| Tabela.coluna | Valores |
|---|---|
| `quotes.status` | `draft`, `sent`, `approved`, `rejected`; arquivar = `draft` + `archived = true` (sem CHECK no banco) |
| `crm_opportunities.status` | `open`, `won`, `lost` (CHECK `crm_opportunities_status_known_chk`); `stage` = texto livre: `lead`/`contato`/`proposta`/`negociacao`/`fechado`/`perdido` no funil padrão, `s_<7 chars>` em estágio customizado |
| `clients.status` | `Ativo`, `Em negociação`, `Potencial`, `Inativo`, `Arquivado` (CHECK `clients_status_known_chk`); arquivar muda **`archived`**, não `status` |
| `projects.status` | `planning`, `in_progress`, `paused`, … (cloud); `projects.source` = `quote` quando há `quote_id` uuid |
| `tasks` (iniciais de Vendas) | `status = 'a_fazer'`, `priority = 'média'`, `source = 'projeto'` |
| `financial_transactions` (recebível) | `type = 'receivable'`, `status = 'pending'`, `source = 'quote'` |

### 0.1 Flags opt-in necessárias (só CRM, casos 2.6 e 2.7)

Caminho real: **Configurações → aba "Dados" → sub-seção "Sincronização Cloud & CRM (Supabase)"**; cada card tem "Status: Ativo/Inativo" e botão **"Ativar"/"Desativar"**. Anotar o estado inicial de cada um e **restaurar no final** (é `localStorage` do navegador do operador — sem prova em SQL):

| Card (título real) | Libera |
|---|---|
| "CRM Supabase - Criar Orçamento Experimental" | botão "Criar orçamento" no drawer da oportunidade (cloud) |
| "Orçamentos Supabase - Gerar Recebível Experimental" | botão "Gerar recebível" em "Orçamentos vinculados" |
| "Orçamentos Supabase - Gerar Projeto Experimental" | botão "Gerar projeto" em "Orçamentos vinculados" |

(Os toasts de "flag desligada" citam esses nomes **sem** " Experimental" e mandam pra "Configurações → Sincronização Cloud" — é cópia divergente conhecida, ver §6, não bloqueia achar o card.)

### 0.2 Pré-voo visual (não conta no placar — observar e anotar divergência)

| # | Onde | Esperado (rótulos reais pós-varredura G29) |
|---|---|---|
| P.1 | `/vendas` → aba "Orçamentos" | linha "Fonte dos orçamentos:" com botões **"Local"** e **"Supabase (nuvem)"** (ativo); badge **"Modo operacional"**; banner "Orçamentos operacionais (Supabase)" |
| P.2 | `/crm` | linha "Fonte do CRM:" com **"Local"** / **"Supabase (nuvem)"**; badge **"Operacional"**; banner "CRM Supabase operacional" |
| P.3 | `/clientes` | botões "Link de cadastro" e **"Novo cliente"** no cabeçalho; sem seletor de fonte |

### 0.3 Ordem de execução recomendada

`3.1` (cliente base) → Quotes `1.2 → 1.8` → CRM `2.1 → 2.9` → Clientes `3.2 → 3.7` → limpezas (`1.8`, `2.9`, limpeza do `3.6`) → **`3.8` por último** (excluir o cliente deixa `client_id = NULL` em quotes/oportunidades/projetos/tarefas por `ON DELETE SET NULL`; limpar essas entidades por título **antes**).

---

## 1. Domínio: Vendas / Quotes

**Estado de flip**: opt-out (`getQuotesDataSource()`, default `"supabase"`), master write flag opt-out. Rota `/vendas`, aba **"Orçamentos"** (a outra é "Catálogo Comercial"). Escrita nativa: `createQuoteWithItems` (RPC `import_quote_with_items`), `updateStatus`, `duplicateQuote`, `softDeleteQuote`.

| Passo | Ação (caminho real) | Esperado | Prova (SELECT depois da ação) |
|---|---|---|---|
| 1.1 | **Setup** (não conta) — fazer o **Caso 3.1** primeiro: precisa existir `HOMOLOG-V2-cliente` na nuvem | Cliente existe com uuid real | `SELECT id FROM public.clients WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND name = 'HOMOLOG-V2-cliente';` → 1 linha (anotar o uuid como `<CLI>`) |
| 1.2 | **Criar — prova de lição G44** (clientes reais no wizard): botão **"Novo orçamento"** → título do wizard "Novo orçamento — Etapa 1 de 4" → Select **"Cliente existente (opcional)"** (placeholder "Selecionar cliente cadastrado...") → escolher `HOMOLOG-V2-cliente` (não digitar) → **"Título do orçamento\*"** = `HOMOLOG-V2-orcamento-1` → "Continuar" → "+ Item manual" (nome `HOMOLOG-V2-item`, valor `100,00`; Etapa 2) → "Continuar" ×2 → **"Salvar orçamento"** | Wizard fecha na hora; toast **"Orçamento salvo"**; linha aparece na lista sem reload. *Variante opcional 1.2b:* repetir digitando em "Cliente\*" um nome que **não** existe → deve gravar `client_id` NULL (G44 só vincula por match) | `SELECT id, title, client_id, status, archived, approved_at, deleted_at FROM public.quotes WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND title = 'HOMOLOG-V2-orcamento-1';` → 1 linha: `client_id = <CLI>` (não `NULL`), **`status = 'draft'`**, `archived = false`, `approved_at IS NULL`, `deleted_at IS NULL`. E `SELECT name, quantity, unit_price FROM public.quote_items WHERE quote_id = '<id acima>';` → 1 linha `HOMOLOG-V2-item` |
| 1.3 | **Prova de lição G67** (deep link `?newQuote=1&clientId=<uuid>` pela fonte bifurcada): em Clientes, abrir o drawer de `HOMOLOG-V2-cliente` → aba **"Comercial"** → seção "Orçamentos" → botão **"Novo orçamento"** (alternativa: colar `/vendas?tab=orcamentos&newQuote=1&clientId=<CLI>`) | Vai pra `/vendas`, wizard abre **já preenchido** (Cliente\*, Empresa, Email, WhatsApp) e mostra o selo **"Origem: cliente"**; a URL perde `newQuote`/`clientId` depois. Fechar com **"Cancelar"** (não salvar). *Carga fria:* repetir com F5 direto na URL do deep link — se abrir **em branco** só na carga fria e preenchido na navegação interna, é achado de corrida de carga (inferido do código), **não** regressão do G67 | Visual (campos do passo 1 populados + selo). Sem SQL (nada é gravado) |
| 1.4 | **Aprovar — prova de lição G68** (`approved_at`): na linha de `HOMOLOG-V2-orcamento-1`, botão **⋯ ("Mais ações")** → **"Marcar como aprovado"** (usar o ⋯, **não** o botão "Aprovar" do preview — esse abre outro dialog em 250 ms, cobre o 1.5) | Toast **"Orçamento aprovado"**; badge vira "Aprovado" sem reload | `SELECT status, archived, approved_at, rejected_at FROM public.quotes WHERE title = 'HOMOLOG-V2-orcamento-1';` → **`status = 'approved'`** (o V1 esperava `'aprovado'` — errado), `approved_at` **preenchido**, `rejected_at IS NULL`, `archived = false` |
| 1.5 | **Recebível — prova de lição G69** (detecção derivada da nuvem): card "Aprovados" do topo antes: **"1 sem recebível · R$ … pendente"**. Clicar na linha (abre "Preview do orçamento") → card **"Financeiro"** ("Sem conta a receber ainda") → **"Gerar conta a receber"** (ou ⋯ → mesmo item) → dialog "Gerar conta a receber" (título default `Orçamento aprovado — HOMOLOG-V2-orcamento-1`, manter) → botão **"Gerar conta a receber"** | Toast **"Conta a receber gerada"** (descrição `<título> · R$ …`). Em até ~30 s (cache de 30 s da fonte financeira; ou ao voltar o foco da aba): o ⋯ da linha passa a mostrar **"Ver recebível"** (some "Gerar conta a receber"), preview mostra "Conta a receber gerada" + botão "Ver recebível", e o card "Aprovados" vira **"Todos lançados no financeiro"**. "Ver recebível" navega a `/financeiro?tab=receivables&entryId=<id>` | `SELECT id, type, status, source, quote_id, title, amount, due_date FROM public.financial_transactions WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND quote_id = '<id da quote>' AND deleted_at IS NULL;` → **1 linha**: `type = 'receivable'`, `status = 'pending'`, `source = 'quote'`, `amount = 100`. Se o menu **nunca** mudar mesmo após reload → vermelho (G69). Atraso < ~30 s → ressalva, não vermelho (inferido do código, `staleTime` 30 s, sem invalidação) |
| 1.6 | **NOVO — Gerar projeto de orçamento (cutover `5be5c3d`)**: ⋯ da linha → **"Gerar projeto"** (aparece porque está aprovado e sem projeto) → dialog **"Gerar projeto"** → conferir faixa "Vinculado ao orçamento HOMOLOG-V2-orcamento-1 · cliente HOMOLOG-V2-cliente"; "Nome do projeto" default `Projeto — HOMOLOG-V2-orcamento-1`; "Status inicial" = "Planejado"; toggles **"Criar marcos a partir dos itens"** e **"Criar tarefas iniciais"** ambos ligados → botão **"Gerar projeto"** | Toast **"Projeto criado"** (descrição "… — vinculado ao orçamento"), dialog fecha. Tela **Portfólio → aba Projetos** mostra o projeto (visual). Em modo nuvem o ⋯ **continua** mostrando "Gerar projeto" (não vira "Ver projeto") — comportamento conhecido, ver §6 | (a) `SELECT id, title, status, source, quote_id, client_id, opportunity_id, budget, archived, deleted_at, deliverables FROM public.projects WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND quote_id = '<id da quote>';` → **1 linha**: `status = 'planning'`, **`source = 'quote'`**, `client_id = <CLI>`, `budget = 100`, `archived = false`, `deliverables` com 1 item `{"title":"HOMOLOG-V2-item","status":"pendente",…}`. (b) `SELECT title, status, priority, source, project_id, quote_id FROM public.tasks WHERE project_id = '<id do projeto>' AND deleted_at IS NULL ORDER BY created_at;` → **5 linhas** (quote com 1 item): `Revisar escopo aprovado`, `Organizar materiais do cliente`, `Criar cronograma de entrega`, `Iniciar entrega: HOMOLOG-V2-item`, `Enviar primeira atualização ao cliente`; todas `status = 'a_fazer'`, `priority = 'média'`, `source = 'projeto'`, `quote_id` preenchido. Se aparecer toast **"Projeto criado, mas N de 5 tarefas iniciais falharam…"** → vermelho. Se as tarefas não estiverem na nuvem mas aparecerem em Tarefas (locais), conferir se a flag de escrita de Tarefas está desligada (`kora.tasks.supabaseWrite.v1 = "false"`): nesse caso é config do operador, não bug |
| 1.7 | **NOVO — Repetir "Gerar projeto" para o mesmo orçamento (idempotência, `ux_projects_from_quote`)**: ⋯ → "Gerar projeto" de novo → "Gerar projeto" | Toast **"Projeto criado"** de novo (**sem** aviso de duplicidade — não existe), nenhuma linha duplicada de projeto | `SELECT count(*) FROM public.projects WHERE quote_id = '<id da quote>' AND deleted_at IS NULL;` → **1** (se 2 → **vermelho**). `SELECT count(*) FROM public.tasks WHERE project_id = '<id do projeto>' AND deleted_at IS NULL;` → **registrar o número**: pelo código o dialog não deduplica as tarefas iniciais, previsão **10** (inferido do código) — 10 é **achado** (candidato a G novo), 5 é o ideal; nenhum dos dois é vermelho |
| 1.8 | **Limpeza** | (a) Quote: ⋯ → **"Excluir"** → dialog "Excluir orçamento?" → confirmar (na nuvem é soft delete, apesar do texto "permanentemente"). (b) Recebível: **Financeiro → aba Receber** → linha → ⋯ → **"Excluir"**. (c) Tarefas iniciais: **Tarefas** → "Excluir" (dialog "Excluir tarefa?") em cada uma — ou, mais curto, o operador roda o `UPDATE` de soft delete abaixo. (d) Projeto: a UI **não tem exclusão** (o ⋯ do drawer só tem "Arquivar"/"Cancelar") — arquivar **não zera** o `count` (`deleted_at` continua `NULL`); o operador roda o `UPDATE` rascunhado abaixo | `SELECT count(*) FROM public.quotes WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND title LIKE '%HOMOLOG-V2-%' AND deleted_at IS NULL;` → **0**; idem `financial_transactions` (coluna `title`, `LIKE '%HOMOLOG-V2-%'`, `deleted_at IS NULL`) → **0**; `projects` (`title LIKE '%HOMOLOG-V2-%'`, `deleted_at IS NULL`) → **0**; `tasks` (`project_id IN (SELECT id FROM public.projects WHERE title LIKE '%HOMOLOG-V2-%')`, `deleted_at IS NULL`) → **0** |

**Rascunho de limpeza (operador roda, depois de EXPORT; Code não executa; só afeta `HOMOLOG-V2`):**

```sql
-- tarefas iniciais primeiro (o subselect ainda enxerga os projetos), depois projetos
UPDATE public.tasks SET deleted_at = now()
 WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND deleted_at IS NULL
   AND project_id IN (SELECT id FROM public.projects
                       WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9'
                         AND title LIKE '%HOMOLOG-V2-%');
UPDATE public.projects SET deleted_at = now()
 WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND deleted_at IS NULL
   AND title LIKE '%HOMOLOG-V2-%';
```

---

## 2. Domínio: CRM / Oportunidades

**Estado de flip**: opt-out (`getCrmDataSource()`, default `"supabase"`), master write flag opt-out. Rota `/crm`. **Os casos 2.6 e 2.7 exigem as 3 flags opt-in do §0.1.** Funis (pipelines) **não existem na nuvem**: ficam só em `localStorage` (chaves `kora.crm.pipelines.v1` e `kora.crm.activePipeline.v1`); a prova SQL só alcança `crm_opportunities`.

| Passo | Ação (caminho real) | Esperado | Prova (SELECT depois da ação) |
|---|---|---|---|
| 2.1 | **Criar**: botão **"Nova oportunidade"** → dialog "Nova oportunidade" → **"Nome / contato\*"** = `HOMOLOG-V2-lead` e **"Email"** = `homolog-v2@example.invalid` (precisa de nome **e** de email ou telefone, senão toast "Informe email ou WhatsApp/telefone") → **"Criar oportunidade"** | Toast **"Oportunidade criada com sucesso no Supabase!"**; card aparece na 1ª coluna ("Novo Lead") sem reload | `SELECT id, title, contact_name, stage, status, won_at, archived, client_id, deleted_at FROM public.crm_opportunities WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND title = 'HOMOLOG-V2-lead';` → 1 linha: **`stage = 'lead'`**, **`status = 'open'`**, `won_at IS NULL`, `archived = false`, `deleted_at IS NULL` (o campo "Nome" vira `title` **e** `contact_name`) |
| 2.2 | **REESCRITO — Prova de lição G64 item 1 (estágio customizado)**: botão **"Gerenciar funis"** (abre "Editar pipeline" do funil **ativo** = "Pipeline Principal") → **"Adicionar etapa"** → nome `HOMOLOG-V2-Ganhamos`, Select de tipo = **"Ganho"** → **"Salvar"**. *(O V1 mandava criar um funil novo e uma oportunidade nele: **inviável em modo nuvem**, ver §1-bis.)* | Toast **"Pipeline atualizado"**; o board ganha a coluna `HOMOLOG-V2-Ganhamos` com o selo **"ganho"** | Sem SQL (funil só no `localStorage`). Operador lê no DevTools → Application → Local Storage → `kora.crm.pipelines.v1`: a etapa nova tem `id` no formato **`s_xxxxxxx`** e `type: "won"`; anotar o id como `<STG>`. *Opcional (visual):* "Novo pipeline" cria funil "pipeline" com 4 etapas — no modo nuvem ele aparece **sem nenhum card** (limitação conhecida, §6), não é falha |
| 2.3 | **REESCRITO — Prova de lição G64 item 1 (mover estágio deriva status pelo `type`)**: no card `HOMOLOG-V2-lead`, menu do card → **"Mover para etapa"** → `HOMOLOG-V2-Ganhamos` (ou arrastar o card). Depois mover de volta para **"Novo Lead"** | Toasts "Sincronizando alteração de estágio no Supabase…" → **"Estágio atualizado com sucesso no Supabase!"** (nunca "Erro ao persistir… Revertendo") | Após o 1º movimento: `SELECT stage, status, won_at, lost_at FROM public.crm_opportunities WHERE title = 'HOMOLOG-V2-lead';` → **`stage = '<STG>'`** (o id `s_…`, não `'fechado'`), **`status = 'won'`**, `won_at` **preenchido**, `lost_at IS NULL`. Após voltar: `stage = 'lead'`, **`status = 'open'`**, `won_at IS NULL` (reset). Qualquer coisa diferente de `won` no 1º SELECT reproduz o bug do G64 → **vermelho**. (Obs.: no modo nuvem o drawer **não** mostra os atalhos "Avançar/Ganho/Perdido" — o banner G62 manda arrastar/usar o menu do card; não é falha) |
| 2.4 | **Prova de lição G64 itens 2/3 (deep link `?newOpportunity=1&clientId=<uuid>`)**: em Clientes, drawer de `HOMOLOG-V2-cliente` → aba **"Comercial"** → botão **"Nova oportunidade"** (alternativa: colar `/crm?newOpportunity=1&clientId=<CLI>`) | Vai a `/crm`; dialog "Nova oportunidade" abre **pré-preenchido** (nome/email/telefone do cliente), com a descrição **"…Vinculada a um cliente existente."** e a faixa **"Cliente vinculado: HOMOLOG-V2-cliente"**; a URL perde os 2 parâmetros. Salvar com **"Criar oportunidade"** (título gerado = nome do cliente; **trocar o nome** para `HOMOLOG-V2-lead-link` antes de salvar, pra não colidir) | Visual (prefill + faixa). Depois de salvar: `SELECT title, client_id FROM public.crm_opportunities WHERE title = 'HOMOLOG-V2-lead-link';` → pelo desenho `client_id = <CLI>`; **pelo código atual, para um cliente nativo da nuvem (nunca importado) o `client_id` grava `NULL`** (a resolução só consulta o mapa `kora.clients.supabaseImport.v1`; inferido do código, `CRM.tsx:1190-1203`). `NULL` aqui = **achado** (o G64 cobre o *preenchimento*, não a persistência do FK; registrar candidato a G novo, **não** vermelho do G64). Prefill ausente = **vermelho** |
| 2.5 | **Prova de lição G58 (converter lead grava na nuvem)**: card `HOMOLOG-V2-lead` → menu do card → **"Converter em cliente"** | Toast **"Cliente criado a partir do lead"**. Se aparecer **"Lead marcado como convertido"** → é o `catch` de erro disfarçado de sucesso → **vermelho**. Cliente aparece na tela **Clientes** sem reload | `SELECT id, name, status, archived FROM public.clients WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND name = 'HOMOLOG-V2-lead';` → **1 linha**, `status = 'Ativo'`. **Não** clicar 2× (em modo nuvem o lead não é marcado como convertido — `converted_client_id` não é gravado — e duplica o cliente; achado conhecido, §6) |
| 2.6 | **REESCRITO — Prova de lição G70 (colisão de recebível no CRM)**. Pré: flags "Criar Orçamento" + "Gerar Recebível" ligadas (§0.1). (i) Drawer da oportunidade `HOMOLOG-V2-lead` → botão **"Criar orçamento"** → dialog "Criar orçamento a partir da oportunidade": "Título do orçamento\*" = `HOMOLOG-V2-orcamento-crm`, "Nome do Cliente\*" = `HOMOLOG-V2-cliente`, "E-mail\*", 1 item → **"Criar Orçamento"**. (ii) Seção **"Orçamentos vinculados"** → **"Aprovar"** → dialog "Aprovar orçamento?" → **"Aprovar orçamento"**. (iii) **"Gerar recebível"** → dialog **"Gerar recebível?"** (título default `Recebível - HOMOLOG-V2-orcamento-crm`) → **"Confirmar e Gerar"**. (iv) Reabrir **"Gerar recebível"** do mesmo orçamento, **mudar o Título** para `Recebível - HOMOLOG-V2-segunda` → **"Confirmar e Gerar"** | (i) toasts "Orçamento criado com sucesso no Supabase!" + "Orçamento <id> associado à oportunidade!"; (ii) "Orçamento aprovado com sucesso!"; (iii) toast **"Recebível financeiro gerado. Veja em Financeiro."**; (iv) **`toast.warning` "Este orçamento já tem uma conta a receber na nuvem — categoria e forma de pagamento escolhidas aqui ficaram só no local."** (descrição "Veja/edite o recebível existente na tela Financeiro."). **Obsoleto no V1:** "clicar 2× seguidas" não existe (o dialog fecha). **Limitação conhecida:** se o 2º clique mantiver o **título default**, o título devolvido coincide e **não há aviso** (a detecção compara títulos) — registrar, não é vermelho | `SELECT count(*) FROM public.financial_transactions WHERE quote_id = (SELECT id FROM public.quotes WHERE title = 'HOMOLOG-V2-orcamento-crm') AND source = 'quote' AND type = 'receivable' AND deleted_at IS NULL;` → **1** (2 → vermelho). `SELECT title, status FROM public.financial_transactions WHERE quote_id = (…mesmo subselect…);` → título **`Recebível - HOMOLOG-V2-orcamento-crm`** (o da 1ª geração), `status = 'pending'`. `SELECT opportunity_id FROM public.quotes WHERE title = 'HOMOLOG-V2-orcamento-crm';` → uuid de `HOMOLOG-V2-lead` |
| 2.7 | **NOVO — Gerar projeto no CRM (cutover `805977c`)**. Pré: flag "Gerar Projeto" ligada. Na seção "Orçamentos vinculados" do orçamento do 2.6 → **"Gerar projeto"** → dialog **"Gerar projeto?"** (descrição deve dizer "…projeto **na nuvem (Supabase)**…" e "Tarefas, cronogramas e automações não serão criados nesta etapa") → "Título do Projeto" default `Projeto - HOMOLOG-V2-orcamento-crm` → **"Confirmar e Gerar"**. Depois repetir uma 2ª vez | Toast **"Projeto criado. Veja em Projetos."** (nas 2 vezes, **sem** aviso na 2ª) | `SELECT id, title, status, source, quote_id, client_id, opportunity_id, budget, deliverables, archived FROM public.projects WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND quote_id = (SELECT id FROM public.quotes WHERE title = 'HOMOLOG-V2-orcamento-crm') AND deleted_at IS NULL;` → **exatamente 1 linha** (2 → vermelho): **`status = 'planning'`**, **`source = 'quote'`**, `budget` = total do orçamento, `deliverables = []`. `client_id` pode vir `NULL` (o orçamento criado no CRM resolve o cliente pelo mesmo mapa de import; inferido do código — achado, não vermelho). **Sem tarefas:** `SELECT count(*) FROM public.tasks WHERE project_id = '<id>';` → **0** (diferente do 1.6). *G85 só vale em modo "Local" (espelho) — fora do caminho padrão; opcional trocar o seletor para "Local" e repetir, esperando `status = 'planning'` na nuvem se a flag de escrita de projetos estiver ligada* |
| 2.8 | **NOVO — Deep link de oportunidade `?lead=` (estado real, G87 não mergeado)**. No modo nuvem o id do card **não é o uuid**: é um número derivado (primeiros 12 hex do uuid, em decimal). Operador calcula: `SELECT concat('x', substr(replace(id::text,'-',''),1,12))::bit(48)::bigint AS lead_id FROM public.crm_opportunities WHERE title = 'HOMOLOG-V2-lead';` → abrir `/crm?lead=<lead_id>`. Depois abrir `/crm?lead=<uuid completo>` | Com `lead_id` numérico: drawer da oportunidade abre e o card fica destacado ~4 s; fechar o drawer limpa o parâmetro. Com o **uuid**: **nada acontece** (`Number(uuid)` = `NaN`) — **estado conhecido até o G87 mergear**, não vermelho (registrar). Os links do tipo `/crm?lead=<id>` gerados pela Central do Dia/Histórico usam leads **locais** e só abrem algo no seletor "Local" (§6) | Visual (drawer abre/destaque). A conta do `lead_id` é o único SQL |
| 2.9 | **Limpeza** | (a) Cada oportunidade (`HOMOLOG-V2-lead`, `HOMOLOG-V2-lead-link`): menu do card → **"Excluir lead"** → dialog "Excluir oportunidade?" → marcar **"Entendo que esta oportunidade será removida do funil ativo"** → **"Excluir oportunidade"** → toast "Oportunidade excluída (soft delete) com sucesso!". (b) Funil: **"Gerenciar funis"** → remover a etapa `HOMOLOG-V2-Ganhamos` (ícone de lixeira) → "Salvar" (só `localStorage`). (c) Quote/recebível/projeto de 2.6/2.7: limpar como no **1.8** (`LIKE '%HOMOLOG-V2-%'`). (d) O cliente `HOMOLOG-V2-lead` criado no 2.5 sai no **3.8**. (e) **Restaurar o estado inicial das 3 flags** do §0.1 | `SELECT count(*) FROM public.crm_opportunities WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND title LIKE 'HOMOLOG-V2-%' AND deleted_at IS NULL;` → **0**. Prova visual da etapa removida no board |

---

## 3. Domínio: Clientes (dívida §10)

**Estado de flip**: **não é um flip governado** — nuvem sempre que há workspace (`useClientsDataSource`), desde 2026-06-15 (`7ab2367`), sem flags `dataSource`/`supabaseWrite`. Dívida do protocolo §10; esta é a primeira rodada formal. Tabela `clients` (arquivar = `archived`; **sem** `deleted_at`: excluir é **hard delete**).

| Passo | Ação (caminho real) | Esperado | Prova (SELECT depois da ação) |
|---|---|---|---|
| 3.1 | **Criar**: botão **"Novo cliente"** → dialog "Novo cliente" → **"Nome\*"** = `HOMOLOG-V2-cliente`, **"Email"** = `homolog-v2@example.invalid`, **"Telefone"** = `11999990000` (precisa de pelo menos um contato, senão toast "Informe pelo menos um contato (email, telefone ou WhatsApp)") → **"Salvar cliente"** | Toast **"Cliente adicionado."**; aparece na tabela sem reload | `SELECT id, name, status, type, archived FROM public.clients WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND name = 'HOMOLOG-V2-cliente';` → 1 linha, uuid real (anotar `<CLI>`), **`status = 'Potencial'`** (default do formulário), `archived = false`. Observação: `type` grava a string `'—'` quando "Tipo / segmento" fica vazio (achado leve, §6) |
| 3.2 | **Editar**: linha → **⋯ → "Editar"** (ou drawer → botão "Editar") → dialog "Editar cliente": "Empresa" = `HOMOLOG-V2-empresa`, "Telefone" = `11888880000` → **"Salvar alterações"** | Toast **"Cliente atualizado no Supabase."**; lista reflete sem reload | `SELECT company, phone FROM public.clients WHERE name = 'HOMOLOG-V2-cliente';` → `HOMOLOG-V2-empresa`, `11888880000` |
| 3.3 | **Arquivar/restaurar**: linha → **⋯ → "Arquivar"**. Depois clicar o botão de filtro (hoje rotulado **"Ativos"**; tooltip "Mostrar arquivados"; ao alternar passa a mostrar **"Arquivados"**) → linha aparece lá → **⋯ → "Restaurar"** | Toast **"Cliente arquivado no Supabase."** / **"Cliente restaurado no Supabase."**; some da lista padrão ao arquivar e só aparece no modo "Arquivados"; volta à lista padrão ao restaurar. **Esperar um 2º toast** `HOMOLOG-V2-cliente arquivado`/`restaurado` (incondicional — achado conhecido, §6; **não** é falha) | Depois de arquivar: `SELECT archived, status FROM public.clients WHERE name = 'HOMOLOG-V2-cliente';` → **`archived = true`, `status = 'Potencial'` (inalterado)**. Depois de restaurar: **`archived = false`** |
| 3.4 | **Contatos (reconfirmação leve da C8)**: linha → "Ver detalhes" (abre o drawer) → aba **"Contatos"** → **"Adicionar contato"** (estado vazio) ou "Novo contato" → "Nome \*" = `HOMOLOG-V2-contato`, "Função" = "Decisor" → **"Salvar"** | Toast **"Contato adicionado"**; contato listado em "Contatos adicionais" | `SELECT name, role, client_id FROM public.client_contacts WHERE client_id = '<CLI>';` → 1 linha: `HOMOLOG-V2-contato`, `role = 'Decisor'`. (O evento "Contato adicionado" **não** aparece no Histórico para contatos da nuvem — achado conhecido, §6) |
| 3.5 | **NOVO — Deep link `/clientes?client=<uuid>` (G86, mergeado em `b65edb5`)**: colar `/clientes?client=<CLI>` (uuid do 3.1); depois `/clientes?client=<CLI>&tab=contacts`; depois com um uuid inexistente | O drawer de `HOMOLOG-V2-cliente` abre direto (comparação por string, sem `Number()`); com `&tab=contacts` abre na aba "Contatos"; uuid inexistente: **nada acontece, sem erro**. *Variantes de origem (visual, só se existirem dados):* botão **"Cliente"** na linha e **"Ver cliente"** no preview de um orçamento com `client_id` (a quote do 1.2 serve), "Ver cliente" no drawer de projeto/oportunidade | Visual. Sem SQL. Drawer não abrir com uuid válido → **vermelho** (G86 é "corrigido em código — confirmação ao vivo pendente"; este caso é essa confirmação) |
| 3.6 | **NOVO — Prova de lição G79 (cliente real nos forms) + Histórico**: (i) **Tarefas → "Nova tarefa"**: Tipo = **"Trabalho"** (o campo Cliente só aparece em Trabalho) → Select **"Cliente"** ("Selecionar cliente cadastrado...") = `HOMOLOG-V2-cliente`, título `HOMOLOG-V2-tarefa` → salvar. (ii) **Portfólio → Projetos → "Novo projeto"** → dialog "Novo Projeto": Select **"Cliente existente"** = `HOMOLOG-V2-cliente`, nome `HOMOLOG-V2-projeto` → salvar. (iii) Clientes → drawer → aba **"Histórico de Relacionamento"** → chips "Tarefas" e "Projetos" | (i) toast **"Tarefa criada"**; (ii) toast **"Projeto criado"**; (iii) aparecem os eventos **"Tarefa criada"** e **"Projeto criado"** do cliente | `SELECT title, client_id FROM public.tasks WHERE title = 'HOMOLOG-V2-tarefa' AND deleted_at IS NULL;` → **`client_id = <CLI>`** (NULL = **vermelho**, é o defeito do G79). `SELECT title, client_id FROM public.projects WHERE title = 'HOMOLOG-V2-projeto' AND deleted_at IS NULL;` → **`client_id = <CLI>`**. Visual: os 2 eventos no Histórico (pode precisar reabrir o drawer). Digitar o nome exato no campo "Nome do cliente" também deve vincular (variante opcional) |
| 3.7 | **NOVO — Biblioteca do cliente (G75, mitigação `271c225`)**: drawer → aba **"Materiais"** → seção "Biblioteca do cliente" → **"Adicionar material"** → "Nome do material\*" = `HOMOLOG-V2-link`, "Tipo\*" qualquer, "Link / URL\*" = `https://example.com` → **"Adicionar"** | Toast **"Material adicionado"** **e** o `toast.warning` **"Material salvo só neste dispositivo — a Biblioteca do cliente ainda não sincroniza com a nuvem."**; após F5 o item **some** (dado só em memória; decisão de produto de persistência pendente) | Visual. Sem SQL (não existe coluna de assets em `clients`) |
| 3.8 | **Limpeza** (por **último**, §0.3) | Primeiro limpar tarefa/projeto do 3.6 (Tarefas → "Excluir" → "Excluir tarefa?"; projeto pelo `UPDATE` do §1.8 — a UI não exclui). Depois, para `HOMOLOG-V2-cliente` **e** para o cliente `HOMOLOG-V2-lead` criado no 2.5: linha → **⋯ → "Excluir"** → dialog "Excluir cliente?" → **"Excluir"**. Toast **"Cliente excluído do Supabase."** (+ um 2º toast `<nome> excluído`, incondicional — conferir pelo SELECT, não pelo toast). O texto do dialog diz "dados locais" mesmo na nuvem (achado conhecido). Hard delete: contatos saem em cascata; quotes/oportunidades/projetos/tarefas ficam com `client_id = NULL` (`ON DELETE SET NULL`) | `SELECT count(*) FROM public.clients WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND name LIKE 'HOMOLOG-V2-%';` → **0**; `SELECT count(*) FROM public.client_contacts WHERE client_id = '<CLI>';` → **0** (cascata) |

---

## 1-bis. Mapa V1 → V2 (o que ficou obsoleto, reescrito ou entrou)

| Caso V1 | Situação no V2 | Motivo |
|---|---|---|
| 1.1 setup | mantido | só ajustado (SELECT do uuid) |
| 1.2 criar | **ajustado** | rótulos reais ("Cliente existente (opcional)"/"Cliente\*"/"Título do orçamento\*"); prova agora cobre `status='draft'`, `archived`, `approved_at`, itens |
| 1.3 deep link G67 | **ajustado** | gatilho real é o botão **"Novo orçamento"** (aba "Comercial" do drawer), **não** "Criar orçamento"; selo "Origem: cliente"; variante de carga fria |
| 1.4 aprovar | **corrigido** | V1 esperava `status = 'aprovado'`; o banco guarda **`'approved'`** (+ `rejected_at`) |
| 1.5 recebível G69 | **ajustado** | gatilhos reais, strings do KPI ("N sem recebível · R$ pendente" / "Todos lançados no financeiro"), atraso de cache 30 s, **SELECT que faltava** em `financial_transactions` (`type='receivable'`) |
| 1.6 limpeza | **renumerado → 1.8** | agora limpa também recebível, projeto e tarefas; `LIKE '%HOMOLOG-V2-%'`; UI não exclui projeto → `UPDATE` rascunhado |
| — | **NOVO 1.6** | Gerar projeto de orçamento → projeto + 5 tarefas iniciais na nuvem (`5be5c3d`) |
| — | **NOVO 1.7** | repetição de "Gerar projeto" (idempotência `ux_projects_from_quote`; tarefas duplicadas) |
| 2.1 criar | **ajustado** | regra "nome + email/telefone"; toast e vocabulário (`lead`/`open`) |
| 2.2 funil customizado | **REESCRITO (V1 obsoleto)** | em modo nuvem cards só existem no funil padrão (`pipelineId` fixo `default`); a prova viável é **adicionar etapa "Ganho" ao "Pipeline Principal"** |
| 2.3 mover estágio | **REESCRITO** | usa a etapa do 2.2; assert do `stage = s_…`, `status='won'`, `won_at`, e reset ao voltar |
| 2.4 deep link G64 | **ajustado** | gatilho real é "Nova oportunidade" na aba "Comercial"; string do selo ("…Vinculada a um cliente existente." + "Cliente vinculado: …"); **novo ponto**: `client_id` pode gravar NULL |
| 2.5 converter G58 | **ajustado** | toast certo vs toast de erro disfarçado; `status='Ativo'`; aviso de duplicata |
| 2.6 colisão G70 | **REESCRITO** | "clicar 2×" era inviável (dialog fecha) e com título default **não avisa**; agora com setup completo (3 flags opt-in, criar orçamento no CRM, aprovar), título trocado na 2ª vez |
| 2.7 limpeza | **renumerado → 2.9** | inclui funil (localStorage), flags, restauração |
| — | **NOVO 2.7** | Gerar projeto no CRM (cutover `805977c`, sem tarefas, idempotente; G85 só em modo Local) |
| — | **NOVO 2.8** | deep link `?lead=` — id numérico vs uuid (G87 não mergeado) |
| 3.1–3.4 | **ajustados** | rótulos reais, `status='Potencial'`, `type='—'`, filtro "Ativos"/"Arquivados" (rótulo = modo atual, não ação), arquivar muda `archived` e **não** `status` (V1 sugeria o contrário) |
| 3.5 limpeza | **renumerado → 3.8** | agora é por último; FK `SET NULL`; cascata de contatos; toasts incondicionais |
| — | **NOVO 3.5** | deep link `/clientes?client=<uuid>` (G86) |
| — | **NOVO 3.6** | G79 — Select de cliente real em Tarefas/Projetos + eventos no Histórico |
| — | **NOVO 3.7** | Biblioteca do cliente — toast de aviso G75 |
| §4 lições indiretas | **mantido, atualizado** | G67-ext/G68 continuam cobertos por 1.2/1.3/1.4/2.4; adicionado G85 (só modo Local) e G56 (coberto pelo recebível do 2.6, mesma classe) |

---

## 4. Lições sem caso próprio — cobertas indiretamente

- **G67-ext / G67-ext-2** (leitura nuvem→local de `client_id`/`opportunity_id` sem `Number()`): provado implicitamente pelo `client_id` uuid do 1.2 e pelo prefill do 2.4 depois de reload. Não repetido isolado.
- **G68 — passthrough de UUID em `resolveQuoteFk`**: 1.2 (`client_id` uuid), 1.6 (`project.client_id`).
- **G68 — `approved_at`/`rejected_at`**: caso dedicado 1.4.
- **G56** (colisão de recebível em Vendas): o dialog de Vendas usa a mesma checagem do G70; só é alcançável quando o recebível já existe na nuvem **e** o cache de "Ver recebível" ainda não atualizou. Exercitado pelo 2.6 (produtor do CRM); não repetido em Vendas.
- **G85** (espelho local de Projetos): **só com a fonte em "Local"** — fora do caminho padrão desta rodada; opcional dentro do 2.7.

---

## 5. Critérios de vermelho vs. ressalva vs. achado

- **Vermelho (para a homologação):** o comportamento **observado ao vivo diverge do desenhado/documentado**. Casos marcados "Prova de lição" que reproduzam o comportamento QUEBRADO que o fix deveria ter fechado (G44, G58, G64, G67, G68, G69, G70, G79, G86) são vermelho automático. Também vermelho: projeto duplicado (2 linhas no 1.7/2.7), recebível duplicado (2 linhas no 2.6), `status` fora do vocabulário da tabela acima, toast de erro de escrita em fluxo que devia funcionar. Aciona o ciclo: diagnóstico → correção → novo commit → **PARADO** → aguardar novo "vai".
- **Ressalva (não bloqueia):** o mecanismo já está provado por teste automatizado citado no catálogo e só a recaptura ao vivo específica não foi refeita; atraso de ≤ ~30 s na detecção de recebível (1.5). Decisão de não reabrir deve ser **registrada explicitamente**.
- **Achado catalogado, não é bug do caminho testado:** tudo da lista do §6 que se confirmar ao vivo, mais qualquer coisa nova. Registra no catálogo mestre; **o próximo ID livre é reservado pelo revisor — não assumir de memória**.
- **Placar de fechamento:** `N/N casos verdes` por domínio — **7 em Quotes (1.2–1.8), 9 em CRM (2.1–2.9), 8 em Clientes (3.1–3.8) = 24**; o 1.1 (setup) e o pré-voo P.1–P.3 não contam. Marcar individualmente **12 casos de "prova de lição"** (1.2, 1.3, 1.4, 1.5, 2.2, 2.3, 2.4, 2.5, 2.6, 3.5, 3.6, 3.7) e **2 de cutover** (1.6, 2.7) como reprodução-do-bug-fechada / cutover, não genéricos.

---

## 6. Comportamentos já inventariados — não reportar como "novos" sem diferença

Levantados por leitura de código em `0554210` (a maioria **não** tem ID de catálogo; IDs são reservados pelo revisor). Se algum se **confirmar** ao vivo, vira achado; se **não** se confirmar, registrar a divergência:

| # | Comportamento | Onde aparece | Observação |
|---|---|---|---|
| A1 | Em modo nuvem, "Gerar projeto" não vira "Ver projeto" no ⋯ da quote (o mapper cloud não povoa `projectId`; `updateQuote` local é no-op) | 1.6 | observado por código |
| A2 | Texto do dialog "Gerar projeto" de Vendas ainda diz "projeto **local**"; "Observações" do dialog não é persistida | 1.6 | copy G29-classe fora da varredura |
| A3 | Repetir "Gerar projeto" cria de novo as 4–5 tarefas iniciais (sem dedupe) | 1.7 | **inferido**, a confirmar |
| A4 | `client_id` grava `NULL` ao criar oportunidade (e orçamento) no CRM para cliente nativo da nuvem (só resolve pelo mapa de import) | 2.4, 2.6, 2.7 | **inferido**, a confirmar |
| A5 | Converter lead em modo nuvem não grava `converted_client_id` e permite converter várias vezes (duplica cliente); `catch` mostra "Lead marcado como convertido" | 2.5 | observado por código |
| A6 | Funis customizados: cards da nuvem só existem no "Pipeline Principal" (funil novo aparece vazio) | 2.2 | observado por código |
| A7 | **G87 não está no `origin/main`** (commit `ca29850` só na branch `etapa-5-fichas-g87-g84-runbook`); `/crm?lead=<uuid>` não abre nada em modo nuvem; Central do Dia/Histórico geram `/crm?lead=<id local>` e `/clientes?client=<id local>` a partir de leads/clientes **locais** | 2.8, 3.5 | mismatch de fonte, sem ID |
| A8 | Arquivar/restaurar/excluir cliente: toast duplicado/incondicional (não aguarda a mutation); dialog de exclusão diz "dados locais"; item de menu "Criar oportunidade" da linha é só um toast "chega em breve no CRM." (o gatilho real é "Nova oportunidade" no drawer) | 3.3, 3.8 | `Clientes.tsx` não foi tocado pela varredura |
| A9 | Evento "Contato adicionado" não aparece no Histórico para contatos da nuvem; contagens de orçamentos do drawer ("Comercial") e "N× em orçamentos" do catálogo leem dados **locais** | 3.4 | |
| A10 | Toasts de flag desligada citam o card sem " Experimental" e mandam pra "Configurações → Sincronização Cloud" (o caminho real é aba "Dados" → "Sincronização Cloud & CRM (Supabase)") | §0.1 | |
| A11 | Command palette "Novo orçamento" → `/vendas?tab=orcamentos&new=quote` (parâmetro nunca lido; só abre a aba); botão "Novo orçamento" do painel de WhatsApp → `/orcamentos/novo` (rota inexistente → NotFound) | — | fora dos casos; só observar |
| A12 | G84 (aberto, latente): `ClientTechnicalSheetDialog` nunca montado | — | fora de escopo |

---

## O que este doc NÃO faz

- **Não executa nenhum caso** — é preparação/roteiro revisado contra o código; os "esperados" marcados "inferido do código" são previsões a confirmar.
- Não propõe flags novas nem Fase C — o `UPDATE` de limpeza do §1.8 é **rascunho** pro operador, não é migration nem DDL (§8-b).
- Não cobre Fichas Técnicas, WhatsApp nem a Central do Dia além do que aparece nos casos de deep link.
- Não reabre decisão de produto já catalogada (G41; persistência da Biblioteca do cliente, G75).
- Não substitui os gates permanentes do protocolo (EXPORT MANUAL antes de escrita em dado de produção real, PRINT PRÉ-CLIQUE, prova de servidor §17).

**PARADO aqui — runbook V2 é preparação, zero caso executado. Execução real (quem roda os 24 casos, contra qual workspace, com qual operador) só com um novo "vai" que autorize especificamente abrir a homologação.**
