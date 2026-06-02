# KORA Hub — WhatsApp Campanhas Backend V1

Escopo grande: migrations Supabase + repositories + UI funcional para Audiências, Templates e Campanhas. Sem envio real (bloqueado por enquanto).

## 1. Migrations Supabase (1 migration única)

Criar 6 tabelas novas, todas com `workspace_id`, RLS via `is_workspace_member(workspace_id)`, GRANTs para `authenticated` e `service_role`, triggers `update_updated_at_column`:

- `whatsapp_audiences`
- `whatsapp_audience_contacts` (índices em `workspace_id`, `audience_id`, `normalized_phone`)
- `whatsapp_templates`
- `whatsapp_campaigns_v2` — **nota:** já existe `whatsapp_campaigns` com schema diferente em uso. Para evitar quebrar `WhatsAppCampaigns.tsx` antigo, criamos a nova como `whatsapp_campaigns_v2`. (Alternativa: renomear a antiga e adotar o novo schema — mais arriscado nesta fase.)
- `whatsapp_campaign_recipients`
- `whatsapp_opt_outs`

FKs `references public.clients(id)` e `public.whatsapp_conversations(id)` mantidas com `on delete set null`.

## 2. Utilitários frontend

- `src/lib/whatsapp/phone.ts` com `normalizeBrazilianPhone`, `isLikelyValidBrazilianPhone`, `formatPhoneBR`. Foco BR: remove não dígitos, adiciona 55 se ausente, valida DDD (11–99 conforme lista oficial), valida tamanho 12–13 dígitos (55 + DDD + 8/9).
- `src/lib/whatsapp/csvParser.ts` — parser CSV simples (sem dependência nova), aceita cabeçalhos: nome, telefone, empresa, tag, origem, observacao, opt_in.

## 3. Repositories (sem hooks novos, helpers async simples)

- `src/lib/whatsapp/repositories/whatsappAudiencesRepository.ts`
- `src/lib/whatsapp/repositories/whatsappTemplatesRepository.ts`
- `src/lib/whatsapp/repositories/whatsappCampaignsRepository.ts`

Funções conforme spec. `importAudienceContacts` faz:
1. normaliza telefone
2. valida (marca `is_valid`, `validation_reason`)
3. detecta duplicados dentro da lista
4. consulta `clients.whatsapp/phone` e `whatsapp_conversations.contact_phone` por `normalized_phone` → preenche `matched_client_id`/`matched_conversation_id`
5. consulta `whatsapp_opt_outs` por workspace+normalized_phone → marca `opt_out=true`
6. insert em batch
7. atualiza `total_contacts/valid/invalid/duplicate` em `whatsapp_audiences`

Nunca insere em `clients` automaticamente.

## 4. UI

Reorganizar `src/pages/WhatsApp.tsx` em 5 abas: Inbox | Audiências | Templates | Campanhas | Robô IA. Substituir o `AudiencesPanel` mock atual e o `TemplatesLibrary` localStorage atual pelas versões backend.

Novos componentes:
- `src/components/whatsapp/audiences/AudiencesPage.tsx` — lista + botão "Nova audiência" + drawer detalhe
- `src/components/whatsapp/audiences/ImportAudienceWizard.tsx` — paste/CSV/manual, download modelo CSV, preview validação, salvar
- `src/components/whatsapp/audiences/AudienceContactsTable.tsx` — tabela + ações remover inválidos/duplicados
- `src/components/whatsapp/templates/TemplatesPageBackend.tsx` — biblioteca + criar/editar + preview + transições de status manuais; bloqueia uso em campanha se ≠ approved
- `src/components/whatsapp/campaigns/CampaignWizard.tsx` — 4 etapas (Dados → Público → Mensagem → Revisão), botão "Enviar agora" desabilitado com tooltip
- `src/components/whatsapp/campaigns/CampaignsListBackend.tsx`

Mensagens fixas:
- "Contatos importados para campanha não viram clientes automaticamente."
- "Cada empresa precisa ter seus próprios templates aprovados na conta/número conectado."
- Tooltip envio: "Envio real entra na próxima fase."

Botões "converter em cliente / criar oportunidade / vincular" presentes mas `disabled` (visuais).

## 5. Bloqueios de segurança (UI + repositório)

- Wizard não avança sem audiência selecionada
- Wizard não avança sem template `approved`
- Não há textarea livre para campanhas (apenas preview do template)
- Recipients com `opt_out=true` ou `is_valid=false` recebem `status='skipped'` + `skip_reason`
- Repositórios usam `supabase` (anon) — nunca service role no frontend

## 6. Documentação

`SUPABASE-WHATSAPP-CAMPAIGNS-V1.md` na raiz, conforme spec.

## 7. Pontos de atenção / limitações

- **`whatsapp_campaigns` antigo continua vivo** (usado por `WhatsAppCampaigns.tsx` + `useWhatsAppCampaigns.ts` + edge function `whatsapp-campaign-sender`). Novo módulo usa `whatsapp_campaigns_v2`. Migração/unificação fica para fase futura.
- Envio real **desabilitado**. Status fica em `draft`/`scheduled`.
- Sem XLSX (só CSV) para não adicionar dependência.
- Sem novos erros TS no escopo; arquivos legacy não tocados.

## Entregáveis no final

Resposta numerada de 1 a 14 conforme spec.
