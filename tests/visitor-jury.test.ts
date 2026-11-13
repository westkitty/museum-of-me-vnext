import { describe, expect, it } from 'vitest';
import { buildMuseumSceneIndex, type SceneBounds, type SceneIndexRuntime } from '../src/workshop/SceneIndex';
import { museumHealth } from '../src/workshop/MuseumHealth';
import { visitorJury, type VisitorJuryReport } from '../src/workshop/VisitorJury';
import type { WorkshopPlacementManifest, WorkshopPlacementRecord } from '../src/workshop/schema';
import type { Vec3 } from '../src/world/layout';
import { buildMuseum } from './helpers/walk';

type Vec = [number, number, number];
const museum = buildMuseum();

/** Structural runtime giving each record the exact world box listed for it (null: bounds not known yet). */
function runtime(boxes: Record<string, SceneBounds | null>): SceneIndexRuntime {
  return { placements: {
    isResident: () => true,
    sceneEntries: () => [],
    placementBounds: (id) => {
      const box = boxes[id];
      if (!box) return null;
      return { min: { x: box.min[0], y: box.min[1], z: box.min[2] }, max: { x: box.max[0], y: box.max[1], z: box.max[2] } };
    },
  } };
}
const record = (id: string, position: Vec, collision: 'solid' | 'none' = 'solid'): WorkshopPlacementRecord => ({
  id, label: `Test ${id}`, prefab: 'display-plinth', anchor: 'floor', position, rotation: [0, 0, 0], scale: [1, 1, 1],
  worldId: 'interior', collision,
});
const box = (c: Vec3, hx: number, hz: number, bottom = 0, top = 2.4): SceneBounds => ({
  min: [c[0] - hx, c[1] + bottom, c[2] - hz], max: [c[0] + hx, c[1] + top, c[2] + hz] });

/** Run the jury against the real interior collision world with placements of known bounds. */
function jury(objects: { record: WorkshopPlacementRecord; bounds: SceneBounds | null }[] = []): VisitorJuryReport {
  const manifest: WorkshopPlacementManifest = { schemaVersion: 2, objects: objects.map((item) => item.record) };
  const index = buildMuseumSceneIndex(manifest, { interior: museum.collision },
    runtime(Object.fromEntries(objects.map((item) => [item.record.id, item.bounds]))));
  return visitorJury(index, manifest, museum.collision);
}

const base = buildMuseumSceneIndex({ schemaVersion: 2, objects: [] });
const exhibit = (id: string) => base.exhibits.find((item) => item.id === id)!;
const hallPoint = (id: string) => base.route.find((point) => point.label === `${exhibit(id).wing}: outside ${id}`)!.position;
const lerp = (a: Vec3, b: Vec3, t: number): Vec => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** A thin solid wall across the walking line from `a` toward `b` at fraction `t`, `half` metres either side. */
function across(a: Vec3, b: Vec3, t: number, half: number): { position: Vec; bounds: SceneBounds } {
  const position = lerp(a, b, t);
  const alongX = Math.abs(b[0] - a[0]) > Math.abs(b[2] - a[2]);
  return { position, bounds: box(position, alongX ? 0.3 : half, alongX ? half : 0.3) };
}

const clean = jury();

