# Etapa 5 · G1/Projetos · Pacote do Flip — Runbook das Fases C/D (preparação)

> **Escopo desta rodada: doc-only, zero código.** Este doc NÃO executa nada —
> prepara o roteiro pra que a Fase C (flip dos defaults) e a Fase D
> (homologação B.3) não precisem improvisar formato, critério ou passo
> quando chegar a vez delas. Mesmo molde do runbook de `quotes`
> ([`etapa-5-flip-quotes.md`](etapa-5-flip-quotes.md) §5) e da Fase D de
> `projects`/Fatia 10-equivalente, adaptado ao que a Fase A do Pacote do
> Flip de `projects` já desenhou.
>
> **Dependência aberta, explícita:** a Fase B de código (CRUD completo em
> modo Supabase, tradução de status/O12, migração dos 5 consumidores) está
> em andamento pela LANE A (`Kora-laneA`, branch `etapa-5-flip-projetos-pacote`,
> ainda não mesclada em `main` no momento desta rodada) e não faz parte do
> escopo daqui. Onde este runbook depende de detalhe que só existe depois
> daquele merge (nome exato de hook, arquivo:linha, hash de commit), está
> marcado **`[completar pós-B]`** — não inventado.

## Abertura (§16/§17)

- Worktree: `orbit-designer-hub` (branch própria criada aqui, não na
  worktree de nenhuma outra lane).
- Branch: `etapa-5-flip-projetos-runbook`, criada a partir de `origin/main`.
- Hash confirmado por `git log origin/main -1`: `e8c5dd8`
  (`merge: sessao §8-b APLICADA (12/ago) - Projetos DDL + reaper G24, Etapa 6 fechada`).
- Paralelismo: LANE A em `Kora-laneA` (`etapa-5-flip-projetos-pacote`,
  Fase B em andamento), LANE B em `orbit-designer-hub-qualidade-lint`
  (`ux2-g21-g23-g25-fase-a`) — sem interseção de arquivos com este doc.

## Referências (com o porquê de cada uma)

- [`etapa-5-flip-quotes.md`](etapa-5-flip-quotes.md) — template direto do
  padrão de flip: skeleton de fases (A→B→C→D→sign-off, cada uma "PARADO"
  até novo "vai"), formato de caso de homologação, runbook de rollback,
  critério de vermelho vs. ressalva. A estrutura deste doc replica a de lá
  seção a seção.
- [`etapa-5-fatia-10-quotes-write.md`](etapa-5-fatia-10-quotes-write.md) —
  os 5 incidentes de homologação (worktree errada, loop de refetch/G14,
  symlink quebrado/motivou §17, import órfão/G16, gate de status) —
  origem das regras de prova-de-servidor e do formato de caso atômico
  usados abaixo (§3).
- [`etapa-5-flip-projetos-pacote.md`](etapa-5-flip-projetos-pacote.md) —
  **ainda não mesclada** (branch `etapa-5-flip-projetos-pacote`, LANE A) —
  a Fase A do Pacote do Flip de `projects`: re-inventário dos 5
  consumidores a migrar, plano de import pré-flip, desenho do CRUD, os 7
  casos esboçados (§4.3 daquele doc) e os critérios de rollback (§4.4) —
  fonte primária deste runbook. Lida via `git show` (mesmo repo, branch
  local da LANE A), não checked out nesta worktree.
- [`docs/qa/protocolo-homologacao.md`](protocolo-homologacao.md) — §0/§6
  (Code não acessa banco/localStorage do operador), §16/§17 (isolamento de
  worktree, prova de build por hash), §18 (merge condicionado a "vai"), e
  os gates permanentes **EXPORT MANUAL** (§1) e **PRINT PRÉ-CLIQUE** (§2)
  usados no pré-flip (§1 abaixo).

---

## 1. PRÉ-FLIP — checklist do operador

Mesmo tratamento do precedente de `quotes` (`etapa-5-flip-quotes.md` §1.4,
achado 1): o import não é um gap de código, é uma **pré-condição de
runbook**. Diferença registrada pela Fase A do pacote (`etapa-5-flip-projetos-pacote.md`
§2): o import de `projects` (`useLocalProjectsImport.ts`, construído na
Fatia 7) **nunca foi homologado numa rodada B.3 de verdade** — não dá pra
assumir que "existe" é o mesmo que "provado". Por isso o pré-flip aqui é
mais explícito que o de `quotes`.

