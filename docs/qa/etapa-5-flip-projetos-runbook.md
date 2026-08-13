# Etapa 5 · G1/Projetos · Pacote do Flip — Runbook das Fases C/D (preparação)

> **Escopo desta rodada: doc-only, zero código.** Este doc NÃO executa nada —
> prepara o roteiro pra que a Fase C (flip dos defaults) e a Fase D
> (homologação B.3) não precisem improvisar formato, critério ou passo
> quando chegar a vez delas. Mesmo molde do runbook de `quotes`
> ([`etapa-5-flip-quotes.md`](etapa-5-flip-quotes.md) §5) e da Fase D de
> `projects`/Fatia 10-equivalente, adaptado ao que a Fase A do Pacote do
> Flip de `projects` já desenhou.
>
> **Atualização (rodada seguinte):** a Fase B mesclou em `main`
> (`fbdea18`/merge `d90ba47`, tip confirmado `395a432`) — os
> `[completar pós-B]` desta rodada foram resolvidos contra o código real,
> não mais contra o desenho da Fase A. Nenhum caso mudou de forma, só os
> detalhes antes marcados como pendentes.
>
> **Atualização (Fase D, Caso 1 → vermelho corrigido, G29):** a Fase C
> mesclou (`b90f86a`) e a Fase D começou a execução real — Caso 1 revelou
> um vermelho (badge/banner de "modo leitura" sobrevivendo intactos da
> Fatia N com a escrita já operacional) e a expectativa original do
> **Caso 2** (§3.2) — "override `false` bloqueia escrita" — se provou
> desatualizada contra o código real. **G29**
> (`kora-hub-auditoria-e-plano.md`) corrigiu o achado: a write flag nunca
> gateou o CRUD em modo Supabase (só o espelho em modo local, G22). Caso 2
> e §2.3 emendados nesta rodada pra refletir a semântica real.

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

1. Fase B (código) mesclada — **confirmado**: `d90ba47` (merge em `main`),
   commit de conteúdo `fbdea18` ("Pacote do Flip - Fase B (CRUD real em
   modo Supabase, resolve O12)"). Homologação viva desta Fase B em si não
   faz parte deste runbook (é código de escrita normal, gates de código
   já cobriram); o que falta homologar é o FLIP dos defaults (Fase C/D
   abaixo).
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

**Flag 2 — `kora.projects.supabaseWrite.enabled`** (`src/hooks/useSupabaseProjectsWriteFlag.ts:29-32`,
reconfirmado nesta rodada contra `main` pós-Fase-B — inalterado):

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
os dois juntos"). **Confirmado nesta rodada:** reconferido contra `main`
pós-merge da Fase B (`d90ba47`) — nenhum dos dois pontos ganhou lógica
adicional; os diffs "antes/depois" acima seguem literalmente aplicáveis.

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
- Dado criado/editado em Supabase: não é apagado no revert — só para de
  aparecer na tela se o usuário também trocar pra "Local"; continua em
  `public.projects`, reaparece assim que o seletor volta pra "supabase".
- **Nenhuma direção do rollback nível 1 perde dado** — pior caso é perda
  de visibilidade temporária, sempre reversível.

**Nota (G29):** `kora.projects.supabaseWrite.enabled=false`, **sozinha**,
NÃO bloqueia escrita em modo Supabase — é o `dataSource=local` desta
combinação que faz a tela parar de escrever na nuvem (o CRUD em modo
Supabase simplesmente não roda quando a fonte é local). A flag por si só
só desliga o espelho local→nuvem (padrão G22) — nunca prometer, em
nenhum texto operacional, que "flag false" isoladamente bloqueia escrita
na nuvem (ver Caso 2, §3.2, emendado).

### 2.4 Rollback nível 2 — revert de código

Só se o nível 1 não for suficiente (bug fora do alcance das flags — ex.:
erro na tradução de status O12 gravando dado errado independente do
default). Ao contrário do precedente de `quotes` (que só descreveu o
conceito, sem comando literal), aqui fica explícito:

```bash
git revert <hash-do(s)-commit(s)-de-flip-da-Fase-C> --no-edit
git push origin main
```
**Hash de referência (baseline, não o commit do flip em si):** `d90ba47`
— é o merge da Fase B, confirmado por `git log` como ancestral de `main`
(tip `395a432` no momento desta rodada). É o estado "tudo pronto, defaults
ainda não flipados" — o(s) commit(s) da Fase C nascem em cima dele. Nível
2 reverte especificamente o(s) commit(s) que a Fase C adicionar **depois**
de `d90ba47`, nunca por citação — confirmar o hash exato do commit de flip
por `git log` no relatório daquela rodada, quando ela acontecer. O revert
de nível 2 mantém a Fase B intacta (CRUD/schema/dual-write já em produção
não são tocados) — reverte só os 2 defaults.

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

