# Auditoria classe G52 (UPDATE parcial omitindo campo) + varredura G40/G49 nos mappers — SOMENTE LEITURA

> **Zero código tocado.** Inventário puro — nenhum arquivo da LANE A (nem de nenhuma outra lane)
> foi editado. Achados classificados **conforme / suspeito / violação**; fixes ficam para uma
> rodada própria, com "vai" explícito.

**Branch:** `auditoria-g52-mutations-vocabulario`, worktree `Kora-laneE`, a partir do tip real de
`origin/main` em `de1ce9b` (confirmado por `git fetch origin main` — inclui G49/G53 já mesclados
pela Lane B/D, G54/G55/G56 já mesclados pela Lane A/C).

**Molde:** generaliza a classe de bug que o G52 nomeou —
*"UPDATE parcial nativo esquece um campo que a semântica local sempre preenche"*
(`docs/architecture/kora-hub-auditoria-e-plano.md`, G52) — para todo mutation de UPDATE do repo
com um campo condicionado à transição de `status`/`stage` (ex.: `paid_at` na transição pra
`"paid"`), e generaliza a classe G40/G49 (vocabulário da nuvem deve ser o local literal, sem
tradução acidental nem invenção) pros mappers ainda não auditados nessa dimensão.

---

## 1. Metodologia — o padrão de referência (G52)

`useFinance.ts:247-268` (`updateTransactionStatus`, semântica LOCAL, fonte da verdade):

```ts
paidDate: status === "paid" ? iso(new Date()) : t.paidDate
```

Transição PRA `"paid"` → grava a data de hoje (sempre reescrita). Transição PRA FORA de `"paid"`
→ preserva o valor anterior (nunca `null`, nunca reescrito). `Financeiro.tsx`,
`SupabaseTransactionsPanel.setStatus()` foi corrigido (`a24c817`, G52) pra espelhar exatamente essa
semântica no UPDATE nativo da nuvem — antes só mandava `{status}`, agora manda `{status, paid_at}`
condicionalmente. **Este é o padrão-referência usado para julgar todo o resto deste inventário.**

O que se procura em cada mutation de UPDATE:
1. Existe um campo companheiro (tipicamente timestamp) que a semântica local seta/preserva
   condicionalmente por transição?
2. O caminho de escrita na nuvem replica ESSA MESMA condição, em TODAS as direções de transição
   (não só a "principal")?
3. Existe mais de um caminho de escrita pro mesmo campo (ex.: um wrapper cuidadoso + um
   passthrough genérico que pode ser chamado direto, pulando o wrapper)?

---

## 2. Mutations de UPDATE — domínio a domínio

### 2.1 Financeiro — `paid_at`

**`src/pages/Financeiro.tsx`, `SupabaseTransactionsPanel.setStatus()`** (função local ao componente,
por volta da linha 402-418 no tip atual) — **CONFORME**. É o próprio caso que originou o G52 —
já corrigido e testado (`Financeiro.test.tsx`, 2 casos: "paid_at preenchido" na transição PRA pago,
e "cancelar NUNCA envia paid_at" via `not.toHaveProperty`, não um `objectContaining` que deixaria
passar um `null` indevido). Único campo condicional do domínio (`Transaction.paidDate`, único em
`useFinance.ts:11-38`) — nada mais a checar aqui.

### 2.2 Tarefas — sem campo condicional equivalente

**`src/repositories/tasksRepository.ts:68-87`, `updateTaskStatus`** — grava só `{status,
updated_at}`. Conferido o tipo `Task` inteiro (`useTasks.ts:15-48`): não existe nenhum campo tipo
"concluído em" — `updatedAt` é o único timestamp, e é **incondicional** (todo `updateTask`/
`moveTask` local sempre reescreve `updatedAt`, não é derivado de uma transição específica de
`status`; ver `useTasks.ts:148,160`). **N/A** — não há campo condicional equivalente a `paid_at`
neste domínio hoje, então a classe G52 não tem onde se manifestar. `useSupabaseProjectTasks.ts:21-30`
(`updateStatus`) confirma o mesmo — só `status` no patch, consistente.

