# Etapa 5 — G1/Materiais — Fase A (inventário) — SOMENTE LEITURA

> Zero código tocado. Molde de `docs/qa/etapa-5-flip-fichas-pacote.md`/`etapa-5-flip-tarefas-pacote.md`
> — inventário do domínio + mapeamento de assimetrias local↔nuvem usando o catálogo de classes de
> bug já conhecidas (G37/G40/G49/G52/G56/G67-classe) como checklist, não descoberta às cegas.

## Abertura

- Branch: `etapa-5-materiais-fase-a-inventario`, a partir do tip real de `origin/main` em
  `95e7f82` (`feat(financeiro): ressalva (b) do sign-off - EditTransactionDialog v1`), confirmado
  por `git fetch origin` antes de abrir.
- **Domínio nunca apareceu em nenhum pacote anterior** (`etapa-5-flip-clientes-pacote.md`,
  `etapa-5-flip-fichas-pacote.md`, `etapa-5-flip-financeiro-pacote.md`,
  `etapa-5-flip-projetos-pacote.md`, `etapa-5-flip-tarefas-pacote.md`) — confirmado por grep.

---

## ⚠️ Achado crítico (resumo executivo, antes do inventário completo)

**"Materiais" não é UM domínio — são DOIS campos irmãos, mesmo tipo (`ClientAsset[]`), destinos
completamente diferentes. Um já foi migrado (dentro do flip de Fichas Técnicas); o outro nunca
foi tocado e tem uma escrita ativa por padrão que finge sucesso sem persistir nada.**

1. **`Client.technicalSheet.assets`** ("Materiais da Ficha Técnica") — **já migrado**, mapeado
   pro campo real `materials` (JSONB) em `public.client_technical_sheets`, parte do trabalho já
   catalogado como G63 (`etapa-5-flip-fichas-pacote.md`). Fora de escopo aqui — citado só pra
   distinguir do achado real.
2. **`Client.assets`** ("Biblioteca do cliente", aba "Materiais" do perfil, `ClientLibrarySection.tsx`)
   — **este é o que nunca entrou no radar**. Campo embutido no registro `Client`
   (`types/domain.ts:107`), sem coluna, sem tabela, sem mapper — nenhum dos 3.
3. `Clientes.tsx:196-232` (`updateClient`, a função que TODOS os callers de escrita de cliente
   usam) monta o patch pra Supabase copiando campo por campo de uma lista explícita — **`assets`
   nunca está nessa lista** (nem `contacts`, achado irmão fora de escopo). Quando
   `onUpdateAssets(id, assets)` roda em modo Supabase (`Clientes.tsx:828`,
   `updateClient(id, { assets })`), o patch construído fica **`{}`** — um UPDATE vazio.
4. `supabaseUpdate(id, {})` resolve normalmente (não lança erro) → `toast.success("Cliente
   atualizado no Supabase.")` dispara → **o usuário recebe confirmação de sucesso e nada foi
   gravado**. A UI ainda parece certa nesse instante porque o mesmo callback também faz
   `setSelectedClient((prev) => ({ ...prev, assets }))` (`Clientes.tsx:829`) — atualização
   otimista só em memória. Um refetch (F5, reabrir o cliente, trocar de aba e voltar) apaga o
   material sem aviso nenhum.
5. **Não é um caso de laboratório** — `source === "supabase"` é o estado natural de qualquer
   sessão com workspace ativo (`useClientsDataSource.ts:48`: `workspaceLoading || workspace ?
   "supabase" : "local"`), sem seletor manual "Local"/"Supabase experimental" nesta tela (ao
   contrário de Quotes/Financeiro/Tarefas, que têm um toggle explícito com default opt-out
   documentado). **Qualquer usuário logado num workspace real está, por padrão, no caminho que
   perde o material silenciosamente.**

**Não corrigido aqui — Fase A é inventário.** Ver §8 (riscos) e §9 (recomendação).

---

## 1. Estado atual do domínio — hook local + storage

Não existe `useMaterials()`/hook próprio. `ClientAsset[]` aparece embutido em **dois** lugares do
mesmo registro `Client` (`src/types/domain.ts:12-29,107,161`):

