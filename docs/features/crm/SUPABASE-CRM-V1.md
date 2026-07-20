# Fundação Supabase CRM (V1)

Este documento descreve a modelagem, as regras de segurança e a arquitetura técnica da migração incremental do módulo **CRM / Oportunidades** para o Supabase.

---

## 1. Tabela Criada e Modelagem

A tabela `public.crm_opportunities` foi criada através da migração SQL no arquivo [20260530050000_create_crm_opportunities.sql](../../../supabase/migrations/20260530050000_create_crm_opportunities.sql).

### Definição dos Campos
A estrutura foi modelada para refletir fielmente a interface do Lead do frontend local, agregando chaves multi-tenant e integridade relacional:
- `id` (uuid, chave primária)
- `workspace_id` (uuid, chave estrangeira de workspaces, deleção cascade)
- `client_id` (uuid, chave estrangeira de clients, define vínculo com a tabela de Clientes, deleção set null)
- `title` (text, título da oportunidade)
- `company` (text, nome da empresa)
- `contact_name` (text, nome de contato principal)
- `email` (text, endereço de email)
- `phone` (text, telefone fixo)
- `whatsapp` (text, número de WhatsApp principal)
- `stage` (text, chave do estágio do pipeline: 'lead', 'contato', 'proposta', 'negociacao', 'fechado', 'perdido')
- `status` (text, estado da oportunidade: 'open', 'won', 'lost')
- `source` (text, origem/canal de aquisição)
- `temperature` (text, nível de interesse comercial: 'frio', 'morno', 'quente', 'não definida')
- `priority` (text, prioridade: 'alta', 'média', 'baixa')
- `potential_value` (numeric, valor financeiro estimado da oportunidade)
- `probability` (integer, probabilidade de fechamento de 0% a 100%)
- `next_action` (text, descrição da próxima interação pendente)
- `next_action_date` (date, data da próxima ação)
- `expected_close_date` (date, data esperada de fechamento)
- `notes` (text, anotações e histórico descritivo)
- `quote_id` (uuid, orçamento vinculado na nuvem)
- `quote_title` (text, título do orçamento associado)
- `converted_client_id` (uuid, ID do cliente gerado se a oportunidade for ganha)
- `won_at` (timestamptz, data de ganho da oportunidade)
- `lost_at` (timestamptz, data de perda da oportunidade)
- `lost_reason` (text, motivo da perda)
- `is_demo` (boolean, flag para indicar dados de demonstração)
- `archived` (boolean, flag para arquivamento)
- `created_at` / `updated_at` (timestamptz, gerenciados pelo banco, com trigger automático de alteração)

### Índices de Performance
Para assegurar consultas de baixa latência em queries multi-tenant de dashboards e funis de vendas:
- `idx_crm_opportunities_workspace`: filtro rápido por tenant ativo.
- `idx_crm_opportunities_client`: busca rápida por histórico de oportunidades de um cliente.
- `idx_crm_opportunities_stage`: indexação para montagem de colunas do Kanban do CRM.
- `idx_crm_opportunities_archived`: otimização para ocultar/visualizar itens arquivados.

---

## 2. Segurança e RLS (Row Level Security)

A tabela `crm_opportunities` está com a segurança no nível de linhas (**RLS**) ativada.
As quatro operações principais (SELECT, INSERT, UPDATE, DELETE) são protegidas pela função de tenant:
```sql
public.is_workspace_member(workspace_id)
```
Isso garante isolamento completo:
- Usuários autenticados só lêem e gravam registros pertencentes aos workspaces nos quais são membros cadastrados.
- Sem privilégios de bypass para chaves anônimas.

---

## 3. Repositório e Mappers

- **Repository**: Desenvolvido de forma puramente agnóstica de UI em [crmOpportunitiesRepository.ts](../../../src/repositories/crmOpportunitiesRepository.ts). Expõe métodos tipados para `listOpportunities`, `getOpportunity`, `createOpportunity`, `updateOpportunity`, `moveOpportunityStage` (que gerencia triggers de timestamps `won_at`/`lost_at` e status), `archiveOpportunity` e `deleteOpportunity`.
- **Mapper**: Criado em [crmOpportunityMapper.ts](../../../src/services/crm/crmOpportunityMapper.ts) contendo `mapLocalLeadToSupabaseOpportunity` e `mapSupabaseOpportunityToLocalLead` para garantir total interoperabilidade sem corromper as estruturas de memória do frontend legado.

