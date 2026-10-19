# Varredura da classe "a UI gateia, o servidor aceita qualquer membro" (G60/G68) — gate de papel no servidor

> **Origem:** pedido do revisor na rodada do gate de papel da atribuição. **Escopo desta rodada:** corrigir **só a atribuição**
> (`assign_conversation`, `end_human_handover`); o resto está **listado aqui para o revisor decidir** (cada item precisa de ID e de
> decisão de produto). Nada abaixo da §2 foi alterado. Ver também
> [`etapa-9-handover-assigned-to-proposta.md`](../architecture/etapa-9-handover-assigned-to-proposta.md) §11.4.

## 1. O que foi corrigido (atribuição)

| Ação | Antes | Agora |
|---|---|---|
| `assign_conversation` | qualquer membro (inclusive `viewer`) atribuía qualquer conversa a qualquer pessoa; a UI só mostrava o controle a admin | **owner/admin** → atribuem a qualquer elegível e removem qualquer atribuição; **member** → só atribui **a si mesmo** ou remove **a própria**; **viewer** (ou papel desconhecido) → **403**. Mesma `isAssignableRole` do resto do servidor; negação com `reason` + mensagem honesta |
| `end_human_handover` | qualquer membro (inclusive `viewer`) | **owner/admin/member** devolvem; **viewer → 403**. Justificativa: devolver **não atribui a ninguém** — encerra o handover e desfaz só o que o próprio sistema fez (a atribuição automática); atribuição manual nunca é tocada. UI: o botão "Devolver ao robô" some para `viewer` |

Referência de padrão: `whatsapp-official-credentials` (`isAdmin = role in (owner, admin)` → `403 "Admin role required"`), que já fazia isso.

## 2. A classe em si — duas famílias diferentes

A pergunta era "UI gateia por admin, servidor aceita qualquer membro". A varredura achou que **só existia um caso** desse tipo (a atribuição, corrigida acima). Todo o resto do que a UI gateia por admin **já é imposto no servidor**:

| Superfície com gate de UI de admin | Quem impõe no servidor |
|---|---|
| Config do robô (`WhatsAppBotConfig` → `whatsapp_bot_settings`) | RLS: escrita só `is_workspace_admin` (G71, **aplicada** em 2026-08-30). *SELECT segue member-level (conforme o próprio espelho da migration).* |
| Credenciais Vertex AI (`VertexAIConnectionCard`) | RLS — o card trata o `42501` ("não-admin"), mesmo pacote G71 |
| Credenciais WhatsApp oficial (`OfficialWhatsAppCard`) | `whatsapp-official-credentials`: `upsert`/demais ações exigem `isAdmin` (403). **Obs.:** a ação `get` é member-level e devolve `verify_token` (não o `access_token`; `app_secret` só como booleano) |
| Base de conhecimento (`AiKnowledgeSection` → `ai_knowledge_consents`) | RLS do DRAFT da 3ª migration do pacote 8-b: INSERT/UPDATE só `is_workspace_admin` (**ainda não aplicada**) |

A **segunda família** é pior: **ninguém gateia, nem a UI nem o servidor** — o papel `viewer` ("somente leitura") não é respeitado em lugar nenhum de `whatsapp-instance`.

## 3. `whatsapp-instance` — as 24 ações (hoje: só "é membro do workspace")

