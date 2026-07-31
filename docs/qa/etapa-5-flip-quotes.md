# Etapa 5 · Pacote do Flip — quotes (Fase A+B combinadas)

> **Escopo desta rodada: LEVANTAMENTO + DESIGN, num doc só** (autorizado explicitamente pelo
> revisor, dado o tamanho reduzido do pacote). Nenhum código alterado, nenhuma migration escrita
> — confirmado abaixo (§0) que esta fatia é **localStorage only**. PARAR ao final — Fase C só com
> novo "vai".

Referências diretas: [`etapa-5-fatia-10-quotes-write.md`](etapa-5-fatia-10-quotes-write.md)
(cutover de escrita — Fase B §5/§8.1, decisão original do flip como "pacote próprio");
[`etapa-5-fatia-8-crm-cutover.md`](etapa-5-fatia-8-crm-cutover.md) §6 (o mesmo tipo de flip,
já executado pra `opportunities` — molde direto pra este doc, citado seção a seção abaixo).

Worktree: `Kora-laneA`, branch nova `etapa-5-flip-quotes`, criada a partir de `origin/main`
@ `baf7b87` (confirmado — hash esperado pelo revisor).

---

## 0. Confirmação — zero DDL neste pacote

Levantamento completo (abaixo) confirma: as duas mudanças de default (`dataSource`,
`supabaseWrite.enabled`) e a retirada de 2 das 4 flags legadas são **inteiramente client-side**
— constantes de string em `config/flags.ts`/`useSupabaseQuotesWriteFlag.ts`, sem nenhuma tabela,
coluna ou RPC envolvida. **Nenhuma migration nesta fatia.**

---

## 1. Levantamento (Fase A)

### 1.1 Inventário de consumidores — as 4 flags legadas granulares

| Flag (`BOOLEAN_FLAG_KEYS`) | Chave localStorage | Consumidores reais (grep exaustivo) | Escreve de verdade na nuvem hoje? |
|---|---|---|---|
| `quotesSupabaseExperimental` | `kora.quotes.supabaseExperimental.enabled` | `SupabaseQuotesViewerCard.tsx` (gate de renderização do card inteiro — `experimentalEnabled`), `QuotesSupabaseExperimentalToggleCard.tsx` (o toggle) | Não escreve nada por si — só decide se o card de LEITURA/aprovação aparece |
| `quotesSupabaseApproval` | `kora.quotes.supabaseApproval.enabled` | `useSupabaseQuotesWriteFlag.ts` (`isQuotesApprovalReachable()` — `masterFlag \|\| legacyFlag`), `QuotesSupabaseApprovalToggleCard.tsx` (o toggle) | Não mais, desde a Fatia 10 — só serve de fallback OR pra quem já tinha ela ligada antes do master flag existir (coexistência §8.1 da Fatia 10) |
| `quotesSupabaseCreateProject` | `kora.quotes.supabaseCreateProject.enabled` | `LinkedQuotesSection.tsx`/`SupabaseQuotesViewerCard.tsx` (`handleCreateProjectClick` — abre `CreateProjectFromQuoteDialog`), `QuotesSupabaseProjectToggleCard.tsx` (o toggle) | **Sim, mas só local** — `CreateProjectFromQuoteDialog.tsx` grava em `orbyt.projects.v1`/`orbyt.tasks.v1`, nunca em Supabase (decisão F5-b, Fatia 6/7, "desativado até o cutover de leitura de projects") |
| `quotesSupabaseCreateReceivable` | `kora.quotes.supabaseCreateReceivable.enabled` | `LinkedQuotesSection.tsx`/`SupabaseQuotesViewerCard.tsx` (`handleCreateReceivableClick` — abre `CreateReceivableDialog`), `QuotesSupabaseReceivableToggleCard.tsx` (o toggle) | **Sim, mas só local** — mesma situação, grava em `orbyt.finance.v1` (decisão F5-b, Fatia 6) |

**Achado central:** as 4 flags NÃO são equivalentes entre si. `Experimental` e `Approval` são
puramente do domínio `quotes` — uma vez que o master flag (`kora.quotes.supabaseWrite.enabled`)
cobre o ciclo de vida inteiro da própria quote (criar/status/duplicar/excluir/aprovar), as duas
ficam genuinamente redundantes. `CreateProject`/`CreateReceivable` gateiam a **disponibilidade
de um diálogo cujo destino de escrita é outro domínio** (`projects`/`finance`), ainda não
cortado — retirá-las agora tornaria "Gerar recebível"/"Gerar projeto" sempre alcançável nas 2
telas migradas, **adiantando** uma decisão que pertence às fatias de cutover de
`finance`/`projects` (mesmo raciocínio da Fase A §4 da Fatia 10, que já recusou reconciliar as
2 famílias cruzadas ali).

