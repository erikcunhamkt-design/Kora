# Etapa 5 · Fichas Técnicas — F4: flip dos defaults (pacote da rodada)

> **[Status 2026-10-18 — varredura G29 do mapa do estado real]** "O flip só mescla com vai" está superado: **F4 mesclado** (`90142a4` + `ccd6326`, 2026-10-09; registrado em `a2e1134`). Pendente: a homologação Fase D com o operador.

Branch `etapa-5-fichas-f4-flip`, a partir de `be2e6cb`. **Decisão do revisor (FP2):** `accesses` só-local com aviso; invariante `accesses[].password` nunca na nuvem (já garantida pelo FP1/G63). Proposta original: [`etapa-5-flip-fichas-fase-a.md`](../architecture/etapa-5-flip-fichas-fase-a.md) §4/§5. Runbook de homologação (Fase D): [`etapa-5-flip-fichas-runbook.md`](etapa-5-flip-fichas-runbook.md).

> **O flip só mescla com "vai" explícito do revisor** e vira homologação Fase D de Fichas com o operador.

## 1. Fatias pré-requisito da Fase A — estado

| Fatia (Fase A §4) | Estado antes desta rodada | Nesta rodada |
|---|---|---|
| FP0 vínculo cliente→uuid (G82) | em `main` (`360b9f1`) | — |
| FP1 round-trip (G83) | em `main` (`b65edb5`) | — |
| FP2 `accesses` | decisão pendente | **implementada**: armazenamento local por dispositivo + aviso (§2) |
| FP3 5º consumidor (`KoraOnboarding`) | em `main` (FP0) | — |
| FP4 cache de mutação (G30) + serialização | **pendente** | **implementada** (§2) |
| FP5 textos + semântica do "Restaurar" + aviso de cópia local | **pendente** | **implementada** (§4) |
| FP6 Dialog órfão (G84) | em `main` (`6b0616f`) | — |

Mais uma guarda **que a Fase A não listou e o flip exige** (§3): a nuvem só vale quando alcançável.

## 2. Slices antes do flip (commit separado do flip)

- **FP2 — `accessesLocalStore.ts`** (`kora.technicalSheets.accessesLocal.v1`, chave = id da ficha na rota): em fonte nuvem, os acessos vivem só neste dispositivo. Página: `persist` grava o armazenamento local e avisa (`toast.info`: "Acessos salvos só neste dispositivo — não sincronizam com a nuvem (por segurança)"); ao carregar mescla do armazenamento (ou, pro cliente legado, da cópia local); a seção ganha a nota fixa "Acessos ficam só neste dispositivo…". `useBifurcatedTechnicalSheet` também mescla (consumidores — aba "Ficha Técnica" do drawer conta Acessos). **O payload da nuvem continua sem `accesses`** (`technicalSheetMapper.ts`, G63) e a leitura da nuvem nunca os devolve. `isDirty` ignora `accesses` (nunca "pendente de envio").
- **FP4 — G30 + ordem:** `useSupabaseTechnicalSheet` expõe `setCachedSheet`; a página grava no cache a **resposta do próprio upsert** (sem refetch; refetch só como fallback). Gravações são **serializadas** (uma por vez, na ordem das ações) por uma fila — seções salvas em sequência rápida não se atropelam.

## 3. O flip (`flags.ts`) + guarda de alcance

| Função | Antes | Depois |
|---|---|---|
| `getTechnicalSheetDataSource(id)` | `map[id] === "supabase" ? "supabase" : "local"` | `map[id] === "local" ? "local" : "supabase"` |
| `getTechnicalSheetExperimentalEnabled()` | `=== "true"` | `!== "false"` |
| `getTechnicalSheetAutoSaveEnabled()` | `=== "true"` | `!== "false"` |

**Autosave ligado por default** (a Fase A previa) — com o teste explícito exigido: o payload do autosave **não contém `accesses` nem a senha**, mesmo com acessos na ficha local (`ClientTechnicalSheet.test.tsx`, "teste explícito do autosave"; mais `technicalSheetMapper.test.ts` e `ClientTechnicalSheet.uuid.test.tsx`).

**Guarda de alcance (novo, necessário):** com o default na nuvem, um usuário **100% local** (sem workspace, ou cliente sem vínculo) passaria a cair em "Vínculo ausente" a cada edição e a ver a ficha "vazia". Por isso a fonte efetiva é a nuvem **somente se** `workspace` ativo **e** `supabaseClientId` resolvido (cliente só-nuvem continua forçado à nuvem — G82). Idem em `useBifurcatedTechnicalSheet` (consumidores). Testado: sem vínculo ⇒ grava local sem erro; sem workspace ⇒ idem.

### Rollback nível 1 (sem deploy; por navegador; nada é apagado)

```js
localStorage.setItem("kora.technicalSheets.supabaseExperimental.enabled", "false"); // tudo volta a "local"
localStorage.setItem("kora.technicalSheets.supabaseAutoSave.enabled", "false");     // grava só pelo botão manual
localStorage.setItem("kora.technicalSheets.dataSource.v1", JSON.stringify({ "<id>": "local" })); // por cliente
```

Também pela UI: botão **"Local"** na página; **Desativar** os 2 cards em Configurações. Nível 2: `git revert` do **commit de flip isolado** (as 3 funções de `flags.ts` + os textos que dependem dele + testes de defaults); as slices FP2/FP4 ficam. Testado (`ClientTechnicalSheet.test.tsx`, "rollback nível 1"): experimental `"false"` ⇒ fonte local e nunca a nuvem; `"local"` por cliente ⇒ idem; autosave `"false"` ⇒ sem gravação por seção, botão manual envia sem `accesses`.

## 4. Textos que viram falsos com o flip — corrigidos aqui