---

## 4. Hook de Integração Isolado

O hook [useSupabaseOpportunities.ts](../../../src/hooks/useSupabaseOpportunities.ts) foi disponibilizado no sistema.
- Ele detecta o workspace ativo atual usando `useCurrentWorkspace`.
- Gerencia de forma reativa os estados de carregamento (`loading`), erro (`error`) e lista de oportunidades (`opportunities`).
- Expõe métodos envelopados de escrita que disparam toasts automáticos do `sonner`.
- **Nesta etapa, o hook NÃO está conectado à interface de visualização do CRM.tsx**, mitigando regressões.

---

## 5. Modo Supabase Experimental (Leitura / Mover Estágio / Edição Básica / Criação / Arquivamento)

O CRM suporta um modo experimental de visualização de dados da nuvem com escrita pontual controlada:
- **Feature Flag de Leitura**: Controlada localmente pela chave `kora.crm.supabaseExperimental.enabled` (padrão: `false`).
- **Feature Flag de Escrita de Estágio**: Controlada localmente pela chave `kora.crm.supabaseStageMove.enabled` (padrão: `false`).
- **Feature Flag de Edição Básica**: Controlada localmente pela chave `kora.crm.supabaseBasicEdit.enabled` (padrão: `false`).
- **Feature Flag de Criação de Oportunidades**: Controlada localmente pela chave `kora.crm.supabaseCreate.enabled` (padrão: `false`).
- **Feature Flag de Arquivamento**: Controlada localmente pela chave `kora.crm.supabaseArchive.enabled` (padrão: `false`).
- **Seletor de Fonte**: Exibe uma barra no topo da tela do CRM permitindo alternar entre "Local" e "Supabase experimental" (salvo em `kora.crm.dataSource.v1`). Se não houver workspace ativo, a opção Supabase é desativada.
- **Movimentação Controlada (Stage Move)**: Se a flag de escrita de estágio estiver ativa, o usuário pode arrastar cards no Kanban do modo Supabase experimental. Ao arrastar e soltar, o sistema executa `crmOpportunitiesRepository.moveOpportunityStage` atualizando a oportunidade na nuvem e salvando um log local em `kora.crm.supabaseStageMoves.v1`. Em caso de erro, a alteração é revertida visualmente na tela através do reload reativo.
- **Edição Básica Controlada**: Se a flag de edição básica estiver ativa, o usuário pode abrir o Drawer de detalhes de um lead e salvar alterações cadastrais básicas na nuvem via `crmOpportunitiesRepository.updateOpportunity`. A operação é registrada localmente sob a chave `kora.crm.supabaseEdits.v1` apenas após sucesso real de API.
  - **Campos Permitidos**: `title` (name), `company`, `contact_name` (contact), `email`, `phone` (whatsapp), `source` (origin), `temperature`, `priority`, `potential_value` (estimatedValue), `next_action`, `next_action_date`, `expected_close_date` e `notes` (description).
  - **Campos Bloqueados**: `id`, `workspace_id`, `client_id`, `converted_client_id`, `quote_id`, `quote_title`, `status`, `won_at`, `lost_at`, `lost_reason`, `archived` e `is_demo`.