### 1.1 Gate EXPORT MANUAL (protocolo §1) — antes de qualquer coisa

Projeto Supabase em plano Free, sem backup automático (protocolo §0).
Operador exporta as tabelas afetadas por este pacote antes de qualquer
escrita nova: `projects`, `tasks` (FK `project_id`), `whatsapp_campaign_recipients`
não se aplica aqui — só o par `projects`/`tasks`. Confirmação por escrito
do operador ("exportei") é o gate — Code não executa isto, só verifica
que a confirmação chegou antes de prosseguir pra §1.2.

### 1.2 Import assistido — `LocalProjectsImportCard`

Componente confirmado em produção: `src/components/settings/LocalProjectsImportCard.tsx`,
montado em `Configuracoes.tsx:850` (import em `:77`). Usa
`useLocalProjectsImport.ts` → classifica candidatos `new`/`imported`
contra `kora.projects.supabaseImport.v1.importedMap`, sinaliza órfãos de
FK (cliente/quote/oportunidade não mapeado, sobe com campo nulo, dado
textual preservado), importa via `projectsRepository.importProject`
(mesmo arbiter `source_local_id` do espelho best-effort da fatia N).

**Passo a passo (operador, antes de flipar `dataSource`):**

1. Abrir Configurações → "Importar projetos locais".
2. Anotar a contagem de candidatos por status (`new` / `imported`) — **prova
   de import, não estimativa**:
   ```
   Local (orbyt.projects.v1, reais, não-demo): ____
   Já em kora.projects.supabaseImport.v1.importedMap: ____
   Candidatos "new" (não-demo): ____
   ```
3. Se houver algum candidato `new` que não seja demo: revisar órfãos de FK
   sinalizados (cliente/quote/oportunidade não vinculado) e importar.
4. Volume real do operador é **desconhecido — a confirmar com o operador**
   nesta etapa (Code não acessa `localStorage` do navegador do operador,
   protocolo §0/§6). Pergunta específica a fazer: *"quantos projetos reais
   (não-demo) existem em `orbyt.projects.v1`, e quantos já aparecem em
   `kora.projects.supabaseImport.v1.importedMap`?"*
5. **Prova de import (local vs. nuvem), antes de prosseguir:**
   ```sql
   -- Contagem na nuvem, workspace de teste (confirmar id com o operador)
   SELECT count(*) FROM public.projects WHERE workspace_id = '<workspace_id>' AND deleted_at IS NULL;
   ```
   Comparar contra a contagem local anotada no passo 2 — a diferença
   esperada é exatamente o número de candidatos `new` importados no passo
   3, nem mais nem menos.
6. **Decisão explícita de prosseguir** (gate, não formalidade): só depois
   de (a) export confirmado (§1.1), (b) nenhum candidato `new` restante ou
   decisão documentada de não importar algum, (c) prova de contagem
   batendo — a Fase C pode começar. Registrar essa decisão no relatório da
   sessão de flip, mesmo que a resposta seja "zero projetos locais reais,
   nada a importar".

---

## 2. FASE C — flip dos defaults

### 2.1 Pré-requisito de ordem — não flipar antes do CRUD estar pronto

Mesma lição já registrada na Fase A do pacote (`etapa-5-flip-projetos-pacote.md`
§4.1): se `dataSource` flipar antes do CRUD de escrita (Fase B) estar
pronto, todo usuário cai em `blockWrite()` (bloqueio hoje existente em
`ProjectDetailDrawer.tsx`) até o código de escrita chegar — regressão
temporária desnecessária. Ordem obrigatória:

1. Fase B (código) mesclada e homologada — `[completar pós-B]`: confirmar
   hash do merge antes de abrir a Fase C.
2. Fase C (este runbook, §2.2-§2.4).
3. Fase D (homologação, §3).

### 2.2 As duas flags — antes (hoje, confirmado) / depois (proposto)

**Flag 1 — `kora.projects.dataSource.v1`** (`src/config/flags.ts:101,182-188`,
confirmado nesta rodada, código atual):

