# Etapa 5 · G94 — rodada (c) "Mais usado" + CT5 (ponte catálogo ↔ orçamento)

Branch `etapa-5-g94-ct5-maisusado-ponte`, a partir de `285d990` (G95-catálogo + runbook em `main`). **Sem DDL, sem flip.**

**Pré-condição verificada (`git fetch`, tip `285d990`):** o G98 da lane B está em `main` (`22f3400`) — `quoteMapper.ts` grava `service_id` (`resolveQuoteFk`: uuid passthrough, id legado pelo mapa do import, senão `null`) e lê `serviceId`; `src/services/quotes/quoteServiceCatalog.ts` exporta `countServiceUsage` e `isServiceSelectableInQuotes`; `useBifurcatedQuotes` existe.

> **Não tocados:** `quoteMapper.ts` (lane B — só **lido/importado** nos testes), Clientes/Biblioteca (lane E), Fichas, WhatsApp*. **Autorização cruzada usada em `QuotesSection.tsx` (só o bloco "+ Adicionar serviço do catálogo" e o item resultante):** 4 pontos, listados em §2.

## (c) "Mais usado em orçamentos" — `ServicesSection`

- **Modo nuvem do catálogo:** conta por `serviceId` (uuid) os orçamentos pela **fonte de orçamentos** (`useBifurcatedQuotes`) com `countServiceUsage` (o patch da lane B no G98 do catálogo).
- **Onde o `useBifurcatedQuotes` roda:** dentro do provider de nuvem do catálogo (`CatalogDataProvider withQuotes`, só montado com a flag em `"supabase"`), exposto por contexto. **Não** foi chamado direto no `ServicesTab` porque isso reintroduziria `useSupabaseQuotes` (QueryClient + fetch) no **modo local**, que é o padrão e hoje não tem hook de nuvem nenhum (regressão por construção; o `ServicesSection.test.tsx` original, sem providers, continua passando sem alteração).
- **Modo local (e schema pendente, que cai no local):** segue contando os orçamentos **locais** — os ids de serviço locais (`svc-…`) só casam com orçamentos locais; os orçamentos da nuvem guardam uuid. Por isso o patch literal da lane B (`useBifurcatedQuotes()` sempre) foi adaptado: usar sempre a fonte de orçamentos daria contagem 0 num catálogo local com orçamentos na nuvem.
- **Frases fósseis tiradas do banner:** "A métrica “Mais usado em orçamentos” ainda não lê a nuvem." e "O seletor de serviços dos orçamentos ainda usa o catálogo local deste navegador." (ambas passaram a ser falsas). Fica só a do Checkout (continua local). Runbook: Caso 13 atualizado.

## CT5 — wizard de orçamento (`QuotesSection`)

Em modo **nuvem** do catálogo o select **"+ Adicionar serviço do catálogo"** lista os serviços de `useBifurcatedServices` (`active && availableInQuotes !== false`, **o mesmo filtro da lane B** — `isServiceSelectableInQuotes`, que o select já usava), e o item resultante recebe `serviceId` = **uuid** (passthrough G67) para o mapper da lane B gravar `quote_items.service_id`. Em modo **local**: intocado.

**Os 4 pontos de `QuotesSection.tsx` (todos no bloco/provedor do catálogo):**
1. `import { useServices }` → `import { useBifurcatedServices }` + `import { CatalogDataProvider }`;
2. `const { services } = useServices();` → `const { services, mode: catalogMode } = useBifurcatedServices();` (o resto — `addServiceItem`, o `<select>` e o filtro — **não mudou**: `addServiceItem` já gravava `serviceId: svc.id`; com a lista da nuvem, `svc.id` é o uuid);
3. `<NewQuoteWizard …/>` embrulhado em `<CatalogDataProvider>` (o provider só monta hooks de nuvem com a flag em `"supabase"`; sem a flag renderiza só o filho);
4. na linha de ajuda do select, o sufixo `" Catálogo lido da nuvem (Supabase)."` quando `catalogMode.source === "supabase"` (a frase original — que o teste da lane B procura — não mudou).

**Nome/preço copiados no momento da seleção — confirmado e mantido:** `addServiceItem` grava `name: svc.name` e `unitPrice: svc.price` no item; o orçamento não referencia o serviço por preço. Teste: o serviço muda na nuvem **depois** de escolhido (999/renomeado) e o orçamento salvo mantém 100/nome original.

**Degradação:** tabela do catálogo ausente em modo nuvem ⇒ o wizard cai no catálogo **local** (serviceId local; `quoteMapper` grava `null` se o serviço não foi importado — nunca o id cru) e a ajuda **não** diz "lido da nuvem".

## `showInPublicCatalog` — decisão (a)
Toggle do modal de serviço: **"Selo interno “Portfólio” — não publica nada"** (antes: "Mostrar no catálogo público (em breve)", que prometia o que o código não faz — G29/G96). O badge "Portfólio" do card ganhou `title="Selo interno — não publica nada"`. O dado já marcado pelos usuários é preservado; nenhum consumidor público foi criado.

## Testes (uuid real)
- `ServicesSection.catalog-source.test.tsx` (+8, agora 15): contagem por `serviceId` uuid nos orçamentos da nuvem e contador "N× em orçamentos" no card; modo nuvem **não** conta orçamentos locais; **regressão local** (conta os locais, `useSupabaseQuotes` **nunca** chamado); schema pendente volta a contar os locais; banner sem frases fósseis; rótulo "Selo interno…" (e sem "Mostrar no catálogo público"/"(em breve)"); badge com `title`.
- `QuotesSection.catalog-bridge.test.tsx` (novo, 5): **local** (sem QueryClient, lista os locais, `serviceId` local, nome/preço copiados, zero repositório); **nuvem** (lista só ativos && `availableInQuotes`, não mistura o local, ajuda diz a fonte; item com `serviceId` uuid → orçamento criado com ele → `mapLocalQuoteItemToSupabaseItem(item).service_id` = uuid; snapshot de preço/nome); **schema pendente** cai no local.
- Arquivo próprio para o wizard (não toca o `QuotesSection.test.tsx` da lane B); os testes da lane B (`QuotesSection.test.tsx`, G96, `quoteServiceCatalog.test.ts`) passam sem alteração.

**Prova fail→fix→pass por patch (sem stash, G65):** patch dos 4 fontes (`catalogCloudContext.ts`, `CatalogDataProvider.tsx`, `ServicesSection.tsx`, `QuotesSection.tsx`), `git apply -R` ⇒ **8 testes falham** (3 do wizard em nuvem + 5 de ServicesSection: contagem, não-contagem local, banner, rótulo, badge); os de regressão local passam nos dois lados (de propósito — provam que o local não mudou). `git apply` ⇒ **20/20**.

## Pendências
- Homologação ao vivo: runbook **Caso 16** (novo) — só depois do pacote §8-b; a **FK** `quote_items_service_id_fkey` (pacote §2.5) é opcional (passo 16.10).
- Checkout na nuvem (CT6), flip (CT7), robô (lane D), Biblioteca M1–M4 (lane E).
