import type { Vec3 } from '../world/layout';

/** Nominal closed-route preview, not collision-resolved runtime telemetry. */
export interface RoutePreview {
  readonly route: readonly Vec3[];
  readonly segments: readonly number[];
  readonly distance: number;
  readonly duration: number;
  readonly speed: number;
  readonly pause: number;
}

export const TIMELINE_SECONDS = 600;
export function timelineTime(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(TIMELINE_SECONDS, value)) : 0;
}

export function routePreview(route: readonly Vec3[], speed: number, pause: readonly number[]): RoutePreview {
  const points = route.filter(p => p.length === 3 && p.every(Number.isFinite));
  const safeSpeed = Number.isFinite(speed) && speed > 0 ? speed : 0;
  const meanPause = (pause[0] + pause[1]) / 2;
  const safePause = Number.isFinite(meanPause) ? Math.max(0, meanPause) : 0;
  const segments = points.map((p, i) => {
    const next = points[(i + 1) % points.length];
    return Math.hypot(next[0] - p[0], next[2] - p[2]);
  });
  const distance = segments.reduce((a, b) => a + b, 0);
  return { route: points, segments, distance, speed: safeSpeed, pause: safePause,
    duration: safeSpeed > 0 ? distance / safeSpeed + points.length * safePause : 0 };
}

/** Walk starts at route[0], pauses at each destination, and interpolates all axes. */
export function previewPosition(preview: RoutePreview, time: number): Vec3 | null {
  const { route, segments, speed, duration, pause } = preview;
  if (!route.length) return null;
  if (speed === 0 || duration <= 0 || !Number.isFinite(duration)) return [...route[0]];
  let remaining = (Number.isFinite(time) ? Math.max(0, time) : 0) % duration;
  for (let i = 0; i < route.length; i++) {
    const next = route[(i + 1) % route.length];
    const walk = segments[i] / speed;
    if (walk > 0 && remaining < walk) {
      const t = remaining / walk;
      return [0, 1, 2].map(axis => route[i][axis] + (next[axis] - route[i][axis]) * t) as [number, number, number];
    }
    remaining -= walk;
    if (remaining < pause) return [...next];
    remaining -= pause;
  }
  return [...route[0]];
}
