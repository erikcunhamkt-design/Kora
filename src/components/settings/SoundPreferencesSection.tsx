import { useMemo } from "react";
import { Volume2, VolumeX, Play, Moon, AlarmClock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { useSoundPreferences } from "@/hooks/useSoundPreferences";
import { previewKoraSound } from "@/lib/sound/soundManager";
import {
  MODULE_LABELS,
  SOUND_EVENTS,
  type KoraSoundEvent,
  type KoraSoundModule,
} from "@/lib/sound/soundEvents";

const MODULE_PREVIEW: Record<KoraSoundModule, KoraSoundEvent> = {
  whatsapp: "whatsapp:new_message",
  campaigns: "campaign:completed",
  crm: "quotes:approved",
  finance: "finance:paid",
  tasks: "tasks:completed",
  ai: "ai:insight",
};

export function SoundPreferencesSection() {
  const {
    prefs,
    setEnabled,
    setVolume,
    toggleModule,
    muteFor,
    setQuietHours,
    setUnansweredAlert,
  } = useSoundPreferences();

  const mutedRemainingLabel = useMemo(() => {
    if (!prefs.mutedUntil) return null;
    const until = Date.parse(prefs.mutedUntil);
    if (Number.isNaN(until) || until <= Date.now()) return null;
    const mins = Math.round((until - Date.now()) / 60_000);
    if (mins < 60) return `Silenciado por mais ${mins} min`;
    const hours = Math.round(mins / 60);
    return `Silenciado por mais ~${hours}h`;
  }, [prefs.mutedUntil]);

  return (
    <SettingsSection
      title="Sons do sistema"
      description="Use sons discretos para eventos importantes. Você pode desativar a qualquer momento."
    >
      <SettingsCard>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/15 border border-primary/25 text-primary flex items-center justify-center">
              {prefs.enabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Ativar sons do KORA</p>
              <p className="text-xs text-muted-foreground">
                Notificações sonoras curtas para mensagens, tarefas e alertas importantes.
              </p>
            </div>
          </div>
          <Switch checked={prefs.enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Volume
            </Label>
            <span className="text-xs text-muted-foreground tabular-nums">
              {Math.round(prefs.volume * 100)}%
            </span>
          </div>
          <Slider
            value={[Math.round(prefs.volume * 100)]}
            onValueChange={([v]) => setVolume((v ?? 0) / 100)}
            min={0}
            max={100}
            step={5}
            disabled={!prefs.enabled}
            aria-label="Volume dos sons"
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground mr-2">Silenciar:</span>
          <Button size="sm" variant="outline" onClick={() => muteFor(60)} disabled={!prefs.enabled}>
            1 hora
          </Button>
          <Button size="sm" variant="outline" onClick={() => muteFor(240)} disabled={!prefs.enabled}>
            4 horas
          </Button>
          <Button size="sm" variant="outline" onClick={() => muteFor(60 * 12)} disabled={!prefs.enabled}>
            Até amanhã
          </Button>
          {mutedRemainingLabel && (
            <>
              <span className="text-xs text-muted-foreground ml-2">{mutedRemainingLabel}</span>
              <Button size="sm" variant="ghost" onClick={() => muteFor(null)}>
                Reativar
              </Button>
            </>
          )}
        </div>
      </SettingsCard>

      <SettingsCard>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted/40 border border-border text-muted-foreground flex items-center justify-center">
              <Moon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Modo silencioso por horário</p>
              <p className="text-xs text-muted-foreground">
                Não tocar sons fora do horário de trabalho.
              </p>
            </div>
          </div>
          <Switch
            checked={prefs.quietHours.enabled}
            onCheckedChange={(enabled) => setQuietHours({ enabled })}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 max-w-xs">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Início</Label>
            <Input
              type="time"
              value={prefs.quietHours.start}
              onChange={(e) => setQuietHours({ start: e.target.value })}
              disabled={!prefs.quietHours.enabled}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Fim</Label>
            <Input
              type="time"
              value={prefs.quietHours.end}
              onChange={(e) => setQuietHours({ end: e.target.value })}
              disabled={!prefs.quietHours.enabled}
            />
          </div>
        </div>
      </SettingsCard>

      <SettingsCard>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/15 border border-primary/25 text-primary flex items-center justify-center">
              <AlarmClock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Alerta de WhatsApp sem resposta</p>
              <p className="text-xs text-muted-foreground">
                Toca um som em loop quando uma conversa fica sem resposta acima do tempo definido.
                Para automaticamente ao abrir a conversa.
              </p>
            </div>
          </div>
          <Switch
            checked={prefs.unansweredAlert.enabled}
            onCheckedChange={(enabled) => setUnansweredAlert({ enabled })}
            disabled={!prefs.enabled || !prefs.modules.whatsapp}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 max-w-md">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Disparar após (minutos)</Label>
            <Input
              type="number"
              min={1}
              max={240}
              value={prefs.unansweredAlert.thresholdMinutes}
              onChange={(e) =>
                setUnansweredAlert({
                  thresholdMinutes: Math.max(1, parseInt(e.target.value, 10) || 1),
                })
              }
              disabled={!prefs.unansweredAlert.enabled}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Repetir a cada (segundos)</Label>
            <Input
              type="number"
              min={5}
              max={600}
              value={prefs.unansweredAlert.repeatSeconds}
              onChange={(e) =>
                setUnansweredAlert({
                  repeatSeconds: Math.max(5, parseInt(e.target.value, 10) || 5),
                })
              }
              disabled={!prefs.unansweredAlert.enabled}
            />
          </div>
        </div>

        <div className="mt-4">
          <Button
            size="sm"
            variant="outline"
            onClick={() => previewKoraSound("whatsapp:unanswered_alert")}
            disabled={!prefs.enabled || !prefs.modules.whatsapp}
          >
            <Play className="h-3.5 w-3.5 mr-1" />
            Testar som de alerta
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard>
        <p className="text-sm font-medium text-foreground mb-3">Módulos com som</p>
        <div className="divide-y divide-border/40">
          {(Object.keys(MODULE_LABELS) as KoraSoundModule[]).map((mod) => (
            <div key={mod} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm text-foreground">{MODULE_LABELS[mod]}</p>
                <p className="text-xs text-muted-foreground">
                  {SOUND_EVENTS[MODULE_PREVIEW[mod]] ? "Eventos discretos deste módulo." : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => previewKoraSound(MODULE_PREVIEW[mod])}
                  disabled={!prefs.enabled || !prefs.modules[mod]}
                  aria-label={`Testar som de ${MODULE_LABELS[mod]}`}
                >
                  <Play className="h-3.5 w-3.5 mr-1" />
                  Testar
                </Button>
                <Switch
                  checked={prefs.modules[mod]}
                  onCheckedChange={(v) => toggleModule(mod, v)}
                  disabled={!prefs.enabled}
                  aria-label={`Ativar sons de ${MODULE_LABELS[mod]}`}
                />
              </div>
            </div>
          ))}
        </div>
      </SettingsCard>
    </SettingsSection>
  );
}