```ts
export interface ClientAsset {
  id: string; title: string; type: ClientAssetType; url: string;
  description?: string; tags?: string[]; accessStatus: ClientAssetAccessStatus;
  kind?: "link" | "file"; fileName?: string; fileSize?: number; mimeType?: string;
  storagePath?: string; uploadedAt?: string; source?: "link" | "storage" | "manual";
  createdAt: string; updatedAt: string;
}
// Client.assets?: ClientAsset[]                      — "Biblioteca do cliente" (achado)
// Client.technicalSheet?.assets?: ClientAsset[]       — "Materiais da Ficha Técnica" (já migrado)
```

- **Storage local**: `orbyt.clients.v1` (`useClients.ts:48`) — mesma chave do registro de
  cliente inteiro, não uma chave própria (mesmo padrão do achado equivalente em Fichas Técnicas).
- **Leitura/escrita local real dos DOIS campos**: só através de `useClients()`/
  `useClientsDataSource()` (leitura) e `updateClient(id, { assets })`/`updateClient(id, {
  technicalSheet })` (escrita) — nenhum hook, nenhuma função dedicada.
- **Nenhuma chave auxiliar** própria (ao contrário de Fichas Técnicas, que tem
  `kora.technicalSheets.restoreBackups.v1` pra snapshots de desfazer).

---

## 2. Hooks/repository Supabase existentes

| Peça | Existe pra `technicalSheet.assets`? | Existe pra `Client.assets` (biblioteca)? |
|---|---|---|
| Coluna/tabela dedicada | **Sim** — `materials JSONB` em `public.client_technical_sheets` | **Não** — nenhuma coluna em `clients`, nenhuma tabela própria |
| Repository | `clientTechnicalSheetsRepository.ts` (`upsertTechnicalSheet`) | **Nenhum** |
| Hook de leitura Supabase | `useSupabaseTechnicalSheet.ts` | **Nenhum** — `mapSupabaseClientToLocalClient` (`useClientsDataSource.ts:7-42`) nunca atribui `assets` nem `technicalSheet` a partir do row cloud |
| Mapper (escrita) | `technicalSheetMapper.ts:19-24,78` (`assets[]` → `materials[]`, filtra `data:`/`blob:`) | **Nenhum** |
| Mapper (leitura) | `supabaseTechnicalSheetToLocalMapper.ts:17-65` (`materials`/`raw_payload.assets` → `assets[]`) | **Nenhum** |
| Import assistido | `useLocalTechnicalSheetsImport.ts` (cobre a ficha inteira, inclui `assets`) | **Nenhum** — `Client.assets` não é mencionado em nenhum assistente de import (`useLocalClientsImport`/equivalente) |

**Único ponto de contato real com Supabase**: `src/services/storage/clientAssetsStorage.ts` — um
serviço de **upload de arquivo bruto** pro bucket `client-assets` (Storage, não Postgres).
`uploadClientAvatar`/`uploadClientLogo` (usados por `ClientProfileDrawer.tsx`) e
`uploadClientMaterial` (usado por `ClientTechnicalSheetDialog.tsx` — **ficha técnica, não
biblioteca**). `ClientLibrarySection.tsx` (o componente da "Biblioteca do cliente", achado
principal) é **link-only** — sem `<input type="file">`, nunca chama `clientAssetsStorage` — todo
`ClientAsset` criado por lá tem `kind` indefinido (nunca `"file"`) e `url` digitada à mão.

**Achado colateral no serviço de Storage (afeta o lado já migrado, `technicalSheet.assets`):**
`clientAssetsStorage.validateMaterialFile()` (linha 48-62) aceita PDF/DOCX/XLSX/TXT/PNG/JPEG/WebP
até **8MB** no client-side — mas o bucket `client-assets`
(`supabase/migrations/20260530030000_create_client_assets_storage.sql:5-17`) só permite
`['image/png','image/jpeg','image/webp']` até **2MB** (`file_size_limit: 2097152`). Qualquer
upload de PDF/DOCX/XLSX/TXT, ou de imagem entre 2MB e 8MB, **passa na validação da tela e falha
no upload real pro Storage** — o usuário vê o erro genérico do Supabase Storage, não a mensagem
amigável que a tela já tem pronta pra esses casos. Registrado como R3 (§8).

---

## 3. Mapper — não existe (lado do achado)

