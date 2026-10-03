# Etapa 5 · Fichas Técnicas — Fase A pós-F2/F3: levantamento do estado real e proposta de F4

> **Doc-only, zero código.** Complementa (não substitui)
> [`docs/qa/etapa-5-flip-fichas-pacote.md`](../qa/etapa-5-flip-fichas-pacote.md) — o pacote
> original (inventário + G63 + plano F1-F3 + revalidação). Este documento parte do que F2/F3
> entregaram e responde: o que ainda falta pra um flip de defaults (F4) ser seguro.
> Runbook de homologação (rascunho): [`docs/qa/etapa-5-flip-fichas-runbook.md`](../qa/etapa-5-flip-fichas-runbook.md).

## Abertura

- Branch `etapa-5-fichas-fase-a`, worktree `Kora-laneA`, a partir de `origin/main` em `005a435`
  (`docs(projects): doc da rodada completed_at…`), confirmado por `git fetch` antes de abrir.
- Método: leitura direta do código em `main` (não citação de doc). Tudo marcado **[confirmado por
  leitura]** foi lido no arquivo:linha citado; tudo marcado **[inferência — confirmar ao vivo]**
  é conclusão de leitura que só a homologação ao vivo prova (Caso 0 do runbook).
- Protocolo §0/§6: Code não acessa banco nem `localStorage` do operador — nenhuma afirmação abaixo
  sobre o conteúdo real de `client_technical_sheets` ou do mapa de import é fato observado.

---

## 1. Resumo executivo

1. **F2/F3 fecharam leitura nos 4 consumidores do G74 — mas a chave de vínculo cliente→uuid que
   essa leitura usa é o mapa legado local→uuid, e a lista de Clientes hoje é nuvem (ids = uuid).
   [inferência — confirmar ao vivo; achado novo, ver §3.A]**. Se confirmado, a ficha de um cliente
   que só existe na nuvem nunca resolve `supabaseClientId`: não lê, não grava, e a gravação "local"
   cai em `updateClient(uuid)` que não acha ninguém (no-op silencioso). Os testes de F2/F3 e da
   página usam ids numéricos locais e hooks mockados — não enxergam isso.
2. **O round-trip nuvem não é sem perda.** `competitors` é escrito (em `raw_payload`) e nunca lido;
   `accesses` nunca é escrito (G63, correto) e nunca lido; placeholder de binário volta como
   material fantasma; `branding` coluna leva dataURL sem sanitizar. Hoje isso fica escondido porque
   a fonte cloud é opt-in por cliente; com default `"supabase"` vira perda de dado com status
   "Salvo no Supabase" (§3.B).
3. **Os pedidos desta rodada (flip de defaults) contradizem a recomendação registrada no pacote**
   (§11.1/§11.3 do pacote: "manter manual — o incidente G63 nasceu de default automático"). A
   proposta abaixo cumpre o pedido (§5), mas **só com fatias pré-flip obrigatórias** (§4) e mantém
   a invariante de segurança de `accesses[].password` intacta. A decisão final é do operador/revisor.
4. Não há migration obrigatória pro flip. Há 3 drafts opcionais (§6), nenhum aplicado.

---

## 2. Estado real do domínio (pós F2/F3, `main` = `005a435`)

### 2.1 O que F2 e F3 fecharam

| Fatia | Commit | Entrega | Verificado |
|---|---|---|---|
| F2 | `e54bed5` | `useBifurcatedTechnicalSheet(clientId)` — escolhe cloud vs local por `getTechnicalSheetExperimentalEnabled() && getTechnicalSheetDataSource(clientId) === "supabase"`; reaproveita `mapSupabaseToLocalSheet` (G63: nunca reconstrói `accesses`/`competitors`) | [confirmado por leitura] `useBifurcatedTechnicalSheet.ts` |
| F3 | `68440eb` | 4 consumidores leem pelo hook: `ClientTechnicalSheetSnapshot.tsx`, `ClientProfileDrawer.tsx` (`MaterialsTab`, `SheetTab`), `ClientActivitiesTab.tsx` (+ `buildMaterialEvents` recebe o sheet por parâmetro), `ClientTechnicalSheetDialog.tsx` (draft inicial) | [confirmado por leitura] |
| G63 | `256950c` | `accesses` fora do `raw_payload`; 3 flags viraram opt-in; banner bifurcado; auto-promote removido | [confirmado por leitura] `technicalSheetMapper.ts:45`, `flags.ts:195-211,291-294` |
| 2b-fichas | `c637770` | `ClientTechnicalSheet.tsx` acha o cliente por `useClientsDataSource()` | [confirmado por leitura] `:244` |