- **Criação Controlada (Create Opportunity)**: Se a flag de criação de oportunidades estiver ativa, o usuário pode clicar em "Nova oportunidade" no cabeçalho e preencher o formulário para criar uma oportunidade diretamente no Supabase.
  - **Botão Nova Oportunidade**: Se a flag estiver inativa, o clique exibe o toast: `"Criação no CRM Supabase entra nesta etapa experimental. Ative em Configurações."` e bloqueia a ação.
  - **Campos Permitidos e Higienizados**: A oportunidade é salva na nuvem com os seguintes campos: `title`, `company`, `contact_name`, `email`, `phone`, `whatsapp`, `stage`, `status` (padrão `open`), `source`, `temperature`, `priority`, `potential_value`, `next_action`, `next_action_date` e `notes` (descrição).
  - **Mapeamento de Cliente**: Se houver um cliente correspondente localmente (`clientId`), o sistema verifica se ele foi importado para a nuvem no mapa `kora.clients.supabaseImport.v1`. Se encontrar o UUID remoto, define o campo `client_id`; caso contrário, o campo fica nulo (não cria cliente automaticamente).
  - **Valores Padrão**: `stage` (primeiro estágio do pipeline ativo), `status` ('open'), `archived` (`false`), `is_demo` (`false`).
  - **Log Local**: Sucessos reais gravam log local na chave `kora.crm.supabaseCreates.v1` com `opportunityId`, `title` e data de criação.
  - **Tratamento de Erro**: Em caso de falha de conexão/API, o formulário permanece aberto para que o usuário tente novamente, exibindo toast explicativo, e nenhum log local é gerado.
- **Arquivamento Controlado (Archive Opportunity)**: Se a flag de arquivamento de oportunidades estiver ativa, o usuário pode arquivar oportunidades em modo Supabase.
  - **Ação de Arquivar**: Se a flag estiver inativa, a tentativa de arquivamento exibe o toast: `"Arquivamento no CRM Supabase entra nesta etapa experimental. Ative em Configurações."`
  - **Confirmação Obrigatória**: Antes de efetuar o arquivamento, o sistema abre uma caixa de diálogo `AlertDialog` solicitando confirmação explícita.
  - **Persistência**: Ao confirmar, chama-se `crmOpportunitiesRepository.archiveOpportunity(workspaceId, opportunityId)` atualizando `archived = true` no Supabase e disparando o reload com `refreshSupabase()`.
  - **Log Local**: Sucessos reais gravam log na chave `kora.crm.supabaseArchives.v1` com `opportunityId`, `title` e `archivedAt`.
  - **Tratamento de Erro**: Em caso de falha, exibe toast explicativo e dispara `refreshSupabase()` para garantir que a UI reflita a posição correta, sem gravar log local.
  - **Comportamento Visual**: Oportunidades arquivadas desaparecem do Kanban / Lista se o filtro para ocultar arquivadas estiver ativo. A visualização de arquivados ou restauração estão inativas nesta etapa.
- **Somente Leitura / Bloqueio para Outras Ações**: Exclusão definitiva (delete físico), restauração de arquivados (unarchive), geração de orçamentos ou conversão em cliente permanecem bloqueadas no modo Supabase, exibindo toast de bloqueio correspondente.
- **Estados de UI**: Trata estados de carregamento, erros de comunicação com a nuvem e exibe o estado vazio (`EmptyState`) com a mensagem: `"Nenhuma oportunidade encontrada no Supabase. Importe oportunidades locais em Configurações."`

---

## 6. O que continua Local (localStorage)

Quando o seletor está em **Local** (ou a feature flag está desativada):
- O CRM funciona 100% de forma local no `localStorage` (`orbyt.leads.v1`).
- Kanban local, listas locais, criações, edições, movimentações e exclusões estão totalmente preservados.

---

## 7. Próximos Passos e Riscos

### Próximos Passos
1. **Ativação e Validação do Beta**: Homologar a leitura, a escrita de estágio e a edição básica de oportunidades em produção.
2. **Escrita Completa no Supabase**: Implementar a persistência de todas as propriedades no Supabase em etapas futuras (incluindo criação, exclusão, arquivamento e conversão).

### Riscos Identificados
- **Incompatibilidade de IDs**: A interface local do CRM utiliza IDs numéricos autoincrementados no JS. A migração definitiva para UUIDs (Supabase) exigirá mapeamento estrito ( importedMap ) nas associações locais para evitar quebras em orçamentos (`quoteId`).
- **Automações Órfãs**: Gatilhos locais de automação de leads podem não disparar se a escrita for redirecionada diretamente ao Supabase sem um barramento de eventos unificado.