### 1.2 `dataSource` — consumidor único

`getQuotesDataSource()`/`QUOTES_DATA_SOURCE_KEY` (`config/flags.ts`) tem exatamente **um**
consumidor real: `QuotesSection.tsx` (`useState(() => getQuotesDataSource())`). Sem consumidores
escondidos em outras telas — confirmado por grep. Padrão idêntico ao de `getCrmDataSource()`
(`config/flags.ts:150-151`), que já é `safeGet(KEY) === "local" ? "local" : "supabase"` —
molde direto pro flip do item 3.1.

### 1.3 Precedente direto — Fatia 8 (CRM), mesma mecânica já executada

`useSupabaseCrmWriteFlag.ts` já documenta, no próprio cabeçalho, a exceção consciente ao
"CONTRATO DE PRESERVAÇÃO DE COMPORTAMENTO" (Etapa 4a) pra flipar um default: `!== "false"`
(opt-out, default `true`), com a nota "sessões que já têm o valor gravado não são afetadas — só
quem nunca tocou na flag herda o novo default". **Esta é a mesma mudança, no mesmo domínio de
problema, que este pacote replica pra `quotes`** — não é preciso reinventar a mecânica.

**Diferença importante a registrar:** no flip do CRM (Fatia 8, §6.0), o lado de **leitura** já
estava silenciosamente flipado pra "supabase" default ANTES daquela fatia — Fatia 8 só precisou
flipar a **escrita**. Em `quotes`, o seletor de leitura (`kora.quotes.dataSource.v1`) ainda tem
default `"local"` (decisão deliberada da Fatia 9) — **este pacote flipa os DOIS ao mesmo tempo**
(leitura e escrita), exatamente como a Fase A §5 da Fatia 10 já havia previsto ("o cutover
completo decide os dois juntos"). Superfície de homologação um pouco maior que a do CRM: aqui
ambos os defaults mudam na mesma rodada.

### 1.4 Riscos mapeados

1. **Import local pós-flip (mesmo padrão do §6.3 da Fatia 8):** `useLocalQuotesImport.ts` já
   homologado (Fatia 10, item 9 + Fase D caso 8). Continua fazendo sentido de existir — é o único
   caminho pra migrar quotes locais residuais pra nuvem, e é ortogonal ao default de leitura (um
   usuário pode ter quotes locais não-importadas independente de qual fonte a tela mostra por
   padrão). **Risco real:** um workspace com quotes locais reais, nunca importadas, que ganha
   leitura+escrita-padrão em Supabase, passa a criar dado novo do lado errado enquanto o antigo
   fica invisível (não perdido). **Recomendação, igual ao §6.3:** o import vira **pré-condição de
   runbook, não de código** — medir `orbyt.quotes.v1` local (reais, não-demo) antes da Fase C, e
   rodar o import se houver alguma não-mapeada em `kora.quotes.supabaseImport.v1.importedMap`.
2. **Usuário com valor explícito já gravado:** ambos os flips (dataSource, write flag) preservam
   override — só quem NUNCA tocou herda o novo default. Não é uma migração de chave, é a
   semântica normal de "ausência ⇒ novo default, presença ⇒ respeita o que já está lá" — mesma
   garantia que o CRM já opera desde a Fatia 8.
3. **`quotesSupabaseApproval` legada, já ligada por alguém:** irrelevante após a retirada — o
   master flag (agora default ON) já alcança aprovação sozinho; ninguém perde capacidade.
4. **`quotesSupabaseExperimental` legada, já DESLIGADA por alguém deliberadamente:** único caso
   com uma mudança de comportamento observável e aceita conscientemente — ver §2.2.
5. **Bridge de re-link:** diferente do CRM (`Lead.supabaseId`, §6.4 do molde), `Quote` local não
   carrega um campo de ponte embutido — o vínculo vive inteiramente em
   `kora.quotes.supabaseImport.v1.importedMap` (localStorage). Este pacote **não toca** nessa
   chave — preservação automática, mas registrada aqui pra não ser esquecida numa limpeza futura.
6. **Paridade de schema (equivalente ao O1 do CRM):** já resolvida nas Fatias 9/10 (Q8, 6 campos)
   — nenhum gap de campo conhecido pendente para `quotes` neste pacote.
7. **Textos de banner/toast:** revisados (§2.3) — **nenhuma mudança de código necessária**. O
   banner operacional/leitura de `QuotesSection.tsx` já é condicional a
   `isSupabaseQuotesWriteEnabled()`; o flip só muda qual branch é o comum. Precedente direto:
   `CRM.tsx` (já flipado desde a Fatia 8) **mantém** o texto "Supabase experimental" no botão do
   seletor e no toast de troca de fonte até hoje — não há convenção de renomear terminologia no
   momento do flip.

---

## 2. Decisões (Fase B)

### 2.1 Flip dos defaults

**`kora.quotes.dataSource.v1`** (`config/flags.ts`, `getQuotesDataSource()`):
```ts
// Antes (Fatia 9): só "supabase" explícito seleciona nuvem; ausência/malformado ⇒ "local".
export function getQuotesDataSource(): DataSource {
  return safeGet(QUOTES_DATA_SOURCE_KEY) === "supabase" ? "supabase" : "local";
}
// Depois (este pacote): só "local" explícito seleciona local; ausência/malformado ⇒ "supabase".
export function getQuotesDataSource(): DataSource {
  return safeGet(QUOTES_DATA_SOURCE_KEY) === "local" ? "local" : "supabase";
}
```
Idêntico, literalmente, ao padrão já em produção de `getCrmDataSource()`. `setQuotesDataSource`
não muda — grava o valor explícito de qualquer forma, em qualquer direção.

**`kora.quotes.supabaseWrite.enabled`** (`useSupabaseQuotesWriteFlag.ts`, `readFlag()`):
```ts
// Antes (Fatia 10): opt-in — só "true" liga.
return localStorage.getItem(QUOTES_SUPABASE_WRITE_FLAG_KEY) === "true";
// Depois (este pacote): opt-out — só "false" desliga.
return localStorage.getItem(QUOTES_SUPABASE_WRITE_FLAG_KEY) !== "false";
```
Idêntico ao padrão de `useSupabaseCrmWriteFlag.ts`. `isQuotesApprovalReachable()` simplifica
junto (§2.2).

**Exceção consciente ao "CONTRATO DE PRESERVAÇÃO DE COMPORTAMENTO"** (mesmo registro que a
Fatia 8 fez para o CRM): esta é uma decisão de produto deliberada de mudar 2 defaults já
existentes, aprovada nominalmente pelo revisor nesta rodada — não uma omissão silenciosa.

### 2.2 Retirada das flags legadas — decisão por flag

- **`quotesSupabaseExperimental` — RETIRA.** `SupabaseQuotesViewerCard.tsx` perde o gate
  `experimentalEnabled` (o `useState`/listener de `storage` inteiro, G15/Fatia 10, sai junto —
  não tem mais flag pra escutar); passa a renderizar sempre que `workspace` existir, mesmo
  comportamento incondicional que `SupabaseOperationalDashboardCard`/demais viewers já teriam
  (quando montados). `QuotesSupabaseExperimentalToggleCard.tsx` sai de `Configuracoes.tsx`
  (mesmo tratamento das 6 flags mortas do CRM, Fatia 8 — o arquivo do componente pode ser
  deletado, a chave antiga fica órfã no localStorage de quem já a tocou, sem migração
  necessária). **Mudança de comportamento observável, aceita conscientemente:** quem tinha essa
  flag desligada deliberadamente deixa de conseguir esconder o card — aceitável porque o
  domínio deixou de ser "experimental" (é o próprio objetivo do flip).
- **`quotesSupabaseApproval` — RETIRA.** `isQuotesApprovalReachable()` simplifica pra
  `return isSupabaseQuotesWriteEnabled();` (a função pode até ser inlinada nos 2 call sites, ou
  mantida como alias fino — decisão de implementação da Fase C, sem impacto de comportamento:
  com o master flag default ON, todo mundo que antes só alcançava via a legada continua
  alcançando via a nova, sem regressão). `QuotesSupabaseApprovalToggleCard.tsx` sai de
  `Configuracoes.tsx`, mesmo tratamento acima.
- **`quotesSupabaseCreateProject` / `quotesSupabaseCreateReceivable` — NÃO RETIRA.** Ficam
  exatamente como estão, com seus próprios toggles em Configurações intactos. Gateiam uma
  funcionalidade cujo destino de escrita real (`projects`/`finance`) segue fora de escopo — a
  decisão de quando essas 2 telas passam a escrever de verdade na nuvem pertence às fatias de
  cutover desses domínios (mesma fronteira já traçada na Fase A §4 da Fatia 10), não a este
  pacote. Retirá-las agora seria confundir "quotes terminou seu próprio flip" com "finance/
  projects também terminaram o deles" — não é o caso.

### 2.3 Textos de banner/toast — revisados, sem mudança de código

Ver achado 7 do §1.4: o banner condicional de `QuotesSection.tsx` já está correto pros dois
estados; o flip só muda qual é o comum. Nenhuma string precisa mudar. Consistente com o
precedente do CRM (`CRM.tsx:769`/`:2044` ainda dizem "Supabase experimental" hoje, pós-flip).

### 2.4 Critério de retirada do que sobra (`dataSource`, seletor "Local", `CreateProject`/
`CreateReceivable`) — registrado, não executado

