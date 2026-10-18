# Etapa 5 · G94 — Catálogo comercial + Biblioteca de Materiais — Runbook da Fase D (**CT7-prep: executável até onde o código existe**)

> **Status:** os casos do **catálogo que já existe em código (CT1–CT5 + import CT3 + G95 + G98)** estão fechados com os
> **caminhos reais** da tela e são executáveis **depois do pacote §8-b**. O que ainda **não existe** (Checkout na nuvem, robô, flip do default CT7, Biblioteca M1–M4) continua marcado **[pendente — …]** na seção
> "Fora do alcance de hoje". Molde: [`etapa-5-flip-tarefas-runbook.md`](etapa-5-flip-tarefas-runbook.md) /
> [`etapa-5-flip-fichas-runbook.md`](etapa-5-flip-fichas-runbook.md). Os `SELECT` não foram executados por Code (protocolo §0/§6).
>
> **Homologa-se SEM flip:** o default continua LOCAL. Quem testa liga a nuvem **neste navegador** pelos cards de Configurações
> (§ "Estado das flags"). O flip do default é o CT7 (rodada própria, depois desta Fase D).

## O que só pode ser provado DEPOIS do DDL (e o que dá para provar antes)

| Prova | Antes do DDL | Depois do DDL (pacote §8-b) |
|---|---|---|
| Padrão LOCAL sem banner e sem request | ✅ Caso 2 | ✅ Caso 2 |
| "Schema pendente" (card de import + tela de Catálogo + cai no local) | ✅ **só aqui** (Caso 1) — depois do DDL não dá mais para ver | ❌ não aplicável |
| Leitura da nuvem, bloqueio com escrita desligada (G76) | ❌ (cai no schema pendente) | ✅ Casos 3–4 |
| Import assistido, idempotência, descarte contado, FKs/uuid | ❌ | ✅ Caso 5 |
| Escrita nativa (criar/editar/arquivar/duplicar/excluir), G30 | ❌ | ✅ Casos 6–7 |
| CHECK do vocabulário (acento de "único"), UNIQUE do import, RLS | ❌ | ✅ Caso 8 |
| Round-trip por campo (G37), produtos, planos com `refId` uuid | ❌ | ✅ Casos 9–11 |
| Ponte catálogo↔orçamento (`service_id`, "Mais usado", seletor do wizard, toggles G96) | ❌ | ✅ Caso 16 |
| Mensagens de erro REAIS (G95) com a causa | ⚠️ parcial (42P10, só se o índice do §2.3 ainda faltar — Caso 12) | ✅ Caso 12 |
| Honestidade dos textos (limitações na tela) | ✅ | ✅ Caso 13 |
| Rollback nível 1 | ✅ | ✅ Caso 14 |

## Lições incorporadas (não re-derivar)

- **Confirmar o nome na tela antes de cada caso** (Tarefas/Fichas corrigiram o runbook ao executar). Os nomes abaixo foram lidos no código desta rodada.
- **SELECT depois de cada ação que grava**; **print pré-clique** (protocolo §2) em todo passo que grava; **EXPORT MANUAL** antes (protocolo §1).
- **Seeds demo** só existem em fonte local; em fonte nuvem o catálogo de um workspace novo está **vazio** (os seeds nunca vão pra nuvem).
- **Soft delete:** "Excluir" na nuvem grava `deleted_at` — a linha continua existindo; contar sempre com `deleted_at IS NULL` quando o objetivo é "o que o usuário vê".
- Console do navegador: `[Kora] BUILD <hash> (<branch>)` (`src/main.tsx`).

### Nomes reais (lidos no código)
- **Rotas:** `/vendas` (aba **"Catálogo Comercial"**, sub-abas **"Serviços · Produtos · Planos · Checkout"**; aba **"Orçamentos"**) e `/configuracoes` → seção **"Dados"**.
- **Configurações → Dados**, bloco **"Migração de Dados Locais para o Supabase"** → card **"Importar catálogo comercial"** → botão **"Abrir importador"** → diálogo **"Importador assistido do catálogo comercial"**:
  seções **"Etapa 1 · Categorias" → "Etapa 2 · Serviços" → "Etapa 3 · Produtos" → "Etapa 4 · Planos"**; selos **"nova" / "já importada"**; linha de contagem
  **"N nova(s) · M já importada(s) · K selecionada(s)"**; botões **"Selecionar todas as novas" · "Importar selecionados" · "Limpar seleção"**;
  relatório (região "Relatório do último import") com **"N item(ns) com FALHA"** e **"N item(ns) de plano DESCARTADO(S)"**;
  alerta **"Schema pendente (pacote §8-b) — importação desabilitada."** (lista as tabelas ausentes).
  Toasts: **"N item(ns) do catálogo importado(s) com sucesso"**, "… falharam ao importar — nada foi gravado para eles. Primeiro erro (<item>): <causa>", "… de plano foram DESCARTADOS …", "Selecione ao menos um item para importar".
- **Configurações → Dados**, bloco **"Sincronização Cloud & CRM (Supabase)"** → cards **"Catálogo comercial · fonte de dados"** (status **"Fonte: Local"** / **"Fonte: Supabase (nuvem)"**, botão **"Usar Supabase"** / **"Voltar para Local"**) e **"Catálogo comercial · escrita na nuvem"** (status **"Escrita: Inativa"** / **"Escrita: Ativa"**, botão **"Ativar"** / **"Desativar"**).
- **Vendas → Catálogo Comercial** — botões **"Novo serviço"** / **"Criar serviço"** (estado vazio) / **"Categorias"** (modal "Categorias", campo "Nova categoria") / **"Novo produto"** / **"Novo plano"**; modal de serviço com **"Nome\*"**, **"Categoria"**, **"Preço (R$)\*"**, **"Cobrança"**, **"Prazo (dias)"**, **"Tags (separe por vírgula)"**, **"Observações internas"**, toggles **"Disponível em orçamentos"** e **"Mostrar no catálogo público (em breve)"**, botão **"Salvar serviço"**; ícones **Editar · Duplicar · Desativar/Ativar (serviços e produtos) ou Arquivar/Ativar (planos) · Excluir** (produtos não têm Duplicar).
  Validações: **"Informe o nome do serviço"**, **"Informe um preço maior que zero"**, **"Categoria em uso por um serviço"**. Toasts de sucesso: **"Serviço/Produto/Plano criado|atualizado|duplicado|excluído"**, **"Categoria criada"** — **só aparecem se a gravação de fato aconteceu** (G75).
