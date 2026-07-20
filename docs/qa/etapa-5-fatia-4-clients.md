# Etapa 5 · Fatia 4 — `clients` + `client_contacts`

> **Escopo desta entrega:** **Fase A apenas** — diagnóstico de leitura pura, pelos invariantes do
> molde [Espelho Reversível](../architecture/espelho-reversivel.md) e do
> [protocolo de homologação](protocolo-homologacao.md) (incluindo §8 e §9). **Nenhuma rodada de
> homologação, migration ou escrita em banco/localStorage foi executada.** Nada disto está
> aprovado — é proposta, para revisão.
>
> **Achado que muda o enquadramento da fatia, registrado já no topo:** ao contrário de
> `opportunities` (Fatia 2) e `quotes` (Fatia 3), `clients` **não é greenfield**. Existe um
> caminho de leitura/escrita direto pra Supabase **já ativo em produção**, construído **antes**
> da Etapa 5 e **fora** do molde Espelho Reversível — ver §1, invariante (e)/P5. A fatia,
> portanto, não é "migrar clients pro Supabase" — é "blindar e formalizar, sob o protocolo, um
> import legado que convive com um CRUD que já é Supabase-first".

---

## 0. Registros necessários — queries para o OPERADOR rodar (Code não acessa banco nem browser)

Workspace de teste (mesmo das Fatias 1-3): `2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9`.

### 0.1 Nuvem (SQL Editor do Supabase)

```sql
-- (1) Contagem de clients no workspace de teste
select count(*) from public.clients where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9';
```

```sql
-- (2) Contagem de client_contacts no workspace de teste
select count(*) from public.client_contacts cc
join public.clients c on c.id = cc.client_id
where c.workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9';
```

```sql
-- (3) Colunas atuais de public.clients (checar drift schema-vs-código)
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'clients'
order by ordinal_position;
```

```sql
-- (4) Amostra dos clients já existentes na nuvem — quantos vieram do import legado
--     (pré-Etapa-5, sem source_local_id) vs is_demo, e se batem com os UUIDs já
--     referenciados como CLIENT_UUID nas Fatias 2/3 (ex.: 50f894e9-...="fabio")
select id, name, email, is_demo, created_at
from public.clients
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9'
order by created_at;
```

```sql
-- (5) quotes/opportunities já migradas cujo client_id aponta pra essa nuvem —
--     confirma o fan-in que a Fatia 4 precisa preservar
select 'quotes' as origem, id, title, client_id from public.quotes
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and client_id is not null
union all
select 'crm_opportunities', id, title, client_id from public.crm_opportunities
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and client_id is not null;
```

### 0.2 Local (console do navegador, origem de produção)

```js
// (6) Total local (inclui demo)
JSON.parse(localStorage.getItem("orbyt.clients.v1")).length
```

```js
// (7) Reais — mesmo critério isDemo usado na Fatia 3 (e já usado pelo próprio
//     código de import em useLocalClientsImport.ts:55)
JSON.parse(localStorage.getItem("orbyt.clients.v1")).filter(c => !c.isDemo).length
```

```js
// (8) Lista dos reais, pra inspeção visual (id/name/email/company)
console.table(
  JSON.parse(localStorage.getItem("orbyt.clients.v1"))
    .filter(c => !c.isDemo)
    .map(c => ({ id: c.id, name: c.name, email: c.email, company: c.company }))
)
```

```js
// (9) Total de contatos aninhados nos clients reais locais
JSON.parse(localStorage.getItem("orbyt.clients.v1"))
  .filter(c => !c.isDemo)
  .reduce((sum, c) => sum + (c.contacts?.length || 0), 0)
```

```js
// (10) Map de import legado (pré-Etapa-5) já gravado localmente — quais locais
//      já foram apontados pra um UUID de nuvem por essa via
JSON.parse(localStorage.getItem("kora.clients.supabaseImport.v1") || '{"importedMap":{}}')
```

**Preencher após rodar:** contagens (1)-(2)-(6)-(7)-(9), resultado de (3)/(4)/(5)/(8)/(10) colado
bruto. Sem esses números o veredito de risco (§2) e o dimensionamento das migrations (§3) ficam
provisórios.

---

## 1. Auditoria por invariante (Fase A)