describe('Virtual Visitor Jury', () => {
  it('walks all 35 exhibits on the unmodified museum and passes every one, with real movement', () => {
    expect(clean.exhibits).toHaveLength(35);
    for (const item of clean.exhibits) {
      expect(item.status, `${item.exhibitId}: ${item.reached.detail} ${item.visible.detail} ${item.returns.detail}`).toBe('PASS');
      expect(item.reached.status).toBe('PASS');
      expect(item.visible.status).toBe('PASS');
      expect(item.returns.status).toBe('PASS');
      // The visitor actually stood at the bay's visitor spot (within one stride), on its floor.
      const spot = exhibit(item.exhibitId).visitorSpot;
      expect(item.arrival).not.toBeNull();
      expect(Math.hypot(item.arrival![0] - spot[0], item.arrival![2] - spot[2])).toBeLessThanOrEqual(0.28);
      expect(Math.abs(item.arrival![1] - spot[1])).toBeLessThan(0.6);
    }
    expect(clean.counts.PASS).toBe(35);
    expect(clean.status).toBe('PASS');
    expect(clean.walked.steps).toBeGreaterThan(5000);
    expect(clean.walked.metres).toBeGreaterThan(2000);
  });

  it('covers both floors, both stairs up and down, the Sanctuary and every major route section', () => {
    expect(clean.floors).toEqual([{ level: 0, status: 'PASS', exhibits: 29 }, { level: 1, status: 'PASS', exhibits: 6 }]);
    expect(clean.stairs.map((stair) => [stair.id, stair.status])).toEqual([['stair:grand-stair-sw', 'PASS'], ['stair:grand-stair-se', 'PASS']]);
    for (const stair of clean.stairs) {
      expect(stair.legs).toBeGreaterThanOrEqual(2 * 14);
      expect(stair.detail).toMatch(/Walked up .* and back down/);
    }
    expect(clean.sanctuary.status).toBe('PASS');
    expect(clean.sanctuary.detail).toMatch(/down into the Sanctuary .* and back to the main entrance/);
    const routes = clean.routes.map((route) => route.id);
    for (const id of ['canonical', 'entrance', 'rotunda', 'stairs', 'balcony', 'sanctuary-route',
      'hall:north', 'hall:east', 'hall:south', 'hall:west', 'hall:media', 'hall:infra']) expect(routes).toContain(id);
    for (const route of clean.routes) expect(route.status, route.id).toBe('PASS');
    expect(clean.routes.find((route) => route.id === 'canonical')!.legs).toBe(base.route.length - 1);
    // Upper-floor exhibits were genuinely reached by walking up a stair.
    for (const item of clean.exhibits.filter((entry) => entry.level === 1)) expect(item.arrival![1]).toBeGreaterThan(9);
  });

  it('is deterministic', () => {
    expect(jury()).toEqual(clean);
  });

  it('fails an exhibit, naming the placed object, when a solid object blocks its approach', () => {
    const wall = across(hallPoint('E03'), exhibit('E03').visitorSpot, 0.5, 4);
    const report = jury([{ record: record('approach-blocker', wall.position), bounds: wall.bounds }]);
    const e03 = report.exhibits.find((item) => item.exhibitId === 'E03')!;
    expect(e03.status).toBe('FAIL');
    expect(e03.reached.status).toBe('FAIL');
    expect(e03.reached.affected.map((item) => item.id)).toContain('approach-blocker');
    expect(e03.reached.detail).toContain('Test approach-blocker');
    expect(e03.reached.affected.find((item) => item.id === 'approach-blocker')!.position).not.toBeNull();
    // The visitor really stopped against it, not at the spot.
    expect(Math.hypot(e03.arrival![0] - exhibit('E03').visitorSpot[0], e03.arrival![2] - exhibit('E03').visitorSpot[2])).toBeGreaterThan(4.2);
    // Every other exhibit is unaffected; the canonical route fails at that bay.
    expect(report.exhibits.filter((item) => item.status !== 'PASS').map((item) => item.exhibitId)).toEqual(['E03']);
    expect(report.routes.find((route) => route.id === 'hall:north')!.status).toBe('FAIL');
    expect(report.status).toBe('FAIL');
  });

  it('warns rather than fails when the visitor is stopped inside interaction reach of the spot', () => {
    const wall = across(hallPoint('E19'), exhibit('E19').visitorSpot, 0.85, 4);
    const report = jury([{ record: record('late-blocker', wall.position), bounds: wall.bounds }]);
    const e19 = report.exhibits.find((item) => item.exhibitId === 'E19')!;
    expect(e19.reached.status).toBe('WARNING');
    expect(e19.reached.affected.map((item) => item.id)).toEqual(['late-blocker']);
    expect(e19.reached.detail).toContain('inside the 4.2 m interaction reach');
  });

  it('judges the return from where the visitor actually stood', () => {
    // The visitor is stopped on the hall side of this wall, so walking back out from there succeeds.
    const wall = across(hallPoint('E26'), exhibit('E26').visitorSpot, 0.3, 4);
    const e26 = jury([{ record: record('bay-blocker', wall.position), bounds: wall.bounds }]).exhibits.find((item) => item.exhibitId === 'E26')!;
    expect(e26.reached.status).toBe('FAIL');
    expect(e26.returns.status).toBe('PASS');
    expect(e26.returns.detail).toContain('from where the visitor stood back to the main entrance');
  });

  it('fails every exhibit beyond a blocked hall but keeps those before it', () => {
    // Across the whole north hall between E02 and E03.
    const a = hallPoint('E02'), b = hallPoint('E03');
    const wall = across(a, b, 0.5, 9);
    const report = jury([{ record: record('hall-blocker', wall.position), bounds: wall.bounds }]);
    const status = (id: string) => report.exhibits.find((item) => item.exhibitId === id)!;
    expect(status('E01').status).toBe('PASS');
    expect(status('E02').status).toBe('PASS');
    for (const id of ['E03', 'E05', 'E08']) {
      expect(status(id).reached.status).toBe('FAIL');
      expect(status(id).reached.detail).toContain('Never reached the north hall');
      expect(status(id).reached.affected.map((item) => item.id)).toContain('hall-blocker');
      // Never arrived, so the return is walked from the visitor spot and fails at the same wall.
      expect(status(id).arrival).toBeNull();
      expect(status(id).returns.status).toBe('FAIL');
      expect(status(id).returns.affected.map((item) => item.id)).toContain('hall-blocker');
      expect(status(id).returns.detail).toContain('blocked by Test hall-blocker');
    }
    expect(status('E17').status).toBe('PASS');
  });

  it('fails hero visibility when an authored object blocks the eye-height sightline, and warns when it crowds it', () => {
    const e = exhibit('E05');
    const mid = lerp(e.visitorSpot, e.anchor, 0.45);
    const blocking = jury([{ record: record('view-blocker', mid, 'none'), bounds: box(mid, 0.3, 0.3, 0, 2.6) }]);
    const blocked = blocking.exhibits.find((item) => item.exhibitId === 'E05')!;
    expect(blocked.reached.status).toBe('PASS');
    expect(blocked.visible.status).toBe('FAIL');
    expect(blocked.visible.affected.map((item) => item.id)).toEqual(['view-blocker']);
    expect(blocked.visible.detail).toContain('Test view-blocker');

    // Beside the sightline, inside its 0.5 m corridor but clear of the centre ray.
    const alongX = Math.abs(e.anchor[0] - e.visitorSpot[0]) > Math.abs(e.anchor[2] - e.visitorSpot[2]);
    const side: Vec = alongX ? [mid[0], mid[1], mid[2] + 0.6] : [mid[0] + 0.6, mid[1], mid[2]];
    const crowding = jury([{ record: record('view-crowder', side, 'none'), bounds: box(side, 0.2, 0.2, 0, 2.6) }]);
    const crowded = crowding.exhibits.find((item) => item.exhibitId === 'E05')!;
    expect(crowded.visible.status).toBe('WARNING');
    expect(crowded.visible.affected.map((item) => item.id)).toEqual(['view-crowder']);
  });

  it('warns when a non-solid object stands in the walking path, since the visitor walks through it', () => {
    const wall = across(hallPoint('E10'), exhibit('E10').visitorSpot, 0.5, 0.4);
    const e10 = jury([{ record: record('ghost', wall.position, 'none'), bounds: wall.bounds }]).exhibits.find((item) => item.exhibitId === 'E10')!;
    expect(e10.reached.status).toBe('WARNING');
    expect(e10.reached.affected.map((item) => item.id)).toEqual(['ghost']);
  });

  it('fails a stair, and its floor, when a solid object blocks the treads', () => {
    const stair = base.stairs.find((item) => item.id === 'grand-stair-se')!;
    const mid = stair.path[6];
    const report = jury([{ record: record('stair-blocker', [mid[0], mid[1], mid[2]]), bounds: box(mid, 2.2, 2.2, -0.5, 2.4) }]);
    const se = report.stairs.find((item) => item.id === 'stair:grand-stair-se')!;
    expect(se.status).toBe('FAIL');
    expect(se.affected.map((item) => item.id)).toContain('stair-blocker');
    expect(report.stairs.find((item) => item.id === 'stair:grand-stair-sw')!.status).toBe('PASS');
    expect(report.floors.find((floor) => floor.level === 1)!.status).toBe('FAIL');
  });

  it('fails the Sanctuary when its ramp is blocked', () => {
    const descent = base.route.find((point) => point.label === 'sanctuary descent')!.position;
    const threshold = base.route.find((point) => point.label === 'sanctuary threshold')!.position;
    const wall = across(threshold, descent, 0.5, 6);
    const report = jury([{ record: record('sanctuary-blocker', wall.position), bounds: box(wall.position, Math.abs(wall.bounds.max[0] - wall.bounds.min[0]) / 2, Math.abs(wall.bounds.max[2] - wall.bounds.min[2]) / 2, -3, 3) }]);
    expect(report.sanctuary.status).toBe('FAIL');
    expect(report.sanctuary.affected.map((item) => item.id)).toContain('sanctuary-blocker');
    expect(report.routes.find((route) => route.id === 'sanctuary-route')!.status).toBe('FAIL');
  });

  it('reports UNKNOWN, never PASS, when a placement near a path has no known bounds yet', () => {
    const at = lerp(hallPoint('E21'), exhibit('E21').visitorSpot, 0.5);
    const e21 = jury([{ record: record('loading-model', at), bounds: null }]).exhibits.find((item) => item.exhibitId === 'E21')!;
    expect(e21.reached.status).toBe('UNKNOWN');
    expect(e21.reached.affected.map((item) => item.id)).toEqual(['loading-model']);
  });

  it('is NOT TESTED without a collision world', () => {
    const report = visitorJury(base, { schemaVersion: 2, objects: [] }, null);
    expect(report.status).toBe('NOT TESTED');
    expect(report.exhibits.every((item) => item.status === 'NOT TESTED')).toBe(true);
    expect(report.walked.steps).toBe(0);
  });

  it('feeds Museum Health only when a jury result is supplied', () => {
    const manifest: WorkshopPlacementManifest = { schemaVersion: 2, objects: [] };
    const check = (report: ReturnType<typeof museumHealth>) => report.checks.find((item) => item.id === 'visitor-jury')!;
    expect(check(museumHealth(base, manifest)).status).toBe('NOT TESTED');
    expect(check(museumHealth(base, manifest, { jury: clean }))).toMatchObject({ status: 'PASS', affected: [] });

    const wall = across(hallPoint('E03'), exhibit('E03').visitorSpot, 0.5, 4);
    const blocked: WorkshopPlacementManifest = { schemaVersion: 2, objects: [record('approach-blocker', wall.position)] };
    const failing = jury([{ record: blocked.objects[0], bounds: wall.bounds }]);
    const health = check(museumHealth(buildMuseumSceneIndex(blocked), blocked, { jury: failing }));
    expect(health.status).toBe('FAIL');
    expect(health.affected).toContainEqual(expect.objectContaining({ kind: 'placement', id: 'approach-blocker', world: 'interior' }));
  });
});
