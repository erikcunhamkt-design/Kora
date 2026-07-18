# Etapa 5 · Fatia 1 (teste de fogo) — `client_technical_sheets` (Ficha Técnica)

> **Escopo desta fatia:** HOMOLOGAR o ciclo `local → nuvem → local` e CRISTALIZAR o molde
> reutilizável ["Espelho Reversível"](../architecture/espelho-reversivel.md). **NÃO** aposentar
> a flag experimental (fica em **carência** reversível). O caminho já existia (~90% pronto);
> a fatia é auditar + testar + homologar, não construir do zero.
>
> **Regra de dados:** o Code **não dispara** import nem aplica nada em produção. O disparo do
> import é **ação do operador**, após backup/PITR (mesma regra do SQL da Etapa 3).
>
> Diagnóstico da etapa: [`etapa-5-diagnostico.md`](etapa-5-diagnostico.md).

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
1. Confirmar backup/PITR do projeto Supabase.
2. **Configurações → card "Importar Fichas Técnicas"** → anotar os 4 tiles
   (Locais c/ Ficha · Cliente na Nuvem · Prontos · Já Importados).
3. "Analisar importação" → conferir o status por linha → selecionar os "pronto" →
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

| Prova | Resultado | Evidência |
|---|---|---|
| Zero perda (COUNT local vs remoto) | _pendente_ | _local: __ · remoto: ___ |
| Amostra campo-a-campo (1–2 fichas) | _pendente_ | _clientes: ___ |
| Idempotência (import 2×, 0 duplicatas) | _pendente_ | _query de duplicata: __ linhas_ |
| Reversibilidade (flip → local intacto) | _pendente_ | _observação: ___ |
| Ficha órfã reportada "sem_cliente" | _pendente_ | _cliente: ___ |
| EXPLAIN usa índice (não Seq Scan) | _pendente_ | _colar plano: ___ |

**Backup/PITR confirmado antes do import?** _pendente (operador)_.

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
- [ ] Resultados da homologação preenchidos pelo operador (seção 4) — **PENDENTE**.
- [ ] Nada empurrado / push e CI são do operador — **PENDENTE**.