Mesmo padrão de nomeação de `quotes` (prefixo `HOMOLOG-FLIP-`). **Workspace
de QA: a confirmar com o operador na abertura da Fase D** — Code não tem
como verificar qual workspace é o padrão de QA vigente sem acesso a
banco/sessão autenticada (protocolo §0/§6); não presumir o id usado nas
rodadas de `quotes`/CRM sem essa confirmação explícita.

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

**Caso 2 — Prova da semântica real da flag (emendado pelo G29)**

> **Nota de correção:** a expectativa original deste caso ("override
> `false` → escrita bloqueada com toast") vinha do desenho da Fase A,
> antes do CRUD real em modo Supabase existir. **G29**
> (`kora-hub-auditoria-e-plano.md`) confirmou contra o código real
> (`useSupabaseProjects.ts` — `createProject`/`updateProject`) que
> `kora.projects.supabaseWrite.enabled` **nunca gateou o CRUD direto em
> modo Supabase**, nos dois sentidos — só `!workspace` bloqueia. A flag é,
> por desenho documentado no próprio hook, o gate do **ESPELHO** em modo
> **local** (padrão G22) — não um interruptor de escrita em modo nuvem.
> Este caso agora prova a semântica real, não a antiga.

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 2.1 | Console: `localStorage.setItem("kora.projects.supabaseWrite.enabled", "false");` → F5 (dataSource continua supabase) | Tela ainda lê da nuvem (leitura não depende dessa flag); badge/banner mostram "Modo operacional"/"Projetos operacionais (Supabase)" — nunca "modo leitura" (prova visual do fix do G29) | Visual — badge/banner |
| 2.2 | Editar `HOMOLOG-FLIP-projeto-A` (mudar status ou marcar entregável) | **Edição FUNCIONA** — não bloqueia, nenhum toast de erro/bloqueio | Visual — mudança reflete na tela |
| 2.3 | — | Update foi gravado no banco de verdade, apesar da flag `false` | `SELECT status, updated_at FROM public.projects WHERE title = 'HOMOLOG-FLIP-projeto-A';` → valores **diferentes** do caso 1 (mudaram), confirmando que a flag não bloqueou nada |
| 2.4 | Console: `localStorage.removeItem("kora.projects.supabaseWrite.enabled");` → F5 | Limpeza — volta ao estado de usuário novo pra esta chave | Visual |

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
| 4.6 | **Prova O12 — o caso que esta fatia existe pra fechar** | `status` grava valor neutro **E** `archived = true` na mesma linha | `SELECT status, archived FROM public.projects WHERE title = 'HOMOLOG-FLIP-projeto-A';` → **`status = 'planning'`, `archived = true`** — confirmado no código real (`translateLocalProjectStatusToCloud`, `src/services/projects/projectsMapper.ts:97-102`: `if (status === "archived") return { status: "planning", archived: true };`), não mais só o desenho da Fase A |

**Este caso é vermelho automático se o passo 4.6 não bater** — é
literalmente o achado que motivou a fatia (O12), não uma ressalva
aceitável.

---

**Caso 5 — Os 5 consumidores migrados**

Cobre, em sub-passos, exatamente os 5 itens classificados `(a) precisa
migrar` na Fase A do pacote (`etapa-5-flip-projetos-pacote.md` §1):
Central do Dia, `QuoteToProjectDialog` (Vendas), `ClientProfileDrawer`,
`ClientActivitiesTab`, `ClientActivityLogDialog`.

**Mecanismo real, confirmado contra `main` pós-Fase-B (não mais desenho):**
4 dos 5 consumidores foram migrados via um hook novo e compartilhado,
`useBifurcatedProjects()` (`src/hooks/useBifurcatedProjects.ts:27`,
read-only por design — combina `useProjects()` local +
`useSupabaseProjectsSummary()` + `mapSupabaseProjectToLocal`, resolve por
`getProjectsDataSource()`, mesmo padrão da tela principal). O 5º
(`QuoteToProjectDialog`) **não** usa esse hook — ver 5.2 abaixo, mecanismo
diferente por ser um fluxo de criação, não de exibição contínua.

| Passo | Consumidor | Ação | Esperado | Prova |
|---|---|---|---|---|
| 5.1 | Setup | Criar `HOMOLOG-FLIP-quote` (aprovada) vinculada a `HOMOLOG-FLIP-cliente`, ambos em modo Supabase | Quote/cliente existem na nuvem | Visual |
| 5.2 | **`QuoteToProjectDialog.tsx`** (Vendas → "Gerar projeto") — **o mais crítico (R5)** — mecanismo: `addProject` local (`:99`, sempre autoritativo) **+** espelho best-effort `mirrorProjectToSupabase` (`:168`), gated por `isSupabaseProjectsWriteEnabled()` (`:167`) — mesmo padrão G22, **não** `useBifurcatedProjects` | A partir de `HOMOLOG-FLIP-quote` aprovada, clicar "Gerar projeto" → nomear `HOMOLOG-FLIP-projeto-B` | Projeto grava local imediatamente **e** dispara o espelho em paralelo — **não é garantidamente instantâneo na tela principal** (best-effort, pode falhar/atrasar; se falhar, toast avisa "espelho falhou, rode a importação manual"). Esperar propagação e conferir toast antes de marcar vermelho — não é o mesmo tipo de "imediato" do caso 1 (escrita direta via `useSupabaseProjects`) | Visual — projeto na lista (após propagação) + `SELECT * FROM public.projects WHERE title = 'HOMOLOG-FLIP-projeto-B';` → 1 linha. Se não aparecer, checar toast de falha do espelho antes de abrir vermelho |
| 5.3 | **Central do Dia** — `useDayCenterData.ts:27` (`useBifurcatedProjects()`, import `:6`) | Definir `dueDate` de `HOMOLOG-FLIP-projeto-B` no passado (simular atraso), abrir Central do Dia | Item de atenção "projeto atrasado" aparece, referenciando o projeto da NUVEM (não um projeto local fantasma) | Visual — card na Central do Dia |
| 5.4 | **`ClientProfileDrawer.tsx:912`** (aba "Projetos" da ficha, `useBifurcatedProjects()`, import `:45`) | Abrir ficha de `HOMOLOG-FLIP-cliente` → aba Projetos | `HOMOLOG-FLIP-projeto-B` aparece na lista | Visual |
| 5.5 | **`ClientActivitiesTab.tsx:431`** (timeline, `useBifurcatedProjects()`, import `:20`) | Mesma ficha → aba Atividades | Evento relacionado ao projeto aparece na timeline | Visual |
| 5.6 | **`ClientActivityLogDialog.tsx:37`** (registrar atividade manual, `useBifurcatedProjects()`, import `:18`) | Mesma ficha → "Registrar atividade" → selecionar projeto no dropdown | `HOMOLOG-FLIP-projeto-B` aparece como opção selecionável | Visual — dropdown populado |

**Escrita real (`updateProject`) confirmada em `src/hooks/useSupabaseProjects.ts:33`**,
consumida por `ProjectsSection.tsx:55` (tela principal) e
`ProjectDetailDrawer.tsx:86` (`updateProject: updateSupabaseProject`,
usado no caso 4) — os 4 consumidores read-only acima nunca escrevem,
por design (comentário do próprio hook: "estes consumidores só
EXIBEM/REFERENCIAM, nunca criam/editam").

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

- Não executa nenhum caso — é preparação, Fase C ainda não existe (só a
  Fase B, CRUD/leitura, está em `main`).
- Não decide o workspace de QA a usar — fica como pergunta explícita ao
  operador na abertura da Fase D (§3.1).
- Não substitui os gates permanentes do protocolo (EXPORT MANUAL, PRINT
  PRÉ-CLIQUE, prova de servidor §17) — só aponta onde cada um entra nesta
  fatia especificamente.
- Não cita o hash do commit de flip da Fase C — não existe ainda; §2.4
  registra `d90ba47` como baseline, não como o commit a reverter.

**Atualização desta rodada:** todos os `[completar pós-B]` da versão
anterior foram resolvidos contra o código real mesclado (`d90ba47`/`fbdea18`)
— nomes de hook, arquivo:linha e o valor exato do fix do O12, todos
confirmados por leitura direta do código em `main`, não mais por citação
do desenho da Fase A.

**PARADO aqui — este runbook segue sendo preparação. Execução real da
Fase C (flip) e Fase D (homologação) só com um novo "vai" que autorize
especificamente abrir a Fase C.**