- **Banner de modo** (aparece só com a fonte em Supabase):
  - nuvem: **"Catálogo lido da nuvem (Supabase)"** + "A gravação na nuvem está **DESLIGADA** …" / "… está **LIGADA** …" + (só na aba Checkout) "O Checkout continua local (“Em breve”) e usa o catálogo deste navegador." — as frases antigas sobre "Mais usado" e o seletor do wizard **saíram** com o CT5; no wizard de orçamento a ajuda do select termina com **"Catálogo lido da nuvem (Supabase)."**;
  - **"Schema pendente (pacote §8-b) — exibindo o catálogo local deste navegador."** + tabelas ausentes + botão **"Verificar de novo"**;
  - "Fonte “Supabase” selecionada, mas não há workspace ativo — exibindo o catálogo local deste navegador."
- **Toast de escrita bloqueada:** *"Gravação do catálogo na nuvem está desligada — nada foi salvo. Ative “Catálogo comercial · escrita na nuvem” em Configurações → Dados ou volte a fonte para Local."*
- **Toast de erro de escrita (G95):** *"Erro ao <ação> no catálogo (Supabase): <causa real>"* — ações: criar/editar/excluir **a categoria**, criar/editar/duplicar/**arquivar/ativar**/excluir **o serviço**, criar/editar/excluir **o produto**, criar/editar/duplicar/excluir **o plano**.

## Abertura (preencher na execução)

- Worktree / branch / **hash do build** (`[Kora] BUILD …` no console): ______
- Workspace de QA: `2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9` (reconfirmar)
- Prefixos: **`HOMOLOG-CAT-`** (catálogo) e **`HOMOLOG-MAT-`** (Biblioteca — só quando M2 existir)
- Pacote §8-b: aplicado em ______ (data/hora) por ______; provas §3 do pacote coladas: ______ **[obrigatório antes do Caso 3]**

### Entidades sintéticas

| Entidade | Como criar (modo **Local**, antes do import) | Papel |
|---|---|---|
| `HOMOLOG-CAT-categoria-A` | Vendas → Catálogo Comercial → Serviços → **"Categorias"** | FK de serviço/produto |
| `HOMOLOG-CAT-servico-A` | **"Novo serviço"** — categoria A, cobrança **"único"**, preço 100, prazo 5, tags `a,b`, observação preenchida | Casos 5–11 |
| `HOMOLOG-CAT-servico-B` | idem, cobrança **"mensal"**, sem categoria | vocabulário / sem FK |
| `HOMOLOG-CAT-produto-A` | aba **Produtos** → **"Novo produto"** (tipo "Digital", preço, custo, estoque) | Caso 10 |
| `HOMOLOG-CAT-plano-A` | aba **Planos** → **"Novo plano"** com **serviço-A + produto-A + o serviço DEMO "Identidade Visual"** (este último é o item que o import tem de **descartar**) | Casos 5, 11 |

## Pré-voo (Caso 0) — **hash mínimo e pacote §8-b como pré-condição**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 0.1 | §17 passo 0: worktree + branch + URL do dev server; abrir o console | `[Kora] BUILD <hash> (<branch>)` | Print do console |
| 0.2 | **Hash mínimo:** o build contém o **G95 do catálogo** (esta rodada) **e** o CT4 (`5fdda90`). Operador: `git merge-base --is-ancestor 5fdda90 <hash-do-build> && echo OK` e idem para o hash desta rodada (`f5d0187`) | `OK` nos dois | Saída do comando |
| 0.3 | **Pacote §8-b aplicado** — rodar as provas §3 do [`pacote`](etapa-5-g94-pacote-operador-8b.md) (3.1–3.5). Resumo numa consulta só: ver abaixo | todas as colunas "Esperado" batem | Resultado colado |
| 0.4 | **EXPORT MANUAL** (protocolo §1) de `service_categories`, `services`, `products`, `commercial_plans` (vazias — confirmar), de `clients` (coluna `library_assets`) e de `quote_items` | Arquivos salvos | Nomes dos arquivos |
| 0.5 | Estado das flags no navegador de teste: sessão **limpa**; anotar o que existir de `kora.catalog.dataSource.v1`, `kora.catalog.supabaseWrite.v1`, `kora.catalog.supabaseImport.v1`, `kora.install.id.v1` | Sem `dataSource`/`supabaseWrite` (= local/desligada) | Print do Application → Local Storage |
| 0.6 | Contagens iniciais | 0 / 0 / 0 / 0 | SELECT abaixo |

```sql
-- 0.3 (resumo — a prova completa é a do pacote §3)
SELECT
  (SELECT count(*) FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name IN ('service_categories','services','products','commercial_plans'))          AS tabelas,        -- 4
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename IN ('service_categories','services','products','commercial_plans'))              AS policies,       -- 16
  (SELECT count(*) FROM pg_index i
     WHERE i.indisunique AND i.indisvalid AND i.indpred IS NULL
       AND i.indexrelid::regclass::text IN ('ux_service_categories_source_local','ux_services_source_local',
                                             'ux_products_source_local','ux_commercial_plans_source_local'))                      AS indices_ok,     -- 4
  (SELECT pg_get_constraintdef(oid) LIKE '%único%' FROM pg_constraint WHERE conname = 'services_billing_type_known_chk')           AS check_com_acento; -- true

-- 0.6
SELECT (SELECT count(*) FROM public.service_categories) AS categorias, (SELECT count(*) FROM public.services) AS servicos,
       (SELECT count(*) FROM public.products) AS produtos, (SELECT count(*) FROM public.commercial_plans) AS planos;   -- 0 / 0 / 0 / 0
```

