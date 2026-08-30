# Etapa 5 · Tarefas — liga o mapper às 4 colunas novas (scope/tags/recurrence/reminder)

> **Achado #1 da homologação, agravado.** `scope`/`tags`/`recurrence`/os 3
> campos de lembrete tinham coluna real em `public.tasks` desde a fatia B1
> (`etapa-5-flip-tarefas-migrations-drafts.md` §1-4, aplicadas pelo operador
> via §8-b), mas `tasksMapper.ts` continuava hardcodando os 4 no lado de
> leitura (`scope: "work"`, `tags: []`, `recurrence: "none"`,
> `reminderAt/reminderEnabled/reminderSentAt: undefined/false`) e omitindo
> os 4 no lado de escrita — qualquer edição desses campos numa tarefa da
> nuvem era descartada em silêncio (o Select mudava e "revertia" no próximo
> refetch, porque nunca tinha ido a lugar nenhum). **ID novo pedido ao
> revisor — não reservado por conta própria.**
>
> Zero DDL/DML aplicado nesta rodada (protocolo §0/§6) — as 5 migrations da
> fatia B1 (incluindo o CHECK de status/priority) já estavam aplicadas pelo
> operador antes desta rodada começar (confirmado no runbook de Fase D,
> commit `f1fe83f`). Esta rodada é 100% código de aplicação (mapper +
> testes) + regeneração de `types.ts` (introspecção read-only, não DDL).

---

## 1. `types.ts` regenerado (read-only, não é DDL)

`Database["public"]["Tables"]["tasks"]["Row"/"Insert"/"Update"]` não tinha
nenhuma das 6 colunas (`scope`/`tags`/`recurrence`/`reminder_at`/
`reminder_enabled`/`reminder_sent_at`) — confirmado por leitura direta antes
de qualquer mudança. Regenerado via `supabase gen types typescript
--project-id ewamvzncsloagtcvkbxv` (CLI já autenticado nesta sessão,
introspecção do schema real — **não executa DDL nem DML**, só lê o catálogo
do Postgres). Diff resultante, confirmado via `git diff` (não a comparação
ingênua que já causou confusão de line-ending nesta sessão antes):
puramente aditivo, 21 linhas, 2 tabelas:

- `tasks`: as 6 colunas confirmadas com o shape exato do draft de migration
  (`scope: string | null`, `tags: string[] | null`, `recurrence: string |
  null`, `reminder_at: string | null`, `reminder_enabled: boolean`,
  `reminder_sent_at: string | null`).
- `projects.completed_at: string | null` — achado incidental, byproduct da
  regeneração global (não existe regeneração parcial por tabela). Não
  investigado nem usado nesta rodada — fora do escopo desta fatia (Tarefas),
  registrado aqui só por transparência de que o diff não é 100%
  Tarefas-only.

`SupabaseTask` (`tasksRepository.ts`, interface hand-maintained, não gerada)
ganhou os 6 campos como opcionais, espelhando o `Row` gerado.

---

## 2. Vocabulário local vs. cloud (G40/G49-classe) — CONFIRMADO SEM DRIFT

Diferente de `status`/`priority` (que tiveram um 2º dialeto em inglês,
G40/G49), `scope`/`recurrence` são colunas NOVAS — nunca existiu um 2º
produtor com vocabulário divergente pra existir drift. Confirmado por
comparação direta entre `TaskScope`/`TaskRecurrence` (`useTasks.ts:7-8`) e
os 2 CHECKs do draft de migration
(`etapa-5-flip-tarefas-migrations-drafts.md` §1/§3):

| Campo | Vocabulário local (`useTasks.ts`) | CHECK do banco (draft §1/§3) | Tradução necessária? |
|---|---|---|---|
| `scope` | `"work" \| "personal"` | `IN ('work', 'personal')` | **Não** — literais idênticos |
| `recurrence` | `"none" \| "daily" \| "weekly" \| "monthly" \| "weekdays"` | `IN ('none', 'daily', 'weekly', 'monthly', 'weekdays')` | **Não** — literais idênticos |

`normalizeCloudTaskScope`/`normalizeCloudTaskRecurrence` (novos,
`tasksMapper.ts`) por isso NÃO são normalizadores de alias legado (não há
alias nenhum pra mapear) — só protegem contra NULL (linha legada, coluna
nova) ou um valor futuro fora do vocabulário, com o mesmo default já usado
em toda a UI local (`work`/`none`).

---

## 3. Mapper — `tasksMapper.ts`

