# Supabase Storage V1 - Upload de Logo

Este documento descreve as definições do bucket de armazenamento de arquivos privados, regras de segurança RLS aplicadas, lógica do serviço, comportamento na interface de usuário e resultados da auditoria de segurança da V1.

## Bucket Criado
- **Nome**: `client-assets`
- **Privacidade**: Privado (arquivos não são acessíveis por URLs públicas estáticas).
- **Limite de Tamanho**: 2MB (2.097.152 bytes) por arquivo.
- **Tipos de Arquivos Permitidos**: `image/png`, `image/jpeg`, `image/webp`. O formato `image/svg+xml` está desabilitado por razões de segurança.

## Estrutura de Diretórios (Paths)
Os arquivos do bucket são organizados de forma isolada por workspace e cliente:
`{workspaceId}/{clientId}/technical-sheet/logo/{timestamp}-{randomSeed}.{extension}`

Exemplo prático:
`3b3a9876-0f72-4cf0-888e-b810d65a8df2/142/technical-sheet/logo/1717015401928-a4f5b2z.png`

## Policies de Segurança e Auditoria RLS
Durante a auditoria técnica, as policies em `storage.objects` foram endurecidas (hardened) no arquivo de migração [20260530040000_harden_storage_policies.sql](../../../supabase/migrations/20260530040000_harden_storage_policies.sql) para evitar potenciais exceções de execução na conversão de string para UUID.

### Extração Segura do `workspaceId`
- O `workspaceId` é extraído do primeiro segmento da lista de diretórios do caminho do objeto utilizando o método `storage.foldername(name)`.
- **Risco Mitigado**: Realizar `::uuid` em caminhos inválidos ou arquivos na raiz do bucket causaria erros catastróficos no banco de dados. Adicionamos uma validação por Regex (`~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'`) e checagem de tamanho do array para garantir que o cast para UUID ocorra com segurança.

### Políticas de Acesso
```sql
CREATE POLICY "Allow workspace members to read client assets"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-assets'
  AND array_length(storage.foldername(name), 1) >= 1
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);
```
*(Políticas equivalentes aplicadas a INSERT, UPDATE e DELETE).*

## Serviço de Armazenamento (`clientAssetsStorage`)
O arquivo [clientAssetsStorage.ts](../../../src/services/storage/clientAssetsStorage.ts) encapsula as operações TypeScript de maneira limpa (sem tipagens genéricas `any`, sem chaves `service_role` e limitando arquivos a 2MB e extensões a PNG/JPEG/WebP).

## Tratamento de URL Assinada e Caminhos
- **Limitação**: As URLs assinadas (Signed URLs) geradas pelo Supabase expiram em 1 hora. Se salvas diretamente no `localStorage` sob o campo `logoUrl`, elas deixarão de exibir o preview de imagem após a expiração.
- **Tratamento de Hardening**: Adicionamos o campo opcional `logoStoragePath` no tipo `ClientBranding` e salvamos o caminho do objeto remoto no `localStorage`.
- **Recomendação Futura**: Antes de expandir o Storage para outros Materiais e Anexos, recomenda-se criar uma rotina de carregamento dinâmica que use o `logoStoragePath` para renovar/requisitar a Signed URL sob demanda em tempo de carregamento da Ficha Técnica.