**Parar** se 0.2/0.3 estiver vermelho: sem o pacote aplicado os Casos 3–12 não têm como passar (e o que se veria é o Caso 1).

## Rollback

- **Nível 1** (por navegador; **nada é apagado**, nem no banco nem no `localStorage`): Configurações → Dados → card **"Catálogo comercial · fonte de dados"** → **"Voltar para Local"** e card **"Catálogo comercial · escrita na nuvem"** → **"Desativar"**. Equivalente por console: `localStorage.setItem("kora.catalog.dataSource.v1","local")` + `localStorage.setItem("kora.catalog.supabaseWrite.v1","false")` + F5.
- **Nível 2:** ainda **não existe flip** — o default já é local; não há commit de flip a reverter. Depois do CT7: `git revert <hash-do-flip>` **[completar pós-CT7]**.
- **Nível 3 (DDL, só se necessário):** pacote §7 (tabelas/colunas; destrói o catálogo da nuvem — exportar antes).
- **Critério:** qualquer caso vermelho sem correção rápida, ou perda/duplicação relatada.

---

## Casos — Catálogo (HOMOLOG-CAT-%)

### Caso 1 — **[ANTES do DDL]** Schema pendente (G29) — só executável com as tabelas ainda ausentes

> Se o pacote §8-b **já** foi aplicado, marcar **"não aplicável (DDL já aplicado)"** — este caso não pode mais ser provado depois.

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 1.1 | `SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('service_categories','services','products','commercial_plans');` | `0` | Resultado |
| 1.2 | Configurações → Dados → card **"Catálogo comercial · fonte de dados"** → **"Usar Supabase"** (status **"Fonte: Supabase (nuvem)"**) | Toast "Fonte do catálogo comercial: Supabase (nuvem)." | Print |
| 1.3 | Vendas → **Catálogo Comercial** | Alerta **"Schema pendente (pacote §8-b) — exibindo o catálogo local deste navegador."** listando **as 4 tabelas**; os **seeds demo** (ex.: "Identidade Visual") **continuam visíveis** (não lista vazia); botão **"Verificar de novo"** | Print |
| 1.4 | **"Novo serviço"** → nome `HOMOLOG-CAT-pendente`, preço 10 → **"Salvar serviço"** | Toast **"Serviço criado"** (gravou **no local**, que é o que a tela mostra); **nenhum** request de escrita ao Supabase | Network sem `POST …/services`; `localStorage.orbyt.services.v1` contém o item |
| 1.5 | Configurações → Dados → **"Importar catálogo comercial"** → **"Abrir importador"** | Alerta **"Schema pendente (pacote §8-b) — importação desabilitada."** com as tabelas; **"Selecionar todas as novas"** e **"Importar selecionados"** **desabilitados**; checkboxes desabilitados | Print |
| 1.6 | Limpeza deste caso: excluir `HOMOLOG-CAT-pendente` pela UI; card de fonte → **"Voltar para Local"** | Catálogo local volta ao estado anterior | Visual |

### Caso 2 — Estado padrão LOCAL (sem banner, sem request)

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 2.1 | Sessão limpa (flags de 0.5) → Vendas → **Catálogo Comercial** | **Nenhum banner**; os **seeds demo** aparecem ("Identidade Visual", …); tela idêntica à de antes do CT4 | Print |
| 2.2 | Network (filtro `services`/`products`/`service_categories`/`commercial_plans`) ao abrir as 4 sub-abas | **Zero** request a essas tabelas (hooks de nuvem nem montam com a fonte local) | Print do Network vazio |
| 2.3 | Criar/editar/excluir no modo local (ex.: criar e excluir um serviço temporário) | Funciona como sempre; toasts "Serviço criado"/"Serviço excluído" | Visual |
| 2.4 | — (SELECT) | Nada foi pra nuvem | `SELECT count(*) FROM public.services;` → **0** |

### Caso 3 — Fonte Supabase com escrita **desligada**: leitura + bloqueio honesto (G76)

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 3.1 | Card **"Catálogo comercial · fonte de dados"** → **"Usar Supabase"** (deixar **"Escrita: Inativa"**) → Vendas → Catálogo Comercial | Banner **"Catálogo lido da nuvem (Supabase)"** com **"A gravação na nuvem está DESLIGADA: você só consegue visualizar …"**; lista **vazia** (seeds e catálogo local **não** aparecem) | Print |
| 3.2 | **"Novo serviço"** → `HOMOLOG-CAT-bloqueado`, preço 10 → **"Salvar serviço"** | Toast de aviso **"Gravação do catálogo na nuvem está desligada — nada foi salvo. Ative “Catálogo comercial · escrita na nuvem” …"**; **sem** "Serviço criado"; **modal continua aberto** com o que foi digitado | Print |
| 3.3 | Repetir em **Categorias** (adicionar), **Produtos** ("Novo produto") e **Planos** ("Novo plano") | Mesmo aviso; nada gravado | Print de cada |
| 3.4 | — (SELECT + local) | Nada na nuvem **e** nada no local (não "cai" no `localStorage`) | `SELECT count(*) FROM public.services WHERE name LIKE 'HOMOLOG-CAT-%';` → 0; `localStorage.orbyt.services.v1` **sem** `HOMOLOG-CAT-bloqueado` |

### Caso 4 — Leitura da nuvem com dado já existente (G32/G67)