- **Leitura** (`mapSupabaseTaskToLocal`): `scope`/`recurrence` via os 2
  normalizadores acima; `tags: st.tags ?? []`; `reminderAt`/
  `reminderEnabled` lidos direto; `reminderSentAt` lido por completude (G37)
  mesmo sem nenhum produtor client-side escrevendo nele (ver §5).
- **Escrita** (`mapLocalTaskToSupabase`, criação/import): os 4 campos
  gravados explícitos (`scope: task.scope ?? "work"`, etc.) — nunca dependem
  do `DEFAULT` da coluna, mesma disciplina que `status`/`priority` já
  seguiam. `reminder_sent_at` **omitido de propósito** — nunca no payload.
- **Atualização** (`splitTaskUpdatePatch`, escrita nativa): `scope`/`tags`/
  `recurrence`/`reminderAt`/`reminderEnabled` migraram do `localPatch`
  implícito pro `cloudPatch` explícito — é exatamente essa migração que
  fecha o achado #1 (o select não tinha pra onde persistir numa tarefa da
  nuvem). `reminderSentAt` continua SEM entrada no `cloudPatch` (nenhum
  `if` — fica no `localPatch` por omissão, não por acidente).

### 3.1 Regra do G52 (campos-companheiros) — `reminder_at`/`reminder_enabled`

Levantamento de TODOS os call sites reais de `updateTask({reminderAt, ...})`
em `Tarefas.tsx` (2 formas de uso, nunca uma 3ª):

1. **Setar/editar um lembrete** — sempre os 2 juntos:
   `{ reminderAt, reminderEnabled: !!v, reminderSentAt: undefined }`.
2. **Alternar liga/desliga (ícone de sino)** — só `reminderEnabled`, sem
   tocar `reminderAt`: `{ reminderEnabled: !task.reminderEnabled,
   reminderSentAt: undefined }`.

`splitTaskUpdatePatch` trata os 2 campos de forma independente (`if
(patch.reminderAt !== undefined)`, `if (patch.reminderEnabled !==
undefined)`) — cobre os 2 casos reais corretamente sem exigir artificialmente
que os 2 sempre venham juntos (o caso 2 é exatamente "só um dos 2"). Não é
um par condicional tipo `paid`/`paid_at` do G52 original (onde UM campo
implica o outro obrigatoriamente) — aqui os 2 podem genuinamente variar
independente, e o código já reflete isso.

### 3.2 `reminder_sent_at` — invariante, não um campo esquecido

**Nunca escrito pelo client**, em nenhum dos 2 caminhos de escrita
(`mapLocalTaskToSupabase`/`splitTaskUpdatePatch`) — decisão explícita do
revisor, documentada em comentário nos 2 pontos do código. A coluna existe
e é lida (`mapSupabaseTaskToLocal`) por completude (G37 — nunca omitir um
campo que tem coluna), mas hoje sempre volta `NULL`/`undefined` porque não
há nenhum produtor (client ou server) gravando nela ainda — reservada pra
um job server-side futuro que ainda não existe. `useTaskReminders.ts`
continua controlando o disparo LOCAL da notificação (`reminderSentAt` no
`Task` local, nunca sincronizado com a coluna cloud homônima) — são 2
conceitos com o mesmo nome, propositalmente não unificados nesta rodada.

---

## 4. Produtores de escrita — auditoria completa (classe G60/G68: não só o `update`)

| Produtor | Arquivo | Usa `mapLocalTaskToSupabase`? | Veredito |
|---|---|---|---|
| Import geral | `useLocalTasksImport.ts:199` | Sim | **Fechado por tabela** — mesma função, fix automático |
| Criação nativa (Supabase) | `useSupabaseTasksAll.ts` (`createMutation`) | Sim | **Fechado por tabela** — mesma função, fix automático |
| Atualização nativa (Supabase) | `useSupabaseTasksAll.ts` (`updateMutation`) via `splitTaskUpdatePatch` (`Tarefas.tsx`) | N/A (usa o split) | **Fechado nesta rodada** — ver §3 |
| Tarefas-base de projeto | `CreateProjectBaseTasksDialog.tsx:120-136` | **Não** — monta o próprio payload | **Verificado, sem gap** — ver §4.1 |

### 4.1 `CreateProjectBaseTasksDialog.tsx` — verificado, não é um 2º produtor divergente

