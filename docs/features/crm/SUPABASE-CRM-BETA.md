# Beta Fechado - CRM Supabase Experimental (Modo Leitura e Movimentação Controlada)

Este documento define os objetivos, escopo, pré-requisitos, checklist de QA e critérios de liberação para a fase de **Beta Fechado do CRM Supabase Experimental em Modo Leitura e Movimentação Controlada**.

---

## 1. Objetivo do Beta
Validar a estabilidade, a segurança e a integridade de dados do CRM Supabase em modo experimental (leitura e movimentação controlada de estágio), garantindo que a sincronização de dados remotos ocorra sem efeitos colaterais e sem interferir na operação local do CRM (`localStorage`).

---

## 2. Escopo do Beta

### O que está incluído:
- Exibição de seletor "Fonte do CRM" (Local / Supabase experimental) no topo da tela do CRM (se a feature flag estiver ativa e houver um workspace selecionado).
- Leitura reativa de dados remotos da tabela `crm_opportunities` via hook `useSupabaseOpportunities`.
- Mapeamento bidirecional seguro de dados no frontend.
- Bloqueio total de escritas, cadastros ou alterações em modo Supabase (exceções controladas por flags específicas).
- **Mover Estágio Experimental**: Movimentação de leads entre estágios no Kanban persistida no Supabase com logs locais salvos em `kora.crm.supabaseStageMoves.v1`.
- **Edição Básica Experimental**: Edição de campos cadastrais básicos via Drawer persistidos no Supabase com logs locais salvos em `kora.crm.supabaseEdits.v1`.
- **Criar Oportunidade Experimental**: Criação de novas oportunidades diretamente no Supabase a partir do formulário do CRM, controlada pela flag `kora.crm.supabaseCreate.enabled` com logs salvos em `kora.crm.supabaseCreates.v1`.
- Estado de visualização para loading, empty states, e erros de conexão.
- Feature flags locais em Configurações > Empresa/Supabase.

### O que NÃO está incluído (Estritamente Fora do Escopo):
- Exclusão ou arquivamento remoto de oportunidades no modo Supabase.
- Remoção do `localStorage` (Kora CRM continua tendo Local como fonte principal padrão).
- Alterações em orçamentos, financeiro, projetos ou tarefas.

---

## 3. Pré-requisitos
- Usuário autenticado na plataforma.
- Workspace Supabase ativo e selecionado em Configurações.
- Leads locais existentes ou importados para a nuvem previamente através do assistente de importação.

---

## 4. Checklist do Beta

### 4.1 Feature Flag e Isolamento Local
- **Flag OFF**: Com a flag `kora.crm.supabaseExperimental.enabled` desativada nas Configurações, o seletor de fonte deve sumir e o CRM deve continuar operando 100% de forma local.
- **Flag ON**: Ao ativar a flag, o seletor "Fonte do CRM" deve aparecer no cabeçalho do CRM.
- **Retorno seguro**: Desativar a flag nas Configurações deve forçar de imediato o retorno para a fonte Local.

### 4.2 Operações em Modo Local (Preservação)
Com a fonte definida como **Local**:
- Criar novos leads, editar dados do drawer, mover cartões entre colunas e arquivar/excluir registros devem persistir perfeitamente e apenas no `localStorage` (`orbyt.leads.v1`).

### 4.3 Visualização em Modo Supabase Experimental
Com a fonte definida como **Supabase experimental**:
- Exibição da badge clearly visível `"Supabase experimental — somente leitura"` e do banner informativo.
- Exibição de loading durante o fetch de dados.
- Renderização correta de opportunities cadastradas na nuvem.
- Exibição do empty state formatado caso o banco de dados esteja sem registros.
- Tratamento reativo de erros com mensagem amigável e ação de reteste através do botão "Atualizar".