Pré: **depois** do Caso 5 (há linhas na nuvem). Com fonte Supabase: F5 → as linhas aparecem **com os ids/uuids** (inspecionar o card/edição não mostra id, então a prova é a contagem e o conteúdo); trocar para **"Voltar para Local"** (card) e voltar a **"Usar Supabase"** sem F5 → a lista troca **sem recarregar** (flag reativa). Prova: contagem na tela = `SELECT count(*) FROM public.services WHERE deleted_at IS NULL AND is_demo=false;`.

### Caso 5 — Import assistido local → nuvem (CT3): ordem, demo, idempotência, descarte contado

Pré: entidades sintéticas criadas **em modo Local** (card de fonte em **"Fonte: Local"**); pacote §8-b aplicado; **escrita** pode estar inativa (o import não depende dela — grava direto pelo importador).

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 5.1 | Configurações → Dados → **"Importar catálogo comercial"** → **"Abrir importador"** | 4 seções em ordem **"Etapa 1 · Categorias" … "Etapa 4 · Planos"**; **itens demo NÃO aparecem**; selos **"nova"**; **sem** o alerta de schema pendente | Print |
| 5.2 | Observar o plano-A | Aviso **"1 item(ns) sem tradução (serviço/produto demo ou inexistente) serão DESCARTADOS"** (o item "Identidade Visual") e "depende de N item(ns) ainda não importado(s) — selecione-os junto" | Print |
| 5.3 | Tentar marcar serviço-A **antes** da categoria A | Checkbox **desabilitado**; marcar a categoria habilita; desmarcar a categoria **desmarca** o serviço | Visual |
| 5.4 | **"Selecionar todas as novas"** → **"Importar selecionados"** | Toast **"N item(ns) do catálogo importado(s) com sucesso"** + toast de descarte; região **"Relatório do último import"** com contagens por etapa e **"1 item(ns) de plano DESCARTADO(S)"** listando `HOMOLOG-CAT-plano-A: Identidade Visual`; **sem** "com FALHA" | Print |
| 5.5 | — (SELECT depois) contagens | categoria 1, serviços 2, produto 1, plano 1 (só `HOMOLOG-CAT-%`) | SELECT A |
| 5.6 | — (SELECT depois) `source_local_id` e FK | `source_local_id` no formato `<installId>:<id local>` (o `installId` = `kora.install.id.v1`); `services.category_id` do serviço-A = id da categoria A (**uuid**, não `cat-…`) | SELECT B |
| 5.7 | — (SELECT depois) itens do plano | `items` com **2** itens (serviço-A e produto-A), cada `refId` é **uuid existente**; **nenhum** `svc-…`/`prod-…`; o demo **não** está | SELECT C |
| 5.8 | Reabrir o importador | Tudo **"já importada"**; **"Importar selecionados"** desabilitado; linha "0 nova(s) · 5 já importada(s)" | Print |
| 5.9 | **Mapa perdido:** apagar só `kora.catalog.supabaseImport.v1` do `localStorage` → reabrir o importador → tudo volta **"nova"** → importar de novo | Toast de sucesso; **contagens do SELECT A inalteradas** (o upsert por `source_local_id` reencontra as mesmas linhas); sem duplicata | SELECT A + SELECT D |

```sql
-- SELECT A (5.5 / 5.9)
SELECT 'categorias' AS t, count(*) FROM public.service_categories WHERE name LIKE 'HOMOLOG-CAT-%'
UNION ALL SELECT 'servicos', count(*) FROM public.services WHERE name LIKE 'HOMOLOG-CAT-%'
UNION ALL SELECT 'produtos', count(*) FROM public.products WHERE name LIKE 'HOMOLOG-CAT-%'
UNION ALL SELECT 'planos',   count(*) FROM public.commercial_plans WHERE name LIKE 'HOMOLOG-CAT-%';
-- Esperado: 1 / 2 / 1 / 1

-- SELECT B (5.6)
SELECT s.name, s.billing_type, s.source_local_id, s.category_id, c.name AS categoria, s.is_demo
FROM public.services s LEFT JOIN public.service_categories c ON c.id = s.category_id
WHERE s.name LIKE 'HOMOLOG-CAT-%' ORDER BY s.name;
-- Esperado: servico-A → categoria = HOMOLOG-CAT-categoria-A, billing_type 'único'; servico-B → categoria NULL, 'mensal'; is_demo=false; source_local_id com ':'

-- SELECT C (5.7) — refId de plano NUNCA local
SELECT p.name, jsonb_array_length(p.items) AS n_itens,
       (SELECT count(*) FROM jsonb_array_elements(p.items) it
         WHERE (it ->> 'refId') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') AS refs_nao_uuid,
       (SELECT count(*) FROM jsonb_array_elements(p.items) it
         WHERE NOT EXISTS (SELECT 1 FROM public.services s WHERE s.id::text = it ->> 'refId')
           AND NOT EXISTS (SELECT 1 FROM public.products pr WHERE pr.id::text = it ->> 'refId'))                 AS refs_sem_destino
FROM public.commercial_plans p WHERE p.name = 'HOMOLOG-CAT-plano-A';
-- Esperado: n_itens = 2, refs_nao_uuid = 0, refs_sem_destino = 0

-- SELECT D (5.9) — source_local_id único
SELECT 'services' AS t, source_local_id, count(*) FROM public.services WHERE source_local_id IS NOT NULL GROUP BY 2 HAVING count(*) > 1
UNION ALL SELECT 'products', source_local_id, count(*) FROM public.products WHERE source_local_id IS NOT NULL GROUP BY 2 HAVING count(*) > 1
UNION ALL SELECT 'service_categories', source_local_id, count(*) FROM public.service_categories WHERE source_local_id IS NOT NULL GROUP BY 2 HAVING count(*) > 1
UNION ALL SELECT 'commercial_plans', source_local_id, count(*) FROM public.commercial_plans WHERE source_local_id IS NOT NULL GROUP BY 2 HAVING count(*) > 1;
-- Esperado: 0 linhas
```