**Leitura de F3 que o pacote não registrou (G84):** `ClientTechnicalSheetDialog` (o componente
`<ClientTechnicalSheetDialog>`, ~1780 linhas) **não é montado em nenhum lugar** da aplicação — só
em `ClientTechnicalSheetDialog.test.tsx`. O arquivo sobrevive como biblioteca de seções
(`ClientTechnicalSheet.tsx:66` importa dele). Logo, 1 dos "4 consumidores" do G74 era código
morto; e o prop `onUpdateTechnicalSheet` do `ClientProfileDrawer` (declarado `:157`, desestruturado
`:145`, **nunca invocado**) + o handler `Clientes.tsx:844` (`updateClient(id, { technicalSheet })`)
são fios soltos. **Se alguém um dia montar o Dialog, cai em G75-classe:** a whitelist de
`Clientes.tsx:updateClient` em modo Supabase não inclui `technicalSheet` → patch vazio +
`toast.success("Cliente atualizado no Supabase.")` mentindo. Recomendação: remover o Dialog órfão
em rodada de limpeza própria (fora do F4) ou, no mínimo, não montá-lo sem tratar isso.

### 2.2 Quinto consumidor não coberto pelo G74

`KoraOnboarding.tsx:35,91-102` — passo 2 ("Preencher Ficha Técnica") lê `useClients()` local e
`c.technicalSheet` local. Em modo nuvem nunca completa (e o passo 1 `clients.some(!isDemo)` lê a
mesma lista local). Mesma classe do G74, não catalogado. **[confirmado por leitura]**

### 2.3 Fonte de cada produtor em cada modo

Modo "default hoje" = `experimental` OFF, `autosave` OFF, `dataSource` "local" (G63).
Modo "pós-F4" = os três invertidos (§5).

| # | Produtor | Arquivo:linha | Hoje (default G63) | Pós-F4 (default novo) |
|---|---|---|---|---|
| P1 | Edição por seção da página (`persist`, chamado no `onSave`/`onChange` de cada seção — não por tecla) | `ClientTechnicalSheet.tsx:304-338`, `:870-894` | `activeDataSource="local"` → `updateClient(client.id, {technicalSheet})` **do `useClients()` local** | `"supabase"` + autosave → `upsertTechnicalSheet(ws, supabaseClientId, mapLocalToSupabaseSheet(next))` **se** `supabaseClientId` resolvido; senão toast de erro e edição só em memória |
| P2 | Botão "Salvar versão atual no Supabase" (AlertDialog "Salvar cópia no Supabase?" → "Salvar no Supabase") | `:281-299`, `:752-800` | Disponível só com `supabaseClientId` e `hasLocalData`; sem gate de flag | idem; passa a ser redundante com autosave ligado |
| P3 | "Restaurar do Supabase" (`RestoreFromSupabaseDialog`, "Restaurar versão Supabase") — escreve LOCAL a partir da nuvem, com backup em `kora.technicalSheets.restoreBackups.v1` | `:83-228`, `:740-749` | Só com ficha remota; chama `persist(restored)` → local | `persist(restored)` passaria a **escrever na nuvem** (porque a fonte ativa é supabase) — semântica do botão muda; ver §3.E |
| P4 | Import assistido em lote ("Importar Fichas Técnicas", Configurações → Dados) | `useLocalTechnicalSheetsImport.ts:137-193`, `Configuracoes.tsx:1518` | Opt-in manual; candidatos exigem `clientsImportMap[localId]` | idem (fonte irrelevante: sempre local→nuvem) |
| P5 | Upload de logo / de material (bucket `client-assets`) dentro de `BrandingSection`/`AssetsSection` | `ClientTechnicalSheetDialog.tsx:297-310` e `:1254-1265` (lógica); `ClientTechnicalSheet.tsx:870,894` (props) | Exige `supabaseClientId`; independe das flags | idem; **quebra por `Number(clientId)`**, §3.A |
| P6 | Dialog (`onSave` → `updateClient`) | `ClientTechnicalSheetDialog.tsx:76-80`, `Clientes.tsx:844` | **Não montado** (código morto) | idem |

