# SUPABASE CRM QA Checklist - Modo Experimental (Leitura)

Este documento contém o checklist prático de auditoria de qualidade, mapeamento de limitações, logs de testes e critérios de liberação para o módulo CRM Supabase Experimental.

---

## 1. Checklist de Homologação (Beta Fechado)

### 1.1 Estado de Feature Flag e Seletor
- [x] **Flag Desativada**: Garantir que se a flag `kora.crm.supabaseExperimental.enabled` estiver em `false`, o seletor fique invisível e o CRM opere puramente em `localStorage`.
- [x] **Flag Ativada**: Garantir que o seletor apareça no cabeçalho.
- [x] **Desativação a Quente**: Ativar a flag, alternar para o modo Supabase, retornar à página de configurações, desativar a flag e retornar ao CRM. O sistema deve redefinir e forçar o carregamento local com segurança.
- [x] **Ausência de Workspace**: Garantir que se o usuário não possuir um workspace ativo selecionado, a opção Supabase fique desabilitada e exiba uma dica explicativa no hover.

### 1.2 CRM Operacional Local (Sem Regressão)
- [x] **Criação de Negociação**: Criar um lead local e validar gravação em `orbyt.leads.v1`.
- [x] **Movimentação Visual**: Mover um lead local entre colunas do Kanban e atualizar a página. O lead deve manter a nova coluna.
- [x] **Edição e Drawer**: Abrir o detalhe do lead local, editar dados básicos e notas. Validar persistência.
- [x] **Geração de Orçamentos**: Criar orçamentos a partir do lead local e checar o vínculo sem erros de UI.

### 1.3 Modo Supabase Experimental Leitura
- [x] **Estados de Carregamento**: Garantir visualização do loader rotativo durate a listagem de oportunidades remotas.
- [x] **Mensagem de Sem Registros (Empty State)**: Com a tabela vazia, confirmar a visualização da string exata: `Nenhuma oportunidade encontrada no Supabase. Importe oportunidades locais em Configurações.`
- [x] **Simulação de Erro**: Forçar queda de rede ou erro na requisição e conferir renderização do painel vermelho de erro do Supabase.
- [x] **Botão de Atualizar**: Clicar em "Atualizar" no banner de leitura e validar nova requisição ao Supabase.

### 1.4 Bloqueios de Escrita em Modo Supabase
No modo experimental ativo, tentar forçar escrita e confirmar o toast de bloqueio `"Edição no CRM Supabase entra na próxima etapa. Volte para Local para editar."` nas seguintes interações:
- [x] Clicar em "Nova oportunidade" no cabeçalho.
- [x] Clicar nos botões rápidos de criação nas colunas do Kanban.
- [x] Tentar alterar informações, salvar notas, converter para cliente ou gerar orçamentos dentro do Drawer de detalhe do Lead.

### 1.5 Mapeamento e Escrita de Estágios (Stage Move)
Com as flags `kora.crm.supabaseExperimental.enabled` e `kora.crm.supabaseStageMove.enabled` ativas:
- [x] **Arrastar e Soltar Ativo**: Validar que o drag-and-drop de oportunidades no Kanban Supabase passa a ser permitido.
- [x] **Sucesso de Persistência**: Ao soltar o card em um novo estágio, verificar a chamada para `crmOpportunitiesRepository.moveOpportunityStage` e atualização da base remota no Supabase.
- [x] **Log Local de Escrita**: Garantir que as informações de ID, origem, destino e timestamp do movimento foram criadas perfeitamente no array do `localStorage` sob a chave `kora.crm.supabaseStageMoves.v1`.
- [x] **Rollback em Erro**: Simular erro de rede ou requisição e certificar que a oportunidade retorna visualmente para a coluna inicial (rollback visual do estado) sem atualizar o `localStorage` operacional local de leads.
- [x] **Bloqueio com Flag Move OFF**: Desativar a flag de stage move e confirmar que o drag-and-drop de oportunidades no Supabase volta a ficar bloqueado.