### Caso 6 — Escrita **ligada**: criar nativo + G30 (resposta no cache, sem F5)

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 6.1 | Fonte **Supabase**; card **"Catálogo comercial · escrita na nuvem"** → **"Ativar"** (status **"Escrita: Ativa"**) → Vendas → Catálogo Comercial | Banner **"… A gravação na nuvem está LIGADA: as alterações são salvas no Supabase."**; lista com os itens importados (Caso 5) | Print |
| 6.2 | **"Categorias"** → criar `HOMOLOG-CAT-nativa-cat` | Toast **"Categoria criada"**; aparece **sem F5** | SELECT E |
| 6.3 | **"Novo serviço"** → `HOMOLOG-CAT-nativo-A`, categoria `HOMOLOG-CAT-nativa-cat`, **"único"**, preço 100, prazo 5, tags `a,b`, observações, **"Disponível em orçamentos"** ligado → **"Salvar serviço"** | Toast **"Serviço criado"**; modal fecha; card aparece **sem F5** (resposta do INSERT no cache — G30) | Visual |
| 6.4 | — (SELECT depois) | Todos os campos gravados; `category_id` uuid; `is_demo=false`; **`source_local_id` começa com `native:`** | SELECT F |
| 6.5 | F5 | O serviço continua, com categoria e tags | Visual |
| 6.6 | Validações: criar sem nome; com preço 0 | **"Informe o nome do serviço"** / **"Informe um preço maior que zero"**; nada gravado | `count(*)` inalterado |

```sql
-- SELECT E (6.2)
SELECT id, name, deleted_at FROM public.service_categories WHERE name = 'HOMOLOG-CAT-nativa-cat';   -- 1 linha, deleted_at NULL

-- SELECT F (6.4)
SELECT name, price, billing_type, delivery_days, active, tags, available_in_quotes, show_in_public_catalog, notes,
       category_id, is_demo, source_local_id
FROM public.services WHERE name = 'HOMOLOG-CAT-nativo-A';
-- Esperado: price 100.00, 'único', 5, true, {a,b}, true, false, notes preenchido, category_id uuid, false, 'native:…'
```

### Caso 7 — Editar, arquivar, duplicar, excluir (soft delete) e categoria em uso

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 7.1 | Editar o preço do `HOMOLOG-CAT-nativo-A` → 150 | Toast **"Serviço atualizado"**; sem F5 | `SELECT price FROM public.services WHERE name='HOMOLOG-CAT-nativo-A';` → `150.00` |
| 7.2 | **Desativar/Ativar** (ícone de status do card do serviço — é o "arquivar/ativar" do código) | Badge muda; sem toast de sucesso (só efeito) | `SELECT active FROM … ;` → `false` (depois `true`) |
| 7.3 | **Duplicar** | Toast **"Serviço duplicado"**; nome **"… (cópia)"**; **outra linha** | `SELECT name, source_local_id FROM public.services WHERE name LIKE 'HOMOLOG-CAT-nativo-A%';` → 2 linhas, `source_local_id` **distintos**, ambos `native:` |
| 7.4 | **Excluir** a cópia | Toast **"Serviço excluído"**; some da lista | `SELECT deleted_at FROM … WHERE name='HOMOLOG-CAT-nativo-A (cópia)';` → **não nulo** (a linha continua existindo) |
| 7.5 | "Categorias" → remover `HOMOLOG-CAT-nativa-cat` (em uso pelo nativo-A) | Toast **"Categoria em uso por um serviço"**; nada removido | `SELECT deleted_at FROM public.service_categories WHERE name='HOMOLOG-CAT-nativa-cat';` → NULL |

### Caso 8 — Vocabulário, CHECK, UNIQUE e RLS (G40/G49) — operador

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 8.1 | Criar pela UI um serviço **"mensal"** e um **"único"** (`HOMOLOG-CAT-nativo-B/C`) | Gravados com o **literal local acentuado** | `SELECT name, billing_type FROM public.services WHERE name LIKE 'HOMOLOG-CAT-nativo-%';` → `único` / `mensal` (sem tradução, **com acento**) |
| 8.2 | **CHECK obrigatório:** `UPDATE public.services SET billing_type='valor-invalido' WHERE name='HOMOLOG-CAT-nativo-A';` | **FALHA** `23514` em `services_billing_type_known_chk` | Erro capturado |
| 8.3 | `UPDATE public.services SET price=-1 WHERE name='HOMOLOG-CAT-nativo-A';` | falha em `services_price_nonneg_chk` | Erro capturado |
| 8.4 | `UPDATE public.products SET type='x' WHERE name='HOMOLOG-CAT-produto-A';` | falha em `products_type_known_chk` | Erro capturado |
| 8.5 | **UNIQUE do import:** reinserir uma linha com o mesmo `(workspace_id, source_local_id)` de uma existente (operador, em transação com `ROLLBACK`) | falha `23505` (`ux_services_source_local`) | Erro capturado |
| 8.6 | **RLS (membro):** com a sessão de **outro workspace** (ou usuário sem vínculo), `SELECT count(*) FROM public.services WHERE workspace_id='2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9';` | **0** (RLS esconde); INSERT nesse workspace é recusado (`42501`) | Resultado/erro |

### Caso 9 — Round-trip por campo (G37/G83)

Criar **serviço** com **todos** os campos (incl. observações, tags, "Mostrar no catálogo público" ligado, categoria, rótulo legado), **produto** (tipo, status, preço, **custo e estoque**) e **plano** (ciclo, preço, destaque, itens); **F5**; abrir **Editar** de cada: **nada** pode ter sumido (cada campo = o digitado). Prova: SELECT dos campos (serviço: os 12 do SELECT F; produto: `type,status,price,cost,stock,category_id`; plano: `billing_cycle,price,highlight,status,items`) + a tela. Falha em qualquer campo ⇒ vermelho (classe G37/G83).

