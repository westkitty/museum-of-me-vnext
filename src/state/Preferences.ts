import type { QualityTier } from '../render/QualityTiers';
import { checksumPayload } from './integrity';

export type MotionPreference = 'system' | 'reduce' | 'full';
export type FrameCap = 'auto' | '30' | '60' | 'unlimited';
export type InterfaceDensity = 'comfortable' | 'compact';

export interface VisitorPreferences {
  readonly version: number;
  quality: QualityTier | 'auto';
  reducedMotion: boolean;
  motion: MotionPreference;
  highContrast: boolean;
  uiScale: number;
  subtitles: boolean;
  masterVolume: number;
  ambienceVolume: number;
  mouseSensitivity: number;
  touchSensitivity: number;
  invertY: boolean;
  fieldOfView: number;
  hudOpacity: number;
  autoPauseOnBlur: boolean;
  frameCap: FrameCap;
  wakeLock: boolean;
  showMapVisitors: boolean;
  showStats: boolean;
  reducedTransparency: boolean;
  showTooltips: boolean;
  interfaceDensity: InterfaceDensity;
}

export interface PreferencesLoadResult {
  preferences: VisitorPreferences;
  migrated: boolean;
  quarantined: boolean;
  notice: string | null;
}

const KEY = 'museum-of-me:preferences';
const KEY_V2 = 'museum-of-me:preferences:v2';
const BACKUP_KEY = 'museum-of-me:preferences:backup';
const QUARANTINE_KEY = 'museum-of-me:preferences:quarantine';
export const PREFERENCES_VERSION = 2;

export const DEFAULT_PREFERENCES: VisitorPreferences = {
  version: PREFERENCES_VERSION,
  quality: 'auto',
  reducedMotion: false,
  motion: 'system',
  highContrast: false,
  uiScale: 1,
  subtitles: true,
  masterVolume: 0.7,
  ambienceVolume: 0.5,
  mouseSensitivity: 1,
  touchSensitivity: 1,
  invertY: false,
  fieldOfView: 65,
  hudOpacity: 0.88,
  autoPauseOnBlur: true,
  frameCap: 'auto',
  wakeLock: false,
  showMapVisitors: true,
  showStats: false,
  reducedTransparency: false,
  showTooltips: true,
  interfaceDensity: 'comfortable',
};

function systemPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function finite(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function qualityFromSource(value: unknown): QualityTier | 'auto' {
  if (value === 'auto' || value === 'low' || value === 'medium' || value === 'high') return value;
  if (value === 'balanced') return 'medium';
  return DEFAULT_PREFERENCES.quality;
}

export function sanitizePreferences(value: unknown): VisitorPreferences {
  const raw = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<VisitorPreferences> & { fov?: number; motion?: string }
    : {};
  const motion: MotionPreference =
    raw.motion === 'reduce' || raw.motion === 'full' || raw.motion === 'system'
      ? raw.motion
      : DEFAULT_PREFERENCES.motion;
  const reducedMotion = raw.reducedMotion === true || motion === 'reduce';
  const density = raw.interfaceDensity;
  const cap = String((raw as { frameCap?: string }).frameCap ?? DEFAULT_PREFERENCES.frameCap);
  return {
    version: PREFERENCES_VERSION,
    quality: qualityFromSource(raw.quality),
    reducedMotion,
    motion: reducedMotion && motion === 'system' ? 'reduce' : motion,
    highContrast: raw.highContrast === true,
    uiScale: finite(raw.uiScale, 1, 0.85, 1.6),
    subtitles: raw.subtitles !== false,
    masterVolume: finite(raw.masterVolume, 0.7, 0, 1),
    ambienceVolume: finite(raw.ambienceVolume, 0.5, 0, 1),
    mouseSensitivity: finite(raw.mouseSensitivity, 1, 0.45, 2.25),
    touchSensitivity: finite(raw.touchSensitivity, 1, 0.45, 2.25),
    invertY: raw.invertY === true,
    fieldOfView: finite(raw.fieldOfView ?? raw.fov, 65, 48, 95),
    hudOpacity: finite(raw.hudOpacity, 0.88, 0.5, 1),
    autoPauseOnBlur: raw.autoPauseOnBlur !== false,
    frameCap: cap === '30' || cap === '60' || cap === 'unlimited' || cap === 'auto' ? cap : 'auto',
    wakeLock: raw.wakeLock === true,
    showMapVisitors: raw.showMapVisitors !== false,
    showStats: raw.showStats === true,
    reducedTransparency: raw.reducedTransparency === true,
    showTooltips: raw.showTooltips !== false,
    interfaceDensity: density === 'compact' || density === 'comfortable' ? density : 'comfortable',
  };
}

export function isSafeMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('safe') === '1';
}

/** Session overlay: does not mutate the stored preference record. */
export function applySafeModeOverlay(base: VisitorPreferences): VisitorPreferences {
  if (!isSafeMode()) return base;
  return sanitizePreferences({
    ...base,
    quality: 'low',
    motion: 'reduce',
    reducedMotion: true,
    showStats: false,
    frameCap: '30',
    wakeLock: false,
  });
}

