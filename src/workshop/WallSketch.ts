/** Deterministic Sims-style two-click wall drawing math. No renderer state. */
export type WallPoint = readonly [number, number, number];
export interface WallSegment {
  readonly position: [number, number, number];
  readonly rotation: [number, number, number];
  readonly scale: [number, number, number];
}
export function snapWallPoint(point: WallPoint, step: number): WallPoint {
  if (!(step > 0) || !Number.isFinite(step)) return point;
  const snap = (n: number): number => Math.round(n / step) * step;
  return [snap(point[0]), point[1], snap(point[2])];
}
/**
 * A BoxGeometry(1,3,.15) starts with its length on local X and its base at
 * ground height. Yaw maps local +X into the drawn XZ segment. Undo uses the
 * same record no matter which camera or viewport performed the drawing.
 */
export function measureWall(start: WallPoint, end: WallPoint): WallSegment | null {
  if (![...start, ...end].every(Number.isFinite)) return null;
  if (Math.abs(start[1] - end[1]) > 0.001) return null;
  const dx = end[0] - start[0], dz = end[2] - start[2];
  const length = Math.hypot(dx, dz);
  if (length < 0.25 || length > 100) return null;
  return {
    position: [(start[0] + end[0]) / 2, start[1], (start[2] + end[2]) / 2],
    rotation: [0, dz === 0 && dx >= 0 ? 0 : Math.atan2(-dz, dx), 0],
    scale: [length, 1, 1],
  };
}