Diferente do padrão G40/G49 (2 produtores gravando o MESMO campo com
vocabulários diferentes), aqui o produtor não tem NENHUM dado de
scope/tags/recurrence/lembrete pra gravar — `EditableTask` (a interface do
formulário deste diálogo) só tem `checked/title/description/priority/
dueDate` (confirmado por leitura completa do arquivo). É um gerador de
checklist fixo (`DEFAULT_TASKS`), não um formulário de tarefa completo —
omitir os 4 campos no payload é omitir um dado que **genuinamente não
existe** nesta tela, não um esquecimento. Confirmado que a coluna cai no
`DEFAULT`/`NULL` do banco (mesmo resultado que gravar explícito
`scope: null`/`tags: []`/etc.) — sem regressão, sem divergência de
vocabulário (não há vocabulário nenhum sendo gravado). **Não alterado.**

---

## 5. Testes

`src/services/tasks/__tests__/tasksMapper.test.ts` — 63 testes (22 novos +
41 pré-existentes, 2 dos pré-existentes ATUALIZADOS porque codificavam a
suposição antiga, agora corrigida, de que `scope`/`recurrence` eram
local-only):

- `mapLocalTaskToSupabase`: os 4 campos presentes passam direto; ausentes
  caem no default explícito (`work`/`none`), nunca omitidos do payload;
  `reminder_sent_at` nunca aparece no payload.
- `mapSupabaseTaskToLocal`: linha legada (colunas NULL) cai no mesmo
  default neutro de sempre (regressão); round-trip de valor real presente
  (`scope: "personal"`, os 4 valores não-"none" de `recurrence`, `tags`
  arbitrário, `reminderAt`/`reminderEnabled` juntos, `reminderSentAt` por
  completude); valor fora do vocabulário cai no default, nunca mascara.
- `normalizeCloudTaskScope`/`normalizeCloudTaskRecurrence` (novos,
  describes próprios): os valores locais, NULL/undefined, e um valor
  desconhecido.
- `splitTaskUpdatePatch`: os 2 testes que assumiam scope/recurrence
  local-only reescritos com campos genuinamente local-only
  (`taskProjectId`/`milestoneId`); novo describe "fatia B1" prova os 4
  campos indo pro `cloudPatch`, o PATCH MISTO real (`{taskProjectId,
  scope}`), a regra do G52 (`reminderAt`+`reminderEnabled` juntos e
  separados), e a invariante de `reminderSentAt` nunca aparecer no
  `cloudPatch`.

Regressão confirmada (sem nenhum teste quebrado): `useSupabaseTasksAll.test.ts`
(8), `useLocalTasksImport.test.ts` (12), `Tarefas.test.tsx` (9),
`CreateProjectBaseTasksDialog.test.tsx` (3).

**Prova fail→fix→pass por patch** (método G65/§14-A, sem `git stash`):
`git diff` de `tasksMapper.ts`+`tasksRepository.ts` → `git checkout --`
(reverte só os 2 arquivos de implementação, testes ficam) → **22/63 falham**
contra o código antigo (os 41 restantes, pré-existentes e inalterados,
continuam passando — nenhuma sobreposição inesperada) → `git apply` do
mesmo patch → **63/63 verdes**, mais 95/95 no conjunto completo dos 5
arquivos de teste afetados.

`npm run gates`: tsc 0 — lint 0/0 — vitest 889/889 (92 arquivos).

---

## 6. Comentário desatualizado corrigido (G29-classe, encontrado de passagem)

`Tarefas.tsx` (bloco de comentário do wrapper `updateTask`, linhas ~251-273)
classificava cada call site de `onUpdate` como "local-only"/"cloud" com base
no estado ANTES desta rodada — ficaria factualmente errado no exato momento
em que este PR mergeasse (3 call sites viram PATCH MISTO real: `{scope}`,
`{recurrence}`, `{reminderAt, reminderEnabled, reminderSentAt}` e variantes).
Atualizado na mesma rodada, não deixado pra trás.

---

## Referências

- `docs/qa/etapa-5-flip-tarefas-migrations-drafts.md` §1-4 — os 4 drafts de
  migration (shape exato das colunas, vocabulário do CHECK).
- `docs/qa/etapa-5-flip-tarefas-runbook.md` — confirmação do operador
  (5/5 migrations aplicadas via §8-b, commit `f1fe83f`).
- `src/services/tasks/tasksMapper.ts` — implementação.
- `src/pages/Tarefas.tsx:274-286` — wrapper `updateTask`, consumidor de
  `splitTaskUpdatePatch`.
- `docs/architecture/kora-hub-auditoria-e-plano.md` — G37 (payload
  completo), G40/G49 (vocabulário cloud incompleto — classe verificada
  SEM drift nesta rodada), G52 (campo-companheiro condicionado à
  transição), G60/G68 (auditoria de produtores por classe, não por
  ocorrência) — molde metodológico desta rodada.

**PARADO aqui — commit local, sem push/merge. §18.**
