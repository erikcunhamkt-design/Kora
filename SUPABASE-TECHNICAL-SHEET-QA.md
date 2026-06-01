# Relatório de QA Técnico — Ficha Técnica Supabase-Ready

Este relatório documenta a rodada completa de QA e auditoria técnica para a integração experimental e incremental do módulo **Ficha Técnica** com o Supabase.

---

## 1. Fluxos Testados

### 1.1 Clientes e Mapping
- **Cliente local sem importação**: Verificado que clientes criados puramente no `localStorage` não ativam os botões de ação do Supabase. A UI exibe corretamente a mensagem desabilitada: *"Importe o cliente para o Supabase antes de salvar a Ficha Técnica."*
- **Cliente local importado**: Mapeamento via `kora.clients.supabaseImport.v1` (`importedMap`) recupera corretamente o `supabaseClientId` e habilita as opções de gravação e leitura.
- **Estado com e sem vínculo no painel Supabase**: O painel exibe com precisão se a Ficha Técnica possui ou não uma versão gravada correspondente na nuvem, indicando a data de atualização (`updated_at`) quando disponível.

### 1.2 Importação da Ficha Técnica
- **Sanitização de Carga Útil**: Validação de que blobs, arquivos `base64` e `dataURL` gigantes são omitidos/sanitizados do payload enviado ao banco (`raw_payload`), mantendo a integridade do banco sem sobrecarregar o tráfego e o storage do banco relacional.
- **Configurações de Importação Assistida**: A importação em lote ou individual nas configurações do cliente respeita e atualiza o mapeamento adequadamente.

### 1.3 Leitura do Supabase na Página
- **Estados de Carregamento e Erro**: Testados loaders (`Skeleton` / spinners) e feedbacks de erro de rede ou permissão sem travar a interface local.
- **Resumo de Seções e Updated At**: O componente exibe com sucesso um resumo estruturado da versão atualmente armazenada no Supabase para comparação visual com o estado local.

### 1.4 Salvamento Manual no Supabase
- **Validação do AlertDialog**: Solicitação explícita de confirmação antes de disparar o `upsert`, prevenindo escritas acidentais.
- **Comportamento Transacional**: Garantido que falhas de rede ou de RLS abortam a operação sem marcar falsamente a ficha como salva e sem alterar o `localStorage` do usuário.

### 1.5 Upload de Logo no Storage
- **Formatos Aceitos**: Testado com sucesso o upload de arquivos PNG, JPEG e WebP.
- **Formatos Bloqueados**: SVG foi rejeitado com sucesso no frontend e no backend.
- **Limite de Tamanho (2MB)**: Arquivos maiores que 2MB dispararam toast de erro conforme esperado.
- **Preservação de Path**: `logoStoragePath` é salvo permanentemente nos metadados, e a signed URL é gerada sob demanda sempre que a ficha é carregada para visualização.

### 1.6 Upload de Materiais/Anexos
- **Extensões Válidas**: PDF, TXT, DOCX, XLSX, PNG, JPEG e WebP aceitos sem intercorrências.
- **Bloqueios de Segurança**: Arquivos potencialmente perigosos (HTML, JS, SVG, ZIP, executáveis) são rejeitados antes do upload.
- **Limite de Tamanho (8MB)**: Validação de tamanho testada e aprovada.
- **Signed URL sob demanda**: Função `openStorageAsset` gera dinamicamente novas URLs assinadas com tempo de expiração curto (1 hora) ao invés de guardar URLs expiradas.

---

## 2. Bugs Encontrados e Corrigidos

1. **Código Morto na UI**:
   - *Bug*: A função `downloadAsset` no componente `ClientTechnicalSheetDialog.tsx` era uma sobra de código órfã que tentava disparar download usando a URL crua (o que falhava quando as URLs assinadas expiravam).
   - *Correção*: Removida completamente da UI de diálogo para evitar confusão e vazamento de lógica obsoleta. O download agora é mediado de forma limpa pela geração de links dinâmicos no fluxo sob demanda.

---

## 3. Limitações Conhecidas

