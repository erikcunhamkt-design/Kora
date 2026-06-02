# SUPABASE-WHATSAPP-CAMPAIGNS-V1

Backend V1 do módulo Atendimento/WhatsApp — Audiências, Templates e Campanhas.

## Objetivo

Tirar a área de campanhas WhatsApp do estado mock/localStorage e ancorar tudo em Supabase com RLS por workspace, preparando o terreno para envio real em fase futura — sem ativar disparo agora.

## Tabelas criadas

Todas no schema `public`, com `workspace_id` obrigatório, RLS via `is_workspace_member(workspace_id)`, GRANTs para `authenticated` e `service_role`, trigger `update_updated_at_column`:

- `whatsapp_audiences` — listas de contatos (nome, descrição, status `draft/clean/needs_review/archived`, contadores `total/valid/invalid/duplicate`).
- `whatsapp_audience_contacts` — contatos da audiência (telefone original + `normalized_phone`, `is_valid`, `validation_reason`, `matched_client_id`, `matched_conversation_id`, `opt_out`, `is_duplicate`). Índices em `workspace_id`, `audience_id`, `normalized_phone`.
- `whatsapp_templates` — templates aprovados (nome, `internal_name`, `category`, `language`, `body`, `variables`, `sample_values`, `status` `draft/pending/approved/rejected/paused`, `provider_template_id`, `rejection_reason`, `deleted_at`).
- `whatsapp_campaigns_v2` — campanhas vinculadas a audiência + template, com contadores `total/valid/sent/failed/skipped` e status (`draft/scheduled/...`).
- `whatsapp_campaign_recipients` — destinatários por campanha (status `pending/sent/failed/skipped`, `skip_reason`).
- `whatsapp_opt_outs` — telefones que saíram (por workspace + `normalized_phone`).

## Por que `whatsapp_campaigns_v2`

Já existia `whatsapp_campaigns` em uso por `WhatsAppCampaigns.tsx`, `useWhatsAppCampaigns.ts` e a edge function `whatsapp-campaign-sender`, com schema diferente. Criar `whatsapp_campaigns_v2` evita quebrar o fluxo antigo e permite migrar/unificar com calma em uma fase futura. A tabela antiga continua viva e intocada.

## RLS e policies

- RLS habilitado em todas as 6 tabelas.
- Policies `select/insert/update/delete` condicionadas a `is_workspace_member(workspace_id)`.
- `service_role` mantém acesso total para edge functions futuras (envio).
- Nenhuma policy permissiva (`true`), nenhum acesso anônimo.

## Repositories (frontend)

Em `src/lib/whatsapp/repositories/`:

- `whatsappAudiencesRepository.ts` — `listAudiences`, `createAudience`, `archiveAudience`, `deleteAudience`, `importAudienceContacts`, `listAudienceContacts`, `removeContacts`.
- `whatsappTemplatesRepository.ts` — CRUD + transições de status (`markTemplatePending/Approved/Rejected/Paused/Draft`) + `renderTemplatePreview`.
- `whatsappCampaignsRepository.ts` — `listCampaigns`, `createCampaign`, `deleteCampaign`, materialização de recipients a partir da audiência selecionada.

Todos usam o cliente `supabase` anon — **nunca service role no frontend**.

## Utils de telefone e CSV

- `src/lib/whatsapp/phone.ts` — `normalizeBrazilianPhone`, `isLikelyValidBrazilianPhone`, `formatPhoneBR`. Remove não-dígitos, força DDI 55, valida DDD (11–99 oficial), tamanho 12–13 dígitos.
- `src/lib/whatsapp/csvParser.ts` — parser CSV simples sem dependência nova. Cabeçalhos suportados: `nome, telefone, empresa, tag, origem, observacao, opt_in`.

## Fluxo de Audiências

