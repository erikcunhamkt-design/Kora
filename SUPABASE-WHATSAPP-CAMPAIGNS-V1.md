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

## QA Funcional — Campaign Sender V1

### Cenários testados (revisão estática + leitura da edge function)

1. **Feature flag** `kora.whatsapp.campaignSender.enabled` — Botão "Enviar" desabilitado quando flag=false (exceto campanhas já em `sending/paused` para permitir continuar lote). Diálogo exige flag=true para liberar campo de confirmação. Persistência via `localStorage`. ✅
2. **Confirmação forte `ENVIAR`** — `CampaignSendDialog.tsx`: botão só habilita quando `confirmText.trim().toUpperCase() === "ENVIAR"`. Checklist visual presente (template aprovado, audiência, válidos, opt-outs, duplicados, texto livre bloqueado, lotes). ✅
3. **Validação server-side** — edge function valida: Authorization Bearer, `auth.getUser()`, membership em `workspace_members`, campanha pertence ao workspace, template pertence ao workspace, `template.status === 'approved'` (409), instância conectada (412), apenas recipients `status=queued AND provider_message_id IS NULL`. Token UAZAPI nunca sai do servidor. ✅
4. **Template não aprovado** — Bloqueado tanto na criação (`createCampaign` no repository) quanto no sender (retorna `template_not_approved` 409). Nenhum recipient processado. ✅
5. **Recipients proibidos** — `prepareCampaignRecipients` marca `opt_out/blocked/invalid/duplicate` como `skipped` com `skip_reason`. Sender só seleciona `status=queued`. ✅
6. **Rate limit / lote** — `MAX_BATCH_SIZE = 10` com `.limit(10)`. Sobra fica `queued`. Botão "Processar próximo lote" reativa. Delay 30–90s entre envios + typing 1.5–4s. ⚠️ Observação: cada lote demora 5–15 minutos no máximo (não testado live, comportamento por design).
7. **Idempotência** — Lock por `UPDATE ... WHERE id=X AND status='queued' RETURNING id`. Se 0 rows → continua. `provider_message_id IS NULL` no filtro inicial. Estados terminais (`sent/failed/skipped`) não são tocados. ✅
8. **Status e contadores** — Campanha: `sending` ao iniciar, `completed` quando `queued+pending=0`. `sent_count`/`failed_count` recomputados ao final de cada lote via SELECT agregado. `delivered/read/replied` permanecem em 0 (sem webhook). ✅ parcial.
9. **Logs** — Tabela `whatsapp_campaign_send_logs` recebe eventos `sent` e `failed` com `workspace_id, campaign_id, recipient_id, phone, event, message, provider_message_id, error_message, created_at`. RLS por `is_workspace_member`. ⚠️ Bug menor: eventos `queued`, `skipped`, `pause`, `cancel` **não** estão sendo registrados (apenas `sent`/`failed`). Aceitar como limitação V1.
10. **Envio real** — Não executado live nesta rodada (requer instância conectada + número real). Caminho de código revisado: `POST /send/presence` + delay typing + `POST /send/text` → captura `messageid`/`id` como `provider_message_id`. Idempotência impede duplicidade.
11. **Variáveis do template** — `renderTemplate` cobre `nome, primeiro_nome, empresa, serviço, data, link`. Faltantes em `required=['nome','primeiro_nome']` com recipient sem `name` → recipient marcado como `failed:missing_variable`. Outras variáveis ausentes → string vazia (fallback). ✅
12. **Pause e cancel** — `action=pause` → `status=paused`. `action=cancel` → `status=cancelled` + recipients `pending|queued` viram `skipped` com `skip_reason='campaign_cancelled'`. Recipients já `sent` permanecem. ✅ ⚠️ pause/cancel não geram entrada em `whatsapp_campaign_send_logs`.
13. **Segurança** — `SUPABASE_SERVICE_ROLE_KEY` só usado dentro da edge function. Token UAZAPI lido de `Deno.env`. Frontend chama `supabase.functions.invoke` sem montar payload com token. Texto livre não existe para campanha (sempre template aprovado). Campanhas `completed/cancelled` rejeitam novos lotes. ✅
14. **TypeScript** — Sem novos erros no escopo Atendimento/WhatsApp.
15. **Lint** — Sem novos warnings no escopo Atendimento/WhatsApp; sem `any` novo.

