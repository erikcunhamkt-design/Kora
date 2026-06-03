## Diagnóstico — por que o bot não atende hoje

Confirmei direto no banco:

- A instância UAZAPI está `connected` (workspace `2dc45e1a…`).
- `whatsapp_bot_settings.is_active = true` para esse workspace.
- `workspace_ai_credentials` tem Vertex ativo (`gemini-2.0-flash-001`).
- O webhook recebe mensagens e dispara `whatsapp-bot-reply` (linhas 582-604 de `whatsapp-webhook/index.ts`).

**Causa raiz nº 1 (bloqueante):** `whatsapp-bot-reply` faz:

```ts
.from("whatsapp_conversations")
.select("*, whatsapp_instances!inner(instance_token, status)")
```

Mas **não existe foreign key** entre `whatsapp_conversations.instance_id` e `whatsapp_instances.id` (confirmado em `pg_constraint`). Sem FK, o PostgREST não consegue embutir o relacionamento e a query falha → `conv` vem `null` → função retorna `"conversation not found"` e nunca envia.

**Causa raiz nº 2 (latente):** a migration de segurança recente removeu o SELECT em nível de tabela de `whatsapp_instances` para `authenticated`. Service-role ainda tem ALL, então o webhook/bot funcionam — mas só depois de corrigir o embed.

**Causa raiz nº 3 (qualidade):** o bot dispara para QUALQUER inbound de texto, sem regras de pausa (humano assumiu, opt-out, horário, fora-de-escopo), o que pode gerar respostas indesejadas quando começar a funcionar.

---

## Plano

### 1. Adicionar a foreign key faltante (migration)

```sql
ALTER TABLE public.whatsapp_conversations
  ADD CONSTRAINT whatsapp_conversations_instance_id_fkey
  FOREIGN KEY (instance_id) REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE;

ALTER TABLE public.whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_instance_id_fkey
  FOREIGN KEY (instance_id) REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE;

ALTER TABLE public.whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_conversation_id_fkey
  FOREIGN KEY (conversation_id) REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE;
```

Antes, fazer um `UPDATE … SET instance_id = NULL` para linhas órfãs (se houver) ou deletar — vou verificar primeiro.

### 2. Refatorar `whatsapp-bot-reply` para não depender do embed

Mesmo com FK, é mais robusto buscar a instância em duas queries (compatível com Service Role e fácil de logar):

```ts
const { data: conv } = await admin
  .from("whatsapp_conversations").select("*").eq("id", conversationId).maybeSingle();
const { data: inst } = await admin
  .from("whatsapp_instances")
  .select("id, instance_token, status")
  .eq("id", conv.instance_id).maybeSingle();
```

Adicionar logs claros em cada `skipped` para debugar via Edge Function Logs.

### 3. Guardrails de atendimento

No `whatsapp-bot-reply`, antes de responder, pular se:

- `conv.assigned_to != null` (humano já assumiu) — já existe.
- Existe nota interna recente com tag `pause-bot` (opcional, fase 2).
- Contato está em `whatsapp_opt_outs` para o workspace.
- A última mensagem outbound foi enviada nos últimos 5s (debounce).
- O texto inbound é vazio ou começa com `/` (comandos manuais).

### 4. UI — controle por conversa no inbox

Adicionar um toggle "🤖 Bot ativo" no header de cada conversa em `WhatsAppInbox` que escreve em `whatsapp_conversations.assigned_to`:

- Botão **"Assumir conversa"** → seta `assigned_to = auth.uid()` (bot para de responder).
- Botão **"Devolver ao bot"** → seta `assigned_to = NULL`.

Indicador visual no card da conversa quando o bot estiver respondendo (badge "Bot").

### 5. Configuração visível do bot

Em `WhatsAppSection`/automações, mostrar:

- Status (ativo/inativo) e provedor em uso (Vertex vs Lovable AI).
- Editor do `system_instruction`.
- Botão **"Testar resposta"** que chama a função com um conversationId fake e mostra o output, sem enviar para o WhatsApp.

### 6. Validação end-to-end

1. Aplicar migration.
2. Deploy de `whatsapp-bot-reply` refatorado.
3. Enviar mensagem real do celular → checar logs de `whatsapp-webhook` e `whatsapp-bot-reply`.
4. Confirmar mensagem outbound em `whatsapp_messages` e chegada no WhatsApp do contato.

---

## Detalhes técnicos

- Arquivos tocados:
  - `supabase/migrations/<nova>.sql` (FKs)
  - `supabase/functions/whatsapp-bot-reply/index.ts` (refator + guardrails + logs)
  - `src/pages/WhatsApp.tsx` / componentes do inbox (toggle bot, badge)
  - `src/components/automacoes/WhatsAppSection.tsx` (botão Testar)
- Sem novas dependências, sem novos secrets (Vertex e Lovable AI já configurados).
- Sem mudanças de schema além das 3 FKs.
- Riscos: a FK pode falhar se houver linhas em `whatsapp_conversations` apontando para `instance_id` inexistente — vou checar e limpar antes de aplicar.

Confirma para eu seguir?
