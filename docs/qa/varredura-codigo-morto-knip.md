# Varredura global de código morto e exports órfãos (classe G84) — knip

> **Rodada:** lane B, branch `etapa-5-dead-code-knip`, a partir de `origin/main` = `3656230`.
> **Escopo:** remover só o que é **comprovadamente** morto, sem tocar comportamento de produção. Dúvida = listar, não remover.
> **Lição G84 aplicada:** *importação ≠ montagem*. Aqui a prova de "morto" é por **grafo de importação a partir das entradas reais** (knip) **e** por `grep` do nome em `src/`, `supabase/` e `docs/`, **e** pela conferência das worktrees/branches das outras lanes (nenhuma importa o que foi removido).

## 1. Ferramenta e configuração

- **knip 6** (`devDependency`), configuração em [`knip.json`](../../knip.json); roda com **`npm run dead-code`** (`knip --no-exit-code` — **não bloqueante**, nunca falha o CI; é um relatório pra quem for mexer no código).
- **Entradas:** o `vite` plugin do knip já enxerga `index.html → src/main.tsx` (rotas, `React.lazy` e `import()` dinâmicos são seguidos); o plugin do `vitest` enxerga os arquivos de teste (um export usado só por um teste conta como usado); `supabase/functions/*/index.ts` e `scripts/*.mjs` entram como entradas separadas.
- **Ignorados por política (falso positivo / geração):**
  - `src/integrations/supabase/types.ts` — **gerado** pelo Supabase (6 exports órfãos por natureza).
  - exports/tipos de `src/components/ui/**` — kit **shadcn** (cada arquivo exporta a família inteira de subcomponentes: `DialogPortal`, `SheetClose`… 44 exports "órfãos" que são a API do kit, não código morto).
  - `ignoreDependencies: ["npm"]` — as Edge Functions (Deno) importam por `npm:`; o knip lê isso como um pacote chamado `npm` não listado (8 achados, todos falso positivo).
  - `rules.duplicates: off` — `export default X` + `export { X }` no mesmo módulo (2 achados, estilo).
- **Como ler:** *Unused files* = ninguém importa; *Unused dependencies* = nenhum arquivo **alcançável** importa; *Unused exports/types* = nenhum outro arquivo (nem teste) importa o nome. O que sobra no relatório hoje são **69 achados conhecidos** — 26 mantidos de propósito (§4) e 43 adiados por serem de outra lane (§4.1); qualquer item **novo** aparece em cima dessa linha de base.
- **Limite honesto:** o knip não vê uso por **string** (nomes em `localStorage`, rotas montadas em runtime) nem código que só existe em outra branch. Por isso cada remoção abaixo foi conferida por `grep` e contra as branches das outras lanes.

## 2. Classificação do resultado inicial (118 arquivos com achado)

| Classe | Achado inicial | Ação |
|---|---|---|
| **(b) arquivo sem importador** | 31 arquivos | **31 removidos** (10 de app + 21 do kit shadcn) |
| **(c) dependência sem uso** | 17 dependências + 1 devDependency | **18 removidas** (todas com `grep` = 0 fora do kit removido) |
| **(a) export / tipo sem consumidor** | 131 no app (+ 44 do kit + 6 gerados) | **62 tratados** (27 declarações mortas removidas; 35 `export` retirados por serem usados só dentro do próprio arquivo); **26 mantidos de propósito** (§4) e **43 adiados** por estarem em arquivos de fichas/catálogo/WhatsApp/Edge (§4.1) |
| **(d) falso positivo** | 8 `npm:` Deno + 2 `default`/nomeado + kit/gerado | configurado no `knip.json` |

### 2.1 Arquivos removidos — (b)

Código de app (nenhum importador; nenhuma rota, `lazy` ou `import()`; nenhuma branch/worktree de lane importa; nenhum teste os cobria):

| Arquivo | Linhas | Observação |
|---|---|---|
| `src/components/day/DayCenter.tsx` | 729 | **G84 clássico**: 26 commits (inclusive o fix do G77 em `completeTask`!) num componente **nunca montado** — a Central do Dia real é `pages/CentralDoDia.tsx` + `DayCenterSummary`. Os docs históricos que o citam como "consumidor" (`etapa-5-flip-*-fase-a.md`) descrevem um mapa de leitura de código, não montagem. |
| `src/components/automacoes/WhatsAppSection.tsx` | 193 | 17 commits, nunca montado. |
| `src/components/whatsapp/templates/{TemplatesLibrary,CreateTemplateDialog}.tsx`, `src/hooks/useWhatsAppTemplates.ts`, `src/lib/whatsapp/templateVariables.ts` | 331+289+127+44 | cluster fechado (só importam entre si); os modelos reais usam `TemplatesBackendPage`/`TemplateFormDialog`. |
| `src/components/whatsapp/audiences/AudiencesPanel.tsx`, `campaigns/CampaignModeBanner.tsx` | 117+100 | nunca montados (as telas montadas são as `*BackendPage`). |
| `src/hooks/useWhatsAppMock.ts` | 96 | mock sem uso. |
| `src/components/accessibility/AdaptiveText.tsx` | 35 | sem uso. |

