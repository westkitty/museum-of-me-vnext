/**
 * Deterministic, visual-only camera crane for the ceremonial arrival.
 * Offsets are applied after PlayerController.applyToCamera() inside the one
 * existing render loop. Never alter player position, physics, streaming,
 * controls, or the canonical Starsilk sky.
 */
export interface ArrivalCameraOffset {
  readonly rise: number;
  readonly retreat: number;
  readonly pitch: number;
}
export const ARRIVAL_MAX_EXTRA_WAIT_MS = 4000;

export function canEnterArrival(elapsedMs: number, minDwellMs: number, criticalReady: boolean): boolean {
  if (!Number.isFinite(elapsedMs) || elapsedMs < Math.max(0, minDwellMs)) return false;
  return criticalReady || elapsedMs >= Math.max(0, minDwellMs) + ARRIVAL_MAX_EXTRA_WAIT_MS;
}

export function sampleArrivalCamera(elapsedMs: number, durationMs: number): ArrivalCameraOffset {
  const duration = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 4000;
  const t = Math.max(0, Math.min(1, (Number.isFinite(elapsedMs) ? elapsedMs : duration) / duration));
  const eased = t * t * (3 - 2 * t);
  const remainder = 1 - eased;
  return {
    rise: 9 * remainder,
    retreat: 18 * remainder,
    pitch: 0.46 * remainder,
  };
}
