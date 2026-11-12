import { describe, expect, it } from 'vitest';
import { buildMuseumSceneIndex, type SceneIndexRuntime } from '../src/workshop/SceneIndex';
import { protectedWalkways, walkwayIntrusion } from '../src/workshop/ClearWalkways';
import type { WorkshopPlacementManifest, WorkshopPlacementRecord } from '../src/workshop/schema';
import { validateWorkshopManifest } from '../src/workshop/schema';
import { validateWorkshopManifestForMuseum } from '../src/workshop/conservation';
import { addEmptyRegion, latestDecision, setLocked } from '../src/workshop/CuratorMemory';
import { autoCurate, applyCurateSuggestions, estimatedBounds, rejectCurateSuggestion, type CurateDensity } from '../src/workshop/AutoCurate';
import { buildMuseum } from './helpers/walk';

type Vec = [number, number, number];
/** Structural runtime giving each record a box of `half` around its position, from `bottom` to `top`. */
function runtime(manifest: WorkshopPlacementManifest, shape: Record<string, { half?: number; bottom?: number; top?: number } | null> = {}): SceneIndexRuntime {
  const byId = new Map(manifest.objects.map((record) => [record.id, record]));
  return { placements: {
    isResident: () => true,
    placementBounds: (id) => {
      const record = byId.get(id);
      const s = shape[id];
      if (!record || s === null) return null;
      const half = s?.half ?? 0.5, bottom = s?.bottom ?? 0, top = s?.top ?? 1.2;
      const [x, y, z] = record.position;
      return { min: { x: x - half, y: y + bottom, z: z - half }, max: { x: x + half, y: y + top, z: z + half } };
    },
    sceneEntries: () => [],
  } };
}
const object = (id: string, position: Vec, extra: Partial<WorkshopPlacementRecord> = {}): WorkshopPlacementRecord => ({
  id, label: id, prefab: 'sculpture-sphere', anchor: 'floor', position, rotation: [0, 0, 0], scale: [1, 1, 1],
  worldId: 'interior', ...extra,
});
const manifest = (...objects: WorkshopPlacementRecord[]): WorkshopPlacementManifest => ({ schemaVersion: 2, objects });

const base = buildMuseumSceneIndex(manifest());
/**
 * Halls are protected circulation, so a realistic obstruction sits where museum
 * conservation does allow a placement: find the first such point that still
 * intrudes on a protected walkway (exhibit approaches, interaction points).
 */
const allowedIntrusion: Vec = (() => {
  for (const walkway of protectedWalkways(base).filter((item) => item.world === 'interior' && item.kind !== 'route')) {
    const [a, b] = [walkway.path[0], walkway.path[walkway.path.length - 1]];
    for (let t = 0; t <= 1; t += 0.25) {
      for (const lateral of [0.6, -0.6, 0.9, -0.9]) {
        const dx = b[0] - a[0], dz = b[2] - a[2], len = Math.hypot(dx, dz) || 1;
        const p: Vec = [a[0] + dx * t + (-dz / len) * lateral, a[1] + (b[1] - a[1]) * t, a[2] + dz * t + (dx / len) * lateral];
        if (len === 1 && dx === 0) { p[0] = a[0] + lateral; }
        const box = { min: [p[0] - 0.5, p[1], p[2] - 0.5] as Vec, max: [p[0] + 0.5, p[1] + 1.2, p[2] + 0.5] as Vec };
        if (walkwayIntrusion(walkway, box) <= 0) continue;
        if (validateWorkshopManifestForMuseum(manifest(object('probe', p)), []).ok) return p;
      }
    }
  }
  throw new Error('No conservation-valid intruding point found');
})();

const museum = buildMuseum();
const index = (m: WorkshopPlacementManifest) => buildMuseumSceneIndex(m, { interior: museum.collision }, runtime(m));
const furnish = (m: WorkshopPlacementManifest, density: CurateDensity = 'rich', zone?: string) =>
  autoCurate(index(m), m, { mode: 'furnish', density, scope: zone ? { kind: 'zone', zone: zone as never } : { kind: 'museum' } });
const overlaps = (a: { min: readonly number[]; max: readonly number[] }, b: { min: readonly number[]; max: readonly number[] }) =>
  a.min[0] < b.max[0] && a.max[0] > b.min[0] && a.min[2] < b.max[2] && a.max[2] > b.min[2];

