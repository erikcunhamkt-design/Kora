# Liberação do Beta Fechado: Modo Supabase Experimental da Ficha Técnica

Este documento detalha o planejamento, os escopos e as diretrizes de QA para a liberação do **Modo Supabase Experimental da Ficha Técnica** em ambiente de beta fechado.

---

## 1. Objetivo do Beta

O objetivo principal desta fase é validar o **Modo Supabase Experimental da Ficha Técnica** em um grupo restrito de usuários (beta fechado) sob condições reais de uso antes de promovê-lo a padrão global da aplicação. Queremos testar a estabilidade da infraestrutura do Supabase, o fluxo de mapeamento estruturado, o comportamento offline resiliente e o upload de mídias para o Storage privado.

---

## 2. Escopo do Beta

### Inclui (O que será testado)
- **Feature Flag local**: Chave de controle `kora.technicalSheets.supabaseExperimental.enabled` em Configurações para habilitar ou ocultar os recursos de nuvem deste módulo.
- **Seletor de Fonte (Local / Supabase)**: Seletor na página da Ficha Técnica permitindo alternar de forma transparente qual fonte de dados ler/exibir.
- **Salvamento Manual**: Envio sob demanda da versão local Higienizada da Ficha Técnica para a tabela remota `client_technical_sheets`.
- **Restauração Manual**: Recuperação de dados estruturados do Supabase com preview comparativo de preenchimento de seções e confirmação forte por checkbox.
- **Backup Preventivo Local**: Armazenamento automático da Ficha Técnica local anterior no `localStorage` antes de sobrescrevê-la no restauro.
- **Upload de Logo**: Armazenamento de imagem de marca no bucket seguro `client-assets` no Supabase Storage.
- **Upload de Materiais/Anexos**: Envio de arquivos de referência com restrições ativas de extensões perigosas e limites de tamanho.
- **Signed URL sob Demanda**: Geração e visualização temporária de assets do Storage autenticados por token (expiração curta de 1 hora).

### Não Inclui (Fora do escopo nesta etapa)
- **Supabase como fonte principal definitiva**: O banco principal padrão da aplicação para novos clientes e operação diária continua sendo o `localStorage`.
- **Autosync (Sincronização Automática)**: As alterações não são gravadas em tempo real na nuvem; é obrigatório salvar manualmente.
- **Bidirecional Automático**: O sistema não tenta mesclar ou resolver conflitos de alteração silenciosamente.
- **Outros Módulos no Supabase**: A migração nesta etapa é isolada; CRM, Financeiro, Projetos e Tarefas operam inteiramente em local e não tocam no Supabase.

---

## 3. Pré-requisitos para Teste

Para que o testador consiga realizar o ciclo de teste, as seguintes condições devem ser atendidas:
1. **Usuário Autenticado**: O usuário deve estar logado no sistema.
2. **Workspace Ativo**: O usuário deve pertencer a um Workspace ativo e válido (pois as políticas de RLS dependem do `workspace_id`).
3. **Cliente Importado para Supabase**: O cliente selecionado deve possuir vínculo ativo com a nuvem (presença do ID remoto no mapeamento `kora.clients.supabaseImport.v1` -> `importedMap`).
4. **Ficha Técnica Local Preenchida**: O cliente local deve possuir algum conteúdo na ficha técnica para que o salvamento seja testado.
5. **Bucket `client-assets` Configurado**: O bucket privado de Storage no Supabase deve estar criado com as políticas de RLS baseadas em UUIDs de workspace aplicadas.

---

## 4. Checklist de Teste (QA Checklist)

O testador deve seguir a sequência de passos abaixo para homologação:

- [ ] **Ativação da Feature Flag**: Ir em Configurações, ativar a opção "Modo Supabase Experimental da Ficha Técnica" e verificar o toast de sucesso.
- [ ] **Abertura da Ficha Técnica**: Acessar a Ficha Técnica de um cliente com vínculo remoto ativo. Confirmar que a fonte inicial exibida é "Local".
- [ ] **Troca de Fonte**: Alternar a fonte de dados para "Supabase experimental" no seletor e verificar se o carregamento é concluído sem erros.
- [ ] **Verificação de Estado Inicial**: Garantir que as seções mostram os dados hidratados do Supabase ou aparecem vazias caso a cópia remota ainda não tenha sido enviada.
- [ ] **Edição em Modo Supabase**: Modificar um valor em qualquer seção (ex: cores de Branding). Confirmar que as mudanças acontecem em memória (in-memory) e não são salvas silenciosamente no `localStorage`.
- [ ] **Indicador de Alterações**: Confirmar que a badge pulsante `⚠️ Alterações pendentes` aparece ao lado do botão de salvar assim que uma alteração é feita.
- [ ] **Gravação Remota (Salvar)**: Clicar no botão "Salvar versão atual no Supabase", aceitar o aviso do Dialog e confirmar que a badge de pendências some após o sucesso.
- [ ] **Recarga de Página**: Recarregar a aba em modo Supabase e verificar se a edição gravada no passo anterior persiste corretamente na visualização.
- [ ] **Recuperação de Backup (Restaurar)**: Voltar a fonte para "Local", alterar dados da ficha local, e depois usar o botão "Restaurar do Supabase". Validar se o resumo comparativo exibe as diferenças de forma precisa e se, após aceitar a caixa de consentimento, a ficha local é sobrescrita com os dados da nuvem.
- [ ] **Upload de Logo**: Fazer upload de uma imagem válida (PNG/JPG < 2MB) e garantir que a visualização da logo funciona. Tentar fazer upload de arquivo perigoso/incompatível (ex: SVG ou arquivo de 5MB) e certificar-se do bloqueio com toast de erro.
- [ ] **Upload de Material**: Adicionar um PDF ou arquivo TXT em "Materiais e Anexos". Verificar se o arquivo é listado.
- [ ] **Signed URL**: Clicar no anexo enviado e garantir que o navegador abre a URL assinada temporária corretamente.
- [ ] **Rollback de Emergência**: Voltar a Configurações, desativar a feature flag e retornar à Ficha Técnica do cliente. Validar se o seletor de fonte sumiu, se os botões de nuvem foram omitidos e se a ficha técnica opera 100% no fluxo local sem quaisquer perdas de dados ou travamentos na UI.

