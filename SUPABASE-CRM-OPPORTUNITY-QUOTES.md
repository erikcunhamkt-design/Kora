# CRM Supabase — Orçamentos Vinculados à Oportunidade

## Objetivo
Exibe, dentro do drawer de detalhes da oportunidade ativa no CRM Supabase, todos os orçamentos no Supabase que estejam vinculados a ela através da coluna `opportunity_id`.

## Função Repository
Adicionado o método `listQuotesByOpportunity(workspaceId: string, opportunityId: string)` em `quotesRepository.ts`:
- Filtra por `workspace_id` e `opportunity_id`.
- Ignora registros com `deleted_at IS NOT NULL`.
- Ordena as propostas por data de criação decrescente (`created_at DESC`).

## Hook Isolado
Criado o hook `src/hooks/useSupabaseOpportunityQuotes.ts` que escuta as mudanças de `workspaceId` e `opportunityId` para carregar de forma isolada os orçamentos associados, sem interagir com estados locais.

## Elemento de UI
Renderiza a seção **"Orçamentos vinculados"** logo acima do Histórico no drawer de detalhes da oportunidade comercial.
- Exibe o título, status, total formatado em BRL e data de criação de cada orçamento.
- Trata estados de carregamento (spinner), erro na query e lista vazia (*"Nenhum orçamento vinculado a esta oportunidade ainda."*).
- Status e Aprovação: Exibe badges correspondentes ao status ('draft', 'approved', 'rejected'). Se a feature flag `kora.quotes.supabaseApproval.enabled` estiver ativa, expõe ações rápidas de "Aprovar" e "Rejeitar" protegidas por diálogos de confirmação obrigatórios.
- Modo somente leitura: Fora as ações de aprovar/rejeitar (se ativas), a seção não permite edição, alteração de valores ou itens, geração de PDF ou financeiro.

## Integração do Fluxo
Ao criar um orçamento com sucesso através do modal "Criar orçamento a partir da oportunidade", a UI dispara uma atualização reativa da lista vinculada, refletindo a nova proposta imediatamente sem a necessidade de reabrir o drawer ou fazer refresh da página inteira.

## Relatório de QA
### Cenários Testados
1. **Filtro por Opportunity ID**:
   - Oportunidade A com orçamento vinculado -> Apenas o orçamento de A é exibido.
   - Oportunidade B com orçamento diferente -> Apenas o orçamento de B é exibido.
   - Oportunidade C sem orçamentos -> Renderiza o estado vazio ("Nenhum orçamento vinculado...").
2. **Atualização Reativa**:
   - Criação bem-sucedida do orçamento dispara um trigger toggle que faz o hook `useSupabaseOpportunityQuotes` recarregar de forma instantânea sem refresh ou reabertura do drawer.
3. **Modo Somente Leitura**:
   - Garantia de que a seção não expõe ações de escrita, exclusão ou edição.
4. **Resiliência a Erros**:
   - Tratamento correto de spinners de carregamento e fallbacks em caso de falha de rede ou timeout.
5. **Ações e Status de Aprovação/Rejeição**:
   - Confirmado que os orçamentos vinculados mudam visualmente seus badges de status para 'aprovado' ou 'rejeitado'.
   - Os botões de Aprovar/Rejeitar são exibidos condicionalmente dependendo da flag experimental e realizam a transição com diálogo de confirmação.