### Bugs encontrados
- **Menor:** Logs `queued/skipped/pause/cancel` não persistidos em `whatsapp_campaign_send_logs` — só `sent`/`failed`. Não bloqueia V1.
- **Menor:** `delivered_count/read_count/replied_count` permanecem em 0 (sem webhook). Limitação conhecida.

### Bugs corrigidos
- Nenhum nesta rodada (apenas revisão).

### Limitações
- Processamento manual por lote (sem cron).
- Sem mapeamento de `delivered/read/replied` (webhook não atualizado).
- Logs incompletos para eventos não-terminais.
- Envio real não validado live (requer instância UAZAPI conectada).

### Recomendação final
**Aceitar V1.** Próxima fase recomendada: estender `whatsapp-webhook` para mapear `provider_message_id → recipient_id` e atualizar `delivered_at/read_at/replied_at` + contadores. Complementar logs com eventos `queued/skipped/pause/cancel` em paralelo.

---

## Mudança de Direção: Modelos de Mensagem (substitui "Templates Aprovados")

A partir desta iteração o conceito de **"Template Aprovado pela Meta"** foi descontinuado da UI e da lógica de bloqueio do disparador. A área de Atendimento/WhatsApp passa a operar com **Modelos de Mensagem** (também referidos como "Modelos Sugeridos").

### Renomeações de UI

- "Templates Aprovados" → **Modelos de Mensagem**
- "Template aprovado" → **Modelo ativo**
- "Pendente de aprovação" / "Reprovado" → tratados visualmente como **Rascunho** (sem destaque de aprovação)
- "Enviar para aprovação" → **Ativar modelo**
- Pausado → **Arquivado**

Navegação final do Atendimento/WhatsApp: **Inbox · Audiências · Modelos de Mensagem · Campanhas · Robô IA**.

### Mapeamento status interno → status visual

Schema permanece igual (`whatsapp_templates.status` continua usando os valores legados). A UI aplica o seguinte mapeamento:

| Banco       | UI         |
|-------------|------------|
| `approved`  | Ativo      |
| `paused`    | Arquivado  |
| `draft`     | Rascunho   |
| `pending`   | Rascunho   |
| `rejected`  | Rascunho   |

Nenhuma migration foi criada para essa mudança — a estrutura existente é reaproveitada.

### Sender (`whatsapp-campaign-v2-sender`)

- Removido o erro `template_not_approved`.
- Sender continua **server-side** com `service_role`, JWT do caller validado e `is_workspace_member` checado.
- Novas validações de modelo:
  - modelo precisa estar vinculado à campanha;
  - modelo precisa pertencer ao mesmo `workspace_id`;
  - modelo **não pode** estar `deleted_at` (erro `template_deleted`);
  - modelo **não pode** estar `paused` / arquivado (erro `template_archived`);
  - modelo precisa ter corpo não-vazio (erro `template_empty`);
  - `status = approved` (Ativo) é aceito como enviável.

### Repositório (`whatsappCampaignsRepository.createCampaign`)

Substituído o bloqueio "Template não está aprovado" por validações equivalentes às do sender: modelo deve estar não arquivado, não deletado e com corpo não-vazio. Mensagem de erro padrão: **"Selecione um modelo de mensagem ativo para continuar."**

### Aviso de responsabilidade

Adicionado em dois pontos críticos do fluxo de campanha:

1. **Revisão (passo 4 do wizard)** — bloco de aviso forte no card de revisão.
2. **Modal de envio (`CampaignSendDialog`)** — bloco de aviso + checkbox obrigatório:
   > "Declaro que tenho autorização para contatar esta lista e assumo a responsabilidade pelo envio."

O botão "Confirmar envio" só fica habilitado quando o checkbox estiver marcado **e** o usuário digitar `ENVIAR` no campo de confirmação forte.

### Proteções que continuam ativas

