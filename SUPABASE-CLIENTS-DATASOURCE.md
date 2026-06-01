# Camada de Fonte de Dados Experimental de Clientes

Este documento detalha o funcionamento técnico da fonte de dados de clientes, que permite alternar dinamicamente entre a base local (`localStorage`) e a base remota do Supabase de forma experimental.

## Como funciona a camada de fonte de dados

A alternância é gerenciada pelo hook [useClientsDataSource.ts](file:///C:/Users/erikw/.gemini/antigravity/scratch/orbit-designer-hub/src/hooks/useClientsDataSource.ts):
1. **Fonte Padrão (Local)**: Por padrão, a fonte de dados ativa é `local` e consome a persistência existente no navegador. A preferência do usuário é armazenada no `localStorage` sob a chave `kora.clients.dataSource.v1`.
2. **Modo Supabase Experimental**: Quando selecionado, a tela de Clientes passa a renderizar os clientes cadastrados no workspace Supabase atual.
3. **Fallback Automático**: Se o usuário perder o acesso ao workspace ou se deslogar, a fonte reverte automaticamente para a `Base Local (Padrão)`.

## Normalização de Dados

Os dados retornados pelo Supabase possuem nomes de campos no padrão snake_case e tipos baseados nas tabelas Postgres. Para exibi-los corretamente nas telas que utilizam o formato camelCase do app, criamos a função de normalização `mapSupabaseClientToLocalClient`.

Campos normalizados:
- `id` (mantido como string UUID em tempo de execução, porém compatível com o fluxo)
- `name`, `company`, `email`, `phone`, `whatsapp`, `instagram`, `website`
- `city`, `state`, `address`, `document`
- `status` (Ativo/Arquivado/etc.)
- `potentialValue` (mapeado de `potential_value`)
- `totalRevenue` (mapeado de `total_revenue`)
- `temperature`, `nextAction`, `nextActionDate`
- `tags`, `isDemo`

*Nota: A Ficha Técnica (Briefing, Personas, Marcas, Assets) NÃO é carregada/mapeada nesta etapa.*

## Restrições do Modo Experimental (Somente Leitura)

O modo Supabase experimental é **estritamente somente leitura** para garantir a segurança dos dados.
Se o usuário tentar disparar operações de gravação no modo Supabase, avisos em formato de `toast` informam a indisponibilidade:
- **Novo Cliente**: O botão fica desabilitado para cadastro no Supabase.
- **Editar Cliente**: Abre um aviso impedindo a edição do registro.
- **Arquivar / Restaurar**: Impede a alteração de status do cliente no Supabase.
- **Excluir Cliente**: A exclusão é bloqueada.
- **Aprovação de Cadastro**: Bloqueia aprovar cadastros vindos do link de cadastro.

## Próximos Passos
1. Implementar a gravação incremental no Supabase no modo híbrido (escrita bidirecional ou gravação direta).
2. Migrar os dados relacionados (Ficha Técnica/Technical Sheet, Orçamentos e CRM) utilizando o mapeamento `importedMap` do passo anterior.
3. Virar a chave permanentemente tornando o Supabase a fonte padrão de dados e remover o modo experimental.
