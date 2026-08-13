# Etapa 5 — G1/Projetos — Pacote do Flip — Fase A (diagnóstico de prontidão)

> Zero mudança de código nesta fase. Mesmo molde do Pacote do Flip de `quotes`
> ([`etapa-5-flip-quotes.md`](etapa-5-flip-quotes.md)) — este doc é o
> equivalente pra `projects`, fatia N+1 depois de `etapa-5-flip-projetos`
> (fatia N, já mesclada em `main`, commit `208ff9c`).

## Abertura (§16/§17)

- Worktree: `Kora-laneA`.
- Branch nova: `etapa-5-flip-projetos-pacote`, criada a partir de `origin/main`.
- Hash confirmado por `git log origin/main -1 --oneline`: **`6022d0f`**
  (`merge: Etapa 6 item 4 - campaign-sender decisao (c)+reaper (G24/G25)`) —
  bate com o esperado.
- **Nota operacional (transparência, não incidente):** o primeiro comando
  (`git checkout main`) falhou corretamente (main já checked-out em
  `orbit-designer-hub`, restrição do git). O comando seguinte
  (`git pull origin main --ff-only`), rodado sem perceber que ainda estava
  em `etapa-5-flip-projetos`, fez fast-forward da ref LOCAL dessa branch
  (já mesclada) de `208ff9c` pra `6022d0f`. **Sem impacto real:** é só a
  ref local, `origin/etapa-5-flip-projetos` continua em `208ff9c` (não
  pushado), e `208ff9c` já é ancestral de `6022d0f` (a branch já estava
  mesclada) — nenhum commit foi perdido ou reescrito. Registrado por
  disciplina de transparência, não por ter causado dano.
- **Contexto confirmado:** DDL da fatia N aplicada em produção nesta sessão
  (coluna `deliverables jsonb` + CHECK de status com 8 valores, kit 3/3
  verde) — reportado pelo operador, fora do alcance do Code (§0/§6 do
  protocolo, Code não acessa banco).
- **Paralelismo com LANE B:** `orbit-designer-hub-qualidade-lint` está em
  `qualidade-lint-o11`, workspace isolado, sem conflito.

---

## 1. Re-inventário dos consumidores fora da tela principal

**Correção ao relatório da fatia N:** eram **8** arquivos, não 9 — contei
errado no relatório do item 2 daquela fatia. Recontado agora por grep
(`useProjects()`, 11 ocorrências totais − o próprio hook − os 2 da tela
principal = 8).

| # | Arquivo | O que lê | Classificação | Por quê |
|---|---|---|---|---|
| 1 | `useDayCenterData.ts` (Central do Dia) | `projects` pra gerar itens de atenção "projeto atrasado" (`dayCenter.ts:415-417`, ignora `delivered/cancelled/archived/paused`) | **(a) precisa migrar** | Widget de destaque na home. Pós-flip, ficaria comparando prazo de projetos LOCAIS (possivelmente vazios/obsoletos) enquanto a tela principal mostra projetos da nuvem — alertas errados (falso positivo ou falso negativo de atraso), quebra de confiança no widget. |
| 2 | `QuoteToProjectDialog.tsx` (Vendas, "Gerar projeto") | Só escreve (`addProject`, sempre local, sem flag) | **(a) precisa migrar — MAIS CRÍTICO** | É um caminho de CRIAÇÃO ativo em produção, sem flag na frente. Se ficar 100% local depois que a tela principal virar Supabase-default, o projeto criado **desaparece da visão do usuário imediatamente após criar** — pior que uma divergência de leitura, é uma ilusão de perda de dado. |
| 3 | `ClientProfileDrawer.tsx` (aba "Projetos" da ficha do cliente) | `projects.filter(p => p.clientId === client.id \|\| p.clientName === client.name)` | **(a) precisa migrar** | Aba visível, ativamente checada pelo usuário ao abrir a ficha de um cliente. Ficaria vazia para clientes com projetos só na nuvem. |
| 4 | `ClientActivitiesTab.tsx` (timeline de atividades do cliente) | Mesmo filtro acima, usado pra listar eventos de projeto na timeline | **(a) precisa migrar** | Mesma classe do #3 — timeline ficaria incompleta. |
| 5 | `ClientActivityLogDialog.tsx` (registrar atividade manual) | Mesmo filtro, usado pra o usuário escolher um projeto ao logar uma atividade | **(a) precisa migrar** | Sem isso, impossível vincular uma atividade manual a um projeto que só existe na nuvem. |
| 6 | `KoraOnboarding.tsx` (checklist de onboarding) | `projects.some(p => !p.isDemo && p.quoteId)` — só um boolean pro passo 5 ("gerar recebível ou projeto") | **(b) pode ficar local com aviso** | Sinal informativo, baixo-stakes, de um fluxo de onboarding (tipicamente já concluído/dispensado por usuários com dado real). Pior caso: checklist marca passo 5 como pendente mesmo o usuário já tendo feito — cosmético, não bloqueia nada. |
| 7 | `CreateProjectFromQuoteDialog.tsx` (CRM, já G22 dual-write) | Escreve local + espelha nuvem (best-effort), já com toast de aviso se o espelho falhar | **(c) indiferente** | Já é dual-write desde antes desta fatia (G22). O projeto aparece na nuvem por padrão; se o espelho falhar, o toast já existente ("rode a importação manual") é o fallback — nenhuma mudança necessária pro flip. |
| 8 | `useLocalProjectsImport.ts` (ferramenta de import assistido) | Lê local por natureza — é o próprio mecanismo de migração local→nuvem | **(c) indiferente** | Não é um "consumidor" no sentido de UI que mostra dado — é a ferramenta que resolve a divergência dos outros. Comportamento correto independente do default. |