### 4.4 Bloqueio Estrito de Ações de Escrita e Permissão de Estágios, Edição e Criação
- **Bloqueio Geral**: Arquivamento, exclusão e conversões em cliente/orçamento de leads devem continuar bloqueadas em modo Supabase.
- **Movimentação de Estágio (Drag-and-Drop)**:
  - Se la flag `kora.crm.supabaseStageMove.enabled` estiver inativa, o drag-and-drop de oportunidades no modo Supabase deve continuar bloqueado.
  - Se a flag estiver ativa, o drag-and-drop de oportunidades deve ser permitido, persistindo o estágio no Supabase, escrevendo logs na chave local `kora.crm.supabaseStageMoves.v1` e realizando rollback de visualização do card em caso de erro na rede.
- **Edição Básica Controlada**:
  - Se a flag `kora.crm.supabaseBasicEdit.enabled` estiver ativa, permitir editar nome/título, empresa, e-mail, telefone, valor estimado, data de fechamento estimada, próxima ação/data e observações no Drawer. O salvamento persiste as alterações remotamente e anota o log em `kora.crm.supabaseEdits.v1` após o sucesso. Em caso de erro, reverter visualmente e recarregar os dados remotos.
  - Se a flag estiver inativa, a edição dos campos no Drawer de detalhes deve permanecer bloqueada.
- **Criação Experimental Controlada**:
  - Se a flag `kora.crm.supabaseCreate.enabled` estiver inativa, o clique no botão "Nova oportunidade" no modo Supabase exibe toast de bloqueio e não abre o modal.
  - Se a flag estiver ativa, permite abrir o modal e salvar. O salvamento persiste no Supabase com payload sanitizado, preenche `client_id` se o cliente estiver mapeado no local storage `kora.clients.supabaseImport.v1`, escreve log local em `kora.crm.supabaseCreates.v1` após o sucesso real da chamada, e executa reload dos dados. Se a API falhar, exibe o toast de erro e mantém o formulário aberto para correção, sem criar nenhum log local.
- **Arquivamento Experimental Controlado**:
  - Se a flag `kora.crm.supabaseArchive.enabled` estiver inativa, a ação de arquivar exibe toast de bloqueio.
  - Se a flag estiver ativa, abre diálogo `AlertDialog` solicitando confirmação. Ao confirmar, executa o arquivamento remoto (`archived = true`), recarrega o Kanban e grava log local sob a chave `kora.crm.supabaseArchives.v1` apenas após o sucesso. Em caso de falha da API, exibe toast de erro, executa refresh para garantir o estado visual coerente, e não grava log local.
- **Restauração e Exclusão Bloqueadas**:
  - Validar que a tentativa de desarquivar/restaurar em modo Supabase exibe toast de ação bloqueada.
  - Validar que a tentativa de excluir definitivamente no Supabase exibe toast de bloqueio e não remove dados fisicamente.

---

## 5. Critérios de Aprovação e Bloqueio

### Critérios de Aprovação (Avançar para a próxima fase experimental):
- 100% de conformidade com os testes integrados do ciclo experimental (Leitura, Stage Move, Edição Básica, Criação e Arquivamento de Oportunidades).
- Validação de que a criação de novas oportunidades persiste no Supabase e integra com a atualização do Kanban, permitindo movimentações de estágio (Stage Move), edições no drawer lateral (Basic Edit) e posterior arquivamento (Archive) com confirmação na oportunidade recém-criada.
- Zero erros de compilação no TypeScript (`npx tsc --noEmit`).
- Manutenção do teto de linter atual (limite estrito de 35 erros legados pré-existentes).
- Nenhum dado local corrompido ou sincronizado indevidamente em modo local, assegurando isolamento total.

### Critérios de Bloqueio (Rollback imediato):
- Escrita não-autorizada de campos estruturais bloqueados, criação automática indevida de clientes, deleção definitiva (delete físico) ou restauração de arquivados (unarchive).
- Perda ou corrupção de registros salvos no `localStorage` (`orbyt.leads.v1`).
- Falha catastrófica de rede ou erro remoto de API que resulte em travamento ou crash da interface, inviabilizando o retorno imediato e seguro ao modo Local.
- Geração de logs locais de sucesso em casos de erro ou falha de escrita no banco de dados.
