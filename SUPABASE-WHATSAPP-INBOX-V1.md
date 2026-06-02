# WhatsApp Inbox Foundation - Fase 1 & Stickers e Mídia Real V1

Este documento detalha o diagnóstico do vazamento de payloads JSON na interface, a modelagem de banco de dados ajustada, o funcionamento do normalizador de webhook e a especificação da renderização limpa das mensagens de chat, incluindo suporte completo para stickers/figurinhas WebP e mídias reais.

---

## 1. Problema Encontrado (JSON Bruto)
O backend da API do WhatsApp (uazapi/wuzapi) envia metadados de mensagens estruturados em estruturas JSON complexas, contendo propriedades como `url`, `mediaKey`, `fileSha256`, `mimeType`, `width`, `height`, etc., sob o objeto `message` (por exemplo, dentro de `imageMessage` ou `audioMessage`).
Como o webhook persistia a mensagem inteira diretamente no campo `content` e o frontend lia esse campo sem distinção, a interface renderizava o JSON bruto, resultando em uma péssima experiência visual e de usabilidade para o atendente.

---

## 2. Modelagem do Banco de Dados
Aproveitamos e complementamos a estrutura de banco de dados existente de maneira incremental, evitando qualquer duplicação de dados:

### Tabelas Existentes no Projeto
* `whatsapp_instances`: Gerenciamento das conexões de WhatsApp do uazapi.
* `whatsapp_conversations`: Tabela de cabeçalho das conversas.
* `whatsapp_messages`: Histórico de mensagens enviadas e recebidas.

### Modificações e Tabelas Novas (Incremental via Migração SQL)
Criamos a migração complementar `20260602030000_whatsapp_media.sql` para introduzir:

1. **Campos Adicionados em `whatsapp_messages`**:
   * `body`: O corpo textual limpo ou legenda da mídia.
   * `timestamp`: O horário real enviado pelo aparelho do contato.
   * `raw_payload` (jsonb): O payload bruto recebido da API de WhatsApp (mantido apenas para fins de auditoria, nunca exposto diretamente na interface).
   * `deleted_at`: Suporte a soft delete de mensagens.

2. **Nova Tabela `whatsapp_message_media`**:
   * Estruturada para guardar dados detalhados das mídias: `media_id`, `mime_type`, `file_name`, `file_size`, `sha256`, `storage_path` e `temporary_url`.
   * Possui RLS (Row Level Security) protegendo os registros por Workspace (`is_workspace_member`).

---

## 3. Stickers e Mídia Real V1
Na presente etapa, garantimos o suporte nativo e tratamento seguro das mensagens de mídias e stickers recebidos do WhatsApp:

### Como o Normalizador identifica cada tipo
* **Texto (`text`)**: Extrai texto limpo de `conversation` ou `extendedTextMessage.text`.
* **Imagem (`image`)**: Detecta o nó `imageMessage`, extrai a URL de download temporária e a legenda.
* **Áudio (`audio`)**: Detecta `audioMessage` ou `ptt`, extrai a URL e define o tipo como áudio.
* **Vídeo (`video`)**: Detecta `videoMessage`, extrai a URL e legenda.
* **Documento (`document`)**: Detecta `documentMessage`, extrai a URL, mime-type e nome do arquivo original.
* **Figurinha (`sticker`)**: Detecta `stickerMessage` ou tipo mime `image/webp`, definindo o tipo como `sticker` e extraindo a URL do arquivo de imagem WebP.

### Persistência das Mídias
* Ao processar o webhook, a Edge Function `whatsapp-webhook` cria o registro correspondente na tabela `whatsapp_messages`.
* Caso a mensagem contenha qualquer anexo ou mídia (imagem, áudio, vídeo, documento ou sticker), os metadados ricos correspondentes são salvos na tabela `whatsapp_message_media` e vinculados ao `message_id`.
* O payload bruto é salvo na íntegra em `raw_payload` apenas para auditoria técnica.

---

## 4. UI e Renderização Limpa
* O componente `<WhatsAppMessageBubble />` renderiza dinamicamente as figurinhas compactas (`h-28 w-28`) e mídias usando as URLs temporárias.
* A barra lateral de conversas agora exibe o avatar do contato, o horário formatado, e um preview textual limpo para mensagens de mídia (ex: "📷 Foto", "🧩 Figurinha" ou "📄 Documento" em vez do JSON bruto).

---

## 5. Limitações Atuais e Próximos Passos
* **Limitação de URLs Temporárias**: As URLs de mídias enviadas pela API do WhatsApp são temporárias e expiram após algumas horas.
* **Próximo Passo Recomendado**: Implementar o **Supabase Media Storage V1**, que fará o download físico dessas mídias no Supabase Storage Bucket do cliente assim que o webhook for recebido, gerando um link permanente e seguro para a Inbox.