`Client.assets` nunca passa por `mapLocalQuoteToSupabaseQuote`/equivalente — não há função. A
"assimetria" aqui não é um campo esquecido dentro de um mapper (classe G37/G68 clássica); é a
**ausência total de um mapper**, porque o campo nunca teve um lugar cloud desenhado pra ir. Mesma
raiz do achado de Fichas Técnicas §7 linha G37 ("não é campo esquecido — é campo que nunca teve
desenho de destino"), só que sem nenhum catch-all tipo `raw_payload` recebendo o valor de
qualquer jeito — aqui o dado simplesmente não sai do dispositivo.

---

## 4. Flags atuais

**Nenhuma flag própria.** Não existe `kora.materiais.*`/`kora.clientAssets.*` em `config/flags.ts`
— nem opt-in nem opt-out, porque não há comportamento cloud nenhum a ligar/desligar. O único
"seletor" que importa é o `source` de `useClientsDataSource()` (§ achado crítico, item 5) — que
não é uma flag deste domínio, é herdada de Clientes inteiro.

---

## 5. Produtores de escrita — inventário completo

| # | Caminho | Arquivo:linha | Gate | Estado real |
|---|---|---|---|---|
| 1 | Adicionar/editar/excluir item na "Biblioteca do cliente" | `ClientLibrarySection.tsx:116-160` (`handleSave`/`handleDelete`) → `onChange` → `ClientProfileDrawer.tsx:1112` (`onUpdateAssets`) → `Clientes.tsx:828` (`updateClient(id, { assets })`) | Nenhum — sempre disponível no perfil do cliente | **Achado crítico**: em modo Supabase, silenciosamente vira UPDATE vazio + toast de sucesso falso (§ topo) |

Só **1** produtor real (o componente é a única porta de entrada pra esse campo). Diferente de
Financeiro/Quotes (vários diálogos convergindo na mesma constraint, classe G56) — aqui o risco não
é colisão entre produtores, é o único produtor existente nunca ter tido a metade cloud construída.

---

## 6. Tabela cloud — não existe

Não há `public.client_assets`/`client_library`/coluna `assets` em `public.clients`. Confirmado por
grep exaustivo em `supabase/migrations/` — só 2 migrations mencionam "assets", e as duas são sobre
o **bucket de Storage** (`20260530030000_create_client_assets_storage.sql`,
`20260530040000_harden_storage_policies.sql`), nunca sobre uma tabela/coluna de metadados.

---

## 7. Relação com outros domínios

- **Timeline de atividades do cliente** (`ClientActivitiesTab.tsx` →
  `activityTimeline/buildMaterialEvents.ts:9`): lê **só** `client.technicalSheet?.assets` — a
  "Biblioteca do cliente" (`Client.assets`) **nunca gera evento nenhum** na timeline, mesmo
  quando um item é adicionado. Inconsistência de escopo entre os 2 campos-irmãos, não um bug de
  leitura bifurcada (a timeline já lê `client` inteiro via prop, não tem hook próprio a bifurcar
  aqui) — registrado como observação, não achado acionável nesta rodada.
- **Ficha do cliente / onboarding** (`KoraOnboarding.tsx:98`, `SheetTab` em
  `ClientProfileDrawer.tsx:1155,1164`): os indicadores de completude ("Materiais" preenchido?)
  também olham só `technicalSheet.assets` — mesmo padrão do achado acima.
- **Deep links**: nenhum encontrado. Não existe rota tipo `/clientes/:id/materiais/:assetId` nem
  `?asset=X` em nenhum `navigate()`/`useSearchParams()` deste repositório — `ClientAsset.id` é só
  uma chave de lista local (`genId()`, `ClientLibrarySection.tsx:55`), nunca vira parâmetro de URL.
  Classe G67 (ids em deep link quebrando com uuid) **não se aplica** — não há superfície pra
  quebrar.

---

## 8. Assimetrias local↔nuvem — checklist por classe conhecida

| Classe | Pergunta do checklist | Resultado |
|---|---|---|
| **G37** (payload completo) | Todo campo local com correspondência estrutural chega na escrita? | **Não se aplica no sentido clássico** — não há payload de escrita nenhum pra `Client.assets` (§3). O parente (`technicalSheet.assets`) já tem G37 respeitado (mapeado pra `materials[]`, filtrado corretamente). |
| **G40/G49** (vocabulário nuvem = local literal) | Existe enum/status traduzido incorretamente? | **N/A por ausência de coluna** — `ClientAssetAccessStatus` (`liberado`/`solicitar_acesso`/`publico`/`privado`/`expirado`/`revisar`) nunca chega numa coluna cloud pra precisar de tradução. Se uma Fase B for desenhada, essa é a primeira decisão de vocabulário a tomar (mesma classe do Q9 de Quotes) — registrado como decisão pendente, não achado. |
| **G52** (campo condicionado a transição de estado) | Existe um campo tipo `paid_at`/`won_at` que uma transição de status deveria setar/limpar? | **N/A hoje, latente se `kind: "file"` for usado** — `fileName`/`fileSize`/`mimeType`/`storagePath`/`uploadedAt` só fazem sentido quando `kind === "file"`, mas `ClientLibrarySection.tsx` nunca seta `kind` (link-only) — a condicionalidade nunca é exercitada na prática hoje. Mesmo padrão do G52 original (campo condicional sem produtor ativo — "bug latente até o campo ganhar produtor"). |
| **G56** (idempotência/constraint colidindo entre produtores) | 2+ produtores podem colidir na mesma constraint sem avisar? | **N/A** — 1 produtor só (§5), nenhuma constraint cloud existe pra colidir. |
| **G67-classe** (id/uuid perdido em cast ou campo omitido do mapper) | Existe um `Number()`/cast quebrando uuid, ou um campo simplesmente nunca lido/escrito de volta? | **A mesma classe do achado crítico, variante "escrita nunca chega a lugar nenhum"** — `updateClient` (`Clientes.tsx:196-232`) é estruturalmente idêntico ao padrão G67/G68 (\"caminho de escrita genérico existe, mas este campo específico nunca foi adicionado à lista\"), só que aqui não há SEQUER uma coluna de destino — é a versão mais severa da classe: não é `Number(uuid)===NaN` nem `campo omitido do mapper de leitura`, é `campo nunca chega a ser enviado, silenciosamente, com toast de sucesso por cima`. |
| **G30** (cache de mutação, resposta da própria escrita) | A UI atualiza a partir da resposta da mutation, ou só espera refetch? | **Nem chega a ser relevante** — não há mutation real (o UPDATE vai vazio), a atualização que a UI mostra é 100% otimista local (`setSelectedClient`), nunca confirmada por uma resposta de servidor. |

---

## 9. Riscos nomeados

- **R1 — Perda de dado silenciosa com confirmação de sucesso falsa (o achado crítico).** Qualquer
  material adicionado/editado/excluído na "Biblioteca do cliente" em modo Supabase (default de
  qualquer sessão com workspace) é descartado no primeiro refetch, com `toast.success` afirmando o
  contrário. Maior risco deste inventário — mesma classe de severidade do achado G30 original
  (Financeiro) e do R1 de Fichas Técnicas (G63), mas aqui não é vazamento de dado sensível, é
  perda de dado sem aviso. Mitigação mínima possível pra uma Fase B (não implementada aqui):
  decidir onde persistir (coluna JSONB nova em `clients`, ou reaproveitar
  `client_technical_sheets.materials` já que a estrutura é idêntica) antes de tocar
  `updateClient`.
- **R2 — Confusão de nomenclatura entre os 2 campos-irmãos.** "Materiais" na UI aparece em 2
  lugares com o mesmo rótulo genérico ("Materiais e Anexos" no menu da ficha técnica,
  "Biblioteca do cliente" dentro da aba "Materiais" do perfil) apontando pra 2 arrays diferentes
  com o mesmo tipo — fácil de uma futura mudança tocar o campo errado achando que são a mesma
  coisa. Vale nomear com mais precisão numa eventual Fase B (ex.: "biblioteca" vs "ficha técnica"
  no próprio código, não só na UI).
- **R3 — Mismatch de validação client-side vs. policy do bucket de Storage** (§2, achado
  colateral). Afeta o lado JÁ MIGRADO (`technicalSheet.assets`, upload real de arquivo) — PDF/
  DOCX/XLSX/TXT e imagens 2-8MB passam na tela e falham no Storage. Fora do escopo direto de
  "Materiais nunca migrado" mas descoberto no mesmo inventário — registrado pra quem for tratar
  Fichas Técnicas de novo, não uma ação desta rodada.
- **R4 — Nenhum limite de tamanho de array.** `Client.assets`/`technicalSheet.assets` crescem sem
  cap — mesma ausência de soft-cap já aceita como padrão noutros domínios (Fichas Técnicas R4,
  cérebro do robô Etapa 9) — não é um achado novo, registrado por completude.

---

## 10. Fechamento — recomendação, não decisão

**Domínio pequeno — cabe numa fatia, não pede ciclo próprio**, com uma ressalva: a fatia começa
com uma **decisão de desenho**, não com código direto.

- **Por que não pede ciclo próprio**: 1 produtor só (§5), 1 componente só (`ClientLibrarySection.tsx`),
  1 função de escrita a tocar (`updateClient`, `Clientes.tsx`), zero constraint/idempotência a
  desenhar (G56 N/A), zero deep link a proteger (G67-classe N/A por ausência de superfície). O
  volume de trabalho é comparável ao pacote de remediação de Fichas Técnicas (G63) — poucos itens,
  bem delimitados — não ao tamanho de Financeiro/Tarefas (múltiplos produtores, múltiplas telas,
  write flag própria).
- **Por que não é código direto ainda**: diferente dos outros domínios desta série (onde a
  Fase B reaproveita uma coluna/tabela já desenhada), aqui **não existe nenhum destino cloud pra
  `Client.assets`**. Antes de qualquer fix, alguém precisa decidir: (a) nova coluna JSONB
  `assets` em `public.clients`, seguindo o padrão de `client_technical_sheets.materials`; ou
  (b) mover "Biblioteca do cliente" pra dentro da MESMA tabela/coluna que `technicalSheet.assets`
  já usa (unificando os 2 campos-irmãos, resolvendo R2 de propósito); ou (c) aceitar que este
  campo fica local-only por decisão de produto (não seria a primeira vez — Q8/G41 já têm
  precedente de "campo sem coluna cloud, documentado, com aviso" em Financeiro) e só trocar o
  `toast.success` falso por um aviso honesto tipo "salvo só neste dispositivo" (mesmo padrão
  reaproveitável da ressalva (a) do sign-off de Financeiro, `Financeiro.tsx`).
- **Recomendação de sequência pro revisor decidir**: a opção (c) é a mais barata e resolve o R1
  (perda de dado com confirmação falsa) sem exigir nenhuma migration nem decisão de schema — troca
  um `toast.success` mentiroso por um aviso honesto, mesma filosofia de "nunca promete escrita que
  não existe" (G29) já aplicada em Financeiro/Fichas Técnicas. As opções (a)/(b) resolvem de
  verdade mas custam uma migration + mapper novos — decisão de produto, não urgência técnica (R1
  não é vazamento de dado sensível, é perda de conveniência).

---

## Referências

- `docs/qa/etapa-5-flip-fichas-pacote.md` — molde estrutural deste doc, achado irmão mais próximo
  em forma (campo embutido em `Client`, sem hook próprio, mesma classe de "escrita ativa sem
  metade cloud completa")
- `docs/architecture/kora-hub-auditoria-e-plano.md` — G29 (banner/toast que promete o que não
  faz), G30 (cache de mutação), G37/G67/G68 (payload/campo nunca chegando ao destino), G52 (campo
  condicional), G56 (idempotência) — classes usadas como checklist no §8
- `src/types/domain.ts:1-29,107,161` — shape completo de `ClientAsset`/`Client.assets`/
  `Client.technicalSheet.assets`
- `src/pages/Clientes.tsx:196-232` — `updateClient`, a função com a lista de campos que nunca
  inclui `assets` (achado crítico)
- `src/components/clients/ClientLibrarySection.tsx` — único produtor de `Client.assets`
- `src/services/storage/clientAssetsStorage.ts`,
  `supabase/migrations/20260530030000_create_client_assets_storage.sql` — mismatch de validação
  (R3)

---

**PARADO aqui — inventário encerrado, zero código alterado. Achado crítico (§ topo, R1)
registrado para decisão do revisor — não corrigido nesta rodada por instrução explícita de
escopo (só leitura + doc). Fase B (se houver) só com novo "vai".**
