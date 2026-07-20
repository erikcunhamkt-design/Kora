# Etapa 5 · Fatia 4 — `clients` + `client_contacts`

> **Escopo desta entrega:** **Fase A apenas** — diagnóstico de leitura pura, pelos invariantes do
> molde [Espelho Reversível](../architecture/espelho-reversivel.md) e do
> [protocolo de homologação](protocolo-homologacao.md) (incluindo §8 e §9). **Nenhuma rodada de
> homologação, migration ou escrita em banco/localStorage foi executada.** Nada disto está
> aprovado — é proposta, para revisão.
>
> **Enquadramento (adendo 2026-07-20): Fatia 4 é REGULARIZAÇÃO, não migração clássica.** Ao
> contrário de `opportunities` (Fatia 2) e `quotes` (Fatia 3), `clients` **não é greenfield**.
> Existe um caminho de leitura/escrita direto pra Supabase **já ativo em produção**, construído
> **antes** da Etapa 5 e **fora** do molde Espelho Reversível — ver §1, invariante (e)/P5. A
> fatia, portanto, não é "migrar clients pro Supabase" — é "blindar e formalizar, sob o
> protocolo, um import legado que convive com um CRUD que já é Supabase-first". Essa mudança de
> enquadramento obriga a reler (a) e (d) fora do sentido clássico (ver §1) — "local" não é mais a
> fonte ativa que esses dois invariantes originalmente protegiam, é um snapshot congelado de
> antes do cutover.

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

### 0.3 DIFF local ↔ nuvem (por email/nome — não há `source_local_id` ainda)

**Esta é a medição que decide C6.** Sem `source_local_id`, não existe chave exata pra cruzar as
duas listas — o diff abaixo usa o mesmo critério que o próprio código de import já usa hoje
(email; se vazio, nome+empresa), então mede exatamente o que o card de import classificaria como
"novo" em cada direção. **Ressalva de precisão, registrada por honestidade:** é heurístico, não
exato — um client com e-mail preenchido no local mas `NULL` na nuvem não casa por e-mail e cai
como "ausente" mesmo que seja o mesmo registro; inspecionar os resultados antes de tratá-los como
verdade absoluta.

**Passo 1 — no console do navegador, gera e copia o array normalizado dos locais reais:**

```js
// (11) copia pro clipboard — cole no lugar de <<COLAR_AQUI_O_JSON_COPIADO>> nas 4 queries abaixo
copy(JSON.stringify(
  JSON.parse(localStorage.getItem("orbyt.clients.v1"))
    .filter(c => !c.isDemo)
    .map(c => ({
      email: (c.email || "").toLowerCase().trim(),
      name: (c.name || "").toLowerCase().trim(),
      company: (c.company || "").toLowerCase().trim(),
    }))
))
```

**Passo 2 — no SQL Editor, cola o mesmo array nas 4 queries (mesma sessão, roda as 4):**

```sql
-- (12) direção 1: locais reais SEM correspondência na nuvem — candidatos reais ao import
with local_clients as (
  select * from jsonb_to_recordset('<<COLAR_AQUI_O_JSON_COPIADO>>'::jsonb)
    as x(email text, name text, company text)
)
select lc.email, lc.name, lc.company
from local_clients lc
where not exists (
  select 1 from public.clients c
  where c.workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9'
    and (
      (lc.email <> '' and lower(trim(c.email)) = lc.email)
      or (lc.email = '' and lower(trim(c.name)) = lc.name and lower(trim(coalesce(c.company, ''))) = lc.company)
    )
);
```

```sql
-- (13) contagem da direção 1
with local_clients as (
  select * from jsonb_to_recordset('<<COLAR_AQUI_O_JSON_COPIADO>>'::jsonb)
    as x(email text, name text, company text)
)
select count(*) from local_clients lc
where not exists (
  select 1 from public.clients c
  where c.workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9'
    and (
      (lc.email <> '' and lower(trim(c.email)) = lc.email)
      or (lc.email = '' and lower(trim(c.name)) = lc.name and lower(trim(coalesce(c.company, ''))) = lc.company)
    )
);
```

