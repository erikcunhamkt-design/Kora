# Varredura da classe "a UI gateia, o servidor aceita qualquer membro" (G60/G68) — gate de papel no servidor

> **Status:** gate da **atribuição** em `main` (`3bb9a72`); **G103 fatias 1+2** (instância owner/admin + `viewer` somente-leitura +
> `get` das credenciais oficiais → admin) e a regra revisada do `member` **em `main` (`fd98bc7`)**, confirmação ao vivo pendente
> (pacote 8-b, passos 31–35). **G104** (RLS) = DRAFT, **não aplicado**. Ver
> [`etapa-9-handover-assigned-to-proposta.md`](../architecture/etapa-9-handover-assigned-to-proposta.md) §11.4–§11.5 e a 5ª migration em
> [`etapa-9-bot-pacote-operador-8b.md`](etapa-9-bot-pacote-operador-8b.md) §2.5.

## 1. A régua, em uma tabela

A tabela de papel mínimo por ação vive em **um** lugar do código — `supabase/functions/_shared/instanceRoles.ts` (`INSTANCE_ACTION_POLICY`) — e
é aplicada por **um gate central** em `whatsapp-instance`, **antes de qualquer efeito**. A UI (`src/lib/whatsapp/permissions.ts`) importa a mesma
tabela. A §3 abaixo é a versão em prosa e **é conferida por teste contra o código** (`instanceRolesWiring.test.ts`: cada ação do handler tem uma linha
aqui, com o mesmo papel mínimo que o código).

| Papel mínimo | Quem passa | Significa |
|---|---|---|
| `admin` | owner, admin | administrar a **instância** (credencial do número, webhook, vida da instância) |
| `member` | owner, admin, member | **escritas operacionais** (enviar, apagar mensagem, arquivar, tags, sincronizar, atribuir, devolver) |
| `viewer` | qualquer membro, inclusive `viewer` | **leitura** |

Negação = `403 { error: <mensagem em português>, reason, action }` — `role-requires-admin`, `role-read-only` (e, para a atribuição, o motivo específico).
Papel desconhecido nunca passa em `admin`/`member`. Ação fora da tabela passa e cai no "Unknown action" (400) do handler — o teste de fiação impede uma
ação nova sem linha na tabela.

## 2. A classe — duas famílias

1. **"UI gateia por admin, servidor aceita qualquer membro":** só existia um caso — a **atribuição** (corrigida em `3bb9a72`; `member` agora só atribui a si mesmo
   **e só com a conversa sem dono**, decisão 1 do revisor). Todo o resto que a UI gateia por admin **já é imposto no servidor**:

   | Superfície com gate de UI de admin | Quem impõe no servidor |
   |---|---|
   | Config do robô (`WhatsAppBotConfig` → `whatsapp_bot_settings`) | RLS: escrita só `is_workspace_admin` (G71, **aplicada** em 2026-08-30). *SELECT segue member-level (conforme o próprio espelho da migration).* |
   | Credenciais Vertex AI (`VertexAIConnectionCard`) | RLS — o card trata o `42501` ("não-admin"), mesmo pacote G71 |
   | Credenciais WhatsApp oficial (`OfficialWhatsAppCard`) | `whatsapp-official-credentials`: `upsert`/`verify`/`delete`/`set_active` exigiam admin; **`get` era member-level e devolvia o `verify_token`** → **agora também admin (decisão 2, G103)** |
   | Base de conhecimento (`AiKnowledgeSection` → `ai_knowledge_consents`) | RLS do DRAFT da 3ª migration do pacote 8-b: INSERT/UPDATE só `is_workspace_admin` (**ainda não aplicada**) |

2. **"Ninguém gateia, nem UI nem servidor":** o papel `viewer` não era respeitado em lugar nenhum de `whatsapp-instance`, e as ações de instância não exigiam
   admin — a única checagem era "é membro". **Corrigido na rodada G103** (fatias 1+2): ver a tabela abaixo.

## 3. `whatsapp-instance` — as 25 ações, com o papel mínimo

*Antes:* todas = "é membro". *(São 25 ações em 24 `if`: `create` e `connect` dividem um — relatórios anteriores diziam "24".)* *Agora:* a coluna **Papel mínimo**. "UI hoje" = o que a tela faz para quem não tem o papel.

