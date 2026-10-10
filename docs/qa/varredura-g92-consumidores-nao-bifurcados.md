# Varredura classe G92/B4 — consumidores fora dos módulos principais que liam fonte LOCAL

> Escopo desta rodada: KoraOnboarding + widgets de Início/Dashboard, pros
> domínios **Clientes/Projetos/Tarefas/Vendas/Financeiro** (Tarefas não
> apareceu em nenhum consumidor real desta varredura — ver nota em §3).
> Oportunidades/leads (CRM) são o próprio G92 do catálogo
> (`kora-hub-auditoria-e-plano.md`) — escopo da lane A, **não tocado aqui**.

---

## 1. Como a varredura foi feita

Grep por `from "@/hooks/useClients"` / `useProjects` / `useTasks` /
`useQuotes` / `useFinance` em todo `src/` (93 arquivos), filtrando os que já
pertencem aos 6 módulos principais (Clientes/CRM/Projetos/Tarefas/Vendas/
Financeiro — arquivo próprio da tela, seus hooks/mappers/repositories, ou
consumidores já confirmados bifurcados em rodadas anteriores). O que restou:
todos os arquivos sob `components/dashboard/`, `pages/Index.tsx`,
`components/settings/` e um caso de borda em `components/projetos/`
(`ContentSection.tsx`, ver §4).

## 2. Tabela — arquivo ↔ fonte atual ↔ hook bifurcado ↔ ação

| Arquivo | Fonte lida | Hook bifurcado | Ação nesta rodada |
|---|---|---|---|
| `KoraOnboarding.tsx` — step1 (cliente) | `useClients()` local | `useClientsDataSource()` (já existia, G44) | **Trocado** |
| `KoraOnboarding.tsx` — step2 (ficha técnica) | `useClients()` local, só campo `technicalSheet` | nenhum — campo é local-only por natureza (G82) | **Mantido de propósito** — não é bug, ver §3 |
| `KoraOnboarding.tsx` — step3 (oportunidade) | `useLeads()` local | não existe ainda (seria `useBifurcatedOpportunities`) | **Fora de escopo** — é o próprio G92 do catálogo, lane A |
| `KoraOnboarding.tsx` — step4 (orçamento) | `useQuotes()` local | não existia — **criado `useBifurcatedQuotes()`** | **Trocado + hook novo** |
| `KoraOnboarding.tsx` — step5 (recebível/projeto) | `useFinance()` + `useProjects()` locais | `useBifurcatedFinance()` / `useBifurcatedProjects()` (já existiam) | **Trocado** — removia uma "limitação aceita" documentada (Fase A do flip de Projetos) |
| `hooks/useDayCenterData.ts` (clients) | `useClients()` local | `useClientsDataSource()` | **Trocado** |
| `hooks/useDayCenterData.ts` (quotes) | `useQuotes()` local | não existia — **criado `useBifurcatedQuotes()`** | **Trocado + hook novo** — alimenta `DayCenterSummary.tsx`/`GreetingHero.tsx`/`DayCenter.tsx`/`CentralDoDia.tsx` de uma só vez |
| `hooks/useDayCenterData.ts` (leads) | `useLeads()` local | nenhum ainda | **Fora de escopo** — G92 do catálogo, lane A, não tocado |
| `components/day/DayCenter.tsx` (escrita: `useTasks()`/`useFinance()`) | locais, de propósito | — | **Não é bug** — escrita da Central do Dia é local-only por decisão de desenho já documentada (`useDayCenterActions.ts`), separada da leitura (já bifurcada) |
| `components/dashboard/FinanceSummary.tsx` | nenhuma — **100% hardcoded** (`revenue = 6500`, `target = 10000`) | n/a | **Fora de escopo** — não há leitura de domínio pra trocar, é placeholder desde sempre |
| `components/dashboard/CRMPipeline.tsx` | nenhuma — **100% hardcoded** (array de colunas/itens fixo) | n/a | **Fora de escopo** — mesmo caso, placeholder |
| `pages/Index.tsx` — array `metrics` (topo do arquivo) | nenhuma — **100% hardcoded** | n/a | **Fora de escopo** — placeholder, nunca leu hook nenhum |
| `components/dashboard/{RecentTasks,TodayTasks,NextActions,GoalsSection,PerformanceChart,StudioProgress,CriticalAlert}.tsx` | n/a | n/a | **Código morto** — confirmado por grep, nenhum é importado/renderizado em lugar nenhum do app. Não tocado (fora do escopo desta rodada limpar código morto) |
| `components/settings/SupabaseQuotesViewerCard.tsx` | `useSupabaseQuotes()`, sempre nuvem | n/a | **Fora de escopo, por desenho** — é um card de operador ("viewer"), existe especificamente pra inspecionar a nuvem direto, nunca deveria respeitar o seletor de fonte |
| `components/projetos/ContentSection.tsx` (2 call sites) | `useClients()` local — só para o seletor/filtro de cliente do calendário editorial | `useClientsDataSource()` já existe | **AMBÍGUO — reportado, NÃO corrigido.** Ver §4 |
| `components/clients/activityTimeline/build*Events.ts` + `ClientActivitiesTab.tsx` | já bifurcado — funções puras recebem `Task[]`/`Project[]`/`Transaction[]` já bifurcados do caller | — | **Confirmado correto** (rodadas anteriores do módulo Clientes) — fora do escopo desta varredura, só confirmação |
| `components/projects/CreateProjectBaseTasksDialog.tsx` | já tinha checagem de duplicidade coerente (confirmado na rodada do G90) | — | **Confirmado correto**, não re-tocado |

