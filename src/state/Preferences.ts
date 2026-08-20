import type { QualityTier } from '../render/QualityTiers';

export interface VisitorPreferences {
  readonly version: number;
  quality: QualityTier | 'auto';
  reducedMotion: boolean;
  highContrast: boolean;
  uiScale: number;
  subtitles: boolean;
  masterVolume: number;
  ambienceVolume: number;
  mouseSensitivity: number;
  invertY: boolean;
  /** Persist as a hint only; the museum never gates content on it. */
  fieldOfView: number;
}

const KEY = 'museum-of-me:preferences';
export const PREFERENCES_VERSION = 1;

export const DEFAULT_PREFERENCES: VisitorPreferences = {
  version: PREFERENCES_VERSION,
  quality: 'auto',
  reducedMotion: false,
  highContrast: false,
  uiScale: 1,
  subtitles: true,
  masterVolume: 0.7,
  ambienceVolume: 0.5,
  mouseSensitivity: 1,
  invertY: false,
  fieldOfView: 65,
};

function systemPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Versioned load. An unrecognised or older payload falls back to defaults for
 * the fields it cannot supply rather than being discarded wholesale.
 */
export function loadPreferences(storage: Storage | null = safeStorage()): VisitorPreferences {
  const base: VisitorPreferences = { ...DEFAULT_PREFERENCES, reducedMotion: systemPrefersReducedMotion() };
  if (!storage) return base;
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<VisitorPreferences>;
    if (typeof parsed !== 'object' || parsed === null) return base;
    return { ...base, ...parsed, version: PREFERENCES_VERSION };
  } catch {
    return base;
  }
}

export function savePreferences(prefs: VisitorPreferences, storage: Storage | null = safeStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(KEY, JSON.stringify({ ...prefs, version: PREFERENCES_VERSION }));
  } catch {
    /* storage unavailable (private mode, quota) — the museum still works */
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
