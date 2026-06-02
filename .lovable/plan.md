## Objetivo
Trazer o chat do WhatsApp para paridade básica de mídia: figurinhas (com favoritos), áudio (ouvir + enviar áudio gravado), fotos (visualizar em tela cheia + enviar) e documentos.

## 1. Backend — Edge Function `whatsapp-instance`
Novas actions:
- **`send_media`** — recebe `{ conversationId, kind: "image"|"video"|"audio"|"document"|"sticker", base64, mimeType, fileName?, caption? }`. Encaminha para uazapi `/send/media` (image/video/document) ou `/send/audio` (PTT) ou `/send/sticker`. Grava em `whatsapp_messages` com `type` correto, `media_url` (URL retornada pela uazapi quando disponível) e `content` (caption).
- **`toggle_favorite_sticker`** — `{ stickerUrl, mimeType?, action: "add"|"remove" }`. Insere/remove em `whatsapp_favorite_stickers`.
- **`list_favorite_stickers`** — retorna favoritos do workspace.

`load_messages` já extrai `stickerMessage.url`, então figurinhas recebidas aparecem assim que `refresh` rodar.

## 2. Banco — nova tabela
`whatsapp_favorite_stickers`:
- `workspace_id`, `sticker_url` (unique por workspace), `mime_type`, `created_by`, `created_at`
- RLS scoped por workspace (igual demais tabelas WA)

## 3. Frontend

### `WhatsAppMessageBubble.tsx`
- Imagem: clique abre **lightbox** (Dialog full-screen) em vez de nova aba, com zoom e download.
- Sticker: aumentar para 140px, hover mostra botão "⭐ Favoritar" (chama `toggle_favorite_sticker`).
- Áudio: já funciona; melhorar estilo (player escuro consistente).

### `WhatsAppChatInput.tsx`
Substituir botões "em breve" por funcionais:
- **Paperclip**: menu com "Foto/Vídeo", "Documento", "Figurinha" → abre `<input type=file>` filtrado. Lê em base64 e chama `send_media`.
- **Mic**: grava áudio via `MediaRecorder` (segurar para gravar / clicar para parar). Envia como `audio` (PTT).
- **Sticker picker**: popover lista figurinhas favoritas do workspace; clicar envia direto.

### Hook `useWhatsAppConversations`
Adicionar `sendMedia(conversationId, payload)` e `toggleFavoriteSticker`.

## 4. Pontos técnicos
- Tamanho máximo do upload: 10 MB (validar no frontend antes do base64).
- `MediaRecorder` grava em `audio/webm;codecs=opus`; uazapi `/send/audio` aceita; converter para base64 puro (sem prefixo data URL).
- Lightbox: usar `Dialog` do shadcn + `<img>` com `object-contain`, fechar com ESC.
- Realtime já está ligado em `whatsapp_messages` (INSERT/UPDATE), então mensagens enviadas aparecem na hora.

## Arquivos afetados
- `supabase/functions/whatsapp-instance/index.ts` (3 novas actions)
- nova migration `whatsapp_favorite_stickers`
- `src/components/whatsapp/WhatsAppMessageBubble.tsx`
- `src/components/whatsapp/WhatsAppChatInput.tsx`
- `src/hooks/useWhatsAppConversations.ts`
- novo `src/components/whatsapp/WhatsAppStickerPicker.tsx`
- novo `src/components/whatsapp/WhatsAppImageLightbox.tsx`
