## Escopo

Implementar features premium na aba **Atendimento (WhatsApp)** sem nenhuma dependência de IA. Removidas do plano original: transcrição de áudio, resumo IA, sugestão de resposta, detecção de intenção e tradução automática.

Vou entregar em **4 fases** para você validar cada etapa antes da próxima. Cada fase é deployável e usável sozinha.

---

## Fase 1 — Painel lateral do contato + Ações rápidas

Layout vira **3 colunas**: lista | chat | painel do contato.

Painel lateral mostra:
- Foto, nome, telefone, copiar número
- Tags da conversa (editáveis inline)
- Responsável atribuído (membros do workspace)
- Cliente vinculado (busca em `clients`) — se ainda não existir, botão "Criar cliente"
- Orçamentos vinculados (`supabase_quotes` por client_id)
- Projetos ativos (`projects`)
- Financeiro em aberto (`finance_*`)
- Notas internas (textarea persistida)

**Ações rápidas** (botões no topo do painel):
- Criar orçamento (abre `CreateCrmSupabaseQuoteDialog` pré-preenchido)
- Criar briefing (abre `BriefingCreateDialog`)
- Agendar reunião (abre `ScheduleMeetingDialog`)
- Marcar como Lead → empurra para CRM (`crm_opportunities`)

---

## Fase 2 — Produtividade no chat

- **Respostas rápidas (`/snippets`)**: ao digitar `/` no input, abre popover com snippets do workspace. CRUD em Configurações. Variáveis `{{nome}}`, `{{telefone}}`.
- **Notas internas**: toggle no input ("Nota interna" vs "Mensagem"). Notas ficam no chat com fundo âmbar, não são enviadas pro WhatsApp.
- **Atribuição + SLA**: badge vermelho se conversa não respondida há +N horas (configurável). Filtro "Aguardando minha resposta".
- **Filtros salvos** na lista: Não lidas, Sem responsável, Com tag X, Aguardando resposta.
- **Atalhos de teclado**: `⌘K` busca, `⌘↵` envia, `J/K` navega, `E` arquiva, `/` abre snippets.

---

## Fase 3 — Performance + Polimento UI

- **Virtualização** da lista de conversas e mensagens (`@tanstack/react-virtual`) — escala pra milhares.
- **Skeleton loaders** substituem spinners.
- **Densidade ajustável** (compacto/confortável) salva no perfil.
- **Indicadores ricos**: digitando…, online, visto às (quando o webhook entregar — não inventar).
- **Reações com emoji** nas mensagens, **reply/quote**, **encaminhar**, **fixar mensagem** (uazapi suporta).
- **Busca global** em mensagens (`⌘K` → busca full-text em `whatsapp_messages.content`).

---

## Fase 4 — Insights (aba dentro de Atendimento)

Métricas por workspace/período:
- Tempo médio de primeira resposta
- Conversas abertas vs fechadas
- Volume por hora/dia (heatmap)
- Ranking por atendente
- Taxa de conversão: conversa → orçamento → cliente

Tudo via queries agregadas em `whatsapp_messages` + joins com `supabase_quotes`/`clients`. Sem IA.

---

## Banco de dados (migrations)

Fase 1:
- `whatsapp_conversation_tags` (workspace_id, conversation_id, tag, color)
- `whatsapp_conversation_assignments` (conversation_id, user_id, assigned_at)
- adicionar `client_id` (FK opcional) em `whatsapp_conversations`
- `whatsapp_internal_notes` (conversation_id, author_id, content, created_at)

Fase 2:
- `whatsapp_quick_replies` (workspace_id, shortcut, content, created_by)
- `whatsapp_inbox_settings` (workspace_id, sla_minutes, default_filter)

Fase 3:
- adicionar `reply_to_message_id`, `pinned_at`, `reactions jsonb` em `whatsapp_messages`
- índice full-text em `whatsapp_messages.content` (`tsvector`)

Todas com RLS via `is_workspace_member()` e GRANTs corretos.

---

## Edge function (`whatsapp-instance`)

Novas actions:
- `assign_conversation`, `set_tags`, `link_client`
- `add_note`, `list_notes`
- `send_reply` (com `quoted_message_id`), `react_message`, `pin_message`, `forward_message`
- `search_messages` (full-text)

---

## Decisão pedida

Confirma que posso começar pela **Fase 1** (painel lateral + ações rápidas)? Depois sigo nas próximas direto, sem precisar perguntar a cada uma — mas valido com você ao final de cada fase antes de mexer no banco da próxima.

Se preferir outra ordem (ex: começar pela Fase 2 que tem mais ganho de produtividade imediato), só dizer.