### 2.3 Projetos — `completedAt` existe local, mas não existe coluna cloud (N/A estrutural, não G52)

**Semântica local** (`useProjects.ts:113-120`, `updateProject`):
```ts
if (patch.status === "delivered" && !p.completedAt) next.completedAt = new Date().toISOString();
```
Diferente do `paidDate` de Financeiro: aqui é "seta uma vez, nunca reescreve" (`!p.completedAt`
como guarda), não "sempre reescreve na transição". Nunca limpa ao sair de `"delivered"` (mesmo
espírito de preservar o histórico que `paidDate` tem).

**Caminho cloud** — `src/repositories/projectsRepository.ts:9-34` (`SupabaseProject`): **não existe
coluna `completed_at`** no schema (confirmado lendo a interface inteira — `start_date`/`due_date`
existem, não há um terceiro campo de data). `ProjectDetailDrawer.tsx:163-176` (`handleStatus`) e
`useSupabaseProjects.ts:73-89` (`updateMutation`) fazem `UPDATE` genérico com o patch que o chamador
montar — nenhum deles TENTA (nem poderia, o tipo não aceita) mandar `completed_at`.

**Classificação: N/A para a classe G52** — não há como "omitir silenciosamente" um campo que nunca
existiu na coluna de destino (diferente do G52 original, onde a coluna `paid_at` já existia e o
código esquecia de escrevê-la). **Achado correlato, fora da classe G52 mas real**: se/quando a
Fase C do flip de Projetos girar `Tarefas.tsx`-equivalente (`Projetos`) pra ler `public.projects`
como fonte, a data de conclusão do projeto **não existe** na nuvem — perda estrutural de dado, não
um bug de patch. Recomendo registrar como gap de schema (mesma classe dos já catalogados
`recurrence`/`supplierId`/`cashAccountId` em Financeiro), não como G52.

### 2.4 CRM / Oportunidades — `won_at`/`lost_at`/`lost_reason`

**`src/repositories/crmOpportunitiesRepository.ts:177-218`** (`moveOpportunityStage`,
`markOpportunityWon`, `markOpportunityLost`) — **CONFORME, e mais rigoroso que o padrão
pré-G52 de Financeiro**: as 3 funções limpam explicitamente o par oposto em TODAS as direções —

```ts
// moveOpportunityStage — as 3 direções, todas explícitas:
if (stage === "fechado")      { won_at = now;  lost_at = null; lost_reason = null; status = "won";  }
else if (stage === "perdido") { lost_at = now; won_at = null;                      status = "lost"; }
else                           { won_at = null; lost_at = null; lost_reason = null; status = "open"; }
```

Nenhum caminho alternativo de escrita de `stage`/`status` encontrado — os 2 outros chamadores
diretos de `updateOpportunity` (genérico) em `CRM.tsx:372` (só `tags`) e `CRM.tsx:1254`
(`allowedPatch` explicitamente whitelisted, edição básica — nome/empresa/contato/temperatura/
notas, **nunca** `stage`/`status`/`won_at`/`lost_at`) confirmam que não há bypass.

**Achado adjacente, SUSPEITO (não ativo hoje)** — `src/services/crm/crmOpportunityMapper.ts:63-64`,
`mapLocalLeadToSupabaseOpportunity` (caminho de **import**, não de UPDATE ao vivo):
```ts
won_at: lead.wonAt || (lead.stage === "fechado" ? new Date().toISOString() : null),
lost_at: lead.stage === "perdido" ? new Date().toISOString() : null,
```
Ao contrário de `moveOpportunityStage`, esta função **não limpa `won_at`** quando
`lead.stage !== "fechado"` — se `lead.wonAt` já tiver um valor truthy, `||` preserva esse valor
mesmo que o `stage` atual seja `"perdido"`. **Confirmado por grep exaustivo em `useLeads.ts` e
`CRM.tsx` que `Lead.wonAt` nunca é escrito por nenhum caminho LOCAL** — só é populado ao LER da
nuvem (`mapSupabaseOpportunityToLocalLead:109`, direção inversa). Ou seja: o bug de desenho existe
no código, mas não é exercitável hoje porque a pré-condição (`lead.wonAt` já truthy vindo de um
estado local editável) nunca ocorre na prática. Vira ativo se algum código futuro passar a
alimentar `Lead.wonAt` a partir de um objeto já lido da nuvem antes de reimportar (cenário de
round-trip). Classificação: **SUSPEITO — violação latente, não confirmada em produção**.