| Ação | O que faz | UI chama de | UI para quem não tem o papel | Papel mínimo | Observação |
|---|---|---|---|---|---|
| `create` | cria a instância no uazapi | `useWhatsAppInstance` | `WhatsAppConnectionCard` esconde "Conectar" e mostra o aviso | `admin` | instância |
| `connect` | gera o QR / reconecta | `useWhatsAppInstance` | idem | `admin` | instância |
| `set_webhook` | reconfigura o webhook da instância | `WhatsApp.tsx` (verificação automática 1×/sessão) | a página **não dispara** para quem não é admin | `admin` | ver §5: a verificação só roda quando um admin abre a página |
| `disconnect` | derruba a sessão do número | `useWhatsAppInstance` | botão "Desconectar" escondido | `admin` | instância |
| `delete` | **apaga a instância** (uazapi + linha) | `useWhatsAppInstance` | botão "Remover conexão" escondido | `admin` | instância |
| `import` | importa instância existente **a partir de um token** (credencial) | `useWhatsAppInstance` | botão "Importar token" escondido | `admin` | instância |
| `status` | lê/atualiza o status da instância | `useWhatsAppInstance` | — | `viewer` | **o `qr_code` sai nulo para quem não é admin** |
| `load_messages` | carrega mensagens (cacheia no banco) | `useWhatsAppConversations` | — | `viewer` | leitura com cache de sistema |
| `download_media` | baixa mídia (cacheia `media_url`) | `WhatsAppMessageBubble` | — | `viewer` | leitura com cache de sistema |
| `list_favorite_stickers` | lista figurinhas favoritas | `WhatsAppStickerPicker` | — | `viewer` | leitura |
| `list_attendants` | lista id/nome/papel dos membros (nunca e-mail) | `useWorkspaceAttendants` | — | `viewer` | leitura |
| `sync` | puxa chats do uazapi | `WhatsApp.tsx` (sincronização automática) | a página **não dispara** para `viewer` | `member` | escrita operacional |
| `refresh_avatars` | puxa avatares | `WhatsApp.tsx` | a página **não dispara** para `viewer` | `member` | escrita operacional |
| `send` | **manda mensagem a um cliente** | `WhatsAppChatInput` | composer vira "Somente leitura" | `member` | escrita operacional |
| `send_media` | manda mídia/áudio/figurinha | `WhatsAppChatInput` | idem | `member` | escrita operacional |
| `forward_message` | encaminha mensagem | `WhatsAppMessageBubble` | barra de ações escondida | `member` | escrita operacional |
| `react_message` | reage a uma mensagem | `WhatsAppMessageBubble` | idem | `member` | escrita operacional |
| `pin_message` | fixa/desafixa mensagem | `WhatsAppMessageBubble` | idem | `member` | escrita operacional |
| `delete_message` | apaga mensagem | `WhatsAppMessageBubble` | idem | `member` | escrita operacional |
| `archive_conversation` | arquiva/desarquiva a conversa | `WhatsApp.tsx` (menu "Mais opções") | item escondido | `member` | escrita operacional |
| `mark_unread` | marca como não lida | `WhatsApp.tsx` (menu "Mais opções") | item escondido | `member` | escrita operacional |
| `update_conversation_tags` | edita as tags da conversa | `WhatsAppContactPanel` | tags sem "×" e sem campo de nova tag | `member` | escrita operacional |
| `toggle_favorite_sticker` | favorita/desfavorita figurinha | `WhatsAppMessageBubble` | estrela escondida | `member` | escrita operacional |
| `assign_conversation` | atribui/remove atribuição | `WhatsAppContactPanel` (G101) | só texto (sem Select) para não-admin | `member` | **régua fina:** admin qualquer; member só a si mesmo **com a conversa sem dono**, ou remove a própria; viewer 403 |
| `end_human_handover` | devolve a conversa ao robô | banner "Devolver ao robô" | botão escondido para `viewer` | `member` | quem atende devolve (devolver não atribui a ninguém); viewer 403 |

## 4. Achado de fundo: a RLS é de nível "membro" nas tabelas `whatsapp_*` → G104