### 1.6 Edição Básica Experimental (Basic Edit)
Com as flags `kora.crm.supabaseExperimental.enabled` e `kora.crm.supabaseBasicEdit.enabled` ativas:
- [x] **Permissão do Botão Editar**: Validar que o botão "Editar" é renderizado no cabeçalho do Drawer de leads no modo Supabase.
- [x] **Bloqueio sem Flag**: Confirmar que com a flag de edição básica desativada, o Drawer de detalhes do Supabase permanece somente leitura.
- [x] **Valores e Campos Permitidos**: Editar campos permitidos (nome, empresa, e-mail, telefone, valor, próxima ação, etc.) e verificar o salvamento com sucesso via repository na nuvem.
- [x] **Campos Bloqueados**: Confirmar que o payload de envio de atualização não contém campos estruturais como `client_id`, `quote_id` ou `archived`.
- [x] **Log Local de Edição**: Conferir que o log de sucesso de edição é inserido na chave `kora.crm.supabaseEdits.v1` apenas após sucesso real do backend.
- [x] **Erro ao Salvar**: Simular um erro e verificar que as alterações são descartadas e os valores originais são recarregados através do refresh, mantendo o `localStorage` operacional local intacto.
- [x] **Outras Ações Sensíveis Bloqueadas**: Validar que botões e fluxos de criação de novos leads, orçamentos e conversão em cliente no Drawer seguem bloqueados no modo Supabase.

### 1.7 Criar Oportunidade Experimental (Create Opportunity)
Com as flags `kora.crm.supabaseExperimental.enabled` e `kora.crm.supabaseCreate.enabled` ativas:
- [x] **Flag de Criação OFF**: Tentar criar nova oportunidade no modo Supabase com flag desativada e verificar toast de bloqueio: `"Criação no CRM Supabase entra nesta etapa experimental. Ative em Configurações."`
- [x] **Flag de Criação ON**: Com flag ativa, clicar em "Nova oportunidade" e abrir formulário.
- [x] **Payload Sanitizado**: Salvar e verificar se apenas as colunas corretas (title, company, contact_name, email, phone, whatsapp, stage, status, source, temperature, priority, potential_value, next_action, next_action_date, notes) são enviadas.
- [x] **Valores Padrão**: Validar que archived é false, is_demo é false, status é 'open', e stage é o estágio correto inicial.
- [x] **Vínculo com Cliente**:
  - Se for um cliente importado previamente, validar que o link remoto `client_id` é corretamente preenchido a partir do mapeamento.
  - Se não for importado, validar que `client_id` permanece nulo e nenhum cliente novo é gerado.
- [x] **Log Local de Criação**: Validar que o registro é inserido em `kora.crm.supabaseCreates.v1` após o sucesso de API.
- [x] **Tratamento de Erros**: Simular erro ao salvar, confirmar que o diálogo permanece aberto para nova tentativa, nenhum log local é gerado e o `localStorage` operacional permanece limpo.
- [x] **Ações Sensíveis Bloqueadas**: Arquivar, excluir, converter e orçamentos continuam bloqueados no modo experimental.

---

## 2. Relatórios de Qualidade