### Caso 10 — Produtos

Criar `HOMOLOG-CAT-produto-nativo` (tipo **"Digital"**, ativo, preço, custo, estoque); SELECT: `type='digital'`, `status='active'`, `cost`, `stock` gravados; ícone **"Desativar"** → `status='inactive'`; **"Excluir"** (confirmar) → toast **"Produto excluído"** e `deleted_at` não nulo; F5 mantém. (CHECK de `products` já coberto no 8.4.)

### Caso 11 — Planos e referências (R1)

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 11.1 | Com a fonte Supabase e escrita ativa: **"Novo plano"** `HOMOLOG-CAT-plano-nativo`, escolher **serviço-A importado** e **produto-A importado** no seletor | O seletor lista **só** serviços/produtos da nuvem (não os seeds); toast **"Plano criado"** | SELECT C (com o nome do plano novo) → `refs_nao_uuid = 0`, `refs_sem_destino = 0` |
| 11.2 | **Editar** o plano | Os itens aparecem **marcados** (os `refId` resolvem) | Visual |
| 11.3 | **Duplicar** o plano | Toast **"Plano duplicado"**; **"… (cópia)"**; linha **nova** (`source_local_id` distinto, `native:`) com os mesmos itens | `SELECT name, source_local_id, jsonb_array_length(items) FROM public.commercial_plans WHERE name LIKE 'HOMOLOG-CAT-plano-nativo%';` |
| 11.4 | **Arquivar** (ícone "Arquivar") e **Excluir** o plano duplicado | `status='inactive'` / `deleted_at` não nulo | SELECT |
| 11.5 | Excluir (soft) o **serviço referenciado** | A aba Planos **não quebra**; o plano continua listado | Visual |

### Caso 12 — Mensagens de erro REAIS (G95): "Erro ao <ação> no catálogo (Supabase): <causa>"

O que se prova: nenhum erro do catálogo mostra um genérico ("Ocorreu um erro inesperado") — o toast/relatório diz **a ação** e **a causa técnica** (nome da constraint/policy/erro).

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 12.1 | **(só se o §2.3 do pacote ainda não foi aplicado — aplicar §2.1 e testar ANTES do §2.3):** importar o catálogo local (Caso 5) | Relatório com **"N item(ns) com FALHA"** listando **cada item** como **"Categorias · HOMOLOG-CAT-categoria-A: …"** com a causa **"there is no unique or exclusion constraint matching the ON CONFLICT specification"**; toast "… falharam ao importar … Primeiro erro (<item>): …"; **nada gravado**; **0 linhas** no SELECT A. Depois aplicar o §2.3 e repetir o Caso 5 | Print do relatório + SELECT |
| 12.2 | Escrita ligada; criar serviço e **forçar um CHECK** (operador: criar a linha de um serviço **e**, antes de salvar na UI, aplicar `ALTER TABLE public.services ADD CONSTRAINT homolog_tmp_chk CHECK (name <> 'HOMOLOG-CAT-erro') NOT VALID;` — **remover depois** com `DROP CONSTRAINT`) → salvar `HOMOLOG-CAT-erro` | Toast **"Erro ao criar o serviço no catálogo (Supabase): Alguns dados não atendem às regras de validação. (… violates check constraint "homolog_tmp_chk")"**; **sem** "Serviço criado"; modal **aberto** | Print do toast |
| 12.3 | Leitura com erro que **não** é tabela ausente (ex.: sessão sem permissão) | Banner de nuvem mostra **"Não foi possível carregar o catálogo da nuvem: <causa>"**; a tela **não** cai silenciosamente pro local | Print |
| 12.4 | Limpeza: `ALTER TABLE public.services DROP CONSTRAINT IF EXISTS homolog_tmp_chk;` | Constraint removida | `SELECT conname FROM pg_constraint WHERE conname='homolog_tmp_chk';` → 0 linhas |

> 12.2/12.4 mexem no schema de produção por alguns minutos — **opcional**; se o operador preferir não fazê-lo, registrar "12.2 coberto por teste automatizado" (os testes `useBifurcatedCatalog.test.tsx`/`ServicesSection.catalog-source.test.tsx` provam o formato do toast com o CHECK).

### Caso 13 — Honestidade dos textos (G29/G40): o que a nuvem **ainda não** faz, dito na tela

Com a fonte Supabase: o banner **não** traz mais as frases "ainda não lê a nuvem" (Mais usado) nem "seletor … ainda usa o catálogo local" (**saíram com o CT5** — conferir que não voltaram); a aba **Checkout** diz que **o Checkout continua local ("Em breve")** (isso continua verdadeiro). Conferir também que o texto do card **"Catálogo comercial · fonte de dados"** diz que a nuvem **começa vazia** e que a chave **não migra dado**. **Vermelho** se algum texto prometer o que o código não faz, ou se uma frase "fóssil" reaparecer.

### Caso 14 — Rollback nível 1 (nada apagado)

Card de escrita → **"Desativar"**; card de fonte → **"Voltar para Local"**; Vendas → Catálogo: banner some, **seeds e catálogo local reaparecem**; `SELECT count(*) FROM public.services WHERE name LIKE 'HOMOLOG-CAT-%';` **inalterado** (nada apagado). **Prova do critério:** voltar a **"Usar Supabase"** → as linhas continuam lá.

---

### Caso 16 — Ponte catálogo ↔ orçamento (CT5/G98): `service_id`, wizard, "Mais usado", toggles (G96)

