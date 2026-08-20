export type QualityTier = 'low' | 'medium' | 'high';

export interface QualitySettings {
  readonly tier: QualityTier;
  /** Hard cap on device pixel ratio. Plan §24: DPR is always capped. */
  readonly maxPixelRatio: number;
  readonly shadows: boolean;
  readonly shadowMapSize: number;
  /** Metres. Radius at which Layer-2 wing detail is resident. */
  readonly wingStreamRadius: number;
  /** Metres. Radius at which Layer-3 exhibit payloads load. */
  readonly exhibitStreamRadius: number;
  /** Scales particle and instanced-detail counts across the museum. */
  readonly detailScale: number;
  readonly antialias: boolean;
  /** Ambient visitors. Plan §33: removed entirely on low. */
  readonly ambientVisitors: number;
}

export const QUALITY: Record<QualityTier, QualitySettings> = {
  low: {
    tier: 'low',
    maxPixelRatio: 1,
    shadows: false,
    shadowMapSize: 512,
    wingStreamRadius: 45,
    exhibitStreamRadius: 22,
    detailScale: 0.4,
    antialias: false,
    ambientVisitors: 0,
  },
  medium: {
    tier: 'medium',
    maxPixelRatio: 1.5,
    shadows: true,
    shadowMapSize: 1024,
    wingStreamRadius: 70,
    exhibitStreamRadius: 30,
    detailScale: 0.75,
    antialias: true,
    ambientVisitors: 4,
  },
  high: {
    tier: 'high',
    maxPixelRatio: 2,
    shadows: true,
    shadowMapSize: 2048,
    wingStreamRadius: 100,
    exhibitStreamRadius: 38,
    detailScale: 1,
    antialias: true,
    ambientVisitors: 6,
  },
};

/**
 * Pick an initial tier from cheap, synchronous signals. Deliberately
 * conservative: a visitor on `medium` who could have run `high` loses a little
 * detail; a visitor on `high` who cannot run it loses the museum.
 * Always overridable in settings.
 */
export function detectQualityTier(
  nav: { hardwareConcurrency?: number; deviceMemory?: number; userAgent?: string } = navigator as never,
  screenWidth = typeof window !== 'undefined' ? window.screen?.width ?? 1920 : 1920,
): QualityTier {
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  const ua = nav.userAgent ?? '';
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);

  if (mobile) return 'low';
  if (cores <= 4 || memory <= 4) return 'low';
  if (cores >= 8 && memory >= 8 && screenWidth >= 1440) return 'high';
  return 'medium';
}