Não há mirror best-effort (padrão G22) neste domínio: a escrita é sempre direta numa só fonte por
vez, escolhida por cliente. Isso é uma diferença estrutural em relação a Projetos/Tarefas.

### 2.4 Flags e o papel exato dos dois toggles

| Flag | Chave | Semântica hoje | Quem lê | UI |
|---|---|---|---|---|
| Modo experimental | `kora.technicalSheets.supabaseExperimental.enabled` | `=== "true"` (opt-in, G63) | `ClientTechnicalSheet.tsx:340` (`isExperimentalEnabled`, congelado por `useMemo([])` — só relê no remount), `useBifurcatedTechnicalSheet.ts:34` | Card **"Modo Supabase Experimental da Ficha Técnica"** (`Configuracoes.tsx:1721`, função local `SupabaseExperimentalToggleCard`) |
| Autosave | `kora.technicalSheets.supabaseAutoSave.enabled` | `=== "true"` (opt-in, G63) | `ClientTechnicalSheet.tsx:265` (`useState` lazy + listener `storage`) | Card **"Fichas Técnicas Supabase - Autosave Experimental"** (`QuotesSupabaseTechnicalSheetsAutoSaveToggleCard.tsx`; o nome do arquivo cita "Quotes" por engano — o card é 100% de Fichas) |
| Fonte por cliente | `kora.technicalSheets.dataSource.v1` (mapa JSON `{clientId: "local"\|"supabase"}`) | só `"supabase"` explícito escolhe nuvem | `flags.ts:291`, página `:343`, hook F2 `:35` | Botões "Local" / "Supabase experimental" na página (só aparecem com experimental ON; "Supabase experimental" `disabled={!supabaseClientId}` com cadeado) |

**Correção ao pacote (§2):** o pacote afirma "Nenhum card equivalente para
`TECHNICAL_SHEETS_EXPERIMENTAL_KEY`". Existe: o card inline do experimental está em
`Configuracoes.tsx:1721` e é renderizado ao lado do de autosave (`:873-875`). **[confirmado por leitura]**