**Achado adjacente, NOTA (não é inconsistência, é campo morto)** —
`crmOpportunitiesRepository.ts:238-267` (`softDeleteOpportunity`/`restoreSoftDeletedOpportunity`):
nenhuma das duas funções toca `deleted_by` (coluna existe no schema — `crm_opportunities.deleted_by`
— confirmado no schema Supabase). Diferente do padrão G52 (que é sobre uma condição que às vezes
acontece e às vezes não), aqui a ausência é **uniforme** — nenhum caminho de escrita jamais
preencheu essa coluna, não há dois comportamentos divergindo. Não é violação de G52; é um campo de
auditoria não implementado, catalogável à parte se o operador quiser rastrear quem excluiu.

### 2.5 Clientes (cadastro puro, `clients`/`client_contacts`) — sem campo condicional

**`src/repositories/clientsRepository.ts:70-94`** (`updateClient`, `archiveClient`) — patches
genéricos, sem nenhuma lógica condicional embutida no repository (decisão de campo fica 100% com o
chamador). Conferido o schema (`clients` — `status`, `temperature`, `next_action`,
`next_action_date`, todos diretamente editáveis pelo usuário, nenhum derivado automaticamente de
uma transição de `status`). **N/A** — mesma conclusão de Tarefas, não há campo condicional
equivalente a `paid_at` neste domínio.

---

## 3. Varredura G40/G49 — mappers restantes (vocabulário da nuvem = local literal)

| Mapper | Vocabulário auditado | Classificação | Nota |
|---|---|---|---|
| `financeMapper.ts` | `type`/`status`/`payment_method` | **CONFORME** | Já auditado na revisão da Fase B (relatório anterior desta Lane) — `type` é `CLOUD_TYPE` mapeado por desenho (não bug), `status`/`payment_method` passthrough literal exato. |
| `quoteMapper.ts:40-79` | `status` (`CLOUD_TO_LOCAL_STATUS`/`LOCAL_TO_CLOUD_STATUS`) | **CONFORME** | O mapper mais maduro do repo — tradução bidirecional deliberada e documentada (Q9), com passthrough dos 5 literais PT legados já reconhecido, `"vencido"` (computado, nunca gravado) tratado defensivamente. Padrão-ouro pros outros domínios. |
| `projectsMapper.ts:178-215` | `status` (`CLOUD_TO_LOCAL_PROJECT_STATUS`) + `archived` | **CONFORME funcionalmente, SUSPEITO no comentário** | Fix O12 aplicado (`mapLocalProjectToSupabase` já traduz `archived` corretamente via `translateLocalProjectStatusToCloud`, linhas 106-126/142/156). MAS o docstring de `translateCloudProjectStatusToLocal` (linhas 190-200, função **diferente**, direção de leitura) ainda descreve o comportamento **pré-fix** ("`mapLocalProjectToSupabase` acima sempre grava `archived: false`") — texto desatualizado dentro do mesmo arquivo que documenta a própria correção 80 linhas acima. Risco: alguém lendo só esse docstring reintroduz a regressão do O12 achando que o boolean é morto. |
| `tasksMapper.ts` | `status`/`priority`, `resolveTaskFk` | **Já catalogado, não novo** | G37 (passthrough de UUID) e G49 (vocabulário legado de `createProjectBaseTasks`) — G49 **confirmado mesclado** no tip desta rodada (`origin/main:CreateProjectBaseTasksDialog.tsx:127`, `status: "a_fazer"`/`priority` em português). Nada novo a reportar aqui. |
| `crmOpportunityMapper.ts` | `stage` (passthrough literal) | **CONFORME** | Sem tabela de tradução — `stage: lead.stage \|\| "lead"` grava o vocabulário PT verbatim, mesmo vocabulário que `moveOpportunityStage`/`known: StageKey[]` (`useLeads.ts:279`) já usam. Achado de `won_at`/`lost_at` reportado em §2.4 (SUSPEITO), não é de vocabulário. |
| `technicalSheetMapper.ts` / `supabaseTechnicalSheetToLocalMapper.ts` | — | **N/A** | Sem campo de vocabulário fechado (`status`/enum) — só blobs JSONB de branding/persona/briefing, texto livre. Classe G40/G49 não se aplica. |