| Inv. | Ponto | Veredito |
|---|---|---|
| (a) | Não apaga local antes do remoto | ✅ OK |
| (b) | Idempotência | ⛔ **BLOQUEANTE** — sem backstop no banco, dedupe só heurístico client-side |
| (c) | Leitura server-side | 🟡 OK, sem paginação (mesmo padrão adiado das Fatias 2/3) |
| (d) | Reversibilidade (local nunca destruído) | ✅ OK |
| (e) | Disparo consciente / flag em carência (P5) | ⛔ **JÁ VIOLADO, pré-existente** — ver abaixo |
| + | FK / dependentes de `clients` | 🟡 mapeados, ver abaixo |
| + | Atomicidade pai-filho (`clients`→`client_contacts`) | ⛔ **BLOQUEANTE** — import não-atômico |
| + | Precisão de campos monetários | 🟡 ajuste — sem arredondamento antes de gravar |
| + | Drift schema-vs-código | ✅ **sem drift** nas colunas base (contraste com a Fatia 3) |
| + | Legado sem `source_local_id` | 🟡 **a reconciliar** — ver abaixo |

### (a) Não apaga o local — ✅ OK

`useLocalClientsImport.ts` só escreve na chave de metadado `kora.clients.supabaseImport.v1`
(`localStorage.setItem` na linha 184); nunca `removeItem`/`clear`/overwrite de
`orbyt.clients.v1`. `useClients.ts` (hook local) idem — não há caminho de código que apague o
local a partir do fluxo de import.

### (b) Idempotência — ⛔ BLOQUEANTE

`public.clients` **não tem** coluna `source_local_id` nem qualquer UNIQUE além da `id` (UUID
gerado). O "dedupe" atual em `useLocalClientsImport.ts:64-72` é **inteiramente heurístico** e
roda no cliente, não no banco:

```js
const matched = supabaseClients.find((s) => {
  const emailMatch = s.email && local.email && s.email.toLowerCase() === local.email.toLowerCase();
  const phoneMatch = s.phone && local.phone && s.phone.replace(/\D/g, "") === local.phone.replace(/\D/g, "");
  const nameCompanyMatch = s.name.toLowerCase() === local.name.toLowerCase() &&
                           s.company?.toLowerCase() === local.company?.toLowerCase();
  return emailMatch || phoneMatch || nameCompanyMatch;
});
```

Isso é **mais fraco** que o estado inicial de `quotes` na Fatia 3 (que ao menos comparava título
exato): aqui, um clique duplo, uma corrida entre abas, ou simplesmente rodar o import duas vezes
sem essa checagem pegar o match (ex.: e-mail vazio nos dois lados, nome com acentuação diferente)
cria um **client duplicado de verdade** na nuvem, sem nenhum arbiter pra impedir. Nenhum backstop
no banco.

### (c) Leitura server-side — 🟡 OK, sem paginação

`useSupabaseClients.ts` já está em React Query (comentário no topo do arquivo confirma: "A2").
`listClients` faz `select("*")` sem `.range()`/`.limit()` — mesma lacuna já adiada (Q7-style) nas
Fatias 2/3. Não bloqueante no volume atual.

### (e) Disparo consciente / P5 (flag em carência) — ⛔ JÁ VIOLADO, condição pré-existente

**Este é o achado mais importante da Fase A.** `src/hooks/useClientsDataSource.ts:47`:

```js
const source: "local" | "supabase" = workspaceLoading || workspace ? "supabase" : "local";
```

Ou seja: **para qualquer usuário com um workspace ativo — o caso normal em produção — a fonte já
é `"supabase"`, não `"local"`.** E não é só leitura: em `src/pages/Clientes.tsx` (`addClient`,
`updateClient`, e por simetria `archiveClient`/`deleteClient`), o branch `if (source ===
"supabase")` já chama `supabaseAdd`/`supabaseUpdate`/etc. diretamente — **CRUD completo de
`clients` já é Supabase-first hoje**, sem qualquer rodada de homologação, sem `source_local_id`,
sem RPC atômica para os contatos.

Isso **não é algo que a Fatia 4 vai introduzir** — é uma condição já em produção, construída antes
da Etapa 5 e fora do molde Espelho Reversível (P5 do protocolo — "flag de escrita/experimental
fica OFF/carência até a homologação fechar" — já não vale pra `clients` há quanto tempo, o Code
não sabe precisar sem `git blame`, não rodado nesta Fase A por ser fora do escopo de leitura pura
combinado). **Decisão que cabe ao revisor, não ao Code:** aceitar o fato consumado (reverter pra
"local" quebraria a experiência de quem já usa clientes via Supabase) e focar a Fatia 4 em blindar
o que falta (import legado + atomicidade dos contatos), ou tratar como incidente e definir um
plano de contenção antes de prosseguir. A recomendação em §3 assume a primeira leitura, mas fica
marcada como pressuposto a confirmar.

### FK / dependentes de `clients`