Mesmo molde do §6.5 da Fatia 8 ("define o critério, não a data"):
1. O seletor `kora.quotes.dataSource.v1` e a opção "Local" continuam disponíveis
   indefinidamente — sem prazo de remoção associado a este pacote. Só fariam sentido sair no dia
   em que `useQuotes()`/`orbyt.quotes.v1` forem de fato apagados (fora de escopo, pode nunca
   acontecer — aceitável, desde que seja decisão consciente, não omissão).
2. `quotesSupabaseCreateProject`/`CreateReceivable` só saem de carência quando uma fatia futura
   de cutover de `finance`/`projects` explicitamente decidir religar `CreateReceivableDialog.tsx`/
   `CreateProjectFromQuoteDialog.tsx` ao caminho nuvem (ver Fase A §4 da Fatia 10) — não antes.

### 2.5 Reversibilidade — runbook de rollback (mesmo molde do §6.6 da Fatia 8)

**O que desligar:** reverter os 2 defaults no código (2 constantes) — **OU**, por workspace
individual, o usuário troca `kora.quotes.dataSource.v1` de volta pra `"local"` via UI, sem
precisar de deploy.

**O que acontece com o dado, em cada direção:**
- **Voltando pra "Local":** `orbyt.quotes.v1` nunca foi tocado enquanto o workspace esteve em
  modo Supabase (os dois hooks rodam em paralelo, só um é lido) — 100% intacto, leitura volta a
  mostrar exatamente o que havia antes.
