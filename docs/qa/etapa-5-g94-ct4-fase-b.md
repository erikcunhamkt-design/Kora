# Etapa 5 · G94 — CT4: Fase B do catálogo (leitura bifurcada + escrita nativa atrás de flags, **sem flip**)

Branch `etapa-5-g94-pacote-8b-ct4`, a partir de `ff0a999` (CT2 + CT3 em `main`). **Sem DDL, sem flip:** os defaults são LOCAL; o flip é o CT7. Pacote do operador desta rodada: [`etapa-5-g94-pacote-operador-8b.md`](etapa-5-g94-pacote-operador-8b.md).
Plano: [`etapa-5-flip-catalogo-materiais-fase-a.md`](../architecture/etapa-5-flip-catalogo-materiais-fase-a.md) §9.1. Rodadas anteriores: [M0+CT1](etapa-5-g94-m0-ct1.md), [CT2+CT3](etapa-5-g94-ct2-ct3.md).

> **Congelamento de Fichas respeitado** (nenhum `ClientTechnicalSheet*`, `useSupabaseTechnicalSheet`, `useBifurcatedTechnicalSheet`, `resolveSheetClientId`, `accessesLocalStore`, aba "Ficha Técnica"). **Não tocados:** `QuotesSection`/`quoteMapper`/wizard de orçamento (CT5, rodada própria — lane B/E), WhatsApp*, `CRM.tsx`, Projetos, Tarefas. Arquivos existentes editados: `config/flags.ts` (+chaves/getters), `ServicesSection.tsx`, `Configuracoes.tsx` (+import e 2 cards).

## 1. Flags (padrão LOCAL)

| Chave | Default | Semântica |
|---|---|---|
| `kora.catalog.dataSource.v1` | **local** | só o literal `"supabase"` seleciona a nuvem (valor ausente/`"local"`/malformado ⇒ local). Molde de **nascimento** de quotes/projects/finance/tasks (antes dos flips) |
| `kora.catalog.supabaseWrite.v1` | **desligada** | opt-in, só `"true"` liga. Molde `kora.tasks.supabaseWrite.v1` pré-flip |

Reativas sem recarregar: `useCatalogSource()` sincroniza por `CustomEvent` (mesma aba) + `storage` (outras abas). Cards em **Configurações → Dados → Sincronização Cloud**: *"Catálogo comercial · fonte de dados"* (Local ⇄ Supabase) e *"Catálogo comercial · escrita na nuvem"* (Ativar/Desativar) — padrão `SettingsCard` + status + botão dos demais domínios. Os textos dizem a verdade: a nuvem **começa vazia** até o import; a chave **não migra dado**; a escrita **bloqueia** (não grava no local) quando desligada.

## 2. Arquitetura — hooks bifurcados com a nuvem por **contexto**

`useBifurcatedServices` / `…Products` / `…ServiceCategories` / `…CommercialPlans` (`src/hooks/useBifurcatedCatalog.ts`) devolvem **o mesmo formato** de `useServices`/`useProducts`/`useServiceCategories`/`useCommercialPlans` (troca direta nas telas) + `mode`.

**Desvio deliberado do padrão `useBifurcatedTasks`** (que chama os dois hooks sempre): a nuvem chega por `CatalogDataProvider` (`src/components/vendas/CatalogDataProvider.tsx`), que só monta os 4 hooks nativos do CT1/CT2 quando a flag é `"supabase"`. Motivos:
1. cada `useSupabase*` instancia `useCurrentWorkspace` (fetch próprio) — 4 hooks nativos dentro de cada hook bifurcado multiplicariam fetches de workspace por tela;
2. **no modo LOCAL (padrão) não existe hook de nuvem: zero request, zero dependência de QueryClient/workspace** — regressão local por construção (os 80 testes de `components/vendas` existentes, sem providers, passam **sem alteração**);
3. com a tabela ainda inexistente (DDL do operador pendente), o padrão da casa (G32: query roda sempre) dispararia 4 GETs 404 a cada abertura do Catálogo para **todos** os usuários. G32 trata de expectativa de homologação (o critério é "nenhuma *escrita*", não "nenhuma rede"); aqui a flag é reativa, então não há o risco de query desabilitada "congelada".
Hook bifurcado **fora** do provider ⇒ local (seguro): a nuvem nunca "aparece" sem o provider.

### Modo efetivo (`mode`)
`source` = `"supabase"` só se a flag pede nuvem **e** há provider **e** há workspace **e** nenhuma das 4 tabelas está ausente. Senão `"local"`.

| Situação | `mode` | Leitura | Escrita |
|---|---|---|---|
| flag local (padrão) | `source: local` | store local | store local (byte a byte) |
| nuvem + escrita **ligada** | `source: supabase`, `cloudWrite` | nuvem | `mutateAsync` dos hooks nativos (G30, G37, G56) |
| nuvem + escrita **desligada** | `source: supabase`, `writeBlocked` | nuvem | **BLOQUEADA** com aviso honesto (G76) — nunca cai silenciosamente no local |
| nuvem + **tabela ausente** (`CatalogUnavailableError`) | `source: local`, `unavailable`, `tables[]` | **local** (não lista vazia) | store local; tela avisa "schema pendente" |
| nuvem + erro que **não** é tabela ausente (RLS, rede) | `source: supabase`, `error` | nuvem (vazia) + erro legível | idem acima |

