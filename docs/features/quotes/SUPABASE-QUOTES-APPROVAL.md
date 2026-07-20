# Orçamentos Supabase - Aprovação Experimental

Este documento descreve o fluxo experimental de aprovação e rejeição de orçamentos diretamente integrados com o Supabase no KORA Hub.

## Objetivo
Permitir a aprovação ou rejeição de orçamentos salvos no Supabase de forma controlada, explícita e protegida por feature flag, sem editar o conteúdo do orçamento, sem gerar registros financeiros ou projetos, e sem alterar o fluxo ou dados do ambiente local.

## Feature Flag
O comportamento é regido pela feature flag local:
* **Chave**: `kora.quotes.supabaseApproval.enabled`
* **Padrão**: `false`
* **Ativação**: Pode ser alternada em *Configurações > Empresa > Orçamentos Supabase - Aprovação Experimental*.

O fluxo só funciona se:
1. A visualização experimental de orçamentos Supabase estiver ativa (`kora.quotes.supabaseExperimental.enabled` = `true`).
2. A flag de aprovação experimental estiver ativada (`kora.quotes.supabaseApproval.enabled` = `true`).

## Repository
No arquivo [quotesRepository.ts](../../../src/repositories/quotesRepository.ts), foram atualizadas as seguintes funções de transição de status:
* `approveQuote(workspaceId, quoteId)`: Define `status = 'approved'`, preenche `approved_at = now()`, limpa `rejected_at = null`, filtra por `workspace_id` e ignora registros onde `deleted_at` não seja nulo.
* `rejectQuote(workspaceId, quoteId)`: Define `status = 'rejected'`, preenche `rejected_at = now()`, limpa `approved_at = null`, filtra por `workspace_id` e ignora registros onde `deleted_at` não seja nulo.

## Hook
Os métodos estão expostos no hook [useSupabaseQuotes.ts](../../../src/hooks/useSupabaseQuotes.ts):
* `approveQuote(quoteId)`
* `rejectQuote(quoteId)`
Ambos os métodos atualizam o estado local de orçamentos de forma reativa e executam o `refresh` da listagem.

## Interface do Usuário (UI)
As ações de "Aprovar" e "Rejeitar" aparecem nos seguintes locais:
1. **SupabaseQuotesViewerCard** (em *Configurações > Empresa*).
2. **LinkedQuotesSection** (no drawer da oportunidade no CRM Supabase).

Se a flag estiver desligada, os botões exibem um aviso (`toast.info`) explicando que o recurso é experimental e precisa ser ativado nas configurações. Se ativa, os botões exibem os diálogos de confirmação obrigatórios.

## Confirmação Obrigatória
Diálogos (`AlertDialog`) solicitam confirmação antes de concluir a operação:
* **Aprovação**:
  * Título: "Aprovar orçamento?"
  * Descrição: "Esta ação marcará o orçamento como aprovado no Supabase. Ela não criará financeiro, projeto ou envio automático nesta etapa."
* **Rejeição**:
  * Título: "Rejeitar orçamento?"
  * Descrição: "Esta ação marcará o orçamento como rejeitado no Supabase. Ela não excluirá o orçamento."

## Registro de Logs Locais
Após o sucesso real de uma ação, logs de auditoria local são armazenados no `localStorage`:
* **Aprovações**: `kora.quotes.supabaseApprovals.v1` (salva array contendo `quoteId`, `title`, e `approvedAt`).
* **Rejeições**: `kora.quotes.supabaseRejections.v1` (salva array contendo `quoteId`, `title`, e `rejectedAt`).

Em caso de erro na rede ou banco de dados, nenhum log é gerado.

## Ações Bloqueadas nesta Etapa
A aprovação ou rejeição de um orçamento no Supabase **não** realiza nenhuma das seguintes ações:
* Criação de lançamentos no Financeiro (contas a receber).
* Criação de projetos locais/Supabase.
* Geração de PDFs.
* Envio de e-mails ou WhatsApp.
* Edição de conteúdo, itens ou valores do orçamento.
* Exclusão ou arquivamento de orçamentos.

## Relação Futura
Em futuras iterações, a aprovação de orçamentos poderá disparar gatilhos para instanciar automaticamente novos projetos no pipeline e contas a receber no módulo financeiro, sob nova cobertura de flags.

## Limitações e Próximos Passos
* Os dados locais em `orbyt.quotes.v1` continuam completamente intactos e imutáveis.
* Não há autosincronização bidirecional ativa nesta fase.

## Relatório de QA
### Cenários Testados
1. **Migration Segura**: A nova migration `20260601_010000_add_approved_rejected_to_quotes.sql` foi validada e utiliza a cláusula `ADD COLUMN IF NOT EXISTS`, garantindo a idempotência e evitando falhas em bancos onde as colunas já possam ter sido criadas.
2. **Feature Flag**:
   - Com `kora.quotes.supabaseApproval.enabled` = `false`, ao clicar em "Aprovar" ou "Rejeitar" na UI, exibe-se um toast informativo impedindo a ação.
   - Com `kora.quotes.supabaseApproval.enabled` = `true`, as ações chamam os respectivos modais de confirmação.
3. **Controle em Configurações**: Card em "Configurações > Empresa/Supabase" reflete e altera o localStorage com o microcopy de ações bloqueadas bem definido.
4. **Repository (`approveQuote` / `rejectQuote`)**:
   - `approveQuote` atualiza o banco de dados definindo `status = 'approved'`, `approved_at = now()`, `rejected_at = null`.
   - `rejectQuote` define `status = 'rejected'`, `rejected_at = now()`, `approved_at = null`.
   - Filtros de `workspace_id` e `deleted_at IS NULL` são estritamente observados.
5. **UI & Modais de Confirmação**: Os AlertDialogs exibem os títulos corretos ("Aprovar orçamento?" / "Rejeitar orçamento?") com descrições fiéis. Clicar em "Cancelar" não executa nenhuma ação.
6. **Logs Locais**:
   - Em caso de sucesso real, logs são gravados em `kora.quotes.supabaseApprovals.v1` ou `kora.quotes.supabaseRejections.v1`.
   - Em erros simulados (falha de rede, timeout), nenhum log é escrito.
7. **Erro e Rollback Visual**: Simulando falhas na API, a UI reverte o status visual para o valor correto do banco logo após exibir um toast de erro.
8. **Segurança de Base Local**: `orbyt.quotes.v1` não sofre qualquer escrita ou mutação.

### Bugs Encontrados e Corrigidos
* *Bug*: Mapeamento inicial não populava os campos `approvedAt` e `rejectedAt` no objeto do hook local.
* *Correção*: Atualizado `mapSupabaseQuoteToLocalQuote` em `quoteMapper.ts` para mapear corretamente `approved_at` e `rejected_at`.

### Recomendação Final
Aprovação e rejeição experimental validadas com sucesso. Recomenda-se avançar para o próximo fluxo controlado: gerar financeiro a partir de orçamento aprovado.

