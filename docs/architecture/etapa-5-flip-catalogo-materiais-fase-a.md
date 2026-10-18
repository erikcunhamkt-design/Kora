# Etapa 5 · G94 — Catálogo comercial (Serviços/Produtos/…) e Biblioteca de Materiais do cliente — Fase A (inventário + proposta)

> **Doc-only, zero código, nenhuma migration aplicada.** Molde: `etapa-5-flip-tarefas-pacote.md`,
> `etapa-5-flip-fichas-fase-a.md`, `etapa-5-flip-materiais-pacote.md`. O G94 diz: "serviços e produtos
> vivem só no `localStorage`" e "Biblioteca de Materiais do cliente (G75) idem". Esta Fase A confirma,
> amplia o escopo (o catálogo são **5 stores locais**, não 2) e propõe o ciclo de domínio da casa
> (Fase A → tabela + RLS → repositório/mapper → hook bifurcado → import → flip → homologação).

## Abertura

- Branch `etapa-5-g94-catalogo-materiais-fase-a`, worktree `Kora-laneA`, a partir de `origin/main` em `a2e1134`
  (`docs(catalogo): F4 de Fichas registrado…`), confirmado por `git fetch` antes de abrir.
- Método: leitura direta do código em `main`. **[confirmado por leitura]** = lido no arquivo citado;
  **[inferência]** = conclusão de leitura que só o uso ao vivo prova. Protocolo §0/§6: Code não acessa banco
  nem `localStorage` do operador — nada abaixo sobre o conteúdo real de tabelas/storage é observado.
- Congelamento: o código de **Fichas** está congelado até o sign-off da Fase D. A trilha de Materiais
  toca `ClientProfileDrawer.tsx`, que também hospeda os consumidores F3 da ficha (`MaterialsTab`/`SheetTab`) —
  ver §9 (coordenação).

---

## 1. Resumo executivo

1. **O "catálogo" é um conjunto de 5 stores locais acoplados por ids, não 2**: serviços
   (`orbyt.services.v1`), produtos (`kora.products.v1`), **categorias** (`kora.serviceCategories.v1`),
   **planos comerciais** (`kora.commercialPlans.v1`, itens apontam pra ids de serviço/produto) e
   **configurações de checkout** (`kora.checkoutSettings.v1`). Levar só serviços+produtos pra nuvem
   **quebra** categorias e planos (referências por id local) — o ciclo precisa tratá-los juntos (§3, §9).
2. **A única ponte existente com a nuvem é `quote_items.service_id`** (uuid **sem FK**), e ela está **morta nos
   dois sentidos**: a escrita hardcoda `service_id: undefined` e a leitura nunca devolve `serviceId`
   (`quoteMapper.ts:240-282`). Consequência já ativa: "Mais usado em orçamentos" subconta qualquer orçamento da
   nuvem. **[confirmado por leitura]**
3. **Achado novo (falso positivo ativo, classe G29/G75):** o aviso que a mitigação do G75 colocou na
   Biblioteca ("Material salvo só neste dispositivo…", `Clientes.tsx:232-234`) **é falso para quem tem workspace**:
   em fonte nuvem, `updateClient` não chama `localUpdate` — o material fica **só em memória** (`setSelectedClient`)
   e some no primeiro refetch/reabertura. Nem "neste dispositivo" ele fica. **[confirmado por leitura]** (§2.4)