```sql
-- (14) direção 2: clients NA NUVEM sem correspondência local — nasceram via CRUD
--      Supabase-first já ativo, ou são legado sem contrapartida local íntegra
with local_clients as (
  select * from jsonb_to_recordset('<<COLAR_AQUI_O_JSON_COPIADO>>'::jsonb)
    as x(email text, name text, company text)
)
select c.id, c.name, c.email, c.company, c.is_demo, c.created_at
from public.clients c
where c.workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9'
  and not exists (
    select 1 from local_clients lc
    where (lc.email <> '' and lc.email = lower(trim(c.email)))
       or (lc.email = '' and lc.name = lower(trim(c.name)) and lc.company = lower(trim(coalesce(c.company, ''))))
  )
order by c.created_at;
```

```sql
-- (15) contagem da direção 2
with local_clients as (
  select * from jsonb_to_recordset('<<COLAR_AQUI_O_JSON_COPIADO>>'::jsonb)
    as x(email text, name text, company text)
)
select count(*) from public.clients c
where c.workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9'
  and not exists (
    select 1 from local_clients lc
    where (lc.email <> '' and lc.email = lower(trim(c.email)))
       or (lc.email = '' and lc.name = lower(trim(c.name)) and lc.company = lower(trim(coalesce(c.company, ''))))
  );
```

**Por que decide C6:** se a direção 2 (nuvem sem local) vier **grande**, é evidência forte de que
o CRUD Supabase-first já é o dia a dia real — regularizar é a única opção sensata, reverter pra
carência quebraria uso corrente. Se vier **~0**, o CRUD direto pode ainda não ter sido usado de
fato (só existe no código), e a decisão C6 tem mais espaço. A direção 1 (local sem nuvem) mede o
volume real que o import legado ainda precisa cobrir — dimensiona o risco de C1-C3.

---

## 1. Auditoria por invariante (Fase A)

| Inv. | Ponto | Veredito |
|---|---|---|
| (a) | Não apaga local antes do remoto | ✅ OK — **sentido redefinido**, ver texto |
| (b) | Idempotência (de import) | 🗄️ **CATALOGADO, não bloqueante** — decisão C6 (§4.1): 0 clients reais no local, nada a importar hoje |
| (c) | Leitura server-side | 🟡 OK, sem paginação (mesmo padrão adiado das Fatias 2/3) |
| (d) | Reversibilidade (de import) | 🗄️ **CATALOGADO, não bloqueante** — decisão C6 (§4.1), mesmo motivo de (b) |
| (e) | Disparo consciente / flag em carência (P5) | ⛔→🗄️ **JÁ VIOLADO, mas agora REGULARIZADO por decisão do revisor** — ver §4.3 |
| + | FK / dependentes de `clients` | 🟡 mapeados, ver abaixo |
| + | Atomicidade pai-filho (`clients`→`client_contacts`) | ⛔ **BLOQUEANTE — achado revisado em §4.2**: não é o import (catalogado), é um bug ativo no CRUD vivo |
| + | Precisão de campos monetários | 🟡 ajuste — sem arredondamento antes de gravar |
| + | Drift schema-vs-código | ✅ **sem drift** nas colunas base (contraste com a Fatia 3) |
| + | Legado sem `source_local_id` | 🗄️ **CATALOGADO** — mesma lógica de (b)/(d), ver §4.1 |

### (a) Não apaga o local — ✅ OK, mas o sentido do invariante mudou (REINTERPRETADO)

Nas Fatias 2/3, (a) protegia um local que era **a fonte ativa** durante a janela de transição —
não apagar antes do remoto confirmar garantia que nada se perdia numa migração em andamento. Para
`clients`, o local (`orbyt.clients.v1`) **já não é a fonte ativa** para quem tem workspace — é um
**snapshot congelado** de antes do cutover (ver (d) e (e) abaixo): ninguém grava nele mais via o
CRUD do dia a dia, só o fluxo de import legado ainda o lê. O que (a) garante hoje é mais estreito:
esse snapshot congelado — o único registro que resta de qualquer client local pré-cutover ainda
não reconciliado com a nuvem (é exatamente o que o diff da seção 0.3 mede) — não pode ser apagado
sem que esse dado suma de vez, sem nenhuma cópia em lugar nenhum.

