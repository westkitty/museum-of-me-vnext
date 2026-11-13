import { describe, expect, it } from 'vitest';
import { buildMuseumSceneIndex, type SceneIndexRuntime } from '../src/workshop/SceneIndex';
import { protectedWalkways, walkwayIntrusion } from '../src/workshop/ClearWalkways';
import type { WorkshopPlacementManifest, WorkshopPlacementRecord } from '../src/workshop/schema';
import { validateWorkshopManifestForMuseum } from '../src/workshop/conservation';
import { addEmptyRegion } from '../src/workshop/CuratorMemory';
import { museumHealth } from '../src/workshop/MuseumHealth';

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
// A point in the middle of the long south-hall route leg, inside the museum.
const legs = protectedWalkways(base).filter((walkway) => walkway.kind === 'route' && walkway.world === 'interior');
const hall = legs.find((walkway) => walkway.id !== 'route:0:interior' && walkway.path.every((p) => p[1] === 0 && p[2] > 30 && p[2] < 120)
  && Math.abs(walkway.path[0][2] - walkway.path[1][2]) > 10)!;
const onRoute: Vec = [(hall.path[0][0] + hall.path[1][0]) / 2, 0, (hall.path[0][2] + hall.path[1][2]) / 2];
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

const health = (m: WorkshopPlacementManifest, shape: Parameters<typeof runtime>[1] | false = {}) =>
  museumHealth(buildMuseumSceneIndex(m, {}, shape === false ? undefined : runtime(m, shape)), m, { runtime: shape !== false });
const check = (report: ReturnType<typeof museumHealth>, id: string) => report.checks.find((item) => item.id === id)!;

describe('Museum Health', () => {
  it('passes the protected structure and never reports untested checks as passing', () => {
    const report = health(manifest(), false);
    expect(check(report, 'structure')).toMatchObject({ status: 'PASS', affected: [] });
    expect(check(report, 'structure').detail).toContain('6/6 wings, 35/35 exhibits, 2/2 stairs, 2/2 levels');
    expect(check(report, 'conservation').status).toBe('PASS');
    for (const id of ['walkways', 'route-collision', 'bounds', 'performance', 'visitor-jury', 'exterior-jury']) {
      expect(check(report, id).status).toBe('NOT TESTED');
    }
    expect(report.status).toBe('NOT TESTED');
    expect(report.counts['NOT TESTED']).toBe(6);
  });

  it('fails when the protected structure is incomplete and names what is missing', () => {
    const index = buildMuseumSceneIndex(manifest());
    const removed = index.exhibits[7].id;
    const damaged = { ...index, exhibits: index.exhibits.filter((exhibit) => exhibit.id !== removed) };
    const structure = check(museumHealth(damaged, manifest()), 'structure');
    expect(structure.status).toBe('FAIL');
    expect(structure.affected).toEqual([expect.objectContaining({ kind: 'exhibit', id: removed })]);
  });

  it('links a walkway obstruction to the real placement and its location', () => {
    const blocker = object('blocker', allowedIntrusion, { collision: 'solid', label: 'Tall plinth' });
    const report = health(manifest(blocker));
    const walkways = check(report, 'walkways');
    expect(walkways.status).toBe('FAIL');
    expect(walkways.detail).toContain('Tall plinth');
    expect(walkways.affected).toEqual([{ kind: 'placement', id: 'blocker', label: 'Tall plinth', world: 'interior', position: allowedIntrusion }]);
    expect(report.status).toBe('FAIL');
  });

  it('reports a conservation violation against the offending placement', () => {
    const report = health(manifest(object('in-hall', onRoute)));
    const conservation = check(report, 'conservation');
    expect(conservation.status).toBe('FAIL');
    expect(conservation.affected.map((subject) => subject.id)).toEqual(['in-hall']);
  });

  it('reports unknown bounds as UNKNOWN, not PASS', () => {
    const far: Vec = [250, 0, 260];
    const m = manifest(object('loading', far, { worldId: 'exterior' }));
    const bounds = check(health(m, { loading: null }), 'bounds');
    expect(bounds.status).toBe('UNKNOWN');
    expect(bounds.affected.map((subject) => subject.id)).toEqual(['loading']);
    expect(check(health(m), 'bounds').status).toBe('PASS');
  });

  it('warns when a placement occupies an area the curator marked empty', () => {
    const far: Vec = [250, 0, 260];
    const placed = manifest(object('bench', far, { worldId: 'exterior' }));
    const region = { id: 'empty-1', label: 'Quiet lawn', worldId: 'exterior' as const, min: [249, 259] as [number, number], max: [251, 261] as [number, number] };
    const occupied = check(health(addEmptyRegion(placed, region)), 'empty-regions');
    expect(occupied.status).toBe('WARNING');
    expect(occupied.detail).toContain('Quiet lawn');
    expect(occupied.affected.map((subject) => subject.id)).toEqual(['bench']);
    const elsewhere = { ...region, min: [200, 200] as [number, number], max: [201, 201] as [number, number] };
    expect(check(health(addEmptyRegion(placed, elsewhere)), 'empty-regions').status).toBe('PASS');
  });
});