**Resumo:** 5×(a) precisam migrar, 1×(b) aviso aceitável, 2×(c) já corretos.
Os 5 casos (a) são o núcleo do trabalho de código da Fase B desta fatia —
provavelmente convergem para o MESMO padrão já usado na tela principal
(useProjects() local + useSupabaseProjects-equivalente + merge/gate por
`dataSource`), não 5 soluções diferentes.

---

## 2. Plano de import assistido pré-flip

**Precedente direto — Pacote do Flip de `quotes` (§1.4, risco 1):**

> "Import local pós-flip... risco real: um workspace com quotes locais
> reais, nunca importadas, que ganha leitura+escrita-padrão em Supabase,
> passa a criar dado novo do lado errado enquanto o antigo fica invisível
> (não perdido). Recomendação: o import vira **pré-condição de runbook,
> não de código** — medir o local (reais, não-demo) antes da Fase C, e
> rodar o import se houver alguma não-mapeada."

Proponho o **mesmo tratamento** para `projects` — não é um gap de código,
é uma pré-condição operacional:

- **Ferramenta já existe e já cobre isso:** `LocalProjectsImportCard.tsx`
  (Configurações → "Importar projetos locais") → `useLocalProjectsImport.ts`
  — analisa `orbyt.projects.v1` local, classifica `new`/`imported` contra
  `kora.projects.supabaseImport.v1.importedMap`, sinaliza órfãos de FK
  (cliente/quote/oportunidade não mapeados), importa via
  `projectsRepository.importProject` (mesmo arbiter `source_local_id` que
  o espelho best-effort da fatia N usa — os dois caminhos já são
  consistentes entre si, confirmado nos testes de `projectsCloudMirror.test.ts`).
- **Volume real do operador: desconhecido — a confirmar com o operador**
  antes da Fase C. Code não acessa `localStorage` do navegador do operador
  (protocolo §0/§6). Pergunta específica pro runbook: "quantos projetos
  reais (não-demo) existem em `orbyt.projects.v1`, e quantos já aparecem em
  `kora.projects.supabaseImport.v1.importedMap`?"
- **Passo do runbook (Fase C, antes de flipar `dataSource`):**
  1. Operador abre Configurações → "Importar projetos locais".
  2. Se `candidates` tiver algum item `status: "new"` que NÃO seja demo,
     revisar órfãos de FK (cliente/quote/oportunidade não vinculado —
     sobe com o campo nulo, dado textual preservado) e importar.
  3. Só depois de importar (ou confirmar que não há nada a importar),
     prosseguir pra flipar os defaults.
- **Diferença de `quotes`:** lá o import já estava homologado desde a
  Fatia 10 (item 9). Pra `projects`, o import (`useLocalProjectsImport.ts`)
  foi construído na Fatia 7 mas **nunca homologado numa rodada de
  homologação de verdade** (Fatia 7 foi diagnóstico + schema, não B.3) —
  vale considerar homologar o import explicitamente como parte da Fase D
  desta fatia, não assumir que "existe" é o mesmo que "provado".

---

## 3. CRUD completo em modo Supabase — desenho

Hoje (fatia N), `ProjectDetailDrawer.tsx` bloqueia TODA escrita quando
`dataSource === "supabase"` (`blockWrite()`) — correto para uma fatia que
só entregava leitura. O flip exige que editar um projeto lido da nuvem
funcione de verdade.

### 3.1 O que falta no repository