```ts
// ANTES (Fatia N, hoje em produção) — só "supabase" explícito seleciona nuvem.
export function getProjectsDataSource(): DataSource {
  return safeGet(PROJECTS_DATA_SOURCE_KEY) === "supabase" ? "supabase" : "local";
}
```

```ts
// DEPOIS (Fase C, proposto — mesmo padrão literal de getCrmDataSource()/
// getQuotesDataSource() pós-flip) — só "local" explícito seleciona local.
export function getProjectsDataSource(): DataSource {
  return safeGet(PROJECTS_DATA_SOURCE_KEY) === "local" ? "local" : "supabase";
}
```

**Flag 2 — `kora.projects.supabaseWrite.enabled`** (`src/hooks/useSupabaseProjectsWriteFlag.ts:29-31`,
confirmado nesta rodada, código atual):

```ts
// ANTES (Fatia N, hoje em produção) — opt-in, só "true" liga.
function readFlag(): boolean {
  try {
    return localStorage.getItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY) === "true";
  } catch {
    return false;
  }
}
```

```ts
// DEPOIS (Fase C, proposto — mesmo padrão de useSupabaseQuotesWriteFlag.ts
// pós-flip) — opt-out, só "false" desliga.
function readFlag(): boolean {
  try {
    return localStorage.getItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY) !== "false";
  } catch {
    return false;
  }
}
```

