# Etapa 5 · Fatia 1 (teste de fogo) — `client_technical_sheets` (Ficha Técnica)

> **Escopo desta fatia:** HOMOLOGAR o ciclo `local → nuvem → local` e CRISTALIZAR o molde
> reutilizável ["Espelho Reversível"](../architecture/espelho-reversivel.md). **NÃO** aposentar
> a flag experimental (fica em **carência** reversível). O caminho já existia (~90% pronto);
> a fatia é auditar + testar + homologar, não construir do zero.
>
> **Regra de dados:** o Code **não dispara** import nem aplica nada em produção. O disparo do
> import é **ação do operador**, após o gate de segurança da Fase B.2 (**ver seção 0** — como
> não há backup automático, o gate é **EXPORT MANUAL** + **PRINT pré-clique**).
>
> Diagnóstico da etapa: [`etapa-5-diagnostico.md`](etapa-5-diagnostico.md).

---

## 0. DECISÃO SOBRE BACKUP e gates da Fase B.2 (registro permanente)

> ⚠️ **Este projeto Supabase está no plano FREE e NÃO tem backup automático ativo**
> (`LAST BACKUP: No backups`). Logo, o gate "confirmar backup/PITR" das outras etapas
> **não se aplica** e é substituído pelos gates 0.2 e 0.3 abaixo.

### 0.1 Declaração do operador (verbatim)

> "Estou ciente de que meu projeto Supabase está no plano free e não tem backup ativo.
> Estou ciente de que, se dado for perdido durante a Etapa 5, o risco é meu e não tenho
> como restaurar. Autorizo prosseguir mesmo assim."

Decisão consciente do operador, registrada para efeito permanente. A homologação prossegue
sob esse risco declarado.

### 0.2 Gate SUBSTITUTO — EXPORT MANUAL (substitui "confirmar backup")

Antes de o operador clicar em "Importar selecionadas", ele **deve**:
1. Exportar a tabela **`client_technical_sheets`** e, por precaução, **`clients`** — via
   `pg_dump` ou Export (CSV/SQL) do painel Supabase.
2. Confirmar por escrito: _"exportei client_technical_sheets e clients, salvei em [caminho]"_.

**Sem essa confirmação, o Code NÃO libera a homologação.**

### 0.3 Gate operacional — PRINT PRÉ-CLIQUE (obrigatório)

Antes de **qualquer** clique que escreva no banco, o operador manda um **print do card exato
que vai clicar**, com os tiles de contagem visíveis. O Code só autoriza o clique após
confirmar:
- (a) é o card **"Importar Fichas Técnicas"** — **NÃO** o "Importar Clientes";
- (b) os números batem: **Locais c/ Ficha ≥ 2 · Cliente na Nuvem = 1 · Prontos = 1**.

Motivo: no incidente da tentativa anterior, o **card errado foi clicado por atropelamento**.
Este gate existe para impedir a repetição.

---

## 1. Auditoria dos 6 pontos (Fase A) — **todos OK, sem ajuste para fechar invariantes**

Referências de arquivo:código abaixo.

### (a) NÃO apaga o local antes de confirmar remoto — ✅ OK
- O import só grava o **mapa de metadados** (`kora.technicalSheets.supabaseImport.v1`), e
  **depois** do upsert remoto retornar `id`:
  - `useLocalTechnicalSheetsImport.ts:159-168` — upsert primeiro; `if (result && result.id)` → só então registra o `localClientId`.
  - `useLocalTechnicalSheetsImport.ts:182` — `localStorage.setItem(TECH_SHEET_IMPORT_META_KEY, ...)`; **nunca** escreve em `orbyt.clients.v1` (onde a ficha vive).
- Grep app-wide: **nenhum** `removeItem`/`clear`/overwrite de `orbyt.clients.v1`.
- Card exibe "Aviso de Backup Híbrido: a página Ficha Técnica continua usando localStorage nesta fase" (`Configuracoes.tsx:1560-1563`).

### (b) Idempotência — ✅ OK (dupla proteção)
- **Banco:** `clientTechnicalSheetsRepository.ts:36-43` — `.upsert({...}, { onConflict: "client_id" })` contra o `UNIQUE(client_id)` de `20260530020000_create_client_technical_sheets.sql:18`. Segundo upsert do mesmo `client_id` = **UPDATE**, não INSERT.
- **Assistente:** após o 1º import, o candidato vira `status:"existe"` (`useLocalTechnicalSheetsImport.ts:116-119`) e é excluído do 2º run pelo filtro `status==="pronto" && supabaseClientId` (`:142-144`).
- Coberto por teste: `src/repositories/__tests__/clientTechnicalSheetsRepository.test.ts`.

### (c) Leitura server-side (point read) — ✅ OK
- `clientTechnicalSheetsRepository.ts:18-23` — `.select("*").eq("workspace_id",…).eq("client_id",…).maybeSingle()`. Point read por `(workspace_id, client_id)`, ambos indexados.
- `useSupabaseTechnicalSheet.ts:45-51` — React Query, `enabled: !!workspaceId && !!supabaseClientId`.
- Ressalva: o **assistente** faz um list workspace-wide projetando só `("client_id, id")` (`useLocalTechnicalSheetsImport.ts:61-64`) para calcular status — não é o read do app e não traz o payload.