| Tabela | Coluna | ON DELETE | Fatia |
|---|---|---|---|
| `client_contacts` | `client_id` (NOT NULL) | CASCADE | **esta (4)** |
| `client_technical_sheets` | `client_id` (NOT NULL) | CASCADE | futura, não migrada |
| `quotes` | `client_id` (nullable) | SET NULL | Fatia 3 — **fan-in já ativo** |
| `crm_opportunities` | `client_id` (nullable) | SET NULL | Fatia 2 — **fan-in já ativo** |
| `projects` | `client_id` (nullable) | SET NULL | não migrada |
| `financial_transactions` | `client_id` (nullable) | SET NULL | não migrada |
| `tasks` | `client_id` (nullable) | SET NULL | não migrada |
| `whatsapp_audience_contacts` | `matched_client_id` (nullable) | SET NULL | fora do escopo desta etapa |

**Contrato de fan-in já em uso, verificado nesta Fase A (leitura de código, sem query):**
`quotes` (`src/hooks/useLocalQuotesImport.ts`) e `crm_opportunities`
(`src/services/crm/crmOpportunityMapper.ts:15`) já leem
`kora.clients.supabaseImport.v1` esperando `{ importedMap: Record<string /* id local, stringificado */, string /* uuid Supabase */> }`
— exatamente o shape que `useLocalClientsImport.ts:164` já escreve
(`newlyImportedMap[String(item.id)] = String(result.id)`). **Os três já concordam.** Qualquer
mudança na Fatia 4 (ex.: trocar a chave, o formato do valor, ou como o `id` local é
stringificado) **quebra Fatia 2 e Fatia 3 já homologadas** — é uma restrição de design dura, não
uma sugestão.

### Atomicidade pai-filho — ⛔ BLOQUEANTE

`useLocalClientsImport.ts:143-160`: cria o `client` primeiro (`clientsRepository.createClient`),
depois itera `local.contacts` chamando `clientsRepository.createClientContact` **um a um, sem
transação**. Se o 2º contato falhar (ex.: campo NOT NULL violado, rede cair no meio), o client já
existe na nuvem com **parte** dos contatos — mesma classe do bug de "quota decapitada" que a
Fatia 3 existe para prevenir, aqui como "cliente com contatos decapitados". Pede o mesmo
tratamento: RPC atômica `import_client_with_contacts` (upsert do pai + insert dos filhos numa
única transação), no molde de `import_quote_with_items`.

### Precisão de campos monetários — 🟡 ajuste

`potentialValue`/`totalRevenue` vão pro payload sem arredondamento
(`useLocalClientsImport.ts:132-133`: `local.potentialValue || 0`, `local.totalRevenue || 0`,
direto). Mesma classe de gap que `quotes` tinha antes do ajuste Q5 — não seria descoberto sem
grep, e um `unitPrice`/soma com artefato de ponto flutuante local viraria um `numeric` "sujo" na
nuvem. Recomendação: `roundMoney` nos dois campos antes de montar `SupabaseClientInput`.

### Drift schema-vs-código — ✅ sem drift, ao contrário da Fatia 3

`is_demo` e `avatar_url` já existem na tabela e já são usados corretamente pelo código atual
(`is_demo: false` fixo no import; `avatar_url` mapeado em ambas as direções). Não há coluna
referenciada pelo código que não exista no schema — diferente do B-DRIFT que abriu a Fatia 3
(`client_id`/`opportunity_id` inexistentes em `quotes`). Achado positivo, registrado por
contraste.

### Legado sem `source_local_id` — 🟡 a reconciliar

Se a Fatia 4 adicionar `source_local_id` + UNIQUE `(workspace_id, source_local_id)` (Variante B,
ver §2), os `clients` **já existentes na nuvem** (criados pelo import legado ou pelo CRUD
Supabase-first já ativo) terão `source_local_id IS NULL` — sem problema pro índice (não-parcial,
NULL nunca colide, mesmo padrão já provado 2× nas Fatias 2/3). O risco real é outro: **se algum
local antigo já importado** (presente em `kora.clients.supabaseImport.v1`) **for reenviado pela
nova rota atômica**, o novo arbiter (`source_local_id`) não vai reconhecer a linha antiga como "a
mesma" (ela não tem `source_local_id`) — criaria um **duplicado**, não um upsert. A blindagem
contra isso já existe hoje (o candidate-builder pula quem já está em `importedMap`), mas precisa
ser preservada explicitamente no desenho da B.1/B.2 desta fatia, não assumida.

---

## 2. Avaliação de risco — vs Fatias 1-3 (provisória, sem os números do §0)