### Bugs Encontrados & Corrigidos:
- *Ausência de Workspace Ativo*: O seletor de fonte permitia alternar para o Supabase sem um workspace carregado, resultando em chamadas de API inválidas com `null` ou `undefined`. **Corrigido**: Desabilitado o botão de transição para o Supabase experimental no seletor de fonte caso `workspace` esteja ausente no contexto de autenticação, forçando o retorno seguro para Local.
- *Mensagem de Empty State Divergente*: O texto de pipeline vazio estava desalinhado com o esperado pelo cliente. **Corrigido**: Alterado no [CRM.tsx](file:///C:/Users/erikw/.gemini/antigravity/scratch/orbit-designer-hub/src/pages/CRM.tsx#L725) para exibir a mensagem descritiva literal estipulada.

### Limitações Conhecidas nesta Etapa:
- **IDs Híbridos (Mapeamento)**: O CRM local utiliza chaves numéricas incrementais. As oportunidades gravadas no Supabase utilizam UUIDs. A conversão de leads e buscas relativas por link direto `?lead=<id>` utilizam IDs locais no `localStorage`.
- **Deduplicação baseada em Metadados**: A importação depende estritamente da integridade do mapa `kora.crm.supabaseImport.v1`. Caso o usuário limpe o cache de metadados do navegador, oportunidades importadas anteriormente podem ser identificadas como duplicadas ao invés de importadas.

---

## 3. Critérios para Avançar para a Escrita no Supabase
Para autorizar a escrita direta no Supabase e evolução para o CRM V2:
1. **Homologação completa do Importador Assistido**: Certificar de que todos os leads e históricos comerciais do localStorage foram enviados corretamente pelos usuários pioneiros.
2. **Consistência de Identificadores**: Garantir que referências a orçamentos (`quote_id`) e tarefas sejam mapeadas corretamente usando UUIDs.
3. **Mecanismo de Sincronização Incremental**: Planejar e testar a transição final de escrita dupla temporária ou migração definitiva offline da base local de leads.

---

## 4. QA Integrado do CRM Supabase Beta

### Combinações de Flags Testadas:
- `Experimental=false, stageMove=any, basicEdit=any, create=any`: CRM funciona 100% em modo Local. Seletor invisível.
- `Experimental=true, stageMove=false, basicEdit=false, create=false`: Seletor visível. Leitura ativa. Drag-and-drop, botão "Editar" e "Nova oportunidade" bloqueados.
- `Experimental=true, stageMove=true, basicEdit=false, create=false`: Drag-and-drop permitido. Botão "Editar" e "Nova oportunidade" bloqueados.
- `Experimental=true, stageMove=false, basicEdit=true, create=false`: Drag-and-drop e "Nova oportunidade" bloqueados. Edição de campos básicos liberada.
- `Experimental=true, stageMove=false, basicEdit=false, create=true`: Drag-and-drop e "Editar" bloqueados. Criação de novas oportunidades no Supabase liberada.
- `Experimental=true, stageMove=true, basicEdit=true, create=true`: Criação, movimentação e edição básica operacionalizadas dinamicamente na nuvem.

### Resultados da Auditoria:
* **CRM Local**: 100% operacional e isolado. Modificações salvam perfeitamente na chave local `orbyt.leads.v1` sem tocar no Supabase.
* **Leitura**: Kanban e listas renderizam as colunas Supabase dinamicamente.
* **Mover Estágio**: Cards arrastados atualizam com sucesso no banco Supabase. Log escrito após persistência bem-sucedida em `kora.crm.supabaseStageMoves.v1`.
* **Edição Básica**: Apenas os campos permitidos são mutados. O update não envia propriedades estruturais bloqueadas. Log escrito após sucesso em `kora.crm.supabaseEdits.v1`.
* **Criação Experimental**: Formulário envia payloads higienizados com UUIDs corretos do workspace/cliente associado. Logs persistidos em `kora.crm.supabaseCreates.v1`.
* **Rollback / Tratamento de Erro**: Em caso de erros, a UI permanece consistente (movimento reverte visualmente e criação mantém formulário aberto para correção), mantendo o `localStorage` operacional livre de dados inválidos.
* **Ações Sensíveis**: Exclusão, arquivamento e geração de orçamentos ou conversão em cliente permanecem bloqueadas no modo Supabase.

---

## 5. QA Integrado após Criação de Oportunidades

### 5.1 Combinações de Flags e Restrições de Função
- **Flag `kora.crm.supabaseExperimental.enabled` = false**: O CRM funciona 100% no modo local operacional e o seletor de fonte de dados fica oculto.
- **Flag `kora.crm.supabaseExperimental.enabled` = true + `supabaseCreate` = false**: O botão "Nova oportunidade" bloqueia a abertura do formulário e dispara o toast: `"Criação no CRM Supabase entra nesta etapa experimental. Ative em Configurações."`
- **Flag `kora.crm.supabaseExperimental.enabled` = true + `supabaseCreate` = true**: O formulário é aberto no modo Supabase experimental. Outras ações sensíveis (como deletar ou arquivar) permanecem bloqueadas.
- **Flag `kora.crm.supabaseExperimental.enabled` = true + `supabaseCreate` = true + `supabaseStageMove` = true**: Permite criar e mover cards no Kanban.
- **Flag `kora.crm.supabaseExperimental.enabled` = true + `supabaseCreate` = true + `supabaseBasicEdit` = true**: Permite criar e editar campos básicos da oportunidade no drawer lateral.
- **Flag `kora.crm.supabaseExperimental.enabled` = true + `supabaseArchive` = true**: Permite arquivar oportunidades no modo Supabase experimental. Exclusão definitiva (delete físico) e restauração (unarchive) continuam estritamente bloqueadas.
- **Todas as flags ativas**: Ciclo completo de listagem, criação, edição básica, movimentação e arquivamento ativo no Supabase, enquanto exclusão física, restauração, conversão em cliente e orçamentos permanecem bloqueados.

### 5.2 Comportamento e Isolamento do CRM Local
- O banco local (`orbyt.leads.v1` no localStorage) continua 100% funcional.
- Criar leads locais, editar no drawer, arrastar cards locais, arquivar/deletar e gerar orçamentos locais funcionam de forma independente e isolada, sem registrar logs ou tocar na API Supabase.
- Links profundos locais e a Central do Dia reativa local operam normalmente sem regressão.

### 5.3 Criação no Supabase e Validação de Payload
- **Sanitização de Envio**: O payload enviado ao banco Supabase possui exclusivamente os campos permitidos: `title`, `company`, `contact_name`, `email`, `phone`, `whatsapp`, `stage`, `status` (`'open'`), `source`, `temperature`, `priority`, `potential_value`, `next_action`, `next_action_date` e `notes`.
- **Campos Estruturais Bloqueados**: Propriedades indevidas (como `quote_id`, `quote_title`, `converted_client_id`, `won_at`, `lost_at`, `lost_reason`) não são enviadas na criação e nem geram dados financeiros/projetos/tarefas correspondentes.
- **Mapeamento de Cliente**: O vínculo do `client_id` (UUID) é feito apenas caso o `clientId` local tenha um mapeamento válido registrado em `kora.clients.supabaseImport.v1`. Caso contrário, o campo é enviado como `null`, sem forçar a criação indevida de um cliente.

### 5.4 Comportamento sob Erro/Falha
- Simulação de ausência de workspace, erro de API ou falha de conexão na criação exibe toast informativo de erro.
- O formulário de nova oportunidade **permanece aberto** com todos os dados digitados intactos, permitindo ao usuário corrigir e reenviar.
- Nenhum registro falso ou inconsistente é persistido no localStorage operacional e nenhum log de sucesso é registrado localmente.

### 5.5 Geração de Logs Locais
- Registros de sucesso real de criação remota no Supabase salvam os campos `opportunityId` (UUID retornado), `title` e `createdAt` (data ISO) sob a chave de log local `kora.crm.supabaseCreates.v1`.
- Em caso de erros na chamada de API, nenhum log é inserido.

### 5.6 Arquivamento Experimental de Oportunidades
Com as flags `kora.crm.supabaseExperimental.enabled` e `kora.crm.supabaseArchive.enabled` ativas:
- [x] **Flag de Arquivamento OFF**: Tentar arquivar uma oportunidade no modo Supabase com flag desativada e verificar toast de bloqueio: `"Arquivamento no CRM Supabase entra nesta etapa experimental. Ative em Configurações."`
- [x] **Flag de Arquivamento ON**: Com flag ativa, clicar em "Arquivar" no menu de ações do card.
- [x] **Diálogo de Confirmação**: Verificar que o modal `AlertDialog` abre exibindo título e descrição apropriados, com botões "Cancelar" e "Arquivar oportunidade".
- [x] **Gravação Remota**: Confirmar que ao aceitar o diálogo, a API `crmOpportunitiesRepository.archiveOpportunity` é acionada e atualiza `archived = true` no banco Supabase.
- [x] **Remoção Visual**: Certificar que a oportunidade sai do Kanban ativo imediatamente após o sucesso real da chamada e recarregamento da UI.
- [x] **Log Local de Arquivo**: Validar que a transição insere o registro com `opportunityId`, `title` e `archivedAt` sob a chave `kora.crm.supabaseArchives.v1` apenas após sucesso remoto.
- [x] **Erro ao Arquivar**: Simular erro de API no arquivamento, validar que o toast de erro é exibido, a ação reverte visualmente executando `refreshSupabase()`, nenhum log de arquivo é inserido e o `localStorage` operacional `orbyt.leads.v1` continua intacto.
- [x] **Exclusão e Restauração Bloqueadas**: Validar que a restauração (unarchive) exibe toast informando o bloqueio e a exclusão definitiva continua bloqueada com toast padrão no modo Supabase.

---

## 6. QA do Arquivamento Experimental

Este checklist registra o escopo de auditorias, simulações de falha e testes de estresse operacionais para o arquivamento controlado.

### 6.1 Cenários Testados
1. **Controle de Flag Inativa**: Com `supabaseArchive.enabled = false` no modo Supabase experimental, tentar arquivar dispara o toast explicativo e bloqueia o modal.
2. **Confirmação e AlertDialog**: Com flag ativa, clicar em arquivar abre o `AlertDialog` com os botões "Cancelar" e "Arquivar oportunidade" e microcopy esclarecedora (não é delete físico). Clicar em cancelar fecha o modal sem alterar o banco.
3. **Persistência de Estado**: Clicar em confirmar dispara a atualização `archived = true` no banco Supabase e, após recarregamento automático, a oportunidade é ocultada da listagem ativa / Kanban ativo.
4. **Resiliência e Falha (Rollback)**: Forçar erro de conexão, workspace ausente ou token expirado dispara toast de erro, executa refresh corretivo da interface para evitar travamento em estados falsos, e não gera nenhuma entrada de log local.
5. **Logs de Auditoria**: Entradas gravadas com sucesso na chave local `kora.crm.supabaseArchives.v1` apenas sob confirmação real de resposta `200` da API Supabase.
6. **CRM Local Intacto**: Todo o fluxo local do CRM (`localStorage` `orbyt.leads.v1`) continua respondendo perfeitamente, permitindo arquivamento local, restauração local e deleção local sem tocar na nuvem.
7. **Bloqueio de Ações Adicionais**: O exclusão definitiva e restauração de remotos continuam bloqueados sob as regras de proteção.

### 6.2 Bugs Encontrados & Corrigidos
- **Alinhamento de Unarchive**: Identificado que se o usuário clicasse no botão "Restaurar" em cartões marcados como arquivados (se exibidos na interface), a chamada local de arquivamento seria efetuada na nuvem. **Corrigido**: Adicionado bloqueio explícito em `handleUnarchiveClick` exibindo toast informando que a restauração está inativa no Supabase.

### 6.3 Limitações Conhecidas
- **Visualização de Oportunidades Arquivadas**: A interface ativa do Kanban oculta registros arquivados. A visualização da lista de arquivados no Supabase e sua respectiva restauração lógica ficam reservadas para uma etapa futura.

### 6.4 Recomendação Final
- Recomenda-se avançar com segurança para a liberação da **Restauração de Oportunidades Arquivadas**, visto que o fluxo lógico de arquivamento está robusto, isola os bancos e não gera resíduos de logs falsos em cenários de erro.

