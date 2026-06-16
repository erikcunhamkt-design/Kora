import { SOUND_EVENTS, type KoraSoundEvent, type KoraSoundModule } from "./soundEvents";

export const SOUND_PREFS_KEY = "kora.sound.preferences.v1";

export interface SoundPreferences {
  enabled: boolean;
  volume: number; // 0..1
  mutedUntil: string | null;
  modules: Record<KoraSoundModule, boolean>;
  quietHours: {
    enabled: boolean;
    start: string; // HH:mm
    end: string;   // HH:mm
  };
}

export const DEFAULT_SOUND_PREFERENCES: SoundPreferences = {
  enabled: false,
  volume: 0.4,
  mutedUntil: null,
  modules: {
    whatsapp: true,
    campaigns: true,
    crm: true,
    finance: true,
    tasks: true,
    ai: true,
  },
  quietHours: {
    enabled: false,
    start: "22:00",
    end: "08:00",
  },
};

const audioCache = new Map<string, HTMLAudioElement>();
const lastPlayedAt = new Map<KoraSoundEvent, number>();

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

function isWithinQuietHours(prefs: SoundPreferences, now = new Date()): boolean {
  if (!prefs.quietHours.enabled) return false;
  const toMin = (s: string) => {
    const [h, m] = s.split(":").map((n) => parseInt(n, 10) || 0);
    return h * 60 + m;
  };
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const start = toMin(prefs.quietHours.start);
  const end = toMin(prefs.quietHours.end);
  if (start === end) return false;
  return start < end ? nowMin >= start && nowMin < end : nowMin >= start || nowMin < end;
}

function getAudio(src: string): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  let audio = audioCache.get(src);
  if (!audio) {
    try {
      audio = new Audio(src);
      audio.preload = "auto";
      audioCache.set(src, audio);
    } catch {
      return null;
    }
  }
  return audio;
}

export interface PlaySoundOptions {
  /** Skip throttle/quiet hours (used by "Testar som"). Still respects enabled+volume. */
  force?: boolean;
}

export function playKoraSound(event: KoraSoundEvent, opts: PlaySoundOptions = {}): void {
  if (typeof window === "undefined") return;
  const def = SOUND_EVENTS[event];
  if (!def) return;
  const prefs = readPrefs();
  if (!prefs.enabled) return;
  if (!prefs.modules[def.module]) return;

  if (!opts.force) {
    if (prefs.mutedUntil) {
      const until = Date.parse(prefs.mutedUntil);
      if (!Number.isNaN(until) && until > Date.now()) return;
    }
    if (isWithinQuietHours(prefs)) return;
    const last = lastPlayedAt.get(event) ?? 0;
    if (Date.now() - last < def.throttleMs) return;
  }

  const audio = getAudio(def.src);
  if (!audio) return;
  try {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = Math.max(0, Math.min(1, prefs.volume * def.gain));
    const result = audio.play();
    if (result && typeof result.catch === "function") {
      result.catch(() => {
        // autoplay blocked or asset missing — ignore silently
      });
    }
    lastPlayedAt.set(event, Date.now());
  } catch {
    // never break the app for an audio failure
  }
}

export function previewKoraSound(event: KoraSoundEvent): void {
  playKoraSound(event, { force: true });
}

export function stopAllKoraSounds(): void {
  audioCache.forEach((audio) => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      /* noop */
    }
  });
}