1. Usuário cria audiência (nome/descrição).
2. Importa contatos via paste, CSV ou manual.
3. Repositório normaliza telefone → valida → detecta duplicados internos → cruza com `clients` e `whatsapp_conversations` por `normalized_phone` (preenche `matched_client_id/matched_conversation_id`) → cruza com `whatsapp_opt_outs` (marca `opt_out=true`) → insere em batch → atualiza contadores.
4. **Nenhum contato vira cliente automaticamente.**
5. Drawer de detalhe permite remover inválidos/duplicados e arquivar.

## Fluxo de Templates

1. Cadastro local (`status='draft'`).
2. Transições manuais de status (`draft → pending → approved/rejected → paused`), refletindo o que foi aprovado na conta WhatsApp Business externa.
3. Preview com `sample_values` substituindo `{{var}}`.
4. **Cada workspace tem seus próprios templates aprovados** no número conectado.

## Fluxo de Campanhas

Wizard de 4 etapas: Dados → Público → Mensagem → Revisão.

- Não avança sem audiência selecionada.
- Não avança sem template `approved`.
- Sem textarea livre — apenas preview do template.
- Recipients com `opt_out=true` ou `is_valid=false` recebem `status='skipped'` + `skip_reason`.
- Botão "Enviar agora" desabilitado com tooltip: *"Envio real entra na próxima fase."*

## Separação Clientes × Contatos de audiência

`clients` e `whatsapp_audience_contacts` são tabelas independentes. A importação só faz *match* via `normalized_phone` para enriquecer o contato (botões "converter em cliente / criar oportunidade / vincular" existem visualmente mas estão `disabled`). Nada é inserido em `clients` automaticamente.

## Opt-in / opt-out

- CSV/paste podem carregar coluna `opt_in`.
- `whatsapp_opt_outs` é fonte de verdade por workspace + telefone normalizado.
- Qualquer contato importado que case com um opt-out é marcado e fica fora do disparo (skip com motivo).

## Bloqueio de template não aprovado

UI do wizard só lista templates com `status='approved'`. Repositório de campanha rejeita criação se o template não estiver aprovado. Templates `draft/pending/rejected/paused` não aparecem como opção de envio.

## Status atual do envio real

**Bloqueado.** Campanhas só podem ser salvas em `draft`/`scheduled`. Nenhuma edge function de envio nova foi criada nesta fase. A função `whatsapp-campaign-sender` antiga continua operando sobre a tabela antiga `whatsapp_campaigns` e não foi alterada.

## Limitações

- `whatsapp_campaigns` antigo continua coexistindo (unificação futura).
- Sem suporte a XLSX (só CSV) para evitar dependência nova.
- Sem agendamento real (cron/worker) — `scheduled_at` é só metadata.
- Sem retry/throttle/quota.
- Validação de telefone focada em BR.

## Próximos passos

1. Edge function `whatsapp-campaign-v2-sender` com fila, rate limit e idempotência.
2. Sincronização real do status de template com a API do provedor.
3. Webhook de delivery/read para atualizar `whatsapp_campaign_recipients`.
4. Unificar `whatsapp_campaigns` antigo no schema v2 e aposentar a tabela legada.
5. Suporte a XLSX e a múltiplos países (não-BR).
6. Métricas agregadas por campanha (entrega, leitura, resposta, conversão).

---

## QA Funcional — V1

### Cenários testados

**Tabelas/RLS (via schema introspection):**
- 6 tabelas existem (`whatsapp_audiences`, `whatsapp_audience_contacts`, `whatsapp_templates`, `whatsapp_campaigns_v2`, `whatsapp_campaign_recipients`, `whatsapp_opt_outs`).
- Todas com `workspace_id NOT NULL`.
- RLS ativa em todas, 4 policies (select/insert/update/delete) por tabela, role `authenticated`, expressão `is_workspace_member(workspace_id)`.
- GRANTs corretos para `authenticated` + `service_role`.

