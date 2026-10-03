# Etapa 5 · Fichas Técnicas — rodada FP0 (fix do G82: vínculo cliente→uuid)

Branch `etapa-5-fichas-fp0-g82`. Plano e achados: [`etapa-5-flip-fichas-fase-a.md`](../architecture/etapa-5-flip-fichas-fase-a.md) §3.A / §4 (FP0). Catálogo: G82 (**continua ABERTO** até a confirmação ao vivo — Caso 0 de [`etapa-5-flip-fichas-runbook.md`](etapa-5-flip-fichas-runbook.md)).

## O que mudou

| Peça | Antes | Depois |
|---|---|---|
| `services/technicalSheets/resolveSheetClientId.ts` (novo) | 3 pontos liam o mapa legado direto | `resolveSheetSupabaseClientId(id, map)`: **uuid → passthrough**; id local → `map[id]`; senão `null` (nunca o id local cru) — mesmo padrão de `resolveProjectFk`/`resolveTaskFk`. `findLocalClientForSheet`: acha o cliente local por id igual **ou** pelo mapa local→uuid |
| `useSupabaseTechnicalSheet` | `importedMap[String(id)]` | helper (uuid direto resolve) |
| `useBifurcatedTechnicalSheet` (F2) | local: `find(c.id === id)`; nuvem só com 3 opt-ins | cliente sem correspondente local ⇒ **nuvem, independente dos flags** (é a única fonte que existe); com correspondente local, comportamento anterior (flags + seletor) |
| `BrandingSection` / `AssetsSection` | `clientId={Number(clientId)}` ⇒ `NaN` | recebem o `clientId` string; resolvem pelo helper |
| `ClientTechnicalSheet.tsx` `persist` | fonte "local" ⇒ `updateClient(uuid)` (no-op silencioso) | cliente só-nuvem: fonte ativa = nuvem, gravação por seção vai direto (`upsert` com o uuid), sem depender do autosave; cliente legado: `updateClient(<id local>)`; sem cópia local ⇒ toast de erro (nunca no-op mudo) |
| Seletor "Local" para cliente só-nuvem | — | toast "Este cliente só existe na nuvem — não há cópia local da ficha." |
| 5º consumidor — `KoraOnboarding` passo "Preencher Ficha Técnica" | só `client.technicalSheet` local | também considera as fichas da nuvem (`useSupabaseTechnicalSheetsAll` + `clientTechnicalSheetsRepository.listTechnicalSheets`) |

## Decisão registrada (diverge do espírito do G63, de propósito)

O G63 tornou toda escrita nuvem da ficha opt-in. Para um cliente **só-nuvem não existe armazenamento local**, então manter "local por padrão" significa descartar a edição. A escrita nuvem aqui acontece **só como consequência de uma ação explícita do usuário (salvar a seção)** e só para esse caso; clientes com cópia local seguem o comportamento do G63 intacto. A invariante `accesses[].password` não muda: o payload continua sem `accesses` (`technicalSheetMapper.ts:45`).

## Campos sem caminho nativo na nuvem (G75) — NÃO silenciados

| Campo | Situação | Tratamento nesta rodada |
|---|---|---|
| `accesses` | nunca é gravado (G63, decisão permanente); FP2 (aviso/store local) pendente de decisão | toast de aviso ao salvar a seção em fonte nuvem: "Acessos ainda não é salvo de forma persistente na nuvem — a alteração não será mantida ao recarregar." A seção em si **não foi tocada** |
| `competitors` | escrito em `raw_payload`, nunca lido de volta (G83/FP1) | mesmo toast |
| demais campos (branding, persona, linha editorial, tipografia, redes, briefing, materiais) | colunas dedicadas ou `raw_payload.assets`, lidos de volta | sem aviso (persistem) |

O toast não bloqueia o salvamento dos outros campos.

## Fora do escopo / observações (reportar, não corrigir)

- `Clientes.tsx:312` — `Number(queryClientId)` (deep link `?clientId=` da própria tela de Clientes): mesma classe G67 **fora do domínio de fichas**; não tocado.
- `getTechnicalSheetDataSource(clientId)` é chaveado pelo id recebido (uuid agora). Uma escolha "supabase" gravada antes sob o id numérico local não é herdada pelo uuid — só afeta clientes legados que tinham optado pela nuvem (opt-in, G63).
- `KoraOnboarding` passos 1/3/4/5 continuam 100% locais (limitação já declarada no código); só o passo 2 (ficha) foi tratado. Fichas de clientes demo na nuvem também contam (a tabela não carrega o flag `is_demo`).
- Código morto do Dialog (G84), `accesses` (FP2), FP1 (round-trip), FP4 (cache de mutação), FP5 (textos): intocados.

## Testes (fixtures com **uuid real**, hooks reais onde a classe G67 se esconde)

| Arquivo | Cobertura |
|---|---|
| `resolveSheetClientId.test.ts` (novo) | passthrough de uuid, mapa local→uuid, nunca o id local cru, JSON corrompido, `findLocalClientForSheet` |
| `useSupabaseTechnicalSheet.test.ts` (novo) | hook real: uuid sem entrada no mapa busca a ficha com o uuid; regressão do id numérico mapeado/não mapeado |
| `useBifurcatedTechnicalSheet.test.ts` (+4) | cliente só-nuvem lê a nuvem com flags no default; legado mapeado fica local; invariante G63 por uuid |
| `ClientTechnicalSheet.uuid.test.tsx` (novo, 5) | página com hooks reais: vínculo resolvido, salvar seção → `upsert(ws, uuid)` e nunca `updateClient`, toast G75 de Concorrentes, upload de logo resolve o vínculo, cliente legado (local 7 ↔ uuid) segue local |
| `technicalSheet.consumers.uuid.test.tsx` (novo, 3) | `Snapshot` e as abas "Materiais"/"Ficha Técnica" do drawer com cliente uuid só-nuvem e hooks reais |
| `ClientActivitiesTab.test.tsx` | fixture com uuid real (era `"client-uuid-1"`, que não é um uuid) + asserção de que o id chega intacto ao hook |
| `KoraOnboarding.technicalSheet.test.tsx` (novo, 3) | ficha só na nuvem completa o passo; regressões (vazio; ficha local) |
| `ClientTechnicalSheet.test.tsx` (G63) | fixture ajustada: o cliente também existe no storage local (era o fixture que mascarava o G82) |

Prova fail→fix→pass por patch (sem stash, G65): com as fontes revertidas, **12 testes falham** em 6 arquivos (+ `resolveSheetClientId.test.ts` falha na importação, 7 testes sem rodar) e 37 passam (regressões); com o patch reaplicado, **56/56** passam nos 8 arquivos.

## Pendente

- Confirmação ao vivo do G82 (Caso 0) — por isso o G82 segue ABERTO.
- FP1 (G83), FP2 (accesses), FP3/FP4/FP5, G84 e o flip F4.
