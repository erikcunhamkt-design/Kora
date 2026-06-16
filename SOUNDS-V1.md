# KORA Hub — Sons do Sistema V1 (QA Funcional)

Documento técnico-funcional da camada de áudio do KORA Hub, conforme implementada na V1.

## 1. Arquitetura

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/sound/soundEvents.ts` | Tipos `KoraSoundEvent` / `KoraSoundModule`, mapa `SOUND_EVENTS` (src + module + gain + throttleMs), labels |
| `src/lib/sound/soundManager.ts` | `playKoraSound`, `previewKoraSound`, `stopAllKoraSounds`, leitura de prefs, throttle, quiet hours, mute, cache de `Audio` |
| `src/hooks/useSoundPreferences.ts` | CRUD reativo das preferências + sync entre abas |
| `src/components/settings/SoundPreferencesSection.tsx` | UI premium em Configurações → Aparência |
| `src/assets/sounds/*.mp3` | 6 placeholders curtos (notification/success/error/task/ai/campaign) |

## 2. Eventos sonoros (15)

```
whatsapp:new_message, whatsapp:sent, whatsapp:human_takeover,
campaign:created, campaign:batch_success, campaign:batch_error, campaign:completed,
crm:opportunity_created, quotes:approved,
finance:paid, finance:overdue_alert,
tasks:completed, tasks:overdue_alert,
ai:enabled, ai:insight
```

## 3. Preferências

Chave `localStorage`: `kora.sound.preferences.v1`

```ts
{ enabled: boolean; volume: 0..1; mutedUntil: string|null;
  modules: { whatsapp, campaigns, crm, finance, tasks, ai };
  quietHours: { enabled, start "HH:mm", end "HH:mm" } }
```

Defaults: `enabled=false`, `volume=0.4`, todos módulos `true`, quiet hours off (22:00–08:00).

## 4. Modo silencioso e quiet hours

- Botões: 1h, 4h, até amanhã (12h), com botão Reativar.
- Quiet hours suporta intervalo que atravessa meia-noite (`start > end`).
- `previewKoraSound` (Testar som) ignora throttle/quiet hours/mute mas respeita `enabled` e volume.

## 5. Anti-spam

`lastPlayedAt: Map<KoraSoundEvent, number>` em memória. Throttle padrão 3s, configurável por evento:
- WhatsApp inbound: 5s
- WhatsApp enviado / Task: 1.5s
- Campanha: toca apenas no encerramento do `simulateSend` (não por recipient).

## 6. Integrações V1

| Evento | Onde |
|---|---|
| `whatsapp:new_message` | `useWhatsAppConversations` — INSERT/UPDATE quando `last_message_at` avança e `id !== selectedId` |
| `tasks:completed` | `useTasks.moveTask` → status `concluido` |
| `quotes:approved` | `useQuotes.updateStatus` → status `aprovado` |
| `campaign:completed` | `useCampaigns.simulateSend` (sucesso) |
| `campaign:batch_error` | `useCampaigns.simulateSend` (sent=0) |

## 7. Tratamento de falhas

- `try/catch` em `new Audio`, `audio.play().catch()` silencioso → autoplay bloqueado nunca quebra o app.
- `try/catch` em `localStorage.getItem/setItem`.
- Sem listeners agressivos, sem loops.

## 8. Resultado do QA

| # | Item | Status |
|---|---|---|
| 1 | Default desligado, não toca antes de ativar | ✅ |
| 2 | Ativar/desativar persistente | ✅ |
| 3 | Volume 0–100% aplicado e persistido | ✅ |
| 4 | Toggles por módulo bloqueiam corretamente | ✅ |
| 5 | Modo silencioso 1h/4h/até amanhã + reativar | ✅ |
| 6 | Quiet hours, inclusive cruzando meia-noite | ✅ |
| 7 | Throttle anti-spam por evento | ✅ |
| 8 | Integrações V1 (5 de 6 — `ai:insight` aguardando hook real) | ⚠️ Parcial |
| 9 | Autoplay/áudio bloqueado não quebra | ✅ |
| 10 | UI premium em Configurações → Aparência | ✅ |

## 9. Limitações conhecidas

- `ai:insight` não foi plugado — não há gerador real de insights no app ainda.
- `finance:paid` / `finance:overdue_alert` / `tasks:overdue_alert` / `crm:opportunity_created` / `whatsapp:human_takeover` / `whatsapp:sent` / `campaign:created` / `ai:enabled` definidos no tipo, sem integração V1.
- Conclusão de tarefa via `updateTask({ status })` direto não toca som — apenas `moveTask`. Centralizar conclusão em `moveTask` cobre todos os fluxos.
- `mutedUntil` expira na próxima tentativa de play; não há timer reativo para atualizar a label "Silenciado por mais Xmin" automaticamente (atualiza ao trocar de aba/reabrir).
- Sons são tons sintéticos de placeholder — recomendado substituir por assets premium reais antes do GA.

## 10. Próximos eventos a integrar

1. `finance:paid` no toggle de recebível pago.
2. `tasks:overdue_alert` no varrer diário de tarefas atrasadas.
3. `crm:opportunity_created` em `useLeads.addLead`.
4. `ai:insight` quando houver geração real de recomendações.
5. `whatsapp:sent` em `sendMessage` (opt-in extra por ser ruidoso).