Pré: Casos 5–6 feitos (há serviços na nuvem); fonte do catálogo **Supabase**; anotar `kora.quotes.dataSource.v1` (default `supabase` desde o flip de Vendas). A escrita do **catálogo** pode estar Ativa ou Inativa — o wizard só **lê** o catálogo; o orçamento grava pelo fluxo de orçamentos. Preparar: `HOMOLOG-CAT-nativo-A` ativo e **"Disponível em orçamentos"** ligado; `HOMOLOG-CAT-servico-B` **desativado**; um terceiro serviço (`HOMOLOG-CAT-nativo-C`) com **"Disponível em orçamentos" desligado**.

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 16.1 | Vendas → **"Orçamentos"** → **"Novo orçamento"** → cliente `HOMOLOG-CAT-cliente`, título `HOMOLOG-CAT-orcamento` → **"Continuar"** → no passo 2 abrir o select **"+ Adicionar serviço do catálogo"** | Lista **só** serviços **da nuvem**, **ativos e "Disponível em orçamentos"** (aparece o `nativo-A`; **não** aparecem seeds demo, `servico-B` desativado, nem `nativo-C`); a ajuda termina com **"Catálogo lido da nuvem (Supabase)."** | Print |
| 16.2 | Escolher `HOMOLOG-CAT-nativo-A` | O item entra com **nome e preço copiados** (preço do cadastro, ex. 150); → **"Continuar"** ×2 → **"Salvar orçamento"** | Toast **"Orçamento salvo"** |
| 16.3 | — (SELECT depois) | `service_id` = **uuid do serviço** (não `NULL`) | SELECT G |
| 16.4 | **Snapshot:** no Catálogo (escrita **Ativa**) editar o preço do `nativo-A` → 200; reabrir o orçamento | O item **continua com o preço do momento** (150): o orçamento não muda se o serviço mudar | `SELECT unit_price FROM public.quote_items WHERE name='HOMOLOG-CAT-nativo-A';` → `150.00` |
| 16.5 | F5 e reabrir o orçamento | O item volta **com o vínculo** (`serviceId` lido de volta) | Visual + SELECT G inalterado |
| 16.6 | Vendas → Catálogo Comercial → **Serviços** | Métrica **"Mais usado em orçamentos"** mostra `HOMOLOG-CAT-nativo-A`; o card mostra **"1× em orçamentos"** (a contagem vem dos orçamentos **da nuvem**, por `serviceId`) | Print + SELECT H |
| 16.7 | Banner de modo | **Sem** as frases antigas ("ainda não lê a nuvem", "seletor … ainda usa o catálogo local") | Visual |
| 16.8 | **Regressão local:** card **"Voltar para Local"** → Orçamentos → novo → passo 2 | O select lista o catálogo **local** (seeds etc.), **sem** a frase "Catálogo lido da nuvem"; escolher um serviço **local não importado** e salvar | `service_id IS NULL` para esse item (**nunca** o id cru `svc-…`); para um serviço local **já importado** (Caso 5) o `service_id` = uuid do importado — SELECT G |
| 16.9 | Volta a **"Usar Supabase"**; **Excluir** (soft) o `nativo-A` depois de orçado | O orçamento **continua íntegro**; `service_id` **permanece** (soft delete); a métrica deixa de nomear o serviço excluído | SELECT G |
| 16.10 | **(só se o §2.5 do pacote foi aplicado)** `UPDATE public.quote_items SET service_id='00000000-0000-0000-0000-000000000000' WHERE name='HOMOLOG-CAT-nativo-A';` | FALHA de FK (`quote_items_service_id_fkey`). Depois, com um serviço **descartável** referenciado por um item: `DELETE` físico do serviço ⇒ `service_id` do item vira **NULL** (`ON DELETE SET NULL`), orçamento intacto | Erro capturado + SELECT |
| 16.11 | **Toggles (G96):** desligar **"Disponível em orçamentos"** de um serviço ativo | Some do select do wizard; religar volta | Visual |
| 16.12 | Modal do serviço | O toggle se chama **"Selo interno “Portfólio” — não publica nada"** (não "Mostrar no catálogo público"); ligado, o card ganha o selo **"Portfólio"** (tooltip "Selo interno — não publica nada"); **nenhuma** página/URL pública é criada | Print |

```sql
-- SELECT G (16.3 / 16.5 / 16.8 / 16.9)
SELECT q.title, i.name, i.unit_price, i.service_id, s.name AS servico, s.deleted_at AS servico_excluido_em
FROM public.quote_items i
JOIN public.quotes q ON q.id = i.quote_id
LEFT JOIN public.services s ON s.id = i.service_id
WHERE q.title LIKE 'HOMOLOG-CAT-%' ORDER BY q.created_at DESC, i.created_at;
-- 16.3: service_id = uuid de HOMOLOG-CAT-nativo-A, servico = 'HOMOLOG-CAT-nativo-A', unit_price 150.00
-- 16.8: serviço local NÃO importado ⇒ service_id NULL (nunca 'svc-…'); importado ⇒ uuid do importado
-- 16.9: servico_excluido_em NÃO nulo e service_id continua preenchido

-- SELECT H (16.6) — o que a métrica deve mostrar
SELECT s.name, count(*) AS vezes
FROM public.quote_items i JOIN public.services s ON s.id = i.service_id AND s.deleted_at IS NULL
GROUP BY s.name ORDER BY vezes DESC LIMIT 3;
-- o 1º da lista = o serviço que a tela mostra em "Mais usado em orçamentos"; vezes = o contador "N× em orçamentos" do card
```

---

## Fora do alcance de hoje (**[pendente — …]**; NÃO executar; não implementado)