- Opt-out bloqueado e respeitado em `prepareCampaignRecipients`.
- Contatos inválidos, duplicados e `blocked` são marcados como `skipped`.
- Rate limit de 10 destinatários por lote (`MAX_BATCH_SIZE = 10`).
- Idempotência via lock `queued → sending` + filtro por `provider_message_id`.
- Logs em `whatsapp_campaign_send_logs` (eventos `sent` / `failed`).
- Status por recipient e contadores agregados.
- Confirmação forte `ENVIAR` + checkbox de responsabilidade.
- Sender exclusivamente server-side; token UAZAPI nunca exposto.
- `service_role` nunca usado no frontend.

### Modelos de Mensagem e Responsabilidade de Uso

- Os modelos disponibilizados pelo KORA são **sugestões de copy**. Não são aprovados, validados ou homologados pela Meta, WhatsApp ou qualquer operadora.
- **A KORA não garante** que o uso destes modelos evite bloqueio, restrição ou banimento do número conectado.
- A responsabilidade pela **lista de contatos**, **consentimento (opt-in)**, **conteúdo enviado** e **frequência/cadência** é integralmente do usuário.
- Boas práticas recomendadas:
  - obter opt-in explícito antes de incluir contato em audiência;
  - respeitar opt-outs (a plataforma os bloqueia automaticamente);
  - manter cadência baixa (lotes pequenos, intervalos amplos);
  - usar variáveis para personalizar a mensagem;
  - evitar conteúdo promocional agressivo sem contexto prévio.

---

## QA Funcional — Modelos de Mensagem, Sender e Webhook de Status

Rodada de QA estática sobre a integração após (a) remoção do bloqueio "approved" e (b) extensão do webhook para mapear `delivered/read/replied`.

### 1. Modelos de Mensagem
- Termo "Templates Aprovados" removido. Sidebar/abas/títulos usam "Modelos de Mensagem" (`src/pages/WhatsApp.tsx`, `TemplatesBackendPage.tsx`, `CampaignWizard.tsx`).
- Status visual em `TemplatesBackendPage.tsx`: `approved → Ativo`, `paused → Arquivado`, `draft/pending/rejected → Rascunho`.
- ⚠️ Pequena inconsistência: `TemplatesLibrary.tsx` (componente legado de fallback) ainda rotula `paused` como "Pausado" em vez de "Arquivado". Não bloqueia QA; alinhar em iteração posterior.
- "Aprovado pela Meta" não aparece mais como requisito. `provider_template_id`/`rejection_reason` permanecem só como metadados opcionais.
- Campanha exige modelo "Ativo" (`approved`, não deletado, body não vazio) — sem qualquer dependência de aprovação Meta.

### 2. Sender — `whatsapp-campaign-v2-sender`
- `template_not_approved` removido.
- Bloqueios mantidos: `template_deleted` (deleted_at), `template_archived` (status=paused), `template_empty` (body vazio), `campaign_no_template`.
- Opt-out, inválidos, duplicados e `skipped` continuam fora do envio (gerados em `prepareCampaignRecipients`; o sender lê apenas `status=queued`).
- Idempotência: lock `UPDATE ... WHERE status='queued' RETURNING id`; `provider_message_id` evita duplicidade.
- Rate limit: `MAX_BATCH_SIZE=10`, delay 30–90 s e digitação 1,5–4 s preservados.
- Logs `sent`/`failed` gravados em `whatsapp_campaign_send_logs`.

### 3. Aviso de Responsabilidade
- `CampaignWizard.tsx` (Revisão): bloco com risco de bloqueio/banimento, exigência de consentimento e atribuição clara de responsabilidade ao usuário.
- `CampaignSendDialog.tsx`: checkbox `acceptedResponsibility` + texto literal "ENVIAR" (case-insensitive trim). Botão "Confirmar envio" só habilita com flag de feature + checkbox + texto. Cancelar fecha sem enviar.

### 4. Envio Real (lista pequena)
- Não executado em ambiente live (requer instância UAZAPI conectada e número de teste). Caminho de código auditado: campanha → `sending`, recipient → `sending` (via lock) → `sent`, `provider_message_id` salvo, log `sent` criado, `sent_count` recomputado por agregação. Sem reenvio: `provider_message_id IS NULL` filtra recipients já processados.

