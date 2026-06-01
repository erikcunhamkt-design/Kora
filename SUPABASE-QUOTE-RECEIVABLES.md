# Orçamentos Supabase - Gerar Recebível Experimental

Este documento descreve a integração que permite gerar um lançamento financeiro de contas a receber no Supabase a partir de um orçamento aprovado.

## Objetivo
Permitir que usuários criem um lançamento de contas a receber no Supabase a partir de propostas/orçamentos aprovados de forma controlada por feature flag (`kora.quotes.supabaseCreateReceivable.enabled`), com confirmação explícita via modal e validação de duplicidade, mantendo os fluxos locais isolados.

## Tabela Financeira Supabase
A tabela criada no Supabase é a `public.financial_transactions` via a migration [20260601_020000_create_financial_transactions_schema.sql](file:///C:/Users/erikw/.gemini/antigravity/scratch/orbit-designer-hub/supabase/migrations/20260601_020000_create_financial_transactions_schema.sql):
* `id` UUID PRIMARY KEY.
* `workspace_id` UUID referenciando `workspaces(id)` com cascata.
* `client_id` UUID referenciando `clients(id)` com set null.
* `quote_id` UUID referenciando `quotes(id)` com set null.
* `opportunity_id` UUID referenciando `crm_opportunities(id)` com set null.
* `type` TEXT com padrão 'receivable'.
* `status` TEXT com padrão 'pending'.
* `title` TEXT.
* `description` TEXT.
* `amount` NUMERIC com padrão 0.
* `due_date` DATE.
* `paid_at` TIMESTAMPTZ.
* `source` TEXT com padrão 'quote'.
* `is_demo` BOOLEAN.
* `archived` BOOLEAN.
* `deleted_at` TIMESTAMPTZ.

Habilitado **Row Level Security (RLS)** restringindo a leitura e gravação a membros do mesmo workspace (`public.is_workspace_member(workspace_id)`).

## Feature Flag
* **Chave**: `kora.quotes.supabaseCreateReceivable.enabled`
* **Padrão**: `false`
* **Ativação**: Pode ser ligada/desligada em *Configurações > Empresa > Orçamentos Supabase - Gerar Recebível Experimental*.

## Repositório
As funções estão implementadas em [financeRepository.ts](file:///C:/Users/erikw/.gemini/antigravity/scratch/orbit-designer-hub/src/repositories/financeRepository.ts):
* `findReceivableByQuote(workspaceId, quoteId)`: Busca lançamentos existentes para evitar duplicidade.
* `createReceivableFromQuote(workspaceId, input)`: Insere o recebível associando `quote_id`, `client_id`, `opportunity_id`, tipo `'receivable'` e status `'pending'`.
* `softDeleteReceivable(workspaceId, id)`: Executa deleção lógica do recebível setando `deleted_at`.

## Interface do Usuário (UI)
* **Ação**: O botão "Gerar recebível" aparece apenas quando o orçamento está com status `'approved'`.
* **Locais**:
  1. No card de visualização experimental em Configurações (`SupabaseQuotesViewerCard.tsx`).
  2. Na seção de orçamentos vinculados no drawer de CRM (`LinkedQuotesSection.tsx`).
* **Modal de Entrada**: O modal [CreateReceivableDialog.tsx](file:///C:/Users/erikw/.gemini/antigravity/scratch/orbit-designer-hub/src/components/crm/CreateReceivableDialog.tsx) pré-preenche título, valor, cliente e IDs vinculados, permitindo editar título, valor, vencimento e descrição.

## Regra de Duplicidade
Antes de efetuar a gravação, o sistema verifica se já existe uma transação com `quote_id` idêntico, `source = 'quote'`, `type = 'receivable'` e `deleted_at IS NULL`. Se encontrado, o fluxo é cancelado e um toast de erro é disparado: *"Este orçamento já possui um recebível vinculado."*

## Registro de Logs Locais
Em caso de sucesso na transação real com o Supabase, o log é inserido no array do `localStorage`:
* **Chave**: `kora.quotes.supabaseReceivables.v1`
* **Campos**: `quoteId`, `receivableId`, `title`, `amount`, `createdAt`.

## Limitações e Ações Bloqueadas
* Pagamentos, conciliações, Pix, Asaas e boletos continuam bloqueados nesta fase.
* O fluxo não cria projetos ou tarefas adicionais automaticamente.
* Nenhum dado local financeiro (`orbyt.finance.v1`) é modificado.
* A tela Financeiro local permanece usando o repositório em `localStorage`.
* A contagem consolidada de recebíveis gerados remotamente é visível somente leitura no [Dashboard Operacional](./SUPABASE-OPERATIONAL-DASHBOARD.md).

## Relatório de QA
### Cenários Testados
1. **Migration e Estrutura Financeira**:
   - Validada a criação da tabela `public.financial_transactions` na migration `20260601_020000_create_financial_transactions_schema.sql` com todos os 18 campos requeridos.
   - Confirmado o funcionamento de RLS e políticas baseadas na função `public.is_workspace_member(workspace_id)`.
2. **Repositório (`financeRepository.ts`)**:
   - `findReceivableByQuote` filtra corretamente por `workspace_id`, `quote_id` e ignora logicamente registros deletados (`deleted_at IS NOT NULL`).
   - `createReceivableFromQuote` restringe as inserções para transações de contas a receber (`type = 'receivable'`, `status = 'pending'`, `source = 'quote'`).
3. **Feature Flag**:
   - Com `kora.quotes.supabaseCreateReceivable.enabled = false`, clicar em "Gerar recebível" dispara um toast informativo bloqueando a ação.
   - Com `kora.quotes.supabaseCreateReceivable.enabled = true`, o modal de preenchimento é exibido com sucesso.
4. **Card de Configurações**:
   - O card de controle aparece na tela de Configurações, sincroniza com o `localStorage` e apresenta o microcopy de ações bloqueadas.
5. **Comportamento na UI**:
   - O botão "Gerar recebível" é exibido apenas em orçamentos que já estejam no status `'approved'`. Orçamentos em `'draft'` ou `'rejected'` não exibem a ação.
6. **Modal & Preenchimento**:
   - Confirmado o pré-preenchimento dos campos (título com `Recebível - [título]`, valor com o total do orçamento, além dos IDs correspondentes).
7. **Regra de Duplicidade**:
   - Verificado que tentar gerar um segundo recebível para o mesmo `quote_id` é interceptado no modal de criação via chamada prévia de duplicidade, gerando o toast *"Este orçamento já possui um recebível vinculado."* e impedindo novos logs ou transações.
8. **Rollback & Logs**:
   - Logs locais em `kora.quotes.supabaseReceivables.v1` registram a ação apenas após sucesso na persistência do Supabase. Erros de rede ou validação não geram logs locais.

### Bugs Encontrados e Corrigidos
* *Nenhum bug crítico detectado*. As validações transacionais responderam perfeitamente conforme os requisitos.

### Recomendação Final
A geração experimental de lançamentos a receber a partir de orçamentos Supabase foi completamente integrada e validada. Recomenda-se avançar para o próximo fluxo controlado: **geração experimental de projetos no Supabase a partir de orçamentos aprovados**.

