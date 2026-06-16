import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_SOUND_PREFERENCES,
  SOUND_PREFS_KEY,
  type SoundPreferences,
} from "@/lib/sound/soundManager";
import type { KoraSoundModule } from "@/lib/sound/soundEvents";

function readPrefs(): SoundPreferences {
  if (typeof window === "undefined") return DEFAULT_SOUND_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(SOUND_PREFS_KEY);
    if (!raw) return DEFAULT_SOUND_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<SoundPreferences>;
    return {
      ...DEFAULT_SOUND_PREFERENCES,
      ...parsed,
      modules: { ...DEFAULT_SOUND_PREFERENCES.modules, ...(parsed.modules ?? {}) },
      quietHours: { ...DEFAULT_SOUND_PREFERENCES.quietHours, ...(parsed.quietHours ?? {}) },
    };
  } catch {
    return DEFAULT_SOUND_PREFERENCES;
  }
}

function writePrefs(prefs: SoundPreferences) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SOUND_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* storage may be unavailable — ignore */
  }
}

export function useSoundPreferences() {
  const [prefs, setPrefsState] = useState<SoundPreferences>(() => readPrefs());

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === SOUND_PREFS_KEY) setPrefsState(readPrefs());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((patch: Partial<SoundPreferences>) => {
    setPrefsState((prev) => {
      const next: SoundPreferences = {
        ...prev,
        ...patch,
        modules: { ...prev.modules, ...(patch.modules ?? {}) },
        quietHours: { ...prev.quietHours, ...(patch.quietHours ?? {}) },
      };
      writePrefs(next);
      return next;
    });
  }, []);

  const setEnabled = useCallback((enabled: boolean) => update({ enabled }), [update]);
  const setVolume = useCallback((volume: number) => update({ volume }), [update]);

  const toggleModule = useCallback(
    (module: KoraSoundModule, value: boolean) =>
      setPrefsState((prev) => {
        const next: SoundPreferences = {
          ...prev,
          modules: { ...prev.modules, [module]: value },
        };
        writePrefs(next);
        return next;
      }),
    [],
  );

  const muteFor = useCallback((minutes: number | null) => {
    update({
      mutedUntil:
        minutes === null
          ? null
          : new Date(Date.now() + minutes * 60_000).toISOString(),
    });
  }, [update]);

  const setQuietHours = useCallback(
    (patch: Partial<SoundPreferences["quietHours"]>) =>
      setPrefsState((prev) => {
        const next: SoundPreferences = {
          ...prev,
          quietHours: { ...prev.quietHours, ...patch },
        };
        writePrefs(next);
        return next;
      }),
    [],
  );

  const setUnansweredAlert = useCallback(
    (patch: Partial<SoundPreferences["unansweredAlert"]>) =>
      setPrefsState((prev) => {
        const next: SoundPreferences = {
          ...prev,
          unansweredAlert: { ...prev.unansweredAlert, ...patch },
        };
        writePrefs(next);
        return next;
      }),
    [],
  );

  return {
    prefs,
    update,
    setEnabled,
    setVolume,
    toggleModule,
    muteFor,
    setQuietHours,
    setUnansweredAlert,
  };
}
