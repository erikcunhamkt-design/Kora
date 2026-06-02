## Escopo

Construção 100% visual/UX (sem backend, sem migration, sem RLS, sem webhook). Tudo persiste em localStorage via os hooks existentes (`useCampaigns`, novo `useWhatsAppTemplates`).

## Onde entra

Página **WhatsApp** (`src/pages/WhatsApp.tsx`) — adicionar abas internas:
- Inbox de Atendimento (existente)
- Audiências/Listas (nova aba leve, reaproveita `consents`/`segments` do `useCampaigns`)
- Campanhas (refatorada — fluxo Tipo de envio)
- **Templates Aprovados** (novo)
- Robô IA (existente `WhatsAppBotConfig`)

Se a página WhatsApp ainda não tiver tabs, envolver o conteúdo atual em `Tabs`.

## Arquivos novos

```text
src/hooks/useWhatsAppTemplates.ts
src/components/whatsapp/templates/TemplatesLibrary.tsx
src/components/whatsapp/templates/TemplateCard.tsx
src/components/whatsapp/templates/TemplatePreview.tsx
src/components/whatsapp/templates/CreateTemplateDialog.tsx
src/components/whatsapp/templates/VariableChips.tsx
src/components/whatsapp/audiences/AudiencesPanel.tsx
src/components/whatsapp/campaigns/CampaignFlow.tsx        (Tipo de envio + escolha template ou janela atendimento)
src/components/whatsapp/campaigns/CampaignHistory.tsx
src/components/whatsapp/campaigns/OptInNotice.tsx
src/lib/whatsapp/templateVariables.ts                     (render preview com {{vars}})
```

## Arquivos editados

- `src/pages/WhatsApp.tsx` — adicionar Tabs com 5 seções.
- `src/components/whatsapp/WhatsAppCampaigns.tsx` — quebrar em CampaignFlow + History; bloquear textarea livre quando envio = audiência; banner opt-in.

## Modelo do Template (localStorage `orbyt.whatsapp.templates.v1`)

```ts
type TemplateCategory = "marketing" | "utility" | "authentication" | "service";
type TemplateStatus   = "draft" | "submitted" | "approved" | "rejected" | "paused";
interface WhatsAppTemplate {
  id, name, category, status, language,
  body, variables: string[], cta?: {label,url}, notes?,
  lastUsedAt?, responseRate?, createdAt, isDemo
}
```

Seeds: 4 templates demo cobrindo cada categoria, status variados.

## Variáveis

`{{nome}} {{primeiro_nome}} {{empresa}} {{serviço}} {{data}} {{link}}` — chips clicáveis inserem no textarea (cursor position). Preview lateral renderiza com valores fake ("Erik", "Estúdio Orbyt", "Branding"…).

## Fluxo Campanha (CampaignFlow)

Passo 1 RadioGroup:
- **Mensagem livre — janela de atendimento** (badge âmbar 24h) → seleciona conversa ativa, textarea livre liberado.
- **Campanha com template aprovado** → seleciona audiência (Select) + template (Select filtrado por `status==="approved"`). Textarea livre OCULTO. Banner opt-in vermelho/vinho fixo.

Botão "Enviar campanha" desabilitado se template não-approved com tooltip "Selecione um template aprovado".

## Audiências (AudiencesPanel)

Cards por segmento mostrando: total, válidos, inválidos, duplicados, já clientes, já conversaram, sem opt-in, opt-out. Valores derivados dos `consents` + mocks determinísticos. Alerta: "Contatos de campanha não viram clientes automaticamente."

## Histórico (CampaignHistory)

Tabela: Template · Status · Total · Enviados · Falhas · Respostas · Bloqueios · Data · Origem.

## CreateTemplateDialog

Campos pedidos + alertas amarelos. Botões:
- **Salvar rascunho** (ativo)
- **Enviar para aprovação** (disabled + Tooltip "Integração oficial entra na próxima fase")

## Visual

Tokens existentes (dark, `primary` vinho/vermelho `#F81040`). Status badges:
- approved → success
- submitted → info
- draft → muted
- rejected → destructive
- paused → warning

Empty states elegantes com `EmptyState`. Tabela responsiva: desktop tabela, tablet cards, mobile stepper no CreateTemplateDialog.

## Fora de escopo

Nada de Edge Function, migration, alteração de webhook, envio real, alteração de RLS. `simulateSend` continua local.

## Entrega

Ao final reporto: localização, biblioteca, status/categorias, variáveis, fluxo de campanha, avisos opt-in, ações desabilitadas, ausência de mudanças no backend, status TypeScript/lint, próxima recomendação.
