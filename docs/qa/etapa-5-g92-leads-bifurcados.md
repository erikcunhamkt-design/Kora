# Etapa 5 · G92 — consumidores de oportunidades/leads fora do CRM leem a fonte do CRM

Branch `etapa-5-g92-leads-bifurcados`, a partir de `b0101e9`. Sem DDL. **`CRM.tsx` intocado** (lane B, G91).

## Problema

`dayCenter.ts`/`buildCommercialEvents.ts` e outros consumidores liam `useLeads()` (localStorage) enquanto o CRM em modo Supabase (o default pós-flip) lista as oportunidades da **nuvem**. Efeitos: lead criado/editado na nuvem não gerava evento na Central do Dia nem na timeline do cliente; lead local gerava `/crm?lead=<id>` que a lista da nuvem não reconhecia (drawer não abria, sem erro). Mesma família do G74/G54 e da B4 de Tarefas.

## Varredura da classe — todo consumidor de `useLeads()` fora do CRM

`grep -rn "useLeads\b" src` (sem testes) + leitura direta do `localStorage` (`orbyt.leads.v1` só é lido por `useLeads.ts`):

| Consumidor | O que lê | Decisão |
|---|---|---|
| `hooks/useDayCenterData.ts` → `lib/dayCenter.ts` | follow-ups/atrasos de lead (eventos `/crm?lead=`) — alimenta `GreetingHero`, `DayCenterSummary`, Central do Dia | **bifurcado** |
| `components/clients/ClientActivitiesTab.tsx` → `buildCommercialEvents.ts` | "Oportunidade criada/ganha/perdida" + "Ver no CRM" | **bifurcado** |
| `components/clients/ClientProfileDrawer.tsx` (`CommercialTab`) | oportunidades do cliente (contagem e lista) | **bifurcado** |
| `components/clients/ClientActivityLogDialog.tsx` | select "oportunidade relacionada" | **bifurcado** (ids são hash numérico, `Number()` do select segue seguro) |
| `components/dashboard/KoraOnboarding.tsx` | passo "Criar oportunidade" | **bifurcado** |
| `components/vendas/QuotesSection.tsx` | seed do wizard por `?newQuote&opportunityId=` | **leitura bifurcada**; `updateLead` (escrita, vínculo orçamento→lead) **segue local** — ver "Fora do escopo" |
| `hooks/useLocalOpportunitiesImport.ts` | candidatos do import local→nuvem | **mantido local, por desenho** (a ferramenta de import lê o storage local) |
| `pages/Clientes.tsx` (`addLead`) | só escrita (criar lead a partir do cliente) | fora do escopo (escrita) |
| `components/crm/CreateCrmSupabaseQuoteDialog.tsx` | só `import type { Lead }` | n/a |
| `pages/CRM.tsx` | fonte própria (bifurcação inline) | **não tocado** (lane B) |
| Widgets de Início | `Index.tsx` só usa `usage.leads` do plan-context (contador, escrito pelo CRM); `SupabaseOperationalDashboardCard` já lê a nuvem direto | n/a |

## O que mudou

- **`hooks/useBifurcatedOpportunities.ts` (novo)**: `Lead[]`, mesma decisão do CRM — `workspace ? getCrmDataSource() : "local"`; em nuvem, `useSupabaseOpportunities({ includeArchived: true })` + `mapSupabaseOpportunityToLocalLead` (mapper real). Padrão de `useBifurcatedTasks`/`useBifurcatedFinance`. **G32**: o `enabled: !!workspaceId` fica no hook de baixo e a chave de cache é a do CRM (`includeArchived: true`) — sem fetch duplicado. **G30**: read-only, sem `setQueryData` (não há mutation).
- 6 consumidores trocam `useLeads()` por esse hook.
- **Links `?lead=`**: continuam `/crm?lead=${lead.id}`; agora `lead.id` é o id que o CRM usa em modo Supabase (o hash numérico estável do uuid, produzido pelo mapper) — o link abre o lead certo (G87 já compara por string).
- **Modo local intocado**: sem workspace ou com `kora.crm.dataSource.v1 = "local"`, o hook devolve exatamente `useLeads().leads`.

## Testes (dados da nuvem via mapper real; fixtures com uuid real; datas relativas — G72)

| Arquivo | Cobertura |
|---|---|
| `useBifurcatedOpportunities.test.ts` (novo, 5) | nuvem por default com o MESMO id do mapper do CRM, `clientId` uuid preservado, `includeArchived: true`, local explícito, sem workspace, nuvem vazia ⇒ vazio |
| `useDayCenterData.opportunities.test.ts` (novo, 4) | evento da Central do Dia **abre o lead certo**: o `?lead=` do evento, comparado com a lista que o CRM mostra (mapper real), acha ESTE lead; o lead local deixa de gerar evento em nuvem; regressões local/sem workspace |
| `g92.consumers.test.tsx` (novo, 2) | timeline do cliente (evento + "Ver no CRM" navega pra `/crm?lead=<id do mapper>`) e aba Comercial do drawer, com o lead local fantasma ausente |
| `KoraOnboarding.technicalSheet.test.tsx` (+2) | passo "Criar oportunidade" completa só com oportunidade da nuvem; demo não conta |
| `QuotesSection.test.tsx`, `ClientActivitiesTab.test.tsx`, `useDayCenterData.test.ts` | mocks ajustados para o hook novo (cenário **local** preservado: workspace nulo/`kora.crm.dataSource.v1="local"`) — nenhuma asserção alterada |

**Prova fail→fix→pass por patch (sem stash, G65):** com as 6 fontes revertidas e o hook removido, **5 testes falham** em 3 arquivos (+ o arquivo do hook falha na importação, 5 testes sem rodar) e 6 passam (regressões); com o patch reaplicado, **16/16**.

## Fora do escopo / observações (reportar)

- **Escrita de lead fora do CRM:** `QuotesSection` chama `updateLead(opportunityId, {quoteId, quoteTitle})` do hook local após criar o orçamento; para uma oportunidade da nuvem o `updateLead` local não acha nada (no-op) e o vínculo orçamento→oportunidade não é gravado na nuvem por esse caminho (o CRM tem fluxo próprio, `CreateCrmSupabaseQuoteDialog`). Mesma classe do G75 (sucesso sem efeito); **não tocado** — candidato a ID próprio.
- `Clientes.tsx` `addLead` (criar oportunidade a partir de um cliente) grava no storage local; em modo nuvem o lead não aparece no CRM. Idem: escrita, fora do escopo.
- Contagem `usage.leads` do plan-context é escrita pelo CRM; não verificada aqui.
