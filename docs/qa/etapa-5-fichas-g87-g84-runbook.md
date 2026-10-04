# Etapa 5 · Fichas Técnicas — rodada G87 (varredura de deep links) + G84 (código morto) + runbook

Branch `etapa-5-fichas-g87-g84-runbook`, a partir de `26fbd4b`. Sem DDL.

## G87 — varredura da classe "param de rota/deep link convertido pra número" (repo inteiro)

Comandos: `grep -rnE "Number\((searchParams|query|params|sp\b|url)|parseInt\((searchParams|query|params)|Number\(.*\.get\(|parseInt\(.*\.get\(|Number\(useParams|Number\(.*(Id|id)\)|parseInt\(.*[iI]d\b"` e `grep -rnE "searchParams\.get\(|useParams|params\.get\("` em `src/` (sem testes), mais `Number.isFinite|Number.isNaN|isNaN(|parseInt(` e `Number(` sobre `*Id`/`value`.

### Todos os leitores de parâmetro de rota

| Tela | Parâmetro | Tipo real do id | Antes | Estado |
|---|---|---|---|---|
| `Clientes.tsx` | `?client=` | **uuid** (cliente da nuvem) | `Number()` ⇒ NaN | corrigido em **G86** (`b65edb5`) |
| `Tarefas.tsx` | `?task=` | uuid | string (G73) | ok |
| `QuotesSection.tsx` | `?newQuote&clientId=` | uuid | string (G67) | ok |
| `QuotesSection.tsx` | `?newQuote&opportunityId=` | **hash numérico** do uuid (ver nota) | `Number()` | **G87 — string** (defensivo) |
| `QuotesSection.tsx` | `?quote=` | uuid | string | ok |
| `CRM.tsx` | `?newOpportunity&clientId=` | uuid | string (G64) | ok |
| `CRM.tsx` | `?lead=` | **hash numérico** do uuid | `Number()` + `isFinite` | **G87 — string** (defensivo) |
| `ProjectsSection.tsx` | `?projectId=` | uuid | string | ok |
| `Financeiro.tsx` | `?entryId=` | uuid | string | ok |
| `ClientTechnicalSheet.tsx` | rota `:clientId` | uuid | string (FP0) | ok |
| `Configuracoes`, `Vendas`, `Portfolio`, `Automacoes`, `Briefings`, `Financeiro` | `?tab=`, `?new=` | — (não é id) | string | n/a |
| `Clientes.tsx` | `?activity=` | string (id do log) | string | ok |
| `PublicClientSignup`, `PublicProfile`, `BriefingPublicForm` | `:slug`/`:token` | — | string | n/a |

### Equivalentes fora de leitor de rota (mesmo `Number()` sobre id)

| Onde | Situação | Decisão |
|---|---|---|
| `DayCenter.tsx:179`, `useDayCenterActions.ts:80` — `updateTask(Number(item.relatedId), …)` | já protegidos por G76/G77 (guarda contra uuid; só roda no caminho local) | ok, não alterado |
| `ClientActivityLogDialog.tsx:110` — `Number(relatedOpportunityId)` | valor vem de um `<Select>` de leads **locais** (`useLeads()`, id numérico) e o tipo do modelo é `ClientManualActivity.relatedOpportunityId?: number` | **não alterado** (mudar exigiria mudar o tipo do modelo; hoje não é alcançável com uuid). Ressalva registrada |
| `crmOpportunityMapper.ts` — `Number.parseInt(uuid.slice(0,12), 16)` | é o desenho: o lead da nuvem tem id **numérico** derivado do uuid (48 bits, seguro em double) | ok (é a razão pela qual o G87 é defensivo) |
| demais `Number(`/`parseInt(` | valores monetários, quantidades, datas (`isNaN(date)`), configurações | n/a |

### Resultado, com honestidade sobre a premissa

A premissa "id de entidade = uuid pós-flip" **não vale para oportunidades**: o `?lead=` e o `?opportunityId=` carregam o **hash numérico estável** produzido pelo mapper (`stableNumericIdFromUuid`), então `Number()` funcionava — o defeito era **latente**, não observado. A única conversão que quebrava com uuid real era a de Clientes (G86, já corrigida). Mesmo assim os 2 pontos passaram a comparar por string (`String(l.id) === raw`), por pedido, para padronizar com o G73/G86 e tirar a armadilha (qualquer id não numérico virava `NaN` e o seed/drawer era pulado em silêncio).

Testes (um por tela alterada):
- `QuotesSection.test.tsx` "G87" (3): id da nuvem **como o app o produz** (mapper real) abre o wizard preenchido; id **não numérico** (antes: NaN, seed pulado) preenche; regressão do numérico local.
- `CRM.test.tsx` "G87" (4): id da nuvem pelo mapper real abre o drawer; id **não numérico** (antes: NaN) abre; id inexistente não abre nada; regressão do numérico.
- Os casos "id da nuvem pelo mapper real" e "regressão" **passam também contra o código antigo** (o caso era latente); os de id não numérico são os que provam o fix.