---

## 5. Critérios de Aprovação (Definição de Pronto)

Para considerar o beta fechado um sucesso, todos os seguintes critérios devem ser cumpridos:
- **Sem Perda de Dados Local**: Edições experimentais ou alternâncias de fonte não causam apagamento acidental de chaves locais do `localStorage`.
- **Sem Sobrescrita Silenciosa**: Nenhuma gravação no Supabase ocorre sem o consentimento e clique explícito do usuário.
- **Uploads Funcionais**: Os uploads de imagens e documentos para o Storage são bem-sucedidos e não vazam memória ou geram falhas de formato no banco.
- **Signed URLs Resilientes**: Os arquivos do Storage são acessados e exibidos por meio de links gerados sob demanda sem expiração precoce durante a sessão do usuário.
- **Rollback Transparente**: Desativar a flag oculta com sucesso todos os pontos de contato experimentais de nuvem da interface, mantendo a integridade total do aplicativo local.
- **Tratamento de Erros Limpo**: Quedas de internet ou erros de rede do Supabase exibem banners e toasts de erro compreensíveis, oferecendo de forma simples botões para retornar ao modo local estável.
- **Qualidade do Código**: O projeto deve continuar compilando inteiramente sem erros de tipos no compilador TypeScript e sem incremento no teto de 35 erros de lint legados.

---

## 6. Critérios de Bloqueio (Regressões Críticas)

Se qualquer um dos seguintes comportamentos for identificado no beta fechado, a liberação deve ser suspensa imediatamente para correção:
- Perda total ou parcial dos dados locais da Ficha Técnica de um cliente salvos no `localStorage`.
- Gravação remota no Supabase sobrescrevendo ou alterando silenciosamente dados do `localStorage` sem o processo obrigatório de backup preventivo (`kora.technicalSheets.restoreBackups.v1`).
- Vazamento de arquivos de Storage entre workspaces distintos (violação das políticas de RLS e isolamento multi-tenant).
- Falha na restauração que impeça a reconstrução correta dos campos locais hidratados.
- Link assinado gerando erro `403 Forbidden` ou quebra de renderização na tela devido a caminhos lógicos corrompidos.
- Impossibilidade de o usuário retornar ao modo Local (tela travada em erro de rede do Supabase sem botão de fallback ativo).

---

## 7. Procedimento de Rollback de Emergência

Se um testador se deparar com erros de renderização ou quebras de fluxo, ele pode reverter o aplicativo ao estado puramente local imediatamente por meio de duas formas:

1. **Pelo Painel de Configurações**:
   - Navegar até `/configuracoes`.
   - Na seção **Modo Supabase Experimental da Ficha Técnica**, clicar no botão **"Desativar"**.
   
2. **Via Console do Navegador (Developer Tools)**:
   - Se a tela estiver travada ou inacessível, abrir o console do desenvolvedor (F12) e executar o comando de rollback para desativar a flag globalmente:
     ```javascript
     localStorage.setItem("kora.technicalSheets.supabaseExperimental.enabled", "false");
     ```
   - Em seguida, recarregar a página. A aplicação carregará a Ficha Técnica 100% de volta ao fluxo local convencional.

---

## 8. Próximas Etapas (Pós-Beta)

Se a fase de testes em beta fechado for aprovada sem regressões de segurança ou perdas de integridade, a próxima etapa estruturada do roadmap consistirá em:
- **Supabase como fonte preferencial com fallback Local para clientes sincronizados**: A nuvem passará a ser a fonte ativa principal de leitura e escrita para clientes integrados, mantendo o `localStorage` estritamente como uma camada de persistência de segurança resiliente em segundo plano (write-through) para suporte offline confiável.
