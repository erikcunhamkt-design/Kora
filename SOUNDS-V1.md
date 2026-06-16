# KORA Hub — Sons do Sistema V1 (QA Funcional)

Documento técnico-funcional da camada de áudio do KORA Hub, conforme implementada na V1 com áudios reais.

## 1. Arquitetura

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/sound/soundEvents.ts` | Tipos `KoraSoundEvent` / `KoraSoundModule`, mapa `SOUND_EVENTS` (src + module + gain + throttleMs), labels |
| `src/lib/sound/soundManager.ts` | `playKoraSound`, `previewKoraSound`, `stopAllKoraSounds`, leitura de prefs, throttle, quiet hours, mute, cache de `Audio` |
| `src/hooks/useSoundPreferences.ts` | CRUD reativo das preferências + sync entre abas |
| `src/hooks/useWhatsAppUnansweredAlert.ts` | Loop de alerta para conversas sem resposta acima do limite |
| `src/components/settings/SoundPreferencesSection.tsx` | UI premium em Configurações → Aparência |
| `src/assets/sounds/*.mp3` | 9 assets reais (ver §2) |

## 2. Arquivos de áudio reais (`src/assets/sounds/`)

| Arquivo | Uso |
|---|---|
| `notification-soft.mp3` | WhatsApp — nova mensagem |
| `success-soft.mp3` | Campanha criada / lote OK (fallback) |
| `error-soft.mp3` | Erros: lote, financeiro atrasado, tarefa atrasada |
| `task-complete.mp3` | Tarefa concluída + fallback de WhatsApp enviado |
| `ai-pulse.mp3` | IA habilitada / insight / human takeover (fallback) |
| `campaign-complete.mp3` | Campanha concluída |
| `crm-ding.mp3` | CRM — oportunidade criada / orçamento aprovado |
| `finance-paid.mp3` | Financeiro — recebível pago |
| `whatsapp-unanswered-alert.mp3` | Alerta repetido de conversa sem resposta |

## 3. Eventos sonoros (16) — mapeamento atual

```
whatsapp:new_message        → notification-soft.mp3
whatsapp:sent               → task-complete.mp3 (fallback)
whatsapp:human_takeover     → ai-pulse.mp3 (fallback)
whatsapp:unanswered_alert   → whatsapp-unanswered-alert.mp3
campaign:created            → success-soft.mp3
campaign:batch_success      → success-soft.mp3
campaign:batch_error        → error-soft.mp3
campaign:completed          → campaign-complete.mp3
crm:opportunity_created     → crm-ding.mp3
quotes:approved             → crm-ding.mp3
finance:paid                → finance-paid.mp3
finance:overdue_alert       → error-soft.mp3 (fallback)
tasks:completed             → task-complete.mp3
tasks:overdue_alert         → error-soft.mp3 (fallback)
ai:enabled                  → ai-pulse.mp3
ai:insight                  → ai-pulse.mp3
```

## 4. Preferências

Chave `localStorage`: `kora.sound.preferences.v1`

```ts
{ enabled: boolean; volume: 0..1; mutedUntil: string|null;
  modules: { whatsapp, campaigns, crm, finance, tasks, ai };
  quietHours: { enabled, start "HH:mm", end "HH:mm" };
  unansweredAlert: { enabled, thresholdMinutes, repeatSeconds } }
```

Defaults: `enabled=true`, `volume=0.5`, todos módulos `true`, quiet hours off (22:00–08:00), unansweredAlert off (10 min / 30 s).

## 5. Modo silencioso, quiet hours e alerta sem resposta

- Botões: 1h, 4h, até amanhã (12h), com botão Reativar.
- Quiet hours suporta intervalo que atravessa meia-noite (`start > end`).
- `previewKoraSound` (Testar som) ignora throttle/quiet hours/mute mas respeita `enabled` e volume.
- `useWhatsAppUnansweredAlert` dispara `whatsapp:unanswered_alert` em loop (`skipThrottle`) e para ao abrir a conversa.

## 6. Anti-spam

`lastPlayedAt: Map<KoraSoundEvent, number>` em memória. Throttle padrão 3s, configurável por evento:
- WhatsApp inbound: 5s
- WhatsApp enviado / Task: 1.5s
- Alerta sem resposta: throttle 0 (controlado pelo hook via `repeatSeconds`)
- Campanha: toca apenas no encerramento do `simulateSend` (não por recipient)

## 7. Integrações V1

| Evento | Onde | Status |
|---|---|---|
| `whatsapp:new_message` | `useWhatsAppConversations` (INSERT/UPDATE, `id !== selectedId`) | ✅ |
| `whatsapp:unanswered_alert` | `useWhatsAppUnansweredAlert` | ✅ |
| `tasks:completed` | `useTasks.moveTask` → `concluido` | ✅ |
| `quotes:approved` | `useQuotes.updateStatus` → `aprovado` | ✅ |
| `campaign:completed` | `useCampaigns.simulateSend` (sucesso) | ✅ |
| `campaign:batch_error` | `useCampaigns.simulateSend` (sent=0) | ✅ |
| Demais eventos | Definidos + testáveis via "Testar"; sem hook real ainda | ⚠️ Preparado |

## 8. Tratamento de falhas

- `try/catch` em `new Audio`, `audio.play().catch()` silencioso → autoplay bloqueado nunca quebra o app.
- `try/catch` em `localStorage.getItem/setItem`.
- Sem listeners agressivos, sem loops fora do alerta de sem-resposta (que para ao abrir conversa).

## 9. Resultado do QA com áudios reais

| # | Item | Status |
|---|---|---|
| 1 | 9 assets reais carregados e importados sem erro | ✅ |
| 2 | Cada módulo do "Testar" toca som distinto e representativo | ✅ |
| 3 | WhatsApp inbound toca `notification-soft` | ✅ |
| 4 | Tarefa concluída toca `task-complete` | ✅ |
| 5 | Orçamento aprovado toca `crm-ding` | ✅ |
| 6 | Lote sucesso/erro toca som correto, uma vez por lote | ✅ |
| 7 | Alerta sem resposta toca em loop e para ao abrir | ✅ |
| 8 | Volume / mute / módulo / quiet hours / throttle | ✅ |
| 9 | Autoplay bloqueado não quebra | ✅ |
| 10 | UI premium em Configurações → Aparência | ✅ |

## 10. Eventos apenas preparados (sem hook de produção)

`whatsapp:sent`, `whatsapp:human_takeover`, `campaign:created`, `campaign:batch_success`, `crm:opportunity_created`, `finance:overdue_alert`, `tasks:overdue_alert`, `ai:enabled`, `ai:insight`.

Todos respondem ao botão "Testar" no painel de Sons.

## 11. Limitações conhecidas

- Faltam assets dedicados para fechar 100% do mapa: `message-sent`, `human-takeover`, `finance-alert`, `important-notification`, `campaign-batch-success/error`, `quote-approved`. Hoje cobertos por fallback aceitável.
- `mutedUntil` expira na próxima tentativa de play; não há timer reativo para atualizar a label "Silenciado por mais Xmin".
- Conclusão de tarefa via `updateTask({ status })` direto não toca som — apenas `moveTask`.

## 12. Próximos passos

1. Adicionar os 5–7 assets faltantes e remover fallbacks.
2. Plugar `finance:paid` no toggle de recebível pago.
3. Plugar `tasks:overdue_alert` no varrer diário.
4. Plugar `crm:opportunity_created` em `useLeads.addLead`.
5. Plugar `ai:insight` quando houver geração real de recomendações.
