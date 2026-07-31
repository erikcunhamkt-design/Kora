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