## 3. Nota — "Tarefas" não apareceu em nenhum consumidor real

A instrução desta rodada cita "clientes, projetos, tarefas, orçamentos"
como os 4 domínios dos passos 1/3/4/5 do onboarding. Pela leitura completa
de `KoraOnboarding.tsx`, **nenhum step lê `useTasks()`** — os steps são:
1 = cliente, 2 = ficha técnica (local-only por natureza, G82), 3 =
oportunidade (leads, fora de escopo), 4 = orçamento, 5 = recebível-ou-projeto
(financeiro + projetos). Não adivinhei um step de tarefas que não existe —
reportando a divergência em vez de inventar uma correção. O único
consumidor real de `tasks` fora do módulo de Tarefas é
`useDayCenterData.ts`, e esse **já estava bifurcado** desde a Fase B do
Pacote do Flip de Tarefas (`useBifurcatedTasks()`, comentário no próprio
arquivo) — nada a corrigir ali. Se a lane A/revisor tinha em mente um
consumidor específico de tarefas que não apareceu nesta varredura, pedir
o caminho exato pra investigar à parte.

## 4. Caso de borda — `ContentSection.tsx` (calendário editorial)

Fica em `components/projetos/`, é renderizado como a aba "Conteúdo" da
MESMA página (`Portfolio.tsx`) que hospeda `ProjectsSection.tsx` (aba
"Projetos") — mesmo arquivo, mesma rota. Por um lado isso sugere módulo
Projetos (fora de escopo desta varredura); por outro, a feature em si
(calendário editorial/conteúdo) não é "gestão de projetos" e os 2
`useClients()` ali são só pra popular um seletor/filtro de cliente no
calendário, não pra ler estado de projeto. Não corrigido nesta rodada —
decisão de escopo que pede confirmação do revisor antes de tocar (mesma
disciplina de reportar divergência em vez de assumir).

## 5. Hook novo criado — `useBifurcatedQuotes.ts`

Não existia hook bifurcado pra orçamentos fora da tela principal de Vendas
— criado em `src/hooks/useBifurcatedQuotes.ts`, mesmo padrão de
`useBifurcatedFinance.ts`/`useBifurcatedTasks.ts` (read-only, 3 linhas:
`useQuotes()` local + `useSupabaseQuotes()` nuvem, escolhido por
`getQuotesDataSource()`). `useSupabaseQuotes()` já é G32-compliant
(`enabled: !!workspaceId`) e suas mutations já são G30-compliant (gravam a
própria resposta no cache) — nada a ajustar ali, só reusar.

## 6. Testes

- `useBifurcatedQuotes.test.ts` (novo) — modo local explícito, modo
  Supabase (default pós-flip e explícito) — mesmo molde de
  `useBifurcatedFinance.test.ts`.
- `useDayCenterData.test.ts` — mocks atualizados (`useClientsDataSource`/
  `useBifurcatedQuotes` no lugar de `useClients`/`useQuotes` crus) + 2
  testes novos com dados de fonte NUVEM via mapper real (lição G82: fixture
  local mascara a classe) — um orçamento e um cliente só-nuvem (sem
  contraparte local) aparecem no resultado da Central do Dia.
- `KoraOnboarding.technicalSheet.test.tsx` — mocks atualizados pros 4 hooks
  novos/trocados; 1 teste existente ajustado (`useClientsDataSource`
  precisa refletir o mesmo cliente local que `useClients()` já tinha, já
  que step1 agora lê de lá).
- Prova fail→fix→pass por patch, sem stash (G65) — ver relatório da sessão.

## Referências

- `docs/architecture/kora-hub-auditoria-e-plano.md` — G92 (leads/CRM, lane
  A, não tocado aqui), B4 de Tarefas (`useBifurcatedTasks`, precedente
  direto desta classe de fix).
- `src/hooks/useBifurcatedFinance.ts`/`useBifurcatedProjects.ts`/
  `useBifurcatedTasks.ts` — padrão seguido pelo hook novo.
- `src/hooks/useClientsDataSource.ts` — hook bifurcado de clientes (G44),
  reusado sem alteração.

**PARADO aqui — commit local, sem push/merge. §18.**
