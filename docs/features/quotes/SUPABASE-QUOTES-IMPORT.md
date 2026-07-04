# Importador Assistido de Orçamentos Locais

## Objetivo
Permite importar manualmente orçamentos armazenados no `localStorage` para o Supabase, oferecendo pré‑visualização, dedupe, confirmação explícita e mapeamento de entidades.

## Chave de Metadados
- **`kora.quotes.supabaseImport.v1`** – armazena o estado da importação.

## Estrutura do Metadado
```json
{
  "lastImportedAt": "2026-05-30T15:00:00Z",
  "importedLocalIds": ["quote1", "quote2"],
  "skippedLocalIds": ["quote3"],
  "importedMap": {
    "localQuoteId": "supabaseQuoteId"
  }
}
```
- `lastImportedAt` – timestamp da última importação.
- `importedLocalIds` – IDs dos orçamentos locais já importados.
- `skippedLocalIds` – IDs que foram ignorados (ex.: bloqueados).
- `importedMap` – mapeamento de IDs locais para IDs criados no Supabase.

## Como lê os orçamentos locais
Utiliza o hook `useQuotes` que expõe `quotes` (lista de orçamentos) a partir do `localStorage`. Orçamentos marcados com `isDemo === true` são ignorados.

## Regras de Dedupe
1. **Importado** – se `meta.importedMap` já contém o `local.id`.
2. **Code/Number** – verifica campos `code`, `number` ou `quoteNumber` (se existirem) contra `remoteQuotes.code`.
3. **Title + ClientName + Total** – combina `title`, `clientName` e diferença de `total` ≤ 0.01.
4. **ClientEmail + Total + validUntil** – combina `clientEmail`, `total` (tolerância 0.01) e, opcionalmente, `validUntil`.
5. **Blocked** – se faltarem campos essenciais (`clientName`, `clientEmail`, `total`).

## Mapping de Clientes
Lê o mapa armazenado em `localStorage` sob a chave **`kora.clients.supabaseImport.v1`**. Quando presente, o ID do cliente do orçamento local (`clientId`) é traduzido para o ID Supabase correspondente e incluído no payload (`client_id`).

## Mapping de Oportunidades
Lê o mapa sob a chave **`kora.crm.supabaseImport.v1`**. Caso o orçamento possua `leadId` ou `opportunityId`, o ID Supabase correspondente (`opportunity_id`) é inserido.

## Processo de Importação
1. **Analisar** – `useLocalQuotesImport.analyze()` cria a lista de `candidates` com status `new`, `duplicate`, `imported` ou `blocked`.
2. **Selecionar** – UI permite selecionar apenas itens com status `new`.
3. **Importar** – `importSelected(ids)`:
   - Constrói o payload usando `mapLocalQuoteToSupabaseQuote`.
   - Acrescenta `client_id` e `opportunity_id` quando os maps existem.
   - Cria o quote via `quotesRepository.createQuote`.
   - Insere os itens associados via `quotesRepository.replaceQuoteItems`.
   - Atualiza o metadado (`importedMap`, `importedLocalIds`).
   - Emite toast de sucesso/erro.

## O que NÃO é importado
- Campos que não possuem representação no schema Supabase são mantidos apenas como texto (ex.: descrições customizadas).
- Orçamentos já marcados como importados ou bloqueados.

## Limitações
- Não há sincronização automática; a importação é manual e assistida.
- Não altera a tela principal de Vendas/Orçamentos – continua usando `localStorage`.
- Não cria ou altera feature flags nem `.env`.

## Próximos Passos
- Automatizar a atualização de clientes/oporturnidades ao criar novos mapas.
- Expor métricas de importação no dashboard.
- Avaliar migração gradual da UI principal para Supabase.