4. **Dois toggles do catálogo não fazem o que prometem** (classe G29): `availableInQuotes` ("Disponível em
   orçamentos") **não é lido por ninguém** — o seletor do wizard filtra só `active` (`QuotesSection.tsx:997`);
   `showInPublicCatalog` ("Mostrar no catálogo público") só vira um badge "Portfólio" — não existe página/consumidor
   público do catálogo. **[confirmado por leitura]** (§3.4)
5. **Recomendação de ordem:** Catálogo primeiro (categorias → serviços → produtos, depois planos), Materiais em
   paralelo e menor; **Materiais NÃO depende de Storage** (a Biblioteca é link-only — a dependência de Storage só
   aparece se alguém quiser upload de arquivo nela, fora do escopo). O bot (item 3) **só precisa do catálogo
   (categoria A)**, não de Materiais, e só depois de existir schema + dado na nuvem (§4).
6. **Nenhuma migration aplicada/necessária para esta Fase A**; os drafts do §6 são para o operador (§8-b).

---

## 2. Inventário — o que existe hoje

### 2.1 Os 5 stores do catálogo (todos `localStorage`, sem repositório/tabela/RLS/`workspace_id`)

| Store | Chave | Hook | Modelo (campos) | Id local |
|---|---|---|---|---|
| Serviços | `orbyt.services.v1` | `useServices` | `name, description, category (string legado), categoryId?, price, billingType ("único"\|"mensal"\|"recorrente"\|"personalizado"\|"pacote"), deliveryDays, active, tags?, availableInQuotes?, showInPublicCatalog?, notes?, isDemo?` | `svc-${Date.now()}` (seeds `svc-demo-1..7`) |
| Produtos | `kora.products.v1` | `useProducts` | `name, description, categoryId?, price, cost?, stock?, type ("digital"\|"physical"\|"addon"\|"template"\|"consulting"), status ("active"\|"inactive"), isDemo?, createdAt, updatedAt` | `prod-${Date.now()}` (seeds `prod-demo-1..2`) |
| Categorias | `kora.serviceCategories.v1` | `useServiceCategories` | `name, color, isDemo?` | `cat-${Date.now()}` (seeds `cat-branding`, `cat-social`, … 7) |
| Planos | `kora.commercialPlans.v1` | `useCommercialPlans` | `name, description, billingCycle ("one_time"\|"monthly"\|"quarterly"\|"yearly"), price, items: [{refId, kind:"service"\|"product", name}], highlight, status ("active"\|"inactive"), isDemo?, createdAt, updatedAt` | `plan-${…}` |
| Checkout | `kora.checkoutSettings.v1` | `useCheckoutSettings` | `primaryColor, logoUrl, buttonLabel, confirmationMessage, terms` (objeto único) | — |

Todos semeiam dados de demonstração (`isDemo: true`) quando o storage está vazio. O `Service.category` (string)
coexiste com `categoryId` ("compat" legado) — dois campos pro mesmo conceito. **[confirmado por leitura]**

### 2.2 Produtores de escrita

Um só ponto de entrada de UI: **Vendas → aba "Catálogo Comercial" → sub-abas "Serviços · Produtos · Planos · Checkout"**
(`ServicesSection.tsx`). Operações: `addService/updateService/duplicateService/toggleActive/removeService`
(botões "Novo serviço", "Categorias", ícones Editar/Duplicar/Excluir; serviço demo não pode ser excluído),
`addProduct/updateProduct/removeProduct`, `addCategory/updateCategory/removeCategory` (modal "Categorias"; remover
categoria em uso é bloqueado — "Categoria em uso por um serviço"), `addPlan/updatePlan/removePlan/duplicatePlan`,
`useCheckoutSettings().update`. Todos substituem a lista inteira no estado e persistem por `useEffect`. Exclusão é
**hard delete** local. Validações de UI: nome obrigatório; preço **> 0** (serviço, produto, plano).

### 2.3 Consumidores

| Consumidor | O que lê | Observação |
|---|---|---|
| `ServicesSection.tsx` (4 sub-abas) | tudo; métricas (ativos, "receita potencial/mês", "ticket médio") | `usageMap`/"Mais usado em orçamentos" conta `item.serviceId` em `useQuotes()` **local** — não lê os orçamentos da nuvem **e** o `serviceId` nunca sobrevive ao espelho |
| `QuotesSection.tsx` (`ServiceItemWizard`, `useServices()`) | seletor "adicionar serviço do catálogo" — `services.filter((s) => s.active)`; grava `QuoteItem.serviceId = svc.id`, copia `name` e `unitPrice` | **não** honra `availableInQuotes` |
| `PlansTab`/`CheckoutTab` | serviços/produtos ativos pra montar plano e "itens elegíveis" | referências por id local |
| `quoteMapper.ts` | `service_id: undefined` hardcoded na escrita; leitura não devolve `serviceId` | G37-classe nos dois sentidos |
| Robô WhatsApp / relatórios / outro membro-dispositivo | **nada** | o catálogo não sai do navegador (G94) |

Sem rota/deep link com id de serviço/produto/plano (nenhum `useParams`/`searchParams` — classe G67 de deep link **sem
superfície**). Todos os ids são **strings** (`svc-…`), nunca `Number()`-cast — o risco G67 aqui é outro: o id local
**não é uuid** e não pode ir cru pra uma coluna `uuid` (`resolve*Fk` passthrough/mapa).

### 2.4 Biblioteca de Materiais do cliente (`Client.assets`)

Estado herdado do `etapa-5-flip-materiais-pacote.md` (Fase A de Materiais) + a mitigação G75 (`3d0b632`):

- **Dado:** `Client.assets?: ClientAsset[]` embutido no registro (`orbyt.clients.v1`) — `id, title, type (12 valores), url, description?, tags?, accessStatus (6 valores), kind?, fileName?, fileSize?, mimeType?, storagePath?, uploadedAt?, source?, createdAt, updatedAt`.
- **Produtor único:** `ClientLibrarySection.tsx` (aba "Materiais" do perfil → "Biblioteca do cliente", botões "Adicionar material"/diálogo "Novo material"/"Editar material", campos "Nome do material *", "Link / URL *") → `onChange` → `onUpdateAssets` → `Clientes.tsx:updateClient(id, { assets })`. É **link-only** (sem `<input type="file">`, nunca chama `clientAssetsStorage`).
- **Consumidor:** só o próprio drawer (`client.assets ?? []`). Não aparece na timeline (`buildMaterialEvents` lê só `technicalSheet.assets`), nem no onboarding, nem em lugar nenhum fora do perfil.
- **Em fonte local** (sem workspace): `localUpdate` grava em `orbyt.clients.v1` — persiste.
- **Em fonte nuvem** (qualquer sessão com workspace — o estado normal): `updateClient` monta o patch por whitelist **sem** `assets`; o patch fica `{}` (UPDATE pulado, G75-mitigação) e **não há `localUpdate`**. O item vive só em `selectedClient` (React state) até o próximo refetch/reabertura. O `toast.warning("Material salvo só neste dispositivo…")` é, portanto, **falso**: não está salvo em dispositivo nenhum. **[confirmado por leitura — `Clientes.tsx:222-240`, `:843-846`]** → candidato a **G novo, a numerar pelo revisor** (classe G29+G75), **correção interina barata e independente de schema** (trocar o texto por "não foi salvo — a Biblioteca ainda não persiste com a nuvem" ou persistir localmente por uuid, como o store local de acessos da ficha).
- **Relações:** irmã da `technicalSheet.assets` (mesmo tipo, outro destino já migrado — R2 do pacote de Materiais). Sem deep link. Sem relação com `quotes`/`quote_items`.

---

## 3. Mapeamento por classe de lição (checklist do catálogo)

| Classe | Catálogo (serviços/produtos/categorias/planos) | Biblioteca |
|---|---|---|
| **G30** cache de mutação | futuro: toda mutation grava a resposta no cache (`setQueryData`) | idem (mutation de `clients`) |
| **G32** fetch paralelo | hooks de leitura `enabled: !!workspaceId`, nunca condicionado à fonte | idem |
| **G37** payload completo | **ativo e grande**: `quote_items.service_id` morto nos 2 sentidos; `Service.category` (string) e `categoryId` coexistem — o mapper precisa levar os dois; `tags`, `notes`, `showInPublicCatalog`, `availableInQuotes` têm que ter coluna | `assets` precisa de coluna + leitura (round-trip lossless, lição G83) |
| **G40/G49** vocabulário | ver §7 — `billingType` em português **com acento** ("único"), `ProductType`/`ProductStatus`/`BillingCycle` em inglês: preservar o literal local na nuvem + CHECK preventivo (precedente Tarefas) | `ClientAssetType` (12) e `ClientAssetAccessStatus` (6): definir literal + validar |
| **G52** campo condicional | N/A (sem status→timestamp) — `toggleActive` não tem campo-companheiro | N/A hoje; latente só se `kind:"file"` ganhar produtor |
| **G56** idempotência | import vs criação nativa vs "Duplicar": `UNIQUE (workspace_id, source_local_id)`; nome **não** é único (duplicar gera "(cópia)") | 1 produtor, sem colisão; import por cliente idempotente |
| **G67** uuid/Number | ids locais **não-uuid** (`svc-…`, `cat-…`): usar import-map/`source_local_id` e passthrough de uuid; **referências cruzadas** (plano→serviço, serviço→categoria, `quote_item`→serviço, `QuoteItem.serviceId` legado) precisam de tradução no import, senão ficam dangling | `client.id` já uuid (G82); sem deep link |
| **G72** datas fixas | seeds usam `now()` no carregamento; testes novos devem usar datas relativas | idem |
| **G75** sucesso falso | hoje N/A (nada tenta gravar); **no flip**: nenhum campo sem coluna (é o antídoto) | **ativo** (§2.4) |
| **G79** vínculo real | o vínculo serviço↔orçamento **tem** caminho de UI (seletor do wizard) — o que falta é o destino; diferente do G79 de tarefas/projetos | o vínculo Biblioteca↔cliente existe por construção (tela do cliente) |
| **G82** id de cliente uuid | n/a | a leitura de `assets` precisa vir do cliente da nuvem (`mapSupabaseClientToLocalClient` nunca o preenche) |

### 3.4 Achados novos desta Fase A (sem numeração — a cargo do revisor)

- **A — toast falso da Biblioteca** (§2.4): classe G29+G75, ativo em produção.
- **B — `availableInQuotes` sem efeito:** o toggle "Disponível em orçamentos" é gravado e **nunca lido**; o wizard filtra só `active`. Decidir: honrar no seletor (mudança de comportamento) ou remover o toggle.
- **C — `showInPublicCatalog` sem consumidor:** só gera o badge "Portfólio"; nenhuma página pública lê o catálogo.
- **D — "Mais usado em orçamentos" lê só orçamentos locais e `serviceId` nunca volta da nuvem** (G37-classe, já descrito no código do mapper).
- **E — referências dangling prontas:** planos guardam `refId` de serviço/produto **e** `name` denormalizado; ao migrar serviços sem traduzir os planos, o "Editar plano" não acha os itens.
- **F — seeds de demonstração:** em fonte nuvem não há seed; a UI de um workspace novo precisa de estado vazio decente (decisão de produto, Q3).

---

## 4. O que o bot (item 3, lane D) precisaria ler

Decisões oficiais do item 3 (`etapa-9-item3-base-conhecimento-fase-a.md` §2, Q1/Q6; `etapa-9-item3-r1-base-conhecimento-fundacao.md` D1): hoje a categoria A ("catálogo comercial") é servida por `quote_items` agregado, rotulada **"itens já orçados"** (nunca "catálogo"). O G94 é a trilha que a substitui.

| Necessidade do bot | Fonte | Colunas (allowlist) | Fora (nunca ler) |
|---|---|---|---|
| Serviços oferecidos, preço, condições | `services` (nuvem) | `name, description, price, billing_type, delivery_days, category` (rótulo) | `notes` (interno), `tags`, `is_demo` |
| Produtos | `products` | `name, description, price, type` | **`cost`, `stock`** (confidencial comercial) |
| Filtro | — | `deleted_at IS NULL` **e** `active`/`status='active'` (+ decidir `available_in_quotes` — Q8) | itens inativos/excluídos |

- Leitura **server-side** (edge function `whatsapp-bot-reply`, service role) com **allowlist de colunas** explícita no `knowledgeSources.ts` — nunca `select("*")`; mesma disciplina do item 3 (consentimento por categoria, `ai_knowledge_consents`).
- **Materiais (Biblioteca) NÃO entram**: são links/dados específicos de **um cliente do operador** (terceiro; categoria C do item 3, risco alto) — o robô fala pela empresa do operador. Registrar como "não necessário", não como pendência.
- O bot só ganha valor depois de existir **schema (CT1) + dado na nuvem (CT4 criação nativa ou CT6 import)**; a lane D pode começar o `knowledgeSources` assim que o schema existir (colunas conhecidas), sem esperar o flip do app.

---

## 5. Decisões de desenho (o que a proposta assume)

1. **Um domínio de catálogo, uma flag de fonte, um flip** — categorias, serviços, produtos e planos referenciam-se por id; flipar em separado cria dangling.
2. **Vocabulário local preservado na nuvem + CHECK preventivo** (precedente Tarefas, G40/G49) — sem tabela de tradução: `billing_type` guarda `'único'` etc. literal.
3. **Import por `source_local_id`** (`${installId}:${localId}`, mesmo mecanismo de clientes/quotes/tasks) com `UNIQUE (workspace_id, source_local_id)` **não-parcial** (arbiter do upsert).
4. **Soft delete** (`deleted_at`) — preserva `quote_items.service_id` e histórico; a UI continua "Excluir".
5. **Seeds demo nunca vão pra nuvem** (`is_demo` não é importado); em modo nuvem, estado vazio.
6. **Biblioteca = coluna JSONB em `clients`** (opção (a) do G75) — a UI já trabalha por "substitui a lista inteira" (`onChange(next)`), igual a `materials` da ficha; tabela por item exigiria diff por item sem ganho (nada consulta Biblioteca por item).

---

## 6. Schema proposto — DRAFTS, **NÃO APLICAR** (protocolo §0/§6/§8-b: DDL é do operador)

Convenções copiadas de `20260601040000_create_tasks_schema.sql` e do par `source_local_id` (`20260719000000/…100`):
`workspace_id` FK `ON DELETE CASCADE`, RLS `is_workspace_member`, trigger `update_*_updated_at`, índice único
`CONCURRENTLY` em arquivo separado (não-parcial). Nomes de policy no estilo "Users can … in their workspaces".

```sql
-- 6.1 service_categories
CREATE TABLE IF NOT EXISTS public.service_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#8B5CF6',
  is_demo BOOLEAN NOT NULL DEFAULT false,
  source_local_id TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6.2 services
CREATE TABLE IF NOT EXISTS public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.service_categories(id) ON DELETE SET NULL,
  category TEXT,                                   -- rótulo legado (Service.category) — G37: não perder o campo
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  billing_type TEXT NOT NULL DEFAULT 'único',
  delivery_days INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  tags TEXT[] NOT NULL DEFAULT '{}',
  available_in_quotes BOOLEAN NOT NULL DEFAULT true,
  show_in_public_catalog BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  source_local_id TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT services_billing_type_known_chk
    CHECK (billing_type IN ('único','mensal','recorrente','personalizado','pacote')),
  CONSTRAINT services_price_nonneg_chk CHECK (price >= 0),
  CONSTRAINT services_delivery_days_nonneg_chk CHECK (delivery_days >= 0)
);

-- 6.3 products
CREATE TABLE IF NOT EXISTS public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.service_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost NUMERIC(12,2),
  stock INTEGER,
  type TEXT NOT NULL DEFAULT 'digital',
  status TEXT NOT NULL DEFAULT 'active',
  is_demo BOOLEAN NOT NULL DEFAULT false,
  source_local_id TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT products_type_known_chk CHECK (type IN ('digital','physical','addon','template','consulting')),
  CONSTRAINT products_status_known_chk CHECK (status IN ('active','inactive')),
  CONSTRAINT products_price_nonneg_chk CHECK (price >= 0)
);

-- 6.4 commercial_plans (fatia final do ciclo — ver §9, CT6)
CREATE TABLE IF NOT EXISTS public.commercial_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,     -- [{refId (uuid já traduzido), kind, name}] — NUNCA id local
  highlight BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  is_demo BOOLEAN NOT NULL DEFAULT false,
  source_local_id TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT plans_billing_cycle_known_chk CHECK (billing_cycle IN ('one_time','monthly','quarterly','yearly')),
  CONSTRAINT plans_status_known_chk CHECK (status IN ('active','inactive')),
  CONSTRAINT plans_items_array_chk CHECK (jsonb_typeof(items) = 'array')
);

-- 6.5 RLS (as 4 tabelas, mesmo molde de tasks)
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;   -- idem service_categories, products, commercial_plans
CREATE POLICY "Users can select services in their workspaces" ON public.services
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Users can insert services in their workspaces" ON public.services
  FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "Users can update services in their workspaces" ON public.services
  FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "Users can delete services in their workspaces" ON public.services
  FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id));
-- VARIANTE (decisão Q2, G71-classe): escrita só para admin/owner — trocar is_workspace_member por
-- public.is_workspace_admin(workspace_id) nas 3 policies de escrita (precedente já em uso:
-- 20260830000800_g71_workspace_ai_credentials_admin_rls.sql). SELECT permanece member (o bot lê por service role).

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();   -- idem as demais

-- 6.6 índice único do import (ARQUIVO SEPARADO, CONCURRENTLY, autocommit — padrão …fatia2_unique_source_local_id)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ux_services_source_local
  ON public.services (workspace_id, source_local_id);      -- idem categories/products/plans

-- 6.7 ponte com orçamentos: FK que hoje não existe (quote_items.service_id é uuid solto)
-- Pré-check do operador: SELECT count(*) FROM public.quote_items WHERE service_id IS NOT NULL;  -- esperado 0
ALTER TABLE public.quote_items
  ADD CONSTRAINT quote_items_service_id_fkey FOREIGN KEY (service_id)
  REFERENCES public.services(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.quote_items VALIDATE CONSTRAINT quote_items_service_id_fkey;

-- 6.8 Biblioteca de Materiais (opção (a) do G75): coluna JSONB em clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS library_assets JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.clients
  ADD CONSTRAINT clients_library_assets_array_chk
  CHECK (jsonb_typeof(library_assets) = 'array' AND jsonb_array_length(library_assets) <= 200) NOT VALID;
-- VALIDATE depois (nenhuma linha existente tem a coluna preenchida).
```

Pontos de atenção do draft (verificar contra o schema real antes de aplicar): o nome da função de `updated_at`
(`update_updated_at_column`) segue o trigger de `tasks`; `quote_items.quantity` é `numeric` hoje (promovido, Q5b) —
irrelevante aqui; se o operador preferir `quote_items.service_id` **sem** FK por ora, 6.7 é opcional (a escrita
passa a mandar uuid válido de qualquer jeito).

---

## 7. Mapper e vocabulário (G37/G40/G49)

| Local | Nuvem | Regra |
|---|---|---|
| `Service.name/description/price/active/tags/notes/deliveryDays` | `name/description/price/active/tags/notes/delivery_days` | passthrough; `price` por `roundMoney` (mesmo quantizador dos outros mappers) |
| `Service.billingType` (`"único"`…) | `billing_type` | **literal preservado** (com acento) + CHECK 6.2; leitura valida contra a lista e cai em `"único"` com aviso de log se desconhecido (nunca quebra a lista) |
| `Service.categoryId` (`cat-…`) | `category_id` (uuid) | `resolveCatalogFk(localId, map)` = uuid passthrough → mapa → `null` (nunca id local cru — Q4/G37); categoria **não resolvida** ⇒ `category_id = null` **e** `category` (rótulo legado) preservado |
| `Service.category` (string legado) | `category` | passthrough — **não descartar** (G37); na leitura, rótulo exibido = nome da categoria resolvida, senão `category` |
| `Service.availableInQuotes/showInPublicCatalog` | `available_in_quotes/show_in_public_catalog` | passthrough (a decisão sobre o efeito é produto, Q10) |
| `Service.isDemo` | `is_demo` | demo **nunca é importado**; criação nativa grava `false` |
| `Product.type/status` | `type/status` | literal preservado + CHECK 6.3 |
| `Product.cost/stock` | `cost/stock` | `cost` por `roundMoney`; `stock` inteiro ou `null` |
| `Plan.billingCycle/status` | `billing_cycle/status` | literal preservado + CHECK |
| `Plan.items[].refId` | `items[].refId` | **traduzido** serviço/produto → uuid pelo mapa do import; item não resolvido é **descartado com contagem** no relatório do import (nunca gravado com id local) |
| `QuoteItem.serviceId` (legado, local) | `quote_items.service_id` | `resolveCatalogFk`; hoje `undefined` hardcoded — **leitura também** passa a devolver `serviceId` (hoje perdido) |
| `Client.assets` (Biblioteca) | `clients.library_assets` | array validado item a item na leitura (descarta entrada sem `id/title/url`); `kind:"file"`/`storagePath` só preservados, sem upload (R3 do bucket segue fora) |

Ids: `id` uuid nativo na nuvem; `source_local_id` só pra import/criação nativa (`buildNativeSourceLocalId()`).
O hook local continua devolvendo `id` string — o `Service.id` bifurcado vira o uuid (string), sem cast numérico.

---

## 8. Import assistido local → nuvem (padrão `LocalTasksImportCard`)

- **`useLocalCatalogImport`** (Configurações → Dados, card novo "Importar Catálogo Comercial"), ordem **categorias → serviços → produtos → planos**, cada etapa produz seu mapa em `kora.catalog.supabaseImport.v1` (`{categories,services,products,plans: {localId → uuid}}`) — mesmo desenho de `kora.clients.supabaseImport.v1`.
- Candidatos: itens **não-demo**; status "pronto / já existe / depende de categoria não importada"; `upsert onConflict (workspace_id, source_local_id)` com `${installId}:${localId}` (idempotente por perfil de navegador — duas máquinas importam o mesmo catálogo **duas vezes** se os ids locais diferirem: risco G56 aceito e **documentado** no card, como já é nos outros domínios).
- **Planos:** traduz `items[].refId` pelo mapa (itens sem mapa são descartados e contados no toast final).
- **Orçamentos já na nuvem** têm `service_id = NULL`: **sem backfill automático** (casar por nome é heurística frágil). Opcional, só com aprovação do operador: SQL de backfill por nome exato dentro do workspace, com `SELECT count(*)` antes/depois — fica como draft do pacote §8-b, não nesta trilha.
- **Biblioteca:** card/etapa "Importar Biblioteca" (ou extensão do import de Clientes): candidatos = clientes locais **mapeados** (`kora.clients.supabaseImport.v1`) com `assets.length > 0` **e** `library_assets` vazio na nuvem; `UPDATE clients SET library_assets = …` por cliente; nunca sobrescreve uma Biblioteca já preenchida na nuvem.

---

## 9. Fatias, ordem e flip

### 9.1 Catálogo

| Fatia | Conteúdo | Arquivos (provável) | Depende de |
|---|---|---|---|
| **CT1** | Drafts 6.1–6.7 aplicados pelo operador (§8-b) | `supabase/migrations/*` (só após aplicar) | — |
| **CT2** | `servicesRepository`/`productsRepository`/`serviceCategoriesRepository` (+ plans) + mappers do §7 + `useSupabaseServices/Products/Categories` (G32 `enabled:!!ws`) + testes de ida-e-volta com **uuid real** | `src/repositories/*`, `src/services/catalog/*`, `src/hooks/useSupabase*` (novos) | CT1 (schema), pode escrever contra tipos hand-rolled antes |
| **CT3** | `useBifurcatedServices/Products/ServiceCategories` + flag `kora.catalog.dataSource.v1` (nasce **local**) + consumidores de **leitura**: `ServicesSection`, wizard de `QuotesSection` (fatia mínima: trocar `useServices()`), `usageMap` por quotes bifurcados | `src/hooks/useBifurcated*`, `src/config/flags.ts`, `ServicesSection.tsx`, **`QuotesSection.tsx` (lane B)** | CT2 |
| **CT4** | **Escrita nativa** em `ServicesSection` (CRUD, duplicar, ativar/desativar, excluir = soft delete) por flag `kora.catalog.supabaseWrite.v1` (nasce **opt-in**); G30 (`setQueryData` da resposta), toasts honestos | `ServicesSection.tsx`, hooks de mutation | CT3 |
| **CT5** | Ponte com orçamentos: `quote_items.service_id` escrito/lido (`quoteMapper`), `QuoteItem.serviceId` volta — "Mais usado" deixa de subcontar | `quoteMapper.ts`, `useSupabaseQuotes` | CT2 + 6.7; **domínio Quotes (coordenar com lane B)** |
| **CT6** | Import assistido (§8) + **Planos** (tabela 6.4, repositório, tradução de `refId`, aba "Planos" bifurcada); **Checkout** fica local ("Em breve", sem consumidor — decisão Q1) | `useLocalCatalogImport`, `Configuracoes.tsx`, `ServicesSection.tsx` | CT2–CT4 |
| **CT7** | Fase C (flip dos 2 defaults: fonte → `supabase`, escrita → opt-out) + Fase D (runbook) | `flags.ts`, runbook | CT1–CT6, gates verdes, "vai" |

**Bot (lane D):** `knowledgeSources` do item 3 lê `services`/`products` por allowlist (§4) a partir de CT1+CT2 (schema e tipos); o **valor real** só aparece com dado na nuvem (CT4/CT6).

### 9.2 Biblioteca de Materiais (trilha menor, independente de Storage)

| Fatia | Conteúdo | Arquivos |
|---|---|---|
| **M0 (interina, imediata, sem schema)** | corrigir o toast falso (§2.4) — texto honesto ou persistência local por uuid | `Clientes.tsx` (1 mensagem) |
| **M1** | Draft 6.8 aplicado (coluna `library_assets` + CHECK) | operador |
| **M2** | `Clientes.tsx:updateClient` inclui `library_assets` na whitelist; `mapSupabaseClientToLocalClient` passa a devolver `assets` (G37/G83: escrita ⇒ leitura); G30 na mutation de `clients` (confirmar em `useSupabaseClients.updateClient`); remove o aviso falso; testes com uuid real | `Clientes.tsx`, `useClientsDataSource.ts`, `useSupabaseClients.ts`, `clientsRepository.ts` |
| **M3** | import da Biblioteca (§8) | hook/card de import |
| **M4** | homologação (runbook) — **sem flag própria**: a mudança vale no instante em que M2 mescla (Clientes já é nuvem por padrão) ⇒ **homologar antes de anunciar** |

**Storage:** Materiais **não depende** de Storage. A dependência (e o R3 do pacote de Materiais — validação client-side vs policy do bucket `client-assets` png/jpeg/webp ≤ 2 MB) só entra se a Biblioteca ganhar **upload de arquivo** — fora do escopo desta trilha.

### 9.3 Ordem recomendada e coordenação

1. **Agora, sem schema:** M0 (toast falso) — risco ativo, uma linha.
2. **Catálogo primeiro** (CT1→CT7): é o que destrava o robô e a ponte `quote_items.service_id`, e é o maior valor; **categorias antes de serviços/produtos** (FK) e **planos por último** (dependem dos ids traduzidos).
3. **Materiais em paralelo** (M1→M4) por ser pequeno e independente — **mas** `ClientProfileDrawer.tsx` é arquivo compartilhado com os consumidores F3 da ficha **congelados até o sign-off da Fase D de Fichas**; M2 mexe só em `Clientes.tsx`/mappers/hooks de Clientes (não no drawer) — o drawer só precisa de alteração se o aviso migrar para lá. Se M2 precisar do drawer, **esperar o sign-off**.
4. **Colisão de lane:** CT3/CT5 tocam `QuotesSection.tsx`/`quoteMapper.ts` (lane B, trilha Vendas) — alinhar fatia a fatia, como nas rodadas anteriores.

### 9.4 Flip (Fase C) e rollback

Padrão das Fases C anteriores: `getCatalogDataSource()` só `"local"` explícito seleciona local; flag de escrita opt-out só `"false"` desliga; rollback nível 1 por override de `localStorage` (`kora.catalog.dataSource.v1="local"`, `kora.catalog.supabaseWrite.v1="false"`), nível 2 `git revert` do commit de flip isolado. **Guarda de alcance** (lição do F4 de Fichas): a nuvem só vale com workspace ativo (usuário 100% local não regride). Catálogo local existente **não some** no flip: aviso "existe catálogo salvo só neste dispositivo — importe em Configurações → Dados" (mesma estratégia do aviso de ficha local do F4).

---

## 10. Riscos nomeados

- **R1 — Dangling por referência cruzada** (plano→serviço, serviço→categoria, `QuoteItem.serviceId` legado → id local): mitigado por import em ordem + tradução via mapa + descarte contado (§8). Maior risco técnico do ciclo.
- **R2 — Flipar parcial** (serviços sem planos/categorias): o seletor de itens do plano e o filtro de categoria quebram. Mitigação: um domínio, uma flag (§5.1).
- **R3 — Aviso falso da Biblioteca** (§2.4): ativo agora; M0 resolve sem schema.
- **R4 — Confidencialidade comercial pro bot:** `cost`/`stock`/`notes` nunca na allowlist (§4); `select("*")` proibido no server.
- **R5 — Preço/escrita por qualquer membro** (G71-classe): Q2.
- **R6 — Import duplicado entre navegadores** (G56-classe, `installId` diferente): aceito e documentado.
- **R7 — Ressalva de produto:** toggles `availableInQuotes`/`showInPublicCatalog` sem efeito (§3.4 B/C) — migrar para a nuvem **sem decidir** cristaliza o defeito.
- **R8 — Tamanho:** `library_assets` ≤ 200 itens (CHECK) e o `clients` row cresce; aceito (links curtos).

## 11. Decisões (Q1–Q10) — **adotadas conforme recomendação (revisor)**

| # | Decisão | Recomendação — **adotada** |
|---|---|---|
| Q1 | Escopo do ciclo | categorias + serviços + produtos + planos; **checkout fica local** ("Em breve", sem consumidor) |
| Q2 | RLS de escrita | member (precedente tasks/quotes) na v1; admin-only só se o operador quiser blindar preço (G71) |
| Q3 | Seeds demo em fonte nuvem | não importar; estado vazio com CTA "Criar serviço"/"Importar catálogo" |
| Q4 | Destino da Biblioteca | coluna JSONB em `clients` (G75-a); alternativas: unificar com a ficha (G75-b) / manter local (G75-c) |
| Q5 | Upload de arquivo na Biblioteca | fora desta trilha (R3 do bucket) |
| Q6 | Exclusão | soft delete |
| Q7 | Backfill de `quote_items.service_id` por nome | não nesta trilha (draft opcional §8-b) |
| Q8 | Filtro do bot | `active` + `deleted_at IS NULL` (+ `available_in_quotes`, se o toggle for honrado) |
| Q9 | M0 interina (toast falso) | fazer já |
| Q10 | `availableInQuotes` | honrar no seletor do wizard (mudança de comportamento) ou remover o toggle; `showInPublicCatalog`: remover o badge/toggle até existir consumidor, ou documentar como "reservado" |

## 12. Referências

- G94 (`kora-hub-auditoria-e-plano.md`), G75, G63/G82/G83 (padrões de Fichas), G40/G49, G30/G32/G37/G56/G67/G72/G79
- `etapa-5-flip-materiais-pacote.md` (Biblioteca), `etapa-5-flip-tarefas-pacote.md` §7 (fatias B1–B6), `etapa-5-flip-fichas-fase-a.md` e `docs/qa/etapa-5-flip-fichas-f4.md` (guarda de alcance, aviso de cópia local)
- `etapa-9-item3-base-conhecimento-fase-a.md`, `docs/qa/etapa-9-item3-r1-base-conhecimento-fundacao.md` (D1, Q1/Q6)
- Código: `src/hooks/useServices.ts`, `useProducts.ts`, `useServiceCategories.ts`, `useCommercialPlans.ts`, `useCheckoutSettings.ts`, `src/components/vendas/ServicesSection.tsx`, `QuotesSection.tsx:788-830,997`, `src/services/quotes/quoteMapper.ts:236-282`, `src/pages/Clientes.tsx:196-240,843`, `src/components/clients/ClientLibrarySection.tsx`, `supabase/migrations/20260531030000_create_quotes_schema.sql:24-36`

**PARADO — doc-only, zero código, nenhum DDL. §18: aguardando "vai".**