`projectsRepository.ts` hoje tem `createProjectFromQuote`,
`softDeleteProject` (morto, O9), `listProjects`, `importProject` (upsert
por `source_local_id`) — **falta um `updateProject(workspaceId, projectId, patch)`**
que faça `UPDATE ... WHERE id = projectId AND workspace_id = workspaceId`
direto, pra editar uma linha já existente identificada pelo próprio uuid
(não pelo `source_local_id, que é o arbiter de importação, não de edição
pontual).

### 3.2 Tradução de status na escrita — resolve O12 nesta fatia

`mapLocalProjectToSupabase` hoje grava `status: project.status` verbatim
e `archived: false` hardcoded (O12). Proposta — mesma mecânica de
`translateLocalStatusToCloud` (`quoteMapper.ts`, Q9):

```ts
function translateLocalProjectStatusToCloud(status: ProjectStatus): { status: string; archived: boolean } {
  if (status === "archived") return { status: "planning", archived: true };
  return { status, archived: false };
}
```

- Local `"archived"` → texto neutro (`"planning"`, mesma escolha de
  fallback já usada na leitura) + `archived: true` — daqui pra frente,
  **novo** dado sai correto dos dois lados.
- Os outros 6 valores locais já são literais válidos do CHECK (aplicado
  na fatia N) — passagem direta, sem tradução.
- **Não migra dado legado:** linhas já gravadas por caminhos anteriores
  (import geral antes desta correção, `createProjectFromQuote` com
  `'active'`) continuam como estão — o mapper de LEITURA
  (`translateCloudProjectStatusToLocal`) já cobre os dois formatos
  (boolean OU texto `'archived'`), então não há regressão de leitura pra
  dado antigo. Só a escrita NOVA fica limpa.
- Afeta 3 chamadores: `mapLocalProjectToSupabase` é usado por
  `useLocalProjectsImport.ts` (import geral), `projectsCloudMirror.ts`
  (espelho best-effort da fatia N) e o novo `updateProject` desta fatia —
  os 3 ficam consistentes automaticamente, é uma correção no mapper, não
  em cada chamador.

### 3.3 Exclusão — parity real, não feature nova

**Achado importante:** `deleteProject` (hook local, `useProjects.ts:124-126`)
**não tem nenhum caller na UI hoje** — nem para projetos locais existe um
botão "excluir projeto". `softDeleteProject` (repository, nuvem) está no
mesmo estado — código morto, O9.

Proposta: **não inventar uma feature de exclusão que não existe hoje** só
porque o flip está em andamento — isso seria escopo a mais, não paridade.
O que a fatia deve entregar é a REPOSITORY pronta (`softDeleteProject` já
está pronta, só precisa ser chamada) — se uma fatia futura adicionar um
botão "excluir" na UI (local e nuvem juntos), a peça de nuvem já existe.
Resolve O9 como efeito colateral (deixa de ser código morto no dia em que
alguém chamar), sem forçar essa UI a nascer nesta fatia.

### 3.4 `deliverables` na escrita em modo Supabase

Coluna já existe em produção (DDL aplicada). `setDeliverableStatus`
(`ProjectDetailDrawer.tsx`) precisa, em modo Supabase, chamar o novo
`updateProject` com `{ deliverables: next }` — sem tradução de formato
(mesmo array `ProjectDeliverable[]`, jsonb aceita direto). `progress`
continua sendo sempre DERIVADO (não existe coluna `progress` na nuvem,
achado da Fase A da fatia N) — o cálculo já existe no mapper de leitura
(`mapSupabaseProjectToLocal`), só precisa ser recalculado depois do
`update` (ou lido de volta via `refresh()`/invalidação de query).

---

## 4. Sequência de flip proposta

### 4.1 Ordem dos defaults

**Não flipar `dataSource` antes do CRUD estar pronto** — se flipar a
leitura primeiro, todo usuário cai em `blockWrite()` até o código de
escrita chegar, uma regressão temporária desnecessária. Ordem correta:

1. **Fase B (código):** `updateProject` no repository, tradução de status
   corrigida (O12), `setDeliverableStatus`/`handleStatus` chamando
   `updateProject` real em modo Supabase (substitui `blockWrite()`), os
   5 consumidores (a) migrados pro padrão bifurcado. `tsc`/lint/testes
   verdes, PARA pra aprovação de design (mesmo padrão da fatia N).
2. **Fase C (flip dos defaults):** `dataSource` → `supabase` E
   `supabaseWrite` → opt-out (default ON), **no mesmo pacote**, mesmo
   precedente de `quotes` (flipou os dois juntos, não em 2 rodadas
   separadas — motivo registrado lá: "o cutover completo decide os dois
   juntos").
3. **Fase D (homologação B.3):** runbook caso a caso, print por caso
   (ver §4.2).

### 4.2 `supabaseWrite` — não fica obsoleta, vira o lever de rollback

Precedente de `quotes`/CRM: a flag **não é retirada** no flip — muda de
opt-in (default OFF) pra opt-out (default ON), e continua existindo como
override manual. Mesmo tratamento proposto aqui: `kora.projects.supabaseWrite.enabled`
sobrevive ao flip, só troca o default. É o mecanismo de rollback mais
rápido (ver §4.4).

### 4.3 Plano de homologação B.3 (esqueleto — detalhamento fica pra Fase C)

Mesmo molde do runbook de `quotes` (§5.2 daquele doc) — cenário sintético
(`HOMOLOG-FLIP-projeto`, cliente/quote sintéticos próprios, emenda §11),
print pré-clique por caso (§2 do protocolo):

| Caso | O quê | Prova esperada |
|---|---|---|
| Usuário novo | `localStorage` limpo → F5 → criar projeto | Seletor já em "Supabase", badge operacional, projeto aparece na lista, SQL confirma linha |
| Override negativo sobrevive | `supabaseWrite=false` manual → tentar editar | Bloqueia com toast explícito, nada muda no banco |
| Override de dataSource | `dataSource=local` manual → F5 | Mostra local intacto, zero chamada de rede |
| Edição real (create→update→archive) | Criar, mudar status, marcar entregável, arquivar | Cada transição reflete no banco; `archived` vira `true` + status neutro (prova O12) |
| Central do Dia + ficha do cliente | Projeto atrasado sintético | Aparece em ambos, não só na tela principal (prova dos 5 consumidores migrados) |
| Import pré-existente | Rodar import de um projeto local antes do flip | Aparece na tela sem duplicar após o flip |
| Limpeza | Soft-delete/arquivar cenário sintético | Resíduo zero, SQL confirma |

### 4.4 Critérios de rollback

1. **Nível 1 (imediato, sem código):** `kora.projects.dataSource.v1=local`
   + `kora.projects.supabaseWrite.enabled=false` via console/hotfix de
   configuração — mesma garantia que os overrides de flag sempre têm
   precedência sobre o default (P5 do protocolo).
2. **Nível 2 (revert de código):** só se o Nível 1 não for suficiente
   (ex.: bug fora do controle das flags) — `git revert` do commit de
   flip, mantendo a fatia N (schema/dual-write) intacta.
3. **Critério de acionamento:** qualquer caso do runbook B.3 vermelho sem
   correção rápida (mesmo padrão de "marco vermelho para tudo" do §8),
   ou relato do operador de projeto sumido/duplicado em uso real.

---

## 5. Riscos e estimativa

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| R1 | 5 consumidores fora da tela principal precisam do mesmo padrão de bifurcação — mais superfície de código que a fatia N | Média | Padrão já provado (mapper, hook, dataSource) — replicar, não inventar |
| R2 | Volume de dado local real do operador desconhecido | Média | Import vira pré-condição de runbook (§2), não bloqueia o código |
| R3 | O12 (tradução de status na escrita) precisa ficar correta antes do flip, senão gera MAIS dado divergente (não menos) | Alta | Endereçado no design (§3.2), testável isoladamente (mapper) antes de tocar UI |
| R4 | Import do `useLocalProjectsImport.ts` nunca foi homologado numa rodada B.3 de verdade (só construído na Fatia 7) | Média | Homologar explicitamente na Fase D desta fatia, não assumir |
| R5 | `QuoteToProjectDialog.tsx` (Vendas) é o consumidor mais crítico (#2) — projeto criado lá fica invisível se não migrar | Alta | Prioridade #1 da Fase B de código |
| R6 | Painel órfão `SupabaseOperationalDashboardCard` nunca foi validado em produção real (achado da Fase A da fatia N) — não contar com ele como cobertura | Baixa | Já registrado, sem mudança de plano |

**Estimativa:** 1 fatia (Fase B código + Fase C flip + Fase D homologação),
comparável em escopo ao Pacote do Flip de `quotes` — a diferença é a
superfície maior de consumidores (5 vs. nenhum adicional em quotes) e o
CRUD completo precisar ser construído do zero (quotes já tinha escrita
desde a Fatia 10; aqui a fatia N só entregou leitura).

---

## Referências

- [`etapa-5-flip-quotes.md`](etapa-5-flip-quotes.md) — template completo do
  padrão de flip, precedente direto para risco de import (§1.4) e ordem
  dos defaults (§1.3).
- [`etapa-5-flip-projetos.md`](etapa-5-flip-projetos.md) — fatia N (schema,
  leitura bifurcada, dual-write G22), já mesclada (`208ff9c`).
- `docs/architecture/kora-hub-auditoria-e-plano.md` — O9 (softDeleteProject
  morto), O10 (alias `active`), O11 (fixture de data), O12 (archived
  boolean não traduzido) — O10 e O12 resolvidos juntos nesta fatia (§3.2).

**PARADO aqui — Fase B (código) só com novo "vai" do revisor.**
