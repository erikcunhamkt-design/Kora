# Supabase Storage - Upload de Materiais e Anexos (V1)

Este documento detalha o funcionamento, regras de segurança RLS, serviços TypeScript, persistência e visualização dos materiais e anexos dos clientes no Supabase Storage.

## Tipos de Arquivos Permitidos
Para garantir a segurança do servidor e do cliente contra a execução de scripts maliciosos, apenas formatos de documentos estruturados e imagens comuns são aceitos:
- **Imagens**: `image/png`, `image/jpeg`, `image/webp` (SVG bloqueado).
- **Documentos**: `application/pdf`, `text/plain` (.txt), `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (.docx), `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (.xlsx).
- **Bloqueados**: SVG, HTML, JS, ZIP, arquivos executáveis e quaisquer extensões desconhecidas.

## Limites de Tamanho
- **Tamanho Máximo**: 8MB (8.388.608 bytes) por arquivo.

## Estrutura de Paths (Diretórios)
Os arquivos carregados são isolados por workspace e cliente no mesmo bucket privado `client-assets`:
`{workspaceId}/{clientId}/technical-sheet/materials/{timestamp}-{randomSeed}.{extension}`

Exemplo prático:
`3b3a9876-0f72-4cf0-888e-b810d65a8df2/142/technical-sheet/materials/1717015401928-a4f5b2z.pdf`

## Signed URL vs `storagePath`
- **`storagePath` (Caminho Permanente)**: Armazenado no banco de dados e no metadado local. Representa a localização lógica do arquivo no Storage do Supabase. É imutável e seguro.
- **Signed URL (URL Assinada Temporária)**: Uma URL pública temporária gerada pelo Supabase com tempo de expiração de 1 hora. É utilizada exclusivamente para renderizar visualizações ou downloads.
- **Visualização sob Demanda**: Resolvemos a expiração dos links assinados interceptando a ação de abertura. Quando o usuário clica em visualizar ou baixar o material, o sistema gera dinamicamente uma Signed URL atualizada através do `storagePath` e abre em uma nova aba de forma transparente.

## Comportamento na UI e Persistência
1. **Upload**: Box experimental na aba "Materiais e Anexos" permite enviar arquivos.
2. **Confirmação**: Após o upload bem-sucedido, o usuário escolhe:
   - *Apenas manter no Supabase*: O arquivo físico é mantido no Storage, mas sem referência local.
   - *Adicionar à Ficha Técnica local*: O material é registrado no `localStorage` sob o tipo `ClientAsset` com `source: "storage"`, armazenando o `storagePath` permanente, o tamanho, a extensão e a data do upload.
3. **Backup Completo**: Para registrar a referência do material no banco de dados Supabase definitivo, o usuário deve clicar no botão superior *"Salvar versão atual no Supabase"*.

## Próximos Passos
1. Implementar rotina de expurgo de mídias órfãs (arquivos no Storage sem correspondência em nenhuma Ficha Técnica).
2. Habilitar sincronização ativa da lista de materiais na Ficha Técnica no Supabase.
3. Permitir a exclusão de arquivos no Storage Supabase remoto quando o usuário deletar o material da Ficha Técnica.