| Ação | O que faz | UI chama de | Gate na UI | Gate no servidor (hoje) | Proposta (para decisão) |
|---|---|---|---|---|---|
| `create` / `connect` | cria a instância no uazapi / gera QR | `useWhatsAppInstance` | nenhum | membro | **owner/admin** |
| `set_webhook` | reconfigura o webhook da instância | `WhatsApp.tsx`, `automacoes/WhatsAppSection` | nenhum | membro | **owner/admin** |
| `disconnect` | derruba a sessão do número | `useWhatsAppInstance` | nenhum | membro | **owner/admin** |
| `delete` | **apaga a instância** (uazapi + linha) | `useWhatsAppInstance` | nenhum | membro | **owner/admin** |
| `import` | importa instância existente **a partir de um token** (credencial) | `useWhatsAppInstance` | nenhum | membro | **owner/admin** |
| `sync` / `refresh_avatars` | puxa chats/avatares do uazapi | `WhatsApp.tsx`, `WhatsAppSection` | nenhum | membro | member+ (viewer 403) |
| `send` / `send_media` / `forward_message` | **manda mensagem a um cliente** | `WhatsApp.tsx`, `WhatsAppSection` | nenhum | membro | member+ (viewer 403) |
| `react_message` / `pin_message` / `delete_message` / `archive_conversation` / `mark_unread` / `update_conversation_tags` / `toggle_favorite_sticker` | escrita operacional | `WhatsApp.tsx`, `WhatsAppMessageBubble`, `WhatsAppStickerPicker` | nenhum | membro | member+ (viewer 403) |
| `status` / `load_messages` / `download_media` / `list_favorite_stickers` / `list_attendants` | leitura | vários | — | membro | membro (inclui viewer) |
| `assign_conversation` / `end_human_handover` | atribuição / devolução | painel de contato / banner | admin (controle) / todos (botão) | **✔ corrigido (§1)** | — |

Em português claro: hoje um `viewer` consegue **desconectar e apagar o WhatsApp do workspace, importar outro número por token e mandar mensagens a clientes** — não há gate de papel na UI dessas telas nem no servidor (a única checagem é "é membro"). *Não verifiquei se alguma rota/guard impede o `viewer` de abrir a página do WhatsApp; se houver, o risco pela tela cai, mas a chamada direta continua aberta.*

## 4. Achado de fundo: a RLS é de nível "membro" nas tabelas `whatsapp_*`

`whatsapp_instances`, `whatsapp_conversations` e `whatsapp_messages` têm policies de INSERT/UPDATE/DELETE com `is_workspace_member(workspace_id)` (migration `20260602004057`, sem alteração posterior). Consequências:

- Um gate **só no edge function** (como o desta rodada) fecha a rota oficial, mas **não** uma escrita direta pelo PostgREST: um `viewer` com o token do próprio usuário ainda consegue `supabase.from("whatsapp_conversations").update({ assigned_to })` ou `supabase.from("whatsapp_instances").delete()`.
- Fechar de verdade é **DDL** (policies de escrita por `is_workspace_admin`/papel que atende) — pacote do operador §8-b, nunca aplicado pelo Code. Para `whatsapp_conversations` há um agravante: `assigned_to` (e, quando as migrations do pacote 8-b forem aplicadas, `assignment_origin` e `handover_at`) são colunas de decisão do atendimento, graváveis por esse mesmo UPDATE direto.

## 5. Outras observações (baixo risco, para registro)

- `whatsapp-bot-reply` em modo simulador (`isTest`): exige JWT de **membro** (não de admin) e consome IA paga do workspace; o simulador mora na tela do Robô IA. A quota por workspace (G5) limita o dano. Decidir se o simulador deve exigir admin.
- `whatsapp-official-credentials` `get`: ver §2 (`verify_token` a qualquer membro).

## 6. Fatiamento sugerido (IDs a pedir ao revisor)

1. **Instância (owner/admin):** `create`, `connect`, `set_webhook`, `disconnect`, `delete`, `import` → gate de servidor + UI (esconder/desabilitar para não-admin). *Maior risco, menor custo.*
2. **Viewer somente-leitura:** `viewer` → 403 em todas as escritas operacionais (`send*`, `forward`, `react`, `pin`, `delete_message`, `archive`, `mark_unread`, `tags`, `toggle_favorite_sticker`, `sync`, `refresh_avatars`) e na UI (composer/ações).
3. **RLS das tabelas `whatsapp_*`** (DDL, §8-b do operador): escrita por papel — única forma de fechar o bypass direto.
4. **Simulador do robô / `get` das credenciais oficiais:** decisão de produto (admin?).
