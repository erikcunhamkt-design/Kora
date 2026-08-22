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
| 1 | `ClientActivitiesTab.test.tsx:159,170` (`makeCloudReceivable()` sem override de `dueDate`) × `buildFinanceEvents.ts:40` (`isOverdue`) | Factory default `dueDate: "2026-08-20"` — **já cruzou o limiar hoje** (22/ago/2026). Os 2 testes (linhas 157/168) **ainda passam** por sorte: `"Conta a receber gerada"` e `"Recebível vencido"` são textos DIFERENTES, então `findByText`/`getByText` não colidem (diferente do bug original do G72, que usava uma regex que batia nos 2). Mas cada um desses 2 testes agora renderiza silenciosamente um **2º evento não previsto** (`"Recebível vencido"`) que nenhum assert verifica — mina ativa, mascarada, não quebrou ainda mas já mudou o comportamento exercitado. Um assert futuro adicionado perto de "vencido" nesses testes começaria a falhar sem nenhuma mudança de código. | **Mina real, ATIVA hoje (mascarada)** | **NÃO tocado** — arquivo é `ClientActivitiesTab`/domínio da Lane E (mesmo território do achado original do G72). Listado, não corrigido. |
| 2 | `ClientActivitiesTab.test.tsx:148` (`dueDate: "2099-01-01"`) | Já corrigido no commit original do G72 (`7c1ae42`/`6cb30de`) — data explícita e comprovadamente futura. | Segura (fix já aplicado, precedente) | Nenhuma — registro de referência. |
| 3 | `ClientActivitiesTab.test.tsx:285` (`dueDate: "2020-01-01"`, teste "recebível vencido") | Data no passado distante usada pra testar o caso "vencido = true" — direção OPOSTA do bug (aqui a intenção É que fique sempre vencido); nunca deixa de ser verdade com o avanço do calendário. | Segura (padrão correto pra testar "sempre verdadeiro") | Nenhuma. |
| 4 | `ClientActivitiesTab.test.tsx:264` (`status: "vencido"` literal em fixture de quote) × `buildCommercialEvents.ts:101` | `buildCommercialEvents.ts` checa `q.status === "vencido"` **diretamente** (string literal), não computa a partir de data — o campo do fixture não é comparado contra relógio nenhum. | Falso positivo (campo presente, nunca comparado contra relógio) | Nenhuma. |
| 5 | `QuotesSection.test.tsx` (`todayIso()`, linha ~87) × `useQuotes.ts.isQuoteExpired`/`QuotesSection.tsx.effectiveStatus` | `createdAt` do fixture é gerado como `new Date().toISOString().slice(0,10)` — sempre "hoje" no momento da execução, mantendo o fixture válido pra sempre. Comentário no próprio arquivo (linha 81-86) já documenta a mina e o motivo do fix. | **Segura — padrão de referência** (é literalmente a técnica que o próprio G72 recomenda como fix sistêmico) | Nenhuma — citado como exemplo positivo a seguir em correções futuras. |
| 6 | `useDayCenterActions.test.ts` (`dueDate: "2026-08-20"`) × `useDayCenterActions.ts` | Mesmo valor "suspeito" do achado #1, mas `useDayCenterActions.ts` (código sob teste) só usa `new Date()` pra CARIMBAR `resolvedAt` no momento da resolução — nunca compara `dueDate` contra o relógio. `useDayCenterResolvedActions` (que TEM `isToday(iso)`) está 100% mockado neste arquivo (`vi.mock` linha 28) — sua implementação real nunca é exercitada aqui. | Falso positivo (campo presente, função com risco real está mockada) | Nenhuma. |
| 7 | `Tarefas.tsx` (`isOverdue`/`isToday`/`dueBucket`, linhas 91-104) | Nenhum arquivo `Tarefas.test.tsx` existe no repo — confirmado via busca. Sem teste, não há fixture pra apodrecer. | Sem risco (ausência de teste — fora do escopo de G72, que é sobre teste que apodrece) | Nenhuma. Observação lateral: gap de cobertura, não um achado G72. |
| 8 | `ContentSection.tsx` (`isToday`, linha ~504) | Nenhum teste importa/renderiza `ContentSection` (confirmado via `grep` repo-wide). | Sem risco (ausência de teste) | Nenhuma. |
| 9 | `lib/dayCenter.ts` (textos "vencido"/"vencida" em `buildDayCenterItems`-equivalente, linhas 283/365) | Único arquivo de teste que importa de `lib/dayCenter.ts` (`useDayCenterActions.test.ts`) importa só o TIPO `DayActionItem`, nunca a função geradora — a lógica de vencimento não é exercitada por nenhum teste. | Sem risco (ausência de teste) | Nenhuma. |
| 10 | `useNotificationsCenter.ts` ("vencido"/"vencida" em títulos de notificação-seed, linhas 53/106) | Strings estáticas de conteúdo demo — não são derivadas de nenhuma comparação de data. Sem teste próprio. | Falso positivo (texto estático, não comparação de data) | Nenhuma. |
| — | Varredura cruzada adicional (§ Método, item 3): `tasksMapper.test.ts`, `Financeiro.test.tsx`, `useSupabaseOpportunities.test.ts`, `useLocalOpportunitiesImport.test.ts`, `financeRepository.test.ts`, `useSupabaseFinanceTransactions.test.ts`, `QuoteToProjectDialog.test.tsx`, `projectsMapper.test.ts` — datas próximas de hoje encontradas, mas em nenhum caso comparadas contra um `new Date()` de threshold no código sob teste (mappers só traduzem campos; `Financeiro.tsx`'s filtro "próximos 30 dias" — único ponto real de comparação de data encontrado no arquivo — não tem NENHUM teste que o exercite, confirmado por grep). | Falso positivo / sem risco | Nenhuma. |

---

## 2. Fechamento

**1 mina real ativa encontrada, 0 corrigidas nesta rodada** — o único achado
com risco confirmado (#1) está em `ClientActivitiesTab.test.tsx`/
`buildFinanceEvents.ts`, território da Lane E (mesmo domínio do achado
original do G72) — por instrução explícita desta rodada, **não tocado**,
só listado. Nenhum arquivo da Lane B foi identificado como relevante pra
esta classe de achado durante a varredura (nenhuma mina encontrada fora do
território da Lane E).

**Provas por patch**: não aplicável — nenhum fix foi aplicado nesta rodada
(o único achado corrigível está fora do escopo autorizado). `npm run gates`
rodado em modo sanity (nenhuma linha de código tocada).

**Recomendação de correção pro achado #1** (pra quem estiver de plantão em
`ClientActivitiesTab.test.tsx`): trocar o default do factory
`makeCloudReceivable()` de `dueDate: "2026-08-20"` pra um valor relativo
(`new Date(Date.now() + 365*86400000).toISOString().slice(0,10)`, sempre 1
ano no futuro) ou um valor fixo suficientemente distante (`"2099-01-01"`,
mesmo valor já usado no fix pontual da linha 148) — mesma lição que
`QuotesSection.test.tsx` (`todayIso()`) já aplica corretamente pro domínio
de quotes.

**Recomendação sistêmica** (já registrada no G72 original, reafirmada
aqui): fixture de data sempre relativo ao momento do teste OU relógio
fixado via `vi.useFakeTimers()`/`vi.setSystemTime()` — nunca uma string
absoluta comparada contra tempo real. Nenhum outro caso do repo hoje viola
essa regra de forma ativa, além do achado #1.

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
