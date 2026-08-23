# Varredura G72-classe — minas de calendário (fixture de data fixa × relógio real)

> Backlog registrado pela Lane E (`kora-hub-auditoria-e-plano.md`, G72):
> "qualquer fixture de teste com uma data absoluta comparada, no código sob
> teste, contra `new Date()`/`Date.now()` real (sem `vi.useFakeTimers()`/
> `vi.setSystemTime()`) tem uma data de validade embutida — o teste passa
> por meses/anos e então começa a falhar sozinho, sem nenhum commit tocar
> nele." Branch `etapa-5-varredura-g72-minas-calendario`, a partir do tip
> real de `origin/main` em `6cb30de`. **Executada em 22/ago/2026** — data
> relevante porque um dos achados só é visível a partir de hoje (ver §1).

## Método

1. Localizar toda função de PRODUÇÃO que faz comparação de THRESHOLD contra
   o relógio real (`isOverdue`/`isToday`/`dueBucket`/`effectiveStatus`/
   `vencid*`/`isPast`/`isExpired`) — `grep` desse vocabulário em `src/**/*.{ts,tsx}`
   encontrou 15 arquivos (produção + teste).
2. Para cada função encontrada, achar o(s) arquivo(s) de teste que a
   exercitam (direto ou via render de componente), e verificar: (a) o teste
   usa `vi.useFakeTimers()`/`vi.setSystemTime()`? (b) se não, o fixture de
   data é relativo ao momento da execução (`new Date()`/`todayIso()`) ou uma
   string absoluta (`"2026-08-20"` etc.)? (c) se absoluta, ela **já
   cruzou** o limiar hoje, ou está longe o bastante (passado distante,
   futuro distante) pra nunca cruzar?
3. Varredura cruzada adicional: grep por datas absolutas próximas de hoje
   (`2026-08-1[0-9]`/`2[0-9]`) em `**/__tests__/**`, pra pegar comparações
   de threshold que não usem os nomes de função acima.
4. Classificar cada achado: **mina real (ativa hoje)** · **mina real
   (adormecida, cruzará o limiar no futuro)** · **segura (padrão correto:
   fixture relativo ou data intencionalmente longe do limiar)** · **falso
   positivo (campo presente, mas nunca comparado contra relógio no código
   sob teste)** · **sem risco (função existe, mas não tem teste que a
   exercite — nada pra apodrecer, só falta de cobertura, fora do escopo de
   G72)**.

---

## 1. Achados

