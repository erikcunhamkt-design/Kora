## Objetivo
Permitir conectar o WhatsApp por **dois provedores** no card de Integrações:
1. **uazapi** (já existente — QR Code)
2. **WhatsApp Cloud API oficial (Meta)** — credenciais

O usuário escolhe o provedor, salva as credenciais e o atendimento (inbox/campanhas existentes) passa a funcionar com o provedor escolhido.

## UI (frontend)

Em `src/components/automacoes/IntegrationsSection.tsx`, substituir o `WhatsAppConnectionCard` único por um bloco com **Tabs**:

```text
┌─ Conexão WhatsApp ───────────────────────────┐
│  [ uazapi (QR Code) ] [ API Oficial (Meta) ] │
│                                              │
│  <conteúdo da aba ativa>                     │
└──────────────────────────────────────────────┘
```

- Aba **uazapi**: mantém `WhatsAppConnectionCard` atual sem mudanças.
- Aba **API Oficial**: novo `OfficialWhatsAppCard.tsx` com formulário:
  - Phone Number ID
  - WhatsApp Business Account ID (WABA ID)
  - Permanent Access Token (input password)
  - Verify Token (gerado automaticamente, com botão "copiar")
  - App Secret (opcional, para validar assinatura do webhook)
  - Status badge (não configurado / configurado / verificado)
  - Botão **Testar conexão** (chama edge function que faz `GET /v19.0/{phone_number_id}` na Graph API)
  - Botão **Salvar / Atualizar** e **Remover**
  - Bloco informativo com a **URL do Webhook** a configurar no Meta Developer Portal

Novo hook `src/hooks/useWhatsAppOfficial.ts` (CRUD via supabase) — segue o mesmo padrão de `useWhatsAppInstance`.

Apenas um provedor pode estar **ativo** por workspace por vez. Ao conectar/salvar um, o outro fica "inativo" (não é apagado). Indicador visual de "Provedor ativo: …" no topo do card.

## Backend (Supabase)

### Nova tabela `whatsapp_official_credentials`
Colunas: `id`, `workspace_id` (unique), `phone_number_id`, `waba_id`, `display_phone_number`, `access_token` (text, server-only via RLS), `verify_token`, `app_secret` (nullable), `status` (`not_configured` | `configured` | `verified`), `last_verified_at`, `created_at`, `updated_at`.

RLS:
- Workspace members: SELECT/INSERT/UPDATE/DELETE em linhas do próprio workspace.
- `access_token` e `app_secret` retornados pela API só para membros (não anon). Mesma postura das outras tabelas WhatsApp.

### Tabela `whatsapp_instances` (existente)
Adicionar coluna `provider` (`uazapi` | `official`, default `uazapi`) para registrar qual está ativo. Permite ao inbox/campanhas saberem por onde enviar.

### Edge functions

1. **`whatsapp-official-credentials`** (POST, autenticado)
   - actions: `get`, `upsert`, `delete`, `verify`
   - `verify`: chama `https://graph.facebook.com/v19.0/{phone_number_id}?fields=display_phone_number,verified_name` com o token salvo → atualiza `status=verified` e `display_phone_number`.

2. **`whatsapp-official-webhook`** (público, sem JWT)
   - `GET`: handshake do Meta — verifica `hub.verify_token` contra qualquer linha em `whatsapp_official_credentials` e responde `hub.challenge`.
   - `POST`: valida assinatura `X-Hub-Signature-256` se `app_secret` existir, identifica workspace pelo `phone_number_id` do payload, normaliza mensagens recebidas para as tabelas existentes `whatsapp_conversations` / `whatsapp_messages` (mesmo formato usado pelo `whatsapp-webhook` atual da uazapi).

3. **`whatsapp-official-send`** (POST, autenticado)
   - Body: `{ workspaceId, to, type, content }`
   - Envia via `POST https://graph.facebook.com/v19.0/{phone_number_id}/messages` com `Authorization: Bearer <access_token>`.
   - Persiste a mensagem em `whatsapp_messages` (provider=`official`).

O envio em outras partes do app (inbox, campanhas) passa a checar `whatsapp_instances.provider` e roteia para `whatsapp-official-send` quando for `official`, mantendo o resto da experiência igual.

## Segurança
- Tokens ficam **na tabela** (não como Supabase Secret), porque cada workspace tem o seu. RLS restringe leitura aos membros do workspace.
- Webhook valida `X-Hub-Signature-256` quando `app_secret` estiver definido.
- `access_token` nunca é exposto a `anon`; UI o trata como write-only (campo em branco no modo edição com placeholder "•••• salvo").

## Fora de escopo
- Sincronização de templates aprovados (HSM) da Meta — fica para depois.
- Migrar campanhas existentes — elas continuarão funcionando no provedor ativo escolhido.