describe('Auto-Curate & Clear', () => {
  it('refuses to furnish without the collision world, rather than guessing', () => {
    const report = autoCurate(buildMuseumSceneIndex(manifest()), manifest(), { mode: 'furnish', density: 'rich', scope: { kind: 'museum' } });
    expect(report.suggestions).toEqual([]);
    expect(report.limitations.join(' ')).toContain('nothing was suggested');
  });

  it('suggests only safe benches: conservation-valid, clear of every walkway, exhibit and installation', () => {
    const report = furnish(manifest());
    expect(report.suggestions.length).toBeGreaterThan(5);
    const base = buildMuseumSceneIndex(manifest());
    const walkways = protectedWalkways(base).filter((walkway) => walkway.world === 'interior');
    const exhibitBoxes = base.exhibits.map(({ id, bounds: { c, h } }) => ({ id, min: [c[0] - h[0], c[1] - h[1], c[2] - h[2]], max: [c[0] + h[0], c[1] + h[1], c[2] + h[2]] }));
    for (const suggestion of report.suggestions) {
      expect(suggestion.kind).toBe('add');
      const record = suggestion.record!;
      expect(validateWorkshopManifestForMuseum(manifest(record), []).ok).toBe(true);
      expect(walkways.every((walkway) => walkwayIntrusion(walkway, estimatedBounds(record)) === 0)).toBe(true);
      // Inside its own exhibit's bay, outside every other bay, and clear of the display itself.
      const own = base.exhibits.find((exhibit) => suggestion.id === `curate-bench-${exhibit.id.toLowerCase()}`)!;
      const box = estimatedBounds(record);
      const bay = exhibitBoxes.find((item) => item.id === own.id)!;
      expect(box.min[0] >= bay.min[0] && box.max[0] <= bay.max[0] && box.min[2] >= bay.min[2] && box.max[2] <= bay.max[2]).toBe(true);
      const overlaps3d = (a: typeof box, b: typeof bay) => overlaps(a, b) && a.min[1] < b.max[1] && a.max[1] > b.min[1];
      expect(exhibitBoxes.some((item) => item.id !== own.id && overlaps3d(box, item))).toBe(false);
      expect(Math.hypot(record.position[0] - own.anchor[0], record.position[2] - own.anchor[2])).toBeGreaterThanOrEqual(3);
    }
    const ids = report.suggestions.map((suggestion) => suggestion.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Benches keep their spacing from one another.
    for (const a of report.suggestions) for (const b of report.suggestions) {
      if (a !== b && Math.abs(a.to[1] - b.to[1]) < 2) expect(Math.hypot(a.to[0] - b.to[0], a.to[2] - b.to[2])).toBeGreaterThanOrEqual(4);
    }
    // The whole result is a valid manifest if every suggestion were approved.
    const all = applyCurateSuggestions(manifest(), report.suggestions, new Set(ids));
    expect(validateWorkshopManifestForMuseum(all, []).errors).toEqual([]);
  });

  it('respects density and scope, and is deterministic', () => {
    const counts = (['minimal', 'restrained', 'rich'] as const).map((density) => furnish(manifest(), density).suggestions.length);
    expect(counts[0]).toBeLessThan(counts[1]);
    expect(counts[1]).toBeLessThan(counts[2]);
    const minimal = furnish(manifest(), 'minimal').suggestions;
    expect(new Set(minimal.map((suggestion) => suggestion.zone)).size).toBe(minimal.length);
    const zone = minimal[0].zone;
    const scoped = furnish(manifest(), 'rich', zone).suggestions;
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.every((suggestion) => suggestion.zone === zone)).toBe(true);
    expect(JSON.stringify(furnish(manifest()))).toBe(JSON.stringify(furnish(manifest())));
  });

  it('applies only approved suggestions, remembers approval and rejection, and never re-proposes them', () => {
    const first = furnish(manifest(), 'rich').suggestions;
    const [approve, reject] = first;
    const at = new Date('2026-11-12T12:00:00Z');
    expect(applyCurateSuggestions(manifest(), first, new Set())).toEqual(manifest());
    let m = applyCurateSuggestions(manifest(), first, new Set([approve.id]), at);
    expect(m.objects.map((record) => record.id)).toEqual([approve.id]);
    expect(latestDecision(m, 'furnish-add', approve.id)?.outcome).toBe('approved');
    m = rejectCurateSuggestion(m, reject, at);
    expect(validateWorkshopManifest(JSON.parse(JSON.stringify(m))).errors).toEqual([]);
    const again = furnish(m, 'rich');
    expect(again.suggestions.map((suggestion) => suggestion.id)).not.toContain(approve.id);
    expect(again.suggestions.map((suggestion) => suggestion.id)).not.toContain(reject.id);
    expect(again.skipped.find((item) => item.id === reject.id)?.reason).toContain('rejected by the curator');
  });

  it('never furnishes inside an area the curator keeps empty', () => {
    const target = furnish(manifest(), 'rich').suggestions[0];
    const region = { id: 'keep-clear', label: 'Keep clear', worldId: 'interior' as const,
      min: [target.to[0] - 3, target.to[2] - 3] as [number, number], max: [target.to[0] + 3, target.to[2] + 3] as [number, number] };
    const m = addEmptyRegion(manifest(), region);
    for (const suggestion of furnish(m, 'rich').suggestions) {
      expect(overlaps(suggestion.bounds, { min: [region.min[0], 0, region.min[1]], max: [region.max[0], 0, region.max[1]] })).toBe(false);
    }
  });

  it('clears walkways in clear and combined modes, honours locks, and keeps new benches off moved objects', () => {
    const blocker = object('blocker', allowedIntrusion, { collision: 'solid' });
    const m = manifest(blocker);
    const clear = autoCurate(index(m), m, { mode: 'clear', density: 'rich', scope: { kind: 'museum' } });
    expect(clear.suggestions).toEqual([expect.objectContaining({ id: 'blocker', kind: 'move', from: allowedIntrusion })]);
    const locked = setLocked(m, 'blocker', true);
    expect(autoCurate(index(locked), locked, { mode: 'clear', density: 'rich', scope: { kind: 'museum' } }).suggestions).toEqual([]);
    const both = autoCurate(index(m), m, { mode: 'both', density: 'rich', scope: { kind: 'museum' } });
    const move = both.suggestions.find((suggestion) => suggestion.kind === 'move')!;
    expect(move.id).toBe('blocker');
    for (const add of both.suggestions.filter((suggestion) => suggestion.kind === 'add')) expect(overlaps(add.bounds, move.bounds)).toBe(false);
  });
});
