# Dashboard Supabase Experimental — Visão Operacional Passiva

Este documento descreve a implementação do painel de controle consolidado e passivo das operações experimentais persistidas no Supabase.

## Objetivo
Fornecer uma visualização centralizada, consolidada e **exclusivamente de leitura** (passiva) sobre as entidades que já foram criadas e persistidas remotamente no Supabase: Oportunidades do CRM, Orçamentos, Recebíveis Financeiros e Projetos.

Esta tela serve apenas para acompanhamento do fluxo comercial/operacional e não altera dados locais nem substitui as interfaces principais dos módulos.

## Feature Flag
* **Flag local**: `kora.supabase.operationalDashboard.enabled`
* **Comportamento**:
  * **Desligada (`false`)**: Mostra um card informativo com a mensagem de que o painel está desabilitado experimentalmente e orientações de ativação.
  * **Ligada (`true`)**: Carrega ativamente os resumos de dados do Supabase.

## Dados Exibidos
O dashboard consolida em cards e listas as seguintes informações de forma puramente passiva:

1. **CRM**:
   * Total de oportunidades Supabase.
   * Oportunidades abertas.
   * Oportunidades ganhas/perdidas.
2. **Orçamentos**:
   * Total de orçamentos Supabase.
   * Rascunhos.
   * Aprovados.
   * Rejeitados.
   * Valor total acumulado dos orçamentos aprovados.
3. **Recebíveis (Financeiro)**:
   * Total de recebíveis.
   * Recebíveis pendentes.
   * Recebíveis pagos.
   * Valor total pendente.
4. **Projetos**:
   * Total de projetos.
   * Projetos ativos.
   * Projetos arquivados.
   * Budget total acumulado.

### Relações do Fluxo Comercial (Contadores)
* **Oportunidades com orçamento**: Oportunidades que possuem um orçamento associado.
* **Orçamentos aprovados com recebível**: Orçamentos aprovados que já possuem um contas a receber gerado no Supabase.
* **Orçamentos aprovados com projeto**: Orçamentos aprovados que já possuem um projeto gerado no Supabase.
* **Orçamentos aprovados sem recebível**: Orçamentos aprovados que ainda não têm contas a receber gerado.
* **Orçamentos aprovados sem projeto**: Orçamentos aprovados que ainda não têm projeto gerado.

## Modo Somente Leitura e Ações Bloqueadas
* Não há botões de escrita, formulários de criação, edição ou remoção de CRM, Orçamentos, Financeiro ou Projetos.
* O painel permite **gerar tarefas base no Supabase** a partir da listagem experimental de projetos remotos, controlada pela flag `kora.projects.supabaseCreateBaseTasks.enabled` (veja [SUPABASE-PROJECT-TASKS.md](../projects/SUPABASE-PROJECT-TASKS.md)). Outros cronogramas, calendários e edições de tarefas continuam bloqueados.
* Badges claros de "Experimental" e "Somente Leitura" são exibidos no cabeçalho do painel.
* Um botão de **Refresh** permite recarregar manualmente os dados das quatro fontes.

## Fontes de Dados e Repositórios Usados
* **CRM (Oportunidades)**: Hook `useSupabaseOpportunities` consumindo `crmOpportunitiesRepository`.
* **Orçamentos**: Hook `useSupabaseQuotes` consumindo `quotesRepository`.
* **Recebíveis (Financeiro)**: Hook `useSupabaseFinancialSummary` consumindo o método read-only `financeRepository.listReceivables`.
* **Projetos**: Hook `useSupabaseProjectsSummary` consumindo o método read-only `projectsRepository.listProjects`.

*Todos os métodos de listagem filtram os registros pelo `workspace_id` ativo e ignoram dados com `deleted_at IS NOT NULL` (exclusão lógica).*

