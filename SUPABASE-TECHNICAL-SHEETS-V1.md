# Infraestrutura e Migração de Fichas Técnicas (V1)

Este documento detalha o schema do banco de dados e o funcionamento da importação assistida de Fichas Técnicas (`technicalSheet`) dos clientes locais do `localStorage` para a nuvem (Supabase).

## Migration SQL e Tabela

A tabela `public.client_technical_sheets` foi criada por meio da migração SQL no arquivo [20260530020000_create_client_technical_sheets.sql](file:///C:/Users/erikw/.gemini/antigravity/scratch/orbit-designer-hub/supabase/migrations/20260530020000_create_client_technical_sheets.sql).

### Modelagem da Tabela
A tabela armazena de forma estruturada as sub-seções da Ficha Técnica utilizando o tipo de dados `jsonb` do PostgreSQL:
- `id` (uuid, chave primária)
- `workspace_id` (uuid, relacionamento cascade com workspaces)
- `client_id` (uuid, relacionamento cascade com clients, chave única de 1-para-1)
- `branding` (jsonb contendo cores, slogan, voz e notas de marca)
- `persona` (jsonb contendo dores, desejos, objeções e comportamento)
- `editorial` (jsonb contendo linhas editoriais, frequências e notas)
- `typography` (jsonb contendo fontes e links)
- `social_links` (jsonb contendo endereços de Instagram, Youtube, etc.)
- `briefing` (jsonb contendo briefing geral e notas adicionais)
- `materials` (jsonb contendo referências de links externos e assets não-binários)
- `raw_payload` (jsonb contendo o objeto original completo exportado do cliente local para integridade)
- `created_at` / `updated_at` (carimbos de data e hora gerenciados com trigger)

### Segurança e RLS
- **RLS Ativada**: Políticas de SELECT, INSERT, UPDATE, DELETE verificam o workspace de destino.
- **Função Utilizada**: `public.is_workspace_member(workspace_id)` garante que apenas membros autenticados do workspace possam ler/gravar as fichas técnicas.

## Mapeamento e Importador Assistido

O processo é centralizado no hook [useLocalTechnicalSheetsImport.ts](file:///C:/Users/erikw/.gemini/antigravity/scratch/orbit-designer-hub/src/hooks/useLocalTechnicalSheetsImport.ts):
1. **Verificação de dependência**: Só é possível importar a ficha técnica de um cliente que já tenha sido importado para o Supabase e que possua uma entrada no `importedMap` do `localStorage` sob a chave `kora.clients.supabaseImport.v1`.
2. **Ignorar binários**: Como não usamos Storage nesta fase, imagens em formato de arquivo local ou em formato base64/dataURL são ignoradas, migrando apenas referências a links públicos normais.
3. **Metadados locais**: Gravamos o status em `kora.technicalSheets.supabaseImport.v1` contendo:
   - `lastImportedAt`: carimbo da última migração.
   - `importedLocalClientIds`: lista de IDs locais já migrados.
   - `importedMap`: mapeamento `localClientId -> supabaseTechnicalSheetId` (ID da ficha no Supabase).

## Leitura Experimental da Ficha Técnica no Supabase

Implementamos uma camada experimental somente leitura diretamente na página do cliente (`/clientes/:clientId/ficha-tecnica`) para verificar a integridade da migração de dados estruturados para o Supabase:

1. **Uso do `importedMap`**:
   - A página recebe o `clientId` local.
   - O hook `useSupabaseTechnicalSheet` lê a chave do `localStorage` `kora.clients.supabaseImport.v1` e obtém o `importedMap`.
   - Se houver `supabaseClientId` mapeado para o cliente correspondente, a busca é disparada na tabela `client_technical_sheets` do Supabase utilizando o `clientTechnicalSheetsRepository`.
2. **Painel "Versão Supabase"**:
   - Renderiza no topo da página uma visão clara e consolidada da Ficha Técnica na nuvem.
   - **Estados da UI**:
     - *Sem vínculo*: Mostra quando o cliente local ainda não foi sincronizado para o Supabase.
     - *Carregando*: Feedback visual de carregamento.
     - *Erro*: Oferece mensagem de erro com botão de re-tentativa.
     - *Sem ficha no Supabase*: O cliente está cadastrado no Supabase, mas a ficha técnica ainda não foi importada.
     - *Ficha encontrada*: Exibe um indicador visual (Preenchido/Vazio) para cada módulo (Branding, Persona, Linha Editorial, Tipografia, Redes Sociais, Materiais) e a data/hora exata da última atualização.

## Salvamento Manual da Ficha Técnica no Supabase

Adicionamos a capacidade de enviar explicitamente a Ficha Técnica local do cliente para o Supabase:

1. **Botão de Ação**: Localizado no painel "Versão Supabase", habilitado somente se houver um workspace ativo, o cliente estiver vinculado ao Supabase e houver dados locais preenchidos na Ficha Técnica.
2. **Confirmação por Dialog**: Um `AlertDialog` é apresentado ao usuário antes do envio confirmando que a versão local será enviada como backup/cópia estruturada na nuvem.
3. **Mapper Centralizado**: O mapper `mapLocalToSupabaseSheet` em [technicalSheetMapper.ts](file:///C:/Users/erikw/.gemini/antigravity/scratch/orbit-designer-hub/src/services/technicalSheets/technicalSheetMapper.ts) é compartilhado entre o importador assistido e o salvamento manual:
   - Higieniza e filtra arquivos binários, dataURL ou base64 do campo `materials`.
   - Limpa imagens locais do `raw_payload` para evitar inchar o payload JSON.
4. **Atualização**: Ao salvar, o painel recarrega os dados imediatamente, atualizando o indicador visual de preenchimento e a data da última atualização (`updated_at`).

## Restauração Manual do Supabase (localStorage Fallback)

Implementamos a funcionalidade de restaurar a Ficha Técnica gravada no Supabase de volta para o armazenamento local (`localStorage`), agindo como uma recuperação manual e explícita contra perdas:

1. **Botão "Restaurar do Supabase"**: Fica visível e ativo no painel se houver uma Ficha Técnica correspondente salva na nuvem.
2. **Preview Comparativo**: Apresenta uma visão lado a lado detalhando quais seções estão preenchidas no local e na nuvem, indicando também o número de materiais e arquivos.
3. **Confirmação Obrigatória**: Exige que o usuário marque ativamente um checkbox atestando que entende que a versão local atual da Ficha Técnica será substituída.
4. **Backup Preventivo Local**: Antes de sobrescrever o estado local do cliente, o sistema salva o estado anterior no `localStorage` sob a chave `kora.technicalSheets.restoreBackups.v1` (guardando até os últimos 5 backups do usuário para fins de rollback ou auditoria futura).
5. **Conversor Seguro (Mapper Local)**: O mapper `mapSupabaseToLocalSheet` em [supabaseTechnicalSheetToLocalMapper.ts](file:///C:/Users/erikw/.gemini/antigravity/scratch/orbit-designer-hub/src/services/technicalSheets/supabaseTechnicalSheetToLocalMapper.ts) reconstrói a Ficha Técnica de volta ao padrão local, preservando os caminhos lógicos do storage (`storagePath`, sizes, mimeTypes) e filtrando imagens binárias grandes/expiradas.

## Modo Supabase Experimental (Beta Fechado)

Introduzimos um seletor no topo da Ficha Técnica e uma feature flag local para habilitar/desabilitar o Modo Supabase Experimental da Ficha Técnica de forma controlada.

### 1. Feature Flag de Beta Fechado
- **Chave no localStorage**: `kora.technicalSheets.supabaseExperimental.enabled`
- **Valor padrão**: `true` no ambiente atual (para fins de testes/homologação de beta fechado).
- **Controle de Interface**: 
  - Um toggle controlável é fornecido na página de **Configurações** na seção "Modo Supabase Experimental da Ficha Técnica".
  - Se a flag for desativada, a interface esconde completamente o seletor Local/Supabase e mantém a Ficha Técnica 100% baseada no fluxo local. O painel Informativo do Supabase passa a exibir uma microcopy discreta e os botões de ação (Salvar/Restaurar) são omitidos.

### 2. Seletor de Fonte e Comportamento Operacional
- **Seletor de Fonte**: Salva a preferência por cliente no `localStorage` sob a chave `kora.technicalSheets.dataSource.v1` no formato `{[clientId]: "local" | "supabase"}`.
- **Diferenças Operacionais (com flag ativada)**:
  - **Modo Local**: Lê e edita diretamente no `localStorage`. Sincronização e restauração continuam manuais e sob demanda por botões.
  - **Modo Supabase Experimental**: Busca os dados estruturados no banco do Supabase, hidrata a tela usando o mapper reverso, e bloqueia o `autosave` local. Qualquer edição feita neste modo é in-memory até que o usuário clique explicitamente no botão de **Salvar no Supabase** para efetivar as alterações remotamente.
- **Proteção contra Sobrescritas Silenciosas**: Alternar entre fontes apenas muda a visualização temporária na UI, sem disparar gravações automáticas e sem apagar dados locais ou remotos.
- **Indicador de Alterações Pendentes**: Quando modificado em modo Supabase, um badge de aviso pulsante `Alterações pendentes` alerta o usuário de que as edições precisam ser salvas manualmente no banco.

### 3. Comportamento de Rollback Simples
- Se o usuário desativar a flag experimental (seja nas configurações ou alterando manualmente):
  - A fonte da ficha é rebaixada automaticamente para **Local**.
  - As preferências salvas anteriormente em cache não são apagadas.
  - **Absolutamente nenhum dado** do Supabase ou do `localStorage` é apagado ou expurgado. Os dados continuam íntegros em ambas as pontas.

## Restrições e Limitações Atuais
- **Ausência de Autosync**: Não há gravação em tempo real no Supabase. Edições no modo experimental exigem clique manual para persistir.
- **Sem Modificação da Fonte Padrão**: O modo padrão da aplicação permanece Local. A transição transparente/gravação dupla automática não foi implementada para resiliência no beta.
- **Cache de Storage**: As assinaturas das URLs de visualização expiram após 1 hora e dependem da chave simbólica `storagePath` para regeneração sob demanda.

## Próximos Passos
1. Coletar feedbacks do beta fechado para refinar o tratamento de conflitos offline e de sincronização.
2. Habilitar sincronização automática (autosave) diretamente no Supabase em segundo plano.
3. Promover o Supabase como fonte definitiva primária para todos os clientes ativos.
