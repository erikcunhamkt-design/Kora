# CRM Supabase → Criar Orçamento Supabase Experimental

## Objetivo
Permite a criação controlada e explícita de orçamentos no Supabase a partir de oportunidades do CRM, vinculando ambas as entidades via `opportunity_id` e `client_id`.

## Flag de Controle
Protegido por feature flag específica no localStorage:
- **`kora.crm.supabaseCreateQuote.enabled`**

A funcionalidade só está disponível se:
1. `kora.crm.supabaseExperimental.enabled === true`
2. Fonte ativa do CRM for `supabase`
3. `kora.crm.supabaseCreateQuote.enabled === true`

Caso a flag esteja desativada e a fonte for Supabase, a ação exibe um toast explicativo:
*"Criação de orçamento no CRM Supabase entra nesta etapa experimental. Ative em Configurações."*

## Formulário de Criação (Modal)
Preenche os dados com base na Oportunidade:
- **Título**: Pré-preenchido como `"Orçamento - [Nome da Oportunidade]"`
- **Cliente**: Pré-preenchido com o nome do contato.
- **Empresa, Email, Telefone**: Puxados automaticamente da oportunidade.
- **Opportunity ID**: Vincula o UUID da oportunidade no Supabase.
- **Client ID**: Puxa o UUID do cliente caso o mapping `kora.clients.supabaseImport.v1` exista para o `clientId` local.

## Persistência e Logs
- Cria o quote via `quotesRepository.createQuote` (status inicial `draft`).
- Salva os itens associados via `quotesRepository.replaceQuoteItems`.
- Grava o sucesso em `kora.crm.supabaseCreatedQuotes.v1`.
- Se a criação do orçamento for concluída mas os itens falharem, um **rollback lógico** é disparado chamando `softDeleteQuote`.

## Limitações
- A tela principal de Vendas/Orçamentos não é alterada e continua baseada no localStorage (`orbyt.quotes.v1` ou equivalente).
- Somente leitura: Visualizações dos orçamentos Supabase acontecem de forma passiva nas Configurações.

## Relatório de QA
### Cenários Testados
1. **Controle de Flags**:
   - Flag em `false` -> Botão "Criar orçamento" bloqueado com toast de aviso.
   - Flag em `true` -> Modal abre preenchido com dados da oportunidade.
   - CRM local ativo -> Fluxo oculto.
2. **Rollback e Transações**:
   - Em falha de gravação de itens (`quote_items`), o quote principal inserido é logicamente desfeito através do `softDeleteQuote`. Nenhum log local de sucesso é criado.
3. **Mapeamentos**:
   - Resolução correta de `client_id` (via mapping local -> Supabase) e preenchimento de `opportunity_id`.
4. **Impacto Local**:
   - `orbyt.quotes.v1` totalmente preservado sem adulteração de registros locais.

## Integração com Orçamentos Vinculados
Após a criação com sucesso do orçamento a partir da oportunidade no modal, a UI dispara um evento reativo que força o recarregamento instantâneo da seção **Orçamentos vinculados** no drawer de detalhes da oportunidade, exibindo a nova proposta sem necessitar de refresh manual ou reabertura de drawer.