---

## 4. Resumo classificado

| # | Domínio | Arquivo:linha | Achado | Classificação |
|---|---|---|---|---|
| 1 | Financeiro | `Financeiro.tsx` (`SupabaseTransactionsPanel.setStatus`) | `paid_at` condicional — já corrigido (G52) | **CONFORME** |
| 2 | Tarefas | `tasksRepository.ts:68-87` | Sem campo condicional equivalente | **N/A** |
| 3 | Projetos | `useProjects.ts:117` vs. `projectsRepository.ts:9-34` | `completedAt` local sem coluna cloud — gap estrutural, não G52 | **N/A (classe G52) / gap de schema real** |
| 4 | Projetos | `projectsMapper.ts:190-200` | Docstring desatualizado sobre `archived` (descreve estado pré-O12) | **SUSPEITO (doc)** |
| 5 | CRM/Oportunidades | `crmOpportunitiesRepository.ts:177-218` | `won_at`/`lost_at`/`lost_reason` — limpa o par oposto em todas as 3 direções | **CONFORME** |
| 6 | CRM/Oportunidades | `crmOpportunityMapper.ts:63-64` | Import não limpa `won_at` ao sair de "fechado" — inofensivo hoje (campo nunca populado localmente) | **SUSPEITO (latente, não ativo)** |
| 7 | CRM/Oportunidades | `crmOpportunitiesRepository.ts:238-267` | `deleted_by` nunca escrito (coluna morta, ausência uniforme) | **NOTA** |
| 8 | Clientes | `clientsRepository.ts:70-94` | Sem campo condicional equivalente | **N/A** |
| 9 | Mappers | `financeMapper.ts`, `quoteMapper.ts` | Vocabulário literal/traduzido corretamente | **CONFORME** |
| 10 | Mappers | `tasksMapper.ts` (G37/G49) | Já catalogado, G49 confirmado mesclado no tip | **Já resolvido/catalogado** |
| 11 | Mappers | `technicalSheetMapper.ts` | Sem vocabulário fechado | **N/A** |

**Nenhuma VIOLAÇÃO ativa confirmada.** O item mais próximo de virar violação real (#6) está
estruturalmente inofensivo hoje só porque nenhum código local escreve `Lead.wonAt` — não é uma
garantia permanente, é uma coincidência de que o campo nunca foi usado desse lado. Recomendo
tratar #4 e #6 numa rodada de fix pequena (comentário + guarda defensiva), e registrar #3 como
item de desenho pra uma futura Fase de schema de Projetos, não como bug.

---

## Referências

- `docs/architecture/kora-hub-auditoria-e-plano.md` — G52 (padrão de referência desta auditoria),
  G37 (passthrough de UUID), G40/G49 (vocabulário `updateTaskStatus`/`createProjectBaseTasks`)
- `docs/qa/etapa-5-flip-financeiro-runbook.md` — achado original do G52 (Lane C, homologação Fase B)
- `src/hooks/useFinance.ts:247-268` — semântica local de referência (`updateTransactionStatus`)
- `src/repositories/crmOpportunitiesRepository.ts` — melhor exemplo do repo do padrão correto
  (limpa o par oposto em todas as direções, não só a principal)

---

**PARADO aqui — inventário encerrado, zero código alterado. Fix (se autorizado) é rodada própria,
com "vai" explícito — nenhum arquivo da Lane A tocado nesta rodada.**