| Eixo | Fatia 2 (opportunities) | Fatia 3 (quotes) | **Fatia 4 (clients)** |
|---|---|---|---|
| Ponto de partida | greenfield | greenfield (com B-DRIFT de colunas) | **já parcialmente em produção** (CRUD Supabase-first ativo) |
| Variante (UNIQUE natural?) | B (sem natural) | B (sem natural) | **B** — `email` existe mas é opcional, sem UNIQUE, e o próprio código já trata como não-confiável (fallback pra phone/nome+company) |
| Atomicidade pai-filho | N/A (sem filho) | **era o achado central** — resolvido | **mesmo achado central**, ainda não resolvido |
| Import legado sem idempotência | não havia | não havia | **existe hoje**, em uso, sem `source_local_id` |
| Flag de leitura (P5) | em carência, íntegra | em carência, íntegra | **já rompida** antes da fatia começar |
| Dado real em risco | 0 na nuvem no início | 0 na nuvem no início | **clients reais já vivem na nuvem hoje** — qualquer migration precisa ser aditiva sobre dado já em uso ativo, não sobre tabela vazia |

**Leitura:** tecnicamente mais simples que a Fatia 3 no sentido de "sem B-DRIFT de colunas" — mas
o risco operacional é **maior**, porque a tabela já tem dado real de produção sendo lido e
escrito por usuários reais agora, e a fatia precisa desenhar em cima disso sem quebrar o que já
funciona. Fase B.2 (migrations) desta fatia entra direto na categoria "operação em dado
existente" do protocolo (gate reforçado, aprovação por statement).

---

## 3. Recomendação de ajustes — PROPOSTA, aguardando aprovação (nenhuma fase liberada)

| # | Item | Fase | Resumo |
|---|---|---|---|
| C1 | Coluna `clients.source_local_id` (text, nullable) + índice **não-parcial** `UNIQUE (workspace_id, source_local_id)` | B.2 (migration, operador aplica) | Mesmo padrão de Q1/Q2 das Fatias 2/3 — arbiter de idempotência real no banco. |
| C2 | RPC `import_client_with_contacts` (`SECURITY INVOKER`, `search_path` hardened, guarda de NULL) | B.2 (migration) + B.1 (código) | Upsert atômico do pai + insert dos filhos numa transação — fecha o achado "atomicidade pai-filho". Justificar INVOKER vs DEFINER no mesmo raciocínio da Fatia 3 (RLS já cobre o caller). |
| C3 | `useLocalClientsImport.ts` chama a nova RPC em vez de `createClient`+loop de `createClientContact` | B.3 Passo 1 (código puro) | Mesma reescrita que `useLocalQuotesImport.ts` já passou. |
| C4 | `roundMoney` em `potentialValue`/`totalRevenue` antes do payload | B.1 (código, zero risco) | Fecha o gap de precisão monetária. |
| C5 | Preservar o contrato de `kora.clients.supabaseImport.v1` **byte a byte** (chave, shape do `importedMap`) | Restrição de design, não uma fase | Fatia 2 e Fatia 3 já homologadas dependem disso — qualquer C1-C3 precisa provar que não quebra o fan-in. |
| C6 | **Decisão do revisor, não uma fase de código:** o que fazer com o CRUD Supabase-first já ativo (`useClientsDataSource`) — aceitar como fato consumado (P5 já rompido, formalizar o resto em cima) ou tratar como incidente à parte | Pré-requisito antes de aprovar B.1/B.2 | Ver §1 (e). Sem essa decisão, o desenho de C1/C2 fica ambíguo (a RPC atômica cobre só o import legado, ou também o CRUD direto do dia a dia?). |
| C7 | Extensão do contrato de fan-in monetário/documental — checar se `client_contacts` tem algum consumidor forward (nenhum encontrado nesta leitura, mas registrar por paridade com o Q6 da Fatia 3) | B.1 (documentação) | Baixo risco — nenhum `INSERT`/`upsert` em `client_contacts` fora do import foi encontrado nesta Fase A. |

**Nenhuma destas fases está liberada.** Fase B.1 começaria só após aprovação de design (em
particular de C6, que muda o escopo de C2); Fase B.2 só após export manual (Gate 1) do dado real
já existente em `clients`/`client_contacts` na nuvem — que, ao contrário das Fatias 2/3, **já não
está vazio**.

---

**PARADO aqui.** Sem "vai" literal do revisor colado neste chat pelo operador, nenhuma fase B
começa, nenhuma rodada de homologação executa, nenhuma migration é escrita ou aplicada.