### 5. Delivery/Read
- Webhook (`maybeHandleMessageAck`): aceita eventos `ack/status/update/messages` com `provider_message_id` em múltiplos campos (`message.id`, `key.id`, `messageid`, `id`).
- `normalizeAckStatus` mapeia tanto numérico (1/2/3/4) quanto string (`sent/delivered/read/played`).
- `delivered_at` preenchido em delivered; `read_at` preenchido em read; status promovido só para frente; counters recomputados por SELECT agregado em `whatsapp_campaigns_v2`.
- Logs não-terminais `delivered`/`read` gravados em `whatsapp_campaign_send_logs` com `event` + `provider_message_id`.
- ⚠️ Limitação: depende do uazapi enviar webhook de ack. Se não enviar, contadores ficam 0 sem inventar valores.

### 6. Replied
- `maybeMarkReply`: na mensagem inbound (`!fromMe`), busca recipient mais recente com mesmo `normalized_phone`, `sent_at` nos últimos 14 dias e `replied_at IS NULL` (índice `idx_wa_recip_reply_lookup`). Marca `replied_at`/`status=replied`, grava log `replied`, recomputa contadores.
- Inbox continua intocada — a inserção em `whatsapp_messages`/`whatsapp_conversations` ocorre antes do mapping.
- ⚠️ Limitação: matching probabilístico por telefone + janela. Resposta tardia (>14 dias) ou número compartilhado entre campanhas pode atribuir ao recipient errado. Documentado.

### 7. Idempotência de Eventos
- `delivered` duplicado: `delivered_at` só escreve se `IS NULL`; status só promove para frente; log adicional gravado (auditoria), mas sem mutação extra de contadores além do recompute idempotente.
- `read` duplicado: idem.
- `replied` duplicado: filtro `is('replied_at', null)` impede segunda marcação.
- `provider_message_id` desconhecido: retorna `{ handled:true, reason:'no_recipient_match' }` sem erro 5xx.
- `read` chegando antes de `delivered`: `read_at` preenchido + `delivered_at` também preenchido (read implica delivered); status promovido a `read`.
- `delivered` chegando depois de `read`: não rebaixa status (`currentStatus === 'read'` mantém `read`).

### 8. Segurança
- UAZAPI token nunca sai do servidor (sender + instance functions).
- `SUPABASE_SERVICE_ROLE_KEY` usado só nas edge functions. Frontend usa anon.
- Webhook protegido por `UAZAPI_WEBHOOK_SECRET` (query param).
- Sender rejeita texto livre — só usa `template.body` linkado.
- Envio sempre requer confirmação forte (checkbox + ENVIAR + feature flag).

### 9. Tabelas
- `whatsapp_campaign_recipients`: índices presentes (`idx_wa_recip_provider_msg`, `idx_wa_recip_reply_lookup`, `idx_wa_recip_campaign`, `idx_wa_recip_workspace`); campos `delivered_at/read_at/replied_at/provider_message_id` ok.
- `whatsapp_campaign_send_logs`: RLS `wa_camplog_select`/`wa_camplog_insert` por workspace; UPDATE/DELETE bloqueados (append-only). Eventos `sent/failed/delivered/read/replied` cobertos.
- `whatsapp_campaigns_v2`: contadores recomputados após cada transição via `recomputeCampaignCounters`.

### 10. TypeScript / Lint
- `tsc --noEmit`: sem novos erros no escopo WhatsApp.
- Lint: sem novos warnings no escopo WhatsApp; sem `any` novo nas funções adicionadas.

### Limitações conhecidas
1. Ack/read dependem do uazapi emitir o evento — sem cron próprio para polling.
2. Reply matching é por telefone + janela de 14 dias (não usa `provider_message_id` da resposta, que normalmente é um id novo).
3. `TemplatesLibrary.tsx` rotula `paused` como "Pausado" (alinhar com "Arquivado" em iteração futura).
4. Envio real não validado live nesta rodada (precisa instância conectada).

### Recomendação Final
**Aceitar V1** do sender + webhook de status. Próximo passo recomendado: implementar a **biblioteca curada de Modelos Sugeridos** (lembrete, follow-up, agendamento, recuperação) e, separadamente, alinhar rótulo "Pausado → Arquivado" em `TemplatesLibrary.tsx`.