Verificado nesta leitura: `useLocalClientsImport.ts` só escreve na chave de metadado
`kora.clients.supabaseImport.v1` (`localStorage.setItem` na linha 184); nunca
`removeItem`/`clear`/overwrite de `orbyt.clients.v1`. `useClients.ts` (hook local) idem — não há
caminho de código que apague o local a partir do fluxo de import. **OK no sentido estreito**
("nada apaga o arquivo histórico"), não no sentido amplo original ("o local segue sendo a fonte
protegida durante a transição") — esse segundo sentido não se sustenta mais para `clients`.

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

### (d) Reversibilidade — 🟡 REINTERPRETADO, não mais "✅ OK" no sentido clássico

Nas Fatias 2/3, (d) significa: flipar a flag de volta pra `"local"` mostra o local **intacto e
atual** — prova de que a escrita na nuvem nunca mutilou nem perdeu dado local, uma rede de
segurança viva durante a homologação. **Esse sentido já não se aplica a `clients`.** Como (e)
mostra, a flag já está em `"supabase"` por padrão sempre que há workspace — não existe mais um
caminho de escrita que espelhe no local o que é criado/editado/arquivado direto na nuvem. Flipar
a flag de volta pra `"local"` hoje não mostraria "o mesmo dado, só que da fonte local" — mostraria
o **snapshot congelado de antes do cutover**, sem nenhum dos clients criados ou editados via CRUD
Supabase-first desde então. Reversibilidade como rollback ao vivo **não existe mais** para esse
dado.

O que continua verdadeiro, e é o que a leitura de código desta Fase A consegue afirmar: nenhum
código de import ou de migration **corrompeu ou apagou** o snapshot congelado
(`orbyt.clients.v1`) — ele segue legível e consistente com o que existia antes do cutover. Essa é
uma garantia mais fraca que "reversível" no sentido original do protocolo, por isso o veredito
muda de ✅ para 🟡: não é uma rede de segurança para o dado novo, é a integridade de um arquivo
histórico. Rebaixado deliberadamente, não é o mesmo "OK" que as Fatias 2/3 reportam.

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

## 3. Recomendação de ajustes — histórico da proposta original (SUPERADA por §4, ver abaixo)

> ⚠️ Esta tabela foi escrita **antes** do diff (§0.3) rodar e da decisão C6. Mantida por
> histórico — não apagar uma leitura anterior sem nota, mesmo quando o resultado muda o
> encaminhamento. **Status atual de cada item está em §4, não aqui.**

| # | Item | Fase (como proposta originalmente) | Resumo |
|---|---|---|---|
| C1 | Coluna `clients.source_local_id` + índice **não-parcial** `UNIQUE (workspace_id, source_local_id)` | B.2 — **agora catalogado, não bloqueante** (§4.1) | Mesmo padrão de Q1/Q2 das Fatias 2/3 — arbiter de idempotência real no banco. |
| C2 | RPC `import_client_with_contacts` | B.2+B.1 — **substituído por C8** (§4.2) | O achado de atomicidade pai-filho não é mais sobre o import (catalogado) — é sobre o CRUD vivo. |
| C3 | `useLocalClientsImport.ts` chama a nova RPC | B.3 Passo 1 — **catalogado, não bloqueante** (§4.1) | Sem dado real pra importar hoje (C6). |
| C4 | `roundMoney` em `potentialValue`/`totalRevenue` | B.1 — **segue válido, não bloqueante** | Continua um ajuste de qualidade pendente, independente do C6. |
| C5 | Preservar o contrato de `kora.clients.supabaseImport.v1` byte a byte | restrição de design | Segue valendo, mesmo com o import catalogado — não desmontar o contrato que Fatia 2/3 usam. |
| C6 | Decisão do revisor sobre o CRUD Supabase-first | pré-requisito | **DECIDIDA — ver §4.1/§4.3.** |
| C7 | Fan-in de `client_contacts` — nenhum consumidor forward encontrado | B.1 (documentação) | Sem mudança. |

---

## 4. Decisão C6 (revisor, 2026-07-20) e redefinição da Fase B — escrita apenas, nada aplicado

### 4.1 C6 registrada — REGULARIZAÇÃO SEM MIGRAÇÃO DE DADO

**Medições do operador (§0):**

| Medida | Valor |
|---|---|
| Clients reais no local | **0** |
| Clients demo no local | **8** |
| Clients reais na nuvem | **2** |

**Cenário (i): nuvem ⊇ local.** Não existe nenhum client real vivendo só no local que precise
subir pra nuvem — a direção 1 do diff (§0.3, query 12/13) é vazia por definição, já que não há
candidato algum. Os 2 clients reais da nuvem não foram (e não podem ter sido, com local real = 0)
trazidos por nenhum import a partir do estado atual do local — nasceram direto na nuvem, via o
CRUD Supabase-first já ativo (§1 (e)), ou foram inseridos manualmente durante a preparação das
Fatias 2/3 (consistente com o client "fabio" usado no seed da Fatia 3, embora este documento não
tenha rodado a query (4)/(10) pra confirmar a origem exata — registrado como consistente, não
como fato verificado).

**Reclassificação da fatia:** de "migração local→nuvem" para **REGULARIZAÇÃO SEM MIGRAÇÃO DE
DADO**. Não há dado a mover. O trabalho que resta é formalizar, sob o protocolo, uma condição de
fato já em produção (§4.3) e corrigir o que estiver genuinamente quebrado nela (§4.2) — não
construir um pipeline de import para dado que não existe.

**Consequência sobre os invariantes de import** (b, d parcial, C1-C3, "legado sem
`source_local_id`"): viram **CATALOGADOS para instalação futura**, não bloqueantes. Ficam
descritos e prontos-pra-construir (mesmo padrão Q1/Q2/RPC das Fatias 2/3, nada novo a desenhar
quando chegar a hora), mas nada disso impede o fechamento desta fatia hoje. Gatilho de
reabertura: se um dia existir de novo um client real só no local (ex.: uso offline antes de
workspace existir), a query (12)/(13) volta a apontar isso e o catálogo vira execução.

### 4.2 Bloqueante remanescente: `client_contacts` — dois fluxos distintos, um deles quebrado agora

A Fase A original (§1, "Atomicidade pai-filho") tratou isso como um problema do **import**. Não é
— o import está catalogado (4.1), moot pra dado real hoje. Investigando mais a fundo pra responder
com precisão (não presumir), existem **dois fluxos de código separados** que tocam
`client_contacts`, com riscos completamente diferentes:

**Fluxo A — import legado (`useLocalClientsImport.ts:143-160`).** `createClient` seguido de um
loop `createClientContact` por contato, sem transação — a mesma classe de "cliente com contatos
decapitados" já registrada na Fase A. **Risco: catalogado, não ativo** — não roda hoje porque não
há candidato de import (4.1). Se um dia isso mudar, o risco reaparece junto.

**Fluxo B — aba "Contatos" da ficha do cliente, uso corrente (achado novo desta leitura).**
Existe uma UI **ativa e visível** hoje: `ClientProfileDrawer.tsx` renderiza uma aba "Contatos"
(`ContactsTab`, linha ~468) com adicionar/editar/remover contato, que chama
`onUpdateContacts(clientId, contacts)`. Em `src/pages/Clientes.tsx:834-837`, isso vira
`updateClient(id, { contacts })`. **O problema:** a função `updateClient` (linhas 196-232),
quando `source === "supabase"`, monta um `patch` a partir de uma lista explícita de campos
(`name`, `company`, `email`, ... — linhas 200-220) — **`contacts` não está nessa lista**. Não há
coluna `contacts` em `public.clients` (contatos vivem em `client_contacts`, tabela separada) e
nada nesse caminho chama `clientsRepository.createClientContact`/`updateClientContact`/
`deleteClientContact`. Resultado: `supabaseUpdate` é chamado com um patch que **não contém a
mudança de contato nenhuma**, o toast diz "Cliente atualizado no Supabase", e o estado React
local (`setSelectedClient`) reflete o contato como salvo — **mas nada foi persistido**. No próximo
refetch, `mapSupabaseClientToLocalClient` (linha 38) sempre devolve `contacts: []` — o contato
desaparece. **Isso não é uma questão de atomicidade — é perda de dado silenciosa, ativa, hoje**,
pra qualquer usuário com workspace (o caso normal) que tente usar a aba Contatos. Mais severo que
o achado original da Fase A.

**Por que a nuvem provavelmente mostra ~0 `client_contacts`:** consistente com esse bug — ninguém
que tentou adicionar um contato pela aba viu isso persistir de fato. (Não confirmado por query
nesta leitura — a contagem (2) da seção 0 mede isso; se vier 0, corrobora.)

**Correção proposta — dois itens, severidade diferente:**

| # | Item | Fase | Por quê |
|---|---|---|---|
| **C8** | Corrigir Fluxo B: `updateClient`/um hook dedicado (`useSupabaseClientContacts`?) passa a chamar `clientsRepository.createClientContact`/`updateClientContact`/`deleteClientContact` diretamente por contato. **Não precisa de RPC transacional** — `save()`/`remove()` do `ContactsTab` já operam um contato por vez; cada chamada já é atômica por ser uma única linha. | B.1 (código) — **prioridade alta, bug ativo** | Fecha perda de dado silenciosa em uso corrente. Mais simples que C2 original (RPC): é fiação faltando, não uma transação faltando. |
| **C2'** (era C2) | RPC `import_client_with_contacts` transacional, só pro Fluxo A | catalogado junto com 4.1 | Continua correta como desenho para quando o import voltar a ser relevante — não urgente hoje. |

Nenhum dos dois foi escrito ainda (código ou migration) — isto é diagnóstico + proposta.

### 4.3 Proposta de texto para o protocolo — regularização de P5 (NÃO incorporada ainda)

Data do cutover, apurada por `git log` (não estimada): `src/hooks/useClientsDataSource.ts:47` (a
linha que decide `source: "local" | "supabase"`) foi introduzida em **2026-06-15**, commit
`7ab2367`. Texto proposto, no molde das emendas §8/§9, **para aprovação do revisor antes de
entrar em `protocolo-homologacao.md`**:

> ## 10. Emenda [data de aprovação] — Regularização de P5 para `clients` (dívida assumida, sem
> > homologação retroativa)
> >
> > A nuvem (Supabase) é fonte oficial de leitura e escrita de `clients` desde **2026-06-15**
> > (commit `7ab2367`, `src/hooks/useClientsDataSource.ts:47`) — decisão do operador, anterior à
> > Etapa 5, fora do molde Espelho Reversível e sem nenhuma rodada de homologação sob este
> > protocolo. A Fatia 4 (Etapa 5) **não reverte** esse cutover — reverter quebraria uso corrente
> > já em produção. Esta emenda **regulariza o fato consumado**, registrado como **dívida
> > assumida**, não como violação corrigida: P5 ("flag em carência até homologar") não foi
> > cumprido para `clients` e não será cumprido retroativamente. O que a Fatia 4 entrega em troca:
> > (1) correção do bug ativo de perda de dado em `client_contacts` (C8); (2) catalogação
> > explícita, pronta-pra-construir, dos invariantes de import (idempotência, RPC atômica) para o
> > dia em que voltarem a ser relevantes (§4.1 da Fatia 4). Nenhuma outra entidade além de
> > `clients` está coberta por esta emenda — um cutover Supabase-first descoberto em outra
> > entidade exige o mesmo tratamento explícito, não herda esta emenda por analogia.

**Este texto está proposto.** Incorporação ao protocolo real é tratada como commit separado desta
entrega (§10 de `protocolo-homologacao.md`), após aprovação.

### 4.4 Design de C8 — correção do fluxo `client_contacts` (DESIGN, nenhum código escrito ainda)

**Achado adicional desta rodada de design, por precisão:** ao investigar como fica o "estado
depois de corrigido", achei que o problema não é só de escrita. `mapSupabaseClientToLocalClient`
(`src/hooks/useClientsDataSource.ts:9-41`) retorna `contacts: []` **fixo**, sempre — e
`listClientContacts` (já existe em `clientsRepository.ts:107`) **nunca é chamado em lugar
nenhum** do código. Ou seja: pra client Supabase, a leitura de contatos também nunca acontece hoje
— não é só que salvar não persiste, é que a aba "Contatos" nunca mostraria um contato real da
nuvem mesmo que existisse um. O design abaixo cobre leitura e escrita; corrigir só a escrita
deixaria a leitura quebrada do mesmo jeito.

#### (a) Decisão: operações individuais por contato, não patch com reconciliação de array

**Escolhido: operações individuais (create/update/delete direto por contato).**

Por quê:
1. A UI já opera um contato por vez. `ContactsTab.save(c)` recebe **um** `ClientContact`;
   `remove(id)` recebe **um** id. O "array inteiro" que hoje sobe via `onUpdateContacts` é
   artefato do modelo antigo (contacts como campo local aninhado), não uma necessidade da UX —
   não existe hoje nenhuma tela de edição em lote de vários contatos ao mesmo tempo.
2. Reconciliação de array (diffar o array novo contra o último conhecido pra decidir
   create/update/delete por item) só adicionaria uma camada de diff **em cima** do que operações
   individuais já fazem direto — sem ganhar atomicidade real, porque Postgres não tem "patch de
   array" nativo pra tabela filha sem uma RPC dedicada (e se for construir uma RPC, é o mesmo
   trabalho que C2' já cataloga pro import — aplicado ao caminho que não precisa).
3. Superfície de mudança menor: só a aba Contatos + um hook novo. Não mexe no `updateClient`
   genérico nem no patch-building que os outros campos de `clients` já usam e funcionam.
4. Cada operação individual já é atômica por ser uma linha só — não há "pai+filhos" numa única
   ação de contato, é sempre "um contato".

**Risco do caminho escolhido:** se a UI um dia ganhar edição em lote de vários contatos numa tela
só, este desenho vira N chamadas de rede sequenciais sem atomicidade entre elas — precisaria ser
revisitado então (não é grátis pra sempre, é a escolha certa pro formato de UI atual).

**Risco do caminho não escolhido (reconciliação):** mais código, mais superfície de bug (diff
errado apagando o contato certo), sem ganho de atomicidade sem RPC — e RPC pra isso seria esforço
duplicado do C2' catalogado.

**Arquivos afetados:**

| Arquivo | Mudança |
|---|---|
| `src/hooks/useSupabaseClientContacts.ts` (**novo**) | Hook React Query no molde de `useSupabaseClients.ts`: `useQuery` pra `listClientContacts(workspaceId, clientId)`; `useMutation` pra `createClientContact`/`updateClientContact`/`deleteClientContact`, cada uma invalidando a query própria no sucesso. |
| `src/components/clients/ClientProfileDrawer.tsx` | `ContactsTab` passa a receber a origem (`source`) ou os handlers já resolvidos. Quando `supabase`: usa o hook novo pra ler (corrige o gap de leitura) e escrever contato a contato. Quando `local`: **comportamento inalterado** — `onUpdateContacts` como hoje, zero regressão. |
| `src/pages/Clientes.tsx` | Passa `source` pra baixo (ou substitui `onUpdateContacts` por um conjunto de handlers condicionais equivalente ao que já faz pra `addClient`/`updateClient`/etc.). Caminho local idêntico ao atual. |
| `src/repositories/clientsRepository.ts` | **Sem mudança de assinatura** — os 3 métodos já existem e já são usados pelo import legado; ganham um segundo chamador. |

**Gotcha registrado, pra não ser descoberto em produção:** `mapSupabaseClientToLocalClient`
(`useClientsDataSource.ts:9`) faz `id: s.id as unknown as number` — o `client.id` de um client
Supabase é, em runtime, uma **string** (UUID) mascarada de `number` pelo TypeScript. Qualquer
chamada nova a `clientsRepository.*ClientContact(workspaceId, clientId, ...)` precisa
`String(client.id)`, nunca o valor cru — risco de bug silencioso (`"[object Object]"` ou UUID
malformado na query) se o cast for esquecido.

#### (b) Estado intermediário se uma operação de lote falhar (3 contatos, a 2ª falha)

Com a escolha de (a), **Fluxo B (UI viva) nunca emite mais de 1 escrita em `client_contacts` por
ação do usuário** — o cenário "3 contatos editados, 2ª falha numa mesma operação" **não existe
nesse desenho, por construção**: cada save/remove é uma chamada isolada, com sucesso ou erro
imediato e visível (toast), sem lote. Editar 3 contatos = 3 ações do usuário = 3 chamadas
independentes; se a 2ª falhar, a 1ª já persistiu (correta) e a 3ª nunca foi disparada (usuário vê
o erro da 2ª e decide se tenta de novo) — sem inconsistência, porque não há "operação composta"
nenhuma pra ficar pela metade.

A pergunta continua válida pro **Fluxo A** (import legado, catalogado — fora do escopo de C8,
resposta registrada aqui pra quando a RPC C2' for desenhada):
- **Hoje, sem C2':** client é criado, depois um loop cria contato 1, 2, 3 — se o 3º falhar, o
  client **já existe na nuvem com 2 dos 3 contatos**. O usuário vê um toast de erro genérico
  ("Ocorreu um erro ao importar um ou mais clientes"), sem saber quantos contatos entraram. O que
  persiste: client completo + contatos 1 e 2; contato 3 nunca existiu. Estado inconsistente, sem
  rollback — a mesma classe de "cliente com contatos decapitados" já registrada na Fase A.
- **Com C2' (RPC transacional, catalogada, não construída):** a falha do contato 3 reverteria
  tudo (client + contatos 1 e 2 também) — mesmo padrão já provado em `import_quote_with_items` na
  Fatia 3, 0/0 nunca parcial.

#### (c) Testes que provariam a correção

| # | Caso | Prova |
|---|---|---|
| 1 | **Caso do bug atual, como pedido:** criar contato novo num client Supabase → simular refetch (reinvalidar a query / remontar o componente) → contato **persiste**, com um UUID real (não o `ct-<timestamp>-<random>` temporário do form). | Fecha a perda de dado silenciosa — é o teste que hoje **falharia** contra o código atual e passaria depois de C8. |
| 2 | Editar um contato existente → refetch → alteração persiste (não duplica, não reverte). | Confirma o branch UPDATE do hook novo. |
| 3 | Remover um contato → refetch → não reaparece. | Confirma o branch DELETE. |
| 4 | Client **local** (`source === "local"`) → fluxo de contatos 100% inalterado, sem chamada nenhuma ao Supabase. | Regressão zero no caminho que já funciona. |
| 5 | Erro de rede/validação numa operação individual → toast de erro específico daquele contato; os **outros** contatos da lista permanecem intocados (não somem, não duplicam). | Prova que não há efeito colateral cruzado entre contatos — reforça (b). |
| 6 | `client.id` (Supabase) chega como string no repository, não como o `number` que o TS afirma. | Regressão pro gotcha do cast — pega o bug antes de produção. |
| 7 | (Homologação manual, não unitário) Abrir a aba Contatos de um client real na nuvem, adicionar um contato, fechar o drawer, reabrir → contato ainda lá. | Prova end-to-end do que hoje falha silenciosamente. |

---

**PARADO aqui.** §4.4 é design — nenhum arquivo de código foi criado ou editado (`useSupabaseClientContacts.ts`
não existe ainda). A emenda §10 do protocolo segue como commit separado, tratado a seguir nesta
mesma entrega. Depois dos dois commits, aguardando "vai" literal do revisor colado neste chat pelo
operador antes de qualquer linha de código ou aplicação de migration.
