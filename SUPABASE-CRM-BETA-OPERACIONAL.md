# Acompanhamento Operacional - CRM Supabase Experimental (Beta Fechado)

Este documento estabelece as diretrizes de monitoramento, homologação em produção, métricas de observabilidade manual e critérios de decisão para o **Beta Fechado do CRM Supabase Experimental**.

---

## 1. Objetivo
Monitorar e atestar o comportamento prático, a segurança de persistência e a integridade do CRM Supabase Experimental sob uso real antes de liberar novas ações de escrita sensíveis ou destrutivas.

---

## 2. Escopo Atualmente Liberado
As seguintes funcionalidades experimentais estão implementadas e ativas para testes sob suas respectivas feature flags:
- **Leitura Supabase**: Visualização de oportunidades remotas da tabela `crm_opportunities` no Kanban do CRM.
- **Criação de Oportunidade**: Persistência de novas oportunidades diretamente na nuvem com payload higienizado e mapeamento opcional de cliente.
- **Movimentação de Estágio (Stage Move)**: Drag-and-drop persistente no Supabase com suporte a rollback automático.
- **Edição Básica**: Atualização de campos cadastrais básicos e notas a partir do drawer lateral.
- **Arquivamento de Oportunidade**: Mover oportunidade lógica para arquivado (`archived = true`) com confirmação de segurança.
- **Flags Separadas**: Controle granular de acesso para cada funcionalidade nas Configurações.
- **Logs Locais**: Histórico local de transações bem-sucedidas no navegador (`kora.crm.supabaseCreates.v1`, `kora.crm.supabaseStageMoves.v1`, `kora.crm.supabaseEdits.v1` e `kora.crm.supabaseArchives.v1`).

---

## 3. O Que Continua Bloqueado
Permanecem estritamente bloqueadas no modo Supabase experimental as seguintes ações:
- **Excluir**: Remoção definitiva (delete físico) de registros.
- **Restaurar**: Desarquivamento/restauração de oportunidades arquivadas.
- **Converter em Cliente**: Transformação de lead em cliente integrado.
- **Criar Orçamento**: Criação de propostas vinculadas a partir da oportunidade.
- **Integrações de Projetos/Tarefas/Financeiro**: Criação de faturas, fluxos de caixa, cronogramas ou tarefas ligadas à oportunidade.
- **Automação**: Gatilhos e disparadores automáticos baseados em colunas.
- **Fonte Principal Definitiva**: O `localStorage` continua sendo a fonte operacional padrão do CRM.

---

## 4. Checklist de Teste com Dados Reais
Os testadores devem executar os seguintes fluxos por pelo menos alguns ciclos comerciais:
- [ ] **Importador Assistido**: Executar a importação manual de oportunidades locais para a nuvem via assistente em Configurações.
- [ ] **Criação Direta**: Criar uma nova oportunidade diretamente no modo Supabase experimental.
- [ ] **Movimentação**: Arrastar a oportunidade recém-criada entre colunas e etapas.
- [ ] **Edição**: Abrir o drawer lateral, atualizar informações cadastrais, preencher notas e salvar.
- [ ] **Arquivamento com Alerta**: Clicar em arquivar no card, confirmar o `AlertDialog`, verificar que ela sai do Kanban ativo e o log local `kora.crm.supabaseArchives.v1` é escrito com sucesso.
- [ ] **Persistência Remota**: Recarregar a página e validar que a oportunidade e suas alterações persistem inalteradas.
- [ ] **Alternância de Fonte**: Alternar a fonte de dados entre "Local" e "Supabase experimental" no cabeçalho do CRM e verificar que cada modo reflete seus respectivos dados isolados.
- [ ] **Desativação de Flags**: Desligar as flags em Configurações e confirmar que a interface CRM bloqueia as operações adequadamente.
- [ ] **Preservação de Dados**: Verificar que nenhuma das interações acima mutou, apagou ou corrompeu a base local operacional (`orbyt.leads.v1` no localStorage).

---

## 5. Métricas Manuais para Observar
Os administradores do beta devem coletar feedback manual e telemetria sobre os seguintes pontos:
- **Tempo de Carregamento**: Latência perceptível ao alternar para a fonte Supabase ou realizar refresh.
- **Falhas de Refresh**: Ocorrência de erros ou timeouts de rede durante a leitura das oportunidades.
- **Duplicidades**: Aparecimento de cards ou registros duplicados na visualização do Kanban.
- **Cards em Coluna Errada**: Inconsistências de posicionamento de cards em relação ao `stage` real do banco.
- **Erro de Vínculo com Cliente**: Falhas de associação relacional do `client_id` (clientes não mapeados ou mapeados indevidamente).
- **Logs Duplicados**: Verificação de duplicidade de entradas nos históricos de logs do localStorage.
- **Usuário Tentando Ação Bloqueada**: Tentativas frequentes de exclusão, arquivamento ou conversão bloqueadas (sinaliza necessidade de maior clareza visual na UI).
- **Confusão de Modo**: Casos onde o usuário edita a nuvem acreditando estar alterando a base local ou vice-versa.

---

## 6. Critérios para Avançar para Restauração de Arquivados
A liberação da funcionalidade de restauração de arquivados remotos no Supabase só ocorrerá se:
- O **arquivamento lógico** de cartões estiver perfeitamente estável em produção, sem sumiço indevido de registros.
- Os logs locais em `kora.crm.supabaseArchives.v1` estiverem registrando transações sem nenhuma duplicidade ou omissão.
- O diálogo `AlertDialog` de confirmação for considerado adequado e claro pelos usuários.
- Não ocorrer **nenhuma alteração indevida ou corrupção** no `orbyt.leads.v1` do localStorage local.
- For planejado o fluxo visual correspondente da lista de arquivados no frontend para viabilizar o desarquivamento seletivo.

---

## 7. Critérios de Bloqueio (Rollback do Beta)
O avanço será imediatamente paralisado e as flags desativadas se ocorrer:
- Desaparecimento inexplicável de cards no Kanban ativo (fora do fluxo de arquivamento planejado).
- Duplicação de registros na criação ou movimentação.
- Falha na persistência de alteração de estágio, campos editados ou arquivamento.
- Quebra de relacionamentos com clientes importados.
- Corrupção ou perda de dados da base local operacional.
- Falha no rollback visual diante de quedas de rede ou erros na API de arquivamento.
- Gravação indevida ou corrupção do `localStorage` no modo Supabase.

---

## 8. Próxima Etapa Sugerida se Aprovado
Se os critérios do beta operacional forem satisfeitos, a próxima microetapa sugerida é:
`CRM Supabase — Excluir / Restaurar Oportunidade Experimental`
