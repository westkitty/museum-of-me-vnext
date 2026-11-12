import { describe, expect, it } from 'vitest';
import { buildMuseumSceneIndex, type SceneIndexRuntime } from '../src/workshop/SceneIndex';
import { applyWalkwayProposals, clearWalkways, protectedWalkways, walkwayIntrusion } from '../src/workshop/ClearWalkways';
import type { WorkshopPlacementManifest, WorkshopPlacementRecord } from '../src/workshop/schema';
import { validateWorkshopManifestForMuseum } from '../src/workshop/conservation';
import { addEmptyRegion, overlapsEmptyRegion, recordDecision, setLocked } from '../src/workshop/CuratorMemory';

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
const scan = (m: WorkshopPlacementManifest, shape = {}, locked?: Set<string>) =>
  clearWalkways(buildMuseumSceneIndex(m, {}, runtime(m, shape)), m, { locked });

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

describe('Clear Walkways', () => {
  it('derives every protected walkway from the scene index', () => {
    const walkways = protectedWalkways(base);
    const kinds = (kind: string) => walkways.filter((walkway) => walkway.kind === kind).length;
    expect(kinds('route')).toBe(base.route.length);
    expect(kinds('stair')).toBe(2);
    expect(kinds('exhibit-approach')).toBe(35);
    expect(kinds('installation-reach')).toBe(base.installations.length);
    expect(kinds('threshold')).toBe(2);
    expect(new Set(walkways.map((walkway) => walkway.id)).size).toBe(walkways.length);
    expect(hall).toBeDefined();
  });

  it('passes an empty museum and reports UNKNOWN rather than PASS without runtime bounds', () => {
    expect(scan(manifest()).status).toBe('PASS');
    const m = manifest(object('blocker', onRoute, { collision: 'solid' }));
    expect(clearWalkways(buildMuseumSceneIndex(m), m).status).toBe('UNKNOWN');
  });

  it('fails a solid obstruction, warns for a non-solid one, and ignores walkable or overhead objects', () => {
    const solid = scan(manifest(object('blocker', onRoute, { collision: 'solid' })));
    expect(solid.status).toBe('FAIL');
    expect(solid.findings[0]).toMatchObject({ objectId: 'blocker', severity: 'FAIL' });
    expect(solid.findings[0].walkways.map((walkway) => walkway.id)).toContain(hall.id);
    expect(scan(manifest(object('soft', onRoute))).findings[0].severity).toBe('WARNING');
    expect(scan(manifest(object('rug', onRoute)), { rug: { half: 1, bottom: -0.02, top: 0.03 } }).status).toBe('PASS');
    expect(scan(manifest(object('banner', onRoute)), { banner: { bottom: 2.4, top: 3 } }).status).toBe('PASS');
    expect(walkwayIntrusion(hall, { min: [onRoute[0] - 0.1, 0, onRoute[2] - 0.1], max: [onRoute[0] + 0.1, 1, onRoute[2] + 0.1] }))
      .toBeCloseTo(0.75, 6);
  });

  it('proposes a minimal conservation-safe move that clears every walkway, and applies only approved moves', () => {
    const m = manifest(object('blocker', allowedIntrusion, { collision: 'solid' }), object('soft', [allowedIntrusion[0], 0, allowedIntrusion[2] + 3]));
    const report = scan(m);
    expect(report.proposals.map((proposal) => proposal.objectId).sort()).toEqual(['blocker', 'soft']);
    for (const proposal of report.proposals) {
      expect(proposal.distance).toBeGreaterThan(0);
      expect(proposal.distance).toBeLessThanOrEqual(3);
      expect(proposal.to[1]).toBe(proposal.from[1]);
    }
    const onlyBlocker = applyWalkwayProposals(m, report.proposals, new Set(['blocker']));
    expect(onlyBlocker.objects.find((record) => record.id === 'soft')).toBe(m.objects[1]);
    expect(onlyBlocker.objects).toHaveLength(2);
    const rescan = scan(onlyBlocker);
    expect(rescan.findings.map((finding) => finding.objectId)).toEqual(['soft']);
    const all = applyWalkwayProposals(m, report.proposals, new Set(['blocker', 'soft']));
    expect(scan(all).status).toBe('PASS');
    // The original manifest is untouched: proposals are reversible by discarding them.
    expect(m.objects[0].position).toEqual(allowedIntrusion);
  });

  it('never moves locked placements or placements with unknown bounds', () => {
    const locked = scan(manifest(object('blocker', allowedIntrusion, { collision: 'solid' })), {}, new Set(['blocker']));
    expect(locked.proposals).toEqual([]);
    expect(locked.findings[0].locked).toBe(true);
    expect(locked.unresolved[0]).toMatchObject({ objectId: 'blocker' });
    const unknown = scan(manifest(object('loading', allowedIntrusion, { collision: 'solid' })), { loading: null });
    expect(unknown.findings[0].severity).toBe('UNKNOWN');
    expect(unknown.status).toBe('UNKNOWN');
    expect(unknown.proposals).toEqual([]);
  });

  it('does not move an object onto another placement', () => {
    // Fill the space around the blocker so its nearest free spot is further away.
    const ring: WorkshopPlacementRecord[] = [];
    for (let k = 0; k < 8; k++) {
      const angle = (k * Math.PI) / 4;
      ring.push(object(`ring-${k}`, [allowedIntrusion[0] + Math.cos(angle) * 1.6, 0, allowedIntrusion[2] + Math.sin(angle) * 1.6]));
    }
    const m = manifest(object('blocker', allowedIntrusion, { collision: 'solid' }), ...ring);
    const report = scan(m);
    const proposal = report.proposals.find((item) => item.objectId === 'blocker');
    if (!proposal) {
      expect(report.unresolved.map((item) => item.objectId)).toContain('blocker');
      return;
    }
    for (const other of ring) {
      const moved = report.proposals.find((item) => item.objectId === other.id)?.to ?? other.position;
      expect(Math.max(Math.abs(moved[0] - proposal.to[0]), Math.abs(moved[2] - proposal.to[2]))).toBeGreaterThanOrEqual(1);
    }
  });

  it('is deterministic for identical input', () => {
    const m = manifest(object('a', allowedIntrusion, { collision: 'solid' }), object('b', [allowedIntrusion[0] + 0.4, 0, allowedIntrusion[2] - 2]));
    expect(JSON.stringify(scan(m))).toBe(JSON.stringify(scan(m)));
  });
});