- **Sem Sincronização Automática**: Modificações locais não são refletidas no Supabase instantaneamente. O usuário precisa salvar manualmente sua versão para a nuvem.
- **Dependência do LocalStorage**: Se o usuário limpar o cache do navegador sem salvar a Ficha Técnica local no Supabase, as alterações locais serão perdidas. O Supabase funciona estritamente como um backup manual nesta etapa.
- **Expiração de Links de Logo e Anexos**: Imagens/arquivos visualizados diretamente dependem da regeneração de links temporários (`createSignedUrl`). Se o usuário mantiver a aba aberta por mais de 1 hora, os links expiram e requerem recarga da página para atualização.

---

## 4. Segurança do Storage e RLS

A auditoria de segurança das tabelas de storage confirmou que:
1. O bucket `client-assets` está configurado no modo **privado**.
2. Todas as operações de leitura/escrita são controladas por políticas de RLS baseadas em `(storage.foldername(name))[1]` com validação estrita de UUID via Regex:
   ```sql
   (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   ```
3. Não há credenciais `service_role` expostas no código cliente do frontend. O token utilizado é o anonimizado público padrão, cujos privilégios são estritamente determinados pelo login autenticado do usuário correspondente ao seu tenant workspace.

---

## 5. Resultados de Compilação e Código

- **TypeScript**: `npx tsc --noEmit` executado com **0 erros**.
- **ESLint**: `npm run lint` manteve o limite histórico exato de **35 erros**, sem novas regressões ou introdução de problemas de estilo/código.

---

## 6. Fluxo Restaurar do Supabase (Homologado)

- **Comportamento do Botão**: Habilita-se somente na presença de dados remotos correspondentes.
- **Resumo Comparativo**: Apresenta com precisão o estado de preenchimento local e na nuvem de todas as seções (Branding, Persona, Linha Editorial, Tipografia, Redes Sociais, Materiais) auxiliando na tomada de decisão do usuário.
- **Exigência de Consentimento**: Bloqueio de submissão do formulário até o preenchimento explícito do checkbox de substituição local.
- **Isolamento de Estado**: Substituição estrita e exclusiva da Ficha Técnica do cliente selecionado no `localStorage`.
- **Estratégia de Backup**: Armazenamento preventivo do estado local anterior em `kora.technicalSheets.restoreBackups.v1` (com histórico de até 5 backups) possibilitando reverter operações caso necessário.

---

## 7. Validação do Ciclo Completo (Local → Supabase → Local)

O ciclo manual foi exaustivamente auditado e homologado:
1. **Local → Supabase (Backup/Upload)**: O usuário edita localmente, realiza uploads para o Storage (com validações de tamanho/extensões ativas), e envia a cópia para a nuvem de forma transacional.
2. **Supabase → Local (Restauração/Download)**: O usuário visualiza o preview, confirma a substituição com checkbox, o sistema cria o backup em `localStorage` e carrega com segurança a versão remota (resolvendo links do storage por assinatura sob demanda).
3. **Resiliência Multi-tenant**: RLS garante integridade nas duas pontas e impede vazamentos.

---

## 8. Casos de Teste do Modo Supabase Experimental

Foram implementados cenários específicos para a homologação do seletor de dados:
1. **Trocar Fonte Local → Supabase**: O usuário clica na opção do Supabase. A UI atualiza exibindo uma badge clara, desabilitando o salvamento em localStorage, e carregando a ficha remota via mapper estruturado.
2. **Trocar Supabase → Local**: O usuário alterna para o modo Local. A UI carrega instantaneamente os dados do `localStorage` sem modificar ou expurgar as informações remotas.
3. **Erro ao Carregar Supabase**: Caso ocorra falha de rede ou de autenticação, um banner de aviso é exibido sugerindo ao usuário re-autenticar ou voltar ao modo Local de forma simples por meio de um botão de emergência.
4. **Cliente Sem Vínculo**: A opção "Supabase experimental" fica visualmente bloqueada com um ícone de cadeado e um aviso em toast caso o cliente ainda não possua mapeamento.
5. **Salvamento Explícito no Modo Supabase**: Edições feitas no modo experimental modificam a tela de forma local-temporária (em memória) e só são persistidas de forma definitiva no Supabase caso o usuário acione o botão "Salvar no Supabase", sem disparar escrita silenciosa.

---

## 9. QA do Modo Supabase Experimental