**As duas flipam no mesmo pacote, não em rodadas separadas** — mesmo
precedente de `quotes` (motivo registrado lá: "o cutover completo decide
os dois juntos"). `[completar pós-B]`: confirmar que nenhum outro
`readFlag`/`getProjectsDataSource` ganhou lógica adicional durante a Fase
B que mude este diff.

### 2.3 Rollback nível 1 — override de flag, sem deploy

Mesma garantia dos overrides de flag (precedência sobre o default — P5 do
protocolo). Sem código, sem deploy, por workspace individual, via console
do navegador:

```js
localStorage.setItem("kora.projects.dataSource.v1", "local");
localStorage.setItem("kora.projects.supabaseWrite.enabled", "false");
```
seguido de F5.

**O que acontece com o dado, em cada direção (mesma garantia de `quotes`):**
- Voltando pra "Local": `orbyt.projects.v1` nunca foi tocado enquanto o
  workspace estava em modo Supabase (hooks correm em paralelo, só um é
  lido) — 100% intacto.
- Dado criado/editado em Supabase durante a janela com escrita ligada: não
  é apagado no revert — só para de aparecer na tela se o usuário também
  trocar pra "Local"; continua em `public.projects`, reaparece assim que o
  seletor volta pra "supabase".
- **Nenhuma direção do rollback nível 1 perde dado** — pior caso é perda
  de visibilidade temporária, sempre reversível.

### 2.4 Rollback nível 2 — revert de código

Só se o nível 1 não for suficiente (bug fora do alcance das flags — ex.:
erro na tradução de status O12 gravando dado errado independente do
default). Ao contrário do precedente de `quotes` (que só descreveu o
conceito, sem comando literal), aqui fica explícito:

```bash
git revert <hash-do-commit-de-flip-da-Fase-C> --no-edit
git push origin main
```
`<hash-do-commit-de-flip-da-Fase-C>` — `[completar pós-B]`: só existe
depois que a Fase C for de fato mesclada; registrar o hash exato no
relatório daquela rodada, nunca por citação (mesmo princípio de todo este
protocolo — `git log`, não memória). O revert de nível 2 mantém a Fatia N
intacta (schema/dual-write já em produção não são tocados por este
commit) — reverte só os 2 defaults + qualquer código de escrita da Fase B
que tenha ido no mesmo commit.

### 2.5 Critério de acionamento do rollback

Qualquer caso do runbook de Fase D (§3) fechar **vermelho sem correção
rápida** (ver critério em §4), ou relato do operador em uso real de
projeto sumido/duplicado — aciona nível 1 imediatamente; nível 2 só se o
nível 1 não resolver.

---

## 3. FASE D — Runbook de homologação (PRONTO PARA EXECUÇÃO após Fase C)

### 3.0 Prova de servidor — protocolo §17, passo 0 obrigatório

Antes de qualquer caso abaixo: declarar worktree + branch + URL do dev
server, e confirmar que o app carregado exibe `[Kora] BUILD <hash> (<branch>)`
no console (modo dev) batendo com o hash esperado da Fase C mesclada —
nunca inferir correspondência código↔servidor pelo comportamento
observado (incidente #1/#3 da Fatia 10 de `quotes`: um bloqueio de escrita
"parecendo certo" pode ser o código ERRADO bloqueando pelo motivo errado).
Sem symlink de conveniência pro `cwd` do dev server (incidente #3) — subir
`npm run dev` direto na worktree real.

### 3.1 Papéis das entidades sintéticas

Mesmo padrão de nomeação de `quotes` (prefixo `HOMOLOG-FLIP-`), workspace
de QA a confirmar com o operador antes de rodar (mesmo workspace usado nas
rodadas anteriores de `quotes`/CRM — **`[completar pós-B]`/operador:
confirmar que esse workspace segue sendo o padrão de QA antes de reusar o
id literal**):

| Entidade sintética | Papel no runbook |
|---|---|
| `HOMOLOG-FLIP-cliente` | Cliente sintético — usado nos casos de ficha (Central do Dia, `ClientProfileDrawer`, `ClientActivitiesTab`, `ClientActivityLogDialog`) |
| `HOMOLOG-FLIP-quote` | Quote sintética aprovada — origem do caso `QuoteToProjectDialog` (Vendas → "Gerar projeto") |
| `HOMOLOG-FLIP-projeto-A` | Projeto criado direto na tela principal — casos 1, 2, 3, 4, 7 |
| `HOMOLOG-FLIP-projeto-B` | Projeto gerado via `QuoteToProjectDialog` a partir de `HOMOLOG-FLIP-quote` — caso 5 |
| `HOMOLOG-FLIP-projeto-import` | Projeto criado **local**, antes do flip, pra provar o caso 6 (import pré-existente) |

### 3.2 Os 7 casos

Esqueleto herdado de `etapa-5-flip-projetos-pacote.md` §4.3 (7 casos
esboçados na Fase A do pacote), expandido aqui passo-a-passo. Print
pré-clique obrigatório (protocolo §2) em todo passo que grava na nuvem.

---

**Caso 1 — Usuário novo**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 1.1 | Console: `localStorage.removeItem("kora.projects.dataSource.v1"); localStorage.removeItem("kora.projects.supabaseWrite.enabled");` → F5 | Seletor da tela principal já mostra fonte "Supabase" sem setar nada manualmente | Visual — seletor/badge |
| 1.2 | Portfolio → Projetos → "+ Novo projeto" `HOMOLOG-FLIP-projeto-A`, cliente `HOMOLOG-FLIP-cliente` (se já existir) ou em branco, salvar | Toast de sucesso, projeto aparece na lista imediatamente | Visual |
| 1.3 | — | Linha existe na nuvem | `SELECT id, title, status FROM public.projects WHERE workspace_id = '<workspace_id>' AND title = 'HOMOLOG-FLIP-projeto-A';` → 1 linha |

---

**Caso 2 — Override negativo sobrevive**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 2.1 | Console: `localStorage.setItem("kora.projects.supabaseWrite.enabled", "false");` → F5 (dataSource continua supabase) | Tela ainda lê da nuvem (leitura não depende dessa flag) | Visual |
| 2.2 | Tentar editar `HOMOLOG-FLIP-projeto-A` (mudar status ou marcar entregável) | Bloqueia com toast explícito (mesmo padrão de `blockWrite()` — mensagem deve indicar que a escrita está desligada, não falhar em silêncio) | Visual — texto do toast |
| 2.3 | — | Nada mudou no banco | `SELECT status, updated_at FROM public.projects WHERE title = 'HOMOLOG-FLIP-projeto-A';` → valores idênticos ao caso 1 |

---

**Caso 3 — Override de dataSource**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 3.1 | Console: `localStorage.setItem("kora.projects.dataSource.v1", "local");` → F5 | Tela mostra projetos locais (provavelmente vazia/diferente da nuvem) | Visual |
| 3.2 | — | Zero chamada de rede pra `projects`/`tasks` nesse carregamento | Network tab — nenhum request Supabase relacionado |
| 3.3 | Console: reverter pra `"supabase"` → F5 | `HOMOLOG-FLIP-projeto-A` volta a aparecer, sem duplicar | Visual + `SELECT count(*) FROM public.projects WHERE title = 'HOMOLOG-FLIP-projeto-A';` → 1 |

---

**Caso 4 — Edição real (create→update→archive), prova do O12**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 4.1 | Abrir `HOMOLOG-FLIP-projeto-A`, mudar status pra "Em andamento" | Transição reflete na tela | Visual |
| 4.2 | — | `status` atualizado no banco | `SELECT status FROM public.projects WHERE title = 'HOMOLOG-FLIP-projeto-A';` → `'in_progress'` |
| 4.3 | Marcar 1 entregável como concluído no drawer | `progress` recalculado na tela | Visual — barra/percentual |
| 4.4 | — | `deliverables` gravado, `progress` segue derivado (sem coluna própria) | `SELECT deliverables FROM public.projects WHERE title = 'HOMOLOG-FLIP-projeto-A';` → jsonb com o item marcado |
| 4.5 | Menu do projeto → "Arquivar" | Projeto sai da lista ativa (ou aparece marcado como arquivado, conforme UX da tela) | Visual |
| 4.6 | **Prova O12 — o caso que esta fatia existe pra fechar** | `status` grava valor neutro (não mais literal `'archived'` puro sem o boolean) **E** `archived = true` na mesma linha | `SELECT status, archived FROM public.projects WHERE title = 'HOMOLOG-FLIP-projeto-A';` → `archived = true`, `status` no vocabulário neutro (`'planning'`, conforme desenho §3.2 do pacote — `[completar pós-B]`: confirmar o valor exato que a Fase B implementou) |

**Este caso é vermelho automático se o passo 4.6 não bater** — é
literalmente o achado que motivou a fatia (O12), não uma ressalva
aceitável.

---

**Caso 5 — Os 5 consumidores migrados**

Cobre, em sub-passos, exatamente os 5 itens classificados `(a) precisa
migrar` na Fase A do pacote (`etapa-5-flip-projetos-pacote.md` §1):
Central do Dia, `QuoteToProjectDialog` (Vendas), `ClientProfileDrawer`,
`ClientActivitiesTab`, `ClientActivityLogDialog`.

| Passo | Consumidor | Ação | Esperado | Prova |
|---|---|---|---|---|
| 5.1 | Setup | Criar `HOMOLOG-FLIP-quote` (aprovada) vinculada a `HOMOLOG-FLIP-cliente`, ambos em modo Supabase | Quote/cliente existem na nuvem | Visual |
| 5.2 | **`QuoteToProjectDialog`** (Vendas → "Gerar projeto") — **o mais crítico (R5)** | A partir de `HOMOLOG-FLIP-quote` aprovada, clicar "Gerar projeto" → nomear `HOMOLOG-FLIP-projeto-B` | Projeto aparece **imediatamente** na tela principal de Projetos (nuvem) — este é o caso cuja falha significa "projeto criado, mas invisível pro usuário assim que criado" (risco R5 do pacote) | Visual — projeto na lista + `SELECT * FROM public.projects WHERE title = 'HOMOLOG-FLIP-projeto-B';` → 1 linha |
| 5.3 | **Central do Dia** | Definir `dueDate` de `HOMOLOG-FLIP-projeto-B` no passado (simular atraso), abrir Central do Dia | Item de atenção "projeto atrasado" aparece, referenciando o projeto da NUVEM (não um projeto local fantasma) | Visual — card na Central do Dia |
| 5.4 | **`ClientProfileDrawer`** (aba "Projetos" da ficha) | Abrir ficha de `HOMOLOG-FLIP-cliente` → aba Projetos | `HOMOLOG-FLIP-projeto-B` aparece na lista | Visual |
| 5.5 | **`ClientActivitiesTab`** (timeline) | Mesma ficha → aba Atividades | Evento relacionado ao projeto aparece na timeline | Visual |
| 5.6 | **`ClientActivityLogDialog`** (registrar atividade manual) | Mesma ficha → "Registrar atividade" → selecionar projeto no dropdown | `HOMOLOG-FLIP-projeto-B` aparece como opção selecionável | Visual — dropdown populado |

`[completar pós-B]`: nomes exatos de hook/arquivo:linha de cada
consumidor migrado só existem depois do merge da Fase B — os sub-passos
acima descrevem o comportamento observável esperado, não a implementação.

---

**Caso 6 — Import pré-existente**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 6.1 | **Antes** de rodar este caso, garantir que `HOMOLOG-FLIP-projeto-import` foi criado em modo **local** (dataSource=local) numa sessão anterior ao flip desta rodada | Projeto existe só em `orbyt.projects.v1`, não na nuvem | `SELECT count(*) FROM public.projects WHERE title = 'HOMOLOG-FLIP-projeto-import';` → 0 |
| 6.2 | Configurações → "Importar projetos locais" → localizar `HOMOLOG-FLIP-projeto-import` como candidato `new` → importar | Import bem-sucedido | Visual — toast |
| 6.3 | Voltar pra tela principal (dataSource=supabase) | Projeto aparece, **sem duplicar** | Visual + `SELECT count(*) FROM public.projects WHERE title = 'HOMOLOG-FLIP-projeto-import';` → 1 |

Este caso também é a homologação formal do próprio
`useLocalProjectsImport.ts` — risco R4 do pacote registra que ele nunca
tinha sido testado numa rodada B.3 de verdade.

---

**Caso 7 — Limpeza**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 7.1 | Soft-delete/arquivar todos os projetos sintéticos (`HOMOLOG-FLIP-projeto-A/B/import`), remover quote/cliente sintéticos, limpar chaves de `localStorage` setadas manualmente nos casos 2/3 | Estado volta a "usuário novo" | — |
| 7.2 | — | Resíduo zero | `SELECT count(*) FROM public.projects WHERE workspace_id = '<workspace_id>' AND title LIKE 'HOMOLOG-FLIP-%' AND deleted_at IS NULL;` → 0 |

---

## 4. Critérios de vermelho vs. ressalva

Mesmo critério operacional do precedente de `quotes`/Fatia 10 (nunca
formalizado como regra abstrata única, mas aplicado de forma consistente
— fixado aqui em texto explícito pra não precisar re-derivar):

- **Vermelho (para a homologação):** o comportamento **observado ao vivo
  diverge do comportamento desenhado/documentado** — a feature não faz o
  que devia. Aciona o ciclo: diagnóstico → correção → novo commit →
  **PARADO** → aguardar novo "vai" antes de retomar o runbook do ponto
  onde parou. Exemplo do próprio pacote: caso 4.6 (O12) fechar sem o
  boolean `archived` correto é vermelho automático, não ressalva — é
  exatamente o achado que esta fatia existe pra resolver.
- **Ressalva (não bloqueia):** o mecanismo já está provado correto por
  outra via (teste automatizado + homologação ao vivo anterior) e só uma
  recaptura específica (ex.: print de novo) não foi refeita nesta rodada.
  Decisão de não reabrir deve ser **registrada explicitamente**, nunca
  deixada implícita — formato: *"Decisão: não reabrir/reexecutar esse
  sub-passo agora — [motivo]; registrado explicitamente pra não ficar
  implícito."*
- **Achado catalogado, não é bug:** algo encontrado durante a homologação
  que não afeta o caminho testado (ex.: resíduo de flag legada órfã) —
  registra no catálogo mestre (`kora-hub-auditoria-e-plano.md`), critério:
  zero consumidores reais confirmados por grep **e** mesmo tratamento já
  dado a um achado precedente equivalente.
- **Placar de fechamento:** formato herdado — `N/N casos verdes[, com o
  caso 4 obrigatoriamente incluindo prova SQL do O12 — não pode fechar
  como "assumido correto"]`.

---

## 5. O que este doc NÃO faz

- Não executa nenhum caso — é preparação, Fase C ainda não mesclada.
- Não inventa nome de hook/arquivo:linha da Fase B — marcado
  `[completar pós-B]` onde depende disso.
- Não decide o workspace de QA a usar — fica como pergunta explícita ao
  operador antes da execução real.
- Não substitui os gates permanentes do protocolo (EXPORT MANUAL, PRINT
  PRÉ-CLIQUE, prova de servidor §17) — só aponta onde cada um entra nesta
  fatia especificamente.

**PARADO aqui — este runbook é preparação. Execução real da Fase C/D só
depois que a Fase B (LANE A) mesclar e um novo "vai" autorizar.**