describe("Clear Walkways with Curator's Memory", () => {
  const blocker = () => object('blocker', allowedIntrusion, { collision: 'solid' });

  it('never proposes moving a curator-locked object, across repeated runs', () => {
    const m = setLocked(manifest(blocker()), 'blocker', true);
    for (let run = 0; run < 3; run++) {
      const report = scan(m);
      expect(report.proposals).toEqual([]);
      expect(report.findings[0]).toMatchObject({ objectId: 'blocker', locked: true });
    }
    expect(scan(setLocked(m, 'blocker', false)).proposals).toHaveLength(1);
  });

  it('keeps a rejected suggestion suppressed until the object is moved', () => {
    const m = manifest(blocker());
    const rejected = recordDecision(m, { kind: 'walkway-move', objectId: 'blocker', outcome: 'rejected', position: allowedIntrusion,
      at: new Date('2026-11-12T12:00:00Z') });
    for (let run = 0; run < 3; run++) {
      const report = scan(rejected);
      expect(report.proposals).toEqual([]);
      expect(report.unresolved[0].reason).toContain('rejected by the curator on 2026-11-12');
      // The obstruction itself is still reported; memory never hides a real problem.
      expect(report.status).toBe('FAIL');
    }
    const nudged: Vec = [allowedIntrusion[0] + 0.05, allowedIntrusion[1], allowedIntrusion[2]];
    const moved = { ...rejected, objects: [object('blocker', nudged, { collision: 'solid' })] };
    if (scan(moved).findings.length) expect(scan(moved).proposals).toHaveLength(1);
  });

  it('respects a manual override the same way as a rejection', () => {
    const m = recordDecision(manifest(blocker()), { kind: 'walkway-move', objectId: 'blocker', outcome: 'user-override',
      position: allowedIntrusion });
    expect(scan(m).proposals).toEqual([]);
    expect(scan(m).unresolved[0].reason).toContain('by hand');
  });

  it('never moves an object into a deliberately empty region', () => {
    const plain = scan(manifest(blocker()));
    const target = plain.proposals[0].to;
    const kept = addEmptyRegion(manifest(blocker()), { id: 'reading-nook', label: 'Reading nook', worldId: 'interior',
      min: [target[0] - 0.2, target[2] - 0.2], max: [target[0] + 0.2, target[2] + 0.2] });
    const report = scan(kept);
    for (const proposal of report.proposals) {
      const box = { min: [proposal.to[0] - 0.5, 0, proposal.to[2] - 0.5], max: [proposal.to[0] + 0.5, 1, proposal.to[2] + 0.5] };
      expect(overlapsEmptyRegion(kept, 'interior', box)).toBeNull();
      expect(proposal.to).not.toEqual(target);
    }
  });
});