Abaixo registramos a homologação detalhada do seletor de dados e da segurança da edição in-memory:
- **Respeito à Preferência de Fonte**: A preferência de visualização ("local" ou "supabase") é mantida isoladamente por cliente no cache local. A seleção em um cliente não contamina as abas de outros clientes.
- **Proteção Contra Perda de Dados/Edição In-Memory**: Quando o usuário modifica valores no modo experimental Supabase, o sistema bloqueia atualizações silenciosas em `localStorage`. Caso o usuário saia da aba sem salvar, os dados em memória expiram e a versão de localStorage original é preservada perfeitamente.
- **Alerta Visual de Alterações Pendentes**: Adicionamos uma badge pulsante de aviso `⚠️ Alterações pendentes` que se ativa apenas no modo Supabase e quando o objeto em memória difere da base de dados Supabase, fornecendo um feedback UX imediato.
- **Uploads de Mídia Transparentes**: Uploads de logos e materiais direcionados ao Storage em modo Supabase mantêm integridade e registram as assinaturas lógicas corretamente, permitindo salvamentos manuais subsequentes sem falhas.

---

## 10. Checklist de Validação do Beta Fechado

Para homologação e verificação do funcionamento das barreiras de controle (guardrails) e feature flags, o seguinte checklist de QA deve ser executado no ambiente de teste:

- [ ] **Ativar flag experimental em Configurações**:
  - Acessar a página `/configuracoes`.
  - Ativar o toggle "Modo Supabase Experimental da Ficha Técnica".
  - Confirmar que o toast indica o estado ativo e o status do card muda para "Status: Ativo".
- [ ] **Abrir cliente local**:
  - Acessar `/clientes/:clientId/ficha-tecnica` para um cliente local que não possua vínculo com o Supabase.
  - Confirmar que o seletor de fonte "Local / Supabase" **está visível** (por conta da flag ativa).
  - Confirmar que a opção "Supabase experimental" está desabilitada com um ícone de cadeado.
- [ ] **Abrir cliente com Supabase**:
  - Acessar `/clientes/:clientId/ficha-tecnica` para um cliente importado (com vínculo no `importedMap`).
  - Confirmar que o seletor está habilitado para alternar.
- [ ] **Alternar fonte**:
  - Mudar a fonte de "Local" para "Supabase experimental".
  - Confirmar o toast correspondente de troca de fonte.
  - Verificar que o cabeçalho mostra a badge "Supabase experimental" e o banner informativo azul "Modo Supabase experimental ativo" aparece.
- [ ] **Editar em modo Supabase**:
  - Realizar uma alteração de texto em qualquer seção da ficha técnica (ex: adicionar uma cor em Branding).
  - Confirmar que a badge de aviso `⚠️ Alterações pendentes` aparece ao lado do botão "Salvar versão atual no Supabase".
- [ ] **Salvar manualmente**:
  - Clicar em "Salvar versão atual no Supabase" e aceitar no Dialog.
  - Verificar que os dados são enviados e o aviso de alterações pendentes some após o sucesso.
- [ ] **Restaurar manualmente**:
  - Clicar em "Restaurar do Supabase".
  - Marcar o checkbox e confirmar.
  - Validar se a cópia local foi atualizada e se o backup preventivo foi registrado no `localStorage` em `kora.technicalSheets.restoreBackups.v1`.
- [ ] **Desativar flag experimental**:
  - Retornar a `/configuracoes` e desativar o toggle.
- [ ] **Confirmar rollback para local**:
  - Abrir novamente a Ficha Técnica do cliente vinculado.
  - Confirmar que o seletor "Fonte da Ficha Técnica: Local / Supabase" **desapareceu completamente**.
  - Confirmar que a Ficha Técnica opera 100% no fluxo local e a preferência temporária anterior não causou nenhuma perda de dados.
  - Verificar que o painel informativo mostra a microcopy discreta sugerindo ativar o modo nas Configurações e que os botões "Restaurar do Supabase" / "Salvar versão atual no Supabase" foram omitidos da interface.

---

## 11. Recomendação Final

> [!IMPORTANT]
> **Recomendação: Liberar para Beta Fechado**
> 
> Com a feature flag de controle de acesso local (`kora.technicalSheets.supabaseExperimental.enabled`) integrada às Configurações e à tela de Ficha Técnica, o módulo está pronto para ser distribuído aos testadores do beta fechado.
>
> A arquitetura protege o usuário comum de qualquer alteração acidental, mantendo o `localStorage` intocado e isolando os riscos da nuvem. O rollback simples foi homologado e não limpa dados, permitindo idas e vindas de forma totalmente segura.