**Telefone (`/tmp/phone-qa.mjs`, todos os cases pedidos):**
| Input | Normalizado | Válido | Motivo |
|---|---|---|---|
| `(51) 99999-9999` | `5551999999999` | ✅ | — |
| `51999999999` | `5551999999999` | ✅ | — |
| `5551999999999` | `5551999999999` | ✅ | — |
| `99999-9999` | `999999999` | ❌ | DDI não é Brasil |
| `123` | `123` | ❌ | DDI não é Brasil |
| `99999999999999999` | mantido | ❌ | Tamanho inválido |
| `abc xyz!!!` | `""` | ❌ | Telefone vazio |
| `+55 (11) 98765-4321` | `5511987654321` | ✅ | — |

Conservador: não inventa 9º dígito, não corrige agressivamente, valida DDD oficial.

**Repositories:**
- `whatsappAudiencesRepository.importAudienceContacts` → normaliza, valida, marca duplicados internos, cruza com `clients`/`whatsapp_conversations`/`whatsapp_opt_outs`, insere em batch, atualiza contadores. Nunca insere em `clients`.
- `whatsappTemplatesRepository` → CRUD + transições de status (`draft↔pending↔approved↔rejected↔paused`), preview tolera variáveis ausentes (mantém `{{var}}`).
- `whatsappCampaignsRepository.createCampaign` → bloqueia se `template.status !== 'approved'` (throw explícito).
- `prepareCampaignRecipients` → marca `skipped` com `skip_reason` para `opt_out`, `blocked`, `is_valid=false`, `is_duplicate=true`.

**UI:**
- `WhatsApp.tsx` renderiza `AudiencesBackendPage`, `TemplatesBackendPage`, `CampaignsBackendPage` nas abas correspondentes.
- Inbox e Robô IA intocados.
- Wizard de campanha não avança sem audiência + template aprovado.
- Botão "Enviar agora" desabilitado com tooltip.

### Bugs encontrados
Nenhum no escopo desta V1.

### Bugs corrigidos
Nenhum (sem alteração de código nesta rodada de QA).

### Limitações
- Sem teste E2E em browser real (validação por leitura de código + unit test de telefone).
- `whatsapp_campaigns` legado continua coexistindo.
- Validação focada em BR.

### Status do envio real
**Bloqueado.** Nenhuma edge function nova, nenhum disparo, nenhuma chamada à API WhatsApp. Campanhas só em `draft`/`scheduled`.

### Recomendação final
**Aceitar V1.** Próxima fase deve focar em: edge function `whatsapp-campaign-v2-sender` com fila + rate limit + idempotência, webhook de delivery/read, e unificação do schema legado.

---

## Campaign Sender V1

### Feature flag

`kora.whatsapp.campaignSender.enabled` (localStorage, default `false`). Enquanto `false`,
botão "Enviar campanha" fica desabilitado com tooltip *"Envio real de campanhas ainda
está desativado."* O servidor não confia na flag — ela é apenas controle visual.

Para habilitar localmente:

```js
localStorage.setItem("kora.whatsapp.campaignSender.enabled", "true");
```

### Edge function

`supabase/functions/whatsapp-campaign-v2-sender/index.ts`

Recebe `{ campaignId, workspaceId, action }`. `action` ∈ `send_batch | pause | cancel`.

Validações server-side (em ordem):

1. Authorization Bearer + `auth.getUser` → usuário autenticado.
2. Linha em `workspace_members` para o `workspace_id` → membership.
3. Campanha existe + pertence ao workspace.
4. Status ≠ `completed` / `cancelled`.
5. Template existe + pertence ao workspace + `status='approved'`.
6. Instância WhatsApp conectada (`whatsapp_instances.status='connected'`).
7. Recipients válidos = só os com status `queued` e `provider_message_id IS NULL`.

Sem essas condições retorna 4xx e nada é enviado.

### Rate limit + fila

- `MAX_BATCH_SIZE = 10` por chamada.
- `CAMPAIGN_SEND_MODE = "manual_batch"` — usuário aciona "Processar próximo lote" pela UI.
- Entre envios do mesmo lote: delay aleatório 30–90s (anti-ban).
- Antes de cada envio: typing presence 1.5–4s.

