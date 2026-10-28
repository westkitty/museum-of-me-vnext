import { describe, expect, it } from 'vitest';
import { previewPosition, routePreview, timelineTime } from '../src/choreo/simulation';
import { SOURCE_VISITORS, visitorRouteForVNext } from '../src/content/sourceParity';
import { LEVEL_1_Y, type Vec3 } from '../src/world/layout';
import { mapLevelForY } from '../src/ui/MapPanel';

const route: Vec3[] = [[0, 0, 0], [3, 10, 4]];
describe('nominal choreographer route simulation', () => {
  it('measures horizontal distance, interpolates all axes, pauses at destinations, and wraps', () => {
    const model = routePreview(route, 1, [2, 2]);
    expect(model.distance).toBe(10);
    expect(model.duration).toBe(14);
    expect(previewPosition(model, 2.5)).toEqual([1.5, 5, 2]);
    expect(previewPosition(model, 6)).toEqual(route[1]);
    expect(previewPosition(model, 9.5)).toEqual([1.5, 5, 2]);
    expect(previewPosition(model, 14)).toEqual(route[0]);
  });
  it('handles empty, duplicate, stationary and malformed routes without NaN', () => {
    expect(previewPosition(routePreview([], 1, [0, 0]), 4)).toBeNull();
    for (const speed of [0, -1, NaN, Infinity]) {
      expect(previewPosition(routePreview(route, speed, [0, 0]), 8)).toEqual(route[0]);
    }
    expect(previewPosition(routePreview([route[0], route[0], route[1]], 1, [0, 0]), 2.5)).toEqual([1.5, 5, 2]);
    expect(previewPosition(routePreview([route[0], route[0]], 1, [0, 0]), Infinity)).toEqual(route[0]);
    expect(routePreview([[NaN, 0, 0]], 1, [0, 0]).route).toEqual([]);
    expect(routePreview(route, 1, [NaN, Infinity]).pause).toBe(0);
  });
  it('normalizes invalid timeline values and rejects negative simulation time', () => {
    for (const value of [NaN, Infinity, -Infinity, -4]) expect(timelineTime(value)).toBe(0);
    expect(timelineTime(601)).toBe(600);
    expect(previewPosition(routePreview(route, 1, [0, 0]), NaN)).toEqual(route[0]);
  });
  it('preserves all 17 source identities and routes with finite positions and authoritative floor projection', () => {
    expect(SOURCE_VISITORS).toHaveLength(17);
    expect(new Set(SOURCE_VISITORS.map(v => v.id)).size).toBe(17);
    for (const visitor of SOURCE_VISITORS) {
      const source = visitorRouteForVNext(visitor.id);
      const before = JSON.stringify(source);
      const model = routePreview(source, visitor.speed, visitor.pause);
      expect(model.route).toEqual(source);
      for (const t of [0, 1, 42, 600]) expect(previewPosition(model, t)?.every(Number.isFinite)).toBe(true);
      expect(JSON.stringify(source)).toBe(before);
    }
    expect(mapLevelForY(0)).toBe(0);
    expect(mapLevelForY(LEVEL_1_Y)).toBe(1);
  });
});