> **WhatsApp:** os 7 arquivos acima são um cluster **sem nenhuma aresta de entrada** no grafo (nem rota, nem lazy, nem teste), sem menção em `docs/` como feature planejada, e **nenhuma worktree/branch da lane C/D os referencia** (conferido em `Kora-lane{A,C,D,E}` e em 12 branches locais). Se mesmo assim alguém os quiser de volta: `git show 3656230:<caminho>` (estão no histórico).

Kit **shadcn** (`src/components/ui/`): `alert, aspect-ratio, calendar, carousel, chart, context-menu, drawer, form, hover-card, input-otp, menubar, navigation-menu(+trigger-style), pagination, radio-group, resizable, toggle(+variants), toggle-group, use-form-field, use-toast` — **21 arquivos, nenhum importado**. Reprodutíveis a qualquer momento com `npx shadcn@latest add <nome>` (o `components.json` continua no repo). O `ui/use-toast.ts` removido era um duplicado de `hooks/use-toast.ts` (que segue em uso).

### 2.2 Dependências removidas — (c)

`@hookform/resolvers`, `react-hook-form`, `zod`, `date-fns`, `react-day-picker`, `embla-carousel-react`, `input-otp`, `react-resizable-panels`, `vaul`, `@radix-ui/react-{aspect-ratio,context-menu,hover-card,menubar,navigation-menu,radio-group,toggle,toggle-group}` e a devDependency `@tailwindcss/typography` (**nunca** estava em `plugins` do `tailwind.config.ts`). Prova: `grep` do nome do pacote em `src/`, `supabase/`, `scripts/` e configs = 0 fora dos arquivos do kit removidos; `zod`, `date-fns` e `@hookform/resolvers` não tinham **nenhum** importador (nem o kit). **23 pacotes saem do lock** (18 diretos + transitivos: `embla-carousel`, `lodash.*`, …). `bun.lock`/`bun.lockb` **não** foram mexidos (já divergiam do `package-lock.json`, que é o que o CI usa).

### 2.3 Exports / tipos — (a)

- **Declarações mortas removidas (27):** em `src/types/domain.ts`, o bloco inteiro de tipos duplicados **Quotes / Finance / Tasks / Projects** (172 linhas, 23 tipos — `Quote`, `Transaction`, `Task`, `Project`, `QuoteStatus`, `TxType`…; as definições reais vivem em `useQuotes`/`useFinance`/`useTasks`/`useProjects` e **0** arquivos importavam estes de `@/types/domain`) + `FINANCE_CATEGORIES` ("legacy… fallback"), `CONTENT_STATUS_LABEL` ("legacy label kept"), `DAY_PRIORITY_LABEL` e o alias `TASK_PROJECT_PALETTE`.
- **`export` retirado (35, em 22 arquivos):** nome usado **só dentro do próprio arquivo** (ex.: `initialClients`, `initialTasks`, `initialQuotes`, `newPipelineId`, `EMPTY_FINANCE_IMPORT_MAPS`, `EMPTY_TASK_IMPORT_MAPS`) — o código continua o mesmo; só deixa de ser API pública. Aplicado por script (`export X` → `X`), com `tsc` limpo depois; **checado contra as 12 branches locais ativas e as 4 worktrees das outras lanes** (0 importam esses nomes dos módulos de origem). **Não foram tocados** os arquivos de **fichas** (congeladas), **catálogo** (lane A), **WhatsApp** e **Edge Functions `_shared`** (lanes C/D, deploy): ver §4.1.

## 3. Medição

| | antes (`3656230`) | depois | |
|---|---|---|---|
| arquivos removidos | — | **31** (`git rm`) | 10 app + 21 kit |
| linhas removidas (tudo, exceto `package-lock.json` e docs) | — | **−4004 / +63** (as +63 são `export` retirado, `knip.json` e o script `dead-code`) | |
| dependências | 17 prod + 1 dev a menos; +1 dev (`knip`) | **−18 +1** | 23 pacotes a menos no lock; `knip` adiciona 57 entradas (binários nativos opcionais do `oxc`) |
| bundle `vite build` (chunk principal) | JS **2.643,33 KB** (gzip 671,52), CSS **140,60 KB** (gzip 22,56); `dist/` total **3720 KB** (25 arquivos) | JS **2.643,34 KB** (gzip 671,55), CSS **128,91 KB** (gzip 20,77); `dist/` total **3709 KB** | **JS inalterado** (nada disso estava no grafo — código morto não entra no bundle); **CSS −11,7 KB** (−8%; o Tailwind varria as classes dos arquivos mortos) |
| testes | 178 arquivos / 2134 testes | **178 / 2134** | nenhum teste removido: não havia teste de caracterização dos arquivos mortos (qualquer um teria contado como importador) |

