# Etapa 5 · G94 — Catálogo comercial + Biblioteca de Materiais — Runbook da Fase D (**RASCUNHO — [completar pós-CT7/M4]**)

> **Status: rascunho, não executável.** Escrito antes de qualquer código/DDL do ciclo existir, no molde de
> [`etapa-5-flip-tarefas-runbook.md`](etapa-5-flip-tarefas-runbook.md) e
> [`etapa-5-flip-fichas-runbook.md`](etapa-5-flip-fichas-runbook.md), com as lições incorporadas (nomes reais de
> abas/botões lidos no código; gatilho real de cada caso; SELECT **depois** da ação; prefixo `HOMOLOG-…-%`; limpeza
> com `count = 0` + ressalva de `localStorage`). Tudo marcado **[completar pós-CTn/Mn]** depende de uma fatia do
> [pacote da Fase A](../architecture/etapa-5-flip-catalogo-materiais-fase-a.md) §9 que ainda não existe. Os `SELECT`
> não foram executados (protocolo §0/§6).

## Lições incorporadas (não re-derivar)

- **Confirmar o nome na tela antes de cada caso** (Tarefas/Fichas corrigiram o runbook ao executar).
- **Nomes reais (lidos no código):** Vendas → aba **"Catálogo Comercial"** → sub-abas **"Serviços · Produtos · Planos · Checkout"**;
  botões **"Novo serviço"** / **"Criar serviço"** (estado vazio) / **"Categorias"** (modal "Categorias") / ícones **Editar · Duplicar · Excluir**;
  validações **"Informe o nome do serviço"**, **"Informe um preço maior que zero"**, **"Categoria em uso por um serviço"**;
  toasts **"Serviço criado/atualizado/duplicado/excluído"**; serviço demo **"não pode ser excluído"** (só em fonte local).
  Orçamento: Vendas → **"Orçamentos"** → wizard → seletor "adicionar serviço do catálogo" (mostra só serviços **ativos**).
  Biblioteca: Clientes → perfil do cliente → aba **"Materiais"** → seção **"Biblioteca do cliente"** → **"Adicionar material"** →
  diálogo **"Novo material"** (campos **"Nome do material *"**, **"Link / URL *"**, descrição, tags) / **"Editar material"**.
- **Seeds demo** só existem em fonte local; em fonte nuvem o catálogo de um workspace novo está **vazio**.
- **Print pré-clique** (protocolo §2) em todo passo que grava; **EXPORT MANUAL** antes (protocolo §1).

## Abertura (preencher na execução)

- Worktree / branch / hash do flip do catálogo (CT7) e do merge de M2: ______
- Workspace de QA: `2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9` (reconfirmar)
- Prefixos: **`HOMOLOG-CAT-`** (catálogo) e **`HOMOLOG-MAT-`** (Biblioteca)
- Migrations aplicadas pelo operador (6.1–6.8 do doc da Fase A, conforme decidido): ______ **[completar pós-CT1/M1]**

### Entidades sintéticas

| Entidade | Como criar | Papel |
|---|---|---|
| `HOMOLOG-CAT-categoria-A` | modal "Categorias" | FK de serviço/produto |
| `HOMOLOG-CAT-servico-A` | "Novo serviço" (cobrança **"único"**, preço 100, categoria A) | Casos 2–8 |
| `HOMOLOG-CAT-servico-B` | idem, cobrança **"mensal"** | vocabulário acentuado/duplicar |
| `HOMOLOG-CAT-produto-A` | aba Produtos | Caso 6 |
| `HOMOLOG-CAT-plano-A` | aba Planos, com serviço-A + produto-A | Caso 10 |
| `HOMOLOG-CAT-cliente` + orçamento | cliente de QA + orçamento com serviço-A | Caso 7 |
| `HOMOLOG-MAT-cliente` | cliente de QA nativo da nuvem (uuid) | Casos 12–14 |

## Pré-flip — checklist do operador

1. **EXPORT MANUAL** de `services`, `products`, `service_categories`, `commercial_plans` (vazias hoje — confirmar `count(*)`), de `clients` (coluna `library_assets`) e de `quote_items`.
2. SELECTs de reconfirmação **[completar pós-CT1]**: `SELECT count(*) FROM public.services;` (esperado 0 antes do 1º caso) e `SELECT count(*) FROM public.quote_items WHERE service_id IS NOT NULL;` (esperado 0 antes de CT5).
3. Estado dos flags no navegador de teste: sessão limpa; anotar `kora.catalog.dataSource.v1`, `kora.catalog.supabaseWrite.v1`, `kora.catalog.supabaseImport.v1`.

## Rollback