`whatsapp_instances`, `whatsapp_conversations` e `whatsapp_messages` têm 12 policies (SELECT/INSERT/UPDATE/DELETE em cada) com `is_workspace_member(workspace_id)`
(migration `20260602004057`; nenhuma migration posterior do repositório as altera — o banco real pode divergir, conferir com o SELECT de prova do pacote). Consequências:

- Um gate **só no edge function** (como o desta rodada) fecha a rota oficial, mas **não** uma escrita direta pelo PostgREST: um `viewer` com o token do próprio
  usuário ainda consegue `supabase.from("whatsapp_conversations").update({ assigned_to })` ou `supabase.from("whatsapp_instances").delete()`.
- **Leitura:** o `instance_token` **não** é legível pelo navegador — a migration `20260603174051` faz `REVOKE SELECT` + `GRANT SELECT (colunas…)` por coluna **sem** o token.
  Mas o `qr_code` está na lista de colunas legíveis e o SELECT é member-level: redigir o QR no `status` não fecha a leitura direta da linha. Policy não filtra coluna; tirar o
  `qr_code` da lista de GRANT por coluna (ou servir o QR só por RPC/edge function a admin) é DDL de outro desenho — **resíduo registrado no G104, fora do draft**.
- **Escrita:** o mesmo `20260603174051` deixa `GRANT INSERT, UPDATE, DELETE ON whatsapp_instances TO authenticated` (tabela inteira, **incluindo `instance_token`**) e as policies de
  escrita são `is_workspace_member` — um membro (viewer incluso) pode, direto pelo PostgREST, **trocar o `instance_token`** (apontando a instância do workspace pra outra conta
  uazapi) ou apagar a linha. É exatamente o que o draft da 5ª migration fecha (escrita só admin).
- Fechar a **escrita** é DDL — **5ª migration do pacote 8-b (DRAFT, NÃO aplicada)**: `whatsapp_instances` escrita só admin; `whatsapp_conversations`/`whatsapp_messages`
  escrita só quem atende (owner/admin/member); `viewer` só SELECT. O service role (edge functions, webhook, `whatsapp-bot-reply`) ignora RLS e segue escrevendo.

## 5. Outras observações

- **Consequência assumida (webhook):** `set_webhook` passou a admin e a página só o dispara para admin. A verificação "uma vez por sessão" que qualquer membro disparava
  agora só roda quando um **admin** abre a página; um workspace em que só `member` abre a tela não a faz (o admin ou a ação "Reconectar" fazem).
- `whatsapp-bot-reply` em modo simulador (`isTest`): exige JWT de **membro** (não de admin) e consome IA paga do workspace; o simulador mora na tela do Robô IA. A quota por
  workspace (G5) limita o dano. Decidir se o simulador deve exigir admin — **fora desta rodada**.
- `WhatsAppSection` (`src/components/automacoes/WhatsAppSection.tsx`): **sem nenhuma referência** no `src/` (código morto, classe G84) — chamava `send`/`sync`/`set_webhook`.
  Não tocado.
- `WhatsAppConnectionCard`: o botão "Sincronizar conversas" só aparece com `showSync`, e ninguém passa `showSync` (ramo morto). Segue gateado por `canWrite`.

## 6. Fatiamento

| Fatia | Status |
|---|---|
| Atribuição: `assign_conversation` / `end_human_handover` | ✅ em `main` (`3bb9a72`) |
| **1.** Instância → owner/admin (`create`, `connect`, `set_webhook`, `disconnect`, `delete`, `import`) + UI | ✅ em `main` (`fd98bc7`) |
| **2.** `viewer` somente-leitura em todas as escritas operacionais + UI | ✅ em `main` (`fd98bc7`) |
| `member` só se atribui com `assigned_to IS NULL` (decisão 1) | ✅ implementada (branch G103) |
| `get` das credenciais oficiais → admin (decisão 2) | ✅ implementada (branch G103) |
| **3.** RLS de escrita das tabelas `whatsapp_*` (**G104**) | 🟡 DRAFT (5ª migration), **não aplicado** — só o operador (§8-b) |
| Simulador do robô → admin? | ⏳ decisão de produto |