Ganho real: **menos superfície de manutenção, de dependências e de install** (e o CSS menor), não bundle de JS.

## 4. Mantidos de propósito (26 achados que continuam no relatório) — dúvida = listar

| Achado | Por que fica |
|---|---|
| `useSupportTickets.ts`: `SupportConversation`, `SupportMessage` | comentário no próprio arquivo: *"Future chat structure (not active yet)"* — placeholder deliberado |
| `lib/supabase/errors.ts`: `unwrap`; `lib/i18n/locale.ts`: `pickLocale`; `lib/sound/soundManager.ts`: `stopAllKoraSounds` | utilitários genéricos documentados, sem consumidor hoje — API pequena que custa pouco manter |
| `lib/whatsapp/featureFlags.ts`: `setCampaignSenderEnabled`, `CAMPAIGN_SENDER_FLAG_KEY`; `whatsappCampaignsRepository.ts`: `updateCampaignStatus`; `WhatsAppChatInput.tsx`: `StickerPickPayload` | **WhatsApp (lane C/D)** — sem consumidor, mas é o par setter/repo do sender de campanhas; decisão deles |
| `Bell` (`NotificationInbox`), `AgentStatus`, `Recurrence`, `SubTask`, `TaskComment`, `SupabaseClientInput`, `WorkspaceRole`, `CampaignStatus`, `SimulationInfo`, `initialProjects`, `todayISO`, `manualToEvent`, `CLOUD_TO_LOCAL_STATUS`, `CLOUD_TO_LOCAL_PROJECT_STATUS` | o **nome** aparece em alguma worktree de outra lane (muitos são coincidência de nome com outro módulo, mas sem prova de que não é import → mantidos exportados) |
| `ClientProfileDrawer`/`ClientLibrarySection` `default`; `CLIENT_ACTIVITY_LOGS_KEY` (`export { STORAGE_KEY as … }`) | export duplicado/alias — estilo, não código morto |

### 4.1 Adiados (43 `export`s só usados dentro do próprio arquivo — retirar o `export` é seguro, mas os arquivos são de outra lane)

Não toquei por regra da rodada (fichas congeladas) e pra não gerar conflito de merge com lanes que editam esses arquivos agora. Lista completa a qualquer momento: `npm run dead-code`.

| Área (dono) | Arquivos / nomes |
|---|---|
| **Fichas** (congelada) | `ClientTechnicalSheetDialog`: `LOGO_MAX_BYTES`, `ASSET_FILE_MAX_BYTES`, `ASSETS_QUOTA_BYTES`; `technicalSheetMapper`: `isBinaryUrl`; `useLocalTechnicalSheetsImport`: `TechnicalSheetCandidate` |
| **Catálogo** (lane A) | `catalogCloudContext`: `resolveCatalogMode`; `useCatalogSource`: `CATALOG_SOURCE_EVENT`; `catalogRepositoryShared`: `CATALOG_UNAVAILABLE_CODE`; `catalogImport`: `emptyCatalogMeta`, `CatalogRef`, `CatalogImportFailure`; `catalogMapper`: `DEFAULT_BILLING_TYPE`, `isBillingType`; `catalogProductPlanMapper` (9 nomes); `useServices`: `initialServices` |
| **WhatsApp** (lanes C/D) | `flowTransfer`, `flowValidation` (2), `flowSimulatorModel` (6), `WhatsAppBotConfig`, `WhatsAppMessageBubble`, `useWhatsAppInstance`, `useWhatsAppOfficial` (tipos/constantes) |
| **Edge `_shared`** (lanes C/D, deploy) | `botFlowMenu` (2), `botFlowSimulation` (2), `knowledgeLoader`, `anthropicParser`, `claimOnReply` (tipos) |

Reavaliar numa próxima rodada, **depois** dos merges das lanes A (catálogo/CT6) e C/D.

## 5. Como usar daqui pra frente

```bash
npm run dead-code        # relatório; exit code sempre 0
npx knip --include files # só arquivos sem importador
```

Antes de criar um componente "preparatório" que ainda não será montado, deixe-o **fora** do grafo de propósito (comentário `// reservado para <G…>`) e adicione o caminho a `ignore` do `knip.json` — assim ele não fica indistinguível de um órfão esquecido (a lição do `DayCenter.tsx`).