- **Dado criado em Supabase durante a janela com escrita ligada:** não é apagado ao reverter —
  só some da tela se o usuário também trocar pra "Local" (fica em `public.quotes`, resgatável
  religando o seletor a qualquer momento). Nenhuma direção do rollback perde dado — pior caso é
  perda de visibilidade temporária, sempre reversível.

### 2.6 Plano de itens da Fase C (nomeado)

| Item | O quê | Arquivo(s) |
|---|---|---|
| 1 | Flip `getQuotesDataSource()` (override de "local" explícito) | `config/flags.ts` |
| 2 | Flip `readFlag()` de `useSupabaseQuotesWriteFlag.ts` (opt-out, `!== "false"`) | `useSupabaseQuotesWriteFlag.ts` |
| 3 | Simplificar `isQuotesApprovalReachable()` (drop do OR legado) | `useSupabaseQuotesWriteFlag.ts` |
| 4 | Retirar gate `experimentalEnabled` de `SupabaseQuotesViewerCard.tsx` (sempre renderiza com workspace) | `SupabaseQuotesViewerCard.tsx` |
| 5 | Remover `QuotesSupabaseExperimentalToggleCard`/`QuotesSupabaseApprovalToggleCard` de `Configuracoes.tsx` + deletar os 2 arquivos de componente | `Configuracoes.tsx` + 2 arquivos |
| 6 | Atualizar testes que hoje dependem do estado OFF-por-default (ajustar fixtures/expectativas pro novo default, sem perder cobertura do caminho "explicitamente OFF") | `*.test.tsx` afetados |
| 7 | Doc: registrar os 2 defaults novos como "carência" (§2.4), sem prazo | `etapa-5-flip-quotes.md` |

Gates de saída da Fase C: tsc 0, vitest verde (baseline + novos), lint-gate sem regressão.

---

## 3. Rascunho do runbook de homologação (Fase D — não executar agora)

Seed sintético próprio (`HOMOLOG-FLIP-quotes`), mesmo workspace de teste das fatias anteriores.
Pré-requisito de runbook (não de código, §1.4 achado 1): medir `orbyt.quotes.v1` local do
workspace de teste antes de rodar qualquer caso — se houver quote real não-importada, rodar o
import primeiro.