### (d) Reversibilidade — ✅ OK
- Seletor por-cliente + kill-switch: `activeDataSource = isExperimentalEnabled ? dataSource : "local"` (`ClientTechnicalSheet.tsx:331`).
- Flip persistido: `handleSourceChange → setTechnicalSheetDataSource(clientId, newSource)` (`:341-350`).
- Voltar p/ local lê o dado intacto: `setSheet(client.technicalSheet ?? {})` (`:381`) — o local nunca foi limpo ⇒ rollback sem perda.

### (e) Disparo consciente pelo usuário — ✅ OK
- `LocalTechnicalSheetsImportCard` (`Configuracoes.tsx:1486`, render em `:846`). Nada chama `importSelected` em `useEffect`.
- Fluxo manual: "Analisar importação" (`:1572`) → dialog → seleção → "Importar selecionadas" (`:1679`).
- Feedback: 4 tiles de contagem (`:1535-1552`), "N selecionada(s)" (`:1666`), timestamp da última importação (`:1554`), toast `"${n} fichas técnicas importadas"` (`useLocalTechnicalSheetsImport.ts:185`).

### (6) Ficha órfã (cliente ainda não está no Supabase) — ✅ OK (reportada, nunca perdida)
- Status: `if (!supabaseClientId) { status="sem_cliente"; ... }` (`useLocalTechnicalSheetsImport.ts:113-114`).
- Excluída do upload: `eligibleCandidates = status==="pronto"` (`Configuracoes.tsx:1493`); checkbox `disabled={!isPronto}` (`:1621`); `importSelected` filtra `"pronto" && supabaseClientId`.
- Reportada e visível: badge "Cliente não importado" (`:1635-1638`), linha `opacity-60`.
- FK nunca violada: órfã não entra no upsert ⇒ nenhum INSERT com `client_id` inválido.

---

## 2. Ajustes aplicados (Fase B.1) — por commit

| Commit | Tipo | Conteúdo |
|---|---|---|
| `c517615` | test | Testes do repository (idempotência `onConflict:client_id` + point read) e do mapper (round-trip dos 6 blobs + assets + sanitização de binário). `+12` testes (79→91). Zero código de produção tocado. |
| `63b3a52` | docs | Cristaliza [`espelho-reversivel.md`](../architecture/espelho-reversivel.md) + 1 comentário-ponteiro no topo do repository e do hook de import. |
| _(este commit)_ | docs | Este runbook. |

> **Nenhum ajuste tocou como o dado é lido ou escrito.** Os 5 invariantes + o ponto 6 já
> passavam na Fase A; a B.1 só adicionou testes e documentação.

---

## 3. Runbook de homologação (Fase B.2 — **o OPERADOR roda**)

> ⚠️ **Pré-condição:** confirmar **backup/PITR** ANTES de qualquer import (regra da Etapa 3).
> O Code não dispara nada aqui.

### 3.0 Cenário a montar no ambiente controlado
- **Cliente "pronto":** um cliente que **já foi importado ao Supabase** (existe em
  `clients`, e `kora.clients.supabaseImport.v1.importedMap` tem o mapeamento) **e** tem
  ficha técnica local preenchida (`client.technicalSheet` não-vazio em `orbyt.clients.v1`).
- **Cliente "órfão":** um cliente com ficha local preenchida **mas NÃO importado** ao
  Supabase (sem entrada no importedMap). Serve para provar o caminho `sem_cliente`.

### 3.1 Passos (operador)
1. **Gate EXPORT MANUAL** (seção 0.2): exportar `client_technical_sheets` + `clients` e
   confirmar por escrito onde salvou. **Sem isso, não segue.**
2. **Configurações → card "Importar Fichas Técnicas"** → anotar os 4 tiles
   (Locais c/ Ficha · Cliente na Nuvem · Prontos · Já Importados).
3. **Gate PRINT PRÉ-CLIQUE** (seção 0.3): mandar o print do card (tiles visíveis); o Code
   confirma que é o card certo e que os números batem **antes** de autorizar o clique.
4. "Analisar importação" → conferir o status por linha → selecionar os "pronto" →
   "Importar selecionadas" → observar o toast "N importadas".

### 3.2 Provas (queries que o operador roda) — substituir `<WS>` e `<UUID>`

**Zero perda** — contar local vs remoto e conferir amostra:
- No console do navegador (contagem local de fichas não-vazias):
  ```js
  JSON.parse(localStorage["orbyt.clients.v1"])
    .filter(c => c.technicalSheet && Object.keys(c.technicalSheet).length).length
  ```
- No Supabase:
  ```sql
  select count(*) from client_technical_sheets where workspace_id = '<WS>';
  ```