| Onde | Antes | Depois |
|---|---|---|
| Página — seletor e toast | "Supabase experimental" | "Supabase (nuvem)" |
| Página — banner | "Modo Supabase experimental ativo… Use com cuidado; o modo local continua disponível." | "Ficha sincronizada com o Supabase" + texto por autosave ligado/desligado |
| Página — painel "Versão Supabase" | badge "Experimental"; "A edição principal desta página ainda usa dados locais. A versão Supabase é somente leitura nesta etapa."; "…habilitar o modo experimental…" | sem badge; texto por fonte/alcance/override de rollback |
| Página — rodapé de ações | "A edição principal desta página ainda usa dados locais. O Supabase recebe apenas uma cópia manual… nesta etapa."; "A edição principal continuará local nesta etapa." | "…usa a cópia local deste cliente…"; "…continuará na cópia local." |
| Página — toast do restore | "…restaurada localmente. A edição principal continua local nesta etapa." | "…restaurada na cópia local deste cliente (backup anterior guardado)." |
| Página — nota de Acessos | "não sincronizam… não será mantido ao recarregar" (FP1) | "ficam só neste dispositivo…" (FP2) |
| Configurações — card | "Modo Supabase Experimental da Ficha Técnica" / "Permite testar a leitura e salvamento manual…" | "Ficha Técnica na nuvem (Supabase)" / texto de rollback + "acessos nunca vão para a nuvem" |
| Configurações — card | "Fichas Técnicas Supabase - Autosave Experimental" / "…substituindo o modelo de backup manual" | "Fichas Técnicas Supabase - Autosave" / texto atual |

Semântica: **"Restaurar do Supabase"** só aparece na fonte "Local" (copia nuvem → cópia local, com backup); na fonte nuvem restaurar nuvem→nuvem não faz sentido. Novo **aviso de cópia local não enviada** (fonte nuvem, sem linha na nuvem, cliente com cópia local com conteúdo): aponta **Configurações → Dados → "Importar Fichas Técnicas"** ou a fonte "Local".

## 5. Migrations

**Nenhuma obrigatória** (Fase A §6; nada novo nesta rodada). Os drafts opcionais continuam no pacote §8-b e **não bloqueiam** o flip: (6.1) coluna `competitors` — leitura já prefere a coluna e cai no `raw_payload`; escrita na coluna é follow-up depois da DDL; (6.2) teto de `raw_payload` — já validado no cliente (1 MB, G83); (6.3) gate de papel (G71-classe). Detalhes e SQL: `etapa-5-fichas-g87-g84-runbook.md` e Fase A §6.

## 6. Riscos por classe (revisão pós-FP0/FP1)

| Classe | Estado |
|---|---|
| G29 texto | tabela do §4; Caso 11 do runbook |
| G30 cache | FP4 — resposta do upsert vira o cache; teste "NENHUM refetch" |
| G32 fetch paralelo | inalterado (`enabled: !!ws && !!supabaseClientId`, não condicionado à fonte) |
| G37 payload completo | FP1 (G83) + `accesses` só-local por decisão |
| G56 idempotência | `UNIQUE(client_id)`; gravações serializadas (FP4); last-write-wins entre abas = **ressalva** do Caso 3.3 |
| G63 segredo | invariante intacta: payload sem `accesses`; teste explícito do autosave; SELECT 5.3 |
| G67/G82 uuid | FP0 + fixtures uuid reais |
| G71 papel | **continua decisão de produto** (qualquer membro grava — RLS `is_workspace_member`); draft 6.3 |
| G72 datas | testes novos sem data fixa |
| G75 sucesso falso | binário rejeitado com toast (G83); "Acessos" com aviso; sem vínculo ⇒ erro explícito |
| G79 | caso 7.4 pode ser parcial |

## 7. Testes

| Arquivo | O que prova |
|---|---|
| `flags.test.ts` (reescrito) | defaults pós-flip e opt-out das 3 funções |
| `ClientTechnicalSheet.test.tsx` (G63 → F4) | fonte nuvem + autosave por default; **payload do autosave sem `accesses`/senha**; aviso de cópia local; rollback nível 1 (3 formas); usuário 100% local (sem vínculo / sem workspace) |
| `ClientTechnicalSheet.uuid.test.tsx` (+3, 2 ajustados) | acessos só-locais (armazenamento por uuid, nunca no payload); legado mapeado usa a nuvem por default e o rollback por cliente volta ao local; **G30 sem refetch**; **gravações serializadas** |
| `useBifurcatedTechnicalSheet.test.ts` (reescrito) | defaults pós-flip, nuvem inalcançável ⇒ local, rollback, acessos só-locais, invariante G63 |
| `accessesLocalStore.test.ts` (novo) | store por cliente, `undefined` vs `[]`, JSON corrompido |
| `technicalSheet.consumers.uuid.test.tsx`, `KoraOnboarding.technicalSheet.test.tsx` | regressão dos consumidores F3 + onboarding com uuid real, sob os defaults novos (passam sem alteração) |

**Prova fail→fix→pass por patch (sem stash, G65):** com as 6 fontes revertidas e o store removido, **16 testes falham** e 2 arquivos falham na importação (hook bifurcado e store); 52 passam (regressões). Com o patch reaplicado, **86/86** nos 5 arquivos.

## 8. Fora do escopo / pendências

- Homologação Fase D com o operador (runbook) e a confirmação ao vivo de G82/G83 (Casos 0, 4, 6).
- G71 (gate de papel) e os drafts §8-b: decisão do operador.
- Escrita de `competitors` na coluna: só depois de o operador aplicar o draft 6.1.
- Não tocados: CRM/QuotesSection (lane B), WhatsApp*, Projetos, `tasksMapper`.