- **Nível 1** (por navegador; nada é apagado): `localStorage.setItem("kora.catalog.dataSource.v1","local")` + `localStorage.setItem("kora.catalog.supabaseWrite.v1","false")` + F5. **[completar pós-CT7: confirmar os nomes finais das chaves]**
- **Nível 2:** `git revert <hash-do-commit-de-flip-CT7>` (flip isolado). Materiais **não tem flag** — rollback = revert de M2. **[completar pós-CT7/M2: hashes]**
- **Critério:** qualquer caso vermelho sem correção rápida, ou perda/duplicação relatada em uso real.

---

## Casos — Catálogo (HOMOLOG-CAT-%)

### Caso 0 — Servidor e estado padrão **[completar pós-CT7]**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 0.1 | §17 passo 0: worktree + branch + URL; `[Kora] BUILD <hash> (<branch>)` no console | Bate com o hash do flip | Print do console |
| 0.2 | Sessão limpa → Vendas → "Catálogo Comercial" | Lista **vazia** (sem seeds demo) com CTA "Criar serviço"; se houver catálogo local de antes, aviso "existe catálogo salvo só neste dispositivo — importe em Configurações → Dados" **[completar pós-CT6/CT7: texto real]** | Visual |

### Caso 1 — Categorias **[completar pós-CT4]**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 1.1 | **"Categorias"** → criar `HOMOLOG-CAT-categoria-A` | Toast "Categoria criada"; aparece sem F5 | `SELECT id, name FROM public.service_categories WHERE workspace_id='2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND name='HOMOLOG-CAT-categoria-A';` → 1 linha |
| 1.2 | Remover a categoria **em uso** (após o Caso 2) | Toast "Categoria em uso por um serviço"; nada removido | `SELECT deleted_at FROM … ;` → NULL |

### Caso 2 — Criar serviço nativo + G30 **[completar pós-CT4]**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 2.1 | **"Novo serviço"** → nome `HOMOLOG-CAT-servico-A`, categoria A, cobrança **"único"**, preço 100, prazo 5, tags `a,b`, notas, ligar **"Disponível em orçamentos"** | Toast "Serviço criado"; card aparece **sem F5** (resposta do INSERT no cache — G30) | Visual |
| 2.2 | — (SELECT depois da ação) | Todos os campos gravados, `category_id` = uuid da categoria A, `is_demo=false`, `source_local_id` começa com `native:` | `SELECT name, price, billing_type, delivery_days, active, tags, available_in_quotes, show_in_public_catalog, notes, category_id, is_demo, source_local_id FROM public.services WHERE name='HOMOLOG-CAT-servico-A';` |
| 2.3 | F5 | O serviço continua, com categoria e tags | Visual |
| 2.4 | Validações: criar sem nome; com preço 0 | "Informe o nome do serviço" / "Informe um preço maior que zero"; nada gravado | `count(*)` inalterado |

### Caso 3 — Editar, ativar/desativar, duplicar, excluir **[completar pós-CT4]**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 3.1 | Editar o preço do serviço-A → 150 | Toast "Serviço atualizado"; sem F5 | `SELECT price FROM public.services WHERE name='HOMOLOG-CAT-servico-A';` → `150.00` |
| 3.2 | Desativar (badge/toggle de status) | Some do seletor do wizard de orçamento; badge "Inativo" | `SELECT active FROM … ;` → `false` |
| 3.3 | **Duplicar** | Toast "Serviço duplicado"; nome "… (cópia)"; **outra linha**, sem colidir | `SELECT count(*) FROM public.services WHERE name LIKE 'HOMOLOG-CAT-servico-A%';` → 2; `source_local_id` distintos |
| 3.4 | **Excluir** a cópia | Toast "Serviço excluído"; some da lista | `SELECT deleted_at FROM … WHERE name='HOMOLOG-CAT-servico-A (cópia)';` → **não nulo** (soft delete); a linha continua existindo |

### Caso 4 — Vocabulário e CHECK (G40/G49) **[completar pós-CT1]**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 4.1 | Criar `HOMOLOG-CAT-servico-B` com cobrança **"mensal"** e outro com **"único"** | Gravados com o **literal local acentuado** | `SELECT name, billing_type FROM public.services WHERE name LIKE 'HOMOLOG-CAT-servico-%';` → `único` / `mensal` (sem tradução) |
| 4.2 | **Prova obrigatória do CHECK** (operador): `UPDATE public.services SET billing_type='valor-invalido' WHERE name='HOMOLOG-CAT-servico-A';` | **FALHA** com `23514` em `services_billing_type_known_chk` — prova de que a migration 6.2 está ativa | Erro capturado |
| 4.3 | `UPDATE public.services SET price=-1 …` | falha em `services_price_nonneg_chk` | Erro capturado |

### Caso 5 — Round-trip por campo (G37) **[completar pós-CT2]**