| # | Caso | Resultado esperado |
|---|---|---|
| 1 | Leitura pós-flip, default (workspace nunca tocou seletor nem flag) | Tela de Orçamentos mostra dados de `public.quotes`, não o array local; badge "Modo operacional" |
| 2 | Criar (escrita ligada por padrão) | Linha nova em `public.quotes` via RPC; `orbyt.quotes.v1` não ganha entrada nova |
| 3 | Transição de status (enviado/aprovado/recusado/arquivar/restaurar) | Grava via `updateStatus`, vocabulário PT no banco |
| 4 | **Caso explícito exigido pelo revisor — foto pendente do fix 5b:** criar quote → marcar como "enviado" → verificar botões Aprovar/Rejeitar visíveis e funcionais nas 2 telas migradas (Configurações e painel CRM) | Botões aparecem e funcionam nas 2 telas para uma quote em "enviado" (prova ao vivo do fix da Pendência 1, Fatia 10 — nunca verificada ao vivo por falta de acesso autenticado na sessão anterior) |
| 5 | Duplicar / soft-delete / re-import pós-delete | Mesmos comportamentos já homologados na Fatia 10 (Fase D), agora sob os novos defaults |
| 6 | `quotesSupabaseExperimental`/`Approval` legadas, órfãs | Alterá-las no localStorage não tem mais efeito nenhum — confirma retirada limpa |
| 7 | `quotesSupabaseCreateProject`/`CreateReceivable`, intactas | Comportamento idêntico ao pré-flip (flag ainda gateia, dialog ainda grava só local) — confirma não-regressão da decisão §2.2 |
| 8 | Rollback (flag OFF ou seletor "Local") | Dado criado nos casos 2-5 continua em `public.quotes` (não some); `orbyt.quotes.v1` continua intacto — prova §2.5 |
| 9 | Import local pré-flip (se aplicável ao workspace de teste) | Import homologa, mesmo runbook da Fatia 10 item 9 |

**Critério de aceite:** 9/9 casos verdes, com o caso 4 obrigatoriamente incluindo prova visual
(screenshot ou descrição explícita) — não pode fechar como "assumido correto" dado que é
justamente a lacuna deixada pela Fatia 10.

---

**PARADO aqui.** Levantamento + design entregues (Fase A+B). Nenhum código alterado, nenhuma
migration escrita — confirmado (§0). Fase C só com novo "vai" do revisor.

---

## 4. Fase C — implementada ("vai" do revisor)

Plano de 7 itens (§2.6) implementado por completo, com as 4 precisões do revisor:

1. **Flip dos defaults** — `getQuotesDataSource()` (`config/flags.ts`) e `readFlag()`
   (`useSupabaseQuotesWriteFlag.ts`) invertidos exatamente como desenhado em §2.1 — override
   explícito preservado nos dois. Teste dedicado cobre os 3 estados por flag (ausente/novo
   default, `"true"` explícito, `"false"` explícito) para ambos.
2. **Retirada de `Experimental`/`Approval`** — `SupabaseQuotesViewerCard.tsx` perdeu o gate
   `experimentalEnabled` (state + listener de `storage` inteiros, G15 da Fatia 10, saíram
   junto); `isQuotesApprovalReachable()` simplificado pra delegar só ao master flag, **mantido
   como função nomeada** (não inlinada) — comentário registra que ela volta a ganhar um segundo
   termo quando `finance`/`projects` chegarem. Os 2 componentes de toggle
   (`QuotesSupabaseExperimentalToggleCard.tsx`, `QuotesSupabaseApprovalToggleCard.tsx`) foram
   removidos de `Configuracoes.tsx` e deletados do repositório.
3. **`CreateProject`/`CreateReceivable`** — mantidas intactas, conforme §2.2 (fora de escopo,
   domínio ainda não cortado).