Não há worker contínuo nesta V1 — limitação documentada.

### Idempotência

Para cada recipient o servidor:

1. Tenta `UPDATE ... SET status='sending' WHERE id=X AND status='queued'`.
2. Se 0 linhas afetadas → já está em processamento ou já enviado → pula.
3. Recipients com `provider_message_id` preenchido nunca são selecionados.
4. Recipients `sent/delivered/read/replied/skipped/failed` são imutáveis pelo sender.

### Status dos recipients

`pending → queued → sending → sent | failed | skipped`

Atualizações de `delivered/read/replied` virão do webhook (limitação atual — ver abaixo).

A campanha:
- vai para `sending` no primeiro lote;
- volta para `completed` quando não há mais `queued/pending`;
- pode ir para `paused` ou `cancelled` via ações do dialog.

Contadores `sent_count` e `failed_count` são recomputados a partir da tabela de recipients
ao final de cada lote (fonte de verdade = recipients, não incrementos).

### Logs

Tabela `whatsapp_campaign_send_logs` com `event ∈ {sent, failed, skipped, retry, queued}`,
`phone`, `provider_message_id`, `error_message`. RLS por `is_workspace_member(workspace_id)`.
Últimos 10 eventos exibidos no dialog de progresso.

### Confirmação forte (UI)

Dialog em `CampaignSendDialog.tsx`:

- Título "Enviar campanha WhatsApp?"
- Checklist de pré-requisitos.
- Aviso amarelo se feature flag desligada.
- Campo obrigatório: digitar `ENVIAR` para confirmar.
- Botões: Cancelar / Confirmar envio.

Após iniciar, dialog mostra: status, progress bar, contadores
(total/queued/sent/failed/skipped/delivered), últimos eventos, e botões
"Processar próximo lote", "Pausar", "Cancelar campanha".

### Variáveis do template

Mapeadas server-side: `{{nome}}`, `{{primeiro_nome}}`, `{{empresa}}`, `{{serviço}}`,
`{{data}}`, `{{link}}`. `nome` e `primeiro_nome` usam o nome do recipient. Demais usam
`sample_values` do template como fallback. Variável obrigatória ausente → recipient
marcado como `failed` com `error_message=missing_variable:<keys>`.

### Webhook delivery/read

**Limitação V1**: o webhook atual `whatsapp-webhook` ainda não mapeia eventos do
provedor (`messages.update`) para `whatsapp_campaign_recipients` via `provider_message_id`.
Status `sent`/`failed` são finais para esta fase. Atualizações `delivered/read/replied`
serão implementadas junto com a extensão do webhook.

### Segurança

- Sender só executa na edge function (token uazapi apenas em `UAZAPI_SUBDOMAIN`/instance secret).
- Frontend nunca recebe nem envia token.
- Service role só na edge function.
- Texto livre para audiência **bloqueado**: edge function só lê `template.body` do registro
  aprovado — não aceita `body` no payload.
- Template não aprovado → 409 `template_not_approved`.
- Opt-out / inválido / duplicate são marcados como `skipped` na materialização dos
  recipients e nunca chegam ao status `queued`.

### Limitações

- Sem worker contínuo (manual batch).
- Sem retry automático para `failed`.
- Sem webhook de delivery/read mapeado para v2 ainda.
- Sem agendamento real (`scheduled_at` é metadata).
- Sem mídia (apenas texto).

### Próximos passos

1. Cron job (pg_cron + pg_net) para `whatsapp-campaign-v2-sender` rodar lotes automaticamente.
2. Extensão do `whatsapp-webhook` para mapear `provider_message_id` → recipient e
   atualizar `delivered/read/replied`.
3. Retry policy explícita para `failed`.
4. Suporte a mídia (image/document) no template.
5. Unificação do schema legado `whatsapp_campaigns` em v2.