Papel de cada uma, em frase: *experimental* = "esta tela pode mostrar/escolher a fonte nuvem"
(sem ele `activeDataSource` é sempre `"local"`, mesmo com o mapa dizendo `"supabase"`);
*autosave* = "em fonte nuvem, `persist` grava sozinho"; sem ele, em fonte nuvem a edição vive só em
memória até o clique em "Salvar versão atual no Supabase" (banner "Modo Supabase experimental
ativo" descreve exatamente isso, bifurcado por `autosaveEnabled`).

**Assimetria de sincronização (registrar):** o card do autosave dispara
`window.dispatchEvent(new Event("storage"))` (o listener da página reage); o card do experimental
**não** — e a página congela `isExperimentalEnabled` no mount. Ligar/desligar o experimental só
tem efeito após recarregar a ficha. Aceitável; vira item de runbook (§ runbook Caso 8).

### 2.5 O que ainda grava só local

- Fonte "local" (default atual): toda edição de ficha — `orbyt.clients.v1` via `updateClient`
  local (**só efetiva para clientes que existem no storage local**, ver §3.A).
- `accesses[]` — local por decisão permanente (G63); nunca vai pra nuvem.
- `competitors[]` — escrito em `raw_payload` mas nunca lido de volta (efetivamente local).
- Backups de restore (`kora.technicalSheets.restoreBackups.v1`) — local por desenho.
- Binários (`data:`/`blob:`) — filtrados fora da nuvem por desenho; arquivos reais vão pro bucket.
- Materiais da "Biblioteca do cliente" (`Client.assets`, G75) — domínio vizinho, sem coluna.

---

## 3. Achados novos (todos sem número de G — numeração a cargo do revisor)

> IDs atribuídos pelo revisor após esta Fase A: **A = G82**, **B = G83**, **Dialog órfão (§2.1) = G84**, **C = adendo ao G29**; D e E seguem sem ID (decisões de produto). Entradas no catálogo mestre. Nenhum foi
> corrigido (doc-only). A e B são pré-requisitos do F4; C–E entram como fatias do F4 ou limpeza.

### A — **G82**. Vínculo cliente→uuid quebrado pelo flip de Clientes (classe G67 + G74) — **ALTO se confirmado**

**Mecanismo [confirmado por leitura]:**
1. `useClientsDataSource` devolve a lista **cloud** sempre que há workspace (`source = workspaceLoading
   || workspace ? "supabase" : "local"`), com `id: s.id as unknown as number` — **uuid**.
2. O drawer navega para `/clientes/${client.id}/ficha-tecnica` (`ClientProfileDrawer.tsx:346,1080`),
   então `useParams().clientId` é o uuid.
3. `useSupabaseTechnicalSheet(clientId)` resolve `supabaseClientId` por
   `importedMap[String(clientId)]` (`useSupabaseTechnicalSheet.ts:30-43`). O `importedMap` de
   `kora.clients.supabaseImport.v1` é **idLocal → uuid** (`useLocalClientsImport.ts:160-176`;
   confirmado nos comentários dos mappers de quotes/projects/tasks/finance/crm). Chave uuid ⇒ miss ⇒ `supabaseClientId = null`.
4. `useBifurcatedTechnicalSheet(client.id)`: ramo nuvem → `useSupabaseTechnicalSheet` desabilitado
   (`enabled: !!supabaseClientId`) → `EMPTY_SHEET`; ramo local → procura em `useClients()` local por
   `String(c.id) === uuid` → miss → `EMPTY_SHEET`. **Os 4 consumidores do G74 mostram "vazio"
   para qualquer cliente cloud, em qualquer fonte.**
5. A página, ramo local: `setSheet(client.technicalSheet ?? {})` (cliente cloud não tem o campo) e
   `persist` → `updateClient(client.id, …)` de `useClients()` local → `prev.map(c => c.id === id …)`
   não casa → **no-op**; `setSheet(next)` mantém o estado em memória, a edição some no reload, sem
   toast de erro.
6. **G67 literal, 2 pontos:** `ClientTechnicalSheet.tsx:870` (`BrandingSection … clientId={Number(clientId)}`)
   e `:894` (`AssetsSection … clientId={Number(clientId)}`) → `NaN` com uuid; as duas seções fazem
   `if (!clientId) return null` ao resolver `supabaseClientId` (`ClientTechnicalSheetDialog.tsx:297-310`,
   `:1254-1265`) → upload de logo/material sempre cai em "Vínculo Supabase ou workspace ativo ausente.".

**Por que os testes não pegam [confirmado por leitura]:** `ClientTechnicalSheet.test.tsx` mocka
`useSupabaseTechnicalSheet` e usa `CLIENT_ID` numérico local; `useBifurcatedTechnicalSheet.test.ts`
usa cliente `id: 1`. Nenhum exercita o par (id cloud uuid, mapa local→uuid).

**Atenuante:** quando o usuário abre a ficha por um cliente que **também** existe no storage local
com o mesmo id numérico (modo local de Clientes, sem workspace), tudo funciona. O problema é
específico de "workspace ativo + cliente cloud" — o estado normal pós-G58.

**Confirmação ao vivo (Caso 0):** abrir a ficha de um cliente criado nativamente na nuvem;
esperado pela leitura de código: "Este cliente ainda não está vinculado ao Supabase." no Painel
Versão Supabase, botão "Supabase experimental" desabilitado (cadeado).

### B — **G83**. Round-trip assimétrico — perda silenciosa com "Salvo no Supabase" (classe G37 + G75)

| Campo | Escrita | Leitura (`mapSupabaseToLocalSheet`) | Efeito em fonte nuvem |
|---|---|---|---|
| `branding/persona/editorial/typography/social/briefing` | coluna dedicada | coluna | OK |
| `assets[]` | `materials[]` (só `url` real) + `raw_payload.assets` | prefere `raw_payload.assets` | OK, **exceto** B1 |
| `competitors[]` | só `raw_payload.competitors` | **nunca lido** | usuário adiciona concorrente → badge "Salvo no Supabase" → reload → sumiu |
| `accesses[]` | **nunca** (G63) | nunca | seção "Acessos" aparece vazia; o que o usuário digita nela some no reload com badge "Salvo" |
| B1 — placeholder | `assets[].url` com `data:`/`blob:` vira `"[Conteúdo binário não enviado nesta etapa]"` no `raw_payload` | o filtro de leitura só barra `url.startsWith("data:"\|"blob:")` — o placeholder **passa** | material-fantasma com URL de texto na lista |
| B2 — `branding` coluna | `branding: localSheet.branding \|\| {}` (o objeto **original**; a sanitização só roda na cópia de `raw_payload`) | zera `logoUrl` que comece com `data:`/`blob:` | dataURL (base64) de logo trafega e fica gravada na coluna `branding` (peso; R4 do pacote) e é descartada na leitura |

Hoje isso é contido porque a fonte nuvem exige 3 opt-ins. Com os defaults invertidos, vira o
caminho principal — por isso **B é pré-requisito do F4** (não do F2/F3).

### C — **G29 (adendo, sem ID novo)**. Textos de UI que viram falsos no flip (classe G29) — lista fechada

`ClientTechnicalSheet.tsx`: `:469` ("Tudo é salvo automaticamente neste dispositivo…"), `:571` +
`:577` (selo "Somente Leitura"/"A edição principal desta página ainda usa dados locais…"),
`:736` ("A edição principal desta página ainda usa dados locais. O Supabase recebe apenas uma cópia
manual…"), `:789` ("A edição principal continuará local nesta etapa."), `:133` (toast "…A edição
principal continua local nesta etapa."), `ClientTechnicalSheetDialog.tsx:103` ("Tudo salvo
localmente neste dispositivo."), e os textos dos 2 cards de Configurações ("Permite testar a
leitura e salvamento manual…", "substituindo o modelo de backup manual"). Todos descrevem o
modelo pré-flip.

### D. Sem gate de papel e sem cache de mutação (classes G71 / G30)

- A página não usa `useWorkspaceRole` (grep: zero ocorrências) e a RLS de
  `client_technical_sheets` é `is_workspace_member(workspace_id)` nos 4 comandos. A ficha guarda
  logins/notas de acesso de terceiros (hoje local; `accesses` não vai pra nuvem, mas
  persona/briefing/materiais vão). Qualquer membro grava/apaga. Mesma pergunta que o G71 fez pro
  robô; registrar como decisão de produto (viewer deveria só ler?), não tratar como bug.
- `handleSaveToSupabase`/`persist` fazem `refreshSupabase()` (refetch) depois do upsert e **não
  usam a linha devolvida** (`upsert().select().single()`, `clientTechnicalSheetsRepository.ts`).
  Padrão G30 original; sem sintoma relatado, mas com autosave default vira o caminho principal e o
  lag de leitura reverteria a UI (`useEffect` `:385-398` re-seta `sheet` quando `supabaseSheet` muda).

### E. Semântica do "Restaurar versão Supabase" muda com o flip

Hoje (fonte local) restaura nuvem → local (com backup). Pós-F4 (fonte nuvem) `persist(restored)`
gravaria na nuvem o que veio da nuvem — operação sem efeito prático e com texto errado ("Versão
Supabase restaurada localmente"). O botão perde sentido; decidir remoção ou reorientação
(restaurar **backup local** → nuvem).

---

## 4. Fatias necessárias ANTES do flip

> Cada uma com o molde da casa: fail→fix→pass por patch, gates literais, §18. Numeração FP-n é
> provisória deste doc. Lanes sugeridas só por afinidade de arquivo.

| Fatia | O que faz | Arquivos | Classe | Bloqueia flip? |
|---|---|---|---|---|
| **FP0** | `resolveSupabaseClientId(clientId)` único: se `clientId` for uuid → ele mesmo; senão `importedMap[String(id)]`. Trocar os 3 call sites (hook, `BrandingSection`, `AssetsSection`) e remover `Number(clientId)` em `:870`/`:894` (passar `string`). Guard em `persist` local: id sem cliente local ⇒ toast honesto, nunca no-op silencioso. Ramo local do hook F2 deve ficar nulo-seguro pra uuid | `useSupabaseTechnicalSheet.ts`, `ClientTechnicalSheet.tsx`, seções no `ClientTechnicalSheetDialog.tsx`, `useBifurcatedTechnicalSheet.ts` | G67, G74 | **Sim — sem FP0 o flip entrega uma ficha que não grava** |
| **FP1** | Round-trip lossless: ler `competitors` de `raw_payload.competitors` (sem DDL; sem dado sensível) **ou** coluna dedicada (draft §6.1); filtrar placeholder na leitura (B1); sanitizar `branding` na escrita (B2) | `supabaseTechnicalSheetToLocalMapper.ts`, `technicalSheetMapper.ts` (+testes de roundtrip) | G37, G75 | **Sim** |
| **FP2** | Decisão + implementação de `accesses`. Recomendação: **local-only por desenho, com aviso honesto na seção em modo nuvem** ("Acessos ficam só neste dispositivo, por segurança") + store local próprio chaveado pelo uuid resolvido, pra o cliente cloud não "perder" o que digita. **Nunca** voltar a `raw_payload`/coluna sem autorização nova (invariante do pacote §11.3) | `AccessesSection`, `ClientTechnicalSheet.tsx`, helper de store | G63, G75 | Decisão: **sim** (o flip esconde a seção); implementação mínima = aviso + store |
| **FP3** | 5º consumidor: `KoraOnboarding` passo 2 via `useBifurcatedTechnicalSheet` por cliente (hook por item exige subcomponente ou um `useBifurcatedTechnicalSheets(ids)` — escolher na rodada) | `KoraOnboarding.tsx` | G74 | Não (degradação cosmética), mas incluir |
| **FP4** | Mutação nativa com `setQueryData(["supabase-technical-sheet", ws, supabaseClientId], returned)`; remover dependência de refetch; serializar autosaves (um upsert por vez por cliente; `persist` usa `sheet` do closure) | novo `useSupabaseTechnicalSheetMutation` ou extensão do hook | G30 | Recomendado antes (autosave vira padrão) |
| **FP5** | Reescrever os textos do §3.C; decidir destino do "Restaurar versão Supabase" (§3.E); remover/reorientar selo "Somente Leitura" | `ClientTechnicalSheet.tsx`, Dialog, `Configuracoes.tsx`, card do autosave | G29 | Junto do flip (mesmo PR da Fase C) |
| **FP6** | (opcional) Limpeza: remover o `ClientTechnicalSheetDialog` órfão e o `onUpdateTechnicalSheet` fóssil | `ClientTechnicalSheetDialog.tsx`, `ClientProfileDrawer.tsx`, `Clientes.tsx` | G75-classe latente | Não |

**Sobre os dados locais existentes:** quem tem ficha local preenchida de antes (clientes do
`orbyt.clients.v1`) enxergará a ficha "vazia" após o flip (a fonte padrão passa a ser a nuvem) até
usar o import assistido. Incluir em FP5 um aviso na página quando houver `technicalSheet` local
para o mesmo cliente (resolvido pelo mapa) e nuvem vazia: "Existe uma ficha local deste cliente
que ainda não foi importada" apontando para Configurações → Dados → "Importar Fichas Técnicas".
(Só funciona pra clientes presentes no mapa legado; clientes cloud puros não têm ficha local.)

---

## 5. Proposta F4 — flip dos defaults (formato das Fases C anteriores)

### 5.1 Mudança (≈ 3 funções em `flags.ts`)

```ts
// ANTES (G63, hoje)
getTechnicalSheetExperimentalEnabled(): safeGet(KEY) === "true"
getTechnicalSheetAutoSaveEnabled():     safeGet(KEY) === "true"
getTechnicalSheetDataSource(id):        map[String(id)] === "supabase" ? "supabase" : "local"

// DEPOIS (F4) — mesmo padrão de tarefas/projetos/financeiro
getTechnicalSheetExperimentalEnabled(): safeGet(KEY) !== "false"   // opt-out: só "false" desliga
getTechnicalSheetAutoSaveEnabled():     safeGet(KEY) !== "false"   // opt-out: só "false" desliga
getTechnicalSheetDataSource(id):        map[String(id)] === "local" ? "local" : "supabase" // só "local" explícito
```

Efeitos colaterais a tratar no mesmo PR: `flags.test.ts` (invertido), comentário de topo e do G63
em `flags.ts`, status inicial dos 2 cards ("Status: Ativo" por padrão), banner de
`ClientTechnicalSheet.tsx` (passa a ser o estado normal, não "experimental"), e **o rótulo
"experimental"** (decisão de produto: manter como kill-switch ou renomear).

### 5.2 Por que isso é perigoso aqui e não nos outros domínios

- Os outros 4 flips mudaram de qual lado **de um espelho já em uso** o app lê/escreve; aqui a
  escrita nuvem hoje **não é usada por ninguém por padrão** (G63 a desligou) e há um achado A
  (vínculo) que pode fazê-la inoperante. Flipar sem FP0 troca "grava no local" por "não grava em
  lugar nenhum com sucesso aparente".
- O incidente G63 nasceu exatamente da combinação "3 defaults ligados + payload sem sanitização".
  A sanitização existe hoje (`technicalSheetMapper.ts:45`); o que continua faltando é o
  round-trip (B) e o vínculo (A). O flip não repete o G63 **se e só se** FP0/FP1/FP2 entrarem antes.
- Invariante inegociável (herdada do pacote §11.3): `accesses[].password` não entra em nenhum
  payload, em nenhuma direção, em nenhum hook novo. O flip não altera isso; um teste de regressão
  deve provar (já existe um no `technicalSheetMapper.test.ts`/página — manter e estender ao
  `useBifurcatedTechnicalSheet` e a qualquer mutation nova).

### 5.3 Rollback

- Nível 1 (sem deploy), por navegador: `localStorage.setItem("kora.technicalSheets.supabaseExperimental.enabled","false")`
  (derruba `activeDataSource` pra `"local"` em toda ficha) + F5. Por cliente:
  `kora.technicalSheets.dataSource.v1` com `{"<clientId>":"local"}` ou botão "Local" na página.
  Autosave isolado: `kora.technicalSheets.supabaseAutoSave.enabled="false"` (cai no modelo
  "Salvar versão atual no Supabase" manual).
- Nível 2: `git revert <hash-do-flip>` — reverte só as 3 funções + testes; FP0–FP5 ficam.
- Fichas gravadas na nuvem **não** são apagadas por rollback; somem da view até a fonte voltar.

### 5.4 Riscos por classe de lição

| Classe | Aplica? | Risco / controle |
|---|---|---|
| G29 (texto desatualizado) | **Sim** | 8 textos listados em §3.C; FP5 |
| G30 (cache de mutação) | **Sim** | refetch pós-upsert + `useEffect` que re-seta `sheet`; FP4 |
| G32 (fetch paralelo) | Não-risco | `useSupabaseTechnicalSheet` já é `enabled: !!ws && !!supabaseClientId`; não condicionar à fonte (F2 respeitou). Em fonte local ele **continua** disparando um GET quando há vínculo — design da casa (G32) |
| G37 (payload completo) | **Sim** | B (competitors, placeholder, branding); FP1 |
| G40/G49 (vocabulário) | N/A | domínio sem enum/status persistido (pacote §7) |
| G52 (campo condicional) | N/A | sem transição de estado persistida |
| G56 (idempotência) | Baixo | `UNIQUE(client_id)` = regra de negócio; 2 produtores (autosave e "Salvar versão atual") ambos `upsert onConflict client_id` → last-write-wins sem versão. Risco real é **sobrescrever com estado local velho**: `handleSaveToSupabase` envia o `sheet` da tela. Prova no runbook (Caso 9) |
| G67 (uuid / `Number()`) | **Sim — ativo** | achado A (`Number(clientId)` ×2 + mapa local→uuid); FP0 |
| G72 (fixture de data fixa) | Teste | testes novos de F4 não podem comparar datas fixas com `new Date()` real |
| G75 (campo sem destino + sucesso falso) | **Sim — ativo** | `competitors`, `accesses`, `branding` dataURL; `onUpdateTechnicalSheet` fóssil; FP1/FP2/FP6 |
| G79 (vínculo cliente real) | Relacionado | a ficha depende do vínculo cliente↔uuid, não de vínculo cliente↔projeto; mas o `Snapshot` no drawer de projeto só aparece se `project.clientId` resolver — que o G79 diz não ser criável por UI |
| G63 (segredo) | **Sim — invariante** | §5.2 |
| G71 (gate de papel) | Decisão | §3.D |
| G74 (consumidores) | **Sim** | 5º consumidor (`KoraOnboarding`) e Dialog órfão; FP3/FP6 |

---

## 6. Migrations / CHECKs — DRAFTS, **NÃO APLICAR** (protocolo §0/§6/§8-b: DDL é do operador)

Nenhuma é pré-requisito do flip na recomendação acima. Ficam registradas para a decisão do operador.

```sql
-- 6.1 (opcional — alternativa a ler competitors de raw_payload): coluna dedicada
ALTER TABLE public.client_technical_sheets
  ADD COLUMN IF NOT EXISTS competitors jsonb NOT NULL DEFAULT '[]'::jsonb;
-- Backfill (somente após export manual): copiar de raw_payload
-- UPDATE public.client_technical_sheets
--   SET competitors = COALESCE(raw_payload->'competitors','[]'::jsonb)
--   WHERE competitors = '[]'::jsonb AND raw_payload ? 'competitors';

-- 6.2 (opcional — R4 do pacote): teto de tamanho do catch-all
ALTER TABLE public.client_technical_sheets
  ADD CONSTRAINT client_technical_sheets_raw_payload_size_chk
  CHECK (octet_length(raw_payload::text) <= 1048576) NOT VALID;
-- VALIDATE CONSTRAINT só depois de conferir que nenhuma linha existente estoura.

-- 6.3 (opcional — G71): escrita só para papéis de edição (padrão a copiar do que o repo já
-- usa para credencial equivalente; confirmar o helper de papel existente antes de redigir a policy)
```

Verificações de leitura (SELECT) para o operador rodar **antes** do flip, uma vez:

```sql
-- quantas fichas existem e quantas têm material-fantasma (B1)
SELECT count(*) FROM public.client_technical_sheets;
SELECT count(*) FROM public.client_technical_sheets
WHERE raw_payload::text LIKE '%[Conteúdo binário não enviado nesta etapa]%'
   OR branding::text   LIKE '%data:image%';
-- reconfirmação da invariante G63 (esperado 0)
SELECT count(*) FROM public.client_technical_sheets
WHERE raw_payload::text ILIKE '%password%' OR raw_payload ? 'accesses';
```

---

## 7. Decisões pendentes (para revisor/operador)

1. **Flip sim/não e quando** — o pacote recomendou "manter manual"; o pedido desta rodada propõe
   flip. Recomendação deste doc: flip só depois de FP0+FP1+FP2(decisão), e com FP5 no mesmo PR.
2. **`accesses`**: local-only com aviso (recomendado) × cofre criptografado futuro × nunca expor na UI cloud.
3. **`competitors`**: ler de `raw_payload` (sem DDL, recomendado v1) × coluna dedicada (§6.1).
4. **Papel** (G71): viewer só-leitura? Hoje qualquer membro grava.
5. **Rótulo "experimental"** após o flip e destino do "Restaurar versão Supabase".
6. **Dialog órfão** (FP6): remover agora ou deixar com aviso.
7. **Numeração de G** para os achados A, B, C/D/E e o 5º consumidor.

## Referências

- `docs/qa/etapa-5-flip-fichas-pacote.md` — pacote original (G63, G74, plano F1-F4)
- `docs/qa/etapa-5-flip-tarefas-runbook.md` / `…-homologacao-fase-d.md` — molde e lições
- `docs/architecture/kora-hub-auditoria-e-plano.md` — G29, G30, G32, G37, G63, G67, G71, G72, G74, G75, G79
- Código: `src/hooks/useBifurcatedTechnicalSheet.ts`, `useSupabaseTechnicalSheet.ts`,
  `useLocalTechnicalSheetsImport.ts`, `src/pages/ClientTechnicalSheet.tsx`,
  `src/services/technicalSheets/*`, `src/repositories/clientTechnicalSheetsRepository.ts`,
  `src/config/flags.ts`, `src/pages/Configuracoes.tsx:1518,1721`,
  `supabase/migrations/20260530020000_create_client_technical_sheets.sql`

**PARADO — doc-only, zero código. §18: aguardando "vai".**