Criar serviço com **todos** os campos preenchidos (incl. `notes`, `tags`, `showInPublicCatalog` ligado, categoria e rótulo legado); F5; abrir "Editar": **nada** pode ter sumido (cada campo = o digitado). Prova: SELECT dos 12 campos + tela. Falha em qualquer campo ⇒ vermelho (classe G37/G83).

### Caso 6 — Produtos **[completar pós-CT4]**

Criar `HOMOLOG-CAT-produto-A` (tipo **"Digital"**, status ativo, preço, **custo e estoque**); SELECT: `type='digital'`, `status='active'`, `cost`, `stock` gravados; F5 mantém; **CHECK**: `UPDATE public.products SET type='x'` falha (`products_type_known_chk`).

### Caso 7 — Orçamento com serviço do catálogo — a ponte `quote_items.service_id` (G37/G67) **[completar pós-CT5]**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 7.1 | Vendas → "Orçamentos" → novo → seletor "adicionar serviço do catálogo" → escolher `HOMOLOG-CAT-servico-A` → salvar o orçamento | Item copia nome e preço; salva | Visual |
| 7.2 | — (SELECT depois) | `service_id` **= uuid do serviço** (não `NULL`) | `SELECT i.name, i.service_id, s.name AS servico FROM public.quote_items i LEFT JOIN public.services s ON s.id=i.service_id WHERE i.name='HOMOLOG-CAT-servico-A' ORDER BY i.created_at DESC LIMIT 1;` → `servico = HOMOLOG-CAT-servico-A` |
| 7.3 | Reabrir o orçamento / F5 | O item volta **com o vínculo** (`serviceId` lido de volta) | Visual + `count` |
| 7.4 | "Mais usado em orçamentos" (aba Serviços) | Conta o orçamento da nuvem (antes subcontava) | Visual |
| 7.5 | Excluir (soft) o serviço-A depois de orçado | O orçamento **continua** íntegro; `service_id` permanece (soft delete) | SELECT do 7.2 |
| 7.6 | **FK** (se 6.7 aplicado): `UPDATE public.quote_items SET service_id='00000000-0000-0000-0000-000000000000'` | falha de FK (`quote_items_service_id_fkey`) | Erro capturado |

### Caso 8 — Toggles com efeito (G29) **[completar pós-Q10]**

"Disponível em orçamentos" desligado ⇒ o serviço **não** aparece no seletor do wizard (se a decisão Q10 for honrar o toggle); "Mostrar no catálogo público" ⇒ conforme a decisão (badge removido ou documentado como reservado). Registrar o comportamento escolhido; **vermelho** se a UI prometer o que o código não faz.

### Caso 9 — Import assistido idempotente **[completar pós-CT6]**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 9.1 | Com catálogo **local** de teste (criar 1 categoria, 1 serviço "único", 1 produto, 1 plano em modo local/override), Configurações → Dados → **"Importar Catálogo Comercial"** → selecionar → importar | Toast com contagens; **demo não aparece como candidato** | `SELECT count(*) FROM public.services WHERE source_local_id LIKE '%:%' AND name LIKE 'HOMOLOG-CAT-%';` |
| 9.2 | Reabrir o import | Itens já importados ⇒ status "já existe"; **sem 2ª linha** | mesmo SELECT inalterado; `SELECT source_local_id, count(*) FROM public.services GROUP BY 1 HAVING count(*) > 1;` → 0 linhas |
| 9.3 | Serviço local com categoria **não importada** | Candidato "depende da categoria" (ordem categorias → serviços → produtos → planos) | Visual |

### Caso 10 — Planos e referências (R1) **[completar pós-CT6]**

Plano importado/criado com serviço-A + produto-A: `SELECT items FROM public.commercial_plans WHERE name='HOMOLOG-CAT-plano-A';` → `refId` **são uuids existentes** em `services`/`products` (nenhum `svc-…`/`prod-…`); "Editar plano" mostra os itens marcados; excluir o serviço referenciado não quebra a tela do plano. Item sem tradução no import ⇒ contado no toast, **não gravado**.

### Caso 11 — O robô lê o catálogo (lane D) **[completar pós-item3/CT4]**

Com o consentimento da categoria A ligado, uma pergunta de WhatsApp sobre o serviço-A é respondida com **nome/preço/prazo** corretos; **custo/estoque/notas nunca** aparecem na resposta; serviço desativado/excluído **não** é citado. Prova: log da composição (allowlist de colunas) + SELECT do serviço. Depende da lane D — registrar como parcial se o item 3 ainda não estiver ligado.

---

## Casos — Biblioteca de Materiais (HOMOLOG-MAT-%)