**Por que o bloqueio, e não "cair no local":** o usuário está vendo o catálogo da nuvem; gravar no local criaria um item "fantasma" com id local (`svc-…`) que não aparece no que ele vê e não resolve em nenhum uuid (classe G67/G75).

### Mutators
`boolean | Promise<boolean>` — **nunca lançam**. Local ⇒ `true`. Nuvem ⇒ falha vira `toast.error` com a mensagem legível e `false`. A tela só mostra "criado/atualizado/duplicado/excluído" (e fecha o modal) se `true` — o `toast.success` eager do código antigo era sucesso sem persistência em modo nuvem (G75). Operações cobertas: **criar, editar, arquivar/ativar (`toggleActive` / `status`), duplicar, excluir** (soft delete) em serviços, produtos, categorias e planos. Plano duplicado na nuvem = `createPlan` com `source_local_id` nativo novo e "(cópia)" (G56); item de plano descartado por não ser uuid gera `toast.warning` com a contagem.

## 3. Tela (`ServicesSection.tsx`)

- Provider no shell; Serviços/Produtos/Planos/Categorias leem dos hooks bifurcados; handlers `await` o resultado.
- **Banner de modo** (nada aparece em fonte local = tela idêntica à de antes):
  - **schema pendente** — alerta âmbar "Schema pendente (pacote §8-b) — exibindo o catálogo local deste navegador", com as tabelas ausentes e **"Verificar de novo"** (reconsulta as 4 listas, útil logo depois de o operador aplicar o pacote);
  - sem workspace ativo;
  - **nuvem** — "Catálogo lido da nuvem (Supabase)", diz se a gravação está LIGADA/DESLIGADA ("você só consegue visualizar… nada é salvo"), que o catálogo local não aparece aqui e como importá-lo, e as limitações abaixo; erro legível quando houver.
- **[Atualização: o "Mais usado" e o seletor do wizard passaram a ler a nuvem no CT5 — ver `etapa-5-g94-ct5-ponte.md`; o Checkout segue local.]** **O que a nuvem ainda NÃO cobre (dito na tela e aqui, até o CT5):** a métrica "Mais usado em orçamentos" (depende de `quote_items.service_id` — CT5); o **seletor de serviços do wizard de orçamento** continua no catálogo local (CT5, lane B/E); a aba **Checkout** continua local ("Em breve") e usa o catálogo deste navegador (os ids guardados em `kora.checkoutSettings.v1` são locais — misturar uuids deixaria o checkout dangling ao voltar pro local).

## 4. Testes (29 novos em 3 arquivos; fixtures com uuid real)

| Arquivo | # | Cobre |
|---|---|---|
| `useBifurcatedCatalog.test.tsx` | 15 | **regressão local** (sem flag e **sem nenhum provider**: lê/escreve local, zero repositório; com provider e flag local: **zero request**; só o literal `"supabase"` liga); mutators locais devolvem `true`; nuvem+escrita ligada (lê uuid sem misturar o local; criar com key nativa + payload completo, store local intocado, cache sem refetch; editar/arquivar/duplicar/excluir por uuid; produtos e categorias; plano com item de id local → descartado + aviso, duplicar = linha nova); falha de escrita ⇒ `false` + erro legível, lista inalterada; **escrita desligada: as 14 operações devolvem `false`, avisam, não chamam NENHUM repositório e não tocam o local**; degradação (tabela ausente ⇒ local + `tables`, escrita no local; RLS não vira local; `retry`); flags reativas |
| `ServicesSection.catalog-source.test.tsx` | 7 | o que o usuário vê: local sem banner e "Serviço criado"; nuvem+escrita desligada (banner, **sem** "Serviço criado", modal aberto, nada gravado); escrita ligada (grava uuid, fecha, lista sem refetch); falha (erro, modal aberto); **schema pendente** (alerta + tabelas, seed local visível, grava no local); "Verificar de novo"; avisos de métrica/orçamentos/checkout |
| `CatalogSupabaseToggleCards.test.tsx` | 7 | padrões e literais exatos das flags, chaves reservadas, os 2 cards gravam a chave certa, textos honestos, sincronização entre os cards |

Existentes **sem alteração**: `ServicesSection.test.tsx` e os demais 80 de `components/vendas` (sem providers).

### Prova fail→fix→pass por patch (sem stash, G65)
- Patch das 8 peças (5 novas via `git add -N` + `ServicesSection.tsx`, `flags.ts`, `Configuracoes.tsx`), `git apply -R` ⇒ os **3 arquivos de teste falham na importação** ("Tests: no tests"); `git apply` ⇒ **29/29**.
- **Mutação de comportamento** (escrita desligada cai silenciosamente no store local — a violação do G76): **2 testes falham** (hooks: as 14 operações; UI: criar sem "Serviço criado"); restaurado ⇒ 29/29.

## 5. Limitações e pendências
- **Sem DDL aplicado, o fluxo feliz na nuvem só foi provado com repositórios falsos**; ao vivo, o caminho hoje é o "schema pendente". O pacote §8-b descreve a aplicação, as provas e o passo do import.
- Trocar de fonte **não migra nada**; o catálogo da nuvem nasce vazio até o import do CT3.
- Em fonte nuvem, os 4 hooks nativos + `useCurrentWorkspace` montam **uma vez** no provider (não por hook bifurcado).
- CT5 (`quote_items.service_id`, métrica "mais usado", seletor do wizard — lane B/E), CT6 (planos/aba — checkout), CT7 (flip + Fase D) seguem em aberto.