- **Amostra:** escolher 1–2 clientes e conferir campo-a-campo (`branding`, `persona`,
  `editorial`, `typography`, `social_links`, `briefing`) entre o `client.technicalSheet`
  local e a linha remota.

**Idempotência** — rodar o import 2× e checar que não há duplicata:
```sql
select client_id, count(*)
from client_technical_sheets
where workspace_id = '<WS>'
group by client_id
having count(*) > 1;   -- esperado: 0 linhas
```

**Reversibilidade** — na página Ficha Técnica de um cliente, flipar a fonte para **Local**;
confirmar que o dado aparece do local e que `orbyt.clients.v1` continua intacto (devtools).

**Ficha órfã** — o cliente não-importado aparece no card como **"Cliente não importado"** e
**não** está em `client_technical_sheets`:
```sql
-- deve retornar 0 (a ficha órfã não subiu)
select count(*) from client_technical_sheets
where workspace_id = '<WS>' and client_id = '<UUID_DO_CLIENTE_ORFAO_SE_EXISTIR>';
```

**Leitura indexada** — o point read usa índice, não Seq Scan:
```sql
explain analyze
select * from client_technical_sheets
where workspace_id = '<WS>' and client_id = '<UUID>';
-- esperado: Index Scan (idx_client_technical_sheets_client / unique client_id), não Seq Scan
```

---

## 4. Resultados da homologação — **PENDENTE** (o operador preenche após rodar)

**Homologado pelo operador em 2026-07-18** — cenário de teste (`TESTE-HOMOLOG-PRONTO`
mapeado ao cliente Supabase `ad3f59a5-7513-4ca5-aaad-88ac7cf1b83f` + `TESTE-HOMOLOG-ORFAO`
sem mapa), workspace `2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9`. **6/6 provas ✅.**

| Prova | Resultado | Evidência |
|---|---|---|
| 1 · Import | ✅ | toast "1 fichas técnicas importadas com sucesso!" |
| 2 · Zero perda (remoto = 1, valores batem) | ✅ | `count(*)` p/ `ad3f59a5…` = **1**; `branding/persona/briefing` trazem o dummy do seed (`branding.slogan = "Slogan TESTE-HOMOLOG-PRONTO"`, `persona.name = "Persona…"`, `briefing.objectives = "Objetivo…"`) |
| 3 · Idempotência (0 duplicatas) | ✅ | `group by client_id having count(*)>1` → **0 linhas** ("Success. No rows returned") |
| 4 · Reversibilidade (local intacto pós-import) | ✅ | console: `local intacto? true \| slogan: Slogan TESTE-HOMOLOG-PRONTO` — import não tocou `orbyt.clients.v1` (fallback garantido) |
| 5 · Ficha órfã reportada, não perdida | ✅ | diálogo: `ORFAO` "Cliente não importado"/Ignorar (checkbox travado); `fichas_depois = 1` (delta **+1** sobre baseline 0) → órfão **sem** linha no banco |
| 6 · Leitura indexada (EXPLAIN) | ✅ | **`Index Scan using idx_client_technical_sheets_client`** · Index Cond `client_id` · Execution 0.126 ms |

**Gate de segurança (substituto do backup, seção 0.2):** ✅ EXPORT MANUAL de `clients`
(3 linhas, CSV salvo pelo operador; cópia guardada em `backups/etapa-5-ficha-tecnica/` —
pasta `gitignore`d, contém PII). `client_technical_sheets` estava **vazia** no baseline (0),
nada a perder.
**Baseline pré-import:** `fichas_antes = 0`.
**Gate PRINT PRÉ-CLIQUE (0.3):** ✅ confirmado (card "Importar Fichas Técnicas", tiles 2/1/1/0).

---

## 5. Flag experimental — **PERMANECE (carência)**

Esta fatia **não** aposenta a flag `kora.technicalSheets.supabaseExperimental.enabled` nem o
seletor `kora.technicalSheets.dataSource.v1`. Ambos ficam em carência reversível: se a
homologação apontar qualquer problema, o operador força o modo local sem perda de dado. A
aposentadoria só será proposta em fatia posterior, após a homologação verde e um período de
observação.

---

## 6. Critérios de aceite da fatia

- [x] Auditoria dos 6 pontos com prova de código (Fase A).
- [x] Testes adicionados (repository + mapper); suite subiu 79→**91**.
- [x] `npx tsc --noEmit` = 0.
- [x] Lint gate **89/68** (sem regressão).
- [x] Molde "Espelho Reversível" cristalizado + ponteiros nos arquivos de referência.
- [x] Runbook de homologação escrito (não executado pelo Code).
- [x] Flag experimental permanece (carência).
- [x] Resultados da homologação preenchidos — **6/6 provas ✅** (seção 4).
- [x] Gate substituto (EXPORT MANUAL) + PRINT pré-clique cumpridos (seção 0).
- [ ] Limpeza do cenário de teste (Passos 3 local + 4 SQL) — **próxima ação do operador**.
- [ ] Nada empurrado / push e CI são do operador — **do operador** (commits da fatia estão locais).
