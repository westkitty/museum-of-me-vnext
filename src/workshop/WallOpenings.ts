/**
 * Local wall segment compiler. Door and window voids are actual absent mesh,
 * not a dark texture or false promise of an opening.
 * Fractions are independent of the wall's authored scale and rotation.
 */
export type WallOpeningKind = 'none' | 'door' | 'window';

export interface WallOpeningDimensions {
  readonly width: number;   // fraction of local wall width
  readonly height: number;  // fraction of local wall height
  readonly sill: number;    // fraction from floor to opening bottom
}

export interface WallSolidSegment {
  readonly width: number;
  readonly height: number;
  readonly centerX: number;
  readonly centerY: number;
}

export function defaultOpening(kind: WallOpeningKind): WallOpeningDimensions {
  return kind === 'door'
    ? { width: 0.42, height: 0.73, sill: 0 }
    : { width: 0.45, height: 0.38, sill: 0.32 };
}

export function wallOpeningSegments(
  kind: WallOpeningKind,
  dimensions = defaultOpening(kind),
): readonly WallSolidSegment[] {
  if (kind === 'none') return [{ width: 1, height: 3, centerX: 0, centerY: 1.5 }];
  const { width, height, sill } = dimensions;
  if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(sill)
    || width < 0.2 || width > 0.8 || height < 0.2 || height > 0.9
    || sill < 0 || sill > 0.65 || sill + height > 0.92
    || (kind === 'door' && sill !== 0) || (kind === 'window' && sill < 0.1)) {
    throw new Error('Wall opening dimensions are outside the supported safe ranges');
  }
  const sideWidth = (1 - width) / 2;
  const solids: WallSolidSegment[] = [
    { width: sideWidth, height: 3, centerX: -0.5 + sideWidth / 2, centerY: 1.5 },
    { width: sideWidth, height: 3, centerX: 0.5 - sideWidth / 2, centerY: 1.5 },
  ];
  if (sill > 0) solids.push({
    width, height: sill * 3, centerX: 0, centerY: sill * 1.5,
  });
  const above = 1 - sill - height;
  if (above > 0) solids.push({
    width, height: above * 3, centerX: 0, centerY: (sill + height + above / 2) * 3,
  });
  return solids;
}
