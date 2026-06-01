# Orçamentos Supabase - Visualização Experimental

## Objetivo
Expor uma visualização passiva de somente leitura para confirmar quais orçamentos foram importados ou salvos com sucesso no Supabase.

## Flag de Controle
Esta visualização é protegida pela chave de feature flag do localStorage:
- **`kora.quotes.supabaseExperimental.enabled`**

Quando o valor dessa chave for `"true"`, o card de visualização será renderizado na tela de Configurações (Empresa/Supabase).

## Comportamento
- Carrega a lista em tempo real utilizando o hook `useSupabaseQuotes`.
- Cruza os IDs dos orçamentos retornados com `kora.quotes.supabaseImport.v1` (dentro de `importedMap`) para identificar se foram importados localmente e exibir a badge correspondente: **"Importado do local"**.
- Mostra carregando/erro/vazio/sem workspace adequadamente.
- Não oferece ações de edição, exclusão ou criação – é estritamente **somente leitura**.