4. **Testes limpos, não só código** (precisão 1 do revisor) — todo teste que dependia do
   default antigo (OFF/local) ou da coexistência com a flag legada foi identificado por grep
   exaustivo e reescrito, nunca deixado passando por acidente: `flags.test.ts` (default do
   seletor), `useSupabaseQuotesWriteFlag.test.ts` (reescrito por completo — default, override,
   `isQuotesApprovalReachable` pós-retirada), `QuotesSection.test.tsx` (3 describes afetados:
   "modo local" virou explícito + novo describe do default-nuvem + os testes de "escrita
   bloqueada" e "sem o master flag" passaram a desligar a flag explicitamente),
   `LinkedQuotesSection.test.tsx` e `SupabaseQuotesViewerCard.test.tsx` (mesma correção, mais a
   remoção do describe inteiro que testava a reatividade da flag retirada, e um teste novo
   confirmando que a flag legada não tem mais nenhum efeito).
5. **Viewer confirmado montado** (precisão 4) — `Configuracoes.quotes-viewer-mount.test.tsx`
   (Fatia 10) continua verde, sem mais depender de nenhuma flag: o card renderiza
   incondicionalmente com `workspace`, e o teste de regressão foi atualizado pra provar
   exatamente isso (não seta mais a flag retirada).

**Gates:** tsc 0 · vitest 316/316 (313 + 3 líquidos: alguns testes obsoletos removidos,
outros novos adicionados) · lint-gate 33/33.

---

**PARADO aqui.** Fase C implementada e testada. Fase D (runbook, com a foto pendente do 5b —
§3, caso 4) só com novo "vai" do revisor.

---

## 5. Fase D — Runbook executável ("vai" do revisor) — PRONTO PARA EXECUÇÃO

> **Nada foi executado ainda.** Escrito e PARADO — execução conduzida pelo revisor com o
> operador, passo a passo, mesmo protocolo da Fatia 10.

Workspace de teste (mesmo de sempre): `2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9`. Prefixo
`HOMOLOG-FLIP-` em todo nome sintético. **Sem SQL de seed** — escrita é default agora, então
oportunidade e quotes sintéticas são criadas inteiramente pela UI (SQL só como PROVA de
leitura, nunca pra criar dado).

### 5.0 Passo 0 — prova de servidor (§16/§17, obrigatório antes de qualquer outro passo)

Dev server desta lane já no ar: `http://localhost:8095`, subido direto na pasta `Kora-laneA`
(sem symlink — lição do incidente #3). Verificado agora mesmo: console mostra
`[Kora] BUILD 7adefad (etapa-5-flip-quotes)` — bate com o tip atual da branch. Operador confere
o mesmo antes do passo 1; se vier hash diferente ou branch errada, PARAR e reportar (não é o
código deste pacote).

### 5.1 Papéis das entidades sintéticas

- **Opp** (`HOMOLOG-FLIP-opp`): criada via CRM → "Nova oportunidade", usada nos casos 4 e 6.
- **Quote A** (`HOMOLOG-FLIP-nativa`): criada a partir da Opp (CRM → "Criar orçamento a partir
  da oportunidade") — é a que vira "enviado" pro caso 4 (a foto do 5b).
- **Quote B** (`HOMOLOG-FLIP-novo-usuario`): criada no caso 1, sob o cenário "localStorage
  limpo" — prova a escrita default sem nenhuma flag setada manualmente.

### 5.2 Casos obrigatórios

| # | Caso | Passos | Resultado esperado |
|---|---|---|---|
| 1 | **Usuário novo** | Console: `localStorage.removeItem("kora.quotes.dataSource.v1"); localStorage.removeItem("kora.quotes.supabaseWrite.enabled"); localStorage.removeItem("kora.quotes.supabaseExperimental.enabled"); localStorage.removeItem("kora.quotes.supabaseApproval.enabled");` → **F5** → abrir Orçamentos → **Novo orçamento**, título `HOMOLOG-FLIP-novo-usuario`, 1 item, valor 500, salvar | Seletor já mostra "Supabase experimental" ativo (fonte default), badge **"Modo operacional"** (não "leitura"), toast de sucesso ao salvar, linha aparece na lista — **escrita funcionando sem setar nenhuma flag manualmente**. Prova SQL (só leitura): `select id, title, status from public.quotes where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and title = 'HOMOLOG-FLIP-novo-usuario';` → 1 linha, `status='draft'`. |
| 2 | **Override negativo sobrevive** | Console: `localStorage.setItem("kora.quotes.supabaseWrite.enabled", "false")` → **F5** → tentar mudar o status da quote do caso 1 (menu ⋮ → qualquer transição) | Banner volta a **"modo leitura"**; toast de **erro** com o texto exato "Escrita de orçamentos no Supabase ainda está desligada nesta sessão (flag mestre) — volte para Local para editar."; nenhuma mudança persiste (SQL: `status` continua `draft`). Confirma: quem desligou a flag ANTES do flip (ou a qualquer momento) continua desligado depois — override nunca é pisado pelo novo default. |
| 3 | **Override de dataSource** | Console: `localStorage.setItem("kora.quotes.dataSource.v1", "local")` (mantendo o write flag como estiver) → **F5** | Seletor mostra **"Local"** ativo (não "Supabase experimental"), tela mostra os orçamentos locais do navegador (array `orbyt.quotes.v1`), intactos — nenhuma chamada de rede pra `public.quotes` nesta tela enquanto "Local" estiver selecionado. |
| 4 | **A foto do 5b (caso obrigatório, 2 telas)** | Religar a escrita: console `localStorage.setItem("kora.quotes.supabaseWrite.enabled", "true"); localStorage.setItem("kora.quotes.dataSource.v1", "supabase");` → F5 → CRM → **Nova oportunidade** `HOMOLOG-FLIP-opp` → abrir o detalhe → **"Criar orçamento a partir da oportunidade"** → título `HOMOLOG-FLIP-nativa`, 1 item, valor 900 → na tela de Orçamentos, menu ⋮ da quote → **Marcar como enviado** → (a) Configurações → rolar até "Sincronização Cloud & CRM" → card **"Orçamentos no Supabase (Experimental)"** → localizar `HOMOLOG-FLIP-nativa` → **PRINT** confirmando botões **Aprovar/Rejeitar visíveis** → (b) CRM → detalhe de `HOMOLOG-FLIP-opp` → seção **"Orçamentos vinculados"** → **PRINT** confirmando os mesmos botões visíveis ali | Botões Aprovar/Rejeitar aparecem nas **2 telas** pra uma quote em "enviado" — prova visual do fix da Pendência 1 (Fatia 10), nunca verificada ao vivo por falta de acesso autenticado nas sessões anteriores. **2 prints obrigatórios**, não pode fechar como "assumido correto". |
| 5 | **Configs pós-retirada** | Configurações → aba Dados → seção "Sincronização Cloud & CRM" — inspecionar a lista de cards | Cards **"Visualização Experimental de Orçamentos Supabase"** e **"Orçamentos Supabase - Aprovação Experimental"** **NÃO aparecem mais** (retirados, §2.2). Card **"Orçamentos no Supabase (Experimental)"** (o viewer) aparece **incondicionalmente**, com a lista. Cards **"Orçamentos Supabase - Gerar Recebível Experimental"** e **"Orçamentos Supabase - Gerar Projeto Experimental"** continuam presentes — ligar um deles e confirmar que "Gerar recebível"/"Gerar projeto" ainda abre o diálogo correspondente numa quote aprovada (sem regressão, §2.2). |
| 6 | **Limpeza** | Excluir (soft-delete, menu ⋮) as quotes `HOMOLOG-FLIP-nativa` e `HOMOLOG-FLIP-novo-usuario`; arquivar/excluir `HOMOLOG-FLIP-opp` no CRM; console: remover as chaves setadas manualmente nos casos 2/3 (deixar limpo, estado "usuário novo") | Prova SQL de resíduo: `select count(*) from public.quotes where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and title like 'HOMOLOG-FLIP-%' and deleted_at is null;` → **0**. `select count(*) from public.crm_opportunities where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and title = 'HOMOLOG-FLIP-opp' and archived = false;` → **0** (arquivada, não necessariamente apagada — soft delete é o padrão já estabelecido). |

**Critério de aceite:** 6/6 casos verdes. Caso 4 fecha só com os 2 prints anexados ao
relatório — não pode ser dado como resolvido "de cabeça", é exatamente a lacuna que motivou
este pacote.

---

**PARADO aqui.** Runbook escrito, ambiente confirmado (`http://localhost:8095`,
`[Kora] BUILD 7adefad`). Execução conduzida pelo revisor com o operador só com novo "vai".

---

## 6. Fase D — Resultado (6/6) e fechamento pré-sign-off

**Placar: 6/6**, executado ao vivo pelo revisor/operador contra `BUILD 7adefad`, provado por hash.

| Caso | Resultado |
|---|---|
| 1 Usuário novo | ✅ default Supabase + "Modo operacional", criação sem setar flag nenhuma (prints) |
| 2 Override negativo | ✅ modo leitura + bloqueio — **ressalva registrada abaixo** (banner printado nesta sessão; o toast de bloqueio em si já está coberto por teste automatizado + pela homologação/smoke da Fatia 10 — não reaberto aqui) |
| 3 Override dataSource local | ✅ dados locais intactos (print) |
| 4 **A foto do 5b** | ✅ **QUITADA** — quote `enviado` com Aprovar/Rejeitar visíveis nas 2 telas (2 prints). Aprovação executada de fato **pela `LinkedQuotesSection` pela primeira vez** (nunca tinha sido exercida ao vivo antes), com propagação confirmada no viewer das Configs (`"Aprovado em" + data timestamp`) — não só um clique isolado, o dado realmente circulou entre as 2 telas. |
| 5 Configs pós-retirada | ✅ cards retirados ausentes, `CreateProject`/`CreateReceivable` presentes e funcionais, viewer montado incondicionalmente |
| 6 Limpeza | ✅ sintéticas excluídas — **achado registrado abaixo** |

### Ressalva do caso 2 — toast de bloqueio não re-evidenciado ao vivo nesta rodada

O placar acima referenciava esta seção como "registrada abaixo" — texto que ficou pendente até
esta correção (achado do revisor, pós-merge). Registrando agora: no caso 2 desta rodada, o
**banner** ("modo leitura") foi de fato reobservado e printado ao vivo contra `BUILD 7adefad`.
O **toast de erro** em si (texto exato "Escrita de orçamentos no Supabase ainda está desligada
nesta sessão (flag mestre) — volte para Local para editar.") **não foi recapturado com um print
novo** nesta execução específica — não porque o comportamento fosse duvidoso, mas porque já está
coberto em 2 lugares independentes: (1) teste automatizado dedicado
(`QuotesSection.test.tsx`, describe "escrita bloqueada em modo Supabase") que verifica
literalmente essa string; (2) a mesma mensagem/mecanismo já foi homologada ao vivo na Fatia 10
(Fase D, caso 6, e na sua revalidação pós-incidente #1). **Decisão: não reabrir/reexecutar esse
sub-passo agora** — a combinação teste+homologação anterior é considerada prova suficiente;
registrado explicitamente pra não ficar implícito.

### Achado (a) — chave legada órfã no localStorage (registrado, não é bug)

O residue-check do caso 6 encontrou `kora.quotes.supabaseApproval.enabled` ainda presente no
localStorage de quem a setou antes da retirada (§2.2, Fase C). **Decisão: documentar como
resíduo aceitável, não implementar limpeza one-shot no boot.** Motivo: zero consumidores reais
(confirmado por grep — só a constante em `BOOLEAN_FLAG_KEYS` e comentários explicativos
permanecem, nenhuma leitura de comportamento) e é **exatamente o mesmo tratamento já dado** às
flags mortas do CRM na Fatia 8 ("as chaves antigas ficam órfãs no localStorage de quem já as
tocou, sem migração de dado necessária") — manter consistência com o precedente já estabelecido
é preferível a introduzir um mecanismo de limpeza novo (código extra, superfície de teste extra)
pra resolver algo sem nenhum impacto funcional. Mesmo raciocínio se aplica à
`kora.quotes.supabaseExperimental.enabled`, retirada junto.

### Achados fora de escopo (`quotes`), catalogados em `main`

- **O8** (`kora-hub-auditoria-e-plano.md`, commit `d174047`): CRM — botão "Mover para etapa" do
  menu do lead não produz efeito. Causa provável identificada por leitura de código
  (`handleMoveToStage`, `CRM.tsx:566` — retorno silencioso quando `lead.supabaseId` está
  ausente, sem toast/feedback nenhum) — não confirmada ao vivo (sem acesso autenticado nesta
  sessão). Registrado pra sessão dedicada ao CRM.
- **UX1** (novo doc `kora-ux-produto.md`, mesmo commit): contraste de UX entre
  `CreateCrmSupabaseQuoteDialog.tsx` (pré-preenche por contexto, nunca produziu erro de campo
  trocado em nenhuma homologação) e o `NewQuoteWizard` (2 campos de texto livre adjacentes,
  título/cliente invertidos repetidamente ao longo desta cadeia de fatias) — o padrão bom já
  existe no app, registrado pra uma rodada de UX/Produto decidir se vale espalhar.

---

**PARADO aqui.** Fase D encerrada, 6/6. Achados registrados. Sign-off e merge a seguir, nesta
mesma janela ("vai" já concedido para ambos).

---

## 7. Sign-off e merge — Pacote do Flip encerrado

1. **Sync final** (worktree `Kora-laneA`): `git merge origin/main --no-edit` absorveu o G8/G18
   (`WhatsAppBotConfig.tsx`, autenticação real em `isTestAuth.ts`) e o próprio O8/UX1 desta
   sessão — auto-merge limpo, sem conflito. Commit de sync: `dae6de8`. Gates no estado
   combinado (`Kora-laneA`): tsc 0 · vitest 321/321 · lint-gate 33/33. Push:
   `2ce5a22..dae6de8` em `etapa-5-flip-quotes`.
2. **Checagem de contenção imediatamente antes do merge** (§16 item 4, §17): `orbit-designer-hub`
   (única worktree com `main`), `git fetch` + comparação de hash — `main` idêntico a
   `origin/main` (`d174047`), sem commit estranho no meio da operação.
3. **Merge `etapa-5-flip-quotes` → `main`: fast-forward** (`d174047..dae6de8`) — histórico
   linear, sem commit de merge extra (a branch já continha `origin/main` como ancestral direto
   pelo sync do passo 1).
4. **Gates repetidos diretamente em `main`** pós fast-forward, mesmo commit: tsc 0 ·
   vitest 321/321 · lint-gate 33/33.
5. **Push:** `d174047..dae6de8` em `origin/main`, sem drift (confirmado imediatamente antes).

**Hash final mesclado em `main`: `dae6de8`.**

Worktrees ao fechar: `Kora-laneA` (`etapa-5-flip-quotes`) e `orbit-designer-hub` (`main`) ambas
em `dae6de8`, idênticas.

---

**PARADO aqui.** Pacote do Flip de `quotes` encerrado — merge em `main` @ `dae6de8`. Coordenação
pós-merge (LANE B re-sync do teto de lint, depois LANE C janela de deploy do G18) conforme
combinado. Nenhum próximo passo desta lane sem novo "vai".
