# Plano — Sons do Sistema KORA V1

Camada de áudio premium, opcional e discreta. 100% frontend, sem backend/migrations.

## 1. Sound Manager

Criar `src/lib/sound/soundManager.ts`:

- Tipo `KoraSoundEvent` com os 15+ eventos do brief.
- Mapa `EVENT → { file, module, defaultVolume }`.
- `playKoraSound(event, opts?)`: lê prefs do localStorage, valida `enabled`, módulo, quiet hours e `mutedUntil`, aplica throttle por evento (mínimo 3s, configurável até 5s) e toca via `HTMLAudioElement` com `try/catch` silencioso (autoplay nunca quebra app).
- Cache de `Audio` por arquivo, `volume = prefs.volume * eventVolume`.
- `stopAll()`, `previewSound(event)` (ignora throttle e quiet hours, respeita volume).
- Lazy load — não pré-carrega tudo no boot.

## 2. Preferências

Criar `src/hooks/useSoundPreferences.ts`:

- Chave `kora.sound.preferences.v1`.
- Estrutura conforme spec (`enabled`, `volume 0..1`, `mutedUntil`, `modules`, `quietHours`).
- Padrão: `enabled: false`, `volume: 0.4`, todos módulos `true`, quiet hours desativado (22:00–08:00).
- API: `prefs`, `setPrefs`, `togglePref`, `muteFor(minutes)`.
- Sincroniza entre abas via `storage` event.

## 3. Assets

Criar `src/assets/sounds/` com 6 placeholders curtos em `.mp3`. Se geração de áudio não estiver disponível, criar arquivos vazios versionados e manager faz fallback silencioso sem erro (try/catch em `play()`).

Arquivos:
- `notification-soft.mp3`, `success-soft.mp3`, `error-soft.mp3`
- `task-complete.mp3`, `ai-pulse.mp3`, `campaign-complete.mp3`

## 4. UI de Configurações

Adicionar seção "Sons do sistema" em `src/pages/Configuracoes.tsx` (novo componente `src/components/settings/SoundPreferencesSection.tsx`):

- Toggle mestre "Ativar sons do KORA".
- Slider de volume (0–100).
- Botão "Silenciar por 1h / 4h / até amanhã".
- Quiet hours: toggle + inputs `time`.
- Toggles por módulo: WhatsApp, Campanhas, CRM, Financeiro, Tarefas, IA.
- Botão "Testar som" por seção.
- Microcopy: "Use sons discretos para eventos importantes. Você pode desativar a qualquer momento."
- Estética dark premium, tokens semânticos.

## 5. Integração V1 (6 pontos)

Apenas estes — nada espalhado:

1. WhatsApp nova mensagem recebida (quando conversa não está aberta) — em hook de mensagens.
2. Tarefa concluída — handler de toggle complete.
3. Orçamento aprovado — handler de aprovação.
4. Lote de campanha concluído — fim do batch, não por recipient.
5. Erro de campanha — falha de envio de lote.
6. Insight da KORA AI — quando IA gera recomendação visível.

Cada integração: 1 linha `playKoraSound("...")` dentro do success/error path existente.

## 6. Anti-spam

Implementado dentro do manager via `lastPlayedAt` por evento (Map em memória). Throttle padrão 3s, configurável por evento (mensagens WhatsApp 5s).

## 7. Acessibilidade

- Feedback visual nunca removido (toasts permanecem).
- Toggle global desliga tudo.
- Sem loops, sem repetição agressiva.
- `prefers-reduced-motion` não afeta áudio, mas respeitamos `enabled=false` como default.

## Detalhes técnicos

```text
src/
├── lib/sound/
│   ├── soundManager.ts        (play, throttle, prefs read)
│   └── soundEvents.ts         (tipo + mapa evento→arquivo)
├── hooks/
│   └── useSoundPreferences.ts (CRUD prefs + storage sync)
├── assets/sounds/             (6 .mp3 placeholders)
└── components/settings/
    └── SoundPreferencesSection.tsx
```

Sem novas deps. Sem `any`. Sem backend. Sem migrations. Sem webhooks.

## Fora do escopo V1

Outros 9 eventos definidos no tipo mas não integrados ainda (campanha criada, conversa assumida, IA pausada, recebível pago/vencido, tarefa atrasada, IA ativada, oportunidade criada, mensagem enviada). Manager pronto para receber as chamadas depois.