**Observação nova (não é `Number`, sem ID — reportar):** os produtores de `?lead=` (`dayCenter.ts` ×2, `buildCommercialEvents.ts` ×2) leem `useLeads()` (leads **locais**), enquanto o CRM em modo Supabase (o default) lista as oportunidades da **nuvem**. Um link nascido de um lead local não encontra o lead na lista da nuvem — descompasso de fonte, não de tipo de id. Mesma família do "leitor bifurcado, produtor local" (G74/G54); não tocado.

## G84 — código morto da ficha removido

Confirmação por grep antes de remover (`grep -rn "ClientTechnicalSheetDialog\b" src`): o componente `<ClientTechnicalSheetDialog>` **só era referenciado pelo próprio arquivo e pelo seu teste**; `client-technical-sheet-helpers.ts` importa só o **tipo** `SectionId` e `ClientTechnicalSheet.tsx` importa as **seções** (`BrandingSection`, `PersonaSection`, …, `OverviewGrid`) — que continuam no arquivo. `onUpdateTechnicalSheet`: declarado/desestruturado em `ClientProfileDrawer.tsx` e nunca chamado; handler em `Clientes.tsx` nunca recebia chamada. **Nenhuma montagem ou uso encontrado ⇒ removido.**

| Removido | Mantido |
|---|---|
| `ClientTechnicalSheetDialog` (componente, `export default`) em `ClientTechnicalSheetDialog.tsx` | todas as seções exportadas, `OverviewGrid`, `SectionId`, constantes de limite — o arquivo segue como biblioteca de seções da página |
| prop `onUpdateTechnicalSheet` em `ClientProfileDrawer.tsx` | — |
| handler `onUpdateTechnicalSheet` em `Clientes.tsx` (que cairia em G75 se alguém o ligasse) | — |
| imports que ficaram sem uso | — |
| `ClientTechnicalSheetDialog.test.tsx` (3 testes) | **convertido** em `ClientTechnicalSheetOverview.test.tsx` (4 testes, `OverviewGrid` direto) |

Justificativa do teste: os 3 testes antigos montavam o Dialog só pra olhar o **overview** — lógica compartilhada e viva (`OverviewGrid` + `statusOf` + invariante G63 "a senha nunca é renderizada"). Mantê-la coberta foi preferível a apagar; a bifurcação de leitura por cliente tem cobertura própria (`useBifurcatedTechnicalSheet.test.ts`, `technicalSheet.consumers.uuid.test.tsx`). Acrescentei 1 teste (concorrentes preenchidos contam como seção preenchida — G83). Sem efeito em runtime: o componente nunca foi montado.

## Runbook de Fichas

`etapa-5-flip-fichas-runbook.md`: **Casos 4 e 6 completados** com o comportamento real pós-FP0/FP1 — nomes reais de botões/abas lidos no código, convenção de path do Storage (`<workspace>/<client_uuid>/technical-sheet/{logo|materials}/…`), SELECTs de prova depois da ação (`raw_payload->'competitors'`, `branding->>'logoStoragePath'`, `data:image` na coluna = 0, descrição/tags, `storage.objects`), teto de 1 MB (`updated_at` inalterado) e a distinção "upload ≠ salvar a ficha" (o arquivo sobe ao escolher, mas só entra na ficha em "Usar/Adicionar à Ficha Técnica local"). Caso 5 atualizado com o comportamento atual de Acessos (nota + toast); texto/armazenamento definitivos seguem `[completar pós-FP2]`. **Caso 0 permanece** como a confirmação ao vivo do G82.

## Draft 6.1 (coluna `competitors`) — item OPCIONAL do próximo pacote §8-b

Não é pré-requisito de nada (a leitura já funciona sem a coluna, via `raw_payload`). Se o operador quiser a coluna no próximo pacote §8-b (sessão de DDL do operador — Code não aplica):

```sql
-- 6.1 (doc da Fase A §6) — coluna dedicada
ALTER TABLE public.client_technical_sheets
  ADD COLUMN IF NOT EXISTS competitors jsonb NOT NULL DEFAULT '[]'::jsonb;
-- Backfill (somente após export manual, protocolo §8-b):
-- UPDATE public.client_technical_sheets
--   SET competitors = COALESCE(raw_payload->'competitors','[]'::jsonb)
--   WHERE competitors = '[]'::jsonb AND raw_payload ? 'competitors';
```

Estado do código frente à coluna: a **leitura** já prefere a coluna quando existe e tem dados e cai no `raw_payload` quando vazia (`supabaseTechnicalSheetToLocalMapper.ts`, G83). A **escrita** segue só em `raw_payload`.

**Follow-up trivial de escrita (fazer só DEPOIS de a coluna existir, no mesmo PR de um próximo pacote):** em `mapLocalToSupabaseSheet` acrescentar `competitors: Array.isArray(localSheet.competitors) ? localSheet.competitors : []` ao objeto retornado e `competitors?: Record<string, unknown>[]` a `SupabaseTechnicalSheetInput`; manter a cópia em `raw_payload` por uma versão (rollback seguro); teste de ida-e-volta já cobre a preferência coluna>raw. **Não fazer antes da DDL:** gravar uma coluna inexistente derruba o upsert inteiro.

## Fora do escopo

`accesses` (FP2), `WhatsApp*`, `tasksMapper`, dialogs de Projetos: intocados.