### Caso 12 — Biblioteca persiste na nuvem (G75 resolvido) **[completar pós-M2]**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 12.1 | Clientes → `HOMOLOG-MAT-cliente` → aba **"Materiais"** → **"Adicionar material"** → nome `HOMOLOG-MAT-item-1`, link `https://example.com/mat1`, tipo "Google Drive", descrição, tags | Toast de **sucesso real** (não o aviso do G75); item na lista | Visual |
| 12.2 | — (SELECT depois) | Item gravado com os campos | `SELECT jsonb_array_length(library_assets) AS n, library_assets->0->>'title' AS titulo, library_assets->0->>'url' AS url, library_assets->0->>'accessStatus' AS acesso FROM public.clients WHERE name='HOMOLOG-MAT-cliente';` → `1 \| HOMOLOG-MAT-item-1 \| https://example.com/mat1 \| …` |
| 12.3 | **F5** e reabrir o cliente | O item **continua** (antes da M2 sumia aqui) — **prova do G75** | Visual (print) |
| 12.4 | Editar o título; adicionar um 2º; excluir o 1º | Mudanças refletidas sem F5; F5 mantém | `jsonb_array_length` = 1, título certo |
| 12.5 | Outro navegador/dispositivo (mesmo workspace) | A Biblioteca aparece (**era local-only**) | Visual |
| 12.6 | **Teto:** inserir > 200 itens (operador, por SQL) | `clients_library_assets_array_chk` rejeita | Erro capturado |

### Caso 13 — Import da Biblioteca local **[completar pós-M3]**

Cliente **local mapeado** com 2 materiais em `orbyt.clients.v1` e `library_assets` vazio na nuvem: o import preenche os 2 (`jsonb_array_length` = 2); rodar de novo **não** duplica nem sobrescreve; Biblioteca já preenchida na nuvem **não** é substituída.

### Caso 14 — Textos (G29) **[completar pós-M2]**

Nenhum aviso "salvo só neste dispositivo" / "ainda não sincroniza com a nuvem" permanece na Biblioteca depois do M2; se algo ainda não persistir (ex.: item com arquivo), o aviso diz a verdade.

---

### Caso 15 — Limpeza (`count = 0`)

Operador executa (Code não executa), na ordem:

```sql
-- 1) prova do que existe
SELECT count(*) FROM public.services WHERE name LIKE 'HOMOLOG-CAT-%';
SELECT count(*) FROM public.products WHERE name LIKE 'HOMOLOG-CAT-%';
SELECT count(*) FROM public.service_categories WHERE name LIKE 'HOMOLOG-CAT-%';
SELECT count(*) FROM public.commercial_plans WHERE name LIKE 'HOMOLOG-CAT-%';
SELECT count(*) FROM public.clients WHERE name LIKE 'HOMOLOG-MAT-%' AND library_assets <> '[]'::jsonb;
-- 2) DELETE (operador; export manual já feito) — quote_items antes dos serviços (FK), planos antes dos itens
DELETE FROM public.quote_items WHERE name LIKE 'HOMOLOG-CAT-%';
DELETE FROM public.commercial_plans WHERE name LIKE 'HOMOLOG-CAT-%';
DELETE FROM public.services WHERE name LIKE 'HOMOLOG-CAT-%';
DELETE FROM public.products WHERE name LIKE 'HOMOLOG-CAT-%';
DELETE FROM public.service_categories WHERE name LIKE 'HOMOLOG-CAT-%';
-- clientes/orçamentos de QA: pelos caminhos de UI de exclusão ou DELETE do operador
-- 3) DEPOIS: todos devem dar 0
```

**Ressalva de `localStorage` (lição de Tarefas):** o catálogo local de teste e as demais chaves ficam no
navegador do operador — remover manualmente `orbyt.services.v1`, `kora.products.v1`, `kora.serviceCategories.v1`,
`kora.commercialPlans.v1`, `kora.checkoutSettings.v1`, `kora.catalog.supabaseImport.v1` e os overrides
`kora.catalog.*`; o `orbyt.clients.v1` do cliente local de teste da Biblioteca.

---

## Placar (preencher na execução)

| Caso | Resultado | Nota |
|---|---|---|
| 0 Servidor / estado padrão | — | |
| 1 Categorias | — | |
| 2 Criar serviço + G30 | — | |
| 3 Editar / duplicar / excluir | — | 3.4 prova de soft delete |
| 4 Vocabulário / CHECK | — | 4.2 vermelho se o UPDATE inválido NÃO falhar |
| 5 Round-trip | — | |
| 6 Produtos | — | |
| 7 Ponte com orçamentos | — | `service_id` ≠ NULL |
| 8 Toggles | — | depende de Q10 |
| 9 Import | — | |
| 10 Planos | — | |
| 11 Robô | — | depende da lane D (pode ser parcial) |
| 12 Biblioteca persiste | — | prova do G75 |
| 13 Import da Biblioteca | — | |
| 14 Textos | — | |
| 15 Limpeza | — | `count = 0` + `localStorage` |

**§18: rascunho — só vira executável depois de CT1–CT7/M1–M4 mesclarem com "vai" explícito.**
