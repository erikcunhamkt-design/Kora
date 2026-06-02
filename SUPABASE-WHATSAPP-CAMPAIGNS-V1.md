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