## Limitações e Próximos Passos
* **Sem Sincronização Automática ou Bidirecional**: As tabelas locais do navegador (`orbyt.leads.v1`, `orbyt.quotes.v1`, `orbyt.finance.v1`, `orbyt.projects.v1`, `orbyt.tasks.v1`) permanecem intactas e desconectadas dessas métricas.
* **Gráficos**: Não são exibidos gráficos de desempenho comercial/financeiro nesta etapa.
* **Próximos Passos**: Implementar visualizações gráficas avançadas e opções de exportação consolidadas assim que as bases de dados passarem do estágio experimental para o de sincronização oficial.

## Relatório de QA
### Cenários Testados
1. **Feature Flag (`kora.supabase.operationalDashboard.enabled`)**:
   - Validado o estado padrão (`false`). Com a flag desligada, o painel exibe um card cinza de informações explicando o propósito experimental.
   - Ativando a flag na UI (Configurações), os dados remotos do Supabase são carregados dinamicamente.
   - O estado do toggle persiste corretamente no `localStorage` e a sincronização entre abas reage ao evento de `storage`.
2. **Localização da UI**:
   - Verificado que o card de ativação e o painel aparecem em **Configurações > Empresa**, abaixo dos outros cards experimentais.
   - Os badges *"Experimental"* e *"Somente Leitura"* estão posicionados de forma visível e legível.
3. **Métricas de CRM**:
   - Os contadores (total, abertas, ganhas/perdidas) batem com o número de oportunidades remotas do Supabase vinculadas ao workspace ativo.
   - Oportunidades marcadas com exclusão lógica (`deleted_at IS NOT NULL`) são devidamente ignoradas.
4. **Métricas de Orçamentos**:
   - Totais, rascunhos, aprovados e rejeitados calculados corretamente a partir de `useSupabaseQuotes`.
   - O valor total dos orçamentos aprovados realiza a soma financeira com precisão e ignora orçamentos deletados.
5. **Métricas de Recebíveis (Financeiro)**:
   - Resumos extraídos com sucesso da base remota pelo método `listReceivables(workspaceId)`.
   - Ignora itens deletados logicamente.
6. **Métricas de Projetos**:
   - Resumos consolidados com sucesso pela função `listProjects(workspaceId)`.
   - Ignora itens deletados logicamente.
7. **Fluxo Comercial (Cruzamento de Relações)**:
   - Validado o cálculo de oportunidades com orçamento, e os cruzamentos de orçamentos aprovados com/sem recebível e com/sem projeto.
   - Nenhuma métrica lê o `localStorage` do módulo principal do app.
8. **UX e Estados da UI**:
   - Estados de **Carregando** (loading spinner de refresh), **Erro** (limites e queda na requisição simulados), **Vazio** e **Refresh Manual** testados e respondendo corretamente.
   - Nenhuma chamada cíclica ou loop de requisições foi gerado.
9. **Geração de Tarefas Base**:
   - Integrada com sucesso na listagem de projetos, respeitando a feature flag `kora.projects.supabaseCreateBaseTasks.enabled` e bloqueando duplicidade.
10. **Visualização de Tarefas por Projeto**:
   - Integrado o painel recolhível para renderizar as tarefas associadas a cada projeto no Supabase, respeitando a ordem correta (`sort_order`).

### Bugs Encontrados e Corrigidos
- *Nenhum bug detectado*. Todas as regras de negócio responderam perfeitamente.

### Limitações
- Somente leitura para CRM/Orçamentos/Financeiro/Projetos. O painel apenas executa a geração e a visualização passiva de tarefas sob confirmação e flag ativa.
- Isolamento local: Nenhum dado das chaves locais `orbyt.*` do browser é alterado ou considerado.

### Recomendação Final
O dashboard operacional passivo, o fluxo de geração de tarefas base, a visualização de checklist por projeto e a transição experimental de status foram totalmente homologados com sucesso. Recomenda-se manter o estado beta experimental ativo para testes internos e prosseguir com o roadmap.

