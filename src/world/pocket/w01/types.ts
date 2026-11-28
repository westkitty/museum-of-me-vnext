export type W01ReefId = 'turtle' | 'ray' | 'whale';

export type W01StationId = 'central' | W01ReefId | 'cathedral';

export type W01StemId = 'bass' | 'drums' | 'other';

/**
 * Configurable encounter-to-stem mapping. Provisional per owner direction
 * (Turtle -> bass, Ray -> drums, Whale -> other).
 */
export interface W01StemMapping {
  readonly turtle: W01StemId;
  readonly ray: W01StemId;
  readonly whale: W01StemId;
}

export const DEFAULT_W01_STEM_MAPPING: W01StemMapping = Object.freeze({
  turtle: 'bass',
  ray: 'drums',
  whale: 'other',
});

export type W01MusicSourceMode = 'bundled-original';

export type W01CathedralPhase = 'apart' | 'assembling' | 'assembled' | 'completed';

export interface W01StateSnapshot {
  readonly station: W01StationId;
  readonly ridingTo: W01StationId | null;
  readonly rideProgress: number;
  readonly envActions: Readonly<Record<W01ReefId, boolean>>;
  readonly awakened: Readonly<Record<W01ReefId, boolean>>;
  readonly cathedralPhase: W01CathedralPhase;
  readonly cathedralProgress: number;
  readonly musicSourceMode: W01MusicSourceMode;
  readonly activeStems: readonly W01StemId[];
  readonly completionEligible: boolean;
  readonly lastMusicCue: string | null;
}