| Item | Pendente de | Por quê / o que esperar |
|---|---|---|
| ~~Ponte com orçamentos / "Mais usado" / seletor do wizard / toggles G96~~ | **FEITO** (G98 da lane B + CT5) | agora é o **Caso 16**. A **FK** `quote_items_service_id_fkey` (pacote §2.5) é opcional — o passo 16.10 só vale se ela foi aplicada |
| **Checkout** na nuvem | CT6 | segue local; o texto diz |
| **Robô lê o catálogo** (lane D, Q8: `active` + `deleted_at IS NULL`; custo/estoque/notas nunca) | lane D (item 3) | parcial/pendente |
| **Flip do default** (`kora.catalog.dataSource.v1` default `supabase`) + Fase D com o catálogo como default | **CT7** | rodada própria, depois desta Fase D |
| **Biblioteca de Materiais** — persistência na nuvem, import (Casos 12–14 do rascunho anterior: `clients.library_assets`) | **M1–M4 (lane E)** | a coluna existe só depois do §2.4 do pacote; **nenhum código** lê/escreve `library_assets` ainda; hoje a Biblioteca em fonte nuvem usa o store local por uuid (M0/G97) |

---

### Caso 15 — Limpeza (`count = 0`)

Operador executa (Code não executa), na ordem — **hard delete** por nome (o soft delete deixa as linhas):

```sql
-- 1) prova do que existe (inclui linhas soft-deletadas)
SELECT count(*) FROM public.services WHERE name LIKE 'HOMOLOG-CAT-%';
SELECT count(*) FROM public.products WHERE name LIKE 'HOMOLOG-CAT-%';
SELECT count(*) FROM public.service_categories WHERE name LIKE 'HOMOLOG-CAT-%';
SELECT count(*) FROM public.commercial_plans WHERE name LIKE 'HOMOLOG-CAT-%';
SELECT count(*) FROM public.clients WHERE name LIKE 'HOMOLOG-MAT-%';                       -- Biblioteca: só se M2 existir
SELECT count(*) FROM public.clients WHERE name LIKE 'HOMOLOG-MAT-%' AND library_assets <> '[]'::jsonb;
-- 2) DELETE (export manual já feito) — planos antes dos itens; quote_items antes dos serviços (FK), quando CT5 existir
DELETE FROM public.quote_items WHERE name LIKE 'HOMOLOG-CAT-%';
DELETE FROM public.quotes WHERE title LIKE 'HOMOLOG-CAT-%';          -- orçamentos do Caso 16 (os itens já saíram acima)
DELETE FROM public.commercial_plans WHERE name LIKE 'HOMOLOG-CAT-%';
DELETE FROM public.services WHERE name LIKE 'HOMOLOG-CAT-%';
DELETE FROM public.products WHERE name LIKE 'HOMOLOG-CAT-%';
DELETE FROM public.service_categories WHERE name LIKE 'HOMOLOG-CAT-%';
-- clientes/orçamentos de QA (HOMOLOG-MAT-…): pelos caminhos de UI de exclusão ou DELETE do operador
-- 3) DEPOIS: todos devem dar 0
SELECT (SELECT count(*) FROM public.services          WHERE name LIKE 'HOMOLOG-CAT-%') AS servicos,
       (SELECT count(*) FROM public.products          WHERE name LIKE 'HOMOLOG-CAT-%') AS produtos,
       (SELECT count(*) FROM public.service_categories WHERE name LIKE 'HOMOLOG-CAT-%') AS categorias,
       (SELECT count(*) FROM public.commercial_plans  WHERE name LIKE 'HOMOLOG-CAT-%') AS planos,
       (SELECT count(*) FROM public.quotes            WHERE title LIKE 'HOMOLOG-CAT-%') AS orcamentos,
       (SELECT count(*) FROM public.clients           WHERE name LIKE 'HOMOLOG-MAT-%') AS clientes_mat;   -- 0 / 0 / 0 / 0 / 0 / 0
```

**Ressalva de `localStorage` (lição de Tarefas):** o catálogo local de teste e as flags ficam no navegador do operador — remover manualmente
`orbyt.services.v1`, `kora.products.v1`, `kora.serviceCategories.v1`, `kora.commercialPlans.v1`, `kora.checkoutSettings.v1`,
**`kora.catalog.supabaseImport.v1`**, **`kora.catalog.dataSource.v1`**, **`kora.catalog.supabaseWrite.v1`**
(`kora.install.id.v1` **não** — é a identidade do navegador, reaproveitada pelos imports); e `orbyt.clients.v1` do cliente local de teste da Biblioteca (quando M2 existir).
Os cards de Configurações limpam as duas flags (**"Voltar para Local"** / **"Desativar"**), mas **não** o resto.

---

## Placar (preencher na execução)

| Caso | Resultado | Nota |
|---|---|---|
| 0 Pré-voo (hash mínimo + pacote §8-b) | — | parar se vermelho |
| 1 Schema pendente | — | **só antes do DDL** (senão "não aplicável") |
| 2 Padrão local | — | zero request |
| 3 Nuvem, escrita desligada (G76) | — | nada no banco **nem** no local |
| 4 Leitura da nuvem / flag reativa | — | depois do Caso 5 |
| 5 Import assistido | — | ordem, demo fora, idempotência, descarte contado, mapa perdido |
| 6 Escrita ligada + G30 | — | `source_local_id` `native:` |
| 7 Editar / arquivar / duplicar / excluir | — | 7.4 prova de soft delete |
| 8 CHECK / UNIQUE / RLS | — | 8.2 vermelho se o UPDATE inválido NÃO falhar |
| 9 Round-trip | — | |
| 10 Produtos | — | |
| 11 Planos | — | `refId` uuid |
| 12 Erros reais (G95) | — | 12.2 opcional |
| 13 Textos honestos | — | frases fósseis não podem voltar |
| 14 Rollback nível 1 | — | |
| 16 Ponte catálogo↔orçamento (CT5/G98) | — | `service_id` uuid; "Mais usado"; snapshot de preço; regressão local |
| 15 Limpeza | — | `count = 0` + `localStorage` |
| **Pendentes** (Checkout na nuvem, robô, CT7, Biblioteca M1–M4) | **não executados** | ver "Fora do alcance de hoje" |

**§18: este runbook cobre o que existe hoje. Os itens pendentes só viram executáveis depois de seus pré-requisitos mesclarem com "vai" explícito.**