function quarantine(storage: Storage, raw: string, reason: string): void {
  try {
    storage.setItem(QUARANTINE_KEY, JSON.stringify({
      at: new Date().toISOString(),
      reason,
      digest: checksumPayload(raw),
      payload: raw.slice(0, 120_000),
    }));
  } catch { /* quota */ }
}

export function loadPreferencesResult(storage: Storage | null = safeStorage()): PreferencesLoadResult {
  const base: VisitorPreferences = {
    ...DEFAULT_PREFERENCES,
    reducedMotion: systemPrefersReducedMotion(),
    motion: systemPrefersReducedMotion() ? 'reduce' : 'system',
  };
  if (!storage) return { preferences: applySafeModeOverlay(base), migrated: false, quarantined: false, notice: null };
  const tryParse = (raw: string | null): unknown => {
    if (!raw) return null;
    return JSON.parse(raw);
  };
  try {
    const current = storage.getItem(KEY_V2) ?? storage.getItem(KEY);
    if (!current) return { preferences: applySafeModeOverlay(base), migrated: false, quarantined: false, notice: null };
    const parsed = tryParse(current);
    if (typeof parsed !== 'object' || parsed === null) {
      quarantine(storage, current, 'wrong-shape');
      return { preferences: applySafeModeOverlay(base), migrated: false, quarantined: true, notice: 'Preferences were unreadable and have been quarantined. Defaults are in use; the previous payload was kept.' };
    }
    const version = Number((parsed as { version?: number }).version);
    if (Number.isFinite(version) && version > PREFERENCES_VERSION) {
      quarantine(storage, current, 'future-version');
      return { preferences: applySafeModeOverlay(base), migrated: false, quarantined: true, notice: 'A newer preference format was rejected. Your previous file is quarantined.' };
    }
    const migrated = version !== PREFERENCES_VERSION || storage.getItem(KEY_V2) === null;
    const sanitized = sanitizePreferences({ ...base, ...(parsed as object) });
    if (migrated) {
      try { storage.setItem(BACKUP_KEY, current); } catch { /* quota */ }
      savePreferences(sanitized, storage);
    }
    return {
      preferences: applySafeModeOverlay(sanitized),
      migrated,
      quarantined: false,
      notice: migrated ? 'Visitor preferences were migrated to the current schema. The previous payload is backed up.' : null,
    };
  } catch {
    const raw = storage.getItem(KEY_V2) ?? storage.getItem(KEY) ?? '';
    if (raw) quarantine(storage, raw, 'malformed-json');
    return { preferences: applySafeModeOverlay(base), migrated: false, quarantined: true, notice: 'Preferences JSON was corrupt and has been quarantined. Defaults are in use.' };
  }
}

export function loadPreferences(storage: Storage | null = safeStorage()): VisitorPreferences {
  return loadPreferencesResult(storage).preferences;
}

export function savePreferences(prefs: VisitorPreferences, storage: Storage | null = safeStorage()): void {
  if (!storage) return;
  const incoming = sanitizePreferences(prefs);
  const stored = isSafeMode()
    ? sanitizePreferences({
      ...incoming,
      quality: loadStoredBase(storage).quality ?? DEFAULT_PREFERENCES.quality,
      motion: loadStoredBase(storage).motion ?? DEFAULT_PREFERENCES.motion,
      reducedMotion: loadStoredBase(storage).reducedMotion ?? DEFAULT_PREFERENCES.reducedMotion,
      frameCap: loadStoredBase(storage).frameCap ?? DEFAULT_PREFERENCES.frameCap,
      wakeLock: loadStoredBase(storage).wakeLock ?? DEFAULT_PREFERENCES.wakeLock,
      showStats: loadStoredBase(storage).showStats ?? DEFAULT_PREFERENCES.showStats,
    })
    : incoming;
  try {
    const previous = storage.getItem(KEY_V2);
    if (previous) storage.setItem(BACKUP_KEY, previous);
    storage.setItem(KEY_V2, JSON.stringify(stored));
    storage.setItem(KEY, JSON.stringify(stored));
  } catch { /* quota / private mode */ }
}

function loadStoredBase(storage: Storage): Partial<VisitorPreferences> {
  try {
    // KEY_V2 is the current real value; BACKUP_KEY is only set to what KEY_V2
    // held immediately before the save now in progress (see savePreferences
    // below), so it is always one save behind. Reading it first pulled a
    // stale value for every Safe-Mode-protected field on every subsequent
    // save, silently reverting real, current settings the visitor had
    // already saved.
    const raw = storage.getItem(KEY_V2) ?? storage.getItem(BACKUP_KEY) ?? storage.getItem(KEY);
    if (!raw) return {};
    return sanitizePreferences(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function restorePreviousPreferences(storage: Storage | null = safeStorage()): VisitorPreferences | null {
  if (!storage) return null;
  const raw = storage.getItem(BACKUP_KEY);
  if (!raw) return null;
  try {
    const sanitized = sanitizePreferences(JSON.parse(raw));
    savePreferences(sanitized, storage);
    return applySafeModeOverlay(sanitized);
  } catch {
    return null;
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
