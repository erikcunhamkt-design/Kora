
# Plano: Integração WhatsApp via uazapi

Hoje o app usa `useWhatsAppMock` (localStorage + dados demo) e a integração "WhatsApp Business" em `useIntegrations` é só um toggle. Vamos plugar o **uazapi** como provedor real, mantendo a UI atual de `WhatsAppSection`, `IntegrationsSection`, CRM e Central do Dia.

## 1. Arquitetura

```text
Frontend (React)
   │
   │ supabase.functions.invoke()
   ▼
Edge Functions (Deno)
   ├── whatsapp-instance      → cria/conecta/desconecta + QR code
   ├── whatsapp-status        → consulta estado da instância
   ├── whatsapp-send          → envia mensagem (texto, mídia, template)
   ├── whatsapp-conversations → lista chats + mensagens (proxy uazapi)
   └── whatsapp-webhook       → recebe eventos (mensagens, status) [verify_jwt=false]
            │
            ▼
       Supabase DB
   ├── whatsapp_instances (workspace_id, instance_token, subdomain, status, phone, qr_code)
   ├── whatsapp_conversations (workspace_id, instance_id, contact_phone, contact_name, status, tags, last_message_at)
   └── whatsapp_messages (conversation_id, direction, type, content, media_url, wa_message_id, status, created_at)
```

Todas as tabelas com **RLS por `workspace_id`** via `is_workspace_member()` (padrão já usado no projeto).

## 2. Secrets necessários (Lovable Cloud / Supabase)

- `UAZAPI_ADMIN_TOKEN` — token administrativo para criar instâncias
- `UAZAPI_SUBDOMAIN` — subdomínio padrão da conta uazapi (ex.: `free`, `meucliente`)
- `UAZAPI_WEBHOOK_SECRET` — segredo gerado por nós para validar webhooks

O **token de cada instância** (gerado pela uazapi por workspace) fica salvo em `whatsapp_instances.instance_token` (criptografado idealmente, mas servirá texto por enquanto já que está atrás de RLS + service_role nas funções).

## 3. Fluxo de conexão (UX)

1. Usuário entra em **Automações → WhatsApp** e clica **Conectar WhatsApp**.
2. Frontend chama `whatsapp-instance` (action: `create`) → edge function chama `POST /instance/init` na uazapi com `admintoken`, recebe `token` da instância, salva em `whatsapp_instances` e retorna **QR code** (`/instance/connect`).
3. Modal mostra o QR (atualiza a cada 5s via `whatsapp-status`).
4. Quando estado vira `connected`, salvamos `phone`, `phoneName`, `connectedAt`.
5. Botão **Desconectar** chama `/instance/disconnect`.

## 4. Envio de mensagens

`whatsapp-send` recebe `{ to, type, text|mediaUrl, conversationId? }`, chama `POST /send/text` ou `/send/media` da uazapi com o `token` da instância, grava em `whatsapp_messages` (direction=`outbound`, status=`sent`) e atualiza `last_message_at` da conversa.

Pontos de uso a substituir (hoje `wa.me` ou mock):
- **CRM** (`LeadActionsMenu`, `CRM.tsx` "Auto-lead WhatsApp")
- **Central do Dia** (lembrete de follow-up)
- **Orçamentos** (`QuotesSection` botão "Enviar por WhatsApp")
- **WhatsAppSection** (caixa de entrada real)

Manter `wa.me` como **fallback** quando a instância não estiver conectada.

## 5. Recebimento (webhook)

- `whatsapp-webhook` configurado como público (`verify_jwt = false`).
- Na criação da instância, registramos a URL `https://<project>.functions.supabase.co/whatsapp-webhook?secret=...` via `POST /webhook` da uazapi.
- A função valida o `secret`, faz upsert da conversa por `contact_phone + instance_id` e insere a mensagem (`direction=inbound`).
- Realtime do Supabase já notifica o front (subscription em `whatsapp_messages` por workspace).

## 6. Migração de banco

Criar 3 tabelas com GRANTs + RLS por workspace, índices em `(workspace_id, last_message_at)` e `(conversation_id, created_at)`. Sem FKs cruzadas (padrão do projeto).

## 7. Frontend — mudanças

- Novo hook `useWhatsApp()` (substitui gradualmente `useWhatsAppMock`) consumindo Supabase + Realtime.
- `WhatsAppSection`: modal de QR, status real, lista de conversas vindas do banco.
- `IntegrationsSection`: card "WhatsApp (uazapi)" passa a refletir status real da instância do workspace.
- Feature flag `whatsappProvider: 'uazapi' | 'mock'` em `useAppSettings` para rollout seguro.

## 8. Entregáveis por fase

1. **Fase A — Fundação** (1 PR): migração das 3 tabelas + secrets + edge function `whatsapp-instance` e `whatsapp-status` + modal de QR funcionando.
2. **Fase B — Envio** (1 PR): `whatsapp-send` + botão real no CRM e Orçamentos, mantendo `wa.me` como fallback.
3. **Fase C — Recebimento** (1 PR): `whatsapp-webhook` + inbox real em `WhatsAppSection` com Realtime.
4. **Fase D — Polimento**: templates rápidos, tags, vínculo automático conversa↔cliente/lead, métricas na Central do Dia.

## 9. Riscos

- **Banimento de número**: uazapi usa WhatsApp não-oficial → recomendar número Business dedicado.
- **Limite de instâncias** no plano uazapi (erro 429) → tratar e mostrar mensagem clara.
- **Webhook público**: proteger com `secret` na query + validação de payload.
- **Custo**: monitorar volume de mensagens; adicionar throttling na edge function.

## 10. Próximo passo

Se aprovar este plano eu começo pela **Fase A**: peço os 3 secrets (`UAZAPI_ADMIN_TOKEN`, `UAZAPI_SUBDOMAIN`, `UAZAPI_WEBHOOK_SECRET`), crio a migração das tabelas e a primeira edge function com o fluxo de QR code.

**Você já tem conta na uazapi e o `admintoken` em mãos, ou precisa que eu te oriente a criar primeiro?**