| # | Arquivo(s) | Mecanismo | Classe | Ação |
|---|---|---|---|---|
| 1 | `ClientActivitiesTab.test.tsx` (`makeCloudReceivable()` sem override de `dueDate`) × `buildFinanceEvents.ts:40` (`isOverdue`) | ✅ **CORRIGIDO** (rodada de merge, F3 da Lane C liberou o arquivo). Factory default `dueDate: "2026-08-20"` — tinha **cruzado o limiar** em 22/ago/2026. Os 2 testes afetados **continuavam passando** por sorte: `"Conta a receber gerada"` e `"Recebível vencido"` são textos DIFERENTES, então `findByText`/`getByText` não colidiam (diferente do bug original do G72, que usava uma regex que batia nos 2) — mas cada um renderizava silenciosamente um **2º evento não previsto** que nenhum assert verificava. **Verificado nos 2 estados, sem mudar nenhum assert** (instrução explícita): revertido só o default via patch → 21/21 ainda passam (a mina não quebrava nada hoje, só mudava o comportamento exercitado em silêncio) → reaplicado → 21/21 continuam passando. Não é um fail→fix→pass tradicional — é uma bomba desarmada preventivamente. Fix: `dueDate` do factory passa a ser relativo (`futureDueDateIso()`, hoje+30 dias) — mesma técnica de `QuotesSection.test.tsx` (`todayIso()`). | **Mina real, corrigida** | **Corrigida** — `git diff` disponível no commit da rodada de merge. |
| 2 | `ClientActivitiesTab.test.tsx:148` (`dueDate: "2099-01-01"`) | Já corrigido no commit original do G72 (`7c1ae42`/`6cb30de`) — data explícita e comprovadamente futura. | Segura (fix já aplicado, precedente) | Nenhuma — registro de referência. |
| 3 | `ClientActivitiesTab.test.tsx:285` (`dueDate: "2020-01-01"`, teste "recebível vencido") | Data no passado distante usada pra testar o caso "vencido = true" — direção OPOSTA do bug (aqui a intenção É que fique sempre vencido); nunca deixa de ser verdade com o avanço do calendário. | Segura (padrão correto pra testar "sempre verdadeiro") | Nenhuma. |
| 4 | `ClientActivitiesTab.test.tsx:264` (`status: "vencido"` literal em fixture de quote) × `buildCommercialEvents.ts:101` | `buildCommercialEvents.ts` checa `q.status === "vencido"` **diretamente** (string literal), não computa a partir de data — o campo do fixture não é comparado contra relógio nenhum. | Falso positivo (campo presente, nunca comparado contra relógio) | Nenhuma. |
| 5 | `QuotesSection.test.tsx` (`todayIso()`, linha ~87) × `useQuotes.ts.isQuoteExpired`/`QuotesSection.tsx.effectiveStatus` | `createdAt` do fixture é gerado como `new Date().toISOString().slice(0,10)` — sempre "hoje" no momento da execução, mantendo o fixture válido pra sempre. Comentário no próprio arquivo (linha 81-86) já documenta a mina e o motivo do fix. | **Segura — padrão de referência** (é literalmente a técnica que o próprio G72 recomenda como fix sistêmico) | Nenhuma — citado como exemplo positivo a seguir em correções futuras. |
| 6 | `useDayCenterActions.test.ts` (`dueDate: "2026-08-20"`) × `useDayCenterActions.ts` | Mesmo valor "suspeito" do achado #1, mas `useDayCenterActions.ts` (código sob teste) só usa `new Date()` pra CARIMBAR `resolvedAt` no momento da resolução — nunca compara `dueDate` contra o relógio. `useDayCenterResolvedActions` (que TEM `isToday(iso)`) está 100% mockado neste arquivo (`vi.mock` linha 28) — sua implementação real nunca é exercitada aqui. | Falso positivo (campo presente, função com risco real está mockada) | Nenhuma. |
| 7 | `Tarefas.tsx` (`isOverdue`/`isToday`/`dueBucket`) | **Atualização (rodada de merge)**: `Tarefas.test.tsx` passou a existir (fatias B4/B5, posteriores a esta varredura) — mas confirmado por busca que nenhum teste ali exercita `isOverdue`/`dueBucket`/"atrasada" diretamente. Conclusão original ainda vale, só a premissa mudou. | Sem risco (ausência de teste que exercite a lógica de data — fora do escopo de G72) | Nenhuma. Observação lateral: gap de cobertura, não um achado G72. |
| 8 | `ContentSection.tsx` (`isToday`, linha ~504) | Nenhum teste importa/renderiza `ContentSection` (confirmado via `grep` repo-wide). | Sem risco (ausência de teste) | Nenhuma. |
| 9 | `lib/dayCenter.ts` (textos "vencido"/"vencida" em `buildDayCenterItems`-equivalente, linhas 283/365) | Único arquivo de teste que importa de `lib/dayCenter.ts` (`useDayCenterActions.test.ts`) importa só o TIPO `DayActionItem`, nunca a função geradora — a lógica de vencimento não é exercitada por nenhum teste. | Sem risco (ausência de teste) | Nenhuma. |
| 10 | `useNotificationsCenter.ts` ("vencido"/"vencida" em títulos de notificação-seed, linhas 53/106) | Strings estáticas de conteúdo demo — não são derivadas de nenhuma comparação de data. Sem teste próprio. | Falso positivo (texto estático, não comparação de data) | Nenhuma. |
| — | Varredura cruzada adicional (§ Método, item 3): `tasksMapper.test.ts`, `Financeiro.test.tsx`, `useSupabaseOpportunities.test.ts`, `useLocalOpportunitiesImport.test.ts`, `financeRepository.test.ts`, `useSupabaseFinanceTransactions.test.ts`, `QuoteToProjectDialog.test.tsx`, `projectsMapper.test.ts` — datas próximas de hoje encontradas, mas em nenhum caso comparadas contra um `new Date()` de threshold no código sob teste (mappers só traduzem campos; `Financeiro.tsx`'s filtro "próximos 30 dias" — único ponto real de comparação de data encontrado no arquivo — não tem NENHUM teste que o exercite, confirmado por grep). | Falso positivo / sem risco | Nenhuma. |

---

## 2. Fechamento

**1 mina real ativa encontrada, corrigida na rodada de merge** —
`ClientActivitiesTab.test.tsx`/`buildFinanceEvents.ts` era território da
Lane E na rodada original desta varredura (não tocado, só listado); a
fatia F3 da Lane C mergeou depois (`68440eb`) e liberou o arquivo — fix
autorizado e aplicado nesta rodada de merge. Nenhum arquivo da Lane B foi
identificado como relevante pra esta classe de achado durante a varredura
(nenhuma mina encontrada fora do território da Lane E).

**Verificação nos 2 estados (sem mudar assert nenhum, por instrução)**:
`git diff` do fix salvo como patch → revertido só o default do factory →
21/21 testes **continuam passando** (a mina já tinha cruzado o limiar, mas
nenhum assert existente detectava o 2º evento silencioso) → reaplicado →
21/21 continuam passando. Não é fail→fix→pass tradicional — é confirmação
de que o fix desarma uma bomba que ainda não tinha explodido, sem alterar
nenhum comportamento observável do teste hoje.

**Recomendação sistêmica** (já registrada no G72 original, reafirmada
aqui): fixture de data sempre relativo ao momento do teste OU relógio
fixado via `vi.useFakeTimers()`/`vi.setSystemTime()` — nunca uma string
absoluta comparada contra tempo real. Com o achado #1 corrigido, nenhum
caso do repo viola essa regra de forma ativa nesta data (22/ago/2026).

## Referências

- `docs/architecture/kora-hub-auditoria-e-plano.md`, G72 (achado original,
  definição da classe, precedente de fix).
- `src/components/clients/activityTimeline/buildFinanceEvents.ts:40`,
  `buildCommercialEvents.ts:101` (mecanismos de threshold da Lane E).
- `src/components/vendas/QuotesSection.test.tsx:81-89` (`todayIso()`,
  padrão de referência).
- `src/hooks/useQuotes.ts:148-167` (`isQuoteExpired`/`getQuoteDaysToExpire`,
  mecanismo de threshold de quotes).
- `src/pages/Tarefas.tsx:81-104` (`isOverdue`/`isToday`/`dueBucket`, sem
  teste — gap de cobertura registrado, não achado G72).
